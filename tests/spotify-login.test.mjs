import assert from 'node:assert/strict';
import test from 'node:test';
import { library, deferred } from './fixtures.mjs';

const ProofValues = Object.freeze({ verifierCharacter: 'v', verifierLength: 64, challengeCharacter: 'c', challengeLength: 43, stateCharacter: 's', stateLength: 64 });
const Values = Object.freeze({ clientIdentifier: '0123456789abcdef0123456789abcdef', redirectAddress: 'streamingservicespotify://callback',
  scope: 'user-modify-playback-state', verifier: ProofValues.verifierCharacter.repeat(ProofValues.verifierLength), challenge: ProofValues.challengeCharacter.repeat(ProofValues.challengeLength), state: ProofValues.stateCharacter.repeat(ProofValues.stateLength),
  accountIdentifier: 'spotify-account', token: 'access-token', refreshToken: 'refresh-token', renewedToken: 'renewed-token',
  nowMilliseconds: 100000, lifetimeSeconds: 3600, successStatus: 200, expiredStatus: 400, requestsBeforeLogin: 0,
  singleRequest: 1, twoRequests: 2, firstPosition: 0, nextPosition: 1, code: 'authorization-code',
  contentType: 'application/x-www-form-urlencoded', tokenAddress: 'https://accounts.spotify.com/api/token',
  formHeader: 'content-type', codeParameter: 'code', verifierParameter: 'code_verifier', grantParameter: 'grant_type',
  refreshParameter: 'refresh_token', clientSecretParameter: 'client_secret', stateParameter: 'state',
  authorizationGrant: 'authorization_code', refreshGrant: 'refresh_token', challengeParameter: 'code_challenge',
  challengeMethodParameter: 'code_challenge_method', challengeMethod: 'S256', bearerType: 'Bearer',
  wrongState: 'wrong-state', foreignCallback: 'other://callback', insecureCallback: 'http://example.test/callback',
  cancellationCode: library.IntegrationFailureCode.Canceled, emptyText: '', secretField: 'credentials',
  differentClientIdentifier: 'abcdef0123456789abcdef0123456789', differentScope: 'user-read-private',
  scopeParameter: 'scope', clientParameter: 'client_id', redirectParameter: 'redirect_uri',
  whitespaceAccessToken: 'access token', whitespaceRefreshToken: 'refresh token',
});
const Names = Object.freeze({ login: 'Login opens PKCE authorization and exchanges code without a client secret',
  callback: 'Foreign callback and mismatched or duplicated state never exchange credentials',
  denied: 'Denied consent returns unauthorized without exchanging code', canceled: 'Canceled login performs no browser or network work',
  logout: 'Logout during browser authorization discards its late completion', staleExchange: 'Logout during code exchange cannot establish credentials',
  proof: 'Invalid proof material is rejected before opening browser', configuration: 'Invalid client and insecure network callbacks are rejected',
  refresh: 'Refresh retains omitted refresh token and rotates provided access token', expired: 'Expired credentials refresh automatically',
  shared: 'Concurrent refresh calls share one exchange', rejected: 'Rejected refresh removes existing credentials',
  malformed: 'Malformed token responses never establish credentials', overlap: 'Concurrent login attempts are rejected',
  volatile: 'Logout removes credentials and renewal access', canceledRefresh: 'Canceled caller does not receive refreshed credentials',
  proofCancellation: 'Cancellation promptly retires login while proof generation ignores cancellation',
  browserCancellation: 'Cancellation promptly retires login while browser authorization ignores cancellation',
  exchangeCancellation: 'Cancellation promptly retires login while token transport ignores cancellation',
  accountCancellation: 'Cancellation promptly retires login while account lookup ignores cancellation',
  isolatedRefreshCancellation: 'Cancelled refresh caller rejects promptly while another caller retains the shared renewal',
  immutableConfiguration: 'Login captures validated configuration and scopes before caller mutation',
  whitespaceTokens: 'Whitespace bearing access and refresh tokens are rejected',
});
function fixture() {
  const requests = []; const addresses = []; let now = Values.nowMilliseconds;
  const dependencies = {
    configuration: { clientIdentifier: Values.clientIdentifier, redirectAddress: Values.redirectAddress, scopes: [Values.scope] },
    proofKeys: { generate: async () => ({ verifier: Values.verifier, challenge: Values.challenge, state: Values.state }) },
    browser: { authorize: async address => { addresses.push(address); return callback(); } },
    requests: { execute: async request => { requests.push(request); return response(); } },
    clock: { nowMilliseconds: () => now }, resolveAccount: async () => Values.accountIdentifier,
  };
  return { dependencies, requests, addresses, session: new library.SpotifyLoginSession(dependencies),
    advance: () => { now += Values.lifetimeSeconds * MillisecondsPerSecond; } };
}
const MillisecondsPerSecond = 1000;
function callback() { const address = new URL(Values.redirectAddress); address.searchParams.set(Values.codeParameter, Values.code);
  address.searchParams.set(Values.stateParameter, Values.state); return address.toString(); }
