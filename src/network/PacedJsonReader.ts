import type { Clock, Scheduler } from '../../contracts/network';
import { IntegrationFailureCode } from '../../contracts/network';
import { withCancellation } from './Cancellation';
import { HttpPolicy } from './HttpPolicy';
import { checkCancellation, IntegrationFailure } from './IntegrationFailure';
import type { JsonReader } from './SpotifyRequestClient';

export class PacedJsonReader implements JsonReader {
  private tail: Promise<unknown> = Promise.resolve();
  private lastStartMilliseconds: number | null = null;

  constructor(private readonly reader: JsonReader, private readonly clock: Clock,
    private readonly scheduler: Scheduler, private readonly minimumIntervalMilliseconds: number) {
    if (!Number.isFinite(minimumIntervalMilliseconds) || minimumIntervalMilliseconds < HttpPolicy.minimumDelayMilliseconds) {
      throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
    }
  }

  read(address: string, cancellation: AbortSignal): Promise<unknown> {
    checkCancellation(cancellation);
    const operation = this.tail.then(async () => {
      checkCancellation(cancellation);
      const delayMilliseconds = this.lastStartMilliseconds === null ? HttpPolicy.minimumDelayMilliseconds
        : Math.max(HttpPolicy.minimumDelayMilliseconds,
          this.lastStartMilliseconds + this.minimumIntervalMilliseconds - this.clock.nowMilliseconds());
      if (delayMilliseconds > HttpPolicy.minimumDelayMilliseconds) await this.wait(delayMilliseconds, cancellation);
      checkCancellation(cancellation);
      this.lastStartMilliseconds = this.clock.nowMilliseconds();
      return this.reader.read(address, cancellation);
    });
    this.tail = operation.catch(() => undefined);
    return withCancellation(operation, cancellation);
  }

  private wait(delayMilliseconds: number, cancellation: AbortSignal): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const stop = this.scheduler.schedule(delayMilliseconds, () => {
        cancellation.removeEventListener(HttpPolicy.abortEvent, abort);
        resolve();
      });
      const abort = () => { stop(); reject(new IntegrationFailure(IntegrationFailureCode.Canceled)); };
      cancellation.addEventListener(HttpPolicy.abortEvent, abort, { once: true });
    });
  }
}
