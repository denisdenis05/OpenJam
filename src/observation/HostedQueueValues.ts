import { HostedQueueItemKind } from '../../contracts/hostedQueue';
import type { HostedQueueItem, HostedQueueResponse } from '../../contracts/hostedQueue';
import { IntegrationFailureCode } from '../../contracts/network';
import { IntegrationFailure } from '../network/IntegrationFailure';
import { arrayValue, objectValue, textValue } from '../network/ResponseValues';

export const HostedQueuePolicy = Object.freeze({
  maximumItems: 100, maximumArtists: 32, maximumTextCharacters: 2048, minimumDurationMilliseconds: 0,
  uriPattern: /^spotify:(track|episode):[A-Za-z0-9]{22}$/, uriKindPosition: 1, artistSeparator: ', ',
  emptyArtistCount: 0, pollIntervalMilliseconds: 15000, millisecondsPerSecond: 1000, minimumRetrySeconds: 0,
});

function boundedText(value: unknown): string {
  const text = textValue(value);
  if (text.length > HostedQueuePolicy.maximumTextCharacters) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
  return text;
}

function duration(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (!Number.isSafeInteger(value) || (value as number) < HostedQueuePolicy.minimumDurationMilliseconds) {
    throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
  }
  return value as number;
}

export function copyHostedQueueItem(item: HostedQueueItem): HostedQueueItem {
  objectValue(item);
  const uri = boundedText(item.uri);
  const match = HostedQueuePolicy.uriPattern.exec(uri);
  if ((item.kind !== HostedQueueItemKind.Track && item.kind !== HostedQueueItemKind.Episode)
    || !match || match[HostedQueuePolicy.uriKindPosition] !== item.kind) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
  return Object.freeze({ uri, kind: item.kind, title: boundedText(item.title), author: boundedText(item.author),
    durationMilliseconds: duration(item.durationMilliseconds) });
}

export function copyHostedQueueResponse(response: HostedQueueResponse): HostedQueueResponse {
  objectValue(response);
  if (response.currentlyPlaying === undefined) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
  const entries = arrayValue(response.entries);
  if (entries.length > HostedQueuePolicy.maximumItems) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
  return Object.freeze({ currentlyPlaying: response.currentlyPlaying === null ? null : copyHostedQueueItem(response.currentlyPlaying),
    entries: Object.freeze(entries.map(item => copyHostedQueueItem(item as HostedQueueItem))) });
}

function decodeItem(value: unknown): HostedQueueItem {
  const item = objectValue(value);
  let author: string;
  if (item.type === HostedQueueItemKind.Track) {
    const artists = arrayValue(item.artists);
    if (artists.length === HostedQueuePolicy.emptyArtistCount || artists.length > HostedQueuePolicy.maximumArtists) {
      throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
    }
    author = artists.map(value => boundedText(objectValue(value).name)).join(HostedQueuePolicy.artistSeparator);
  } else if (item.type === HostedQueueItemKind.Episode) {
    const show = objectValue(item.show);
    author = boundedText(show.publisher ?? show.name);
  } else throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
  return copyHostedQueueItem({ uri: boundedText(item.uri), title: boundedText(item.name), author,
    kind: item.type as HostedQueueItemKind, durationMilliseconds: duration(item.duration_ms) });
}

export function decodeHostedQueue(value: unknown): HostedQueueResponse {
  const response = objectValue(value);
  const entries = arrayValue(response.queue);
  if (entries.length > HostedQueuePolicy.maximumItems || response.currently_playing === undefined) {
    throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
  }
  return Object.freeze({ currentlyPlaying: response.currently_playing === null ? null : decodeItem(response.currently_playing),
    entries: Object.freeze(entries.map(decodeItem)) });
}
