# Equivalent recording candidates across releases — 2026-11-02

The ranker now chooses its existing deterministic identifier representative when
all competitors inside the selection margin independently qualify and share the
same normalized full title, complete recording artist set, version and present,
exact candidate duration. Different release titles alone do not make equivalent
recordings ambiguous. Known normalized recording-code sets must agree pairwise;
missing codes cannot bridge conflicting known codes. All candidates remain in
the result. The default matching policy is now `recording-evidence-v2` so saved
confirmations from the previous matching policy require revalidation.

Different durations, including a one millisecond difference inside the normal
source tolerance, remain distinct. Missing duration, conflicting or partially
overlapping codes, unavailable candidates, release-only artist credits and source
version contradictions cannot be absorbed into an equivalent group. The ordinary
single-candidate and selection-margin behavior remains covered by the existing
catalog tests.

Verification: `npm test` passed architecture checks, TypeScript compilation and
668 cases across 32 test files. `node tests/catalog-equivalent-recordings.test.mjs`
passed all 12 dedicated regression cases. FEATURES.md maps these cases.

The owning mobile session observed native Partner search success and an ambiguous
match with three acceptable candidates before this change. That observation does
not establish exact recording equivalence. This chapter made no live Spotify
requests, changed no native session and built no APK. Actual candidate equivalence
and app-led hosting still require the mobile session's measured device check.

# Authoritative follower queue projection — 2026-10-31

Connect playback samples now carry the actual bounded upcoming occurrence queue.
Shared playback starts the matched current recording immediately, resolves future
recordings in the background and publishes supported matches in remote order.
Repeated tracks retain distinct real occurrences. Missing future recordings are
omitted; missing current recordings hold playback. Superseded matching is canceled
promptly even when a resolver ignores cancellation. Queue projection remains an
optional output capability; unsupported outputs fail explicitly for queue targets.
Future lookup errors retain current audio and expose pending state, unavailable
count and a sanitized queue failure; that projection performs no repeated future
lookup. Legacy playback readers provide current-only targets without fabricated
future identities. Mobile owns native background execution and player queue replacement;
its FOLLOWER_QUEUE_PROGRESS.md maps the source checks and device limitations.

Library `npm test` passed architecture checks, TypeScript and all 652 cases.
Dedicated shared-playback and observation suites passed 58 cases after
current-priority refinement. Mobile adapter/store checks passed 41 cases; the
owning session reported all app and Player JVM checks passing after preservation
changes. No live Spotify or device result is claimed by this implementation agent.

# Native guest commands, player integration and QR — 2026-10-31

Implemented an explicitly composed guestCommandVerifier path for queue append,
playback controls and uncertainty recovery. Browser/default consumers retain
owner guards. Fresh membership is checked before dispatch; the actual native
source restrictions and Spotify acknowledgements determine the result. Guest
recording selection reaches the same guarded session API, and uncertain requests
never replay. `npm test` passed all 643 cases; SHARED_CONTROL_PROGRESS.md and
FEATURES.md map the dedicated coverage.

Mobile composes the verifier only for native Connect, adds prompt/coalesced native
following from actual Dealer events, prepares host recording mappings before
player changes and publishes actual confirmed queue receipts. The Playing screen
now exposes sharing/following controls; QR invitations are generated locally with
stale-scope and privacy fences. Mobile owns these application changes and tests.

The requested queue explicitly includes player-level Jam integration and QR
connections. Physical-device verification remains postponed. Live catalog search
has not been proven successful; a fresh diagnostic probe awaits pairing. No
cross-account permission, audible alignment or physical scan result is claimed.

# Verified guest source integration — 2026-10-31

Implemented optional, fail-closed guest observation in the runtime and queue
observer. Native membership is verified before and after reads; projected guest
admission, account/Jam/host scope and cancellation remain required. Mobile binds
the actual Android membership bridge and supports explicit admitted-guest native
following. Guest writes remain denied because admission alone is not control
permission. Browser construction retains its previous owner-only behavior.

