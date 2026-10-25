import assert from 'node:assert/strict';
import test from 'node:test';
import { library, deferred, flushMicrotasks } from './fixtures.mjs';

const Fixture = Object.freeze({ username: 'listener@example.test', normalizedUsername: 'listener@example.test', paddedUsername: ' listener@example.test ',
  password: 'synthetic-password', replacementPassword: 'replacement-password', account: 'canonical-listener', otherAccount: 'other-listener',
  token: 'synthetic-access-token', replacementToken: 'replacement-access-token', stored: 'opaque-reusable-credential', replacementStored: 'rotated-opaque-credential',
  rawFailure: 'Private transport or native storage detail', schemaVersion: 1, unknownVersion: 2,
  nowMilliseconds: 100000, lifetimeMilliseconds: 3600000, expirationMarginMilliseconds: 30000, maximumLifetimeMilliseconds: 86400000,
  maximumUsernameCharacters: 512, maximumPasswordCharacters: 4096, maximumAccountCharacters: 512, maximumStoredCharacters: 65536,
  maximumTokenCharacters: 16384, maximumRecordCharacters: 524288, oversizedIncrement: 1, padding: 'x', malformedJson: '{', whitespace: ' ',
  zero: 0, one: 1, two: 2, firstPosition: 0,
  recordKeys: Object.freeze(Object.values({ schema: 'schemaVersion', account: 'accountIdentifier', credential: 'storedCredential' })),
  credentialKeys: Object.freeze(Object.values({ account: 'accountIdentifier', token: 'accessToken', expiry: 'expiresAtMilliseconds' })),
  stages: Object.freeze(Object.values({ preparing: library.SpotifyLoginStage.Preparing, authorizing: library.SpotifyLoginStage.Authorizing,
    verifying: library.SpotifyLoginStage.Verifying, saving: library.SpotifyLoginStage.Saving, complete: library.SpotifyLoginStage.Complete })),
  names: Object.freeze({ login: 'Librespot login uses injected native authentication and publishes its canonical account',
    durableShape: 'Durable Librespot login contains only its version canonical account and reusable credential',
    acknowledgement: 'Credentials remain unavailable until durable Librespot saving acknowledges',
    passwordOnce: 'The password is consumed once and is never replayed for an established provider',
    capture: 'Login captures immutable input before caller mutation and trims only the username',
    restore: 'Restore uses reusable credentials without a password and persists rotation before returning',
    presence: 'Saved Librespot lookup reveals only presence and does not invoke authentication',
    missing: 'Missing saved Librespot login fails without native authentication',
    malformed: 'Malformed oversized versioned and invalid saved Librespot records are removed before native authentication',
    grant: 'Malformed expired oversized and invalid native grants cannot publish credentials or write storage',
    automaticRenewal: 'Credentials renew at the configured expiration margin using the reusable native credential',
    singleFlight: 'Concurrent renewal shares native work while one canceled caller cannot cancel another',
    rejectedRenewal: 'Rejected native renewal erases the saved session and retires current credentials',
    changedRestore: 'Restoration rejects another canonical account before persisting its grant',
    changedRenewal: 'Renewal cannot change the authenticated canonical account',
    disposal: 'Dispose cancels pending native login promptly and fences late credentials without erasing prior saved state',
    cancellation: 'Caller cancellation reaches native authentication and ignores an uncooperative late grant',
    logoutWrite: 'Logout during saving retires native results and leaves the acknowledged store erased',
    logoutAcknowledgement: 'Logout waits for durable deletion while retiring credentials immediately',
    canceledRead: 'Canceled restoration cannot authenticate after a late native-store read',
    writeFailure: 'Private storage write errors are sanitized and credentials stay unavailable',
    nativeFailure: 'Private native authentication errors are sanitized without publishing credentials',
    readFailure: 'Private storage read errors retain the saved record for a later restoration',
    clearFailure: 'Failed saved-session deletion is explicit while in-memory credentials remain retired',
    transientRestore: 'Transient native restoration failure preserves reusable credentials for retry',
    deniedRestore: 'Rejected saved native authentication erases unusable reusable credentials',
    disposed: 'A disposed provider preserves saved state and cannot start another login or restoration',
    overlap: 'Concurrent login and restore are rejected without duplicate native authentication',
    canceledBefore: 'A pre-canceled login preserves its one-use input for an uncanceled attempt',
    ownership: 'A retired account store lease cannot persist a late Librespot login over a newer provider',
    observers: 'Throwing and rejecting progress observers cannot interrupt Librespot login',
    observerCancellation: 'Progress observer cancellation prevents native authentication from starting',
    progress: 'Successful Librespot login reports only sanitized login stages in order',
    presenceFailures: 'Saved-presence lookup sanitizes storage errors and rejects malformed data',
    invalidInput: 'Invalid native login inputs are rejected before any native work',
    renewalStorage: 'A failed rotated-grant save cannot publish its new access token',
    expiredDispose: 'Dispose during shared renewal rejects all active callers and ignores late results',
    renewalOverlap: 'Restoration cannot replace an in-progress shared native renewal',
    nativeCredential: 'Native connection handoff exposes only a frozen account and opaque reusable credential',
    nativeBeforeSave: 'Native connection credentials remain unavailable until durable login acknowledgement',
    nativeRenewal: 'Native connection handoff waits for renewal and returns the acknowledged rotated record',
    nativeRetirement: 'Logout disposal and canceled native handoffs cannot expose a retired credential',
    nativeLateRenewal: 'Disposal during native handoff renewal fences a late reusable record' }) });

