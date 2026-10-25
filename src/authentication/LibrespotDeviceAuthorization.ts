import type { LibrespotDeviceAuthorizationDependencies, LibrespotDeviceAuthorizationView, LibrespotSessionGrant,
  SpotifyLoginCredentialStore } from '../../contracts/authentication';
import { SpotifyLoginStage } from '../../contracts/authentication';
import { HttpMethod, IntegrationFailureCode } from '../../contracts/network';
import type { Clock, HttpResponse } from '../../contracts/network';
import { withCancellation } from '../network/Cancellation';
import { checkCancellation, IntegrationFailure } from '../network/IntegrationFailure';
import { LibrespotDeviceAuthorizationPolicy as Policy } from './LibrespotDeviceAuthorizationPolicy';

interface PendingDeviceAuthorization extends LibrespotDeviceAuthorizationView {
  readonly schemaVersion: number;
  readonly clientIdentifier: string;
  readonly deviceCode: string;
  readonly createdAtMilliseconds: number;
  readonly pollingIntervalMilliseconds: number;
}

function requireObject(value: unknown): Record<string, unknown> {
  if (typeof value !== Policy.objectType || value === null || Array.isArray(value)) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
  return value as Record<string, unknown>;
}
function isBoundedSecret(value: unknown, maximumCharacters: number): value is string {
  return typeof value === Policy.stringType && Boolean(value) && (value as string).length <= maximumCharacters
    && !Policy.whitespacePattern.test(value as string);
}
function positiveInteger(value: unknown, maximum: number): value is number {
  return Number.isSafeInteger(value) && (value as number) > Policy.minimumTimestampMilliseconds && (value as number) <= maximum;
}
function requireNowMilliseconds(clock: Clock): number {
  const nowMilliseconds = clock.nowMilliseconds();
  if (!Number.isSafeInteger(nowMilliseconds) || nowMilliseconds < Policy.minimumTimestampMilliseconds) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
  return nowMilliseconds;
}
function verificationAddress(value: unknown, userCode: string, complete: boolean): string {
  if (typeof value !== Policy.stringType) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
  let address: URL;
  try { address = new URL(value as string); } catch { throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse); }
  if (address.protocol !== Policy.secureProtocol || !Policy.verificationHosts.includes(address.hostname)
    || address.pathname !== Policy.verificationPath || address.port || address.username || address.password || address.hash
    || (complete ? address.searchParams.getAll(Policy.codeParameter).length !== Policy.singleParameterCount
      || address.searchParams.get(Policy.codeParameter) !== userCode || [...address.searchParams.keys()].some(key => key !== Policy.codeParameter)
      : Boolean(address.search))) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
  address.searchParams.set(Policy.codeParameter, userCode);
  return address.toString();
}
function requireFreshAuthorization(authorization: PendingDeviceAuthorization, clock: Clock): void {
  const nowMilliseconds = requireNowMilliseconds(clock);
  if (nowMilliseconds < authorization.createdAtMilliseconds || nowMilliseconds >= authorization.expiresAtMilliseconds) throw new IntegrationFailure(IntegrationFailureCode.Unauthorized);
}
function decode(serialized: string, clock: Clock): PendingDeviceAuthorization {
  let decoded: Record<string, unknown>;
  try {
    if (serialized.length > Policy.maximumRecordCharacters) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
    decoded = requireObject(JSON.parse(serialized));
  } catch { throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse); }
  const userCode = decoded.userCode;
  if (decoded.schemaVersion !== Policy.schemaVersion || decoded.clientIdentifier !== Policy.clientIdentifier
    || !isBoundedSecret(decoded.deviceCode, Policy.maximumDeviceCodeCharacters) || typeof userCode !== Policy.stringType
    || !Policy.userCodePattern.test(userCode as string) || !Number.isSafeInteger(decoded.createdAtMilliseconds)
    || (decoded.createdAtMilliseconds as number) < Policy.minimumTimestampMilliseconds
    || !Number.isSafeInteger(decoded.expiresAtMilliseconds)
    || !positiveInteger((decoded.expiresAtMilliseconds as number) - (decoded.createdAtMilliseconds as number), Policy.maximumLifetimeMilliseconds)
    || !positiveInteger(decoded.pollingIntervalMilliseconds, Policy.maximumIntervalMilliseconds)) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
  const authorization = Object.freeze({ schemaVersion: Policy.schemaVersion, clientIdentifier: Policy.clientIdentifier,
    deviceCode: decoded.deviceCode, userCode: userCode as string,
    verificationAddress: verificationAddress(decoded.verificationAddress, userCode as string, true),
    createdAtMilliseconds: decoded.createdAtMilliseconds as number, expiresAtMilliseconds: decoded.expiresAtMilliseconds as number,
    pollingIntervalMilliseconds: decoded.pollingIntervalMilliseconds as number });
  requireFreshAuthorization(authorization, clock);
  return authorization;
}
function sanitized(failure: unknown, fallback: IntegrationFailureCode): IntegrationFailure {
  return failure instanceof IntegrationFailure ? new IntegrationFailure(failure.code, failure.retryAfterSeconds) : new IntegrationFailure(fallback);
}
export async function hasPendingLibrespotDeviceAuthorization(store: SpotifyLoginCredentialStore, clock: Clock,
  cancellation: AbortSignal): Promise<boolean> {
  checkCancellation(cancellation);
  let serialized: string | null;
  try { serialized = await withCancellation(store.read(cancellation), cancellation); }
  catch (failure) { throw sanitized(failure, IntegrationFailureCode.CredentialStorage); }
  checkCancellation(cancellation);
  if (serialized === null) return false;
  decode(serialized, clock);
  return true;
}

