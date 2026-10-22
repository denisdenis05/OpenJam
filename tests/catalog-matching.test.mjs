import assert from 'node:assert/strict';
import test from 'node:test';
import { library, Values, cancellation, song, spotifySong, translatorFixture, deferred } from './fixtures.mjs';

const Names = Object.freeze({
  minimumSchema: 'Minimum title and artist evidence stays ambiguous until confirmed',
  duration: 'Matching duration corroborates exact title and artist',
  durationBoundary: 'Duration tolerance includes its exact boundary',
  conflict: 'Conflicting duration vetoes even a shared recording code',
  code: 'Recording codes corroborate different titles for the same artist',
  version: 'Live and remix suffixes prevent an automatic studio match',
  unicode: 'Unicode accents and punctuation normalize without losing artist identity',
  multipleArtists: 'Artist order is irrelevant but missing collaborators prevent an automatic match',
  duplicates: 'Equally supported different identifiers remain ambiguous',
  duplicateIdentifier: 'Repeated identifiers do not create false ambiguity',
  unavailable: 'Unavailable Spotify tracks are not selected',
  unrelated: 'A shared artist without title or code evidence is not found',
  bounded: 'Candidate inspection respects the configured limit',
  immutable: 'Selected songs and nested artist evidence are copied and immutable',
  invalidPolicy: 'Invalid limits and duration policies are rejected',
  forward: 'Recording to Spotify resolves candidates through the Spotify provider',
  reverse: 'Spotify to recording resolves candidates through the recording provider',
  confirmed: 'Explicit confirmation supports the minimum schema in both directions',
  changed: 'A metadata change invalidates a confirmed association',
  market: 'Confirmed associations do not leak across markets',
  manyTracks: 'Several Spotify identifiers can confirm the same recording',
  absent: 'A missing source returns not found without target search',
  failed: 'Provider failures become typed failures without leaking exception text',
  canceled: 'Canceled resolution performs no source lookup',
  lateCanceled: 'Cancellation discards a source lookup that completes late',
  invalidMarket: 'Invalid market input is rejected before querying',
  confirmationUnavailable: 'Unavailable target tracks cannot be confirmed',
  fallbackCredit: 'Release-level artist fallback cannot independently corroborate a recording match',
  codeConflict: 'Contradictory recording codes veto an otherwise matching title artist and duration',
  confirmationFailure: 'Confirmation sanitizes provider and association-store exceptions',
});

test(Names.minimumSchema, () => {
  const result = new library.CandidateRanker().rank(song(), [spotifySong()]);
  assert.equal(result.status, library.MatchStatus.Ambiguous);
  assert.equal(result.selected, null);
});

test(Names.duration, () => {
  const result = new library.CandidateRanker().rank(song({ durationMilliseconds: Values.durationMilliseconds }),
    [spotifySong({ durationMilliseconds: Values.durationMilliseconds })]);
  assert.equal(result.status, library.MatchStatus.Matched);
  assert.equal(result.selected.identifier, Values.spotifyIdentifier);
});

test(Names.durationBoundary, () => {
  const result = new library.CandidateRanker().rank(song({ durationMilliseconds: Values.durationMilliseconds }),
    [spotifySong({ durationMilliseconds: Values.boundaryDurationMilliseconds })]);
  assert.equal(result.status, library.MatchStatus.Matched);
});

test(Names.conflict, () => {
  const result = new library.CandidateRanker().rank(song({ durationMilliseconds: Values.durationMilliseconds, recordingCodes: [Values.recordingCode] }),
    [spotifySong({ durationMilliseconds: Values.differentDurationMilliseconds, recordingCodes: [Values.recordingCode] })]);
  assert.equal(result.selected, null);
});

test(Names.code, () => {
  const result = new library.CandidateRanker().rank(song({ recordingCodes: [Values.recordingCode] }),
    [spotifySong({ title: Values.unrelatedTitle, recordingCodes: [Values.recordingCode] })]);
  assert.equal(result.status, library.MatchStatus.Matched);
});

test(Names.version, () => {
  for (const title of [Values.liveTitle, Values.remixTitle]) {
    const result = new library.CandidateRanker().rank(song({ recordingCodes: [Values.recordingCode] }),
      [spotifySong({ title, recordingCodes: [Values.recordingCode] })]);
    assert.equal(result.selected, null);
    assert.ok(result.candidates[Values.firstPosition].evidence.includes(library.MatchEvidence.VersionConflict));
  }
});

test(Names.unicode, () => {
  const result = new library.CandidateRanker().rank(song({ title: Values.accentedTitle, durationMilliseconds: Values.durationMilliseconds }),
    [spotifySong({ title: Values.plainTitle, durationMilliseconds: Values.durationMilliseconds })]);
  assert.equal(result.status, library.MatchStatus.Matched);
});