function signal() { return new AbortController().signal; }
function input(overrides = {}) { return { username: Fixture.username, password: Fixture.password, ...overrides }; }
function grant(overrides = {}) { return { accountIdentifier: Fixture.account, accessToken: Fixture.token,
  expiresAtMilliseconds: Fixture.nowMilliseconds + Fixture.lifetimeMilliseconds, storedCredential: Fixture.stored, ...overrides }; }
function saved(overrides = {}) { return JSON.stringify({ schemaVersion: Fixture.schemaVersion, accountIdentifier: Fixture.account,
  storedCredential: Fixture.stored, ...overrides }); }
function failure(code) { return value => value instanceof library.IntegrationFailure && value.code === code && !value.message.includes(Fixture.rawFailure); }
function fixture(serialized = null, loginInput = input()) {
  const state = { serialized, nowMilliseconds: Fixture.nowMilliseconds, grant: grant(), login: null, restore: null, read: null, write: null, clear: null };
  const calls = { inputs: [], restores: [], writes: [], attemptedWrites: [], stages: [], nativeSignals: [], clears: Fixture.zero, reads: Fixture.zero };
  const store = {
    async read(cancellation) { calls.reads += Fixture.one; return state.read ? state.read(cancellation) : state.serialized; },
    async write(serializedValue, cancellation) { calls.attemptedWrites.push(serializedValue); if (state.write) await state.write(serializedValue, cancellation);
      if (cancellation.aborted) throw new library.IntegrationFailure(library.IntegrationFailureCode.Canceled);
      calls.writes.push(serializedValue); state.serialized = serializedValue; },
    async clear() { calls.clears += Fixture.one; if (state.clear) await state.clear(); state.serialized = null; },
  };
  const authentication = {
    async login(loginInputValue, cancellation) { calls.inputs.push(loginInputValue); calls.nativeSignals.push(cancellation);
      return state.login ? state.login(loginInputValue, cancellation) : state.grant; },
    async restore(storedCredential, cancellation) { calls.restores.push(storedCredential); calls.nativeSignals.push(cancellation);
      return state.restore ? state.restore(storedCredential, cancellation) : state.grant; },
  };
  const dependencies = { authentication, credentialStore: store, clock: { nowMilliseconds: () => state.nowMilliseconds },
    onProgress: stage => { calls.stages.push(stage); } };
  return { state, calls, store, authentication, dependencies, session: new library.LibrespotLoginSession(dependencies, loginInput) };
}

