import assert from 'node:assert/strict';
import test from 'node:test';
import { library, deferred, flushMicrotasks } from './fixtures.mjs';

const Fixture = Object.freeze({ client: '0123456789abcdef0123456789abcdef', otherClient: 'abcdef0123456789abcdef0123456789',
  redirect: 'streamingservicespotify://callback', foreignRedirect: 'other://callback', scope: 'user-read-private',
  account: 'verified-spotify-account', applicationAccount: 'application-account', code: 'authorization-code',
  accessToken: 'issued-access-token', refreshToken: 'issued-refresh-token', bearer: 'Bearer',
  verifierCharacter: 'v', stateCharacter: 's', challengeCharacter: 'c', replacementStateCharacter: 'n',
  proofCharacters: 64, challengeCharacters: 43, invalidProof: 'invalid', schemaVersion: 1, unknownVersion: 2,
  nowMilliseconds: 1000000, maximumAgeMilliseconds: 600000, lifetimeSeconds: 3600, successStatus: 200,
  rejectedStatus: 400, zero: 0, one: 1, two: 2, firstPosition: 0, maximumRecordCharacters: 65536,
  oversizedCharacters: 65537, oversizedCodeCharacters: 4097, paddingCharacter: 'x', malformedJson: '{',
  stateParameter: 'state', codeParameter: 'code', errorParameter: 'error', consentDenied: 'access_denied',
  wrongState: 'unrelated-state', whitespaceCode: 'authorization code', privateFailure: 'Sensitive native store detail',
  recordKeys: Object.freeze(Object.values({ schema: 'schemaVersion', configuration: 'configuration', proof: 'proof', created: 'createdAtMilliseconds' })),
  configurationKeys: Object.freeze(Object.values({ client: 'clientIdentifier', redirect: 'redirectAddress', scopes: 'scopes' })),
  names: Object.freeze({ persistence: 'Pending proof configuration and timestamp are securely saved before the browser opens',
    noSecrets: 'Pending authorization never persists a code access token or refresh token',
    consume: 'A valid callback consumes pending proof before code exchange',
    consumeAcknowledgement: 'Code exchange waits for pending transaction deletion acknowledgement',
    processRestart: 'A new provider resumes pending authorization after disposal without opening a browser or regenerating proof',
    publicConfiguration: 'Public pending configuration loading exposes only immutable configuration',
    missing: 'Resuming without a pending transaction never exchanges code',
    replay: 'A consumed authorization cannot exchange the same callback again',
    staleThenValid: 'A stale callback leaves the current pending transaction available for its valid return',
    invalidCallbacks: 'Invalid duplicated and foreign callbacks preserve pending proof while actual consent denial clears it',
    expired: 'Expired and future pending authorizations are erased without code exchange',
    configuration: 'A pending transaction cannot be resumed under another client configuration',
    malformed: 'Malformed oversized versioned and invalid proof transactions fail closed',
    cancelled: 'Canceling the current browser authorization removes pending proof',
    cancelledPreparation: 'Canceling current proof preparation removes an older owned pending transaction',
    rejected: 'A rejected exchange cannot leave resumable authorization material',
    pendingWriteFailure: 'Failed pending persistence never opens a browser and sanitizes storage details',
    pendingReadFailure: 'Pending authorization read errors are sanitized and cleanup is attempted',
    pendingClearFailure: 'A failed consume does not exchange code and exposes sanitized storage failure',
    progress: 'Successful authorization reports each login stage in order',
    resumedProgress: 'Resumed authorization reports exchange verification and saving without browser authorization',
    callbackFailures: 'Throwing and rejecting progress observers cannot disrupt authorization',
    callbackCancellation: 'Progress observer cancellation prevents later authorization work',
    logout: 'Logout clears both durable grant and pending proof even if one cleanup fails',
    bothLogoutFailures: 'Logout attempts both cleanup operations when both stores throw synchronously',
    disposal: 'Dispose preserves pending proof and ignores a late browser callback',
    supersededCleanup: 'An older failed provider cannot erase a replacement providers pending authorization',
    cancellationRead: 'Canceling resume retires an uncooperative pending read before exchange',
    overlap: 'Concurrent pending resume is rejected without another exchange',
    beforeStart: 'A pre-canceled login does not mutate a previously pending transaction',
    configurationErrors: 'Public pending configuration lookup sanitizes storage failures',
    unsupported: 'Pending resume without an authorization store is explicitly unsupported' }) });

