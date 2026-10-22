import assert from 'node:assert/strict';
import test from 'node:test';
import { library, Values, cancellation, credentials, deferred, flushMicrotasks, sessionResponse, wireSession } from './fixtures.mjs';

const Names = Object.freeze({
  create: 'Jam creation sends a state-changing GET to the resolved regional service',
  end: 'Ending a Jam sends DELETE to the encoded session endpoint',
  endMissing: 'Deleting an already absent Jam succeeds',
  malformed: 'Malformed successful creation reports an unknown outcome',
  origin: 'Invalid service origins are rejected before sending credentials',
  invitation: 'Invitation secrets are explicit and absent from ordinary snapshots',
  duplicate: 'Duplicate create requests share one operation and result',
  conflict: 'Reusing a request identifier for another command is rejected',
  endDuplicate: 'Duplicate end requests return their original result after the session is cleared',
  order: 'Conflicting session mutations execute in submission order',
  switchAccount: 'An old account completion cannot populate a new account snapshot',
  detach: 'Detachment cancels owned operations without remotely ending a shared Jam',
  uncertain: 'Unknown creation outcomes block subsequent mutations',
  queuedUncertain: 'Already queued operations do not execute after an unknown outcome',
  forbidden: 'A guest cannot end a session owned by another account',
  bounds: 'The pending command limit rejects excessive work',
  subscriptions: 'Unsubscribed listeners stop receiving snapshots',
  subscriberFailure: 'Subscriber failures do not prevent other listeners or change command outcomes',
  immutable: 'Caller changes to protocol responses cannot change published snapshots',
  capabilities: 'Unverified guest and observation capabilities remain unavailable',
  passiveEmpty: 'Passive device status without a session does not create a Jam',
  passiveSession: 'Passive device status decodes an existing session',
  reconcile: 'A successful passive refresh reconciles an unknown mutation outcome',
  reconcileFailure: 'A failed refresh preserves the requirement to reconcile',
  unsupportedRefresh: 'Unconfigured observation protocols reject refresh explicitly',
  pathTraversal: 'Session and device identifiers cannot escape their endpoint path',
  receiptWindow: 'Completed receipts retire from the bounded local deduplication window',
  invalidPassive: 'Malformed passive status cannot be mistaken for an absent session',
});
const ProtocolFixture = Object.freeze({ createPath: '/social-connect/v2/sessions/current_or_new', activateParameter: 'activate',
  activated: 'true', deletePrefix: '/social-connect/v3/sessions/', deleteMethod: 'DELETE', getMethod: 'GET',
  excessiveCommands: 18, maximumPending: 16, requestPrefix: 'queued-', invalidOrigin: 'https://example.test',
  malformedSessionIdentifier: 'malformed-session', nullSession: null });

function protocolFixture(status = Values.successStatus, body = wireSession()) {
  const requests = [];
  const session = new library.SpotifyCredentialSession(Values.accountIdentifier, {
    getCredentials: async () => credentials(), renewCredentials: async () => credentials(),
  }, { nowMilliseconds: () => Values.nowMilliseconds });
  const client = new library.SpotifyRequestClient({ execute: async request => { requests.push(request); return { status, body }; } }, session);
  const endpoints = { resolveServiceOrigin: async () => Values.serviceOrigin };
  return { requests, endpoints, protocol: new library.SpotifyHttpJamProtocol(client, endpoints) };
}

function sessionFixture(response = sessionResponse()) {
  const calls = { create: Values.noInvocations, end: Values.noInvocations };
  const protocol = { createOrActivate: async () => { calls.create += Values.invocationIncrement; return response; },
    end: async () => { calls.end += Values.invocationIncrement; } };
  const client = new library.JamSessionClient(); client.attachAccount(Values.accountIdentifier, protocol);
  return { client, protocol, calls };
}

