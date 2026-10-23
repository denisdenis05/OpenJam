# Features and dedicated tests

| Functionality | Dedicated tests |
| --- | --- |
| Browser authorization, proof validation, exact callback/state checks, consent denial, exchange validation, refresh rotation/single flight, expiry, immutable configuration and cancellation/logout races | `tests/spotify-login.test.mjs` |
| HTTP form-body forwarding for the token endpoint | `tests/network.test.mjs` |
| App recording preparation, explicit ambiguous selection, validation, immutable snapshots/session identity, cancellation before dispatch, receipt retention after dispatch, duplicate submission, confirmation failure and account/host retirement | `tests/recording-queue.test.mjs` |
| Source-standard enforcement and negative fixtures | `tests/architecture.test.mjs` |
| Minimal schema, duration/codes, version conflicts, Unicode, artist sets, ambiguity, duplicate candidates, availability and bounded ranking | `tests/catalog-matching.test.mjs` |
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