export class LibrespotDeviceAuthorization {
  private busy = false;

  constructor(private readonly dependencies: LibrespotDeviceAuthorizationDependencies) {}

  authorize(cancellation: AbortSignal): Promise<LibrespotSessionGrant> { return this.authenticate(cancellation, true); }
  resume(cancellation: AbortSignal): Promise<LibrespotSessionGrant> { return this.authenticate(cancellation, false); }

  private async authenticate(cancellation: AbortSignal, allowStart: boolean): Promise<LibrespotSessionGrant> {
    checkCancellation(cancellation);
    if (this.busy) throw new IntegrationFailure(IntegrationFailureCode.Backpressure);
    this.busy = true;
    let pending = true;
    try {
      let authorization = await this.read(cancellation, allowStart);
      if (authorization === null) {
        if (!allowStart) throw new IntegrationFailure(IntegrationFailureCode.Unauthorized);
        authorization = await this.start(cancellation);
        await this.save(authorization, cancellation);
      }
      this.notify(authorization);
      checkCancellation(cancellation);
      if (allowStart) {
        await withCancellation(this.dependencies.openVerificationPage(authorization.verificationAddress, cancellation), cancellation);
        checkCancellation(cancellation);
      }
      while (true) {
        requireFreshAuthorization(authorization, this.dependencies.clock);
        const remainingMilliseconds = authorization.expiresAtMilliseconds - requireNowMilliseconds(this.dependencies.clock);
        await this.wait(Math.min(authorization.pollingIntervalMilliseconds, remainingMilliseconds), cancellation);
        requireFreshAuthorization(authorization, this.dependencies.clock);
        const response = await this.request(Policy.tokenAddress, { client_id: Policy.clientIdentifier, grant_type: Policy.grantType,
          device_code: authorization.deviceCode }, cancellation);
        const body = requireObject(response.body);
        if (response.status === Policy.successStatus) {
          if (!isBoundedSecret(body.access_token, Policy.maximumTokenCharacters) || typeof body.token_type !== Policy.stringType
            || (body.token_type as string).toLowerCase() !== Policy.bearerType
            || !positiveInteger(body.expires_in, Policy.maximumLifetimeMilliseconds / Policy.millisecondsPerSecond)) {
            throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
          }
          await this.clear(); pending = false;
          checkCancellation(cancellation);
          try { void Promise.resolve(this.dependencies.onProgress?.(SpotifyLoginStage.Exchanging)).catch(() => undefined); } catch {}
          checkCancellation(cancellation);
          return await withCancellation(this.dependencies.bootstrap(body.access_token, cancellation), cancellation);
        }
        if (response.status === Policy.invalidRequestStatus && body.error === Policy.pendingError) continue;
        if (response.status === Policy.invalidRequestStatus && body.error === Policy.slowdownError) {
          const pollingIntervalMilliseconds: number = authorization.pollingIntervalMilliseconds + Policy.slowdownMilliseconds;
          if (pollingIntervalMilliseconds > Policy.maximumIntervalMilliseconds) throw new IntegrationFailure(IntegrationFailureCode.RateLimited);
          authorization = Object.freeze({ ...authorization, pollingIntervalMilliseconds });
          await this.save(authorization, cancellation);
          continue;
        }
        if (body.error === Policy.deniedError) { await this.clear(); pending = false; }
        throw this.responseFailure(response, body);
      }
    } catch (failure) {
      const classified = sanitized(failure, IntegrationFailureCode.Network);
      if (pending && !cancellation.aborted && (classified.code === IntegrationFailureCode.Unauthorized
        || classified.code === IntegrationFailureCode.Forbidden || classified.code === IntegrationFailureCode.Unsupported
        || classified.code === IntegrationFailureCode.InvalidResponse)) await this.clear();
      throw classified;
    } finally { this.busy = false; }
  }

