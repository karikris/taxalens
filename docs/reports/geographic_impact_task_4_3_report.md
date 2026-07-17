# Geographic Impact Task 4.3 report

Status: complete and pushed to `main`

## Revisions and evidence identity

- TaxaLens starting SHA: `fd3fd3283dc60db98301756ce94077a682ba35fa`
- TaxaLens subtask push SHA: `3c0b9934a7c2db4c5dffa91d62c581d07292d101`
- BioMiner baseline evidence origin:
  `247b42f3206d48bb79e2dbf97c5a92e4f207ae71`
- BioMiner Flickr evidence origin:
  `75461d9c065af0cd96b41cd1f845c2e920f7ae34`
- BioMiner local `main` observed after the task gate:
  `0208c0fbc2e9e92374ac0cadc49643113d5d0c8b`
- Materialized impact artifact SHA-256:
  `97b2422657d79bc8e682c4e51358c0316f6c942a31fea9ed608ef2c4ba420d94`
- Geographic Impact manifest:
  `geographic-impact-manifest:7f6d74f020db6cc4b4ba93dd0284b399a58163f49af1e9186ce45585feba40d3`
- Baseline snapshot: `gbif-occurrence-search-20260715`
- Flickr snapshot: `flickr:2026-07-15`
- Codex session: `019f65d0-3ca9-7870-9eb2-37c14ed02517`
- Primary model: `gpt-5.6-sol`
- Reasoning effort: `xhigh`

BioMiner advanced independently while this task ran and had unrelated
untracked content at the gate. No moving BioMiner `main` content was consumed.
The two exact evidence-origin commits above and the committed TaxaLens
materialization checksum remain the only inputs to this map slice.

## Artifact-first browser path

The public shell continues to load and migrate its truthful v1 judge fixture.
It does not invent v2 bundle sections. When the Geographic Impact Lens opens,
Vite serves the committed 559,441-byte impact-cell Parquet as a same-origin
asset. TaxaLens verifies its byte count and SHA-256 before registering the bytes
with the pinned DuckDB-Wasm runtime and local Parquet extension.

The query selects only the preaggregated map columns and binds every read to the
project, run, accepted taxon, baseline snapshot and Flickr snapshot. It uses
resolution 3 for Global, resolution 5 for a continent, and resolution 7 for a
country or future admin1 scope. A scoped result above 5,000 cells fails closed.
Workers are terminated after each scoped query, and aborted scope queries
cannot publish stale results.

At Global resolution the verified artifact provides:

- 2,155 preaggregated cells;
- 19,201 baseline-union rows represented across cells;
- 630 range-inference-eligible baseline observations;
- 13,416 geographically supported Flickr candidates;
- 13,416 pending candidates;
- zero retained reviewed-positive, reviewed-negative or uncertain outcomes;
- zero release-ready occurrence candidates; and
- a shared absolute scale domain of 0–416 records.

Direct iNaturalist delta remains explicitly unavailable. The map does not
fabricate a provider comparison.

## Shared bubble scale

The immutable scale contract exposes:

- `sqrt_absolute` and explicitly selected `log_absolute` modes;
- the shared baseline/Flickr count domain;
- a 3 px minimum visible radius;
- a 28 px maximum radius;
- deterministic exact-count legend values; and
- zero-count behavior of `hidden`.

The default square-root transform is shared by both evidence layers. Positive
values are clamped to the disclosed visibility floor, so neither product copy
nor tests claim that marker area is exactly proportional. The required caption
is shown verbatim:

> Bubble radius uses a square-root count scale; exact counts appear in the tooltip.

## Evidence layers

Blue filled circles use the deduplicated range-inference-eligible baseline
count by default. Raw baseline union and derived excluded totals remain
inspectable in the selected-cell tooltip.

Flickr evidence is amber and uses color plus shape or stroke:

