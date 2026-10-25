import assert from 'node:assert/strict';
import test from 'node:test';
import { library, deferred } from './fixtures.mjs';

const Fixture = Object.freeze({ nowMilliseconds: 100000, lifetimeSeconds: 60, intervalSeconds: 5, intervalMilliseconds: 5000,
  slowdownMilliseconds: 10000, shortLifetimeSeconds: 1, shortLifetimeMilliseconds: 1000, millisecondsPerSecond: 1000,
  deviceCode: 'synthetic-private-device-code', userCode: 'ABCDEF', token: 'synthetic-access-token', stored: 'synthetic-native-session',
  account: 'synthetic-account', client: '65b708073fc0480ea92a077233ca87bd', otherClient: 'other-client',
  verification: 'https://spotify.com/pair', completeVerification: 'https://spotify.com/pair?code=ABCDEF',
  foreignVerification: 'https://example.test/pair', wrongVerification: 'https://spotify.com/pair?code=OTHER',
  deviceAddress: 'https://accounts.spotify.com/oauth2/device/authorize', tokenAddress: 'https://accounts.spotify.com/api/token',
  codeParameter: 'device_code', clientParameter: 'client_id', grantParameter: 'grant_type', grantType: 'urn:ietf:params:oauth:grant-type:device_code',
  scopeParameter: 'scope', scope: 'streaming', pending: 'authorization_pending', slowdown: 'slow_down', denied: 'access_denied',
  expired: 'expired_token', unsupported: 'unauthorized_client', bearer: 'Bearer', malformed: 'invalid-json',
  rawFailure: 'Sensitive browser or storage failure', whitespaceToken: 'invalid token', whitespaceCode: 'invalid code',
  malformedCode: 'invalid user code', unknownVersion: 2, schemaVersion: 1, success: 200, rejected: 400, forbidden: 403,
  rateLimited: 429, unavailable: 503, retrySeconds: 30, zero: 0, one: 1, two: 2, three: 3, first: 0, next: 1,
  flushTurns: 80, recordLimit: 32769, padding: 'x', empty: '',
  names: Object.freeze({ start: 'Device authorization uses the supported client and waits for secure storage before browser and token polling',
    publicView: 'Pairing observers receive immutable public fields without the private device credential',
    interval: 'Token polling waits the requested interval and repeats pending responses at that interval',
    slowdown: 'Slow down increases and persists polling delay before another request',
    resume: 'Pending authorization resumes after recreation without a new device request or browser launch',
    missing: 'Resume without pending state never starts a new authorization',
    denied: 'Actual user denial erases pending device state and never calls native bootstrap',
    expired: 'Authorization expiration clears pending state before another token request',
    failures: 'Rate limit and server failures preserve pending state for later recovery',
    unsupported: 'Ineligible device clients expose unsupported and erase the unusable pending record',
    invalid: 'Malformed device replies and unsafe verification addresses cannot open the browser',
    malformedRecord: 'Pending records reject invalid schema client expiry and oversized text before resumption',
    replaceExpired: 'An explicit sign-in replaces an expired pending record while resume cannot',
    cancellation: 'Canceling a polling wait removes timers while preserving resumable pending state',
    canceledStart: 'Canceling an uncooperative authorization request ignores its late reply before storage or browser',
    canceledBootstrap: 'Canceling an uncooperative native bootstrap cannot accept its late grant',
    overlap: 'Concurrent device authorization is rejected without another request',
    storageWrite: 'Pending storage failure prevents browser and token requests with sanitized errors',
    consume: 'Native bootstrap waits for pending deletion acknowledgement',
    clearFailure: 'Failed pending deletion prevents native bootstrap',
    browserFailure: 'A browser launch failure is sanitized and leaves pending state recoverable',
    observer: 'Throwing and rejecting pairing observers cannot disrupt authentication',
    observerCancellation: 'Pairing observer cancellation prevents browser opening and removes later work',
    bootstrapFailure: 'A failed native bootstrap cannot reuse an already consumed device grant',
    tokenShape: 'Invalid token replies cannot reach native bootstrap',
    presence: 'Pending presence checks validate records without starting requests or exposing private values',
    preCanceled: 'Pre-canceled device authorization performs no storage or network operations',
    progress: 'Native bootstrap begins only after the exchange phase is observed' }) });

