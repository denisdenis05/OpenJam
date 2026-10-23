# Passive membership observation and recovery

Enable `enableMembershipObservation` and inject
`membershipRequestIdentifiers: () => string` when constructing the runtime.
`runtime.membership` exposes `getSnapshot`, `subscribe`, `refresh`, `setObserving`,
`setActive` and `dispose`. Missing request identity injection leaves observation
disabled; refresh then reports Unsupported without contacting Spotify.

Construction starts no HTTP. Manual foreground refresh works without a scheduler.
Automatic polling additionally requires an injected scheduler, an observing
consumer, foreground activity and an attached account. The named default interval
is 15 seconds. This is bounded passive polling, not a reconstructed push protocol.

## What the observer reads

Every attempt calls the verified passive account-current session endpoint through
`sessions.refreshCurrentSession`. It never creates, joins, leaves or ends a Jam
automatically. An absent Jam is a successful observed result with
`runtime.sessions.getSnapshot().session === null`; polling can therefore discover
a Jam later created on another device. Guest admission and cross-account live
freshness remain separate validation gates.

Membership details remain solely in `runtime.sessions`. Observation metadata
contains enabled/status, typed failure and `observedAtMilliseconds`. The timestamp
is local receipt time after a successful passive read, not a Spotify playback
anchor or proof of synchronized audio. A failed later read retains that receipt
as stale; a failed first read has no invented receipt.

Refreshes coalesce. Hiding the consumer, backgrounding, account replacement and
disposal cancel only the observer's passive work and discard late results. Resume
obtains a new snapshot before reporting ready. Disposing the observer does not
disconnect the account or end its shared session.

## Passive cancellation and write isolation

`sessions.refreshCurrentSession(requestIdentifier, cancellation?)` accepts an
individual cancellation signal in addition to its existing account lifetime.
A cancelled active passive read restores the exact prior membership snapshot,
including prior failure/status. It cannot turn an uncertain mutation into Ready.
Its late response cannot populate or clear membership.

A cancelled passive read queued behind a mutation returns its own cancelled
receipt promptly. It neither aborts that mutation nor restores an older snapshot
over the write. The queued work remains in the bounded coordinator until its
serialized position is retired; its protocol read is never invoked. This does
not add cancellation to already submitted remote queue/session writes.

Successful passive membership reconciliation can clear session mutation
uncertainty using the existing session rules. It cannot establish whether a queue
addition was received and never clears the separate unknown queue-write fence.

## Errors, rate limits and request identities

A read failure stops automatic polling. Explicit refresh or foreground/consumer
resume can recover. Valid Retry-After guidance is propagated on failed command
receipts through optional `retryAfterSeconds` and enforced before another read;
manual refresh does not bypass that deadline. Ordinary receipt shapes remain
unchanged when rate guidance is absent. No timer retries a 429 failure in a loop.

The injected request identity source must produce a new, nonempty identity for
each attempt. Completed command receipts are deduplicated, so reusing an old ID
could otherwise make a replay appear freshly observed. The observer rejects IDs
in its bounded recent window and validates their size before invoking the passive
command. The host owns uniqueness beyond this bounded check, including across
observer replacement within a retained session lifetime.

## Validation

`tests/membership-observation.test.mjs` covers individual passive cancellation,
prior Ready/Failed/Uncertain restoration, queued-write isolation, late responses,
rate receipts, constructor/network gates, coalescing, absent Jam polling, metadata
ownership, foreground recovery, stale/error behavior, identity validation/history,
account replacement, disposal and unknown-write fence preservation.

These are deterministic host tests. This chapter makes no live second-account,
native background, independent private-login or playback synchronization claim.
