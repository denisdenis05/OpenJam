# Spotify Jam implementation queue

User instruction 2026-10-25: implement the remaining Android/library functionality
and continue until it works end to end. iOS native login is deferred. This queue
is the active work list; chapter commits and APKs do not end the objective.
Working paired Login5 authentication, catalog translation, the current local
player and owned-host control guards are preserved.

| Order | Work | Status | Completion evidence |
| --- | --- | --- | --- |
| 1 | Persistent native AP/Dealer connection, Connect device registration, reliable guest join/leave, permissions and recovery | In progress: native transport/Android ownership implemented; hidden observer registration live verified; guest admission pending | Independently registered device; successful second-account control/remote admission; leave/kick/reconnect/role changes reflected correctly |
| 2 | Guest shared queue commands, occurrence identities, ordering and uncertain/competing edit reconciliation | In progress: same-account native controls/append live confirmed with server Dealer acknowledgements; private metadata/queue reads live checked; explicit library/mobile uncertainty recovery implemented and packaged; live recovery and guest permission remain | Accepted guest mutations correlated with observed host/guest queue updates; repeated tracks and interrupted receipts handled without duplicate edits |
| 3 | Fresh guest playback events, local-media synchronization, permitted remote controls and reconnect | In progress: bounded private reads and occurrence-aware foreground follower wired; guest audio/timing unverified | Track changes, pause/resume, seek and skip work across accounts; simultaneous local/Spotify audio checked and timing measured |
| 4 | App-led hosting and publication of local track/position/queue state | In progress: guarded native publication encoder/transport tested; initial activation, real incoming command execution and service composition remain | Spotify participant follows the app's playback authority using app catalog audio; incoming controls are acknowledged after accepted player actions |
| 5 | Native Android foreground transport, playback coordination, renewal and lifecycle recovery | In progress: application-owned connection, player service port, native follower, background resolver, headless task and account handoff integrated and source-tested | Screen lock/background/network interruption/renewal tested without JavaScript screen polling or stale-account playback |
| 6 | iOS native Librespot login/integration | Deferred by user | Outside current objective |

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

Finish the native account/credential lifecycle, exact teardown and visible-action
handoff before removing the existing background-stop guard. Use actual player
readiness, respect the user's local pause, protect source clock domains and pause
on missing/ambiguous media. The responsive Dealer actor must continue handling
incoming commands while bounded HTTP work is pending; mutations never replay.

Hosting still requires explicit initial activation, accepted incoming player
actions and real local state publication. Publication encoding and a registered
observer do not establish a playable host. Cross-account admission/permissions,
phone installation, measured simultaneous audio and screen-lock/network/renewal
checks are separate acceptance requirements and remain unproved.
