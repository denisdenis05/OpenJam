import assert from 'node:assert/strict';
import test from 'node:test';
import { library, Values, credentials, cancellation, deferred, flushMicrotasks, sessionResponse } from './fixtures.mjs';

const Fixture = Object.freeze({ host: 'reconciliation-host', otherHost: 'replacement-host', refresh: 'initial-membership',
  passive: 'passive-membership', reconcile: 'explicit-reconciliation', laterReconcile: 'later-reconciliation',
  uncertain: 'uncertain-command', later: 'new-command', another: 'another-command', empty: '',
  readEvent: 'membership', verifyEvent: 'native-verification', queueEvent: 'queue', playbackEvent: 'playback',
  zero: 0, one: 1, two: 2, three: 3, generation: 4, revision: 'actual-queue-revision', occurrence: 'actual-current-occurrence',
  otherOccurrence: 'other-current-occurrence', trackPrefix: 'spotify:track:', provider: 'queue', durationMilliseconds: 100000,
  names: {
    finalReadFailure: 'Failure during the final membership read retains both mutation fences',
    initialReadCancel: 'Cancellation during the initial membership read prevents native verification and restores uncertainty',
    both: 'One successful reconciliation clears both uncertain fences while retaining both original receipts',
    nativePending: 'Canceling a pending native observation rejects promptly and ignores its late completion',
    nativeIdentity: 'Native verification captures the supplied authority before an asynchronous read',
    recovery: 'Explicit shared-state verification clears queue and playback fences while preserving the original unknown receipt',
    passive: 'Passive membership refresh preserves queue and playback uncertainty without invoking native verification',
    unsupported: 'Shared-state reconciliation requires both account membership and an injected verifier',
    failure: 'Native verification and membership failures preserve uncertain mutation fences',
    before: 'Fresh membership identity changes prevent native shared-state verification',
    after: 'Membership changes after native verification cannot clear outcome fences',
    inactive: 'Guest inactive missing-host and absent membership cannot authorize shared-state reconciliation',
    account: 'Account replacement aborts reconciliation and prevents a late verifier from changing the new account',
    cancelBefore: 'Already canceled reconciliation performs no membership or native reads',
    cancelDuring: 'Cancellation during native verification preserves the exact prior uncertain snapshot and fences late completion',
    cancelMembership: 'Cancellation during the final membership read cannot clear uncertainty',
    ordering: 'Reconciliation serializes membership and native verification ahead of a later mutation',
    queued: 'Canceled queued reconciliation never performs a read and does not interrupt the preceding mutation',
    staleQueued: 'Queued reconciliation rejects membership changed by an earlier serialized refresh',
    duplicate: 'Duplicate reconciliation requests share one read sequence and conflicting operations are rejected',
    runtime: 'Runtime forwards the optional shared-state verifier without reading at construction',
    native: 'Native shared-state verifier binds account and host while accepting real revision and current occurrence',
    nativeInvalid: 'Native shared-state verifier rejects missing revision occurrence mismatched playback or generation',
    nativeAuthority: 'Native shared-state verifier rejects wrong account host and missing target identity',
    nativeCancel: 'Native shared-state verification rejects cancellation before and after the native read',
    nativeFailure: 'Native observation failure propagates without replay or a fallback read' } });
const Failure = library.IntegrationFailureCode;
const Status = library.JamConnectionStatus;
const Command = Object.freeze({ kind: library.HostedPlaybackCommandKind.Next });

function rejected(code) { return value => value instanceof library.IntegrationFailure && value.code === code; }
function unknown() { throw new library.IntegrationFailure(Failure.UnknownOutcome); }
async function session({ verifierEnabled = true, accountReadEnabled = true } = {}) {
  const state = { response: sessionResponse({ hostDeviceIdentifier: Fixture.host }), read: null, verify: null, mutate: null };
  const calls = { events: [], identities: [], signals: [], mutations: Values.noInvocations };
  const membership = { createOrActivate: async () => state.response, end: async () => undefined,
    ...(accountReadEnabled ? { readCurrentAccount: async signal => {
      calls.events.push(Fixture.readEvent); calls.signals.push(signal); return state.read ? state.read(signal) : state.response;
    } } : {}) };
  const verifier = { verify: async (identity, signal) => {
    calls.events.push(Fixture.verifyEvent); calls.identities.push(identity); calls.signals.push(signal);
    if (state.verify) await state.verify(identity, signal);
  } };
  const mutate = async event => { calls.events.push(event); calls.mutations += Values.invocationIncrement;
    if (state.mutate) await state.mutate(); };
  const queue = { addToQueue: async () => mutate(Fixture.queueEvent) };
  const playback = { execute: async () => mutate(Fixture.playbackEvent) };
  const client = new library.JamSessionClient();
  client.attachAccount(Values.accountIdentifier, membership, queue, playback, verifierEnabled ? verifier : null);
  await client.createOrActivateSession(Fixture.refresh);
  return { state, calls, client, membership, queue, playback, verifier };
}
function mutation(current, playback, identifier) { return playback ? current.client.executeHostedPlayback(Command, identifier)
  : current.client.addToQueue(Values.spotifyIdentifier, identifier); }
