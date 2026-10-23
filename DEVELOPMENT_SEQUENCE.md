# Remaining Spotify Jam implementation

Authorized 2026-10-23. Work proceeds in chapters with dedicated tests and owning
repository commits. A protocol or live-validation gate is not silently treated
as successful because an adapter compiles.

| Chapter | Implementation | Live gate |
| --- | --- | --- |
| Authentication | PKCE login/renewal/secure restoration implemented; private credential admission remains unverified | Registered OAuth client not supplied; private Jam OAuth access unverified |
| App song selection | Implemented: local recording → candidates → explicit selection → host queue | Catalog access previously rate limited |
| Shared queue | Implemented host observation; guest routing and authoritative reconciliation require protocol evidence | Fresh shared/guest queue not established |
| Joining | Implemented foreground membership observation/recovery; join/leave remain experimental | Second controlled account missing |
| Playback together | Unimplemented: verified fresh remote playback/command protocol is required before a native follower | Fresh remote playback feed and two-output measurement missing |
| Persistent login | Implemented account-owned refresh storage/restoration and durable forget | OS keychain/device tests required |
| Mobile lifecycle | Implemented foreground recovery, iOS proof-key and secure storage boundaries; native background shared transport remains open | Native background and iOS/device tests required |

Current production login requires a registered public Spotify client ID and exact
callback. No official Spotify client identifier is borrowed. Research identified the native authentication boundary but could not capture a
fresh private guest/playback stream without a desktop debugging endpoint and a
second controlled client. Desktop credential reuse is research evidence only. Implementation can continue on
independent components while external admission gates remain pending.
