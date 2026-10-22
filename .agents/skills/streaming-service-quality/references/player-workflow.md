# Related project references

For this library, start with [PROGRESS.md](../../../../PROGRESS.md),
[ARCHITECTURE.md](../../../../ARCHITECTURE.md),
[FEATURES.md](../../../../FEATURES.md),
[IMPLEMENTATION_PLAN.md](../../../../IMPLEMENTATION_PLAN.md), and
[VALIDATION.md](../../../../VALIDATION.md).

The current implementation is TypeScript and HTTP integration, without a native
audio engine or bridge. If subsequent work includes native player integration,
read the original player's [workflow reference](../../../../../StreamingServicePlayer/.agents/skills/streaming-service-quality/references/player-workflow.md)
and its current linked platform documents. Preserve native queue ownership,
account/generation fencing, independent listening reports, and exactly one
selected local audio engine.

Keep host tests, JavaScript bundles, native packaging, physical-device behavior,
and measurements separate. This library's bundle results do not establish
background Spotify connectivity, guest participation, or playback correctness.
