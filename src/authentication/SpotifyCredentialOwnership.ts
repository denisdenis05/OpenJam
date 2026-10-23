import type { SpotifyAccountCredentialStorage, SpotifyLoginCredentialStore } from '../../contracts/authentication';
import { IntegrationFailureCode } from '../../contracts/network';
import { checkCancellation, IntegrationFailure } from '../network/IntegrationFailure';

const MaximumAccountCharacters = 512;

export class SpotifyCredentialOwnership {
  private pending: Promise<unknown> = Promise.resolve();
  private lease: Readonly<{ accountIdentifier: string }> | null = null;

  constructor(private readonly storage: SpotifyAccountCredentialStorage) {}

  acquire(accountIdentifier: string): SpotifyLoginCredentialStore {
    this.validateAccount(accountIdentifier);
    const lease = Object.freeze({ accountIdentifier });
    this.lease = lease;
    return {
      read: async cancellation => {
        this.assertCurrent(lease, cancellation);
        return this.enqueue(async () => {
          this.assertCurrent(lease, cancellation);
          const serialized = await this.storage.read(accountIdentifier, cancellation);
          this.assertCurrent(lease, cancellation);
          return serialized;
        });
      },
      write: async (serialized, cancellation) => {
        this.assertCurrent(lease, cancellation);
        return this.enqueue(async () => {
          this.assertCurrent(lease, cancellation);
          await this.storage.write(accountIdentifier, serialized, cancellation);
          this.assertCurrent(lease, cancellation);
        });
      },
      clear: () => this.lease !== lease ? Promise.resolve() : this.enqueue(() => this.storage.clear(accountIdentifier)),
    };
  }

  forget(accountIdentifier: string): Promise<void> {
    this.validateAccount(accountIdentifier);
    if (this.lease?.accountIdentifier === accountIdentifier) this.lease = null;
    return this.enqueue(() => this.storage.clear(accountIdentifier));
  }

  retire(): void { this.lease = null; }

  private assertCurrent(lease: object, cancellation: AbortSignal): void {
    checkCancellation(cancellation);
    if (this.lease !== lease) throw new IntegrationFailure(IntegrationFailureCode.Superseded);
  }

  private validateAccount(accountIdentifier: string): void {
    if (!accountIdentifier.trim() || accountIdentifier.length > MaximumAccountCharacters) throw new IntegrationFailure(IntegrationFailureCode.InvalidInput);
  }

  private enqueue<Value>(operation: () => Promise<Value>): Promise<Value> {
    const result = this.pending.then(operation).catch(failure => {
      throw failure instanceof IntegrationFailure ? failure : new IntegrationFailure(IntegrationFailureCode.CredentialStorage);
    });
    this.pending = result.catch(() => undefined);
    return result;
  }
}
