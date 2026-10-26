import type { SpotifySong } from '../../contracts/catalog';
import type { SpotifyConnectMetadataPort } from '../../contracts/connectMetadata';
import type { SpotifyConnectObservationPort, SpotifyConnectTrack } from '../../contracts/connectObservation';
import { HostedQueueItemKind } from '../../contracts/hostedQueue';
import type { HostedQueueItem, HostedQueueReader, HostedQueueResponse } from '../../contracts/hostedQueue';
import { IntegrationFailureCode } from '../../contracts/network';
import { checkCancellation, IntegrationFailure } from '../network/IntegrationFailure';
import { HostedQueuePolicy } from '../observation/HostedQueueValues';
import { ConnectObservationPolicy } from './SpotifyConnectObservationValues';
import { ConnectMetadataPolicy } from './SpotifyConnectMetadataValues';

const Policy = Object.freeze({ firstPosition: 0, trackPrefix: 'spotify:track:' } as const);

export class SpotifyConnectHostedQueueReader implements HostedQueueReader {
  constructor(private readonly observations: SpotifyConnectObservationPort, private readonly metadata: SpotifyConnectMetadataPort,
    private readonly accountIdentifier: string) {}

  async read(hostDeviceIdentifier: string, cancellation: AbortSignal): Promise<HostedQueueResponse> {
    checkCancellation(cancellation);
    const observation = await this.observations.read(this.accountIdentifier, hostDeviceIdentifier, cancellation);
    checkCancellation(cancellation);
    if (observation.hostDeviceIdentifier !== hostDeviceIdentifier) throw new IntegrationFailure(IntegrationFailureCode.Superseded);
    const entries = observation.nextTracks.filter(track => track.uri !== ConnectObservationPolicy.delimiterUri
      && !track.uri.startsWith(ConnectObservationPolicy.metadataUriPrefix)).slice(Policy.firstPosition, HostedQueuePolicy.maximumItems);
    const tracks = [observation.currentTrack, ...entries];
    const identifiers = [...new Set(tracks.map(track => {
      if (!track.uri.startsWith(Policy.trackPrefix)) throw new IntegrationFailure(IntegrationFailureCode.Unsupported);
      return track.uri.slice(Policy.trackPrefix.length);
    }))];
    const songs = new Map<string, SpotifySong>();
    for (let position = Policy.firstPosition; position < identifiers.length; position += ConnectMetadataPolicy.maximumItems) {
      const requested = identifiers.slice(position, position + ConnectMetadataPolicy.maximumItems);
      const returned = await this.metadata.readMetadata(this.accountIdentifier, requested, cancellation);
      checkCancellation(cancellation);
      if (returned.length !== requested.length) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
      for (const song of returned) {
        if (!requested.includes(song.identifier) || songs.has(song.identifier)) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
        songs.set(song.identifier, song);
      }
    }
    const current = await this.observations.read(this.accountIdentifier, hostDeviceIdentifier, cancellation);
    checkCancellation(cancellation);
    if (current.hostDeviceIdentifier !== hostDeviceIdentifier || current.generation !== observation.generation || current.queueRevision !== observation.queueRevision
      || current.currentTrack.occurrenceIdentifier !== observation.currentTrack.occurrenceIdentifier) throw new IntegrationFailure(IntegrationFailureCode.Superseded);
    const project = (track: SpotifyConnectTrack): HostedQueueItem => {
      const song = songs.get(track.uri.slice(Policy.trackPrefix.length));
      if (!song) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
      return Object.freeze({ uri: track.uri, title: song.title, author: song.author, kind: HostedQueueItemKind.Track,
        durationMilliseconds: song.durationMilliseconds ?? null, occurrenceIdentifier: track.occurrenceIdentifier, provider: track.provider });
    };
    return Object.freeze({ currentlyPlaying: project(observation.currentTrack), entries: Object.freeze(entries.map(project)), queueRevision: observation.queueRevision });
  }
}