function response(accessToken = Values.token, refreshToken = Values.refreshToken) { return { status: Values.successStatus,
  body: { access_token: accessToken, refresh_token: refreshToken, expires_in: Values.lifetimeSeconds, token_type: Values.bearerType } }; }
function signal() { return new AbortController().signal; }

test(Names.login, async () => { const current = fixture(); const credentials = await current.session.login(signal());
  assert.equal(credentials.accountIdentifier, Values.accountIdentifier); assert.equal(credentials.accessToken, Values.token);
  const address = new URL(current.addresses[Values.firstPosition]); assert.equal(address.searchParams.get(Values.challengeParameter), Values.challenge);
  assert.equal(address.searchParams.get(Values.challengeMethodParameter), Values.challengeMethod);
  assert.equal(address.toString().includes(Values.verifier), false);
  const request = current.requests[Values.firstPosition]; assert.equal(request.address, Values.tokenAddress);
  assert.equal(request.headers[Values.formHeader], Values.contentType);
  const parameters = new URLSearchParams(request.body); assert.equal(parameters.get(Values.verifierParameter), Values.verifier);
  assert.equal(parameters.get(Values.grantParameter), Values.authorizationGrant); assert.equal(parameters.has(Values.clientSecretParameter), false);
});
test(Names.callback, async () => { const duplicateSeparator = '&state=';
  for (const address of [callback().replace(Values.state, Values.wrongState), callback().replace(Values.redirectAddress, Values.foreignCallback),
    callback() + duplicateSeparator + Values.state]) {
    const current = fixture(); current.dependencies.browser.authorize = async () => address;
    await assert.rejects(current.session.login(signal()), { code: library.IntegrationFailureCode.InvalidResponse });
    assert.equal(current.requests.length, Values.requestsBeforeLogin);
  }
});
test(Names.denied, async () => { const current = fixture(); const errorParameter = 'error'; const error = 'access_denied';
  const address = new URL(callback()); address.searchParams.set(errorParameter, error); current.dependencies.browser.authorize = async () => address.toString();
  await assert.rejects(current.session.login(signal()), { code: library.IntegrationFailureCode.Unauthorized });
  assert.equal(current.requests.length, Values.requestsBeforeLogin);
});
test(Names.canceled, async () => { const current = fixture(); const cancellation = new AbortController(); cancellation.abort();
  await assert.rejects(current.session.login(cancellation.signal), { code: Values.cancellationCode }); assert.equal(current.addresses.length, Values.requestsBeforeLogin);
});
test(Names.logout, async () => { const current = fixture(); const browser = deferred(); current.dependencies.browser.authorize = () => browser.promise;
  const pending = current.session.login(signal()); await Promise.resolve(); current.session.logout(); browser.resolve(callback());
  await assert.rejects(pending, { code: Values.cancellationCode }); assert.equal(current.requests.length, Values.requestsBeforeLogin);
});
test(Names.staleExchange, async () => { const current = fixture(); const exchange = deferred(); const started = deferred();
  current.dependencies.requests.execute = () => { started.resolve(); return exchange.promise; };
  const pending = current.session.login(signal()); await started.promise; current.session.logout(); exchange.resolve(response());
  await assert.rejects(pending, { code: Values.cancellationCode });
  await assert.rejects(current.session.getCredentials(signal()), { code: library.IntegrationFailureCode.Unauthorized });
});
test(Names.proof, async () => { const current = fixture(); current.dependencies.proofKeys.generate = async () => ({ verifier: Values.emptyText,
  challenge: Values.challenge, state: Values.state }); await assert.rejects(current.session.login(signal()), { code: library.IntegrationFailureCode.InvalidInput });
  assert.equal(current.addresses.length, Values.requestsBeforeLogin);
});
test(Names.configuration, () => { const current = fixture();
  for (const configuration of [{ ...current.dependencies.configuration, clientIdentifier: Values.emptyText },
    { ...current.dependencies.configuration, redirectAddress: Values.insecureCallback }]) {
    assert.throws(() => new library.SpotifyLoginSession({ ...current.dependencies, configuration }), { code: library.IntegrationFailureCode.InvalidInput });
  }
});
test(Names.refresh, async () => { const current = fixture(); await current.session.login(signal());
  current.dependencies.requests.execute = async request => { current.requests.push(request); const result = response(Values.renewedToken); delete result.body.refresh_token; return result; };
  assert.equal((await current.session.renewCredentials(signal())).accessToken, Values.renewedToken);
  await current.session.renewCredentials(signal()); const parameters = new URLSearchParams(current.requests[Values.nextPosition].body);
  assert.equal(parameters.get(Values.refreshParameter), Values.refreshToken); assert.equal(parameters.get(Values.grantParameter), Values.refreshGrant);
});
test(Names.expired, async () => { const current = fixture(); await current.session.login(signal()); current.advance();
  await current.session.getCredentials(signal()); assert.equal(current.requests.length, Values.twoRequests);
});
test(Names.shared, async () => { const current = fixture(); await current.session.login(signal()); const exchange = deferred();
  current.dependencies.requests.execute = request => { current.requests.push(request); return exchange.promise; };
  const first = current.session.renewCredentials(signal()); const second = current.session.renewCredentials(signal()); exchange.resolve(response());
  await Promise.all([first, second]); assert.equal(current.requests.length, Values.twoRequests);
});
test(Names.rejected, async () => { const current = fixture(); await current.session.login(signal());
  current.dependencies.requests.execute = async () => ({ status: Values.expiredStatus, body: {} });
  await assert.rejects(current.session.renewCredentials(signal()), { code: library.IntegrationFailureCode.Unauthorized });
  await assert.rejects(current.session.getCredentials(signal()), { code: library.IntegrationFailureCode.Unauthorized });
});
test(Names.malformed, async () => { const invalidBodies = [null, {}, { ...response().body, expires_in: Number.POSITIVE_INFINITY },
  { ...response().body, refresh_token: Values.emptyText }, { ...response().body, token_type: Values.emptyText }];
  for (const body of invalidBodies) { const current = fixture(); current.dependencies.requests.execute = async () => ({ status: Values.successStatus, body });
    await assert.rejects(current.session.login(signal()), { code: library.IntegrationFailureCode.InvalidResponse });
  }
});
test(Names.overlap, async () => { const current = fixture(); const browser = deferred(); current.dependencies.browser.authorize = () => browser.promise;
  const first = current.session.login(signal()); await assert.rejects(current.session.login(signal()), { code: library.IntegrationFailureCode.Backpressure });
  browser.resolve(callback()); await first;
});
test(Names.volatile, async () => { const current = fixture(); await current.session.login(signal()); current.session.logout();
  await assert.rejects(current.session.getCredentials(signal()), { code: library.IntegrationFailureCode.Unauthorized });
  await assert.rejects(current.session.renewCredentials(signal()), { code: library.IntegrationFailureCode.Unauthorized });
});
test(Names.canceledRefresh, async () => { const current = fixture(); await current.session.login(signal()); const exchange = deferred();
  current.dependencies.requests.execute = () => exchange.promise; const cancellation = new AbortController();
  const pending = current.session.renewCredentials(cancellation.signal); cancellation.abort(); exchange.resolve(response());
  await assert.rejects(pending, { code: Values.cancellationCode });
});

