import assert from 'node:assert/strict';
import test from 'node:test';
import { library, Values, song, deferred, flushMicrotasks } from './fixtures.mjs';

const Fixture = Object.freeze({ identifier: '0123456789abcdefghijkl', request: 'recording-queue-request', nextRequest: 'recording-queue-next',
  host: 'spotify-host', replacement: 'replacement-session', invalidIdentifier: '', invalidMarket: 'invalid',
  guestAccepted: 'Explicitly composed native guest recording selection reaches the guarded session command',
  missingCandidate: 'abcdefghijkl0123456789', initialCalls: 0, oneCall: 1, firstPosition: 0 });
const Names = Object.freeze({ matching: 'Preparing an app recording translates without confirming or enqueueing',
  explicit: 'An explicit ambiguous candidate selection confirms before host enqueue',
  unavailable: 'Unavailable and contradictory candidates never confirm or enqueue',
  invalid: 'Invalid recording and market input never query catalogs', unknown: 'Unknown candidate identifiers never query confirmation or queue',
  failure: 'Translation failure is visible without a queue mutation', immutable: 'Selection snapshots defensively copy candidates and evidence',
  cancel: 'Canceled matching retires an uncooperative catalog result', replacement: 'Replacement matching cannot be overwritten by its predecessor',
  account: 'Changed session identity clears pending selection and discards late matching',
  host: 'Missing or replaced host cannot receive a stale recording selection', guest: 'A guest cannot submit the host-only recording queue workflow',
  confirmation: 'Confirmation failure never sends a queue mutation', duplicate: 'Concurrent submit never repeats confirmation or queue writes',
  uncertain: 'Unknown queue outcome is preserved and cannot be retried by the selection workflow',
  disposed: 'Disposed coordinators release observation and reject late completions',
  reentrant: 'A subscriber clearing submission cannot allow confirmation or queue side effects' });
function signal() { return new AbortController().signal; }
function match() { const selectedSong = song({ identifier: Fixture.identifier }); return { status: library.MatchStatus.Ambiguous,
  selected: null, failure: null, candidates: [{ song: selectedSong, score: Values.noInvocations,
    acceptable: false, evidence: [library.MatchEvidence.Title, library.MatchEvidence.Artist] }] }; }
function fixture() {
  const listeners = new Set(); const calls = { translated: Fixture.initialCalls, confirmed: Fixture.initialCalls, queued: Fixture.initialCalls };
  const state = { snapshot: { accountIdentifier: Values.accountIdentifier, status: library.JamConnectionStatus.Ready, failure: null,
    session: { identifier: Values.sessionIdentifier, active: true, ownedByCurrentAccount: true, participants: [], hostDeviceIdentifier: Fixture.host } },
    translate: async () => match(), confirm: async () => undefined, queue: async () => ({ applied: true, failure: null }) };
  const coordinator = new library.RecordingQueueCoordinator({ toSpotify: async (...parameters) => {
    calls.translated += Fixture.oneCall; return state.translate(...parameters); }, confirm: async (...parameters) => {
    calls.confirmed += Fixture.oneCall; return state.confirm(...parameters); } }, {
    get guestCommandsAvailable() { return state.guestCommandsAvailable === true; },
    getSnapshot: () => state.snapshot, subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    addToQueue: async (...parameters) => { calls.queued += Fixture.oneCall; return state.queue(...parameters); },
  });
  return { coordinator, state, calls, listeners, change(snapshot) { state.snapshot = snapshot; for (const listener of [...listeners]) listener(); } };
}
async function prepare(current) { await current.coordinator.prepare(Values.recordingIdentifier, Values.market, signal()); }
function enqueue(current) { return current.coordinator.enqueue(Fixture.identifier, Fixture.request, signal()); }

test(Names.matching, async () => { const current = fixture(); await prepare(current);
  assert.equal(current.coordinator.getSnapshot().status, library.RecordingQueueStatus.Ready);
  assert.equal(current.calls.translated, Fixture.oneCall); assert.equal(current.calls.confirmed, Fixture.initialCalls);
  assert.equal(current.calls.queued, Fixture.initialCalls); current.coordinator.dispose(); });
test(Names.explicit, async () => { const current = fixture(); await prepare(current);
  current.state.queue = async () => { assert.equal(current.calls.confirmed, Fixture.oneCall); return { applied: true, failure: null }; };
  assert.equal(await enqueue(current), true); assert.equal(current.coordinator.getSnapshot().acceptedSpotifyIdentifier, Fixture.identifier);
  assert.equal(current.calls.queued, Fixture.oneCall); current.coordinator.dispose(); });
