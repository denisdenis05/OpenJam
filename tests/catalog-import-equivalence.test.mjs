import assert from 'node:assert/strict';
import test from 'node:test';
import { library, Values, song, spotifySong, translatorFixture, cancellation, deferred, flushMicrotasks, credentials } from './fixtures.mjs';

const Credits = Object.freeze({ group: 'Example Collective', creditedAlias: 'Original Guest Credit', canonical: 'Canonical Guest',
  producer: 'Example Producer', unrelated: 'Unrelated Artist' });
const Names = Object.freeze({ forward: 'Exact imports to a different local identifier require strict equivalent recording metadata',
  reverse: 'Reverse translation can retain an existing equivalent local recording through the exact imported recording',
  missing: 'A foreign imported identifier without local metadata cannot authorize selection',
  wrongTitle: 'A foreign imported recording with another title cannot corroborate the source',
  wrongArtists: 'A foreign imported recording with unrelated artists cannot corroborate the source',
  partialArtists: 'Alias-like partial credit overlap alone never establishes transitive equivalence',
  sourceCodes: 'Source and imported local recording code conflicts prevent transitive proof',
  candidateCodes: 'Imported local recording and Spotify recording code conflicts prevent transitive proof',
  sourceUnavailable: 'Unavailable source recordings cannot obtain transitive import evidence',
  mappedUnavailable: 'Unavailable imported local recordings cannot supply equivalence evidence',
  candidateUnavailable: 'Unavailable Spotify candidates cannot obtain transitive import evidence',
  sourceRelease: 'Source release-only credits cannot be upgraded through a different imported recording',
  mappedRelease: 'Imported release-only credits cannot establish strict local recording equivalence',
  deduplication: 'Multiple candidate imports to the same local recording share one bounded lookup',
  malformedLookup: 'A local equivalence lookup cannot replace the imported identifier with another identity',
  canceledLookup: 'Canceled transitive lookup rejects promptly and discards uncooperative late metadata',
  reverseCanceledLookup: 'Canceled reverse import lookup cannot retain late imported recording metadata',
  strictSkip: 'Strong strict candidates skip both importer requests and transitive lookups',
  direct: 'Exact source identifier import proof keeps its existing lookup-free fast path',
  suggested: 'Suggested import mappings never trigger equivalence lookups',
  runtime: 'Runtime disposal cancels in-flight transitive import metadata lookup',
  duplicateMetadata: 'A repeated local identifier cannot borrow equivalence proof from contradictory later metadata',
  bound: 'Transitive import lookups cannot exceed the configured candidate limit',
  reverseMalformed: 'Reverse import equivalence rejects a lookup that returns a foreign local identity',
});
function local(overrides = {}) { return song({ author: Credits.group, artistNames: [Credits.group, Credits.creditedAlias],
  artistCreditSource: library.ArtistCreditSource.Recording, ...overrides }); }
function mapped(overrides = {}) { return local({ identifier: Values.otherRecordingIdentifier, artistNames: [Credits.group], ...overrides }); }
function remote(overrides = {}) { return spotifySong({ author: Credits.group,
  artistNames: [Credits.group, Credits.canonical, Credits.producer], artistCreditSource: library.ArtistCreditSource.Recording, ...overrides }); }
function fixture(overrides = {}) {
  const current = translatorFixture(); const calls = { importer: Values.noInvocations, mappedLookup: Values.noInvocations };
  current.recordingSongs.set(Values.recordingIdentifier, local(overrides.source));
  current.recordingSongs.set(Values.otherRecordingIdentifier, mapped(overrides.mapped));
  current.spotifySongs.set(Values.spotifyIdentifier, remote(overrides.remote));
  const lookup = current.recordings.lookup.bind(current.recordings);
  current.recordings.lookup = async (identifier, signal) => {
    if (identifier === Values.otherRecordingIdentifier) calls.mappedLookup += Values.invocationIncrement;
    return lookup(identifier, signal);
  };
  current.recordings.search = async () => [current.recordingSongs.get(Values.recordingIdentifier)];
  const state = { import: async songs => songs.map(candidate => ({ spotifyIdentifier: candidate.identifier,
    recordingIdentifier: Values.otherRecordingIdentifier, exact: true })) };
  const importer = { match: async (...parameters) => { calls.importer += Values.invocationIncrement; return state.import(...parameters); } };
  return { ...current, calls, state, importer,
    translator: new library.TrackTranslator(current.recordings, current.spotify, current.ranker, current.associations, importer) };
}
function forward(current, signal = cancellation().signal) { return current.translator.toSpotify(Values.recordingIdentifier, Values.market, signal); }
function reverse(current, signal = cancellation().signal) { return current.translator.toRecording(Values.spotifyIdentifier, Values.market, signal); }

