import assert from 'node:assert/strict';
import test from 'node:test';
import { library, Values, song, spotifySong, translatorFixture, cancellation, deferred, credentials } from './fixtures.mjs';

const Credits = Object.freeze({
  group: 'The Example Collective', producer: 'Example Producer', vocalist: 'Example Vocalist',
  unrelatedGroup: 'Another Collective', expandedAuthor: 'The Example Collective, Example Producer, Example Vocalist',
});
const Names = Object.freeze({
  primary: 'A single recording group matches Spotify expanded credits with the same primary artist',
  reverse: 'Expanded Spotify credits match the known single recording group in reverse',
  normalized: 'Primary artist expansion normalizes spelling and duplicate credits',
  unrelatedArtist: 'Import identity cannot authorize a recording without any shared artist credit',
  strict: 'Exact recording title and contained artist credits select without import evidence',
  release: 'An exact import identity can corroborate a release artist fallback with title artist and duration guards',
  missingDuration: 'An exact import mapping does not need recording duration',
  differentTitle: 'Expanded artist credits need exact normalized title even with a shared recording code',
  durationConflict: 'An exact import mapping remains valid when recording durations differ',
  codeConflict: 'Expanded artist credits preserve recording code conflict rejection',
  unavailable: 'Expanded artist credits preserve unavailable recording rejection',
  version: 'Expanded artist credits preserve version conflict rejection',
  missingCollaborator: 'Canonical single artist metadata matches a contained expanded recording credit set',
  recordingExpansion: 'An exact import identity can corroborate different credit set lengths',
  authorConflict: 'Exact artist credit overlap is checked instead of fuzzy author text',
  equivalent: 'Equivalent expanded Spotify recordings retain stable duplicate-release selection',
  differentExpandedCredits: 'Exact import proof groups otherwise equivalent expanded candidate credits',
  forwardTranslation: 'Recording translation applies the primary group expansion rule',
  reverseTranslation: 'Reverse translation applies the primary group expansion rule',
});

function recording(overrides = {}) {
  return song({ author: Credits.group, artistNames: [Credits.group],
    artistCreditSource: library.ArtistCreditSource.Recording, durationMilliseconds: Values.durationMilliseconds, ...overrides });
}

function expanded(overrides = {}) {
  return spotifySong({ author: Credits.expandedAuthor, artistNames: [Credits.group, Credits.producer, Credits.vocalist],
    durationMilliseconds: Values.durationMilliseconds, ...overrides });
}

function assertUnselected(source, target) {
  assert.equal(new library.CandidateRanker().rankWithImportMatches(source, [target], [target.identifier]).selected, null);
}

for (const scenario of [{ name: Names.primary, reverse: false }, { name: Names.reverse, reverse: true }]) {
  test(scenario.name, () => {
    const source = scenario.reverse ? expanded() : recording();
    const target = scenario.reverse ? recording() : expanded();
    const result = new library.CandidateRanker().rankWithImportMatches(source, [target], [target.identifier]);
    assert.equal(result.status, library.MatchStatus.Matched);
    assert.equal(result.selected.identifier, target.identifier);
    assert.ok(result.candidates[Values.firstPosition].evidence.includes(library.MatchEvidence.Artist));
  });
}

test(Names.normalized, () => {
  const result = new library.CandidateRanker().rankWithImportMatches(recording({ author: Credits.group.toUpperCase() }), [expanded({
    artistNames: [Credits.group.toLowerCase(), Credits.group, Credits.producer],
  })], [Values.spotifyIdentifier]);
  assert.equal(result.status, library.MatchStatus.Matched);
});

test(Names.unrelatedArtist, () => {
  assertUnselected(recording(), expanded({ artistNames: [Credits.unrelatedGroup, Credits.producer] }));
});

test(Names.strict, () => {
  assert.equal(new library.CandidateRanker().rank(recording(), [expanded()]).status, library.MatchStatus.Matched);
});

test(Names.release, () => {
  const fallback = recording({ artistCreditSource: library.ArtistCreditSource.Release });
  assert.equal(new library.CandidateRanker().rankWithImportMatches(fallback, [expanded()], [Values.spotifyIdentifier]).status, library.MatchStatus.Matched);
  assert.equal(new library.CandidateRanker().rankWithImportMatches(expanded(), [fallback], [Values.recordingIdentifier]).status, library.MatchStatus.Matched);
});

