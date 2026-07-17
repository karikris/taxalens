# BioMiner geographic handoff audit

Status: accepted current-state audit; no product behavior changed

Audit date: 2026-07-17

TaxaLens audit base: `71cd945`

BioMiner task-start contract revision:
`f5b3dae093a5abe50ddb77b99dfda08d12e3e8c8`

BioMiner audit-closure revision:
`cdbde1036bc398c2ed654d7aa5669a3b53382f4e`

Scope: committed BioMiner geographic contracts, configuration, compact
manifests, reports, and tests. Dirty and untracked BioMiner workspace content
was excluded by reading commit-qualified objects. BioMiner `main` advanced
from the task-start revision to the audit-closure revision while this audit
was running. The intervening commits removed compatibility and production
test-fixture code and changed no geographic contract, configuration, compact
manifest, or report reviewed here. The audit used GitHits for
handoff-review categories and Headroom record
`3ffca70f9bb929d9bd7e91a4`; no external code or prose was copied.

## Handoff decision

TaxaLens should use an artifact-first adapter over BioMiner's committed
scientific contracts. The two products already share a hierarchical global H3
grid at configured resolutions 3, 5, and 7, and BioMiner preserves the
precision and eligibility information needed to avoid false local points.

The current BioMiner repository does **not** commit any Parquet or DuckDB file.
It commits schemas, builders, compact manifests, reports, paths, row counts,
checksums, and source identities. Consequently:

- the four Flickr Parquets already vendored and checksum-verified in TaxaLens
  are usable at their historical producing revision;
- the reported baseline spread and occurrence-evidence Parquets are not yet
  importable from current committed BioMiner content because their bytes are
  absent;
- no committed pilot materialization of `taxon_geographic_summary.parquet`
  was found;
- an absent artifact must remain unavailable; TaxaLens must not reconstruct
  evidence from report totals or fetch a substitute snapshot merely for the
  display.

Engine code should not be copied while an exact, provenance-preserving
artifact publication or deterministic upstream invocation remains possible.

## Availability and import readiness

| Evidence | Contract in BioMiner `HEAD` | Materialization evidence | Bytes committed in BioMiner | Bytes already committed in TaxaLens | Decision |
| --- | --- | --- | --- | --- | --- |
| `taxon_geographic_spread.parquet` | `taxon-geographic-spread-v1.0.0` | 16,678 rows and SHA-256 in Phase 14 report | No | No | Unavailable until exact bytes are published or reproducibly built and verified |
| `geographic_occurrence_evidence.parquet` | `geographic-occurrence-evidence-v1.0.0` | 57,603 multi-resolution rows and SHA-256 in Phase 14 report | No | No | Unavailable until exact bytes are published or reproducibly built and verified |
| `taxon_geographic_summary.parquet` | `taxon-geographic-summary-v1.0.0` | No committed pilot artifact or checksum found | No | No | Unavailable; do not infer a summary from the spread report |
| `geographic_qa_findings.parquet` | geographic summary builder contract | No committed pilot artifact or checksum found | No | No | Unavailable |
| `flickr_geography.parquet` | `flickr-geography-v1.0.0` | Compact workload manifest identifies bytes and SHA-256 | No | Yes, 13,501 rows | Usable through the existing TaxaLens import receipt |
| `flickr_geo_assignments.parquet` | workload/cluster contract | Compact workload manifest identifies bytes and SHA-256 | No | Yes, 13,501 rows | Usable for operational workload and later identity joins |
| `flickr_geo_clusters.parquet` | workload/cluster contract | Compact workload manifest identifies bytes and SHA-256 | No | Yes, 77 rows | Usable for the preserved Flickr Workload Map |
| `flickr_query_hits.parquet` | workload query-hit contract | Compact workload manifest identifies bytes and SHA-256 | No | Yes, 76,485 rows | Usable as discovery provenance, never as a taxonomic label |
| baseline provider union | None | None | No | No | Must be defined and materialized in this goal |

The TaxaLens fixture records the four Flickr imports against historical
BioMiner source revision
`75461d9c065af0cd96b41cd1f845c2e920f7ae34`. The compact workload manifest
records producing revision
`45f3d6a878ea158a3656f7d6aa327d52de94a0e7`. Current BioMiner `HEAD` is the
reviewed contract revision, not a replacement artifact-producing identity.
All three identities must remain distinct in provenance.

## Baseline geographic contracts

BioMiner's spread builder declares:

- `taxon_geographic_spread.parquet`;
- `geographic_occurrence_evidence.parquet`;
- `geographic_spread_manifest.json`;
- schema versions `taxon-geographic-spread-v1.0.0` and
  `geographic-occurrence-evidence-v1.0.0`.

