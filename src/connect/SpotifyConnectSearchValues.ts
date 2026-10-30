import type { CatalogSearch, SpotifySong } from '../../contracts/catalog';
import { IntegrationFailureCode } from '../../contracts/network';
import { IntegrationFailure } from '../network/IntegrationFailure';
import { validateSpotifyQueueTrack } from '../session/SpotifyQueueTrack';
import { decodeSpotifyConnectMetadata } from './SpotifyConnectMetadataValues';

export const ConnectSearchPolicy = Object.freeze({ minimumResults: 1, maximumResults: 10, maximumTextCharacters: 2048,
  stringType: 'string', objectType: 'object', booleanType: 'boolean', marketPattern: /^[A-Z]{2}$/,
  controlPattern: /[\u0000-\u001f\u007f]/ } as const);

export function copySpotifyConnectSearch(search: CatalogSearch, market: string): CatalogSearch & { readonly market: string } {
  if (!search || ![search.title, search.author].every(value => typeof value === ConnectSearchPolicy.stringType
    && value.trim() && value.length <= ConnectSearchPolicy.maximumTextCharacters && !ConnectSearchPolicy.controlPattern.test(value))
    || !Number.isSafeInteger(search.limit) || search.limit < ConnectSearchPolicy.minimumResults || !ConnectSearchPolicy.marketPattern.test(market)) {
    throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
  }
  return Object.freeze({ title: search.title, author: search.author, market, limit: Math.min(search.limit, ConnectSearchPolicy.maximumResults) });
}

export function decodeSpotifyConnectSearch(value: unknown, handle: number, generation: number, limit: number): readonly SpotifySong[] {
  const response = value as { readonly handle?: unknown; readonly generation?: unknown; readonly tracks?: unknown } | null;
  if (!response || typeof response !== ConnectSearchPolicy.objectType || response.handle !== handle || response.generation !== generation
    || !Array.isArray(response.tracks) || response.tracks.length > limit || limit < ConnectSearchPolicy.minimumResults
    || limit > ConnectSearchPolicy.maximumResults || !Number.isSafeInteger(limit)) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
  const returnedTracks = response.tracks;
  const identifiers = returnedTracks.map((track: unknown) => {
    const item = track as { readonly spotifyTrackIdentifier?: unknown; readonly playable?: unknown } | null;
    if (!item || typeof item !== ConnectSearchPolicy.objectType || typeof item.spotifyTrackIdentifier !== ConnectSearchPolicy.stringType
      || item.playable !== undefined && typeof item.playable !== ConnectSearchPolicy.booleanType) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
    try { validateSpotifyQueueTrack(item.spotifyTrackIdentifier as string); }
    catch { throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse); }
    return item.spotifyTrackIdentifier as string;
  });
  if (new Set(identifiers).size !== identifiers.length) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
  const tracks = decodeSpotifyConnectMetadata(response, handle, generation, identifiers);
  return Object.freeze(tracks.map((track, position) => {
    const playable = returnedTracks[position]?.playable as boolean | undefined;
    return Object.freeze({ ...track, ...(playable === undefined ? {} : { playable }) });
  }));
}
