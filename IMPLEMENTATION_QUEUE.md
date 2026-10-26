# Spotify Jam implementation queue

User instruction 2026-10-25: implement the remaining Android/library functionality
and continue until it works end to end. iOS native login is deferred. This queue
is the active work list; chapter commits and APKs do not end the objective.
Working paired Login5 authentication, catalog translation, the current local
player and owned-host control guards are preserved.

| Order | Work | Status | Completion evidence |
| --- | --- | --- | --- |
| 1 | Persistent native AP/Dealer connection, Connect device registration, reliable guest join/leave, permissions and recovery | In progress: native transport/Android ownership implemented; hidden observer registration live verified; guest admission pending | Independently registered device; successful second-account control/remote admission; leave/kick/reconnect/role changes reflected correctly |
| 2 | Guest shared queue commands, occurrence identities, ordering and uncertain/competing edit reconciliation | In progress: same-account native controls/append live confirmed with server Dealer acknowledgements; private metadata/queue reads live checked; explicit library uncertainty recovery implemented; live recovery and guest permission remain | Accepted guest mutations correlated with observed host/guest queue updates; repeated tracks and interrupted receipts handled without duplicate edits |
| 3 | Fresh guest playback events, local-media synchronization, permitted remote controls and reconnect | In progress: bounded private reads and occurrence-aware foreground follower wired; guest audio/timing unverified | Track changes, pause/resume, seek and skip work across accounts; simultaneous local/Spotify audio checked and timing measured |
| 4 | App-led hosting and publication of local track/position/queue state | Queued | Spotify participant follows the app's playback authority using app catalog audio; incoming controls are acknowledged after accepted player actions |
| 5 | Native Android foreground transport, playback coordination, renewal and lifecycle recovery | Queued | Screen lock/background/network interruption/renewal tested without JavaScript screen polling or stale-account playback |
| 6 | iOS native Librespot login/integration | Deferred by user | Outside current objective |

## Execution rules

Complete independent implementation while live account/device input is pending.
Request needed clicks or second-account help concisely and continue other work.
Do not mark a queue item complete from unit tests, static protocol strings,
registration acknowledgements or membership alone. Preserve remote wire ordering
and actual clock domains; never invent a guest playback source or permissions.
The final acceptance pass covers installation, login/restore, both membership
roles, queue operations, both playback directions and Android background behavior.

## Current dependency

Native authentication currently returns a grant and shuts its AP session down.
Add a persistent, account-bound transport with bounded event/command delivery,
scoped cancellation and proper shutdown. Reuse the dedicated stored-credential
Login5 exchange rather than Android's incompatible client-token path or the
rejected Keymaster exchange. Resolve regional services rather than pinning hosts.
Register a real device before using its identifier in guest admission. Keep
registration, passive observation, command acknowledgement and audible playback
as separate states.

See mobile SPOTIFY_INTEGRATION_PROGRESS.md for concrete build/probe checkpoints
and library FEATURES.md for each feature's dedicated tests.
