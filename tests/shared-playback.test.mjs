import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const LibraryModulePath = '../.build/src/index.js';
const library = require(LibraryModulePath);
const Fixture = Object.freeze({ accountIdentifier: 'controlled-account', sessionIdentifier: 'controlled-session',
  authorityIdentifier: 'controlled-authority', occurrenceIdentifier: 'first-occurrence', secondOccurrence: 'second-occurrence',
  otherAuthority: 'other-authority', recordingIdentifier: 'local-recording', spotifyTrackIdentifier: '4uLU6hMCjMI75M1A2tKUQC',
  secondTrackIdentifier: '5uLU6hMCjMI75M1A2tKUQC', title: 'Test recording', author: 'Test artist',
  positionMilliseconds: 12000, durationMilliseconds: 200000, nowMilliseconds: 100000, laterMilliseconds: 101000,
  oldMilliseconds: 90000, preparationMilliseconds: 100200, sequence: 1, nextSequence: 2, lastSequence: 3,
  zero: 0, firstPosition: 0, secondPosition: 1, singleCount: 1, doubleCount: 2,
  driftMilliseconds: 900, tinyDriftMilliseconds: 10, uncertaintyMilliseconds: 100,
  highUncertaintyMilliseconds: 1000, futureMilliseconds: 100001, sampleDelayMilliseconds: 300,
  flushCount: 30, iterationIncrement: 1, releaseFailure: 'Unexported output detail',
  names: Object.freeze({ idle: 'Constructing the follower does not acquire output or schedule work',
    capture: 'Attachment captures immutable identity and acquires one exclusive paused output lease',
    fresh: 'A matched recording is prepared paused and then follows the latest target',
    preparation: 'Playback position is recalculated after source preparation',
    pause: 'Remote pause is applied locally without a reflected remote command',
    duplicate: 'Duplicate and older targets cannot restart or rewind playback',
    authority: 'Another account session or authority cannot drive the attached output',
    occurrence: 'Repeated recordings with different occurrence identifiers prepare independently',
    contradiction: 'One occurrence cannot change recording identity',
    ambiguous: 'Ambiguous recording matches hold output and stop automatic matching retries',
    missing: 'Missing recordings remain unavailable without advancing locally',
    stale: 'A stale observation pauses local output', uncertainty: 'High timing uncertainty holds output',
    pausedAnchor: 'A freshly observed paused target can retain an old playback anchor',
    drift: 'Drift above the correction threshold seeks the current occurrence',
    smallDrift: 'Drift within uncertainty is observed without a seek',
    unseekable: 'Required correction on unseekable media holds playback and reports unsupported',
    buffering: 'Local buffering holds playback until a fresh ready sample is available',
    remoteBuffering: 'Remote buffering does not extrapolate or start local playback',
    lateResolver: 'Detach cancels resolution and rejects its late completion',
    replaceTarget: 'A new occurrence supersedes a pending source resolution',
    newestTarget: 'Preparation uses the latest accepted pause and position',
    detach: 'Detach cancels the timer and awaits native release',
    lateLease: 'An output lease acquired after detach is released without use',
    ordering: 'A replacement attachment waits for release of the previous lease',
    invalid: 'Malformed negative future and nonfinite targets fail closed',
    invalidSample: 'A stale or nonfinite local position sample cannot drive playback',
    duration: 'Target projection clamps at duration without selecting another occurrence',
    subscribers: 'Subscriber exceptions cannot abort synchronization',
    failures: 'Resolver and output errors are sanitized and pause the follower',
    reentrant: 'Detach during a resolving notification prevents source resolution',
    timer: 'Timer reconciliation corrects drift and stops after detach',
    exhausted: 'An exhausted target pauses at duration without restarting or advancing the local queue',
    uncertainOutput: 'An output error after applying play triggers a compensating local pause',
    shorterMedia: 'A shorter local recording holds at its own end instead of replaying its tail',
    foreignMalformed: 'Malformed targets from a retired authority cannot fail the current follower',
    failedLookup: 'Late recording resolution cannot restart a follower that already failed validation',
    failedApply: 'Failure during a dispatched play waits for a compensating pause before reporting failure',
    replacementNotification: 'An available replacement accepted during an unavailable notification is processed immediately',
    failedAttachment: 'Failure during the waiting notification prevents native output acquisition',
    reentrantAttachment: 'A newer attachment requested during retirement supersedes the outer attachment',
  }) });
