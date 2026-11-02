import { MatchEvidence, MatchStatus } from '../../contracts/catalog';
import type { AssociationStore, CatalogSong, ConfirmedAssociation, MatchResult, RecordingCatalog, RecordingImportMatch, RecordingImportMatcher, SpotifyCatalog, SpotifySong } from '../../contracts/catalog';
import { IntegrationFailureCode } from '../../contracts/network';
import { checkCancellation, failureCode, IntegrationFailure } from '../network/IntegrationFailure';
import { CandidateRanker } from './CandidateRanker';
import { withCancellation } from '../network/Cancellation';
import { copySong, songFingerprint } from './SongIdentity';

const FirstPosition = 0;
const EmptyMatchCount = 0;
const TextType = 'string';
const BooleanType = 'boolean';
const SingleCandidateCount = 1;
const ConfirmedScore = 100;
const ValidMarket = /^[A-Z]{2}$/;

export class TrackTranslator {
  constructor(private readonly recordings: RecordingCatalog, private readonly spotify: SpotifyCatalog,
    private readonly ranker: CandidateRanker, private readonly associations: AssociationStore,
    private readonly recordingImportMatcher?: RecordingImportMatcher) {}

  async toSpotify(identifier: string, market: string, cancellation: AbortSignal): Promise<MatchResult<SpotifySong>> {
    try {
      this.validate(identifier, market, cancellation);
      const source = await this.recordings.lookup(identifier, cancellation);
      checkCancellation(cancellation);
      if (!source) return this.notFound();
      if (source.identifier !== identifier) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
      const capturedSource = copySong(source);
      const associations = await this.associations.findForRecording(this.recordings.identity, identifier, market);
      checkCancellation(cancellation);
      const targets: SpotifySong[] = [];
      for (const association of associations) {
        if (!this.applicable(association) || association.recordingFingerprint !== songFingerprint(capturedSource)) continue;
        const target = await this.spotify.lookup(association.spotifyIdentifier, market, cancellation);
        checkCancellation(cancellation);
        if (target && target.playable !== false && association.spotifyFingerprint === songFingerprint(target)) targets.push(copySong(target));
      }
      if (targets.length === SingleCandidateCount) return this.confirmed(targets[FirstPosition]!);
      const candidates = await this.spotify.search({ title: capturedSource.title, author: capturedSource.author,
        limit: this.ranker.policy.maximumCandidates }, market, cancellation);
      checkCancellation(cancellation);
      const capturedCandidates = candidates.slice(FirstPosition, this.ranker.policy.maximumCandidates).map(copySong);
      const strict = this.ranker.rank(capturedSource, capturedCandidates);
      if (strict.status === MatchStatus.Matched || !this.recordingImportMatcher || capturedCandidates.length === EmptyMatchCount) return strict;
      const imported = await this.importMatches(capturedCandidates, cancellation);
      const confirmedIdentifiers = imported.filter(match => match.exact && match.recordingIdentifier === capturedSource.identifier)
        .map(match => match.spotifyIdentifier);
      return this.ranker.rankWithImportMatches(capturedSource, capturedCandidates, confirmedIdentifiers);
    } catch (failure) { return this.failed(failure); }
  }

  async toRecording(identifier: string, market: string, cancellation: AbortSignal): Promise<MatchResult> {
    try {
      this.validate(identifier, market, cancellation);
      const source = await this.spotify.lookup(identifier, market, cancellation);
      checkCancellation(cancellation);
      if (!source) return this.notFound();
      if (source.identifier !== identifier) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
      const capturedSource = copySong(source);
      const associations = await this.associations.findForSpotify(this.recordings.identity, identifier, market);
      checkCancellation(cancellation);
      const targets: CatalogSong[] = [];
      for (const association of associations) {
        if (!this.applicable(association) || association.spotifyFingerprint !== songFingerprint(capturedSource)) continue;
        const target = await this.recordings.lookup(association.recordingIdentifier, cancellation);
        checkCancellation(cancellation);
        if (target && association.recordingFingerprint === songFingerprint(target)) targets.push(copySong(target));
      }
      if (targets.length === SingleCandidateCount) return this.confirmed(targets[FirstPosition]!);
      const candidates = await this.recordings.search({ title: capturedSource.title, author: capturedSource.author,
        limit: this.ranker.policy.maximumCandidates }, cancellation);
      checkCancellation(cancellation);
      const capturedCandidates = candidates.slice(FirstPosition, this.ranker.policy.maximumCandidates).map(copySong);
      const strict = this.ranker.rank(capturedSource, capturedCandidates);
      if (strict.status === MatchStatus.Matched || !this.recordingImportMatcher) return strict;
      const imported = await this.importMatches([capturedSource], cancellation);
      const confirmedIdentifiers = [...new Set(imported.filter(match => match.exact).map(match => match.recordingIdentifier))];
      for (const recordingIdentifier of confirmedIdentifiers) {
        if (capturedCandidates.some(candidate => candidate.identifier === recordingIdentifier)) continue;
        const target = await withCancellation(this.recordings.lookup(recordingIdentifier, cancellation), cancellation);
        checkCancellation(cancellation);
        if (!target) continue;
        if (target.identifier !== recordingIdentifier) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
        capturedCandidates.unshift(copySong(target));
      }
      return this.ranker.rankWithImportMatches(capturedSource, capturedCandidates, confirmedIdentifiers);
    } catch (failure) { return this.failed(failure); }
  }

