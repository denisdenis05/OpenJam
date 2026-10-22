import type { IntegrationFailureCode } from './network';

export interface JamParticipant {
  readonly identifier: string;
  readonly displayName: string;
}

export interface JamSession {
  readonly identifier: string;
  readonly ownedByCurrentAccount: boolean;
  readonly active: boolean;
  readonly participants: readonly JamParticipant[];
}

export interface JamInvitation {
  readonly joinToken: string;
  readonly address: string;
}

export interface JamSessionResponse {
  readonly session: JamSession;
  readonly invitation: JamInvitation | null;
}

export interface JamProtocol {
  createOrActivate(cancellation: AbortSignal): Promise<JamSessionResponse>;
  end(identifier: string, cancellation: AbortSignal): Promise<void>;
  readCurrent?(deviceIdentifier: string, cancellation: AbortSignal): Promise<JamSessionResponse | null>;
}

export enum JamConnectionStatus {
  Detached = 'detached',
  Ready = 'ready',
  Operating = 'operating',
  Uncertain = 'uncertain',
  Failed = 'failed',
}

export interface JamSnapshot {
  readonly accountIdentifier: string | null;
  readonly status: JamConnectionStatus;
  readonly session: JamSession | null;
  readonly failure: IntegrationFailureCode | null;
}

export interface JamCommandResult {
  readonly applied: boolean;
  readonly failure: IntegrationFailureCode | null;
}

export interface ExternalStore<State> {
  getSnapshot(): State;
  subscribe(listener: () => void): () => void;
}

export interface JamCapabilities {
  readonly createOrActivate: boolean;
  readonly end: boolean;
  readonly refresh: boolean;
  readonly resolveInvitation: boolean;
  readonly join: boolean;
  readonly leave: boolean;
  readonly observe: boolean;
  readonly queue: boolean;
}