test(Names.missingDuration, () => {
  const result = new library.CandidateRanker().rankWithImportMatches(recording({ durationMilliseconds: undefined }),
    [expanded({ durationMilliseconds: undefined })], [Values.spotifyIdentifier]);
  assert.equal(result.status, library.MatchStatus.Matched);
});

test(Names.differentTitle, () => {
  assertUnselected(recording({ recordingCodes: [Values.recordingCode] }),
    expanded({ title: Values.unrelatedTitle, recordingCodes: [Values.recordingCode] }));
});

test(Names.durationConflict, () => {
  const result = new library.CandidateRanker().rankWithImportMatches(recording(),
    [expanded({ durationMilliseconds: Values.differentDurationMilliseconds })], [Values.spotifyIdentifier]);
  assert.equal(result.status, library.MatchStatus.Matched);
});

test(Names.codeConflict, () => {
  assertUnselected(recording({ recordingCodes: [Values.recordingCode] }), expanded({ recordingCodes: [Values.otherRecordingCode] }));
});

test(Names.unavailable, () => {
  assertUnselected(recording(), expanded({ playable: false }));
});

test(Names.version, () => {
  assertUnselected(recording(), expanded({ title: Values.liveTitle }));
});

test(Names.missingCollaborator, () => {
  assert.equal(new library.CandidateRanker().rank(recording({ artistNames: [Credits.group, Credits.producer] }),
    [expanded({ artistNames: [Credits.group] })]).status, library.MatchStatus.Matched);
});

test(Names.recordingExpansion, () => {
  assert.equal(new library.CandidateRanker().rankWithImportMatches(recording(), [expanded({ artistCreditSource: library.ArtistCreditSource.Recording })], [Values.spotifyIdentifier]).status, library.MatchStatus.Matched);
});

test(Names.authorConflict, () => {
  assertUnselected(recording({ author: Credits.group, artistNames: [Credits.unrelatedGroup] }), expanded());
});

test(Names.equivalent, () => {
  const result = new library.CandidateRanker().rankWithImportMatches(recording(), [expanded({ identifier: Values.otherSpotifyIdentifier }), expanded()], [Values.spotifyIdentifier, Values.otherSpotifyIdentifier]);
  assert.equal(result.status, library.MatchStatus.Matched);
  assert.equal(result.selected.identifier, Values.spotifyIdentifier);
});

test(Names.differentExpandedCredits, () => {
  const result = new library.CandidateRanker().rankWithImportMatches(recording(), [expanded(), expanded({
    identifier: Values.otherSpotifyIdentifier, artistNames: [Credits.group, Credits.producer],
  })], [Values.spotifyIdentifier, Values.otherSpotifyIdentifier]);
  assert.equal(result.status, library.MatchStatus.Matched);
  assert.equal(result.selected.identifier, Values.spotifyIdentifier);
});

for (const scenario of [{ name: Names.forwardTranslation, reverse: false }, { name: Names.reverseTranslation, reverse: true }]) {
  test(scenario.name, async () => {
    const fixture = translatorFixture();
    fixture.recordingSongs.set(Values.recordingIdentifier, recording());
    fixture.spotifySongs.set(Values.spotifyIdentifier, expanded());
    const translator = new library.TrackTranslator(fixture.recordings, fixture.spotify, fixture.ranker, fixture.associations,
      { match: async () => [{ spotifyIdentifier: Values.spotifyIdentifier, recordingIdentifier: Values.recordingIdentifier, exact: true }] });
    const result = scenario.reverse
      ? await translator.toRecording(Values.spotifyIdentifier, Values.market, cancellation().signal)
      : await translator.toSpotify(Values.recordingIdentifier, Values.market, cancellation().signal);
    assert.equal(result.status, library.MatchStatus.Matched);
  });
}

