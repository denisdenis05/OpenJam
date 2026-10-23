import { IntegrationFailureCode } from '../../contracts/network';
import { JamConnectionStatus, JamJoinMode } from '../../contracts/session';
import type { ExternalStore, JamCapabilities, JamCommandResult, JamInvitation, JamProtocol, JamSnapshot } from '../../contracts/session';
import type { JamQueueProtocol } from '../../contracts/queue';
import { failureCode, IntegrationFailure } from '../network/IntegrationFailure';
import { withCancellation } from '../network/Cancellation';
import { validateSpotifyQueueTrack } from './SpotifyQueueTrack';

export const VerifiedJamCapabilities: JamCapabilities = Object.freeze({
  createOrActivate: true, end: true, refresh: false, resolveInvitation: false, join: false, leave: false, observe: false, queue: false,
});
const CommandPolicy = Object.freeze({ maximumPendingCommands: 16, emptyCount: 0, commandCount: 1,
  completedRequestLimit: 64, firstPosition: 0, createOperation: 'create', endOperation: 'end', refreshOperation: 'refresh',
  joinOperation: 'join', leaveOperation: 'leave', refreshCurrentOperation: 'refresh-current', addQueueOperation: 'add-queue' });

interface SessionOwnership {
  readonly accountIdentifier: string;
  readonly protocol: JamProtocol;
  readonly cancellation: AbortController;
  readonly operations: Map<string, { readonly operation: string; readonly result: Promise<JamCommandResult>; completed: boolean }>;
  pending: number;
  tail: Promise<unknown>;
  readonly queue: JamQueueProtocol | null;
  queueOutcomeUnknown: boolean;
}

export class JamSessionClient implements ExternalStore<JamSnapshot> {
  get capabilities(): JamCapabilities {
    return Object.freeze({ ...VerifiedJamCapabilities, refresh: this.ownership?.protocol.readCurrent !== undefined
      || this.ownership?.protocol.readCurrentAccount !== undefined,
      join: this.experimentalMembership && this.ownership?.protocol.join !== undefined,
      leave: this.experimentalMembership && this.ownership?.protocol.leave !== undefined,
      queue: this.ownership?.queue !== undefined && this.ownership.queue !== null });
  }
  private ownership: SessionOwnership | null = null;
  private invitation: JamInvitation | null = null;
  private snapshot: JamSnapshot = Object.freeze({ accountIdentifier: null, status: JamConnectionStatus.Detached, session: null, failure: null });
  private readonly listeners = new Set<() => void>();

  constructor(private readonly onSubscriberFailure: () => void = () => undefined,
    private readonly experimentalMembership = false) {}

  getSnapshot = (): JamSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  attachAccount(accountIdentifier: string, protocol: JamProtocol, queue: JamQueueProtocol | null = null): void {
    if (!accountIdentifier.trim()) throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
    this.detachAccount();
    this.ownership = { accountIdentifier, protocol, cancellation: new AbortController(), operations: new Map(),
      pending: CommandPolicy.emptyCount, tail: Promise.resolve(), queue, queueOutcomeUnknown: false };
    this.publish({ accountIdentifier, status: JamConnectionStatus.Ready, session: null, failure: null });
  }

  detachAccount(): void {
    this.ownership?.cancellation.abort();
    this.ownership = null;
    this.invitation = null;
    this.publish({ accountIdentifier: null, status: JamConnectionStatus.Detached, session: null, failure: null });
  }

  createOrActivateSession(requestIdentifier: string): Promise<JamCommandResult> {
    const permissionFailure = () => this.snapshot.session !== null && !this.snapshot.session.ownedByCurrentAccount
      ? IntegrationFailureCode.Forbidden : null;
    return this.submit(requestIdentifier, CommandPolicy.createOperation, async ownership => {
      const failure = permissionFailure();
      if (failure !== null) throw new IntegrationFailure(failure);
      const response = await withCancellation(ownership.protocol.createOrActivate(ownership.cancellation.signal), ownership.cancellation.signal);
      if (ownership !== this.ownership) throw new IntegrationFailure(IntegrationFailureCode.Superseded);
      this.invitation = response.invitation === null ? null : Object.freeze({ ...response.invitation });
      const session = Object.freeze({ ...response.session, participants: Object.freeze(response.session.participants.map(participant => Object.freeze({ ...participant }))) });
      this.publish({ accountIdentifier: ownership.accountIdentifier, status: JamConnectionStatus.Ready, session, failure: null });
    }, false, permissionFailure);
  }

  endSession(requestIdentifier: string): Promise<JamCommandResult> {
    const expectedSessionIdentifier = this.snapshot.session?.identifier;
    return this.submit(requestIdentifier, CommandPolicy.endOperation, async ownership => {
      const session = this.snapshot.session;
      if (!session || session.identifier !== expectedSessionIdentifier) throw new IntegrationFailure(IntegrationFailureCode.Superseded);
      if (!session.ownedByCurrentAccount) throw new IntegrationFailure(IntegrationFailureCode.Forbidden);
      await withCancellation(ownership.protocol.end(session.identifier, ownership.cancellation.signal), ownership.cancellation.signal);
      if (ownership !== this.ownership) throw new IntegrationFailure(IntegrationFailureCode.Superseded);
      this.invitation = null;
      this.publish({ accountIdentifier: ownership.accountIdentifier, status: JamConnectionStatus.Ready, session: null, failure: null });
    });
  }

