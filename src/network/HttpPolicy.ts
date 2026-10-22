export const HttpPolicy = Object.freeze({
  successMinimumStatus: 200, successMaximumStatus: 299, unauthorizedStatus: 401,
  forbiddenStatus: 403, notFoundStatus: 404, rateLimitedStatus: 429,
  invalidRequestStatus: 400, serverErrorMinimumStatus: 500,
  emptyText: '', authorizationHeader: 'authorization', acceptHeader: 'accept',
  userAgentHeader: 'user-agent', retryAfterHeader: 'retry-after', contentLengthHeader: 'content-length',
  jsonMediaType: 'application/json', bearerPrefix: 'Bearer ',
  secureProtocol: 'https:', spotifyHost: 'spotify.com', spotifyHostSuffix: '.spotify.com',
  redirectPolicy: 'error', credentialPolicy: 'omit', abortEvent: 'abort',
  defaultDeadlineMilliseconds: 15000, maximumResponseCharacters: 1048576,
  minimumDelayMilliseconds: 0, expirationMarginMilliseconds: 30000,
  minimumRetryAfterSeconds: 0,
});
