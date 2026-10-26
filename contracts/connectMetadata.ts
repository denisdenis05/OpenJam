import type { SpotifySong } from './catalog';

export interface SpotifyConnectMetadataPort {
  readMetadata(accountIdentifier: string, spotifyTrackIdentifiers: readonly string[], cancellation: AbortSignal): Promise<readonly SpotifySong[]>;
}
