import type { ControllableQueueEntry, ControllableQueueMapper, ControllableQueuePort, ControllableQueueSnapshot, QueueSynchronizationResult } from '../../contracts/controllableQueue';
import { QueueSide } from '../../contracts/controllableQueue';
import { IntegrationFailureCode } from '../../contracts/network';
import { combineCancellation, withCancellation } from '../network/Cancellation';
import { checkCancellation, IntegrationFailure } from '../network/IntegrationFailure';

const QueueSynchronizationPolicy = Object.freeze({ maximumEntries: 1000, maximumReceipts: 64, emptyCount: 0 });

export class QueueSynchronizationCoordinator {
  private readonly lifetime = new AbortController();
  private pending: AbortController | null = null;
  private readonly publishedOperations = new Map<string, ControllableQueueSnapshot | null>();
  private disposed = false;

  constructor(private readonly local: ControllableQueuePort, private readonly spotify: ControllableQueuePort,
    private readonly mapper: ControllableQueueMapper, private readonly operationIdentifiers: () => string) {}

  async synchronize(destination: QueueSide, cancellation: AbortSignal): Promise<QueueSynchronizationResult> {
    if (this.disposed) throw new IntegrationFailure(IntegrationFailureCode.Superseded);
    this.pending?.abort();
    const operation = new AbortController();
    this.pending = operation;
    const lifetime = combineCancellation(this.lifetime.signal, operation.signal);
    const scope = combineCancellation(lifetime.signal, cancellation);
    const sourcePort = destination === QueueSide.Spotify ? this.local : this.spotify;
    const destinationPort = destination === QueueSide.Spotify ? this.spotify : this.local;
    try {
      const source = copyQueue(await withCancellation(sourcePort.read(scope.signal), scope.signal));
      const target = copyQueue(await withCancellation(destinationPort.read(scope.signal), scope.signal));
      const acknowledgedSource = source.lastOperationIdentifier === null ? null : this.publishedOperations.get(source.lastOperationIdentifier);
      if (acknowledgedSource && sameRevision(source, acknowledgedSource)) {
        return this.result(false, [], target);
      }
      const entries: ControllableQueueEntry[] = [];
      const unresolved: string[] = [];
      const resolvedEntries = new Map<string, ControllableQueueEntry>();
      const prioritizedEntries = [...source.entries.filter(entry => entry.occurrenceIdentifier === source.currentOccurrenceIdentifier),
        ...source.entries.filter(entry => entry.occurrenceIdentifier !== source.currentOccurrenceIdentifier)];
      for (const entry of prioritizedEntries) {
        checkCancellation(scope.signal);
        const existing = target.entries.find(candidate => candidate.occurrenceIdentifier === entry.occurrenceIdentifier);
        const mapped = await withCancellation(this.mapper.map(entry, destination, scope.signal), scope.signal);
        if (mapped !== null) {
          this.assertMapping(entry, mapped, destination);
          resolvedEntries.set(entry.occurrenceIdentifier, Object.freeze({ ...mapped, occurrenceIdentifier: entry.occurrenceIdentifier }));
        } else {
          unresolved.push(entry.occurrenceIdentifier);
          if (existing && compatibleEntry(entry, existing)) resolvedEntries.set(entry.occurrenceIdentifier, existing);
          else if (entry.occurrenceIdentifier === source.currentOccurrenceIdentifier) throw new IntegrationFailure(IntegrationFailureCode.NotFound);
        }
      }
      for (const entry of source.entries) {
        const resolved = resolvedEntries.get(entry.occurrenceIdentifier);
        if (resolved) entries.push(resolved);
      }
      if (source.complete === false || unresolved.length > QueueSynchronizationPolicy.emptyCount) {
        for (const entry of target.entries) {
          if (!entries.some(candidate => candidate.occurrenceIdentifier === entry.occurrenceIdentifier)) entries.push(entry);
        }
      }
      const currentOccurrenceIdentifier = source.complete === false && source.currentOccurrenceIdentifier === null
        ? target.currentOccurrenceIdentifier : source.currentOccurrenceIdentifier;
      if (sameContents(target, entries, currentOccurrenceIdentifier)) return this.result(false, unresolved, target);
      const currentSource = copyQueue(await withCancellation(sourcePort.read(scope.signal), scope.signal));
      if (!sameRevision(source, currentSource)) throw new IntegrationFailure(IntegrationFailureCode.Superseded);
      const currentTarget = copyQueue(await withCancellation(destinationPort.read(scope.signal), scope.signal));
      if (!sameRevision(target, currentTarget)) throw new IntegrationFailure(IntegrationFailureCode.Superseded);
      checkCancellation(scope.signal);
      const operationIdentifier = this.operationIdentifiers();
      if (!operationIdentifier.trim() || this.publishedOperations.has(operationIdentifier)) throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
      this.publishedOperations.set(operationIdentifier, null);
      this.trimReceipts();
      const receipt = copyQueue(await withCancellation(destinationPort.apply(Object.freeze({ expectedScopeIdentifier: target.scopeIdentifier,
        expectedRevision: target.revision, operationIdentifier, entries: Object.freeze(entries),
        currentOccurrenceIdentifier }), scope.signal), scope.signal));
      if (receipt.scopeIdentifier !== target.scopeIdentifier || receipt.lastOperationIdentifier !== operationIdentifier) {
        throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
      }
      this.publishedOperations.set(operationIdentifier, receipt);
      this.trimReceipts();
      return this.result(true, unresolved, receipt);
    } finally {
      scope.dispose();
      lifetime.dispose();
      if (this.pending === operation) this.pending = null;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.lifetime.abort();
    this.pending?.abort();
    this.publishedOperations.clear();
  }

  private trimReceipts(): void {
    while (this.publishedOperations.size > QueueSynchronizationPolicy.maximumReceipts) {
      const oldest = this.publishedOperations.keys().next().value;
      if (oldest !== undefined) this.publishedOperations.delete(oldest);
    }
  }

  private assertMapping(source: ControllableQueueEntry, mapped: ControllableQueueEntry, destination: QueueSide): void {
    if (source.recordingIdentifier !== null && mapped.recordingIdentifier !== source.recordingIdentifier
      || source.spotifyIdentifier !== null && mapped.spotifyIdentifier !== source.spotifyIdentifier
      || destination === QueueSide.Local && !mapped.recordingIdentifier
      || destination === QueueSide.Spotify && !mapped.spotifyIdentifier) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
  }

  private result(applied: boolean, unresolved: readonly string[], snapshot: ControllableQueueSnapshot): QueueSynchronizationResult {
    return Object.freeze({ applied, unresolvedOccurrenceIdentifiers: Object.freeze([...unresolved]), snapshot });
  }
}

function copyQueue(snapshot: ControllableQueueSnapshot): ControllableQueueSnapshot {
  if (!snapshot.scopeIdentifier.trim() || !snapshot.revision.trim() || snapshot.entries.length > QueueSynchronizationPolicy.maximumEntries) {
    throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
  }
  const occurrences = new Set<string>();
  const entries = snapshot.entries.map(entry => {
    if (!entry.occurrenceIdentifier.trim() || occurrences.has(entry.occurrenceIdentifier)
      || entry.recordingIdentifier === null && entry.spotifyIdentifier === null) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
    occurrences.add(entry.occurrenceIdentifier);
    return Object.freeze({ ...entry });
  });
  if (snapshot.currentOccurrenceIdentifier !== null && !occurrences.has(snapshot.currentOccurrenceIdentifier)) {
    throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
  }
  return Object.freeze({ ...snapshot, entries: Object.freeze(entries) });
}

function sameRevision(first: ControllableQueueSnapshot, second: ControllableQueueSnapshot): boolean {
  return first.scopeIdentifier === second.scopeIdentifier && first.revision === second.revision
    && sameContents(second, first.entries, first.currentOccurrenceIdentifier);
}

function sameContents(snapshot: ControllableQueueSnapshot, entries: readonly ControllableQueueEntry[], current: string | null): boolean {
  return snapshot.currentOccurrenceIdentifier === current && snapshot.entries.length === entries.length
    && entries.every((entry, position) => {
      const existing = snapshot.entries[position];
      return existing?.occurrenceIdentifier === entry.occurrenceIdentifier && existing.recordingIdentifier === entry.recordingIdentifier
        && existing.spotifyIdentifier === entry.spotifyIdentifier;
    });
}

function compatibleEntry(first: ControllableQueueEntry, second: ControllableQueueEntry): boolean {
  return (first.recordingIdentifier === null || second.recordingIdentifier === first.recordingIdentifier)
    && (first.spotifyIdentifier === null || second.spotifyIdentifier === first.spotifyIdentifier);
}
