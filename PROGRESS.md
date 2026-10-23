# Hosted queue observation chapter — 2026-10-23

Added optional `runtime.hostedQueue`, immutable track/episode snapshots and a
public API reader that checks the owned active Jam's actual active device before
and after reading the account queue. Duplicate entries retain array order; no
stable occurrence identity, remote revision or atomic snapshot is invented.

Observation starts no constructor HTTP, coalesces refreshes and requires explicit
foreground observation plus an injected scheduler for polling. Background/hiding,
identity changes and disposal cancel pending work. Failures pause polling and
retain good data as stale; Retry-After remains enforced on manual/resume paths.
A later valid Jam/host can recover from initial absence. Host observation cannot
clear the unknown queue-write fence or enable guest queue/playback capabilities.

Validation: `npm test` passed 276 cases across 14 files, including 41 dedicated
host-observation cases. `npm run check`, `npm run build` and `git diff --check`
passed. No live observation, registered-client admission, physical-device or
shared playback result is claimed. See HOSTED_QUEUE_OBSERVATION.md.

# App recording selection chapter — 2026-10-23

User authorized all remaining development stages, one by one. Added
RecordingQueueCoordinator and runtime.recordingQueue: local catalog lookup,
Spotify candidates, explicit confirmation, then host queue submission. Matching
never queues automatically. Invalid/unavailable/conflicting choices and unknown
outcomes do not produce automatic retries. Captured account/session/host identity
is immutable and cleared on replacement; disposal retires asynchronous matching.
Cancellation stops lookup/confirmation before dispatch. Once an enqueue is sent,
the coordinator waits for its actual receipt and keeps submission busy even if
the caller cancels, so cancellation cannot imply that the remote write was undone.
Account/runtime retirement still discards the projection.

Dedicated tests: tests/recording-queue.test.mjs (21 cases). Full npm test passed
235 library cases across 13 files, with source checks and strict compilation.
Mobile adds the shared song-menu action, account-bound route metadata, a bounded
selection store and explicit candidate screen. Mobile validation counts are in
its progress file. No live catalog/queue/device result is claimed.

Authentication protocol research remains open: installed token acquisition crosses
native Login5; ordinary OAuth refresh tokens are not reusable native Login5
credentials. The current Spotify process has no debug listener. A single
non-disruptive launch attempt forwarded to the existing process without enabling
it; no process was killed and no playback/queue/session mutations occurred.
Research details and pinned primary references remain at
spotify-jam-research/PRIVATE_PROTOCOL_NEXT_BLOCKS.md outside the production package.

Continue with host queue observation and reconciliation before guest routing and
playback authority. DEVELOPMENT_SEQUENCE.md tracks all seven requested stages;
private OAuth admission and cross-account live gates remain pending.

# Browser login and hosted queue chapter — 2026-10-23

Added `SpotifyLoginProvider` and `SpotifyLoginSession`: injected PKCE proof/browser,
validated immutable client/callback/scopes, exact state/code checks, fixed HTTPS
code exchange, authenticated account resolution, in-memory credentials and shared
refresh-token renewal. Logout/cancellation reject uncooperative late collaborators;
refresh caller cancellation leaves other renewal callers intact. Mobile Android
provides SecureRandom/SHA-256 and opens Spotify through its existing browser.
No password collection or client secret is implemented. See LOGIN.md.

Added form-body transport support and dedicated forwarding coverage. Login has
23 dedicated tests; hosted queue has 28. Final `npm test` passed 214 cases across
12 files with source checking and strict compilation. Mobile passed 87 Node and
15 rendered-screen cases, full app TypeScript and three Android proof-key tests.
No registered client ID was supplied: real OAuth callback completion, private Jam
OAuth admission and host queue propagation remain unverified. The mobile APK
is the reviewable test vehicle, not evidence of device/runtime success.

The mobile flow exposes login → create/share (or experimental join) → host queue.
Existing translation and ambiguity handling precede queue submission for callers
using local catalog records. The personal-test screen accepts selected Spotify
track references. No shared player/audio bridge was added.