const identity = Object.freeze({ accountIdentifier: Fixture.accountIdentifier, sessionIdentifier: Fixture.sessionIdentifier,
  authorityIdentifier: Fixture.authorityIdentifier });
function target(overrides = {}) { return { ...identity, sequence: Fixture.sequence, occurrenceIdentifier: Fixture.occurrenceIdentifier,
  spotifyTrackIdentifier: Fixture.spotifyTrackIdentifier, positionMilliseconds: Fixture.positionMilliseconds,
  durationMilliseconds: Fixture.durationMilliseconds, anchorMonotonicMilliseconds: Fixture.nowMilliseconds,
  observedMonotonicMilliseconds: Fixture.nowMilliseconds, uncertaintyMilliseconds: Fixture.zero, playing: true, buffering: false, ...overrides }; }
function deferred() { let resolve; let reject; const promise = new Promise((complete, fail) => { resolve = complete; reject = fail; }); return { promise, resolve, reject }; }
async function flush() { for (let iteration = Fixture.zero; iteration < Fixture.flushCount; iteration += Fixture.iterationIncrement) await Promise.resolve(); }
function fixture() {
  const state = { now: Fixture.nowMilliseconds, acquired: [], prepared: [], applied: [], released: Fixture.zero,
    resolutions: [], timers: new Set(), ready: true, buffering: false, seekable: true, playing: false,
    position: Fixture.zero, occurrence: Fixture.occurrenceIdentifier, sampled: null,
    match: { status: library.MatchStatus.Matched, selected: { identifier: Fixture.recordingIdentifier, title: Fixture.title, author: Fixture.author }, candidates: [], failure: null } };
  const lease = {
    async prepare(recording, occurrence, cancellation) { state.prepared.push({ recording, occurrence, cancellation }); state.occurrence = occurrence; state.playing = false; },
    async sample() { return { occurrenceIdentifier: state.occurrence, positionMilliseconds: state.position,
      uncertaintyMilliseconds: Fixture.zero,
      sampledMonotonicMilliseconds: state.sampled ?? state.now, ready: state.ready, buffering: state.buffering,
      seekable: state.seekable, playing: state.playing }; },
    async apply(execution, cancellation) { state.applied.push({ ...execution, cancellation }); state.playing = execution.playing;
      if (execution.seek) state.position = execution.positionMilliseconds; },
    async release() { state.released += Fixture.singleCount; state.playing = false; },
  };
  const output = { async acquire(captured, cancellation) { state.acquired.push({ captured, cancellation }); return lease; } };
  const resolver = { async resolve(identifier, cancellation) { state.resolutions.push({ identifier, cancellation }); return state.match; } };
  const scheduler = { schedule(delay, callback) { const timer = { delay, callback }; state.timers.add(timer); return () => state.timers.delete(timer); } };
  const follower = new library.SharedPlaybackSynchronizer(output, resolver, { nowMonotonicMilliseconds: () => state.now }, scheduler);
  return { state, lease, output, resolver, follower, async start() { await follower.attach(identity); await follower.accept(target()); },
    async tick() { const timers = [...state.timers]; state.timers.clear(); for (const timer of timers) timer.callback(); await flush(); } };
}

test(Fixture.names.idle, () => { const current = fixture(); assert.equal(current.state.acquired.length, Fixture.zero); assert.equal(current.state.timers.size, Fixture.zero); });
test(Fixture.names.capture, async () => { const current = fixture(); const mutable = { ...identity }; await current.follower.attach(mutable); mutable.authorityIdentifier = Fixture.otherAuthority;
  assert.equal(current.follower.getSnapshot().identity.authorityIdentifier, Fixture.authorityIdentifier); assert.ok(Object.isFrozen(current.follower.getSnapshot().identity)); await current.follower.detach(); });
test(Fixture.names.fresh, async () => { const current = fixture(); await current.start(); assert.equal(current.state.prepared.length, Fixture.singleCount);
  assert.equal(current.state.applied[Fixture.firstPosition].positionMilliseconds, Fixture.positionMilliseconds); assert.equal(current.state.playing, true);
  assert.equal(current.follower.getSnapshot().status, library.SharedPlaybackStatus.Following); await current.follower.detach(); });
test(Fixture.names.preparation, async () => { const current = fixture(); const prepare = current.lease.prepare; current.lease.prepare = async (...parameters) => { await prepare(...parameters); current.state.now = Fixture.preparationMilliseconds; };
  await current.start(); assert.equal(current.state.applied[Fixture.firstPosition].positionMilliseconds, Fixture.positionMilliseconds + Fixture.preparationMilliseconds - Fixture.nowMilliseconds); await current.follower.detach(); });
