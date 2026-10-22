import assert from 'node:assert/strict';
import test from 'node:test';
import { library, Values, cancellation, song, ManualScheduler } from './fixtures.mjs';

const Names = Object.freeze({
  queryMinimal: 'Queryable providers accept only identifier title and author',
  queryBounded: 'Queryable providers bound and copy candidate results',
  queryLookup: 'Queryable lookup rejects a different returned identifier',
  queryCancellation: 'Canceled queryable requests do not invoke the query',
  queryValidation: 'Queryable search rejects empty fields and invalid limits',
  spotifySearch: 'Spotify search encodes field filters and clamps the remote result limit',
  spotifyDecode: 'Spotify catalog decodes optional duration codes and all artists',
  spotifyMissing: 'Spotify lookup maps missing responses to null',
  spotifyInvalid: 'Spotify catalog rejects malformed artist and duration fields',
  spotifyIdentifier: 'Spotify lookup rejects malformed identifiers before requesting',
  musicbrainzSearch: 'MusicBrainz search escapes query syntax and requests bounded JSON results',
  musicbrainzDecode: 'MusicBrainz lookup preserves recording identifiers artist credits and codes',
  musicbrainzMissing: 'MusicBrainz lookup maps missing responses to null',
  musicbrainzRate: 'Public MusicBrainz configuration cannot weaken the request interval',
  musicbrainzIdentifier: 'MusicBrainz lookup rejects release-style non-recording input formats',
  serverSearch: 'Server catalog queries encode the three field search and bound responses',
  serverLookup: 'Server catalog lookup preserves identifier and optional duration',
  serverMissing: 'Server catalog lookup maps not found to null',
  selfHosted: 'Explicit self-hosted MusicBrainz services can use an internal HTTP endpoint',
});
const ProviderFixture = Object.freeze({
  queryParameter: 'q', limitParameter: 'limit', marketParameter: 'market',
  searchTitle: 'Song "quoted"', searchAuthor: 'Artist: Special', titleFilter: 'track:', artistFilter: 'artist:',
  userAgent: 'StreamingServiceSpotifyJamTests/1.0 (tests@example.test)',
  musicbrainzQueryParameter: 'query', musicbrainzFormatParameter: 'fmt', musicbrainzJsonFormat: 'json',
  escapedAuthor: 'Artist\\: Special', serverAddress: 'https://streaming.example.test/',
  serverSearchSuffix: '/spotify/catalog/recordings/search', serverTitleParameter: 'title',
  minimumIntervalMilliseconds: 1000, tooShortIntervalMilliseconds: 999,
  spotifyMaximumLimit: 10, invalidDuration: -1,
  selfHostedAddress: 'http://musicbrainz.internal/ws/2/',
});

function spotifyWire(overrides = {}) {
  return { id: Values.spotifyIdentifier, name: Values.title, artists: [{ name: Values.artist }, { name: Values.otherArtist }],
    duration_ms: Values.durationMilliseconds, external_ids: { isrc: Values.recordingCode }, is_playable: true, ...overrides };
}

function recordingWire(overrides = {}) {
  const artistCreditProperty = 'artist-credit';
  return { id: Values.recordingIdentifier, title: Values.title, length: Values.durationMilliseconds,
    [artistCreditProperty]: [{ name: Values.artist }, { artist: { name: Values.otherArtist } }], isrcs: [Values.recordingCode], ...overrides };
}

function musicbrainzFixture(body) {
  const requests = [];
  const scheduler = new ManualScheduler();
  const catalog = new library.MusicBrainzRecordingCatalog({ identity: Values.catalogIdentity, userAgent: ProviderFixture.userAgent },
    { execute: async request => { requests.push(request); return { status: Values.successStatus, body }; } },
    { nowMilliseconds: () => scheduler.nowMilliseconds }, scheduler);
  return { catalog, requests };
}

test(Names.queryMinimal, async () => {
  const catalog = new library.QueryableRecordingCatalog(Values.catalogIdentity, library.RecordingNamespace.Local,
    { lookup: async () => song({ identifier: Values.ordinaryIdentifier }), search: async () => [] });
  assert.deepEqual(await catalog.lookup(Values.ordinaryIdentifier, cancellation().signal), song({ identifier: Values.ordinaryIdentifier }));
});

