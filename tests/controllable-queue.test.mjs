import assert from 'node:assert/strict';
import test from 'node:test';
import { library, deferred, flushMicrotasks } from './fixtures.mjs';

const Fixture = Object.freeze({ scope: 'account-session-host', replacedScope: 'other-account-session', firstRevision: 'first', nextRevision: 'next',
  operation: 'operation', occurrence: 'current-occurrence', repeated: 'repeat-occurrence', future: 'future-occurrence',
  recording: 'local-recording', spotify: 'spotify-recording', otherSpotify: 'spotify-other', zeroCalls: 0, oneCall: 1,
  firstPosition: 0, suffix: '-next', operationSuffix: '-operation' });
const Names = Object.freeze({ forward: 'The package maps and submits the actual local queue with current occurrence',
  reverse: 'Participant additions map back into the local queue preserving duplicate occurrences',
  echo: 'An acknowledged queue revision does not echo back to its source', changed: 'Later edits remain eligible even when a port retains the last operation marker',
  missing: 'Unresolved future mappings preserve the known destination queue', current: 'An unresolved current track never replaces a working queue',
  revision: 'A source revision change during matching rejects the stale queue', account: 'A destination account change during matching rejects the stale queue',
  cancel: 'Canceled mapping cannot apply a late uncooperative result', superseded: 'A new synchronization supersedes an older mapping without poisoning future work',
  partial: 'A partial current-only source does not erase known destination entries', receipt: 'Foreign operation receipts never become accepted queue state',
  duplicate: 'An unchanged queue does not issue a duplicate queue write', malformed: 'Repeated occurrence identifiers are rejected before mutation',
  mapping: 'A mapper cannot replace an already known track identity', disposed: 'Disposal cancels matching and fences later synchronization',
  recovery: 'A failed current match cannot poison a later current selection or return to the original track',
  priority: 'Current mapping runs before earlier or future queue entries without changing queue order' });
function entry(occurrenceIdentifier = Fixture.occurrence) {
  return { occurrenceIdentifier, recordingIdentifier: Fixture.recording, spotifyIdentifier: Fixture.spotify };
}
function snapshot(entries = [entry()]) {
  return { scopeIdentifier: Fixture.scope, revision: Fixture.firstRevision, entries,
    currentOccurrenceIdentifier: entries.length ? entries[Fixture.firstPosition].occurrenceIdentifier : null, lastOperationIdentifier: null };
}
function port(initial) {
  const state = { snapshot: initial, changes: [] };
  return { state, read: async () => state.snapshot, apply: async change => {
    assert.equal(change.expectedScopeIdentifier, state.snapshot.scopeIdentifier);
    assert.equal(change.expectedRevision, state.snapshot.revision);
    state.changes.push(change);
    state.snapshot = { ...state.snapshot, entries: change.entries, currentOccurrenceIdentifier: change.currentOccurrenceIdentifier,
      revision: state.snapshot.revision + Fixture.suffix, lastOperationIdentifier: change.operationIdentifier };
    return state.snapshot;
  } };
}
function fixture() {
  const local = port(snapshot()); const spotify = port(snapshot([]));
  const state = { map: async value => ({ ...value }), operation: Fixture.operation };
  const coordinator = new library.QueueSynchronizationCoordinator(local, spotify, { map: (...parameters) => state.map(...parameters) },
    () => { state.operation += Fixture.operationSuffix; return state.operation; });
  return { local, spotify, state, coordinator };
}
function signal() { return new AbortController().signal; }
function synchronize(current, destination = library.QueueSide.Spotify, cancellation = signal()) {
  return current.coordinator.synchronize(destination, cancellation);
}

test(Names.forward, async () => { const current = fixture(); const result = await synchronize(current);
  assert.equal(result.applied, true); assert.deepEqual(result.snapshot.entries, current.local.state.snapshot.entries);
  assert.equal(result.snapshot.currentOccurrenceIdentifier, Fixture.occurrence); current.coordinator.dispose(); });
