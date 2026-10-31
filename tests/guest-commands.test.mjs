import assert from 'node:assert/strict';
import test from 'node:test';
import { library, Values, sessionResponse, deferred, flushMicrotasks } from './fixtures.mjs';

const Fixture = Object.freeze({ host: 'guest-command-host', refresh: 'guest-command-refresh', request: 'guest-command-request',
  nextRequest: 'guest-command-next-request', recovery: 'guest-command-recovery',
  recovered: 'Explicit guest shared-state recovery clears uncertainty without replaying old commands',
  recoveryDenied: 'Removed guests cannot clear an uncertain command through reconciliation', denied: 'Guest command denial prevents every mutation',
  defaults: 'Guest commands remain forbidden without an explicitly composed native verifier',
  accepted: 'Guest playback and queue commands verify fresh membership before one dispatch',
  detached: 'Account retirement during guest verification prevents command dispatch',
  uncertain: 'Unknown guest mutation outcomes block subsequent requests without replay',
  duplicate: 'Duplicate guest requests share membership verification and one mutation',
  deniedMutation: 'Native permission denial stays a definite denial without retry' });

async function fixture({ enabled = true, verification = async () => undefined, mutation = async () => undefined } = {}) {
  const calls = { verification: [], mutations: [] };
  const response = sessionResponse({ ownedByCurrentAccount: false, hostDeviceIdentifier: Fixture.host,
    participants: [{ identifier: Values.accountIdentifier, displayName: Values.participantName }] });
  const client = new library.JamSessionClient();
  const dispatch = async (...parameters) => { calls.mutations.push(parameters); await mutation(); };
  const verifier = { verify: async (...parameters) => { calls.verification.push(parameters); await verification(); } };
  client.attachAccount(Values.accountIdentifier, { readCurrentAccount: async () => response },
    { addToQueue: dispatch }, { execute: dispatch }, { verify: async () => undefined }, enabled ? verifier : null);
  await client.refreshCurrentSession(Fixture.refresh);
  return { client, calls };
}

function execute(client, queue, requestIdentifier = Fixture.request) {
  return queue ? client.addToQueue(Values.spotifyIdentifier, requestIdentifier)
    : client.executeHostedPlayback({ kind: library.HostedPlaybackCommandKind.Pause }, requestIdentifier);
}

for (const queue of [false, true]) {
  test(Fixture.defaults, async () => {
    const current = await fixture({ enabled: false });
    const result = await execute(current.client, queue);
    assert.equal(result.failure, library.IntegrationFailureCode.Forbidden);
    assert.equal(current.calls.mutations.length, Values.noInvocations);
  });
  test(Fixture.accepted, async () => {
    const current = await fixture();
    assert.equal((await execute(current.client, queue)).applied, true);
    assert.equal(current.calls.verification.length, Values.singleResultCount);
    assert.deepEqual(current.calls.verification[Values.firstPosition][Values.firstPosition], {
      accountIdentifier: Values.accountIdentifier, sessionIdentifier: Values.sessionIdentifier, hostDeviceIdentifier: Fixture.host });
    assert.equal(current.calls.mutations.length, Values.singleResultCount);
  });
  test(Fixture.denied, async () => {
    const current = await fixture({ verification: async () => { throw new library.IntegrationFailure(library.IntegrationFailureCode.Forbidden); } });
    assert.equal((await execute(current.client, queue)).failure, library.IntegrationFailureCode.Forbidden);
    assert.equal(current.calls.mutations.length, Values.noInvocations);
  });
  test(Fixture.detached, async () => {
    const pending = deferred();
    const current = await fixture({ verification: () => pending.promise });
    const result = execute(current.client, queue);
    await flushMicrotasks();
    current.client.detachAccount();
    pending.resolve();
    assert.equal((await result).applied, false);
    assert.equal(current.calls.mutations.length, Values.noInvocations);
  });
  test(Fixture.uncertain, async () => {
    const current = await fixture({ mutation: async () => { throw new library.IntegrationFailure(library.IntegrationFailureCode.UnknownOutcome); } });
    assert.equal((await execute(current.client, queue)).failure, library.IntegrationFailureCode.UnknownOutcome);
    assert.equal((await execute(current.client, queue, Fixture.nextRequest)).failure, library.IntegrationFailureCode.UnknownOutcome);
    assert.equal(current.calls.mutations.length, Values.singleResultCount);
  });
  test(Fixture.duplicate, async () => {
    const current = await fixture();
    const results = await Promise.all([execute(current.client, queue), execute(current.client, queue)]);
    assert.equal(results.every(result => result.applied), true);
    assert.equal(current.calls.verification.length, Values.singleResultCount);
    assert.equal(current.calls.mutations.length, Values.singleResultCount);
  });
  test(Fixture.deniedMutation, async () => {
    const current = await fixture({ mutation: async () => { throw new library.IntegrationFailure(library.IntegrationFailureCode.Forbidden); } });
    assert.equal((await execute(current.client, queue)).failure, library.IntegrationFailureCode.Forbidden);
    assert.equal(current.calls.mutations.length, Values.singleResultCount);
  });
}

test(Fixture.recovered, async () => {
  let uncertain = true;
  const current = await fixture({ mutation: async () => {
    if (uncertain) throw new library.IntegrationFailure(library.IntegrationFailureCode.UnknownOutcome);
  } });
  await execute(current.client, true);
  uncertain = false;
  assert.equal((await current.client.reconcileSharedState(Fixture.recovery)).applied, true);
  assert.equal(current.calls.mutations.length, Values.singleResultCount);
  assert.equal((await execute(current.client, true, Fixture.nextRequest)).applied, true);
  assert.equal(current.calls.mutations.length, Values.retriedInvocationCount);
});
test(Fixture.recoveryDenied, async () => {
  let removed = false;
  const current = await fixture({ verification: async () => {
    if (removed) throw new library.IntegrationFailure(library.IntegrationFailureCode.Forbidden);
  }, mutation: async () => { throw new library.IntegrationFailure(library.IntegrationFailureCode.UnknownOutcome); } });
  await execute(current.client, true);
  removed = true;
  assert.equal((await current.client.reconcileSharedState(Fixture.recovery)).failure, library.IntegrationFailureCode.Forbidden);
  assert.equal((await execute(current.client, true, Fixture.nextRequest)).failure, library.IntegrationFailureCode.UnknownOutcome);
  assert.equal(current.calls.mutations.length, Values.singleResultCount);
});