test(Fixture.names.nativeCredential, async () => {
  const current = fixture(); await current.session.login(signal());
  const native = await current.session.getNativeSessionCredential(signal());
  assert.deepEqual(native, { accountIdentifier: Fixture.account, storedCredential: Fixture.stored });
  assert.ok(Object.isFrozen(native)); assert.equal(JSON.stringify(native).includes(Fixture.token), false);
  assert.deepEqual(Object.keys(await current.session.getCredentials(signal())), Fixture.credentialKeys);
});
test(Fixture.names.nativeBeforeSave, async () => {
  const current = fixture(); const writing = deferred(); current.state.write = () => writing.promise;
  const loggingIn = current.session.login(signal()); await flushMicrotasks();
  await assert.rejects(current.session.getNativeSessionCredential(signal()), failure(library.IntegrationFailureCode.Unauthorized));
  writing.resolve(); await loggingIn;
  assert.equal((await current.session.getNativeSessionCredential(signal())).storedCredential, Fixture.stored);
});
test(Fixture.names.nativeRenewal, async () => {
  const current = fixture(); await current.session.login(signal());
  current.state.nowMilliseconds += Fixture.lifetimeMilliseconds;
  current.state.grant = grant({ storedCredential: Fixture.replacementStored, accessToken: Fixture.replacementToken,
    expiresAtMilliseconds: current.state.nowMilliseconds + Fixture.lifetimeMilliseconds });
  const native = await current.session.getNativeSessionCredential(signal());
  assert.equal(native.storedCredential, Fixture.replacementStored);
  assert.equal(current.calls.restores.length, Fixture.one);
});
test(Fixture.names.nativeRetirement, async () => {
  for (const dispose of [false, true]) {
    const current = fixture(); await current.session.login(signal());
    const cancellation = new AbortController(); cancellation.abort();
    await assert.rejects(current.session.getNativeSessionCredential(cancellation.signal), failure(library.IntegrationFailureCode.Canceled));
    if (dispose) current.session.dispose(); else await current.session.logout();
    await assert.rejects(current.session.getNativeSessionCredential(signal()), failure(library.IntegrationFailureCode.Unauthorized));
  }
});
test(Fixture.names.nativeLateRenewal, async () => {
  const current = fixture(); await current.session.login(signal());
  current.state.nowMilliseconds += Fixture.lifetimeMilliseconds;
  const restoring = deferred(); current.state.restore = () => restoring.promise;
  const handoff = current.session.getNativeSessionCredential(signal()); await flushMicrotasks();
  current.session.dispose();
  restoring.resolve(grant({ storedCredential: Fixture.replacementStored,
    expiresAtMilliseconds: current.state.nowMilliseconds + Fixture.lifetimeMilliseconds }));
  await assert.rejects(handoff, failure(library.IntegrationFailureCode.Canceled));
});

test(Fixture.names.login, async () => { const current = fixture(); const credentials = await current.session.login(signal());
  assert.equal(current.session.authenticationMethod, library.SpotifyLoginMethod.Librespot); assert.equal(credentials.accountIdentifier, Fixture.account);
  assert.deepEqual(current.calls.inputs, [input()]); assert.equal(current.calls.restores.length, Fixture.zero);
  assert.deepEqual(Object.keys(credentials), Fixture.credentialKeys); assert.ok(Object.isFrozen(credentials)); });
test(Fixture.names.durableShape, async () => { const current = fixture(); await current.session.login(signal());
  assert.deepEqual(Object.keys(JSON.parse(current.state.serialized)), Fixture.recordKeys); assert.equal(current.state.serialized, saved());
  for (const secret of [Fixture.username, Fixture.password, Fixture.token]) assert.equal(current.state.serialized.includes(secret), false); });
test(Fixture.names.acknowledgement, async () => { const current = fixture(); const writing = deferred(); current.state.write = () => writing.promise;
  const loggingIn = current.session.login(signal()); await flushMicrotasks(); assert.equal(current.calls.attemptedWrites.length, Fixture.one);
  await assert.rejects(current.session.getCredentials(signal()), failure(library.IntegrationFailureCode.Unauthorized)); writing.resolve();
  assert.equal((await loggingIn).accessToken, Fixture.token); });
test(Fixture.names.passwordOnce, async () => { const current = fixture(); await current.session.login(signal());
  await assert.rejects(current.session.login(signal()), failure(library.IntegrationFailureCode.Unauthorized));
  assert.equal(current.calls.inputs.length, Fixture.one); assert.equal((await current.session.getCredentials(signal())).accessToken, Fixture.token); });
test(Fixture.names.capture, async () => { const loginInput = input({ username: Fixture.paddedUsername }); const current = fixture(null, loginInput);
  loginInput.password = Fixture.replacementPassword; await current.session.login(signal());
  assert.deepEqual(current.calls.inputs, [input({ username: Fixture.normalizedUsername })]); assert.ok(Object.isFrozen(current.calls.inputs[Fixture.firstPosition])); });
test(Fixture.names.restore, async () => { const current = fixture(saved(), undefined);
  current.state.grant = grant({ storedCredential: Fixture.replacementStored, accessToken: Fixture.replacementToken });
  const credentials = await current.session.restore(signal()); assert.equal(credentials.accessToken, Fixture.replacementToken);
  assert.deepEqual(current.calls.restores, [Fixture.stored]); assert.equal(current.calls.inputs.length, Fixture.zero);
  assert.equal(JSON.parse(current.state.serialized).storedCredential, Fixture.replacementStored); });
test(Fixture.names.presence, async () => { const current = fixture(saved()); assert.equal(await library.hasSavedLibrespotLogin(current.store, signal()), true);
  current.state.serialized = null; assert.equal(await library.hasSavedLibrespotLogin(current.store, signal()), false);
  assert.equal(current.calls.inputs.length + current.calls.restores.length, Fixture.zero); });
