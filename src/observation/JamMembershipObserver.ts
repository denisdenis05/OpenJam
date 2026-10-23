import { MembershipObservationStatus } from '../../contracts/membershipObservation';
import type { MembershipObservation, MembershipObservationSession, MembershipObservationSnapshot } from '../../contracts/membershipObservation';
import { IntegrationFailureCode } from '../../contracts/network';
import type { Clock, Scheduler } from '../../contracts/network';
import { withCancellation } from '../network/Cancellation';
import { failureCode, IntegrationFailure } from '../network/IntegrationFailure';

export const MembershipObservationPolicy = Object.freeze({
  pollIntervalMilliseconds: 15000, millisecondsPerSecond: 1000, minimumRetrySeconds: 0,
  recentRequestLimit: 128, maximumRequestCharacters: 512, stringType: 'string',
});

interface PendingMembershipRead {
  readonly accountIdentifier: string;
  readonly cancellation: AbortController;
  promise: Promise<void>;
}

export class JamMembershipObserver implements MembershipObservation {
  private snapshot: MembershipObservationSnapshot;
  private readonly enabled: boolean;
  private observing = false;
  private active = true;
  private disposed = false;
  private pollPaused = false;
  private retryAtMilliseconds: number | null = null;
  private cancelPoll: (() => void) | null = null;
  private pending: PendingMembershipRead | null = null;
  private accountIdentifier: string | null;
  private readonly recentRequests = new Set<string>();
  private readonly listeners = new Set<() => void>();
  private readonly stopSessionObservation: () => void;

  constructor(private readonly sessions: MembershipObservationSession, private readonly clock: Clock,
    enabled = false, private readonly requestIdentifiers?: () => string, private readonly scheduler?: Scheduler) {
    this.enabled = enabled && requestIdentifiers !== undefined;
    this.accountIdentifier = sessions.getSnapshot().accountIdentifier;
    this.snapshot = Object.freeze({ enabled: this.enabled,
      status: this.enabled && this.accountIdentifier !== null ? MembershipObservationStatus.Idle : MembershipObservationStatus.Detached,
      observedAtMilliseconds: null, failure: null });
    this.stopSessionObservation = sessions.subscribe(() => this.sessionChanged());
  }

