# Features and dedicated tests

| Functionality | Dedicated tests |
| --- | --- |
| Actual import preview fallback in both directions, exact database identity, featured-title normalization and expanded credits, missing/different duration support, base-title/code/availability safeguards, same-recording import grouping across credit expansions, strict success bypass, malformed/foreign/duplicate responses and cancellation | `tests/catalog-expanded-credits.test.mjs` |
| Retained native host receipts preserve original HTTP timing, age and real queue identity; expired/backward clocks fail | `tests/connect-observation.test.mjs`; Mobile `SpotifyConnectObservationDecoderTest` |
| Current unavailable/ambiguous match is retained across position and upcoming-only updates; new occurrence and explicit reattachment can retry | `tests/shared-playback.test.mjs` |
| Actual bounded follower occurrence queue, immediate current playback, background upcoming matching, repeated tracks, queue replacement, missing/failed future recordings, partial-queue failure/counts without stopping current audio and prompt supersession | `tests/shared-playback.test.mjs`, `tests/connect-observation.test.mjs`; Mobile `FOLLOWER_QUEUE_PROGRESS.md` |
| Retained host runtime, failed cleanup replacement barriers, native retirement release, snapshot privacy and decision ordering | Mobile `SpotifyHostRuntimeTest`, `SpotifyHostNativeSessionTest`, `SpotifyHostSnapshotProtocolTest`, `SpotifyDecisionExecutorTest`, `SpotifyConnectRuntimeTest` |
| Verified admitted-guest queue/playback reads, denial after reading, participant removal and cancellation | `tests/guest-observation.test.mjs`, `tests/hosted-playback.test.mjs`; mobile `tools/spotify-connect-store.test.cjs`, `tools/spotify-native-follower-context.test.cjs`, `tools/spotify-shared-screen.test.tsx`, `SpotifyConnectNativeExecutionTest` |
| Safe native hosting rejection/snapshot categories, cleanup/catalog and stop errors, unknown/throwing-property privacy | Mobile `tools/spotify-hosting.test.cjs` (44 total hosting cases) |
| Explicit app hosting, actual queue capture, matching/epoch fences, exclusive following cleanup and app controls | Mobile `tools/spotify-hosting.test.cjs`, `tools/spotify-hosting-queue.test.cjs`, `tools/spotify-hosting-screen.test.tsx`, `tools/spotify-playback-controller.test.cjs` |
| Background reverse matching, one-use native claims, scoped search, task expiry, account replacement and paused fresh publication | Mobile `SpotifyHostRecordingBrokerTest`, `SpotifyHostCoordinatorTest`, `tools/spotify-background-hosting.test.cjs`, `tools/spotify-background-hosting-headless.test.ts` |
| Bounded native HTTP waiting with actual generation/authority revalidation, responsive Dealer replies and no HTTP request replay | Mobile native `connect_actor` suite |
| Native host readiness, original command deadlines, actual player receipts, serialized dispatch, periodic queue publication, lifecycle fences and queue-independent withdrawal | Mobile `SpotifyHostCommandEventDecoderTest`, `SpotifyHostCommandDispatcherTest`, `SpotifyHostCoordinatorTest`, `SpotifyHostNativeSessionTest`, `SpotifyHostConfigurationProtocolTest`, `SpotifyHostConnectionEventsTest`, `SpotifyHostNativeTransportTest`, `SpotifyHostPlayerPortTest`; native `connect_actor`, `connect_bridge`, `connect_publication` |
| Approved current-session native catalog diagnostic without account/song logging | Mobile `tools/spotify-native-search-probe.test.cjs`; live search returned backpressure, so availability remains unresolved |
| Explicit native/foreground following route, exclusive cleanup, actual native handoff/player-epoch receipt, background guards, account/token updates, scoped restoration, local suspension, late completions and native events | Mobile `tools/spotify-native-follower-store.test.cjs`, `tools/spotify-playback-controller.test.cjs`, `tools/spotify-jam-playback-platform.test.ts`, `tools/player-native-ownership.test.cjs`; detailed mapping in `SPOTIFY_NATIVE_FOLLOWER_HANDOFF.md` |
| Explicit shared-state reconciliation, unchanged passive fences, queue/playback receipt retention, membership/account/host guards, serialized ordering, duplicate requests, cancellation, native revision/occurrence validation and runtime injection | `tests/shared-state-reconciliation.test.mjs` (26 cases) |
| Explicit immutable native credential handoff after durable acknowledgement, renewal rotation, cancellation, logout/disposal and stale renewal | `tests/librespot-login.test.mjs` (five native-handoff cases) |
| Android connection ownership, strict native decoding, account/generation fencing, cleanup barriers/retry and native join device selection | Mobile `SpotifyConnectOwnerTest.kt`, `SpotifyConnectNativeExecutionTest.kt`, `tools/spotify-connect-store.test.cjs`, `tools/spotify-mobile.test.cjs` |
| Android Connect event platform and separate registration/control-only UI | Mobile `tools/spotify-connect-platform.test.ts`, `tools/spotify-screen.test.tsx` |
| Persistent native Dealer framing/registration/HTTP classification, explicit command acknowledgement, heartbeat, cleanup ownership, connection handles and JNI input boundaries | Mobile `native/librespot-session/tests/connect_*.rs`; detailed mapping in `native/librespot-session/CONNECT_TRANSPORT.md` |
| Safe native Connect diagnostic summaries/private IPC and explicit observer controls | Mobile `tools/spotify-connect-probe.test.cjs` |
| Host playback command routes/preflight/seek bounds, ownership, identity copying, duplicate/conflicting intents, serialization, uncertainty and stale membership preservation | `tests/hosted-playback-commands.test.mjs` |
| Explicit mobile host playback controls, seek preparation, busy/uncertain/guest states, account/host replacement and late response fences | Mobile `tools/spotify-playback-commands.test.cjs`, `tools/spotify-playback-controls-screen.test.tsx` |
| Private native-grant IPC, passive live probe status, protected existing/replaced Jams and explicit test-Jam cleanup | Mobile `tools/spotify-jam-probe.test.cjs` |
| Desktop-authorized bootstrap/restore uses Login5 without a client token; platform password sessions retain upstream Login5; no cross-client fallback; safe rejection stages preserve transient recovery | Mobile `native/librespot-session/tests/token_exchange.rs` |
| Desktop Login5 request/header binding, canonical account/token/expiry validation, protobuf bounds, transient errors, challenge solving/context, code verification and bounded rounds | Mobile `native/librespot-session/tests/desktop_login5.rs` |
| Native rejection stage survives the adapter/provider/UI and rejected saved records are erased | `tests/librespot-login.test.mjs`; Mobile `tools/spotify-librespot-mobile.test.cjs`, `tools/spotify-screen.test.tsx` |
| Device request/poll forms, safe browser validation, private/public record separation, secure acknowledgement, pending/slow_down pacing, default interval, expiry, restart resume, denial, transient failures, token consumption, native handoff, cancellation, overlap and observers | `tests/device-authorization.test.mjs` |
| Password-free authorize strategy, one-use/logout behavior and pending resume through shared native grant persistence | `tests/librespot-login.test.mjs` |
| Primary device-login UI, pairing/reopen/cancel, native-bootstrap stage, four-namespace selection and account/lifetime fences | Mobile `tools/spotify-screen.test.tsx`, `tools/spotify-mobile.test.cjs`, `tools/spotify-login-providers.test.cjs`, `tools/spotify-secure-platform.test.ts` |
| Approved-token native dispatch, platform errors and browser launch | Mobile `tools/spotify-librespot-mobile.test.cjs`, `tools/spotify-librespot-platform.test.ts` |
| Fixed desktop native bootstrap, client-bound restore compatibility, invalid/canceled bootstrap and JNI handoff | Mobile `native/librespot-session/tests/session_boundaries.rs`, `tools/fixtures/librespot-jni/com/streamingservice/spotify/SpotifyLibrespotNative.java` |
| Independent native login, one-use input, validated grants, durable acknowledgement, saved record selection, renewal/rotation/shared cancellation, account binding, stale work, storage failures, disposal/logout and progress observers | `tests/librespot-login.test.mjs` |
| Injected native request dispatch, scoped cancellation, missing module and sanitized failures | Mobile `tools/spotify-librespot-mobile.test.cjs`, `tools/spotify-librespot-platform.test.ts` |
| Native saved-session precedence, optional OAuth selection, no identity downgrade, callback-only resume and all-namespace forgetting | Mobile `tools/spotify-login-providers.test.cjs` |
| Native account identity skips profile HTTP, retains Jam rejection, fences account replacement; UI clears password and distinguishes login/verification/Jam failures | Mobile `tools/spotify-mobile.test.cjs`, `tools/spotify-screen.test.tsx`, `tools/spotify-secure-platform.test.ts` |
| Native input/record/type/account/expiry boundaries, request capacity/isolation/release, unsupported verification, cancellation and deadlines | Mobile `native/librespot-session/tests/session_boundaries.rs` |
| Native worker registration, forwarding, duplicate/cancel/close/dispatch failure and safe native-load failures | Mobile `android/app/src/test/java/com/streamingservice/spotify/SpotifyLibrespotRequestRunnerTest.kt` |
| Actual host JNI loading, null strings, duplicate registration, cancel-before-execute, release and malformed restoration | Mobile `tools/fixtures/librespot-jni/com/streamingservice/spotify/SpotifyLibrespotNative.java` |
| Shared callback base comparison, custom root path compatibility, network/opaque exclusions, scheme/host/port precedence and exact nonroot paths | `tests/authorization-redirect.test.mjs` |
| Warm/resumed root-slash callbacks retain the registered token redirect and reject wrong state, fragments and other paths | `tests/pending-authorization.test.mjs` |
| Warm event/native intent and cold startup root comparisons; specific scheme/host/path diagnostics and screen messages | Mobile `tools/spotify-authorization-recovery.test.cjs`, `tools/spotify-screen.test.tsx` |
| Pending PKCE persistence before browser opening, secure shape, consume acknowledgement, restart resume, expiry, stale return then valid recovery, replay/configuration/malformed input, disposal/logout/storage races and isolated progress notifications | `tests/pending-authorization.test.mjs` |
| Android callback/dismissal ordering, initial intent recovery, state isolation, cancellation and cleanup; cold account/restore ordering and one-time navigation | Mobile `tools/spotify-authorization-recovery.test.cjs` |
| Android custom-tab capture and initial intent fallback; iOS native authentication session | Mobile `tools/spotify-login-platform.test.ts` |
| Login phase/error preservation across remounts, explicit interruption/cancellation and separate device-only pending proof storage | Mobile `tools/spotify-screen.test.tsx`, `tools/spotify-secure-platform.test.ts` |
| Identity/sequence fencing, paused preparation, latest-target position, local/remote buffering, drift correction, freshness/uncertainty, ambiguous/missing media, duration hold, cancellation, late output, release ordering and failed play compensation | `tests/shared-playback.test.mjs` |
| Monotonic source-clock mapping, interval uncertainty, oscillator allowance, sample bounds/order/expiry, inconsistent clocks, bounded retention and reset | `tests/shared-clock.test.mjs` |
| Public playback decoding, actual host binding, request timing, old paused timestamps, malformed/unavailable data, cancellation, runtime ownership and sanitized local lookup | `tests/hosted-playback.test.mjs` |
| Browser authorization, proof validation, exact callback/state checks, consent denial, exchange validation, refresh rotation/single flight, expiry, immutable configuration and cancellation/logout races | `tests/spotify-login.test.mjs` |
| HTTP form-body forwarding for the token endpoint | `tests/network.test.mjs` |
| App recording preparation, explicit ambiguous selection, validation, immutable snapshots/session identity, cancellation before dispatch, receipt retention after dispatch, duplicate submission, confirmation failure and account/host retirement | `tests/recording-queue.test.mjs` |
| Durable login encoding/configuration, restoration, account validation, refresh rotation, transient profile recovery, explicit logout vs disposal, canceled/stale writes, serialized account leases and sanitized storage errors | `tests/saved-login.test.mjs` |
| Source-standard enforcement and negative fixtures | `tests/architecture.test.mjs` |
| Exact title/full artist identity, optional duration/code evidence, meaningful version title text, Unicode, ambiguity, duplicate candidates, availability and bounded ranking | `tests/catalog-matching.test.mjs` |
| Deterministic equivalent-release recording selection, complete normalized identity, optional candidate durations, pairwise code compatibility and fail-closed variant/availability/credit boundaries | `tests/catalog-equivalent-recordings.test.mjs` |
| Both translation directions, confirmation, invalidation, market isolation, many-to-one identity, missing sources, typed failures and cancellation | `tests/catalog-matching.test.mjs` |
| Queryable three-field provider, bounded/copying behavior and input validation | `tests/catalog-providers.test.mjs` |
| MusicBrainz escaping, metadata decoding, identifiers, missing entries and public-service interval validation | `tests/catalog-providers.test.mjs` |
| Spotify search filters/limits, market, metadata fields, missing entries and malformed responses | `tests/catalog-providers.test.mjs` |
| Authenticated server-catalog protocol and optional metadata | `tests/catalog-providers.test.mjs` |
| Association catalog/market isolation, defensive copies and memory capacity | `tests/association-store.test.mjs` |
| Credential single-flight loading/renewal, expiry, identity validation, lifetime fences and per-caller cancellation | `tests/network.test.mjs` |
| Credential origin checks, read-only renewal/retry, mutation uncertainty and rate limits | `tests/network.test.mjs` |
| Pacing, timer cancellation, deadlines, malformed JSON and fetch redirect/cookie policy | `tests/network.test.mjs` |
| Jam creation/deletion/status protocol, absent session and malformed success | `tests/jam-session.test.mjs` |
| Passive account-current JSON/404 decoding, endpoint trust, cancellation, malformed responses, refresh capability, private copied snapshots, deduplication, stale accounts and uncertain-outcome reconciliation | `tests/jam-current-account.test.mjs` |
| Explicit hosted queue request encoding/validation, host decoding, disabled/guest/inactive/missing-host rejection, replay/conflicts, ordered membership changes, cancellation, account fences, bounds and unknown queue outcomes surviving membership refresh | `tests/hosted-queue.test.mjs` |
| Host queue item decoding, duplicate order, episodes, bounds and active device checks before/after account queue reads | `tests/hosted-queue-observation.test.mjs` |
| Disabled/guest/missing-host observation, coalescing, frozen snapshots, account/session/host races, background cancellation, disposal, foreground polling, paused failures, Retry-After and later host recovery | `tests/hosted-queue-observation.test.mjs` |
| Membership passive polling, absence/recovery, metadata-only snapshots, coalescing, account/foreground lifecycle, rate guidance and bounded fresh request identity validation | `tests/membership-observation.test.mjs` |
| Individual passive cancellation, exact prior status/failure restoration, queued mutation isolation, late-response fencing, optional retry receipts and unknown queue-write preservation | `tests/membership-observation.test.mjs` |
| Commands, request deduplication/conflicts, host permission, account switch, detach, backpressure and subscriber ownership | `tests/jam-session.test.mjs` |
| Unknown outcomes, queued-command fencing and passive reconciliation | `tests/jam-session.test.mjs` |
| Immutable private snapshots, explicit invitation access and capability truthfulness | `tests/jam-session.test.mjs` |
| Experimental membership defaults/capabilities/runtime opt in, join query modes/device encoding, guest leave endpoint, validation, malformed success and cancellation | `tests/jam-membership.test.mjs` |
| Experimental guest ownership rules, forbidden guest creation at submission/execution, owner reactivation, response copies, replay/conflicts, bounded pending work, account changes, detach and join/leave uncertain outcomes | `tests/jam-membership.test.mjs` |
| Account-scoped runtime composition, translation, confirmation and disposal | `tests/runtime.test.mjs` |
| Selector identity retention, selected changes and store method receiver | `tests/react-bindings.test.mjs` |
| Server credit projection, fallback provenance, deduplication, invalid inputs, cancellation, SQL translation, routes and authorization | `StreamingServiceServer.CoverTests/SpotifyRecordingCatalogTests.cs` |
| Actual PostgreSQL lookup/search, multiple artists, result limits and no tracked entities | Two PostgreSQL cases in `SpotifyRecordingCatalogTests.cs` |
| Mobile linking/Metro, application vs Spotify identity, logout, account changes, replacement, hot-lifetime disposal, stale resolution and foreground selection | `StreamingServiceMobile/tools/spotify-integration.test.cjs` |

