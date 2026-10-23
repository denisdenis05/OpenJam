import assert from 'node:assert/strict';
import test from 'node:test';
import { library, Values, ManualScheduler, cancellation, deferred, flushMicrotasks, credentials, song } from './fixtures.mjs';

const Fixture = Object.freeze({ host: 'verified-host', otherHost: 'other-host', session: 'observed-jam', otherSession: 'different-jam',
  trackIdentifier: '0123456789abcdefghijkl', episodeIdentifier: 'abcdefghijkl0123456789',
  trackUri: 'spotify:track:0123456789abcdefghijkl', episodeUri: 'spotify:episode:abcdefghijkl0123456789',
  title: 'Test track', author: 'Test artist', publisher: 'Test publisher', showName: 'Test show',
  changedTitle: 'Changed caller title', unknownKind: 'advertisement', decimalDuration: 1.5,
  playbackField: 'device', deviceField: 'id', retrySeconds: 30, excessCount: 101, boundedCount: 100,
  unsupportedStatus: 204, noCalls: 0, oneCall: 1, twoCalls: 2, threeCalls: 3, firstPosition: 0,
});
const Names = Object.freeze({
  reader: 'Hosted reader checks playback host before and after the queue request',
  beforeHost: 'A different active device prevents reading the unrelated account queue',
  afterHost: 'A changed playback device rejects a queue response before publication',
  inactiveDevice: 'An inactive matching playback device cannot establish a hosted queue',
  malformedDevice: 'A playback device without an active flag is not accepted as known active',
  unknownDevice: 'A valid nullable Spotify device identifier cannot establish host correlation',
  unavailable: 'Unavailable playback does not become an empty observed queue',
  readerCancellation: 'Cancellation between host checks prevents the next HTTP read',
  duplicates: 'Queue decoding preserves duplicate order and currently playing identity without occurrence IDs',
  episodes: 'Episode queue decoding retains publisher or show name and nullable duration',
  unknownKind: 'Unsupported queue item kinds are rejected rather than dropped',
  bounds: 'Oversized queue arrays fail while the exact configured bound is accepted',
  malformed: 'Malformed artist metadata URI kinds durations and absent queue fields are rejected',
  constructor: 'Observation construction starts no HTTP or polling work',
  disabled: 'Disabled observation never starts requests or timers',
  guest: 'Guest membership cannot observe an account queue as a shared Jam queue',
  missing: 'Absent membership cannot observe a hosted queue',
  inactive: 'Inactive membership cannot observe a hosted queue',
  hostRequired: 'Missing host identity cannot observe an arbitrary account queue',
  coalescing: 'Concurrent refresh calls coalesce into one operation',
  copies: 'Published queue snapshots copy and freeze injected reader values',
  failure: 'Failed refresh retains prior data as stale and never claims a fresh receipt',
  sessionChange: 'Session replacement aborts uncooperative observation and clears previous data',
  accountChange: 'Same session and host identifiers cannot carry data across account replacement',
  silentLogout: 'A silent account logout clears retained data before a failed manual refresh',
  beforeStart: 'A silent account change before scheduled execution prevents even a loading publication',
  silentChange: 'A host change without a notification cannot publish an old read',
  background: 'Backgrounding aborts pending reads and retains prior results as stale',
  backgroundManual: 'Manual refresh while backgrounded does not contact Spotify',
  dispose: 'Disposal cancels reads timers and session observation',
  noScheduler: 'Observation without a scheduler performs only explicit refresh',
  polling: 'Polling starts only while foreground and observing and stops when hidden',
  pauseFailure: 'A failed poll pauses automatic retries until an explicit successful refresh',
  rateLimited: 'Retry guidance throttles manual refresh and resume until its deadline',
  sessionAppears: 'A newly created valid Jam resumes observation after initial absence',
  hostAppears: 'An actual host becoming available resumes observation after an unsupported target',
  changedHostRate: 'Changed host identity cannot bypass an existing account rate limit deadline',
  reentrant: 'A subscriber suspending loading prevents the reader from starting',
  invalidInjected: 'Malformed injected observation values fail with a typed response error',
  listener: 'Subscriber failures and removed subscribers cannot break publication',
  runtime: 'Runtime observation opt in and disposal perform no eager network work',
});

