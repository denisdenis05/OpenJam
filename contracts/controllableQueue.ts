export enum QueueSide {
  Local = 'local',
  Spotify = 'spotify',
}

export interface ControllableQueueEntry {
  readonly occurrenceIdentifier: string;
  readonly recordingIdentifier: string | null;
  readonly spotifyIdentifier: string | null;
}

export interface ControllableQueueSnapshot {
  readonly scopeIdentifier: string;
  readonly revision: string;
  readonly currentOccurrenceIdentifier: string | null;
  readonly entries: readonly ControllableQueueEntry[];
  readonly lastOperationIdentifier: string | null;
  readonly complete?: boolean;
}

export interface ControllableQueueChange {
  readonly expectedScopeIdentifier: string;
  readonly expectedRevision: string;
  readonly operationIdentifier: string;
  readonly entries: readonly ControllableQueueEntry[];
  readonly currentOccurrenceIdentifier: string | null;
}

export interface ControllableQueuePort {
  read(cancellation: AbortSignal): Promise<ControllableQueueSnapshot>;
  apply(change: ControllableQueueChange, cancellation: AbortSignal): Promise<ControllableQueueSnapshot>;
}

export interface ControllableQueueMapper {
  map(entry: ControllableQueueEntry, destination: QueueSide, cancellation: AbortSignal): Promise<ControllableQueueEntry | null>;
}

export interface QueueSynchronizationResult {
  readonly applied: boolean;
  readonly unresolvedOccurrenceIdentifiers: readonly string[];
  readonly snapshot: ControllableQueueSnapshot;
}

export interface ControllableQueueDependencies {
  readonly local: ControllableQueuePort;
  readonly spotify: ControllableQueuePort;
  readonly mapper: ControllableQueueMapper;
  readonly operationIdentifiers: () => string;
}