test(Names.forward, async () => { const current = fixture(); const result = await forward(current);
  assert.equal(result.status, library.MatchStatus.Matched); assert.equal(result.selected.identifier, Values.spotifyIdentifier);
  assert.ok(result.candidates[Values.firstPosition].evidence.includes(library.MatchEvidence.Import));
  assert.equal(current.calls.mappedLookup, Values.singleResultCount);
});
test(Names.reverse, async () => { const current = fixture(); const result = await reverse(current);
  assert.equal(result.status, library.MatchStatus.Matched); assert.equal(result.selected.identifier, Values.recordingIdentifier);
  assert.ok(result.candidates.find(candidate => candidate.song.identifier === Values.recordingIdentifier).evidence.includes(library.MatchEvidence.Import));
});
test(Names.missing, async () => { const current = fixture(); current.recordingSongs.delete(Values.otherRecordingIdentifier);
  assert.equal((await forward(current)).selected, null);
});
for (const scenario of [
  { name: Names.wrongTitle, mapped: { title: Values.unrelatedTitle } },
  { name: Names.wrongArtists, mapped: { artistNames: [Credits.unrelated] } },
  { name: Names.partialArtists, mapped: { artistNames: [Credits.group, Credits.canonical] } },
  { name: Names.sourceCodes, source: { recordingCodes: [Values.recordingCode] }, mapped: { recordingCodes: [Values.otherRecordingCode] } },
  { name: Names.candidateCodes, mapped: { recordingCodes: [Values.recordingCode] }, remote: { recordingCodes: [Values.otherRecordingCode] } },
  { name: Names.sourceUnavailable, source: { playable: false } },
  { name: Names.mappedUnavailable, mapped: { playable: false } },
  { name: Names.candidateUnavailable, remote: { playable: false } },
  { name: Names.sourceRelease, source: { artistCreditSource: library.ArtistCreditSource.Release } },
  { name: Names.mappedRelease, mapped: { artistCreditSource: library.ArtistCreditSource.Release } },
]) {
  test(scenario.name, async () => { const current = fixture(scenario); assert.equal((await forward(current)).selected, null); });
}
test(Names.deduplication, async () => { const current = fixture();
  current.spotifySongs.set(Values.otherSpotifyIdentifier, remote({ identifier: Values.otherSpotifyIdentifier }));
  const result = await forward(current); assert.equal(result.status, library.MatchStatus.Matched);
  assert.equal(current.calls.mappedLookup, Values.singleResultCount);
});
test(Names.malformedLookup, async () => { const current = fixture(); const lookup = current.recordings.lookup.bind(current.recordings);
  current.recordings.lookup = async (identifier, signal) => identifier === Values.otherRecordingIdentifier ? mapped({ identifier: Values.recordingIdentifier }) : lookup(identifier, signal);
  assert.equal((await forward(current)).failure, library.IntegrationFailureCode.InvalidResponse);
});
for (const scenario of [{ name: Names.canceledLookup, translate: forward }, { name: Names.reverseCanceledLookup, translate: reverse }]) {
  test(scenario.name, async () => { const current = fixture(); const pending = deferred(); const started = deferred();
    const lookup = current.recordings.lookup.bind(current.recordings);
    current.recordings.lookup = (identifier, signal) => {
      if (identifier === Values.otherRecordingIdentifier) { started.resolve(); return pending.promise; }
      return lookup(identifier, signal);
    };
    const controller = cancellation(); const translating = scenario.translate(current, controller.signal); await started.promise;
    controller.abort(); assert.equal((await translating).failure, library.IntegrationFailureCode.Canceled);
    pending.resolve(mapped()); await flushMicrotasks();
    assert.equal(current.calls.importer, Values.singleResultCount);
  });
}
test(Names.strictSkip, async () => { const current = fixture({ remote: { artistNames: [Credits.group] } });
  assert.equal((await forward(current)).status, library.MatchStatus.Matched);
  assert.equal(current.calls.importer, Values.noInvocations); assert.equal(current.calls.mappedLookup, Values.noInvocations);
});
test(Names.direct, async () => { const current = fixture(); current.state.import = async () => [{ spotifyIdentifier: Values.spotifyIdentifier,
  recordingIdentifier: Values.recordingIdentifier, exact: true }];
  assert.equal((await forward(current)).status, library.MatchStatus.Matched); assert.equal(current.calls.mappedLookup, Values.noInvocations);
});
test(Names.suggested, async () => { const current = fixture(); current.state.import = async () => [{ spotifyIdentifier: Values.spotifyIdentifier,
  recordingIdentifier: Values.otherRecordingIdentifier, exact: false }];
  assert.equal((await forward(current)).selected, null); assert.equal(current.calls.mappedLookup, Values.noInvocations);
});
test(Names.runtime, async () => { const current = fixture(); const pending = deferred(); const started = deferred();
  const lookup = current.recordings.lookup.bind(current.recordings);
  current.recordings.lookup = (identifier, signal) => {
    if (identifier === Values.otherRecordingIdentifier) { started.resolve(); return pending.promise; }
    return lookup(identifier, signal);
  };
  const runtime = new library.SpotifyJamRuntime({ accountIdentifier: Values.accountIdentifier,
    credentials: { getCredentials: async () => credentials(), renewCredentials: async () => credentials() },
    endpoints: { resolveServiceOrigin: async () => Values.serviceOrigin }, recordings: current.recordings,
    associations: current.associations, clock: { nowMilliseconds: () => Values.nowMilliseconds }, recordingImportMatcher: current.importer,
    requests: { execute: async () => ({ status: Values.successStatus, body: { tracks: { items: [{ id: Values.spotifyIdentifier,
      name: Values.title, artists: [{ name: Credits.group }, { name: Credits.canonical }, { name: Credits.producer }] }] } } }) },
  });
  const translating = runtime.translateToSpotify(Values.recordingIdentifier, Values.market, cancellation().signal);
  await started.promise; runtime.dispose(); assert.equal((await translating).failure, library.IntegrationFailureCode.Canceled);
  pending.resolve(mapped());
});

