# Shared playback execution contracts

Implemented 2026-10-24. `SharedPlaybackSynchronizer` follows normalized targets
through injected recording resolution, exclusive output leases, a monotonic
clock and a scheduler. Construction starts no network or audio work. The mobile
composition supplies the native output adapter; the library imports no player or
React Native implementation.

`SharedPlaybackIdentity` binds the Spotify account, Jam and authority. Targets
also carry a source-adapter sequence, execution occurrence, track identifier,
position/duration, local monotonic anchor/observation times, uncertainty and
play/buffer flags. Adapter sequences fence arrival within that adapter lifetime;
they do not imply Spotify supplied a global revision. An occurrence identifies
local execution. Remote queue identities require a separately verified source.
Changing authority requires a new attachment and releases the former lease.

Only increasing sequences with the bound identity are accepted. A single
occurrence cannot change recording identity. Mapping uses the existing catalog
matcher. Missing and ambiguous results hold playback, expose unavailable state
and stop automatic matching retries for that target. The mobile host controller
caches that decision while watching for another song.

Preparation must install one paused occurrence. The controller rechecks identity
after every asynchronous step, then computes position from the latest accepted
target after preparation. Local readiness, buffering and seekability are sampled
before execution. Reflected targets never call a remote-command interface.

Reconciliation runs once per second. Position correction uses a 250 ms threshold
plus source and local sampling uncertainty. Advancing anchors project only to
known duration, where output pauses without independent advance. Shorter local
media holds at its own end rather than repeatedly replaying its tail. Paused or
buffering targets do not advance. Observation age over five seconds, uncertainty
over 750 ms per sample or a backwards clock causes holding/error behavior.
Rate changes are not implemented; native output remains at normal rate.

`SharedPlaybackClockMapper` accepts explicit source-clock exchanges bracketed by
local monotonic send/receive times. It retains at most eight sequential exchanges,
intersects offset bounds and includes source precision plus a conservative named
100 ppm drift allowance. Round trips above two seconds and samples older than
one minute are rejected. Inconsistent bounds require reset for the new clock
generation. No current Spotify private clock exchange is assumed. The allowance
is configuration policy, not a measured device oscillator result.

An output lease must fence every native mutation against its account, engine,
authentication and lease identity, install paused media, sample actual readiness,
and release paused without restoring/advancing an earlier queue. It must reject
late operations after retirement. Cancellation of a JavaScript wait cannot undo
a native command already dispatched. The mobile adapter serializes commands and
waits for cleanup acknowledgement; native ownership checks reject late commands.

StreamingServicePlayer advertises `supportsExternalAuthority`. Older binaries
without the capability are rejected before claiming output. Android/iOS retain
one occurrence, suppress independent navigation/repeat/shuffle, guard app/system
commands, reset rate and pause on a native five-second renewal deadline. User
pause/stop suspends the lease so reflected play cannot undo that action. Account
clear releases it. Native output sampling brackets a fresh request in JavaScript
time instead of subtracting different clock origins.

Unit/host tests establish these contracts and state transitions. Native command
acceptance is not measured audible start or seek completion. Hardware timing,
private guest delivery, remote permission/control routing, app-led Spotify hosting
and continuous background synchronization remain separate implementation and
device gates. The existing host-only Web API source is documented separately.

Feature tests: `tests/shared-playback.test.mjs`, `tests/shared-clock.test.mjs`,
the player's `tests/external-authority.test.mjs`, Android `PlayerBehaviorTest`,
Swift `ExternalAuthorityCoordinatorTests`, and the mobile's
`tools/spotify-shared-playback.test.cjs` / `tools/spotify-shared-screen.test.tsx`.
