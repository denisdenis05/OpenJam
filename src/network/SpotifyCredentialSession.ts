import { IntegrationFailureCode } from '../../contracts/network';
import type { Clock, SpotifyCredentials, SpotifyCredentialProvider } from '../../contracts/network';
import { HttpPolicy } from './HttpPolicy';
import { withCancellation } from './Cancellation';
import { checkCancellation, IntegrationFailure } from './IntegrationFailure';

export class SpotifyCredentialSession {
  private readonly lifetime = new AbortController();
  private credentials: SpotifyCredentials | null = null;
  private pending: Promise<SpotifyCredentials> | null = null;

  constructor(readonly accountIdentifier: string, private readonly provider: SpotifyCredentialProvider, private readonly clock: Clock) {
    if (!accountIdentifier.trim()) throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
  }

  async current(cancellation: AbortSignal): Promise<SpotifyCredentials> {
    checkCancellation(cancellation);
    this.checkLifetime();
    if (this.credentials && this.credentials.expiresAtMilliseconds - this.clock.nowMilliseconds() > HttpPolicy.expirationMarginMilliseconds) {
      return this.credentials;
    }
    return this.load(this.credentials !== null, cancellation);
  }

  async renew(rejected: SpotifyCredentials, cancellation: AbortSignal): Promise<SpotifyCredentials> {
    checkCancellation(cancellation);
    this.checkLifetime();
    if (this.credentials && this.credentials.accessToken !== rejected.accessToken) return this.current(cancellation);
    return this.load(true, cancellation);
  }

  dispose(): void {
    this.lifetime.abort();
    this.credentials = null;
    this.pending = null;
  }

  assertCurrentAccount(): void { this.checkLifetime(); }

  private async load(renew: boolean, cancellation: AbortSignal): Promise<SpotifyCredentials> {
    if (!this.pending) {
      const operation = Promise.resolve().then(() => {
        this.checkLifetime();
        return renew ? this.provider.renewCredentials(this.lifetime.signal) : this.provider.getCredentials(this.lifetime.signal);
      }).then(credentials => {
        this.checkLifetime();
        if (credentials.accountIdentifier !== this.accountIdentifier || !credentials.accessToken.trim()
            || !Number.isFinite(credentials.expiresAtMilliseconds) || credentials.expiresAtMilliseconds <= this.clock.nowMilliseconds()) {
          throw new IntegrationFailure(IntegrationFailureCode.Unauthorized);
        }
        this.credentials = Object.freeze({ ...credentials });
        return this.credentials;
      }).catch(failure => {
        if (failure instanceof IntegrationFailure) throw failure;
        throw new IntegrationFailure(IntegrationFailureCode.Unauthorized);
      });
      this.pending = operation;
      void operation.finally(() => { if (this.pending === operation) this.pending = null; }).catch(() => undefined);
    }
    const credentials = await withCancellation(this.pending, cancellation);
    checkCancellation(cancellation);
    this.checkLifetime();
    return credentials;
  }

  private checkLifetime(): void {
    if (this.lifetime.signal.aborted) throw new IntegrationFailure(IntegrationFailureCode.Superseded);
  }
}
