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

## Bundle and facade geography audit

Subtask 0.1.2 extends this report from the interface into the current bundle,
artifact, fixture, and product-loader boundary. It changes no runtime behavior.

### Current judge-bundle contract

The Python, TypeScript, and JSON Schema contracts all fix the bundle at
`taxalens-judge-bundle:v1.0.0`. They require exactly 25 named evidence
sections. The only geography-named section is `geographic_clusters`; the
contract has no sections for:

- `baseline_geographic_spread`;
- `baseline_provider_union`;
- `flickr_geography`;
- `geographic_impact_cells`;
- `geographic_impact_summary`;
- `country_hierarchy`.

Each v1 section has only availability, artifact IDs, reason, candidate
semantics, verification status, human-review requirement, and a scientific
claim flag. That is sufficient for evidence availability but cannot express a
baseline snapshot, Flickr snapshot, provider-union deduplication receipt,
spatial hierarchy, compatible cell resolutions, review-state reconciliation,
or occurrence-release gate.

Top-level identity contains bundle ID, one target, and TaxaLens/BioMiner source
revisions. It does not scope geographic reads by project ID, run ID, baseline
snapshot ID, and Flickr snapshot ID. Artifact inventory rows carry checksum,
row count, schema version, repository, and commit, but no typed dependency
relationships between baseline, Flickr, verification, hierarchy, and impact
artifacts.

`expected_ui_counts` repeats per-section and per-screen counts. The generic
contract validates those declarations against the inventory, which is useful,
but v1 cannot declare geographic rollup reconciliation or provider composition.
There is no v1-to-v2 migration path; unknown schema versions fail validation.

### Current fixture artifact geography

The public fixture is
`papilio-demoleus-prototype-74a7d648-v3`. Its manifest identifies TaxaLens
`fab9d3f1605d28d4bbfc3a4d0074f40e5ffff023` and BioMiner
`74a7d648a562efa744e6502ef504a23b63b4e02f`; its imported analytics come from
the older committed BioMiner artifact source
`75461d9c065af0cd96b41cd1f845c2e920f7ae34`.

The 30-artifact inventory contains four geography-related entries:

| Artifact | Role | Rows | Current use |
| --- | --- | ---: | --- |
| `biominer-flickr-geography-parquet` | `other` | 13,501 | Evidence Lens source-coordinate join |
| `biominer-flickr-geo-assignments-parquet` | `other` | 13,501 | Workload cluster assignment query |
| `biominer-flickr-geo-clusters-parquet` | `other` | 77 | Workload centroid query |
| `geographic-clusters` | `geographic_clusters` | 1 | Aggregate replay boundary |

The raw Flickr geography artifact already declares country code, admin1,
coarse/regional/local cells, coordinate quality, and geography warnings. None
of those fields is projected by the current Workload Map. Because all three
Parquets use role `other`, they cannot be requested through the typed
`loadSection` API; components select literal artifact IDs from the generic
analytics payload instead.

The fixture imports no `geographic_occurrence_evidence.parquet`,
`taxon_geographic_spread.parquet`, or `taxon_geographic_summary.parquet`.
Consequently, the public bundle contains no baseline occurrence rows and
cannot calculate provider composition, duplicate removal, baseline-only or
candidate-only cells, range-edge distance, temporal contribution, or data
deficiency.

The `geographic_clusters` section is partial, metadata-only, requires human
review, and allows no scientific claim. It references only the one-row JSON
summary, not the three Parquets.

### Verification projections available to geography

The public judge bundle contains one Commons campaign, three review items,
three media assets, zero decision artifacts, and zero quality artifacts. The
broader committed repository storage mirror contains four campaigns and 82
items, including 49 Flickr audit items, but still zero assignments, events,
consensus rows, quality snapshots, or retained human outcomes.

Neither representation currently binds Flickr verification item identity to
the Flickr geography row and spatial cells. The Workload Map therefore cannot
show pending, positive, negative, uncertain, media-failure, or release-ready
geographic states even though the campaign definitions now exist.

### Evidence Facade coupling

The frontend `EvidenceFacade` interface exposes only stored analyst replay,
the four-artifact analytics input, the four-artifact discovery input, and a
generic section loader. It has no typed geographic-impact input, summary,
hierarchy, or record-context methods.

`loadEvidenceFacade` is a fixture loader rather than a general project loader:

- module constants pin the exact bundle ID, TaxaLens SHA, current BioMiner SHA,
  legacy BioMiner SHA, verification manifest SHA, and verification-media SHA;
- `assertManifestSemantics` rejects any bundle other than that truthful pilot;
- one constant array names the four accepted analytics artifact IDs;
- analytics receipt schema, origin commit, and source-manifest fingerprint are
  hard-coded;
- discovery selects another literal set of four artifact IDs;
- projection functions assert exact Papilio artifact schemas, counts, states,
  and prototype values;
- the exported `replayEvidenceContract` repeats the fixture ID and SHAs.

There are 39 textual Papilio or exact geographic/workload count references in
the fixture builder, fixture verifier, and frontend facade search scope alone.
Exact-count checks are appropriate in the frozen fixture validator, but they
currently share files with reusable loading and projection logic.

The Python repository also has two different concepts named `EvidenceFacade`:
the earlier general JSON-demo facade in `taxalens/product/facade.py`, and the
frontend judge-bundle facade. Neither is currently a bundle-version-neutral
`TaxaLensProjectFacade` with typed geographic loaders.

### Fixture builder and verifier coupling

`truthful_demo.py` owns fixed Papilio bundle, target, created-at, source SHA,
hero ID, verification-manifest SHA, media SHA, artifact allowlist, schemas,
section counts, and generated replay outputs. `truthful_demo_verifier.py`
correctly enforces the same closed fixture with exact artifact IDs, schema
versions, checksums, source commits, rights, attribution, counts, stored replay,
and blocked scientific semantics.

This strictness is a strength for the competition replay but should become a
`PapilioJudgeFixtureValidator`, invoked after the general bundle loader and
v1-to-v2 migration. Moving exact values out of reusable loading must not weaken
the frozen fixture checks.

### Contract limitations to resolve in bundle v2

1. Add the six required geographic-impact sections as typed roles rather than
   `other` artifacts.
2. Add project, run, target, baseline snapshot, and Flickr snapshot identity to
   every geographic read boundary.
3. Add typed provider-union and impact manifests that can prove input SHAs,
   duplicate handling, compatible resolutions, and rollup reconciliation.
4. Keep expected counts manifest-derived in reusable code; preserve exact
   counts and admitted SHAs in the Papilio fixture validator.
5. Add an explicit v1-to-v2 migration that retains every v1 artifact, right,
   attribution, and source SHA while marking absent geographic-impact sections
   unavailable.
6. Fail reviewed contribution without retained review evidence and fail
   release-ready contribution without complete occurrence-release evidence.
7. Generalize artifact selection through typed section roles and loader methods
   rather than component-owned literal ID filters.