  getSnapshot = (): MembershipObservationSnapshot => this.snapshot;
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
    if (observing) this.resume();
    else this.suspend();
  }

  setActive(active: boolean): void {
    if (this.disposed || active === this.active) return;
    this.active = active;
    if (active) this.resume();
    else this.suspend();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopSessionObservation();
    this.invalidate();
    this.publish({ enabled: false, status: MembershipObservationStatus.Detached, observedAtMilliseconds: null, failure: null });
    this.listeners.clear();
    this.recentRequests.clear();
  }

  private read(): Promise<void> {
    if (this.pending !== null) return this.pending.promise;
    if (this.disposed) return Promise.resolve();
    if (!this.enabled) { this.publish({ ...this.snapshot, failure: IntegrationFailureCode.Unsupported }); return Promise.resolve(); }
    if (!this.active) return Promise.resolve();
    this.stopPoll();
    const accountIdentifier = this.sessions.getSnapshot().accountIdentifier;
    if (accountIdentifier !== this.accountIdentifier) {
      this.sessionChanged();
      return this.read();
    }
    if (accountIdentifier === null) {
      this.publish({ ...this.snapshot, status: MembershipObservationStatus.Detached,
        observedAtMilliseconds: null, failure: IntegrationFailureCode.Unauthorized }); return Promise.resolve();
    }
    if (this.retryAtMilliseconds !== null && this.clock.nowMilliseconds() < this.retryAtMilliseconds) {
      this.fail(new IntegrationFailure(IntegrationFailureCode.RateLimited)); return Promise.resolve();
    }
    const operation: PendingMembershipRead = { accountIdentifier, cancellation: new AbortController(), promise: Promise.resolve() };
    operation.promise = Promise.resolve().then(() => this.execute(operation)).finally(() => {
      if (this.pending === operation) { this.pending = null; this.schedule(); }
    });
    this.pending = operation;
    return operation.promise;
  }

  private async execute(operation: PendingMembershipRead): Promise<void> {
    if (!this.isCurrent(operation)) { this.sessionChanged(); return; }
    this.publish({ ...this.snapshot, status: MembershipObservationStatus.Refreshing, failure: null });
    if (!this.isCurrent(operation)) { this.sessionChanged(); return; }
    try {
      const requestIdentifier = this.nextRequestIdentifier();
      if (!this.isCurrent(operation)) { this.sessionChanged(); return; }
      const result = await withCancellation(this.sessions.refreshCurrentSession(requestIdentifier, operation.cancellation.signal), operation.cancellation.signal);
      if (!this.isCurrent(operation)) { this.sessionChanged(); return; }
      if (!result.applied) throw new IntegrationFailure(result.failure ?? IntegrationFailureCode.Network, result.retryAfterSeconds);
      this.retryAtMilliseconds = null;
      this.publish({ ...this.snapshot, status: MembershipObservationStatus.Ready, observedAtMilliseconds: this.clock.nowMilliseconds(), failure: null });
    } catch (failure) {
      if (this.isCurrent(operation)) this.fail(failure);
      else this.sessionChanged();
    }
  }

  private nextRequestIdentifier(): string {
    const identifier = this.requestIdentifiers?.();
    if (typeof identifier !== MembershipObservationPolicy.stringType || !(identifier as string).trim()
      || (identifier as string).length > MembershipObservationPolicy.maximumRequestCharacters
      || this.recentRequests.has(identifier as string)) throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
    this.recentRequests.add(identifier as string);
    if (this.recentRequests.size > MembershipObservationPolicy.recentRequestLimit) {
      const first = this.recentRequests.values().next().value;
      if (first !== undefined) this.recentRequests.delete(first);
    }
    return identifier as string;
  }

  private sessionChanged(): void {
    if (this.disposed || !this.enabled) return;
    const current = this.sessions.getSnapshot().accountIdentifier;
    if (current === this.accountIdentifier) return;
    this.accountIdentifier = current;
    this.invalidate();
    this.publish({ enabled: true, status: current === null ? MembershipObservationStatus.Detached : MembershipObservationStatus.Idle,
      observedAtMilliseconds: null, failure: null });
    this.pollPaused = false;
    if (current !== null) this.resume();
  }

  private suspend(): void {
    this.invalidate();
    if (this.enabled) this.publish({ ...this.snapshot,
      status: this.accountIdentifier === null ? MembershipObservationStatus.Detached : MembershipObservationStatus.Stale });
  }

  private resume(): void {
    this.pollPaused = false;
    if (!this.enabled || this.disposed || !this.active || !this.observing || !this.scheduler || this.accountIdentifier === null) return;
    if (this.retryAtMilliseconds !== null && this.clock.nowMilliseconds() < this.retryAtMilliseconds) this.schedule();
    else void this.read();
  }

  private schedule(): void {
    if (!this.enabled || this.disposed || !this.active || !this.observing || !this.scheduler
      || this.pollPaused || this.pending !== null || this.accountIdentifier === null) return;
    this.stopPoll();
    const delay = this.retryAtMilliseconds === null ? MembershipObservationPolicy.pollIntervalMilliseconds
      : Math.max(MembershipObservationPolicy.pollIntervalMilliseconds, this.retryAtMilliseconds - this.clock.nowMilliseconds());
    this.cancelPoll = this.scheduler.schedule(delay, () => { this.cancelPoll = null; void this.read(); });
  }

  private fail(failure: unknown): void {
    this.pollPaused = true;
    const code = failureCode(failure);
    if (failure instanceof IntegrationFailure && code === IntegrationFailureCode.RateLimited && failure.retryAfterSeconds !== undefined
      && Number.isFinite(failure.retryAfterSeconds) && failure.retryAfterSeconds >= MembershipObservationPolicy.minimumRetrySeconds) {
      this.retryAtMilliseconds = this.clock.nowMilliseconds() + failure.retryAfterSeconds * MembershipObservationPolicy.millisecondsPerSecond;
    }
    this.publish({ ...this.snapshot,
      status: this.snapshot.observedAtMilliseconds === null ? MembershipObservationStatus.Failed : MembershipObservationStatus.Stale, failure: code });
  }

  private isCurrent(operation: PendingMembershipRead): boolean {
    return !this.disposed && this.active && this.pending === operation && !operation.cancellation.signal.aborted
      && this.sessions.getSnapshot().accountIdentifier === operation.accountIdentifier;
  }

  private invalidate(): void {
    this.pending?.cancellation.abort();
    this.pending = null;
    this.stopPoll();
  }

  private stopPoll(): void { this.cancelPoll?.(); this.cancelPoll = null; }

  private publish(snapshot: MembershipObservationSnapshot): void {
    this.snapshot = Object.freeze(snapshot);
    for (const listener of [...this.listeners]) { if (this.listeners.has(listener)) { try { listener(); } catch {} } }
  }
}
