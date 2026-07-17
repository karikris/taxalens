# Current geographic interface audit

Status: accepted current-state audit; no product behavior changed

Audit date: 2026-07-17

TaxaLens SHA: `e85b0d225cfdad4932de95d745b936ae85a61097`

Scope: `GeographicWorkloadMap`, its DuckDB-Wasm query and projection helpers,
Dashboard styles, Evidence Lens geography, unit tests, browser tests, and
visual snapshots.

## Current product boundary

The existing view is an operational **Flickr candidate-workload map**. It
answers where BioMiner grouped Flickr acquisition work; it does not compare
baseline occurrence evidence with Flickr candidate evidence and it does not
measure geographic contribution. That operational meaning is worth preserving
as a separate Flickr Workload Map.

The map is mounted in Dashboard and remains idle until the user selects
**Load verified workload map**. It uses no basemap, boundaries, tiles, country
hierarchy, baseline occurrence rows, verification consensus, quality snapshot,
or release decision.

## Data inputs and calculations

`GeographicWorkloadMap` calls `loadAnalyticsReplayInput()` and then selects two
artifact IDs itself:

| Artifact | Rows | Bytes | Source commit |
| --- | ---: | ---: | --- |
| `biominer-flickr-geo-assignments-parquet` | 13,501 | 633,625 | `75461d9c065af0cd96b41cd1f845c2e920f7ae34` |
| `biominer-flickr-geo-clusters-parquet` | 77 | 22,573 | `75461d9c065af0cd96b41cd1f845c2e920f7ae34` |

The query creates two in-memory DuckDB views. It calculates assignment count,
outlier count, `unassigned_geo`, `no_geo`, and distinct `geo:*` cluster count.
It then joins per-cluster outlier totals to cluster centroid, image count, cell
count, P95 dispersion radius, target key, and candidate-only flag. The current
fixture exposes 76 located clusters, 792 unassigned geotagged rows, 707
outliers, and zero no-geo rows through this query.

The map projects longitude and latitude directly onto a 360 by 180
equirectangular SVG plane. Marker radius is:

```text
2.5 + sqrt(member_image_count / maximum_member_image_count) * 8
```

The non-zero 2.5 radius offset improves visibility but means area is not
proportional to count. The current caption says marker area “encodes” workload
without claiming exact proportionality. The Geographic Impact Lens still
needs the separately specified shared scale contract and exact caption.

P95 radius is cluster dispersion, not coordinate uncertainty. The interface
correctly says so. No H3 identity is present in the imported cluster view.

## Scientific and review semantics

The current copy consistently calls the points candidate workload and rejects
an occurrence claim. The query also rejects a wrong target key, invalid
coordinates, a non-positive member count, or a cluster without
`candidate_distribution_only=true`.

`reviewDensity` is hard-coded to `null`. Its reason says no materialized review
queue or geographic reviewer assignments are committed. That statement now
combines two different facts:

- 49 Flickr audit items are materialized in the committed verification
  campaign, so a review queue does exist;
- the committed Supabase assignment and event snapshots are empty, and the
  map does not bind campaign items or consensus to geographic cells.

The correct current conclusion is that geographic review density is **not
calculated**, not that all review work is absent. Zero retained human outcomes
means potential candidate contribution must remain distinct from
human-supported and release-ready contribution.

## Visual design and interaction

The SVG contains a rectangle, latitude/longitude grid lines, and one circle per
located centroid. It contains no land geometry, continent, country, admin1,
country label, or geographic slicer. Selection changes fill and stroke, while
all workload markers otherwise share one blue presentation.

The two-column layout places the plane beside a selected-cluster definition
list and collapses to one column below 60rem. Below 44rem, metrics and facts
stack, and the complete table uses an intentionally scrollable 48rem minimum
width.

The selected cluster exposes exact centroid, candidate count, coarse-cell
count, outliers, dispersion, missing H3 identity, and missing review density.
The complete table exposes exact values for every cluster, and provenance is
inspectable in a separate disclosure.

## Accessibility

Existing strengths:

