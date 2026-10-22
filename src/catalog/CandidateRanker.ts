import { ArtistCreditSource, MatchEvidence, MatchStatus } from '../../contracts/catalog';
import type { CatalogSong, MatchCandidate, MatchingPolicy, MatchResult } from '../../contracts/catalog';
import { IntegrationFailureCode } from '../../contracts/network';
import { IntegrationFailure } from '../network/IntegrationFailure';
import { artistIdentity, copySong, normalizeSongText, versionIdentity } from './SongIdentity';

export const DefaultMatchingPolicy: MatchingPolicy = Object.freeze({
  version: 'recording-evidence-v1', maximumCandidates: 20,
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
    const capturedSource = copySong(source);
    const identifiers = new Set<string>();
    const candidates: MatchCandidate<Song>[] = [];
    for (const song of songs.slice(RankingBounds.firstPosition, this.policy.maximumCandidates)) {
      if (identifiers.has(song.identifier)) continue;
      identifiers.add(song.identifier);
      candidates.push(this.score(capturedSource, copySong(song)));
    }
    candidates.sort((left, right) => right.score - left.score || this.compareIdentifiers(left.song.identifier, right.song.identifier));
    const first = candidates[RankingBounds.firstPosition];
    const second = candidates[RankingBounds.secondPosition];
    const margin = first && second ? first.score - second.score : Number.POSITIVE_INFINITY;
    const selected = first?.acceptable && margin >= this.policy.minimumSelectionMargin ? first.song : null;
    const status = selected ? MatchStatus.Matched : candidates.some(candidate =>
      candidate.evidence.includes(MatchEvidence.Artist) && (candidate.evidence.includes(MatchEvidence.Title)
        || candidate.evidence.includes(MatchEvidence.RecordingCode)))
      ? MatchStatus.Ambiguous : MatchStatus.NotFound;
    return Object.freeze({ status, candidates: Object.freeze(candidates), selected, failure: null });
  }

  private score<Song extends CatalogSong>(source: CatalogSong, song: Song): MatchCandidate<Song> {
    const evidence: MatchEvidence[] = [];
    let score = EvidenceScore.none;
    const titleMatches = normalizeSongText(source.title) === normalizeSongText(song.title);
    const artistMatches = artistIdentity(source) === artistIdentity(song);
    const versionConflict = versionIdentity(source) !== versionIdentity(song);
    const unavailable = AvailableProperty in song && (song as CatalogSong & { playable?: boolean }).playable === false;
    if (titleMatches) { evidence.push(MatchEvidence.Title); score += EvidenceScore.title; }
    if (artistMatches) { evidence.push(MatchEvidence.Artist); score += EvidenceScore.artist; }
    const durationMatches = source.durationMilliseconds !== undefined && song.durationMilliseconds !== undefined
      && Math.abs(source.durationMilliseconds - song.durationMilliseconds) <= this.policy.durationToleranceMilliseconds;
    const durationConflict = source.durationMilliseconds !== undefined && song.durationMilliseconds !== undefined && !durationMatches;
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
    const acceptable = artistMatches && !versionConflict && !durationConflict && !codeConflict && !unavailable && !releaseCreditOnly
      && (codeMatches || (titleMatches && durationMatches));
    return Object.freeze({ song, score, evidence: Object.freeze(evidence), acceptable });
  }

  private compareIdentifiers(left: string, right: string): number {
    return left === right ? RankingBounds.equivalentIdentifiers
      : left < right ? RankingBounds.precedingIdentifier : RankingBounds.followingIdentifier;
  }
}

const AvailableProperty = 'playable';
