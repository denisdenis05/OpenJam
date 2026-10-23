# Observing the host's Spotify queue

Enable the runtime dependency `enableHostedQueueObservation` to use
`runtime.hostedQueue`. Construction performs no HTTP requests. The separate
`hostedQueueReader` dependency can replace the concrete reader, and `scheduler`
enables foreground polling when supplied.

The public store exposes `getSnapshot`, `subscribe`, `refresh`, `setObserving`,
`setActive` and `dispose`. Observation is disabled by default. Manual refresh is
available while enabled and foreground even without polling or subscribers.
Polling requires both `setObserving(true)` and `setActive(true)` plus a scheduler.
The default interval is a named 15-second policy; it is not a synchronization or
performance guarantee. Hiding the consumer or backgrounding aborts pending reads
and cancels timers. Existing results become stale and retain their original
receipt time. Resume rereads only when observation is enabled and selected.

## Scope and correlation

The concrete reader uses the documented playback-state and account queue APIs.
It reads playback state, then queue, then playback state again. Both device checks
must identify the active Spotify device as the current owned Jam host. Missing,
inactive, unavailable or mismatched endpoints are rejected. Guest sessions and
Jams without a known active host cannot use this feature.

Request OAuth scopes appropriate to the two endpoints. The login flow includes
`user-read-playback-state` and `user-read-currently-playing` for observation.
[Spotify playback state](https://developer.spotify.com/documentation/web-api/reference/get-information-about-the-users-current-playback),
[Spotify account queue](https://developer.spotify.com/documentation/web-api/reference/get-queue)

These sequential reads do not form an atomic snapshot. A device could switch and
switch back between requests; the queue can change while being read. The public
account queue has no guaranteed stable occurrence identities or Jam revision.
The library preserves duplicate entries and order in an array and invents none.
It cannot use this response to settle an unknown enqueue result or clear the
write fence. Membership identity and matching device IDs do not establish remote
guest delivery or synchronized audio.

## Snapshot behavior

Snapshots contain enabled/status, session and host identity, currently playing
item, entries, local receipt time and typed failure. Item fields are URI, title,
author, track/episode kind and nullable duration. Track artists are retained in
their supplied order; episodes display their publisher or supplied show name.
Unknown item kinds, incompatible URIs, invalid metadata and arrays above the
named item bound fail explicitly instead of dropping items silently.

`observedAtMilliseconds` comes from the injected local clock after the reads and
validation. It is receipt metadata, not a server playback anchor or proof of
current audible position. No playback position, authoritative queue revision,
remote clock estimate or stable occurrence ID is created by this feature.

Refreshes coalesce. Account, session or host replacement cancels pending reads,
discards late results and clears prior data, including when replacement reuses
the same session/host strings on another account. Responses are defensively
copied and frozen. An unavailable first read is failed; failure after a good read
retains that result as stale.

A read failure stops automatic polling. Explicit refresh or foreground/consumer
resume can retry. A genuinely new valid Jam/host can start observation after an
initial missing-session/host failure. Retry-After deadlines are retained across
those resumes and identity changes; manual refresh does not bypass them. There
is no automatic 429 loop. Disposal clears data, timers and subscriptions without
ending the Jam or changing Spotify playback.

## Validation and remaining gaps

`tests/hosted-queue-observation.test.mjs` contains dedicated cases for wire
decoding, duplicate order, episodes, bounds, host checks, disabled/guest/missing
targets, coalescing, immutable snapshots, failures, rate guidance, reentrancy,
account/session changes, cancellation, foreground polling and disposal.

No live account queue read, registered-client OAuth admission, guest behavior,
physical-device execution or audio synchronization was established by this
chapter. Earlier public APIs returned 429 for the research account. Private
protocol investigation still has its explicit freshness/admission gates.
