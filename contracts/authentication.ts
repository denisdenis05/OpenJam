import type { Clock, HttpExecutor, SpotifyCredentialProvider, SpotifyCredentials } from './network';

export interface SpotifyLoginProvider extends SpotifyCredentialProvider {
  login(cancellation: AbortSignal): Promise<SpotifyCredentials>;
  logout(): void | Promise<void>;
  restore?(cancellation: AbortSignal): Promise<SpotifyCredentials>;
  dispose?(): void;
}

export interface SpotifyLoginConfiguration {
  readonly clientIdentifier: string;
  readonly redirectAddress: string;
  readonly scopes: readonly string[];
}

export interface SpotifyProofKey {
  readonly verifier: string;
  readonly challenge: string;
  readonly state: string;
}

export interface SpotifyProofKeyGenerator {
  generate(): Promise<SpotifyProofKey>;
}

export interface SpotifyLoginBrowser {
  authorize(address: string, redirectAddress: string, cancellation: AbortSignal): Promise<string>;
}

export interface SpotifyLoginDependencies {
  readonly configuration: SpotifyLoginConfiguration;
  readonly proofKeys: SpotifyProofKeyGenerator;
  readonly browser: SpotifyLoginBrowser;
  readonly requests: HttpExecutor;
  readonly clock: Clock;
  readonly resolveAccount: (accessToken: string, cancellation: AbortSignal) => Promise<string>;
  readonly credentialStore?: SpotifyLoginCredentialStore;
}

export interface SpotifyLoginCredentialStore {
  read(cancellation: AbortSignal): Promise<string | null>;
  write(serialized: string, cancellation: AbortSignal): Promise<void>;
  clear(): Promise<void>;
}

export interface SpotifyAccountCredentialStorage {
  read(accountIdentifier: string, cancellation: AbortSignal): Promise<string | null>;
  write(accountIdentifier: string, serialized: string, cancellation: AbortSignal): Promise<void>;
  clear(accountIdentifier: string): Promise<void>;
}
