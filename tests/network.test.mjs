import assert from 'node:assert/strict';
import test from 'node:test';
import { library, Values, cancellation, credentials, deferred, flushMicrotasks, ManualScheduler } from './fixtures.mjs';

const Names = Object.freeze({
  sharedInitial: 'Concurrent requests share initial credential loading',
  renewal: 'Expired credentials renew once for concurrent callers',
  account: 'Renewal rejects an account identity change',
  dispose: 'Disposal rejects late credentials and never retains them',
  callerCancel: 'One canceled credential caller does not abort another caller',
  secrets: 'Credential provider exceptions cannot expose credential values',
  safeRetry: 'A read renews once after unauthorized and retries with the new token',
  mutationRetry: 'An unauthorized mutation is never automatically retried',
  uncertain: 'A transport failure during a mutation reports an unknown outcome',
  rateLimit: 'Rate limit details remain typed and do not trigger an automatic mutation retry',
  host: 'Credential forwarding rejects foreign and insecure origins before credential loading',
  boundedRenew: 'Repeated unauthorized reads stop after one renewal',
  sharedRenewal: 'Concurrent unauthorized reads share one renewal',
  paced: 'MusicBrainz pacing waits until the injected clock reaches the interval',
  pacedCancel: 'Canceling a paced request releases its timer without performing a request',
  fetchDeadline: 'Fetch deadlines abort pending transport and release the scheduled timer',
  fetchCancellation: 'Caller cancellation aborts fetch and releases its deadline',
  fetchInvalid: 'Malformed JSON becomes an invalid response without preserving response text',
  fetchPolicy: 'Fetch disables redirects and ambient cookies',
  staleResponse: 'Disposing credential ownership rejects a network response that completes late',
});

function credentialFixture() {
  const calls = { initial: Values.noInvocations, renewal: Values.noInvocations };
  const provider = {
    getCredentials: async () => { calls.initial += Values.invocationIncrement; return credentials(); },
    renewCredentials: async () => { calls.renewal += Values.invocationIncrement; return credentials({ accessToken: Values.renewedToken }); },
  };
  const clock = { value: Values.nowMilliseconds, nowMilliseconds() { return this.value; } };
  const session = new library.SpotifyCredentialSession(Values.accountIdentifier, provider, clock);
  return { calls, provider, clock, session };
}

test(Names.sharedInitial, async () => {
  const fixture = credentialFixture();
  const [first, second] = await Promise.all([fixture.session.current(cancellation().signal), fixture.session.current(cancellation().signal)]);
  assert.equal(first, second);
  assert.equal(fixture.calls.initial, Values.singleResultCount);
});

test(Names.renewal, async () => {
  const fixture = credentialFixture();
  await fixture.session.current(cancellation().signal);
  fixture.clock.value = Values.expiresAtMilliseconds;
  fixture.provider.renewCredentials = async () => { fixture.calls.renewal += Values.invocationIncrement;
    return credentials({ accessToken: Values.renewedToken, expiresAtMilliseconds: Values.expiresAtMilliseconds + Values.expiresAtMilliseconds }); };
  await Promise.all([fixture.session.current(cancellation().signal), fixture.session.current(cancellation().signal)]);
  assert.equal(fixture.calls.renewal, Values.singleResultCount);
});

test(Names.account, async () => {
  const fixture = credentialFixture();
  const rejected = await fixture.session.current(cancellation().signal);
  fixture.provider.renewCredentials = async () => credentials({ accountIdentifier: Values.otherAccountIdentifier });
  await assert.rejects(fixture.session.renew(rejected, cancellation().signal), { code: library.IntegrationFailureCode.Unauthorized });
});

test(Names.dispose, async () => {
  const fixture = credentialFixture(); const pending = deferred();
  fixture.provider.getCredentials = () => pending.promise;
  const result = fixture.session.current(cancellation().signal);
  await flushMicrotasks(); fixture.session.dispose(); pending.resolve(credentials());
  await assert.rejects(result, { code: library.IntegrationFailureCode.Superseded });
});

test(Names.callerCancel, async () => {
  const fixture = credentialFixture(); const pending = deferred(); const controller = cancellation();
  fixture.provider.getCredentials = () => pending.promise;
  const canceled = fixture.session.current(controller.signal);
  const surviving = fixture.session.current(cancellation().signal);
  controller.abort();
  await assert.rejects(canceled, { code: library.IntegrationFailureCode.Canceled });
  pending.resolve(credentials());
  assert.equal((await surviving).accessToken, Values.accessToken);
});

test(Names.secrets, async () => {
  const fixture = credentialFixture();
  fixture.provider.getCredentials = async () => { throw new Error(Values.accessToken); };
  await assert.rejects(fixture.session.current(cancellation().signal), failure => {
    assert.equal(failure.code, library.IntegrationFailureCode.Unauthorized);
    assert.ok(!failure.message.includes(Values.accessToken)); return true;
  });
});