test(Fixture.names.pause, async () => { const current = fixture(); await current.start(); await current.follower.accept(target({ sequence: Fixture.nextSequence, playing: false }));
  assert.equal(current.state.playing, false); assert.equal(current.state.prepared.length, Fixture.singleCount); await current.follower.detach(); });
test(Fixture.names.duplicate, async () => { const current = fixture(); await current.start(); const count = current.state.applied.length;
  await current.follower.accept(target({ playing: false })); await current.follower.accept(target({ sequence: Fixture.zero, playing: false })); assert.equal(current.state.applied.length, count); await current.follower.detach(); });
test(Fixture.names.authority, async () => { const current = fixture(); await current.start(); await current.follower.accept(target({ sequence: Fixture.nextSequence, authorityIdentifier: Fixture.otherAuthority, playing: false }));
  assert.equal(current.state.playing, true); assert.equal(current.follower.getSnapshot().sequence, Fixture.sequence); await current.follower.detach(); });
test(Fixture.names.occurrence, async () => { const current = fixture(); await current.start(); await current.follower.accept(target({ sequence: Fixture.nextSequence, occurrenceIdentifier: Fixture.secondOccurrence }));
  assert.equal(current.state.prepared.length, Fixture.doubleCount); assert.equal(current.state.prepared[Fixture.secondPosition].occurrence, Fixture.secondOccurrence); await current.follower.detach(); });
test(Fixture.names.contradiction, async () => { const current = fixture(); await current.start(); await current.follower.accept(target({ sequence: Fixture.nextSequence, spotifyTrackIdentifier: Fixture.secondTrackIdentifier }));
  assert.equal(current.follower.getSnapshot().failure, library.IntegrationFailureCode.InvalidResponse); assert.equal(current.state.playing, false); await current.follower.detach(); });
test(Fixture.names.ambiguous, async () => { const current = fixture(); current.state.match = { ...current.state.match, status: library.MatchStatus.Ambiguous, selected: null }; await current.start(); await current.tick();
  assert.equal(current.follower.getSnapshot().status, library.SharedPlaybackStatus.Unavailable); assert.equal(current.state.resolutions.length, Fixture.singleCount); assert.equal(current.state.applied.length, Fixture.zero); await current.follower.detach(); });
test(Fixture.names.missing, async () => { const current = fixture(); current.state.match = { ...current.state.match, status: library.MatchStatus.NotFound, selected: null }; await current.start();
  assert.equal(current.state.prepared.length, Fixture.zero); assert.equal(current.state.playing, false); await current.follower.detach(); });
test(Fixture.names.stale, async () => { const current = fixture(); await current.start(); current.state.now += library.SharedPlaybackPolicy.maximumObservationAgeMilliseconds + Fixture.singleCount; await current.tick();
  assert.equal(current.state.playing, false); assert.equal(current.follower.getSnapshot().status, library.SharedPlaybackStatus.Stale); await current.follower.detach(); });
test(Fixture.names.uncertainty, async () => { const current = fixture(); await current.follower.attach(identity); await current.follower.accept(target({ uncertaintyMilliseconds: Fixture.highUncertaintyMilliseconds }));
  assert.equal(current.state.resolutions.length, Fixture.zero); assert.equal(current.follower.getSnapshot().status, library.SharedPlaybackStatus.Stale); await current.follower.detach(); });
test(Fixture.names.pausedAnchor, async () => { const current = fixture(); await current.follower.attach(identity); await current.follower.accept(target({ playing: false, anchorMonotonicMilliseconds: Fixture.oldMilliseconds }));
  assert.equal(current.state.applied[Fixture.firstPosition].positionMilliseconds, Fixture.positionMilliseconds); assert.equal(current.state.playing, false); await current.follower.detach(); });
test(Fixture.names.drift, async () => { const current = fixture(); await current.start(); current.state.position -= Fixture.driftMilliseconds; await current.follower.reconcile();
  assert.equal(current.state.applied.at(-Fixture.singleCount).seek, true); assert.equal(current.follower.getSnapshot().driftMilliseconds, Fixture.driftMilliseconds); await current.follower.detach(); });
test(Fixture.names.smallDrift, async () => { const current = fixture(); await current.start(); const count = current.state.applied.length; current.state.position -= Fixture.tinyDriftMilliseconds;
  await current.follower.reconcile(); assert.equal(current.state.applied.length, count); await current.follower.detach(); });
