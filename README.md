# OpenJam

OpenJam is a private TypeScript library for Spotify Jam membership, catalog matching, queue coordination, and host or follower playback. Its core has no React Native dependency. It does not decode or stream Spotify audio: the application supplies the local player and native Spotify transport.

[Quick start](#quick-start) · [Runtime and ownership](#runtime-and-ownership) · [Matching](#catalog-matching) · [Queue synchronization](#controllable-queue-synchronization) · [Limits and verification](#limits-and-verification) · [Documentation](#documentation)

## Capabilities

| Area | What the library provides | Boundary |
| --- | --- | --- |
| Jam membership | Create or end owned sessions, experimental join/leave, and account-scoped observations | Membership by itself does not start audio or authorize guest control |
| Recording matching | Catalog translation, candidate results, and confirmed associations | Ambiguity and missing evidence remain explicit |
| Controllable queues | Optional synchronization between injected local and Spotify queue ports | The consumer performs real mutations and supplies change triggers |
| Host and follower playback | Hosted queue observation, shared playback reading, and guarded commands | The app composes native transport, player authority, and lifecycle |
| Native guest access | Optional fresh membership verifiers around observations and commands | No verifier means fail-closed guest access; membership is not control permission |
| Authentication | Injectable credentials, browser authorization contracts, and native librespot session interfaces | A consumer must supply platform login, secure storage, and account lifecycle |
| React | Optional exports from `streaming-service-spotify-jam/react` | React 18 or later is an optional peer dependency |

## Quick start

Requires Node.js 20 or later. The package is private and versioned `0.1.0`; it is consumed from a checkout, not installed from the public npm registry. The mobile app uses the sibling dependency `file:../StreamingServiceSpotifyJam`.

```sh
npm install
npm run check
npm test
npm run build
```

## Runtime and ownership

| Required dependency | What the consumer supplies |
| --- | --- |
| `accountIdentifier` | The current Spotify account identity |
| `credentials` | Account-checked credential acquisition and renewal |
| `endpoints` | Resolution of the current HTTPS Spotify service origin |
| `recordings` | Catalog identity, namespace, recording lookup, and bounded search |
| `associations` | Confirmed association storage scoped by the consumer |
| `requests` | HTTP execution with cancellation |
| `clock` | Current time in milliseconds |


`SpotifyJamRuntime` is assembled from caller-owned ports. Required dependencies include the account identifier, credential provider, endpoint resolver, recording catalog, association store, HTTP executor, and clock. Optional ports add catalog import evidence, native Connect search or metadata, controllable queues, shared-state verification, hosted playback, guest verifiers, and scheduling. See [ARCHITECTURE.md](ARCHITECTURE.md) for the ownership map and composition details.

The public entry point is [`src/index.ts`](src/index.ts). A minimal composition uses real adapters supplied by the application:

```ts
import { SpotifyJamRuntime } from 'streaming-service-spotify-jam';
import type { SpotifyJamDependencies } from 'streaming-service-spotify-jam';

declare const dependencies: SpotifyJamDependencies;
declare const recordingIdentifier: string;
declare const market: string;
declare const cancellation: AbortSignal;
const runtime = new SpotifyJamRuntime(dependencies);

const match = await runtime.translateToSpotify(recordingIdentifier, market, cancellation);
const session = runtime.sessions.getSnapshot();

runtime.dispose();
```

The application creates `dependencies` by composing its own adapters. The declarations leave those caller-owned adapters explicit rather than suggesting the library can create an authenticated device or live session by itself. Runtime disposal cancels its work and detaches its account session.

### Authentication boundaries

The runtime acquires and temporarily holds credentials through `SpotifyCredentialProvider`. The host owns secure credential persistence and retires the runtime when the account changes. Browser authorization requires a registered PKCE client and a callback supplied by the host application. Native librespot authorization and saved grants require platform adapters and secure storage. StreamingService account authentication is separate from Spotify authentication. Read [LOGIN.md](LOGIN.md) and [LIBRESPOT_AUTH.md](LIBRESPOT_AUTH.md).

### Hosting, joining, and following

Local hosting and remote following use different authorities and adapters. Invitation membership does not prove the Jam is active, select a device, start local audio, or grant queue and playback commands. Optional operations are composed separately:

| Dependency | What it enables |
| --- | --- |
| `experimentalMembership` | Reconstructed join/leave requests, disabled by default |
| `enableHostedQueue` | Queue commands using an injected protocol or the Web API adapter |
| `enableHostedQueueObservation` | Hosted queue reads and optional scheduled observation |
| `enableHostedPlaybackCommands` | Playback commands with an injected protocol or a configured playback reader |
| `enableMembershipObservation` | Membership observation with a unique request-identifier provider |
| `guestObservationVerifier` / `guestCommandVerifier` | Fresh guest checks for the corresponding explicitly composed operation |

The boolean options default to disabled. A flag advertises composition, not successful remote permission. Guest observation and commands require explicit verifiers that recheck fresh native membership; the application must also enforce source restrictions and native Spotify acknowledgements.

The library exposes invitation and session boundaries but does not encode QR images or scan them. In the mobile app, QR creation is an offline app feature and scanning opens the Spotify invitation flow. Read [SHARED_PLAYBACK.md](SHARED_PLAYBACK.md), [HOSTED_PLAYBACK.md](HOSTED_PLAYBACK.md), and [SHARED_STATE_RECONCILIATION.md](SHARED_STATE_RECONCILIATION.md).

## Catalog matching

Matching compares catalog recordings using identifiers, title, full artist credits, catalog identity, market availability, and recording-code evidence when present. Normalized exact base titles can ignore bracketed `feat` or `ft` credits. Artist evidence uses complete-set containment; arbitrary partial overlap is insufficient. Release-only credits cannot establish an automatic match without actual importer evidence. Duration may contribute ranking evidence, but missing or differing duration does not veto selection. There is no separate version acceptance gate; meaningful version text in titles remains significant. Conflicting recording codes or known unavailability veto a match.

Results preserve ambiguity rather than turning a weak similarity into confidence. Confirmed associations are distinct from candidates and are scoped to catalog and market evidence. An optional `RecordingImportMatcher` reuses the consumer's real read-only import preview when strict matching fails. An exact mapping still needs an equal normalized title and an actual shared artist credit, with no availability or recording-code contradiction. A mapping to another local recording identifier requires a real lookup and strict equivalence with the captured source before it can corroborate that source. Fuzzy suggestions alone cannot confirm an association. The library does not use audio fingerprints or a statistical confidence score. Read [FEATURES.md](FEATURES.md) and [TRANSITIVE_IMPORT_MATCHING_PROGRESS.md](TRANSITIVE_IMPORT_MATCHING_PROGRESS.md).

The minimum catalog record has `identifier`, `title`, and `author`. Providers declare a catalog identity and either `RecordingNamespace.MusicBrainz` or `RecordingNamespace.Local`; optional `artistNames`, `recordingCodes`, `durationMilliseconds`, and `artistCreditSource` carry additional evidence. `QueryableRecordingCatalog` wraps consumer lookup/search functions. `MusicBrainzRecordingCatalog` is a separate HTTP option; a database-only provider does not silently contact MusicBrainz. `StreamingServiceRecordingQuery` uses the application server's authenticated read-only catalog routes without sending Spotify credentials there.

`MemoryAssociationStore` is bounded and ephemeral. Supply account-scoped durable storage if confirmed preferences should survive a restart. Metadata fingerprints, matching policy, catalog namespace, and market are revalidated on reuse.

Handle every `MatchStatus` instead of taking the first candidate:

| Result | Consumer action |
| --- | --- |
| `Matched` | Use `selected`; preserve the candidate evidence for presentation or diagnostics |
| `Ambiguous` | Present acceptable choices and require an explicit user selection |
| `NotFound` | Keep the existing playback destination and show that no acceptable recording was found |
| `Failed` | Handle the sanitized `failure` category, including rate limits and authorization |

`translateToRecording` performs the reverse lookup. After a deliberate selection, `confirmAssociation` saves an association after revalidation; searching alone does not save a confirmation. Candidate scores rank evidence and are not confidence percentages.

Recording preparation can run while no Jam session is loaded. Submission to a live queue still requires a current authorized session and the relevant owner or guest permission. Preparation does not imply that an enqueue was accepted.

## Controllable queue synchronization

`ControllableQueuePort.read` must return an actual queue snapshot with a real scope identifier, revision, occurrence identifiers, current occurrence, and the optional `complete` flag when known. Recording identifiers describe catalog items; occurrence identifiers describe distinct queue positions, so repeated tracks remain separate.

`ControllableQueuePort.apply` receives the expected scope and revision, desired entries, current occurrence, and operation identifier. The adapter must enforce compare-and-set at the actual mutation and return the actual accepted snapshot and operation identifier. A request acknowledgement alone is not proof that a queue changed. The coordinator rereads both sides after matching, rejects stale snapshots, issues a scoped CAS write, and suppresses only its exact acknowledged revision from echoing.

Complete source snapshots describe all source occurrences, including entries not yet mapped. Partial snapshots (`complete: false`) cannot justify removing unseen destination entries. When completeness is omitted and mappings remain unresolved, the coordinator also preserves known destination entries conservatively. Unmapped current recordings preserve the working destination; unknown future recordings are treated according to source completeness. Failures are not speculative echoes and a new synchronization can recover from a prior failed match. The queue coordinator does not poll, invent queue occurrences, trigger background work, or automatically replay an uncertain mutation. The application owns triggers, lifecycle, and uncertain-state reconciliation. See [CONTROLLABLE_QUEUE_PROGRESS.md](CONTROLLABLE_QUEUE_PROGRESS.md).

Compose the coordinator directly from real consumer ports, or pass the same dependencies through `SpotifyJamDependencies.controllableQueues` to expose `runtime.queueSynchronization`:

```ts
import { QueueSide, QueueSynchronizationCoordinator } from 'streaming-service-spotify-jam';
import type { ControllableQueueDependencies } from 'streaming-service-spotify-jam';

declare const queueDependencies: ControllableQueueDependencies;
declare const queueCancellation: AbortSignal;
const synchronization = new QueueSynchronizationCoordinator(
  queueDependencies.local,
  queueDependencies.spotify,
  queueDependencies.mapper,
  queueDependencies.operationIdentifiers,
);

const result = await synchronization.synchronize(QueueSide.Spotify, queueCancellation);
synchronization.dispose();
```

`QueueSide.Spotify` copies the local queue toward Spotify; `QueueSide.Local` copies the observed Spotify queue toward the local player. Inspect `result.applied`, `result.unresolvedOccurrenceIdentifiers`, and the returned accepted `result.snapshot` before updating the UI. These calls require real consumer adapters. They do not enable arbitrary remote edits on their own. See [`contracts/controllableQueue.ts`](contracts/controllableQueue.ts) for every receipt field.

## Failures and recovery

Typed failures distinguish authorization, permission, unsupported operation, missing recording, rate limiting, stale work, and uncertain outcomes. A new queue synchronization cancels its predecessor. Consumers must submit a new intent for a new current song; matching failure on an earlier song must not latch onto the replacement. Canceling stale matching does not erase a real transport cooldown.

A mutation with an uncertain outcome is not automatically retried. Passive membership refresh can recover membership state, but it cannot prove what happened to a playback or queue write. Those fences need explicit `sessions.reconcileSharedState` with an injected verifier and fresh scope checks. Completed receipts remain unchanged; recovery does not replay the original mutation. Optional membership and hosted-queue observers use an injected scheduler when polling is enabled.

## Limits and verification

Deterministic package tests cover matching, cancellation, session guards, queue mapping, stale revisions, acknowledgements, and recovery. These checks use injected contracts and do not prove live Spotify permissions, equality of two real queues, accepted guest appends, audible alignment, or background behavior on a physical device.

The mobile integration owns those device scenarios. Earlier emulator observations are not complete acceptance: cross-account guest permissions, live queue mutations, audible timing, and background/reconnect behavior remain unverified. See [mobile acceptance notes](../StreamingServiceMobile/SPOTIFY_JAM_ACCEPTANCE.md) and [VALIDATION.md](VALIDATION.md) for the distinction between source checks and device evidence.

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md): component and dependency ownership
- [FEATURES.md](FEATURES.md): feature coverage and focused tests
- [VALIDATION.md](VALIDATION.md): evidence categories and open checks
- [LOGIN.md](LOGIN.md) and [LIBRESPOT_AUTH.md](LIBRESPOT_AUTH.md): browser and native authentication
- [CONTROLLABLE_QUEUE_PROGRESS.md](CONTROLLABLE_QUEUE_PROGRESS.md): queue adapter contract and recovery
- [SHARED_PLAYBACK.md](SHARED_PLAYBACK.md), [HOSTED_PLAYBACK.md](HOSTED_PLAYBACK.md), and [SHARED_STATE_RECONCILIATION.md](SHARED_STATE_RECONCILIATION.md): playback and uncertainty
- [TRANSITIVE_IMPORT_MATCHING_PROGRESS.md](TRANSITIVE_IMPORT_MATCHING_PROGRESS.md): current importer equivalence rules
- [PROGRESS.md](PROGRESS.md): current implementation status

The related Player and Mobile checkouts are separate repositories. The mobile app's local file dependency expects the sibling directory layout documented in its [README](../StreamingServiceMobile/README.md).
