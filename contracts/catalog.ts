import type { IntegrationFailureCode } from './network';

export enum RecordingNamespace {
  MusicBrainz = 'musicbrainz-recording',
  Local = 'local-recording',
}

export enum ArtistCreditSource {
  Recording = 'recording',
  Release = 'release',
}

export interface CatalogSong {
  readonly identifier: string;
  readonly title: string;
  readonly author: string;
  readonly artistNames?: readonly string[];
  readonly durationMilliseconds?: number;
  readonly recordingCodes?: readonly string[];
  readonly releaseTitle?: string;
  readonly artistCreditSource?: ArtistCreditSource;
}

export interface SpotifySong extends CatalogSong {
  readonly playable?: boolean;
}

export interface CatalogSearch {
  readonly title: string;
  readonly author: string;
  readonly limit: number;
}

export interface RecordingCatalog {
  readonly identity: string;
  readonly namespace: RecordingNamespace;
  lookup(identifier: string, cancellation: AbortSignal): Promise<CatalogSong | null>;
  search(search: CatalogSearch, cancellation: AbortSignal): Promise<readonly CatalogSong[]>;
}

export interface SpotifyCatalog {
  lookup(identifier: string, market: string, cancellation: AbortSignal): Promise<SpotifySong | null>;
  search(search: CatalogSearch, market: string, cancellation: AbortSignal): Promise<readonly SpotifySong[]>;
}

export enum MatchStatus {
  Matched = 'matched',
  Ambiguous = 'ambiguous',
  NotFound = 'not-found',
  Failed = 'failed',
}

export enum MatchEvidence {
  Confirmed = 'confirmed',
  RecordingCode = 'recording-code',
  RecordingCodeConflict = 'recording-code-conflict',
  Title = 'title',
  Artist = 'artist',
  Duration = 'duration',
  VersionConflict = 'version-conflict',
  Unavailable = 'unavailable',
}

export interface MatchCandidate<Song extends CatalogSong = CatalogSong> {
  readonly song: Song;
  readonly score: number;
  readonly evidence: readonly MatchEvidence[];
  readonly acceptable: boolean;
}

export interface MatchResult<Song extends CatalogSong = CatalogSong> {
  readonly status: MatchStatus;
  readonly candidates: readonly MatchCandidate<Song>[];
  readonly selected: Song | null;
  readonly failure: IntegrationFailureCode | null;
}

export interface MatchingPolicy {
  readonly version: string;
  readonly maximumCandidates: number;
  readonly durationToleranceMilliseconds: number;
  readonly minimumSelectionMargin: number;
}

export interface ConfirmedAssociation {
  readonly catalogIdentity: string;
  readonly recordingNamespace: RecordingNamespace;
  readonly recordingIdentifier: string;
  readonly spotifyIdentifier: string;
  readonly policyVersion: string;
  readonly market: string;
  readonly recordingFingerprint: string;
  readonly spotifyFingerprint: string;
}

export interface AssociationStore {
  findForRecording(catalogIdentity: string, identifier: string, market: string): Promise<readonly ConfirmedAssociation[]>;
  findForSpotify(catalogIdentity: string, identifier: string, market: string): Promise<readonly ConfirmedAssociation[]>;
  save(association: ConfirmedAssociation): Promise<void>;
}