test(Fixture.names.unseekable, async () => { const current = fixture(); current.state.seekable = false; await current.start(); assert.equal(current.state.playing, false);
  assert.equal(current.follower.getSnapshot().failure, library.IntegrationFailureCode.Unsupported); await current.follower.detach(); });
test(Fixture.names.buffering, async () => { const current = fixture(); await current.start(); current.state.buffering = true; await current.follower.reconcile();
  assert.equal(current.state.playing, false); assert.equal(current.follower.getSnapshot().status, library.SharedPlaybackStatus.Buffering); current.state.buffering = false;
  await current.follower.reconcile(); assert.equal(current.state.playing, true); await current.follower.detach(); });
test(Fixture.names.remoteBuffering, async () => { const current = fixture(); await current.follower.attach(identity); await current.follower.accept(target({ buffering: true }));
  assert.equal(current.state.playing, false); assert.equal(current.follower.getSnapshot().status, library.SharedPlaybackStatus.Buffering); await current.follower.detach(); });
test(Fixture.names.lateResolver, async () => { const current = fixture(); const pending = deferred(); current.resolver.resolve = () => pending.promise;
  await current.follower.attach(identity); const following = current.follower.accept(target()); await flush(); await current.follower.detach(); pending.resolve(current.state.match); await following;
  assert.equal(current.state.prepared.length, Fixture.zero); assert.equal(current.follower.getSnapshot().status, library.SharedPlaybackStatus.Detached); });
test(Fixture.names.replaceTarget, async () => { const current = fixture(); const pending = deferred(); current.resolver.resolve = () => pending.promise;
  await current.follower.attach(identity); const following = current.follower.accept(target()); await flush(); const newer = current.follower.accept(target({ sequence: Fixture.nextSequence, occurrenceIdentifier: Fixture.secondOccurrence }));
  pending.resolve(current.state.match); await Promise.all([following, newer]); assert.equal(current.state.prepared.length, Fixture.singleCount); assert.equal(current.state.prepared[Fixture.firstPosition].occurrence, Fixture.secondOccurrence); await current.follower.detach(); });
test(Fixture.names.newestTarget, async () => { const current = fixture(); const pending = deferred(); const prepare = current.lease.prepare; current.lease.prepare = async (...parameters) => { await pending.promise; await prepare(...parameters); };
  await current.follower.attach(identity); const following = current.follower.accept(target()); await flush(); const newer = current.follower.accept(target({ sequence: Fixture.nextSequence, playing: false }));
  pending.resolve(); await Promise.all([following, newer]); assert.equal(current.state.playing, false); assert.equal(current.follower.getSnapshot().sequence, Fixture.nextSequence); await current.follower.detach(); });
test(Fixture.names.detach, async () => { const current = fixture(); await current.start(); const pending = deferred(); current.lease.release = () => pending.promise;
  let completed = false; const detaching = current.follower.detach().then(() => { completed = true; }); await flush(); assert.equal(completed, false); assert.equal(current.state.timers.size, Fixture.zero); pending.resolve(); await detaching; });
test(Fixture.names.lateLease, async () => { const current = fixture(); const pending = deferred(); current.output.acquire = () => pending.promise;
  const attaching = current.follower.attach(identity); await flush(); await current.follower.detach(); pending.resolve(current.lease); await attaching; await flush(); assert.equal(current.state.released, Fixture.singleCount); });
test(Fixture.names.ordering, async () => { const current = fixture(); await current.start(); const pending = deferred(); current.lease.release = () => pending.promise;
  const attaching = current.follower.attach({ ...identity, authorityIdentifier: Fixture.otherAuthority }); await flush(); assert.equal(current.state.acquired.length, Fixture.singleCount);
  pending.resolve(); await attaching; assert.equal(current.state.acquired.length, Fixture.doubleCount); await current.follower.detach(); });
test(Fixture.names.invalid, async () => { for (const override of [{ positionMilliseconds: -Fixture.singleCount }, { observedMonotonicMilliseconds: Fixture.futureMilliseconds },
  { sequence: Number.NaN }, { durationMilliseconds: Number.POSITIVE_INFINITY }, { durationMilliseconds: Number.MAX_VALUE }]) { const current = fixture(); await current.follower.attach(identity); await current.follower.accept(target(override));
  assert.equal(current.follower.getSnapshot().failure, library.IntegrationFailureCode.InvalidResponse); assert.equal(current.state.applied.length, Fixture.zero); await current.follower.detach(); } });