function configuration(overrides = {}) { return { clientIdentifier: Fixture.client, redirectAddress: Fixture.redirect, scopes: [Fixture.scope], ...overrides }; }
function proof(overrides = {}) { return { verifier: Fixture.verifierCharacter.repeat(Fixture.proofCharacters),
  challenge: Fixture.challengeCharacter.repeat(Fixture.challengeCharacters), state: Fixture.stateCharacter.repeat(Fixture.proofCharacters), ...overrides }; }
function pending(overrides = {}) { return JSON.stringify({ schemaVersion: Fixture.schemaVersion, configuration: configuration(), proof: proof(),
  createdAtMilliseconds: Fixture.nowMilliseconds, ...overrides }); }
function callback(overrides = {}) {
  const address = new URL(Fixture.redirect);
  address.searchParams.set(Fixture.stateParameter, proof().state);
  address.searchParams.set(Fixture.codeParameter, Fixture.code);
  for (const [key, value] of Object.entries(overrides)) address.searchParams.set(key, value);
  return address.toString();
}
function signal() { return new AbortController().signal; }
function failure(code) { return value => value instanceof library.IntegrationFailure && value.code === code; }
function fixture(serialized = null) {
  const state = { pending: serialized, grant: null, now: Fixture.nowMilliseconds, callback: callback(),
    pendingRead: null, pendingWrite: null, pendingClear: null, grantClear: null, browser: null,
    response: { status: Fixture.successStatus, body: { access_token: Fixture.accessToken, refresh_token: Fixture.refreshToken,
      token_type: Fixture.bearer, expires_in: Fixture.lifetimeSeconds } } };
  const calls = { writes: [], requests: [], stages: [], browser: Fixture.zero, proofs: Fixture.zero, reads: Fixture.zero,
    pendingClears: Fixture.zero, grantClears: Fixture.zero };
  const authorizationStore = {
    async read() { calls.reads += Fixture.one; return state.pendingRead ? state.pendingRead() : state.pending; },
    async write(serializedValue) { calls.writes.push(serializedValue); if (state.pendingWrite) await state.pendingWrite(serializedValue); state.pending = serializedValue; },
    async clear() { calls.pendingClears += Fixture.one; if (state.pendingClear) await state.pendingClear(); state.pending = null; },
  };
  const credentialStore = { read: async () => state.grant, write: async serializedValue => { state.grant = serializedValue; },
    clear: async () => { calls.grantClears += Fixture.one; if (state.grantClear) await state.grantClear(); state.grant = null; } };
  const dependencies = { configuration: configuration(), authorizationStore, credentialStore,
    proofKeys: { generate: async () => { calls.proofs += Fixture.one; return proof(); } },
    browser: { authorize: async () => { calls.browser += Fixture.one; return state.browser ? state.browser() : state.callback; } },
    requests: { execute: async request => { calls.requests.push(request); return state.response; } },
    resolveAccount: async () => Fixture.account, clock: { nowMilliseconds: () => state.now }, onProgress: stage => { calls.stages.push(stage); } };
  return { state, calls, authorizationStore, credentialStore, dependencies, session: new library.SpotifyLoginSession(dependencies) };
}

test(Fixture.names.persistence, async () => { const current = fixture(); current.state.browser = async () => {
  const record = JSON.parse(current.state.pending); assert.deepEqual(Object.keys(record), Fixture.recordKeys);
  assert.deepEqual(record.configuration, configuration()); assert.deepEqual(record.proof, proof());
  assert.equal(record.createdAtMilliseconds, Fixture.nowMilliseconds); assert.ok(current.state.pending.length <= Fixture.maximumRecordCharacters); return callback(); };
  await current.session.login(signal()); assert.equal(current.calls.writes.length, Fixture.one); });
test(Fixture.names.noSecrets, async () => { const current = fixture(); await current.session.login(signal()); const serialized = current.calls.writes[Fixture.firstPosition];
  for (const secret of [Fixture.code, Fixture.accessToken, Fixture.refreshToken]) assert.equal(serialized.includes(secret), false);
  assert.equal(current.state.pending, null); assert.ok(current.state.grant.includes(Fixture.refreshToken)); });
test(Fixture.names.consume, async () => { const current = fixture(); current.dependencies.requests.execute = async request => {
  assert.equal(current.state.pending, null); current.calls.requests.push(request); return current.state.response; };
  await current.session.login(signal()); assert.equal(current.calls.pendingClears, Fixture.one); });
test(Fixture.names.consumeAcknowledgement, async () => { const current = fixture(); const clearing = deferred(); current.state.pendingClear = () => clearing.promise;
  const loggingIn = current.session.login(signal()); await flushMicrotasks(); assert.equal(current.calls.requests.length, Fixture.zero);
  clearing.resolve(); await loggingIn; assert.equal(current.calls.requests.length, Fixture.one); });
