import assert from 'node:assert/strict';
import test from 'node:test';
import { library, Values, cancellation, credentials, deferred, flushMicrotasks, sessionResponse, wireSession, song } from './fixtures.mjs';

const Fixture = Object.freeze({ hostIdentifier: 'actual-spotify-host-device', otherHostIdentifier: 'different-host-device',
  requestIdentifier: 'queue-request', otherRequestIdentifier: 'other-queue-request', refreshIdentifier: 'queue-refresh-request',
  endpoint: 'https://api.spotify.com/v1/me/player/queue', trackParameter: 'uri', deviceParameter: 'device_id',
  trackPrefix: 'spotify:track:', postMethod: 'POST', acceptedStatus: 204, forbiddenStatus: 403,
  invalidIdentifier: 'invalid-track', maximumPending: 16, excessivePending: 17, requestPrefix: 'pending-queue-',
  lastPosition: -1, queueOperation: 'queue', endOperation: 'end', rawFailure: 'Private failure text' });
const Names = Object.freeze({
  adapter: 'Hosted queue posts a Spotify track URI to the explicitly named host device',
  invalid: 'Hosted queue rejects invalid track and absent or whitespace host identifiers before network work',
  cancelled: 'Cancelled queue requests never execute',
  forbidden: 'Spotify queue permission errors remain explicit and are never retried',
  rateLimited: 'Spotify queue rate limits remain explicit and are never retried',
  serverFailure: 'Server errors leave queue acceptance uncertain without retries',
  transportFailure: 'Transport failure during enqueue has an unknown outcome',
  malformed: 'Unexpected nonempty successful queue responses have an unknown outcome',
  hostDecode: 'Verified current session decoding preserves an actual host device identifier',
  hostEmpty: 'Empty host device identifiers do not invent playable Jam targets',
  hostMalformed: 'Malformed host device fields reject session JSON',
  disabled: 'Hosted queue is unavailable without an injected queue protocol',
  accepted: 'Owned active Jam enqueue uses the host from its current session',
  guest: 'Guest membership cannot modify an account queue through hosted queue support',
  inactive: 'Inactive Jam membership cannot enqueue to a Spotify endpoint',
  absentHost: 'A Jam without an active host rejects enqueue instead of targeting an arbitrary device',
  absentSession: 'Enqueue without current membership is superseded',
  duplicate: 'Duplicate enqueue request identities share one receipt and submission',
  conflict: 'Enqueue request identity cannot be reused for another track',
  invalidClient: 'Invalid queue identifiers do not invoke an injected queue adapter',
  ordering: 'Membership ending waits behind an already submitted queue command',
  ended: 'An enqueue queued behind ending a Jam cannot modify the former host queue',
  changedHost: 'A queued enqueue cannot target a host replaced by an earlier refresh',
  uncertain: 'Membership refresh cannot clear an unknown queue mutation outcome',
  late: 'A late queue response cannot populate another account snapshot',
  detach: 'Detachment aborts a queue request without ending its remote Jam',
  bounds: 'Hosted queue shares bounded pending work with membership commands',
  runtime: 'Hosted queue opt in is composed without starting network work',
});

function adapterFixture(status = Fixture.acceptedStatus, body = null) {
  const requests = [];
  const ownership = new library.SpotifyCredentialSession(Values.accountIdentifier, {
    getCredentials: async () => credentials(), renewCredentials: async () => credentials(),
  }, { nowMilliseconds: () => Values.nowMilliseconds });
  const executor = { execute: async request => { requests.push(request); return { status, body }; } };
  const client = new library.SpotifyRequestClient(executor, ownership);
  return { requests, executor, client, queue: new library.SpotifyWebQueueProtocol(client) };
}

async function sessionFixture(overrides = {}, enabled = true) {
  const response = sessionResponse({ hostDeviceIdentifier: Fixture.hostIdentifier, ...overrides });
  const calls = { queue: Values.noInvocations, end: Values.noInvocations, targets: [] };
  const protocol = { createOrActivate: async () => response, end: async () => { calls.end += Values.invocationIncrement; },
    readCurrentAccount: async () => response };
  const queue = { addToQueue: async (identifier, host) => {
    calls.queue += Values.invocationIncrement; calls.targets.push({ identifier, host });
  } };
  const client = new library.JamSessionClient(); client.attachAccount(Values.accountIdentifier, protocol, enabled ? queue : null);
  await client.refreshCurrentSession(Fixture.refreshIdentifier);
  return { client, protocol, queue, calls, response, add: (requestIdentifier = Fixture.requestIdentifier) =>
    client.addToQueue(Values.spotifyIdentifier, requestIdentifier) };
}

