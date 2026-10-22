import assert from 'node:assert/strict';
import test from 'node:test';
import { library, Values, cancellation, credentials, song } from './fixtures.mjs';

const Names = Object.freeze({
  composition: 'Runtime composes an account-scoped session store without starting network work',
  dispose: 'Runtime disposal clears session ownership and cancels later resolution',
  translation: 'Runtime translates through the supplied catalog and authenticated Spotify adapter',
  confirmation: 'Runtime confirmation persists through the injected association store',
});

function fixture() {
  let requests = Values.noInvocations;
  const associationStore = new library.MemoryAssociationStore();
  const runtime = new library.SpotifyJamRuntime({ accountIdentifier: Values.accountIdentifier,
    credentials: { getCredentials: async () => credentials(), renewCredentials: async () => credentials() },
    endpoints: { resolveServiceOrigin: async () => Values.serviceOrigin },
    recordings: new library.QueryableRecordingCatalog(Values.catalogIdentity, library.RecordingNamespace.MusicBrainz,
      { lookup: async () => song({ durationMilliseconds: Values.durationMilliseconds }), search: async () => [] }),
    associations: associationStore, clock: { nowMilliseconds: () => Values.nowMilliseconds },
    requests: { execute: async request => {
      requests += Values.invocationIncrement;
      const item = { id: Values.spotifyIdentifier, name: Values.title, artists: [{ name: Values.artist }], duration_ms: Values.durationMilliseconds };
      return { status: Values.successStatus, body: request.address.includes(SearchPath) ? { tracks: { items: [item] } } : item };
    } },
  });
  return { runtime, associationStore, requestCount: () => requests };
}
const SearchPath = '/search';

test(Names.composition, () => {
  const state = fixture();
  assert.equal(state.runtime.sessions.getSnapshot().accountIdentifier, Values.accountIdentifier);
  assert.equal(state.requestCount(), Values.noInvocations); state.runtime.dispose();
});

test(Names.dispose, async () => {
  const state = fixture(); state.runtime.dispose(); state.runtime.dispose();
  assert.equal(state.runtime.sessions.getSnapshot().status, library.JamConnectionStatus.Detached);
  assert.equal((await state.runtime.translateToSpotify(Values.recordingIdentifier, Values.market, cancellation().signal)).failure, library.IntegrationFailureCode.Canceled);
  assert.equal(state.requestCount(), Values.noInvocations);
});

test(Names.translation, async () => {
  const state = fixture();
  const result = await state.runtime.translateToSpotify(Values.recordingIdentifier, Values.market, cancellation().signal);
  assert.equal(result.selected.identifier, Values.spotifyIdentifier); state.runtime.dispose();
});

test(Names.confirmation, async () => {
  const state = fixture();
  await state.runtime.confirmAssociation(Values.recordingIdentifier, Values.spotifyIdentifier, Values.market, cancellation().signal);
  assert.equal((await state.associationStore.findForRecording(Values.catalogIdentity, Values.recordingIdentifier, Values.market)).length, Values.singleResultCount);
  state.runtime.dispose();
});
