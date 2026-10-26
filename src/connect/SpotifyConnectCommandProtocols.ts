import type { SpotifyConnectCommand, SpotifyConnectCommandPort } from '../../contracts/connectCommands';
import { SpotifyConnectCommandKind } from '../../contracts/connectCommands';
import type { HostedPlaybackCommand, HostedPlaybackCommandProtocol } from '../../contracts/hostedPlaybackCommands';
import type { JamQueueProtocol } from '../../contracts/queue';
import { IntegrationFailureCode } from '../../contracts/network';
import { checkCancellation, IntegrationFailure } from '../network/IntegrationFailure';
import { copyHostedPlaybackCommand } from '../playback/HostedPlaybackCommandValues';
import { validateSpotifyQueueTrack } from '../session/SpotifyQueueTrack';

const Policy = Object.freeze({ stringType: 'string', maximumDeviceCharacters: 512, maximumOccurrenceCharacters: 128,
  controlPattern: /[\u0000-\u0020\u007f]/ } as const);

function requireIdentifier(value: string, maximumCharacters: number): void {
  if (typeof value !== Policy.stringType || !value.length || value.length > maximumCharacters || Policy.controlPattern.test(value)) {
    throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
  }
}

export function copySpotifyConnectCommand(input: SpotifyConnectCommand): SpotifyConnectCommand {
  if (input?.kind !== SpotifyConnectCommandKind.AddToQueue) return copyHostedPlaybackCommand(input as HostedPlaybackCommand);
  validateSpotifyQueueTrack(input.spotifyTrackIdentifier);
  requireIdentifier(input.occurrenceIdentifier, Policy.maximumOccurrenceCharacters);
  return Object.freeze({ kind: SpotifyConnectCommandKind.AddToQueue, spotifyTrackIdentifier: input.spotifyTrackIdentifier,
    occurrenceIdentifier: input.occurrenceIdentifier });
}

export class SpotifyConnectPlaybackCommandProtocol implements HostedPlaybackCommandProtocol {
  constructor(private readonly port: SpotifyConnectCommandPort, private readonly accountIdentifier: string) {}

  async execute(input: HostedPlaybackCommand, hostDeviceIdentifier: string, cancellation: AbortSignal): Promise<void> {
    checkCancellation(cancellation);
    const command = copyHostedPlaybackCommand(input);
    requireIdentifier(hostDeviceIdentifier, Policy.maximumDeviceCharacters);
    await this.port.execute(this.accountIdentifier, command, hostDeviceIdentifier, cancellation);
  }
}

export class SpotifyConnectQueueProtocol implements JamQueueProtocol {
  constructor(private readonly port: SpotifyConnectCommandPort, private readonly accountIdentifier: string,
    private readonly nextOccurrenceIdentifier: () => string) {}

  async addToQueue(spotifyTrackIdentifier: string, hostDeviceIdentifier: string, cancellation: AbortSignal): Promise<void> {
    checkCancellation(cancellation);
    validateSpotifyQueueTrack(spotifyTrackIdentifier);
    requireIdentifier(hostDeviceIdentifier, Policy.maximumDeviceCharacters);
    const occurrenceIdentifier = this.nextOccurrenceIdentifier();
    const command = copySpotifyConnectCommand({ kind: SpotifyConnectCommandKind.AddToQueue, spotifyTrackIdentifier, occurrenceIdentifier });
    checkCancellation(cancellation);
    await this.port.execute(this.accountIdentifier, command, hostDeviceIdentifier, cancellation);
  }
}
