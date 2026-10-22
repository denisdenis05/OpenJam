import assert from 'node:assert/strict';
import test from 'node:test';
import { library, Values, cancellation, credentials, deferred, flushMicrotasks, sessionResponse, wireSession, song } from './fixtures.mjs';

const MembershipFixture = Object.freeze({
  joinRequest: 'join-request', leaveRequest: 'leave-request', anotherRequest: 'another-request',
  deviceIdentifier: 'actual-test-device', escapedToken: 'token/with?reserved', invalidMode: 'unsupported-mode',
  joinPrefix: '/social-connect/v2/sessions/join/', leavePrefix: '/social-connect/v3/sessions/', leaveSuffix: '/leave',
  controlParameter: 'playback_control', remoteControl: 'listen_and_control', controlOnly: 'control',
  joinTypeParameter: 'join_type', deepLinkType: 'deeplinking', deviceParameter: 'local_device_id', postMethod: 'POST',
  excessivePendingCount: 17, lastPosition: -1, requestPrefix: 'membership-pending-',
});
const Names = Object.freeze({
  disabled: 'Membership defaults remain unavailable even when the protocol implements membership',
  capabilities: 'Experimental membership exposes join and leave without claiming queue or observation',
  protocolDisabled: 'HTTP membership requires explicit experimental opt in before network work',
  remote: 'Remote join uses the experimental listening query and actual selected device',
  control: 'Control only join omits an absent local device identifier',
  escaped: 'Join token reserved characters remain inside the encoded path segment',
  invalid: 'Invalid membership mode token and empty device fail before sending requests',
  malformed: 'Malformed successful join requires unknown outcome reconciliation',
  serverFailure: 'Membership server failure is uncertain and never retried',
  cancelled: 'Cancelled HTTP membership sends no request',
  leaveEndpoint: 'Guest leave posts to the encoded session leave endpoint',
  join: 'Experimental join publishes a copied guest session and explicit invitation',
  duplicate: 'Duplicate joins share one request and completed receipt',
  conflict: 'Join request identity cannot be reused with different join parameters',
  active: 'Joining cannot replace an existing session',
  owner: 'Leaving an owned session is forbidden without ending it explicitly',
  leave: 'Guest leave clears membership and replays its completed receipt',
  absent: 'Guest leave without current membership is superseded',
  stale: 'Late join cannot populate a replacement account snapshot',
  detach: 'Detaching cancels a pending join without issuing guest leave',
  uncertain: 'Unknown join outcome blocks queued and later membership mutations until refresh',
  staleLeave: 'A late guest leave cannot clear a replacement account session',
  runtime: 'Runtime experimental opt in reaches membership composition without eager requests',
  leaveUncertain: 'Unknown guest leave retains membership and blocks further mutations',
  invalidClient: 'Invalid join arguments and request identity do not invoke the membership protocol',
  bounds: 'Pending membership commands share the bounded session command queue',
  missingProtocol: 'Experimental availability requires the corresponding protocol methods',
  guestCreate: 'Creating a Jam cannot replace current guest membership',
  queuedGuestCreate: 'A queued create is forbidden after an earlier guest join completes',
  ownerActivate: 'An owner may reactivate its current Jam',
});

function protocolFixture(body = wireSession({ is_session_owner: false }), status = Values.successStatus, enabled = true) {
  const requests = [];
  const credentialsSession = new library.SpotifyCredentialSession(Values.accountIdentifier, {
    getCredentials: async () => credentials(), renewCredentials: async () => credentials(),
  }, { nowMilliseconds: () => Values.nowMilliseconds });
  const client = new library.SpotifyRequestClient({ execute: async request => {
    requests.push(request); return { status, body };
  } }, credentialsSession);
  return { requests, protocol: new library.SpotifyHttpJamProtocol(client,
    { resolveServiceOrigin: async () => Values.serviceOrigin }, enabled) };
}