`npm test` passed 626 library cases, including dedicated before/after denial,
retirement and cancellation tests. GUEST_IMPLEMENTATION_PROGRESS.md and FEATURES.md
map the changes. Mobile checks and the new Profile/Settings build are recorded in
its progress files. Physical-device and cross-account verification are postponed
by the user; no new live Spotify request is evidence for this chapter.

# Mobile failure reporting and physical startup checkpoint — 2026-10-31

Mobile source `9cef510` preserves known hosting failure categories from React
Native Promise rejections and scoped snapshots, instead of collapsing them to
Network. Dedicated hosting tests passed 44 cases; the full Spotify run passed
487 Node and 105 Jest cases, plus full mobile TypeScript. Mobile `bff66d5` records
the updated, verified release APK. This library's source is unchanged.

Earlier physical checks on mobile e82ea20 passed installation, startup, rendered
Spotify Jam, restored native-connection status and creation of an owned Jam.
App-led hosting did not pass: an initial attempt displayed Unsupported, and
another after the user selected library audio displayed Network. Neither message
establishes a root cause. The newer error-reporting APK has not been installed.
The user now requests continuation without device access; do not treat earlier
source tests or registration as guest/audio/background acceptance.

Fresh approved host probe 52503 reached registration and passed native state and
metadata reads. Catalog search still returned Backpressure; HTTP status/cause are
unproven. Check actual owner liveness before reusing the socket or requesting
another pairing. No second Spotify account is available. Live catalog success,
guest permissions/shared playback, audible timing and Android background/reconnect/
renewal checks remain open. Current artifact details and resumption instructions
are in the mobile SPOTIFY_JAM_APK.md and SPOTIFY_NATIVE_FOLLOWER_HANDOFF.md.

# Integrated mobile hosting and packaged APK — 2026-10-31

Mobile source `e82ea20` now composes the retained host owner, real player and
native transport, scoped background authentication/recording tasks, explicit app
hosting controls, actual queue/epoch capture and exclusive following/hosting.
New local recordings use bounded background matching; audio pauses while matching
and Play afterward remains explicit. Native HTTP contention uses a bounded queue
and revalidates scope/authority at dispatch without repeating HTTP requests.

The ARM64 release APK is built and recorded in mobile SPOTIFY_JAM_APK.md:
35,886,828 bytes; SHA-256
`7bfcc1ea616f7c0275a811fd1204d30ee95e67501533c1583b6863057730afa0`.
Release assembly, v2 signature and 16 KB ZIP/native alignment checks passed.
Source verification passed 235 Rust, 409 Android JVM, 451 Spotify Node, 105 Jest,
329 player/mobile and 619 library cases, plus full app TypeScript. No library
implementation changed in this chapter; this is a documentation checkpoint.

No Android device is attached and installation, guest admission/permissions,
shared audio timing and physical background lifecycle remain unverified. A fresh
host read-only probe awaits new pairing; its earlier approved process had ended.
The earlier two live native catalog backpressure results remain failures; the
contention source fix is not proof of live permission or an HTTP diagnosis.
Mobile SPOTIFY_JAM_ACCEPTANCE.md lists the required actual-device scenarios.

# Native host source checkpoint and approved probe result — 2026-10-31

The user approved the native pairing. Read-only current-state and native metadata
checks succeeded. Two native public catalog searches returned the safe failure
`backpressure`; search availability is still unresolved. This does not establish
an HTTP status or whether actor occupancy or throttling caused the failure.
The probe owner disappeared across an interrupted turn. Its leftover socket is
not a registered session, and no Spotify process was stopped by implementation.

