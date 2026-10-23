import type { JamQueueProtocol } from '../../contracts/queue';
import { HttpMethod, IntegrationFailureCode } from '../../contracts/network';
import { checkCancellation, IntegrationFailure } from '../network/IntegrationFailure';
import { SpotifyRequestClient } from '../network/SpotifyRequestClient';
import { SpotifyQueueTrackPattern, validateSpotifyQueueTrack } from './SpotifyQueueTrack';

export const SpotifyQueuePolicy = Object.freeze({
  address: 'https://api.spotify.com/v1/me/player/queue', trackPrefix: 'spotify:track:',
  trackParameter: 'uri', deviceParameter: 'device_id', trackIdentifierPattern: SpotifyQueueTrackPattern,
  maximumDeviceIdentifierCharacters: 512, whitespacePattern: /\s/,
});

export class SpotifyWebQueueProtocol implements JamQueueProtocol {
  constructor(private readonly requests: SpotifyRequestClient) {}

  async addToQueue(spotifyTrackIdentifier: string, hostDeviceIdentifier: string, cancellation: AbortSignal): Promise<void> {
    checkCancellation(cancellation);
    validateSpotifyQueueTrack(spotifyTrackIdentifier);
    if (!hostDeviceIdentifier.trim() || hostDeviceIdentifier.length > SpotifyQueuePolicy.maximumDeviceIdentifierCharacters
      || SpotifyQueuePolicy.whitespacePattern.test(hostDeviceIdentifier)) throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
    const address = new URL(SpotifyQueuePolicy.address);
    address.searchParams.set(SpotifyQueuePolicy.trackParameter, SpotifyQueuePolicy.trackPrefix + spotifyTrackIdentifier);
    address.searchParams.set(SpotifyQueuePolicy.deviceParameter, hostDeviceIdentifier);
    const response = await this.requests.send(address.toString(), HttpMethod.Create, true, cancellation);
    if (response !== null) throw new IntegrationFailure(IntegrationFailureCode.UnknownOutcome);
  }
}