test(Fixture.names.missing, async () => { const current = fixture(); await assert.rejects(current.session.restore(signal()), failure(library.IntegrationFailureCode.Unauthorized));
  assert.equal(current.calls.restores.length, Fixture.zero); });
test(Fixture.names.malformed, async () => { for (const serialized of [Fixture.malformedJson, saved({ schemaVersion: Fixture.unknownVersion }),
  saved({ accountIdentifier: Fixture.whitespace }), saved({ storedCredential: Fixture.whitespace }),
  saved({ storedCredential: Fixture.padding.repeat(Fixture.maximumStoredCharacters + Fixture.oversizedIncrement) }),
  Fixture.padding.repeat(Fixture.maximumRecordCharacters + Fixture.oversizedIncrement)]) {
  const current = fixture(serialized); await assert.rejects(current.session.restore(signal()), failure(library.IntegrationFailureCode.InvalidResponse));
  assert.equal(current.calls.restores.length, Fixture.zero); assert.equal(current.state.serialized, null);
} });
test(Fixture.names.grant, async () => { for (const invalid of [null, grant({ accessToken: Fixture.whitespace }),
  grant({ accountIdentifier: Fixture.whitespace }), grant({ accountIdentifier: Fixture.padding.repeat(Fixture.maximumAccountCharacters + Fixture.oversizedIncrement) }),
  grant({ storedCredential: Fixture.whitespace }), grant({ expiresAtMilliseconds: Fixture.nowMilliseconds }),
  grant({ expiresAtMilliseconds: Fixture.nowMilliseconds + Fixture.maximumLifetimeMilliseconds + Fixture.oversizedIncrement }),
  grant({ accessToken: Fixture.padding.repeat(Fixture.maximumTokenCharacters + Fixture.oversizedIncrement) }),
  grant({ storedCredential: Fixture.padding.repeat(Fixture.maximumStoredCharacters + Fixture.oversizedIncrement) })]) {
  const current = fixture(); current.state.grant = invalid; await assert.rejects(current.session.login(signal()), failure(library.IntegrationFailureCode.InvalidResponse));
  assert.equal(current.calls.writes.length, Fixture.zero); await assert.rejects(current.session.getCredentials(signal()), failure(library.IntegrationFailureCode.Unauthorized));
} });
test(Fixture.names.automaticRenewal, async () => { const current = fixture(); await current.session.login(signal());
  current.state.nowMilliseconds = Fixture.nowMilliseconds + Fixture.lifetimeMilliseconds - Fixture.expirationMarginMilliseconds;
  current.state.grant = grant({ accessToken: Fixture.replacementToken, expiresAtMilliseconds: current.state.nowMilliseconds + Fixture.lifetimeMilliseconds });
  assert.equal((await current.session.getCredentials(signal())).accessToken, Fixture.replacementToken); assert.deepEqual(current.calls.restores, [Fixture.stored]); });
test(Fixture.names.singleFlight, async () => { const current = fixture(); await current.session.login(signal()); const renewing = deferred();
  current.state.restore = () => renewing.promise; const cancellation = new AbortController(); const first = current.session.renewCredentials(cancellation.signal);
  const canceled = assert.rejects(first, failure(library.IntegrationFailureCode.Canceled)); const second = current.session.renewCredentials(signal()); await flushMicrotasks();
  assert.equal(current.calls.restores.length, Fixture.one); cancellation.abort(); await canceled;
  assert.equal(current.calls.nativeSignals[current.calls.nativeSignals.length - Fixture.one].aborted, false);
  renewing.resolve(grant({ accessToken: Fixture.replacementToken, storedCredential: Fixture.replacementStored })); assert.equal((await second).accessToken, Fixture.replacementToken);
  assert.equal(JSON.parse(current.state.serialized).storedCredential, Fixture.replacementStored); });
test(Fixture.names.rejectedRenewal, async () => { const current = fixture(); await current.session.login(signal());
  current.state.restore = async () => { throw new library.IntegrationFailure(library.IntegrationFailureCode.Unauthorized); };
  await assert.rejects(current.session.renewCredentials(signal()), failure(library.IntegrationFailureCode.Unauthorized));
  assert.equal(current.state.serialized, null); await assert.rejects(current.session.getCredentials(signal()), failure(library.IntegrationFailureCode.Unauthorized)); });
test(Fixture.names.changedRestore, async () => { const current = fixture(saved()); current.state.grant = grant({ accountIdentifier: Fixture.otherAccount });
  await assert.rejects(current.session.restore(signal()), failure(library.IntegrationFailureCode.Unauthorized));
  assert.equal(current.calls.writes.length, Fixture.zero); assert.equal(current.state.serialized, null); });