async function uncertain(current, playback) {
  current.state.mutate = unknown;
  const result = await mutation(current, playback, Fixture.uncertain);
  assert.equal(result.failure, Failure.UnknownOutcome);
  current.state.mutate = null;
  return result;
}
async function assertFence(current, playback) {
  await current.client.refreshCurrentSession(Fixture.passive);
  const count = current.calls.mutations;
  assert.equal((await mutation(current, playback, Fixture.later)).failure, Failure.UnknownOutcome);
  assert.equal(current.calls.mutations, count);
}

test(Fixture.names.recovery, async () => {
  for (const playback of [false, true]) {
    const current = await session(); const receipt = await uncertain(current, playback);
    assert.equal(current.client.getSnapshot().status, Status.Uncertain);
    assert.equal((await current.client.reconcileSharedState(Fixture.reconcile)).applied, true);
    assert.deepEqual(current.calls.events, [playback ? Fixture.playbackEvent : Fixture.queueEvent,
      Fixture.readEvent, Fixture.verifyEvent, Fixture.readEvent]);
    assert.equal(current.client.getSnapshot().status, Status.Ready);
    assert.equal(await mutation(current, playback, Fixture.uncertain), receipt);
    assert.equal((await mutation(current, playback, Fixture.later)).applied, true);
    assert.equal(current.calls.mutations, Fixture.two);
    assert.equal(current.calls.identities[Fixture.zero].sessionIdentifier, Values.sessionIdentifier);
    assert.equal(Object.isFrozen(current.calls.identities[Fixture.zero]), true);
  }
});
test(Fixture.names.passive, async () => {
  for (const playback of [false, true]) {
    const current = await session(); await uncertain(current, playback); await assertFence(current, playback);
    assert.equal(current.calls.identities.length, Fixture.zero);
  }
});
test(Fixture.names.unsupported, async () => {
  for (const options of [{ verifierEnabled: false }, { accountReadEnabled: false }]) {
    const current = await session(options); await uncertain(current, false);
    assert.equal(current.client.capabilities.reconcileSharedState, false);
    assert.equal((await current.client.reconcileSharedState(Fixture.reconcile)).failure, Failure.Unsupported);
    assert.equal(current.client.getSnapshot().status, Status.Uncertain);
    assert.equal(current.calls.events.length, Fixture.one);
  }
  const detached = new library.JamSessionClient();
  assert.equal(detached.capabilities.reconcileSharedState, false);
  assert.equal((await detached.reconcileSharedState(Fixture.reconcile)).failure, Failure.Unauthorized);
});
test(Fixture.names.failure, async () => {
  for (const playback of [false, true]) {
    for (const nativeFailure of [false, true]) {
      const current = await session(); await uncertain(current, playback);
      const fail = async () => { throw new library.IntegrationFailure(Failure.Network); };
      if (nativeFailure) current.state.verify = fail; else current.state.read = fail;
      assert.equal((await current.client.reconcileSharedState(Fixture.reconcile)).failure, Failure.Network);
      assert.equal(current.client.getSnapshot().status, Status.Uncertain);
      current.state.read = null; current.state.verify = null; await assertFence(current, playback);
    }
  }
});
test(Fixture.names.before, async () => {
  for (const replacement of [{ identifier: Values.otherSessionIdentifier }, { hostDeviceIdentifier: Fixture.otherHost }]) {
    const current = await session(); await uncertain(current, false);
    current.state.response = sessionResponse({ hostDeviceIdentifier: Fixture.host, ...replacement });
    assert.equal((await current.client.reconcileSharedState(Fixture.reconcile)).failure, Failure.Superseded);
    assert.equal(current.calls.identities.length, Fixture.zero);
    current.state.response = sessionResponse({ hostDeviceIdentifier: Fixture.host }); await assertFence(current, false);
  }
});
test(Fixture.names.after, async () => {
  for (const replacement of [null, { identifier: Values.otherSessionIdentifier }, { hostDeviceIdentifier: Fixture.otherHost },
    { ownedByCurrentAccount: false }, { active: false }]) {
    const current = await session(); await uncertain(current, true);
    current.state.verify = async () => { current.state.response = replacement === null ? null
      : sessionResponse({ hostDeviceIdentifier: Fixture.host, ...replacement }); };
    assert.equal((await current.client.reconcileSharedState(Fixture.reconcile)).applied, false);
    assert.equal(current.calls.identities.length, Fixture.one);
    current.state.response = sessionResponse({ hostDeviceIdentifier: Fixture.host }); await assertFence(current, true);
  }
});
test(Fixture.names.inactive, async () => {
  for (const replacement of [null, { ownedByCurrentAccount: false }, { active: false }, { hostDeviceIdentifier: undefined }]) {
    const current = await session(); await uncertain(current, false);
    current.state.response = replacement === null ? null : sessionResponse({ hostDeviceIdentifier: Fixture.host, ...replacement });
    assert.equal((await current.client.reconcileSharedState(Fixture.reconcile)).applied, false);
    assert.equal(current.calls.identities.length, Fixture.zero);
  }
});
test(Fixture.names.account, async () => {
  const current = await session(); await uncertain(current, false); const pending = deferred(); current.state.verify = () => pending.promise;
  const result = current.client.reconcileSharedState(Fixture.reconcile); await flushMicrotasks();
  current.client.attachAccount(Values.otherAccountIdentifier, current.membership, current.queue, current.playback, current.verifier);
  assert.equal((await result).failure, Failure.Superseded);
  assert.equal(current.calls.signals.every(signal => signal.aborted), true);
  pending.resolve(); await flushMicrotasks();
  assert.equal(current.client.getSnapshot().accountIdentifier, Values.otherAccountIdentifier);
  assert.equal(current.client.getSnapshot().session, null);
});
test(Fixture.names.cancelBefore, async () => {
  const current = await session(); await uncertain(current, false); const abort = cancellation(); abort.abort();
  assert.equal((await current.client.reconcileSharedState(Fixture.reconcile, abort.signal)).failure, Failure.Canceled);
  assert.equal(current.calls.events.length, Fixture.one);
});
test(Fixture.names.cancelDuring, async () => {
  const current = await session(); await uncertain(current, false); const prior = current.client.getSnapshot();
  const pending = deferred(); current.state.verify = () => pending.promise; const abort = cancellation();
  const result = current.client.reconcileSharedState(Fixture.reconcile, abort.signal); await flushMicrotasks(); abort.abort();
  assert.equal((await result).failure, Failure.Canceled); assert.equal(current.client.getSnapshot(), prior);
  pending.resolve(); await flushMicrotasks(); assert.equal(current.client.getSnapshot(), prior); await assertFence(current, false);
});
test(Fixture.names.cancelMembership, async () => {
  const current = await session(); await uncertain(current, true); const pending = deferred(); const abort = cancellation();
  current.state.verify = async () => { current.state.read = () => pending.promise; };
  const result = current.client.reconcileSharedState(Fixture.reconcile, abort.signal); await flushMicrotasks(); abort.abort();
  assert.equal((await result).failure, Failure.Canceled); pending.resolve(current.state.response); await flushMicrotasks();
  current.state.read = null; await assertFence(current, true);
});
test(Fixture.names.ordering, async () => {
  const current = await session(); await uncertain(current, false); await current.client.refreshCurrentSession(Fixture.passive);
  const pending = deferred(); current.state.verify = () => pending.promise;
  const recovery = current.client.reconcileSharedState(Fixture.reconcile); await flushMicrotasks();
  const later = mutation(current, false, Fixture.later); await flushMicrotasks(); assert.equal(current.calls.mutations, Fixture.one);
  pending.resolve(); assert.equal((await recovery).applied, true); assert.equal((await later).applied, true);
  assert.deepEqual(current.calls.events.slice(-Fixture.three), [Fixture.verifyEvent, Fixture.readEvent, Fixture.queueEvent]);
});
test(Fixture.names.queued, async () => {
  const current = await session(); const pending = deferred(); current.state.mutate = () => pending.promise;
  const command = mutation(current, false, Fixture.uncertain); await flushMicrotasks(); const abort = cancellation();
  const recovery = current.client.reconcileSharedState(Fixture.reconcile, abort.signal); abort.abort();
  assert.equal((await recovery).failure, Failure.Canceled); assert.equal(current.calls.identities.length, Fixture.zero);
  pending.resolve(); assert.equal((await command).applied, true); await flushMicrotasks();
  assert.deepEqual(current.calls.events, [Fixture.queueEvent]);
});
test(Fixture.names.staleQueued, async () => {
  const current = await session(); const pending = deferred(); current.state.read = () => pending.promise;
  const refresh = current.client.refreshCurrentSession(Fixture.passive); await flushMicrotasks();
  const recovery = current.client.reconcileSharedState(Fixture.reconcile);
  pending.resolve(sessionResponse({ hostDeviceIdentifier: Fixture.otherHost })); await refresh;
  assert.equal((await recovery).failure, Failure.Superseded); assert.equal(current.calls.identities.length, Fixture.zero);
  assert.equal(current.client.getSnapshot().session.hostDeviceIdentifier, Fixture.otherHost);
});
test(Fixture.names.duplicate, async () => {
  const current = await session(); const pending = deferred(); current.state.verify = () => pending.promise;
  const first = current.client.reconcileSharedState(Fixture.reconcile);
  assert.equal(current.client.reconcileSharedState(Fixture.reconcile), first);
  assert.equal((await current.client.refreshCurrentSession(Fixture.reconcile)).failure, Failure.InvalidInput);
  await flushMicrotasks(); pending.resolve(); assert.equal((await first).applied, true);
  assert.equal(current.calls.identities.length, Fixture.one);
  assert.equal(current.client.capabilities.reconcileSharedState, true);
});
test(Fixture.names.runtime, () => {
  const runtime = new library.SpotifyJamRuntime({ accountIdentifier: Values.accountIdentifier,
    sharedStateVerifier: { verify: async () => assert.fail() },
    credentials: { getCredentials: async () => credentials(), renewCredentials: async () => credentials() },
    endpoints: { resolveServiceOrigin: async () => Values.serviceOrigin }, associations: new library.MemoryAssociationStore(),
    recordings: { identity: Values.catalogIdentity, namespace: library.RecordingNamespace.Local, lookup: async () => null, search: async () => [] },
    clock: { nowMilliseconds: () => Values.nowMilliseconds }, requests: { execute: async () => assert.fail() } });
  assert.equal(runtime.sessions.capabilities.reconcileSharedState, true); runtime.dispose();
});

