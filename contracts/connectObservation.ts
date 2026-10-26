import type { HostedPlaybackRead } from './hostedPlayback';

export interface SpotifyConnectTrack {
  readonly uri: string;
  readonly occurrenceIdentifier: string | null;
  readonly provider: string;
}

export interface SpotifyConnectObservation {
  readonly generation: number;
  readonly hostDeviceIdentifier: string;
  readonly queueRevision: string;
  readonly currentTrack: SpotifyConnectTrack;
  readonly nextTracks: readonly SpotifyConnectTrack[];
  readonly previousTracks: readonly SpotifyConnectTrack[];
  readonly playback: HostedPlaybackRead;
  readonly buffering: boolean;
}

export interface SpotifyConnectObservationPort {
  read(accountIdentifier: string, hostDeviceIdentifier: string, cancellation: AbortSignal): Promise<SpotifyConnectObservation>;
}

export interface SpotifyConnectObservationBoundary {
  readonly handle: number;
  readonly generation: number;
  readonly hostDeviceIdentifier: string;
  readonly sentMonotonicMilliseconds: number;
  readonly receivedMonotonicMilliseconds: number;
}
