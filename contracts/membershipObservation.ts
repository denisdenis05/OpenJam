import type { IntegrationFailureCode } from './network';
import type { ExternalStore, JamCommandResult, JamSnapshot } from './session';

export enum MembershipObservationStatus {
  Detached = 'detached',
  Idle = 'idle',
  Refreshing = 'refreshing',
  Ready = 'ready',
  Stale = 'stale',
  Failed = 'failed',
}

export interface MembershipObservationSnapshot {
  readonly enabled: boolean;
  readonly status: MembershipObservationStatus;
  readonly observedAtMilliseconds: number | null;
  readonly failure: IntegrationFailureCode | null;
}

export interface MembershipObservationSession extends ExternalStore<JamSnapshot> {
  refreshCurrentSession(requestIdentifier: string, cancellation?: AbortSignal): Promise<JamCommandResult>;
}

export interface MembershipObservation extends ExternalStore<MembershipObservationSnapshot> {
  refresh(): Promise<void>;
  setObserving(observing: boolean): void;
  setActive(active: boolean): void;
  dispose(): void;
}
