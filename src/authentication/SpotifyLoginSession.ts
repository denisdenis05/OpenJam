import type { SpotifyLoginConfiguration, SpotifyLoginDependencies, SpotifyLoginProvider, SpotifyProofKey } from '../../contracts/authentication';
import { HttpMethod, IntegrationFailureCode } from '../../contracts/network';
import type { SpotifyCredentials } from '../../contracts/network';
import { checkCancellation, IntegrationFailure } from '../network/IntegrationFailure';
import { withCancellation } from '../network/Cancellation';
import { SpotifyLoginPolicy as Policy } from './SpotifyLoginPolicy';

interface TokenResponse {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAtMilliseconds: number;
}

export class SpotifyLoginSession implements SpotifyLoginProvider {
  private credentials: SpotifyCredentials | null = null;
  private refreshToken: string | null = null;
  private lifetime = new AbortController();
  private pendingRenewal: Promise<SpotifyCredentials> | null = null;
  private loggingIn = false;
  private readonly configuration: SpotifyLoginConfiguration;

  constructor(private readonly dependencies: SpotifyLoginDependencies) {
    const configuration = Object.freeze({ clientIdentifier: dependencies.configuration.clientIdentifier,
      redirectAddress: dependencies.configuration.redirectAddress, scopes: Object.freeze([...dependencies.configuration.scopes]) });
    this.configuration = configuration;
    let redirect: URL;
    try { redirect = new URL(configuration.redirectAddress); } catch { throw new IntegrationFailure(IntegrationFailureCode.InvalidInput); }
    if (!Policy.clientPattern.test(configuration.clientIdentifier) || redirect.username || redirect.password || redirect.hash
      || redirect.search || Policy.forbiddenProtocols.includes(redirect.protocol)
      || redirect.protocol === Policy.insecureProtocol && redirect.hostname !== Policy.loopbackIpv4 && redirect.hostname !== Policy.loopbackIpv6
      || configuration.scopes.some(scope => !scope.trim() || scope.includes(Policy.scopeSeparator))) {
      throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
    }
  }

  async login(cancellation: AbortSignal): Promise<SpotifyCredentials> {
    checkCancellation(cancellation);
    if (this.loggingIn || this.pendingRenewal !== null) throw new IntegrationFailure(IntegrationFailureCode.Backpressure);
    this.logout();
    this.loggingIn = true;
    const lifetime = this.lifetime;
    const abort = () => lifetime.abort();
    cancellation.addEventListener(Policy.abortEvent, abort, { once: true });
    try {
      const proof = await withCancellation(this.dependencies.proofKeys.generate(), lifetime.signal);
      this.assertCurrent(lifetime);
      this.validateProof(proof);
      const configuration = this.configuration;
      const address = new URL(Policy.authorizationAddress);
      const parameters = { client_id: configuration.clientIdentifier, response_type: Policy.responseType,
        redirect_uri: configuration.redirectAddress, scope: configuration.scopes.join(Policy.scopeSeparator),
        state: proof.state, code_challenge_method: Policy.challengeMethod, code_challenge: proof.challenge };
      for (const [name, value] of Object.entries(parameters)) address.searchParams.set(name, value);
      const callback = await withCancellation(this.dependencies.browser.authorize(address.toString(), configuration.redirectAddress, lifetime.signal), lifetime.signal);
      this.assertCurrent(lifetime);
      const code = this.readCode(callback, proof.state);
      const tokens = await this.exchange({ grant_type: Policy.authorizationGrant, code, redirect_uri: configuration.redirectAddress,
        client_id: configuration.clientIdentifier, code_verifier: proof.verifier }, null, lifetime.signal);
      const accountIdentifier = await withCancellation(this.dependencies.resolveAccount(tokens.accessToken, lifetime.signal), lifetime.signal);
      this.assertCurrent(lifetime);
      if (!accountIdentifier.trim()) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
      return this.accept(tokens, accountIdentifier);
    } catch (failure) {
      if (this.lifetime === lifetime) { this.credentials = null; this.refreshToken = null; }
      if (lifetime.signal.aborted) throw new IntegrationFailure(IntegrationFailureCode.Canceled);
      throw failure instanceof IntegrationFailure ? failure : new IntegrationFailure(IntegrationFailureCode.Network);
    } finally {
      cancellation.removeEventListener(Policy.abortEvent, abort);
      if (this.lifetime === lifetime) this.loggingIn = false;
    }
  }

  async getCredentials(cancellation: AbortSignal): Promise<SpotifyCredentials> {
    checkCancellation(cancellation);
    if (this.credentials === null) throw new IntegrationFailure(IntegrationFailureCode.Unauthorized);
    if (this.credentials.expiresAtMilliseconds - Policy.expirationMarginMilliseconds <= this.dependencies.clock.nowMilliseconds()) {
      return this.renewCredentials(cancellation);
    }
    return this.credentials;
  }

