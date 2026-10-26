import type { SpotifySong } from '../../contracts/catalog';
import { IntegrationFailureCode } from '../../contracts/network';
import { IntegrationFailure } from '../network/IntegrationFailure';
import { copySong } from '../catalog/SongIdentity';
import { validateSpotifyQueueTrack } from '../session/SpotifyQueueTrack';

export const ConnectMetadataPolicy = Object.freeze({ minimumItems: 1, maximumItems: 20, maximumTextCharacters: 2048,
  maximumArtists: 32, maximumRecordingCodes: 16, minimumDurationMilliseconds: 1, stringType: 'string', objectType: 'object',
  artistSeparator: ', ', controlPattern: /[\u0000-\u001f\u007f]/ } as const);
function invalid(): never { throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse); }
function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== ConnectMetadataPolicy.objectType || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== ConnectMetadataPolicy.stringType || !(value as string).trim() || (value as string).length > ConnectMetadataPolicy.maximumTextCharacters
    || ConnectMetadataPolicy.controlPattern.test(value as string)) return invalid();
  return value as string;
}
function texts(value: unknown, maximumItems: number): readonly string[] {
  if (!Array.isArray(value) || value.length > maximumItems) return invalid();
  return Object.freeze(value.map(text));
}
export function copySpotifyConnectMetadataIdentifiers(input: readonly string[]): readonly string[] {
  if (!Array.isArray(input) || input.length < ConnectMetadataPolicy.minimumItems || input.length > ConnectMetadataPolicy.maximumItems) {
    throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
  }
  const identifiers = [...input];
  for (const identifier of identifiers) validateSpotifyQueueTrack(identifier);
  if (new Set(identifiers).size !== identifiers.length) throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
  return Object.freeze(identifiers);
}
export function decodeSpotifyConnectMetadata(value: unknown, handle: number, generation: number, identifiers: readonly string[]): readonly SpotifySong[] {
  const response = object(value);
  if (response.handle !== handle || response.generation !== generation || !Array.isArray(response.tracks) || response.tracks.length !== identifiers.length) return invalid();
  return Object.freeze(response.tracks.map((value, position) => {
    const track = object(value); const identifier = text(track.spotifyTrackIdentifier);
    if (identifier !== identifiers[position]) return invalid();
    const artistNames = texts(track.artistNames, ConnectMetadataPolicy.maximumArtists);
    const recordingCodes = texts(track.recordingCodes, ConnectMetadataPolicy.maximumRecordingCodes);
    if (artistNames.length < ConnectMetadataPolicy.minimumItems || !Number.isSafeInteger(track.durationMilliseconds)
      || (track.durationMilliseconds as number) < ConnectMetadataPolicy.minimumDurationMilliseconds) return invalid();
    return copySong({ identifier, title: text(track.title), author: artistNames.join(ConnectMetadataPolicy.artistSeparator), artistNames,
      recordingCodes, durationMilliseconds: track.durationMilliseconds as number });
  }));
}