function track(overrides = {}) {
  return { type: library.HostedQueueItemKind.Track, uri: Fixture.trackUri, name: Fixture.title,
    artists: [{ name: Fixture.author }], duration_ms: Values.durationMilliseconds, ...overrides };
}
function entry(overrides = {}) {
  return { uri: Fixture.trackUri, kind: library.HostedQueueItemKind.Track, title: Fixture.title,
    author: Fixture.author, durationMilliseconds: Values.durationMilliseconds, ...overrides };
}
function response() { return { currentlyPlaying: entry(), entries: [entry(), entry()] }; }
function wire(overrides = {}) { return { currently_playing: track(), queue: [track(), track()], ...overrides }; }
function readerFixture() {
  const addresses = []; const state = { playback: async () => ({ device: { id: Fixture.host, is_active: true } }), queue: async () => wire() };
  const reader = new library.SpotifyWebHostedQueueReader({ read: async (address, signal) => {
    addresses.push(address); return address === library.HostedQueueEndpoints.queue ? state.queue(signal) : state.playback(signal);
  } });
  return { addresses, state, reader };
}
function fixture(enabled = true, polling = false) {
  const scheduler = new ManualScheduler(); const listeners = new Set(); const signals = [];
  const state = { snapshot: { accountIdentifier: Values.accountIdentifier, status: library.JamConnectionStatus.Ready, failure: null,
    session: { identifier: Fixture.session, hostDeviceIdentifier: Fixture.host, ownedByCurrentAccount: true, active: true, participants: [] } },
  read: async () => response() };
  const reader = { read: async (host, signal) => { assert.equal(host, state.snapshot.session.hostDeviceIdentifier); signals.push(signal); return state.read(signal); } };
  const observer = new library.HostedQueueObserver({ getSnapshot: () => state.snapshot,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); } }, reader,
  { nowMilliseconds: () => scheduler.nowMilliseconds }, enabled, polling ? scheduler : undefined);
  return { observer, state, scheduler, signals, listeners, change(snapshot) {
    state.snapshot = snapshot; for (const listener of [...listeners]) listener();
  } };
}

