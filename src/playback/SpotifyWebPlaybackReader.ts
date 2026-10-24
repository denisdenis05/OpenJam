import type { HostedPlaybackRead } from '../../contracts/hostedPlayback';
import type { SharedPlaybackClock } from '../../contracts/sharedPlayback';
import { IntegrationFailureCode } from '../../contracts/network';
import type { JsonReader } from '../network/SpotifyRequestClient';
import { objectValue, textValue } from '../network/ResponseValues';
import { checkCancellation, IntegrationFailure } from '../network/IntegrationFailure';

export const HostedPlaybackPolicy = Object.freeze({ address: 'https://api.spotify.com/v1/me/player?additional_types=track',
  trackType: 'track', trackPrefix: 'spotify:track:', trackPattern: /^[A-Za-z0-9]{22}$/, booleanType: 'boolean',
  minimumMilliseconds: 0, maximumRoundTripMilliseconds: 1500, midpointDivisor: 2, pollIntervalMilliseconds: 2000,
  initialSequence: 0, sequenceIncrement: 1, millisecondsPerSecond: 1000, localOccurrencePrefix: 'observed-playback-' });

export class SpotifyWebPlaybackReader {
  constructor(private readonly requests: JsonReader, private readonly clock: SharedPlaybackClock) {}

  async read(hostDeviceIdentifier: string, cancellation: AbortSignal): Promise<HostedPlaybackRead> {
    checkCancellation(cancellation);
    if (!hostDeviceIdentifier.trim()) throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
    const before = this.clock.nowMonotonicMilliseconds();
    const response = await this.requests.read(HostedPlaybackPolicy.address, cancellation);
    const after = this.clock.nowMonotonicMilliseconds();
    checkCancellation(cancellation);
    if (![before, after].every(value => Number.isFinite(value) && value >= HostedPlaybackPolicy.minimumMilliseconds)
      || after < before || after - before > HostedPlaybackPolicy.maximumRoundTripMilliseconds) throw new IntegrationFailure(IntegrationFailureCode.Deadline);
    if (response === null) throw new IntegrationFailure(IntegrationFailureCode.NotFound);
    const playback = objectValue(response);
    const device = objectValue(playback.device);
    if (typeof device.is_active !== HostedPlaybackPolicy.booleanType || typeof playback.is_playing !== HostedPlaybackPolicy.booleanType) {
      throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
    }
    if (!device.is_active || device.id === null) throw new IntegrationFailure(IntegrationFailureCode.Unsupported);
    if (textValue(device.id) !== hostDeviceIdentifier) throw new IntegrationFailure(IntegrationFailureCode.Forbidden);
    if (playback.item === null || playback.progress_ms === null) throw new IntegrationFailure(IntegrationFailureCode.Unsupported);
    const item = objectValue(playback.item);
    if (item.type !== HostedPlaybackPolicy.trackType || item.is_local === true || item.is_playable === false) {
      throw new IntegrationFailure(IntegrationFailureCode.Unsupported);
    }
    const identifier = textValue(item.id);
    if (!HostedPlaybackPolicy.trackPattern.test(identifier) || item.uri !== HostedPlaybackPolicy.trackPrefix + identifier
      || ![playback.progress_ms, item.duration_ms, playback.timestamp].every(value => Number.isSafeInteger(value)
        && (value as number) >= HostedPlaybackPolicy.minimumMilliseconds)
      || (playback.progress_ms as number) > (item.duration_ms as number)) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
    return Object.freeze({ spotifyTrackIdentifier: identifier, positionMilliseconds: playback.progress_ms as number,
      durationMilliseconds: item.duration_ms as number, playing: playback.is_playing as boolean,
      anchorMonotonicMilliseconds: before + (after - before) / HostedPlaybackPolicy.midpointDivisor,
      observedMonotonicMilliseconds: after, uncertaintyMilliseconds: (after - before) / HostedPlaybackPolicy.midpointDivisor,
      stateChangedAtUnixMilliseconds: playback.timestamp as number });
  }
}
