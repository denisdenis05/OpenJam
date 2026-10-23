import type { HostedQueueReader, HostedQueueResponse } from '../../contracts/hostedQueue';
import { IntegrationFailureCode } from '../../contracts/network';
import { checkCancellation, IntegrationFailure } from '../network/IntegrationFailure';
import type { JsonReader } from '../network/SpotifyRequestClient';
import { objectValue, textValue } from '../network/ResponseValues';
import { decodeHostedQueue } from './HostedQueueValues';

export const HostedQueueEndpoints = Object.freeze({
  playback: 'https://api.spotify.com/v1/me/player?additional_types=track%2Cepisode',
  queue: 'https://api.spotify.com/v1/me/player/queue',
});
const BooleanType = 'boolean';

export class SpotifyWebHostedQueueReader implements HostedQueueReader {
  constructor(private readonly requests: JsonReader) {}

  async read(hostDeviceIdentifier: string, cancellation: AbortSignal): Promise<HostedQueueResponse> {
    checkCancellation(cancellation);
    if (!hostDeviceIdentifier.trim()) throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
    await this.requireHost(hostDeviceIdentifier, cancellation);
    const queue = decodeHostedQueue(await this.requests.read(HostedQueueEndpoints.queue, cancellation));
    checkCancellation(cancellation);
    await this.requireHost(hostDeviceIdentifier, cancellation);
    checkCancellation(cancellation);
    return queue;
  }

  private async requireHost(expected: string, cancellation: AbortSignal): Promise<void> {
    const response = await this.requests.read(HostedQueueEndpoints.playback, cancellation);
    checkCancellation(cancellation);
    if (response === null) throw new IntegrationFailure(IntegrationFailureCode.Unsupported);
    const playback = objectValue(response);
    if (playback.device === null || playback.device === undefined) throw new IntegrationFailure(IntegrationFailureCode.Unsupported);
    const device = objectValue(playback.device);
    if (typeof device.is_active !== BooleanType) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
    if (device.is_active !== true) throw new IntegrationFailure(IntegrationFailureCode.Unsupported);
    if (device.id === null) throw new IntegrationFailure(IntegrationFailureCode.Unsupported);
    const identifier = textValue(device.id);
    if (identifier !== expected) throw new IntegrationFailure(IntegrationFailureCode.Forbidden);
  }
}
