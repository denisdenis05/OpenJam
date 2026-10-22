import type { CatalogSearch, CatalogSong, RecordingCatalog } from '../../contracts/catalog';
import { RecordingNamespace } from '../../contracts/catalog';
import { IntegrationFailureCode } from '../../contracts/network';
import { checkCancellation, IntegrationFailure } from '../network/IntegrationFailure';
import { copySong } from './SongIdentity';

export interface RecordingQuery {
  lookup(identifier: string, cancellation: AbortSignal): Promise<CatalogSong | null>;
  search(search: CatalogSearch, cancellation: AbortSignal): Promise<readonly CatalogSong[]>;
}

const MinimumCandidates = 1;
const FirstPosition = 0;

export class QueryableRecordingCatalog implements RecordingCatalog {
  constructor(readonly identity: string, readonly namespace: RecordingNamespace, private readonly query: RecordingQuery) {
    if (!identity.trim()) throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
  }

  async lookup(identifier: string, cancellation: AbortSignal): Promise<CatalogSong | null> {
    checkCancellation(cancellation);
    if (!identifier.trim()) throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
    const song = await this.query.lookup(identifier, cancellation);
    checkCancellation(cancellation);
    if (song !== null && song.identifier !== identifier) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
    return song === null ? null : copySong(song);
  }

  async search(search: CatalogSearch, cancellation: AbortSignal): Promise<readonly CatalogSong[]> {
    checkCancellation(cancellation);
    if (!search.title.trim() || !search.author.trim() || !Number.isInteger(search.limit) || search.limit < MinimumCandidates) {
      throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
    }
    const capturedSearch = Object.freeze({ ...search });
    const songs = await this.query.search(capturedSearch, cancellation);
    checkCancellation(cancellation);
    return Object.freeze(songs.slice(FirstPosition, capturedSearch.limit).map(copySong));
  }
}
