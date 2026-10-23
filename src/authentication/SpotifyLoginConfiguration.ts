import type { SpotifyLoginConfiguration } from '../../contracts/authentication';
import { IntegrationFailureCode } from '../../contracts/network';
import { IntegrationFailure } from '../network/IntegrationFailure';
import { SpotifyLoginPolicy as Policy } from './SpotifyLoginPolicy';

const ConfigurationPolicy = Object.freeze({ maximumScopes: 64, maximumScopeCharacters: 256, maximumRedirectCharacters: 4096,
  stringType: 'string', whitespacePattern: /\s/ });

export function validatedSpotifyLoginConfiguration(value: SpotifyLoginConfiguration): SpotifyLoginConfiguration {
  if (typeof value.clientIdentifier !== ConfigurationPolicy.stringType || typeof value.redirectAddress !== ConfigurationPolicy.stringType
    || !Array.isArray(value.scopes) || value.scopes.length > ConfigurationPolicy.maximumScopes
    || value.redirectAddress.length > ConfigurationPolicy.maximumRedirectCharacters) throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
  const configuration = Object.freeze({ clientIdentifier: value.clientIdentifier, redirectAddress: value.redirectAddress,
    scopes: Object.freeze([...new Set(value.scopes)]) });
  let redirect: URL;
  try { redirect = new URL(configuration.redirectAddress); } catch { throw new IntegrationFailure(IntegrationFailureCode.InvalidInput); }
  if (!Policy.clientPattern.test(configuration.clientIdentifier) || redirect.username || redirect.password || redirect.hash
    || redirect.search || Policy.forbiddenProtocols.includes(redirect.protocol)
    || redirect.protocol === Policy.insecureProtocol && redirect.hostname !== Policy.loopbackIpv4 && redirect.hostname !== Policy.loopbackIpv6
    || configuration.scopes.some(scope => typeof scope !== ConfigurationPolicy.stringType || !scope.trim()
      || scope.length > ConfigurationPolicy.maximumScopeCharacters || ConfigurationPolicy.whitespacePattern.test(scope))) {
    throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
  }
  return configuration;
}
