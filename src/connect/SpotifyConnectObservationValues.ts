import type { SpotifyConnectObservation, SpotifyConnectObservationBoundary, SpotifyConnectTrack } from '../../contracts/connectObservation';
import { IntegrationFailureCode } from '../../contracts/network';
import { IntegrationFailure } from '../network/IntegrationFailure';

export const ConnectObservationPolicy = Object.freeze({ zero: 0, firstIdentifier: 1, maximumIdentifierCharacters: 2048,
  maximumTracks: 2000, maximumRoundTripMilliseconds: 1500, midpointDivisor: 2, nativeClockPrecisionMilliseconds: 1,
  ordinaryPlaybackSpeed: 1, stringType: 'string', objectType: 'object', booleanType: 'boolean',
  trackPattern: /^spotify:track:([A-Za-z0-9]{22})$/, mediaPattern: /^spotify:(track|episode):[A-Za-z0-9]{22}$/,
  controlPattern: /[\u0000-\u001f\u007f]/ } as const);

function invalid(): never { throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse); }
function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== ConnectObservationPolicy.objectType || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown, allowEmpty = false): string {
  if (typeof value !== ConnectObservationPolicy.stringType || (!allowEmpty && !(value as string).length)
    || (value as string).length > ConnectObservationPolicy.maximumIdentifierCharacters || ConnectObservationPolicy.controlPattern.test(value as string)) return invalid();
  return value as string;
}
function natural(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < ConnectObservationPolicy.zero) return invalid();
  return value as number;
}
function boolean(value: unknown): boolean {
  if (typeof value !== ConnectObservationPolicy.booleanType) return invalid();
  return value as boolean;
}
function track(value: unknown): SpotifyConnectTrack {
  const item = object(value); const uri = text(item.uri);
  if (!ConnectObservationPolicy.mediaPattern.test(uri)) throw new IntegrationFailure(IntegrationFailureCode.Unsupported);
  return Object.freeze({ uri, occurrenceIdentifier: item.occurrenceIdentifier === null ? null : text(item.occurrenceIdentifier), provider: text(item.provider, true) });
}
function tracks(value: unknown): readonly SpotifyConnectTrack[] {
  if (!Array.isArray(value) || value.length > ConnectObservationPolicy.maximumTracks) return invalid();
  return Object.freeze(value.map(track));
}

export function decodeSpotifyConnectObservation(value: unknown, boundary: SpotifyConnectObservationBoundary): SpotifyConnectObservation {
  const response = object(value);
  const before = boundary.sentMonotonicMilliseconds; const after = boundary.receivedMonotonicMilliseconds;
  if (![before, after].every(sample => Number.isFinite(sample) && sample >= ConnectObservationPolicy.zero)
    || after < before || after - before > ConnectObservationPolicy.maximumRoundTripMilliseconds) throw new IntegrationFailure(IntegrationFailureCode.Deadline);
  if (natural(response.handle) !== boundary.handle || natural(response.generation) !== boundary.generation
    || boundary.handle < ConnectObservationPolicy.firstIdentifier || boundary.generation < ConnectObservationPolicy.firstIdentifier) return invalid();
  const reading = object(response.reading);
  const nativeStart = natural(reading.requestStartedNativeMonotonicMilliseconds);
  const nativeEnd = natural(reading.requestCompletedNativeMonotonicMilliseconds);
  const nativeSample = natural(response.sampledNativeMonotonicMilliseconds);
  if (nativeEnd < nativeStart || nativeSample < nativeEnd
    || nativeEnd - nativeStart > after - before + ConnectObservationPolicy.nativeClockPrecisionMilliseconds) return invalid();
  const cluster = object(reading.cluster);
  if (text(cluster.activeDeviceIdentifier) !== boundary.hostDeviceIdentifier) throw new IntegrationFailure(IntegrationFailureCode.Superseded);
  const state = object(cluster.playback); const currentTrack = track(state.track);
  const matchedTrack = ConnectObservationPolicy.trackPattern.exec(currentTrack.uri);
  if (!matchedTrack || currentTrack.occurrenceIdentifier === null) throw new IntegrationFailure(IntegrationFailureCode.Unsupported);
  const serverTime = natural(cluster.serverAtMilliseconds); const timestamp = natural(state.timestampMilliseconds);
  const position = natural(state.positionAsOfTimestampMilliseconds); const duration = natural(state.durationMilliseconds);
  if (serverTime < timestamp || serverTime === ConnectObservationPolicy.zero || duration === ConnectObservationPolicy.zero || position > duration) return invalid();
  const paused = boolean(state.paused); const buffering = boolean(state.buffering); const playing = boolean(state.playing) && !paused && !buffering;
  if (state.playbackSpeed !== ConnectObservationPolicy.ordinaryPlaybackSpeed
    && (state.playbackSpeed !== ConnectObservationPolicy.zero || playing)) throw new IntegrationFailure(IntegrationFailureCode.Unsupported);
  const elapsed = playing ? serverTime - timestamp : ConnectObservationPolicy.zero;
  const estimatedPosition = position + elapsed;
  if (!Number.isSafeInteger(estimatedPosition)) return invalid();
  const roundTrip = after - before;
  const uncertainty = roundTrip / ConnectObservationPolicy.midpointDivisor + ConnectObservationPolicy.nativeClockPrecisionMilliseconds;
  return Object.freeze({ generation: boundary.generation, hostDeviceIdentifier: boundary.hostDeviceIdentifier,
    queueRevision: text(state.queueRevision), currentTrack, nextTracks: tracks(state.nextTracks), previousTracks: tracks(state.previousTracks), buffering,
    playback: Object.freeze({ spotifyTrackIdentifier: text(matchedTrack[ConnectObservationPolicy.firstIdentifier]),
      occurrenceIdentifier: currentTrack.occurrenceIdentifier, buffering,
      positionMilliseconds: Math.min(duration, estimatedPosition), durationMilliseconds: duration, playing,
      anchorMonotonicMilliseconds: before + roundTrip / ConnectObservationPolicy.midpointDivisor,
      observedMonotonicMilliseconds: after, uncertaintyMilliseconds: uncertainty, stateChangedAtUnixMilliseconds: timestamp }) });
}