test(Names.safeRetry, async () => {
  const fixture = credentialFixture(); const requests = [];
  const client = new library.SpotifyRequestClient({ execute: async request => {
    requests.push(request);
    return { status: requests.length === Values.singleResultCount ? Values.unauthorizedStatus : Values.successStatus, body: null };
  } }, fixture.session);
  await client.read(Values.catalogAddress, cancellation().signal);
  assert.equal(requests.length, Values.retriedInvocationCount);
  assert.ok(requests[Values.secondPosition].headers.authorization.includes(Values.renewedToken));
  assert.equal(fixture.calls.renewal, Values.singleResultCount);
});

test(Names.mutationRetry, async () => {
  const fixture = credentialFixture(); let count = Values.noInvocations;
  const client = new library.SpotifyRequestClient({ execute: async () => { count += Values.invocationIncrement; return { status: Values.unauthorizedStatus, body: null }; } }, fixture.session);
  await assert.rejects(client.send(Values.catalogAddress, library.HttpMethod.Read, true, cancellation().signal), { code: library.IntegrationFailureCode.Unauthorized });
  assert.equal(count, Values.singleResultCount); assert.equal(fixture.calls.renewal, Values.noInvocations);
});

test(Names.uncertain, async () => {
  const fixture = credentialFixture();
  const client = new library.SpotifyRequestClient({ execute: async () => { throw new Error(Values.accessToken); } }, fixture.session);
  await assert.rejects(client.send(Values.catalogAddress, library.HttpMethod.Read, true, cancellation().signal), { code: library.IntegrationFailureCode.UnknownOutcome });
});

test(Names.rateLimit, async () => {
  const fixture = credentialFixture();
  const client = new library.SpotifyRequestClient({ execute: async () => ({ status: Values.rateLimitedStatus, retryAfterSeconds: Values.retryAfterSeconds, body: null }) }, fixture.session);
  await assert.rejects(client.send(Values.catalogAddress, library.HttpMethod.Read, true, cancellation().signal), {
    code: library.IntegrationFailureCode.RateLimited, retryAfterSeconds: Values.retryAfterSeconds,
  });
});

test(Names.host, async () => {
  const fixture = credentialFixture();
  const client = new library.SpotifyRequestClient({ execute: async () => assert.fail() }, fixture.session);
  for (const address of [Values.foreignAddress, Values.insecureAddress]) {
    await assert.rejects(client.read(address, cancellation().signal), { code: library.IntegrationFailureCode.InvalidInput });
  }
  assert.equal(fixture.calls.initial, Values.noInvocations);
});

test(Names.boundedRenew, async () => {
  const fixture = credentialFixture(); let count = Values.noInvocations;
  const client = new library.SpotifyRequestClient({ execute: async () => { count += Values.invocationIncrement; return { status: Values.unauthorizedStatus, body: null }; } }, fixture.session);
  await assert.rejects(client.read(Values.catalogAddress, cancellation().signal), { code: library.IntegrationFailureCode.Unauthorized });
  assert.equal(count, Values.retriedInvocationCount); assert.equal(fixture.calls.renewal, Values.singleResultCount);
});

test(Names.sharedRenewal, async () => {
  const fixture = credentialFixture();
  const client = new library.SpotifyRequestClient({ execute: async request => ({
    status: request.headers.authorization.includes(Values.renewedToken) ? Values.successStatus : Values.unauthorizedStatus, body: null,
  }) }, fixture.session);
  await Promise.all([client.read(Values.catalogAddress, cancellation().signal), client.read(Values.catalogAddress, cancellation().signal)]);
  assert.equal(fixture.calls.renewal, Values.singleResultCount);
});

test(Names.paced, async () => {
  const scheduler = new ManualScheduler(); let count = Values.noInvocations;
  const clock = { nowMilliseconds: () => scheduler.nowMilliseconds };
  const reader = new library.PacedJsonReader({ read: async () => { count += Values.invocationIncrement; return null; } }, clock, scheduler, Values.schedulerAdvanceMilliseconds);
  await reader.read(Values.catalogAddress, cancellation().signal);
  const next = reader.read(Values.catalogAddress, cancellation().signal);
  await flushMicrotasks(); assert.equal(count, Values.singleResultCount);
  scheduler.advance(Values.schedulerAdvanceMilliseconds);
  await next; assert.equal(count, Values.retriedInvocationCount); assert.equal(scheduler.callbacks.size, Values.noInvocations);
});

