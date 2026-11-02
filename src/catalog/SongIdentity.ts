import type { CatalogSong } from '../../contracts/catalog';
import { IntegrationFailureCode } from '../../contracts/network';
import { IntegrationFailure } from '../network/IntegrationFailure';

const UnicodeNormalization = 'NFKD';
const CombiningMarks = /\p{M}/gu;
const Punctuation = /[^\p{L}\p{N}]+/gu;
const Whitespace = /\s+/g;
const EmptyText = '';
const WordSeparator = ' ';
const VersionSuffix = /(?:\(|\[|\s[-–—]\s)([^)\]]+)/gu;
const VersionLabel = /\b(live|remix|acoustic|instrumental|radio edit|sped up|slowed|demo)\b/gu;
const CapturedSuffixIndex = 1;
const MinimumDurationMilliseconds = 0;
const FirstPosition = 0;
const ImportedFeaturedArtistAnnotation = /\s*[\[\(]\s*(feat|ft)\.?\s+.*?[\]\)]/gi;

export function normalizeSongText(value: string): string {
  return value.normalize(UnicodeNormalization).replace(CombiningMarks, EmptyText)
    .toLowerCase().replace(Punctuation, WordSeparator).replace(Whitespace, WordSeparator).trim();
}

export function copySong<Song extends CatalogSong>(song: Song): Song {
  if (![song.identifier, song.title, song.author].every(value => typeof value === TextType && value.trim() !== EmptyText)
      || (song.durationMilliseconds !== undefined && (!Number.isFinite(song.durationMilliseconds)
        || song.durationMilliseconds < MinimumDurationMilliseconds))
      || (song.artistNames !== undefined && !song.artistNames.every(value => typeof value === TextType && value.trim() !== EmptyText))
      || (song.recordingCodes !== undefined && !song.recordingCodes.every(value => typeof value === TextType && value.trim() !== EmptyText))) {
    throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
  }
  return Object.freeze({ ...song,
    ...(song.artistNames === undefined ? {} : { artistNames: Object.freeze([...song.artistNames]) }),
    ...(song.recordingCodes === undefined ? {} : { recordingCodes: Object.freeze([...song.recordingCodes]) }),
  });
}

const TextType = 'string';

export function artistIdentity(song: CatalogSong): string {
  const names = song.artistNames?.length ? song.artistNames : [song.author];
  return JSON.stringify([...new Set(names.map(normalizeSongText))].sort());
}

export function importRecordingTitle(title: string): string {
  return normalizeSongText(title.replace(ImportedFeaturedArtistAnnotation, EmptyText).trim());
}

export function hasSharedRecordingArtist(left: CatalogSong, right: CatalogSong): boolean {
  const leftNames = new Set((left.artistNames?.length ? left.artistNames : [left.author]).map(normalizeSongText));
  return (right.artistNames?.length ? right.artistNames : [right.author]).some(name => leftNames.has(normalizeSongText(name)));
}

export function versionIdentity(song: CatalogSong): string {
  const versions = [...song.title.toLowerCase().matchAll(VersionSuffix)].flatMap(match => {
    const suffix = match[CapturedSuffixIndex] ?? EmptyText;
    return [...suffix.matchAll(VersionLabel)].map(label => label[FirstPosition]);
  });
  return JSON.stringify([...new Set(versions)].sort());
}

export function songFingerprint(song: CatalogSong): string {
  return JSON.stringify({ identifier: song.identifier, title: normalizeSongText(song.title),
    artists: artistIdentity(song), durationMilliseconds: song.durationMilliseconds ?? null,
    recordingCodes: [...(song.recordingCodes ?? [])].map(normalizeSongText).sort(),
    version: versionIdentity(song), release: song.releaseTitle ?? null, artistCreditSource: song.artistCreditSource ?? null });
}