test(Fixture.names.processRestart, async () => { const current = fixture(); const browser = deferred(); current.state.browser = () => browser.promise;
  const loggingIn = current.session.login(signal()); const canceled = assert.rejects(loggingIn, failure(library.IntegrationFailureCode.Canceled));
  await flushMicrotasks(); current.session.dispose(); await canceled; const recorded = current.state.pending;
  const resumed = new library.SpotifyLoginSession(current.dependencies); const credentials = await resumed.resumeAuthorization(callback(), signal());
  assert.equal(credentials.accountIdentifier, Fixture.account); assert.equal(current.calls.browser, Fixture.one); assert.equal(current.calls.proofs, Fixture.one);
  assert.equal(current.state.pending, null); assert.equal(current.calls.writes[Fixture.firstPosition], recorded); browser.resolve(callback()); });
test(Fixture.names.publicConfiguration, async () => { const current = fixture(pending()); const loaded = await library.loadSpotifyAuthorizationConfiguration(current.authorizationStore, signal());
  assert.deepEqual(Object.keys(loaded), Fixture.configurationKeys); assert.deepEqual(loaded, configuration()); assert.ok(Object.isFrozen(loaded)); assert.ok(Object.isFrozen(loaded.scopes));
  assert.equal(current.calls.requests.length, Fixture.zero); });
test(Fixture.names.missing, async () => { const current = fixture(); await assert.rejects(current.session.resumeAuthorization(callback(), signal()), failure(library.IntegrationFailureCode.Unauthorized));
  assert.equal(current.calls.browser, Fixture.zero); assert.equal(current.calls.requests.length, Fixture.zero); });
test(Fixture.names.replay, async () => { const current = fixture(pending()); await current.session.resumeAuthorization(callback(), signal());
  await assert.rejects(current.session.resumeAuthorization(callback(), signal()), failure(library.IntegrationFailureCode.Unauthorized)); assert.equal(current.calls.requests.length, Fixture.one); });
test(Fixture.names.staleThenValid, async () => { const current = fixture(pending());
  await assert.rejects(current.session.resumeAuthorization(callback({ [Fixture.stateParameter]: Fixture.wrongState }), signal()));
  assert.equal(current.state.pending, pending());
  const credentials = await current.session.resumeAuthorization(callback(), signal());
  assert.equal(credentials.accountIdentifier, Fixture.account); assert.equal(current.calls.requests.length, Fixture.one);
  assert.equal(current.state.pending, null); });
test(Fixture.names.invalidCallbacks, async () => { const duplicated = new URL(callback()); duplicated.searchParams.append(Fixture.stateParameter, proof().state);
  const addresses = [callback({ [Fixture.stateParameter]: Fixture.wrongState }), duplicated.toString(), callback().replace(Fixture.redirect, Fixture.foreignRedirect),
    callback({ [Fixture.errorParameter]: Fixture.consentDenied }), callback({ [Fixture.codeParameter]: Fixture.whitespaceCode }),
    callback({ [Fixture.codeParameter]: Fixture.paddingCharacter.repeat(Fixture.oversizedCodeCharacters) })];
  for (const address of addresses) { const current = fixture(pending()); await assert.rejects(current.session.resumeAuthorization(address, signal()));
    assert.equal(current.calls.requests.length, Fixture.zero);
    assert.equal(current.state.pending, new URL(address).searchParams.has(Fixture.errorParameter) ? null : pending()); } });
test(Fixture.names.expired, async () => { for (const createdAtMilliseconds of [Fixture.nowMilliseconds - Fixture.maximumAgeMilliseconds,
  Fixture.nowMilliseconds + Fixture.one]) { const current = fixture(pending({ createdAtMilliseconds }));
  await assert.rejects(current.session.resumeAuthorization(callback(), signal()), failure(library.IntegrationFailureCode.Unauthorized)); assert.equal(current.calls.requests.length, Fixture.zero); assert.equal(current.state.pending, null); } });
test(Fixture.names.configuration, async () => { const current = fixture(pending({ configuration: configuration({ clientIdentifier: Fixture.otherClient }) }));
  await assert.rejects(current.session.resumeAuthorization(callback(), signal()), failure(library.IntegrationFailureCode.Unauthorized)); assert.equal(current.state.pending, null); });
