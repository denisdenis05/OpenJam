# Browser-assisted email-code login — 2026-10-25

Implemented primary device authorization through Spotify's browser page. The
user can use email-code or another supported login method there; password login
remains optional. Pairing and email codes are distinct. The app's pending-device
credential is private, account-owned and secure; only public pairing metadata
reaches UI snapshots.

The library broker validates Spotify responses/verification URLs, persists before
browser opening, polls at the server interval, increases/persists slow_down delay,
checks expiry and handles denial, cancellation, malformed/transient responses and
native handoff. Pending approval resumes when the Jam screen is reopened after
restart. Token success consumes pending state before native bootstrap, with no
OAuth token saved. A failed/interrupted consumed handoff needs fresh sign-in.

The existing session provider now accepts password-free authorization/resume
strategies and shares native grant validation, durable storage and renewal. Native
bootstrap uses the fixed eligible desktop identity; saved restoration preserves
that identity or the existing platform password identity and rejects others.
The controller bypasses public profile gating and separates approval/bootstrap/
private Jam failures. All four namespaces retire together on cancel/forget.

Live initialization through the real broker succeeded; its observer canceled
before opening a browser, polling a token or authenticating an account. Local
validation and APK evidence are in VALIDATION.md and the mobile progress notes.
Completed live approval, native bootstrap and Jam admission remain phone gates.
No automatic cold-start navigation or direct in-app email-code entry is added.
Existing guest/playback/background limitations remain open.

# Independent Librespot authentication — 2026-10-25

Implemented LibrespotLoginSession behind injected native authentication, secure
storage and clock contracts. It consumes username/password once, validates native
canonical identity/token/expiry and saves only account plus opaque reusable
credential. Login/restoration wait for secure persistence; renewal is shared and
account-fenced. Rejected or malformed reusable credentials are erased, while
transient failures preserve them. Disposal preserves storage; explicit logout
retires memory and awaits forgetting. Progress observers cannot alter login.

The mobile app composes the provider with pinned librespot-core through Android
JNI, without the installed Spotify app, developer client ID or public /v1/me gate.
Native login uses Login5, access-point authentication and renewable stored
credentials. The account-owned Librespot namespace is separate from OAuth and
pending-browser namespaces. The primary screen clears its password after press,
restores saved native sessions first and distinguishes login from private Jam
rejection. Optional OAuth remains available. No playback engine was changed.

LIBRESPOT_AUTH.md records architecture, exact upstream revision, native packaging,
framework boundaries and remaining live gates. FEATURES.md maps dedicated tests.
Validation passed in VALIDATION.md and the mobile progress file. No physical
login, live private Jam admission or guest audio result is claimed. Independent
native authentication is implemented; its server acceptance needs the reporting
phone. Existing guest/shared/background protocol work remains open.

# Callback root path comparison — 2026-10-24

The reporting phone now shows redirect-mismatch after an automatic return. That
category did not identify scheme, host or path, and the actual received URI has
not been captured. An added root slash is a candidate, not a confirmed cause.

Added a shared parsed-address comparison used by login code extraction, mobile
browser capture and startup recovery. For a custom scheme with an authority,
only empty and root slash response paths compare equally. Scheme, authority
(including port) and nonroot paths remain exact. Network/file and opaque custom
addresses do not receive this compatibility rule. State, code, credentials and
fragment validation remain separate and unchanged.

The configured redirect string is never rewritten: authorization requests,
secure pending/saved configuration and token exchange retain it. The comparison
helper checks the callback base only; callers still validate the full response.
Mobile rejection messages now identify scheme-mismatch, host-mismatch or
path-mismatch without revealing callback values. The old generic status remains
available for compatibility.

Dedicated tests and results are in FEATURES.md and VALIDATION.md. The root-path
warm-login regression fails against the preceding login implementation, then
passes with the shared comparison. No physical login success is claimed.

# Android login return recovery — 2026-10-24

The reported symptom was browser sign-in returning to the same login form with
no error. A public client ID was supplied. The exact physical-device failure
branch has not been captured. Review found an Android browser dismissal/callback
race, stale Activity initial intents, process-local PKCE proof and screen remounts
that could replace authentication errors with an empty restore result.

Added optional secure pending authorization storage and resumeAuthorization.
Proof/configuration are saved before opening the browser, expire after ten
minutes and are consumed before exchange. Disposal preserves the transaction;
logout erases both transaction and saved grant. Foreign/stale callback rejection
preserves the current transaction. Codes and callback URLs are never persisted.
Public configuration lookup exposes neither proof nor credentials. Login stages
are observable without sensitive values.

Mobile owns Android callback capture, bounded dismissal recovery and cold-start
resume after app-account restoration. MainActivity updates its current intent
before forwarding onNewIntent. The Android adapter uses the custom tab directly;
iOS retains native openAuth. Pending proof and refresh grants use separate
account-owned Keychain services. Profile-only login no longer depends on private
service discovery. Failed login steps remain beside the button across remounts.