test(Names.create, async () => {
  const fixture = protocolFixture();
  const result = await fixture.protocol.createOrActivate(cancellation().signal);
  const request = fixture.requests[Values.firstPosition]; const address = new URL(request.address);
  assert.equal(address.origin, Values.serviceOrigin); assert.equal(address.pathname, ProtocolFixture.createPath);
  assert.equal(address.searchParams.get(ProtocolFixture.activateParameter), ProtocolFixture.activated);
  assert.equal(request.method, ProtocolFixture.getMethod); assert.equal(result.session.identifier, Values.sessionIdentifier);
});

test(Names.end, async () => {
  const fixture = protocolFixture(); await fixture.protocol.end(Values.sessionIdentifier, cancellation().signal);
  assert.equal(new URL(fixture.requests[Values.firstPosition].address).pathname, ProtocolFixture.deletePrefix + Values.sessionIdentifier);
  assert.equal(fixture.requests[Values.firstPosition].method, ProtocolFixture.deleteMethod);
});

test(Names.endMissing, async () => {
  await protocolFixture(Values.missingStatus, null).protocol.end(Values.sessionIdentifier, cancellation().signal);
});

test(Names.malformed, async () => {
  await assert.rejects(protocolFixture(Values.successStatus, { session_id: ProtocolFixture.malformedSessionIdentifier })
    .protocol.createOrActivate(cancellation().signal), { code: library.IntegrationFailureCode.UnknownOutcome });
});

test(Names.origin, async () => {
  const fixture = protocolFixture(); fixture.endpoints.resolveServiceOrigin = async () => ProtocolFixture.invalidOrigin;
  await assert.rejects(fixture.protocol.createOrActivate(cancellation().signal), { code: library.IntegrationFailureCode.InvalidInput });
  assert.equal(fixture.requests.length, Values.noInvocations);
});

test(Names.invitation, async () => {
  const fixture = sessionFixture(); await fixture.client.createOrActivateSession(Values.createRequestIdentifier);
  const serialized = JSON.stringify(fixture.client.getSnapshot());
  assert.ok(!serialized.includes(Values.invitationToken)); assert.ok(!serialized.includes(Values.invitationAddress));
  assert.equal(fixture.client.getInvitation().joinToken, Values.invitationToken);
});

test(Names.duplicate, async () => {
  const fixture = sessionFixture();
  const first = fixture.client.createOrActivateSession(Values.createRequestIdentifier);
  const second = fixture.client.createOrActivateSession(Values.createRequestIdentifier);
  assert.equal(first, second); await first; assert.equal(fixture.calls.create, Values.singleResultCount);
});

test(Names.conflict, async () => {
  const fixture = sessionFixture(); await fixture.client.createOrActivateSession(Values.createRequestIdentifier);
  const result = await fixture.client.endSession(Values.createRequestIdentifier);
  assert.equal(result.failure, library.IntegrationFailureCode.InvalidInput); assert.equal(fixture.calls.end, Values.noInvocations);
});

test(Names.endDuplicate, async () => {
  const fixture = sessionFixture(); await fixture.client.createOrActivateSession(Values.createRequestIdentifier);
  const first = await fixture.client.endSession(Values.endRequestIdentifier);
  const second = await fixture.client.endSession(Values.endRequestIdentifier);
  assert.equal(first, second); assert.equal(fixture.calls.end, Values.singleResultCount);
});

test(Names.order, async () => {
  const fixture = sessionFixture(); const pending = deferred();
  fixture.protocol.createOrActivate = () => pending.promise;
  const first = fixture.client.createOrActivateSession(Values.createRequestIdentifier);
  await flushMicrotasks(); assert.equal(fixture.calls.end, Values.noInvocations);
  pending.resolve(sessionResponse()); await first;
  assert.equal((await fixture.client.endSession(Values.endRequestIdentifier)).applied, true);
});

test(Names.switchAccount, async () => {
  const fixture = sessionFixture(); const pending = deferred(); fixture.protocol.createOrActivate = () => pending.promise;
  const first = fixture.client.createOrActivateSession(Values.createRequestIdentifier); await flushMicrotasks();
  fixture.client.attachAccount(Values.otherAccountIdentifier, fixture.protocol);
  pending.resolve(sessionResponse());
  assert.equal((await first).failure, library.IntegrationFailureCode.Superseded);
  assert.equal(fixture.client.getSnapshot().accountIdentifier, Values.otherAccountIdentifier);
  assert.equal(fixture.client.getSnapshot().session, null);
});

