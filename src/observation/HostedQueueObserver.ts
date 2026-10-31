import { HostedQueueStatus } from '../../contracts/hostedQueue';
import type { HostedQueueObservation, HostedQueueReader, HostedQueueSnapshot, JamGuestObservationVerifier } from '../../contracts/hostedQueue';
import { IntegrationFailureCode } from '../../contracts/network';
import type { Clock, Scheduler } from '../../contracts/network';
import { JamConnectionStatus } from '../../contracts/session';
import type { ExternalStore, JamSnapshot } from '../../contracts/session';
import { withCancellation } from '../network/Cancellation';
import { failureCode, IntegrationFailure } from '../network/IntegrationFailure';
import { copyHostedQueueResponse, HostedQueuePolicy } from './HostedQueueValues';

interface ObservationIdentity {
  readonly accountIdentifier: string;
  readonly sessionIdentifier: string;
  readonly hostDeviceIdentifier: string;
}

interface PendingObservation {
  readonly identity: ObservationIdentity;
  readonly cancellation: AbortController;
  promise: Promise<void>;
}

const EmptyResponse = Object.freeze({ currentlyPlaying: null, entries: Object.freeze([]), observedAtMilliseconds: null });

export class HostedQueueObserver implements HostedQueueObservation {
  private snapshot: HostedQueueSnapshot;
  private pending: PendingObservation | null = null;
  private snapshotIdentity: ObservationIdentity | null = null;
  private observing = false;
  private active = true;
  private disposed = false;
  private pollPaused = false;
  private retryAtMilliseconds: number | null = null;
  private cancelPoll: (() => void) | null = null;
  private readonly listeners = new Set<() => void>();
  private readonly stopSessionObservation: () => void;

  constructor(private readonly sessions: ExternalStore<JamSnapshot>, private readonly reader: HostedQueueReader,
    private readonly clock: Clock, private readonly enabled = false, private readonly scheduler?: Scheduler, private readonly guestVerifier?: JamGuestObservationVerifier) {
    this.snapshot = Object.freeze({ ...EmptyResponse, enabled,
      status: enabled ? HostedQueueStatus.Idle : HostedQueueStatus.Detached,
      sessionIdentifier: null, hostDeviceIdentifier: null, failure: null });
    this.stopSessionObservation = sessions.subscribe(() => this.sessionChanged());
  }

  getSnapshot = (): HostedQueueSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  refresh(): Promise<void> {
    this.pollPaused = false;
    return this.read();
  }

  setObserving(observing: boolean): void {
    if (this.disposed || observing === this.observing) return;
    this.observing = observing;
    if (!observing) this.suspend();
    else this.resume();
  }

  setActive(active: boolean): void {
    if (this.disposed || active === this.active) return;
    this.active = active;
    if (!active) this.suspend();
    else this.resume();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopSessionObservation();
    this.invalidate();
    this.publish({ ...EmptyResponse, enabled: false, status: HostedQueueStatus.Detached,
      sessionIdentifier: null, hostDeviceIdentifier: null, failure: null });
    this.listeners.clear();
  }

  private read(): Promise<void> {
    if (this.pending !== null) return this.pending.promise;
    if (this.disposed) return Promise.resolve();
    if (!this.enabled) { this.publish({ ...this.snapshot, failure: IntegrationFailureCode.Unsupported }); return Promise.resolve(); }
    if (!this.active) return Promise.resolve();
    this.stopPoll();
    let identity: ObservationIdentity;
    try { identity = this.captureIdentity(); }
    catch (failure) { this.fail(failure); return Promise.resolve(); }
    if (this.retryAtMilliseconds !== null && this.clock.nowMilliseconds() < this.retryAtMilliseconds) {
      this.fail(new IntegrationFailure(IntegrationFailureCode.RateLimited)); return Promise.resolve();
    }
    const operation: PendingObservation = { identity, cancellation: new AbortController(), promise: Promise.resolve() };
    operation.promise = Promise.resolve().then(() => this.execute(operation)).finally(() => {
      if (this.pending === operation) { this.pending = null; this.schedule(); }
    });
    this.pending = operation;
    return operation.promise;
  }

