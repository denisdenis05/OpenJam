# Explicit shared-state recovery — 2026-10-26

npm test passed 612 cases across 28 files, including 26 dedicated cases in
tests/shared-state-reconciliation.test.mjs. The command includes source-standard
checks and strict TypeScript compilation. npm run check, npm run build and
git diff --check passed separately.

Recovery checks fresh owned account/session/host membership before and after an
injected native verifier. Tests establish queue/playback fence clearing only on
complete success, retained unknown receipts, unchanged passive refresh, failure
and identity fencing, queued ordering, duplicate/conflicting requests, capability
availability, runtime forwarding and cancellation at each asynchronous stage.
Native verifier cases check account/host binding, actual revision/current
occurrence, generation, cancellation and failed observations without retry.

This is deterministic library verification. No live interrupted-command recovery,
guest participation, synchronized audio, background lifecycle or physical-device
result is established by these cases. See SHARED_STATE_RECONCILIATION.md.

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

# Browser/device login validation — 2026-10-25

`npm test` passed 531 cases across 23 files, including 29 device-broker cases and
48 native-session/provider cases. Source checking and strict compilation passed.
Package dry-run reviewed 128 files; nothing was published. The 29 broker cases
also passed using the installed React Native URL polyfill implementations.

Mobile passed 261 service and 74 UI/platform cases, full TypeScript compilation,
320 player-mobile cases and seven player integration cases. Native validation
passed 19 Rust cases and actual host JNI execution, including malformed and
canceled bootstrap. Android's 23 JVM cases passed during release assembly.

The actual broker's live device-authorization request returned valid pairing
metadata. Its observer canceled before browser opening/token polling/native
bootstrap. No account was authenticated and no email was requested. This result
covers live initialization only. The reporting phone must verify completed
approval, canonical native bootstrap, restart/restore and private Jam admission.
Final APK bundling, signature, alignment and archive details are recorded in the
mobile progress file. No audible/guest/background result is claimed.

# Librespot authentication validation — 2026-10-25

`npm test` passed 496 cases across 22 files, including 42 independent-session
cases. Source checking and strict compilation passed. Package dry-run reviewed
124 files, including the new implementation, contracts and LIBRESPOT_AUTH.md;
nothing was published.

Mobile passed 249 service cases and 66 UI/platform cases, full TypeScript
compilation, 320 player-mobile cases and seven player integration cases.
Thirteen deterministic Rust tests cover native records, grant binding, capacity,
cancellation, unsupported verification and deadline behavior. A real host JVM
loaded the native library and passed JNI string/cancellation/release/error checks
without authenticating or submitting a network request. Android's 23 JVM tests
passed, including eight worker-runner regressions.

Forced release bundling, native Rust compilation, assembly, APK signature and
16 KB alignment checks passed. Archive verification found the ARM64 session
library, matching Gradle's stripped output, the new Hermes login code and license
assets. No physical Android device was connected. Live Login5 authentication,
OS storage behavior and private Jam admission remain unverified. These checks
are implementation/packaging evidence, not proof of successful Spotify login.

# Callback base comparison validation — 2026-10-24

`npm test` passed 454 deterministic cases across 21 files, including seven shared
redirect-comparison and 35 pending-authorization cases. Source checking and strict
compilation ran in that command. Package dry-run reviewed 117 files; nothing was
published. A transient old-module reproduction failed the new warm root-slash
regression with invalid-response, as expected; current-source tests pass.

Mobile passed 219 Node and 57 Jest cases and full TypeScript compilation. Native
packaging evidence is recorded in the mobile progress file. Actual callback shape
on the reporting phone and live OAuth remain unverified.

Android release bundling, native unit-test task, assembly and signature checks
passed. The unchanged callback-store and proof-key suites retain fifteen passing
cases. The ARM64-only archive contains a Hermes bundle with the shared redirect
comparison and specific diagnostic markers. No ADB device was connected; this is
packaging evidence, not proof of the reporting phone's callback or live OAuth.

# Android login recovery validation — 2026-10-24

`npm test` passed 444 deterministic cases across 20 files, including 32 pending
transaction cases. Source checking and strict compilation ran in that command.
Package dry-run and mobile/native results are recorded below and in the owning
mobile progress file. No physical callback delivery or real OAuth result is
claimed. The exact branch reported on the phone remains unobserved.

