import assert from 'node:assert/strict';
import test from 'node:test';
import { library, Values } from './fixtures.mjs';

const Names = Object.freeze({
  scope: 'Association lookups isolate catalog identities and markets in both directions',
  copy: 'Association writes copy caller data and expose immutable entries',
  capacity: 'The bounded memory store retires the oldest association when full',
  validation: 'Invalid memory association capacities are rejected',
});
const Fingerprint = 'test-fingerprint';

function association(overrides = {}) {
  return { catalogIdentity: Values.catalogIdentity, recordingNamespace: library.RecordingNamespace.MusicBrainz,
    recordingIdentifier: Values.recordingIdentifier, spotifyIdentifier: Values.spotifyIdentifier,
    policyVersion: library.DefaultMatchingPolicy.version, market: Values.market,
    recordingFingerprint: Fingerprint, spotifyFingerprint: Fingerprint, ...overrides };
}

test(Names.scope, async () => {
  const store = new library.MemoryAssociationStore(); await store.save(association());
  assert.equal((await store.findForRecording(Values.otherCatalogIdentity, Values.recordingIdentifier, Values.market)).length, Values.noInvocations);
  assert.equal((await store.findForSpotify(Values.catalogIdentity, Values.spotifyIdentifier, Values.otherMarket)).length, Values.noInvocations);
  assert.equal((await store.findForRecording(Values.catalogIdentity, Values.recordingIdentifier, Values.market)).length, Values.singleResultCount);
  assert.equal((await store.findForSpotify(Values.catalogIdentity, Values.spotifyIdentifier, Values.market)).length, Values.singleResultCount);
});

test(Names.copy, async () => {
  const store = new library.MemoryAssociationStore(); const value = association(); await store.save(value);
  value.spotifyIdentifier = Values.otherSpotifyIdentifier;
  const stored = (await store.findForRecording(Values.catalogIdentity, Values.recordingIdentifier, Values.market))[Values.firstPosition];
  assert.equal(stored.spotifyIdentifier, Values.spotifyIdentifier); assert.ok(Object.isFrozen(stored));
});

test(Names.capacity, async () => {
  const store = new library.MemoryAssociationStore(Values.singleAssociationCapacity); await store.save(association());
  await store.save(association({ spotifyIdentifier: Values.otherSpotifyIdentifier }));
  assert.equal((await store.findForSpotify(Values.catalogIdentity, Values.spotifyIdentifier, Values.market)).length, Values.noInvocations);
  assert.equal((await store.findForSpotify(Values.catalogIdentity, Values.otherSpotifyIdentifier, Values.market)).length, Values.singleResultCount);
});

test(Names.validation, () => {
  assert.throws(() => new library.MemoryAssociationStore(Values.invalidAssociationCapacity), { code: library.IntegrationFailureCode.InvalidInput });
});
