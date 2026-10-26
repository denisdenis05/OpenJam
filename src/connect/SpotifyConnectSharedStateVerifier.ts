import type { SpotifyConnectObservationPort } from '../../contracts/connectObservation';
import type { JamSharedStateVerifier } from '../../contracts/sharedStateReconciliation';
import type { SharedPlaybackIdentity } from '../../contracts/sharedPlayback';
import { IntegrationFailureCode } from '../../contracts/network';
import { checkCancellation, IntegrationFailure } from '../network/IntegrationFailure';
import { withCancellation } from '../network/Cancellation';
import { ConnectObservationPolicy } from './SpotifyConnectObservationValues';

export class SpotifyConnectSharedStateVerifier implements JamSharedStateVerifier {
  constructor(private readonly observationPort: SpotifyConnectObservationPort, private readonly accountIdentifier: string) {}

  async verify(identity: SharedPlaybackIdentity, cancellation: AbortSignal): Promise<void> {
    checkCancellation(cancellation);
    if (identity.accountIdentifier !== this.accountIdentifier) throw new IntegrationFailure(IntegrationFailureCode.Superseded);
    if (!identity.accountIdentifier.trim() || !identity.sessionIdentifier.trim() || !identity.authorityIdentifier.trim()) {
      throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
    }
    const authorityIdentifier = identity.authorityIdentifier;
    const observation = await withCancellation(this.observationPort.read(this.accountIdentifier, authorityIdentifier, cancellation), cancellation);
    checkCancellation(cancellation);
    if (observation.hostDeviceIdentifier !== authorityIdentifier) throw new IntegrationFailure(IntegrationFailureCode.Superseded);
    if (!Number.isSafeInteger(observation.generation) || observation.generation < ConnectObservationPolicy.firstIdentifier
      || !observation.queueRevision?.trim() || !observation.currentTrack.occurrenceIdentifier?.trim()
      || observation.playback.occurrenceIdentifier !== observation.currentTrack.occurrenceIdentifier) {
      throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
    }
  }
}
