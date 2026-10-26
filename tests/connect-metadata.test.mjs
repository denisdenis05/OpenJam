import assert from 'node:assert/strict';
import test from 'node:test';
import { library, Values, cancellation, song } from './fixtures.mjs';

const Fixture = Object.freeze({ handle: 4, generation: 2, otherGeneration: 3, host: 'native-host', occurrence: 'first-occurrence',
  secondOccurrence: 'second-occurrence', revision: 'native-revision', otherRevision: 'changed-revision',
  provider: 'queue', emptyProvider: '', trackPrefix: 'spotify:track:', zero: 0, one: 1, two: 2, duration: 180000,
  names: { projection: 'Private metadata projection binds exact requested identities and freezes song values',
    malformed: 'Private metadata rejects missing foreign duplicate and malformed track results',
    bounds: 'Metadata requests reject empty duplicate excessive and malformed identifiers',
    catalog: 'Native catalog lookups use private metadata while search retains the supplied catalog',
    queue: 'Native queue metadata resolves a repeated song once and preserves distinct occurrence order and revision',
    changed: 'A changed queue revision during metadata lookup cannot publish the old queue',
    canceled: 'Canceled native queue reads do not request metadata',
    copy: 'Hosted queue copies retain native occurrence revision and empty provider values' } });
function failure(code) { return value => value instanceof library.IntegrationFailure && value.code === code; }
function metadata() { return { handle: Fixture.handle, generation: Fixture.generation, tracks: [{ spotifyTrackIdentifier: Values.spotifyIdentifier,
  title: Values.title, artistNames: [Values.artist], durationMilliseconds: Fixture.duration, recordingCodes: [] }] }; }
function observe(revision = Fixture.revision) { const track = { uri: Fixture.trackPrefix + Values.spotifyIdentifier,
  occurrenceIdentifier: Fixture.occurrence, provider: Fixture.provider };
  return { generation: Fixture.generation, hostDeviceIdentifier: Fixture.host, queueRevision: revision, currentTrack: track,
    nextTracks: [track, { ...track, occurrenceIdentifier: Fixture.secondOccurrence }], previousTracks: [] }; }
function fixture() {
  const state = { observationCalls: Fixture.zero, metadataCalls: [], nextRevision: Fixture.revision, cancelAfterObservation: null };
  const observations = { read: async () => { state.observationCalls += Fixture.one;
    state.cancelAfterObservation?.(); return observe(state.observationCalls === Fixture.one ? Fixture.revision : state.nextRevision); } };
  const metadataPort = { readMetadata: async (...parameters) => { state.metadataCalls.push(parameters); return [song({ identifier: Values.spotifyIdentifier })]; } };
  return { state, reader: new library.SpotifyConnectHostedQueueReader(observations, metadataPort, Values.accountIdentifier) };
}

test(Fixture.names.projection, () => {
  const value = metadata(); const tracks = library.decodeSpotifyConnectMetadata(value, Fixture.handle, Fixture.generation, [Values.spotifyIdentifier]);
  value.tracks[Fixture.zero].artistNames.push(Values.artist);
  assert.equal(tracks[Fixture.zero].identifier, Values.spotifyIdentifier); assert.equal(tracks[Fixture.zero].artistNames.length, Fixture.one);
  assert.equal(Object.isFrozen(tracks), true); assert.equal(Object.isFrozen(tracks[Fixture.zero]), true);
});
test(Fixture.names.malformed, () => {
  const response = metadata(); response.tracks[Fixture.zero].spotifyTrackIdentifier = Values.otherSpotifyIdentifier;
  assert.throws(() => library.decodeSpotifyConnectMetadata(response, Fixture.handle, Fixture.generation, [Values.spotifyIdentifier]), failure(library.IntegrationFailureCode.InvalidResponse));
  const missing = metadata(); missing.tracks = [];
  assert.throws(() => library.decodeSpotifyConnectMetadata(missing, Fixture.handle, Fixture.generation, [Values.spotifyIdentifier]), failure(library.IntegrationFailureCode.InvalidResponse));
  const invalidDuration = metadata(); invalidDuration.tracks[Fixture.zero].durationMilliseconds = Fixture.zero;
  assert.throws(() => library.decodeSpotifyConnectMetadata(invalidDuration, Fixture.handle, Fixture.generation, [Values.spotifyIdentifier]), failure(library.IntegrationFailureCode.InvalidResponse));
});
test(Fixture.names.bounds, () => {
  for (const identifiers of [[], [Values.spotifyIdentifier, Values.spotifyIdentifier], Array(library.ConnectMetadataPolicy.maximumItems + Fixture.one).fill(Values.spotifyIdentifier)]) {
    assert.throws(() => library.copySpotifyConnectMetadataIdentifiers(identifiers), failure(library.IntegrationFailureCode.InvalidInput));
  }
});
test(Fixture.names.catalog, async () => {
  const calls = []; const returned = song({ identifier: Values.spotifyIdentifier });
  const catalog = new library.SpotifyConnectCatalog({ readMetadata: async (...parameters) => { calls.push(parameters); return [returned]; } },
    { search: async () => [returned] }, Values.accountIdentifier);
  assert.equal(await catalog.lookup(Values.spotifyIdentifier, Values.market, cancellation().signal), returned);
  assert.equal(calls[Fixture.zero][Fixture.zero], Values.accountIdentifier);
  assert.deepEqual(await catalog.search({}, Values.market, cancellation().signal), [returned]);
});
test(Fixture.names.queue, async () => {
  const current = fixture(); const result = await current.reader.read(Fixture.host, cancellation().signal);
  assert.equal(result.queueRevision, Fixture.revision); assert.equal(result.entries.length, Fixture.two);
  assert.equal(result.entries[Fixture.zero].occurrenceIdentifier, Fixture.occurrence);
  assert.equal(result.entries[Fixture.one].occurrenceIdentifier, Fixture.secondOccurrence);
  assert.equal(current.state.metadataCalls.length, Fixture.one);
  assert.deepEqual(current.state.metadataCalls[Fixture.zero][Fixture.one], [Values.spotifyIdentifier]);
});
test(Fixture.names.changed, async () => {
  const current = fixture(); current.state.nextRevision = Fixture.otherRevision;
  await assert.rejects(current.reader.read(Fixture.host, cancellation().signal), failure(library.IntegrationFailureCode.Superseded));
});
test(Fixture.names.canceled, async () => {
  const current = fixture(); const abort = cancellation(); current.state.cancelAfterObservation = () => abort.abort();
  await assert.rejects(current.reader.read(Fixture.host, abort.signal), failure(library.IntegrationFailureCode.Canceled));
  assert.equal(current.state.metadataCalls.length, Fixture.zero);
});
test(Fixture.names.copy, async () => {
  const current = fixture(); const result = await current.reader.read(Fixture.host, cancellation().signal);
  const entry = { ...result.entries[Fixture.zero], provider: Fixture.emptyProvider };
  const copied = library.copyHostedQueueResponse({ ...result, entries: [entry] });
  assert.equal(copied.queueRevision, Fixture.revision); assert.equal(copied.entries[Fixture.zero].provider, Fixture.emptyProvider);
  assert.equal(copied.entries[Fixture.zero].occurrenceIdentifier, Fixture.occurrence);
});
const BatchFixture = Object.freeze({ width: 22, padding: '0', entries: 41, expectedBatches: 3, lastBatchItems: 2,
  name: 'Queue metadata batches stay bounded while preserving the requested queue order' });
