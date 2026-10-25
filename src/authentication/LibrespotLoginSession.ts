import { SpotifyLoginMethod, SpotifyLoginStage } from '../../contracts/authentication';
import type { LibrespotLoginDependencies, LibrespotLoginInput, LibrespotSessionGrant, SpotifyLoginProvider } from '../../contracts/authentication';
import { IntegrationFailureCode } from '../../contracts/network';
import type { SpotifyCredentials } from '../../contracts/network';
import { withCancellation } from '../network/Cancellation';
import { checkCancellation, IntegrationFailure } from '../network/IntegrationFailure';
import { LibrespotLoginPolicy as Policy } from './LibrespotLoginPolicy';
import { decodeLibrespotLogin, encodeLibrespotLogin, isLibrespotAccountIdentifier, isLibrespotStoredCredential } from './LibrespotSavedLogin';

export class LibrespotLoginSession implements SpotifyLoginProvider {
  readonly authenticationMethod = SpotifyLoginMethod.Librespot;
  private input: LibrespotLoginInput | null;
  private credentials: SpotifyCredentials | null = null;
  private storedCredential: string | null = null;
  private pendingRenewal: Promise<SpotifyCredentials> | null = null;
  private lifetime = new AbortController();
  private authenticating = false;
  private disposed = false;
  private authorizationAvailable: boolean;

  constructor(private readonly dependencies: LibrespotLoginDependencies, input?: LibrespotLoginInput) {
    this.input = input === undefined ? null : this.validatedInput(input);
    this.authorizationAvailable = dependencies.authorize !== undefined;
  }

  async login(cancellation: AbortSignal): Promise<SpotifyCredentials> {
    this.requireAvailable(cancellation);
    const input = this.input;
    this.input = null;
    const authorize = this.authorizationAvailable ? this.dependencies.authorize : undefined;
    this.authorizationAvailable = false;
    if (input === null && authorize === undefined) throw new IntegrationFailure(IntegrationFailureCode.Unauthorized);
    return this.authenticate(async lifetime => {
      this.progress(SpotifyLoginStage.Authorizing, lifetime);
      const grant = await withCancellation(authorize === undefined ? this.dependencies.authentication.login(input!, lifetime.signal) : authorize(lifetime.signal), lifetime.signal);
      this.assertCurrent(lifetime);
      return this.accept(grant, null, lifetime);
    }, cancellation, false);
  }

  async restore(cancellation: AbortSignal): Promise<SpotifyCredentials> {
    this.requireAvailable(cancellation);
    this.input = null;
    return this.authenticate(async lifetime => {
      let serialized: string | null;
      try { serialized = await withCancellation(this.dependencies.credentialStore.read(lifetime.signal), lifetime.signal); }
      catch (failure) { throw this.failure(failure, IntegrationFailureCode.CredentialStorage); }
      this.assertCurrent(lifetime);
      if (serialized === null) {
        if (!this.dependencies.resumeAuthorization) throw new IntegrationFailure(IntegrationFailureCode.Unauthorized);
        this.progress(SpotifyLoginStage.Authorizing, lifetime);
        const grant = await withCancellation(this.dependencies.resumeAuthorization(lifetime.signal), lifetime.signal);
        this.assertCurrent(lifetime);
        return this.accept(grant, null, lifetime);
      }
      const saved = decodeLibrespotLogin(serialized);
      this.progress(SpotifyLoginStage.Authorizing, lifetime);
      const grant = await withCancellation(this.dependencies.authentication.restore(saved.storedCredential, lifetime.signal), lifetime.signal);
      this.assertCurrent(lifetime);
      return this.accept(grant, saved.accountIdentifier, lifetime);
    }, cancellation, true);
  }

  async getCredentials(cancellation: AbortSignal): Promise<SpotifyCredentials> {
    checkCancellation(cancellation);
    if (this.disposed || this.credentials === null) throw new IntegrationFailure(IntegrationFailureCode.Unauthorized);
    if (this.credentials.expiresAtMilliseconds - Policy.expirationMarginMilliseconds <= this.dependencies.clock.nowMilliseconds()) {
      return this.renewCredentials(cancellation);
    }
    return this.credentials;
  }

