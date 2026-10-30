import assert from 'node:assert/strict';
import test from 'node:test';
import { library, Values, cancellation } from './fixtures.mjs';

const Fixture = Object.freeze({ handle: 7, generation: 3, otherGeneration: 4, limit: 2, maximumLimit: 10, excessiveLimit: 11,
  firstPosition: 0, noResults: 0, durationMilliseconds: 180000, controlText: '\u0000', invalidMarket: 'invalid',
  malformedIdentifier: 'invalid-track',
  names: { bounded: 'Native search captures bounded title author country and candidate limit',
    invalid: 'Native search rejects missing unsafe and invalid query input',
    decoded: 'Native search decodes frozen candidates and preserves explicit unplayability',
    empty: 'Native search accepts a verified empty result',
    malformed: 'Native search rejects foreign generation duplicate tracks unsafe candidates and excess results',
    routing: 'Native catalog search uses its account-bound port without web fallback',
    failure: 'Native catalog search preserves permission failures without retrying another transport' } });
function query() { return { title: Values.title, author: Values.artist, limit: Fixture.limit }; }
function response() { return { handle: Fixture.handle, generation: Fixture.generation, tracks: [{ spotifyTrackIdentifier: Values.spotifyIdentifier,
  title: Values.title, artistNames: [Values.artist], durationMilliseconds: Fixture.durationMilliseconds, recordingCodes: [], playable: false }] }; }
function invalidResponse() { return failure => failure instanceof library.IntegrationFailure && failure.code === library.IntegrationFailureCode.InvalidResponse; }

test(Fixture.names.bounded, () => {
  const input = query(); const captured = library.copySpotifyConnectSearch({ ...input, limit: Fixture.excessiveLimit }, Values.market);
  assert.equal(captured.limit, Fixture.maximumLimit); assert.equal(captured.market, Values.market); assert.equal(Object.isFrozen(captured), true);
});
test(Fixture.names.invalid, () => {
  for (const input of [null, { ...query(), title: Fixture.controlText }, { ...query(), limit: Fixture.noResults }]) {
    assert.throws(() => library.copySpotifyConnectSearch(input, Values.market), { code: library.IntegrationFailureCode.InvalidInput });
  }
  assert.throws(() => library.copySpotifyConnectSearch(query(), Fixture.invalidMarket), { code: library.IntegrationFailureCode.InvalidInput });
});
test(Fixture.names.decoded, () => {
  const source = response(); const decoded = library.decodeSpotifyConnectSearch(source, Fixture.handle, Fixture.generation, Fixture.limit);
  source.tracks[Fixture.firstPosition].title = Fixture.controlText;
  assert.equal(decoded[Fixture.firstPosition].title, Values.title); assert.equal(decoded[Fixture.firstPosition].playable, false);
  assert.equal(Object.isFrozen(decoded), true); assert.equal(Object.isFrozen(decoded[Fixture.firstPosition]), true);
});
test(Fixture.names.empty, () => {
  assert.deepEqual(library.decodeSpotifyConnectSearch({ ...response(), tracks: [] }, Fixture.handle, Fixture.generation, Fixture.limit), []);
});
test(Fixture.names.malformed, () => {
  const source = response(); const track = source.tracks[Fixture.firstPosition];
  const invalid = [{ ...source, generation: Fixture.otherGeneration }, { ...source, tracks: [track, track] },
    { ...source, tracks: [{ ...track, spotifyTrackIdentifier: Fixture.malformedIdentifier }] },
    { ...source, tracks: [{ ...track, playable: null }] }, { ...source, tracks: [{ ...track, title: Fixture.controlText }] }];
  for (const value of invalid) assert.throws(() => library.decodeSpotifyConnectSearch(value, Fixture.handle, Fixture.generation, Fixture.limit), invalidResponse());
  assert.throws(() => library.decodeSpotifyConnectSearch(source, Fixture.handle, Fixture.generation, Fixture.noResults), invalidResponse());
});
test(Fixture.names.routing, async () => {
  const calls = []; const returned = [];
  const native = { async search(...parameters) { calls.push(parameters); return returned; } };
  const catalog = new library.SpotifyConnectCatalog({}, { search() { throw new Error(Fixture.names.routing); } }, Values.accountIdentifier, native);
  const signal = cancellation().signal;
  assert.equal(await catalog.search(query(), Values.market, signal), returned);
  assert.deepEqual(calls, [[Values.accountIdentifier, query(), Values.market, signal]]);
});
test(Fixture.names.failure, async () => {
  const native = { async search() { throw new library.IntegrationFailure(library.IntegrationFailureCode.Forbidden); } };
  const catalog = new library.SpotifyConnectCatalog({}, { search() { throw new Error(Fixture.names.failure); } }, Values.accountIdentifier, native);
  await assert.rejects(catalog.search(query(), Values.market, cancellation().signal), { code: library.IntegrationFailureCode.Forbidden });
});