Resume: configure a registered public client ID and accepted callback; verify
login and private passive membership first, then owned create/share and known-host
queue on a device. Cross-account joins and queue observation require a second
controlled account. Do not substitute desktop credentials when OAuth fails.

# Spotify library progress

## Hosted queue request adapter

Added `JamQueueProtocol`, `SpotifyWebQueueProtocol`, optional host device decoding,
runtime `enableHostedQueue`/adapter injection and serialized `sessions.addToQueue`.
The adapter uses the documented account playback-queue POST with an explicit
actual Jam host. Guest/inactive/unknown-host targets are rejected. Unknown queue
outcomes retain an account-lifetime queue fence that membership refresh cannot
clear. Base verified queue capability remains false; enabled capability means
configured request availability. See HOSTED_QUEUE.md for prerequisites and limits.

Twenty-eight dedicated queue tests passed in the full library suite. A scoped
live host-field read confirmed that creating an owned active Jam can return an
empty host identifier; the temporary Jam was cleaned up. No live queue mutation
or guest propagation was tested. Final aggregate counts include concurrent login
work and are recorded by the coordinating chapter.

Updated 2026-10-22. The user approved the library plan and required the project's
streaming-service-quality skill for implementation. This repository is separate
from the player, mobile, and server repositories. No player engine was changed.

## Chapter 3 — mobile session testing support

After the protocol investigation, the user authorized mobile session controls and
an installable personal-test APK. The mobile repository now owns its Profile
entry, temporary-token connection, authenticated private profile lookup, safe
initial passive membership read, create/share/join/leave/end controls and public
short-invitation resolution. See its SPOTIFY_JAM_APK.md for use and build results.
This is session testing support; the playback bridge remains unimplemented.

Added opt-in `experimentalMembership` runtime composition, `JamJoinMode`, guarded
`joinSession` and `leaveSession`, and source-reconstructed HTTP POST adapters.
Default verified capabilities retain join/leave false. Experimental availability
does not claim cross-account admission or remote audio synchronization.

Join refuses an existing session; guest leave refuses owned sessions. Commands
reuse bounded pending/receipt storage, account cancellation, serialized execution,
duplicate/conflicting request handling and uncertain-outcome refresh fences.
Tests cover the membership-specific functionality in `tests/jam-membership.test.mjs`.
No live guest or playback probes were performed for this implementation.

Membership validation: `npm run check`, `npm test`, and `npm run build` passed.
The library now has 162 passing deterministic cases across ten test files,
including 30 dedicated membership cases and 16 account-current cases.
`git diff --check` passed. These are
host checks; guest admission and physical-device operation remain unverified.

Added `JamProtocol.readCurrentAccount` and `sessions.refreshCurrentSession` after
a scoped live probe verified `GET /social-connect/v2/sessions/current`: HTTP 200
direct session JSON during a temporary owned Jam, HTTP 404 before/after absence,
and successful deletion with no native session left. Sanitized local evidence is
`spotify-jam-research/evidence/mobile-current-session-probe.json`. No device API
or device identifier is needed for this passive refresh. Failure preserves the
unknown-outcome fence; successful absent/present reads reconcile it. Guest state
and playback synchronization remain unverified.

## Chapter 1 — library, catalog matching, and verified session lifecycle

Implemented the private `streaming-service-spotify-jam` package, strict compiler
and package tooling, project skill/instructions, public contracts, source checks,
and dedicated feature tests. React selectors live in a separate entry point.

The catalog layer accepts ID/title/author records and optional recording evidence.
Implemented MusicBrainz and caller-query adapters, the server projection adapter,
Spotify Web API catalog access, bidirectional matching, explicit ambiguity,
confirmation, fingerprint invalidation, many-to-many associations, market
isolation, and bounded defensive memory storage. Recording versions, conflicting
recording codes, and release-only artist credits veto automatic selections.