test(Fixture.names.changedRenewal, async () => { const current = fixture(); await current.session.login(signal()); current.state.grant = grant({ accountIdentifier: Fixture.otherAccount });
  await assert.rejects(current.session.renewCredentials(signal()), failure(library.IntegrationFailureCode.Unauthorized)); assert.equal(current.state.serialized, null); });
test(Fixture.names.disposal, async () => { const current = fixture(saved()); const pending = deferred(); current.state.login = () => pending.promise;
  const loggingIn = current.session.login(signal()); const canceled = assert.rejects(loggingIn, failure(library.IntegrationFailureCode.Canceled));
  await flushMicrotasks(); current.session.dispose(); await canceled; pending.resolve(grant()); await flushMicrotasks();
  assert.equal(current.calls.writes.length, Fixture.zero); assert.equal(current.state.serialized, saved()); });
test(Fixture.names.cancellation, async () => { const current = fixture(); const pending = deferred(); current.state.login = () => pending.promise;
  const cancellation = new AbortController(); const loggingIn = current.session.login(cancellation.signal);
  const canceled = assert.rejects(loggingIn, failure(library.IntegrationFailureCode.Canceled)); await flushMicrotasks(); cancellation.abort(); await canceled;
  assert.equal(current.calls.nativeSignals[Fixture.firstPosition].aborted, true); pending.resolve(grant()); await flushMicrotasks(); assert.equal(current.calls.writes.length, Fixture.zero); });
test(Fixture.names.logoutWrite, async () => { const current = fixture(); const writing = deferred(); current.state.write = () => writing.promise;
  const loggingIn = current.session.login(signal()); const canceled = assert.rejects(loggingIn, failure(library.IntegrationFailureCode.Canceled));
  await flushMicrotasks(); await current.session.logout(); await canceled; writing.resolve(); await flushMicrotasks();
  assert.equal(current.state.serialized, null); assert.equal(current.calls.writes.length, Fixture.zero); });
test(Fixture.names.logoutAcknowledgement, async () => { const current = fixture(); await current.session.login(signal()); const clearing = deferred(); current.state.clear = () => clearing.promise;
  let finished = false; const loggingOut = current.session.logout().then(() => { finished = true; }); await flushMicrotasks(); assert.equal(finished, false);
  await assert.rejects(current.session.getCredentials(signal()), failure(library.IntegrationFailureCode.Unauthorized)); clearing.resolve(); await loggingOut; assert.equal(current.state.serialized, null); });
test(Fixture.names.canceledRead, async () => { const current = fixture(saved()); const reading = deferred(); current.state.read = () => reading.promise;
  const cancellation = new AbortController(); const restoring = current.session.restore(cancellation.signal);
  const canceled = assert.rejects(restoring, failure(library.IntegrationFailureCode.Canceled)); await flushMicrotasks(); cancellation.abort(); await canceled;
  reading.resolve(saved()); await flushMicrotasks(); assert.equal(current.calls.restores.length, Fixture.zero); });
test(Fixture.names.writeFailure, async () => { const current = fixture(); current.state.write = async () => { throw new Error(Fixture.rawFailure); };
  await assert.rejects(current.session.login(signal()), failure(library.IntegrationFailureCode.CredentialStorage));
  await assert.rejects(current.session.getCredentials(signal()), failure(library.IntegrationFailureCode.Unauthorized)); });
test(Fixture.names.nativeFailure, async () => { const current = fixture(); current.state.login = async () => { throw new Error(Fixture.rawFailure); };
  await assert.rejects(current.session.login(signal()), failure(library.IntegrationFailureCode.Network)); assert.equal(current.calls.writes.length, Fixture.zero); });
test(Fixture.names.readFailure, async () => { const current = fixture(saved()); current.state.read = async () => { throw new Error(Fixture.rawFailure); };
  await assert.rejects(current.session.restore(signal()), failure(library.IntegrationFailureCode.CredentialStorage)); assert.equal(current.state.serialized, saved()); });
test(Fixture.names.clearFailure, async () => { const current = fixture(); await current.session.login(signal()); current.state.clear = async () => { throw new Error(Fixture.rawFailure); };
  await assert.rejects(current.session.logout(), failure(library.IntegrationFailureCode.CredentialStorage));
  await assert.rejects(current.session.getCredentials(signal()), failure(library.IntegrationFailureCode.Unauthorized)); });
test(Fixture.names.transientRestore, async () => { const current = fixture(saved()); current.state.restore = async () => { throw new Error(Fixture.rawFailure); };
  await assert.rejects(current.session.restore(signal()), failure(library.IntegrationFailureCode.Network)); assert.equal(current.state.serialized, saved());
  current.state.restore = null; assert.equal((await current.session.restore(signal())).accountIdentifier, Fixture.account); });
