# Remaining Spotify Jam implementation

Authorized 2026-10-23. Work proceeds in chapters with dedicated tests and owning
repository commits. A protocol or live-validation gate is not silently treated
as successful because an adapter compiles.

| Chapter | Implementation | Live gate |
| --- | --- | --- |
| Authentication | PKCE login/renewal exists; investigate private credentials and eligibility | Registered OAuth client not supplied; private Jam OAuth access unverified |
| App song selection | Implemented: local recording → candidates → explicit selection → host queue | Catalog access previously rate limited |
| Shared queue | Implemented host observation; guest routing and authoritative reconciliation require protocol evidence | Fresh shared/guest queue not established |
| Joining | Existing experimental join/leave; finish membership observation/reconnect | Second controlled account missing |
| Playback together | Follow fresh playback state through local media, with authority and drift controls | Fresh remote playback feed and two-output measurement missing |
| Persistent login | Secure account-owned credential storage/restoration | OS keychain/device tests required |
| Mobile lifecycle | Resume/reconnect; iOS proof-key and secure storage boundary | Native background and iOS/device tests required |

Current production login requires a registered public Spotify client ID and exact
callback. No official Spotify client identifier is borrowed. The research agent
is investigating private native authentication and queue/playback paths; desktop
credential reuse is research evidence only. Implementation can continue on
independent components while external admission gates remain pending.
