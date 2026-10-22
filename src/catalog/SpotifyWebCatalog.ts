import type { CatalogSearch, SpotifyCatalog, SpotifySong } from '../../contracts/catalog';
import { IntegrationFailureCode } from '../../contracts/network';
import { checkCancellation, IntegrationFailure } from '../network/IntegrationFailure';
import { arrayValue, durationValue, objectValue, textValue } from '../network/ResponseValues';
import type { JsonReader } from '../network/SpotifyRequestClient';
import { copySong } from './SongIdentity';

const SpotifyCatalogProtocol = Object.freeze({
  origin: 'https://api.spotify.com/v1/', trackPath: 'tracks/', searchPath: 'search',
  marketParameter: 'market', queryParameter: 'q', typeParameter: 'type', trackType: 'track',
  limitParameter: 'limit', artistSeparator: ', ', queryTrackPrefix: 'track:', queryArtistPrefix: ' artist:',
  quote: '"', escape: '\\', firstPosition: 0, minimumLimit: 1, maximumLimit: 10,
});
const SearchSpecialCharacters = /["\\]/g;
const ValidMarket = /^[A-Z]{2}$/;
const ValidSpotifyIdentifier = /^[A-Za-z0-9]{22}$/;
const BooleanType = 'boolean';

export class SpotifyWebCatalog implements SpotifyCatalog {
  constructor(private readonly requests: JsonReader) {}

  async lookup(identifier: string, market: string, cancellation: AbortSignal): Promise<SpotifySong | null> {
    this.validateMarket(market);
    checkCancellation(cancellation);
    if (!ValidSpotifyIdentifier.test(identifier)) throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
    const address = new URL(SpotifyCatalogProtocol.trackPath + encodeURIComponent(identifier), SpotifyCatalogProtocol.origin);
    address.searchParams.set(SpotifyCatalogProtocol.marketParameter, market);
    try {
      const song = this.decode(await this.requests.read(address.toString(), cancellation));
      checkCancellation(cancellation);
      if (song.identifier !== identifier) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
      return song;
    } catch (failure) {
      if (failure instanceof IntegrationFailure && failure.code === IntegrationFailureCode.NotFound) return null;
      throw failure;
    }
  }

  async search(search: CatalogSearch, market: string, cancellation: AbortSignal): Promise<readonly SpotifySong[]> {
    this.validateMarket(market);
    checkCancellation(cancellation);
    if (!search.title.trim() || !search.author.trim() || !Number.isInteger(search.limit)
        || search.limit < SpotifyCatalogProtocol.minimumLimit) throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
    const limit = Math.min(search.limit, SpotifyCatalogProtocol.maximumLimit);
    const address = new URL(SpotifyCatalogProtocol.searchPath, SpotifyCatalogProtocol.origin);
    const quoted = (value: string) => SpotifyCatalogProtocol.quote
      + value.replace(SearchSpecialCharacters, character => SpotifyCatalogProtocol.escape + character) + SpotifyCatalogProtocol.quote;
    address.searchParams.set(SpotifyCatalogProtocol.queryParameter, SpotifyCatalogProtocol.queryTrackPrefix + quoted(search.title)
      + SpotifyCatalogProtocol.queryArtistPrefix + quoted(search.author));
    address.searchParams.set(SpotifyCatalogProtocol.typeParameter, SpotifyCatalogProtocol.trackType);
    address.searchParams.set(SpotifyCatalogProtocol.marketParameter, market);
    address.searchParams.set(SpotifyCatalogProtocol.limitParameter, String(limit));
    const response = objectValue(await this.requests.read(address.toString(), cancellation));
    checkCancellation(cancellation);
    return Object.freeze(arrayValue(objectValue(response.tracks).items).slice(SpotifyCatalogProtocol.firstPosition, limit)
      .map(value => this.decode(value)));
  }

  private decode(value: unknown): SpotifySong {
    const response = objectValue(value);
    const artistNames = arrayValue(response.artists).map(artist => textValue(objectValue(artist).name));
    const durationMilliseconds = durationValue(response.duration_ms);
    const externalIdentifiers = response.external_ids === undefined ? null : objectValue(response.external_ids);
    const recordingCode = externalIdentifiers?.isrc === undefined ? undefined : textValue(externalIdentifiers.isrc);
    if (response.is_playable !== undefined && typeof response.is_playable !== BooleanType) {
      throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
    }
    return copySong({ identifier: textValue(response.id), title: textValue(response.name),
      author: artistNames.join(SpotifyCatalogProtocol.artistSeparator), artistNames,
      ...(durationMilliseconds === undefined ? {} : { durationMilliseconds }),
      ...(recordingCode === undefined ? {} : { recordingCodes: [recordingCode] }),
      ...(response.is_playable === undefined ? {} : { playable: response.is_playable as boolean }) });
  }

  private validateMarket(market: string): void {
    if (!ValidMarket.test(market)) throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
  }
}
