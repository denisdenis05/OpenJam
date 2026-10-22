import { RecordingNamespace } from '../../contracts/catalog';
import type { CatalogSearch, CatalogSong, RecordingCatalog } from '../../contracts/catalog';
import { IntegrationFailureCode } from '../../contracts/network';
import type { Clock, HttpExecutor, Scheduler } from '../../contracts/network';
import { checkCancellation, IntegrationFailure } from '../network/IntegrationFailure';
import { arrayValue, durationValue, objectValue, textValue } from '../network/ResponseValues';
import { HttpPolicy } from '../network/HttpPolicy';
import { PacedJsonReader } from '../network/PacedJsonReader';
import { PlainJsonReader } from '../network/PlainJsonReader';
import { copySong } from './SongIdentity';

export const MusicBrainzProtocol = Object.freeze({
  serviceAddress: 'https://musicbrainz.org/ws/2/', minimumIntervalMilliseconds: 1000,
  recordingPath: 'recording/', searchPath: 'recording', formatParameter: 'fmt', jsonFormat: 'json',
  includeParameter: 'inc', artistCreditsInclude: 'artist-credits+isrcs', queryParameter: 'query',
  limitParameter: 'limit', titleQueryPrefix: 'recording:"', artistQueryPrefix: '" AND artist:"',
  closingQuote: '"', artistCreditProperty: 'artist-credit', artistSeparator: ', ',
  firstPosition: 0, minimumLimit: 1, maximumLimit: 100, escape: '\\', pathSeparator: '/',
  selfHostedProtocol: 'http:',
});
const SearchSpecialCharacters = /[+\-&|!(){}\[\]^"~*?:\\/]/g;
const RecordingIdentifierPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export interface MusicBrainzConfiguration {
  readonly identity: string;
  readonly userAgent: string;
  readonly serviceAddress?: string;
  readonly minimumIntervalMilliseconds?: number;
}

export class MusicBrainzRecordingCatalog implements RecordingCatalog {
  readonly namespace = RecordingNamespace.MusicBrainz;
  readonly identity: string;
  private readonly requests: PacedJsonReader;
  private readonly serviceAddress: string;

  constructor(configuration: MusicBrainzConfiguration, executor: HttpExecutor, clock: Clock, scheduler: Scheduler) {
    this.identity = textValue(configuration.identity);
    this.serviceAddress = configuration.serviceAddress ?? MusicBrainzProtocol.serviceAddress;
    let parsed: URL;
    try { parsed = new URL(this.serviceAddress); } catch { throw new IntegrationFailure(IntegrationFailureCode.InvalidInput); }
    const publicService = parsed.hostname === new URL(MusicBrainzProtocol.serviceAddress).hostname;
    if ((parsed.protocol !== HttpPolicy.secureProtocol && (publicService || parsed.protocol !== MusicBrainzProtocol.selfHostedProtocol))
        || parsed.username || parsed.password || parsed.search || parsed.hash
        || !parsed.pathname.endsWith(MusicBrainzProtocol.pathSeparator)) {
      throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
    }
    const minimumIntervalMilliseconds = configuration.minimumIntervalMilliseconds ?? MusicBrainzProtocol.minimumIntervalMilliseconds;
    if (publicService
        && minimumIntervalMilliseconds < MusicBrainzProtocol.minimumIntervalMilliseconds) {
      throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
    }
    this.requests = new PacedJsonReader(new PlainJsonReader(executor, {
      [HttpPolicy.userAgentHeader]: textValue(configuration.userAgent), [HttpPolicy.acceptHeader]: HttpPolicy.jsonMediaType,
    }), clock, scheduler, minimumIntervalMilliseconds);
  }

  async lookup(identifier: string, cancellation: AbortSignal): Promise<CatalogSong | null> {
    checkCancellation(cancellation);
    if (!RecordingIdentifierPattern.test(identifier)) throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
    const address = this.address(MusicBrainzProtocol.recordingPath + identifier);
    address.searchParams.set(MusicBrainzProtocol.includeParameter, MusicBrainzProtocol.artistCreditsInclude);
    try {
      const song = this.decode(await this.requests.read(address.toString(), cancellation));
      checkCancellation(cancellation);
      if (song.identifier !== identifier) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
      return song;
    } catch (failure) {
      if (failure instanceof IntegrationFailure && failure.code === IntegrationFailureCode.NotFound) return null;
      throw failure;
    }
  }

  async search(search: CatalogSearch, cancellation: AbortSignal): Promise<readonly CatalogSong[]> {
    checkCancellation(cancellation);
    if (!search.title.trim() || !search.author.trim() || !Number.isInteger(search.limit)
        || search.limit < MusicBrainzProtocol.minimumLimit) throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
    const limit = Math.min(search.limit, MusicBrainzProtocol.maximumLimit);
    const escape = (value: string) => value.replace(SearchSpecialCharacters, character => MusicBrainzProtocol.escape + character);
    const address = this.address(MusicBrainzProtocol.searchPath);
    address.searchParams.set(MusicBrainzProtocol.queryParameter, MusicBrainzProtocol.titleQueryPrefix + escape(search.title)
      + MusicBrainzProtocol.artistQueryPrefix + escape(search.author) + MusicBrainzProtocol.closingQuote);
    address.searchParams.set(MusicBrainzProtocol.limitParameter, String(limit));
    const response = objectValue(await this.requests.read(address.toString(), cancellation));
    checkCancellation(cancellation);
    return Object.freeze(arrayValue(response.recordings).slice(MusicBrainzProtocol.firstPosition, limit).map(value => this.decode(value)));
  }

  private address(path: string): URL {
    const address = new URL(path, this.serviceAddress);
    address.searchParams.set(MusicBrainzProtocol.formatParameter, MusicBrainzProtocol.jsonFormat);
    return address;
  }

  private decode(value: unknown): CatalogSong {
    const response = objectValue(value);
    const artistNames = arrayValue(response[MusicBrainzProtocol.artistCreditProperty]).map(value => {
      const credit = objectValue(value);
      return textValue(credit.name ?? objectValue(credit.artist).name);
    });
    const durationMilliseconds = durationValue(response.length);
    const recordingCodes = response.isrcs === undefined ? undefined : arrayValue(response.isrcs).map(textValue);
    return copySong({ identifier: textValue(response.id), title: textValue(response.title),
      author: artistNames.join(MusicBrainzProtocol.artistSeparator), artistNames,
      ...(durationMilliseconds === undefined ? {} : { durationMilliseconds }),
      ...(recordingCodes === undefined ? {} : { recordingCodes }) });
  }
}
