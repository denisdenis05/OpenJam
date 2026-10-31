import type { SpotifyConnectObservationPort } from '../../contracts/connectObservation';
import { IntegrationFailure } from '../network/IntegrationFailure';
import { IntegrationFailureCode } from '../../contracts/network';
import { ConnectObservationPolicy } from './SpotifyConnectObservationValues';
import type { HostedPlaybackReader, HostedPlaybackRead } from '../../contracts/hostedPlayback';

export class SpotifyConnectPlaybackReader implements HostedPlaybackReader {
  constructor(private readonly port: SpotifyConnectObservationPort, private readonly accountIdentifier: string) {}

  async read(hostDeviceIdentifier: string, cancellation: AbortSignal): Promise<HostedPlaybackRead> {
    const observation = await this.port.read(this.accountIdentifier, hostDeviceIdentifier, cancellation);
    const identifiers = new Set([observation.currentTrack.occurrenceIdentifier]);
    const upcomingOccurrences = observation.nextTracks.flatMap(track => {
      const matched = ConnectObservationPolicy.trackPattern.exec(track.uri);
      if (!matched || track.occurrenceIdentifier === null) return [];
      if (identifiers.has(track.occurrenceIdentifier)) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
      const spotifyTrackIdentifier = matched[ConnectObservationPolicy.firstIdentifier];
      if (!spotifyTrackIdentifier) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
      identifiers.add(track.occurrenceIdentifier);
      return [Object.freeze({ occurrenceIdentifier: track.occurrenceIdentifier,
        spotifyTrackIdentifier })];
    });
    return Object.freeze({ ...observation.playback, queue: Object.freeze({ revision: observation.queueRevision,
      upcomingOccurrences: Object.freeze(upcomingOccurrences) }) });
  }
}
