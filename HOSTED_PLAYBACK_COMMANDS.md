# Hosted playback controls

Implemented 2026-10-25. Enable enableHostedPlaybackCommands and supply playbackClock
when composing SpotifyJamRuntime. A caller may inject playbackCommandProtocol
instead. Construction sends no network requests. sessions.capabilities.playbackControl
means an adapter is available, not that Spotify accepted a live command or a guest
has permission.

sessions.executeHostedPlayback(command, requestIdentifier) supports Play, Pause,
Next, Previous and Seek from HostedPlaybackCommandKind. Seek also requires
positionMilliseconds and expectedSpotifyTrackIdentifier. A command is copied on
submission. The coordinator requires an owned active Jam and its real host device;
it never falls back to another selected device or a guest's account queue.

Commands share membership/enqueue serialization, pending bounds and request receipt
storage. A repeated request identifier with the same target and payload shares its
receipt. Reuse for another command/session/host is rejected. Account replacement,
host/session changes and late completions are fenced. A command queued behind a
host change returns Superseded without marking the replacement membership failed.

The adapter makes a fresh playback read before mutation. The existing reader
validates the host device, supported track and timing. Seek additionally rejects
changed tracks and targets at or beyond duration, preventing Spotify's documented
behavior of advancing to the next track for an excessive position. This is a
preflight check: the public API has no atomic track-occurrence precondition, so a
track transition after the read can still race a seek. It does not establish
private guest routing or authoritative shared queue revisions.

Play/Pause/Seek use PUT and Next/Previous use POST, with explicit device_id.
Acknowledgement must be empty. Permission/rate-limit rejections remain typed.
Transport failure after dispatch, server failures and malformed acknowledgements
have UnknownOutcome and are never retried automatically. The connection's
playback outcome fence survives passive membership refresh. An injected
sharedStateVerifier enables explicit sessions.reconcileSharedState recovery after
fresh owned membership and native state verification. A new deliberate command
uses a new request identifier; old uncertain receipts remain unchanged. Reads
failing before mutation retain their original failure category. See
SHARED_STATE_RECONCILIATION.md.

The mobile Jam screen exposes explicit host controls and a seconds-based seek
input. Seek captures the current track before submitting and the adapter checks
it again. Busy/guest/unavailable/uncertain states disable controls. Runtime and
membership replacement abort pending preparation and discard late UI results.
Accepted commands are reflected through subsequent Spotify observations; the
local follower never sends commands merely because it accepted a remote target.
Following remains approximate and foreground-only.

Primary protocol references:
- https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback
- https://developer.spotify.com/documentation/web-api/reference/pause-a-users-playback
- https://developer.spotify.com/documentation/web-api/reference/seek-to-position-in-currently-playing-track
- https://developer.spotify.com/documentation/web-api/reference/skip-users-playback-to-next-track

Dedicated tests: tests/hosted-playback-commands.test.mjs (19); mobile
tools/spotify-playback-commands.test.cjs (12) and
tools/spotify-playback-controls-screen.test.tsx (8 rendered cases).
Live command effects and audio alignment still require an active host device.
The independent-login test created a Jam with no active host, so it did not
establish these effects.