  async renewCredentials(cancellation: AbortSignal): Promise<SpotifyCredentials> {
    checkCancellation(cancellation);
    if (this.credentials === null || this.refreshToken === null) throw new IntegrationFailure(IntegrationFailureCode.Unauthorized);
    const lifetime = this.lifetime;
    if (this.pendingRenewal === null) {
      const accountIdentifier = this.credentials.accountIdentifier;
      const renewal = this.exchange({ grant_type: Policy.refreshGrant, refresh_token: this.refreshToken,
        client_id: this.configuration.clientIdentifier }, this.refreshToken, lifetime.signal)
        .then(tokens => { this.assertCurrent(lifetime); return this.accept(tokens, accountIdentifier); })
        .catch(failure => {
          if (this.lifetime === lifetime && failure instanceof IntegrationFailure && failure.code === IntegrationFailureCode.Unauthorized) this.logout();
          throw failure;
        });
      this.pendingRenewal = renewal;
      void renewal.finally(() => { if (this.pendingRenewal === renewal) this.pendingRenewal = null; }).catch(() => {});
    }
    const credentials = await withCancellation(this.pendingRenewal, cancellation);
    checkCancellation(cancellation);
    this.assertCurrent(lifetime);
    return credentials;
  }

  logout(): void {
    this.lifetime.abort();
    this.lifetime = new AbortController();
    this.credentials = null;
    this.refreshToken = null;
    this.pendingRenewal = null;
    this.loggingIn = false;
  }

  private validateProof(proof: SpotifyProofKey): void {
    for (const value of [proof.verifier, proof.state]) {
      if (value.length < Policy.minimumProofCharacters || value.length > Policy.maximumProofCharacters || !Policy.proofPattern.test(value)) {
        throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
      }
    }
    if (!Policy.challengePattern.test(proof.challenge)) throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
  }

  private readCode(address: string, state: string): string {
    let callback: URL;
    try { callback = new URL(address); } catch { throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse); }
    const expected = new URL(this.configuration.redirectAddress);
    if (callback.protocol !== expected.protocol || callback.host !== expected.host || callback.pathname !== expected.pathname
      || callback.username || callback.password || callback.hash
      || callback.searchParams.getAll(Policy.stateParameter).length !== SingleParameterCount
      || callback.searchParams.get(Policy.stateParameter) !== state) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
    if (callback.searchParams.has(Policy.errorParameter)) throw new IntegrationFailure(IntegrationFailureCode.Unauthorized);
    const code = callback.searchParams.get(Policy.codeParameter);
    if (!code || callback.searchParams.getAll(Policy.codeParameter).length !== SingleParameterCount) {
      throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
    }
    return code;
  }

  private async exchange(parameters: Readonly<Record<string, string>>, previousRefreshToken: string | null, cancellation: AbortSignal): Promise<TokenResponse> {
    checkCancellation(cancellation);
    const body = new URLSearchParams();
    for (const [name, value] of Object.entries(parameters)) body.set(name, value);
    const response = await withCancellation(this.dependencies.requests.execute({ address: Policy.tokenAddress, method: HttpMethod.Create,
      headers: { [Policy.contentTypeHeader]: Policy.formMediaType }, body: body.toString(), cancellation }), cancellation);
    checkCancellation(cancellation);
    if (response.status === Policy.badRequestStatus || response.status === Policy.unauthorizedStatus) throw new IntegrationFailure(IntegrationFailureCode.Unauthorized);
    if (response.status === Policy.rateLimitedStatus) throw new IntegrationFailure(IntegrationFailureCode.RateLimited, response.retryAfterSeconds);
    if (response.status !== Policy.successStatus) throw new IntegrationFailure(IntegrationFailureCode.Network);
    if (typeof response.body !== ObjectType || response.body === null) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
    const result = response.body as Record<string, unknown>;
    const refreshToken = result.refresh_token ?? previousRefreshToken;
    if (!this.validToken(result.access_token) || !this.validToken(refreshToken)
      || typeof result.token_type !== StringType || (result.token_type as string).toLowerCase() !== Policy.bearerType
      || typeof result.expires_in !== NumberType || !Number.isFinite(result.expires_in) || (result.expires_in as number) <= Policy.minimumLifetimeSeconds) {
      throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
    }
    const expiresAtMilliseconds = this.dependencies.clock.nowMilliseconds() + (result.expires_in as number) * Policy.millisecondsPerSecond;
    if (!Number.isSafeInteger(expiresAtMilliseconds)) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
    return { accessToken: result.access_token, refreshToken, expiresAtMilliseconds };
  }

  private validToken(value: unknown): value is string {
    return typeof value === StringType && (value as string).length >= MinimumTokenCharacters
      && (value as string).length <= Policy.maximumTokenCharacters && !TokenWhitespacePattern.test(value as string);
  }

  private accept(tokens: TokenResponse, accountIdentifier: string): SpotifyCredentials {
    this.refreshToken = tokens.refreshToken;
    this.credentials = Object.freeze({ accountIdentifier, accessToken: tokens.accessToken, expiresAtMilliseconds: tokens.expiresAtMilliseconds });
    return this.credentials;
  }

  private assertCurrent(lifetime: AbortController): void {
    checkCancellation(lifetime.signal);
    if (lifetime !== this.lifetime) throw new IntegrationFailure(IntegrationFailureCode.Superseded);
  }
}

const SingleParameterCount = 1;
const ObjectType = 'object';
const StringType = 'string';
const NumberType = 'number';
const MinimumTokenCharacters = 1;
const TokenWhitespacePattern = /\s/;
