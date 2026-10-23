export interface JamQueueProtocol {
  addToQueue(spotifyTrackIdentifier: string, hostDeviceIdentifier: string, cancellation: AbortSignal): Promise<void>;
}
