import assert from 'node:assert/strict';
import test from 'node:test';
import { library, deferred, flushMicrotasks } from './fixtures.mjs';

const Fixture = Object.freeze({ client: '0123456789abcdef0123456789abcdef', otherClient: 'abcdef0123456789abcdef0123456789',
  redirect: 'streamingservicespotify://callback', scope: 'user-read-private', account: 'spotify-account', otherAccount: 'other-spotify-account',
  applicationAccount: 'app-account', otherApplicationAccount: 'other-app-account', accessToken: 'access-token', refreshToken: 'refresh-token',
  rotatedRefreshToken: 'rotated-refresh-token', otherRefreshToken: 'replacement-refresh-token', schemaVersion: 1,
  nowMilliseconds: 100000, lifetimeSeconds: 3600, successStatus: 200, rejectedStatus: 400, code: 'authorization-code',
  stateCharacter: 's', proofLength: 43, verifierCharacter: 'v', challengeCharacter: 'c', bearer: 'Bearer',
  emptyText: '', initialCount: 0, singleCount: 1, twoCalls: 2, firstPosition: 0, malformedJson: '{',
  oversizedLength: 65537, paddingCharacter: 'x', rawFailure: 'Sensitive storage details', missingVersion: 999,
  stateParameter: 'state', codeParameter: 'code', refreshParameter: 'refresh_token' });
const Names = Object.freeze({ save: 'Login persists only renewable grant configuration and account identity',
  restore: 'Fresh login instances restore through refresh and account verification without opening a browser',
  disposal: 'Memory disposal preserves saved login for the next process lifetime', logout: 'Explicit logout removes saved and in-memory credentials',
  rotation: 'Refresh rotation updates the saved renewable credential', omitted: 'Omitted refresh rotation retains the existing saved token',
  configuration: 'A saved login cannot be restored under a different client configuration',
  identity: 'Restored credentials must verify the saved Spotify account identity',
  rejected: 'A rejected saved grant is erased and cannot become connected',
  transient: 'Transient profile failure retains a freshly rotated token for later restoration',
  malformed: 'Malformed or oversized saved records fail without token exchange',
  publicConfiguration: 'Saved configuration lookup returns immutable public metadata without tokens',
  storageFailure: 'Storage failures cannot establish credentials or expose private error messages',
  cancellation: 'Canceled restore rejects an uncooperative storage read and never installs credentials',
  clearOrdering: 'Logout queued behind an in-flight save leaves no saved credential',
  replacement: 'A newer login survives an older provider logout and stale store writes',
  forgetOther: 'Forgetting another application account does not retire the current account store',
  queueRecovery: 'A failed storage operation does not poison subsequent ownership operations',
  malformedAccount: 'Invalid application account scopes cannot reach persistent storage',
  configurationFailure: 'Public configuration lookup sanitizes storage failures' });
function configuration() { return { clientIdentifier: Fixture.client, redirectAddress: Fixture.redirect, scopes: [Fixture.scope] }; }
function saved(configurationValue = configuration(), refreshToken = Fixture.refreshToken) { return JSON.stringify({ schemaVersion: Fixture.schemaVersion,
  configuration: configurationValue, accountIdentifier: Fixture.account, refreshToken }); }
function signal() { return new AbortController().signal; }
function fixture(serialized = null) {
  const state = { serialized, response: { status: Fixture.successStatus, body: { access_token: Fixture.accessToken,
    refresh_token: Fixture.refreshToken, expires_in: Fixture.lifetimeSeconds, token_type: Fixture.bearer } },
    resolveAccount: async () => Fixture.account };
  const calls = { writes: [], clears: Fixture.initialCount, browser: Fixture.initialCount, requests: [] };
  const store = { read: async () => state.serialized, write: async value => { calls.writes.push(value); state.serialized = value; },
    clear: async () => { calls.clears += Fixture.singleCount; state.serialized = null; } };
  function create(storeValue = store, configurationValue = configuration()) {
    return new library.SpotifyLoginSession({ configuration: configurationValue, credentialStore: storeValue,
      clock: { nowMilliseconds: () => Fixture.nowMilliseconds }, proofKeys: { generate: async () => ({
        state: Fixture.stateCharacter.repeat(Fixture.proofLength), verifier: Fixture.verifierCharacter.repeat(Fixture.proofLength),
        challenge: Fixture.challengeCharacter.repeat(Fixture.proofLength) }) },
      browser: { authorize: async () => { calls.browser += Fixture.singleCount; const callback = new URL(Fixture.redirect);
        callback.searchParams.set(Fixture.stateParameter, Fixture.stateCharacter.repeat(Fixture.proofLength));
        callback.searchParams.set(Fixture.codeParameter, Fixture.code); return callback.toString(); } },
      requests: { execute: async request => { calls.requests.push(request); return state.response; } },
      resolveAccount: (...parameters) => state.resolveAccount(...parameters),
    });
  }
  return { state, calls, store, create };
}
test(Names.save, async () => { const current = fixture(); await current.create().login(signal()); const record = JSON.parse(current.state.serialized);
  assert.equal(record.refreshToken, Fixture.refreshToken); assert.equal(record.accountIdentifier, Fixture.account);
  assert.equal(current.state.serialized.includes(Fixture.accessToken), false); assert.deepEqual(record.configuration, configuration()); });
