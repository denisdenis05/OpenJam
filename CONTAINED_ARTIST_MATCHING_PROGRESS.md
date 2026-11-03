# Contained recording artist matching — 2026-11-03

Strict matching now requires an exact normalized base title, removing only the
existing bracketed feat/ft clauses, and a complete normalized artist set contained
in the other complete set. This handles canonical local group credits against
expanded Spotify recording credits in both directions. It does not use fuzzy
artist scores, require the importer to find the identical database row, or accept
arbitrary overlap between two different multi-artist sets. Empty normalized artist
names cannot establish containment.

Duration remains optional. Live/remix/version labels remain meaningful title text;
there is no separate version acceptance gate. Explicit unavailability, conflicting
recording codes and release-only artist fallback retain their acceptance guards.
An exact importer result can still corroborate release-level credits under the
existing same-recording/title/shared-artist checks. The importer remains a fallback
when strict evidence does not select a match.

Equivalent candidate grouping applies the same exact base title and pairwise
artist containment to every independently acceptable competitor. It preserves
pairwise known-code compatibility, stable representative selection and ambiguity
for different non-contained collaborator groups. The default policy version is
recording-evidence-v4, so stored v3 confirmations are revalidated in both directions.

Dedicated fixtures in tests/catalog-contained-artists.test.mjs model Americas
Most Blunted, Rainbows and Shadows Of Tomorrow with canonical Madvillain credits
and expanded recording artists, including feat/ft title annotations and missing
duration. These are deterministic metadata fixtures, not new live catalog captures.
The suite also checks unrelated artists, non-contained collaborator sets,
conflicting codes, unavailability, release-only fallback, equivalent releases,
meaningful version titles, skipped importer requests and actual v3 association
invalidation in both translation directions.

Existing importer fixtures now deliberately use release-level provenance, ensuring
malformed/foreign/suggested/duplicate results, cancellation and runtime disposal
continue to exercise the actual import fallback. The strict-success fixture uses
recording provenance. Superseded tests now accept canonical artist subsets; no
importer failure or lifetime tests were removed.

Verification: npm test passes architecture checks, TypeScript and 751 tests.
The dedicated contained-artist suite has 13 cases; the existing expanded/import
suite has 47. No API request, Spotify process change, playback action or APK build
was performed. Mobile owns integrating this policy and verifying the actual
missing queue positions with the retained session and deployed catalog.
