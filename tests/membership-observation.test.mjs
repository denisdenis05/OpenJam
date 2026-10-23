import assert from 'node:assert/strict';
import test from 'node:test';
import { library, Values, ManualScheduler, cancellation, deferred, flushMicrotasks, sessionResponse, credentials, song } from './fixtures.mjs';

const Fixture = Object.freeze({ requestPrefix: 'membership-observation-', firstRequest: 'passive-first', nextRequest: 'passive-next',
  createRequest: 'membership-create', secondCreateRequest: 'membership-second-create', queueRequest: 'membership-queue',
  secondQueueRequest: 'membership-second-queue', host: 'membership-host', invalidRequest: '', retrySeconds: 30,
  noCalls: 0, oneCall: 1, twoCalls: 2, countIncrement: 1, firstPosition: 0, forbiddenStatus: 403 });
const Names = Object.freeze({
  preCancelled: 'Precancelled passive read does not change membership or contact its protocol',
  cancelledReady: 'Cancelling passive observation restores ready membership and its invitation',
  cancelledFailed: 'Cancelling passive observation restores the prior failure and status',
  cancelledUncertain: 'Cancelling passive reconciliation preserves uncertain mutation fencing',
  reentrantCancel: 'Cancelling from an operating subscriber prevents passive protocol invocation',
  queuedCancel: 'Cancelling a queued passive read never cancels an earlier mutation',
  retryReceipt: 'Typed command receipts preserve rate guidance without changing ordinary result shapes',
  latePassive: 'A cancelled passive response cannot clear membership after completing late',
  constructor: 'Membership observer construction starts neither HTTP nor timers',
  disabled: 'Disabled membership observation does not generate identifiers or contact Spotify',
  identifiersRequired: 'Membership observation requires an injected request identity source',
  noScheduler: 'Manual membership refresh works without enabling automatic polling',
  coalescing: 'Concurrent membership refresh calls share one operation and identifier',
  noJam: 'Absent current Jam is a successful observed result and remains pollable',
  session: 'Observed membership details remain in the session store instead of being duplicated',
  polling: 'Membership polling requires both an observing foreground consumer and scheduler',
  hidden: 'Hiding membership observation aborts pending passive reads and marks metadata stale',
  background: 'Backgrounding preserves membership while aborting its passive observation',
  foreground: 'Foreground resumption obtains a new membership snapshot before marking ready',
  failedRead: 'Read failure retains the previous receipt as stale and stops automatic retries',
  retry: 'Membership rate guidance throttles manual and resumed polling until its deadline',
  identifiers: 'Polling uses distinct request identities so prior receipts cannot fake fresh reads',
  duplicateIdentifier: 'A repeated generated request identity is rejected before passive work',
  invalidIdentifier: 'Empty and oversized generated identifiers cannot reach passive commands',
  boundedHistory: 'Retired identifier history permits a real read after old receipts have expired',
  accountChange: 'Account replacement cancels old membership reads and discards their late results',
  sameAccount: 'Detaching and reattaching the same account cannot revive an old observer completion',
  dispose: 'Disposal releases membership polling and never ends the shared Jam',
  reentrant: 'A subscriber suspending refresh prevents request identity and protocol work',
  subscriberFailure: 'Subscriber exceptions cannot change the membership read outcome',
  emptyToCreated: 'Polling discovers a later Jam without creating or joining one itself',
  observerUncertain: 'Observer background cancellation cannot reconcile an uncertain mutation',
  queueFence: 'Membership observer success cannot clear an unknown queue-write fence',
  runtime: 'Runtime composes opt-in membership observation without eager requests',
  silentAccount: 'A silently changed injected account cannot retain old ready metadata',
  staleFailure: 'A failed injected read after silent account replacement cannot overwrite new account metadata',
  duplicateCancelled: 'Duplicate individually cancelled queued reads share their original receipt',
  invalidRetry: 'Invalid rate guidance is omitted from command receipts',
});