test(Names.pacedCancel, async () => {
  const scheduler = new ManualScheduler(); let count = Values.noInvocations;
  const reader = new library.PacedJsonReader({ read: async () => { count += Values.invocationIncrement; return null; } },
    { nowMilliseconds: () => scheduler.nowMilliseconds }, scheduler, Values.schedulerAdvanceMilliseconds);
  await reader.read(Values.catalogAddress, cancellation().signal);
  const controller = cancellation(); const next = reader.read(Values.catalogAddress, controller.signal);
  await flushMicrotasks(); controller.abort();
  await assert.rejects(next, { code: library.IntegrationFailureCode.Canceled });
  assert.equal(count, Values.singleResultCount); assert.equal(scheduler.callbacks.size, Values.noInvocations);
});

const FetchFixture = Object.freeze({ abortEvent: 'abort', redirectPolicy: 'error', credentialsPolicy: 'omit', invalidJson: 'private-invalid-response',
  jsonText: '{}', retryAfterHeader: 'retry-after', acceptHeader: 'accept', jsonType: 'application/json', method: 'GET',
  deadlineMilliseconds: 1000 });

async function pendingFetchProbe(cancelCaller) {
  const originalFetch = globalThis.fetch; const scheduler = new ManualScheduler(); const controller = cancellation();
  let signal;
  globalThis.fetch = async (address, options) => { signal = options.signal; return new Promise((resolve, reject) => {
    signal.addEventListener(FetchFixture.abortEvent, () => reject(new Error()), { once: true });
  }); };
  try {
    const executor = new library.FetchHttpExecutor(scheduler, FetchFixture.deadlineMilliseconds);
    const result = executor.execute({ address: Values.catalogAddress, method: FetchFixture.method, headers: {}, cancellation: controller.signal });
    if (cancelCaller) controller.abort(); else scheduler.advance(FetchFixture.deadlineMilliseconds);
    await assert.rejects(result, { code: cancelCaller ? library.IntegrationFailureCode.Canceled : library.IntegrationFailureCode.Deadline });
    assert.equal(signal.aborted, true); assert.equal(scheduler.callbacks.size, Values.noInvocations);
  } finally { globalThis.fetch = originalFetch; }
}

test(Names.fetchDeadline, () => pendingFetchProbe(false));
test(Names.fetchCancellation, () => pendingFetchProbe(true));

test(Names.fetchInvalid, async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(FetchFixture.invalidJson, { status: Values.successStatus });
  try {
    await assert.rejects(new library.FetchHttpExecutor(new ManualScheduler()).execute({ address: Values.catalogAddress,
      method: FetchFixture.method, headers: {}, cancellation: cancellation().signal }), { code: library.IntegrationFailureCode.InvalidResponse });
  } finally { globalThis.fetch = originalFetch; }
});

test(Names.fetchPolicy, async () => {
  const originalFetch = globalThis.fetch; const scheduler = new ManualScheduler();
  globalThis.fetch = async (address, options) => {
    assert.equal(options.redirect, FetchFixture.redirectPolicy); assert.equal(options.credentials, FetchFixture.credentialsPolicy);
    return new Response(FetchFixture.jsonText, { status: Values.successStatus });
  };
  try {
    await new library.FetchHttpExecutor(scheduler).execute({ address: Values.catalogAddress, method: FetchFixture.method,
      headers: {}, cancellation: cancellation().signal });
    assert.equal(scheduler.callbacks.size, Values.noInvocations);
  } finally { globalThis.fetch = originalFetch; }
});

test(Names.staleResponse, async () => {
  const state = credentialFixture(); const pending = deferred(); const started = deferred();
  const client = new library.SpotifyRequestClient({ execute: () => { started.resolve(); return pending.promise; } }, state.session);
  const response = client.read(Values.catalogAddress, cancellation().signal);
  await started.promise; state.session.dispose(); pending.resolve({ status: Values.successStatus, body: null });
  await assert.rejects(response, { code: library.IntegrationFailureCode.Superseded });
});

const FormFixture = Object.freeze({ name: 'Fetch executor forwards a caller supplied form body unchanged',
  body: 'grant_type=authorization_code&code=encoded%2Bcode', method: 'POST', contentTypeHeader: 'content-type',
  contentType: 'application/x-www-form-urlencoded' });
test(FormFixture.name, async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (address, options) => {
    assert.equal(options.body, FormFixture.body);
    assert.equal(options.headers[FormFixture.contentTypeHeader], FormFixture.contentType);
    return new Response(FetchFixture.jsonText, { status: Values.successStatus });
  };
  try {
    await new library.FetchHttpExecutor(new ManualScheduler()).execute({ address: Values.catalogAddress, method: FormFixture.method,
      headers: { [FormFixture.contentTypeHeader]: FormFixture.contentType }, body: FormFixture.body, cancellation: cancellation().signal });
  } finally { globalThis.fetch = originalFetch; }
});
