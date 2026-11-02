# Architecture

## Ownership

Spotify owns remote Jam membership and playback. The library owns the current
account's command lifetime, a projection of the last observed session, and
matching decisions. StreamingServicePlayer owns local playback. Translation
does not synchronize its queue/position, download audio, or submit a Spotify
queue mutation.

The public contracts are in `contracts/`. `SpotifyJamRuntime` composes focused
catalog, credential, request, protocol, and session components. HTTP execution,
credential renewal, service-origin resolution, clocks, scheduling, recording
queries, and association storage are injected. React is a separate entry point.

The .NET server owns Entity Framework and database access. `RecordingCatalogQuery`
filters and bounds candidates before projecting recording identifiers, titles,
duration and credits. Materialization deduplicates credits and marks release
artist fallback. It does not load covers, mutate tracked entities, queue
downloads, or store Spotify tokens. Query result limits do not establish bounded
database scan cost; no query performance claim has been measured.

## Verified guest observations

An optional JamGuestObservationVerifier admits guest playback and shared-queue
reads. The session projection must include the bound guest, and a fresh verifier
must confirm the same account, Jam and host before and after the source read.
Cancellation, participant removal and account/host replacement discard results.
Default construction remains owner-only. The mobile native composition supplies
actual Connect membership reads fenced by registration handle/generation. This
read capability grants no guest queue mutation or playback-command authority.

## Explicit native guest command composition

An optional guestCommandVerifier enables deliberate guest append and playback
requests. This is composed only with the mobile native command protocols. Fresh
account/Jam/host membership and projected admission are prerequisites; actual
source restrictions and command acknowledgements remain authoritative. Admission
is not a cached control permission. Default/browser construction stays owner-only.
Role/host/account changes retire preparation and dispatched uncertain outcomes
remain fenced until explicit verified reconciliation, without replay.

## Session commands

`JamSessionClient` serializes mutations, retaining up to 16 pending commands and
64 request receipts, retiring completed receipts while preserving pending work. Repeated identifiers
within that live ownership window share results. Reusing an identifier for a
different operation is rejected. This is local deduplication, not a remote
idempotency guarantee. Detaching retires the ownership object and aborts its
signal. Late completions cannot populate a new account snapshot.

Creation is a state-changing HTTP GET. It has no automatic retry. Transport
failures, cancellation after transmission, invalid successful payloads, and
server errors during mutations produce unknown-outcome failures. Further
mutations stop until an explicit passive device refresh succeeds. A failed
refresh preserves that requirement. Disposal/detachment never remotely ends a
shared session.

The snapshot contains session identity, ownership, participants, status, and a
typed failure. It excludes credentials, join tokens and invitation addresses.
Invitation access is explicit and only available in ready state. Subscribers
receive immutable copied state; listener failures do not change command results.

Explicit owned-host Play/Pause/Next/Previous/Seek commands also use this
coordinator. They require an active owned session and its current host, copy
intents on submission and cancel preflight when that target changes. A fresh
playback read precedes mutation; seek rechecks track identity and duration.
Playback and queue uncertainty have separate fences, which passive membership
refresh cannot clear. An injected JamSharedStateVerifier enables explicit
reconcileSharedState: the same serialized coordinator reads fresh owned active
account membership, verifies native shared state for its captured account/session/host,
then reads membership again. Only complete success clears both fences. Cancellation,
identity changes and failed verification preserve the fences and stored mutation
receipts. No uncertain request is replayed. See HOSTED_PLAYBACK_COMMANDS.md.

## Credentials and requests

`SpotifyCredentialSession` validates account identity and expiry, copies returned
credentials, and shares acquisition/renewal. Each caller can cancel its wait
without aborting another caller's shared refresh. Disposal aborts the provider
lifetime and fences late results. This coordinates a host's credential provider;
it does not implement Spotify login or a native token exchange.

`SpotifyRequestClient` rejects insecure/foreign origins before loading
credentials. Safe reads can renew once after HTTP 401. Mutations do not refresh
and replay automatically. Rate limits preserve typed retry information without
an automatic retry loop. `FetchHttpExecutor` supplies a deadline, propagates
cancellation, requests no redirects or ambient cookies, limits accepted JSON
response length, and emits sanitized errors. The length check is an acceptance
limit after body reading, not a streaming allocation bound. React Native's
platform enforcement still needs device validation.

