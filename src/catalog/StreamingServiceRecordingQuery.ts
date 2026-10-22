import { ArtistCreditSource } from '../../contracts/catalog';
import type { CatalogSearch, CatalogSong } from '../../contracts/catalog';
import { IntegrationFailureCode } from '../../contracts/network';
import { checkCancellation, IntegrationFailure } from '../network/IntegrationFailure';
import { arrayValue, durationValue, objectValue, textValue } from '../network/ResponseValues';
import type { JsonReader } from '../network/SpotifyRequestClient';
import type { RecordingQuery } from './QueryableRecordingCatalog';
import { copySong } from './SongIdentity';
import { pathSegment } from '../network/PathSegment';

export const RecordingQueryProtocol = Object.freeze({
  route: 'spotify/catalog/recordings/', searchRoute: 'search', titleParameter: 'title',
  authorParameter: 'author', limitParameter: 'limit', firstPosition: 0,
});

export class StreamingServiceRecordingQuery implements RecordingQuery {
  private readonly serviceAddress: string;

  constructor(serviceAddress: string, private readonly requests: JsonReader) {
    try { this.serviceAddress = new URL(RecordingQueryProtocol.route, serviceAddress).toString(); }
    catch { throw new IntegrationFailure(IntegrationFailureCode.InvalidInput); }
  }

  async lookup(identifier: string, cancellation: AbortSignal): Promise<CatalogSong | null> {
    checkCancellation(cancellation);
    try {
      const song = this.decode(await this.requests.read(new URL(pathSegment(identifier), this.serviceAddress).toString(), cancellation));
      checkCancellation(cancellation);
      if (song.identifier !== identifier) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
      return song;
    } catch (failure) {
      if (failure instanceof IntegrationFailure && failure.code === IntegrationFailureCode.NotFound) return null;
      throw failure;
    }
  }

  async search(search: CatalogSearch, cancellation: AbortSignal): Promise<readonly CatalogSong[]> {
    checkCancellation(cancellation);
    const address = new URL(RecordingQueryProtocol.searchRoute, this.serviceAddress);
    address.searchParams.set(RecordingQueryProtocol.titleParameter, search.title);
    address.searchParams.set(RecordingQueryProtocol.authorParameter, search.author);
    address.searchParams.set(RecordingQueryProtocol.limitParameter, String(search.limit));
    const response = await this.requests.read(address.toString(), cancellation);
    checkCancellation(cancellation);
    return Object.freeze(arrayValue(response).slice(RecordingQueryProtocol.firstPosition, search.limit).map(value => this.decode(value)));
  }

  private decode(value: unknown): CatalogSong {
    const response = objectValue(value);
    const durationMilliseconds = durationValue(response.durationMilliseconds);
    const artistNames = response.artistNames === undefined ? undefined : arrayValue(response.artistNames).map(textValue);
    const artistCreditSource = response.artistCreditSource;
    if (artistCreditSource !== undefined && artistCreditSource !== ArtistCreditSource.Recording && artistCreditSource !== ArtistCreditSource.Release) {
      throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
    }
    return copySong({ identifier: textValue(response.identifier), title: textValue(response.title), author: textValue(response.author),
      ...(artistNames === undefined ? {} : { artistNames }),
      ...(artistCreditSource === undefined ? {} : { artistCreditSource }),
      ...(durationMilliseconds === undefined ? {} : { durationMilliseconds }) });
  }
}
