import type { AssociationStore, CatalogSong, MatchResult, MatchingPolicy, RecordingCatalog, SpotifySong } from '../contracts/catalog';
import type { Clock, HttpExecutor, Scheduler, SpotifyCredentialProvider, SpotifyEndpointResolver } from '../contracts/network';
import type { HostedQueueReader } from '../contracts/hostedQueue';
import type { JamQueueProtocol } from '../contracts/queue';
import type { HostedPlaybackCommandProtocol } from '../contracts/hostedPlaybackCommands';
import { SpotifyWebPlaybackCommandProtocol } from './playback/SpotifyWebPlaybackCommandProtocol';
import { CandidateRanker } from './catalog/CandidateRanker';
import { SpotifyWebCatalog } from './catalog/SpotifyWebCatalog';
import { TrackTranslator } from './catalog/TrackTranslator';
import { combineCancellation } from './network/Cancellation';
import { SpotifyCredentialSession } from './network/SpotifyCredentialSession';
import { SpotifyRequestClient } from './network/SpotifyRequestClient';
import { JamSessionClient } from './session/JamSessionClient';
import { SpotifyHttpJamProtocol } from './session/SpotifyHttpJamProtocol';
import { SpotifyWebQueueProtocol } from './session/SpotifyWebQueueProtocol';
import { RecordingQueueCoordinator } from './session/RecordingQueueCoordinator';
import { HostedQueueObserver } from './observation/HostedQueueObserver';
import { SpotifyWebHostedQueueReader } from './observation/SpotifyWebHostedQueueReader';
import { JamMembershipObserver } from './observation/JamMembershipObserver';
import { SpotifyWebPlaybackReader } from './playback/SpotifyWebPlaybackReader';
import type { SharedPlaybackClock, SharedPlaybackIdentity } from '../contracts/sharedPlayback';
import type { HostedPlaybackSample, HostedPlaybackReader } from '../contracts/hostedPlayback';
import { IntegrationFailureCode } from '../contracts/network';
import { JamConnectionStatus } from '../contracts/session';
import { checkCancellation, failureCode, IntegrationFailure } from './network/IntegrationFailure';
import { copySong } from './catalog/SongIdentity';
import { samePlaybackIdentity } from './playback/SharedPlaybackTiming';

export interface SpotifyJamDependencies {
  readonly accountIdentifier: string;
  readonly credentials: SpotifyCredentialProvider;
  readonly endpoints: SpotifyEndpointResolver;
  readonly recordings: RecordingCatalog;
  readonly associations: AssociationStore;
  readonly requests: HttpExecutor;
  readonly clock: Clock;
  readonly matchingPolicy?: MatchingPolicy;
  readonly onSubscriberFailure?: () => void;
  readonly experimentalMembership?: boolean;
  readonly enableHostedQueue?: boolean;
  readonly queueProtocol?: JamQueueProtocol;
  readonly enableHostedQueueObservation?: boolean;
  readonly hostedQueueReader?: HostedQueueReader;
  readonly scheduler?: Scheduler;
  readonly enableMembershipObservation?: boolean;
  readonly membershipRequestIdentifiers?: () => string;
  readonly playbackClock?: SharedPlaybackClock;
  readonly playbackReader?: HostedPlaybackReader;
  readonly enableHostedPlaybackCommands?: boolean;
  readonly playbackCommandProtocol?: HostedPlaybackCommandProtocol;
}

export class SpotifyJamRuntime {
  readonly sessions: JamSessionClient;
  readonly recordingQueue: RecordingQueueCoordinator;
  readonly hostedQueue: HostedQueueObserver;
  readonly membership: JamMembershipObserver;
  private readonly lifetime = new AbortController();
  private readonly credentials: SpotifyCredentialSession;
  private readonly translator: TrackTranslator;
  private readonly playbackReader: HostedPlaybackReader | null;
  private readonly recordings: RecordingCatalog;
  private readonly accountIdentifier: string;

  constructor(dependencies: SpotifyJamDependencies) {
    this.accountIdentifier = dependencies.accountIdentifier;
    this.recordings = dependencies.recordings;
    this.credentials = new SpotifyCredentialSession(dependencies.accountIdentifier, dependencies.credentials, dependencies.clock);
    const requests = new SpotifyRequestClient(dependencies.requests, this.credentials);
    this.playbackReader = dependencies.playbackReader ?? (dependencies.playbackClock ? new SpotifyWebPlaybackReader(requests, dependencies.playbackClock) : null);
    this.translator = new TrackTranslator(dependencies.recordings, new SpotifyWebCatalog(requests),
      new CandidateRanker(dependencies.matchingPolicy), dependencies.associations);
    this.sessions = new JamSessionClient(dependencies.onSubscriberFailure, dependencies.experimentalMembership);
    this.sessions.attachAccount(dependencies.accountIdentifier,
      new SpotifyHttpJamProtocol(requests, dependencies.endpoints, dependencies.experimentalMembership),
      dependencies.enableHostedQueue ? dependencies.queueProtocol ?? new SpotifyWebQueueProtocol(requests) : null,
      dependencies.enableHostedPlaybackCommands ? dependencies.playbackCommandProtocol
        ?? (this.playbackReader ? new SpotifyWebPlaybackCommandProtocol(requests, this.playbackReader) : null) : null);
    this.recordingQueue = new RecordingQueueCoordinator(this.translator, this.sessions);
    this.hostedQueue = new HostedQueueObserver(this.sessions, dependencies.hostedQueueReader ?? new SpotifyWebHostedQueueReader(requests),
      dependencies.clock, dependencies.enableHostedQueueObservation, dependencies.scheduler);
    this.membership = new JamMembershipObserver(this.sessions, dependencies.clock, dependencies.enableMembershipObservation,
      dependencies.membershipRequestIdentifiers, dependencies.scheduler);
  }