- the SVG has `role="img"` and a generated summary label;
- the select control gives keyboard users a complete cluster-selection path;
- selected facts and the table expose exact values as text;
- table headers use row and column scope;
- completion and failure state is in a polite live region;
- layout has narrow-screen overflow protection;
- functional browser coverage checks that no external HTTP origin is used.

Existing gaps:

- circles are not focusable and expose no per-circle accessible name, selected
  state, tooltip, or keyboard action;
- selecting a cluster does not select or focus the corresponding table row;
- table rows cannot drive map selection;
- the SVG's overall label cannot replace a per-feature accessible model;
- state is communicated by the select and details panel, but there is no
  formal legend or shape/stroke vocabulary;
- no automated accessibility-tree or color-independent interpretation audit
  covers the loaded map.

The future impact map therefore needs renderer-independent shared selection,
an always-available synchronized table, exact-count descriptions, and visible
keyboard focus. The existing workload view can retain its simpler operational
interaction until its planned compatibility-preserving rename.

## Evidence Lens geography

Evidence Lens currently projects one inspected Flickr coordinate onto a styled
coordinate plane. It correctly labels the point as a search candidate, not an
occurrence, and withholds metric uncertainty. It exposes cluster metadata,
source rights, reference shortfalls, and a candidate-versus-competitor evidence
boundary.

It is not yet the required record mini-map. It has no country or spatial-cell
identity, nearby baseline cells, nearest-baseline distance, temporal
comparison, contribution state, map deep link, cell-record list, baseline
provenance action, or direct geographic Verification action.

## Performance and lifecycle

Existing strengths:

- DuckDB-Wasm and the Parquets are lazy and do not start at application
  bootstrap;
- files are same-origin, byte-counted, SHA-256 verified, and checked for
  Parquet magic before query use;
- the database connection closes, registered files drop, and the worker
  terminates in `finally`;
- only 76 circle nodes are rendered for the current fixture.

Existing gaps:

- each reload creates a fresh database and rereads both complete Parquets;
- the SQL views use `SELECT *` before the focused queries;
- there is no query cache, stale-query cancellation, component-unmount guard,
  or abort signal;
- an older request can still update React state after a later request or
  unmount;
- no elapsed time, bytes scanned, memory, feature-count budget, or cache state
  is reported;
- product code itself enforces the fixture-specific 13,501 assignment count.

## Test coverage and limitations

Current unit coverage verifies idle/loading/ready rendering, two-cluster
selection, table presence, coordinate projection, and three radius examples.
The component test injects a result; it does not run the real DuckDB query.
There is no direct Vitest coverage of `executeGeographicWorkload`.

The mobile Playwright journey runs the real local query and checks the 76
circles, selected cluster, 76-row table, exact fixture metrics, provenance, no
external origin, and no document-width overflow. It does not test cancellation,
worker failure, keyboard-only feature selection, table-to-map selection,
tooltips, empty clusters, extreme scaling, or a second project.

The 1280×720 dashboard visual snapshot is captured before the lazy map query
and does not contain the map. Both judge-layout and reduced-motion screenshot
helpers explicitly mask the workload SVG. Consequently, there is no current
visual-regression evidence for actual map geometry, circles, focus, selection,
or extreme values.

## Hard-coded and fixture-coupled values

- The component filters two literal analytics artifact IDs.
- The executor maps those IDs to two literal filenames.
- The executor rejects any assignment total other than 13,501.
- Summary validation depends on replay fields projected from the Papilio
  fixture.
- Unit and E2E expectations name 76 clusters, 792 unassigned rows, 707
  outliers, and exact Papilio cluster IDs and coordinates.
- The Evidence Facade itself pins bundle ID, TaxaLens SHA, BioMiner SHA, target,
  artifact versions, and multiple Papilio counts; the bundle/facade audit is
  recorded in Subtask 0.1.2.

## Decision for later phases

Preserve this view's operational semantics and lazy local execution. Rename it
to Flickr Workload Map in the dedicated compatibility task. Build Geographic
Impact as a separate evidence-comparison interface backed by generalized
bundle contracts, baseline-provider deduplication, precision-aware shared
cells, verification and release states, offline boundaries, and an accessible
map/table interaction model.