function fixture(enabled = true, polling = false, identifiers = true) {
  const scheduler = new ManualScheduler(); const calls = { reads: Fixture.noCalls, creates: Fixture.noCalls, ends: Fixture.noCalls,
    identifiers: [], signals: [] };
  const state = { read: async () => null, create: async () => sessionResponse(), queue: async () => undefined };
  const protocol = { createOrActivate: async (...parameters) => { calls.creates += Fixture.countIncrement; return state.create(...parameters); },
    end: async () => { calls.ends += Fixture.countIncrement; }, readCurrentAccount: async signal => {
      calls.reads += Fixture.countIncrement; calls.signals.push(signal); return state.read(signal);
    } };
  const client = new library.JamSessionClient();
  client.attachAccount(Values.accountIdentifier, protocol, { addToQueue: (...parameters) => state.queue(...parameters) });
  let sequence = Fixture.noCalls;
  const identity = { next: () => { sequence += Fixture.countIncrement; return Fixture.requestPrefix + sequence; } };
  const requestIdentifiers = () => { const identifier = identity.next(); calls.identifiers.push(identifier); return identifier; };
  const observer = new library.JamMembershipObserver(client, { nowMilliseconds: () => scheduler.nowMilliseconds }, enabled,
    identifiers ? requestIdentifiers : undefined, polling ? scheduler : undefined);
  return { scheduler, calls, state, protocol, client, observer, identity };
}