Package dry-run reviewed 115 files. Mobile passed 208 service and 50 UI/platform
cases, full TypeScript compilation, 320 player-mobile cases and seven integration
checks. Android release bundling, assembly and all three native proof tests passed.
The APK signature, ARM64 libraries and embedded Hermes recovery markers were
verified. No ADB device was available. See the mobile progress file for commands
and artifact details.

# Foreground host follower validation — 2026-10-24

`npm test` passed 412 deterministic cases across 19 files, including 41 shared
playback, 11 clock-mapping and 18 hosted-playback/runtime cases. Source checks and
strict compilation ran in that command. `npm pack --dry-run --json --cache
/tmp/spotify-jam-npm-cache` reviewed 113 files, including normalized contracts,
compiled playback implementations and both new playback documents. Nothing was
published. Native/mobile results are in their owning progress files.

These are deterministic source/host results. The account playback source is
implemented against the documented endpoint; no real OAuth client admission,
private guest stream, physical-device audio or measured alignment is claimed.
The live desktop debug endpoint was unavailable on recheck. No desktop playback,
queue or session was changed during this chapter.

# Saved login validation — 2026-10-23

Library npm test passed 342 deterministic cases across 16 files, including 28
saved-login cases. Source checking and strict compilation ran as part of that
command. The optional credential store, restore flow and storage ownership use
injected collaborators. Native OS storage execution and real OAuth admission are
separate device gates. Mobile native/package results are recorded in its own
progress file; no cross-account audio result is claimed.

Package dry-run review passed with 99 files, including saved-login implementation,
contracts and documentation. Tests, dependencies and removed experimental output
were excluded. Nothing was published.

# Membership observation validation — 2026-10-23

Library `npm test` passed 314 deterministic cases across 15 files, including
38 membership observation/cancellation cases. Passive cancellation retains prior
membership failure/status and does not abort remote writes; failed/rate-limited
polls pause and preserve stale receipt metadata. No live guest/push/device or
audio synchronization result is implied.

`npm run check`, `npm run build` and `git diff --check` also passed.

# Hosted queue observation validation — 2026-10-23

Library `npm test` passed 276 deterministic cases across 14 files, including
41 host-observation cases. Strict compilation/source checks, `npm run check`,
`npm run build` and `git diff --check` passed. The observation cases cover parser
bounds and metadata, before/after active-device checks, coalescing, private
account/session/host ownership, uncooperative cancellation, polling gates,
rate-limit backoff, initial host recovery and retained stale data.

No live public queue read, custom-client admission, guest synchronization or
physical-device result was established. Sequential host checks do not establish
an atomic authoritative Jam queue or allow unknown-write reconciliation.

# Login and hosted queue validation — 2026-10-23

Library `npm test` passed 214 deterministic cases across twelve files, including
23 login cases, 28 hosted-queue cases and the dedicated form-body transport case.
The command includes source checks and strict compilation. Mobile Spotify tests
passed 87 Node cases and 15 screen cases; full app TypeScript checking passed.
Android proof-key unit tests passed three cases. Final package dry-run review
passed with 74 files including login/queue implementations, contracts and docs.
The first dry-run hit a read-only default npm cache; the approved rerun used
`--cache /tmp/spotify-jam-npm-cache` and did not publish anything. Earlier chapter results follow.

No registered Spotify developer client ID was supplied. Real browser authorization,
private Jam access with OAuth credentials, live enqueue and shared queue
propagation remain unverified. The controlled host-field probe created/deleted
only its own temporary Jam, observed an empty host target and changed no queue or
playback. Native packaging does not establish device behavior.

# Validation

Experimental membership follow-up: `npm run check`, `npm test`, and
`npm run build` passed with 162 deterministic cases across ten files, including
30 membership cases and 16 account-current cases. `git diff --check` passed.
These tests use injected transports. Separately, a scoped account-current live
probe verified passive HTTP 200 JSON during an owned Jam and HTTP 404 when absent;
temporary creation/deletion succeeded and no native session remained. No live
guest admission, queue synchronization or audio playback result is claimed.
Earlier counts below describe the initial library chapter.

The mobile follow-up passed 65 Node feature/integration cases, 11 rendered-screen
cases, full app TypeScript, seven workspace player checks and 319 player-mobile
cases. Its real controller/gateway/library performed an owned Jam lifecycle on a
Node host. Private profile verification and two public short-invitation samples
passed. Public profile/device APIs returned 429. Android packaging is documented
in the mobile repository's SPOTIFY_JAM_APK.md; no physical-device execution or
guest admission result is claimed.