test(Names.adapter, async () => {
  const fixture = adapterFixture();
  await fixture.queue.addToQueue(Values.spotifyIdentifier, Fixture.hostIdentifier, cancellation().signal);
  const request = fixture.requests[Values.firstPosition]; const address = new URL(request.address);
  assert.equal(address.origin + address.pathname, Fixture.endpoint);
  assert.equal(address.searchParams.get(Fixture.trackParameter), Fixture.trackPrefix + Values.spotifyIdentifier);
  assert.equal(address.searchParams.get(Fixture.deviceParameter), Fixture.hostIdentifier);
  assert.equal(request.method, Fixture.postMethod); assert.equal(fixture.requests.length, Values.singleResultCount);
});

test(Names.invalid, async () => {
  const fixture = adapterFixture();
  for (const [identifier, host] of [[Fixture.invalidIdentifier, Fixture.hostIdentifier],
    [Values.spotifyIdentifier, Values.emptyText], [Values.spotifyIdentifier, Values.title]]) {
    await assert.rejects(fixture.queue.addToQueue(identifier, host, cancellation().signal), { code: library.IntegrationFailureCode.InvalidInput });
  }
  assert.equal(fixture.requests.length, Values.noInvocations);
});

test(Names.cancelled, async () => {
  const fixture = adapterFixture(); const controller = cancellation(); controller.abort();
  await assert.rejects(fixture.queue.addToQueue(Values.spotifyIdentifier, Fixture.hostIdentifier, controller.signal),
    { code: library.IntegrationFailureCode.Canceled }); assert.equal(fixture.requests.length, Values.noInvocations);
});

test(Names.forbidden, async () => {
  const fixture = adapterFixture(Fixture.forbiddenStatus);
  await assert.rejects(fixture.queue.addToQueue(Values.spotifyIdentifier, Fixture.hostIdentifier, cancellation().signal),
    { code: library.IntegrationFailureCode.Forbidden }); assert.equal(fixture.requests.length, Values.singleResultCount);
});

test(Names.rateLimited, async () => {
  const fixture = adapterFixture(Values.rateLimitedStatus);
  await assert.rejects(fixture.queue.addToQueue(Values.spotifyIdentifier, Fixture.hostIdentifier, cancellation().signal),
    { code: library.IntegrationFailureCode.RateLimited }); assert.equal(fixture.requests.length, Values.singleResultCount);
});

test(Names.serverFailure, async () => {
  const fixture = adapterFixture(Values.serverFailureStatus);
  await assert.rejects(fixture.queue.addToQueue(Values.spotifyIdentifier, Fixture.hostIdentifier, cancellation().signal),
    { code: library.IntegrationFailureCode.UnknownOutcome }); assert.equal(fixture.requests.length, Values.singleResultCount);
});

test(Names.transportFailure, async () => {
  const fixture = adapterFixture(); fixture.executor.execute = async () => { throw new Error(Fixture.rawFailure); };
  await assert.rejects(fixture.queue.addToQueue(Values.spotifyIdentifier, Fixture.hostIdentifier, cancellation().signal),
    { code: library.IntegrationFailureCode.UnknownOutcome });
});

test(Names.malformed, async () => {
  const fixture = adapterFixture(Values.successStatus, {});
  await assert.rejects(fixture.queue.addToQueue(Values.spotifyIdentifier, Fixture.hostIdentifier, cancellation().signal),
    { code: library.IntegrationFailureCode.UnknownOutcome });
});

test(Names.hostDecode, async () => {
  const fixture = adapterFixture(Values.successStatus, wireSession({ hostActiveDeviceId: Fixture.hostIdentifier }));
  const protocol = new library.SpotifyHttpJamProtocol(fixture.client, { resolveServiceOrigin: async () => Values.serviceOrigin });
  assert.equal((await protocol.readCurrentAccount(cancellation().signal)).session.hostDeviceIdentifier, Fixture.hostIdentifier);
});