function sessionFixture(enabled = true) {
  const calls = { joins: Values.noInvocations, leaves: Values.noInvocations };
  const protocol = {
    createOrActivate: async () => sessionResponse(), end: async () => undefined,
    join: async () => { calls.joins += Values.invocationIncrement; return sessionResponse({ ownedByCurrentAccount: false }); },
    leave: async () => { calls.leaves += Values.invocationIncrement; }, readCurrent: async () => null,
  };
  const client = new library.JamSessionClient(undefined, enabled);
  client.attachAccount(Values.accountIdentifier, protocol);
  const join = (requestIdentifier = MembershipFixture.joinRequest) => client.joinSession(Values.invitationToken,
    library.JamJoinMode.Control, null, requestIdentifier);
  return { client, protocol, calls, join };
}

test(Names.disabled, async () => {
  const fixture = sessionFixture(false);
  assert.equal(fixture.client.capabilities.join, false); assert.equal(fixture.client.capabilities.leave, false);
  assert.equal((await fixture.join()).failure, library.IntegrationFailureCode.Unsupported);
  assert.equal((await fixture.client.leaveSession(MembershipFixture.leaveRequest)).failure, library.IntegrationFailureCode.Unsupported);
  assert.equal(fixture.calls.joins, Values.noInvocations); assert.equal(fixture.calls.leaves, Values.noInvocations);
});

test(Names.capabilities, () => {
  const fixture = sessionFixture();
  assert.equal(fixture.client.capabilities.join, true); assert.equal(fixture.client.capabilities.leave, true);
  assert.equal(fixture.client.capabilities.queue, false); assert.equal(fixture.client.capabilities.observe, false);
  assert.equal(library.VerifiedJamCapabilities.join, false); assert.equal(library.VerifiedJamCapabilities.leave, false);
  fixture.client.detachAccount(); assert.equal(fixture.client.capabilities.join, false);
});

test(Names.protocolDisabled, async () => {
  const fixture = protocolFixture(undefined, Values.successStatus, false);
  await assert.rejects(fixture.protocol.join(Values.invitationToken, library.JamJoinMode.Control, null, cancellation().signal),
    { code: library.IntegrationFailureCode.Unsupported });
  await assert.rejects(fixture.protocol.leave(Values.sessionIdentifier, cancellation().signal), { code: library.IntegrationFailureCode.Unsupported });
  assert.equal(fixture.requests.length, Values.noInvocations);
});

test(Names.remote, async () => {
  const fixture = protocolFixture();
  await fixture.protocol.join(Values.invitationToken, library.JamJoinMode.Remote, MembershipFixture.deviceIdentifier, cancellation().signal);
  const request = fixture.requests[Values.firstPosition]; const address = new URL(request.address);
  assert.equal(request.method, MembershipFixture.postMethod);
  assert.equal(address.pathname, MembershipFixture.joinPrefix + Values.invitationToken);
  assert.equal(address.searchParams.get(MembershipFixture.controlParameter), MembershipFixture.remoteControl);
  assert.equal(address.searchParams.get(MembershipFixture.joinTypeParameter), MembershipFixture.deepLinkType);
  assert.equal(address.searchParams.get(MembershipFixture.deviceParameter), MembershipFixture.deviceIdentifier);
});

test(Names.control, async () => {
  const fixture = protocolFixture();
  await fixture.protocol.join(Values.invitationToken, library.JamJoinMode.Control, null, cancellation().signal);
  const address = new URL(fixture.requests[Values.firstPosition].address);
  assert.equal(address.searchParams.get(MembershipFixture.controlParameter), MembershipFixture.controlOnly);
  assert.equal(address.searchParams.has(MembershipFixture.deviceParameter), false);
});

test(Names.escaped, async () => {
  const fixture = protocolFixture();
  await fixture.protocol.join(MembershipFixture.escapedToken, library.JamJoinMode.Control, null, cancellation().signal);
  assert.equal(new URL(fixture.requests[Values.firstPosition].address).pathname,
    MembershipFixture.joinPrefix + encodeURIComponent(MembershipFixture.escapedToken));
});

test(Names.invalid, async () => {
  const fixture = protocolFixture();
  for (const [joinToken, mode, localDeviceIdentifier] of [[Values.emptyText, library.JamJoinMode.Control, null],
    [Values.invitationToken, MembershipFixture.invalidMode, null], [Values.invitationToken, library.JamJoinMode.Control, Values.emptyText]]) {
    await assert.rejects(fixture.protocol.join(joinToken, mode, localDeviceIdentifier, cancellation().signal), { code: library.IntegrationFailureCode.InvalidInput });
  }
  assert.equal(fixture.requests.length, Values.noInvocations);
});

