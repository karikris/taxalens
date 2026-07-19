# Geographic Impact Lens architecture

Status: accepted

Decision date: 2026-07-17

Scope: TaxaLens Geographic Impact Lens, geographic evidence semantics, and
offline judge replay

## Context

TaxaLens currently provides a Flickr candidate-workload map. It plots cluster
centroids from two operational Parquets on a coordinate plane. It does not
compare those candidates with baseline occurrence evidence, bind human-review
or release state, or support administrative drilldown.

BioMiner defines multi-resolution baseline spread and precision-aware Flickr
cells on one hierarchical grid. TaxaLens must adapt those artifacts into a
research interface without turning a query match, provider label, positive
review, missing baseline row, or map symbol into a stronger scientific claim
than its evidence supports.

## Decision

TaxaLens will add **Geographic Impact Lens** as a separate evidence-comparison
workspace. The existing operational view remains Flickr Workload Map.

The lens answers:

> Where does baseline biodiversity evidence already exist, where has Flickr
> exposed additional candidate evidence, and how much verified spatial or
> temporal coverage could those Flickr observations add after human review and
> release-gate validation?

The word *could* is material. A Flickr candidate remains a hypothesis until
human review and the occurrence-release gates pass.

## Scientific vocabulary

### Baseline occurrence evidence

**Baseline occurrence evidence** is the canonical, conservatively
deduplicated union of occurrence observations in one declared baseline
snapshot. Its identity includes project, run, target accepted taxon,
snapshot, provider-union policy, grid, and contract versions.

The default mapped baseline count is the number of canonical observations
eligible for range inference. Raw, georeferenced, excluded,
preserved-specimen, fossil, coordinate-issue, and unresolved-duplicate totals
remain inspectable and are never silently converted into the default count.

GBIF evidence and iNaturalist-origin evidence delivered through GBIF are not
added as independent observations. Direct iNaturalist observations contribute
only an independently materialized delta after conservative cross-provider
deduplication. When no direct snapshot exists, the direct iNaturalist delta is
**unavailable**, not zero.

### Flickr candidate evidence

**Flickr candidate evidence** is a source Flickr photo admitted by a committed
candidate artifact and scoped to the selected project, run, target, and Flickr
snapshot. Search terms, comments, provider taxon labels, model outputs, and
cluster membership explain discovery; none independently establishes the
depicted taxon or an occurrence.

Only spatial cells supported by the source coordinate precision may be used.
Invalid, missing, world-level, country-only, or otherwise coarse coordinates
remain visible through explicit quality states and are not assigned invented
finer cells.

### Reviewed evidence

**Reviewed evidence** is Flickr candidate evidence with an effective,
append-only human-review projection. Its outcome remains one of:

- target positive;
- non-target;
- uncertain;
- media failure;
- pending or deferred.

A target-positive result requires the configured decisive review or consensus
and checksum-verified media display. A non-target decision is reviewed
evidence but cannot support target occurrence contribution. Can't tell is
uncertain. Can't view is a media failure. Skip is deferred work. Can't view
and Skip never count as human-supported contribution.

Target-positive examples from a failure-discovery or otherwise targeted queue
may be displayed as reviewed examples, but they do not support unweighted
population-quality inference. A `QualitySnapshot` determines whether any
aggregate quality claim is valid.

### Release-ready evidence

A **release-ready occurrence candidate** is reviewed target-positive Flickr
evidence for which every configured occurrence-release gate passes. The
minimum gate set is:

- decisive positive consensus or valid adjudication;
- accepted target identity and complete review-event lineage;
- coordinates valid at the selected supported resolution;
- duplicate and observation-group gate;
- applicable quality and sampling gate;
- complete source, snapshot, rights, date, and provenance identity;
- an explicit occurrence-release decision bound to the evidence fingerprints.

Human-reviewed target-positive and release-ready are distinct states. A local
browser review event may update the reviewed layer, but it cannot create a
scientific release decision by itself.

## Evidence-state presentation

The primary evidence colors are blue for baseline occurrence evidence and
amber for Flickr candidate evidence. Flickr maturity also uses shape, fill,
dash, and stroke so color is never the sole signal:

| State | Visual contract | Scientific meaning |
| --- | --- | --- |
| Baseline occurrence evidence | blue filled bubble | deduplicated selected-baseline evidence; range-inference eligible by default |
| Unreviewed candidate | hollow amber ring | Flickr candidate awaiting a decisive review |
| Human-reviewed target positive | solid amber bubble | human-supported candidate; not automatically release-ready |
| Human-reviewed non-target | amber excluded marker | inspected evidence excluded from target contribution |
| Uncertain | dashed amber ring | Can't tell or unresolved review conflict |
| Release-ready occurrence candidate | solid amber with dark external stroke | positive candidate with complete occurrence-release gates |