function identity(overrides = {}) { return { accountIdentifier: Values.accountIdentifier, sessionIdentifier: Values.sessionIdentifier,
  authorityIdentifier: Fixture.host, ...overrides }; }
function observation() { return { generation: Fixture.generation, hostDeviceIdentifier: Fixture.host, queueRevision: Fixture.revision,
  currentTrack: { uri: Fixture.trackPrefix + Values.spotifyIdentifier, occurrenceIdentifier: Fixture.occurrence, provider: Fixture.provider },
  nextTracks: [], previousTracks: [], buffering: false,
  playback: { spotifyTrackIdentifier: Values.spotifyIdentifier, occurrenceIdentifier: Fixture.occurrence,
    positionMilliseconds: Fixture.zero, durationMilliseconds: Fixture.durationMilliseconds, playing: false,
    anchorMonotonicMilliseconds: Fixture.zero, observedMonotonicMilliseconds: Fixture.zero, uncertaintyMilliseconds: Fixture.zero } }; }
function nativeVerifier(read) { return new library.SpotifyConnectSharedStateVerifier({ read }, Values.accountIdentifier); }
test(Fixture.names.native, async () => {
  const calls = []; const abort = cancellation(); const sample = observation();
  await nativeVerifier(async (...parameters) => { calls.push(parameters); return sample; }).verify(identity(), abort.signal);
  assert.deepEqual(calls, [[Values.accountIdentifier, Fixture.host, abort.signal]]);
});
test(Fixture.names.nativeInvalid, async () => {
  for (const change of [sample => { sample.queueRevision = Fixture.empty; },
    sample => { sample.currentTrack.occurrenceIdentifier = null; },
    sample => { sample.playback.occurrenceIdentifier = Fixture.otherOccurrence; },
    sample => { sample.generation = Fixture.zero; }]) {
    const sample = observation(); change(sample);
    await assert.rejects(nativeVerifier(async () => sample).verify(identity(), cancellation().signal), rejected(Failure.InvalidResponse));
  }
});
test(Fixture.names.nativeAuthority, async () => {
  await assert.rejects(nativeVerifier(async () => assert.fail()).verify(identity({ accountIdentifier: Values.otherAccountIdentifier }), cancellation().signal), rejected(Failure.Superseded));
  await assert.rejects(nativeVerifier(async () => assert.fail()).verify(identity({ authorityIdentifier: Fixture.empty }), cancellation().signal), rejected(Failure.InvalidInput));
  const sample = observation(); sample.hostDeviceIdentifier = Fixture.otherHost;
  await assert.rejects(nativeVerifier(async () => sample).verify(identity(), cancellation().signal), rejected(Failure.Superseded));
});
test(Fixture.names.nativeCancel, async () => {
  const before = cancellation(); before.abort();
  await assert.rejects(nativeVerifier(async () => assert.fail()).verify(identity(), before.signal), rejected(Failure.Canceled));
  const after = cancellation();
  await assert.rejects(nativeVerifier(async () => { after.abort(); return observation(); }).verify(identity(), after.signal), rejected(Failure.Canceled));
});
test(Fixture.names.nativeFailure, async () => {
  let count = Fixture.zero;
  await assert.rejects(nativeVerifier(async () => { count += Fixture.one; throw new library.IntegrationFailure(Failure.Deadline); })
    .verify(identity(), cancellation().signal), rejected(Failure.Deadline));
  assert.equal(count, Fixture.one);
});

