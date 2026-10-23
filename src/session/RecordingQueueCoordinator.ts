import { MatchEvidence, MatchStatus } from '../../contracts/catalog';
import { IntegrationFailureCode } from '../../contracts/network';
import { RecordingQueueStatus } from '../../contracts/recordingQueue';
import type { RecordingQueueSession, RecordingQueueSnapshot, RecordingQueueTranslator } from '../../contracts/recordingQueue';
import { JamConnectionStatus } from '../../contracts/session';
import { copySong } from '../catalog/SongIdentity';
import { combineCancellation, withCancellation } from '../network/Cancellation';
import { checkCancellation, failureCode, IntegrationFailure } from '../network/IntegrationFailure';

const EmptySnapshot: RecordingQueueSnapshot = Object.freeze({ status: RecordingQueueStatus.Idle,
  recordingIdentifier: null, market: null, match: null, acceptedSpotifyIdentifier: null, failure: null });
const SelectionPolicy = Object.freeze({ maximumIdentifierCharacters: 512, marketPattern: /^[A-Z]{2}$/ });

interface SelectionSessionIdentity {
  readonly accountIdentifier: string | null;
  readonly sessionIdentifier: string;
  readonly hostDeviceIdentifier: string | undefined;
  readonly ownedByCurrentAccount: boolean;
}

export class RecordingQueueCoordinator {
  private snapshot = EmptySnapshot;
  private lifetime = new AbortController();
  private expectedSession: SelectionSessionIdentity | null = null;
  private disposed = false;
  private readonly listeners = new Set<() => void>();
  private readonly stopObservation: () => void;

  constructor(private readonly translator: RecordingQueueTranslator, private readonly sessions: RecordingQueueSession) {
    this.stopObservation = sessions.subscribe(() => {
      if (this.expectedSession !== null && !this.sameSession(this.expectedSession)) this.clear();
    });
  }

  getSnapshot = (): RecordingQueueSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  async prepare(recordingIdentifier: string, market: string, cancellation: AbortSignal): Promise<void> {
    if (this.disposed) return;
    if (this.snapshot.status === RecordingQueueStatus.Submitting) return;
    this.clear();
    const lifetime = this.lifetime;
    const scope = combineCancellation(lifetime.signal, cancellation);
    try {
      checkCancellation(scope.signal);
      if (!recordingIdentifier.trim() || recordingIdentifier.length > SelectionPolicy.maximumIdentifierCharacters
        || !SelectionPolicy.marketPattern.test(market)) throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
      const session = this.sessions.getSnapshot();
      if (!session.accountIdentifier || !session.session) throw new IntegrationFailure(IntegrationFailureCode.Unauthorized);
      this.expectedSession = Object.freeze({ accountIdentifier: session.accountIdentifier,
        sessionIdentifier: session.session.identifier, hostDeviceIdentifier: session.session.hostDeviceIdentifier,
        ownedByCurrentAccount: session.session.ownedByCurrentAccount });
      this.publish({ ...EmptySnapshot, recordingIdentifier, market, status: RecordingQueueStatus.Matching });
      this.assertCurrent(lifetime);
      checkCancellation(scope.signal);
      const result = await withCancellation(this.translator.toSpotify(recordingIdentifier, market, scope.signal), scope.signal);
      this.assertCurrent(lifetime);
      const match = Object.freeze({ ...result, selected: result.selected ? copySong(result.selected) : null,
        candidates: Object.freeze(result.candidates.map(candidate => Object.freeze({ ...candidate,
          song: copySong(candidate.song), evidence: Object.freeze([...candidate.evidence]) }))) });
      this.publish({ ...this.snapshot, match, status: result.status === MatchStatus.Failed ? RecordingQueueStatus.Failed : RecordingQueueStatus.Ready,
        failure: result.failure });
    } catch (failure) { if (this.current(lifetime)) this.fail(failureCode(failure)); }
    finally { scope.dispose(); }
  }