The React selector cases use an injected hook boundary, not a mounted React
Native renderer. PostgreSQL cases establish query execution independently of
unit matching cases. Live Spotify probes are additional evidence and do not
replace these tests.

Guest join/leave, invitation resolution, live pushed events, queue controls,
independent mobile authentication and physical-device operation remain unverified.
Mock endpoint success does not prove live guest participation. Join/leave
capabilities can be explicitly enabled as experimental operations; all other
unsupported capabilities remain false. A MusicBrainz result also does not imply
local audio availability.

## Native command adapters

`tests/connect-commands.test.mjs` covers immutable account/host binding, queue
occurrence input, malformed commands/targets/tracks, cancellation before identity
allocation and uncertain failures without fallback/retry. Native preflight and
Android lifecycle cases are mapped in mobile native CONNECT_TRANSPORT.md.

## Private observation boundary

`tests/connect-observation.test.mjs` covers server/monotonic time separation,
uncertainty, pause/buffering, duration clamp, repeated-track occurrence identity,
immutable queue values, handle/generation/host checks, invalid or slow clocks,
missing occurrence and unsupported speed. The native reader forwards its bound
account/host. `tests/hosted-playback.test.mjs` verifies runtime reader injection
retains source occurrence/buffering without public player requests. Existing
membership/account retirement guards still apply to this injected reader.