test(Names.multipleArtists, () => {
  const source = song({ artistNames: [Values.artist, Values.otherArtist], durationMilliseconds: Values.durationMilliseconds });
  const candidate = spotifySong({ artistNames: [Values.otherArtist, Values.artist], durationMilliseconds: Values.durationMilliseconds });
  assert.equal(new library.CandidateRanker().rank(source, [candidate]).status, library.MatchStatus.Matched);
  assert.equal(new library.CandidateRanker().rank(source, [{ ...candidate, artistNames: [Values.artist] }]).selected, null);
});

test(Names.duplicates, () => {
  const source = song({ durationMilliseconds: Values.durationMilliseconds });
  const result = new library.CandidateRanker().rank(source, [spotifySong({ durationMilliseconds: Values.durationMilliseconds }),
    spotifySong({ identifier: Values.otherSpotifyIdentifier, durationMilliseconds: Values.durationMilliseconds })]);
  assert.equal(result.status, library.MatchStatus.Ambiguous);
});

test(Names.duplicateIdentifier, () => {
  const candidate = spotifySong({ durationMilliseconds: Values.durationMilliseconds });
  const result = new library.CandidateRanker().rank(song({ durationMilliseconds: Values.durationMilliseconds }), [candidate, candidate]);
  assert.equal(result.candidates.length, Values.singleResultCount);
  assert.equal(result.status, library.MatchStatus.Matched);
});

test(Names.unavailable, () => {
  const result = new library.CandidateRanker().rank(song({ durationMilliseconds: Values.durationMilliseconds }),
    [spotifySong({ durationMilliseconds: Values.durationMilliseconds, playable: false })]);
  assert.equal(result.selected, null);
});

test(Names.unrelated, () => {
  assert.equal(new library.CandidateRanker().rank(song(), [spotifySong({ title: Values.unrelatedTitle })]).status, library.MatchStatus.NotFound);
});

test(Names.bounded, () => {
  const ranker = new library.CandidateRanker({ ...library.DefaultMatchingPolicy, maximumCandidates: Values.singleCandidateLimit });
  assert.equal(ranker.rank(song(), [spotifySong(), spotifySong({ identifier: Values.otherSpotifyIdentifier })]).candidates.length, Values.singleResultCount);
});

test(Names.immutable, () => {
  const candidate = spotifySong({ artistNames: [Values.artist], durationMilliseconds: Values.durationMilliseconds });
  const result = new library.CandidateRanker().rank(song({ artistNames: [Values.artist], durationMilliseconds: Values.durationMilliseconds }), [candidate]);
  candidate.artistNames.push(Values.otherArtist);
  assert.deepEqual(result.selected.artistNames, [Values.artist]);
  assert.ok(Object.isFrozen(result.selected));
  assert.ok(Object.isFrozen(result.selected.artistNames));
});

test(Names.invalidPolicy, () => {
  assert.throws(() => new library.CandidateRanker({ ...library.DefaultMatchingPolicy, maximumCandidates: Values.invalidCandidateLimit }), library.IntegrationFailure);
});

for (const scenario of [{ name: Names.forward, direction: true }, { name: Names.reverse, direction: false }]) {
  test(scenario.name, async () => {
    const fixture = translatorFixture();
    fixture.recordingSongs.set(Values.recordingIdentifier, song({ durationMilliseconds: Values.durationMilliseconds }));
    fixture.spotifySongs.set(Values.spotifyIdentifier, spotifySong({ durationMilliseconds: Values.durationMilliseconds }));
    const result = scenario.direction
      ? await fixture.translator.toSpotify(Values.recordingIdentifier, Values.market, cancellation().signal)
      : await fixture.translator.toRecording(Values.spotifyIdentifier, Values.market, cancellation().signal);
    assert.equal(result.status, library.MatchStatus.Matched);
    assert.equal(scenario.direction ? fixture.calls.spotifySearch : fixture.calls.recordingSearch, Values.singleResultCount);
  });
}

test(Names.confirmed, async () => {
  const fixture = translatorFixture();
  await fixture.translator.confirm(Values.recordingIdentifier, Values.spotifyIdentifier, Values.market, cancellation().signal);
  assert.equal((await fixture.translator.toSpotify(Values.recordingIdentifier, Values.market, cancellation().signal)).status, library.MatchStatus.Matched);
  assert.equal((await fixture.translator.toRecording(Values.spotifyIdentifier, Values.market, cancellation().signal)).status, library.MatchStatus.Matched);
  assert.equal(fixture.calls.spotifySearch, Values.noInvocations);
  assert.equal(fixture.calls.recordingSearch, Values.noInvocations);
});

test(Names.changed, async () => {
  const fixture = translatorFixture();
  await fixture.translator.confirm(Values.recordingIdentifier, Values.spotifyIdentifier, Values.market, cancellation().signal);
  fixture.recordingSongs.set(Values.recordingIdentifier, song({ title: Values.unrelatedTitle }));
  assert.equal((await fixture.translator.toSpotify(Values.recordingIdentifier, Values.market, cancellation().signal)).selected, null);
  assert.equal(fixture.calls.spotifySearch, Values.singleResultCount);
});