Executed on 2026-10-21. Host tools: Node.js 26.11.1, TypeScript 5.0.4,
.NET SDK 10.0.112 targeting the existing net9.0 server, and disposable
PostgreSQL 18.6. Dependency resolution is recorded in each owning lockfile.

Package review finished on 2026-10-22. `npm pack --dry-run --json` ran the
prepack build successfully and listed 58 files, including 52 compiled JavaScript
and declaration files. Core, contract, session protocol and React entry points
were present; tests and dependencies were excluded. No package was published.

| Check | Result |
| --- | --- |
| Library `npm run check` | Architecture checks and strict TypeScript passed |
| Library `npm test` | 116 deterministic cases across eight feature test files passed |
| Library `npm run build` | CommonJS output and declarations built |
| Mobile `npm run test:spotify` | Focused strict compilation and 12 cases passed |
| Mobile `./node_modules/.bin/tsc --noEmit --pretty false` | Full application type check passed |
| Mobile `npm run test:player-integration` | Seven existing player workspace integration cases passed |
| Server catalog filter with disposable PostgreSQL | All 12 cases passed, including two actual database cases |
| Android production JavaScript bundle | Passed; 19 asset files |
| iOS production JavaScript bundle | Passed; 15 asset files |

The server filter was:

```bash
dotnet test StreamingServiceServer.CoverTests --filter 'FullyQualifiedName~SpotifyRecordingCatalogTests' --no-restore --nologo
```

Its database fixture requires `COVER_TEST_POSTGRES` pointing at a disposable
Unix-socket PostgreSQL instance under `/tmp`. The run used
`/tmp/spotify-jam-postgres-socket`, port 55439, with the cluster data under
`/tmp/spotify-jam-postgres-data`. The cluster was started and stopped within the
same shell invocation. Separate tool invocations did not preserve its running
process; the first cross-invocation attempt failed to connect, then the combined
invocation passed. No application database was used.

JavaScript bundles were built with the mobile React Native CLI, platform
`android` or `ios`, entry point `index.js`, and `--dev false`. Outputs are under
`/tmp/spotify-jam-mobile-android` and `/tmp/spotify-jam-mobile-ios`. These checks
include the startup-imported Spotify composition boundary. They are not native
APK/IPA builds, device executions, or proofs of foreground/background behavior.

## Broader server suite

`dotnet test StreamingServiceServer.CoverTests --filter 'Category!=Postgres'
--no-restore --nologo` produced 148 passes, two skips, and one failure:
`AudioImportSafetyTests.ImportDestinationCannotEscapeMusicRootOrTraverseDirectoryLinks`.
It expects `InvalidDataException`; the unchanged `MusicLocationHelper` throws
`InvalidOperationException` for the invalid relative path before publication.
Neither that helper, import code, nor its test was edited for this work. The
full suite is therefore not green, despite the new catalog suite passing.
Existing server assembly-version/nullability warnings also remain.

## Live Spotify evidence

The actual public `SpotifyJamRuntime` performed this controlled cycle:

1. Passively refresh the current device and confirm no session is present.
2. Create/activate a session and observe ownership and invitation availability.
3. Passively refresh the created session.
4. End the session.
5. Passively refresh again and confirm no session remains.

All five command receipts reported applied. The HTTP implementation separately
received HTTP 200 for fresh creation/deletion. Passive status requires a matching
`device_broadcast_status.device_id`; missing/mismatched envelopes are rejected
rather than interpreted as an absent session.

Sanitized local research reports are in the workspace's
`spotify-jam-research/evidence/production-runtime-lifecycle.json` and
`production-library-probe.json`. Credentials stayed in the probing process's
memory and were supplied from the current user's desktop session. This verifies
the session protocol, not independent mobile credential acquisition.

A Spotify Web API catalog probe returned HTTP 429, so no successful live
catalog access or end-to-end real-catalog matching is claimed. The earlier
invitation-info request returned HTTP 404. No second-account join, pushed event
stream, real Android/iPhone scenario, or playback synchronization was verified.

The React selector cases exercise the production hook through a controlled hook
boundary. They are not mounted React Native screen tests. Source checks and
manual review supplement behavior tests and do not prove all SOLID or naming
requirements automatically.