test(Names.reverse, async () => { const current = fixture(); current.spotify.state.snapshot = snapshot([entry(), entry(Fixture.repeated)]);
  await synchronize(current, library.QueueSide.Local); assert.equal(current.local.state.snapshot.entries.length, Fixture.oneCall + Fixture.oneCall);
  assert.equal(current.local.state.snapshot.entries[Fixture.oneCall].occurrenceIdentifier, Fixture.repeated); current.coordinator.dispose(); });
test(Names.echo, async () => { const current = fixture(); await synchronize(current); const result = await synchronize(current, library.QueueSide.Local);
  assert.equal(result.applied, false); assert.equal(current.local.state.changes.length, Fixture.zeroCalls); current.coordinator.dispose(); });
test(Names.changed, async () => { const current = fixture(); await synchronize(current);
  current.spotify.state.snapshot = { ...current.spotify.state.snapshot, revision: Fixture.nextRevision, entries: [entry(), entry(Fixture.future)] };
  assert.equal((await synchronize(current, library.QueueSide.Local)).applied, true); current.coordinator.dispose(); });
test(Names.missing, async () => { const current = fixture(); current.local.state.snapshot = snapshot([entry(), entry(Fixture.future)]);
  current.spotify.state.snapshot = snapshot([entry(), entry(Fixture.repeated)]);
  current.state.map = async value => value.occurrenceIdentifier === Fixture.future ? null : value;
  const result = await synchronize(current); assert.equal(result.snapshot.entries.some(value => value.occurrenceIdentifier === Fixture.repeated), true);
  assert.deepEqual(result.unresolvedOccurrenceIdentifiers, [Fixture.future]); current.coordinator.dispose(); });
test(Names.current, async () => { const current = fixture(); current.state.map = async () => null;
  await assert.rejects(synchronize(current), { code: library.IntegrationFailureCode.NotFound });
  assert.equal(current.spotify.state.changes.length, Fixture.zeroCalls); current.coordinator.dispose(); });
for (const [name, destinationChanged] of [[Names.revision, false], [Names.account, true]]) {
  test(name, async () => { const current = fixture(); current.state.map = async value => {
    if (destinationChanged) current.spotify.state.snapshot = { ...current.spotify.state.snapshot, scopeIdentifier: Fixture.replacedScope };
    else current.local.state.snapshot = { ...current.local.state.snapshot, revision: Fixture.nextRevision };
    return value;
  }; await assert.rejects(synchronize(current), { code: library.IntegrationFailureCode.Superseded });
  assert.equal(current.spotify.state.changes.length, Fixture.zeroCalls); current.coordinator.dispose(); });
}
test(Names.cancel, async () => { const current = fixture(); const pending = deferred(); current.state.map = () => pending.promise;
  const cancellation = new AbortController(); const synchronizing = synchronize(current, library.QueueSide.Spotify, cancellation.signal);
  await flushMicrotasks(); cancellation.abort(); await assert.rejects(synchronizing, { code: library.IntegrationFailureCode.Canceled });
  pending.resolve(entry()); await flushMicrotasks(); assert.equal(current.spotify.state.changes.length, Fixture.zeroCalls); current.coordinator.dispose(); });
test(Names.superseded, async () => { const current = fixture(); const pending = deferred(); current.state.map = () => pending.promise;
  const first = synchronize(current); await flushMicrotasks(); current.state.map = async value => value;
  const rejected = assert.rejects(first, { code: library.IntegrationFailureCode.Canceled }); await synchronize(current); await rejected;
  pending.resolve(entry()); assert.equal(current.spotify.state.changes.length, Fixture.oneCall); current.coordinator.dispose(); });
test(Names.partial, async () => { const current = fixture(); current.local.state.snapshot = { ...snapshot(), complete: false };
  current.spotify.state.snapshot = snapshot([entry(), entry(Fixture.future)]); const result = await synchronize(current);
  assert.equal(result.snapshot.entries.length, Fixture.oneCall + Fixture.oneCall); current.coordinator.dispose(); });