  private async read(cancellation: AbortSignal, allowStart: boolean): Promise<PendingDeviceAuthorization | null> {
    let serialized: string | null;
    try { serialized = await withCancellation(this.dependencies.authorizationStore.read(cancellation), cancellation); }
    catch (failure) { throw sanitized(failure, IntegrationFailureCode.CredentialStorage); }
    checkCancellation(cancellation);
    if (serialized === null) return null;
    try { return decode(serialized, this.dependencies.clock); }
    catch (failure) {
      if (!allowStart) throw failure;
      await this.clear(); checkCancellation(cancellation); return null;
    }
  }

  private async start(cancellation: AbortSignal): Promise<PendingDeviceAuthorization> {
    const response = await this.request(Policy.deviceAddress, { client_id: Policy.clientIdentifier, scope: Policy.scope }, cancellation);
    const body = requireObject(response.body);
    if (response.status !== Policy.successStatus) throw this.responseFailure(response, body);
    const pollingIntervalMilliseconds = body.interval === undefined ? Policy.defaultIntervalMilliseconds
      : Number(body.interval) * Policy.millisecondsPerSecond;
    if (!isBoundedSecret(body.device_code, Policy.maximumDeviceCodeCharacters) || typeof body.user_code !== Policy.stringType
      || !Policy.userCodePattern.test(body.user_code as string)
      || !positiveInteger(body.expires_in, Policy.maximumLifetimeMilliseconds / Policy.millisecondsPerSecond)
      || body.interval !== undefined && !positiveInteger(body.interval, Policy.maximumIntervalMilliseconds / Policy.millisecondsPerSecond)
      || !positiveInteger(pollingIntervalMilliseconds, Policy.maximumIntervalMilliseconds)) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
    const userCode = body.user_code as string;
    const base = verificationAddress(body.verification_uri, userCode, false);
    const verification = body.verification_uri_complete === undefined ? base : verificationAddress(body.verification_uri_complete, userCode, true);
    const createdAtMilliseconds = requireNowMilliseconds(this.dependencies.clock);
    const expiresAtMilliseconds = createdAtMilliseconds + (body.expires_in as number) * Policy.millisecondsPerSecond;
    if (!Number.isSafeInteger(expiresAtMilliseconds)) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
    return Object.freeze({ schemaVersion: Policy.schemaVersion, clientIdentifier: Policy.clientIdentifier, deviceCode: body.device_code,
      userCode, verificationAddress: verification, createdAtMilliseconds, expiresAtMilliseconds,
      pollingIntervalMilliseconds });
  }