test(Names.unavailable, async () => { for (const evidence of [library.MatchEvidence.Unavailable, library.MatchEvidence.VersionConflict, library.MatchEvidence.RecordingCodeConflict]) {
  const current = fixture(); current.state.translate = async () => { const result = match(); result.candidates[Fixture.firstPosition].evidence.push(evidence); return result; };
  await prepare(current); assert.equal(await enqueue(current), false); assert.equal(current.calls.confirmed, Fixture.initialCalls); current.coordinator.dispose();
} });
test(Names.invalid, async () => { for (const [identifier, market] of [[Fixture.invalidIdentifier, Values.market], [Values.recordingIdentifier, Fixture.invalidMarket]]) {
  const current = fixture(); await current.coordinator.prepare(identifier, market, signal());
  assert.equal(current.coordinator.getSnapshot().failure, library.IntegrationFailureCode.InvalidInput); assert.equal(current.calls.translated, Fixture.initialCalls); current.coordinator.dispose();
} });
test(Names.unknown, async () => { const current = fixture(); await prepare(current);
  assert.equal(await current.coordinator.enqueue(Fixture.missingCandidate, Fixture.request, signal()), false);
  assert.equal(current.calls.confirmed, Fixture.initialCalls); current.coordinator.dispose(); });
test(Names.failure, async () => { const current = fixture(); current.state.translate = async () => ({ status: library.MatchStatus.Failed,
  candidates: [], selected: null, failure: library.IntegrationFailureCode.RateLimited }); await prepare(current);
  assert.equal(current.coordinator.getSnapshot().failure, library.IntegrationFailureCode.RateLimited); assert.equal(current.calls.queued, Fixture.initialCalls); current.coordinator.dispose(); });
test(Names.immutable, async () => { const current = fixture(); const result = match(); current.state.translate = async () => result;
  await prepare(current); result.candidates[Fixture.firstPosition].song.title = Values.otherTitle; result.candidates.splice(Fixture.firstPosition);
  assert.equal(current.coordinator.getSnapshot().match.candidates.length, Fixture.oneCall);
  assert.ok(Object.isFrozen(current.coordinator.getSnapshot().match.candidates[Fixture.firstPosition].song)); current.coordinator.dispose(); });
test(Names.cancel, async () => { const current = fixture(); const pending = deferred(); current.state.translate = () => pending.promise;
  const cancellation = new AbortController(); const preparing = current.coordinator.prepare(Values.recordingIdentifier, Values.market, cancellation.signal);
  cancellation.abort(); await preparing; pending.resolve(match()); await flushMicrotasks();
  assert.equal(current.coordinator.getSnapshot().failure, library.IntegrationFailureCode.Canceled); current.coordinator.dispose(); });
test(Names.replacement, async () => { const current = fixture(); const pending = deferred(); current.state.translate = () => pending.promise;
  const preparing = prepare(current); current.state.translate = async () => match(); await prepare(current); await preparing;
  pending.resolve({ status: library.MatchStatus.NotFound, candidates: [], selected: null, failure: null }); await flushMicrotasks();
  assert.equal(current.coordinator.getSnapshot().match.status, library.MatchStatus.Ambiguous); current.coordinator.dispose(); });
test(Names.account, async () => { const current = fixture(); const pending = deferred(); current.state.translate = () => pending.promise;
  const preparing = prepare(current); current.change({ ...current.state.snapshot, session: { ...current.state.snapshot.session, identifier: Fixture.replacement } });
  await preparing; pending.resolve(match()); await flushMicrotasks(); assert.equal(current.coordinator.getSnapshot().status, library.RecordingQueueStatus.Idle); current.coordinator.dispose(); });
test(Names.host, async () => { const current = fixture(); current.state.snapshot.session.hostDeviceIdentifier = undefined; await prepare(current);
  assert.equal(await enqueue(current), false); assert.equal(current.calls.confirmed, Fixture.initialCalls);
  assert.equal(current.coordinator.getSnapshot().failure, library.IntegrationFailureCode.Unsupported); current.coordinator.dispose(); });
test(Names.guest, async () => { const current = fixture(); current.state.snapshot.session.ownedByCurrentAccount = false; await prepare(current);
  assert.equal(await enqueue(current), false); assert.equal(current.calls.queued, Fixture.initialCalls); current.coordinator.dispose(); });
