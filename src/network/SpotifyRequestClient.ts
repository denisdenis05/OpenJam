import { HttpMethod, IntegrationFailureCode } from '../../contracts/network';
import type { HttpExecutor, HttpResponse } from '../../contracts/network';
import { HttpPolicy } from './HttpPolicy';
import { checkCancellation, failureCode, IntegrationFailure } from './IntegrationFailure';
import { SpotifyCredentialSession } from './SpotifyCredentialSession';

export interface JsonReader {
  read(address: string, cancellation: AbortSignal): Promise<unknown>;
}

export function ensureSuccess(response: HttpResponse): unknown {
  if (response.status >= HttpPolicy.successMinimumStatus && response.status <= HttpPolicy.successMaximumStatus) return response.body;
  const code = response.status === HttpPolicy.unauthorizedStatus ? IntegrationFailureCode.Unauthorized
    : response.status === HttpPolicy.invalidRequestStatus ? IntegrationFailureCode.InvalidInput
    : response.status === HttpPolicy.forbiddenStatus ? IntegrationFailureCode.Forbidden
    : response.status === HttpPolicy.notFoundStatus ? IntegrationFailureCode.NotFound
    : response.status === HttpPolicy.rateLimitedStatus ? IntegrationFailureCode.RateLimited : IntegrationFailureCode.Network;
  throw new IntegrationFailure(code, response.retryAfterSeconds);
}

export class SpotifyRequestClient implements JsonReader {
  constructor(private readonly executor: HttpExecutor, private readonly credentials: SpotifyCredentialSession) {}

  read(address: string, cancellation: AbortSignal): Promise<unknown> {
    return this.send(address, HttpMethod.Read, false, cancellation);
  }

  async send(address: string, method: HttpMethod, mutation: boolean, cancellation: AbortSignal): Promise<unknown> {
    checkCancellation(cancellation);
    this.validateAddress(address);
    const credentials = await this.credentials.current(cancellation);
    const execute = (accessToken: string) => this.executor.execute({ address, method, cancellation,
      headers: { [HttpPolicy.authorizationHeader]: HttpPolicy.bearerPrefix + accessToken,
        [HttpPolicy.acceptHeader]: HttpPolicy.jsonMediaType } });
    try {
      let response = await execute(credentials.accessToken);
      checkCancellation(cancellation);
      this.credentials.assertCurrentAccount();
      if (response.status === HttpPolicy.unauthorizedStatus && !mutation) {
        const renewed = await this.credentials.renew(credentials, cancellation);
        response = await execute(renewed.accessToken);
        checkCancellation(cancellation);
        this.credentials.assertCurrentAccount();
      }
      if (mutation && response.status >= HttpPolicy.serverErrorMinimumStatus) {
        throw new IntegrationFailure(IntegrationFailureCode.UnknownOutcome);
      }
      return ensureSuccess(response);
    } catch (failure) {
      const code = failureCode(failure);
      if (mutation && (code === IntegrationFailureCode.Network || code === IntegrationFailureCode.Deadline
          || code === IntegrationFailureCode.Canceled || code === IntegrationFailureCode.InvalidResponse)) {
        throw new IntegrationFailure(IntegrationFailureCode.UnknownOutcome);
      }
      if (failure instanceof IntegrationFailure) throw failure;
      throw new IntegrationFailure(IntegrationFailureCode.Network);
    }
  }

  private validateAddress(address: string): void {
    let parsed: URL;
    try { parsed = new URL(address); } catch { throw new IntegrationFailure(IntegrationFailureCode.InvalidInput); }
    if (parsed.protocol !== HttpPolicy.secureProtocol || parsed.username || parsed.password
        || (parsed.hostname !== HttpPolicy.spotifyHost && !parsed.hostname.endsWith(HttpPolicy.spotifyHostSuffix))) {
      throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
    }
  }
}