const ImportCases = Object.freeze({
  featureTitle: 'Import title normalization shares the existing bracketed feat and ft behavior',
  wrongRecording: 'An exact import for another local recording cannot authorize forward matching',
  suggested: 'A suggested import result cannot authorize matching',
  unrelatedResponse: 'Importer Spotify identifiers must belong to the actual supplied candidates',
  strictSkip: 'Strict successful matches skip the import service',
  recoverLookup: 'Reverse import resolves an exact local recording absent from the strict search results',
  cancellation: 'Cancellation discards a pending import response promptly',
  malformed: 'Malformed import result shapes fail without leaking provider values',
  duplicate: 'Duplicate Spotify import identities cannot authorize conflicting local mappings',
  reverseUnavailable: 'An unavailable Spotify source cannot be imported into a local match',
  unrelatedImport: 'An exact but unrelated importer mapping cannot bypass title artist guards',
  namedTrack: 'An exact Raid import can connect Madvillain to expanded artist credits without duration',
  featureVersionWord: 'Artist annotation containing a version word cannot create an extra import version veto',
  runtime: 'Runtime composes the actual recording import fallback port',
  retiredRuntime: 'Runtime disposal cancels and discards an import result from its former lifetime',
});
const ImportValues = Object.freeze({
  featuredTitle: `${Values.title} (feat. Guest Artist)`, bracketedTitle: `${Values.title} [ft Guest Artist]`,
  liveTitle: `${Values.title} (Live)`, bareTitle: `${Values.title} feat. Guest Artist`,
});

function importFixture(matches) {
  const fixture = translatorFixture();
  fixture.recordingSongs.set(Values.recordingIdentifier, recording({ artistCreditSource: library.ArtistCreditSource.Release }));
  fixture.spotifySongs.set(Values.spotifyIdentifier, expanded());
  const calls = [];
  const matcher = { match: async (songs, signal) => { calls.push({ songs, signal }); return matches; } };
  return { ...fixture, matcher, calls,
    translator: new library.TrackTranslator(fixture.recordings, fixture.spotify, fixture.ranker, fixture.associations, matcher) };
}

function exactImport(overrides = {}) {
  return { spotifyIdentifier: Values.spotifyIdentifier, recordingIdentifier: Values.recordingIdentifier, exact: true, ...overrides };
}

test(ImportCases.featureTitle, () => {
  for (const title of [ImportValues.featuredTitle, ImportValues.bracketedTitle]) {
    assert.equal(library.importRecordingTitle(title), library.importRecordingTitle(Values.title));
    const result = new library.CandidateRanker().rankWithImportMatches(recording(), [expanded({ title })], [Values.spotifyIdentifier]);
    assert.equal(result.status, library.MatchStatus.Matched);
    assert.ok(result.candidates[Values.firstPosition].evidence.includes(library.MatchEvidence.Import));
  }
  for (const title of [ImportValues.liveTitle, ImportValues.bareTitle]) {
    assert.notEqual(library.importRecordingTitle(title), library.importRecordingTitle(Values.title));
  }
});

test(ImportCases.wrongRecording, async () => {
  const fixture = importFixture([exactImport({ recordingIdentifier: Values.otherRecordingIdentifier })]);
  assert.equal((await fixture.translator.toSpotify(Values.recordingIdentifier, Values.market, cancellation().signal)).selected, null);
});

test(ImportCases.suggested, async () => {
  const fixture = importFixture([exactImport({ exact: false })]);
  assert.equal((await fixture.translator.toSpotify(Values.recordingIdentifier, Values.market, cancellation().signal)).selected, null);
});

test(ImportCases.unrelatedResponse, async () => {
  const fixture = importFixture([exactImport({ spotifyIdentifier: Values.otherSpotifyIdentifier })]);
  assert.equal((await fixture.translator.toSpotify(Values.recordingIdentifier, Values.market, cancellation().signal)).failure,
    library.IntegrationFailureCode.InvalidResponse);
});

test(ImportCases.strictSkip, async () => {
  const fixture = importFixture([exactImport()]);
  fixture.recordingSongs.set(Values.recordingIdentifier, recording());
  fixture.spotifySongs.set(Values.spotifyIdentifier, spotifySong({ author: Credits.group, durationMilliseconds: Values.durationMilliseconds }));
  assert.equal((await fixture.translator.toSpotify(Values.recordingIdentifier, Values.market, cancellation().signal)).status, library.MatchStatus.Matched);
  assert.equal(fixture.calls.length, Values.noInvocations);
});

