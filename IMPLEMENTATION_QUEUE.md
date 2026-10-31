# Spotify Jam implementation queue

User instruction 2026-10-25: implement the remaining Android/library functionality
and continue until it works end to end. iOS native login is deferred. This queue
is the active work list; chapter commits and APKs do not end the objective.
Working paired Login5 authentication, catalog translation, the current local
player and owned-host control guards are preserved.

| Order | Work | Status | Completion evidence |
| --- | --- | --- | --- |
| 1 | Persistent native AP/Dealer connection, Connect device registration, reliable guest join/leave, permissions and recovery | In progress: native transport/Android ownership implemented; hidden observer registration live verified; guest admission pending | Independently registered device; successful second-account control/remote admission; leave/kick/reconnect/role changes reflected correctly |
| 2 | Guest shared queue commands, occurrence identities, ordering and uncertain/competing edit reconciliation | In progress: native-only verified guest append/playback and recovery implemented in source; same-account native controls/append live confirmed with server Dealer acknowledgements; private metadata/queue reads live checked; explicit library/mobile uncertainty recovery implemented and packaged; live recovery and guest permission remain | Accepted guest mutations correlated with observed host/guest queue updates; repeated tracks and interrupted receipts handled without duplicate edits |
| 3 | Fresh guest playback events, local-media synchronization, permitted remote controls and reconnect | In progress: bounded private reads, foreground following and explicit Android native following handoff are wired; verified native reconnect implemented in source; guest audio/timing remain | Track changes, pause/resume, seek and skip work across accounts; simultaneous local/Spotify audio checked and timing measured |
| 4 | App-led hosting and publication of local track/position/queue state | In progress: retained application/module/task composition, explicit JS controls, actual queue capture/publication and background matching integrated and packaged; live hosting remains | Spotify participant follows the app's playback authority using app catalog audio; incoming controls are acknowledged after accepted player actions |
| 5 | Native Android foreground transport, playback coordination, renewal and lifecycle recovery | In progress: application-owned connection, native follower, headless resolver, app controls and verified player-epoch ownership receipt integrated; background continuation requires acknowledged native ownership | Screen lock/background/network interruption/renewal tested without JavaScript screen polling or stale-account playback |
| 6 | iOS native Librespot login/integration | Deferred by user | Outside current objective |
| 7 | Jam integration in the player and prompt bidirectional queue updates | Source implemented: real host mapping preparation/publication, guarded player controls and coalesced native following | Actual local song changes reach Spotify participants, remote changes update local audio/queue, and latency is measured |
| 8 | QR invitation connections | Source implemented: offline bounded QR generation for actual scoped Spotify invitations with accessible share/text alternatives | Physical scan, actual joining and stale-invitation retirement are exercised across accounts |

## Current requested implementation — player and QR connections

- Diagnose live catalog-search backpressure and implement reliable supported search.
- Complete permission-backed native guest queue/playback commands while keeping
  browser and denied-role guards intact.
- Complete app-led host activation/publication, actual shared-queue updates and
  source-level background/reconnect/renewal lifecycle handling.
- Integrate Jam controls into the player: while hosting, another selected local
  recording updates Spotify participants; remote changes promptly update local
  playback/queue. Preload known mappings, preserve actual occurrences and user
  intent, and avoid teardown/restart loops or uncertain command replay.
- Research and implement local QR generation for actual scoped Jam invitation
  links, with accessible sharing/join alternatives and stale-invitation retirement.
- Package integrated source after deterministic checks. Physical-device audio,
  measured alignment and second-account acceptance remain postponed/unverified.

## Verified guest reads and in-app settings — 2026-10-31

Native-only guest queue/playback reads now require fresh membership verification
before and after the read and actual projected admission. Explicit guest native
following is integrated with the same verified source. Guest writes remain
permission-gated. Mobile also integrates the approved Profile/Settings hierarchy
and further host cleanup, queue capture and startup acknowledgement fixes.
Library source tests pass 626 cases. Actual guest admission/control permissions,
catalog backpressure, audible alignment and background device acceptance remain
unverified; mobile verification is postponed, not treated as passed.

## Current acceptance and device-free source continuation — 2026-10-31

Mobile `9cef510` fixes safe native hosting failure propagation; `bff66d5` records
the updated APK, which has not been installed. Physical e82ea20 installation,
React UI, restored Spotify connection and owned-Jam creation passed. App-led
hosting failed with Unsupported before selecting library audio and a generic
Network afterward; the exact cause remains unknown. Fresh approved probe state/
metadata reads passed, but search returned Backpressure. The user now requests
continuation without the device; no second account is available. Preserve live
sessions and keep guest/audio/background acceptance open. See mobile progress
notes for source test results and the artifact checksum.

## Integrated source and APK checkpoint — 2026-10-31

