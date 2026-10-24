import { MatchStatus } from '../../contracts/catalog';
import { IntegrationFailureCode } from '../../contracts/network';
import type { Scheduler } from '../../contracts/network';
import { SharedPlaybackStatus } from '../../contracts/sharedPlayback';
import type { SharedPlaybackClock, SharedPlaybackFollower, SharedPlaybackIdentity, SharedPlaybackLease, SharedPlaybackOutput,
  SharedPlaybackExecution, SharedPlaybackRecordingResolver, SharedPlaybackSnapshot, SharedPlaybackTarget } from '../../contracts/sharedPlayback';
import { withCancellation } from '../network/Cancellation';
import { failureCode, IntegrationFailure } from '../network/IntegrationFailure';
import { capturePlaybackIdentity, capturePlaybackTarget, localPlaybackPosition, playbackTargetFresh, samePlaybackIdentity,
  SharedPlaybackPolicy, targetPlaybackPosition } from './SharedPlaybackTiming';

const EmptySnapshot: SharedPlaybackSnapshot = Object.freeze({ status: SharedPlaybackStatus.Detached, identity: null,
  occurrenceIdentifier: null, recordingIdentifier: null, sequence: null, driftMilliseconds: null, failure: null });

interface PlaybackLifetime {
  readonly identity: SharedPlaybackIdentity;
  readonly cancellation: AbortController;
  lease: SharedPlaybackLease | null;
  target: SharedPlaybackTarget | null;
  preparedOccurrence: string | null;
  recordingIdentifier: string | null;
  pending: Promise<void> | null;
  cancelTimer: (() => void) | null;
  paused: boolean;
  failed: boolean;
  outputPending: Promise<void>;
}

export class SharedPlaybackSynchronizer implements SharedPlaybackFollower {
  private snapshot = EmptySnapshot;
  private lifetime: PlaybackLifetime | null = null;
  private readonly listeners = new Set<() => void>();
  private releasePending: Promise<void> = Promise.resolve();
  private attachmentIntent: object = Object.freeze({});

  constructor(private readonly output: SharedPlaybackOutput, private readonly resolver: SharedPlaybackRecordingResolver,
    private readonly clock: SharedPlaybackClock, private readonly scheduler: Scheduler) {}

  getSnapshot = (): SharedPlaybackSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  async attach(identity: SharedPlaybackIdentity): Promise<void> {
    const captured = capturePlaybackIdentity(identity);
    const attachmentIntent = Object.freeze({}); this.attachmentIntent = attachmentIntent;
    const retired = this.retire();
    if (this.attachmentIntent !== attachmentIntent) { await retired; return; }
    const lifetime: PlaybackLifetime = { identity: captured, cancellation: new AbortController(), lease: null, target: null,
      preparedOccurrence: null, recordingIdentifier: null, pending: null, cancelTimer: null, paused: true, failed: false, outputPending: Promise.resolve() };
    this.lifetime = lifetime;
    this.publish({ ...EmptySnapshot, identity: captured, status: SharedPlaybackStatus.Waiting });
    try {
      await retired;
      if (!this.canFollow(lifetime)) return;
      const acquired = this.output.acquire(captured, lifetime.cancellation.signal).then(async lease => {
        if (!this.canFollow(lifetime)) { await lease.release(); return; }
        lifetime.lease = lease;
      });
      await withCancellation(acquired, lifetime.cancellation.signal);
      if (!this.canFollow(lifetime)) return;
      await this.reconcile();
    } catch (failure) { if (this.canFollow(lifetime)) await this.fail(lifetime, failure); }
  }

  accept(target: SharedPlaybackTarget): Promise<void> {
    const lifetime = this.lifetime;
    if (!lifetime || lifetime.failed) return Promise.resolve();
    try {
      if (!samePlaybackIdentity(capturePlaybackIdentity(target), lifetime.identity)) return Promise.resolve();
    } catch { return Promise.resolve(); }
    let captured: SharedPlaybackTarget;
    try { captured = capturePlaybackTarget(target, this.clock.nowMonotonicMilliseconds()); }
    catch (failure) { return this.fail(lifetime, failure); }
    if (!samePlaybackIdentity(captured, lifetime.identity)) return Promise.resolve();
    if (lifetime.target && captured.sequence <= lifetime.target.sequence) return Promise.resolve();
    if (lifetime.target?.occurrenceIdentifier === captured.occurrenceIdentifier
      && lifetime.target.spotifyTrackIdentifier !== captured.spotifyTrackIdentifier) return this.fail(lifetime, new IntegrationFailure(IntegrationFailureCode.InvalidResponse));
    lifetime.target = captured;
    return this.reconcile();
  }