  joinSession(joinToken: string, mode: JamJoinMode, localDeviceIdentifier: string | null,
    requestIdentifier: string): Promise<JamCommandResult> {
    if (!joinToken.trim() || (mode !== JamJoinMode.Control && mode !== JamJoinMode.Remote)
      || (localDeviceIdentifier !== null && !localDeviceIdentifier.trim())) return Promise.resolve(this.rejected(IntegrationFailureCode.InvalidInput));
    const operation = JSON.stringify([CommandPolicy.joinOperation, joinToken, mode, localDeviceIdentifier]);
    return this.submit(requestIdentifier, operation, async ownership => {
      if (!this.experimentalMembership || !ownership.protocol.join) throw new IntegrationFailure(IntegrationFailureCode.Unsupported);
      if (this.snapshot.session !== null) throw new IntegrationFailure(IntegrationFailureCode.Forbidden);
      const response = await withCancellation(ownership.protocol.join(joinToken, mode, localDeviceIdentifier,
        ownership.cancellation.signal), ownership.cancellation.signal);
      if (ownership !== this.ownership) throw new IntegrationFailure(IntegrationFailureCode.Superseded);
      this.invitation = response.invitation === null ? null : Object.freeze({ ...response.invitation });
      const session = Object.freeze({ ...response.session,
        participants: Object.freeze(response.session.participants.map(participant => Object.freeze({ ...participant }))) });
      this.publish({ accountIdentifier: ownership.accountIdentifier, status: JamConnectionStatus.Ready, session, failure: null });
    });
  }

  leaveSession(requestIdentifier: string): Promise<JamCommandResult> {
    const expectedSessionIdentifier = this.snapshot.session?.identifier;
    return this.submit(requestIdentifier, CommandPolicy.leaveOperation, async ownership => {
      if (!this.experimentalMembership || !ownership.protocol.leave) throw new IntegrationFailure(IntegrationFailureCode.Unsupported);
      const session = this.snapshot.session;
      if (!session || session.identifier !== expectedSessionIdentifier) throw new IntegrationFailure(IntegrationFailureCode.Superseded);
      if (session.ownedByCurrentAccount) throw new IntegrationFailure(IntegrationFailureCode.Forbidden);
      await withCancellation(ownership.protocol.leave(session.identifier, ownership.cancellation.signal), ownership.cancellation.signal);
      if (ownership !== this.ownership) throw new IntegrationFailure(IntegrationFailureCode.Superseded);
      this.invitation = null;
      this.publish({ accountIdentifier: ownership.accountIdentifier, status: JamConnectionStatus.Ready, session: null, failure: null });
    });
  }

  addToQueue(spotifyTrackIdentifier: string, requestIdentifier: string): Promise<JamCommandResult> {
    try { validateSpotifyQueueTrack(spotifyTrackIdentifier); }
    catch { return Promise.resolve(this.rejected(IntegrationFailureCode.InvalidInput)); }
    const expectedSession = this.snapshot.session;
    const operation = JSON.stringify([CommandPolicy.addQueueOperation, spotifyTrackIdentifier]);
    return this.submit(requestIdentifier, operation, async ownership => {
      if (!ownership.queue) throw new IntegrationFailure(IntegrationFailureCode.Unsupported);
      if (ownership.queueOutcomeUnknown) throw new IntegrationFailure(IntegrationFailureCode.UnknownOutcome);
      const session = this.snapshot.session;
      if (!session || session.identifier !== expectedSession?.identifier
        || session.hostDeviceIdentifier !== expectedSession.hostDeviceIdentifier) throw new IntegrationFailure(IntegrationFailureCode.Superseded);
      if (!session.ownedByCurrentAccount) throw new IntegrationFailure(IntegrationFailureCode.Forbidden);
      if (!session.active || !session.hostDeviceIdentifier) throw new IntegrationFailure(IntegrationFailureCode.Unsupported);
      try {
        await withCancellation(ownership.queue.addToQueue(spotifyTrackIdentifier, session.hostDeviceIdentifier,
          ownership.cancellation.signal), ownership.cancellation.signal);
      } catch (failure) {
        if (failureCode(failure) === IntegrationFailureCode.UnknownOutcome) ownership.queueOutcomeUnknown = true;
        throw failure;
      }
      if (ownership !== this.ownership) throw new IntegrationFailure(IntegrationFailureCode.Superseded);
      this.publish({ ...this.snapshot, status: JamConnectionStatus.Ready, failure: null });
    });
  }

  getInvitation(): JamInvitation | null {
    if (this.snapshot.status !== JamConnectionStatus.Ready) return null;
    return this.invitation;
  }