  private async request(address: string, parameters: Readonly<Record<string, string>>, cancellation: AbortSignal): Promise<HttpResponse> {
    checkCancellation(cancellation);
    const body = new URLSearchParams();
    for (const [name, value] of Object.entries(parameters)) body.set(name, value);
    try {
      const response = await withCancellation(this.dependencies.requests.execute({ address, method: HttpMethod.Create,
        headers: { [Policy.contentTypeHeader]: Policy.formMediaType, [Policy.acceptHeader]: Policy.jsonMediaType }, body: body.toString(), cancellation }), cancellation);
      checkCancellation(cancellation);
      if (response.status === Policy.rateLimitedStatus) throw new IntegrationFailure(IntegrationFailureCode.RateLimited, response.retryAfterSeconds);
      if (response.status >= Policy.serverFailureMinimumStatus) throw new IntegrationFailure(IntegrationFailureCode.Network);
      return response;
    } catch (failure) { throw sanitized(failure, IntegrationFailureCode.Network); }
  }

  private responseFailure(response: HttpResponse, body: Record<string, unknown>): IntegrationFailure {
    if (typeof body.error === Policy.stringType && Policy.unsupportedErrors.includes(body.error as string)) return new IntegrationFailure(IntegrationFailureCode.Unsupported);
    if (body.error === Policy.deniedError) return new IntegrationFailure(IntegrationFailureCode.Canceled);
    if (body.error === Policy.expiredError || body.error === Policy.rejectedGrantError
      || response.status === Policy.unauthorizedStatus || response.status === Policy.forbiddenStatus) return new IntegrationFailure(IntegrationFailureCode.Unauthorized);
    if (response.status === Policy.rateLimitedStatus) return new IntegrationFailure(IntegrationFailureCode.RateLimited, response.retryAfterSeconds);
    return new IntegrationFailure(response.status === Policy.invalidRequestStatus ? IntegrationFailureCode.InvalidResponse : IntegrationFailureCode.Network);
  }

  private async save(authorization: PendingDeviceAuthorization, cancellation: AbortSignal): Promise<void> {
    checkCancellation(cancellation);
    const serialized = JSON.stringify(authorization);
    if (serialized.length > Policy.maximumRecordCharacters) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
    try { await withCancellation(this.dependencies.authorizationStore.write(serialized, cancellation), cancellation); }
    catch (failure) { throw sanitized(failure, IntegrationFailureCode.CredentialStorage); }
    checkCancellation(cancellation);
  }

  private async clear(): Promise<void> {
    try { await this.dependencies.authorizationStore.clear(); }
    catch (failure) { throw sanitized(failure, IntegrationFailureCode.CredentialStorage); }
  }

  private notify(authorization: PendingDeviceAuthorization): void {
    const view = Object.freeze({ userCode: authorization.userCode, verificationAddress: authorization.verificationAddress,
      expiresAtMilliseconds: authorization.expiresAtMilliseconds });
    try { void Promise.resolve(this.dependencies.onAuthorization?.(view)).catch(() => undefined); } catch {}
  }

  private wait(delayMilliseconds: number, cancellation: AbortSignal): Promise<void> {
    checkCancellation(cancellation);
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const cleanup: { stop: (() => void) | null } = { stop: null };
      const finish = (failure?: IntegrationFailure) => {
        if (settled) return; settled = true;
        cancellation.removeEventListener(Policy.abortEvent, abort);
        try { cleanup.stop?.(); } catch {}
        if (failure) reject(failure); else resolve();
      };
      const abort = () => finish(new IntegrationFailure(IntegrationFailureCode.Canceled));
      cancellation.addEventListener(Policy.abortEvent, abort, { once: true });
      if (cancellation.aborted) { abort(); return; }
      try {
        const stop = this.dependencies.scheduler.schedule(delayMilliseconds, () => finish());
        if (settled) stop(); else cleanup.stop = stop;
      } catch { finish(new IntegrationFailure(IntegrationFailureCode.Network)); }
    });
  }
}
