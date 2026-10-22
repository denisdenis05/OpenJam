import { IntegrationFailureCode } from '../../contracts/network';
import { JamConnectionStatus } from '../../contracts/session';
import type { ExternalStore, JamCapabilities, JamCommandResult, JamInvitation, JamProtocol, JamSnapshot } from '../../contracts/session';
import { failureCode, IntegrationFailure } from '../network/IntegrationFailure';
import { withCancellation } from '../network/Cancellation';

export const VerifiedJamCapabilities: JamCapabilities = Object.freeze({
  createOrActivate: true, end: true, refresh: false, resolveInvitation: false, join: false, leave: false, observe: false, queue: false,
});
const CommandPolicy = Object.freeze({ maximumPendingCommands: 16, emptyCount: 0, commandCount: 1,
  completedRequestLimit: 64, firstPosition: 0, createOperation: 'create', endOperation: 'end', refreshOperation: 'refresh' });

interface SessionOwnership {
  readonly accountIdentifier: string;
  readonly protocol: JamProtocol;
  readonly cancellation: AbortController;
  readonly operations: Map<string, { readonly operation: string; readonly result: Promise<JamCommandResult>; completed: boolean }>;
  pending: number;
  tail: Promise<unknown>;
}

export class JamSessionClient implements ExternalStore<JamSnapshot> {
  get capabilities(): JamCapabilities {
    return Object.freeze({ ...VerifiedJamCapabilities, refresh: this.ownership?.protocol.readCurrent !== undefined });
  }
  private ownership: SessionOwnership | null = null;
  private invitation: JamInvitation | null = null;
  private snapshot: JamSnapshot = Object.freeze({ accountIdentifier: null, status: JamConnectionStatus.Detached, session: null, failure: null });
  private readonly listeners = new Set<() => void>();

  constructor(private readonly onSubscriberFailure: () => void = () => undefined) {}

  getSnapshot = (): JamSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  attachAccount(accountIdentifier: string, protocol: JamProtocol): void {
    if (!accountIdentifier.trim()) throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
    this.detachAccount();
    this.ownership = { accountIdentifier, protocol, cancellation: new AbortController(), operations: new Map(),
      pending: CommandPolicy.emptyCount, tail: Promise.resolve() };
    this.publish({ accountIdentifier, status: JamConnectionStatus.Ready, session: null, failure: null });
  }

  detachAccount(): void {
    this.ownership?.cancellation.abort();
    this.ownership = null;
    this.invitation = null;
    this.publish({ accountIdentifier: null, status: JamConnectionStatus.Detached, session: null, failure: null });
  }

  createOrActivateSession(requestIdentifier: string): Promise<JamCommandResult> {
    return this.submit(requestIdentifier, CommandPolicy.createOperation, async ownership => {
      const response = await withCancellation(ownership.protocol.createOrActivate(ownership.cancellation.signal), ownership.cancellation.signal);
      if (ownership !== this.ownership) throw new IntegrationFailure(IntegrationFailureCode.Superseded);
      this.invitation = response.invitation === null ? null : Object.freeze({ ...response.invitation });
      const session = Object.freeze({ ...response.session, participants: Object.freeze(response.session.participants.map(participant => Object.freeze({ ...participant }))) });
      this.publish({ accountIdentifier: ownership.accountIdentifier, status: JamConnectionStatus.Ready, session, failure: null });
    });
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

  private submit(requestIdentifier: string, operation: string, command: (ownership: SessionOwnership) => Promise<void>, readOnly = false): Promise<JamCommandResult> {
    const ownership = this.ownership;
    if (!requestIdentifier.trim()) return Promise.resolve(this.rejected(IntegrationFailureCode.InvalidInput));
    if (!ownership) return Promise.resolve(this.rejected(IntegrationFailureCode.Unauthorized));
    const previous = ownership.operations.get(requestIdentifier);
    if (previous) return previous.operation === operation ? previous.result : Promise.resolve(this.rejected(IntegrationFailureCode.InvalidInput));
    if (this.snapshot.status === JamConnectionStatus.Uncertain && !readOnly) return Promise.resolve(this.rejected(IntegrationFailureCode.UnknownOutcome));
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