test(ImportCases.recoverLookup, async () => {
  const fixture = importFixture([exactImport()]);
  fixture.recordings.search = async () => [];
  const result = await fixture.translator.toRecording(Values.spotifyIdentifier, Values.market, cancellation().signal);
  assert.equal(result.selected.identifier, Values.recordingIdentifier);
});

test(ImportCases.cancellation, async () => {
  const pending = deferred();
  const fixture = importFixture([]);
  const started = deferred();
  fixture.matcher.match = () => { started.resolve(); return pending.promise; };
  const controller = cancellation();
  const result = fixture.translator.toSpotify(Values.recordingIdentifier, Values.market, controller.signal);
  await started.promise;
  controller.abort();
  assert.equal((await result).failure, library.IntegrationFailureCode.Canceled);
  pending.resolve([exactImport()]);
});

test(ImportCases.malformed, async () => {
  const fixture = importFixture(null);
  assert.equal((await fixture.translator.toSpotify(Values.recordingIdentifier, Values.market, cancellation().signal)).failure,
    library.IntegrationFailureCode.InvalidResponse);
});


test(ImportCases.duplicate, async () => {
  const fixture = importFixture([exactImport(), exactImport({ recordingIdentifier: Values.otherRecordingIdentifier })]);
  fixture.spotifySongs.set(Values.otherSpotifyIdentifier, expanded({ identifier: Values.otherSpotifyIdentifier }));
  assert.equal((await fixture.translator.toSpotify(Values.recordingIdentifier, Values.market, cancellation().signal)).failure,
    library.IntegrationFailureCode.InvalidResponse);
});

test(ImportCases.reverseUnavailable, async () => {
  const fixture = importFixture([exactImport()]);
  fixture.spotifySongs.set(Values.spotifyIdentifier, expanded({ playable: false }));
  assert.equal((await fixture.translator.toRecording(Values.spotifyIdentifier, Values.market, cancellation().signal)).selected, null);
});

test(ImportCases.unrelatedImport, async () => {
  const fixture = importFixture([exactImport()]);
  fixture.spotifySongs.set(Values.spotifyIdentifier, expanded({ artistNames: [Credits.unrelatedGroup] }));
  assert.equal((await fixture.translator.toSpotify(Values.recordingIdentifier, Values.market, cancellation().signal)).selected, null);
});


function importRuntime(matcher) {
  return new library.SpotifyJamRuntime({ accountIdentifier: Values.accountIdentifier,
    credentials: { getCredentials: async () => credentials(), renewCredentials: async () => credentials() },
    endpoints: { resolveServiceOrigin: async () => Values.serviceOrigin },
    recordings: { identity: Values.catalogIdentity, namespace: library.RecordingNamespace.Local,
      lookup: async () => recording({ artistCreditSource: library.ArtistCreditSource.Release }), search: async () => [] },
    associations: new library.MemoryAssociationStore(), clock: { nowMilliseconds: () => Values.nowMilliseconds },
    recordingImportMatcher: matcher,
    requests: { execute: async () => ({ status: Values.successStatus, body: { tracks: { items: [{
      id: Values.spotifyIdentifier, name: Values.title,
      artists: [{ name: Credits.group }, { name: Credits.producer }], duration_ms: Values.durationMilliseconds,
    }] } } }) },
  });
}

test(ImportCases.runtime, async () => {
  const runtime = importRuntime({ match: async () => [exactImport()] });
  const result = await runtime.translateToSpotify(Values.recordingIdentifier, Values.market, cancellation().signal);
  assert.equal(result.selected.identifier, Values.spotifyIdentifier);
  runtime.dispose();
});

test(ImportCases.retiredRuntime, async () => {
  const started = deferred();
  const pending = deferred();
  const runtime = importRuntime({ match: () => { started.resolve(); return pending.promise; } });
  const result = runtime.translateToSpotify(Values.recordingIdentifier, Values.market, cancellation().signal);
  await started.promise;
  runtime.dispose();
  assert.equal((await result).failure, library.IntegrationFailureCode.Canceled);
  pending.resolve([exactImport()]);
});


const RequestedRecording = Object.freeze({ title: 'Raid', featuredTitle: 'Raid (feat. M.E.D.)', featuredArtist: 'M.E.D.',
  group: 'Madvillain', producer: 'Madlib', vocalist: 'MF DOOM',
  versionNamedGuestTitle: `${Values.title} (feat. Live Guest)`, });

