import assert from 'node:assert/strict';
import test from 'node:test';
import { library, Values, cancellation, credentials, deferred, flushMicrotasks, sessionResponse, wireSession } from './fixtures.mjs';

const CurrentFixture = Object.freeze({ path: '/social-connect/v2/sessions/current', readMethod: 'GET',
  refreshRequest: 'refresh-current-request', nextRefreshRequest: 'next-refresh-current', malformedBody: {},
  foreignOrigin: 'https://example.test', insecureOrigin: 'http://gew1-spclient.spotify.com' });
const Names = Object.freeze({
  read: 'Account current reads the verified passive endpoint and decodes direct session JSON',
  missing: 'Absent account current HTTP 404 becomes no current session',
  malformed: 'Malformed successful account current does not become no session',
  origin: 'Account current rejects untrusted and insecure service origins before sending',
  cancelled: 'Cancelled account current reads send no request',
  otherFailure: 'Account current preserves non absence HTTP failures',
  session: 'Account refresh publishes copied membership and explicit invitation',
  empty: 'Successful empty account refresh clears earlier membership',
  capability: 'Account current observation alone enables refresh capability',
  unsupported: 'A protocol without account current observation rejects that operation',
  duplicate: 'Duplicate account refresh requests share work and retain completed receipts',
  conflict: 'Account refresh request identity cannot be reused for another operation',
  stale: 'Late account refresh cannot populate a replacement account',
  detach: 'Detach cancels account refresh without deleting a remote session',
  reconcile: 'Successful account refresh reconciles an unknown mutation outcome',
  failedReconcile: 'Failed account refresh preserves unknown outcome mutation fencing',
});

function protocolFixture(body = wireSession(), status = Values.successStatus) {
  const requests = [];
  const ownership = new library.SpotifyCredentialSession(Values.accountIdentifier, {
    getCredentials: async () => credentials(), renewCredentials: async () => credentials(),
  }, { nowMilliseconds: () => Values.nowMilliseconds });
  const endpoints = { resolveServiceOrigin: async () => Values.serviceOrigin };
  const requestsClient = new library.SpotifyRequestClient({ execute: async request => {
    requests.push(request); return { status, body };
  } }, ownership);
  return { requests, endpoints, protocol: new library.SpotifyHttpJamProtocol(requestsClient, endpoints) };
}

function sessionFixture(response = sessionResponse()) {
  const calls = { reads: Values.noInvocations, ends: Values.noInvocations };
  const protocol = { createOrActivate: async () => sessionResponse(),
    end: async () => { calls.ends += Values.invocationIncrement; },
    readCurrentAccount: async () => { calls.reads += Values.invocationIncrement; return response; } };
  const client = new library.JamSessionClient(); client.attachAccount(Values.accountIdentifier, protocol);
  return { calls, protocol, client };
}

test(Names.read, async () => {
  const fixture = protocolFixture(); const result = await fixture.protocol.readCurrentAccount(cancellation().signal);
  assert.equal(result.session.identifier, Values.sessionIdentifier);
  assert.equal(fixture.requests.length, Values.singleResultCount);
  const request = fixture.requests[Values.firstPosition];
  assert.equal(request.address, Values.serviceOrigin + CurrentFixture.path);
  assert.equal(request.method, CurrentFixture.readMethod);
});

test(Names.missing, async () => {
  const fixture = protocolFixture(null, Values.missingStatus);
  assert.equal(await fixture.protocol.readCurrentAccount(cancellation().signal), null);
});

test(Names.malformed, async () => {
  const fixture = protocolFixture(CurrentFixture.malformedBody);
  await assert.rejects(fixture.protocol.readCurrentAccount(cancellation().signal), { code: library.IntegrationFailureCode.InvalidResponse });
});

test(Names.origin, async () => {
  for (const origin of [CurrentFixture.foreignOrigin, CurrentFixture.insecureOrigin]) {
    const fixture = protocolFixture(); fixture.endpoints.resolveServiceOrigin = async () => origin;
    await assert.rejects(fixture.protocol.readCurrentAccount(cancellation().signal), { code: library.IntegrationFailureCode.InvalidInput });
    assert.equal(fixture.requests.length, Values.noInvocations);
  }
});

test(Names.cancelled, async () => {
  const fixture = protocolFixture(); const controller = cancellation(); controller.abort();
  await assert.rejects(fixture.protocol.readCurrentAccount(controller.signal), { code: library.IntegrationFailureCode.Canceled });
  assert.equal(fixture.requests.length, Values.noInvocations);
});

test(Names.otherFailure, async () => {
  const fixture = protocolFixture(null, Values.serverFailureStatus);
  await assert.rejects(fixture.protocol.readCurrentAccount(cancellation().signal), { code: library.IntegrationFailureCode.Network });
});

