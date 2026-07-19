# Geographic Impact Task 4.4 report

Status: complete and pushed to `main`

## Revisions and evidence identity

- TaxaLens starting SHA: `9b7f176a7e5115960ec36155dacbfc00a3338706`
- TaxaLens subtask gate SHA: `486a9ef175591c21a8b809086c43e9eb03b0c388`
- BioMiner baseline evidence origin:
  `247b42f3206d48bb79e2dbf97c5a92e4f207ae71`
- BioMiner Flickr evidence origin:
  `75461d9c065af0cd96b41cd1f845c2e920f7ae34`
- BioMiner local `main` observed at the task gate:
  `efd8d1ce3b5d3a81932e16fbdee246caa715dbf9`
- Materialized impact artifact SHA-256:
  `97b2422657d79bc8e682c4e51358c0316f6c942a31fea9ed608ef2c4ba420d94`
- Geographic Impact manifest:
  `geographic-impact-manifest:7f6d74f020db6cc4b4ba93dd0284b399a58163f49af1e9186ce45585feba40d3`
- Baseline snapshot: `gbif-occurrence-search-20260715`
- Flickr snapshot: `flickr:2026-07-15`
- Codex session: `019f65d0-3ca9-7870-9eb2-37c14ed02517`
- Primary model: `configured-model`
- Reasoning effort: `xhigh`

BioMiner advanced independently while this task ran and retained unrelated
untracked files. No moving BioMiner content was imported. The selected panel,
ranking, table and screen-reader summary read only the checksum-verified
TaxaLens materialization whose evidence origins are pinned above.

## Selected geography details

One lifted spatial-cell identity now controls the exact detail panel, table
selection, map popup and selected-cell stroke. With no selected cell, the
panel summarizes the complete selected scope; after selection it reports only
that cell.

The panel exposes:

- baseline union, range-inference-eligible and excluded occurrence totals;
- GBIF-only and iNaturalist-origin-through-GBIF composition;
- direct iNaturalist delta as unavailable rather than zero;
- duplicates removed and unresolved provider duplicate groups;
- pending, target-positive, non-target, uncertain and release-ready Flickr
  states;
- candidate-only, human-supported additional and release-ready additional
  cells;
- nearest-baseline distance;
- latest credible baseline and Flickr candidate dates; and
- sufficient, data-deficient and unavailable baseline states.

Temporal copy compares artifact dates without calling the Flickr candidate a
new occurrence. Missing baseline evidence is explicitly unknown rather than
proof of biological absence.

## Country ranking

The country comparison aggregates the verified cells by canonical country
code and supports five closed metrics:

- Potential coverage-gap cells;
- Human-supported additional cells;
- Release-ready additional cells;
- Range-edge distance; and
- Review backlog.

Exact metric values determine ordering, followed by country name and code for
deterministic ties. Cells without canonical country identity remain visible as
an excluded count and are never assigned to a nearby country. The selected
metric also controls bounded map-feature ordering. The committed replay has
zero human-supported and zero release-ready outcomes, and the ranking keeps
those values at zero.

## Synchronized exact-value table

The Geographic Impact Lens now includes an ordinary native HTML table with:

- a descriptive caption;
- row headers;
- sortable header buttons and `aria-sort`;
- exact integer and distance values;
- 25-row pagination;
- deterministic spatial-cell tie-breaking;
- native, keyboard-operable selection buttons; and
- an explicit selected-row state.

Selecting a row updates the shared cell identity, exact detail panel, map
popup and a declarative violet external highlight stroke. A map selection
moves the table to the page containing that cell. The table loads from the
verified Parquet worker even when WebGL is unavailable; it does not depend on
renderer properties or marker geometry.

## Screen-reader and non-color summary

A visible textual summary and one atomic polite live region report:

- selected scope and spatial resolution;
- exact cell count;
- exact eligible baseline and Flickr candidate totals;
- exact pending, reviewed-positive, reviewed-negative, uncertain and
  release-ready totals;
- exact contribution-cell totals; and
- the selected cell's evidence state.

The summary explains evidence states through ring, fill, excluded mark, dash
and dark external stroke descriptions. Blue and amber are never the sole
meaning carrier. Unchanged derived messages are not republished to the live
region.

## Commits

- `32a98e1` — `feat(map): add selected geography details`
- `4d3da72` — `feat(map): rank geographic contribution`
- `7e0c820` — `feat(map): add accessible impact table`
- `486a9ef` — `feat(map): add accessible geographic summaries`

GitHits records `geo-impact-4.4` and `geo-impact-4.4.1` through
`geo-impact-4.4.4` are present. The table and screen-reader searches returned
reviewed MIT and Apache-2.0 approaches and received positive feedback. Country
ranking had no quality-threshold focused result and therefore used the local
closed metric and artifact contracts. No external implementation or sample
data was copied wholesale.

## Verification

- Python suite: 890 passed.
- Frontend suite: 446 passed, one skipped; 135 files passed, one skipped.
- The first frontend run executed concurrently with the Python suite and had
  one lazy Agent Trace timeout; its exact test and the complete standalone
  frontend suite both passed immediately afterward.
- Focused details, ranking, table, selected-layer and screen-reader tests:
  passed.
- TypeScript project check: passed.
- Production build and local distribution verification: passed.
- Chromium table-to-map keyboard selection: passed.
- Chromium no-WebGL table fallback: passed.
- Chromium external-origin network guard: passed with zero external requests.
- Geographic materialization verifier: 20,237 cells and zero mismatches.
- Truthful judge fixture, BioMiner boundary, geographic boundary and
  provenance verifiers: passed.
- `git diff --check`: passed.

No retained human outcome, human-supported contribution or release-ready
occurrence candidate was created by this task. Skip and Can't view remain
excluded by the upstream materialization contract.