Mobile source chapters now include verified follower reconnect, bounded headless
app credential renewal, actual host queue projection, typed activation/publication,
receipt-based incoming command dispatch, native deadlines, periodic coordination,
queue-preserving host sessions and queue-independent native withdrawal. Latest
mobile source commit: `d25864d`. Runtime/application/module composition and explicit
JavaScript host controls still remain. Current native capabilities stay gated on
an actually attached command handler. No new APK was built before integration.

Verification in the mobile owner repository: full native Cargo suite 230 cases;
all Android app JVM suites 385 cases; Spotify JavaScript 433 Node and 99 Jest
cases; full TypeScript passed. These source checks do not prove live app hosting,
actual guest admission, shared audio timing or screen-lock/Doze/network behavior.
Second-account/device acceptance remains open. See mobile
SPOTIFY_INTEGRATION_PROGRESS.md and SPOTIFY_APP_HOSTING.md for feature mapping and
exact source commands. This library checkpoint changes documentation only.

# Native catalog search composition — 2026-10-30

Added optional account-bound `SpotifyConnectSearchPort`, bounded query capture,
strict generation/handle result decoding and native catalog routing. Native
search preserves explicit unplayability, rejects duplicate/unsafe results and
accepts verified empty results. Configured native search does not fall back to
the browser token route on permission failures. Browser-only callers retain
the supplied search catalog. Mobile composes this port through its JNI bridge.

Verification: `npm test` passed 619 deterministic cases, including seven dedicated
search cases in `tests/connect-search.test.mjs`; build and architecture checks
passed as part of the test command. Mobile passed 422 Node, 95 Jest and 103
focused Connect Android JVM cases; full mobile TypeScript passed. These are
source checks. Live current-session search permission still awaits approval of
the retained diagnostic pairing. No APK rebuilt yet; remaining host/background
source work comes before packaging.

# App action handoff to native following — 2026-10-30

Mobile `147eb76` routes device-sign-in following through the native Android
runtime. Browser sign-in retains foreground following. Startup waits for the
real native player lease, verifies the actual player epochs/authority, and
persists the app account/server/epoch ownership receipt before background
continuation. Scoped account, host and generation changes retire following;
local suspension requires explicit restart. Both previous playback authorities
must finish cleanup before another start. The native view handles matching
retained-session adoption and rejects stale startup or restoration completions.

Verification: mobile `npm run test:spotify` passed 413 Node and 95 Jest cases;
`npm run test:player-mobile` passed 329 cases; full mobile TypeScript passed;
focused Android Jam playback compilation and 22 JVM cases passed. Dedicated
mapping is in mobile `SPOTIFY_NATIVE_FOLLOWER_HANDOFF.md`; packaging is recorded
in mobile `SPOTIFY_JAM_APK.md`. No library runtime or player-engine selection
changed. These are source checks, with no new live session or phone evidence.

Next: verified same-Jam recovery across native reconnect generations, followed
by app-led hosting activation, accepted incoming actions and real state
publication. Guest permissions, audible synchronization, screen lock/network/
token renewal and process-death behavior remain open. A fresh approved native
probe is needed for the current-session catalog search check.

# Android background resolver and native search composition — 2026-10-30

Mobile commit `58e5aa4` integrates the application-owned Jam playback runtime,
native follower/player binding, bounded background recording broker and
React Native headless task registration. The native Rust catalog search and
app-led activation gate are included. Mobile commit `4ad6f5c` records the
release artifact and verification evidence; mobile APK size is 35,636,788 bytes
with SHA-256 `9aabd47ba313b7fbc4d9f15b31d54fe3f5089fb5337236fe1d1ecfb23be4ce71`.

Source verification passed: 67 focused Rust cases, 108 Android JVM cases,
364 mobile Node cases, 92 Jest cases, TypeScript checking and Android Metro
bundle generation. APK signature and 16 KB ZIP/native ELF alignment checks pass.
The native probe is no longer registered and `adb devices -l` found no device;
live catalog permission, installation, audible playback, guest role behavior,
hosting, reconnect and background lifecycle are not verified. Continue from
`IMPLEMENTATION_QUEUE.md` and `StreamingServiceMobile/SPOTIFY_INTEGRATION_PROGRESS.md`.
Do not treat the release APK or source tests as real-device evidence.

