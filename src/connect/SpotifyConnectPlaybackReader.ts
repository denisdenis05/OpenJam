import type { SpotifyConnectObservationPort } from '../../contracts/connectObservation';
import type { HostedPlaybackReader, HostedPlaybackRead } from '../../contracts/hostedPlayback';

export class SpotifyConnectPlaybackReader implements HostedPlaybackReader {
  constructor(private readonly port: SpotifyConnectObservationPort, private readonly accountIdentifier: string) {}

  async read(hostDeviceIdentifier: string, cancellation: AbortSignal): Promise<HostedPlaybackRead> {
    const observation = await this.port.read(this.accountIdentifier, hostDeviceIdentifier, cancellation);
    return observation.playback;
  }
}