test(Names.detach, async () => {
  const fixture = sessionFixture(); await fixture.client.createOrActivateSession(Values.createRequestIdentifier);
  fixture.client.detachAccount();
  assert.equal(fixture.client.getSnapshot().status, library.JamConnectionStatus.Detached);
  assert.equal(fixture.client.getInvitation(), null); assert.equal(fixture.calls.end, Values.noInvocations);
});

test(Names.uncertain, async () => {
  const fixture = sessionFixture(); fixture.protocol.createOrActivate = async () => { throw new library.IntegrationFailure(library.IntegrationFailureCode.UnknownOutcome); };
  await fixture.client.createOrActivateSession(Values.createRequestIdentifier);
  assert.equal(fixture.client.getSnapshot().status, library.JamConnectionStatus.Uncertain);
  assert.equal((await fixture.client.endSession(Values.endRequestIdentifier)).failure, library.IntegrationFailureCode.UnknownOutcome);
});

test(Names.queuedUncertain, async () => {
  const fixture = sessionFixture(); const pending = deferred(); let count = Values.noInvocations;
  fixture.protocol.createOrActivate = () => { count += Values.invocationIncrement; return pending.promise; };
  const first = fixture.client.createOrActivateSession(Values.createRequestIdentifier);
  const second = fixture.client.createOrActivateSession(Values.endRequestIdentifier);
  await flushMicrotasks(); pending.reject(new library.IntegrationFailure(library.IntegrationFailureCode.UnknownOutcome));
  await first; assert.equal((await second).failure, library.IntegrationFailureCode.UnknownOutcome); assert.equal(count, Values.singleResultCount);
});

test(Names.forbidden, async () => {
  const fixture = sessionFixture(sessionResponse({ ownedByCurrentAccount: false }));
  await fixture.client.createOrActivateSession(Values.createRequestIdentifier);
  assert.equal((await fixture.client.endSession(Values.endRequestIdentifier)).failure, library.IntegrationFailureCode.Forbidden);
  assert.equal(fixture.calls.end, Values.noInvocations);
});

test(Names.bounds, async () => {
  const fixture = sessionFixture(); const pending = deferred(); fixture.protocol.createOrActivate = () => pending.promise;
  const commands = Array.from({ length: ProtocolFixture.excessiveCommands }, (unused, position) =>
    fixture.client.createOrActivateSession(ProtocolFixture.requestPrefix + position));
  assert.equal((await commands[ProtocolFixture.maximumPending]).failure, library.IntegrationFailureCode.Backpressure);
  fixture.client.detachAccount(); pending.resolve(sessionResponse()); await Promise.all(commands);
});

test(Names.subscriptions, () => {
  const fixture = sessionFixture(); let count = Values.noInvocations;
  const stop = fixture.client.subscribe(() => { count += Values.invocationIncrement; }); stop(); fixture.client.detachAccount();
  assert.equal(count, Values.noInvocations);
});

test(Names.subscriberFailure, async () => {
  const fixture = sessionFixture(); let count = Values.noInvocations;
  fixture.client.subscribe(() => { throw new Error(Values.accessToken); }); fixture.client.subscribe(() => { count += Values.invocationIncrement; });
  assert.equal((await fixture.client.createOrActivateSession(Values.createRequestIdentifier)).applied, true);
  assert.ok(count > Values.noInvocations);
});

test(Names.immutable, async () => {
  const response = sessionResponse(); const fixture = sessionFixture(response);
  await fixture.client.createOrActivateSession(Values.createRequestIdentifier);
  response.session.participants[Values.firstPosition].displayName = Values.otherArtist;
  assert.equal(fixture.client.getSnapshot().session.participants[Values.firstPosition].displayName, Values.participantName);
  assert.ok(Object.isFrozen(fixture.client.getSnapshot().session.participants));
});