test(Names.preCancelled, async () => {
  const current = fixture(); const controller = cancellation(); controller.abort(); const previous = current.client.getSnapshot();
  assert.equal((await current.client.refreshCurrentSession(Fixture.firstRequest, controller.signal)).failure, library.IntegrationFailureCode.Canceled);
  assert.equal(current.client.getSnapshot(), previous); assert.equal(current.calls.reads, Fixture.noCalls); current.observer.dispose();
});
test(Names.cancelledReady, async () => {
  const current = fixture(); await current.client.createOrActivateSession(Fixture.createRequest); const previous = current.client.getSnapshot();
  const pending = deferred(); current.state.read = () => pending.promise; const controller = cancellation();
  const reading = current.client.refreshCurrentSession(Fixture.firstRequest, controller.signal); await flushMicrotasks(); controller.abort();
  assert.equal((await reading).failure, library.IntegrationFailureCode.Canceled); assert.equal(current.client.getSnapshot(), previous);
  assert.equal(current.client.getInvitation().joinToken, Values.invitationToken); assert.equal(current.calls.signals[Fixture.firstPosition].aborted, true);
  pending.resolve(null); current.observer.dispose();
});
test(Names.cancelledFailed, async () => {
  const current = fixture(); current.state.create = async () => { throw new library.IntegrationFailure(library.IntegrationFailureCode.Forbidden); };
  await current.client.createOrActivateSession(Fixture.createRequest); const previous = current.client.getSnapshot();
  const pending = deferred(); current.state.read = () => pending.promise; const controller = cancellation();
  const reading = current.client.refreshCurrentSession(Fixture.firstRequest, controller.signal); await flushMicrotasks(); controller.abort(); await reading;
  assert.equal(current.client.getSnapshot(), previous); assert.equal(previous.status, library.JamConnectionStatus.Failed);
  assert.equal(previous.failure, library.IntegrationFailureCode.Forbidden); pending.resolve(null); current.observer.dispose();
});
test(Names.cancelledUncertain, async () => {
  const current = fixture(); current.state.create = async () => { throw new library.IntegrationFailure(library.IntegrationFailureCode.UnknownOutcome); };
  await current.client.createOrActivateSession(Fixture.createRequest); const previous = current.client.getSnapshot();
  const pending = deferred(); current.state.read = () => pending.promise; const controller = cancellation();
  const reading = current.client.refreshCurrentSession(Fixture.firstRequest, controller.signal); await flushMicrotasks(); controller.abort(); await reading;
  assert.equal(current.client.getSnapshot(), previous);
  assert.equal((await current.client.createOrActivateSession(Fixture.secondCreateRequest)).failure, library.IntegrationFailureCode.UnknownOutcome);
  pending.resolve(null); current.observer.dispose();
});
test(Names.reentrantCancel, async () => {
  const current = fixture(); const controller = cancellation(); const previous = current.client.getSnapshot();
  const stop = current.client.subscribe(() => { if (current.client.getSnapshot().status === library.JamConnectionStatus.Operating) controller.abort(); });
  await current.client.refreshCurrentSession(Fixture.firstRequest, controller.signal);
  assert.equal(current.calls.reads, Fixture.noCalls); assert.equal(current.client.getSnapshot(), previous); stop(); current.observer.dispose();
});
test(Names.queuedCancel, async () => {
  const current = fixture(); const pending = deferred(); current.state.create = () => pending.promise;
  const creating = current.client.createOrActivateSession(Fixture.createRequest); await flushMicrotasks(); const controller = cancellation();
  const reading = current.client.refreshCurrentSession(Fixture.firstRequest, controller.signal); controller.abort();
  assert.equal((await reading).failure, library.IntegrationFailureCode.Canceled);
  assert.equal(current.client.getSnapshot().status, library.JamConnectionStatus.Operating);
  pending.resolve(sessionResponse()); assert.equal((await creating).applied, true);
  await flushMicrotasks();
  assert.equal(current.calls.reads, Fixture.noCalls); assert.equal(current.client.getSnapshot().session.identifier, Values.sessionIdentifier); current.observer.dispose();
});
test(Names.retryReceipt, async () => {
  const current = fixture(); current.state.read = async () => { throw new library.IntegrationFailure(library.IntegrationFailureCode.RateLimited, Fixture.retrySeconds); };
  assert.equal((await current.client.refreshCurrentSession(Fixture.firstRequest)).retryAfterSeconds, Fixture.retrySeconds);
  current.state.read = async () => null;
  assert.deepEqual(await current.client.refreshCurrentSession(Fixture.nextRequest), { applied: true, failure: null }); current.observer.dispose();
});
test(Names.latePassive, async () => {
  const current = fixture(); await current.client.createOrActivateSession(Fixture.createRequest); const pending = deferred();
  current.state.read = () => pending.promise; const controller = cancellation();
  const reading = current.client.refreshCurrentSession(Fixture.firstRequest, controller.signal); await flushMicrotasks(); controller.abort(); await reading;
  pending.resolve(null); await flushMicrotasks(); assert.equal(current.client.getSnapshot().session.identifier, Values.sessionIdentifier); current.observer.dispose();
});
test(Names.constructor, () => {
  const current = fixture(true, true); assert.equal(current.calls.reads, Fixture.noCalls); assert.equal(current.calls.identifiers.length, Fixture.noCalls);
  assert.equal(current.scheduler.callbacks.size, Fixture.noCalls); assert.equal(current.observer.getSnapshot().status, library.MembershipObservationStatus.Idle); current.observer.dispose();
});
test(Names.disabled, async () => {
  const current = fixture(false, true); current.observer.setObserving(true); await current.observer.refresh();
  assert.equal(current.calls.reads, Fixture.noCalls); assert.equal(current.calls.identifiers.length, Fixture.noCalls);
  assert.equal(current.observer.getSnapshot().status, library.MembershipObservationStatus.Detached); current.observer.dispose();
});
test(Names.identifiersRequired, async () => {
  const current = fixture(true, true, false); current.observer.setObserving(true); await current.observer.refresh();
  assert.equal(current.observer.getSnapshot().enabled, false); assert.equal(current.observer.getSnapshot().failure, library.IntegrationFailureCode.Unsupported);
  assert.equal(current.calls.reads, Fixture.noCalls); current.observer.dispose();
});
test(Names.noScheduler, async () => {
  const current = fixture(); current.observer.setObserving(true); await flushMicrotasks(); assert.equal(current.calls.reads, Fixture.noCalls);
  await current.observer.refresh(); assert.equal(current.calls.reads, Fixture.oneCall); current.observer.dispose();
});
test(Names.coalescing, async () => {
  const current = fixture(); const pending = deferred(); current.state.read = () => pending.promise;
  const first = current.observer.refresh(); const second = current.observer.refresh(); assert.equal(first, second); await flushMicrotasks();
  assert.equal(current.calls.reads, Fixture.oneCall); assert.equal(current.calls.identifiers.length, Fixture.oneCall); pending.resolve(null); await first; current.observer.dispose();
});
test(Names.noJam, async () => {
  const current = fixture(true, true); current.observer.setObserving(true); await flushMicrotasks();
  assert.equal(current.client.getSnapshot().session, null); assert.equal(current.observer.getSnapshot().status, library.MembershipObservationStatus.Ready);
  assert.equal(current.scheduler.callbacks.size, Fixture.oneCall); current.observer.dispose();
});
test(Names.session, async () => {
  const current = fixture(); current.state.read = async () => sessionResponse(); await current.observer.refresh();
  assert.equal(current.client.getSnapshot().session.identifier, Values.sessionIdentifier);
  assert.equal(current.observer.getSnapshot().observedAtMilliseconds, current.scheduler.nowMilliseconds);
  assert.deepEqual(Object.keys(current.observer.getSnapshot()).sort(), Object.values(MembershipSnapshotFields).sort()); current.observer.dispose();
});
const MembershipSnapshotFields = Object.freeze({ enabled: 'enabled', failure: 'failure', receipt: 'observedAtMilliseconds', status: 'status' });
test(Names.polling, async () => {
  const current = fixture(true, true); current.observer.setActive(false); current.observer.setObserving(true); await flushMicrotasks();
  assert.equal(current.calls.reads, Fixture.noCalls); current.observer.setActive(true); await flushMicrotasks();
  assert.equal(current.calls.reads, Fixture.oneCall); current.scheduler.advance(library.MembershipObservationPolicy.pollIntervalMilliseconds); await flushMicrotasks();
  assert.equal(current.calls.reads, Fixture.twoCalls); current.observer.setObserving(false); assert.equal(current.scheduler.callbacks.size, Fixture.noCalls); current.observer.dispose();
});
test(Names.hidden, async () => {
  const current = fixture(true, true); const pending = deferred(); current.state.read = () => pending.promise;
  current.observer.setObserving(true); await flushMicrotasks(); current.observer.setObserving(false); await flushMicrotasks();
  assert.equal(current.calls.signals[Fixture.firstPosition].aborted, true); assert.equal(current.client.getSnapshot().status, library.JamConnectionStatus.Ready);
  assert.equal(current.observer.getSnapshot().status, library.MembershipObservationStatus.Stale); pending.resolve(null); current.observer.dispose();
});
test(Names.background, async () => {
  const current = fixture(); await current.client.createOrActivateSession(Fixture.createRequest); const pending = deferred(); current.state.read = () => pending.promise;
  const reading = current.observer.refresh(); await flushMicrotasks(); current.observer.setActive(false); await reading; await flushMicrotasks();
  assert.equal(current.client.getSnapshot().session.identifier, Values.sessionIdentifier); assert.equal(current.client.getSnapshot().status, library.JamConnectionStatus.Ready);
  pending.resolve(null); current.observer.dispose();
});
test(Names.foreground, async () => {
  const current = fixture(true, true); current.observer.setObserving(true); await flushMicrotasks(); current.observer.setActive(false);
  current.state.read = async () => sessionResponse(); current.observer.setActive(true); await flushMicrotasks();
  assert.equal(current.client.getSnapshot().session.identifier, Values.sessionIdentifier); assert.equal(current.observer.getSnapshot().status, library.MembershipObservationStatus.Ready); current.observer.dispose();
});
test(Names.failedRead, async () => {
  const current = fixture(true, true); current.observer.setObserving(true); await flushMicrotasks(); const observed = current.observer.getSnapshot().observedAtMilliseconds;
  current.state.read = async () => { throw new library.IntegrationFailure(library.IntegrationFailureCode.Network); };
  current.scheduler.advance(library.MembershipObservationPolicy.pollIntervalMilliseconds); await flushMicrotasks();
  assert.equal(current.observer.getSnapshot().status, library.MembershipObservationStatus.Stale); assert.equal(current.observer.getSnapshot().observedAtMilliseconds, observed);
  assert.equal(current.scheduler.callbacks.size, Fixture.noCalls); current.state.read = async () => null; await current.observer.refresh();
  assert.equal(current.scheduler.callbacks.size, Fixture.oneCall); current.observer.dispose();
});
test(Names.retry, async () => {
  const current = fixture(true, true); current.state.read = async () => { throw new library.IntegrationFailure(library.IntegrationFailureCode.RateLimited, Fixture.retrySeconds); };
  current.observer.setObserving(true); await flushMicrotasks(); await current.observer.refresh(); assert.equal(current.calls.reads, Fixture.oneCall);
  current.observer.setActive(false); current.observer.setActive(true); current.state.read = async () => null;
  current.scheduler.advance(Fixture.retrySeconds * library.MembershipObservationPolicy.millisecondsPerSecond); await flushMicrotasks();
  assert.equal(current.calls.reads, Fixture.twoCalls); assert.equal(current.observer.getSnapshot().status, library.MembershipObservationStatus.Ready); current.observer.dispose();
});
test(Names.identifiers, async () => {
  const current = fixture(true, true); current.observer.setObserving(true); await flushMicrotasks();
  current.scheduler.advance(library.MembershipObservationPolicy.pollIntervalMilliseconds); await flushMicrotasks();
  assert.notEqual(current.calls.identifiers[Fixture.firstPosition], current.calls.identifiers[Fixture.oneCall]); assert.equal(current.calls.reads, Fixture.twoCalls); current.observer.dispose();
});
test(Names.duplicateIdentifier, async () => {
  const current = fixture(); current.identity.next = () => Fixture.firstRequest; await current.observer.refresh(); await current.observer.refresh();
  assert.equal(current.calls.reads, Fixture.oneCall); assert.equal(current.observer.getSnapshot().failure, library.IntegrationFailureCode.InvalidInput); current.observer.dispose();
});
test(Names.invalidIdentifier, async () => {
  for (const identifier of [Fixture.invalidRequest, Fixture.requestPrefix.repeat(library.MembershipObservationPolicy.maximumRequestCharacters)]) {
    const current = fixture(); current.identity.next = () => identifier; await current.observer.refresh();
    assert.equal(current.calls.reads, Fixture.noCalls); assert.equal(current.observer.getSnapshot().failure, library.IntegrationFailureCode.InvalidInput); current.observer.dispose();
  }
});
test(Names.boundedHistory, async () => {
  const current = fixture(); await current.observer.refresh(); const original = current.calls.identifiers[Fixture.firstPosition];
  for (let position = Fixture.firstPosition; position < library.MembershipObservationPolicy.recentRequestLimit; position += Fixture.countIncrement) await current.observer.refresh();
  const previous = current.calls.reads; current.identity.next = () => original; await current.observer.refresh();
  assert.equal(current.calls.reads, previous + Fixture.oneCall); assert.equal(current.observer.getSnapshot().status, library.MembershipObservationStatus.Ready); current.observer.dispose();
});
test(Names.accountChange, async () => {
  const current = fixture(); const pending = deferred(); current.state.read = () => pending.promise;
  const reading = current.observer.refresh(); await flushMicrotasks(); current.client.attachAccount(Values.otherAccountIdentifier, current.protocol); await reading;
  pending.resolve(sessionResponse()); await flushMicrotasks(); assert.equal(current.client.getSnapshot().accountIdentifier, Values.otherAccountIdentifier);
  assert.equal(current.client.getSnapshot().session, null); assert.equal(current.observer.getSnapshot().observedAtMilliseconds, null); current.observer.dispose();
});
test(Names.sameAccount, async () => {
  const current = fixture(); const pending = deferred(); current.state.read = () => pending.promise;
  const reading = current.observer.refresh(); await flushMicrotasks(); current.client.detachAccount(); current.client.attachAccount(Values.accountIdentifier, current.protocol); await reading;
  pending.resolve(sessionResponse()); await flushMicrotasks(); assert.equal(current.client.getSnapshot().session, null);
  assert.equal(current.observer.getSnapshot().observedAtMilliseconds, null); current.observer.dispose();
});
test(Names.dispose, async () => {
  const current = fixture(true, true); await current.client.createOrActivateSession(Fixture.createRequest); current.observer.setObserving(true); await flushMicrotasks();
  current.observer.dispose(); assert.equal(current.scheduler.callbacks.size, Fixture.noCalls); assert.equal(current.calls.ends, Fixture.noCalls);
  assert.equal(current.observer.getSnapshot().status, library.MembershipObservationStatus.Detached); await current.observer.refresh(); assert.equal(current.calls.reads, Fixture.oneCall);
});
test(Names.reentrant, async () => {
  const current = fixture(); current.observer.subscribe(() => {
    if (current.observer.getSnapshot().status === library.MembershipObservationStatus.Refreshing) current.observer.setActive(false);
  }); await current.observer.refresh(); assert.equal(current.calls.identifiers.length, Fixture.noCalls); assert.equal(current.calls.reads, Fixture.noCalls); current.observer.dispose();
});
test(Names.subscriberFailure, async () => {
  const current = fixture(); current.observer.subscribe(() => { throw new Error(Fixture.requestPrefix); }); await current.observer.refresh();
  assert.equal(current.observer.getSnapshot().status, library.MembershipObservationStatus.Ready); current.observer.dispose();
});
test(Names.emptyToCreated, async () => {
  const current = fixture(true, true); current.observer.setObserving(true); await flushMicrotasks(); current.state.read = async () => sessionResponse();
  current.scheduler.advance(library.MembershipObservationPolicy.pollIntervalMilliseconds); await flushMicrotasks();
  assert.equal(current.client.getSnapshot().session.identifier, Values.sessionIdentifier); assert.equal(current.calls.creates, Fixture.noCalls); assert.equal(current.calls.ends, Fixture.noCalls); current.observer.dispose();
});
test(Names.observerUncertain, async () => {
  const current = fixture(); current.state.create = async () => { throw new library.IntegrationFailure(library.IntegrationFailureCode.UnknownOutcome); };
  await current.client.createOrActivateSession(Fixture.createRequest); const pending = deferred(); current.state.read = () => pending.promise;
  const reading = current.observer.refresh(); await flushMicrotasks(); current.observer.setActive(false); await reading; await flushMicrotasks();
  assert.equal(current.client.getSnapshot().status, library.JamConnectionStatus.Uncertain);
  assert.equal((await current.client.createOrActivateSession(Fixture.secondCreateRequest)).failure, library.IntegrationFailureCode.UnknownOutcome);
  pending.resolve(null); current.observer.dispose();
});
test(Names.queueFence, async () => {
  const current = fixture(); current.state.read = async () => sessionResponse({ hostDeviceIdentifier: Fixture.host }); await current.observer.refresh();
  current.state.queue = async () => { throw new library.IntegrationFailure(library.IntegrationFailureCode.UnknownOutcome); };
  await current.client.addToQueue(Values.spotifyIdentifier, Fixture.queueRequest); await current.observer.refresh();
  current.state.queue = async () => undefined;
  assert.equal((await current.client.addToQueue(Values.spotifyIdentifier, Fixture.secondQueueRequest)).failure, library.IntegrationFailureCode.UnknownOutcome); current.observer.dispose();
});
test(Names.runtime, () => {
  let calls = Fixture.noCalls;
  const runtime = new library.SpotifyJamRuntime({ accountIdentifier: Values.accountIdentifier, enableMembershipObservation: true,
    membershipRequestIdentifiers: () => Fixture.firstRequest,
    credentials: { getCredentials: async () => credentials(), renewCredentials: async () => credentials() },
    endpoints: { resolveServiceOrigin: async () => Values.serviceOrigin }, clock: { nowMilliseconds: () => Values.nowMilliseconds },
    recordings: new library.QueryableRecordingCatalog(Values.catalogIdentity, library.RecordingNamespace.Local,
      { lookup: async () => song(), search: async () => [] }), associations: new library.MemoryAssociationStore(),
    requests: { execute: async () => { calls += Fixture.oneCall; return { status: Values.successStatus, body: null }; } },
  });
  assert.equal(runtime.membership.getSnapshot().enabled, true); assert.equal(calls, Fixture.noCalls); runtime.dispose();
  assert.equal(runtime.membership.getSnapshot().status, library.MembershipObservationStatus.Detached);
});

