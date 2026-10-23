export enum IntegrationFailureCode {
  InvalidInput = 'invalid-input',
  InvalidResponse = 'invalid-response',
  Canceled = 'canceled',
  Superseded = 'superseded',
  Unauthorized = 'unauthorized',
  Forbidden = 'forbidden',
  NotFound = 'not-found',
  RateLimited = 'rate-limited',
  Network = 'network',
  Deadline = 'deadline',
  Unsupported = 'unsupported',
  UnknownOutcome = 'unknown-outcome',
  Backpressure = 'backpressure',
}

export interface HttpRequest {
  readonly address: string;
  readonly method: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly cancellation: AbortSignal;
  readonly body?: string;
}

export interface HttpResponse {
  readonly status: number;
  readonly body: unknown;
  readonly retryAfterSeconds?: number;
}

export interface HttpExecutor {
  execute(request: HttpRequest): Promise<HttpResponse>;
}

export interface Clock {
  nowMilliseconds(): number;
}

export interface Scheduler {
  schedule(delayMilliseconds: number, callback: () => void): () => void;
}

export interface SpotifyCredentials {
  readonly accountIdentifier: string;
  readonly accessToken: string;
  readonly expiresAtMilliseconds: number;
}

export interface SpotifyCredentialProvider {
  getCredentials(cancellation: AbortSignal): Promise<SpotifyCredentials>;
  renewCredentials(cancellation: AbortSignal): Promise<SpotifyCredentials>;
}

export interface SpotifyEndpointResolver {
  resolveServiceOrigin(cancellation: AbortSignal): Promise<string>;
}

export enum HttpMethod {
  Read = 'GET',
  Create = 'POST',
  Replace = 'PUT',
  Delete = 'DELETE',
}
