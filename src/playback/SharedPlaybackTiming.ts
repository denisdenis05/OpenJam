import type { SharedPlaybackIdentity, SharedPlaybackLocalSample, SharedPlaybackQueue, SharedPlaybackTarget } from '../../contracts/sharedPlayback';
import { IntegrationFailureCode } from '../../contracts/network';
import { IntegrationFailure } from '../network/IntegrationFailure';

export const SharedPlaybackPolicy = Object.freeze({
  maximumUpcomingOccurrences: 2000, emptyCount: 0, currentOccurrenceCount: 1,
  minimumMilliseconds: 0, minimumSequence: 0, maximumIdentifierCharacters: 512,
  maximumMilliseconds: Number.MAX_SAFE_INTEGER,
  maximumObservationAgeMilliseconds: 5000, maximumUncertaintyMilliseconds: 750,
  correctionThresholdMilliseconds: 250, reconcileIntervalMilliseconds: 1000,
  trackIdentifierPattern: /^[A-Za-z0-9]{22}$/, booleanType: 'boolean', stringType: 'string',
});

export function samePlaybackIdentity(left: SharedPlaybackIdentity, right: SharedPlaybackIdentity): boolean {
  return left.accountIdentifier === right.accountIdentifier && left.sessionIdentifier === right.sessionIdentifier
    && left.authorityIdentifier === right.authorityIdentifier;
}

export function capturePlaybackIdentity(identity: SharedPlaybackIdentity): SharedPlaybackIdentity {
  for (const value of [identity.accountIdentifier, identity.sessionIdentifier, identity.authorityIdentifier]) {
    if (typeof value !== SharedPlaybackPolicy.stringType || !value.trim() || value.length > SharedPlaybackPolicy.maximumIdentifierCharacters) {
      throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
    }
  }
  return Object.freeze({ accountIdentifier: identity.accountIdentifier, sessionIdentifier: identity.sessionIdentifier,
    authorityIdentifier: identity.authorityIdentifier });
}

export function capturePlaybackTarget(target: SharedPlaybackTarget, now: number): SharedPlaybackTarget {
  const identity = capturePlaybackIdentity(target);
  if (!Number.isSafeInteger(target.sequence) || target.sequence < SharedPlaybackPolicy.minimumSequence
    || typeof target.occurrenceIdentifier !== SharedPlaybackPolicy.stringType || !target.occurrenceIdentifier.trim()
    || target.occurrenceIdentifier.length > SharedPlaybackPolicy.maximumIdentifierCharacters
    || !SharedPlaybackPolicy.trackIdentifierPattern.test(target.spotifyTrackIdentifier)
    || typeof target.playing !== SharedPlaybackPolicy.booleanType || typeof target.buffering !== SharedPlaybackPolicy.booleanType
    || ![target.positionMilliseconds, target.durationMilliseconds, target.anchorMonotonicMilliseconds,
      target.observedMonotonicMilliseconds, target.uncertaintyMilliseconds, now].every(value => Number.isFinite(value)
        && value >= SharedPlaybackPolicy.minimumMilliseconds && value <= SharedPlaybackPolicy.maximumMilliseconds)
    || target.positionMilliseconds > target.durationMilliseconds || target.anchorMonotonicMilliseconds > target.observedMonotonicMilliseconds
    || target.observedMonotonicMilliseconds > now) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
  return Object.freeze({ ...identity, sequence: target.sequence, occurrenceIdentifier: target.occurrenceIdentifier,
    spotifyTrackIdentifier: target.spotifyTrackIdentifier, positionMilliseconds: target.positionMilliseconds,
    durationMilliseconds: target.durationMilliseconds, anchorMonotonicMilliseconds: target.anchorMonotonicMilliseconds,
    observedMonotonicMilliseconds: target.observedMonotonicMilliseconds, uncertaintyMilliseconds: target.uncertaintyMilliseconds,
    playing: target.playing, buffering: target.buffering,
    ...(target.queue === undefined ? {} : { queue: capturePlaybackQueue(target.queue, target.occurrenceIdentifier) }) });
}

