import assert from 'node:assert/strict';
import test from 'node:test';
import { library, Values, cancellation, deferred } from './fixtures.mjs';

const Fixture = Object.freeze({ host: 'synthetic-host', occurrence: 'synthetic-occurrence', invalidIdentifier: 'bad identifier',
  positionMilliseconds: 1200, zero: 0, one: 1,
  names: { playback: 'Native playback adapters bind immutable commands to their selected account and host',
    queue: 'Native queue adapters pass a validated occurrence identity without claiming remote idempotency',
    bounds: 'Native protocols reject malformed commands targets tracks and occurrence identities before dispatch',
    cancellation: 'Pre-canceled native protocol commands never allocate identities or dispatch',
    failure: 'Native protocol failures propagate without replay or public API fallback' } });
function fixture() {
  const calls = []; let occurrences = Fixture.zero;
  const port = { execute: async (...parameters) => { calls.push(parameters); } };
  return { calls, port, occurrences: () => occurrences,
    playback: new library.SpotifyConnectPlaybackCommandProtocol(port, Values.accountIdentifier),
    queue: new library.SpotifyConnectQueueProtocol(port, Values.accountIdentifier, () => { occurrences += Fixture.one; return Fixture.occurrence; }) };
}
function failure(code) { return value => value instanceof library.IntegrationFailure && value.code === code; }

test(Fixture.names.playback, async () => {
  const current = fixture(); const pending = deferred(); current.port.execute = async (...parameters) => { current.calls.push(parameters); return pending.promise; };
  const command = { kind: library.HostedPlaybackCommandKind.Seek, expectedSpotifyTrackIdentifier: Values.spotifyIdentifier, positionMilliseconds: Fixture.positionMilliseconds };
  const abort = cancellation(); const execution = current.playback.execute(command, Fixture.host, abort.signal);
  command.positionMilliseconds = Fixture.zero;
  const [account, submitted, target, signal] = current.calls[Fixture.zero];
  assert.equal(account, Values.accountIdentifier); assert.equal(target, Fixture.host); assert.equal(signal, abort.signal);
  assert.equal(submitted.positionMilliseconds, Fixture.positionMilliseconds); assert.equal(Object.isFrozen(submitted), true);
  pending.resolve(); await execution;
});
test(Fixture.names.queue, async () => {
  const current = fixture(); const abort = cancellation(); await current.queue.addToQueue(Values.spotifyIdentifier, Fixture.host, abort.signal);
  assert.deepEqual(current.calls, [[Values.accountIdentifier, { kind: library.SpotifyConnectCommandKind.AddToQueue,
    spotifyTrackIdentifier: Values.spotifyIdentifier, occurrenceIdentifier: Fixture.occurrence }, Fixture.host, abort.signal]]);
  assert.equal(current.occurrences(), Fixture.one);
});
test(Fixture.names.bounds, async () => {
  const current = fixture(); const signal = cancellation().signal;
  await assert.rejects(current.playback.execute({ kind: Fixture.invalidIdentifier }, Fixture.host, signal), failure(library.IntegrationFailureCode.InvalidInput));
  await assert.rejects(current.playback.execute({ kind: library.HostedPlaybackCommandKind.Play }, Fixture.invalidIdentifier, signal), failure(library.IntegrationFailureCode.InvalidInput));
  await assert.rejects(current.queue.addToQueue(Fixture.invalidIdentifier, Fixture.host, signal), failure(library.IntegrationFailureCode.InvalidInput));
  const invalidQueue = new library.SpotifyConnectQueueProtocol(current.port, Values.accountIdentifier, () => Fixture.invalidIdentifier);
  await assert.rejects(invalidQueue.addToQueue(Values.spotifyIdentifier, Fixture.host, signal), failure(library.IntegrationFailureCode.InvalidInput));
  assert.deepEqual(current.calls, []);
});
test(Fixture.names.cancellation, async () => {
  const current = fixture(); const abort = cancellation(); abort.abort();
  await assert.rejects(current.playback.execute({ kind: library.HostedPlaybackCommandKind.Play }, Fixture.host, abort.signal), failure(library.IntegrationFailureCode.Canceled));
  await assert.rejects(current.queue.addToQueue(Values.spotifyIdentifier, Fixture.host, abort.signal), failure(library.IntegrationFailureCode.Canceled));
  assert.equal(current.occurrences(), Fixture.zero); assert.deepEqual(current.calls, []);
});
test(Fixture.names.failure, async () => {
  const current = fixture(); const failureValue = new library.IntegrationFailure(library.IntegrationFailureCode.UnknownOutcome);
  current.port.execute = async (...parameters) => { current.calls.push(parameters); throw failureValue; };
  await assert.rejects(current.playback.execute({ kind: library.HostedPlaybackCommandKind.Next }, Fixture.host, cancellation().signal), failureValue);
  assert.equal(current.calls.length, Fixture.one);
});