test(Names.malformed, async () => {
  const fixture = protocolFixture(null);
  await assert.rejects(fixture.protocol.join(Values.invitationToken, library.JamJoinMode.Control, null, cancellation().signal),
    { code: library.IntegrationFailureCode.UnknownOutcome });
});

test(Names.serverFailure, async () => {
  const fixture = protocolFixture(null, Values.serverFailureStatus);
  await assert.rejects(fixture.protocol.join(Values.invitationToken, library.JamJoinMode.Control, null, cancellation().signal),
    { code: library.IntegrationFailureCode.UnknownOutcome });
  assert.equal(fixture.requests.length, Values.singleResultCount);
});

test(Names.cancelled, async () => {
  const fixture = protocolFixture(); const controller = cancellation(); controller.abort();
  await assert.rejects(fixture.protocol.join(Values.invitationToken, library.JamJoinMode.Control, null, controller.signal),
    { code: library.IntegrationFailureCode.Canceled });
  assert.equal(fixture.requests.length, Values.noInvocations);
});

test(Names.leaveEndpoint, async () => {
  const fixture = protocolFixture(null);
  await fixture.protocol.leave(Values.sessionIdentifier, cancellation().signal);
  const request = fixture.requests[Values.firstPosition];
  assert.equal(request.method, MembershipFixture.postMethod);
  assert.equal(new URL(request.address).pathname, MembershipFixture.leavePrefix + Values.sessionIdentifier + MembershipFixture.leaveSuffix);
});

test(Names.join, async () => {
  const fixture = sessionFixture(); const response = sessionResponse({ ownedByCurrentAccount: false });
  fixture.protocol.join = async () => response;
  assert.equal((await fixture.join()).applied, true);
  response.session.participants.splice(Values.firstPosition);
  assert.equal(fixture.client.getSnapshot().session.participants.length, Values.singleResultCount);
  assert.equal(fixture.client.getSnapshot().session.ownedByCurrentAccount, false);
  assert.equal(fixture.client.getInvitation().joinToken, Values.invitationToken);
  assert.equal(JSON.stringify(fixture.client.getSnapshot()).includes(Values.invitationToken), false);
});

test(Names.duplicate, async () => {
  const fixture = sessionFixture(); const first = fixture.join(); const second = fixture.join();
  assert.equal(first, second); await first;
  assert.equal(await fixture.join(), await first); assert.equal(fixture.calls.joins, Values.singleResultCount);
});

test(Names.conflict, async () => {
  const fixture = sessionFixture(); await fixture.join();
  assert.equal((await fixture.client.joinSession(Values.invitationToken, library.JamJoinMode.Remote, null,
    MembershipFixture.joinRequest)).failure, library.IntegrationFailureCode.InvalidInput);
  assert.equal(fixture.calls.joins, Values.singleResultCount);
});

test(Names.active, async () => {
  const fixture = sessionFixture(); await fixture.client.createOrActivateSession(Values.createRequestIdentifier);
  assert.equal((await fixture.join()).failure, library.IntegrationFailureCode.Forbidden);
  assert.equal(fixture.calls.joins, Values.noInvocations);
});

test(Names.owner, async () => {
  const fixture = sessionFixture(); await fixture.client.createOrActivateSession(Values.createRequestIdentifier);
  assert.equal((await fixture.client.leaveSession(MembershipFixture.leaveRequest)).failure, library.IntegrationFailureCode.Forbidden);
  assert.equal(fixture.calls.leaves, Values.noInvocations);
});

test(Names.leave, async () => {
  const fixture = sessionFixture(); await fixture.join();
  const result = await fixture.client.leaveSession(MembershipFixture.leaveRequest);
  assert.equal(result.applied, true); assert.equal(fixture.client.getSnapshot().session, null);
  assert.equal(fixture.client.getInvitation(), null);
  assert.equal(await fixture.client.leaveSession(MembershipFixture.leaveRequest), result);
  assert.equal(fixture.calls.leaves, Values.singleResultCount);
});

