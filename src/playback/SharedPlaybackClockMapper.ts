import { IntegrationFailureCode } from '../../contracts/network';
import { IntegrationFailure } from '../network/IntegrationFailure';

export interface SharedClockExchange {
  readonly sentMonotonicMilliseconds: number;
  readonly receivedMonotonicMilliseconds: number;
  readonly sourceMilliseconds: number;
  readonly sourcePrecisionMilliseconds: number;
}

export interface SharedClockMapping {
  readonly monotonicMilliseconds: number;
  readonly uncertaintyMilliseconds: number;
}

export const SharedClockPolicy = Object.freeze({ minimumMilliseconds: 0, midpointDivisor: 2,
  maximumMilliseconds: Number.MAX_SAFE_INTEGER,
  maximumRoundTripMilliseconds: 2000, maximumSampleAgeMilliseconds: 60000,
  maximumRetainedSamples: 8, oscillatorDriftPartsPerMillion: 100, partsPerMillionDivisor: 1000000,
  initialPosition: 0, removedSampleCount: 1 });

export class SharedPlaybackClockMapper {
  private samples: readonly Readonly<SharedClockExchange>[] = Object.freeze([]);

  accept(exchange: SharedClockExchange): void {
    const captured = Object.freeze({ sentMonotonicMilliseconds: exchange.sentMonotonicMilliseconds,
      receivedMonotonicMilliseconds: exchange.receivedMonotonicMilliseconds, sourceMilliseconds: exchange.sourceMilliseconds,
      sourcePrecisionMilliseconds: exchange.sourcePrecisionMilliseconds });
    if (!Object.values(captured).every(value => Number.isFinite(value) && value >= SharedClockPolicy.minimumMilliseconds && value <= SharedClockPolicy.maximumMilliseconds)
      || captured.receivedMonotonicMilliseconds < captured.sentMonotonicMilliseconds
      || captured.receivedMonotonicMilliseconds - captured.sentMonotonicMilliseconds > SharedClockPolicy.maximumRoundTripMilliseconds) {
      throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
    }
    if (this.samples.some(sample => captured.sentMonotonicMilliseconds < sample.receivedMonotonicMilliseconds)) {
      throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
    }
    this.samples = Object.freeze([...this.samples, captured].slice(-SharedClockPolicy.maximumRetainedSamples));
  }

  map(sourceMilliseconds: number, nowMonotonicMilliseconds: number): SharedClockMapping {
    if (![sourceMilliseconds, nowMonotonicMilliseconds].every(value => Number.isFinite(value)
      && value >= SharedClockPolicy.minimumMilliseconds && value <= SharedClockPolicy.maximumMilliseconds)) throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
    const candidates = this.samples.filter(sample => nowMonotonicMilliseconds >= sample.receivedMonotonicMilliseconds
      && nowMonotonicMilliseconds - sample.receivedMonotonicMilliseconds <= SharedClockPolicy.maximumSampleAgeMilliseconds);
    if (!candidates.length) throw new IntegrationFailure(IntegrationFailureCode.Unsupported);
    const intervals = candidates.map(sample => {
      const drift = (nowMonotonicMilliseconds - sample.receivedMonotonicMilliseconds)
        * SharedClockPolicy.oscillatorDriftPartsPerMillion / SharedClockPolicy.partsPerMillionDivisor;
      return { minimum: sample.sentMonotonicMilliseconds - sample.sourceMilliseconds - sample.sourcePrecisionMilliseconds - drift,
        maximum: sample.receivedMonotonicMilliseconds - sample.sourceMilliseconds + sample.sourcePrecisionMilliseconds + drift };
    });
    const minimum = Math.max(...intervals.map(interval => interval.minimum));
    const maximum = Math.min(...intervals.map(interval => interval.maximum));
    if (minimum > maximum) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
    const mapped = sourceMilliseconds + minimum + (maximum - minimum) / SharedClockPolicy.midpointDivisor;
    if (!Number.isFinite(mapped) || mapped < SharedClockPolicy.minimumMilliseconds || mapped > SharedClockPolicy.maximumMilliseconds) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
    return Object.freeze({ monotonicMilliseconds: mapped, uncertaintyMilliseconds: (maximum - minimum) / SharedClockPolicy.midpointDivisor });
  }

  reset(): void { this.samples = Object.freeze([]); }
}
