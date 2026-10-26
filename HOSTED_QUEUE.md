# Hosted Jam queue requests

The library can submit an item to an owned Jam's known Spotify host device using
the documented Web API. Enable `enableHostedQueue` in runtime dependencies, then
call `runtime.sessions.addToQueue(spotifyTrackIdentifier, requestIdentifier)`.
The track identifier must contain exactly 22 ASCII letters/digits. Translate a
local recording with the existing matcher first and resolve ambiguity before
submitting the selected Spotify identity.

This is a host-only request adapter. Guest queue routing and shared playback
synchronization are not implemented. Optional host-only account queue observation
is described in [HOSTED_QUEUE_OBSERVATION.md](HOSTED_QUEUE_OBSERVATION.md). The configured queue
capability describes available request functionality, not successful live Jam
propagation. `VerifiedJamCapabilities.queue` stays false by default.

## Actual request and prerequisites

The concrete adapter sends a state-changing POST to
`https://api.spotify.com/v1/me/player/queue`, with `uri=spotify:track:<identifier>`
and an explicit `device_id` obtained from the current session's
`hostActiveDeviceId`. It never falls back to an unrelated selected device or the
account's unspecified active queue. A caller can inject `JamQueueProtocol` in
runtime dependencies; queue operations remain disabled unless explicitly enabled.

Spotify documents Premium eligibility and the `user-modify-playback-state` OAuth
scope. Its empty HTTP 204 means the command was received. It does not establish
that another Jam participant observed the track or that audio started.
[Spotify's queue endpoint](https://developer.spotify.com/documentation/web-api/reference/add-to-queue)

The session must be owned, active and contain a nonempty host device identifier.
Creating a Jam alone does not guarantee a playable host. A controlled live probe
on 2026-10-22 created an owned active Jam whose host identifier was empty and host
device information absent. That Jam was deleted successfully without changing
the queue or playback. Sanitized local evidence is
`spotify-jam-research/evidence/hosted-queue-target-probe.json`.

Open Spotify and activate the intended host there, then refresh the Jam before
queue submission. This library does not transfer playback or start an official
Spotify endpoint merely to obtain a target. Rate limits, missing permissions and
unavailable playback devices remain typed failures. Earlier public profile,
device and catalog probes returned HTTP 429 for the research account. A different
OAuth client or future request is not assumed to bypass that limit.

## Ordering and uncertain outcomes

Queue requests share the bounded, serialized membership command coordinator.
Before sending, it rechecks session identity, ownership, active state and host
identity. Work queued behind end/session replacement cannot edit the former host.
Duplicate request identifiers share one submission and completed receipt; reuse
with another track fails. Account replacement/detachment aborts pending work and
rejects late completions without ending the remote Jam.

No queue mutation is automatically retried. Network failure, timeout, server
error or malformed success can mean Spotify received the item. An unknown queue
outcome blocks further queue submissions until explicit shared-state reconciliation
succeeds or the connection is replaced. Passive membership refresh cannot prove
queue contents and does not clear this queue fence. Supply sharedStateVerifier
and call sessions.reconcileSharedState with a new request identifier to verify
fresh owned membership, native shared state, and membership again. Reusing the
old mutation identifier still returns its old uncertain receipt; a later deliberate
queue intent requires a new identifier. See SHARED_STATE_RECONCILIATION.md.

## Private protocol findings and verification

The installed desktop adapter submits `ContextPlayer.AddToQueue` through native
Esperanto with a track URI, optional occurrence identity and logging parameters.
The binary also contains `connect-state/v1/player/command/from/`. These establish
candidate private command machinery, not a verified standalone HTTP command body,
guest addressing protocol or acknowledgement model. The pinned librespot source
models active Connect endpoint commands; it does not prove remote Jam following.
No guessed private queue route is shipped as working behavior.

`tests/hosted-queue.test.mjs` gives dedicated deterministic cases for the concrete
endpoint and encoding, validation, cancellation, rate/permission errors, unknown
outcomes, host decoding, ownership, missing hosts, replay/conflict, membership
ordering, changed targets, account changes, bounded work and runtime opt in.
No live queue mutation was performed. Mock acceptance, compilation and test
counts do not establish cross-account queue propagation or synchronized audio.