test(Names.silentAccount, async () => {
  const pending = deferred(); let accountIdentifier = Values.accountIdentifier;
  const observer = new library.JamMembershipObserver({ getSnapshot: () => ({ accountIdentifier,
    status: library.JamConnectionStatus.Ready, session: null, failure: null }), subscribe: () => () => undefined,
  refreshCurrentSession: () => pending.promise }, { nowMilliseconds: () => Values.nowMilliseconds }, true, () => Fixture.firstRequest);
  const reading = observer.refresh(); await flushMicrotasks(); accountIdentifier = Values.otherAccountIdentifier;
  pending.resolve({ applied: true, failure: null }); await reading;
  assert.equal(observer.getSnapshot().status, library.MembershipObservationStatus.Idle);
  assert.equal(observer.getSnapshot().observedAtMilliseconds, null); observer.dispose();
});

test(Names.staleFailure, async () => {
  const pending = deferred(); let accountIdentifier = Values.accountIdentifier;
  const observer = new library.JamMembershipObserver({ getSnapshot: () => ({ accountIdentifier,
    status: library.JamConnectionStatus.Ready, session: null, failure: null }), subscribe: () => () => undefined,
  refreshCurrentSession: () => pending.promise }, { nowMilliseconds: () => Values.nowMilliseconds }, true, () => Fixture.firstRequest);
  const reading = observer.refresh(); await flushMicrotasks(); accountIdentifier = Values.otherAccountIdentifier;
  pending.reject(new library.IntegrationFailure(library.IntegrationFailureCode.Network)); await reading;
  assert.equal(observer.getSnapshot().status, library.MembershipObservationStatus.Idle);
  assert.equal(observer.getSnapshot().failure, null); observer.dispose();
});

