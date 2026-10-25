import type { Clock, HttpExecutor, SpotifyCredentialProvider, SpotifyCredentials } from './network';

export interface SpotifyLoginProvider extends SpotifyCredentialProvider {
  readonly authenticationMethod?: SpotifyLoginMethod;
  login(cancellation: AbortSignal): Promise<SpotifyCredentials>;
  logout(): void | Promise<void>;
  restore?(cancellation: AbortSignal): Promise<SpotifyCredentials>;
  resumeAuthorization?(callbackAddress: string, cancellation: AbortSignal): Promise<SpotifyCredentials>;
  dispose?(): void;
}

export enum SpotifyLoginMethod { OAuth = 'oauth', Librespot = 'librespot' }

export interface LibrespotLoginInput {
  readonly username: string;
  readonly password: string;
}

export interface LibrespotSessionGrant extends SpotifyCredentials {
  readonly storedCredential: string;
}

export interface LibrespotAuthentication {
  login(input: LibrespotLoginInput, cancellation: AbortSignal): Promise<LibrespotSessionGrant>;
  restore(storedCredential: string, cancellation: AbortSignal): Promise<LibrespotSessionGrant>;
}

export interface LibrespotLoginDependencies {
  readonly authentication: LibrespotAuthentication;
  readonly credentialStore: SpotifyLoginCredentialStore;
  readonly clock: Clock;
  readonly onProgress?: (stage: SpotifyLoginStage) => void;
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

export interface SpotifyAuthorizationRedirectAddress {
  readonly protocol: string;
  readonly host: string;
  readonly pathname: string;
}

export enum SpotifyAuthorizationRedirectComparison {
  Matched = 'matched', SchemeMismatch = 'scheme-mismatch', HostMismatch = 'host-mismatch', PathMismatch = 'path-mismatch',
}

export interface SpotifyLoginDependencies {
  readonly configuration: SpotifyLoginConfiguration;
  readonly proofKeys: SpotifyProofKeyGenerator;
  readonly browser: SpotifyLoginBrowser;
  readonly requests: HttpExecutor;
  readonly clock: Clock;
  readonly resolveAccount: (accessToken: string, cancellation: AbortSignal) => Promise<string>;
  readonly credentialStore?: SpotifyLoginCredentialStore;
  readonly authorizationStore?: SpotifyLoginCredentialStore;
  readonly onProgress?: (stage: SpotifyLoginStage) => void;
}

export enum SpotifyLoginStage {
  Preparing = 'preparing',
  Authorizing = 'authorizing',
  Exchanging = 'exchanging',
  Verifying = 'verifying',
  Saving = 'saving',
  Complete = 'complete',
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