test(Fixture.names.invalidSample, async () => { for (const position of [Number.NaN, -Fixture.singleCount]) { const current = fixture(); current.state.position = position; await current.start();
  assert.equal(current.follower.getSnapshot().failure, library.IntegrationFailureCode.InvalidResponse); assert.equal(current.state.playing, false); await current.follower.detach(); } });
test(Fixture.names.duration, () => { const current = target({ positionMilliseconds: Fixture.durationMilliseconds }); assert.equal(library.targetPlaybackPosition(current, Fixture.laterMilliseconds), Fixture.durationMilliseconds); });
test(Fixture.names.subscribers, async () => { const current = fixture(); current.follower.subscribe(() => { throw new Error(Fixture.releaseFailure); }); await current.start();
  assert.equal(current.follower.getSnapshot().status, library.SharedPlaybackStatus.Following); await current.follower.detach(); });
test(Fixture.names.failures, async () => { const current = fixture(); current.resolver.resolve = async () => { throw new Error(Fixture.releaseFailure); }; await current.start();
  assert.equal(current.follower.getSnapshot().failure, library.IntegrationFailureCode.Network); assert.equal(current.state.playing, false); await current.follower.detach(); });
test(Fixture.names.reentrant, async () => { const current = fixture(); current.follower.subscribe(() => { if (current.follower.getSnapshot().status === library.SharedPlaybackStatus.Resolving) void current.follower.detach(); });
  await current.start(); assert.equal(current.state.resolutions.length, Fixture.zero); assert.equal(current.follower.getSnapshot().status, library.SharedPlaybackStatus.Detached); });
test(Fixture.names.timer, async () => { const current = fixture(); await current.start(); current.state.position -= Fixture.driftMilliseconds; await current.tick();
  assert.equal(current.follower.getSnapshot().driftMilliseconds, Fixture.driftMilliseconds); await current.follower.detach(); assert.equal(current.state.timers.size, Fixture.zero); });
test(Fixture.names.exhausted, async () => { const current = fixture(); await current.follower.attach(identity); await current.follower.accept(target({ positionMilliseconds: Fixture.durationMilliseconds }));
  assert.equal(current.state.playing, false); assert.equal(current.state.position, Fixture.durationMilliseconds); assert.equal(current.state.prepared.length, Fixture.singleCount); await current.follower.detach(); });
test(Fixture.names.uncertainOutput, async () => { const current = fixture(); const apply = current.lease.apply; let applied = false;
  current.lease.apply = async (...parameters) => { await apply(...parameters); if (!applied) { applied = true; throw new Error(Fixture.releaseFailure); } };
  await current.start(); assert.equal(current.state.playing, false); assert.equal(current.follower.getSnapshot().status, library.SharedPlaybackStatus.Failed); await current.follower.detach(); });
test(Fixture.names.shorterMedia, async () => { const current = fixture(); const sample = current.lease.sample;
  current.lease.sample = async (...parameters) => ({ ...await sample(...parameters), durationMilliseconds: Fixture.positionMilliseconds });
  await current.start(); assert.equal(current.state.playing, false); assert.equal(current.state.applied.length, Fixture.zero);
  assert.equal(current.follower.getSnapshot().status, library.SharedPlaybackStatus.Unavailable); await current.follower.detach(); });
test(Fixture.names.foreignMalformed, async () => { const current = fixture(); await current.start();
  for (const override of [{ positionMilliseconds: Number.NaN }, { observedMonotonicMilliseconds: Fixture.futureMilliseconds }]) {
    await current.follower.accept(target({ ...override, authorityIdentifier: Fixture.otherAuthority, sequence: Fixture.nextSequence }));
  }
  assert.equal(current.follower.getSnapshot().status, library.SharedPlaybackStatus.Following); assert.equal(current.state.playing, true);
  assert.equal(current.follower.getSnapshot().sequence, Fixture.sequence); await current.follower.detach(); });
test(Fixture.names.failedLookup, async () => { const current = fixture(); const pending = deferred(); current.resolver.resolve = () => pending.promise;
  await current.follower.attach(identity); const following = current.follower.accept(target()); await flush();
  await current.follower.accept(target({ sequence: Fixture.nextSequence, positionMilliseconds: Number.NaN }));
  pending.resolve(current.state.match); await following; assert.equal(current.follower.getSnapshot().status, library.SharedPlaybackStatus.Failed);
  assert.equal(current.follower.getSnapshot().failure, library.IntegrationFailureCode.InvalidResponse);
  assert.equal(current.state.prepared.length, Fixture.zero); assert.equal(current.state.playing, false); await current.follower.detach(); });
