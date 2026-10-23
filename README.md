# StreamingService Spotify Jam

A private TypeScript library for Spotify Jam sessions and bidirectional
MusicBrainz-recording/Spotify-track translation. It is a sibling repository to
StreamingServicePlayer, consumed by the mobile application through a local file
dependency. The core works without React Native or React. Optional selector
bindings are exported from `streaming-service-spotify-jam/react`.

## Implemented behavior

- Create or activate a Jam, end an owned Jam, and passively refresh the current
  account session or the session associated with a caller-selected Spotify device.
- Account-scoped session snapshots, explicit invitation access, command ordering,
  duplicate request handling, bounded pending work, and uncertain-outcome fences.
- Injectable Spotify credentials with shared loading/renewal and account checks.
- MusicBrainz public/self-hosted service adapter, injected queryable recording
  provider, and StreamingService's authenticated database projection adapter.
- Spotify catalog lookup/search through its documented Web API adapter.
- Bidirectional candidate ranking, explicit ambiguity, caller confirmation,
  metadata-sensitive associations, market isolation, and bounded memory storage.
- Mobile linking, account logout/change cleanup, and foreground refresh when a
  Spotify device-selection provider is supplied.

Production Jam creation/deletion and passive device-status requests were tested
against the installed Spotify account. A subsequent live account-current probe
verified passive JSON reads while a temporary owned Jam was active and HTTP 404
when absent, with successful cleanup. Guest joining, invitation-info lookup,
push updates, queue manipulation, and standalone mobile login are not established
working features. Their capability flags are false by default. Experimental
membership can be explicitly enabled for personal testing as described below;
enabled join/leave flags indicate available experimental operations, not verified
remote listening. The earlier invitation-info
experiment returned HTTP 404. A public Spotify catalog probe returned HTTP 429;
catalog behavior has deterministic adapter tests but no successful live catalog
validation in this chapter.

Playing together is planned separately. Read the
[playback protocol findings](PLAYBACK_PROTOCOL_RESEARCH.md) and
[proposed synchronization plan](PLAYBACK_SYNC_PLAN.md). Independent membership
pushes and a stale Connect snapshot were observed; remote playback synchronization
remains unverified and is not implemented.

## Browser login

[LOGIN.md](LOGIN.md) describes the library-owned PKCE flow and injected platform
boundaries. Android/iOS boundaries now support Spotify sign-in, secure saved refresh grants
and account-verified restoration. A registered public client ID and exact callback are
required; no client secret or pasted access token is needed. Live OAuth access
to the private Jam routes has not yet been established.

## Experimental membership

Set the runtime dependency `experimentalMembership: true` to enable reconstructed
guest join/leave requests. This defaults to false. Call
`sessions.joinSession(joinToken, JamJoinMode.Control, localDeviceIdentifier, requestIdentifier)`
or select `JamJoinMode.Remote` for the experimental `listen_and_control` request.
Pass `null` when no actual Spotify local device identifier is available; do not
invent an identifier. Supply the invitation token, not an entire invitation URL.

Joining requires no current session. Leave a guest session with
`sessions.leaveSession(requestIdentifier)` before joining another; end an owned
session with `endSession` instead. Creating a Jam while currently a guest is
forbidden; an owner may reactivate their own Jam. Join/leave use the existing bounded ordering,
request replay, account cancellation and uncertain-outcome reconciliation rules.
A completed duplicate request returns its original result even after state changes.

These HTTP paths were recovered from source and have deterministic tests.
Cross-account live guest admission remains unverified. Remote mode does not
implement queue updates, Spotify audio playback or synchronization with our player.

## Composition

Optional [passive membership observation](MEMBERSHIP_OBSERVATION.md) polls the
verified account-current endpoint and recovers after foreground resumption.
Inject fresh request identifiers and a scheduler for automatic polling. It
cancels passive reads individually and never joins or creates a Jam automatically.

Optional [host queue observation](HOSTED_QUEUE_OBSERVATION.md) provides copied
track/episode snapshots, host device checks and foreground polling. Enable it
explicitly and supply a scheduler for polling. It does not establish shared guest
queue delivery, settle unknown writes or synchronize audio.

Optional host queue requests are described in [HOSTED_QUEUE.md](HOSTED_QUEUE.md).
They require an owned active Jam with a known Spotify host, suitable OAuth
permissions and explicit `enableHostedQueue` composition. Acceptance does not
claim shared queue observation or playback synchronization.

Construct `SpotifyJamRuntime` with the account identifier, credential provider,
endpoint resolver, recording catalog, association store, HTTP executor, and clock.
No constructor starts network work. Call `dispose()` when retiring its account.