# Explicit shared-state recovery — 2026-10-26

Implemented an optional account-bound JamSharedStateVerifier and
sessions.reconcileSharedState(requestIdentifier, cancellation?). The serialized
read-only recovery works while Uncertain, verifies fresh owned active membership
before and after native shared-state verification, then clears both queue and
playback outcome fences. Passive membership refresh cannot clear those fences.
Old unknown mutation receipts remain stored and are never replayed. New deliberate
mutations require new request identifiers. Failure, cancellation and changed
account/session/host prevent recovery from clearing protections.

SpotifyConnectSharedStateVerifier requires a fresh validated observation for the
bound account and actual host, a real nonempty queue revision and current occurrence,
and matching playback occurrence. It preserves raw queue interpretation and does
not infer guest permission or fabricate remote identifiers. Runtime dependency
injection and the capability flag expose availability without performing a read
at construction. SHARED_STATE_RECONCILIATION.md records the contract.

Validation: npm run check and npm run build passed source checks and strict
TypeScript compilation. npm test passed 612 deterministic cases across 28 files,
including 26 new dedicated recovery/native verification cases. The cases cover
both uncertainty fences together, old receipt retention, passive protection,
failures and membership changes at each stage, queued ordering, deduplication,
account replacement, cancellation and ignored late native responses. git diff
--check passed. This chapter changes only the library and its documentation.

Mobile composition/UI and actual live interrupted-command recovery are separate
checks. Guest admission/permission, synchronized local audio, app-led hosting,
continuous background operation and physical-device behavior remain unfinished.
The implementation queue preserves the separately reported live same-account
command/append and server acknowledgement evidence. Continue the Android recovery
composition and live verification; do not replay a prior uncertain command.

# Live native queue reads and structural markers — 2026-10-26

The composed library observation decoder and private queue reader now pass a live
read against the independently registered session and a running official desktop
peer. One capture had 50 raw next entries, 48 displayed songs, three metadata
batches covering 49 songs including current, preserved occurrence order, and
71.739192 ms playback-read uncertainty. This is library/protocol verification,
not measured local audio synchronization or physical APK execution.

Live nextTracks contains spotify:meta entries and spotify:delimiter markers.
The raw observation must preserve those opaque Spotify entries; rejecting every
non-media URI incorrectly blocked a valid currently playing song. The displayed
queue now skips only these known structural marker types before metadata lookup.
Two reproducing cases bring the complete library suite to 586 cases.

Native pause/resume succeeded against the desktop host after correcting hidden
observer acknowledgement in mobile. A controlled append of the actual currently
playing Spotify song produced one new queue-provider occurrence and a changed
revision on the same host. Spotify replaced the supplied occurrence UUID, and
sessionCommandIdentifier did not echo the logging request UUID. Reconciliation
must use authoritative server occurrence IDs; client IDs are local intents.
Actual guest admission, local audio and app-led hosting remain open.

# Private metadata and revision-checked queue display — 2026-10-26

Native-login Spotify song lookup now uses the registered account's private
metadata port. Catalog search retains the existing search adapter. The library
checks exact returned identities and copies title/artists/duration/recording
codes; explicit not-found results become absent songs without lookup fallback.
Queue display resolves unique song IDs in batches of at most 20, preserving
repeated occurrence IDs, provider and revision. It rechecks host/generation,
queue revision and current occurrence after metadata lookup before publishing.
The existing display bound remains 100 next entries; raw observation has the
larger native queue. Episode metadata remains unsupported on this native path.