  private async execute(operation: PendingObservation): Promise<void> {
    if (!this.isCurrent(operation)) return;
    if (!this.matchesCurrentIdentity(operation.identity)) { this.sessionChanged(); return; }
    const sameSnapshot = this.snapshotIdentity?.accountIdentifier === operation.identity.accountIdentifier
      && this.snapshotIdentity.sessionIdentifier === operation.identity.sessionIdentifier
      && this.snapshotIdentity.hostDeviceIdentifier === operation.identity.hostDeviceIdentifier;
    this.snapshotIdentity = operation.identity;
    this.publish({ ...this.snapshot, ...(sameSnapshot ? {} : EmptyResponse), status: HostedQueueStatus.Loading,
      sessionIdentifier: operation.identity.sessionIdentifier, hostDeviceIdentifier: operation.identity.hostDeviceIdentifier, failure: null });
    if (!this.isCurrent(operation)) return;
    if (!this.matchesCurrentIdentity(operation.identity)) { this.sessionChanged(); return; }
    try {
      await this.verifyGuest(operation);
      const response = await withCancellation(this.reader.read(operation.identity.hostDeviceIdentifier, operation.cancellation.signal), operation.cancellation.signal);
      if (!this.isCurrent(operation)) return;
      if (!this.matchesCurrentIdentity(operation.identity)) { this.sessionChanged(); return; }
      await this.verifyGuest(operation);
      const copied = copyHostedQueueResponse(response);
      if (!this.isCurrent(operation) || !this.matchesCurrentIdentity(operation.identity)) return;
      this.retryAtMilliseconds = null;
      this.publish({ ...this.snapshot, ...copied, status: HostedQueueStatus.Ready,
        observedAtMilliseconds: this.clock.nowMilliseconds(), failure: null });
    } catch (failure) { if (this.isCurrent(operation)) this.fail(failure); }
  }

  private captureIdentity(): ObservationIdentity {
    const current = this.sessions.getSnapshot();
    if (!current.accountIdentifier) throw new IntegrationFailure(IntegrationFailureCode.Unauthorized);
    if (!current.session) throw new IntegrationFailure(IntegrationFailureCode.NotFound);
    if (!current.session.ownedByCurrentAccount && (!this.guestVerifier || !current.session.participants.some(participant => participant.identifier === current.accountIdentifier))) throw new IntegrationFailure(IntegrationFailureCode.Forbidden);
    if (!current.session.active || !current.session.hostDeviceIdentifier) throw new IntegrationFailure(IntegrationFailureCode.Unsupported);
    if (current.status !== JamConnectionStatus.Ready && current.status !== JamConnectionStatus.Operating) {
      throw new IntegrationFailure(current.failure ?? IntegrationFailureCode.UnknownOutcome);
    }
    return Object.freeze({ accountIdentifier: current.accountIdentifier, sessionIdentifier: current.session.identifier,
      hostDeviceIdentifier: current.session.hostDeviceIdentifier });
  }

  private async verifyGuest(operation: PendingObservation): Promise<void> {
    if (!this.matchesCurrentIdentity(operation.identity)) throw new IntegrationFailure(IntegrationFailureCode.Superseded);
    if (this.sessions.getSnapshot().session?.ownedByCurrentAccount) return;
    if (!this.guestVerifier) throw new IntegrationFailure(IntegrationFailureCode.Forbidden);
    await withCancellation(this.guestVerifier.verify(operation.identity, operation.cancellation.signal), operation.cancellation.signal);
    if (!this.isCurrent(operation) || !this.matchesCurrentIdentity(operation.identity)) throw new IntegrationFailure(IntegrationFailureCode.Superseded);
  }

  private matchesCurrentIdentity(expected: ObservationIdentity): boolean {
    try {
      const current = this.captureIdentity();
      return current.accountIdentifier === expected.accountIdentifier && current.sessionIdentifier === expected.sessionIdentifier
        && current.hostDeviceIdentifier === expected.hostDeviceIdentifier;
    } catch { return false; }
  }

