import type { CatalogSearch, SpotifyCatalog, SpotifySong } from '../../contracts/catalog';
import type { SpotifyConnectSearchPort } from '../../contracts/connectSearch';
import type { SpotifyConnectMetadataPort } from '../../contracts/connectMetadata';
import { IntegrationFailureCode } from '../../contracts/network';
import { validateSpotifyQueueTrack } from '../session/SpotifyQueueTrack';
import { checkCancellation, IntegrationFailure } from '../network/IntegrationFailure';

const Policy = Object.freeze({ marketPattern: /^[A-Z]{2}$/, firstPosition: 0, singleTrack: 1 } as const);

export class SpotifyConnectCatalog implements SpotifyCatalog {
  constructor(private readonly metadata: SpotifyConnectMetadataPort, private readonly searchCatalog: SpotifyCatalog,
    private readonly accountIdentifier: string, private readonly nativeSearch?: SpotifyConnectSearchPort) {}

  async lookup(identifier: string, market: string, cancellation: AbortSignal): Promise<SpotifySong | null> {
    checkCancellation(cancellation);
    validateSpotifyQueueTrack(identifier);
    if (!Policy.marketPattern.test(market)) throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
    let tracks: readonly SpotifySong[];
    try { tracks = await this.metadata.readMetadata(this.accountIdentifier, [identifier], cancellation); }
    catch (failure) {
      checkCancellation(cancellation);
      if (failure instanceof IntegrationFailure && failure.code === IntegrationFailureCode.NotFound) return null;
      throw failure;
    }
    checkCancellation(cancellation);
    if (tracks.length !== Policy.singleTrack || tracks[Policy.firstPosition]?.identifier !== identifier) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
    return tracks[Policy.firstPosition] ?? null;
  }

  search(search: CatalogSearch, market: string, cancellation: AbortSignal): Promise<readonly SpotifySong[]> {
    return this.nativeSearch ? this.nativeSearch.search(this.accountIdentifier, search, market, cancellation)
      : this.searchCatalog.search(search, market, cancellation);
  }
}
