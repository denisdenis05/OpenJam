# Playback protocol investigation

Investigated on 2026-10-22 using REA 6.7.0, the installed Spotify Linux
1.2.86.502 client, controlled probes, and an independent agent review of the
existing player and a pinned librespot source revision. This chapter changes
documentation only. It does not add a playback or queue capability.

The investigation establishes independent membership notifications and an
independent Connect snapshot request. It does **not** establish fresh remote Jam
playback delivery, independent guest admission, or synchronized audio.

## Evidence and limits

Local evidence is under the workspace's `spotify-jam-research/evidence/`.
Extracted Spotify resources and probe credentials do not belong in this library.
Reports retain structural fields, timing samples, status codes and comparisons;
they omit credentials, invitation values, member identities and track identifiers.

| Question | Result | Local evidence |
| --- | --- | --- |
| Does the installed client expose playback state? | Yes, native Esperanto `ContextPlayer.GetState` and `GetQueue` streams; `GetPositionState` is a single response. | `playback-native-snapshot.json`, `playback-command-schemas.json` |
| Can another process receive Jam notifications? | Yes, Node opened the resolved Dealer WebSocket and received session-update messages during temporary Jam creation/deletion. Authentication came from the current desktop process in memory. | `playback-dealer-probe.json` |
| Do those observed session messages contain a playback anchor? | No. The captured messages describe session metadata and membership. There is no track/position/queue anchor in these observed envelopes. | `playback-dealer-probe.json` |
| Can another process request Connect state without activating playback? | Yes, an inactive non-playing observer received HTTP 200 and a decoded protobuf Cluster. | `playback-observer-probe.json`, `playback-observer-snapshot.json` |
| Was that snapshot current? | No. Its paused playback anchor was roughly eleven hours old and its track/position differed from the installed client's paused/buffering state. It omitted an active-device identifier. | `playback-observer-snapshot.json` |
| Were continuous playback pushes observed? | No cluster pushes in the first observer's two-second window. No playback changes were induced, so this does not establish absence of a working update route. | `playback-observer-probe.json` |
| Was cleanup successful? | Temporary Jam deletion succeeded. Both observer deletions returned 204. Active device, playback identifier, pause state and position were unchanged during the observer probes. | The three probe reports above |
| Did two accounts listen together? | Unverified; a second controlled account/device was not supplied in this investigation. | No claim |
| Is mobile authentication independent of the desktop client? | Unverified. Credential acquisition remains a separate prerequisite. | Existing PROGRESS.md |

## Membership and playback are different channels

The native desktop PubSub adapter wraps Esperanto pushed messages in an envelope
with `ident`, receipt `timestamp`, `attributes`, and byte-array `payloads`.
The observed JSON session payload has `reason`, `session`, and
`update_session_members`. Creation/deletion produced `NEW_SESSION` and
`SESSION_DELETED`. The receipt timestamp is not a playback timestamp.

The separate Node Dealer connection received JSON frames with `type`, `uri`,
`headers`, and, for session updates, `payloads`. Initial connection information
arrived under `hm://pusher/v1/connections/` with a `Spotify-Connection-Id` header.
It is a connection identity, not permission to infer playback participation.
The resolved regional host changed since the previous chapter; continue to inject
service resolution rather than hardcoding a regional hostname.

The installed player's native service is
`spotify.player.esperanto.proto.ContextPlayer`. Its transport calls native
`executeEsperantoCall` and `cancelEsperantoCall`; it is not a demonstrated remote
HTTP endpoint. `spotify.connect.esperanto.proto.ConnectService` supplies device
state separately. Additional read subscriptions were cancelled after sampling.

The observed native playback schema includes track occurrence, playback and
session identities, queue revision, position as of a timestamp, duration, speed,
pause/buffering state, restrictions, previous/next tracks and session command ID.
Queue edits in the recovered UI adapter carry a queue revision; seeks can be
guarded by playback identity. These are useful contract inputs, not proof that
every field is present in every remote message.

## Independent Connect snapshot experiment

The probe opened its own Dealer connection, then sent a protobuf `PutStateRequest`
to `PUT /connect-state/v1/devices/{freshResearchIdentifier}`, using the current
bearer credential and `x-spotify-connection-id` in process memory.

It declared a hidden, non-playing, non-controllable device, requested full state,
used Connect-state membership, and explicitly set `is_active` false. No transfer,
play, pause, seek or queue command was submitted. The HTTP response decoded as a
Cluster using descriptors recovered from this installed binary. Cleanup used
DELETE on that fresh identifier only. The experiment did not reuse the installed
client's device identifier.