  async translateToSpotify(recordingIdentifier: string, market: string, cancellation: AbortSignal): Promise<MatchResult<SpotifySong>> {
    const scope = combineCancellation(this.lifetime.signal, cancellation);
    try { return await this.translator.toSpotify(recordingIdentifier, market, scope.signal); }
    finally { scope.dispose(); }
  }

  async lookupRecording(recordingIdentifier: string, cancellation: AbortSignal): Promise<CatalogSong | null> {
    const scope = combineCancellation(this.lifetime.signal, cancellation);
    try {
      checkCancellation(scope.signal);
      const song = await this.recordings.lookup(recordingIdentifier, scope.signal);
      checkCancellation(scope.signal);
      if (song && song.identifier !== recordingIdentifier) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
      return song ? copySong(song) : null;
    } catch (failure) { throw new IntegrationFailure(failureCode(failure));
    } finally { scope.dispose(); }
  }

  async translateToRecording(spotifyIdentifier: string, market: string, cancellation: AbortSignal): Promise<MatchResult> {
    const scope = combineCancellation(this.lifetime.signal, cancellation);
    try { return await this.translator.toRecording(spotifyIdentifier, market, scope.signal); }
    finally { scope.dispose(); }
  }

  async confirmAssociation(recordingIdentifier: string, spotifyIdentifier: string, market: string, cancellation: AbortSignal): Promise<void> {
    const scope = combineCancellation(this.lifetime.signal, cancellation);
    try { await this.translator.confirm(recordingIdentifier, spotifyIdentifier, market, scope.signal); }
    finally { scope.dispose(); }
  }

  async readHostedPlayback(cancellation: AbortSignal): Promise<HostedPlaybackSample> {
    const scope = combineCancellation(this.lifetime.signal, cancellation);
    try {
      checkCancellation(scope.signal);
      if (!this.playbackReader) throw new IntegrationFailure(IntegrationFailureCode.Unsupported);
      const identity = this.hostedPlaybackIdentity();
      const sample = await this.playbackReader.read(identity.authorityIdentifier, scope.signal);
      checkCancellation(scope.signal);
      let currentIdentity: SharedPlaybackIdentity;
      try { currentIdentity = this.hostedPlaybackIdentity(); } catch { throw new IntegrationFailure(IntegrationFailureCode.Superseded); }
      if (!samePlaybackIdentity(identity, currentIdentity)) throw new IntegrationFailure(IntegrationFailureCode.Superseded);
      return Object.freeze({ ...identity, ...sample });
    } finally { scope.dispose(); }
  }

  private hostedPlaybackIdentity(): SharedPlaybackIdentity {
    const snapshot = this.sessions.getSnapshot();
    if (!snapshot.accountIdentifier) throw new IntegrationFailure(IntegrationFailureCode.Unauthorized);
    if (snapshot.accountIdentifier !== this.accountIdentifier) throw new IntegrationFailure(IntegrationFailureCode.Superseded);
    if (!snapshot.session) throw new IntegrationFailure(IntegrationFailureCode.NotFound);
    if (!snapshot.session.ownedByCurrentAccount) throw new IntegrationFailure(IntegrationFailureCode.Forbidden);
    if (!snapshot.session.active || !snapshot.session.hostDeviceIdentifier) throw new IntegrationFailure(IntegrationFailureCode.Unsupported);
    if (snapshot.status !== JamConnectionStatus.Ready && snapshot.status !== JamConnectionStatus.Operating) {
      throw new IntegrationFailure(snapshot.failure ?? IntegrationFailureCode.UnknownOutcome);
    }
    return Object.freeze({ accountIdentifier: snapshot.accountIdentifier, sessionIdentifier: snapshot.session.identifier,
      authorityIdentifier: snapshot.session.hostDeviceIdentifier });
  }

  dispose(): void {
    this.membership.dispose();
    this.hostedQueue.dispose();
    this.recordingQueue.dispose();
    this.lifetime.abort();
    this.credentials.dispose();
    this.sessions.detachAccount();
  }
}