test(Fixture.names.malformed, async () => { for (const record of [Fixture.malformedJson, Fixture.paddingCharacter.repeat(Fixture.oversizedCharacters),
  pending({ schemaVersion: Fixture.unknownVersion }), pending({ proof: proof({ verifier: Fixture.invalidProof }) }), pending({ createdAtMilliseconds: Number.NaN })]) {
  const current = fixture(record); await assert.rejects(current.session.resumeAuthorization(callback(), signal()), failure(library.IntegrationFailureCode.InvalidResponse));
  assert.equal(current.calls.requests.length, Fixture.zero); assert.equal(current.state.pending, null); } });
test(Fixture.names.cancelled, async () => { const current = fixture(); const browser = deferred(); const cancellation = new AbortController(); current.state.browser = () => browser.promise;
  const loggingIn = current.session.login(cancellation.signal); const rejected = assert.rejects(loggingIn, failure(library.IntegrationFailureCode.Canceled)); await flushMicrotasks(); cancellation.abort(); await rejected;
  assert.equal(current.state.pending, null); browser.resolve(callback()); assert.equal(current.calls.requests.length, Fixture.zero); });
test(Fixture.names.cancelledPreparation, async () => { const current = fixture(pending()); const generating = deferred(); current.dependencies.proofKeys.generate = () => generating.promise; const cancellation = new AbortController();
  const loggingIn = current.session.login(cancellation.signal); const rejected = assert.rejects(loggingIn, failure(library.IntegrationFailureCode.Canceled)); cancellation.abort(); await rejected;
  assert.equal(current.state.pending, null); generating.resolve(proof()); });
test(Fixture.names.rejected, async () => { const current = fixture(pending()); current.state.response.status = Fixture.rejectedStatus;
  await assert.rejects(current.session.resumeAuthorization(callback(), signal()), failure(library.IntegrationFailureCode.Unauthorized)); assert.equal(current.state.pending, null); });
test(Fixture.names.pendingWriteFailure, async () => { const current = fixture(); current.state.pendingWrite = async () => { throw new Error(Fixture.privateFailure); };
  await assert.rejects(current.session.login(signal()), failure(library.IntegrationFailureCode.CredentialStorage)); assert.equal(current.calls.browser, Fixture.zero); assert.equal(current.state.pending, null); });
test(Fixture.names.pendingReadFailure, async () => { const current = fixture(pending()); current.state.pendingRead = async () => { throw new Error(Fixture.privateFailure); };
  await assert.rejects(current.session.resumeAuthorization(callback(), signal()), failure(library.IntegrationFailureCode.CredentialStorage)); assert.equal(current.calls.pendingClears, Fixture.one); });
test(Fixture.names.pendingClearFailure, async () => { const current = fixture(pending()); current.state.pendingClear = async () => { throw new Error(Fixture.privateFailure); };
  await assert.rejects(current.session.resumeAuthorization(callback(), signal()), failure(library.IntegrationFailureCode.CredentialStorage)); assert.equal(current.calls.requests.length, Fixture.zero); });
test(Fixture.names.progress, async () => { const current = fixture(); await current.session.login(signal()); assert.deepEqual(current.calls.stages, [library.SpotifyLoginStage.Preparing,
  library.SpotifyLoginStage.Authorizing, library.SpotifyLoginStage.Exchanging, library.SpotifyLoginStage.Verifying, library.SpotifyLoginStage.Saving, library.SpotifyLoginStage.Complete]); });
test(Fixture.names.resumedProgress, async () => { const current = fixture(pending()); await current.session.resumeAuthorization(callback(), signal()); assert.deepEqual(current.calls.stages,
  [library.SpotifyLoginStage.Preparing, library.SpotifyLoginStage.Exchanging, library.SpotifyLoginStage.Verifying, library.SpotifyLoginStage.Saving, library.SpotifyLoginStage.Complete]); });
test(Fixture.names.callbackFailures, async () => { for (const asynchronous of [false, true]) { const current = fixture(); current.dependencies.onProgress = () => {
  if (asynchronous) return Promise.reject(new Error(Fixture.privateFailure)); throw new Error(Fixture.privateFailure); };
  const credentials = await current.session.login(signal()); await flushMicrotasks(); assert.equal(credentials.accountIdentifier, Fixture.account); } });
test(Fixture.names.callbackCancellation, async () => { const current = fixture(pending()); const cancellation = new AbortController(); current.dependencies.onProgress = () => cancellation.abort();
  await assert.rejects(current.session.login(cancellation.signal), failure(library.IntegrationFailureCode.Canceled)); assert.equal(current.calls.proofs, Fixture.zero); assert.equal(current.state.pending, null); });