function signal() { return new AbortController().signal; }
function failure(code) { return value => value instanceof library.IntegrationFailure && value.code === code; }
function startResponse(overrides = {}) { return { status: Fixture.success, body: { device_code: Fixture.deviceCode, user_code: Fixture.userCode,
  verification_uri: Fixture.verification, verification_uri_complete: Fixture.completeVerification,
  expires_in: Fixture.lifetimeSeconds, interval: Fixture.intervalSeconds, ...overrides } }; }
function tokenResponse(overrides = {}) { return { status: Fixture.success, body: { access_token: Fixture.token,
  token_type: Fixture.bearer, expires_in: Fixture.lifetimeSeconds, ...overrides } }; }
function pendingResponse(error = Fixture.pending, status = Fixture.rejected) { return { status, body: { error } }; }
function record(overrides = {}) { return JSON.stringify({ schemaVersion: Fixture.schemaVersion, clientIdentifier: Fixture.client,
  deviceCode: Fixture.deviceCode, userCode: Fixture.userCode, verificationAddress: Fixture.completeVerification,
  createdAtMilliseconds: Fixture.nowMilliseconds, expiresAtMilliseconds: Fixture.nowMilliseconds + Fixture.lifetimeSeconds * Fixture.millisecondsPerSecond,
  pollingIntervalMilliseconds: Fixture.intervalMilliseconds, ...overrides }); }
async function flush() { for (let turn = Fixture.zero; turn < Fixture.flushTurns; turn += Fixture.one) await Promise.resolve(); }
function fixture(serialized = null) {
  const state = { nowMilliseconds: Fixture.nowMilliseconds, serialized, responses: [], request: null, write: null, clear: null, open: null, bootstrap: null, observe: null };
  const calls = { requests: [], writes: [], clears: Fixture.zero, opens: [], views: [], bootstrap: [], stages: [], reads: Fixture.zero };
  const jobs = new Set();
  const store = { read: async () => { calls.reads += Fixture.one; return state.serialized; },
    write: async value => { calls.writes.push(value); if (state.write) await state.write(value); state.serialized = value; },
    clear: async () => { calls.clears += Fixture.one; if (state.clear) await state.clear(); state.serialized = null; } };
  const clock = { nowMilliseconds: () => state.nowMilliseconds };
  const grant = { accountIdentifier: Fixture.account, accessToken: Fixture.token, expiresAtMilliseconds: Fixture.nowMilliseconds + Fixture.lifetimeSeconds * Fixture.millisecondsPerSecond,
    storedCredential: Fixture.stored };
  const dependencies = { authorizationStore: store, clock,
    scheduler: { schedule(delayMilliseconds, callback) { const job = { due: state.nowMilliseconds + delayMilliseconds, callback }; jobs.add(job); return () => { jobs.delete(job); }; } },
    requests: { execute: async request => { calls.requests.push(request); if (state.request) return state.request(request);
      return state.responses.shift() ?? (request.address === Fixture.deviceAddress ? startResponse() : tokenResponse()); } },
    openVerificationPage: async address => { calls.opens.push(address); if (state.open) await state.open(address); },
    bootstrap: async token => { calls.bootstrap.push(token); return state.bootstrap ? state.bootstrap(token) : grant; },
    onAuthorization: value => { calls.views.push(value); return state.observe?.(value); }, onProgress: stage => { calls.stages.push(stage); } };
  return { state, calls, jobs, store, clock, dependencies, grant, broker: new library.LibrespotDeviceAuthorization(dependencies),
    async advance(delayMilliseconds = Fixture.intervalMilliseconds) {
      state.nowMilliseconds += delayMilliseconds;
      const due = [...jobs].filter(job => job.due <= state.nowMilliseconds).sort((left, right) => left.due - right.due);
      for (const job of due) { if (jobs.delete(job)) job.callback(); await flush(); }
    } };
}

