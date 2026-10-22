import { IntegrationFailureCode } from '../../contracts/network';

export class IntegrationFailure extends Error {
  constructor(readonly code: IntegrationFailureCode, readonly retryAfterSeconds?: number) {
    super(code);
  }
}

export function checkCancellation(cancellation: AbortSignal): void {
  if (cancellation.aborted) throw new IntegrationFailure(IntegrationFailureCode.Canceled);
}

export function failureCode(failure: unknown): IntegrationFailureCode {
  return failure instanceof IntegrationFailure ? failure.code : IntegrationFailureCode.Network;
}
