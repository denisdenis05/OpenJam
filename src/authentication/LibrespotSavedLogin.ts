import type { SpotifyLoginCredentialStore } from '../../contracts/authentication';
import { IntegrationFailureCode } from '../../contracts/network';
import { withCancellation } from '../network/Cancellation';
import { checkCancellation, IntegrationFailure } from '../network/IntegrationFailure';
import { LibrespotLoginPolicy as Policy } from './LibrespotLoginPolicy';

export interface SavedLibrespotLogin {
  readonly schemaVersion: number;
  readonly accountIdentifier: string;
  readonly storedCredential: string;
}

export function isLibrespotAccountIdentifier(value: unknown): value is string {
  return typeof value === Policy.stringType && Boolean((value as string).trim())
    && (value as string).length <= Policy.maximumAccountCharacters && !Policy.whitespacePattern.test(value as string);
}

export function isLibrespotStoredCredential(value: unknown): value is string {
  return typeof value === Policy.stringType && Boolean((value as string).trim())
    && (value as string).length <= Policy.maximumStoredCredentialCharacters;
}

export function decodeLibrespotLogin(serialized: string): SavedLibrespotLogin {
  try {
    if (typeof serialized !== Policy.stringType || serialized.length > Policy.maximumRecordCharacters) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
    const decoded: unknown = JSON.parse(serialized);
    if (typeof decoded !== Policy.objectType || decoded === null || Array.isArray(decoded)) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
    const record = decoded as Record<string, unknown>;
    if (record.schemaVersion !== Policy.schemaVersion || !isLibrespotAccountIdentifier(record.accountIdentifier)
      || !isLibrespotStoredCredential(record.storedCredential)) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
    return Object.freeze({ schemaVersion: Policy.schemaVersion, accountIdentifier: record.accountIdentifier, storedCredential: record.storedCredential });
  } catch { throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse); }
}

export function encodeLibrespotLogin(accountIdentifier: string, storedCredential: string): string {
  const serialized = JSON.stringify({ schemaVersion: Policy.schemaVersion, accountIdentifier, storedCredential });
  decodeLibrespotLogin(serialized);
  return serialized;
}

export async function hasSavedLibrespotLogin(store: SpotifyLoginCredentialStore, cancellation: AbortSignal): Promise<boolean> {
  try {
    checkCancellation(cancellation);
    const serialized = await withCancellation(store.read(cancellation), cancellation);
    checkCancellation(cancellation);
    if (serialized === null) return false;
    decodeLibrespotLogin(serialized);
    return true;
  } catch (failure) {
    throw new IntegrationFailure(failure instanceof IntegrationFailure ? failure.code : IntegrationFailureCode.CredentialStorage);
  }
}
