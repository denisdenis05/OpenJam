import test from 'node:test';
import assert from 'node:assert/strict';
import { library, Values, cancellation, credentials, deferred, flushMicrotasks, song } from './fixtures.mjs';

const Fixture = Object.freeze({ host: 'controlled-host', otherHost: 'unrelated-device', track: Values.spotifyIdentifier,
  episode: 'episode', prefix: 'spotify:track:', trackType: 'track', now: 10000, returned: 10200, midpoint: 10100,
  position: 12000, duration: 200000, oldChange: 1, uncertainty: 100, zero: 0, one: 1, negative: -1,
  unsupportedBody: null, recordingError: 'Unexported database detail',
  names: Object.freeze({ sample: 'Host playback reads track progress and active device through the documented account endpoint',
    midpoint: 'Playback sampling uses local request midpoint and round trip uncertainty',
    timestamp: 'An old last change timestamp does not make a fresh paused observation stale',
    foreign: 'An unrelated active device cannot supply the Jam playback clock',
    unavailable: 'Absent playback unknown progress inactive devices episodes local and unavailable tracks cannot drive playback',
    malformed: 'Malformed booleans identifiers times and out of bounds progress fail closed',
    delayed: 'An excessive round trip or reversed monotonic clock rejects the sample',
    cancellation: 'Cancellation retires an uncooperative playback response',
    immutable: 'Returned playback samples are immutable copies',
    noConstructor: 'Runtime construction starts no playback request',
    guard: 'Runtime playback reads require an active owned Jam and its actual host',
    guest: 'Guest membership does not enable public host playback following',
    hostless: 'A Jam without an active host cannot read unrelated account playback',
    retired: 'Changing membership retires an in flight host playback read',
    disposed: 'Runtime disposal prevents playback and recording reads',
    recording: 'Runtime recording lookup copies the requested local recording',
    changedAccount: 'Changing the session account cannot read playback with the retired runtime credentials',
    lookupFailure: 'Recording lookup errors are sanitized and wrong recording identities are rejected' }) });
function body(overrides = {}) { return { device: { id: Fixture.host, is_active: true }, is_playing: true,
  progress_ms: Fixture.position, timestamp: Fixture.oldChange, item: { id: Fixture.track, uri: Fixture.prefix + Fixture.track,
    type: Fixture.trackType, is_local: false, duration_ms: Fixture.duration }, ...overrides }; }
function failure(code) { return value => value instanceof library.IntegrationFailure && value.code === code; }
function fixture() {
  const state = { now: Fixture.now, response: body(), requests: [] };
  const reader = new library.SpotifyWebPlaybackReader({ read: async (address, signal) => { state.requests.push({ address, signal }); state.now = Fixture.returned; return state.response; } },
    { nowMonotonicMilliseconds: () => state.now });
  return { state, reader };
}
function runtimeFixture(overrides = {}) {
  const state = { response: body(), requests: [], recording: song() };
  const runtime = new library.SpotifyJamRuntime({ accountIdentifier: Values.accountIdentifier,
    credentials: { getCredentials: async () => credentials(), renewCredentials: async () => credentials() },
    endpoints: { resolveServiceOrigin: async () => Values.serviceOrigin }, associations: new library.MemoryAssociationStore(),
    recordings: { identity: Values.catalogIdentity, namespace: library.RecordingNamespace.Local,
      lookup: async () => state.recording, search: async () => [] }, clock: { nowMilliseconds: () => Values.nowMilliseconds },
    playbackClock: { nowMonotonicMilliseconds: () => Fixture.now },
    requests: { execute: async request => { state.requests.push(request); return { status: Values.successStatus, body: await state.response }; } }, ...overrides });
  runtime.sessions.attachAccount(Values.accountIdentifier, { createOrActivate: async () => ({ session: { identifier: Values.sessionIdentifier,
    ownedByCurrentAccount: true, active: true, participants: [], hostDeviceIdentifier: Fixture.host }, invitation: null }), end: async () => undefined });
  return { runtime, state };
}
test(Fixture.names.sample, async () => { const current = fixture(); const sample = await current.reader.read(Fixture.host, cancellation().signal);
  assert.equal(current.state.requests[Fixture.zero].address, library.HostedPlaybackPolicy.address); assert.equal(sample.spotifyTrackIdentifier, Fixture.track);
  assert.equal(sample.positionMilliseconds, Fixture.position); });