Dedicated mappings are in FEATURES.md and LOGIN.md. Validation is recorded in
VALIDATION.md and the mobile progress file. Real Spotify login, physical process
recreation and OS credential storage remain device checks. This chapter does not
establish private Jam admission or guest shared playback.

# Foreground host follower and native authority — 2026-10-24

Implemented a documented Web API playback reader bound to the actual owned Jam
host. Runtime reads reject unrelated devices/guests, late ownership changes and
unsupported media. A local monotonic request interval anchors progress; the
response's last-change Unix timestamp is metadata. Runtime local-recording
lookup uses the existing injected catalog with copying and sanitized failures.

Added SharedPlaybackSynchronizer with injected matching/output/clock/scheduler,
identity/sequence fences, paused preparation, latest-position application,
buffering/readiness, bounded freshness/uncertainty, drift correction, duration
hold, cancellation and acknowledged native release. Added bounded source-clock
exchange mapping; the host source uses request timing rather than assuming a
private clock exchange. Execution IDs and sequences are local fences.

The mobile action explicitly replaces the queue and follows only an owned host.
Matching is cached for the current track/country; unavailable choices hold audio.
App/Spotify account or Jam/host replacement and backgrounding stop following.
User pause suspends the native lease and ends following; cleanup remains pending
until acknowledgement. Native Android/iOS leases reject ordinary playback,
independent advance/modes and stale commands, and pause on a five-second native
renewal deadline. Expired leases can be reclaimed after JavaScript restart.

Dedicated mappings are in FEATURES.md, HOSTED_PLAYBACK.md and SHARED_PLAYBACK.md.
Final validation and package results follow in VALIDATION.md and the mobile
progress file. No live OAuth/client admission, cross-account guest playback,
physical OS storage, audible alignment or continuous background result is claimed.

Remaining implementation: private credential acquisition if OAuth is rejected;
verified guest queue/playback transport; shared permission/control routing;
authoritative unknown-write reconciliation; app-led Spotify hosting clock; and
continuous native background network/renewal. The installed debug endpoint was
rechecked and remains unavailable. No client ID or second controlled client was
supplied. No desktop process, queue or playback was changed for these checks.

Review regressions now cover malformed retired-scope events, failure followed by
late recording resolution, serialized compensation for dispatched play, replacement
accepted during unavailable notification, and reentrant attachment. Failed normal
work cannot resume playback or replace a failed snapshot. Native review preserves
request deduplication across authority changes while account reset still clears it.

# Saved login and iOS boundary chapter — 2026-10-23

Added optional account-owned secure credential persistence and restore to
SpotifyLoginSession. Saved records contain refresh grant/configuration/account,
not access tokens or proof material. Restore verifies account identity and saves
rotated refresh grants before a potentially rate-limited profile lookup. Logout
clears durable storage; dispose preserves it. Credential ownership serializes
writes/clears and rejects retired leases so older work cannot overwrite a newer
login. Public saved-configuration loading exposes no token.

The mobile app uses pinned react-native-keychain 10.0.0 with Android AES-GCM
Keystore and iOS device-only, noncloud Keychain options. Nonsecret revocation
metadata prevents restoring a login whose physical deletion failed. Cold app
account restoration preserves its saved login; actual logout removes it even
without an active Spotify connection. Pending deletion remains visible until
storage acknowledgement. iOS proof generation and callback registration are now
implemented, including actual Apple SDK Swift and Objective-C syntax checks.

Validation: npm test passed 342 cases across 16 files, including 28 saved-login
cases and the existing 23 browser-login cases. Mobile host/service/UI counts and
native packaging evidence are recorded in its progress file. Live OAuth/private
Jam admission, guest queue commands and synchronized playback remain unverified;
no tokens, passwords or cookies were acquired during this chapter.

Source implementation now covers matching, host queue, membership recovery
and saved/platform login. Fresh cross-account playback and
command-routing protocols remain unresolved; do not wire a native follower to an
invented queue revision or stale Connect snapshot. Required next evidence is a
registered OAuth client plus two controlled clients, with the installed desktop
client's debugging endpoint enabled. DEVELOPMENT_SEQUENCE.md retains those gates.

# Membership observation chapter — 2026-10-23

Added opt-in `runtime.membership` with metadata-only snapshots, injected request
identities, coalesced passive refresh, foreground/consumer polling gates, account
cancellation and error/Retry-After recovery. An absent Jam is a successful passive
result that can later detect a Jam from another device. No create/join/end action
is automatic. No constructor starts network work.

Account-current session refresh now accepts individual passive cancellation.
Cancellation restores the prior Ready/Failed/Uncertain snapshot, rejects late
updates and cannot cancel an earlier remote mutation. A queued cancelled passive
receipt resolves promptly while bounded serialized retirement remains intact.
Optional command retry guidance is retained only when supplied. Membership reads
never clear the separate unknown queue-write fence.

Validation: `npm test` passed 314 library cases across 15 files, including
38 dedicated membership-observation/passive-cancellation cases. `npm run check`,
`npm run build` and `git diff --check` passed. See
MEMBERSHIP_OBSERVATION.md. Guest admission, push events, physical-device lifecycle
and synchronized playback remain unverified.

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
