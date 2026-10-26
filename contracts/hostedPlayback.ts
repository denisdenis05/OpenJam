import type { SharedPlaybackIdentity } from './sharedPlayback';

export interface HostedPlaybackSample extends SharedPlaybackIdentity {
  readonly spotifyTrackIdentifier: string;
  readonly occurrenceIdentifier?: string;
  readonly buffering?: boolean;
  readonly positionMilliseconds: number;
  readonly durationMilliseconds: number;
  readonly playing: boolean;
  readonly anchorMonotonicMilliseconds: number;
  readonly observedMonotonicMilliseconds: number;
  readonly uncertaintyMilliseconds: number;
  readonly stateChangedAtUnixMilliseconds: number;
}

export type HostedPlaybackRead = Omit<HostedPlaybackSample, keyof SharedPlaybackIdentity>;

export interface HostedPlaybackReader {
  read(hostDeviceIdentifier: string, cancellation: AbortSignal): Promise<HostedPlaybackRead>;
}