## Private metadata and queue projection

`tests/connect-metadata.test.mjs` covers immutable exact-identity projection,
invalid response/request bounds, private lookup with delegated search, explicit
not-found, repeated-song deduplication with distinct occurrences, queue revision
change, cancellation after observation, preservation of revision/empty provider,
and bounded batches preserving order. `tests/connect-observation.test.mjs` adds
the live paused-zero-speed regression and rejects active zero-speed samples.

## Structural queue markers

connect-observation.test.mjs preserves meta/delimiter entries while accepting a
playable current track. connect-metadata.test.mjs skips those structural entries
before metadata batching and preserves the remaining song occurrence order.
Live composed observation/queue reading succeeded after these regressions.

Native account-bound search, bounded inputs, empty results, playable flags,
malformed results and transport routing: `tests/connect-search.test.mjs`.

## Explicit native guest commands

`guestCommandVerifier` enables the explicitly composed native path for admitted
guest playback and append requests. Fresh membership verification precedes each
command; native source restrictions and real acknowledgements determine whether
the mutation succeeds. Browser/default construction retains owner guards. No
permission is cached from admission. Explicit uncertainty reconciliation verifies
fresh guest membership before and after shared state and never replays a request.

Dedicated tests: `tests/guest-commands.test.mjs` covers default denial, fresh
verification, denial, retirement, deduplication, actual mutation rejection,
unknown-outcome fences and deliberate guest recovery. `tests/recording-queue.test.mjs`
covers guest recording selection reaching the guarded command path.

Source checks passed 643 library cases. Cross-account acceptance, permission
changes, queue propagation and audible timing remain live gates.

## Mobile player and QR integration

Actual queue-change preparation, post-receipt publication and superseded cursor
protection: mobile `tools/player-jam-runtime.test.cjs`, `tools/player-queue-
lifecycle.test.cjs`, `tools/spotify-player-jam.test.cjs`. Explicit player controls,
country/role gating, retained ownership and cancel/navigation: mobile
`tools/spotify-player-jam-screen.test.tsx`. QR generation, private invitation scope,
quiet zone, input/matrix bounds, stale completion/share retirement and accessibility:
mobile `tools/spotify-jam-qr.test.tsx`. Native host/follower feature maps are in
mobile CATALOG_HOSTING_PROGRESS.md and SHARED_CONTROL_PROGRESS.md.