Media failure, Skip, invalid geography, and no-geo remain explicit filter and
table states. They do not acquire one of the supporting marker styles.

Every state has legend text, a screen-reader description, exact-count text,
and a synchronized table representation.

## Provider union

The **baseline provider union** is the only baseline count source. It retains a
canonical observation plus all provider relationships and distinguishes:

- GBIF-only observations;
- iNaturalist-origin observations delivered through GBIF;
- a direct iNaturalist delta, when a committed snapshot exists;
- exact cross-provider duplicates removed;
- unresolved provider duplicate groups.

The union never deletes an ambiguous coincident observation merely to improve
a deduplication total. Its matching hierarchy, canonical identity, and count
reconciliation are defined in the companion baseline-provider-union ADR.

## Spatial grid and resolutions

Geographic comparison requires an explicit grid name and version. The initial
BioMiner handoff uses the `hierarchical_global_grid` H3 backend and configured
resolutions:

- coarse: 3;
- regional: 5;
- local: 7.

These values are artifact identities, not universal product constants. A
bundle may declare another compatible resolution set, but every source in one
comparison must declare compatible grid and resolution identities. Unknown,
mixed, or unverified identities fail closed.

Flickr precision limits take precedence over the selected UI resolution. The
query may roll a fine supported cell up to a coarser parent. It must not infer
a fine child cell from a coarse coordinate. Unsupported finer comparison is
unavailable and explained at record and aggregate level.

Administrative scope and spatial resolution are independent controls. A
country can be compared using coarse, regional, or local supported cells; the
country boundary does not manufacture a cell identity.

## Drilldown scopes

The canonical public and judge-facing scope is **global**. Stored analyst
replays, hosted release checks, README captures, judge routes, and presentation
copy do not hard-code a named country or candidate record as the project's
representative geography. This prevents an unreviewed search result from being
mistaken for a biological occurrence merely because it made a convenient test
fixture.

Administrative drilldown remains available as an optional researcher action.
Automated browser coverage selects any required regional scope from the
checksum-verified hierarchy at runtime; isolated contract tests use clearly
synthetic identities. A named place shown after an artifact-backed user
selection is evidence context, not a TaxaLens occurrence claim.

The scope hierarchy is:

1. global;
2. continent;
3. country;
4. admin1.

Each scope has a stable identifier, parent, label, bounds, and available child
list in the bundled country hierarchy. The lens supports map selection,
slicers, breadcrumbs, keyboard selection, and deep links. Every geographic
read remains scoped by project ID, run ID, accepted taxon key, baseline
snapshot ID, and Flickr snapshot ID.

Changing scope changes the shared count domain and rollup but not evidence
semantics. Global, continent, country, admin1, and cell totals must reconcile
under one verified input identity.

## Spatial contribution states

Contribution states are calculated only when the selected baseline is
available and compatible.

### Candidate-only spatial cell

A **candidate-only spatial cell** satisfies:

```text
baseline range-inference-eligible union count = 0
AND Flickr candidate count > 0
```

Its judge-facing label is **Potential coverage-gap cell**. It is absent from
the selected baseline snapshot, not evidence of biological absence and not a
new occurrence.

### Human-supported additional cell

A **human-supported additional cell** satisfies:

```text
baseline range-inference-eligible union count = 0
AND human-reviewed target-positive count > 0
```

The artifact field may be named `reviewed_additional_cell` for contract
continuity, but product copy uses **Human-supported additional cell**. Skip,
Can't view, uncertain, non-target, and unresolved conflict outcomes do not
satisfy it.

### Release-ready additional cell

A **release-ready additional cell** satisfies:

```text
baseline range-inference-eligible union count = 0
AND release-ready occurrence-candidate count > 0
```

Every contributing row must pass the occurrence-release gates. A cell cannot
be made release-ready by an aggregate count when any contributing identity or
gate is missing.

Potential, human-supported, and release-ready spatial coverage uplift are
reported separately. Uplift is unavailable when its selected baseline
denominator is zero.

## Candidate range-edge distance

**Range-edge distance** is a deterministic geodesic distance from a Flickr
candidate's supported cell centroid, or another explicitly declared supported
geographic representative point, to the nearest range-inference-eligible
baseline cell at the same comparison resolution.

The result records method, unit, grid, resolution, source and destination cell,
and baseline snapshot. It is an approximation determined by cell resolution,
not the distance to a proven biological range boundary. It is unavailable
when the candidate has no supported cell, the baseline has no eligible cells,
or the nearest-cell calculation cannot be verified.

Product copy may say **candidate range extension** only with its maturity
state: potential, human-supported, release-ready, data-deficient, or
unavailable. It must not make an unqualified biological range-expansion claim.

## Temporal contribution