The decoded Cluster contained `server_timestamp_ms`, `player_state`, and a device
map. Player state contained track, playback/session identities, queue revision,
position, pause flag and previous/next tracks. The server timestamp was close to
receipt time, while the playback timestamp was old. A fresh response is therefore
not sufficient evidence of fresh playback. Sparse/default protobuf fields and
actual host/device/session identity must be checked explicitly.

An old anchor alone does not prove stale state: a correctly correlated paused
track may retain the same anchor for hours. Here the track/position disagreement
and absent active-device identity also prevent treating the response as the
installed client's current authoritative playback. Observation freshness and
playback-anchor age must be assessed separately.

This is a promising bootstrap mechanism. Cross-account Jam authorization,
continuous delivery, resnapshot behavior, device visibility, coexistence and
registration after reconnect still require controlled validation. Do not publish
an active/playable registration simply to make updates appear: taking over a
Connect device is different from participating in simultaneous remote listening.

## Timing interpretation

The recovered UI position helper advances position only with a context, known
duration, and neither paused nor buffering. It extrapolates from timestamp and
speed, clamping to duration. The native sample was paused and buffering with
speed zero and an anchor older than receipt. Blind elapsed-time extrapolation
would be wrong even in this simple observed case.

Do not equate server wall time, playback sample time, JavaScript receipt time and
native monotonic time. A nearby server timestamp does not prove clock symmetry,
one-way delay, or audible alignment. Clock offset, uncertainty, delayed state,
buffering transitions and actual output readiness need measurements.

## Source provenance

The installed snapshot SHA-256 remains
`c0700bb430481af6fb501c5875f659007c0e328912b06b18876d5180e0793758`.
Its printable UTF-16LE source run starts at binary byte offset 4192446. Selected
source excerpts and exact ranges are recorded in the research folder's
`artifacts/playback-source/provenance.json`.

REA evidence `ev_e2802e2fcec8ff3ae25467b701efd38f413f1157a1ae9d82f6331b5aa365990e`
parsed four selected JavaScript files with zero parse failures. Semantic coverage
remains unknown/partial; dependencies and one provenance file were outside the
selected source analysis. `rea-playback-source-summary.json` preserves these
limits. Runtime evidence is a separate CDP observation; its origin filters and
late attachment do not cover native network traffic.

Embedded FileDescriptorProto records from `/opt/spotify/spotify` were decoded
without executing native code. `playback-native-descriptors.json` records the
binary hash, offsets, lengths, descriptor hashes and fields for
`social_connect_v2.proto`, `connect.proto`, `connect-service.proto`, and
`player.proto`. These are schema observations, not recovered native control flow.
The current native social Session schema is smaller than the HTTP JSON session
and includes `redirect_commands`; older extracted schemas cannot be substituted
without checking their wire version.

REA native layout analysis was unavailable because its caller-supplied pwntools
provider was not configured. No native decompilation or disassembly finding is
claimed. Shell string searches and descriptor decoding were separate operations.

Independent review used librespot commit
`99b6088bf3ea028f90192676ac1a337fa4b2ed12`, with downloaded file hashes in the
research reference manifest. Its active-device code stops when another device
becomes active; its Jam update handler primarily maintains a host-associated
session ID. This is a Connect implementation reference, not proof of simultaneous
remote Jam following. See its [Spirc implementation](https://github.com/librespot-org/librespot/blob/99b6088bf3ea028f90192676ac1a337fa4b2ed12/connect/src/spirc.rs)
and [Dealer description](https://github.com/librespot-org/librespot/blob/99b6088bf3ea028f90192676ac1a337fa4b2ed12/docs/dealer.md).

## Unresolved questions

1. What registers an independent remote listener, and how does that listener
   receive the host's fresh playback/queue state across accounts?
2. Which state and permission changes occur for control-only versus remote
   listening membership, and which requests are required after reconnect?
3. What ordering/acknowledgement fields govern queue edits and playback commands?
4. Which timestamp domain anchors actual playback, and what correction behavior
   does the official guest apply while buffering or drifting?
5. Can our player remain a simultaneous listener without an official Spotify
   audio process, and can it host without becoming an exclusive Connect endpoint?
6. How do account eligibility, credential renewal, background suspension, missing
   local recordings and unequal audio timelines affect that participation?

These remain implementation gates in [PLAYBACK_SYNC_PLAN.md](PLAYBACK_SYNC_PLAN.md).
