import assert from 'node:assert/strict';
import test from 'node:test';
import { library, Values, credentials, cancellation, deferred, flushMicrotasks, sessionResponse } from './fixtures.mjs';

const Fixture = Object.freeze({ host: 'owned-host', otherHost: 'replacement-host', otherSession: 'replacement-session',
  request: 'playback-request', refresh: 'playback-refresh', laterRefresh: 'later-playback-refresh', second: 'second-playback-request',
  endpoint: 'https://api.spotify.com/v1/me/player/', deviceParameter: 'device_id', positionParameter: 'position_ms',
  positionMilliseconds: 12000, durationMilliseconds: 180000, invalidPosition: -1, zero: 0, one: 1, signalPosition: 2,
  accepted: 204, forbidden: 403, unavailable: 503, rateLimited: 429, unauthorized: 401, malformedKind: 'invalid-command',
  names: Object.freeze({ routes: 'Host playback commands use the explicit device and correct mutation method',
    seek: 'Seek validates the currently playing track and position before issuing the command',
    bounds: 'Malformed commands and device identifiers are rejected before preflight or mutation',
    changedTrack: 'A changed seek track or position beyond its duration never mutates playback',
    preflight: 'Playback preflight failure is a read failure and does not become an unknown mutation',
    cancel: 'Cancellation after preflight prevents the playback mutation',
    failures: 'Playback mutation denial rate limiting and unknown server outcomes remain distinct without retries',
    body: 'Nonempty mutation acknowledgement leaves playback outcome unknown',
    owned: 'Playback commands require an owned active Jam and its actual host',
    disabled: 'Playback control remains disabled without a supplied command protocol',
    duplicate: 'Duplicate playback command requests share one result and submission',
    conflict: 'A request identifier cannot change command or target session',
    immutable: 'Queued playback intents are copied before callers can mutate them',
    uncertainty: 'Membership refresh cannot replay an uncertain playback command',
    ordering: 'Playback commands share serialization with membership and queue commands',
    hostChange: 'Host replacement cancels playback preflight and preserves the new membership snapshot',
    queuedHostChange: 'Playback queued behind host replacement cannot mutate or fail the new membership',
    account: 'Account replacement cancels old playback work and rejects its late completion',
    runtime: 'Runtime playback control is opt in and construction performs no requests' }) });
const Kinds = library.HostedPlaybackCommandKind;
function command(kind = Kinds.Play) { return kind === Kinds.Seek
  ? { kind, positionMilliseconds: Fixture.positionMilliseconds, expectedSpotifyTrackIdentifier: Values.spotifyIdentifier } : { kind }; }
function adapter() {
  const state = { sample: { spotifyTrackIdentifier: Values.spotifyIdentifier, durationMilliseconds: Fixture.durationMilliseconds },
    read: null, status: Fixture.accepted, body: null };
  const calls = { requests: [], preflight: [] };
  const ownership = new library.SpotifyCredentialSession(Values.accountIdentifier, {
    getCredentials: async () => credentials(), renewCredentials: async () => credentials() }, { nowMilliseconds: () => Values.nowMilliseconds });
  const requests = new library.SpotifyRequestClient({ execute: async request => {
    calls.requests.push(request); return { status: state.status, body: state.body }; } }, ownership);
  const protocol = new library.SpotifyWebPlaybackCommandProtocol(requests, { read: async (...parameters) => {
    calls.preflight.push(parameters); return state.read ? state.read(...parameters) : state.sample; } });
  return { state, calls, protocol };
}
async function session(overrides = {}, enabled = true) {
  const state = { response: sessionResponse({ hostDeviceIdentifier: Fixture.host, ...overrides }), execute: null, refresh: null };
  const calls = { commands: [], events: [] };
  const membership = { createOrActivate: async () => state.response, readCurrentAccount: async () => state.refresh ? state.refresh() : state.response,
    end: async () => { calls.events.push(library.JamConnectionStatus.Detached); } };
  const playback = { execute: async (...parameters) => { calls.commands.push(parameters); calls.events.push(parameters[Fixture.zero].kind);
    if (state.execute) return state.execute(...parameters); } };
  const client = new library.JamSessionClient();
  client.attachAccount(Values.accountIdentifier, membership, null, enabled ? playback : null);
  await client.refreshCurrentSession(Fixture.refresh);
  return { state, calls, client, membership, playback };
}
function failure(code) { return value => value instanceof library.IntegrationFailure && value.code === code; }

