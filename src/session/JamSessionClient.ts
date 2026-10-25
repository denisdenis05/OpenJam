import { IntegrationFailureCode } from '../../contracts/network';
import { JamConnectionStatus, JamJoinMode } from '../../contracts/session';
import type { ExternalStore, JamCapabilities, JamCommandResult, JamInvitation, JamProtocol, JamSnapshot } from '../../contracts/session';
import type { JamQueueProtocol } from '../../contracts/queue';
import type { HostedPlaybackCommand, HostedPlaybackCommandProtocol } from '../../contracts/hostedPlaybackCommands';
import { copyHostedPlaybackCommand } from '../playback/HostedPlaybackCommandValues';
import { checkCancellation, failureCode, IntegrationFailure } from '../network/IntegrationFailure';
import { combineCancellation, withCancellation } from '../network/Cancellation';
import { validateSpotifyQueueTrack } from './SpotifyQueueTrack';

export const VerifiedJamCapabilities: JamCapabilities = Object.freeze({
  createOrActivate: true, end: true, refresh: false, resolveInvitation: false, join: false, leave: false, observe: false, queue: false, playbackControl: false,
});
const CommandPolicy = Object.freeze({ maximumPendingCommands: 16, emptyCount: 0, commandCount: 1,
  completedRequestLimit: 64, firstPosition: 0, createOperation: 'create', endOperation: 'end', refreshOperation: 'refresh',
  joinOperation: 'join', leaveOperation: 'leave', refreshCurrentOperation: 'refresh-current', addQueueOperation: 'add-queue', playbackOperation: 'playback', minimumRetrySeconds: 0 });

interface SessionOwnership {
  readonly accountIdentifier: string;
  readonly protocol: JamProtocol;
  readonly cancellation: AbortController;
  readonly operations: Map<string, { readonly operation: string; readonly result: Promise<JamCommandResult>; completed: boolean }>;
  pending: number;
  tail: Promise<unknown>;
  readonly queue: JamQueueProtocol | null;
  queueOutcomeUnknown: boolean;
  readonly playback: HostedPlaybackCommandProtocol | null;
  playbackOutcomeUnknown: boolean;
}

