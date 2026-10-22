import { IntegrationFailureCode } from '../../contracts/network';
import type { HttpExecutor, HttpRequest, HttpResponse, Scheduler } from '../../contracts/network';
import { HttpPolicy } from './HttpPolicy';
import { checkCancellation, IntegrationFailure } from './IntegrationFailure';

export class SystemScheduler implements Scheduler {
  schedule(delayMilliseconds: number, callback: () => void): () => void {
    const timer = setTimeout(callback, delayMilliseconds);
    return () => clearTimeout(timer);
  }
}

export class FetchHttpExecutor implements HttpExecutor {
  constructor(private readonly scheduler: Scheduler, private readonly deadlineMilliseconds = HttpPolicy.defaultDeadlineMilliseconds) {
    if (!Number.isFinite(deadlineMilliseconds) || deadlineMilliseconds <= HttpPolicy.minimumDelayMilliseconds) {
      throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
    }
  }

  async execute(request: HttpRequest): Promise<HttpResponse> {
    checkCancellation(request.cancellation);
    const controller = new AbortController();
    const abort = () => controller.abort();
    request.cancellation.addEventListener(HttpPolicy.abortEvent, abort, { once: true });
    let deadlineReached = false;
    const stopDeadline = this.scheduler.schedule(this.deadlineMilliseconds, () => { deadlineReached = true; controller.abort(); });
    try {
      const response = await fetch(request.address, { method: request.method, headers: request.headers,
        signal: controller.signal, redirect: HttpPolicy.redirectPolicy, credentials: HttpPolicy.credentialPolicy });
      const declaredLength = response.headers.get(HttpPolicy.contentLengthHeader);
      if (declaredLength !== null && Number(declaredLength) > HttpPolicy.maximumResponseCharacters) {
        await response.body?.cancel();
        throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
      }
      const text = await response.text();
      checkCancellation(request.cancellation);
      if (deadlineReached) throw new IntegrationFailure(IntegrationFailureCode.Deadline);
      if (text.length > HttpPolicy.maximumResponseCharacters) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
      let body: unknown = null;
      if (text !== HttpPolicy.emptyText) {
        try { body = JSON.parse(text); } catch {
          if (response.status >= HttpPolicy.successMinimumStatus && response.status <= HttpPolicy.successMaximumStatus) {
            throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
          }
        }
      }
      const retryAfter = response.headers.get(HttpPolicy.retryAfterHeader);
      const retryAfterSeconds = retryAfter === null ? undefined : Number(retryAfter);
      return Object.freeze({ status: response.status, body,
        ...(retryAfterSeconds !== undefined && Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= HttpPolicy.minimumRetryAfterSeconds
          ? { retryAfterSeconds } : {}) });
    } catch (failure) {
      if (request.cancellation.aborted) throw new IntegrationFailure(IntegrationFailureCode.Canceled);
      if (deadlineReached) throw new IntegrationFailure(IntegrationFailureCode.Deadline);
      if (failure instanceof IntegrationFailure) throw failure;
      throw new IntegrationFailure(IntegrationFailureCode.Network);
    } finally {
      stopDeadline();
      request.cancellation.removeEventListener(HttpPolicy.abortEvent, abort);
    }
  }
}