  async confirm(recordingIdentifier: string, spotifyIdentifier: string, market: string, cancellation: AbortSignal): Promise<void> {
    try {
      this.validate(recordingIdentifier, market, cancellation);
      const [recording, spotify] = await Promise.all([this.recordings.lookup(recordingIdentifier, cancellation),
        this.spotify.lookup(spotifyIdentifier, market, cancellation)]);
      checkCancellation(cancellation);
      if (!recording || !spotify || recording.identifier !== recordingIdentifier || spotify.identifier !== spotifyIdentifier
          || spotify.playable === false) throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
      await this.associations.save(Object.freeze({ catalogIdentity: this.recordings.identity,
        recordingNamespace: this.recordings.namespace, recordingIdentifier, spotifyIdentifier,
        policyVersion: this.ranker.policy.version, market, recordingFingerprint: songFingerprint(copySong(recording)),
        spotifyFingerprint: songFingerprint(copySong(spotify)) }));
      checkCancellation(cancellation);
    } catch (failure) { throw new IntegrationFailure(failureCode(failure)); }
  }

  private async importMatches(songs: readonly SpotifySong[], cancellation: AbortSignal): Promise<readonly RecordingImportMatch[]> {
    checkCancellation(cancellation);
    const matches = await withCancellation(this.recordingImportMatcher!.match(Object.freeze(songs.map(copySong)), cancellation), cancellation);
    checkCancellation(cancellation);
    const spotifyIdentifiers = new Set(songs.map(song => song.identifier));
    if (!Array.isArray(matches) || matches.length > songs.length) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
    const returnedSpotifyIdentifiers = new Set<string>();
    return Object.freeze(matches.map(match => {
      if (!match || typeof match.spotifyIdentifier !== TextType || !spotifyIdentifiers.has(match.spotifyIdentifier)
          || typeof match.recordingIdentifier !== TextType || !match.recordingIdentifier.trim()
          || typeof match.exact !== BooleanType || returnedSpotifyIdentifiers.has(match.spotifyIdentifier)) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
      returnedSpotifyIdentifiers.add(match.spotifyIdentifier);
      return Object.freeze({ spotifyIdentifier: match.spotifyIdentifier, recordingIdentifier: match.recordingIdentifier, exact: match.exact });
    }));
  }

  private applicable(association: ConfirmedAssociation): boolean {
    return association.recordingNamespace === this.recordings.namespace && association.policyVersion === this.ranker.policy.version;
  }

  private validate(identifier: string, market: string, cancellation: AbortSignal): void {
    checkCancellation(cancellation);
    if (!identifier.trim() || !ValidMarket.test(market)) throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
  }

  private confirmed<Song extends CatalogSong>(song: Song): MatchResult<Song> {
    const capturedSong = copySong(song);
    return Object.freeze({ status: MatchStatus.Matched, selected: capturedSong, failure: null,
      candidates: Object.freeze([Object.freeze({ song: capturedSong, score: ConfirmedScore,
        evidence: Object.freeze([MatchEvidence.Confirmed]), acceptable: true })]) });
  }

  private notFound<Song extends CatalogSong>(): MatchResult<Song> {
    return Object.freeze({ status: MatchStatus.NotFound, selected: null, candidates: Object.freeze([]), failure: null });
  }

  private failed<Song extends CatalogSong>(failure: unknown): MatchResult<Song> {
    return Object.freeze({ status: MatchStatus.Failed, selected: null, candidates: Object.freeze([]), failure: failureCode(failure) });
  }
}