test(Names.reader, async () => {
  const current = readerFixture(); const result = await current.reader.read(Fixture.host, cancellation().signal);
  assert.deepEqual(current.addresses, [library.HostedQueueEndpoints.playback, library.HostedQueueEndpoints.queue, library.HostedQueueEndpoints.playback]);
  assert.equal(result.entries.length, Fixture.twoCalls);
});
test(Names.beforeHost, async () => {
  const current = readerFixture(); current.state.playback = async () => ({ device: { id: Fixture.otherHost, is_active: true } });
  await assert.rejects(current.reader.read(Fixture.host, cancellation().signal), { code: library.IntegrationFailureCode.Forbidden });
  assert.equal(current.addresses.length, Fixture.oneCall);
});
test(Names.afterHost, async () => {
  const current = readerFixture(); let calls = Fixture.noCalls;
  current.state.playback = async () => { calls += Fixture.oneCall; return { device: { id: calls === Fixture.oneCall ? Fixture.host : Fixture.otherHost, is_active: true } }; };
  await assert.rejects(current.reader.read(Fixture.host, cancellation().signal), { code: library.IntegrationFailureCode.Forbidden });
  assert.equal(current.addresses.length, Fixture.threeCalls);
});
test(Names.unavailable, async () => {
  const current = readerFixture(); current.state.playback = async () => null;
  await assert.rejects(current.reader.read(Fixture.host, cancellation().signal), { code: library.IntegrationFailureCode.Unsupported });
  assert.equal(current.addresses.length, Fixture.oneCall);
});
test(Names.inactiveDevice, async () => {
  const current = readerFixture(); current.state.playback = async () => ({ device: { id: Fixture.host, is_active: false } });
  await assert.rejects(current.reader.read(Fixture.host, cancellation().signal), { code: library.IntegrationFailureCode.Unsupported });
  assert.equal(current.addresses.length, Fixture.oneCall);
});
test(Names.malformedDevice, async () => {
  const current = readerFixture(); current.state.playback = async () => ({ device: { id: Fixture.host } });
  await assert.rejects(current.reader.read(Fixture.host, cancellation().signal), { code: library.IntegrationFailureCode.InvalidResponse });
  assert.equal(current.addresses.length, Fixture.oneCall);
});
test(Names.unknownDevice, async () => {
  const current = readerFixture(); current.state.playback = async () => ({ device: { id: null, is_active: true } });
  await assert.rejects(current.reader.read(Fixture.host, cancellation().signal), { code: library.IntegrationFailureCode.Unsupported });
  assert.equal(current.addresses.length, Fixture.oneCall);
});
test(Names.readerCancellation, async () => {
  const current = readerFixture(); const controller = cancellation(); current.state.queue = async () => { controller.abort(); return wire(); };
  await assert.rejects(current.reader.read(Fixture.host, controller.signal), { code: library.IntegrationFailureCode.Canceled });
  assert.equal(current.addresses.length, Fixture.twoCalls);
});
test(Names.duplicates, () => {
  const result = library.decodeHostedQueue(wire());
  assert.equal(result.currentlyPlaying.uri, Fixture.trackUri); assert.deepEqual(result.entries.map(value => value.uri), [Fixture.trackUri, Fixture.trackUri]);
  assert.deepEqual(Object.keys(result.entries[Fixture.firstPosition]).sort(), Object.keys(entry()).sort());
});
test(Names.episodes, () => {
  for (const show of [{ publisher: Fixture.publisher }, { name: Fixture.showName }]) {
    const episode = { type: library.HostedQueueItemKind.Episode, uri: Fixture.episodeUri, name: Fixture.title, show };
    const result = library.decodeHostedQueue(wire({ currently_playing: null, queue: [episode] }));
    assert.equal(result.currentlyPlaying, null); assert.equal(result.entries[Fixture.firstPosition].kind, library.HostedQueueItemKind.Episode);
    assert.equal(result.entries[Fixture.firstPosition].durationMilliseconds, null);
    assert.equal(result.entries[Fixture.firstPosition].author, show.publisher ?? show.name);
  }
});
test(Names.unknownKind, () => {
  assert.throws(() => library.decodeHostedQueue(wire({ queue: [track({ type: Fixture.unknownKind })] })), { code: library.IntegrationFailureCode.InvalidResponse });
});
test(Names.bounds, () => {
  assert.throws(() => library.decodeHostedQueue(wire({ queue: Array.from({ length: Fixture.excessCount }, () => track()) })),
    { code: library.IntegrationFailureCode.InvalidResponse });
  assert.equal(library.decodeHostedQueue(wire({ queue: Array.from({ length: Fixture.boundedCount }, () => track()) })).entries.length, Fixture.boundedCount);
});
test(Names.malformed, () => {
  const invalid = [wire({ queue: undefined }), wire({ currently_playing: undefined }), wire({ queue: [track({ artists: [] })] }),
    wire({ queue: [track({ duration_ms: Fixture.decimalDuration })] }), wire({ queue: [track({ uri: Fixture.episodeUri })] }),
    wire({ queue: [track({ name: null })] }), wire({ queue: [track({ artists: [{ name: null }] })] })];
  for (const value of invalid) assert.throws(() => library.decodeHostedQueue(value), { code: library.IntegrationFailureCode.InvalidResponse });
});
test(Names.constructor, () => {
  const current = fixture(true, true); assert.equal(current.signals.length, Fixture.noCalls); assert.equal(current.scheduler.callbacks.size, Fixture.noCalls);
  assert.equal(current.observer.getSnapshot().status, library.HostedQueueStatus.Idle); current.observer.dispose();
});
test(Names.disabled, async () => {
  const current = fixture(false, true); current.observer.setObserving(true); await current.observer.refresh();
  assert.equal(current.signals.length, Fixture.noCalls); assert.equal(current.scheduler.callbacks.size, Fixture.noCalls);
  assert.equal(current.observer.getSnapshot().status, library.HostedQueueStatus.Detached); current.observer.dispose();
});
test(Names.guest, async () => {
  const current = fixture(); current.state.snapshot.session.ownedByCurrentAccount = false; await current.observer.refresh();
  assert.equal(current.signals.length, Fixture.noCalls); assert.equal(current.observer.getSnapshot().failure, library.IntegrationFailureCode.Forbidden); current.observer.dispose();
});
test(Names.missing, async () => {
  const current = fixture(); current.state.snapshot.session = null; await current.observer.refresh();
  assert.equal(current.signals.length, Fixture.noCalls); assert.equal(current.observer.getSnapshot().failure, library.IntegrationFailureCode.NotFound); current.observer.dispose();
});
test(Names.inactive, async () => {
  const current = fixture(); current.state.snapshot.session.active = false; await current.observer.refresh();
  assert.equal(current.signals.length, Fixture.noCalls); assert.equal(current.observer.getSnapshot().failure, library.IntegrationFailureCode.Unsupported); current.observer.dispose();
});
test(Names.hostRequired, async () => {
  const current = fixture(); delete current.state.snapshot.session.hostDeviceIdentifier; await current.observer.refresh();
  assert.equal(current.signals.length, Fixture.noCalls); assert.equal(current.observer.getSnapshot().failure, library.IntegrationFailureCode.Unsupported); current.observer.dispose();
});
test(Names.coalescing, async () => {
  const current = fixture(); const pending = deferred(); current.state.read = () => pending.promise;
  const first = current.observer.refresh(); const second = current.observer.refresh(); assert.equal(first, second); await flushMicrotasks();
  assert.equal(current.signals.length, Fixture.oneCall); pending.resolve(response()); await first; current.observer.dispose();
});
test(Names.copies, async () => {
  const current = fixture(); const result = response(); current.state.read = async () => result; await current.observer.refresh();
  result.entries[Fixture.firstPosition].title = Fixture.changedTitle; result.entries.splice(Fixture.firstPosition);
  const snapshot = current.observer.getSnapshot(); assert.equal(snapshot.status, library.HostedQueueStatus.Ready);
  assert.equal(snapshot.entries.length, Fixture.twoCalls); assert.equal(snapshot.entries[Fixture.firstPosition].title, Fixture.title);
  assert.ok(Object.isFrozen(snapshot)); assert.ok(Object.isFrozen(snapshot.entries)); assert.ok(Object.isFrozen(snapshot.entries[Fixture.firstPosition]));
  assert.equal(snapshot.observedAtMilliseconds, current.scheduler.nowMilliseconds); current.observer.dispose();
});
test(Names.failure, async () => {
  const current = fixture(); await current.observer.refresh(); const observed = current.observer.getSnapshot().observedAtMilliseconds;
  current.state.read = async () => { throw new library.IntegrationFailure(library.IntegrationFailureCode.Network); }; await current.observer.refresh();
  assert.equal(current.observer.getSnapshot().status, library.HostedQueueStatus.Stale);
  assert.equal(current.observer.getSnapshot().entries.length, Fixture.twoCalls); assert.equal(current.observer.getSnapshot().observedAtMilliseconds, observed); current.observer.dispose();
});
test(Names.sessionChange, async () => {
  const current = fixture(); const pending = deferred(); current.state.read = () => pending.promise;
  const reading = current.observer.refresh(); await flushMicrotasks(); current.change({ ...current.state.snapshot,
    session: { ...current.state.snapshot.session, identifier: Fixture.otherSession } }); await reading; pending.resolve(response()); await flushMicrotasks();
  assert.equal(current.signals[Fixture.firstPosition].aborted, true); assert.equal(current.observer.getSnapshot().entries.length, Fixture.noCalls); current.observer.dispose();
});
test(Names.accountChange, async () => {
  const current = fixture(); await current.observer.refresh(); current.change({ ...current.state.snapshot, accountIdentifier: Values.otherAccountIdentifier });
  assert.equal(current.observer.getSnapshot().entries.length, Fixture.noCalls); assert.equal(current.observer.getSnapshot().observedAtMilliseconds, null); current.observer.dispose();
});
test(Names.silentLogout, async () => {
  const current = fixture(); await current.observer.refresh();
  current.state.snapshot = { accountIdentifier: null, session: null, status: library.JamConnectionStatus.Detached, failure: null };
  await current.observer.refresh(); assert.equal(current.observer.getSnapshot().entries.length, Fixture.noCalls);
  assert.equal(current.observer.getSnapshot().observedAtMilliseconds, null);
  assert.equal(current.observer.getSnapshot().failure, library.IntegrationFailureCode.Unauthorized); current.observer.dispose();
});
test(Names.beforeStart, async () => {
  const current = fixture(); const statuses = []; current.observer.subscribe(() => statuses.push(current.observer.getSnapshot().status));
  const reading = current.observer.refresh(); current.state.snapshot.accountIdentifier = Values.otherAccountIdentifier; await reading;
  assert.equal(current.signals.length, Fixture.noCalls); assert.equal(statuses.includes(library.HostedQueueStatus.Loading), false); current.observer.dispose();
});
test(Names.silentChange, async () => {
  const current = fixture(); const pending = deferred(); current.state.read = () => pending.promise;
  const reading = current.observer.refresh(); await flushMicrotasks(); current.state.snapshot.session.hostDeviceIdentifier = Fixture.otherHost;
  pending.resolve(response()); await reading; assert.equal(current.observer.getSnapshot().entries.length, Fixture.noCalls); current.observer.dispose();
});
test(Names.background, async () => {
  const current = fixture(); await current.observer.refresh(); const pending = deferred(); current.state.read = () => pending.promise;
  const reading = current.observer.refresh(); await flushMicrotasks(); current.observer.setActive(false); await reading;
  assert.equal(current.signals.at(Fixture.oneCall).aborted, true); assert.equal(current.observer.getSnapshot().status, library.HostedQueueStatus.Stale);
  assert.equal(current.observer.getSnapshot().entries.length, Fixture.twoCalls); pending.resolve(response()); current.observer.dispose();
});
test(Names.backgroundManual, async () => {
  const current = fixture(); current.observer.setActive(false); await current.observer.refresh();
  assert.equal(current.signals.length, Fixture.noCalls); current.observer.dispose();
});
test(Names.dispose, async () => {
  const current = fixture(true, true); const pending = deferred(); current.state.read = () => pending.promise;
  current.observer.setObserving(true); await flushMicrotasks(); current.observer.dispose(); await flushMicrotasks(); pending.resolve(response());
  assert.equal(current.listeners.size, Fixture.noCalls); assert.equal(current.scheduler.callbacks.size, Fixture.noCalls);
  assert.equal(current.observer.getSnapshot().status, library.HostedQueueStatus.Detached); await current.observer.refresh();
  assert.equal(current.signals.length, Fixture.oneCall);
});
test(Names.noScheduler, async () => {
  const current = fixture(); current.observer.setObserving(true); await flushMicrotasks(); assert.equal(current.signals.length, Fixture.noCalls);
  await current.observer.refresh(); assert.equal(current.signals.length, Fixture.oneCall); current.observer.dispose();
});
test(Names.polling, async () => {
  const current = fixture(true, true); current.observer.setActive(false); current.observer.setObserving(true); await flushMicrotasks();
  assert.equal(current.signals.length, Fixture.noCalls); current.observer.setActive(true); await flushMicrotasks();
  assert.equal(current.signals.length, Fixture.oneCall); assert.equal(current.scheduler.callbacks.size, Fixture.oneCall);
  current.scheduler.advance(library.HostedQueuePolicy.pollIntervalMilliseconds); await flushMicrotasks(); assert.equal(current.signals.length, Fixture.twoCalls);
  current.observer.setObserving(false); assert.equal(current.scheduler.callbacks.size, Fixture.noCalls); current.observer.dispose();
});
test(Names.pauseFailure, async () => {
  const current = fixture(true, true); current.observer.setObserving(true); await flushMicrotasks();
  current.state.read = async () => { throw new library.IntegrationFailure(library.IntegrationFailureCode.Network); };
  current.scheduler.advance(library.HostedQueuePolicy.pollIntervalMilliseconds); await flushMicrotasks();
  assert.equal(current.scheduler.callbacks.size, Fixture.noCalls); const count = current.signals.length;
  current.scheduler.advance(library.HostedQueuePolicy.pollIntervalMilliseconds); await flushMicrotasks(); assert.equal(current.signals.length, count);
  current.state.read = async () => response(); await current.observer.refresh(); assert.equal(current.scheduler.callbacks.size, Fixture.oneCall); current.observer.dispose();
});
test(Names.rateLimited, async () => {
  const current = fixture(true, true); current.state.read = async () => { throw new library.IntegrationFailure(library.IntegrationFailureCode.RateLimited, Fixture.retrySeconds); };
  current.observer.setObserving(true); await flushMicrotasks(); await current.observer.refresh(); assert.equal(current.signals.length, Fixture.oneCall);
  assert.equal(current.scheduler.callbacks.size, Fixture.noCalls); current.observer.setActive(false); current.observer.setActive(true);
  assert.equal(current.scheduler.callbacks.size, Fixture.oneCall); current.state.read = async () => response();
  current.scheduler.advance(Fixture.retrySeconds * library.HostedQueuePolicy.millisecondsPerSecond); await flushMicrotasks();
  assert.equal(current.signals.length, Fixture.twoCalls); assert.equal(current.observer.getSnapshot().status, library.HostedQueueStatus.Ready); current.observer.dispose();
});
test(Names.sessionAppears, async () => {
  const current = fixture(true, true); const session = current.state.snapshot.session; current.state.snapshot.session = null;
  current.observer.setObserving(true); await flushMicrotasks(); assert.equal(current.signals.length, Fixture.noCalls);
  current.change({ ...current.state.snapshot, session }); await flushMicrotasks();
  assert.equal(current.signals.length, Fixture.oneCall); assert.equal(current.observer.getSnapshot().status, library.HostedQueueStatus.Ready); current.observer.dispose();
});
test(Names.hostAppears, async () => {
  const current = fixture(true, true); delete current.state.snapshot.session.hostDeviceIdentifier;
  current.observer.setObserving(true); await flushMicrotasks(); assert.equal(current.signals.length, Fixture.noCalls);
  current.change({ ...current.state.snapshot, session: { ...current.state.snapshot.session, hostDeviceIdentifier: Fixture.host } }); await flushMicrotasks();
  assert.equal(current.signals.length, Fixture.oneCall); assert.equal(current.observer.getSnapshot().status, library.HostedQueueStatus.Ready); current.observer.dispose();
});
test(Names.changedHostRate, async () => {
  const current = fixture(true, true); current.state.read = async () => { throw new library.IntegrationFailure(library.IntegrationFailureCode.RateLimited, Fixture.retrySeconds); };
  current.observer.setObserving(true); await flushMicrotasks(); current.state.read = async () => response();
  current.change({ ...current.state.snapshot, session: { ...current.state.snapshot.session, hostDeviceIdentifier: Fixture.otherHost } });
  await flushMicrotasks(); assert.equal(current.signals.length, Fixture.oneCall);
  current.scheduler.advance(Fixture.retrySeconds * library.HostedQueuePolicy.millisecondsPerSecond); await flushMicrotasks();
  assert.equal(current.signals.length, Fixture.twoCalls); current.observer.dispose();
});
test(Names.reentrant, async () => {
  const current = fixture(); current.observer.subscribe(() => {
    if (current.observer.getSnapshot().status === library.HostedQueueStatus.Loading) current.observer.setActive(false);
  }); await current.observer.refresh(); assert.equal(current.signals.length, Fixture.noCalls); current.observer.dispose();
});
test(Names.invalidInjected, async () => {
  const current = fixture(); current.state.read = async () => ({ currentlyPlaying: null, entries: [null] }); await current.observer.refresh();
  assert.equal(current.observer.getSnapshot().failure, library.IntegrationFailureCode.InvalidResponse); current.observer.dispose();
});
test(Names.listener, async () => {
  const current = fixture(); let calls = Fixture.noCalls;
  const removed = current.observer.subscribe(() => { calls += Fixture.oneCall; }); removed();
  current.observer.subscribe(() => { throw new Error(Fixture.title); }); await current.observer.refresh();
  assert.equal(current.observer.getSnapshot().status, library.HostedQueueStatus.Ready); assert.equal(calls, Fixture.noCalls); current.observer.dispose();
});
test(Names.runtime, () => {
  let calls = Fixture.noCalls;
  const runtime = new library.SpotifyJamRuntime({ accountIdentifier: Values.accountIdentifier, enableHostedQueueObservation: true,
    credentials: { getCredentials: async () => credentials(), renewCredentials: async () => credentials() },
    endpoints: { resolveServiceOrigin: async () => Values.serviceOrigin }, clock: { nowMilliseconds: () => Values.nowMilliseconds },
    recordings: new library.QueryableRecordingCatalog(Values.catalogIdentity, library.RecordingNamespace.Local,
      { lookup: async () => song(), search: async () => [] }), associations: new library.MemoryAssociationStore(),
    requests: { execute: async () => { calls += Fixture.oneCall; return { status: Values.successStatus, body: null }; } },
  });
  assert.equal(runtime.hostedQueue.getSnapshot().enabled, true); assert.equal(calls, Fixture.noCalls); runtime.dispose();
  assert.equal(runtime.hostedQueue.getSnapshot().status, library.HostedQueueStatus.Detached);
});