  refreshSession(deviceIdentifier: string, requestIdentifier: string): Promise<JamCommandResult> {
    if (!deviceIdentifier.trim()) return Promise.resolve(this.rejected(IntegrationFailureCode.InvalidInput));
    const operation = JSON.stringify([CommandPolicy.refreshOperation, deviceIdentifier]);
    return this.submit(requestIdentifier, operation, async ownership => {
      if (!ownership.protocol.readCurrent) throw new IntegrationFailure(IntegrationFailureCode.Unsupported);
      const response = await withCancellation(ownership.protocol.readCurrent(deviceIdentifier, ownership.cancellation.signal), ownership.cancellation.signal);
      if (ownership !== this.ownership) throw new IntegrationFailure(IntegrationFailureCode.Superseded);
      this.invitation = response?.invitation ? Object.freeze({ ...response.invitation }) : null;
      const session = response ? Object.freeze({ ...response.session,
        participants: Object.freeze(response.session.participants.map(participant => Object.freeze({ ...participant }))) }) : null;
      this.publish({ accountIdentifier: ownership.accountIdentifier, status: JamConnectionStatus.Ready, session, failure: null });
    }, true);
  }

  refreshCurrentSession(requestIdentifier: string): Promise<JamCommandResult> {
    return this.submit(requestIdentifier, CommandPolicy.refreshCurrentOperation, async ownership => {
      if (!ownership.protocol.readCurrentAccount) throw new IntegrationFailure(IntegrationFailureCode.Unsupported);
      const response = await withCancellation(ownership.protocol.readCurrentAccount(ownership.cancellation.signal), ownership.cancellation.signal);
      if (ownership !== this.ownership) throw new IntegrationFailure(IntegrationFailureCode.Superseded);
      this.invitation = response?.invitation ? Object.freeze({ ...response.invitation }) : null;
      const session = response ? Object.freeze({ ...response.session,
        participants: Object.freeze(response.session.participants.map(participant => Object.freeze({ ...participant }))) }) : null;
      this.publish({ accountIdentifier: ownership.accountIdentifier, status: JamConnectionStatus.Ready, session, failure: null });
    }, true);
  }

  private submit(requestIdentifier: string, operation: string, command: (ownership: SessionOwnership) => Promise<void>,
    readOnly = false, permissionFailure?: () => IntegrationFailureCode | null): Promise<JamCommandResult> {
    const ownership = this.ownership;
    if (!requestIdentifier.trim()) return Promise.resolve(this.rejected(IntegrationFailureCode.InvalidInput));
    if (!ownership) return Promise.resolve(this.rejected(IntegrationFailureCode.Unauthorized));
    const previous = ownership.operations.get(requestIdentifier);
    if (previous) return previous.operation === operation ? previous.result : Promise.resolve(this.rejected(IntegrationFailureCode.InvalidInput));
    if (this.snapshot.status === JamConnectionStatus.Uncertain && !readOnly) return Promise.resolve(this.rejected(IntegrationFailureCode.UnknownOutcome));
    const permission = permissionFailure?.();
    if (permission !== undefined && permission !== null) return Promise.resolve(this.rejected(permission));
    if (ownership.pending >= CommandPolicy.maximumPendingCommands) return Promise.resolve(this.rejected(IntegrationFailureCode.Backpressure));
    ownership.pending += CommandPolicy.commandCount;
    const result = ownership.tail.then(async () => {
      if (ownership !== this.ownership) return this.rejected(IntegrationFailureCode.Superseded);
      if (this.snapshot.status === JamConnectionStatus.Uncertain && !readOnly) return this.rejected(IntegrationFailureCode.UnknownOutcome);
      const reconciliationRequired = this.snapshot.status === JamConnectionStatus.Uncertain;
      this.publish({ ...this.snapshot, status: JamConnectionStatus.Operating, failure: null });
      try {
        await command(ownership);
        return Object.freeze({ applied: true, failure: null });
      } catch (failure) {
        if (ownership !== this.ownership) return this.rejected(IntegrationFailureCode.Superseded);
        const code = failureCode(failure);
        this.publish({ ...this.snapshot, status: code === IntegrationFailureCode.UnknownOutcome || reconciliationRequired
          ? JamConnectionStatus.Uncertain : JamConnectionStatus.Failed, failure: code });
        return this.rejected(code);
      }
    }).finally(() => {
      ownership.pending -= CommandPolicy.commandCount;
      const completed = ownership.operations.get(requestIdentifier);
      if (completed) completed.completed = true;
      for (const [identifier, receipt] of ownership.operations) {
        if (ownership.operations.size <= CommandPolicy.completedRequestLimit) break;
        if (receipt.completed) ownership.operations.delete(identifier);
      }
    });
    ownership.operations.set(requestIdentifier, { operation, result, completed: false });
    ownership.tail = result;
    return result;
  }

  private rejected(failure: IntegrationFailureCode): JamCommandResult {
    return Object.freeze({ applied: false, failure });
  }

  private publish(snapshot: JamSnapshot): void {
    this.snapshot = Object.freeze(snapshot);
    for (const listener of [...this.listeners]) {
      if (!this.listeners.has(listener)) continue;
      try { listener(); } catch { try { this.onSubscriberFailure(); } catch {} }
    }
  }
}