test(ImportCases.namedTrack, async () => {
  const source = recording({ title: RequestedRecording.title, author: RequestedRecording.group,
    artistNames: [RequestedRecording.group], artistCreditSource: library.ArtistCreditSource.Release, durationMilliseconds: undefined });
  const candidate = expanded({ title: RequestedRecording.featuredTitle,
    artistNames: [RequestedRecording.group, RequestedRecording.producer, RequestedRecording.vocalist, RequestedRecording.featuredArtist],
    durationMilliseconds: undefined });
  const fixture = importFixture([exactImport()]);
  fixture.recordingSongs.set(Values.recordingIdentifier, source);
  fixture.spotifySongs.set(Values.spotifyIdentifier, candidate);
  const result = await fixture.translator.toSpotify(Values.recordingIdentifier, Values.market, cancellation().signal);
  assert.equal(result.status, library.MatchStatus.Matched);
  assert.equal(fixture.calls.length, Values.singleResultCount);
});

test(ImportCases.featureVersionWord, () => {
  const result = new library.CandidateRanker().rankWithImportMatches(recording(),
    [expanded({ title: RequestedRecording.versionNamedGuestTitle })], [Values.spotifyIdentifier]);
  assert.equal(result.status, library.MatchStatus.Matched);
});

const StrictCases = Object.freeze({
  missingDuration: 'Exact title and complete artists select All Caps without either duration',
  differentDuration: 'Exact Accordion identity remains selectable with differing durations',
  missingCandidateDuration: 'A missing target duration is optional ranking evidence',
  missingSourceDuration: 'A missing source duration is optional ranking evidence',
  missingDuplicateDurations: 'Equivalent duplicate identifiers without durations resolve consistently',
  titleVersionText: 'Live version text remains a distinct full title even without a version gate',
  changedLookupIdentity: 'A catalog lookup cannot silently replace the requested source identity',
});
const StrictValues = Object.freeze({ firstTitle: 'All Caps', secondTitle: 'Accordion' });

test(StrictCases.missingDuration, () => {
  const result = new library.CandidateRanker().rank(song({ title: StrictValues.firstTitle,
    author: RequestedRecording.group, artistNames: [RequestedRecording.group] }),
    [spotifySong({ title: StrictValues.firstTitle, author: RequestedRecording.group, artistNames: [RequestedRecording.group] })]);
  assert.equal(result.status, library.MatchStatus.Matched);
});

test(StrictCases.differentDuration, () => {
  const result = new library.CandidateRanker().rank(song({ title: StrictValues.secondTitle,
    author: RequestedRecording.group, artistNames: [RequestedRecording.group], durationMilliseconds: Values.durationMilliseconds }),
    [spotifySong({ title: StrictValues.secondTitle, author: RequestedRecording.group, artistNames: [RequestedRecording.group],
      durationMilliseconds: Values.differentDurationMilliseconds })]);
  assert.equal(result.status, library.MatchStatus.Matched);
});

for (const scenario of [{ name: StrictCases.missingCandidateDuration, source: Values.durationMilliseconds, target: undefined },
  { name: StrictCases.missingSourceDuration, source: undefined, target: Values.durationMilliseconds }]) {
  test(scenario.name, () => {
    const result = new library.CandidateRanker().rank(song({ durationMilliseconds: scenario.source }),
      [spotifySong({ durationMilliseconds: scenario.target })]);
    assert.equal(result.status, library.MatchStatus.Matched);
  });
}

test(StrictCases.missingDuplicateDurations, () => {
  const result = new library.CandidateRanker().rank(song(), [spotifySong(), spotifySong({ identifier: Values.otherSpotifyIdentifier })]);
  assert.equal(result.status, library.MatchStatus.Matched);
  assert.equal(result.selected.identifier, Values.spotifyIdentifier);
});

test(StrictCases.titleVersionText, () => {
  const result = new library.CandidateRanker().rank(song(), [spotifySong({ title: Values.liveTitle })]);
  assert.equal(result.selected, null);
});

