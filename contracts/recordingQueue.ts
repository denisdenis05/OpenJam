import type { MatchResult, SpotifySong } from './catalog';
import type { IntegrationFailureCode } from './network';
import type { ExternalStore, JamCommandResult, JamSnapshot } from './session';

export enum RecordingQueueStatus {
  Idle = 'idle', Matching = 'matching', Ready = 'ready', Submitting = 'submitting', Accepted = 'accepted', Failed = 'failed',
}

export interface RecordingQueueSnapshot {
  readonly status: RecordingQueueStatus;
  readonly recordingIdentifier: string | null;
  readonly market: string | null;
  readonly match: MatchResult<SpotifySong> | null;
  readonly acceptedSpotifyIdentifier: string | null;
  readonly failure: IntegrationFailureCode | null;
}

export interface RecordingQueueTranslator {
  toSpotify(recordingIdentifier: string, market: string, cancellation: AbortSignal): Promise<MatchResult<SpotifySong>>;
  confirm(recordingIdentifier: string, spotifyIdentifier: string, market: string, cancellation: AbortSignal): Promise<void>;
}

export interface RecordingQueueSession extends ExternalStore<JamSnapshot> {
  addToQueue(spotifyIdentifier: string, requestIdentifier: string): Promise<JamCommandResult>;
}

export interface RecordingQueueWorkflow extends ExternalStore<RecordingQueueSnapshot> {
  prepare(recordingIdentifier: string, market: string, cancellation: AbortSignal): Promise<void>;
  enqueue(spotifyIdentifier: string, requestIdentifier: string, cancellation: AbortSignal): Promise<boolean>;
  clear(): void;
}
