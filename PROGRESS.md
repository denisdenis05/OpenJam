# Spotify library progress

Updated 2026-10-22. The user approved the library plan and required the project's
streaming-service-quality skill for implementation. This repository is separate
from the player, mobile, and server repositories. No player engine was changed.

## Chapter 1 — library, catalog matching, and verified session lifecycle

Implemented the private `streaming-service-spotify-jam` package, strict compiler
and package tooling, project skill/instructions, public contracts, source checks,
and dedicated feature tests. React selectors live in a separate entry point.

The catalog layer accepts ID/title/author records and optional recording evidence.
Implemented MusicBrainz and caller-query adapters, the server projection adapter,
Spotify Web API catalog access, bidirectional matching, explicit ambiguity,
confirmation, fingerprint invalidation, many-to-many associations, market
isolation, and bounded defensive memory storage. Recording versions, conflicting
recording codes, and release-only artist credits veto automatic selections.

The session layer implements injected credential loading/renewal, guarded HTTP
execution, regional origin injection, fresh Jam creation, owned-session deletion,
and passive status for a selected Spotify device. Snapshots are copied and omit
credentials/invitations. Commands are ordered, bounded, locally deduplicated, and
fenced against old account completions. Unknown mutation outcomes prevent further
mutations until passive reconciliation succeeds. Detachment never ends a remote
shared Jam.

Added `SpotifyJamRuntime` composition and optional React selectors. The mobile
repository links/builds this package, loads its connection owner at startup,
clears ownership on logout/account changes, and passively refreshes a configured
Spotify device when the app resumes. The server repository owns the authenticated
read-only catalog query and its PostgreSQL tests.

Validation:

- Final package review on 2026-10-22: `npm pack --dry-run --json` passed its
  prepack build and included compiled core/contracts/React entries without tests
  or dependencies. No package was published.
- Library `npm run check`, `npm test`, `npm run build`: passed; 116 cases across
  architecture, association storage, matching, providers, session, networking,
  selector, and runtime suites. See FEATURES.md for functionality mapping.
- Mobile `npm run test:spotify`: passed strict focused compilation and 12 cases.
  Full application TypeScript checking and seven existing player-integration
  cases passed. Android/iOS production JavaScript bundles passed.
- Server catalog filter: 12 passed including two disposable PostgreSQL cases.
  Full non-PostgreSQL regression: 148 passed, two skipped, one untouched
  audio-import exception-type mismatch failed. See VALIDATION.md.
- Public production runtime: passive status, create, refresh, end, and passive
  status all applied against the current account. No Jam remained active.
- Live Spotify catalog access: HTTP 429; no success claimed. Invitation-info:
  earlier HTTP 404. Guest participation, live pushed observation, device runtime,
  and independent mobile authentication remain unverified.

## Chapter 2 — playback protocol research and proposed plan

On 2026-10-22 the user authorized investigation of playing together and an
additional agent. Applied the project skill and REA's bundled investigation
workflow. One agent independently reviewed the player bridge and pinned librespot
reference while the main agent inspected the installed client and ran probes.

Observed native playback/queue schemas, independent Dealer membership pushes,
and an independent inactive observer snapshot (HTTP 200, cleanup 204). The
snapshot was stale and differed from the installed client's paused/buffering
track. No remote listening, fresh cross-account playback stream or audible
synchronization is established. The temporary Jam was removed and the observers
did not change active playback. No production code or capability flag changed.

REA parsed four selected playback source excerpts without parse failures, with
unknown/partial semantic coverage. Native layout provider was unavailable; no
native decompilation claimed. Embedded protobuf descriptors were decoded by a
separate bounded extraction. Research scripts/probes are not production tests;
no library/device test or performance result is claimed for this docs chapter.

Read PLAYBACK_PROTOCOL_RESEARCH.md for evidence and limits, and
PLAYBACK_SYNC_PLAN.md for the proposed six-chapter implementation. The next gate
is controlled two-account admission and fresh state delivery. The plan awaits
user approval before implementation.

## Resume work

1. Obtain a second controlled account for guest validation. An asynchronous
   question was sent to the user; no second account was supplied during this
   implementation. Do not claim guest join/leave or invitation resolution works.
2. Establish mobile credential acquisition/renewal independently of desktop
   debugging. The provider contract and coordination are implemented; no login
   flow, cookie extraction, credential relay, or companion dependency was added.
3. Resolve the info lookup failure and inspect the real session subscription
   connection/envelopes. Keep unsupported capability flags false until validated.
4. Validate real catalog access after rate limits permit and run cross-catalog
   examples using real candidates, preserving ambiguous results for selection.
5. Run actual Android/iOS foreground, account, cancellation and transport-policy
   scenarios. Native background execution and playback synchronization need
   separate designs. No performance improvements have been measured.

Record future chapters with exact functionality tests and live/device limits.
Keep credential material and extracted Spotify resources outside this repository.
Commit relevant changes only in their owning repository; do not push implicitly.
