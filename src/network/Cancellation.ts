import { IntegrationFailureCode } from '../../contracts/network';
import { HttpPolicy } from './HttpPolicy';
import { checkCancellation, IntegrationFailure } from './IntegrationFailure';

export async function withCancellation<Value>(operation: Promise<Value>, cancellation: AbortSignal): Promise<Value> {
  checkCancellation(cancellation);
  return new Promise<Value>((resolve, reject) => {
    const abort = () => reject(new IntegrationFailure(IntegrationFailureCode.Canceled));
    cancellation.addEventListener(HttpPolicy.abortEvent, abort, { once: true });
    void operation.then(value => {
      cancellation.removeEventListener(HttpPolicy.abortEvent, abort);
      if (cancellation.aborted) reject(new IntegrationFailure(IntegrationFailureCode.Canceled));
      else resolve(value);
    }, failure => { cancellation.removeEventListener(HttpPolicy.abortEvent, abort); reject(failure); });
  });
}

export function combineCancellation(first: AbortSignal, second: AbortSignal): { readonly signal: AbortSignal; dispose(): void } {
  const controller = new AbortController();
  const abort = () => controller.abort();
  first.addEventListener(HttpPolicy.abortEvent, abort, { once: true });
  second.addEventListener(HttpPolicy.abortEvent, abort, { once: true });
  if (first.aborted || second.aborted) controller.abort();
  return { signal: controller.signal, dispose() {
    first.removeEventListener(HttpPolicy.abortEvent, abort);
    second.removeEventListener(HttpPolicy.abortEvent, abort);
  } };
}