test(Fixture.names.failedApply, async () => { const current = fixture(); const pending = deferred(); const apply = current.lease.apply;
  current.lease.apply = async (...parameters) => { if (parameters[Fixture.firstPosition].playing) await pending.promise; await apply(...parameters); };
  await current.follower.attach(identity); const following = current.follower.accept(target()); await flush();
  const failing = current.follower.accept(target({ sequence: Fixture.nextSequence, positionMilliseconds: Number.NaN })); await flush();
  pending.resolve(); await Promise.all([following, failing]); assert.equal(current.state.playing, false);
  assert.equal(current.follower.getSnapshot().status, library.SharedPlaybackStatus.Failed); await current.follower.detach(); });
test(Fixture.names.replacementNotification, async () => { const current = fixture(); let first = true; let replacement = null;
  current.resolver.resolve = async () => { if (first) { first = false; return { ...current.state.match, status: library.MatchStatus.NotFound, selected: null }; } return current.state.match; };
  current.follower.subscribe(() => { if (current.follower.getSnapshot().status === library.SharedPlaybackStatus.Unavailable && !replacement) {
    replacement = current.follower.accept(target({ sequence: Fixture.nextSequence, occurrenceIdentifier: Fixture.secondOccurrence }));
  } });
  await current.start(); await replacement; assert.equal(current.follower.getSnapshot().status, library.SharedPlaybackStatus.Following);
  assert.equal(current.state.prepared[Fixture.firstPosition].occurrence, Fixture.secondOccurrence); await current.follower.detach(); });
test(Fixture.names.failedAttachment, async () => { const current = fixture(); current.follower.subscribe(() => {
  if (current.follower.getSnapshot().status === library.SharedPlaybackStatus.Waiting) void current.follower.accept(target({ positionMilliseconds: Number.NaN }));
  }); await current.follower.attach(identity); assert.equal(current.state.acquired.length, Fixture.zero);
  assert.equal(current.follower.getSnapshot().status, library.SharedPlaybackStatus.Failed); await current.follower.detach(); });
test(Fixture.names.reentrantAttachment, async () => { const current = fixture(); await current.follower.attach(identity); let replacement = null; let triggered = false;
  current.follower.subscribe(() => { if (!triggered && current.follower.getSnapshot().status === library.SharedPlaybackStatus.Detached) {
    triggered = true; replacement = current.follower.attach({ ...identity, authorityIdentifier: Fixture.otherAuthority });
  } });
  await current.follower.attach(identity); await replacement; assert.equal(current.follower.getSnapshot().identity.authorityIdentifier, Fixture.otherAuthority);
  assert.equal(current.state.acquired.length, Fixture.doubleCount); await current.follower.detach(); });

const QueueFixture = Object.freeze({ revision: 'first-remote-queue', replacementRevision: 'replacement-remote-queue',
  thirdOccurrence: 'third-remote-occurrence',
  preserveName: 'Authoritative queue preparation preserves repeated tracks and actual occurrence order',
  replaceName: 'A changed remote queue replaces upcoming entries while retaining the current occurrence',
  missingName: 'An unmatched upcoming recording is omitted without advancing the current occurrence',
  staleName: 'A superseded upcoming resolution cannot publish its retired queue',
  duplicateName: 'Duplicate authoritative occurrence identifiers fail before preparing output',
  unsupportedName: 'An output without queue projection support rejects authoritative queue targets' });