test(Fixture.names.routes, async () => { for (const kind of [Kinds.Play, Kinds.Pause, Kinds.Next, Kinds.Previous]) {
  const current = adapter(); await current.protocol.execute(command(kind), Fixture.host, cancellation().signal);
  const request = current.calls.requests[Fixture.zero]; const address = new URL(request.address);
  assert.equal(address.origin + address.pathname, Fixture.endpoint + kind);
  assert.equal(address.searchParams.get(Fixture.deviceParameter), Fixture.host);
  assert.equal(request.method, kind === Kinds.Next || kind === Kinds.Previous ? library.HttpMethod.Create : library.HttpMethod.Replace);
  assert.equal(current.calls.preflight.length, Fixture.one); assert.equal(current.calls.requests.length, Fixture.one);
} });
test(Fixture.names.seek, async () => { const current = adapter();
  await current.protocol.execute(command(Kinds.Seek), Fixture.host, cancellation().signal);
  const request = current.calls.requests[Fixture.zero]; const address = new URL(request.address);
  assert.equal(address.searchParams.get(Fixture.positionParameter), String(Fixture.positionMilliseconds));
  assert.equal(address.pathname.endsWith(Kinds.Seek), true); assert.equal(request.method, library.HttpMethod.Replace);
});
test(Fixture.names.bounds, async () => { for (const [input, host] of [[null, Fixture.host], [{ kind: Fixture.malformedKind }, Fixture.host],
  [{ ...command(Kinds.Seek), positionMilliseconds: Fixture.invalidPosition }, Fixture.host],
  [command(), Values.emptyText], [command(), Values.title], [command(), null]]) {
  const current = adapter(); await assert.rejects(current.protocol.execute(input, host, cancellation().signal), failure(library.IntegrationFailureCode.InvalidInput));
  assert.equal(current.calls.preflight.length + current.calls.requests.length, Fixture.zero);
} });
test(Fixture.names.changedTrack, async () => { for (const input of [{ ...command(Kinds.Seek), expectedSpotifyTrackIdentifier: Values.otherSpotifyIdentifier },
  { ...command(Kinds.Seek), positionMilliseconds: Fixture.durationMilliseconds }]) {
  const current = adapter(); await assert.rejects(current.protocol.execute(input, Fixture.host, cancellation().signal));
  assert.equal(current.calls.requests.length, Fixture.zero);
} });
test(Fixture.names.preflight, async () => { const current = adapter(); current.state.read = async () => { throw new library.IntegrationFailure(library.IntegrationFailureCode.Network); };
  await assert.rejects(current.protocol.execute(command(), Fixture.host, cancellation().signal), failure(library.IntegrationFailureCode.Network));
  assert.equal(current.calls.requests.length, Fixture.zero);
});
test(Fixture.names.cancel, async () => { const current = adapter(); const canceled = cancellation();
  current.state.read = async () => { canceled.abort(); return current.state.sample; };
  await assert.rejects(current.protocol.execute(command(), Fixture.host, canceled.signal), failure(library.IntegrationFailureCode.Canceled));
  assert.equal(current.calls.requests.length, Fixture.zero);
});
test(Fixture.names.failures, async () => { for (const [status, expected] of [[Fixture.forbidden, library.IntegrationFailureCode.Forbidden],
  [Fixture.rateLimited, library.IntegrationFailureCode.RateLimited], [Fixture.unavailable, library.IntegrationFailureCode.UnknownOutcome],
  [Fixture.unauthorized, library.IntegrationFailureCode.Unauthorized]]) {
  const current = adapter(); current.state.status = status;
  await assert.rejects(current.protocol.execute(command(Kinds.Next), Fixture.host, cancellation().signal), failure(expected));
  assert.equal(current.calls.requests.length, Fixture.one);
} });
test(Fixture.names.body, async () => { const current = adapter(); current.state.body = {};
  await assert.rejects(current.protocol.execute(command(), Fixture.host, cancellation().signal), failure(library.IntegrationFailureCode.UnknownOutcome));
});
test(Fixture.names.owned, async () => { for (const overrides of [{ ownedByCurrentAccount: false }, { active: false }, { hostDeviceIdentifier: undefined }]) {
  const current = await session(overrides); const result = await current.client.executeHostedPlayback(command(), Fixture.request);
  assert.equal(result.applied, false); assert.equal(current.calls.commands.length, Fixture.zero);
} });
test(Fixture.names.disabled, async () => { const current = await session({}, false);
  assert.equal(current.client.capabilities.playbackControl, false);
  assert.equal((await current.client.executeHostedPlayback(command(), Fixture.request)).failure, library.IntegrationFailureCode.Unsupported);
});
test(Fixture.names.duplicate, async () => { const current = await session(); const pending = deferred(); current.state.execute = () => pending.promise;
  const first = current.client.executeHostedPlayback(command(), Fixture.request); const duplicate = current.client.executeHostedPlayback(command(), Fixture.request);
  assert.equal(first, duplicate); await flushMicrotasks(); assert.equal(current.calls.commands.length, Fixture.one);
  pending.resolve(); assert.equal((await first).applied, true);
});
test(Fixture.names.conflict, async () => { const current = await session(); await current.client.executeHostedPlayback(command(), Fixture.request);
  assert.equal((await current.client.executeHostedPlayback(command(Kinds.Pause), Fixture.request)).failure, library.IntegrationFailureCode.InvalidInput);
  current.state.response = sessionResponse({ identifier: Fixture.otherSession, hostDeviceIdentifier: Fixture.host });
  await current.client.refreshCurrentSession(Fixture.laterRefresh);
  assert.equal((await current.client.executeHostedPlayback(command(), Fixture.request)).failure, library.IntegrationFailureCode.InvalidInput);
});
test(Fixture.names.immutable, async () => { const current = await session(); const input = command();
  const result = current.client.executeHostedPlayback(input, Fixture.request); input.kind = Kinds.Next;
  await result; assert.equal(current.calls.commands[Fixture.zero][Fixture.zero].kind, Kinds.Play);
});
test(Fixture.names.uncertainty, async () => { const current = await session(); current.state.execute = async () => { throw new library.IntegrationFailure(library.IntegrationFailureCode.UnknownOutcome); };
  await current.client.executeHostedPlayback(command(Kinds.Next), Fixture.request); await current.client.refreshCurrentSession(Fixture.laterRefresh);
  assert.equal((await current.client.executeHostedPlayback(command(), Fixture.second)).failure, library.IntegrationFailureCode.UnknownOutcome);
  assert.equal(current.calls.commands.length, Fixture.one);
});
test(Fixture.names.ordering, async () => { const current = await session(); const pending = deferred(); current.state.execute = () => pending.promise;
  const playing = current.client.executeHostedPlayback(command(), Fixture.request); const ending = current.client.endSession(Values.endRequestIdentifier);
  await flushMicrotasks(); assert.deepEqual(current.calls.events, [Kinds.Play]); pending.resolve(); await Promise.all([playing, ending]);
  assert.deepEqual(current.calls.events, [Kinds.Play, library.JamConnectionStatus.Detached]);
});
test(Fixture.names.hostChange, async () => { const current = await session(); const pending = deferred(); current.state.execute = () => pending.promise;
  const playing = current.client.executeHostedPlayback(command(), Fixture.request); await flushMicrotasks();
  current.client.detachAccount(); current.state.response = sessionResponse({ identifier: Fixture.otherSession, hostDeviceIdentifier: Fixture.otherHost });
  current.client.attachAccount(Values.accountIdentifier, current.membership, null, current.playback);
  await current.client.refreshCurrentSession(Fixture.laterRefresh);
  assert.equal((await playing).failure, library.IntegrationFailureCode.Superseded);
  pending.resolve(); await flushMicrotasks(); assert.equal(current.client.getSnapshot().session.identifier, Fixture.otherSession);
  assert.equal(current.client.getSnapshot().status, library.JamConnectionStatus.Ready);
});
test(Fixture.names.account, async () => { const current = await session(); const pending = deferred(); current.state.execute = () => pending.promise;
  const playing = current.client.executeHostedPlayback(command(), Fixture.request); await flushMicrotasks();
  current.client.attachAccount(Values.otherAccountIdentifier, current.membership, null, current.playback);
  assert.equal((await playing).failure, library.IntegrationFailureCode.Superseded);
  assert.equal(current.calls.commands[Fixture.zero][Fixture.signalPosition].aborted, true);
  pending.resolve(); await flushMicrotasks(); assert.equal(current.client.getSnapshot().accountIdentifier, Values.otherAccountIdentifier);
});
test(Fixture.names.queuedHostChange, async () => { const current = await session(); const pending = deferred(); current.state.refresh = () => pending.promise;
  const refreshing = current.client.refreshCurrentSession(Fixture.laterRefresh); await flushMicrotasks();
  const playing = current.client.executeHostedPlayback(command(), Fixture.request);
  pending.resolve(sessionResponse({ identifier: Fixture.otherSession, hostDeviceIdentifier: Fixture.otherHost })); await refreshing;
  assert.equal((await playing).failure, library.IntegrationFailureCode.Superseded);
  assert.equal(current.calls.commands.length, Fixture.zero); assert.equal(current.client.getSnapshot().status, library.JamConnectionStatus.Ready);
  assert.equal(current.client.getSnapshot().session.identifier, Fixture.otherSession);
});
test(Fixture.names.runtime, () => { const dependencies = { accountIdentifier: Values.accountIdentifier,
  credentials: { getCredentials: async () => credentials(), renewCredentials: async () => credentials() },
  endpoints: { resolveServiceOrigin: async () => Values.serviceOrigin }, associations: new library.MemoryAssociationStore(),
  recordings: { identity: Values.catalogIdentity, namespace: library.RecordingNamespace.Local, lookup: async () => null, search: async () => [] },
  clock: { nowMilliseconds: () => Values.nowMilliseconds }, requests: { execute: async () => { assert.fail(); } },
  playbackClock: { nowMonotonicMilliseconds: () => Fixture.zero } };
  const disabled = new library.SpotifyJamRuntime(dependencies); assert.equal(disabled.sessions.capabilities.playbackControl, false); disabled.dispose();
  const enabled = new library.SpotifyJamRuntime({ ...dependencies, enableHostedPlaybackCommands: true });
  assert.equal(enabled.sessions.capabilities.playbackControl, true); enabled.dispose();
});