Mobile source `e82ea20` integrates the app hosting action, retained runtime, native
module/headless routing, real queue capture and background reverse matching.
Release artifact, source commands and checksum are in mobile SPOTIFY_JAM_APK.md.
Source checks passed: 235 Rust, 409 JVM, 451 Node, 105 Jest, 329 player/mobile,
619 library and full mobile TypeScript. Installation and actual guest/device
acceptance remain open as listed in mobile SPOTIFY_JAM_ACCEPTANCE.md. Native
catalog permission is unresolved; a new read-only probe is awaiting fresh pairing.

## Latest host source checkpoint — 2026-10-31

Mobile `d25864d` contains source-tested host command handling, periodic actual
player publication, queue-preserving native session lifecycle and withdrawal that
needs no song mappings. Application runtime, module/headless routing, explicit JS
hosting controls and background reverse mapping remain. Native follower reconnect
and bounded app credential renewal are implemented in source; physical lifecycle
acceptance is still pending. The approved read-only native catalog search returned
backpressure twice; do not claim successful search or an HTTP status. Its probe
owner is now absent. Source verification: 230 Rust, 385 Android JVM, 433 Node and
99 Jest cases; full mobile TypeScript passed. No new APK or live hosting result.

## Native and headless source checkpoint — 2026-10-30

The mobile repository now contains the bounded native public catalog-search path,
application-owned follower runtime, Android background recording broker and
React Native headless task registration. Dedicated Rust/JVM/JS source checks pass;
the ARM64 release APK is recorded in `StreamingServiceMobile/SPOTIFY_JAM_APK.md`.
The current-session search probe was absent and there was no attached Android
device, so neither live search permission nor runtime behavior has been validated.

Remaining acceptance is unchanged: live second-account admission and permissions,
shared queue reconciliation, synchronized local audio and timing, app-led host
activation with real state publication, same-Jam reconnect recovery, and screen-
lock/network/token-renewal/background playback lifecycle. Do not mark those items
complete from compilation, packaging, or the previous same-account command tests.

## Execution rules

Complete independent implementation while live account/device input is pending.
Request needed clicks or second-account help concisely and continue other work.
Do not mark a queue item complete from unit tests, static protocol strings,
registration acknowledgements or membership alone. Preserve remote wire ordering
and actual clock domains; never invent a guest playback source or permissions.
The final acceptance pass covers installation, login/restore, both membership
roles, queue operations, both playback directions and Android background behavior.

## Current dependencies

The persistent native AP/Dealer transport, hidden observer registration and
Android bridge are implemented. Same-account native commands, server-correlated
acknowledgements, metadata and composed queue reads have live desktop-peer
evidence. The delivered receipt/recovery APK is recorded in mobile
SPOTIFY_JAM_APK.md. None of that proves cross-account permission or local audio.
The previous diagnostic process is no longer reachable, so fresh live work needs
an actual new owner rather than relying on an old pairing message or socket file.

A different account's Jam invitation remains needed to establish guest admission,
permission and remote playback behavior. Continue independent native ownership,
resolution and hosting implementation while awaiting that help. Application
ownership must survive React recreation with account/device-safe reattachment;
continuous background audio additionally requires a native follower, fresh clock
mapping, unseen-track resolution and StreamingService credential renewal.

Reuse dedicated stored-credential Login5 without the incompatible client-token
path. Renew a rejected safe-read token at most once; never automatically repeat
a queue/playback mutation. Keep actual observer registration, audible player
registration and app-led state publication distinct. Playback-ready registration
remains disabled until the existing local player accepts incoming actions and
publishes real state. Do not remove the background follower-stop protection
merely because a Dealer connection survives React detachment.

See mobile SPOTIFY_INTEGRATION_PROGRESS.md for concrete build/probe checkpoints
and library FEATURES.md for each feature's dedicated tests.

## Native integration continuation — 2026-10-27

The next implementation chapter composes the tested native follower with the
actual service binding and a complete recording resolver. Resolve previously
unseen Spotify songs through private metadata and the same conservative app
catalog matcher. A bounded headless task can reuse the existing matcher and
StreamingService cookie/JWT renewal; it must be request/account/Jam/generation
fenced and cannot depend on a mounted screen. A preloaded mapping cache alone
would not satisfy the goal. Native observation, timing, lease renewal and audio
control remain independent of JavaScript timers.

The native account/credential handoff, exact teardown and visible app actions
are composed in mobile `147eb76`. Pending handoff and browser following still
stop in the background; only acknowledged native ownership with a verified app
receipt may continue. Continue physical lifecycle and renewal acceptance. Use actual player
readiness, respect the user's local pause, protect source clock domains and pause
on missing/ambiguous media. The responsive Dealer actor must continue handling
incoming commands while bounded HTTP work is pending; mutations never replay.

Hosting still requires explicit initial activation, accepted incoming player
actions and real local state publication. Publication encoding and a registered
observer do not establish a playable host. Cross-account admission/permissions,
phone installation, measured simultaneous audio and screen-lock/network/renewal
checks are separate acceptance requirements and remain unproved.