test(Names.restore, async () => { const current = fixture(saved()); const session = current.create();
  assert.equal((await session.restore(signal())).accountIdentifier, Fixture.account); assert.equal(current.calls.browser, Fixture.initialCount);
  assert.equal(new URLSearchParams(current.calls.requests[Fixture.firstPosition].body).get(Fixture.refreshParameter), Fixture.refreshToken); });
test(Names.disposal, async () => { const current = fixture(); const session = current.create(); await session.login(signal()); session.dispose();
  assert.notEqual(current.state.serialized, null); assert.equal(current.calls.clears, Fixture.initialCount);
  assert.equal((await current.create().restore(signal())).accessToken, Fixture.accessToken); });
test(Names.logout, async () => { const current = fixture(); const session = current.create(); await session.login(signal()); await session.logout();
  assert.equal(current.state.serialized, null); await assert.rejects(session.getCredentials(signal()), { code: library.IntegrationFailureCode.Unauthorized }); });
test(Names.rotation, async () => { const current = fixture(); const session = current.create(); await session.login(signal());
  current.state.response.body.refresh_token = Fixture.rotatedRefreshToken; await session.renewCredentials(signal());
  assert.equal(JSON.parse(current.state.serialized).refreshToken, Fixture.rotatedRefreshToken); });
test(Names.omitted, async () => { const current = fixture(); const session = current.create(); await session.login(signal()); delete current.state.response.body.refresh_token;
  await session.renewCredentials(signal()); assert.equal(JSON.parse(current.state.serialized).refreshToken, Fixture.refreshToken); });
test(Names.configuration, async () => { const current = fixture(saved()); const session = current.create(current.store, { ...configuration(), clientIdentifier: Fixture.otherClient });
  await assert.rejects(session.restore(signal()), { code: library.IntegrationFailureCode.Unauthorized });
  assert.equal(current.calls.requests.length, Fixture.initialCount); assert.equal(current.state.serialized, null); });
test(Names.identity, async () => { const current = fixture(saved()); current.state.resolveAccount = async () => Fixture.otherAccount;
  await assert.rejects(current.create().restore(signal()), { code: library.IntegrationFailureCode.Unauthorized }); assert.equal(current.state.serialized, null); });
test(Names.rejected, async () => { const current = fixture(saved()); current.state.response.status = Fixture.rejectedStatus;
  await assert.rejects(current.create().restore(signal()), { code: library.IntegrationFailureCode.Unauthorized }); assert.equal(current.state.serialized, null); });
test(Names.transient, async () => { const current = fixture(saved()); current.state.response.body.refresh_token = Fixture.rotatedRefreshToken;
  current.state.resolveAccount = async () => { throw new library.IntegrationFailure(library.IntegrationFailureCode.RateLimited); };
  await assert.rejects(current.create().restore(signal()), { code: library.IntegrationFailureCode.RateLimited });
  assert.equal(JSON.parse(current.state.serialized).refreshToken, Fixture.rotatedRefreshToken);
  current.state.resolveAccount = async () => Fixture.account; await current.create().restore(signal()); });
test(Names.malformed, async () => { for (const serialized of [Fixture.malformedJson, Fixture.paddingCharacter.repeat(Fixture.oversizedLength),
  JSON.stringify({ ...JSON.parse(saved()), schemaVersion: Fixture.missingVersion }),
  JSON.stringify({ ...JSON.parse(saved()), refreshToken: Fixture.emptyText }),
  JSON.stringify({ ...JSON.parse(saved()), configuration: {} })]) {
  const current = fixture(serialized); await assert.rejects(current.create().restore(signal()), { code: library.IntegrationFailureCode.InvalidResponse });
  assert.equal(current.calls.requests.length, Fixture.initialCount);
} });
test(Names.publicConfiguration, async () => { const current = fixture(saved()); const result = await library.loadSpotifyLoginConfiguration(current.store, signal());
  assert.deepEqual(result, configuration()); assert.ok(Object.isFrozen(result.scopes)); assert.equal(JSON.stringify(result).includes(Fixture.refreshToken), false); });
test(Names.storageFailure, async () => { const current = fixture(); current.store.write = async () => { throw new Error(Fixture.rawFailure); };
  const session = current.create(); await assert.rejects(session.login(signal()), { message: library.IntegrationFailureCode.Network });
  await assert.rejects(session.getCredentials(signal()), { code: library.IntegrationFailureCode.Unauthorized }); });
