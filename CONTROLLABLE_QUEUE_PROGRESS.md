# Controllable queue port — 2026-11-02

The package now accepts application-owned queue ports without importing an app or
player implementation. `ControllableQueuePort.read` captures actual scope,
revision, occurrence identities and current selection. `apply` receives expected
scope/revision and returns the actual accepted snapshot with its operation
identifier. Adapters must enforce compare-and-set at the actual mutation and
return real player occurrence identifiers; request acknowledgement alone is not
an accepted queue receipt. `complete: false` marks partial observations.

`QueueSynchronizationCoordinator` maps either direction through an injected
mapper, resolves current first and preserves source occurrence order and repeated
recordings. Missing current matches retain the working destination by rejecting
the mutation. Missing future matches and partial observations preserve known
destination entries. It rechecks both captured queues after mapping, issues one
CAS write, and suppresses only the exact acknowledged revision from echoing.
A later edit remains eligible even when an adapter retains its last operation
marker. Every new synchronization cancels its predecessor; a failed current match
cannot prevent a new selection or return to the same track. Actual Spotify rate
limit cooldown remains owned by the transport, not cleared by this coordinator.

The optional runtime `controllableQueues` dependency exposes
`queueSynchronization` and disposes it with the account lifetime. Applications may
also instantiate the exported coordinator directly. The package performs no
polling, creates no fabricated occurrences and makes no direct native calls.
Mobile owns actual player/native adapter composition and source change triggers.
The contract does not establish that those adapters are bound or that a live
participant queue mutation has succeeded.

Dedicated tests: `tests/controllable-queue.test.mjs` covers forward and reverse
mapping, duplicate occurrences, echo suppression, later edits, unknown futures,
current mismatch, source/destination scope and revision changes, cancellation,
supersession, partial observations, receipt validation, duplicate suppression,
malformed occurrence IDs, mapping identity contradictions, disposal, current
priority and failure recovery. `npm run build` and all 18 dedicated tests pass. `npm test` passed architecture
checks, TypeScript compilation and all 736 tests (zero failures).
Live queue equality, participant additions and playback transitions remain device
gates owned by the integration session.