test(Fixture.names.deniedRestore, async () => { const current = fixture(saved()); current.state.restore = async () => { throw new library.IntegrationFailure(library.IntegrationFailureCode.Unauthorized); };
  await assert.rejects(current.session.restore(signal()), failure(library.IntegrationFailureCode.Unauthorized)); assert.equal(current.state.serialized, null); });
test(Fixture.names.disposed, async () => { const current = fixture(saved()); current.session.dispose();
  await assert.rejects(current.session.login(signal()), failure(library.IntegrationFailureCode.Unauthorized));
  await assert.rejects(current.session.restore(signal()), failure(library.IntegrationFailureCode.Unauthorized));
  assert.equal(current.state.serialized, saved()); assert.equal(current.calls.inputs.length + current.calls.restores.length, Fixture.zero); });
test(Fixture.names.overlap, async () => { const current = fixture(); const pending = deferred(); current.state.login = () => pending.promise;
  const loggingIn = current.session.login(signal()); await flushMicrotasks();
  await assert.rejects(current.session.login(signal()), failure(library.IntegrationFailureCode.Backpressure));
  await assert.rejects(current.session.restore(signal()), failure(library.IntegrationFailureCode.Backpressure)); pending.resolve(grant()); await loggingIn;
  assert.equal(current.calls.inputs.length, Fixture.one); });
test(Fixture.names.canceledBefore, async () => { const current = fixture(); const cancellation = new AbortController(); cancellation.abort();
  await assert.rejects(current.session.login(cancellation.signal), failure(library.IntegrationFailureCode.Canceled));
  await current.session.login(signal()); assert.equal(current.calls.inputs.length, Fixture.one); });
test(Fixture.names.ownership, async () => { const state = { serialized: null };
  const ownership = new library.SpotifyCredentialOwnership({ read: async () => state.serialized,
    write: async (_accountIdentifier, serialized) => { state.serialized = serialized; }, clear: async () => { state.serialized = null; } });
  const first = fixture(); const pending = deferred(); first.state.login = () => pending.promise;
  const previous = new library.LibrespotLoginSession({ ...first.dependencies, credentialStore: ownership.acquire(Fixture.account) }, input());
  const loggingIn = previous.login(signal()); const superseded = assert.rejects(loggingIn, failure(library.IntegrationFailureCode.Superseded)); await flushMicrotasks();
  const second = fixture(); second.state.grant = grant({ storedCredential: Fixture.replacementStored });
  const replacement = new library.LibrespotLoginSession({ ...second.dependencies, credentialStore: ownership.acquire(Fixture.account) }, input());
  await replacement.login(signal()); pending.resolve(grant()); await superseded;
  assert.equal(JSON.parse(state.serialized).storedCredential, Fixture.replacementStored); });
test(Fixture.names.observers, async () => { for (const observer of [() => { throw new Error(Fixture.rawFailure); }, async () => { throw new Error(Fixture.rawFailure); }]) {
  const current = fixture(); current.dependencies.onProgress = observer; await current.session.login(signal());
  assert.equal((await current.session.getCredentials(signal())).accessToken, Fixture.token);
} });
test(Fixture.names.observerCancellation, async () => { const current = fixture(); const cancellation = new AbortController();
  current.dependencies.onProgress = stage => { if (stage === library.SpotifyLoginStage.Authorizing) cancellation.abort(); };
  await assert.rejects(current.session.login(cancellation.signal), failure(library.IntegrationFailureCode.Canceled)); assert.equal(current.calls.inputs.length, Fixture.zero); });
test(Fixture.names.progress, async () => { const current = fixture(); await current.session.login(signal()); assert.deepEqual(current.calls.stages, Fixture.stages); });
test(Fixture.names.presenceFailures, async () => { const current = fixture(saved()); current.state.read = async () => { throw new Error(Fixture.rawFailure); };
  await assert.rejects(library.hasSavedLibrespotLogin(current.store, signal()), failure(library.IntegrationFailureCode.CredentialStorage));
  current.state.read = null; current.state.serialized = Fixture.malformedJson;
  await assert.rejects(library.hasSavedLibrespotLogin(current.store, signal()), failure(library.IntegrationFailureCode.InvalidResponse)); });
