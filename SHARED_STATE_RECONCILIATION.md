# Explicit shared-state reconciliation

Supply SpotifyJamDependencies.sharedStateVerifier, or the optional fifth argument
of JamSessionClient.attachAccount. sessions.capabilities.reconcileSharedState is
true only when both that verifier and account-current membership reading exist.
Construction sends no request. A capability indicates available implementation,
not live guest authorization or verified audio synchronization.

Call sessions.reconcileSharedState(requestIdentifier, cancellation?) explicitly.
The request uses the existing bounded serialized coordinator and remains available
while the snapshot is Uncertain. It reads fresh account membership, requires the
captured owned active session and host, calls the verifier with the immutable
account/session/authority identity, then reads and verifies membership again.
Success publishes the copied final membership and clears queue and playback
unknown-outcome fences. A failed, canceled, superseded, guest, inactive or changed
target cannot clear them. Cancellation restores the prior snapshot and fences
late results. Passive refresh retains its existing behavior and cannot clear
queue or playback fences.

SpotifyConnectSharedStateVerifier(observationPort, accountIdentifier) issues a
new account/host-bound observation read. The supplied port must produce freshly
validated native observations through decodeSpotifyConnectObservation; its request
boundary owns handle/generation and timing validation. The verifier rechecks host,
positive generation, nonempty actual queue revision, current occurrence identity
and agreement with playback occurrence. It does not manufacture revisions,
occurrences, counters, permissions or remote mutation receipts. Queue markers,
repeated tracks and raw next/previous entries retain their existing interpretation.

Recovery establishes a fresh shared-state baseline. It does not determine whether
an uncertain mutation was applied. Old requests retain their original receipts
within the existing bounded ownership window and are never replayed. After
successful recovery a deliberate later mutation requires a new request identifier.
A connection with no verifier remains fenced until replaced.

Dedicated tests: tests/shared-state-reconciliation.test.mjs covers 26 cases for
queue and playback uncertainty, simultaneous fences, retained receipts, passive
refresh, failures before/during/after verification, account/session/host changes,
permissions, cancellation at each asynchronous stage, serialized queued work,
deduplication, unsupported configurations, runtime forwarding and native checks.
These deterministic tests do not establish live guest participation, synchronized
local audio, background playback or device packaging.
