import type { SpotifyLoginConfiguration, SpotifyLoginCredentialStore } from '../../contracts/authentication';
import { IntegrationFailureCode } from '../../contracts/network';
import { checkCancellation, failureCode, IntegrationFailure } from '../network/IntegrationFailure';
import { withCancellation } from '../network/Cancellation';
import { validatedSpotifyLoginConfiguration } from './SpotifyLoginConfiguration';
import { SpotifyLoginPolicy } from './SpotifyLoginPolicy';

export const SavedLoginPolicy = Object.freeze({ schemaVersion: 1, maximumCharacters: 65536, maximumAccountCharacters: 512,
  objectType: 'object', stringType: 'string', whitespacePattern: /\s/ });

export interface SavedSpotifyLogin {
  readonly schemaVersion: number;
  readonly configuration: SpotifyLoginConfiguration;
  readonly accountIdentifier: string;
  readonly refreshToken: string;
}

export function decodeSavedSpotifyLogin(serialized: string): SavedSpotifyLogin {
  try {
    if (serialized.length > SavedLoginPolicy.maximumCharacters) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
    const value: unknown = JSON.parse(serialized);
    if (typeof value !== SavedLoginPolicy.objectType || value === null || Array.isArray(value)) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
    const record = value as Record<string, unknown>;
    if (record.schemaVersion !== SavedLoginPolicy.schemaVersion || typeof record.accountIdentifier !== SavedLoginPolicy.stringType
      || !(record.accountIdentifier as string).trim() || (record.accountIdentifier as string).length > SavedLoginPolicy.maximumAccountCharacters
      || typeof record.refreshToken !== SavedLoginPolicy.stringType || !(record.refreshToken as string).trim()
      || (record.refreshToken as string).length > SpotifyLoginPolicy.maximumTokenCharacters
      || SavedLoginPolicy.whitespacePattern.test(record.refreshToken as string)
      || typeof record.configuration !== SavedLoginPolicy.objectType || record.configuration === null) {
      throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
    }
    return Object.freeze({ schemaVersion: SavedLoginPolicy.schemaVersion, accountIdentifier: record.accountIdentifier as string,
      refreshToken: record.refreshToken as string,
      configuration: validatedSpotifyLoginConfiguration(record.configuration as unknown as SpotifyLoginConfiguration) });
  } catch { throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse); }
}

export async function loadSpotifyLoginConfiguration(store: SpotifyLoginCredentialStore, cancellation: AbortSignal): Promise<SpotifyLoginConfiguration | null> {
  try {
    checkCancellation(cancellation);
    const serialized = await withCancellation(store.read(cancellation), cancellation);
    checkCancellation(cancellation);
    return serialized === null ? null : decodeSavedSpotifyLogin(serialized).configuration;
  } catch (failure) { throw new IntegrationFailure(failureCode(failure)); }
}

export function encodeSavedSpotifyLogin(configuration: SpotifyLoginConfiguration, accountIdentifier: string, refreshToken: string): string {
  const serialized = JSON.stringify({ schemaVersion: SavedLoginPolicy.schemaVersion, configuration, accountIdentifier, refreshToken });
  decodeSavedSpotifyLogin(serialized);
  return serialized;
}