test(Fixture.names.invalidInput, () => { const dependencies = fixture().dependencies;
  for (const loginInput of [null, input({ username: Fixture.whitespace }), input({ password: Fixture.whitespace.repeat(Fixture.zero) }),
    input({ username: Fixture.padding.repeat(Fixture.maximumUsernameCharacters + Fixture.oversizedIncrement) }),
    input({ password: Fixture.padding.repeat(Fixture.maximumPasswordCharacters + Fixture.oversizedIncrement) })]) {
    assert.throws(() => new library.LibrespotLoginSession(dependencies, loginInput), failure(library.IntegrationFailureCode.InvalidInput));
  }
});
test(Fixture.names.renewalStorage, async () => { const current = fixture(); await current.session.login(signal());
  current.state.grant = grant({ accessToken: Fixture.replacementToken }); current.state.write = async () => { throw new Error(Fixture.rawFailure); };
  await assert.rejects(current.session.renewCredentials(signal()), failure(library.IntegrationFailureCode.CredentialStorage));
  assert.equal((await current.session.getCredentials(signal())).accessToken, Fixture.token); });
test(Fixture.names.expiredDispose, async () => { const current = fixture(); await current.session.login(signal()); const pending = deferred(); current.state.restore = () => pending.promise;
  const first = current.session.renewCredentials(signal()); const second = current.session.renewCredentials(signal());
  const rejected = Promise.all([assert.rejects(first, failure(library.IntegrationFailureCode.Canceled)), assert.rejects(second, failure(library.IntegrationFailureCode.Canceled))]);
  await flushMicrotasks(); current.session.dispose(); await rejected; pending.resolve(grant({ accessToken: Fixture.replacementToken })); await flushMicrotasks();
  assert.equal(current.calls.writes.length, Fixture.one); assert.equal(JSON.parse(current.state.serialized).storedCredential, Fixture.stored); });
test(Fixture.names.renewalOverlap, async () => { const current = fixture(); await current.session.login(signal()); const pending = deferred(); current.state.restore = () => pending.promise;
  const renewing = current.session.renewCredentials(signal()); await flushMicrotasks();
  await assert.rejects(current.session.restore(signal()), failure(library.IntegrationFailureCode.Backpressure)); pending.resolve(grant()); await renewing;
  assert.equal(current.calls.restores.length, Fixture.one); });

const AdditionalNames = Object.freeze({ opaqueRestore: 'Native rejection of malformed reusable credential input erases the saved record',
  opaqueRenewal: 'Native rejection of malformed renewal input retires and erases the active saved session',
  invalidInputGetter: 'Throwing login input accessors expose only a sanitized input failure',
  presenceCanceled: 'Canceling a pending saved-presence read rejects before the uncooperative storage result arrives' });
test(AdditionalNames.opaqueRestore, async () => { const current = fixture(saved());
  current.state.restore = async () => { throw new library.IntegrationFailure(library.IntegrationFailureCode.InvalidInput); };
  await assert.rejects(current.session.restore(signal()), failure(library.IntegrationFailureCode.InvalidInput)); assert.equal(current.state.serialized, null); });
test(AdditionalNames.opaqueRenewal, async () => { const current = fixture(); await current.session.login(signal());
  current.state.restore = async () => { throw new library.IntegrationFailure(library.IntegrationFailureCode.InvalidInput); };
  await assert.rejects(current.session.renewCredentials(signal()), failure(library.IntegrationFailureCode.InvalidInput));
  assert.equal(current.state.serialized, null); await assert.rejects(current.session.getCredentials(signal()), failure(library.IntegrationFailureCode.Unauthorized)); });
test(AdditionalNames.invalidInputGetter, () => { const current = fixture(); const hostileInput = { get username() { throw new Error(Fixture.rawFailure); }, password: Fixture.password };
  assert.throws(() => new library.LibrespotLoginSession(current.dependencies, hostileInput), failure(library.IntegrationFailureCode.InvalidInput)); });
test(AdditionalNames.presenceCanceled, async () => { const current = fixture(saved()); const reading = deferred(); current.state.read = () => reading.promise;
  const cancellation = new AbortController(); const finding = library.hasSavedLibrespotLogin(current.store, cancellation.signal);
  const canceled = assert.rejects(finding, failure(library.IntegrationFailureCode.Canceled)); cancellation.abort(); await canceled;
  reading.resolve(saved()); await flushMicrotasks(); assert.equal(current.calls.inputs.length + current.calls.restores.length, Fixture.zero); });

const DeviceStrategyNames = Object.freeze({ login: 'A device authorization strategy establishes and persists a session without a password input',
  once: 'A device authorization strategy cannot be replayed on the same login provider',
  resume: 'Missing native credentials resume an existing device transaction when a resume strategy is provided',
  savedFirst: 'A saved native credential is preferred over pending device authorization during restoration',
  cancel: 'Canceled device authorization cannot accept an uncooperative late native grant',
  loggedOut: 'Logging out before device authorization retires the unused strategy' });
