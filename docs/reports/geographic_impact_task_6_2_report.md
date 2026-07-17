# Geographic Impact Lens Task 6.2 Report

## Scope

Task 6.2 adds record-level Geographic Impact context to Evidence Lens while
preserving coordinate precision, candidate semantics and occurrence-release
gates. TaxaLens started the task on `main` at
`b656ae47154d43882c62bd639693c2c23d7b4e77` and completed the four numbered
subtasks at implementation head
`c87e256ac114a72334b103851c62174745626581`.

The public campaigns still contain zero retained human outcomes. The selected
Flickr record is not in the committed public audit campaign, has no decisive
review and is not release-ready.

## Record geographic context

The Evidence Lens now starts a separate bounded geographic query only after
the researcher explicitly inspects the verified discovery record. The query
verifies and loads two same-origin artifacts:

- the 941,398-byte precision-aware Flickr geography verification Parquet with
  SHA-256
  `c414d2db442acc372029a4cc6d0a02d57a7f4e8495efd93ef2faa2499c32084d`;
- the 639,681-byte Geographic Impact cells Parquet with SHA-256
  `a02927ffbb4dc09fca582c61e6ceab51af6d12f8998cf0f7762ebfe26a4ea1c9`.

The record join is scoped by project, run, accepted taxon, baseline snapshot,
Flickr snapshot, source, photo ID, source-record hash, spatial resolution and
cell identity. It selects only the finest supported artifact row and converts
at most eight same-resolution baseline cell centroids to browser objects.

For the deterministic hero `flickr:55081300254`, the committed evidence is:

- exact candidate coordinate `59.366308, 18.031366`;
- coordinate quality `flickr_street`, Flickr accuracy level 16;
- selected H3 resolution 7 cell `87088660cffffff` in Sweden;
- zero baseline-union and zero range-inference-eligible rows in the selected
  cell;
- 414 Flickr candidates, all pending in the materialized cell;
- zero reviewed target-positive and zero release-ready rows;
- candidate-only, data-deficient state;
- nearest same-resolution baseline cell `871968a00ffffff` at
  1,084.7683635043893 km.

These values identify a potential coverage-gap cell. They do not identify a
new occurrence, biological absence or confirmed range extension.

## Mini-map and facts

The record mini-map uses the exact Flickr coordinate for its hollow amber
marker, same-resolution baseline cell centroids for fixed-size blue markers,
and a dashed line to the artifact-declared nearest baseline cell. Country
outlines come from the bundled public-domain Natural Earth data. The component
makes no tile, font, sprite, geocoding, telemetry or analytics request.

Marker size is fixed by evidence role and is explicitly not presented as a
record-count scale. Text beside the map provides coordinate quality, country,
cell, exact baseline and Flickr counts, review state, nearest-baseline distance,
potential contribution and data-deficiency state.

## Actions and deep links

Evidence Lens provides four record actions:

- Open Geographic Impact;
- View records in this cell;
- Verify this result; and
- Inspect baseline provenance.

Geographic links encode a validated hierarchy scope, H3 resolution, cell and
focus target. The scope's configured map resolution must match the cell
resolution. Geographic Impact restores the selected cell from the URL,
preserves it while the asynchronous map data loads, synchronizes details and
the exact table, and places keyboard focus on either the lens or selected table
row.

Verification continues to use the exact committed candidate-intake campaign
and item route with Evidence Lens as its return view. Baseline provenance is an
inline disclosure of the snapshot, artifact digest, selected-cell counts and
nearest baseline cell; it does not open a live provider or claim that a digest
proves scientific truth.

## Precision boundary

The shared precision policy treats `cell_supported` and
`cell_support_status` as authoritative. It never derives a fine child cell
from a coarse coordinate. The Evidence Lens lists each configured resolution,
marks the current and supported coarser rows, and uses explicit disabled text
for unsupported rows.

Regression coverage includes:

- world and country precision: no comparison cell;
- region precision: resolution 3 only;
- city precision: resolutions 3 and 5;
- street precision: resolutions 3, 5 and 7;
- unknown precision: no comparison cell;
- invalid coordinate: no comparison cell; and
- missing/no-geography: no comparison cell.

A country-scoped map link that requires resolution 7 is unavailable for a
region-precision record rather than falling back silently or manufacturing a
local cell.

## Commits

- `4c6199a` — `feat(evidence): add record geographic context map`
- `b5981de` — `feat(evidence): explain geographic contribution`
- `05dc4ac` — `feat(evidence): link geographic actions`
- `c87e256` — `fix(evidence): respect coordinate precision in map`

GitHits records `geo-impact-6.2` and `geo-impact-6.2.1` through
`geo-impact-6.2.4` are present. The single broad GitHits attempt did not
return after more than 150 seconds, so it was recorded unavailable and was not
retried for focused subtasks. No external implementation was copied.

The local root `AGENTS.md` and relevant `docs/agents/` guidance were read after
the user announced their update. Those operator/agent-pack files were not
modified or staged as part of this task.

## Verification

- Full frontend suite: 512 passed, one skipped; 147 files passed, one skipped.
- Focused record, precision, deep-link, table and map tests: 32 passed across
  seven files.
- Python Flickr geography handoff and precision tests: 14 passed.
- TypeScript project check: passed.
- Production build, offline-map distribution check and public review-media
  verification: passed.
- Provenance verifier: passed.
- BioMiner boundary verifier: passed and recorded
  `provenance/biominer_state/biominer_boundary_20260717T191133Z.json`.
- `git diff --check`: passed.

The new Chromium record-route journey is committed but could not start in this
container. The installed headless Chromium binary is missing the host library
`libnspr4.so`; Playwright stopped before creating a browser page. This remains
an environment blocker and is not reported as a browser pass.

## Upstream and scientific boundary

Record geography consumes the pinned BioMiner Flickr handoff at
`75461d9c065af0cd96b41cd1f845c2e920f7ae34`; baseline spread remains pinned at
`247b42f3206d48bb79e2dbf97c5a92e4f207ae71`. During the final boundary check,
the concurrently changing local BioMiner checkout was at
`477eaface3d1f5efa51255550f0ef8d6a7740f35` with staged and untracked work. It
was not consumed or modified.

The scientific boundary remains unchanged: a Flickr result is candidate
evidence until human review and every configured occurrence-release gate pass.
No local navigation, map selection or review intent creates release evidence.