test(Fixture.names.midpoint, async () => { const current = fixture(); const sample = await current.reader.read(Fixture.host, cancellation().signal);
  assert.equal(sample.anchorMonotonicMilliseconds, Fixture.midpoint); assert.equal(sample.uncertaintyMilliseconds, Fixture.uncertainty); assert.equal(sample.observedMonotonicMilliseconds, Fixture.returned); });
test(Fixture.names.timestamp, async () => { const current = fixture(); current.state.response = body({ is_playing: false }); const sample = await current.reader.read(Fixture.host, cancellation().signal);
  assert.equal(sample.playing, false); assert.equal(sample.stateChangedAtUnixMilliseconds, Fixture.oldChange); assert.equal(sample.positionMilliseconds, Fixture.position); });
test(Fixture.names.foreign, async () => { const current = fixture(); await assert.rejects(current.reader.read(Fixture.otherHost, cancellation().signal), failure(library.IntegrationFailureCode.Forbidden)); });
test(Fixture.names.unavailable, async () => { for (const response of [null, body({ progress_ms: null }), body({ device: { id: Fixture.host, is_active: false } }),
  body({ item: { ...body().item, type: Fixture.episode } }), body({ item: { ...body().item, is_local: true } }), body({ item: { ...body().item, is_playable: false } })]) {
  const current = fixture(); current.state.response = response; await assert.rejects(current.reader.read(Fixture.host, cancellation().signal)); } });
test(Fixture.names.malformed, async () => { for (const response of [body({ is_playing: Fixture.one }), body({ progress_ms: Number.NaN }), body({ timestamp: Fixture.negative }),
  body({ progress_ms: Fixture.duration + Fixture.one }), body({ item: { ...body().item, uri: Fixture.prefix } })]) {
  const current = fixture(); current.state.response = response; await assert.rejects(current.reader.read(Fixture.host, cancellation().signal), failure(library.IntegrationFailureCode.InvalidResponse)); } });
test(Fixture.names.delayed, async () => { for (const before of [Fixture.zero, Fixture.returned + Fixture.one]) { const current = fixture(); current.state.now = before;
  await assert.rejects(current.reader.read(Fixture.host, cancellation().signal), failure(library.IntegrationFailureCode.Deadline)); } });
test(Fixture.names.cancellation, async () => { const pending = deferred(); const signal = cancellation(); const reader = new library.SpotifyWebPlaybackReader({ read: () => pending.promise }, { nowMonotonicMilliseconds: () => Fixture.now });
  const reading = reader.read(Fixture.host, signal.signal); signal.abort(); pending.resolve(body()); await assert.rejects(reading, failure(library.IntegrationFailureCode.Canceled)); });
test(Fixture.names.immutable, async () => { const current = fixture(); const sample = await current.reader.read(Fixture.host, cancellation().signal); current.state.response.progress_ms = Fixture.zero;
  assert.ok(Object.isFrozen(sample)); assert.equal(sample.positionMilliseconds, Fixture.position); });
test(Fixture.names.noConstructor, () => { const current = runtimeFixture(); assert.equal(current.state.requests.length, Fixture.zero); current.runtime.dispose(); });
test(Fixture.names.guard, async () => { const current = runtimeFixture(); await assert.rejects(current.runtime.readHostedPlayback(cancellation().signal), failure(library.IntegrationFailureCode.NotFound));
  await current.runtime.sessions.createOrActivateSession(Values.createRequestIdentifier); const sample = await current.runtime.readHostedPlayback(cancellation().signal);
  assert.equal(sample.authorityIdentifier, Fixture.host); assert.equal(sample.sessionIdentifier, Values.sessionIdentifier); current.runtime.dispose(); });
