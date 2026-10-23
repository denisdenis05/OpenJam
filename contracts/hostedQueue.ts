import type { IntegrationFailureCode } from './network';
import type { ExternalStore } from './session';

export enum HostedQueueStatus {
  Detached = 'detached',
  Idle = 'idle',
  Loading = 'loading',
  Ready = 'ready',
  Stale = 'stale',
  Failed = 'failed',
}

export enum HostedQueueItemKind {
  Track = 'track',
  Episode = 'episode',
}

export interface HostedQueueItem {
  readonly uri: string;
  readonly title: string;
  readonly author: string;
  readonly kind: HostedQueueItemKind;
  readonly durationMilliseconds: number | null;
}

export interface HostedQueueResponse {
  readonly currentlyPlaying: HostedQueueItem | null;
  readonly entries: readonly HostedQueueItem[];
}

export interface HostedQueueReader {
  read(hostDeviceIdentifier: string, cancellation: AbortSignal): Promise<HostedQueueResponse>;
}

export interface HostedQueueSnapshot extends HostedQueueResponse {
  readonly enabled: boolean;
  readonly status: HostedQueueStatus;
  readonly sessionIdentifier: string | null;
  readonly hostDeviceIdentifier: string | null;
  readonly observedAtMilliseconds: number | null;
  readonly failure: IntegrationFailureCode | null;
}

export interface HostedQueueObservation extends ExternalStore<HostedQueueSnapshot> {
  refresh(): Promise<void>;
  setObserving(observing: boolean): void;
  setActive(active: boolean): void;
  dispose(): void;
}