test(Names.proofCancellation, async () => {
  const current = fixture(); const proof = deferred(); current.dependencies.proofKeys.generate = () => proof.promise;
  const cancellation = new AbortController(); const pending = current.session.login(cancellation.signal); cancellation.abort();
  await assert.rejects(pending, { code: Values.cancellationCode });
  current.dependencies.proofKeys.generate = async () => ({ verifier: Values.verifier, challenge: Values.challenge, state: Values.state });
  assert.equal((await current.session.login(signal())).accountIdentifier, Values.accountIdentifier);
  proof.resolve({ verifier: Values.verifier, challenge: Values.challenge, state: Values.state });
});

test(Names.browserCancellation, async () => {
  const current = fixture(); const browser = deferred(); const started = deferred();
  current.dependencies.browser.authorize = () => { started.resolve(); return browser.promise; };
  const cancellation = new AbortController(); const pending = current.session.login(cancellation.signal); await started.promise; cancellation.abort();
  await assert.rejects(pending, { code: Values.cancellationCode }); browser.resolve(callback());
  assert.equal(current.requests.length, Values.requestsBeforeLogin);
});

test(Names.exchangeCancellation, async () => {
  const current = fixture(); const exchange = deferred(); const started = deferred();
  current.dependencies.requests.execute = () => { started.resolve(); return exchange.promise; };
  const cancellation = new AbortController(); const pending = current.session.login(cancellation.signal); await started.promise; cancellation.abort();
  await assert.rejects(pending, { code: Values.cancellationCode }); exchange.resolve(response());
  await assert.rejects(current.session.getCredentials(signal()), { code: library.IntegrationFailureCode.Unauthorized });
});