function queuedTarget(overrides = {}) {
  return target({ queue: { revision: QueueFixture.revision, upcomingOccurrences: [
    { occurrenceIdentifier: Fixture.secondOccurrence, spotifyTrackIdentifier: Fixture.spotifyTrackIdentifier },
  ] }, ...overrides });
}
function queueFixture() {
  const current = fixture(); current.state.queues = [];
  current.lease.prepareQueue = async (recordings, occurrence) => {
    current.state.queues.push({ recordings, occurrence });
    if (current.state.occurrence !== occurrence) current.state.playing = false;
    current.state.occurrence = occurrence;
  };
  return current;
}
test(QueueFixture.preserveName, async () => {
  const current = queueFixture(); await current.follower.attach(identity); await current.follower.accept(queuedTarget());
  assert.deepEqual(current.state.queues[Fixture.firstPosition], { occurrence: Fixture.occurrenceIdentifier, recordings: [
    { occurrenceIdentifier: Fixture.occurrenceIdentifier, recordingIdentifier: Fixture.recordingIdentifier },
    { occurrenceIdentifier: Fixture.secondOccurrence, recordingIdentifier: Fixture.recordingIdentifier },
  ] });
  assert.equal(current.state.resolutions.length, Fixture.singleCount); await current.follower.detach();
});
test(QueueFixture.replaceName, async () => {
  const current = queueFixture(); await current.follower.attach(identity); await current.follower.accept(queuedTarget());
  await current.follower.accept(queuedTarget({ sequence: Fixture.nextSequence,
    queue: { revision: QueueFixture.replacementRevision, upcomingOccurrences: [] } }));
  assert.equal(current.state.queues.length, Fixture.doubleCount);
  assert.equal(current.state.queues[Fixture.secondPosition].recordings.length, Fixture.singleCount); await current.follower.detach();
});
test(QueueFixture.missingName, async () => {
  const current = queueFixture(); const resolve = current.resolver.resolve;
  current.resolver.resolve = async (identifier, cancellation) => identifier === Fixture.secondTrackIdentifier
    ? { ...current.state.match, status: library.MatchStatus.NotFound, selected: null } : resolve(identifier, cancellation);
  await current.follower.attach(identity); await current.follower.accept(queuedTarget({ queue: { revision: QueueFixture.revision,
    upcomingOccurrences: [{ occurrenceIdentifier: Fixture.secondOccurrence, spotifyTrackIdentifier: Fixture.secondTrackIdentifier }] } }));
  assert.equal(current.state.queues[Fixture.firstPosition].recordings.length, Fixture.singleCount);
  assert.equal(current.follower.getSnapshot().status, library.SharedPlaybackStatus.Following); await current.follower.detach();
});
test(QueueFixture.staleName, async () => {
  const current = queueFixture(); const pending = deferred(); const resolve = current.resolver.resolve;
  current.resolver.resolve = (identifier, cancellation) => identifier === Fixture.secondTrackIdentifier ? pending.promise : resolve(identifier, cancellation);
  await current.follower.attach(identity);
  const first = current.follower.accept(queuedTarget({ queue: { revision: QueueFixture.revision,
    upcomingOccurrences: [{ occurrenceIdentifier: Fixture.secondOccurrence, spotifyTrackIdentifier: Fixture.secondTrackIdentifier }] } }));
  await flush();
  const replacement = current.follower.accept(queuedTarget({ sequence: Fixture.nextSequence,
    queue: { revision: QueueFixture.replacementRevision, upcomingOccurrences: [] } }));
  await replacement;
  assert.equal(current.state.queues.length, Fixture.doubleCount);
  pending.resolve(current.state.match); await first;
  assert.equal(current.state.queues.length, Fixture.doubleCount);
  assert.equal(current.state.queues.at(-Fixture.singleCount).recordings.length, Fixture.singleCount); await current.follower.detach();
});
test(QueueFixture.duplicateName, async () => {
  const current = queueFixture(); await current.follower.attach(identity);
  await current.follower.accept(queuedTarget({ queue: { revision: QueueFixture.revision,
    upcomingOccurrences: [{ occurrenceIdentifier: Fixture.occurrenceIdentifier, spotifyTrackIdentifier: Fixture.spotifyTrackIdentifier }] } }));
  assert.equal(current.follower.getSnapshot().failure, library.IntegrationFailureCode.InvalidResponse);
  assert.equal(current.state.queues.length, Fixture.zero); await current.follower.detach();
});
test(QueueFixture.unsupportedName, async () => {
  const current = fixture(); await current.follower.attach(identity); await current.follower.accept(queuedTarget());
  assert.equal(current.follower.getSnapshot().failure, library.IntegrationFailureCode.Unsupported);
  assert.equal(current.state.prepared.length, Fixture.zero); await current.follower.detach();
});