test(Names.confirmation, async () => { const current = fixture(); await prepare(current);
  current.state.confirm = async () => { throw new library.IntegrationFailure(library.IntegrationFailureCode.Network); };
  assert.equal(await enqueue(current), false); assert.equal(current.calls.queued, Fixture.initialCalls); current.coordinator.dispose(); });
test(Names.duplicate, async () => { const current = fixture(); await prepare(current); const pending = deferred(); current.state.confirm = () => pending.promise;
  const submitting = enqueue(current); assert.equal(await enqueue(current), false); await prepare(current);
  assert.equal(current.coordinator.getSnapshot().status, library.RecordingQueueStatus.Submitting); pending.resolve();
  assert.equal(await submitting, true); assert.equal(current.calls.confirmed, Fixture.oneCall); assert.equal(current.calls.queued, Fixture.oneCall); current.coordinator.dispose(); });
test(Names.uncertain, async () => { const current = fixture(); await prepare(current);
  current.state.queue = async () => ({ applied: false, failure: library.IntegrationFailureCode.UnknownOutcome });
  assert.equal(await enqueue(current), false); assert.equal(await enqueue(current), false);
  assert.equal(current.coordinator.getSnapshot().failure, library.IntegrationFailureCode.UnknownOutcome); assert.equal(current.calls.queued, Fixture.oneCall); current.coordinator.dispose(); });
test(Names.disposed, async () => { const current = fixture(); const pending = deferred(); current.state.translate = () => pending.promise;
  const preparing = prepare(current); current.coordinator.dispose(); await preparing; pending.resolve(match()); await flushMicrotasks();
  assert.equal(current.listeners.size, Fixture.initialCalls); assert.equal(await enqueue(current), false); });
test(Names.reentrant, async () => { const current = fixture(); await prepare(current); current.coordinator.subscribe(() => {
  if (current.coordinator.getSnapshot().status === library.RecordingQueueStatus.Submitting) current.coordinator.clear(); });
  assert.equal(await enqueue(current), false); assert.equal(current.calls.confirmed, Fixture.initialCalls); assert.equal(current.calls.queued, Fixture.initialCalls); current.coordinator.dispose(); });

const ReviewNames = Object.freeze({ request: 'Empty command identities cause no confirmation or queue side effects',
  identity: 'Mutating an injected session snapshot cannot rewrite the captured selection identity',
  dispatched: 'Caller cancellation after dispatch preserves the pending receipt and prevents duplicate submission',
  notFound: 'Not found results cannot submit unrelated catalog candidates' });
test(ReviewNames.request, async () => { const current = fixture(); await prepare(current);
  assert.equal(await current.coordinator.enqueue(Fixture.identifier, Fixture.invalidIdentifier, signal()), false);
  assert.equal(current.calls.confirmed, Fixture.initialCalls); assert.equal(current.calls.queued, Fixture.initialCalls); current.coordinator.dispose(); });
test(ReviewNames.identity, async () => { const current = fixture(); await prepare(current); current.state.snapshot.session.identifier = Fixture.replacement;
  assert.equal(await enqueue(current), false); assert.equal(current.calls.confirmed, Fixture.initialCalls); current.coordinator.dispose(); });
test(ReviewNames.dispatched, async () => { const current = fixture(); await prepare(current); const pending = deferred(); const started = deferred();
  current.state.queue = () => { started.resolve(); return pending.promise; }; const cancellation = new AbortController();
  const submitting = current.coordinator.enqueue(Fixture.identifier, Fixture.request, cancellation.signal); await started.promise;
  cancellation.abort(); assert.equal(current.coordinator.getSnapshot().status, library.RecordingQueueStatus.Submitting);
  assert.equal(await enqueue(current), false); pending.resolve({ applied: true, failure: null });
  assert.equal(await submitting, true); assert.equal(current.calls.queued, Fixture.oneCall); current.coordinator.dispose(); });
test(ReviewNames.notFound, async () => { const current = fixture(); current.state.translate = async () => ({ ...match(), status: library.MatchStatus.NotFound });
  await prepare(current); assert.equal(await enqueue(current), false); assert.equal(current.calls.confirmed, Fixture.initialCalls); current.coordinator.dispose(); });

test(Fixture.guestAccepted, async () => {
  const current = fixture();
  current.state.snapshot.session.ownedByCurrentAccount = false;
  current.state.guestCommandsAvailable = true;
  await prepare(current);
  assert.equal(await enqueue(current), true);
  assert.equal(current.calls.confirmed, Fixture.oneCall);
  assert.equal(current.calls.queued, Fixture.oneCall);
  current.coordinator.dispose();
});