  async enqueue(spotifyIdentifier: string, requestIdentifier: string, cancellation: AbortSignal): Promise<boolean> {
    if (this.disposed) return false;
    if (this.snapshot.status !== RecordingQueueStatus.Ready) return false;
    const lifetime = this.lifetime;
    const scope = combineCancellation(lifetime.signal, cancellation);
    try {
      checkCancellation(scope.signal);
      if (!requestIdentifier.trim()) throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
      this.assertCurrent(lifetime);
      if (this.snapshot.match?.status === MatchStatus.NotFound) throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
      const candidate = this.snapshot.match?.candidates.find(value => value.song.identifier === spotifyIdentifier);
      if (!candidate || candidate.song.playable === false || candidate.evidence.includes(MatchEvidence.VersionConflict)
        || candidate.evidence.includes(MatchEvidence.RecordingCodeConflict) || candidate.evidence.includes(MatchEvidence.Unavailable)) {
        throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
      }
      const session = this.sessions.getSnapshot();
      if (session.status !== JamConnectionStatus.Ready) throw new IntegrationFailure(IntegrationFailureCode.Backpressure);
      if (!session.session?.ownedByCurrentAccount) throw new IntegrationFailure(IntegrationFailureCode.Forbidden);
      if (!session.session.active || !session.session.hostDeviceIdentifier) throw new IntegrationFailure(IntegrationFailureCode.Unsupported);
      const recordingIdentifier = this.snapshot.recordingIdentifier;
      const market = this.snapshot.market;
      if (recordingIdentifier === null || market === null) throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
      this.publish({ ...this.snapshot, status: RecordingQueueStatus.Submitting, failure: null });
      this.assertCurrent(lifetime);
      checkCancellation(scope.signal);
      await withCancellation(this.translator.confirm(recordingIdentifier, spotifyIdentifier, market, scope.signal), scope.signal);
      this.assertCurrent(lifetime);
      checkCancellation(scope.signal);
      const result = await this.sessions.addToQueue(spotifyIdentifier, requestIdentifier);
      this.assertCurrent(lifetime);
      if (!result.applied) throw new IntegrationFailure(result.failure ?? IntegrationFailureCode.Network);
      this.publish({ ...this.snapshot, status: RecordingQueueStatus.Accepted, acceptedSpotifyIdentifier: spotifyIdentifier, failure: null });
      return true;
    } catch (failure) { if (this.current(lifetime)) this.fail(failureCode(failure)); return false; }
    finally { scope.dispose(); }
  }

  clear(): void {
    this.lifetime.abort();
    this.lifetime = new AbortController();
    this.expectedSession = null;
    this.publish(EmptySnapshot);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopObservation();
    this.clear();
    this.listeners.clear();
  }

  private sameSession(expected: SelectionSessionIdentity): boolean {
    const current = this.sessions.getSnapshot();
    return current.accountIdentifier === expected.accountIdentifier && current.session?.identifier === expected.sessionIdentifier
      && current.session?.hostDeviceIdentifier === expected.hostDeviceIdentifier
      && current.session?.ownedByCurrentAccount === expected.ownedByCurrentAccount;
  }

  private current(lifetime: AbortController): boolean { return !this.disposed && lifetime === this.lifetime && !lifetime.signal.aborted; }
  private assertCurrent(lifetime: AbortController): void {
    if (!this.current(lifetime) || this.expectedSession === null || !this.sameSession(this.expectedSession)) {
      throw new IntegrationFailure(IntegrationFailureCode.Superseded);
    }
  }
  private fail(failure: IntegrationFailureCode): void { this.publish({ ...this.snapshot, status: RecordingQueueStatus.Failed, failure }); }
  private publish(snapshot: RecordingQueueSnapshot): void {
    this.snapshot = Object.freeze(snapshot);
    for (const listener of [...this.listeners]) { if (this.listeners.has(listener)) { try { listener(); } catch {} } }
  }
}