```typescript
const runtime = new SpotifyJamRuntime({
  accountIdentifier,
  credentials,
  endpoints,
  recordings,
  associations,
  requests,
  clock,
});

const spotifyMatch = await runtime.translateToSpotify(recordingIdentifier, market, cancellation.signal);
const recordingMatch = await runtime.translateToRecording(spotifyIdentifier, market, cancellation.signal);
const creation = await runtime.sessions.createOrActivateSession(createRequestIdentifier);
const snapshot = runtime.sessions.getSnapshot();
const invitation = runtime.sessions.getInvitation();
const currentRefresh = await runtime.sessions.refreshCurrentSession(currentRefreshRequestIdentifier);
const refresh = await runtime.sessions.refreshSession(spotifyDeviceIdentifier, refreshRequestIdentifier);
```

The identifiers, providers, policies, market, and cancellation controller in this
example are supplied by the host. `FetchHttpExecutor` and `SystemScheduler` are
concrete boundary implementations. `SpotifyEndpointResolver` must supply the
actual HTTPS service origin; the research account's regional host is not a
production default. `SpotifyCredentialProvider` must obtain and renew the
current account's credentials. Desktop debugging is not part of this package.

`refreshCurrentSession` uses the verified passive
`GET /social-connect/v2/sessions/current` endpoint and requires no device lookup.
HTTP 404 means no current session; malformed successful JSON remains an error.
It can reconcile an uncertain mutation through the same account guards as device
refresh. The live check covered an owned session, not cross-account guest state.

## Catalog records

The minimum recording record is `identifier`, `title`, and `author`. Author means
credited performer names. Providers declare a catalog identity and either the
MusicBrainz-recording or local-recording namespace. Optional artist arrays,
duration in milliseconds, recording codes, and artist-credit provenance improve
decisions. Release artist fallback cannot automatically corroborate a match.

`QueryableRecordingCatalog` wraps caller-supplied asynchronous lookup and bounded
search functions. It does not require MusicBrainz or a particular database.
`MusicBrainzRecordingCatalog` provides the alternative HTTP implementation with
query escaping, identification and per-instance pacing. Share one instance for
each service policy; separate processes/instances need a shared rate limiter if
they collectively use the public MusicBrainz service.

`StreamingServiceRecordingQuery` consumes the .NET server's read-only
`spotify/catalog/recordings/{identifier}` and `spotify/catalog/recordings/search`
routes through an injected application-authenticated `JsonReader`. Wrap it in
`QueryableRecordingCatalog` using an identity specific to the server/catalog.
No Spotify credential is sent to these application endpoints. A database-only
catalog never silently contacts MusicBrainz.

With only title and artist evidence, a plausible result is ambiguous. Exact
normalized text plus corroborating duration, or a shared recording code with
consistent artist/version/duration evidence, can select a unique candidate.
Conflicting recording codes veto automatic selection. Scores rank candidates;
they are not statistical confidence percentages. Confirm a chosen association
with `confirmAssociation` after the host has made an explicit selection.

Associations are many-to-many. They are revalidated against metadata fingerprints,
policy version, catalog identity/namespace, and requested market. Target Spotify
availability is checked on confirmed forward lookups. The provided memory store
retains a configurable maximum of 512 associations, retiring the oldest on
capacity pressure; inject durable account-owned storage when desired.

## Mobile boundary

The mobile package links this repository and builds it with `prepare:spotify`.
`src/services/SpotifyIntegration.ts` composes the application-account observer
and AppState notification boundary. Its `spotifyIntegration.connect` accepts
runtime dependencies and optional device selection. It does not supply a login
flow, create a Spotify device, or start a Jam automatically.

Application logout/account changes and hot reload dispose the previous runtime.
Foreground resumption requests one passive refresh only when a device identifier
and unique request-identifier provider were configured. There is no background
service or guarantee of observation while JavaScript is suspended.

## Development

Run `npm install`, then `npm run check`, `npm test`, and `npm run build` here.
The runner can also use the sibling mobile TypeScript installation. Strict
compiler options and architecture checks cover authored TypeScript/JavaScript;
review and feature-specific tests remain required.

Read [FEATURES.md](FEATURES.md), [ARCHITECTURE.md](ARCHITECTURE.md),
[VALIDATION.md](VALIDATION.md), and [PROGRESS.md](PROGRESS.md) before changes.
The workspace quality skill applies to code, contracts, tools, tests, examples,
and related integration changes. No generated/extracted Spotify application code
or account credentials belongs in this repository.