test(Names.queryBounded, async () => {
  const source = [song(), song({ identifier: Values.otherRecordingIdentifier })];
  const catalog = new library.QueryableRecordingCatalog(Values.catalogIdentity, library.RecordingNamespace.MusicBrainz,
    { lookup: async () => null, search: async () => source });
  const result = await catalog.search({ title: Values.title, author: Values.artist, limit: Values.singleCandidateLimit }, cancellation().signal);
  assert.equal(result.length, Values.singleResultCount);
  source[Values.firstPosition].title = Values.unrelatedTitle;
  assert.equal(result[Values.firstPosition].title, Values.title);
});

test(Names.queryLookup, async () => {
  const catalog = new library.QueryableRecordingCatalog(Values.catalogIdentity, library.RecordingNamespace.MusicBrainz,
    { lookup: async () => song({ identifier: Values.otherRecordingIdentifier }), search: async () => [] });
  await assert.rejects(catalog.lookup(Values.recordingIdentifier, cancellation().signal), { code: library.IntegrationFailureCode.InvalidResponse });
});

test(Names.queryCancellation, async () => {
  const catalog = new library.QueryableRecordingCatalog(Values.catalogIdentity, library.RecordingNamespace.Local,
    { lookup: async () => assert.fail(), search: async () => assert.fail() });
  const controller = cancellation(); controller.abort();
  await assert.rejects(catalog.lookup(Values.ordinaryIdentifier, controller.signal), { code: library.IntegrationFailureCode.Canceled });
});

test(Names.queryValidation, async () => {
  const catalog = new library.QueryableRecordingCatalog(Values.catalogIdentity, library.RecordingNamespace.Local,
    { lookup: async () => null, search: async () => assert.fail() });
  await assert.rejects(catalog.search({ title: Values.title, author: Values.artist, limit: Values.invalidCandidateLimit }, cancellation().signal), { code: library.IntegrationFailureCode.InvalidInput });
});

test(Names.spotifySearch, async () => {
  const requests = [];
  const catalog = new library.SpotifyWebCatalog({ read: async address => { requests.push(new URL(address)); return { tracks: { items: [spotifyWire()] } }; } });
  const result = await catalog.search({ title: ProviderFixture.searchTitle, author: ProviderFixture.searchAuthor, limit: Values.maximumCandidates }, Values.market, cancellation().signal);
  const address = requests[Values.firstPosition];
  assert.equal(address.searchParams.get(ProviderFixture.limitParameter), String(ProviderFixture.spotifyMaximumLimit));
  assert.equal(address.searchParams.get(ProviderFixture.marketParameter), Values.market);
  assert.ok(address.searchParams.get(ProviderFixture.queryParameter).includes(ProviderFixture.titleFilter));
  assert.ok(address.searchParams.get(ProviderFixture.queryParameter).includes(ProviderFixture.artistFilter));
  assert.equal(result.length, Values.singleResultCount);
});

test(Names.spotifyDecode, async () => {
  const catalog = new library.SpotifyWebCatalog({ read: async () => spotifyWire() });
  const result = await catalog.lookup(Values.spotifyIdentifier, Values.market, cancellation().signal);
  assert.deepEqual(result.artistNames, [Values.artist, Values.otherArtist]);
  assert.deepEqual(result.recordingCodes, [Values.recordingCode]);
  assert.equal(result.durationMilliseconds, Values.durationMilliseconds);
});

test(Names.spotifyMissing, async () => {
  const catalog = new library.SpotifyWebCatalog({ read: async () => { throw new library.IntegrationFailure(library.IntegrationFailureCode.NotFound); } });
  assert.equal(await catalog.lookup(Values.spotifyIdentifier, Values.market, cancellation().signal), null);
});

test(Names.spotifyInvalid, async () => {
  for (const body of [spotifyWire({ artists: [] }), spotifyWire({ duration_ms: ProviderFixture.invalidDuration })]) {
    const catalog = new library.SpotifyWebCatalog({ read: async () => body });
    await assert.rejects(catalog.lookup(Values.spotifyIdentifier, Values.market, cancellation().signal), { code: library.IntegrationFailureCode.InvalidResponse });
  }
});

test(Names.spotifyIdentifier, async () => {
  const catalog = new library.SpotifyWebCatalog({ read: async () => assert.fail() });
  await assert.rejects(catalog.lookup(Values.emptyText, Values.market, cancellation().signal), { code: library.IntegrationFailureCode.InvalidInput });
});

