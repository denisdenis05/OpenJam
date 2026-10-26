import type { SharedPlaybackIdentity } from './sharedPlayback';

export interface JamSharedStateVerifier {
  verify(identity: SharedPlaybackIdentity, cancellation: AbortSignal): Promise<void>;
}
