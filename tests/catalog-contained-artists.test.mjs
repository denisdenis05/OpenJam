import assert from 'node:assert/strict';
import test from 'node:test';
import { library, Values, song, spotifySong, translatorFixture, cancellation } from './fixtures.mjs';

const Credits = Object.freeze({ group: 'Madvillain', producer: 'Madlib', vocalist: 'MF DOOM', guest: 'Quasimoto', other: 'Another Artist' });
const Titles = Object.freeze({ first: "America's Most Blunted", second: 'Rainbows', third: 'Shadows Of Tomorrow',
  featuredFirst: "America's Most Blunted (feat. Quasimoto)", featuredThird: 'Shadows Of Tomorrow [ft. Quasimoto]' });
const Names = Object.freeze({ first: 'Americas Most Blunted matches expanded recording credits without import identity or duration',
  second: 'Rainbows matches the canonical local artist against expanded Spotify recording credits',
  third: 'Shadows Of Tomorrow matches bracketed featured credits without duration evidence',
  wrongArtist: 'Exact titles cannot authorize an unrelated artist', overlap: 'Partial overlap between different complete multi-artist sets is insufficient',
  recordingCodes: 'Contained artist credits cannot bypass contradictory recording codes', unavailable: 'Contained artist credits cannot authorize unavailable tracks',
  release: 'Release artist fallback remains insufficient without actual import evidence',
  equivalent: 'Contained credit variations across otherwise equivalent releases do not create ambiguity',
  unrelatedCollaborators: 'Different non-contained collaborator groups remain ambiguous even when each contains the canonical artist',
  versionTitle: 'Meaningful live version title text remains distinct after featured credit normalization',
  forward: 'Strict contained credits skip the importer instead of requiring the same database recording identity',
  policy: 'Contained artist matching invalidates recording evidence v3 associations through policy v4' });
const PolicyVersion = 'recording-evidence-v4';
const PreviousPolicyVersion = 'recording-evidence-v3';
function source(overrides = {}) {
  return song({ title: Titles.first, author: Credits.group, artistNames: [Credits.group],
    artistCreditSource: library.ArtistCreditSource.Recording, ...overrides });
}
function candidate(overrides = {}) {
  return spotifySong({ title: Titles.first, author: Credits.group,
    artistNames: [Credits.group, Credits.producer, Credits.vocalist, Credits.guest],
    artistCreditSource: library.ArtistCreditSource.Recording, ...overrides });
}
for (const scenario of [{ name: Names.first, local: Titles.first, remote: Titles.featuredFirst },
  { name: Names.second, local: Titles.second, remote: Titles.second },
  { name: Names.third, local: Titles.third, remote: Titles.featuredThird }]) {
  test(scenario.name, () => {
    const ranker = new library.CandidateRanker();
    const result = ranker.rank(source({ title: scenario.local }), [candidate({ title: scenario.remote })]);
    assert.equal(result.status, library.MatchStatus.Matched);
    assert.ok(result.candidates[Values.firstPosition].evidence.includes(library.MatchEvidence.Title));
    assert.ok(result.candidates[Values.firstPosition].evidence.includes(library.MatchEvidence.Artist));
    assert.equal(result.candidates[Values.firstPosition].evidence.includes(library.MatchEvidence.Import), false);
    assert.equal(ranker.rank(candidate({ title: scenario.remote }), [source({ title: scenario.local })]).status, library.MatchStatus.Matched);
  });
}
test(Names.wrongArtist, () => {
  assert.equal(new library.CandidateRanker().rank(source(), [candidate({ artistNames: [Credits.other] })]).selected, null);
});
test(Names.overlap, () => {
  assert.equal(new library.CandidateRanker().rank(source({ artistNames: [Credits.group, Credits.guest] }),
    [candidate({ artistNames: [Credits.group, Credits.producer] })]).selected, null);
});
test(Names.recordingCodes, () => {
  assert.equal(new library.CandidateRanker().rank(source({ recordingCodes: [Values.recordingCode] }),
    [candidate({ recordingCodes: [Values.otherRecordingCode] })]).selected, null);
});
test(Names.unavailable, () => {
  assert.equal(new library.CandidateRanker().rank(source(), [candidate({ playable: false })]).selected, null);
});
test(Names.release, () => {
  assert.equal(new library.CandidateRanker().rank(source({ artistCreditSource: library.ArtistCreditSource.Release }), [candidate()]).selected, null);
  assert.equal(new library.CandidateRanker().rank(source(), [candidate({ artistCreditSource: library.ArtistCreditSource.Release })]).selected, null);
});
test(Names.equivalent, () => {
  const result = new library.CandidateRanker().rank(source(), [candidate(), candidate({ identifier: Values.otherSpotifyIdentifier,
    title: Titles.featuredFirst, artistNames: [Credits.group, Credits.producer] })]);
  assert.equal(result.status, library.MatchStatus.Matched); assert.equal(result.selected.identifier, Values.spotifyIdentifier);
});
test(Names.unrelatedCollaborators, () => {
  const result = new library.CandidateRanker().rank(source(), [candidate({ artistNames: [Credits.group, Credits.producer] }),
    candidate({ identifier: Values.otherSpotifyIdentifier, artistNames: [Credits.group, Credits.guest] })]);
  assert.equal(result.status, library.MatchStatus.Ambiguous);
});
test(Names.versionTitle, () => {
  assert.equal(new library.CandidateRanker().rank(source(), [candidate({ title: Values.liveTitle })]).selected, null);
});
test(Names.forward, async () => {
  const fixture = translatorFixture(); let calls = Values.noInvocations;
  fixture.recordingSongs.set(Values.recordingIdentifier, source()); fixture.spotifySongs.set(Values.spotifyIdentifier, candidate());
  const translator = new library.TrackTranslator(fixture.recordings, fixture.spotify, fixture.ranker, fixture.associations,
    { match: async () => { calls += Values.singleResultCount; return []; } });
  assert.equal((await translator.toSpotify(Values.recordingIdentifier, Values.market, cancellation().signal)).status, library.MatchStatus.Matched);
  assert.equal(calls, Values.noInvocations);
});
test(Names.policy, async () => {
  const fixture = translatorFixture();
  const former = new library.TrackTranslator(fixture.recordings, fixture.spotify,
    new library.CandidateRanker({ ...fixture.ranker.policy, version: PreviousPolicyVersion }), fixture.associations);
  await former.confirm(Values.recordingIdentifier, Values.spotifyIdentifier, Values.market, cancellation().signal);
  assert.equal(fixture.ranker.policy.version, PolicyVersion);
  const forward = await fixture.translator.toSpotify(Values.recordingIdentifier, Values.market, cancellation().signal);
  const reverse = await fixture.translator.toRecording(Values.spotifyIdentifier, Values.market, cancellation().signal);
  assert.equal(forward.status, library.MatchStatus.Matched); assert.equal(reverse.status, library.MatchStatus.Matched);
  assert.equal(fixture.calls.spotifySearch, Values.singleResultCount); assert.equal(fixture.calls.recordingSearch, Values.singleResultCount);
  assert.equal(forward.candidates[Values.firstPosition].evidence.includes(library.MatchEvidence.Confirmed), false);
});
