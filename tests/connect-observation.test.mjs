import assert from 'node:assert/strict';
import test from 'node:test';
import { library, Values, cancellation } from './fixtures.mjs';

const Fixture = Object.freeze({ handle: 4, generation: 2, host: 'synthetic-host', otherHost: 'replacement-host',
  occurrence: 'synthetic-current-occurrence', otherOccurrence: 'synthetic-next-occurrence', provider: 'queue', revision: 'synthetic-queue-revision',
  sent: 1000, received: 1100, nativeStart: 8, nativeEnd: 25, nativeSample: 28, epoch: 1700000000000,
  sourceElapsed: 3000, sourcePosition: 12000, duration: 180000, zero: 0, one: 1, two: 2, excessiveRoundTrip: 2000,
  trackPrefix: 'spotify:track:', pausedField: 'paused', bufferingField: 'buffering', handleField: 'handle', generationField: 'generation',
  names: { timing: 'Fresh private observations advance source positions using server time within the measured request interval',
    pause: 'Paused or buffering Connect state never advances despite is_playing remaining true',
    occurrence: 'Private queue observations preserve repeated track occurrence identities and freeze their values',
    bounds: 'Private observation boundaries reject foreign handles generations hosts unsafe clocks and slow requests',
    unavailable: 'Missing track occurrences unavailable source clocks and unsupported playback speeds cannot drive local audio',
    reader: 'Native playback reader retains the account binding and uses the observed timing sample' } });
function boundary(overrides = {}) { return { handle: Fixture.handle, generation: Fixture.generation, hostDeviceIdentifier: Fixture.host,
  sentMonotonicMilliseconds: Fixture.sent, receivedMonotonicMilliseconds: Fixture.received, ...overrides }; }
function track(occurrenceIdentifier = Fixture.occurrence) { return { uri: Fixture.trackPrefix + Values.spotifyIdentifier, occurrenceIdentifier, provider: Fixture.provider }; }
function response() { return { handle: Fixture.handle, generation: Fixture.generation, sampledNativeMonotonicMilliseconds: Fixture.nativeSample,
  reading: { requestStartedNativeMonotonicMilliseconds: Fixture.nativeStart, requestCompletedNativeMonotonicMilliseconds: Fixture.nativeEnd,
    cluster: { activeDeviceIdentifier: Fixture.host, serverAtMilliseconds: Fixture.epoch + Fixture.sourceElapsed,
      playback: { track: track(), queueRevision: Fixture.revision, timestampMilliseconds: Fixture.epoch,
        positionAsOfTimestampMilliseconds: Fixture.sourcePosition, durationMilliseconds: Fixture.duration, playbackSpeed: Fixture.one,
        playing: true, paused: false, buffering: false, nextTracks: [track(), track(Fixture.otherOccurrence)], previousTracks: [] } } } }; }
function failure(code) { return value => value instanceof library.IntegrationFailure && value.code === code; }
function decode(value = response(), scope = boundary()) { return library.decodeSpotifyConnectObservation(value, scope); }
test(Fixture.names.timing, () => {
  const value = decode(); assert.equal(value.playback.positionMilliseconds, Fixture.sourcePosition + Fixture.sourceElapsed);
  assert.equal(value.playback.anchorMonotonicMilliseconds, Fixture.sent + (Fixture.received - Fixture.sent) / Fixture.two);
  assert.equal(value.playback.observedMonotonicMilliseconds, Fixture.received);
  assert.equal(value.playback.uncertaintyMilliseconds, (Fixture.received - Fixture.sent) / Fixture.two + Fixture.one);
  assert.equal(value.playback.stateChangedAtUnixMilliseconds, Fixture.epoch);
  const ended = response(); ended.reading.cluster.serverAtMilliseconds += Fixture.duration;
  assert.equal(decode(ended).playback.positionMilliseconds, Fixture.duration);
});
test(Fixture.names.pause, () => {
  for (const field of [Fixture.pausedField, Fixture.bufferingField]) {
    const value = response(); value.reading.cluster.playback[field] = true;
    const observed = decode(value); assert.equal(observed.playback.playing, false);
    assert.equal(observed.playback.positionMilliseconds, Fixture.sourcePosition);
  }
});
test(Fixture.names.occurrence, () => {
  const value = response(); const observed = decode(value);
  value.reading.cluster.playback.nextTracks[Fixture.zero].occurrenceIdentifier = Fixture.otherOccurrence;
  assert.equal(observed.nextTracks[Fixture.zero].occurrenceIdentifier, Fixture.occurrence);
  assert.equal(observed.nextTracks[Fixture.one].occurrenceIdentifier, Fixture.otherOccurrence);
  assert.equal(observed.nextTracks[Fixture.zero].uri, observed.nextTracks[Fixture.one].uri);
  assert.equal(Object.isFrozen(observed.nextTracks), true); assert.equal(Object.isFrozen(observed.playback), true);
});
test(Fixture.names.bounds, () => {
  for (const field of [Fixture.handleField, Fixture.generationField]) { const value = response(); value[field] += Fixture.one;
    assert.throws(() => decode(value), failure(library.IntegrationFailureCode.InvalidResponse)); }
  const host = response(); host.reading.cluster.activeDeviceIdentifier = Fixture.otherHost;
  assert.throws(() => decode(host), failure(library.IntegrationFailureCode.Superseded));
  const invalidClock = response(); invalidClock.reading.requestCompletedNativeMonotonicMilliseconds = Fixture.nativeSample + Fixture.one;
  assert.throws(() => decode(invalidClock), failure(library.IntegrationFailureCode.InvalidResponse));
  assert.throws(() => decode(response(), boundary({ receivedMonotonicMilliseconds: Fixture.sent + Fixture.excessiveRoundTrip })), failure(library.IntegrationFailureCode.Deadline));
});
test(Fixture.names.unavailable, () => {
  const occurrence = response(); occurrence.reading.cluster.playback.track.occurrenceIdentifier = null;
  assert.throws(() => decode(occurrence), failure(library.IntegrationFailureCode.Unsupported));
  const clock = response(); clock.reading.cluster.serverAtMilliseconds = Fixture.zero;
  assert.throws(() => decode(clock), failure(library.IntegrationFailureCode.InvalidResponse));
  const speed = response(); speed.reading.cluster.playback.playbackSpeed = Fixture.two;
  assert.throws(() => decode(speed), failure(library.IntegrationFailureCode.Unsupported));
});
test(Fixture.names.reader, async () => {
  const calls = []; const sample = decode(); const abort = cancellation();
  const reader = new library.SpotifyConnectPlaybackReader({ read: async (...parameters) => { calls.push(parameters); return sample; } }, Values.accountIdentifier);
  assert.equal(await reader.read(Fixture.host, abort.signal), sample.playback);
  assert.deepEqual(calls, [[Values.accountIdentifier, Fixture.host, abort.signal]]);
});