test(Fixture.names.guest, async () => { const current = runtimeFixture(); current.runtime.sessions.attachAccount(Values.accountIdentifier, { createOrActivate: async () => ({ session: {
  identifier: Values.sessionIdentifier, ownedByCurrentAccount: false, active: true, participants: [], hostDeviceIdentifier: Fixture.host }, invitation: null }), end: async () => undefined });
  await current.runtime.sessions.createOrActivateSession(Values.createRequestIdentifier); await assert.rejects(current.runtime.readHostedPlayback(cancellation().signal), failure(library.IntegrationFailureCode.Forbidden));
  assert.equal(current.state.requests.length, Fixture.zero); current.runtime.dispose(); });
test(Fixture.names.hostless, async () => { const current = runtimeFixture(); current.runtime.sessions.attachAccount(Values.accountIdentifier, { createOrActivate: async () => ({ session: {
  identifier: Values.sessionIdentifier, ownedByCurrentAccount: true, active: true, participants: [] }, invitation: null }), end: async () => undefined });
  await current.runtime.sessions.createOrActivateSession(Values.createRequestIdentifier); await assert.rejects(current.runtime.readHostedPlayback(cancellation().signal), failure(library.IntegrationFailureCode.Unsupported)); current.runtime.dispose(); });
test(Fixture.names.retired, async () => { const current = runtimeFixture(); await current.runtime.sessions.createOrActivateSession(Values.createRequestIdentifier); const pending = deferred(); current.state.response = pending.promise;
  const reading = current.runtime.readHostedPlayback(cancellation().signal); await flushMicrotasks(); current.runtime.sessions.detachAccount(); pending.resolve(body());
  await assert.rejects(reading, failure(library.IntegrationFailureCode.Superseded)); current.runtime.dispose(); });
test(Fixture.names.disposed, async () => { const current = runtimeFixture(); current.runtime.dispose(); await assert.rejects(current.runtime.readHostedPlayback(cancellation().signal), failure(library.IntegrationFailureCode.Canceled));
  await assert.rejects(current.runtime.lookupRecording(Values.recordingIdentifier, cancellation().signal), failure(library.IntegrationFailureCode.Canceled)); });
test(Fixture.names.recording, async () => { const current = runtimeFixture(); const recording = await current.runtime.lookupRecording(Values.recordingIdentifier, cancellation().signal);
  assert.equal(recording.identifier, Values.recordingIdentifier); assert.ok(Object.isFrozen(recording)); current.runtime.dispose(); });
test(Fixture.names.lookupFailure, async () => { const current = runtimeFixture({ recordings: { lookup: async () => { throw new Error(Fixture.recordingError); } } });
  await assert.rejects(current.runtime.lookupRecording(Values.recordingIdentifier, cancellation().signal), failure(library.IntegrationFailureCode.Network)); current.runtime.dispose();
  const wrong = runtimeFixture(); wrong.state.recording = song({ identifier: Values.otherRecordingIdentifier }); await assert.rejects(wrong.runtime.lookupRecording(Values.recordingIdentifier, cancellation().signal), failure(library.IntegrationFailureCode.InvalidResponse)); wrong.runtime.dispose(); });
test(Fixture.names.changedAccount, async () => { const current = runtimeFixture(); current.runtime.sessions.attachAccount(Values.otherAccountIdentifier, {
  createOrActivate: async () => ({ session: { identifier: Values.sessionIdentifier, ownedByCurrentAccount: true, active: true, participants: [], hostDeviceIdentifier: Fixture.host }, invitation: null }), end: async () => undefined });
  await current.runtime.sessions.createOrActivateSession(Values.createRequestIdentifier); await assert.rejects(current.runtime.readHostedPlayback(cancellation().signal), failure(library.IntegrationFailureCode.Superseded));
  assert.equal(current.state.requests.length, Fixture.zero); current.runtime.dispose(); });