**Temporal contribution** compares a dated Flickr candidate with the latest
credible baseline event date under the same selected target and scope. It
records both dates, date precision, maturity state, and the signed interval.

Potential, human-supported, and release-ready temporal contribution are
separate. Missing, partial, invalid, or incomparable dates make the metric
unavailable. A more recent Flickr date does not by itself establish an
occurrence or biological change.

## Data deficiency

**Data-deficient baseline** means the selected snapshot is insufficient for a
requested inference. It never means the species is biologically absent.

Reasons are additive and inspectable, including:

- no baseline rows in the selected snapshot or scope;
- preserved specimens or fossils only;
- too few range-inference-eligible observations or occupied cells;
- high or unknown coordinate uncertainty;
- geospatial issues or unsupported spatial resolution;
- outdated or missing baseline dates;
- insufficient provider coverage or unavailable direct iNaturalist delta;
- unresolved provider duplicates;
- unresolved taxon identity or incompatible registry/snapshot identity.

Availability, data deficiency, candidate-only state, and review maturity are
separate fields. The interface must not encode all four in one nullable count
or one color.

## Bubble scaling and exact counts

Baseline and Flickr bubbles use one tested scale module and one count domain
for the selected scope. The default mode is `sqrt_absolute`; an explicitly
selected `log_absolute` mode may be offered for extreme skew.

The scale contract exposes domain minimum and maximum, mode, minimum visible
radius, maximum radius, legend values, and zero-count behavior. Exact counts
appear in tooltip, selected-geography details, and table.

If a non-zero minimum radius is used, the caption is exactly:

> Bubble radius uses a square-root count scale; exact counts appear in the
> tooltip.

TaxaLens does not claim that bubble area is exactly proportional to count.

## Accessible map and table

The renderer is an enhancement, not the sole evidence interface. The
synchronized table is always available and contains the same exact scoped
values, contribution states, provider composition, review maturity, quality
state, and provenance as the map.

Required interaction behavior:

- map, slicers, breadcrumbs, details, and table share one controlled selection;
- selecting a map feature selects and identifies the corresponding table row;
- selecting a table row updates the map and details;
- every selection and action is keyboard accessible with visible focus;
- screen readers receive scope, evidence-state, exact-count, and selection
  summaries;
- legend wording plus fill, stroke, dash, and marker shape make interpretation
  independent of color;
- tooltips are supplemental and never the only exact-value surface;
- without WebGL or map rendering, drilldown, table, record links, verification,
  and exports remain usable.

## Self-contained network policy

The hosted judge replay is credential-free and self-contained. Runtime map
startup and interaction may request only verified same-origin replay assets.
Country boundaries, hierarchy, style, fonts, sprites, data, worker code, and
attribution are bundled. External tiles, fonts, sprites, analytics, telemetry,
CDNs, and map-service calls are prohibited.

Network-guard tests fail on an unexpected external origin. A missing local
asset or unavailable WebGL/DuckDB-Wasm capability produces a visible fallback;
it does not silently enable a remote service.

## Artifact and quality authority

Deterministic code calculates counts, deduplication, full outer cell joins,
distances, dates, rollups, rankings, and gate state from verified artifacts.
Configured model may explain those results but does not calculate novelty from model
memory. Every explanation cites the baseline snapshot, Flickr snapshot,
impact-cell artifact, verification campaign, quality snapshot, and source
revisions it used.

Local review events can update the local maturity projection immediately. They
remain labelled local until a deterministic export/import and scientific
release workflow records the corresponding authoritative gate state.

## Consequences

- Judge bundle v2 must carry baseline, provider-union, Flickr-geography,
  impact-cell, impact-summary, and country-hierarchy sections.
- Every geographic query is explicitly scoped and rejects incompatible grid,
  snapshot, target, and provider provenance.
- The lens can show potential contribution before reviews exist without
  presenting all candidates as new records.
- Human-supported contribution becomes visible as real outcomes arrive while
  the release-ready gate remains separate and inspectable.
- Missing direct iNaturalist or baseline evidence remains unavailable rather
  than being fetched or fabricated.
- Evidence Lens gains record-level geographic context and a direct
  Verification path without manufacturing local precision.

## Rejected alternatives

- Replacing Flickr Workload Map with the impact comparison.
- Adding all GBIF rows to all direct iNaturalist rows.
- Presenting candidate-only cells with prohibited occurrence, biological
  range-expansion, or knowledge-gain claims.
- Treating a provider taxon label or model score as a reviewed identity.
- Treating a human-reviewed positive as automatically release-ready.
- Treating zero baseline rows as biological absence.
- Assigning fine cells from coordinates whose source precision supports only a
  country or region.
- Encoding evidence state through color alone.
- Using map-rendered density instead of exact artifact-backed counts.
- Loading external map tiles, fonts, sprites, telemetry, or analytics.