test(Names.receipt, async () => { const current = fixture(); current.spotify.apply = async change => ({ ...snapshot(change.entries), lastOperationIdentifier: null });
  await assert.rejects(synchronize(current), { code: library.IntegrationFailureCode.InvalidResponse }); current.coordinator.dispose(); });
test(Names.duplicate, async () => { const current = fixture(); await synchronize(current); assert.equal((await synchronize(current)).applied, false);
  assert.equal(current.spotify.state.changes.length, Fixture.oneCall); current.coordinator.dispose(); });
test(Names.malformed, async () => { const current = fixture(); current.local.state.snapshot = snapshot([entry(), entry()]);
  await assert.rejects(synchronize(current), { code: library.IntegrationFailureCode.InvalidResponse }); current.coordinator.dispose(); });
test(Names.mapping, async () => { const current = fixture(); current.state.map = async value => ({ ...value, spotifyIdentifier: Fixture.otherSpotify });
  await assert.rejects(synchronize(current), { code: library.IntegrationFailureCode.InvalidResponse }); current.coordinator.dispose(); });
test(Names.disposed, async () => { const current = fixture(); current.coordinator.dispose();
  await assert.rejects(synchronize(current), { code: library.IntegrationFailureCode.Superseded }); });

test(Names.recovery, async () => { const current = fixture(); current.state.map = async () => null;
  await assert.rejects(synchronize(current), { code: library.IntegrationFailureCode.NotFound });
  current.state.map = async value => value;
  current.local.state.snapshot = snapshot([entry(Fixture.future)]);
  assert.equal((await synchronize(current)).applied, true);
  current.local.state.snapshot = snapshot();
  assert.equal((await synchronize(current)).snapshot.currentOccurrenceIdentifier, Fixture.occurrence); current.coordinator.dispose(); });
test(Names.priority, async () => { const current = fixture(); const mapped = [];
  current.local.state.snapshot = { ...snapshot([entry(Fixture.future), entry()]), currentOccurrenceIdentifier: Fixture.occurrence };
  current.state.map = async value => { mapped.push(value.occurrenceIdentifier); return value; };
  const result = await synchronize(current); assert.equal(mapped[Fixture.firstPosition], Fixture.occurrence);
  assert.equal(result.snapshot.entries[Fixture.firstPosition].occurrenceIdentifier, Fixture.future); current.coordinator.dispose(); });

const CompleteSourceCase = 'A complete replacement queue never retains removed Spotify occurrences merely because a future track is unmapped';
test(CompleteSourceCase, async () => {
  const current = fixture();
  current.local.state.snapshot = { ...snapshot([entry(), entry(Fixture.future)]), complete: true };
  current.spotify.state.snapshot = snapshot([entry(), entry(Fixture.repeated)]);
  current.state.map = async value => value.occurrenceIdentifier === Fixture.future ? null : value;
  const result = await synchronize(current);
  assert.equal(result.snapshot.entries.some(value => value.occurrenceIdentifier === Fixture.repeated), false);
  assert.deepEqual(result.unresolvedOccurrenceIdentifiers, [Fixture.future]);
  current.coordinator.dispose();
});
const RetainedFutureCase = 'A complete queue retains existing mappings for an unresolved occurrence that remains in the actual source';
test(RetainedFutureCase, async () => {
  const current = fixture();
  current.local.state.snapshot = { ...snapshot([entry(), entry(Fixture.future)]), complete: true };
  current.spotify.state.snapshot = snapshot([entry(), entry(Fixture.future)]);
  current.state.map = async value => value.occurrenceIdentifier === Fixture.future ? null : value;
  const result = await synchronize(current);
  assert.equal(result.snapshot.entries.some(value => value.occurrenceIdentifier === Fixture.future), true);
  assert.equal(result.applied, false);
  current.coordinator.dispose();
});