test(Names.duplicateMetadata, async () => {
  const current = fixture({ mapped: { artistNames: [Credits.group, Credits.creditedAlias] } });
  const first = local({ artistNames: [Credits.group, Credits.unrelated] });
  current.recordings.search = async () => [first, local()];
  const result = await reverse(current);
  assert.equal(result.selected.identifier, Values.otherRecordingIdentifier);
  assert.equal(result.candidates.find(candidate => candidate.song.identifier === Values.recordingIdentifier).evidence.includes(library.MatchEvidence.Import), false);
});
test(Names.bound, async () => {
  const current = fixture(); const lookedUp = []; const mappedPrefix = 'bounded-imported-recording-'; const spotifyPrefix = 'bounded-spotify-candidate-';
  const importLengths = [];
  current.spotify.search = async () => Array.from({ length: Values.maximumCandidates }, (_unused, position) => remote({ identifier: spotifyPrefix + position }));
  current.state.import = async songs => { importLengths.push(songs.length); return songs.map((candidate, position) => ({
    spotifyIdentifier: candidate.identifier, recordingIdentifier: mappedPrefix + position, exact: true })); };
  current.recordings.lookup = async identifier => {
    if (identifier === Values.recordingIdentifier) return local();
    lookedUp.push(identifier); return mapped({ identifier });
  };
  const translator = new library.TrackTranslator(current.recordings, current.spotify,
    new library.CandidateRanker({ ...current.ranker.policy, maximumCandidates: Values.retriedInvocationCount }), current.associations, current.importer);
  assert.equal((await translator.toSpotify(Values.recordingIdentifier, Values.market, cancellation().signal)).status, library.MatchStatus.Matched);
  assert.deepEqual(importLengths, [Values.retriedInvocationCount]); assert.equal(lookedUp.length, Values.retriedInvocationCount);
});
test(Names.reverseMalformed, async () => {
  const current = fixture(); const lookup = current.recordings.lookup.bind(current.recordings);
  current.recordings.lookup = async (identifier, signal) => identifier === Values.otherRecordingIdentifier
    ? mapped({ identifier: Values.recordingIdentifier }) : lookup(identifier, signal);
  assert.equal((await reverse(current)).failure, library.IntegrationFailureCode.InvalidResponse);
});