test(Names.absent, async () => {
  const fixture = sessionFixture();
  assert.equal((await fixture.client.leaveSession(MembershipFixture.leaveRequest)).failure, library.IntegrationFailureCode.Superseded);
  assert.equal(fixture.calls.leaves, Values.noInvocations);
});

test(Names.stale, async () => {
  const fixture = sessionFixture(); const pending = deferred(); fixture.protocol.join = () => pending.promise;
  const result = fixture.join(); await flushMicrotasks();
  fixture.client.attachAccount(Values.otherAccountIdentifier, fixture.protocol);
  pending.resolve(sessionResponse({ ownedByCurrentAccount: false }));
  assert.equal((await result).failure, library.IntegrationFailureCode.Superseded);
  assert.equal(fixture.client.getSnapshot().accountIdentifier, Values.otherAccountIdentifier);
  assert.equal(fixture.client.getSnapshot().session, null);
});

test(Names.detach, async () => {
  const fixture = sessionFixture(); const pending = deferred(); let observedSignal;
  fixture.protocol.join = async (joinToken, mode, localDeviceIdentifier, cancellationSignal) => {
    observedSignal = cancellationSignal; return pending.promise;
  };
  const result = fixture.join(); await flushMicrotasks(); fixture.client.detachAccount();
  assert.equal(observedSignal.aborted, true); assert.equal((await result).failure, library.IntegrationFailureCode.Superseded);
  assert.equal(fixture.calls.leaves, Values.noInvocations); pending.resolve(sessionResponse());
});

test(Names.uncertain, async () => {
  const fixture = sessionFixture(); const pending = deferred(); fixture.protocol.join = () => pending.promise;
  const result = fixture.join(); const queued = fixture.join(MembershipFixture.anotherRequest);
  await flushMicrotasks(); pending.reject(new library.IntegrationFailure(library.IntegrationFailureCode.UnknownOutcome));
  assert.equal((await result).failure, library.IntegrationFailureCode.UnknownOutcome);
  assert.equal((await queued).failure, library.IntegrationFailureCode.UnknownOutcome);
  assert.equal((await fixture.client.leaveSession(MembershipFixture.leaveRequest)).failure, library.IntegrationFailureCode.UnknownOutcome);
  await fixture.client.refreshSession(MembershipFixture.deviceIdentifier, Values.createRequestIdentifier);
  assert.equal(fixture.client.getSnapshot().status, library.JamConnectionStatus.Ready);
});

test(Names.staleLeave, async () => {
  const fixture = sessionFixture(); await fixture.join(); const pending = deferred(); fixture.protocol.leave = () => pending.promise;
  const result = fixture.client.leaveSession(MembershipFixture.leaveRequest); await flushMicrotasks();
  fixture.client.attachAccount(Values.otherAccountIdentifier, fixture.protocol);
  await fixture.client.createOrActivateSession(Values.createRequestIdentifier); pending.resolve();
  assert.equal((await result).failure, library.IntegrationFailureCode.Superseded);
  assert.equal(fixture.client.getSnapshot().session.identifier, Values.sessionIdentifier);
});

test(Names.runtime, () => {
  let requestCount = Values.noInvocations;
  const runtime = new library.SpotifyJamRuntime({ accountIdentifier: Values.accountIdentifier, experimentalMembership: true,
    credentials: { getCredentials: async () => credentials(), renewCredentials: async () => credentials() },
    endpoints: { resolveServiceOrigin: async () => Values.serviceOrigin },
    recordings: new library.QueryableRecordingCatalog(Values.catalogIdentity, library.RecordingNamespace.MusicBrainz,
      { lookup: async () => song(), search: async () => [] }), associations: new library.MemoryAssociationStore(),
    clock: { nowMilliseconds: () => Values.nowMilliseconds }, requests: { execute: async () => {
      requestCount += Values.invocationIncrement; return { status: Values.successStatus, body: wireSession() };
    } },
  });
  assert.equal(runtime.sessions.capabilities.join, true); assert.equal(requestCount, Values.noInvocations); runtime.dispose();
});