  private sessionChanged(): void {
    if (this.disposed || !this.enabled) return;
    const current = this.sessions.getSnapshot();
    const identity = this.pending?.identity;
    if (identity && this.matchesCurrentIdentity(identity)) return;
    if (!identity && this.snapshotIdentity?.accountIdentifier === current.accountIdentifier
      && current.accountIdentifier && current.session && this.matchesCurrentIdentity(this.snapshotIdentity) && current.session.active
      && current.session.identifier === this.snapshot.sessionIdentifier && current.session.hostDeviceIdentifier === this.snapshot.hostDeviceIdentifier
      && (current.status === JamConnectionStatus.Ready || current.status === JamConnectionStatus.Operating)) return;
    this.invalidate();
    this.snapshotIdentity = null;
    this.publish({ ...EmptyResponse, enabled: true, status: current.accountIdentifier === null ? HostedQueueStatus.Detached : HostedQueueStatus.Idle,
      sessionIdentifier: current.session?.identifier ?? null, hostDeviceIdentifier: current.session?.hostDeviceIdentifier ?? null, failure: null });
    try { this.captureIdentity(); } catch { return; }
    this.pollPaused = false;
    this.resume();
  }

  private suspend(): void {
    this.invalidate();
    if (this.enabled) this.publish({ ...this.snapshot, status: HostedQueueStatus.Stale });
  }

  private resume(): void {
    this.pollPaused = false;
    if (!this.enabled || !this.observing || !this.active || !this.scheduler) return;
    if (this.retryAtMilliseconds !== null && this.clock.nowMilliseconds() < this.retryAtMilliseconds) this.schedule();
    else void this.read();
  }

  private schedule(): void {
    if (!this.enabled || this.disposed || !this.observing || !this.active || !this.scheduler || this.pollPaused || this.pending !== null) return;
    this.stopPoll();
    const delay = this.retryAtMilliseconds === null ? HostedQueuePolicy.pollIntervalMilliseconds
      : Math.max(HostedQueuePolicy.pollIntervalMilliseconds, this.retryAtMilliseconds - this.clock.nowMilliseconds());
    this.cancelPoll = this.scheduler.schedule(delay, () => { this.cancelPoll = null; void this.read(); });
  }

  private fail(failure: unknown): void {
    this.pollPaused = true;
    const code = failureCode(failure);
    if (failure instanceof IntegrationFailure && code === IntegrationFailureCode.RateLimited && failure.retryAfterSeconds !== undefined
      && Number.isFinite(failure.retryAfterSeconds) && failure.retryAfterSeconds >= HostedQueuePolicy.minimumRetrySeconds) {
      this.retryAtMilliseconds = this.clock.nowMilliseconds() + failure.retryAfterSeconds * HostedQueuePolicy.millisecondsPerSecond;
    }
    const current = this.sessions.getSnapshot();
    const changedContext = this.snapshotIdentity !== null && (current.accountIdentifier !== this.snapshotIdentity.accountIdentifier
      || current.session?.identifier !== this.snapshotIdentity.sessionIdentifier
      || current.session?.hostDeviceIdentifier !== this.snapshotIdentity.hostDeviceIdentifier
      || !this.matchesCurrentIdentity(this.snapshotIdentity) || !current.session.active);
    if (changedContext) this.snapshotIdentity = null;
    const snapshot = changedContext ? { ...this.snapshot, ...EmptyResponse,
      sessionIdentifier: current.session?.identifier ?? null, hostDeviceIdentifier: current.session?.hostDeviceIdentifier ?? null } : this.snapshot;
    this.publish({ ...snapshot, status: snapshot.observedAtMilliseconds === null ? HostedQueueStatus.Failed : HostedQueueStatus.Stale, failure: code });
  }

  private isCurrent(operation: PendingObservation): boolean {
    return !this.disposed && this.active && this.pending === operation && !operation.cancellation.signal.aborted;
  }

  private invalidate(): void {
    this.pending?.cancellation.abort();
    this.pending = null;
    this.stopPoll();
  }

  private stopPoll(): void { this.cancelPoll?.(); this.cancelPoll = null; }

  private publish(snapshot: HostedQueueSnapshot): void {
    this.snapshot = Object.freeze(snapshot);
    for (const listener of [...this.listeners]) { if (this.listeners.has(listener)) { try { listener(); } catch {} } }
  }
}