export class JamSessionClient implements ExternalStore<JamSnapshot> {
  get capabilities(): JamCapabilities {
    return Object.freeze({ ...VerifiedJamCapabilities, refresh: this.ownership?.protocol.readCurrent !== undefined
      || this.ownership?.protocol.readCurrentAccount !== undefined,
      join: this.experimentalMembership && this.ownership?.protocol.join !== undefined,
      leave: this.experimentalMembership && this.ownership?.protocol.leave !== undefined,
      queue: this.ownership?.queue !== undefined && this.ownership.queue !== null,
      playbackControl: this.ownership?.playback !== undefined && this.ownership.playback !== null });
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

  attachAccount(accountIdentifier: string, protocol: JamProtocol, queue: JamQueueProtocol | null = null,
    playback: HostedPlaybackCommandProtocol | null = null): void {
    if (!accountIdentifier.trim()) throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
    this.detachAccount();
    this.ownership = { accountIdentifier, protocol, cancellation: new AbortController(), operations: new Map(),
      pending: CommandPolicy.emptyCount, tail: Promise.resolve(), queue, queueOutcomeUnknown: false, playback, playbackOutcomeUnknown: false };
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

  executeHostedPlayback(input: HostedPlaybackCommand, requestIdentifier: string): Promise<JamCommandResult> {
    let command: HostedPlaybackCommand;
    try { command = copyHostedPlaybackCommand(input); }
    catch { return Promise.resolve(this.rejected(IntegrationFailureCode.InvalidInput)); }
    const expected = this.snapshot;
    const currentTarget = () => this.snapshot.accountIdentifier === expected.accountIdentifier
      && this.snapshot.session?.identifier === expected.session?.identifier
      && this.snapshot.session?.hostDeviceIdentifier === expected.session?.hostDeviceIdentifier
      && this.snapshot.session?.active === expected.session?.active
      && this.snapshot.session?.ownedByCurrentAccount === expected.session?.ownedByCurrentAccount;
    const operation = JSON.stringify([CommandPolicy.playbackOperation, expected.session?.identifier, expected.session?.hostDeviceIdentifier, command]);
    return this.submit(requestIdentifier, operation, async ownership => {
      if (!ownership.playback) throw new IntegrationFailure(IntegrationFailureCode.Unsupported);
      if (ownership.playbackOutcomeUnknown) throw new IntegrationFailure(IntegrationFailureCode.UnknownOutcome);
      if (!currentTarget()) throw new IntegrationFailure(IntegrationFailureCode.Superseded);
      const session = this.snapshot.session;
      if (!session) throw new IntegrationFailure(IntegrationFailureCode.NotFound);
      if (!session.ownedByCurrentAccount) throw new IntegrationFailure(IntegrationFailureCode.Forbidden);
      if (!session.active || !session.hostDeviceIdentifier) throw new IntegrationFailure(IntegrationFailureCode.Unsupported);
      const membership = new AbortController();
      const scope = combineCancellation(ownership.cancellation.signal, membership.signal);
      const stop = this.subscribe(() => { if (!currentTarget()) membership.abort(); });
      try {
        await withCancellation(ownership.playback.execute(command, session.hostDeviceIdentifier, scope.signal), scope.signal);
        if (ownership !== this.ownership || !currentTarget()) throw new IntegrationFailure(IntegrationFailureCode.Superseded);
        this.publish({ ...this.snapshot, status: JamConnectionStatus.Ready, failure: null });
      } catch (failure) {
        if (ownership !== this.ownership || !currentTarget()) throw new IntegrationFailure(IntegrationFailureCode.Superseded);
        if (failureCode(failure) === IntegrationFailureCode.UnknownOutcome) ownership.playbackOutcomeUnknown = true;
        throw failure;
      } finally { stop(); scope.dispose(); }
    });
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

  refreshCurrentSession(requestIdentifier: string, cancellation?: AbortSignal): Promise<JamCommandResult> {
    return this.submit(requestIdentifier, CommandPolicy.refreshCurrentOperation, async ownership => {
      if (!ownership.protocol.readCurrentAccount) throw new IntegrationFailure(IntegrationFailureCode.Unsupported);
      const scope = combineCancellation(ownership.cancellation.signal, cancellation ?? ownership.cancellation.signal);
      try {
        checkCancellation(scope.signal);
        const response = await withCancellation(ownership.protocol.readCurrentAccount(scope.signal), scope.signal);
        checkCancellation(scope.signal);
        if (ownership !== this.ownership) throw new IntegrationFailure(IntegrationFailureCode.Superseded);
        this.invitation = response?.invitation ? Object.freeze({ ...response.invitation }) : null;
        const session = response ? Object.freeze({ ...response.session,
          participants: Object.freeze(response.session.participants.map(participant => Object.freeze({ ...participant }))) }) : null;
        this.publish({ accountIdentifier: ownership.accountIdentifier, status: JamConnectionStatus.Ready, session, failure: null });
      } finally { scope.dispose(); }
    }, true, undefined, cancellation);
  }

  private submit(requestIdentifier: string, operation: string, command: (ownership: SessionOwnership) => Promise<void>,
    readOnly = false, permissionFailure?: () => IntegrationFailureCode | null, passiveCancellation?: AbortSignal): Promise<JamCommandResult> {
    const ownership = this.ownership;
    if (!requestIdentifier.trim()) return Promise.resolve(this.rejected(IntegrationFailureCode.InvalidInput));
    if (!ownership) return Promise.resolve(this.rejected(IntegrationFailureCode.Unauthorized));
    const previous = ownership.operations.get(requestIdentifier);
    if (previous) return previous.operation === operation ? previous.result : Promise.resolve(this.rejected(IntegrationFailureCode.InvalidInput));
    if (passiveCancellation?.aborted) return Promise.resolve(this.rejected(IntegrationFailureCode.Canceled));
    if (this.snapshot.status === JamConnectionStatus.Uncertain && !readOnly) return Promise.resolve(this.rejected(IntegrationFailureCode.UnknownOutcome));
    const permission = permissionFailure?.();
    if (permission !== undefined && permission !== null) return Promise.resolve(this.rejected(permission));
    if (ownership.pending >= CommandPolicy.maximumPendingCommands) return Promise.resolve(this.rejected(IntegrationFailureCode.Backpressure));
    ownership.pending += CommandPolicy.commandCount;
    let started = false;
    const result = ownership.tail.then(async () => {
      started = true;
      if (ownership !== this.ownership) return this.rejected(IntegrationFailureCode.Superseded);
      if (passiveCancellation?.aborted) return this.rejected(IntegrationFailureCode.Canceled);
      if (this.snapshot.status === JamConnectionStatus.Uncertain && !readOnly) return this.rejected(IntegrationFailureCode.UnknownOutcome);
      const reconciliationRequired = this.snapshot.status === JamConnectionStatus.Uncertain;
      const priorSnapshot = this.snapshot;
      this.publish({ ...this.snapshot, status: JamConnectionStatus.Operating, failure: null });
      try {
        await command(ownership);
        return Object.freeze({ applied: true, failure: null });
      } catch (failure) {
        if (ownership !== this.ownership) return this.rejected(IntegrationFailureCode.Superseded);
        const code = failureCode(failure);
        if (code === IntegrationFailureCode.Superseded) {
          if (this.snapshot.session === priorSnapshot.session) this.publish(priorSnapshot);
          return this.rejected(code);
        }
        if (readOnly && code === IntegrationFailureCode.Canceled) {
          this.publish(priorSnapshot);
          return this.rejected(code);
        }
        this.publish({ ...this.snapshot, status: code === IntegrationFailureCode.UnknownOutcome || reconciliationRequired
          ? JamConnectionStatus.Uncertain : JamConnectionStatus.Failed, failure: code });
        return this.rejected(code, failure instanceof IntegrationFailure ? failure.retryAfterSeconds : undefined);
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
    const receipt = passiveCancellation === undefined ? result : this.passiveReceipt(result, passiveCancellation, () => started);
    ownership.operations.set(requestIdentifier, { operation, result: receipt, completed: false });
    ownership.tail = result;
    return receipt;
  }

  private passiveReceipt(result: Promise<JamCommandResult>, cancellation: AbortSignal, started: () => boolean): Promise<JamCommandResult> {
    return new Promise(resolve => {
      const abort = () => { if (!started()) resolve(this.rejected(IntegrationFailureCode.Canceled)); };
      cancellation.addEventListener(AbortEvent, abort, { once: true });
      void result.then(receipt => { cancellation.removeEventListener(AbortEvent, abort); resolve(receipt); },
        failure => { cancellation.removeEventListener(AbortEvent, abort); resolve(this.rejected(failureCode(failure))); });
      if (cancellation.aborted) abort();
    });
  }

  private rejected(failure: IntegrationFailureCode, retryAfterSeconds?: number): JamCommandResult {
    return Object.freeze({ applied: false, failure,
      ...(retryAfterSeconds !== undefined && Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= CommandPolicy.minimumRetrySeconds
        ? { retryAfterSeconds } : {}) });
  }

  private publish(snapshot: JamSnapshot): void {
    this.snapshot = Object.freeze(snapshot);
    for (const listener of [...this.listeners]) {
      if (!this.listeners.has(listener)) continue;
      try { listener(); } catch { try { this.onSubscriberFailure(); } catch {} }
    }
  }
}

const AbortEvent = 'abort';