test(BatchFixture.name, async () => {
  const identifiers = Array.from({ length: BatchFixture.entries + Fixture.one }, (unusedValue, position) => String(position).padStart(BatchFixture.width, BatchFixture.padding));
  const tracks = identifiers.map(identifier => ({ uri: Fixture.trackPrefix + identifier, occurrenceIdentifier: identifier, provider: Fixture.provider }));
  const observation = { ...observe(), currentTrack: tracks[Fixture.zero], nextTracks: tracks.slice(Fixture.one) };
  const batches = [];
  const reader = new library.SpotifyConnectHostedQueueReader({ read: async () => observation }, { readMetadata: async (accountIdentifier, requested) => {
    batches.push(requested); return requested.map(identifier => song({ identifier }));
  } }, Values.accountIdentifier);
  const queue = await reader.read(Fixture.host, cancellation().signal);
  assert.equal(batches.length, BatchFixture.expectedBatches); assert.equal(batches.at(-Fixture.one).length, BatchFixture.lastBatchItems);
  assert.equal(queue.entries.length, BatchFixture.entries);
  assert.deepEqual(queue.entries.map(entry => entry.uri), tracks.slice(Fixture.one).map(track => track.uri));
});

const MissingFixture = Object.freeze({ name: 'An explicit private metadata not-found result becomes an absent catalog song without public lookup fallback' });
test(MissingFixture.name, async () => {
  const catalog = new library.SpotifyConnectCatalog({ readMetadata: async () => { throw new library.IntegrationFailure(library.IntegrationFailureCode.NotFound); } },
    { lookup: async () => { throw new Error(Fixture.names.catalog); } }, Values.accountIdentifier);
  assert.equal(await catalog.lookup(Values.spotifyIdentifier, Values.market, cancellation().signal), null);
});

const QueueMarkerFixture = Object.freeze({ metadata: 'spotify:meta:repeat', delimiter: 'spotify:delimiter',
  name: 'Queue display removes known structural markers before requesting metadata while retaining repeated song order' });
test(QueueMarkerFixture.name, async () => {
  const observation = observe(); const first = observation.nextTracks[Fixture.zero];
  observation.nextTracks = [{ ...first, uri: QueueMarkerFixture.metadata }, first,
    { ...first, uri: QueueMarkerFixture.delimiter }, observation.nextTracks[Fixture.one]];
  const calls = [];
  const reader = new library.SpotifyConnectHostedQueueReader({ read: async () => observation }, { readMetadata: async (_accountIdentifier, requested) => {
    calls.push(requested); return requested.map(identifier => song({ identifier }));
  } }, Values.accountIdentifier);
  const queue = await reader.read(Fixture.host, cancellation().signal);
  assert.equal(queue.entries.length, Fixture.two); assert.deepEqual(calls, [[Values.spotifyIdentifier]]);
  assert.equal(queue.entries[Fixture.zero].occurrenceIdentifier, Fixture.occurrence);
  assert.equal(queue.entries[Fixture.one].occurrenceIdentifier, Fixture.secondOccurrence);
});
