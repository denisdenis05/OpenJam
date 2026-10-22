# Approved implementation and remaining work

The user approved the library proposal, including bidirectional catalog
translation and interchangeable MusicBrainz/database providers, on 2026-10-21.
The original detailed plan is in the workspace's
`spotify-jam-research/LIBRARY_PLAN.md`. Current evidence takes precedence over its
initial feasibility assumptions.

## Delivered library checkpoint

1. Separate package/repository, project quality instructions, strict compiler,
   source checks, public contracts, deterministic feature tests and documentation.
2. Minimum three-field recording provider, MusicBrainz service adapter, Spotify
   catalog adapter, bidirectional matching, explicit confirmation and association
   storage. Richer metadata is optional and mismatches remain explicit.
3. Authenticated .NET query projection and endpoints for the existing recording
   schema, including all available credits and release-fallback provenance.
4. Injected Spotify credential coordination, guarded HTTP transport, verified Jam
   creation/deletion and caller-selected-device passive refresh.
5. Account/session state, immutable snapshots, explicit invitations, command
   ordering/deduplication, uncertain-outcome reconciliation and React selectors.
6. Mobile local dependency/build/Metro setup, account lifecycle composition,
   startup registration and selected-device foreground refresh.

## Remaining feasibility and product work

- Establish mobile Spotify credential acquisition/renewal independently of a
  running desktop client. The provider interface is implemented, not a login
  implementation. Do not turn desktop debugging into a mobile dependency or
  introduce a credential relay without a separate reviewed design.
- Resolve invitation info HTTP 404 and validate guest participation with a second
  controlled account. Keep join/leave and invitation resolution unavailable
  until supported behavior is established.
- Capture the actual PubSub connection and notification envelopes. Until then,
  only explicit passive refresh is supported; no pushed live observation is
  advertised and there is no polling of creation endpoints.
- Obtain successful live Spotify catalog results after rate limiting permits it.
  Adapter unit tests are not evidence of live catalog authentication access.
- Validate foreground behavior on real Android/iOS devices, including fetch
  redirect/cookie semantics and AppState transitions. Background execution needs
  its own native ownership design.
- Add queue/guest/host-setting operations only after protocol validation and
  dedicated tests. Design local playback synchronization separately; matching
  identity does not establish queue or timing synchronization.

Progress is recorded per repository. The library owns the core and tests, the
server owns Entity Framework/controllers, and mobile owns account composition
and package integration. No push or deployment is part of this checkpoint.
