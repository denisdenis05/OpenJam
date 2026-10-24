import { SpotifyAuthorizationRedirectComparison } from '../../contracts/authentication';
import type { SpotifyAuthorizationRedirectAddress } from '../../contracts/authentication';

const RedirectPolicy = Object.freeze({ emptyComponent: '', rootPath: '/',
  networkProtocols: Object.values({ secure: 'https:', insecure: 'http:', transfer: 'ftp:', websocket: 'ws:', secureWebsocket: 'wss:', file: 'file:' }) });

export function compareSpotifyAuthorizationRedirect(actual: SpotifyAuthorizationRedirectAddress,
  expected: SpotifyAuthorizationRedirectAddress): SpotifyAuthorizationRedirectComparison {
  if (actual.protocol !== expected.protocol) return SpotifyAuthorizationRedirectComparison.SchemeMismatch;
  if (actual.host !== expected.host) return SpotifyAuthorizationRedirectComparison.HostMismatch;
  if (actual.pathname === expected.pathname) return SpotifyAuthorizationRedirectComparison.Matched;
  const isRoot = (path: string): boolean => path === RedirectPolicy.emptyComponent || path === RedirectPolicy.rootPath;
  return expected.host !== RedirectPolicy.emptyComponent && !RedirectPolicy.networkProtocols.includes(expected.protocol)
    && isRoot(actual.pathname) && isRoot(expected.pathname)
    ? SpotifyAuthorizationRedirectComparison.Matched : SpotifyAuthorizationRedirectComparison.PathMismatch;
}