test(Names.duplicateCancelled, async () => {
  const current = fixture(); const pending = deferred(); current.state.create = () => pending.promise;
  const creating = current.client.createOrActivateSession(Fixture.createRequest); await flushMicrotasks(); const controller = cancellation();
  const first = current.client.refreshCurrentSession(Fixture.firstRequest, controller.signal);
  const second = current.client.refreshCurrentSession(Fixture.firstRequest, controller.signal); assert.equal(first, second);
  controller.abort(); const receipt = await first; assert.equal(receipt.failure, library.IntegrationFailureCode.Canceled);
  assert.equal(await current.client.refreshCurrentSession(Fixture.firstRequest), receipt);
  pending.resolve(sessionResponse()); await creating; await flushMicrotasks(); assert.equal(current.calls.reads, Fixture.noCalls); current.observer.dispose();
});

test(Names.invalidRetry, async () => {
  for (const retryAfterSeconds of [InvalidRetrySeconds, Number.POSITIVE_INFINITY, Number.NaN]) {
    const current = fixture(); current.state.read = async () => { throw new library.IntegrationFailure(library.IntegrationFailureCode.RateLimited, retryAfterSeconds); };
    assert.deepEqual(await current.client.refreshCurrentSession(Fixture.firstRequest), { applied: false, failure: library.IntegrationFailureCode.RateLimited }); current.observer.dispose();
  }
});
const InvalidRetrySeconds = -1;
