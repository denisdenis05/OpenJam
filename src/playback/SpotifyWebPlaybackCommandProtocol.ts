import { HostedPlaybackCommandKind } from '../../contracts/hostedPlaybackCommands';
import type { HostedPlaybackCommand, HostedPlaybackCommandProtocol } from '../../contracts/hostedPlaybackCommands';
import type { HostedPlaybackRead } from '../../contracts/hostedPlayback';
import { HttpMethod, IntegrationFailureCode } from '../../contracts/network';
import { checkCancellation, IntegrationFailure } from '../network/IntegrationFailure';
import type { SpotifyRequestClient } from '../network/SpotifyRequestClient';
import { copyHostedPlaybackCommand } from './HostedPlaybackCommandValues';

const PlaybackCommandPolicy = Object.freeze({ origin: 'https://api.spotify.com/v1/me/player/', stringType: 'string',
  deviceParameter: 'device_id', positionParameter: 'position_ms', maximumDeviceCharacters: 512, whitespacePattern: /\s/ });

export interface HostedPlaybackCommandReader {
  read(hostDeviceIdentifier: string, cancellation: AbortSignal): Promise<HostedPlaybackRead>;
}

export class SpotifyWebPlaybackCommandProtocol implements HostedPlaybackCommandProtocol {
  constructor(private readonly requests: SpotifyRequestClient, private readonly reader: HostedPlaybackCommandReader) {}

  async execute(input: HostedPlaybackCommand, hostDeviceIdentifier: string, cancellation: AbortSignal): Promise<void> {
    checkCancellation(cancellation);
    const command = copyHostedPlaybackCommand(input);
    if (typeof hostDeviceIdentifier !== PlaybackCommandPolicy.stringType || !hostDeviceIdentifier.trim() || hostDeviceIdentifier.length > PlaybackCommandPolicy.maximumDeviceCharacters
      || PlaybackCommandPolicy.whitespacePattern.test(hostDeviceIdentifier)) throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
    const sample = await this.reader.read(hostDeviceIdentifier, cancellation);
    checkCancellation(cancellation);
    if (command.kind === HostedPlaybackCommandKind.Seek) {
      if (sample.spotifyTrackIdentifier !== command.expectedSpotifyTrackIdentifier) throw new IntegrationFailure(IntegrationFailureCode.Superseded);
      if (command.positionMilliseconds >= sample.durationMilliseconds) throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
    }
    const address = new URL(PlaybackCommandPolicy.origin + command.kind);
    address.searchParams.set(PlaybackCommandPolicy.deviceParameter, hostDeviceIdentifier);
    if (command.kind === HostedPlaybackCommandKind.Seek) address.searchParams.set(PlaybackCommandPolicy.positionParameter, String(command.positionMilliseconds));
    const method = command.kind === HostedPlaybackCommandKind.Next || command.kind === HostedPlaybackCommandKind.Previous ? HttpMethod.Create : HttpMethod.Replace;
    const response = await this.requests.send(address.toString(), method, true, cancellation);
    if (response !== null) throw new IntegrationFailure(IntegrationFailureCode.UnknownOutcome);
  }
}
