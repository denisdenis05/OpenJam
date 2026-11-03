# Equivalent local identifiers in import matching — 2026-11-03

Source changes are uncommitted as requested by the user. This chapter changes
only the package translator, deterministic tests and Markdown notes.

An exact playlist-import mapping to another local recording identifier no longer
fails solely because its database identifier differs from the captured source.
The translator loads the actual mapped recording, checks its returned identity,
and requires the ordinary strict ranker to establish equivalence with the source.
This requires exact normalized base title and compatible contained complete artist
credits; release-only credits, unavailable recordings and known recording-code
contradictions cannot establish that proof. The imported local recording must also
pass the existing imported title/shared-artist/code/availability checks against
the actual Spotify candidate. The final source/candidate checks remain unchanged.

This can bridge credit differences only when actual metadata provides an
intermediate equivalent recording. No artist alias table, fuzzy overlap rule,
foreign identifier bypass or fabricated recording was added. Missing/unrelated
metadata remains unconfirmed. Exact source-identifier mappings keep the previous
lookup-free fast path; successful strict matching still skips the importer.

Reverse translation retains actual imported local records and can corroborate an
existing searched recording through the same strict metadata proof. Repeated
searched identifiers cannot borrow proof from a contradictory later metadata
instance. Extra lookups are deduplicated within the captured bounded import batch;
suggested matches perform none. In-flight lookup waits are cancellation-aware,
including runtime disposal, and late uncooperative results cannot become matches.

Dedicated tests in tests/catalog-import-equivalence.test.mjs cover forward and
reverse equivalent identifiers, missing metadata, unrelated titles/artists,
unproven alias-like overlap, source/mapped/candidate recording-code and availability
guards, release provenance, lookup deduplication and candidate limits, malformed
lookup identities, both-direction cancellation, late completions, runtime disposal,
strict skip, direct-ID fast path, suggested results and duplicate-ID metadata.
The existing foreign-ID rejection/import lifetime tests remain unchanged.

Verification: npm test passes architecture checks, TypeScript and 775 cases,
including all 24 dedicated transitive import cases. These tests use injected
synthetic catalogs and no real Spotify requests. Live missing queue positions,
canonical server artist projection and APK integration remain owned by the root
session. No API, device, process or playback action occurred in this chapter.
