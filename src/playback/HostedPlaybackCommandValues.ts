import { HostedPlaybackCommandKind } from '../../contracts/hostedPlaybackCommands';
import type { HostedPlaybackCommand } from '../../contracts/hostedPlaybackCommands';
import { IntegrationFailureCode } from '../../contracts/network';
import { IntegrationFailure } from '../network/IntegrationFailure';
import { validateSpotifyQueueTrack } from '../session/SpotifyQueueTrack';

const CommandValuePolicy = Object.freeze({ objectType: 'object', minimumPositionMilliseconds: 0 });

export function copyHostedPlaybackCommand(command: HostedPlaybackCommand): HostedPlaybackCommand {
  if (typeof command !== CommandValuePolicy.objectType || command === null) throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
  switch (command.kind) {
    case HostedPlaybackCommandKind.Play:
    case HostedPlaybackCommandKind.Pause:
    case HostedPlaybackCommandKind.Next:
    case HostedPlaybackCommandKind.Previous: return Object.freeze({ kind: command.kind });
    case HostedPlaybackCommandKind.Seek:
      if (!Number.isSafeInteger(command.positionMilliseconds) || command.positionMilliseconds < CommandValuePolicy.minimumPositionMilliseconds) {
        throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
      }
      validateSpotifyQueueTrack(command.expectedSpotifyTrackIdentifier);
      return Object.freeze({ kind: command.kind, positionMilliseconds: command.positionMilliseconds,
        expectedSpotifyTrackIdentifier: command.expectedSpotifyTrackIdentifier });
    default: throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
  }
}
