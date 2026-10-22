import type { AssociationStore, ConfirmedAssociation } from '../../contracts/catalog';
import { IntegrationFailureCode } from '../../contracts/network';
import { IntegrationFailure } from '../network/IntegrationFailure';

const AssociationPolicy = Object.freeze({ maximumEntries: 512, minimumEntries: 1 });

export class MemoryAssociationStore implements AssociationStore {
  private readonly associations = new Map<string, ConfirmedAssociation>();

  constructor(private readonly maximumEntries = AssociationPolicy.maximumEntries) {
    if (!Number.isInteger(maximumEntries) || maximumEntries < AssociationPolicy.minimumEntries) {
      throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
    }
  }

  async findForRecording(catalogIdentity: string, identifier: string, market: string): Promise<readonly ConfirmedAssociation[]> {
    return Object.freeze([...this.associations.values()].filter(association => association.catalogIdentity === catalogIdentity
      && association.recordingIdentifier === identifier && association.market === market));
  }

  async findForSpotify(catalogIdentity: string, identifier: string, market: string): Promise<readonly ConfirmedAssociation[]> {
    return Object.freeze([...this.associations.values()].filter(association => association.catalogIdentity === catalogIdentity
      && association.spotifyIdentifier === identifier && association.market === market));
  }

  async save(association: ConfirmedAssociation): Promise<void> {
    const key = JSON.stringify([association.catalogIdentity, association.recordingNamespace, association.recordingIdentifier,
      association.spotifyIdentifier, association.market, association.policyVersion]);
    this.associations.delete(key);
    this.associations.set(key, Object.freeze({ ...association }));
    while (this.associations.size > this.maximumEntries) {
      const oldest = this.associations.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.associations.delete(oldest);
    }
  }
}
