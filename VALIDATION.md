# Validation

Experimental membership follow-up: `npm run check`, `npm test`, and
`npm run build` passed with 162 deterministic cases across ten files, including
30 membership cases and 16 account-current cases. `git diff --check` passed.
These tests use injected transports. Separately, a scoped account-current live
probe verified passive HTTP 200 JSON during an owned Jam and HTTP 404 when absent;
temporary creation/deletion succeeded and no native session remained. No live
guest admission, queue synchronization or audio playback result is claimed.
Earlier counts below describe the initial library chapter.

The mobile follow-up passed 65 Node feature/integration cases, 11 rendered-screen
cases, full app TypeScript, seven workspace player checks and 319 player-mobile
cases. Its real controller/gateway/library performed an owned Jam lifecycle on a
Node host. Private profile verification and two public short-invitation samples
passed. Public profile/device APIs returned 429. Android packaging is documented
in the mobile repository's SPOTIFY_JAM_APK.md; no physical-device execution or
guest admission result is claimed.

Executed on 2026-10-21. Host tools: Node.js 26.11.1, TypeScript 5.0.4,
.NET SDK 10.0.112 targeting the existing net9.0 server, and disposable
PostgreSQL 18.6. Dependency resolution is recorded in each owning lockfile.

Package review finished on 2026-10-22. `npm pack --dry-run --json` ran the
prepack build successfully and listed 58 files, including 52 compiled JavaScript
and declaration files. Core, contract, session protocol and React entry points
were present; tests and dependencies were excluded. No package was published.

| Check | Result |
| --- | --- |
| Library `npm run check` | Architecture checks and strict TypeScript passed |
| Library `npm test` | 116 deterministic cases across eight feature test files passed |
| Library `npm run build` | CommonJS output and declarations built |
| Mobile `npm run test:spotify` | Focused strict compilation and 12 cases passed |
| Mobile `./node_modules/.bin/tsc --noEmit --pretty false` | Full application type check passed |
| Mobile `npm run test:player-integration` | Seven existing player workspace integration cases passed |
| Server catalog filter with disposable PostgreSQL | All 12 cases passed, including two actual database cases |
| Android production JavaScript bundle | Passed; 19 asset files |
| iOS production JavaScript bundle | Passed; 15 asset files |

The server filter was:

```bash
dotnet test StreamingServiceServer.CoverTests --filter 'FullyQualifiedName~SpotifyRecordingCatalogTests' --no-restore --nologo
```

Its database fixture requires `COVER_TEST_POSTGRES` pointing at a disposable
Unix-socket PostgreSQL instance under `/tmp`. The run used
`/tmp/spotify-jam-postgres-socket`, port 55439, with the cluster data under
`/tmp/spotify-jam-postgres-data`. The cluster was started and stopped within the
same shell invocation. Separate tool invocations did not preserve its running
process; the first cross-invocation attempt failed to connect, then the combined
invocation passed. No application database was used.

JavaScript bundles were built with the mobile React Native CLI, platform
`android` or `ios`, entry point `index.js`, and `--dev false`. Outputs are under
`/tmp/spotify-jam-mobile-android` and `/tmp/spotify-jam-mobile-ios`. These checks
include the startup-imported Spotify composition boundary. They are not native
APK/IPA builds, device executions, or proofs of foreground/background behavior.

## Broader server suite

`dotnet test StreamingServiceServer.CoverTests --filter 'Category!=Postgres'
--no-restore --nologo` produced 148 passes, two skips, and one failure:
`AudioImportSafetyTests.ImportDestinationCannotEscapeMusicRootOrTraverseDirectoryLinks`.
It expects `InvalidDataException`; the unchanged `MusicLocationHelper` throws
`InvalidOperationException` for the invalid relative path before publication.
Neither that helper, import code, nor its test was edited for this work. The
full suite is therefore not green, despite the new catalog suite passing.
Existing server assembly-version/nullability warnings also remain.

## Live Spotify evidence

The actual public `SpotifyJamRuntime` performed this controlled cycle:

1. Passively refresh the current device and confirm no session is present.
2. Create/activate a session and observe ownership and invitation availability.
3. Passively refresh the created session.
4. End the session.
5. Passively refresh again and confirm no session remains.

All five command receipts reported applied. The HTTP implementation separately
received HTTP 200 for fresh creation/deletion. Passive status requires a matching
`device_broadcast_status.device_id`; missing/mismatched envelopes are rejected
rather than interpreted as an absent session.

Sanitized local research reports are in the workspace's
`spotify-jam-research/evidence/production-runtime-lifecycle.json` and
`production-library-probe.json`. Credentials stayed in the probing process's
memory and were supplied from the current user's desktop session. This verifies
the session protocol, not independent mobile credential acquisition.

A Spotify Web API catalog probe returned HTTP 429, so no successful live
catalog access or end-to-end real-catalog matching is claimed. The earlier
invitation-info request returned HTTP 404. No second-account join, pushed event
stream, real Android/iPhone scenario, or playback synchronization was verified.

The React selector cases exercise the production hook through a controlled hook
boundary. They are not mounted React Native screen tests. Source checks and
manual review supplement behavior tests and do not prove all SOLID or naming
requirements automatically.