const QueueBoundsFixture = Object.freeze({ name: 'Authoritative queue capture accepts its exact bound and rejects an overflow without mutating captured entries' });
test(QueueBoundsFixture.name, () => {
  const upcomingOccurrences = Array.from({ length: library.SharedPlaybackPolicy.maximumUpcomingOccurrences }, (unusedOccurrence, position) => ({
    occurrenceIdentifier: QueueFixture.thirdOccurrence + position, spotifyTrackIdentifier: Fixture.spotifyTrackIdentifier,
  }));
  const value = queuedTarget({ queue: { revision: QueueFixture.revision, upcomingOccurrences } });
  const captured = library.capturePlaybackTarget(value, Fixture.nowMilliseconds);
  assert.equal(captured.queue.upcomingOccurrences.length, library.SharedPlaybackPolicy.maximumUpcomingOccurrences);
  assert.ok(Object.isFrozen(captured.queue.upcomingOccurrences));
  upcomingOccurrences.push({ occurrenceIdentifier: Fixture.secondOccurrence, spotifyTrackIdentifier: Fixture.spotifyTrackIdentifier });
  assert.throws(() => library.capturePlaybackTarget(value, Fixture.nowMilliseconds),
    failure => failure instanceof library.IntegrationFailure && failure.code === library.IntegrationFailureCode.InvalidResponse);
});


const PriorityQueueFixture = Object.freeze({ name: 'Current playback starts before a blocked future match and a queue refresh preserves its intent' });
test(PriorityQueueFixture.name, async () => {
  const current = queueFixture(); const pending = deferred(); const resolve = current.resolver.resolve;
  let upcomingCancellation = null;
  current.resolver.resolve = (identifier, cancellation) => {
    if (identifier !== Fixture.secondTrackIdentifier) return resolve(identifier, cancellation);
    upcomingCancellation = cancellation; return pending.promise;
  };
  await current.follower.attach(identity);
  await current.follower.accept(queuedTarget({ queue: { revision: QueueFixture.revision,
    upcomingOccurrences: [{ occurrenceIdentifier: Fixture.secondOccurrence, spotifyTrackIdentifier: Fixture.secondTrackIdentifier }] } }));
  assert.equal(current.state.playing, true);
  assert.equal(current.follower.getSnapshot().status, library.SharedPlaybackStatus.Following);
  assert.equal(current.state.queues.length, Fixture.singleCount);
  await current.follower.accept(queuedTarget({ sequence: Fixture.nextSequence,
    queue: { revision: QueueFixture.replacementRevision, upcomingOccurrences: [] } }));
  assert.equal(upcomingCancellation.aborted, true);
  assert.equal(current.state.playing, true);
  assert.equal(current.state.applied.some(execution => !execution.playing), false);
  pending.resolve(current.state.match); await flush();
  assert.equal(current.state.queues.at(-Fixture.singleCount).recordings.length, Fixture.singleCount);
  await current.follower.detach();
});


const FutureFailureFixture = Object.freeze({ name: 'A rejected or failed future lookup preserves current playback and reports a partial queue without retry',
  rejectionMode: 'rejection', failedResultMode: 'failed-result' });
test(FutureFailureFixture.name, async () => {
  for (const mode of [FutureFailureFixture.rejectionMode, FutureFailureFixture.failedResultMode]) {
    const current = queueFixture(); const resolve = current.resolver.resolve;
    let futureRequests = Fixture.zero;
    current.resolver.resolve = async (identifier, cancellation) => {
      if (identifier !== Fixture.secondTrackIdentifier) return resolve(identifier, cancellation);
      futureRequests += Fixture.singleCount;
      if (mode === FutureFailureFixture.rejectionMode) throw new library.IntegrationFailure(library.IntegrationFailureCode.Network);
      return { ...current.state.match, status: library.MatchStatus.Failed, selected: null, failure: library.IntegrationFailureCode.Network };
    };
    await current.follower.attach(identity);
    await current.follower.accept(queuedTarget({ queue: { revision: QueueFixture.revision,
      upcomingOccurrences: [{ occurrenceIdentifier: Fixture.secondOccurrence, spotifyTrackIdentifier: Fixture.secondTrackIdentifier }] } }));
    await flush();
    assert.equal(current.state.playing, true);
    assert.equal(current.follower.getSnapshot().status, library.SharedPlaybackStatus.Following);
    assert.equal(current.follower.getSnapshot().upcomingQueueFailure, library.IntegrationFailureCode.Network);
    assert.equal(current.follower.getSnapshot().unavailableUpcomingCount, Fixture.singleCount);
    assert.equal(current.follower.getSnapshot().upcomingQueuePending, false);
    await current.tick();
    assert.equal(futureRequests, Fixture.singleCount);
    assert.equal(current.state.playing, true);
    await current.follower.detach();
  }
});