- hollow amber ring — unreviewed candidate;
- solid amber — human-reviewed target positive;
- amber ring with exclusion cross — human-reviewed non-target;
- dashed amber ring — uncertain; and
- solid amber with a dark external stroke — release-ready occurrence
  candidate.

MapLibre circle layers provide the filled and hollow states. Because MapLibre
has no `circle-dasharray` property, TaxaLens creates two original 64×64 RGBA
images in memory for the dashed and excluded shapes and registers them with the
local map. No sprite, image, font or glyph request is made. Synthetic tests
protect every maturity state, while the public replay truthfully renders only
pending Flickr rings because its retained human outcome counts are zero.

The tested overlap order is baseline, pending, reviewed positive, reviewed
negative, uncertain, then release-ready. This keeps the gated release stroke
outermost while preserving all state-specific feature queries.

## Legend and exact cell tooltip

The legend is semantic HTML outside the WebGL canvas. Every swatch is paired
with a full text label, exact scope total and renderer-matched description.
Bubble examples come from the same scale object used by the map, and the
legend exposes the domain, mode, radius limits and hidden-zero behavior.
Zero-count reviewed and release-ready rows remain visible so judges can see
the evidence architecture without being told that outcomes exist.

The disclosure says that release-ready is a gated subset of reviewed-positive
evidence and reports Skip plus Can’t view separately as excluded from
human-supported contribution.

Clicking an evidence marker resolves the renderer identity back to the original
immutable feature. The local dismissible popup therefore reads exact typed
integers rather than renderer-coerced properties. It shows baseline union,
eligible and excluded totals; Flickr candidate and visually eligible totals;
all review-state counts; contribution flags; nearest-baseline distance; and
data-deficiency state. Clicking a bubble does not accidentally drill into the
underlying country.

## Commits

- `881a1e45f322b6f4255da30b8245f5be918d9e09` —
  `feat(map): add geographic bubble scale`
- `7266239869980daf5f3898384c5c2b6003e93cde` —
  `feat(map): render baseline occurrence evidence`
- `eda35f0fc8f08052b34a2d44e5f2c76625e41f8b` —
  `feat(map): render Flickr candidate evidence`
- `09fed64b541f28811c1a95991ba42b882b8e2d20` —
  `feat(map): add impact legend`
- `3c0b9934a7c2db4c5dffa91d62c581d07292d101` —
  `feat(map): explain geographic evidence cells`

GitHits records `geo-impact-4.3` and `geo-impact-4.3.1` through
`geo-impact-4.3.5` are present. Broad and focused searches that returned no
usable source received negative feedback. Pinned MapLibre, React MapLibre,
DuckDB-Wasm and d3-scale source supplied the reviewed approaches. Every record
contains adopted and rejected patterns and licence notes; no external
implementation was copied.

## Verification

- Full frontend suite: 435 passed, one skipped; 131 files passed, one skipped.
- Focused scale, feature, layer, icon, legend, tooltip and map tests: passed.
- Shared-domain, zero, extreme-skew and log-mode scale tests: passed.
- Evidence overlap order: passed.
- Color-independent legend interpretation: passed.
- TypeScript project check: passed.
- Production build and deployed map-notice verifier: passed.
- Chromium self-contained map and evidence-data network guard: passed.
- Chromium Global/continent/country scope, camera and history journey: passed.
- External-origin requests: zero in the guarded browser journey.
- Browser page errors: zero.
- Geographic boundary verifier: passed; 177 features, 175 selectable
  countries, seven continents and 508,277 verified runtime bytes.
- Judge-bundle, truthful-fixture, geographic-contract and parity tests:
  92 passed.
- Direct dependency and deployed notice verifiers: passed.
- npm audit: zero vulnerabilities.
- Provenance verifier: passed.
- `git diff --check`: passed.

No reviewed outcome, human-supported additional cell or release-ready cell was
created by this task. Candidate-only, reviewed-additional and release-ready
impact calculations remain the responsibility of the verified materialization
and later quality-gated product tasks.
