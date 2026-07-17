# TaxaLens — Devpost submission copy

## Tagline

Auditable biodiversity evidence from social media, from global coverage gaps to human review.

## Inspiration

Social-media searches can surface biodiversity candidates far beyond the places represented in a
selected baseline snapshot. But a search hit, provider label, coordinate, or model score is still a
hypothesis. Researchers need to see where evidence already exists, where candidate evidence could
matter, and exactly what review and release work remains.

We built TaxaLens to answer one bounded question:

> Where does baseline biodiversity evidence already exist, where has Flickr exposed additional
> candidate evidence, and what **potential geographic coverage contribution** could those
> observations make after human review and occurrence-release validation?

## What it does

The TaxaLens Geographic Impact Lens compares two evidence layers on a shared spatial grid:

- blue bubbles for a deduplicated baseline occurrence-evidence union; and
- amber markers for Flickr candidate evidence, with separate unreviewed, target-positive,
  non-target, uncertain, media-failure, skipped, and release-ready states.

Researchers can drill from global to continent to country, select an exact cell, inspect the same
values in an accessible table, open an individual candidate in Evidence Lens, follow its
coordinate-precision and nearest-baseline context, begin verification, ask a stored GPT-5.6
analyst to explain the artifact receipts, and export the selected scope with provenance and
checksums.

The public replay is deliberately honest. At global resolution 3 it contains 2,155 full-outer
cells, 19,201 canonical baseline observations, 13,416 geographically supported Flickr candidates,
and 1,221 potential coverage-gap cells. It contains zero retained human-reviewed Flickr outcomes,
zero human-supported additional cells, and zero release-ready occurrence candidates. Amber does
not mean a new scientific result.

## How we built it

BioMiner supplies immutable, checksum-bound baseline and Flickr geography artifacts. TaxaLens:

1. builds a canonical provider union that separates GBIF-only observations from iNaturalist-origin
   observations delivered through GBIF;
2. preserves the unavailable direct iNaturalist delta instead of fetching or fabricating it;
3. projects baseline and precision-supported Flickr candidates onto compatible H3 resolutions;
4. materializes deterministic full-outer cell joins and global, continent, and country rollups;
5. queries local Parquet artifacts in the browser with DuckDB-Wasm;
6. renders a self-contained MapLibre map from bundled Natural Earth boundaries, with no external
   tiles, fonts, sprites, telemetry, or analytics;
7. synchronizes the map with exact tables, slicers, breadcrumbs, record mini-maps, verification,
   QualitySnapshot gates, and deterministic exports; and
8. exposes six strict read-only geographic tools to a stored `gpt-5.6-sol` analyst replay.

The hosted judge route is static and credential-free. Supabase and Backblaze B2 remain optional
adapter contracts; committed repository mirrors make the replay inspectable without a cloud
account.

## Challenges we ran into

The hardest part was semantic, not cartographic. GBIF already delivers many iNaturalist-origin
observations, so simply adding provider totals would inflate the baseline. Flickr precision also
varies: unsupported fine resolutions must stay empty rather than becoming false local points.

Human review introduced another boundary. A positive review is not automatically release-ready,
and Skip or Can’t view cannot support geographic contribution. We therefore kept candidate-only,
human-supported, and release-ready cells separate and bound each stage to explicit consensus,
quality, coordinate, duplicate, provenance, and release evidence.

Finally, an offline analytical map still had to remain fast, accessible, keyboard-usable, and
truthful when WebGL or DuckDB-Wasm is unavailable. The synchronized exact table is a first-class
interface, not a fallback footnote.

## Accomplishments we are proud of

- A real global → continent → country → cell → record evidence journey.
- A provider union with 4,017 GBIF-only and 15,184 iNaturalist-origin-through-GBIF observations,
  with the direct iNaturalist delta explicitly unavailable.
- Evidence maturity communicated through colour plus fill, stroke, dash, and exclusion marks.
- Shared, tested square-root bubble scaling and exact values in tooltips and tables.
- Candidate-only, human-supported, release-ready, range-edge, temporal, and data-deficiency
  metrics without promoting hypotheses into occurrences.
- A mature append-only verification system with Can’t view, Skip, optional comments, consensus,
  conflicts, weighted sampling, confidence intervals, QualitySnapshot gates, and local event
  projection.
- Six deterministic GPT-5.6 geographic tools, artifact citations, a credential-free stored replay,
  and 24 safety evaluations.
- Chromium, Firefox, and WebKit coverage; visual and accessibility regression; bounded performance;
  and an external-network guard for the map.

## What we learned

Evidence maturity needs to be visible everywhere, not hidden in methodology. The map, table,
record context, analyst answer, and export must all agree on whether a cell is merely a candidate,
human-supported, or release-ready.

We also learned that an empty reviewed layer can be a strong product result. It proves the system
does not fill a persuasive visualization with machine labels when the retained human evidence is
zero.

## What’s next

The first scientific milestone is at least 20 genuine decisive Flickr audit outcomes with sampling
provenance. Those outcomes can produce the first valid geographic quality snapshot; they still do
not bypass occurrence-release gates.

We also plan to import a committed direct iNaturalist snapshot when one is available, run the
prepared human usability study with real participants, expand compatible hierarchy detail where
rights and precision support it, and publish reviewed evidence added only after its exact quality
and release requirements pass.

## Try it

Public replay: <https://karikris.github.io/taxalens/>

No login, API key, model call, map service, database, object-storage account, or BioMiner runtime is
required for the judge path.