test(Names.market, async () => {
  const fixture = translatorFixture();
  await fixture.translator.confirm(Values.recordingIdentifier, Values.spotifyIdentifier, Values.market, cancellation().signal);
  assert.equal((await fixture.translator.toSpotify(Values.recordingIdentifier, Values.otherMarket, cancellation().signal)).status, library.MatchStatus.Ambiguous);
});

test(Names.manyTracks, async () => {
  const fixture = translatorFixture();
  fixture.spotifySongs.set(Values.otherSpotifyIdentifier, spotifySong({ identifier: Values.otherSpotifyIdentifier }));
  for (const identifier of fixture.spotifySongs.keys()) await fixture.translator.confirm(Values.recordingIdentifier, identifier, Values.market, cancellation().signal);
  for (const identifier of fixture.spotifySongs.keys()) {
    const result = await fixture.translator.toRecording(identifier, Values.market, cancellation().signal);
    assert.equal(result.selected.identifier, Values.recordingIdentifier);
  }
});

test(Names.absent, async () => {
  const fixture = translatorFixture();
  assert.equal((await fixture.translator.toSpotify(Values.otherRecordingIdentifier, Values.market, cancellation().signal)).status, library.MatchStatus.NotFound);
  assert.equal(fixture.calls.spotifySearch, Values.noInvocations);
});

test(Names.failed, async () => {
  const fixture = translatorFixture();
  fixture.spotify.search = async () => { throw new Error(Values.accessToken); };
  const result = await fixture.translator.toSpotify(Values.recordingIdentifier, Values.market, cancellation().signal);
  assert.equal(result.failure, library.IntegrationFailureCode.Network);
  assert.ok(!JSON.stringify(result).includes(Values.accessToken));
});

test(Names.canceled, async () => {
  const fixture = translatorFixture();
  const controller = cancellation(); controller.abort();
  assert.equal((await fixture.translator.toSpotify(Values.recordingIdentifier, Values.market, controller.signal)).failure, library.IntegrationFailureCode.Canceled);
});

test(Names.lateCanceled, async () => {
  const pending = deferred();
  const fixture = translatorFixture();
  const controller = cancellation();
  const recordings = { ...fixture.recordings, lookup: () => pending.promise };
  const translator = new library.TrackTranslator(recordings, fixture.spotify, fixture.ranker, fixture.associations);
  const result = translator.toSpotify(Values.recordingIdentifier, Values.market, controller.signal);
  controller.abort(); pending.resolve(song());
  assert.equal((await result).failure, library.IntegrationFailureCode.Canceled);
  assert.equal(fixture.calls.spotifySearch, Values.noInvocations);
});

test(Names.invalidMarket, async () => {
  const fixture = translatorFixture();
  assert.equal((await fixture.translator.toSpotify(Values.recordingIdentifier, Values.invalidMarket, cancellation().signal)).failure, library.IntegrationFailureCode.InvalidInput);
});

test(Names.confirmationUnavailable, async () => {
  const fixture = translatorFixture();
  fixture.spotifySongs.set(Values.spotifyIdentifier, spotifySong({ playable: false }));
  await assert.rejects(fixture.translator.confirm(Values.recordingIdentifier, Values.spotifyIdentifier, Values.market, cancellation().signal), library.IntegrationFailure);
});

test(Names.fallbackCredit, () => {
  const result = new library.CandidateRanker().rank(song({ durationMilliseconds: Values.durationMilliseconds }),
    [spotifySong({ durationMilliseconds: Values.durationMilliseconds, artistCreditSource: library.ArtistCreditSource.Release })]);
  assert.equal(result.selected, null);
});

test(Names.codeConflict, () => {
  const result = new library.CandidateRanker().rank(song({ durationMilliseconds: Values.durationMilliseconds, recordingCodes: [Values.recordingCode] }),
    [spotifySong({ durationMilliseconds: Values.durationMilliseconds, recordingCodes: [Values.otherRecordingCode] })]);
  assert.equal(result.selected, null);
  assert.ok(result.candidates[Values.firstPosition].evidence.includes(library.MatchEvidence.RecordingCodeConflict));
});

test(Names.confirmationFailure, async () => {
  const fixture = translatorFixture();
  fixture.associations.save = async () => { throw new Error(Values.accessToken); };
  await assert.rejects(fixture.translator.confirm(Values.recordingIdentifier, Values.spotifyIdentifier, Values.market, cancellation().signal), failure => {
    assert.equal(failure.code, library.IntegrationFailureCode.Network);
    assert.ok(!failure.message.includes(Values.accessToken)); return true;
  });
});
