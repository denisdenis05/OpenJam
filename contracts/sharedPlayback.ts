import type { MatchResult } from './catalog';
import type { IntegrationFailureCode } from './network';
import type { ExternalStore } from './session';

export interface SharedPlaybackIdentity {
  readonly accountIdentifier: string;
  readonly sessionIdentifier: string;
  readonly authorityIdentifier: string;
}

export interface SharedPlaybackQueueOccurrence {
  readonly occurrenceIdentifier: string;
  readonly spotifyTrackIdentifier: string;
}

export interface SharedPlaybackQueue {
  readonly revision: string;
  readonly upcomingOccurrences: readonly SharedPlaybackQueueOccurrence[];
}

export interface SharedPlaybackRecordingOccurrence {
  readonly occurrenceIdentifier: string;
  readonly recordingIdentifier: string;
}

export interface SharedPlaybackTarget extends SharedPlaybackIdentity {
  readonly sequence: number;
  readonly queue?: SharedPlaybackQueue;
  readonly occurrenceIdentifier: string;
  readonly spotifyTrackIdentifier: string;
  readonly positionMilliseconds: number;
  readonly durationMilliseconds: number;
  readonly anchorMonotonicMilliseconds: number;
  readonly observedMonotonicMilliseconds: number;
  readonly uncertaintyMilliseconds: number;
  readonly playing: boolean;
  readonly buffering: boolean;
}

export interface SharedPlaybackClock {
  nowMonotonicMilliseconds(): number;
}

export interface SharedPlaybackRecordingResolver {
  resolve(spotifyTrackIdentifier: string, cancellation: AbortSignal): Promise<MatchResult>;
}

export interface SharedPlaybackLocalSample {
  readonly durationMilliseconds?: number | null;
  readonly uncertaintyMilliseconds: number;
  readonly occurrenceIdentifier: string;
  readonly positionMilliseconds: number;
  readonly sampledMonotonicMilliseconds: number;
  readonly ready: boolean;
  readonly buffering: boolean;
  readonly seekable: boolean;
  readonly playing: boolean;
}

export interface SharedPlaybackExecution {
  readonly occurrenceIdentifier: string;
  readonly positionMilliseconds: number;
  readonly playing: boolean;
  readonly seek: boolean;
}

export interface SharedPlaybackLease {
  prepareQueue?(recordings: readonly SharedPlaybackRecordingOccurrence[], occurrenceIdentifier: string, cancellation: AbortSignal): Promise<void>;
  prepare(recordingIdentifier: string, occurrenceIdentifier: string, cancellation: AbortSignal): Promise<void>;
  sample(cancellation: AbortSignal): Promise<SharedPlaybackLocalSample>;
  apply(execution: SharedPlaybackExecution, cancellation: AbortSignal): Promise<void>;
  release(): Promise<void>;
}

export interface SharedPlaybackOutput {
  acquire(identity: SharedPlaybackIdentity, cancellation: AbortSignal): Promise<SharedPlaybackLease>;
}

export enum SharedPlaybackStatus {
  Detached = 'detached',
  Stopping = 'stopping',
  Waiting = 'waiting',
  Resolving = 'resolving',
  Preparing = 'preparing',
  Following = 'following',
  Buffering = 'buffering',
  Stale = 'stale',
  Unavailable = 'unavailable',
  Failed = 'failed',
}

export interface SharedPlaybackSnapshot {
  readonly upcomingQueuePending?: boolean;
  readonly unavailableUpcomingCount?: number;
  readonly upcomingQueueFailure?: IntegrationFailureCode | null;
  readonly status: SharedPlaybackStatus;
  readonly identity: SharedPlaybackIdentity | null;
  readonly occurrenceIdentifier: string | null;
  readonly recordingIdentifier: string | null;
  readonly sequence: number | null;
  readonly driftMilliseconds: number | null;
  readonly failure: IntegrationFailureCode | null;
}

export interface SharedPlaybackFollower extends ExternalStore<SharedPlaybackSnapshot> {
  attach(identity: SharedPlaybackIdentity): Promise<void>;
  accept(target: SharedPlaybackTarget): Promise<void>;
  reconcile(): Promise<void>;
  detach(): Promise<void>;
}