test(Fixture.names.start, async () => { const current = fixture(); const writing = deferred(); current.state.write = () => writing.promise;
  const authorizing = current.broker.authorize(signal()); await flush(); assert.equal(current.calls.requests.length, Fixture.one);
  assert.equal(current.calls.opens.length, Fixture.zero); assert.equal(current.jobs.size, Fixture.zero);
  const form = new URLSearchParams(current.calls.requests[Fixture.first].body);
  assert.equal(form.get(Fixture.clientParameter), Fixture.client); assert.equal(form.get(Fixture.scopeParameter), Fixture.scope);
  writing.resolve(); await flush(); assert.deepEqual(current.calls.opens, [Fixture.completeVerification]);
  await current.advance(); assert.deepEqual(await authorizing, current.grant);
  const poll = new URLSearchParams(current.calls.requests[Fixture.next].body);
  assert.equal(poll.get(Fixture.codeParameter), Fixture.deviceCode); assert.equal(poll.get(Fixture.grantParameter), Fixture.grantType);
  assert.equal(current.state.serialized, null); });
test(Fixture.names.publicView, async () => { const current = fixture(); const authorizing = current.broker.authorize(signal()); await flush();
  const view = current.calls.views[Fixture.first]; assert.ok(Object.isFrozen(view));
  assert.deepEqual(Object.keys(view), Object.values({ code: 'userCode', address: 'verificationAddress', expiration: 'expiresAtMilliseconds' }));
  assert.equal(JSON.stringify(view).includes(Fixture.deviceCode), false); await current.advance(); await authorizing; });
test(Fixture.names.interval, async () => { const current = fixture(); current.state.responses.push(startResponse(), pendingResponse(), tokenResponse());
  const authorizing = current.broker.authorize(signal()); await flush(); assert.equal(current.calls.requests.length, Fixture.one);
  await current.advance(); assert.equal(current.calls.requests.length, Fixture.two); assert.equal(current.calls.bootstrap.length, Fixture.zero);
  await current.advance(); await authorizing; assert.equal(current.calls.requests.length, Fixture.three); });
test(Fixture.names.slowdown, async () => { const current = fixture(); current.state.responses.push(startResponse(), pendingResponse(Fixture.slowdown), tokenResponse());
  const authorizing = current.broker.authorize(signal()); await flush(); await current.advance();
  assert.equal(JSON.parse(current.state.serialized).pollingIntervalMilliseconds, Fixture.slowdownMilliseconds);
  await current.advance(); assert.equal(current.calls.requests.length, Fixture.two);
  await current.advance(); await authorizing; assert.equal(current.calls.requests.length, Fixture.three); });
test(Fixture.names.resume, async () => { const current = fixture(record()); const resuming = current.broker.resume(signal()); await flush();
  assert.equal(current.calls.opens.length, Fixture.zero); assert.equal(current.calls.writes.length, Fixture.zero);
  await current.advance(); await resuming; assert.equal(current.calls.requests[Fixture.first].address, Fixture.tokenAddress); });
test(Fixture.names.missing, async () => { const current = fixture(); await assert.rejects(current.broker.resume(signal()), failure(library.IntegrationFailureCode.Unauthorized));
  assert.equal(current.calls.requests.length + current.calls.opens.length, Fixture.zero); });
test(Fixture.names.denied, async () => { const current = fixture(record()); current.state.responses.push(pendingResponse(Fixture.denied));
  const resuming = current.broker.resume(signal()); const rejected = assert.rejects(resuming, failure(library.IntegrationFailureCode.Canceled));
  await flush(); await current.advance(); await rejected; assert.equal(current.state.serialized, null); assert.equal(current.calls.bootstrap.length, Fixture.zero); });
test(Fixture.names.expired, async () => { const current = fixture(); current.state.responses.push(startResponse({ expires_in: Fixture.shortLifetimeSeconds }));
  const authorizing = current.broker.authorize(signal()); const rejected = assert.rejects(authorizing, failure(library.IntegrationFailureCode.Unauthorized));
  await flush(); await current.advance(Fixture.shortLifetimeMilliseconds); await rejected; assert.equal(current.calls.requests.length, Fixture.one); assert.equal(current.state.serialized, null); });
test(Fixture.names.failures, async () => { for (const response of [{ status: Fixture.rateLimited, retryAfterSeconds: Fixture.retrySeconds, body: null },
  { status: Fixture.unavailable, body: Fixture.rawFailure }]) { const current = fixture(record()); current.state.responses.push(response);
  const resuming = current.broker.resume(signal()); const rejected = assert.rejects(resuming, failure(response.status === Fixture.rateLimited
    ? library.IntegrationFailureCode.RateLimited : library.IntegrationFailureCode.Network));
  await flush(); await current.advance(); await rejected; assert.equal(current.state.serialized, record()); } });