test(StrictCases.changedLookupIdentity, async () => {
  const fixture = importFixture([exactImport()]);
  fixture.recordings.lookup = async () => recording({ identifier: Values.otherRecordingIdentifier });
  assert.equal((await fixture.translator.toSpotify(Values.recordingIdentifier, Values.market, cancellation().signal)).failure,
    library.IntegrationFailureCode.InvalidResponse);
  assert.equal(fixture.calls.length, Values.noInvocations);
});


const ImportedReleaseCases = Object.freeze({
  incompleteProof: 'Contained expanded competing credits do not need additional import proof',
  features: 'Exact imports group different featured annotations and artist credits across releases',
  codes: 'Exact import groups retain pairwise conflicting recording code rejection',
  unrelated: 'An exact import group cannot absorb an unrelated artist candidate',
  wrongTitle: 'An exact import group cannot authorize an unrelated base title',
  sameDatabaseRecord: 'Forward exact import grouping uses the same database recording for every candidate',
});
const ImportedReleaseValues = Object.freeze({
  otherFeaturedTitle: 'Raid (ft. Example Guest)', otherFeaturedArtist: 'Example Guest',
});

function importedRaidCandidates() {
  return [expanded({ title: RequestedRecording.featuredTitle, artistNames: [RequestedRecording.group, RequestedRecording.featuredArtist] }),
    expanded({ identifier: Values.otherSpotifyIdentifier, title: ImportedReleaseValues.otherFeaturedTitle,
      artistNames: [RequestedRecording.group, ImportedReleaseValues.otherFeaturedArtist] })];
}

function raidRecording() {
  return recording({ title: RequestedRecording.title, author: RequestedRecording.group, artistNames: [RequestedRecording.group], artistCreditSource: library.ArtistCreditSource.Release });
}

test(ImportedReleaseCases.incompleteProof, () => {
  const result = new library.CandidateRanker().rankWithImportMatches(recording({ artistNames: [Credits.group, Credits.producer] }), [expanded(), expanded({
    identifier: Values.otherSpotifyIdentifier, artistNames: [Credits.group, Credits.producer],
  })], [Values.spotifyIdentifier]);
  assert.equal(result.status, library.MatchStatus.Matched);
});

test(ImportedReleaseCases.features, () => {
  for (const candidates of [importedRaidCandidates(), importedRaidCandidates().reverse()]) {
    const result = new library.CandidateRanker().rankWithImportMatches(raidRecording(), candidates,
      [Values.spotifyIdentifier, Values.otherSpotifyIdentifier]);
    assert.equal(result.status, library.MatchStatus.Matched);
    assert.equal(result.selected.identifier, Values.spotifyIdentifier);
  }
});

test(ImportedReleaseCases.codes, () => {
  const candidates = importedRaidCandidates().map((candidate, position) => ({ ...candidate,
    recordingCodes: [position === Values.firstPosition ? Values.recordingCode : Values.otherRecordingCode] }));
  const result = new library.CandidateRanker().rankWithImportMatches(raidRecording(), candidates,
    [Values.spotifyIdentifier, Values.otherSpotifyIdentifier]);
  assert.equal(result.selected, null);
});

test(ImportedReleaseCases.unrelated, () => {
  const result = new library.CandidateRanker().rankWithImportMatches(raidRecording(),
    [expanded({ title: RequestedRecording.featuredTitle, artistNames: [Credits.unrelatedGroup] })], [Values.spotifyIdentifier]);
  assert.equal(result.selected, null);
});

test(ImportedReleaseCases.wrongTitle, () => {
  const result = new library.CandidateRanker().rankWithImportMatches(raidRecording(),
    [expanded({ title: Values.unrelatedTitle, artistNames: [RequestedRecording.group] })], [Values.spotifyIdentifier]);
  assert.equal(result.selected, null);
});

test(ImportedReleaseCases.sameDatabaseRecord, async () => {
  const fixture = importFixture([exactImport(), exactImport({ spotifyIdentifier: Values.otherSpotifyIdentifier })]);
  fixture.recordingSongs.set(Values.recordingIdentifier, raidRecording());
  for (const candidate of importedRaidCandidates()) fixture.spotifySongs.set(candidate.identifier, candidate);
  const result = await fixture.translator.toSpotify(Values.recordingIdentifier, Values.market, cancellation().signal);
  assert.equal(result.status, library.MatchStatus.Matched);
  assert.equal(result.selected.identifier, Values.spotifyIdentifier);
});