The session layer implements injected credential loading/renewal, guarded HTTP
execution, regional origin injection, fresh Jam creation, owned-session deletion,
and passive status for a selected Spotify device. Snapshots are copied and omit
credentials/invitations. Commands are ordered, bounded, locally deduplicated, and
fenced against old account completions. Unknown mutation outcomes prevent further
mutations until passive reconciliation succeeds. Detachment never ends a remote
shared Jam.

Added `SpotifyJamRuntime` composition and optional React selectors. The mobile
repository links/builds this package, loads its connection owner at startup,
clears ownership on logout/account changes, and passively refreshes a configured
Spotify device when the app resumes. The server repository owns the authenticated
read-only catalog query and its PostgreSQL tests.

Validation:

- Final package review on 2026-10-22: `npm pack --dry-run --json` passed its
  prepack build and included compiled core/contracts/React entries without tests
  or dependencies. No package was published.
- Library `npm run check`, `npm test`, `npm run build`: passed; 116 cases across
  architecture, association storage, matching, providers, session, networking,
  selector, and runtime suites. See FEATURES.md for functionality mapping.
- Mobile `npm run test:spotify`: passed strict focused compilation and 12 cases.
  Full application TypeScript checking and seven existing player-integration
  cases passed. Android/iOS production JavaScript bundles passed.
- Server catalog filter: 12 passed including two disposable PostgreSQL cases.
  Full non-PostgreSQL regression: 148 passed, two skipped, one untouched
  audio-import exception-type mismatch failed. See VALIDATION.md.
- Public production runtime: passive status, create, refresh, end, and passive
  status all applied against the current account. No Jam remained active.
- Live Spotify catalog access: HTTP 429; no success claimed. Invitation-info:
  earlier HTTP 404. Guest participation, live pushed observation, device runtime,
  and independent mobile authentication remain unverified.

## Chapter 2 — playback protocol research and proposed plan

On 2026-10-22 the user authorized investigation of playing together and an
additional agent. Applied the project skill and REA's bundled investigation
workflow. One agent independently reviewed the player bridge and pinned librespot
reference while the main agent inspected the installed client and ran probes.

Observed native playback/queue schemas, independent Dealer membership pushes,
and an independent inactive observer snapshot (HTTP 200, cleanup 204). The
snapshot was stale and differed from the installed client's paused/buffering
track. No remote listening, fresh cross-account playback stream or audible
synchronization is established. The temporary Jam was removed and the observers
did not change active playback. No production code or capability flag changed.

REA parsed four selected playback source excerpts without parse failures, with
unknown/partial semantic coverage. Native layout provider was unavailable; no
native decompilation claimed. Embedded protobuf descriptors were decoded by a
separate bounded extraction. Research scripts/probes are not production tests;
no library/device test or performance result is claimed for this docs chapter.

Read PLAYBACK_PROTOCOL_RESEARCH.md for evidence and limits, and
PLAYBACK_SYNC_PLAN.md for the proposed six-chapter implementation. The next gate
is controlled two-account admission and fresh state delivery. The plan awaits
user approval before implementation.

## Resume work

1. Obtain a second controlled account for guest validation. An asynchronous
   question was sent to the user; no second account was supplied during this
   implementation. Do not claim guest join/leave, invitation-info lookup or
   synchronized playback has been verified. Public short-link resolution was
   verified separately using controlled own-session share pages.
2. Validate the implemented PKCE login/renewal with a registered client ID.
   The mobile screen now opens browser authorization; no successful live OAuth
   callback or private Jam access with those credentials is established.
3. Resolve the info lookup failure and inspect the real session subscription
   connection/envelopes. Keep unsupported capability flags false until validated.
4. Validate real catalog access after rate limits permit and run cross-catalog
   examples using real candidates, preserving ambiguous results for selection.
5. Run actual Android/iOS foreground, account, cancellation and transport-policy
   scenarios. Native background execution and playback synchronization need
   separate designs. No performance improvements have been measured.

Record future chapters with exact functionality tests and live/device limits.
Keep credential material and extracted Spotify resources outside this repository.
Commit relevant changes only in their owning repository; do not push implicitly.