test(Names.capabilities, () => {
  const fixture = sessionFixture();
  assert.equal(fixture.client.capabilities.join, false); assert.equal(fixture.client.capabilities.observe, false);
  assert.equal(fixture.client.capabilities.createOrActivate, true);
});

test(Names.passiveEmpty, async () => {
  const fixture = protocolFixture(Values.successStatus, { device_broadcast_status: { device_id: Values.participantIdentifier } });
  assert.equal(await fixture.protocol.readCurrent(Values.participantIdentifier, cancellation().signal), null);
  assert.ok(!fixture.requests[Values.firstPosition].address.includes(ProtocolFixture.createPath));
});

test(Names.passiveSession, async () => {
  const fixture = protocolFixture(Values.successStatus, { session: wireSession(), device_broadcast_status: { device_id: Values.participantIdentifier } });
  assert.equal((await fixture.protocol.readCurrent(Values.participantIdentifier, cancellation().signal)).session.identifier, Values.sessionIdentifier);
});

test(Names.reconcile, async () => {
  const fixture = sessionFixture();
  fixture.protocol.createOrActivate = async () => { throw new library.IntegrationFailure(library.IntegrationFailureCode.UnknownOutcome); };
  fixture.protocol.readCurrent = async () => sessionResponse();
  await fixture.client.createOrActivateSession(Values.createRequestIdentifier);
  assert.equal((await fixture.client.refreshSession(Values.participantIdentifier, Values.endRequestIdentifier)).applied, true);
  assert.equal(fixture.client.getSnapshot().status, library.JamConnectionStatus.Ready);
  assert.equal(fixture.client.getSnapshot().session.identifier, Values.sessionIdentifier);
});

test(Names.reconcileFailure, async () => {
  const fixture = sessionFixture();
  fixture.protocol.createOrActivate = async () => { throw new library.IntegrationFailure(library.IntegrationFailureCode.UnknownOutcome); };
  fixture.protocol.readCurrent = async () => { throw new library.IntegrationFailure(library.IntegrationFailureCode.RateLimited); };
  await fixture.client.createOrActivateSession(Values.createRequestIdentifier);
  await fixture.client.refreshSession(Values.participantIdentifier, Values.endRequestIdentifier);
  assert.equal(fixture.client.getSnapshot().status, library.JamConnectionStatus.Uncertain);
});

test(Names.unsupportedRefresh, async () => {
  const fixture = sessionFixture();
  assert.equal((await fixture.client.refreshSession(Values.participantIdentifier, Values.endRequestIdentifier)).failure, library.IntegrationFailureCode.Unsupported);
});

const PathFixture = Object.freeze({ parent: '..', current: '.', retiredRequestCount: 70, requestPrefix: 'completed-' });

test(Names.pathTraversal, async () => {
  const fixture = protocolFixture();
  for (const identifier of [PathFixture.parent, PathFixture.current]) {
    await assert.rejects(fixture.protocol.end(identifier, cancellation().signal), { code: library.IntegrationFailureCode.InvalidInput });
    await assert.rejects(fixture.protocol.readCurrent(identifier, cancellation().signal), { code: library.IntegrationFailureCode.InvalidInput });
  }
  assert.equal(fixture.requests.length, Values.noInvocations);
});

test(Names.receiptWindow, async () => {
  const fixture = sessionFixture();
  for (let position = Values.firstPosition; position < PathFixture.retiredRequestCount; position += Values.positionIncrement) {
    await fixture.client.createOrActivateSession(PathFixture.requestPrefix + position);
  }
  await fixture.client.createOrActivateSession(PathFixture.requestPrefix + Values.firstPosition);
  assert.equal(fixture.calls.create, PathFixture.retiredRequestCount + Values.singleResultCount);
});

test(Names.invalidPassive, async () => {
  for (const body of [{}, { device_broadcast_status: { device_id: Values.otherSessionIdentifier } }]) {
    await assert.rejects(protocolFixture(Values.successStatus, body).protocol.readCurrent(Values.participantIdentifier, cancellation().signal),
      { code: library.IntegrationFailureCode.InvalidResponse });
  }
});