test(Names.hostEmpty, async () => {
  const fixture = adapterFixture(Values.successStatus, wireSession({ hostActiveDeviceId: Values.emptyText }));
  const protocol = new library.SpotifyHttpJamProtocol(fixture.client, { resolveServiceOrigin: async () => Values.serviceOrigin });
  assert.equal((await protocol.readCurrentAccount(cancellation().signal)).session.hostDeviceIdentifier, undefined);
});

test(Names.hostMalformed, async () => {
  const fixture = adapterFixture(Values.successStatus, wireSession({ hostActiveDeviceId: {} }));
  const protocol = new library.SpotifyHttpJamProtocol(fixture.client, { resolveServiceOrigin: async () => Values.serviceOrigin });
  await assert.rejects(protocol.readCurrentAccount(cancellation().signal), { code: library.IntegrationFailureCode.InvalidResponse });
});

test(Names.disabled, async () => {
  const fixture = await sessionFixture({}, false);
  assert.equal(fixture.client.capabilities.queue, false); assert.equal(library.VerifiedJamCapabilities.queue, false);
  assert.equal((await fixture.add()).failure, library.IntegrationFailureCode.Unsupported);
  assert.equal(fixture.calls.queue, Values.noInvocations);
});

test(Names.accepted, async () => {
  const fixture = await sessionFixture(); assert.equal(fixture.client.capabilities.queue, true);
  assert.equal((await fixture.add()).applied, true);
  assert.deepEqual(fixture.calls.targets, [{ identifier: Values.spotifyIdentifier, host: Fixture.hostIdentifier }]);
  assert.equal(fixture.client.getSnapshot().session.identifier, Values.sessionIdentifier);
});

test(Names.guest, async () => {
  const fixture = await sessionFixture({ ownedByCurrentAccount: false });
  assert.equal((await fixture.add()).failure, library.IntegrationFailureCode.Forbidden); assert.equal(fixture.calls.queue, Values.noInvocations);
});

test(Names.inactive, async () => {
  const fixture = await sessionFixture({ active: false });
  assert.equal((await fixture.add()).failure, library.IntegrationFailureCode.Unsupported); assert.equal(fixture.calls.queue, Values.noInvocations);
});

test(Names.absentHost, async () => {
  const fixture = await sessionFixture({ hostDeviceIdentifier: undefined });
  assert.equal((await fixture.add()).failure, library.IntegrationFailureCode.Unsupported); assert.equal(fixture.calls.queue, Values.noInvocations);
});

test(Names.absentSession, async () => {
  const fixture = await sessionFixture(); fixture.protocol.readCurrentAccount = async () => null;
  await fixture.client.refreshCurrentSession(Fixture.otherRequestIdentifier);
  assert.equal((await fixture.add()).failure, library.IntegrationFailureCode.Superseded); assert.equal(fixture.calls.queue, Values.noInvocations);
});

test(Names.duplicate, async () => {
  const fixture = await sessionFixture(); const first = fixture.add(); const second = fixture.add();
  assert.equal(first, second); await first; assert.equal(await fixture.add(), await first);
  assert.equal(fixture.calls.queue, Values.singleResultCount);
});

test(Names.conflict, async () => {
  const fixture = await sessionFixture(); await fixture.add();
  assert.equal((await fixture.client.addToQueue(Values.otherSpotifyIdentifier, Fixture.requestIdentifier)).failure,
    library.IntegrationFailureCode.InvalidInput); assert.equal(fixture.calls.queue, Values.singleResultCount);
});

test(Names.invalidClient, async () => {
  const fixture = await sessionFixture();
  assert.equal((await fixture.client.addToQueue(Fixture.invalidIdentifier, Fixture.requestIdentifier)).failure,
    library.IntegrationFailureCode.InvalidInput); assert.equal(fixture.calls.queue, Values.noInvocations);
});

test(Names.ordering, async () => {
  const fixture = await sessionFixture(); const pending = deferred(); const operations = [];
  fixture.queue.addToQueue = async () => { operations.push(Fixture.queueOperation); await pending.promise; };
  fixture.protocol.end = async () => { operations.push(Fixture.endOperation); };
  const adding = fixture.add(); await flushMicrotasks(); const ending = fixture.client.endSession(Values.endRequestIdentifier);
  assert.deepEqual(operations, [Fixture.queueOperation]); pending.resolve(); await adding; await ending;
  assert.deepEqual(operations, [Fixture.queueOperation, Fixture.endOperation]);
});