The occurrence-evidence rows preserve registry and accepted-taxon identity,
GBIF occurrence identity, source and source-dataset identity, source query,
snapshot version, cell and resolution, country/admin1/bioregion, centroid,
coordinate uncertainty, event date, basis of record, establishment and
occurrence status, known-range role, exclusion reasons, and retrieval time.

The spread rows aggregate those fields by taxon, provider dataset, spatial
cell and known-range role. They preserve total, georeferenced,
range-inference-eligible, preserved-specimen, fossil, and geospatial-issue
counts; coordinate-uncertainty summaries; earliest/latest dates; basis of
record; establishment; evidence confidence; and source snapshot.

Range-inference eligibility is narrower than raw occurrence evidence. The
implemented policy requires an observation basis of record, a non-absent
occurrence status, a valid matching taxon and coordinate, and no disqualifying
geospatial issue. Preserved specimens, fossils, invalid coordinates, taxon
mismatches, and other excluded rows remain inspectable but do not become the
default range-inference count.

The pilot command is scoped to accepted taxon `gbif:1938069`, registry
`butterflies-v2-20260712`, snapshot
`gbif-occurrence-search-20260715`, retrieval time
`2026-07-15T00:00:00Z`, and resolutions 3/5/7. The Phase 14 report records
19,201 source occurrences, 57,603 multi-resolution evidence rows, 16,678
spread rows, and 630 range-inference-eligible occurrences. It reports:

| Artifact | Rows | Reported SHA-256 |
| --- | ---: | --- |
| `geographic_occurrence_evidence.parquet` | 57,603 | `1387f3c9967d322e537e9f2079b58641543707db863d2057c1caa4408d208a47` |
| `taxon_geographic_spread.parquet` | 16,678 | `46f38228cb5e7ba58f5f38f79a38dd87ae8fab80cf987e916f620d5cc4b9e83c` |

These are report claims, not a substitute for artifact bytes. Task 2.1 must
verify the exact artifact, schema, row count, checksum, target, registry,
snapshot, and source revision before importing it.

## Summary and data-deficiency contract

`taxon_geographic_summary.parquet` is defined by
`taxon-geographic-summary-v1.0.0`. Its rows can represent cell counts by
resolution, countries and admin regions, occupied envelope, disconnected
components, occurrence density, suspicious outliers, provider/dataset
coverage, introduced regions, current/historical evidence, and explicit
data-deficiency reasons. Its default policy requires at least five eligible
occurrences and two occupied cells and keeps the policy version in the build
manifest.

This contract is a useful upstream semantic source, but no committed pilot
summary materialization was found. Geographic Impact must show summary-derived
states as unavailable until real rows pass the handoff checks. Missing
baseline evidence remains unknown, not proof of biological absence.

## Shared spatial grid

Both baseline and Flickr builders call the same backend-neutral cell API. The
current backend reports grid name `hierarchical_global_grid` and an
`h3:<library-version>` grid version. It supports coordinate projection,
parents, neighbours, centers, and cell validation. Pilot configuration fixes:

- coarse resolution 3;
- regional resolution 5;
- local resolution 7.

Cell identifiers are opaque H3 identities in ordinary Polars Parquet columns;
the files are not declared GeoParquet geometry datasets. An adapter must
retain both resolution and grid version and reject unknown or incompatible
resolutions. Country and admin fields supplement rather than replace the cell
identity.

## Flickr geography and precision

`flickr_geography.parquet` declares `flickr-geography-v1.0.0` and accuracy
policy `flickr-accuracy-v1.0.0`. Each row preserves source photo and record
hash, coordinate and source, Flickr accuracy, geotag state, country/admin1,
coarse/regional/local cells, coordinate-quality state, warnings, and a
configuration fingerprint.

The precision policy deliberately withholds unsupported cells:

| Flickr accuracy | Quality state | Supported configured cells |
| --- | --- | --- |
| missing, invalid, or unknown | missing/invalid/unknown precision | none |
| 1–2 | world | none |
| 3–5 | country | none |
| 6–10 | region | coarse only |
| 11–15 | city | coarse and regional |
| 16 | street | coarse, regional, and local |

The builder also retains missing/partial/invalid coordinate, null-island, and
precision-limitation warnings. TaxaLens must normalize the supported cells to
long form without filling a finer cell from the point coordinate when the
reported precision does not support it.