  async renewCredentials(cancellation: AbortSignal): Promise<SpotifyCredentials> {
    checkCancellation(cancellation);
    if (this.disposed || this.credentials === null || this.storedCredential === null) throw new IntegrationFailure(IntegrationFailureCode.Unauthorized);
    if (this.authenticating) throw new IntegrationFailure(IntegrationFailureCode.Backpressure);
    const lifetime = this.lifetime;
    if (this.pendingRenewal === null) {
      const accountIdentifier = this.credentials.accountIdentifier;
      const storedCredential = this.storedCredential;
      const renewal = Promise.resolve().then(async () => {
        this.assertCurrent(lifetime);
        const grant = await withCancellation(this.dependencies.authentication.restore(storedCredential, lifetime.signal), lifetime.signal);
        this.assertCurrent(lifetime);
        return this.accept(grant, accountIdentifier, lifetime);
      }).catch(async failure => {
        if (lifetime === this.lifetime && this.permanentFailure(failure)) {
          this.retireMemory();
          await this.clearSavedLogin();
        }
        throw this.failure(failure, IntegrationFailureCode.Network);
      });
      this.pendingRenewal = renewal;
      void renewal.finally(() => { if (this.pendingRenewal === renewal) this.pendingRenewal = null; }).catch(() => undefined);
    }
    const credentials = await withCancellation(this.pendingRenewal, cancellation);
    checkCancellation(cancellation);
    this.assertCurrent(lifetime);
    return credentials;
  }

  async logout(): Promise<void> {
    this.input = null;
    this.authorizationAvailable = false;
    this.retireMemory();
    await this.clearSavedLogin();
  }

  dispose(): void {
    this.input = null;
    this.authorizationAvailable = false;
    this.disposed = true;
    this.retireMemory();
  }

  private async authenticate(operation: (lifetime: AbortController) => Promise<SpotifyCredentials>,
    cancellation: AbortSignal, eraseRejected: boolean): Promise<SpotifyCredentials> {
    this.retireMemory();
    this.authenticating = true;
    const lifetime = this.lifetime;
    const abort = () => lifetime.abort();
    cancellation.addEventListener(Policy.abortEvent, abort, { once: true });
    try {
      this.progress(SpotifyLoginStage.Preparing, lifetime);
      const credentials = await operation(lifetime);
      this.assertCurrent(lifetime);
      this.progress(SpotifyLoginStage.Complete, lifetime);
      return credentials;
    } catch (failure) {
      if (lifetime === this.lifetime) {
        this.credentials = null; this.storedCredential = null;
        if (eraseRejected && this.permanentFailure(failure)) await this.clearSavedLogin();
      }
      if (lifetime.signal.aborted) throw new IntegrationFailure(IntegrationFailureCode.Canceled);
      throw this.failure(failure, IntegrationFailureCode.Network);
    } finally {
      cancellation.removeEventListener(Policy.abortEvent, abort);
      if (lifetime === this.lifetime) this.authenticating = false;
    }
  }

  private async accept(grant: LibrespotSessionGrant, accountIdentifier: string | null, lifetime: AbortController): Promise<SpotifyCredentials> {
    this.progress(SpotifyLoginStage.Verifying, lifetime);
    const valid = this.validatedGrant(grant);
    if (accountIdentifier !== null && valid.accountIdentifier !== accountIdentifier) throw new IntegrationFailure(IntegrationFailureCode.Unauthorized);
    this.progress(SpotifyLoginStage.Saving, lifetime);
    const serialized = encodeLibrespotLogin(valid.accountIdentifier, valid.storedCredential);
    try { await withCancellation(this.dependencies.credentialStore.write(serialized, lifetime.signal), lifetime.signal); }
    catch (failure) { throw this.failure(failure, IntegrationFailureCode.CredentialStorage); }
    this.assertCurrent(lifetime);
    this.storedCredential = valid.storedCredential;
    this.credentials = Object.freeze({ accountIdentifier: valid.accountIdentifier, accessToken: valid.accessToken,
      expiresAtMilliseconds: valid.expiresAtMilliseconds });
    return this.credentials;
  }

