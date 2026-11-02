import assert from 'node:assert/strict';
import test from 'node:test';
import { library, Values, song, spotifySong } from './fixtures.mjs';

const EquivalentRecordingValues = Object.freeze({
  firstRelease: 'Original Album', secondRelease: 'Collected Recordings',
  thirdSpotifyIdentifier: 'cccccccccccccccccccccc',
  almostIdenticalDurationMilliseconds: 200001,
});

const Names = Object.freeze({
  releaseOrder: 'Equivalent recordings across releases select the same identifier regardless of search order',
  normalizedIdentity: 'Equivalent recording identity uses normalized titles and complete unordered recording artist sets',
  differentDuration: 'A one millisecond duration difference does not establish equivalent recordings',
  missingDuration: 'Matching recording codes without complete durations retain ambiguity between identifiers',
  normalizedCodes: 'Equivalent candidates accept equal normalized recording code sets independent of order and duplicates',
  conflictingCodes: 'Conflicting candidate recording codes retain ambiguity when source codes are absent',
  overlappingCodes: 'Partially overlapping recording code sets do not establish equivalence',
  missingCodeBridge: 'A missing candidate recording code cannot bridge conflicting known codes',
  missingCodes: 'Absent recording codes are compatible with one consistently identified candidate',
  unavailable: 'An unavailable competing recording cannot be absorbed into an equivalent group',
  releaseFallback: 'Release artist fallback cannot corroborate an equivalent candidate group',
  versionConflict: 'Equivalent duplicate live versions cannot override the source version conflict',
});

function sourceRecording(overrides = {}) {
  return song({ durationMilliseconds: Values.durationMilliseconds, ...overrides });
}

function candidateRecording(overrides = {}) {
  return spotifySong({ durationMilliseconds: Values.durationMilliseconds, ...overrides });
}

function assertAmbiguous(source, candidates) {
  const result = new library.CandidateRanker().rank(source, candidates);
  assert.equal(result.status, library.MatchStatus.Ambiguous);
  assert.equal(result.selected, null);
}

test(Names.releaseOrder, () => {
  const first = candidateRecording({ releaseTitle: EquivalentRecordingValues.firstRelease });
  const second = candidateRecording({ identifier: Values.otherSpotifyIdentifier, releaseTitle: EquivalentRecordingValues.secondRelease });
  for (const candidates of [[first, second], [second, first]]) {
    const result = new library.CandidateRanker().rank(sourceRecording(), candidates);
    assert.equal(result.status, library.MatchStatus.Matched);
    assert.equal(result.selected.identifier, Values.spotifyIdentifier);
    assert.equal(result.candidates.length, Values.retriedInvocationCount);
  }
});

test(Names.normalizedIdentity, () => {
  const source = sourceRecording({ title: Values.accentedTitle, artistNames: [Values.artist, Values.otherArtist] });
  const result = new library.CandidateRanker().rank(source, [
    candidateRecording({ title: Values.plainTitle, artistNames: [Values.otherArtist, Values.artist] }),
    candidateRecording({ identifier: Values.otherSpotifyIdentifier, title: Values.accentedTitle,
      artistNames: [Values.artist, Values.otherArtist] }),
  ]);
  assert.equal(result.status, library.MatchStatus.Matched);
});

test(Names.differentDuration, () => {
  assertAmbiguous(sourceRecording(), [candidateRecording(), candidateRecording({
    identifier: Values.otherSpotifyIdentifier, durationMilliseconds: EquivalentRecordingValues.almostIdenticalDurationMilliseconds,
  })]);
});

test(Names.missingDuration, () => {
  assertAmbiguous(song({ recordingCodes: [Values.recordingCode] }), [
    spotifySong({ recordingCodes: [Values.recordingCode] }),
    spotifySong({ identifier: Values.otherSpotifyIdentifier, recordingCodes: [Values.recordingCode] }),
  ]);
});

test(Names.normalizedCodes, () => {
  const result = new library.CandidateRanker().rank(sourceRecording(), [
    candidateRecording({ recordingCodes: [Values.recordingCode, Values.otherRecordingCode, Values.recordingCode] }),
    candidateRecording({ identifier: Values.otherSpotifyIdentifier,
      recordingCodes: [Values.otherRecordingCode.toLowerCase(), Values.recordingCode.toLowerCase()] }),
  ]);
  assert.equal(result.status, library.MatchStatus.Matched);
});

test(Names.conflictingCodes, () => {
  assertAmbiguous(sourceRecording(), [
    candidateRecording({ recordingCodes: [Values.recordingCode] }),
    candidateRecording({ identifier: Values.otherSpotifyIdentifier, recordingCodes: [Values.otherRecordingCode] }),
  ]);
});

test(Names.overlappingCodes, () => {
  assertAmbiguous(sourceRecording(), [
    candidateRecording({ recordingCodes: [Values.recordingCode] }),
    candidateRecording({ identifier: Values.otherSpotifyIdentifier, recordingCodes: [Values.recordingCode, Values.otherRecordingCode] }),
  ]);
});

test(Names.missingCodeBridge, () => {
  assertAmbiguous(sourceRecording(), [
    candidateRecording(),
    candidateRecording({ identifier: Values.otherSpotifyIdentifier, recordingCodes: [Values.recordingCode] }),
    candidateRecording({ identifier: EquivalentRecordingValues.thirdSpotifyIdentifier, recordingCodes: [Values.otherRecordingCode] }),
  ]);
});

test(Names.missingCodes, () => {
  const result = new library.CandidateRanker().rank(sourceRecording(), [
    candidateRecording(),
    candidateRecording({ identifier: Values.otherSpotifyIdentifier, recordingCodes: [Values.recordingCode] }),
  ]);
  assert.equal(result.status, library.MatchStatus.Matched);
});

test(Names.unavailable, () => {
  assertAmbiguous(sourceRecording(), [candidateRecording(), candidateRecording({
    identifier: Values.otherSpotifyIdentifier, playable: false,
  })]);
});

test(Names.releaseFallback, () => {
  assertAmbiguous(sourceRecording(), [candidateRecording(), candidateRecording({
    identifier: Values.otherSpotifyIdentifier, artistCreditSource: library.ArtistCreditSource.Release,
  })]);
});

test(Names.versionConflict, () => {
  const result = new library.CandidateRanker().rank(sourceRecording(), [candidateRecording({ title: Values.liveTitle }), candidateRecording({
    identifier: Values.otherSpotifyIdentifier, title: Values.liveTitle,
  })]);
  assert.equal(result.status, library.MatchStatus.NotFound);
  assert.equal(result.selected, null);
});
