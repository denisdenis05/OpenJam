import type { CatalogSearch, SpotifySong } from './catalog';

export interface SpotifyConnectSearchPort {
  search(accountIdentifier: string, search: CatalogSearch, market: string, cancellation: AbortSignal): Promise<readonly SpotifySong[]>;
}
