# Foreground host playback following

Implemented 2026-10-24. The mobile app has an explicit **Replace queue and follow
Spotify** action. It reads the hosting account's active Spotify device, matches
the playing track to the local catalog and plays that local recording through
StreamingServicePlayer. Spotify continues to supply the playback position.

The source is the documented authenticated
[Get Playback State endpoint](https://developer.spotify.com/documentation/web-api/reference/get-information-about-the-users-current-playback).
Its public OAuth scope is `user-read-playback-state`. Runtime reads require an
active owned Jam, its actual host device and an unchanged account/session/host
binding after the request. Guest membership never enables this source. Missing
playback, episodes, unavailable/local Spotify tracks, unknown progress and a
different active device are rejected.

The reader samples local monotonic time before and after HTTP. It anchors progress
at the request midpoint and carries half the round trip as timing uncertainty;
round trips exceeding 1.5 seconds are rejected. The response's Unix `timestamp`
means the last playback-state change. It is retained as metadata and never
subtracted from a native or JavaScript monotonic clock. An old paused-change
timestamp can accompany a freshly read paused state.

The mobile controller polls every two seconds, with one request outstanding.
It assigns local sequence and execution identifiers. These are cancellation and
execution fences; the endpoint supplies no authoritative Jam queue occurrence
IDs or remote revision. A changed track prepares a new local execution. Seeking
or replaying the same Spotify track updates its existing local execution through
position correction. Observations cannot reconcile an uncertain enqueue.

Matching is cached for the current track and country. Ambiguous or absent local
recordings hold audio while polling for a different track. Restart following to
retry after changing a confirmed association. Matching does not silently choose
an ambiguous recording. Local recording lookup remains account-bound and uses
the existing authenticated server catalog projection.

The action replaces the local queue. Stop, Spotify disconnect, account/Jam/host
replacement and backgrounding retire polling and release native authority.
Stop remains pending until native acknowledgement. A native watchdog pauses
after five seconds without renewal even if JavaScript or observation stops.
Expired leases can be reclaimed explicitly after JavaScript restart; active
leases cannot be stolen. Foreground return does not automatically restart audio.

This is approximate foreground host following. Polling, transport delay, remote
buffering that the public endpoint does not describe, local seek completion and
audio-output latency limit alignment. No audible alignment or physical-device
result has been measured. The implementation is not a private guest playback
feed, app-led Spotify clock, or continuous native background transport.

The library's normalized synchronization/output contracts are described in
[SHARED_PLAYBACK.md](SHARED_PLAYBACK.md). Dedicated reader/runtime cases are in
`tests/hosted-playback.test.mjs`; the mobile's real controller/synchronizer/native
adapter combination is exercised by `tools/spotify-shared-playback.test.cjs`.