## Matching

The matcher is deterministic and independent of networking. It normalizes text,
compares complete artist sets and exact normalized full titles. Duration and
recording codes add ranking evidence; missing or differing duration does not
veto selection. Version labels remain meaningful title text, with no separate
version acceptance gate. Recording-code contradictions and unavailability prevent
automatic selection. Closely ranked distinct candidates remain ambiguous.
An acceptable leading candidate may share its selection margin with equivalent
recordings from other releases: normalized full title and complete artist set
must agree. Missing or differing duration does not split an equivalent group.
Every close competitor must independently be acceptable. Known recording-code
sets must agree pairwise; absent codes cannot bridge contradictory known codes.
The existing identifier order chooses a stable representative while retaining
all candidates. This does not fingerprint audio or guarantee exact recording
identity from metadata.

An optional `RecordingImportMatcher` reuses the application's real read-only
playlist import preview after strict matching fails. Forward translation submits
the actual bounded Spotify candidates and accepts only an exact import mapping
to the source recording's database identifier. Reverse translation submits the
actual Spotify source and looks up exact mapped recording identifiers, including
records omitted by strict candidate search. Import responses must contain unique
Spotify identifiers from the supplied batch; malformed, foreign or stale canceled
results fail. Strict successful matches never call this service.

Import evidence is not a stored confirmation or sufficient recording evidence by
itself. The ranker additionally requires equal normalized titles after the same
bracketed `feat`/`ft` removal used by the server importer and an exact shared
artist credit. This path does not require duration or a separate version comparison:
missing or differing duration does not defeat an exact importer mapping. Version
labels outside featured-credit annotations remain part of the base title and
therefore must match as title text. Recording-code and availability
contradictions still veto selection. Only this exact database
mapping can corroborate release-level artist fallback. Other fuzzy suggestions
and unrelated artists remain unconfirmed. Strict-only equivalent-release grouping still requires complete candidate
artist sets and pairwise recording evidence. When both acceptable candidates
carry exact import proof to the same captured database recording, their base
titles and an actual shared artist credit can establish equivalence despite
expanded credit differences. Every candidate pair must retain compatible known
recording-code sets; a missing code cannot bridge conflicting known codes. A
strict-only candidate cannot borrow another candidate's import proof. The host application
injects the importer; the library does not duplicate its fuzzy ranking or make
additional Spotify requests. Policy version changes invalidate older stored
associations under the previous policy.

Confirmed associations are distinct from unconfirmed search results. Both
directions validate relevant metadata fingerprints rather than inverting a
dictionary. Callers should provide account/catalog-scoped durable stores if
preferences need persistence. The bounded memory implementation is ephemeral.

## Mandatory standards

No magic values, authored code comments, or abbreviated variable/method names.
Use SOLID boundaries, injected collaborators, and dedicated deterministic tests
for each behavior. The source checker is inherited from the player and has
negative-fixture tests; its selected syntax checks do not prove all naming,
policy ownership, or architectural requirements. Deliberately invalid source
strings in checker tests are negative fixtures, not executable library examples.

The library contains no native bridge and does not change minimum Android or iOS
versions. The mobile composition owns native proof generation and credential
storage. Host queue submission/observation and foreground membership recovery
are implemented. Normalized playback synchronization and foreground host following
now compose the actual native player through exclusive leases. Guest queue/playback
protocols, guest control routing, continuous background transport and measured
audio alignment remain open. See DEVELOPMENT_SEQUENCE.md for implementation and
live gates.

## Librespot native authentication boundary

LibrespotLoginSession owns library credential lifetime and persistence through
injected authentication/storage/clock contracts. The mobile Android adapter owns
JNI, Login5 and access-point connections using pinned librespot-core. It returns
canonical account identity, access-token expiry and an opaque renewable record.
The private Jam transport consumes this provider without a public profile gate.
The native crate has no audio/player dependency and does not activate playback.
Provider/store selection is account-owned; failure to decode a native session
cannot silently switch identity through a saved OAuth grant. LIBRESPOT_AUTH.md
records native build details, protocol boundaries and live admission gaps.
