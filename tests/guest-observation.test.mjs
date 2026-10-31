import test from 'node:test';
import assert from 'node:assert/strict';
import { library, Values, cancellation } from './fixtures.mjs';
const Fixture = Object.freeze({ host: 'synthetic-guest-host', zero: 0, one: 1, two: 2,
  success: 'Fresh membership brackets admitted guest queue observation',
  denied: 'Final guest membership rejection prevents queue publication',
  absent: 'Absent guest participants cannot invoke native verification',
  retired: 'Guest queue observation retires when membership disappears during verification' });
function fixture() {
  const state = { verifications: Fixture.zero, reads: Fixture.zero, denyFinal: false, participant: true, onVerify: () => undefined };
  const session = { identifier: Values.sessionIdentifier, ownedByCurrentAccount: false, active: true,
    hostDeviceIdentifier: Fixture.host, participants: [{ identifier: Values.accountIdentifier, displayName: Values.accountIdentifier }] };
  let snapshot = { accountIdentifier: Values.accountIdentifier, session, status: library.JamConnectionStatus.Ready, failure: null };
  const verifier = { verify: async identity => {
    assert.deepEqual(identity, { accountIdentifier: Values.accountIdentifier, sessionIdentifier: Values.sessionIdentifier, hostDeviceIdentifier: Fixture.host });
    state.verifications += Fixture.one; state.onVerify();
    if (state.denyFinal && state.verifications === Fixture.two) throw new library.IntegrationFailure(library.IntegrationFailureCode.Forbidden);
  } };
  const observer = new library.HostedQueueObserver({ getSnapshot: () => snapshot, subscribe: () => () => undefined },
    { read: async () => { state.reads += Fixture.one; return { currentlyPlaying: null, entries: [] }; } },
    { nowMilliseconds: () => Values.nowMilliseconds }, true, undefined, verifier);
  return { state, observer, remove: () => { snapshot = { ...snapshot, session: null }; }, absent: () => { snapshot = { ...snapshot, session: { ...session, participants: [] } }; } };
}
test(Fixture.success, async () => { const current = fixture(); await current.observer.refresh();
  assert.equal(current.observer.getSnapshot().status, library.HostedQueueStatus.Ready);
  assert.equal(current.state.verifications, Fixture.two); assert.equal(current.state.reads, Fixture.one); current.observer.dispose(); });
test(Fixture.denied, async () => { const current = fixture(); current.state.denyFinal = true; await current.observer.refresh();
  assert.equal(current.observer.getSnapshot().failure, library.IntegrationFailureCode.Forbidden);
  assert.equal(current.observer.getSnapshot().observedAtMilliseconds, null); current.observer.dispose(); });
test(Fixture.absent, async () => { const current = fixture(); current.absent(); await current.observer.refresh();
  assert.equal(current.observer.getSnapshot().failure, library.IntegrationFailureCode.Forbidden);
  assert.equal(current.state.verifications, Fixture.zero); assert.equal(current.state.reads, Fixture.zero); current.observer.dispose(); });
test(Fixture.retired, async () => { const current = fixture(); current.state.onVerify = current.remove; await current.observer.refresh();
  assert.equal(current.state.reads, Fixture.zero); assert.equal(current.observer.getSnapshot().observedAtMilliseconds, null); current.observer.dispose(); });
