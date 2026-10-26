import type { HostedPlaybackCommand } from './hostedPlaybackCommands';

export enum SpotifyConnectCommandKind {
  AddToQueue = 'addToQueue',
}

export type SpotifyConnectCommand = HostedPlaybackCommand | {
  readonly kind: SpotifyConnectCommandKind.AddToQueue;
  readonly spotifyTrackIdentifier: string;
  readonly occurrenceIdentifier: string;
};

export interface SpotifyConnectCommandPort {
  execute(accountIdentifier: string, command: SpotifyConnectCommand, hostDeviceIdentifier: string, cancellation: AbortSignal): Promise<void>;
}
