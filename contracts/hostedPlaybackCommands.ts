export enum HostedPlaybackCommandKind {
  Play = 'play', Pause = 'pause', Next = 'next', Previous = 'previous', Seek = 'seek',
}

export type HostedPlaybackCommand = {
  readonly kind: HostedPlaybackCommandKind.Play | HostedPlaybackCommandKind.Pause
    | HostedPlaybackCommandKind.Next | HostedPlaybackCommandKind.Previous;
} | {
  readonly kind: HostedPlaybackCommandKind.Seek;
  readonly positionMilliseconds: number;
  readonly expectedSpotifyTrackIdentifier: string;
};

export interface HostedPlaybackCommandProtocol {
  execute(command: HostedPlaybackCommand, hostDeviceIdentifier: string, cancellation: AbortSignal): Promise<void>;
}