test(Fixture.names.logout, async () => { const current = fixture(); await current.session.login(signal()); current.state.grantClear = async () => { throw new Error(Fixture.privateFailure); };
  const loggingOut = current.session.logout(); await assert.rejects(current.session.getCredentials(signal()), failure(library.IntegrationFailureCode.Unauthorized));
  await assert.rejects(loggingOut, failure(library.IntegrationFailureCode.CredentialStorage)); assert.equal(current.calls.grantClears, Fixture.one); assert.equal(current.calls.pendingClears, Fixture.two); });
test(Fixture.names.bothLogoutFailures, async () => { const current = fixture(); current.authorizationStore.clear = () => { current.calls.pendingClears += Fixture.one; throw new Error(Fixture.privateFailure); };
  current.credentialStore.clear = () => { current.calls.grantClears += Fixture.one; throw new Error(Fixture.privateFailure); };
  await assert.rejects(current.session.logout(), failure(library.IntegrationFailureCode.CredentialStorage)); assert.equal(current.calls.pendingClears, Fixture.one); assert.equal(current.calls.grantClears, Fixture.one); });
test(Fixture.names.disposal, async () => { const current = fixture(); const browser = deferred(); current.state.browser = () => browser.promise; const loggingIn = current.session.login(signal());
  const canceled = assert.rejects(loggingIn, failure(library.IntegrationFailureCode.Canceled)); await flushMicrotasks(); const saved = current.state.pending; current.session.dispose(); await canceled;
  browser.resolve(callback()); await flushMicrotasks(); assert.equal(current.state.pending, saved); assert.equal(current.calls.requests.length, Fixture.zero); });
test(Fixture.names.supersededCleanup, async () => { const current = fixture(); const ownership = new library.SpotifyCredentialOwnership({ read: async () => current.state.pending,
  write: async (_account, serialized) => { current.state.pending = serialized; }, clear: async () => { current.state.pending = null; } });
  current.dependencies.authorizationStore = ownership.acquire(Fixture.applicationAccount); const browser = deferred(); current.state.browser = () => browser.promise;
  const loggingIn = current.session.login(signal()); const rejected = assert.rejects(loggingIn, failure(library.IntegrationFailureCode.Canceled)); await flushMicrotasks();
  const replacementStore = ownership.acquire(Fixture.applicationAccount); const replacement = pending({ proof: proof({ state: Fixture.replacementStateCharacter.repeat(Fixture.proofCharacters) }) });
  await replacementStore.write(replacement, signal()); browser.reject(new library.IntegrationFailure(library.IntegrationFailureCode.Canceled)); await rejected;
  assert.equal(current.state.pending, replacement); });
test(Fixture.names.cancellationRead, async () => { const current = fixture(pending()); const reading = deferred(); current.state.pendingRead = () => reading.promise; const cancellation = new AbortController();
  const resuming = current.session.resumeAuthorization(callback(), cancellation.signal); const rejected = assert.rejects(resuming, failure(library.IntegrationFailureCode.Canceled));
  await flushMicrotasks(); cancellation.abort(); await rejected; reading.resolve(pending()); assert.equal(current.calls.requests.length, Fixture.zero); assert.equal(current.state.pending, null); });
test(Fixture.names.overlap, async () => { const current = fixture(pending()); const reading = deferred(); current.state.pendingRead = () => reading.promise;
  const first = current.session.resumeAuthorization(callback(), signal()); await assert.rejects(current.session.resumeAuthorization(callback(), signal()), failure(library.IntegrationFailureCode.Backpressure));
  reading.resolve(pending()); await first; assert.equal(current.calls.requests.length, Fixture.one); });
test(Fixture.names.beforeStart, async () => { const current = fixture(pending()); const previous = current.state.pending; const cancellation = new AbortController(); cancellation.abort();
  await assert.rejects(current.session.login(cancellation.signal), failure(library.IntegrationFailureCode.Canceled)); assert.equal(current.state.pending, previous); assert.equal(current.calls.pendingClears, Fixture.zero); });
test(Fixture.names.configurationErrors, async () => { const current = fixture(); current.state.pendingRead = async () => { throw new Error(Fixture.privateFailure); };
  await assert.rejects(library.loadSpotifyAuthorizationConfiguration(current.authorizationStore, signal()), failure(library.IntegrationFailureCode.CredentialStorage)); });
test(Fixture.names.unsupported, async () => { const current = fixture(); const dependencies = { ...current.dependencies }; delete dependencies.authorizationStore;
  await assert.rejects(new library.SpotifyLoginSession(dependencies).resumeAuthorization(callback(), signal()), failure(library.IntegrationFailureCode.Unsupported)); });