The complete library suite passes 584 cases. New connect-metadata cases cover
projection, bounds, lookup/search routing, missing songs, queue deduplication and
order, cancellation, revision changes, batch limits and preservation of optional
wire identities by hosted queue copying. Live native metadata succeeded for the
cached paused track: nonempty title, one artist, duration and one recording code.
No song details or identifiers are exported by diagnostic artifacts.

Live paused Spotify state reports playback speed zero. A reproducing case now
accepts zero speed only while not progressing; a zero-speed actively progressing
sample remains unsupported until actual protocol evidence supports it. Guest
admission, actual queue commands/audio, host publication and native background
playback remain open in IMPLEMENTATION_QUEUE.md. Mobile progress has live handle,
checks and packaging state; the goal remains active.

# Private playback observations — 2026-10-26

Added a typed native observation boundary and decoder. Each observation binds the
native handle, generation and actual active host; contains a fresh native request
interval; preserves raw queue order/provider/occurrence IDs and queue revision;
and derives playback position from Spotify server time and player anchor time.
JavaScript brackets the entire native request and retains uncertainty. Native and
JavaScript monotonic origins are never subtracted. Slow, malformed, superseded,
unsupported-speed and unidentified-occurrence samples cannot drive audio.

Runtime now accepts an injected playback reader. Native composition uses it,
while existing owned-membership guards remain. Samples can carry occurrence IDs
and buffering; the mobile follower preserves both. Repeated entries of the same
song now prepare separate executions without repeating the matching lookup.
Six new observation tests and one runtime injection case bring the library suite
to 573 cases. Mobile progress records native/Android/source checks and live clock
evidence. Active playback and second-account guest verification remain pending.

# Typed native command adapters — 2026-10-26

Added an injected account-bound Connect command port and native playback/append
adapters. Command inputs are copied and validated before dispatch. Queue intents
carry distinct occurrence identifiers, without claiming Spotify retains those IDs
or provides exactly-once delivery. The existing session coordinator still owns
membership/host-role checks, ordering, deduplication and uncertain-result fences.
Five new dedicated cases and the full 566-case library suite pass.

Mobile composes these adapters for native-login sessions. Kotlin reserves each
request before worker queuing, and Rust checks fresh active-host, restrictions,
seek-track and duration state before one mutation dispatch. Scoped cancellation
before dispatch prevents mutation; cancellation after dispatch reports uncertainty.
Native, Android and source-store tests cover retirement, capacity and stale work.
This is not yet verified guest queue permission or synchronized local audio.

The prior live observer processes have ended. A new interactive probe (85329)
registered successfully after browser approval; cached playback has no active
host yet. Waiting for Spotify playback before explicit native command tests.
The delivered APK still predates this chapter; a new bundle/assembly is required.

# Fresh native playback events observed — 2026-10-26

After user playback, the independently registered native observer received new
Dealer clusters with an active host, current timestamp anchors, pause/resume
transitions and an 80-entry queue with occurrence identities. This is transport
observation, not synchronized audio. Mobile built an observer-integration APK;
its progress file records the exact artifact and live process 79452. A second
account's Jam invitation is pending for guest admission testing. The next chapter
is typed native queue/playback command preflight and transport integration.

# Native credential handoff and Android connection ownership — 2026-10-26

Added an explicit immutable account/opaque-record handoff from LibrespotLoginSession.
It waits for acknowledged durable state and token renewal, and rejects canceled,
logged-out, disposed or stale work. The ordinary SpotifyCredentials result still
contains no reusable credential. Five dedicated handoff cases and the complete
561-case library suite pass.

Mobile now composes a native-owned Connect polling worker with bounded lifecycle
and command queues, account/generation fences and cleanup barriers. Joining in
control mode selects this app's verified native device; remote audio admission
remains blocked until playback handling exists. The UI separates connection
registration from login and Jam membership. Detailed mapping is in FEATURES.md.