The workload manifest defines Flickr rows as
`flickr_search_candidate_not_taxonomic_label`; the cluster contract also marks
candidate distributions only. These semantics survive every later join. A
provider taxon label or query match is Flickr candidate evidence until human
review, and a positive review is still not a release-ready occurrence
candidate without the configured release gates.

## Flickr publication identity

The compact `papilio-demoleus-pilot-geographic-workload-manifest-v1.0.0`
records source snapshot
`papilio-demoleus-global-multilingual-20260609-071759`, input SHA-256
`fe42f248cab68f6c3f67351800718fb9888b54a44f3b4a651d0f8bfa428c015d`,
and settings fingerprint
`sha256:2e7a666c31c0b97b2a23b087128f38bfd7556540ac85ca291a1aacdcd0e5e7f5`.
Its published artifact checksums are:

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `flickr_geography.parquet` | 769,162 | `a3c47a6f213191634f76655d859cdd8555a9b11a4e33a9041209eb23ba7c2bbf` |
| `flickr_query_hits.parquet` | 222,190 | `95448f3145d903f7f042fe41d74561475ef050f8df21b318ebacb252484e4f0b` |
| `flickr_geo_clusters.parquet` | 22,573 | `cba4651b967fae15f586e760859fb11ff608a603f792e338c7661d5563130b35` |
| `flickr_geo_assignments.parquet` | 633,625 | `e12f6ef9582bf707c952c3974c91e9a8f226ca7ce8034cab8ea8c293b70b6f74` |

The same manifest records 13,501 canonical geotagged photos, 76 located
clusters, one fallback cluster, 792 unassigned geotagged records, 707
outliers, and no missing-coordinate records. Those are pilot manifest values,
not reusable product invariants.

## Provider provenance and iNaturalist boundary

The baseline occurrence contract is GBIF-oriented. It preserves `gbif_id`,
source dataset key/citation, and source snapshot. Dataset provenance can help
identify known iNaturalist-origin observations delivered through GBIF, but the
contract does not yet provide:

- a canonical provider identity;
- direct iNaturalist observation identity in baseline rows;
- all provider relationships for one observation;
- canonical flags or duplicate groups;
- exact versus unresolved cross-provider duplicate classifications;
- a direct iNaturalist delta receipt.

BioMiner separately acquires GBIF and direct iNaturalist reference-media
candidates and has policies for retaining provider origin and marking known
GBIF mirrors. The committed compact reference-source manifest reports 91,176
deduplicated reference observations, 64,914 located rows, and zero
human-verified source media. Those rows support reference selection; they are
not a deduplicated baseline occurrence union and their Parquet bytes are not
committed.

TaxaLens must therefore build the provider union conservatively from a
committed occurrence snapshot. If no direct iNaturalist occurrence snapshot
exists, the baseline remains the GBIF-derived union, iNaturalist-origin GBIF
records are identified where possible, and direct iNaturalist delta is shown
as unavailable. No direct-provider data should be fetched to make a display
look complete.

## Verification and evaluation handoff

BioMiner's geographic artifacts provide photo identity, source-record hash,
candidate semantics, coordinate-quality states, cluster assignments, and
dataset-planning context. They do not encode TaxaLens append-only review
events, consensus, quality snapshots, or occurrence-release decisions. Those
must be joined in TaxaLens by stable source and campaign identities.

The committed reference-source manifest reports zero human-verified source
media. The TaxaLens campaigns also currently retain zero human outcomes.
Potential candidate-only cells can be calculated once a baseline exists, but
human-supported and release-ready additional cells must remain zero or
unavailable until their respective evidence and gates exist. Skip and Can't
view are workflow dispositions, not supporting evidence.

## Required fail-closed boundaries for later phases

1. Verify artifact bytes, SHA-256, row count, schema version, target, registry,
   snapshot, grid version, and resolutions before any import.
2. Do not treat a path, report, checksum, or compact manifest as the artifact
   itself.
3. Do not infer `taxon_geographic_summary.parquet` when it is unavailable.
4. Preserve raw, excluded, and range-inference-eligible baseline totals.
5. Preserve Flickr coordinate quality and do not manufacture finer cells.
6. Keep source dataset and provider relationships through deduplication.
7. Retain unresolved provider duplicate groups rather than deleting ambiguous
   independent observations.
8. Do not use reference-media candidates as baseline occurrence evidence.
9. Do not call candidate-only cells new occurrences or evidence of species
   absence.
10. Do not elevate a reviewed positive to release-ready without valid
    coordinates, duplicate, quality, provenance, consensus, and release gates.

This boundary makes the later Geographic Impact Lens an evidence comparison,
not a visualization of assumed novelty.