test(Names.cancellation, async () => { const current = fixture(saved()); const pending = deferred(); current.store.read = () => pending.promise;
  const cancellation = new AbortController(); const session = current.create(); const restoring = session.restore(cancellation.signal); cancellation.abort();
  await assert.rejects(restoring, { code: library.IntegrationFailureCode.Canceled }); pending.resolve(saved()); await flushMicrotasks();
  await assert.rejects(session.getCredentials(signal()), { code: library.IntegrationFailureCode.Unauthorized }); assert.notEqual(current.state.serialized, null); });
test(Names.clearOrdering, async () => { const current = fixture(); const started = deferred(); const release = deferred();
  const ownership = new library.SpotifyCredentialOwnership({ read: async () => current.state.serialized,
    write: async (account, serialized) => { started.resolve(); await release.promise; current.state.serialized = serialized; },
    clear: async () => { current.state.serialized = null; } });
  const session = current.create(ownership.acquire(Fixture.applicationAccount)); const loggingIn = session.login(signal()); await started.promise;
  const failure = assert.rejects(loggingIn, { code: library.IntegrationFailureCode.Canceled }); const logout = session.logout(); release.resolve();
  await Promise.all([failure, logout]); assert.equal(current.state.serialized, null); });
test(Names.replacement, async () => { const current = fixture(); const ownership = new library.SpotifyCredentialOwnership({ read: async () => current.state.serialized,
  write: async (account, serialized) => { current.state.serialized = serialized; }, clear: async () => { current.state.serialized = null; } });
  const previousStore = ownership.acquire(Fixture.applicationAccount); const previous = current.create(previousStore); await previous.login(signal());
  const next = current.create(ownership.acquire(Fixture.applicationAccount)); current.state.response.body.refresh_token = Fixture.otherRefreshToken; await next.login(signal());
  await previous.logout(); assert.equal(JSON.parse(current.state.serialized).refreshToken, Fixture.otherRefreshToken);
  await assert.rejects(previousStore.write(saved(), signal()), { code: library.IntegrationFailureCode.Superseded }); });
test(Names.forgetOther, async () => { const entries = new Map(); const ownership = new library.SpotifyCredentialOwnership({ read: async account => entries.get(account) ?? null,
  write: async (account, serialized) => { entries.set(account, serialized); }, clear: async account => { entries.delete(account); } });
  const store = ownership.acquire(Fixture.applicationAccount); await store.write(saved(), signal()); await ownership.forget(Fixture.otherApplicationAccount);
  assert.equal(await store.read(signal()), saved()); });
test(Names.queueRecovery, async () => { const current = fixture(); let failed = true;
  const ownership = new library.SpotifyCredentialOwnership({ read: async () => current.state.serialized,
    write: async (account, serialized) => { if (failed) { failed = false; throw new library.IntegrationFailure(library.IntegrationFailureCode.Network); } current.state.serialized = serialized; },
    clear: async () => { current.state.serialized = null; } }); const store = ownership.acquire(Fixture.applicationAccount);
  await assert.rejects(store.write(saved(), signal())); await store.write(saved(), signal()); assert.equal(current.state.serialized, saved()); });
test(Names.malformedAccount, () => { const ownership = new library.SpotifyCredentialOwnership({ read: async () => null, write: async () => undefined, clear: async () => undefined });
  assert.throws(() => ownership.acquire(Fixture.emptyText), { code: library.IntegrationFailureCode.InvalidInput }); });
test(Names.configurationFailure, async () => { const current = fixture(); current.store.read = async () => { throw new Error(Fixture.rawFailure); };
  await assert.rejects(library.loadSpotifyLoginConfiguration(current.store, signal()), { message: library.IntegrationFailureCode.Network }); });

const OwnershipReviewNames = Object.freeze({ currentForget: 'Forgetting the active application account retires its storage lease',
  retired: 'Retired ownership rejects credential reads and writes without deleting saved data',
  lateReplacement: 'A pending older save cannot overwrite the newer provider saved login',
  sanitized: 'Ownership sanitizes unexpected storage errors before returning them' });
test(OwnershipReviewNames.currentForget, async () => { const current = fixture(saved()); const ownership = new library.SpotifyCredentialOwnership({
  read: async () => current.state.serialized, write: async (account, serialized) => { current.state.serialized = serialized; },
  clear: async () => { current.state.serialized = null; } }); const store = ownership.acquire(Fixture.applicationAccount);
  await ownership.forget(Fixture.applicationAccount); assert.equal(current.state.serialized, null);
  await assert.rejects(store.read(signal()), { code: library.IntegrationFailureCode.Superseded }); });