test(Names.ended, async () => {
  const fixture = await sessionFixture(); const ending = fixture.client.endSession(Values.endRequestIdentifier); const adding = fixture.add();
  await ending; assert.equal((await adding).failure, library.IntegrationFailureCode.Superseded);
  assert.equal(fixture.calls.queue, Values.noInvocations);
});

test(Names.changedHost, async () => {
  const fixture = await sessionFixture(); fixture.protocol.readCurrentAccount = async () => sessionResponse({ hostDeviceIdentifier: Fixture.otherHostIdentifier });
  const refresh = fixture.client.refreshCurrentSession(Fixture.otherRequestIdentifier); const adding = fixture.add();
  await refresh; assert.equal((await adding).failure, library.IntegrationFailureCode.Superseded); assert.equal(fixture.calls.queue, Values.noInvocations);
});

test(Names.uncertain, async () => {
  const fixture = await sessionFixture();
  fixture.queue.addToQueue = async () => { throw new library.IntegrationFailure(library.IntegrationFailureCode.UnknownOutcome); };
  assert.equal((await fixture.add()).failure, library.IntegrationFailureCode.UnknownOutcome);
  await fixture.client.refreshCurrentSession(Fixture.otherRequestIdentifier);
  fixture.queue.addToQueue = async () => undefined;
  assert.equal((await fixture.add(Values.createRequestIdentifier)).failure, library.IntegrationFailureCode.UnknownOutcome);
});

test(Names.late, async () => {
  const fixture = await sessionFixture(); const pending = deferred(); fixture.queue.addToQueue = () => pending.promise;
  const result = fixture.add(); await flushMicrotasks(); fixture.client.attachAccount(Values.otherAccountIdentifier, fixture.protocol, fixture.queue);
  pending.resolve(); assert.equal((await result).failure, library.IntegrationFailureCode.Superseded);
  assert.equal(fixture.client.getSnapshot().accountIdentifier, Values.otherAccountIdentifier); assert.equal(fixture.client.getSnapshot().session, null);
});

test(Names.detach, async () => {
  const fixture = await sessionFixture(); const pending = deferred(); let signal;
  fixture.queue.addToQueue = (identifier, hostIdentifier, cancellationSignal) => { signal = cancellationSignal; return pending.promise; };
  const result = fixture.add(); await flushMicrotasks(); fixture.client.detachAccount();
  assert.equal(signal.aborted, true); assert.equal((await result).failure, library.IntegrationFailureCode.Superseded);
  assert.equal(fixture.calls.end, Values.noInvocations); pending.resolve();
});

test(Names.bounds, async () => {
  const fixture = await sessionFixture(); const pending = deferred(); fixture.queue.addToQueue = () => pending.promise;
  const requests = Array.from({ length: Fixture.excessivePending }, (unused, index) => fixture.add(Fixture.requestPrefix + index));
  assert.equal((await requests.at(Fixture.lastPosition)).failure, library.IntegrationFailureCode.Backpressure);
  fixture.client.detachAccount(); await Promise.all(requests); pending.resolve();
});

test(Names.runtime, () => {
  let count = Values.noInvocations;
  const dependencies = { accountIdentifier: Values.accountIdentifier, credentials: {
    getCredentials: async () => credentials(), renewCredentials: async () => credentials() },
  endpoints: { resolveServiceOrigin: async () => Values.serviceOrigin },
  recordings: new library.QueryableRecordingCatalog(Values.catalogIdentity, library.RecordingNamespace.MusicBrainz,
    { lookup: async () => song(), search: async () => [] }), associations: new library.MemoryAssociationStore(),
  clock: { nowMilliseconds: () => Values.nowMilliseconds }, requests: { execute: async () => {
    count += Values.invocationIncrement; return { status: Fixture.acceptedStatus, body: null };
  } } };
  const disabled = new library.SpotifyJamRuntime(dependencies); assert.equal(disabled.sessions.capabilities.queue, false); disabled.dispose();
  const enabled = new library.SpotifyJamRuntime({ ...dependencies, enableHostedQueue: true });
  assert.equal(enabled.sessions.capabilities.queue, true); assert.equal(count, Values.noInvocations); enabled.dispose();
});
