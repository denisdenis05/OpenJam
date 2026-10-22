import { HttpMethod, IntegrationFailureCode } from '../../contracts/network';
import type { SpotifyEndpointResolver } from '../../contracts/network';
import type { JamProtocol, JamSessionResponse } from '../../contracts/session';
import { checkCancellation, IntegrationFailure } from '../network/IntegrationFailure';
import { arrayValue, objectValue, textValue } from '../network/ResponseValues';
import { HttpPolicy } from '../network/HttpPolicy';
import { pathSegment } from '../network/PathSegment';
import { SpotifyRequestClient } from '../network/SpotifyRequestClient';

export const JamHttpProtocol = Object.freeze({
  createPath: '/social-connect/v2/sessions/current_or_new?activate=true',
  deletePrefix: '/social-connect/v3/sessions/', emptyPath: '/', emptyText: '', booleanType: 'boolean',
  devicePrefix: '/social-connect/v2/devices/', deviceStatusSuffix: '/jam_status',
});

export class SpotifyHttpJamProtocol implements JamProtocol {
  constructor(private readonly requests: SpotifyRequestClient, private readonly endpoints: SpotifyEndpointResolver) {}

  async createOrActivate(cancellation: AbortSignal): Promise<JamSessionResponse> {
    const origin = await this.origin(cancellation);
    const value = await this.requests.send(origin + JamHttpProtocol.createPath, HttpMethod.Read, true, cancellation);
    try { return this.decode(value); }
    catch { throw new IntegrationFailure(IntegrationFailureCode.UnknownOutcome); }
  }

  async end(identifier: string, cancellation: AbortSignal): Promise<void> {
    checkCancellation(cancellation);
    const encodedIdentifier = pathSegment(identifier);
    const origin = await this.origin(cancellation);
    try {
      await this.requests.send(origin + JamHttpProtocol.deletePrefix + encodedIdentifier, HttpMethod.Delete, true, cancellation);
    } catch (failure) {
      if (!(failure instanceof IntegrationFailure) || failure.code !== IntegrationFailureCode.NotFound) throw failure;
    }
  }

  async readCurrent(deviceIdentifier: string, cancellation: AbortSignal): Promise<JamSessionResponse | null> {
    checkCancellation(cancellation);
    const encodedIdentifier = pathSegment(deviceIdentifier);
    const origin = await this.origin(cancellation);
    const response = objectValue(await this.requests.read(origin + JamHttpProtocol.devicePrefix
      + encodedIdentifier + JamHttpProtocol.deviceStatusSuffix, cancellation));
    const device = objectValue(response.device_broadcast_status);
    if (textValue(device.device_id) !== deviceIdentifier) throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
    if (response.session === undefined || response.session === null) return null;
    return this.decode(response.session);
  }

  private async origin(cancellation: AbortSignal): Promise<string> {
    const origin = await this.endpoints.resolveServiceOrigin(cancellation);
    checkCancellation(cancellation);
    let parsed: URL;
    try { parsed = new URL(origin); } catch { throw new IntegrationFailure(IntegrationFailureCode.InvalidInput); }
    if (origin !== parsed.origin || parsed.protocol !== HttpPolicy.secureProtocol || parsed.username || parsed.password
        || !parsed.hostname.endsWith(HttpPolicy.spotifyHostSuffix)) throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
    return origin;
  }

  private decode(value: unknown): JamSessionResponse {
    const response = objectValue(value);
    if (typeof response.is_session_owner !== JamHttpProtocol.booleanType || typeof response.active !== JamHttpProtocol.booleanType) {
      throw new IntegrationFailure(IntegrationFailureCode.InvalidResponse);
    }
    const participants = arrayValue(response.session_members).map(value => {
      const participant = objectValue(value);
      return Object.freeze({ identifier: textValue(participant.id), displayName: textValue(participant.display_name ?? participant.username) });
    });
    const session = Object.freeze({ identifier: textValue(response.session_id), ownedByCurrentAccount: response.is_session_owner as boolean,
      active: response.active as boolean, participants: Object.freeze(participants) });
    const joinToken = response.join_session_token === undefined ? null : textValue(response.join_session_token);
    const invitationAddress = response.join_session_uri === undefined ? null : textValue(response.join_session_uri);
    const invitation = joinToken !== null && invitationAddress !== null
      ? Object.freeze({ joinToken, address: invitationAddress }) : null;
    return Object.freeze({ session, invitation });
  }
}
