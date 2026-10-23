export const SpotifyLoginPolicy = Object.freeze({
  authorizationAddress: 'https://accounts.spotify.com/authorize', tokenAddress: 'https://accounts.spotify.com/api/token',
  formMediaType: 'application/x-www-form-urlencoded', contentTypeHeader: 'content-type',
  responseType: 'code', challengeMethod: 'S256', authorizationGrant: 'authorization_code', refreshGrant: 'refresh_token',
  bearerType: 'bearer', minimumProofCharacters: 43, maximumProofCharacters: 128,
  proofPattern: /^[A-Za-z0-9._~-]+$/, challengePattern: /^[A-Za-z0-9_-]{43}$/, clientPattern: /^[A-Za-z0-9]{32}$/,
  maximumTokenCharacters: 16384, minimumLifetimeSeconds: 0, millisecondsPerSecond: 1000,
  expirationMarginMilliseconds: 30000, successStatus: 200, badRequestStatus: 400,
  unauthorizedStatus: 401, rateLimitedStatus: 429, emptyText: '', scopeSeparator: ' ',
  secureProtocol: 'https:', insecureProtocol: 'http:', loopbackIpv4: '127.0.0.1', loopbackIpv6: '[::1]',
  forbiddenProtocols: Object.values({ script: 'javascript:', data: 'data:', file: 'file:', transfer: 'ftp:' }),
  codeParameter: 'code', stateParameter: 'state', errorParameter: 'error', abortEvent: 'abort',
});