  reconcile(): Promise<void> {
    const lifetime = this.lifetime;
    if (!lifetime || lifetime.failed || !lifetime.lease || !lifetime.target) return Promise.resolve();
    lifetime.cancelTimer?.(); lifetime.cancelTimer = null;
    if (lifetime.pending) return lifetime.pending;
    lifetime.pending = Promise.resolve().then(() => this.follow(lifetime)).catch(failure => {
      if (this.canFollow(lifetime)) return this.fail(lifetime, failure);
    }).finally(() => {
      lifetime.pending = null;
      if (this.current(lifetime) && !lifetime.failed && this.snapshot.status !== SharedPlaybackStatus.Unavailable) lifetime.cancelTimer = this.scheduler.schedule(
        SharedPlaybackPolicy.reconcileIntervalMilliseconds, () => { lifetime.cancelTimer = null; void this.reconcile(); });
    });
    return lifetime.pending;
  }

  detach(): Promise<void> {
    this.attachmentIntent = Object.freeze({});
    return this.retire();
  }

  private retire(): Promise<void> {
    const lifetime = this.lifetime;
    this.lifetime = null;
    if (lifetime) {
      lifetime.cancellation.abort(); lifetime.cancelTimer?.(); lifetime.cancelTimer = null;
      const cleanup = async () => {
        await lifetime.pending?.catch(() => undefined);
        await lifetime.lease?.release();
      };
      this.releasePending = this.releasePending.then(cleanup, cleanup);
    }
    this.publish(EmptySnapshot);
    return this.releasePending;
  }

  private async follow(lifetime: PlaybackLifetime): Promise<void> {
    while (this.canFollow(lifetime) && lifetime.target && lifetime.lease) {
      const target = lifetime.target;
      if (!playbackTargetFresh(target, this.clock.nowMonotonicMilliseconds())) {
        await this.hold(lifetime);
        if (!this.canFollow(lifetime)) return;
        if (lifetime.target !== target) continue;
        this.update(lifetime, SharedPlaybackStatus.Stale);
        if (lifetime.target !== target) continue;
        return;
      }
      if (lifetime.preparedOccurrence !== target.occurrenceIdentifier) {
        await this.hold(lifetime);
        if (!this.canFollow(lifetime)) return;
        this.update(lifetime, SharedPlaybackStatus.Resolving);
        if (!this.canFollow(lifetime)) return;
        const match = await withCancellation(this.resolver.resolve(target.spotifyTrackIdentifier, lifetime.cancellation.signal), lifetime.cancellation.signal);
        if (!this.canFollow(lifetime)) return;
        if (lifetime.target?.occurrenceIdentifier !== target.occurrenceIdentifier) continue;
        if (match.status !== MatchStatus.Matched || !match.selected) {
          if (match.status === MatchStatus.Failed) throw new IntegrationFailure(match.failure ?? IntegrationFailureCode.Network);
          this.update(lifetime, SharedPlaybackStatus.Unavailable);
          if (lifetime.target !== target) continue;
          return;
        }
        this.update(lifetime, SharedPlaybackStatus.Preparing);
        if (!this.canFollow(lifetime)) return;
        await withCancellation(lifetime.lease.prepare(match.selected.identifier, target.occurrenceIdentifier,
          lifetime.cancellation.signal), lifetime.cancellation.signal);
        if (!this.canFollow(lifetime)) return;
        lifetime.preparedOccurrence = target.occurrenceIdentifier;
        lifetime.recordingIdentifier = match.selected.identifier;
        lifetime.paused = true;
        if (lifetime.target?.occurrenceIdentifier !== target.occurrenceIdentifier) continue;
      }
      const sampledTarget = lifetime.target;
      const sample = await withCancellation(lifetime.lease.sample(lifetime.cancellation.signal), lifetime.cancellation.signal);
      if (!this.canFollow(lifetime)) return;
      if (lifetime.target !== sampledTarget) continue;
      const now = this.clock.nowMonotonicMilliseconds();
      if (!playbackTargetFresh(sampledTarget, now)) continue;
      if (sample.occurrenceIdentifier !== lifetime.preparedOccurrence) throw new IntegrationFailure(IntegrationFailureCode.Superseded);
      const localPosition = localPlaybackPosition(sample, now);
      lifetime.paused = !sample.playing;
      if (!sample.ready || sample.buffering || sampledTarget.buffering) {
        await this.hold(lifetime);
        if (!this.canFollow(lifetime)) return;
        if (lifetime.target !== sampledTarget) continue;
        this.update(lifetime, SharedPlaybackStatus.Buffering);
        if (lifetime.target !== sampledTarget) continue;
        return;
      }
      const sourcePosition = targetPlaybackPosition(sampledTarget, now);
      if (sample.durationMilliseconds !== undefined && sample.durationMilliseconds !== null
        && sampledTarget.playing && sourcePosition >= sample.durationMilliseconds && sampledTarget.durationMilliseconds > sample.durationMilliseconds) {
        await this.hold(lifetime);
        if (!this.canFollow(lifetime)) return;
        if (lifetime.target !== sampledTarget) continue;
        this.update(lifetime, SharedPlaybackStatus.Unavailable, IntegrationFailureCode.Unsupported);
        if (lifetime.target !== sampledTarget) continue;
        return;
      }
      const position = Math.min(sourcePosition, sample.durationMilliseconds ?? sampledTarget.durationMilliseconds);
      const playing = sampledTarget.playing && position < sampledTarget.durationMilliseconds;
      const drift = position - localPosition;
      const seek = Math.abs(drift) > SharedPlaybackPolicy.correctionThresholdMilliseconds + sampledTarget.uncertaintyMilliseconds + sample.uncertaintyMilliseconds;
      if (seek && !sample.seekable) throw new IntegrationFailure(IntegrationFailureCode.Unsupported);
      if (seek || sample.playing !== playing) {
        lifetime.paused = false;
        await this.applyExecution(lifetime, { occurrenceIdentifier: sampledTarget.occurrenceIdentifier,
          positionMilliseconds: position, playing, seek });
        if (!this.canFollow(lifetime)) return;
        lifetime.paused = !playing;
      }
      if (lifetime.target !== sampledTarget) continue;
      this.publish({ status: SharedPlaybackStatus.Following, identity: lifetime.identity,
        occurrenceIdentifier: sampledTarget.occurrenceIdentifier, recordingIdentifier: lifetime.recordingIdentifier,
        sequence: sampledTarget.sequence, driftMilliseconds: drift, failure: null });
      if (lifetime.target !== sampledTarget) continue;
      return;
    }
  }

