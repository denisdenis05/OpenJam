import type { SpotifyLoginConfiguration, SpotifyLoginCredentialStore, SpotifyProofKey } from '../../contracts/authentication';
import { IntegrationFailureCode } from '../../contracts/network';
import { withCancellation } from '../network/Cancellation';
import { checkCancellation, IntegrationFailure } from '../network/IntegrationFailure';
import { validatedSpotifyLoginConfiguration } from './SpotifyLoginConfiguration';
import { SpotifyLoginPolicy } from './SpotifyLoginPolicy';

export const PendingAuthorizationPolicy = Object.freeze({ schemaVersion: 1, maximumCharacters: 65536,
  maximumAgeMilliseconds: 600000, minimumTimestampMilliseconds: 0, objectType: 'object', stringType: 'string' });

export interface PendingSpotifyAuthorization {
  readonly schemaVersion: number;
  readonly configuration: SpotifyLoginConfiguration;
  readonly proof: SpotifyProofKey;
  readonly createdAtMilliseconds: number;
}

export function validatedSpotifyProofKey(proof: SpotifyProofKey): SpotifyProofKey {
  if (typeof proof !== PendingAuthorizationPolicy.objectType || proof === null) throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
  for (const value of [proof.verifier, proof.state]) {
    if (typeof value !== PendingAuthorizationPolicy.stringType || value.length < SpotifyLoginPolicy.minimumProofCharacters
      || value.length > SpotifyLoginPolicy.maximumProofCharacters || !SpotifyLoginPolicy.proofPattern.test(value)) {
      throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
    }
  }
  if (typeof proof.challenge !== PendingAuthorizationPolicy.stringType || !SpotifyLoginPolicy.challengePattern.test(proof.challenge)) {
    throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
  }
  return Object.freeze({ verifier: proof.verifier, challenge: proof.challenge, state: proof.state });
}

export function decodePendingSpotifyAuthorization(serialized: string): PendingSpotifyAuthorization {
  try {
    if (serialized.length > PendingAuthorizationPolicy.maximumCharacters) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
    const decoded: unknown = JSON.parse(serialized);
    if (typeof decoded !== PendingAuthorizationPolicy.objectType || decoded === null || Array.isArray(decoded)) {
      throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
    }
    const record = decoded as Record<string, unknown>;
    if (record.schemaVersion !== PendingAuthorizationPolicy.schemaVersion || !Number.isSafeInteger(record.createdAtMilliseconds)
      || (record.createdAtMilliseconds as number) < PendingAuthorizationPolicy.minimumTimestampMilliseconds
      || typeof record.configuration !== PendingAuthorizationPolicy.objectType || record.configuration === null) {
      throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
    }
    return Object.freeze({ schemaVersion: PendingAuthorizationPolicy.schemaVersion,
      createdAtMilliseconds: record.createdAtMilliseconds as number,
      configuration: validatedSpotifyLoginConfiguration(record.configuration as unknown as SpotifyLoginConfiguration),
      proof: validatedSpotifyProofKey(record.proof as SpotifyProofKey) });
  } catch { throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse); }
}

export function encodePendingSpotifyAuthorization(configuration: SpotifyLoginConfiguration, proof: SpotifyProofKey, createdAtMilliseconds: number): string {
  const serialized = JSON.stringify({ schemaVersion: PendingAuthorizationPolicy.schemaVersion,
    configuration: validatedSpotifyLoginConfiguration(configuration), proof: validatedSpotifyProofKey(proof), createdAtMilliseconds });
  decodePendingSpotifyAuthorization(serialized);
  return serialized;
}

export function requirePendingAuthorizationFresh(authorization: PendingSpotifyAuthorization, nowMilliseconds: number): void {
  if (!Number.isSafeInteger(nowMilliseconds) || nowMilliseconds < PendingAuthorizationPolicy.minimumTimestampMilliseconds
    || authorization.createdAtMilliseconds > nowMilliseconds
    || nowMilliseconds - authorization.createdAtMilliseconds >= PendingAuthorizationPolicy.maximumAgeMilliseconds) {
    throw new IntegrationFailure(IntegrationFailureCode.Unauthorized);
  }
}

export async function loadSpotifyAuthorizationConfiguration(store: SpotifyLoginCredentialStore, cancellation: AbortSignal): Promise<SpotifyLoginConfiguration | null> {
  try {
    checkCancellation(cancellation);
    const serialized = await withCancellation(store.read(cancellation), cancellation);
    checkCancellation(cancellation);
    return serialized === null ? null : decodePendingSpotifyAuthorization(serialized).configuration;
  } catch (failure) {
    throw failure instanceof IntegrationFailure ? new IntegrationFailure(failure.code) : new IntegrationFailure(IntegrationFailureCode.CredentialStorage);
  }
}
