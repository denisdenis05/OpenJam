import { createRequire } from 'node:module';

const EntryPoint = '../.build/src/index.js';
const requireLibrary = createRequire(import.meta.url);
export const library = requireLibrary(EntryPoint);
export const Values = Object.freeze({
  recordingIdentifier: '11111111-1111-4111-8111-111111111111',
  otherRecordingIdentifier: '22222222-2222-4222-8222-222222222222',
  spotifyIdentifier: 'aaaaaaaaaaaaaaaaaaaaaa', otherSpotifyIdentifier: 'bbbbbbbbbbbbbbbbbbbbbb',
  title: 'Into the Blue', artist: 'Moby', otherArtist: 'Alice', unrelatedTitle: 'Unrelated Recording',
  liveTitle: 'Into the Blue (Live)', remixTitle: 'Into the Blue - Remix',
  accentedTitle: 'Ánother — SONG', plainTitle: 'Another song',
  catalogIdentity: 'streaming-service-test-catalog', otherCatalogIdentity: 'other-catalog',
  market: 'RO', otherMarket: 'GB', invalidMarket: 'invalid',
  durationMilliseconds: 200000, differentDurationMilliseconds: 260000, boundaryDurationMilliseconds: 202000,
  recordingCode: 'TEST00000001', otherRecordingCode: 'TEST00000002',
  accountIdentifier: 'spotify-test-account', otherAccountIdentifier: 'other-account',
  accessToken: 'private-test-token', renewedToken: 'private-renewed-token',
  expiresAtMilliseconds: 900000, nowMilliseconds: 0, expiredAtMilliseconds: -1,
  emptyText: '', noInvocations: 0, singleResultCount: 1, retriedInvocationCount: 2, firstPosition: 0, secondPosition: 1,
  invocationIncrement: 1, positionIncrement: 1, singleCandidateLimit: 1, invalidCandidateLimit: 0,
  singleAssociationCapacity: 1, invalidAssociationCapacity: 0, unpacedIntervalMilliseconds: 0,
  initialUnrelatedValue: 0, changedUnrelatedValue: 1,
  maximumCandidates: 20, schedulerAdvanceMilliseconds: 1000, microtaskCount: 20,
  serviceOrigin: 'https://gew1-spclient.spotify.com', catalogAddress: 'https://api.spotify.com/v1/search',
  foreignAddress: 'https://example.test/private', insecureAddress: 'http://api.spotify.com/v1/search',
  sessionIdentifier: 'test-jam-session', otherSessionIdentifier: 'other-jam',
  participantIdentifier: 'test-participant', participantName: 'Test Participant',
  invitationToken: 'private-invitation-token', invitationAddress: 'spotify:socialsession:test-invitation',
  createRequestIdentifier: 'create-request', endRequestIdentifier: 'end-request',
  successStatus: 200, missingStatus: 404, unauthorizedStatus: 401, rateLimitedStatus: 429,
  serverFailureStatus: 503, retryAfterSeconds: 30,
  sourceEncoding: 'utf8', ordinaryIdentifier: 'recording-without-musicbrainz',
});

export function song(overrides = {}) {
  return { identifier: Values.recordingIdentifier, title: Values.title, author: Values.artist, ...overrides };
}

export function spotifySong(overrides = {}) {
  return song({ identifier: Values.spotifyIdentifier, playable: true, ...overrides });
}

export function cancellation() { return new AbortController(); }

export function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
  return { promise, resolve, reject };
}

export async function flushMicrotasks() {
  for (let iteration = Values.firstPosition; iteration < Values.microtaskCount; iteration += Values.positionIncrement) await Promise.resolve();
}

export function credentials(overrides = {}) {
  return { accountIdentifier: Values.accountIdentifier, accessToken: Values.accessToken,
    expiresAtMilliseconds: Values.expiresAtMilliseconds, ...overrides };
}

export function sessionResponse(overrides = {}) {
  return { session: { identifier: Values.sessionIdentifier, ownedByCurrentAccount: true, active: true,
    participants: [{ identifier: Values.participantIdentifier, displayName: Values.participantName }], ...overrides },
  invitation: { joinToken: Values.invitationToken, address: Values.invitationAddress } };
}

export function wireSession(overrides = {}) {
  return { session_id: Values.sessionIdentifier, is_session_owner: true, active: true,
    session_members: [{ id: Values.participantIdentifier, display_name: Values.participantName }],
    join_session_token: Values.invitationToken, join_session_uri: Values.invitationAddress, ...overrides };
}

export function translatorFixture() {
  const recordingSongs = new Map([[Values.recordingIdentifier, song()]]);
  const spotifySongs = new Map([[Values.spotifyIdentifier, spotifySong()]]);
  const calls = { recordingSearch: Values.noInvocations, spotifySearch: Values.noInvocations };
  const recordings = new library.QueryableRecordingCatalog(Values.catalogIdentity, library.RecordingNamespace.MusicBrainz, {
    lookup: async identifier => recordingSongs.get(identifier) ?? null,
    search: async () => { calls.recordingSearch += Values.invocationIncrement; return [...recordingSongs.values()]; },
  });
  const spotify = {
    lookup: async identifier => spotifySongs.get(identifier) ?? null,
    search: async () => { calls.spotifySearch += Values.invocationIncrement; return [...spotifySongs.values()]; },
  };
  const associations = new library.MemoryAssociationStore();
  const ranker = new library.CandidateRanker();
  return { recordingSongs, spotifySongs, recordings, spotify, associations, ranker, calls,
    translator: new library.TrackTranslator(recordings, spotify, ranker, associations) };
}

export class ManualScheduler {
  nowMilliseconds = Values.nowMilliseconds;
  callbacks = new Set();
  schedule(delayMilliseconds, callback) {
    const scheduled = { due: this.nowMilliseconds + delayMilliseconds, callback };
    this.callbacks.add(scheduled);
    return () => this.callbacks.delete(scheduled);
  }
  advance(milliseconds) {
    this.nowMilliseconds += milliseconds;
    for (const scheduled of [...this.callbacks]) {
      if (scheduled.due > this.nowMilliseconds) continue;
      this.callbacks.delete(scheduled);
      scheduled.callback();
    }
  }
}