test(OwnershipReviewNames.retired, async () => { const current = fixture(saved()); const ownership = new library.SpotifyCredentialOwnership({
  read: async () => current.state.serialized, write: async (account, serialized) => { current.state.serialized = serialized; }, clear: async () => { current.state.serialized = null; } });
  const store = ownership.acquire(Fixture.applicationAccount); ownership.retire(); await assert.rejects(store.read(signal()), { code: library.IntegrationFailureCode.Superseded });
  await assert.rejects(store.write(saved(), signal()), { code: library.IntegrationFailureCode.Superseded }); assert.notEqual(current.state.serialized, null); });
test(OwnershipReviewNames.lateReplacement, async () => { const current = fixture(); const started = deferred(); const release = deferred(); let writes = Fixture.initialCount;
  const ownership = new library.SpotifyCredentialOwnership({ read: async () => current.state.serialized,
    write: async (account, serialized) => { writes += Fixture.singleCount; if (writes === Fixture.singleCount) { started.resolve(); await release.promise; } current.state.serialized = serialized; },
    clear: async () => { current.state.serialized = null; } });
  const previous = current.create(ownership.acquire(Fixture.applicationAccount)); const first = previous.login(signal()); await started.promise;
  const failure = assert.rejects(first, { code: library.IntegrationFailureCode.Superseded }); const next = current.create(ownership.acquire(Fixture.applicationAccount));
  current.state.response.body.refresh_token = Fixture.otherRefreshToken; const second = next.login(signal()); release.resolve(); await Promise.all([failure, second]);
  assert.equal(JSON.parse(current.state.serialized).refreshToken, Fixture.otherRefreshToken); await previous.logout(); assert.equal(JSON.parse(current.state.serialized).refreshToken, Fixture.otherRefreshToken); });
test(OwnershipReviewNames.sanitized, async () => { const ownership = new library.SpotifyCredentialOwnership({
  read: async () => { throw new Error(Fixture.rawFailure); }, write: async () => undefined, clear: async () => undefined });
  await assert.rejects(ownership.acquire(Fixture.applicationAccount).read(signal()), { message: library.IntegrationFailureCode.CredentialStorage }); });

const ValidationReviewNames = Object.freeze({ scopes: 'Saved login configurations deduplicate scopes and reject embedded whitespace',
  canceledExchange: 'Logout during saved token exchange cannot persist or install a late credential' });
const ScopeReviewFixture = Object.freeze({ invalidScope: 'user-read-private\nother', duplicateScopes: [Fixture.scope, Fixture.scope] });
test(ValidationReviewNames.scopes, async () => { const current = fixture(); const session = current.create(current.store, { ...configuration(), scopes: ScopeReviewFixture.duplicateScopes });
  await session.login(signal()); assert.deepEqual(JSON.parse(current.state.serialized).configuration.scopes, [Fixture.scope]);
  assert.throws(() => current.create(current.store, { ...configuration(), scopes: [ScopeReviewFixture.invalidScope] }), { code: library.IntegrationFailureCode.InvalidInput }); });
test(ValidationReviewNames.canceledExchange, async () => { const current = fixture(saved()); const pending = deferred(); const started = deferred();
  const session = new library.SpotifyLoginSession({ configuration: configuration(), credentialStore: current.store,
    clock: { nowMilliseconds: () => Fixture.nowMilliseconds }, proofKeys: { generate: async () => assert.fail() }, browser: { authorize: async () => assert.fail() },
    requests: { execute: () => { started.resolve(); return pending.promise; } }, resolveAccount: async () => Fixture.account });
  const restoring = session.restore(signal()); await started.promise; const failure = assert.rejects(restoring, { code: library.IntegrationFailureCode.Canceled });
  await session.logout(); pending.resolve(current.state.response); await failure; await flushMicrotasks();
  assert.equal(current.state.serialized, null); assert.equal(current.calls.writes.length, Fixture.initialCount); });

const ClearFailureNames = Object.freeze({ logout: 'Synchronous storage cleanup failures are sanitized after memory logout',
  rejectedGrant: 'Cleanup failure during rejected grant restoration cannot expose private storage errors' });
test(ClearFailureNames.logout, async () => { const current = fixture(); const session = current.create(); await session.login(signal());
  current.store.clear = () => { throw new Error(Fixture.rawFailure); };
  await assert.rejects(session.logout(), { message: library.IntegrationFailureCode.CredentialStorage });
  await assert.rejects(session.getCredentials(signal()), { code: library.IntegrationFailureCode.Unauthorized }); });
test(ClearFailureNames.rejectedGrant, async () => { const current = fixture(saved()); current.state.response.status = Fixture.rejectedStatus;
  current.store.clear = () => { throw new Error(Fixture.rawFailure); };
  await assert.rejects(current.create().restore(signal()), { message: library.IntegrationFailureCode.CredentialStorage }); });
