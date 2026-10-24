import test from 'node:test';
import assert from 'node:assert/strict';
import { library } from './fixtures.mjs';

const Fixture = Object.freeze({ sent: 1000, received: 1100, source: 10000, precision: 10, midpoint: 1050, uncertainty: 60,
  increment: 1, nextSent: 1200, nextReceived: 1300, nextSource: 10200, inconsistentSource: 20000,
  mappingSource: 10050, mappingMonotonic: 1100, zero: 0, negative: -1, future: 1101,
  names: Object.freeze({ mapping: 'Clock mapping uses the exchange interval rather than subtracting unrelated clock origins',
    immutable: 'Clock exchanges and returned mappings cannot be mutated by callers',
    empty: 'Clock mapping requires an observed exchange', invalid: 'Clock exchanges reject reversed nonfinite and excessive round trips',
    ordering: 'Clock exchanges reject overlap and out of order observations',
    disagreement: 'Inconsistent source clock offsets require a new clock generation',
    stale: 'Expired clock exchanges cannot map a playback anchor',
    drift: 'Clock uncertainty increases with oscillator drift since observation',
    reset: 'Reset removes mapping from the previous authority or connection',
    bounded: 'Clock exchange retention is bounded while preserving valid recent mapping',
    future: 'Future local observations and invalid mapping inputs fail closed' }) });
function exchange(overrides = {}) { return { sentMonotonicMilliseconds: Fixture.sent, receivedMonotonicMilliseconds: Fixture.received,
  sourceMilliseconds: Fixture.source, sourcePrecisionMilliseconds: Fixture.precision, ...overrides }; }
function failure(code) { return value => value instanceof library.IntegrationFailure && value.code === code; }
test(Fixture.names.mapping, () => { const mapper = new library.SharedPlaybackClockMapper(); mapper.accept(exchange());
  assert.deepEqual(mapper.map(Fixture.mappingSource, Fixture.received), { monotonicMilliseconds: Fixture.mappingMonotonic, uncertaintyMilliseconds: Fixture.uncertainty }); });
test(Fixture.names.immutable, () => { const mapper = new library.SharedPlaybackClockMapper(); const mutable = exchange(); mapper.accept(mutable); mutable.sourceMilliseconds = Fixture.zero;
  const mapped = mapper.map(Fixture.source, Fixture.received); assert.equal(mapped.monotonicMilliseconds, Fixture.midpoint); assert.ok(Object.isFrozen(mapped)); });
test(Fixture.names.empty, () => { assert.throws(() => new library.SharedPlaybackClockMapper().map(Fixture.source, Fixture.received), failure(library.IntegrationFailureCode.Unsupported)); });
test(Fixture.names.invalid, () => { for (const override of [{ receivedMonotonicMilliseconds: Fixture.zero }, { sourceMilliseconds: Number.NaN },
  { sourcePrecisionMilliseconds: Fixture.negative }, { sourceMilliseconds: Number.MAX_VALUE }, { receivedMonotonicMilliseconds: Fixture.sent + library.SharedClockPolicy.maximumRoundTripMilliseconds + Fixture.future }]) {
  assert.throws(() => new library.SharedPlaybackClockMapper().accept(exchange(override)), failure(library.IntegrationFailureCode.InvalidInput)); } });
test(Fixture.names.ordering, () => { const mapper = new library.SharedPlaybackClockMapper(); mapper.accept(exchange()); assert.throws(() => mapper.accept(exchange()), failure(library.IntegrationFailureCode.InvalidInput)); });
test(Fixture.names.disagreement, () => { const mapper = new library.SharedPlaybackClockMapper(); mapper.accept(exchange()); mapper.accept(exchange({ sentMonotonicMilliseconds: Fixture.nextSent,
  receivedMonotonicMilliseconds: Fixture.nextReceived, sourceMilliseconds: Fixture.inconsistentSource })); assert.throws(() => mapper.map(Fixture.source, Fixture.nextReceived), failure(library.IntegrationFailureCode.InvalidResponse)); });
test(Fixture.names.stale, () => { const mapper = new library.SharedPlaybackClockMapper(); mapper.accept(exchange()); assert.throws(() => mapper.map(Fixture.source,
  Fixture.received + library.SharedClockPolicy.maximumSampleAgeMilliseconds + Fixture.future), failure(library.IntegrationFailureCode.Unsupported)); });
test(Fixture.names.drift, () => { const mapper = new library.SharedPlaybackClockMapper(); mapper.accept(exchange()); assert.ok(mapper.map(Fixture.source, Fixture.nextReceived).uncertaintyMilliseconds > Fixture.uncertainty); });
test(Fixture.names.reset, () => { const mapper = new library.SharedPlaybackClockMapper(); mapper.accept(exchange()); mapper.reset(); assert.throws(() => mapper.map(Fixture.source, Fixture.received), failure(library.IntegrationFailureCode.Unsupported)); });
test(Fixture.names.bounded, () => { const mapper = new library.SharedPlaybackClockMapper(); mapper.accept(exchange({ sourceMilliseconds: Fixture.inconsistentSource }));
  for (let sequence = Fixture.increment; sequence <= library.SharedClockPolicy.maximumRetainedSamples; sequence += Fixture.increment) {
    mapper.accept(exchange({ sentMonotonicMilliseconds: Fixture.sent + sequence * Fixture.nextSent, receivedMonotonicMilliseconds: Fixture.received + sequence * Fixture.nextSent,
      sourceMilliseconds: Fixture.source + sequence * Fixture.nextSent })); }
  const now = Fixture.received + library.SharedClockPolicy.maximumRetainedSamples * Fixture.nextSent;
  assert.ok(Number.isFinite(mapper.map(Fixture.source, now).monotonicMilliseconds)); });
test(Fixture.names.future, () => { const mapper = new library.SharedPlaybackClockMapper(); mapper.accept(exchange()); assert.throws(() => mapper.map(Fixture.source, Fixture.sent), failure(library.IntegrationFailureCode.Unsupported));
  assert.throws(() => mapper.map(Number.POSITIVE_INFINITY, Fixture.received), failure(library.IntegrationFailureCode.InvalidInput)); });