  private async hold(lifetime: PlaybackLifetime): Promise<void> {
    if (!lifetime.lease || lifetime.paused) return;
    if (lifetime.preparedOccurrence !== null) await this.applyExecution(lifetime, {
      occurrenceIdentifier: lifetime.preparedOccurrence, positionMilliseconds: SharedPlaybackPolicy.minimumMilliseconds,
      playing: false, seek: false }, true);
    lifetime.paused = true;
  }

  private async fail(lifetime: PlaybackLifetime, failure: unknown): Promise<void> {
    if (!this.current(lifetime)) return;
    lifetime.failed = true; lifetime.cancelTimer?.(); lifetime.cancelTimer = null;
    try { await this.hold(lifetime); } catch { try { await lifetime.lease?.release(); } catch {} }
    if (this.current(lifetime)) this.update(lifetime, SharedPlaybackStatus.Failed, failureCode(failure));
  }

  private update(lifetime: PlaybackLifetime, status: SharedPlaybackStatus, failure: IntegrationFailureCode | null = null): void {
    this.publish({ status, identity: lifetime.identity, occurrenceIdentifier: lifetime.target?.occurrenceIdentifier ?? null,
      recordingIdentifier: lifetime.recordingIdentifier, sequence: lifetime.target?.sequence ?? null,
      driftMilliseconds: null, failure });
  }

  private current(lifetime: PlaybackLifetime): boolean { return this.lifetime === lifetime && !lifetime.cancellation.signal.aborted; }
  private canFollow(lifetime: PlaybackLifetime): boolean { return this.current(lifetime) && !lifetime.failed; }
  private applyExecution(lifetime: PlaybackLifetime, execution: SharedPlaybackExecution, holding = false): Promise<void> {
    const operation = lifetime.outputPending.then(async () => {
      if (!(holding ? this.current(lifetime) : this.canFollow(lifetime)) || !lifetime.lease) throw new IntegrationFailure(IntegrationFailureCode.Canceled);
      await lifetime.lease.apply(execution, lifetime.cancellation.signal);
    });
    lifetime.outputPending = operation.catch(() => undefined);
    return withCancellation(operation, lifetime.cancellation.signal);
  }
  private publish(snapshot: SharedPlaybackSnapshot): void {
    this.snapshot = Object.freeze(snapshot);
    for (const listener of this.listeners) { try { listener(); } catch {} }
  }
}