test(Names.accountCancellation, async () => {
  const current = fixture(); const account = deferred(); const started = deferred();
  current.dependencies.resolveAccount = () => { started.resolve(); return account.promise; };
  const cancellation = new AbortController(); const pending = current.session.login(cancellation.signal); await started.promise; cancellation.abort();
  await assert.rejects(pending, { code: Values.cancellationCode }); account.resolve(Values.accountIdentifier);
  await assert.rejects(current.session.getCredentials(signal()), { code: library.IntegrationFailureCode.Unauthorized });
});

test(Names.isolatedRefreshCancellation, async () => {
  const current = fixture(); await current.session.login(signal()); const exchange = deferred();
  current.dependencies.requests.execute = request => { current.requests.push(request); return exchange.promise; };
  const cancellation = new AbortController(); const cancelled = current.session.renewCredentials(cancellation.signal);
  const retained = current.session.renewCredentials(signal()); cancellation.abort();
  await assert.rejects(cancelled, { code: Values.cancellationCode });
  exchange.resolve(response(Values.renewedToken)); assert.equal((await retained).accessToken, Values.renewedToken);
  assert.equal(current.requests.length, Values.twoRequests);
});

test(Names.immutableConfiguration, async () => {
  const current = fixture(); current.dependencies.configuration.clientIdentifier = Values.differentClientIdentifier;
  current.dependencies.configuration.redirectAddress = Values.foreignCallback;
  current.dependencies.configuration.scopes.push(Values.differentScope);
  await current.session.login(signal()); const address = new URL(current.addresses[Values.firstPosition]);
  assert.equal(address.searchParams.get(Values.clientParameter), Values.clientIdentifier);
  assert.equal(address.searchParams.get(Values.redirectParameter), Values.redirectAddress);
  assert.equal(address.searchParams.get(Values.scopeParameter), Values.scope);
  const parameters = new URLSearchParams(current.requests[Values.firstPosition].body);
  assert.equal(parameters.get(Values.clientParameter), Values.clientIdentifier);
  assert.equal(parameters.get(Values.redirectParameter), Values.redirectAddress);
});

test(Names.whitespaceTokens, async () => {
  for (const value of [response(Values.whitespaceAccessToken), response(Values.token, Values.whitespaceRefreshToken)]) {
    const current = fixture(); current.dependencies.requests.execute = async () => value;
    await assert.rejects(current.session.login(signal()), { code: library.IntegrationFailureCode.InvalidResponse });
  }
});
