import { ArtistCreditSource, MatchEvidence, MatchStatus } from '../../contracts/catalog';
import type { CatalogSong, MatchCandidate, MatchingPolicy, MatchResult } from '../../contracts/catalog';
import { IntegrationFailureCode } from '../../contracts/network';
import { IntegrationFailure } from '../network/IntegrationFailure';
import { hasCompatibleRecordingArtists, copySong, hasSharedRecordingArtist, importRecordingTitle, normalizeSongText, versionIdentity } from './SongIdentity';

export const DefaultMatchingPolicy: MatchingPolicy = Object.freeze({
  version: 'recording-evidence-v4', maximumCandidates: 20,
  durationToleranceMilliseconds: 2000, minimumSelectionMargin: 10,
});

const EvidenceScore = Object.freeze({ none: 0, title: 40, artist: 30, duration: 15, recordingCode: 100 });
const RankingBounds = Object.freeze({ firstPosition: 0, secondPosition: 1, minimumCandidates: 1, maximumCandidates: 100,
  minimumDurationToleranceMilliseconds: 0, minimumSelectionMargin: 0, emptyRecordingCodeCount: 0,
  equivalentIdentifiers: 0, precedingIdentifier: -1, followingIdentifier: 1 });

export class CandidateRanker {
  readonly policy: MatchingPolicy;

  constructor(policy: MatchingPolicy = DefaultMatchingPolicy) {
    if (!policy.version.trim() || !Number.isInteger(policy.maximumCandidates)
        || policy.maximumCandidates < RankingBounds.minimumCandidates || policy.maximumCandidates > RankingBounds.maximumCandidates
        || !Number.isFinite(policy.durationToleranceMilliseconds) || policy.durationToleranceMilliseconds < RankingBounds.minimumDurationToleranceMilliseconds
        || !Number.isFinite(policy.minimumSelectionMargin) || policy.minimumSelectionMargin < RankingBounds.minimumSelectionMargin) {
      throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
    }
    this.policy = Object.freeze({ ...policy });
  }

  rank<Song extends CatalogSong>(source: CatalogSong, songs: readonly Song[]): MatchResult<Song> {
    return this.rankWithImportMatches(source, songs, []);
  }

  rankWithImportMatches<Song extends CatalogSong>(source: CatalogSong, songs: readonly Song[],
    confirmedCandidateIdentifiers: readonly string[]): MatchResult<Song> {
    const importedIdentifiers = new Set(confirmedCandidateIdentifiers);
    const capturedSource = copySong(source);
    const identifiers = new Set<string>();
    const candidates: MatchCandidate<Song>[] = [];
    for (const song of songs.slice(RankingBounds.firstPosition, this.policy.maximumCandidates)) {
      if (identifiers.has(song.identifier)) continue;
      identifiers.add(song.identifier);
      candidates.push(this.score(capturedSource, copySong(song), importedIdentifiers.has(song.identifier)));
    }
    candidates.sort((left, right) => right.score - left.score || this.compareIdentifiers(left.song.identifier, right.song.identifier));
    const first = candidates[RankingBounds.firstPosition];
    const selected = first?.acceptable && this.hasSelectionMargin(first, candidates) ? first.song : null;
    const status = selected ? MatchStatus.Matched : candidates.some(candidate =>
      candidate.evidence.includes(MatchEvidence.Artist) && (candidate.evidence.includes(MatchEvidence.Title)
        || candidate.evidence.includes(MatchEvidence.RecordingCode)))
      ? MatchStatus.Ambiguous : MatchStatus.NotFound;
    return Object.freeze({ status, candidates: Object.freeze(candidates), selected, failure: null });
  }

  private hasSelectionMargin<Song extends CatalogSong>(first: MatchCandidate<Song>, candidates: readonly MatchCandidate<Song>[]): boolean {
    const competitors = candidates.slice(RankingBounds.secondPosition)
      .filter(candidate => first.score - candidate.score < this.policy.minimumSelectionMargin);
    return competitors.every(candidate => candidate.acceptable
      && this.areEquivalentRecordings(first, candidate)
      && competitors.every(other => this.areEquivalentRecordings(candidate, other)));
  }