Live browser approval and independent observer registration succeeded. Hidden
observers are absent from Cluster.device; the native adapter now confirms their
exact ID through Spotify's existing Jam device-status endpoint. Explicit refresh
also succeeds. Returned playback is cached and no active host is present; fresh
pushes, second-account joining, shared queue, synchronized audio and app-led host
publication remain open. The mobile live probe is still retained in memory;
read SPOTIFY_INTEGRATION_PROGRESS.md before requesting another approval.
This chapter does not complete IMPLEMENTATION_QUEUE.md; iOS remains deferred.

# Remaining-work queue active — 2026-10-25

IMPLEMENTATION_QUEUE.md tracks all five authorized Android/library tasks; iOS is
deferred. Native persistent Connect foundation is implemented and under Android
build/live validation in the mobile repository. It does not yet enable guest
playback or change this library's advertised capabilities. Native tests/JNI and
private probe tests pass; actual device registration awaits fresh browser
approval. See mobile SPOTIFY_INTEGRATION_PROGRESS.md and native
librespot-session/CONNECT_TRANSPORT.md for exact evidence and next steps.

# Owned-host playback controls and live Jam lifecycle — 2026-10-25

Implemented explicit Play/Pause/Next/Previous/Seek through the existing bounded
session command coordinator. The Web API adapter targets only the owned Jam's
actual active host and reads fresh playback before mutation. Seek binds the
expected track and rejects a position at/beyond duration; the public API cannot
make that preflight atomic with a later track transition. Guest calls remain
forbidden. No private guest command route or remote queue revision is invented.

Commands are copied, serialized with membership/enqueue, deduplicated by request
identity and target, and never replayed after an unknown outcome. Playback
uncertainty survives membership refresh until connection replacement. Target or
account replacement fences preparation and late results. Superseded queued work
now preserves the accepted replacement membership snapshot instead of failing it.

The mobile Jam screen includes explicit host controls, bounded seconds-based seek,
pending state and an uncertainty fence. Observed playback continues to update the
local follower; reflecting a remote target never sends another remote command.
A separate developer probe reuses the production native login/provider/runtime
and mobile regional resolver. It keeps credentials in memory/private child IPC,
projects only status and protects preexisting/replaced Jams from test cleanup.

Live verified after user browser approval: independent login, initial no-Jam
read, create, passive present/owned/active refresh, invitation generation and
restore. The created Jam had one participant and no host device. It remains open
for the requested second-account membership check at this checkpoint; current
mobile progress records the active probe/cleanup instructions. Live controls,
guest admission and synchronized audio have not been established.

Validation: npm test passed 556 cases across 24 files, including 19 dedicated
host-command cases and source/strict compilation checks. Mobile passed 273 Node
and 84 rendered/platform cases, including twelve command-store and eight control UI
cases; full app TypeScript passed. Developer probe tests passed 16 cases, native
example three, Rust/JNI host checks 39 and Android release/JVM 23. Forced Hermes
bundle/assembly and APK signature/alignment checks passed; mobile progress records
artifact details. No server/player runtime code changed.

Next: collect the second-account invitation outcome; verify host commands with
an actual active Spotify host; complete private guest state/queue/controls based
on captured successful requests. App-led hosting, continuous background transport
and native iOS Librespot login remain separate unfinished chapters.

# Phone sign-in confirmed by user — 2026-10-25

The user reports that sign-in works with the paired Login5 APK delivered in the
previous chapter. Record this as user-confirmed Android sign-in, not an observed
agent device test. Saved-session restore after restart, expiry renewal, private
Jam admission, guest queue propagation and synchronized playback were not
individually confirmed by that report. No runtime code or APK changed here.

# Live-tested paired Login5 exchange — 2026-10-25

The user approved desktop-browser pairing. Live native access-point connection
succeeded, but Keymaster returned HTTP 403 for both streaming alone and all five
scopes. Upstream Login5 succeeded on Linux. A dedicated stored-credential Login5
request without client-token succeeded with both Linux and Android-style user
agents. Production bootstrap and restore then succeeded using that same approved
session. This replaces the earlier, disproved Keymaster candidate fix.