test(DeviceStrategyNames.login, async () => { const current = fixture(); let authorizations = Fixture.zero;
  const provider = new library.LibrespotLoginSession({ ...current.dependencies, authorize: async () => { authorizations += Fixture.one; return grant(); } });
  const credentials = await provider.login(signal()); assert.equal(credentials.accountIdentifier, Fixture.account);
  assert.equal(authorizations, Fixture.one); assert.equal(current.calls.inputs.length, Fixture.zero);
  assert.equal(JSON.parse(current.state.serialized).storedCredential, Fixture.stored); provider.dispose(); });
test(DeviceStrategyNames.once, async () => { const current = fixture(); let authorizations = Fixture.zero;
  const provider = new library.LibrespotLoginSession({ ...current.dependencies, authorize: async () => { authorizations += Fixture.one; return grant(); } });
  await provider.login(signal()); await assert.rejects(provider.login(signal()), failure(library.IntegrationFailureCode.Unauthorized));
  assert.equal(authorizations, Fixture.one); provider.dispose(); });
test(DeviceStrategyNames.resume, async () => { const current = fixture(); let resumptions = Fixture.zero;
  const provider = new library.LibrespotLoginSession({ ...current.dependencies, resumeAuthorization: async () => { resumptions += Fixture.one; return grant(); } });
  await provider.restore(signal()); assert.equal(resumptions, Fixture.one); assert.equal(current.calls.inputs.length + current.calls.restores.length, Fixture.zero);
  assert.notEqual(current.state.serialized, null); provider.dispose(); });
test(DeviceStrategyNames.savedFirst, async () => { const current = fixture(saved()); let resumptions = Fixture.zero;
  const provider = new library.LibrespotLoginSession({ ...current.dependencies, resumeAuthorization: async () => { resumptions += Fixture.one; return grant(); } });
  await provider.restore(signal()); assert.equal(resumptions, Fixture.zero); assert.equal(current.calls.restores.length, Fixture.one); provider.dispose(); });
test(DeviceStrategyNames.cancel, async () => { const current = fixture(); const pending = deferred();
  const provider = new library.LibrespotLoginSession({ ...current.dependencies, authorize: () => pending.promise });
  const cancellation = new AbortController(); const signingIn = provider.login(cancellation.signal);
  const canceled = assert.rejects(signingIn, failure(library.IntegrationFailureCode.Canceled)); await flushMicrotasks(); cancellation.abort(); await canceled;
  pending.resolve(grant()); await flushMicrotasks(); assert.equal(current.state.serialized, null); provider.dispose(); });
test(DeviceStrategyNames.loggedOut, async () => { const current = fixture(); let authorizations = Fixture.zero;
  const provider = new library.LibrespotLoginSession({ ...current.dependencies, authorize: async () => { authorizations += Fixture.one; return grant(); } });
  await provider.logout(); await assert.rejects(provider.login(signal()), failure(library.IntegrationFailureCode.Unauthorized));
  assert.equal(authorizations, Fixture.zero); provider.dispose(); });

const NativeDiagnosticFailures = Object.values({ session: library.IntegrationFailureCode.NativeSessionRejected,
  token: library.IntegrationFailureCode.NativeTokenRejected });
const NativeDiagnosticNames = Object.freeze({ login: 'Distinct native authentication failures survive login without exposing private detail or publishing credentials',
  restore: 'Distinct native rejection codes erase unusable saved sessions during restoration',
  renewal: 'Distinct native rejection codes erase renewable material and retire active credentials' });
test(NativeDiagnosticNames.login, async () => { for (const code of NativeDiagnosticFailures) {
  const current = fixture(); current.state.login = async () => { throw new library.IntegrationFailure(code); };
  await assert.rejects(current.session.login(signal()), failure(code)); assert.equal(current.calls.writes.length, Fixture.zero);
  await assert.rejects(current.session.getCredentials(signal()), failure(library.IntegrationFailureCode.Unauthorized));
} });
test(NativeDiagnosticNames.restore, async () => { for (const code of NativeDiagnosticFailures) {
  const current = fixture(saved()); current.state.restore = async () => { throw new library.IntegrationFailure(code); };
  await assert.rejects(current.session.restore(signal()), failure(code)); assert.equal(current.state.serialized, null);
  assert.equal(current.calls.clears, Fixture.one);
} });
test(NativeDiagnosticNames.renewal, async () => { for (const code of NativeDiagnosticFailures) {
  const current = fixture(); await current.session.login(signal());
  current.state.restore = async () => { throw new library.IntegrationFailure(code); };
  await assert.rejects(current.session.renewCredentials(signal()), failure(code)); assert.equal(current.state.serialized, null);
  await assert.rejects(current.session.getCredentials(signal()), failure(library.IntegrationFailureCode.Unauthorized));
} });