test(Names.musicbrainzSearch, async () => {
  const fixture = musicbrainzFixture({ recordings: [recordingWire()] });
  await fixture.catalog.search({ title: ProviderFixture.searchTitle, author: ProviderFixture.searchAuthor, limit: Values.singleCandidateLimit }, cancellation().signal);
  const address = new URL(fixture.requests[Values.firstPosition].address);
  assert.equal(address.searchParams.get(ProviderFixture.musicbrainzFormatParameter), ProviderFixture.musicbrainzJsonFormat);
  assert.ok(address.searchParams.get(ProviderFixture.musicbrainzQueryParameter).includes(ProviderFixture.escapedAuthor));
});

test(Names.musicbrainzDecode, async () => {
  const fixture = musicbrainzFixture(recordingWire());
  const recording = await fixture.catalog.lookup(Values.recordingIdentifier, cancellation().signal);
  assert.equal(recording.identifier, Values.recordingIdentifier);
  assert.deepEqual(recording.artistNames, [Values.artist, Values.otherArtist]);
  assert.deepEqual(recording.recordingCodes, [Values.recordingCode]);
});

test(Names.musicbrainzMissing, async () => {
  const scheduler = new ManualScheduler();
  const catalog = new library.MusicBrainzRecordingCatalog({ identity: Values.catalogIdentity, userAgent: ProviderFixture.userAgent },
    { execute: async () => ({ status: Values.missingStatus, body: null }) }, { nowMilliseconds: () => scheduler.nowMilliseconds }, scheduler);
  assert.equal(await catalog.lookup(Values.recordingIdentifier, cancellation().signal), null);
});

test(Names.musicbrainzRate, () => {
  assert.throws(() => new library.MusicBrainzRecordingCatalog({ identity: Values.catalogIdentity, userAgent: ProviderFixture.userAgent,
    minimumIntervalMilliseconds: ProviderFixture.tooShortIntervalMilliseconds }, { execute: async () => assert.fail() },
  { nowMilliseconds: () => Values.nowMilliseconds }, new ManualScheduler()), { code: library.IntegrationFailureCode.InvalidInput });
});

test(Names.musicbrainzIdentifier, async () => {
  await assert.rejects(musicbrainzFixture(null).catalog.lookup(Values.ordinaryIdentifier, cancellation().signal), { code: library.IntegrationFailureCode.InvalidInput });
});

test(Names.serverSearch, async () => {
  let requestedAddress;
  const query = new library.StreamingServiceRecordingQuery(ProviderFixture.serverAddress, { read: async address => {
    requestedAddress = new URL(address); return [song(), song({ identifier: Values.otherRecordingIdentifier })];
  } });
  const result = await query.search({ title: Values.title, author: Values.artist, limit: Values.singleCandidateLimit }, cancellation().signal);
  assert.equal(requestedAddress.pathname, ProviderFixture.serverSearchSuffix);
  assert.equal(requestedAddress.searchParams.get(ProviderFixture.serverTitleParameter), Values.title);
  assert.equal(result.length, Values.singleResultCount);
});

test(Names.serverLookup, async () => {
  const query = new library.StreamingServiceRecordingQuery(ProviderFixture.serverAddress, { read: async () => song({ durationMilliseconds: Values.durationMilliseconds }) });
  assert.equal((await query.lookup(Values.recordingIdentifier, cancellation().signal)).durationMilliseconds, Values.durationMilliseconds);
});

test(Names.serverMissing, async () => {
  const query = new library.StreamingServiceRecordingQuery(ProviderFixture.serverAddress, { read: async () => {
    throw new library.IntegrationFailure(library.IntegrationFailureCode.NotFound);
  } });
  assert.equal(await query.lookup(Values.recordingIdentifier, cancellation().signal), null);
});

test(Names.selfHosted, async () => {
  const scheduler = new ManualScheduler(); let requestedAddress;
  const catalog = new library.MusicBrainzRecordingCatalog({ identity: Values.catalogIdentity, userAgent: ProviderFixture.userAgent,
    serviceAddress: ProviderFixture.selfHostedAddress, minimumIntervalMilliseconds: Values.unpacedIntervalMilliseconds }, {
    execute: async request => { requestedAddress = request.address; return { status: Values.successStatus, body: recordingWire() }; },
  }, { nowMilliseconds: () => scheduler.nowMilliseconds }, scheduler);
  await catalog.lookup(Values.recordingIdentifier, cancellation().signal);
  assert.ok(requestedAddress.startsWith(ProviderFixture.selfHostedAddress));
});
