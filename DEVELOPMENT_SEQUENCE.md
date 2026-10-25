# Remaining Spotify Jam development

Active queue: [IMPLEMENTATION_QUEUE.md](IMPLEMENTATION_QUEUE.md). The user now
requires continuing through items 1–5 until end-to-end completion; iOS is deferred.

Updated 2026-10-25 after user-confirmed Android sign-in. Work proceeds in chapters
with dedicated feature tests and owning repository commits. Implemented code,
user reports, agent-observed live tests and unfinished protocol work are tracked
separately.

| Area | Existing implementation | Remaining development or validation |
| --- | --- | --- |
| Authentication | Device/browser pairing, native Login5, secure storage, renewal/restore; user confirms Android sign-in | Phone restart/expiry/account-change checks; recovery improvements if these reveal failures |
| Host Jam membership | Create/share/refresh/end and foreground observation | Create/share/passive refresh and native restore succeeded with the new independent login; guest admission and end cleanup are tracked in current mobile progress |
| Song translation | Bidirectional MusicBrainz/Spotify matching, compatible catalog provider, candidate confirmation and app-song queue selection | Live catalog access and ambiguous/unavailable-song cases across accounts |
| Guest membership | Invitation parsing and experimental join/leave | Establish private join/device registration and permission behavior using two controlled accounts; complete reliable guest operation |
| Shared queue | Host-targeted enqueue and host queue observation | Guest command routing, authoritative shared occurrences/revisions and reconciliation after uncertain or competing edits |
| Playback together | Synchronization core, native authority leases, approximate foreground following and explicit owned-host playback controls | Fresh guest playback events/controls, measured alignment and drift correction; owned-host controls need a live active-device check |
| App as playback host | Jam creation exists | Publish playback authority, local track/position and accepted shared commands so Spotify participants can follow the app; Jam creation alone does not implement this |
| Background lifecycle | Foreground recovery and native safety watchdog | Continuous native observation/synchronization through backgrounding, lock screen, network changes and reconnect |
| iOS | OAuth proof-key/browser/storage boundaries and player authority infrastructure | Native Librespot sign-in bridge, complete linked build and device execution |

Recommended order: validate host create/share/end and restart/renewal with the
working login, prove guest membership and fresh state with a second account,
then complete shared queue and both playback roles before continuous background
transport. The remaining items include real implementation work, not only tests.

No developer application client ID or installed Spotify client is needed for the
primary Android sign-in. The optional developer OAuth method remains available.
Current queue submission still requires an active Spotify host device; the app
has not become an independent Spotify playback host merely by creating a Jam.
See HOSTED_QUEUE.md, HOSTED_PLAYBACK.md and PLAYBACK_SYNC_PLAN.md for the exact
existing contracts and protocol evidence still required.