function capturePlaybackQueue(queue: SharedPlaybackQueue, currentOccurrence: string): SharedPlaybackQueue {
  if (typeof queue.revision !== SharedPlaybackPolicy.stringType || !queue.revision.trim()
    || queue.revision.length > SharedPlaybackPolicy.maximumIdentifierCharacters || !Array.isArray(queue.upcomingOccurrences)
    || queue.upcomingOccurrences.length > SharedPlaybackPolicy.maximumUpcomingOccurrences) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
  const identifiers = new Set([currentOccurrence]);
  const upcomingOccurrences = queue.upcomingOccurrences.map(occurrence => {
    if (typeof occurrence.occurrenceIdentifier !== SharedPlaybackPolicy.stringType || !occurrence.occurrenceIdentifier.trim()
      || occurrence.occurrenceIdentifier.length > SharedPlaybackPolicy.maximumIdentifierCharacters
      || !SharedPlaybackPolicy.trackIdentifierPattern.test(occurrence.spotifyTrackIdentifier)
      || identifiers.has(occurrence.occurrenceIdentifier)) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
    identifiers.add(occurrence.occurrenceIdentifier);
    return Object.freeze({ occurrenceIdentifier: occurrence.occurrenceIdentifier, spotifyTrackIdentifier: occurrence.spotifyTrackIdentifier });
  });
  return Object.freeze({ revision: queue.revision, upcomingOccurrences: Object.freeze(upcomingOccurrences) });
}

export function samePlaybackQueue(left: SharedPlaybackTarget, right: SharedPlaybackTarget): boolean {
  return left.occurrenceIdentifier === right.occurrenceIdentifier && left.spotifyTrackIdentifier === right.spotifyTrackIdentifier
    && left.queue?.revision === right.queue?.revision && JSON.stringify(left.queue?.upcomingOccurrences) === JSON.stringify(right.queue?.upcomingOccurrences);
}

export function playbackTargetFresh(target: SharedPlaybackTarget, now: number): boolean {
  return Number.isFinite(now) && now >= target.observedMonotonicMilliseconds
    && now - target.observedMonotonicMilliseconds <= SharedPlaybackPolicy.maximumObservationAgeMilliseconds
    && target.uncertaintyMilliseconds <= SharedPlaybackPolicy.maximumUncertaintyMilliseconds;
}

export function targetPlaybackPosition(target: SharedPlaybackTarget, now: number): number {
  const elapsed = target.playing && !target.buffering ? Math.max(SharedPlaybackPolicy.minimumMilliseconds, now - target.anchorMonotonicMilliseconds)
    : SharedPlaybackPolicy.minimumMilliseconds;
  return Math.min(target.durationMilliseconds, target.positionMilliseconds + elapsed);
}

export function localPlaybackPosition(sample: SharedPlaybackLocalSample, now: number): number {
  if (sample.durationMilliseconds !== undefined && sample.durationMilliseconds !== null
    && (!Number.isFinite(sample.durationMilliseconds) || sample.durationMilliseconds < SharedPlaybackPolicy.minimumMilliseconds
      || sample.durationMilliseconds > SharedPlaybackPolicy.maximumMilliseconds)) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
  if (![sample.positionMilliseconds, sample.sampledMonotonicMilliseconds, sample.uncertaintyMilliseconds, now].every(value => Number.isFinite(value)
    && value >= SharedPlaybackPolicy.minimumMilliseconds && value <= SharedPlaybackPolicy.maximumMilliseconds) || sample.sampledMonotonicMilliseconds > now
    || now - sample.sampledMonotonicMilliseconds > SharedPlaybackPolicy.maximumObservationAgeMilliseconds
    || sample.uncertaintyMilliseconds > SharedPlaybackPolicy.maximumUncertaintyMilliseconds
    || ![sample.ready, sample.buffering, sample.seekable, sample.playing].every(value => typeof value === SharedPlaybackPolicy.booleanType)) {
    throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
  }
  return sample.positionMilliseconds + (sample.playing && !sample.buffering
    ? now - sample.sampledMonotonicMilliseconds : SharedPlaybackPolicy.minimumMilliseconds);
}