  private areEquivalentRecordings(left: MatchCandidate, right: MatchCandidate): boolean {
    const importEquivalent = left.evidence.includes(MatchEvidence.Import) && right.evidence.includes(MatchEvidence.Import)
      && importRecordingTitle(left.song.title) === importRecordingTitle(right.song.title)
      && hasSharedRecordingArtist(left.song, right.song);
    const strictEquivalent = importRecordingTitle(left.song.title) === importRecordingTitle(right.song.title)
      && hasCompatibleRecordingArtists(left.song, right.song);
    if (!importEquivalent && !strictEquivalent) return false;
    const leftCodes = [...new Set((left.song.recordingCodes ?? []).map(normalizeSongText))].sort();
    const rightCodes = [...new Set((right.song.recordingCodes ?? []).map(normalizeSongText))].sort();
    return leftCodes.length === RankingBounds.emptyRecordingCodeCount || rightCodes.length === RankingBounds.emptyRecordingCodeCount
      || JSON.stringify(leftCodes) === JSON.stringify(rightCodes);
  }

  private score<Song extends CatalogSong>(source: CatalogSong, song: Song, imported: boolean): MatchCandidate<Song> {
    const evidence: MatchEvidence[] = [];
    let score = EvidenceScore.none;
    const sourceTitle = importRecordingTitle(source.title);
    const titleMatches = Boolean(sourceTitle) && sourceTitle === importRecordingTitle(song.title);
    const versionConflict = versionIdentity(source) !== versionIdentity(song);
    const unavailable = [source, song].some(candidate => AvailableProperty in candidate
      && (candidate as CatalogSong & { playable?: boolean }).playable === false);
    if (titleMatches) { evidence.push(MatchEvidence.Title); score += EvidenceScore.title; }
    const durationMatches = source.durationMilliseconds !== undefined && song.durationMilliseconds !== undefined
      && Math.abs(source.durationMilliseconds - song.durationMilliseconds) <= this.policy.durationToleranceMilliseconds;
    const importedIdentityMatches = imported && importRecordingTitle(source.title) === importRecordingTitle(song.title)
      && hasSharedRecordingArtist(source, song);
    const artistMatches = hasCompatibleRecordingArtists(source, song) || importedIdentityMatches;
    if (artistMatches) { evidence.push(MatchEvidence.Artist); score += EvidenceScore.artist; }
    if (durationMatches) { evidence.push(MatchEvidence.Duration); score += EvidenceScore.duration; }
    const recordingCodes = new Set((source.recordingCodes ?? []).map(normalizeSongText));
    const codeMatches = (song.recordingCodes ?? []).some(code => recordingCodes.has(normalizeSongText(code)));
    const codeConflict = recordingCodes.size > RankingBounds.emptyRecordingCodeCount
      && (song.recordingCodes?.length ?? RankingBounds.emptyRecordingCodeCount) > RankingBounds.emptyRecordingCodeCount && !codeMatches;
    if (codeMatches) { evidence.push(MatchEvidence.RecordingCode); score += EvidenceScore.recordingCode; }
    if (codeConflict) evidence.push(MatchEvidence.RecordingCodeConflict);
    if (versionConflict) evidence.push(MatchEvidence.VersionConflict);
    if (unavailable) evidence.push(MatchEvidence.Unavailable);
    const releaseCreditOnly = source.artistCreditSource === ArtistCreditSource.Release || song.artistCreditSource === ArtistCreditSource.Release;
    if (importedIdentityMatches) evidence.push(MatchEvidence.Import);
    const strictIdentityMatches = artistMatches && !releaseCreditOnly && titleMatches;
    const acceptable = !codeConflict && !unavailable
      && (importedIdentityMatches || strictIdentityMatches);
    return Object.freeze({ song, score, evidence: Object.freeze(evidence), acceptable });
  }

  private compareIdentifiers(left: string, right: string): number {
    return left === right ? RankingBounds.equivalentIdentifiers
      : left < right ? RankingBounds.precedingIdentifier : RankingBounds.followingIdentifier;
  }
}

const AvailableProperty = 'playable';
