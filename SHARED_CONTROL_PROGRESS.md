# Explicit native guest commands — 2026-10-31

JamSessionClient and runtime accept an explicitly injected guestCommandVerifier.
Default/browser composition retains owner guards. Native-only composition verifies
fresh account/Jam/host membership immediately before deliberate queue append or
playback dispatch. The actual native command preflight reads current restrictions:
disallowRemoteControlReasons and the specific resume/pause/next/previous/seek/append
restriction. Spotify command and Dealer acknowledgements remain the final outcome.
Admission alone does not grant control, and no mutation is retried.

Explicit guest reconciliation rechecks fresh native membership before and after shared-state verification and never replays an uncertain request.

Queue and playback preserve serialized requests, duplicate receipts and separate
unknown-outcome fences. Account, Jam, host, role and projected admission changes
cancel preparation. RecordingQueueCoordinator now allows explicitly composed guest
requests to reach the guarded session client. guestCommandsAvailable describes the
availability of this native command path; it is not a cached Spotify permission.

Dedicated coverage: tests/guest-commands.test.mjs has sixteen cases for queue and
playback default denial, fresh verification, denial, retirement, uncertainty,
deduplication, native rejection and explicit guest uncertainty recovery. tests/recording-queue.test.mjs adds the explicit
guest recording-selection path. `npm test` passed all 643 library cases, including
architecture checks and TypeScript build. Log: /tmp/jam-shared-controls-library-tests.log.

Actual native command support remains resume, pause, next, previous, seek and
append. Arbitrary select/play, queue replacement/reordering and fabricated remote
occurrence IDs are not implemented. Cross-account acceptance, permission changes,
local audio timing and physical lifecycle remain unverified. Mobile verification
is postponed by the user. No device, pairing or live mutation was attempted.
