import { HttpMethod } from '../../contracts/network';
import type { HttpExecutor } from '../../contracts/network';
import { checkCancellation } from './IntegrationFailure';
import { ensureSuccess } from './SpotifyRequestClient';
import type { JsonReader } from './SpotifyRequestClient';

export class PlainJsonReader implements JsonReader {
  constructor(private readonly executor: HttpExecutor, private readonly headers: Readonly<Record<string, string>>) {}

  async read(address: string, cancellation: AbortSignal): Promise<unknown> {
    checkCancellation(cancellation);
    const response = await this.executor.execute({ address, cancellation, method: HttpMethod.Read, headers: this.headers });
    checkCancellation(cancellation);
    return ensureSuccess(response);
  }
}
