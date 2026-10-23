import type { AssociationStore, MatchResult, MatchingPolicy, RecordingCatalog, SpotifySong } from '../contracts/catalog';
import type { Clock, HttpExecutor, SpotifyCredentialProvider, SpotifyEndpointResolver } from '../contracts/network';
import type { JamQueueProtocol } from '../contracts/queue';
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
}

export class SpotifyJamRuntime {
  readonly sessions: JamSessionClient;
  readonly recordingQueue: RecordingQueueCoordinator;
  private readonly lifetime = new AbortController();
  private readonly credentials: SpotifyCredentialSession;
  private readonly translator: TrackTranslator;

  constructor(dependencies: SpotifyJamDependencies) {
    this.credentials = new SpotifyCredentialSession(dependencies.accountIdentifier, dependencies.credentials, dependencies.clock);
    const requests = new SpotifyRequestClient(dependencies.requests, this.credentials);
    this.translator = new TrackTranslator(dependencies.recordings, new SpotifyWebCatalog(requests),
      new CandidateRanker(dependencies.matchingPolicy), dependencies.associations);
    this.sessions = new JamSessionClient(dependencies.onSubscriberFailure, dependencies.experimentalMembership);
    this.sessions.attachAccount(dependencies.accountIdentifier,
      new SpotifyHttpJamProtocol(requests, dependencies.endpoints, dependencies.experimentalMembership),
      dependencies.enableHostedQueue ? dependencies.queueProtocol ?? new SpotifyWebQueueProtocol(requests) : null);
    this.recordingQueue = new RecordingQueueCoordinator(this.translator, this.sessions);
  }

  async translateToSpotify(recordingIdentifier: string, market: string, cancellation: AbortSignal): Promise<MatchResult<SpotifySong>> {
    const scope = combineCancellation(this.lifetime.signal, cancellation);
    try { return await this.translator.toSpotify(recordingIdentifier, market, scope.signal); }
    finally { scope.dispose(); }
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

  dispose(): void {
    this.recordingQueue.dispose();
    this.lifetime.abort();
    this.credentials.dispose();
    this.sessions.detachAccount();
  }
}
