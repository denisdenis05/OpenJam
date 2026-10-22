# Features and dedicated tests

| Functionality | Dedicated tests |
| --- | --- |
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
| Commands, request deduplication/conflicts, host permission, account switch, detach, backpressure and subscriber ownership | `tests/jam-session.test.mjs` |
| Unknown outcomes, queued-command fencing and passive reconciliation | `tests/jam-session.test.mjs` |
| Immutable private snapshots, explicit invitation access and capability truthfulness | `tests/jam-session.test.mjs` |
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
Their absence is not covered up by mock endpoint success or enabled capability
flags. A MusicBrainz result also does not imply local audio availability.