  private validatedInput(input: LibrespotLoginInput): LibrespotLoginInput {
    try {
      if (typeof input !== Policy.objectType || input === null || typeof input.username !== Policy.stringType
        || typeof input.password !== Policy.stringType || !input.username.trim() || !input.password
        || input.username.length > Policy.maximumUsernameCharacters || input.password.length > Policy.maximumPasswordCharacters) {
        throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
      }
      return Object.freeze({ username: input.username.trim(), password: input.password });
    } catch { throw new IntegrationFailure(IntegrationFailureCode.InvalidInput); }
  }

  private validatedGrant(grant: LibrespotSessionGrant): LibrespotSessionGrant {
    try {
      const nowMilliseconds = this.dependencies.clock.nowMilliseconds();
      if (typeof grant !== Policy.objectType || grant === null || !isLibrespotAccountIdentifier(grant.accountIdentifier)
        || typeof grant.accessToken !== Policy.stringType || !grant.accessToken.trim()
        || grant.accessToken.length > Policy.maximumTokenCharacters || Policy.whitespacePattern.test(grant.accessToken)
        || !isLibrespotStoredCredential(grant.storedCredential) || !Number.isSafeInteger(nowMilliseconds)
        || nowMilliseconds < Policy.minimumTimestampMilliseconds || !Number.isSafeInteger(grant.expiresAtMilliseconds)
        || grant.expiresAtMilliseconds <= nowMilliseconds
        || grant.expiresAtMilliseconds - nowMilliseconds > Policy.maximumLifetimeMilliseconds) {
        throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
      }
      return Object.freeze({ accountIdentifier: grant.accountIdentifier, accessToken: grant.accessToken,
        expiresAtMilliseconds: grant.expiresAtMilliseconds, storedCredential: grant.storedCredential });
    } catch { throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse); }
  }

  private requireAvailable(cancellation: AbortSignal): void {
    checkCancellation(cancellation);
    if (this.disposed) throw new IntegrationFailure(IntegrationFailureCode.Unauthorized);
    if (this.authenticating || this.pendingRenewal !== null) throw new IntegrationFailure(IntegrationFailureCode.Backpressure);
  }

  private progress(stage: SpotifyLoginStage, lifetime: AbortController): void {
    this.assertCurrent(lifetime);
    try { void Promise.resolve(this.dependencies.onProgress?.(stage)).catch(() => undefined); } catch {}
    this.assertCurrent(lifetime);
  }

  private async clearSavedLogin(): Promise<void> {
    try { await this.dependencies.credentialStore.clear(); }
    catch (failure) { throw this.failure(failure, IntegrationFailureCode.CredentialStorage); }
  }

  private retireMemory(): void {
    this.lifetime.abort(); this.lifetime = new AbortController();
    this.credentials = null; this.storedCredential = null; this.pendingRenewal = null; this.authenticating = false;
  }

  private permanentFailure(failure: unknown): boolean {
    return failure instanceof IntegrationFailure && (failure.code === IntegrationFailureCode.Unauthorized
      || failure.code === IntegrationFailureCode.NativeSessionRejected || failure.code === IntegrationFailureCode.NativeTokenRejected
      || failure.code === IntegrationFailureCode.InvalidResponse || failure.code === IntegrationFailureCode.InvalidInput);
  }

  private failure(failure: unknown, fallback: IntegrationFailureCode): IntegrationFailure {
    return new IntegrationFailure(failure instanceof IntegrationFailure ? failure.code : fallback);
  }

  private assertCurrent(lifetime: AbortController): void {
    checkCancellation(lifetime.signal);
    if (this.disposed || lifetime !== this.lifetime) throw new IntegrationFailure(IntegrationFailureCode.Superseded);
  }
}