test(Fixture.names.unsupported, async () => { const current = fixture(); current.state.responses.push(pendingResponse(Fixture.unsupported));
  await assert.rejects(current.broker.authorize(signal()), failure(library.IntegrationFailureCode.Unsupported)); assert.equal(current.calls.opens.length, Fixture.zero); });
test(Fixture.names.invalid, async () => { for (const overrides of [{ verification_uri: Fixture.foreignVerification }, { verification_uri_complete: Fixture.wrongVerification },
  { user_code: Fixture.malformedCode }, { device_code: Fixture.whitespaceCode }, { interval: Fixture.zero }, { expires_in: Fixture.zero }]) {
  const current = fixture(); current.state.responses.push(startResponse(overrides)); await assert.rejects(current.broker.authorize(signal()), failure(library.IntegrationFailureCode.InvalidResponse));
  assert.equal(current.calls.opens.length + current.calls.bootstrap.length, Fixture.zero); } });
test(Fixture.names.malformedRecord, async () => { for (const serialized of [Fixture.malformed, Fixture.padding.repeat(Fixture.recordLimit),
  record({ schemaVersion: Fixture.unknownVersion }), record({ clientIdentifier: Fixture.otherClient }), record({ expiresAtMilliseconds: Fixture.nowMilliseconds })]) {
  const current = fixture(serialized); await assert.rejects(current.broker.resume(signal())); assert.equal(current.calls.requests.length, Fixture.zero); } });
test(Fixture.names.replaceExpired, async () => { const current = fixture(record({ expiresAtMilliseconds: Fixture.nowMilliseconds }));
  const authorizing = current.broker.authorize(signal()); await flush(); assert.equal(current.calls.requests[Fixture.first].address, Fixture.deviceAddress);
  await current.advance(); await authorizing; });
test(Fixture.names.cancellation, async () => { const current = fixture(); const cancellation = new AbortController(); const authorizing = current.broker.authorize(cancellation.signal);
  const rejected = assert.rejects(authorizing, failure(library.IntegrationFailureCode.Canceled)); await flush(); cancellation.abort(); await rejected;
  assert.equal(current.jobs.size, Fixture.zero); assert.notEqual(current.state.serialized, null); });
test(Fixture.names.canceledStart, async () => { const current = fixture(); const request = deferred(); current.state.request = () => request.promise;
  const cancellation = new AbortController(); const authorizing = current.broker.authorize(cancellation.signal);
  const rejected = assert.rejects(authorizing, failure(library.IntegrationFailureCode.Canceled)); await flush(); cancellation.abort(); await rejected;
  request.resolve(startResponse()); await flush(); assert.equal(current.calls.writes.length + current.calls.opens.length, Fixture.zero); });
test(Fixture.names.canceledBootstrap, async () => { const current = fixture(record()); const bootstrap = deferred(); current.state.bootstrap = () => bootstrap.promise;
  const cancellation = new AbortController(); const resuming = current.broker.resume(cancellation.signal);
  const rejected = assert.rejects(resuming, failure(library.IntegrationFailureCode.Canceled)); await flush(); await current.advance();
  cancellation.abort(); await rejected; bootstrap.resolve(current.grant); await flush(); assert.equal(current.state.serialized, null); });
test(Fixture.names.overlap, async () => { const current = fixture(); const cancellation = new AbortController(); const authorizing = current.broker.authorize(cancellation.signal);
  const canceled = assert.rejects(authorizing, failure(library.IntegrationFailureCode.Canceled)); await flush();
  await assert.rejects(current.broker.authorize(signal()), failure(library.IntegrationFailureCode.Backpressure)); cancellation.abort(); await canceled; });
test(Fixture.names.storageWrite, async () => { const current = fixture(); current.state.write = () => { throw new Error(Fixture.rawFailure); };
  await assert.rejects(current.broker.authorize(signal()), failure(library.IntegrationFailureCode.CredentialStorage));
  assert.equal(current.calls.requests.length, Fixture.one); assert.equal(current.calls.opens.length, Fixture.zero); });