Mobile native code now uses the dedicated request for paired desktop credentials;
password sessions retain upstream Login5. Account, client/device, token, expiry,
response/challenge bounds and hashcash context are validated. Injected HTTP,
clock and solver support deterministic tests. Transient errors and unsupported
verification retain their categories; no credential replay under another client
identity is introduced. Native reusable credential and pending schemas are
unchanged. No TypeScript runtime or bridge signature changes were required.

Thirteen dedicated native protocol tests cover request/header binding, successful
mint, wrong account, invalid token/expiry/response, server error categories,
transport failures, hashcash context/solutions, unsupported code challenges,
invalid challenges and request limits. Existing native routing/boundary and JNI
checks passed. Mobile research notes track the exact live evidence, APK and
remaining Android-device check. Public profile and private Jam access were not
verified by this experiment. Next: install the rebuilt APK and test a fresh
pairing and saved-session restore on the reporting phone.

# Pairing-to-native session follow-up — 2026-10-25

The reporting phone approved Spotify for Desktop pairing in the installed Spotify
app, returned manually and failed during native bootstrap. A redirect is not
part of device authorization. The old error combined access-point connection and
token minting, so it did not establish which native request Spotify rejected.

Desktop-authorized native sessions now mint tokens through Librespot Keymaster
instead of Login5. Desktop-bound restore/renewal uses the same route; Android
password sessions retain Login5. Pinned Librespot 99b6088 uses the overridden
desktop ID in Login5 but the platform Android ID in its client-token request.
Removing that combination addresses a plausible failure path, not a measured
explanation of the phone's server rejection. No cross-client fallback is used.

Pairing now requests the same five streaming/account/playback scopes as Keymaster.
Pending-device schema version 2 invalidates old streaming-only approval tickets;
explicit login replaces them, while resume fails before opening or polling them.
Native reusable-session and developer OAuth schemas stay unchanged.

Safe native-session-rejected and native-token-rejected codes distinguish permanent
access-point bootstrap and token-mint rejection. Structured Mercury 401/402/403
responses count as rejection, 429 as backpressure and other responses as network
failures; URI/payload/error text never reaches the UI. Transient classifications
are preserved. Unsupported verification keeps its existing classification and
saved-record recovery policy. Rejected saved records are erased. Dedicated tests cover routing,
no fallback, old-ticket replacement/resume, broker code preservation, provider
restore/renew cleanup, adapter propagation and rendered stage messages.

Validation: npm test passed 537 cases across 23 files with source checks and strict
compilation. Mobile passed 261 service and 76 UI/platform cases, full app
TypeScript, 26 Rust cases and actual host JNI execution. Android release APK
packaging and phone retesting are tracked in the mobile progress file.
Accountless live initialization with all five scopes returned HTTP 200, expiry
3599 seconds and interval 5 seconds; no user approval or native authentication
was attempted. Private Jam access remains unverified. Next: install the rebuilt
APK, begin a fresh pairing and check sign-in/restore and Jam admission on phone.

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

## Current-occurrence matching retry fence — 2026-11-01

Unavailable and ambiguous current-song matches now remain held across fresh
position observations, explicit reconciliation and upcoming-only queue changes.
Previously a new observation sequence restarted matching despite the unavailable
state having stopped its timer. A genuinely different current occurrence or an
explicit replacement attachment allows one new match. Contradictory track IDs
for the same occurrence still fail validation. Stale observations retain their
existing pause behavior and never authorize playback.

Two added fresh-observation regressions failed before the fix. Four dedicated
new cases in `tests/shared-playback.test.mjs` cover missing/ambiguous repeated
observations, new current occurrence and explicit attachment recovery. `npm test`
passed architecture checks, TypeScript and 656 cases. No live playback result is
established by these checks.
