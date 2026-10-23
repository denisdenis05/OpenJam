import { IntegrationFailureCode } from '../../contracts/network';
import { IntegrationFailure } from '../network/IntegrationFailure';

export const SpotifyQueueTrackPattern = /^[A-Za-z0-9]{22}$/;

export function validateSpotifyQueueTrack(spotifyTrackIdentifier: string): void {
  if (!SpotifyQueueTrackPattern.test(spotifyTrackIdentifier)) throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
}