test(Fixture.names.consume, async () => { const current = fixture(record()); const clearing = deferred(); current.state.clear = () => clearing.promise;
  const resuming = current.broker.resume(signal()); await flush(); await current.advance(); assert.equal(current.calls.bootstrap.length, Fixture.zero);
  clearing.resolve(); await resuming; assert.deepEqual(current.calls.bootstrap, [Fixture.token]); });
test(Fixture.names.clearFailure, async () => { const current = fixture(record()); current.state.clear = () => { throw new Error(Fixture.rawFailure); };
  const resuming = current.broker.resume(signal()); const rejected = assert.rejects(resuming, failure(library.IntegrationFailureCode.CredentialStorage));
  await flush(); await current.advance(); await rejected; assert.equal(current.calls.bootstrap.length, Fixture.zero); });
test(Fixture.names.browserFailure, async () => { const current = fixture(); current.state.open = () => { throw new Error(Fixture.rawFailure); };
  await assert.rejects(current.broker.authorize(signal()), failure(library.IntegrationFailureCode.Network)); assert.notEqual(current.state.serialized, null); });
test(Fixture.names.observer, async () => { for (const observe of [() => { throw new Error(Fixture.rawFailure); }, () => Promise.reject(new Error(Fixture.rawFailure))]) {
  const current = fixture(); current.state.observe = observe; const authorizing = current.broker.authorize(signal()); await flush(); await current.advance(); await authorizing;
} });
test(Fixture.names.observerCancellation, async () => { const current = fixture(); const cancellation = new AbortController(); current.state.observe = () => cancellation.abort();
  await assert.rejects(current.broker.authorize(cancellation.signal), failure(library.IntegrationFailureCode.Canceled)); assert.equal(current.calls.opens.length, Fixture.zero); });
test(Fixture.names.bootstrapFailure, async () => { const current = fixture(record()); current.state.bootstrap = () => { throw new Error(Fixture.rawFailure); };
  const resuming = current.broker.resume(signal()); const rejected = assert.rejects(resuming, failure(library.IntegrationFailureCode.Network));
  await flush(); await current.advance(); await rejected; assert.equal(current.state.serialized, null); assert.equal(current.calls.bootstrap.length, Fixture.one); });
test(Fixture.names.tokenShape, async () => { for (const overrides of [{ access_token: Fixture.whitespaceToken }, { token_type: Fixture.rawFailure }, { expires_in: Fixture.zero }]) {
  const current = fixture(record()); current.state.responses.push(tokenResponse(overrides)); const resuming = current.broker.resume(signal());
  const rejected = assert.rejects(resuming, failure(library.IntegrationFailureCode.InvalidResponse)); await flush(); await current.advance(); await rejected;
  assert.equal(current.calls.bootstrap.length, Fixture.zero); } });
test(Fixture.names.presence, async () => { const missing = fixture(); assert.equal(await library.hasPendingLibrespotDeviceAuthorization(missing.store, missing.clock, signal()), false);
  const current = fixture(record()); assert.equal(await library.hasPendingLibrespotDeviceAuthorization(current.store, current.clock, signal()), true);
  assert.equal(current.calls.requests.length + current.calls.bootstrap.length, Fixture.zero); });
test(Fixture.names.preCanceled, async () => { const current = fixture(); const cancellation = new AbortController(); cancellation.abort();
  await assert.rejects(current.broker.authorize(cancellation.signal), failure(library.IntegrationFailureCode.Canceled)); assert.equal(current.calls.reads + current.calls.requests.length, Fixture.zero); });
test(Fixture.names.progress, async () => { const current = fixture(record()); current.state.bootstrap = () => {
  assert.deepEqual(current.calls.stages, [library.SpotifyLoginStage.Exchanging]); return current.grant; };
  const resuming = current.broker.resume(signal()); await flush(); await current.advance(); await resuming; });

const DefaultIntervalName = 'An omitted device polling interval uses the protocol default before the first token request';
test(DefaultIntervalName, async () => { const current = fixture(); current.state.responses.push(startResponse({ interval: undefined }));
  const authorizing = current.broker.authorize(signal()); await flush();
  assert.equal(JSON.parse(current.state.serialized).pollingIntervalMilliseconds, Fixture.intervalMilliseconds);
  await current.advance(); await authorizing; });
