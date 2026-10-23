import type { Clock, HttpExecutor, SpotifyCredentialProvider, SpotifyCredentials } from './network';

export interface SpotifyLoginProvider extends SpotifyCredentialProvider {
  login(cancellation: AbortSignal): Promise<SpotifyCredentials>;
  logout(): void;
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
}