test(Fixture.names.both, async () => {
  const current = await session(); const queueReceipt = await uncertain(current, false);
  await current.client.refreshCurrentSession(Fixture.passive); current.state.mutate = unknown;
  const playbackReceipt = await mutation(current, true, Fixture.another);
  assert.equal(playbackReceipt.failure, Failure.UnknownOutcome); current.state.mutate = null;
  assert.equal((await current.client.reconcileSharedState(Fixture.reconcile)).applied, true);
  assert.equal(await mutation(current, false, Fixture.uncertain), queueReceipt);
  assert.equal(await mutation(current, true, Fixture.another), playbackReceipt);
  assert.equal((await mutation(current, false, Fixture.later)).applied, true);
  assert.equal((await mutation(current, true, Fixture.laterReconcile)).applied, true);
});
test(Fixture.names.nativePending, async () => {
  const pending = deferred(); const abort = cancellation();
  const result = nativeVerifier(() => pending.promise).verify(identity(), abort.signal); abort.abort();
  await assert.rejects(result, rejected(Failure.Canceled)); pending.resolve(observation()); await flushMicrotasks();
});
test(Fixture.names.nativeIdentity, async () => {
  const target = identity(); const pending = deferred();
  const result = nativeVerifier(() => pending.promise).verify(target, cancellation().signal);
  target.authorityIdentifier = Fixture.otherHost; pending.resolve(observation()); await result;
});

test(Fixture.names.finalReadFailure, async () => {
  for (const playback of [false, true]) {
    const current = await session(); await uncertain(current, playback);
    current.state.verify = async () => { current.state.read = async () => { throw new library.IntegrationFailure(Failure.Network); }; };
    assert.equal((await current.client.reconcileSharedState(Fixture.reconcile)).failure, Failure.Network);
    current.state.read = null; await assertFence(current, playback);
  }
});
test(Fixture.names.initialReadCancel, async () => {
  const current = await session(); await uncertain(current, false); const prior = current.client.getSnapshot();
  const pending = deferred(); const abort = cancellation(); current.state.read = () => pending.promise;
  const result = current.client.reconcileSharedState(Fixture.reconcile, abort.signal); await flushMicrotasks(); abort.abort();
  assert.equal((await result).failure, Failure.Canceled); assert.equal(current.client.getSnapshot(), prior);
  pending.resolve(current.state.response); await flushMicrotasks(); assert.equal(current.calls.identities.length, Fixture.zero);
  current.state.read = null; await assertFence(current, false);
});