test(Names.session, async () => {
  const response = sessionResponse(); const fixture = sessionFixture(response);
  assert.equal((await fixture.client.refreshCurrentSession(CurrentFixture.refreshRequest)).applied, true);
  response.session.participants.splice(Values.firstPosition);
  assert.equal(fixture.client.getSnapshot().session.participants.length, Values.singleResultCount);
  assert.equal(fixture.client.getInvitation().joinToken, Values.invitationToken);
  assert.equal(JSON.stringify(fixture.client.getSnapshot()).includes(Values.invitationToken), false);
});

test(Names.empty, async () => {
  const fixture = sessionFixture(null); await fixture.client.createOrActivateSession(Values.createRequestIdentifier);
  await fixture.client.refreshCurrentSession(CurrentFixture.refreshRequest);
  assert.equal(fixture.client.getSnapshot().session, null); assert.equal(fixture.client.getInvitation(), null);
});

test(Names.capability, () => {
  const fixture = sessionFixture(); assert.equal(fixture.client.capabilities.refresh, true);
  fixture.client.detachAccount(); assert.equal(fixture.client.capabilities.refresh, false);
});

test(Names.unsupported, async () => {
  const fixture = sessionFixture(); delete fixture.protocol.readCurrentAccount;
  assert.equal((await fixture.client.refreshCurrentSession(CurrentFixture.refreshRequest)).failure, library.IntegrationFailureCode.Unsupported);
  assert.equal(fixture.calls.reads, Values.noInvocations);
});

test(Names.duplicate, async () => {
  const fixture = sessionFixture();
  const first = fixture.client.refreshCurrentSession(CurrentFixture.refreshRequest);
  const second = fixture.client.refreshCurrentSession(CurrentFixture.refreshRequest);
  assert.equal(first, second); await first;
  assert.equal(await fixture.client.refreshCurrentSession(CurrentFixture.refreshRequest), await first);
  assert.equal(fixture.calls.reads, Values.singleResultCount);
});

test(Names.conflict, async () => {
  const fixture = sessionFixture(); await fixture.client.refreshCurrentSession(CurrentFixture.refreshRequest);
  assert.equal((await fixture.client.endSession(CurrentFixture.refreshRequest)).failure, library.IntegrationFailureCode.InvalidInput);
  assert.equal(fixture.calls.ends, Values.noInvocations);
});

test(Names.stale, async () => {
  const fixture = sessionFixture(); const pending = deferred(); fixture.protocol.readCurrentAccount = () => pending.promise;
  const result = fixture.client.refreshCurrentSession(CurrentFixture.refreshRequest); await flushMicrotasks();
  fixture.client.attachAccount(Values.otherAccountIdentifier, fixture.protocol); pending.resolve(sessionResponse());
  assert.equal((await result).failure, library.IntegrationFailureCode.Superseded);
  assert.equal(fixture.client.getSnapshot().accountIdentifier, Values.otherAccountIdentifier);
  assert.equal(fixture.client.getSnapshot().session, null);
});

test(Names.detach, async () => {
  const fixture = sessionFixture(); const pending = deferred(); let signal;
  fixture.protocol.readCurrentAccount = cancellationSignal => { signal = cancellationSignal; return pending.promise; };
  const result = fixture.client.refreshCurrentSession(CurrentFixture.refreshRequest); await flushMicrotasks(); fixture.client.detachAccount();
  assert.equal(signal.aborted, true); assert.equal((await result).failure, library.IntegrationFailureCode.Superseded);
  assert.equal(fixture.calls.ends, Values.noInvocations); pending.resolve(sessionResponse());
});

test(Names.reconcile, async () => {
  const fixture = sessionFixture(null);
  fixture.protocol.createOrActivate = async () => { throw new library.IntegrationFailure(library.IntegrationFailureCode.UnknownOutcome); };
  await fixture.client.createOrActivateSession(Values.createRequestIdentifier);
  assert.equal(fixture.client.getSnapshot().status, library.JamConnectionStatus.Uncertain);
  await fixture.client.refreshCurrentSession(CurrentFixture.refreshRequest);
  assert.equal(fixture.client.getSnapshot().status, library.JamConnectionStatus.Ready);
  fixture.protocol.createOrActivate = async () => sessionResponse();
  assert.equal((await fixture.client.createOrActivateSession(Values.endRequestIdentifier)).applied, true);
});

test(Names.failedReconcile, async () => {
  const fixture = sessionFixture();
  fixture.protocol.createOrActivate = async () => { throw new library.IntegrationFailure(library.IntegrationFailureCode.UnknownOutcome); };
  fixture.protocol.readCurrentAccount = async () => { throw new library.IntegrationFailure(library.IntegrationFailureCode.Network); };
  await fixture.client.createOrActivateSession(Values.createRequestIdentifier);
  assert.equal((await fixture.client.refreshCurrentSession(CurrentFixture.refreshRequest)).failure, library.IntegrationFailureCode.Network);
  assert.equal(fixture.client.getSnapshot().status, library.JamConnectionStatus.Uncertain);
  assert.equal((await fixture.client.endSession(Values.endRequestIdentifier)).failure, library.IntegrationFailureCode.UnknownOutcome);
});