test(Names.leaveUncertain, async () => {
  const fixture = sessionFixture(); await fixture.join();
  fixture.protocol.leave = async () => { throw new library.IntegrationFailure(library.IntegrationFailureCode.UnknownOutcome); };
  assert.equal((await fixture.client.leaveSession(MembershipFixture.leaveRequest)).failure, library.IntegrationFailureCode.UnknownOutcome);
  assert.equal(fixture.client.getSnapshot().status, library.JamConnectionStatus.Uncertain);
  assert.equal(fixture.client.getSnapshot().session.identifier, Values.sessionIdentifier);
  assert.equal((await fixture.join(MembershipFixture.anotherRequest)).failure, library.IntegrationFailureCode.UnknownOutcome);
});

test(Names.invalidClient, async () => {
  const fixture = sessionFixture();
  for (const [joinToken, mode, localDeviceIdentifier, requestIdentifier] of [
    [Values.emptyText, library.JamJoinMode.Control, null, MembershipFixture.joinRequest],
    [Values.invitationToken, MembershipFixture.invalidMode, null, MembershipFixture.joinRequest],
    [Values.invitationToken, library.JamJoinMode.Control, Values.emptyText, MembershipFixture.joinRequest],
    [Values.invitationToken, library.JamJoinMode.Control, null, Values.emptyText],
  ]) assert.equal((await fixture.client.joinSession(joinToken, mode, localDeviceIdentifier, requestIdentifier)).failure,
    library.IntegrationFailureCode.InvalidInput);
  assert.equal(fixture.calls.joins, Values.noInvocations);
});

test(Names.bounds, async () => {
  const fixture = sessionFixture(); const pending = deferred(); fixture.protocol.join = () => pending.promise;
  const requests = Array.from({ length: MembershipFixture.excessivePendingCount }, (unused, requestIndex) =>
    fixture.join(MembershipFixture.requestPrefix + requestIndex));
  assert.equal((await requests.at(MembershipFixture.lastPosition)).failure, library.IntegrationFailureCode.Backpressure);
  fixture.client.detachAccount(); await Promise.all(requests); pending.resolve(sessionResponse());
});

test(Names.missingProtocol, async () => {
  const fixture = sessionFixture(); delete fixture.protocol.join; delete fixture.protocol.leave;
  assert.equal(fixture.client.capabilities.join, false); assert.equal(fixture.client.capabilities.leave, false);
  assert.equal((await fixture.join()).failure, library.IntegrationFailureCode.Unsupported);
  assert.equal((await fixture.client.leaveSession(MembershipFixture.leaveRequest)).failure, library.IntegrationFailureCode.Unsupported);
});

test(Names.guestCreate, async () => {
  const fixture = sessionFixture(); await fixture.join(); let creations = Values.noInvocations;
  fixture.protocol.createOrActivate = async () => { creations += Values.invocationIncrement; return sessionResponse(); };
  assert.equal((await fixture.client.createOrActivateSession(Values.createRequestIdentifier)).failure, library.IntegrationFailureCode.Forbidden);
  assert.equal(creations, Values.noInvocations);
  assert.equal(fixture.client.getSnapshot().session.ownedByCurrentAccount, false);
});

test(Names.queuedGuestCreate, async () => {
  const fixture = sessionFixture(); const pending = deferred(); let creations = Values.noInvocations;
  fixture.protocol.join = () => pending.promise;
  fixture.protocol.createOrActivate = async () => { creations += Values.invocationIncrement; return sessionResponse(); };
  const joining = fixture.join(); await flushMicrotasks();
  const creating = fixture.client.createOrActivateSession(Values.createRequestIdentifier);
  pending.resolve(sessionResponse({ ownedByCurrentAccount: false })); await joining;
  assert.equal((await creating).failure, library.IntegrationFailureCode.Forbidden);
  assert.equal(creations, Values.noInvocations);
  assert.equal(fixture.client.getSnapshot().session.ownedByCurrentAccount, false);
});

test(Names.ownerActivate, async () => {
  const fixture = sessionFixture(); await fixture.client.createOrActivateSession(Values.createRequestIdentifier);
  assert.equal((await fixture.client.createOrActivateSession(MembershipFixture.anotherRequest)).applied, true);
  assert.equal(fixture.client.getSnapshot().session.ownedByCurrentAccount, true);
});
