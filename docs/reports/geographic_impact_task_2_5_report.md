# Geographic Impact Task 2.5 report

Status: complete and pushed to `main`

## Revisions

- TaxaLens starting SHA: `fff0cc61590628866525c3f65ec4893b2b97b9b4`
- TaxaLens task push SHA: `6bc3966a86d6e111f5b1790018d4ec02d36ee31f`
- Verified remote `origin/main`: `6bc3966a86d6e111f5b1790018d4ec02d36ee31f`
- BioMiner baseline artifact origin:
  `247b42f3206d48bb79e2dbf97c5a92e4f207ae71`
- BioMiner Flickr artifact origin:
  `75461d9c065af0cd96b41cd1f845c2e920f7ae34`
- BioMiner `main` at task start:
  `3dbdb0ce118478e8a1eac16b1b50b0e76e39d5b4`
- BioMiner `main` at the final boundary check:
  `7b81a954943a2fca46a13dfbd0e06b1a711439c7`
- Codex session: `019f65d0-3ca9-7870-9eb2-37c14ed02517`
- Primary model: `configured-model`
- Reasoning effort: `xhigh`

BioMiner advanced during the task and its working tree contained three staged
user changes plus known untracked files at the final boundary check. None was
consumed. The materialization is bound to the two exact upstream evidence
revisions above and their committed artifact checksums.

## Full-outer materialization

The builder preaggregates canonical baseline observations and precision-supported
Flickr candidates by H3 resolution/cell, then performs a real full outer join.
Baseline rows use distinct canonical observation IDs. Flickr rows use distinct
photo IDs only where the precision contract supports that resolution. H3 supplies
the exact cell center and parent. The bundled Natural Earth hierarchy assigns a
country only when the cell center lies unambiguously inside an included polygon;
2,160 cells remain explicitly unassigned rather than receiving invented geography.

| Resolution | Full-outer cells | Baseline union observations | Flickr candidates | Candidate-only cells |
| ---: | ---: | ---: | ---: | ---: |
| 3 | 2,155 | 19,201 | 13,416 | 1,221 |
| 5 | 7,163 | 19,201 | 13,026 | 3,075 |
| 7 | 10,919 | 19,201 | 7,932 | 2,468 |

Across all resolutions the artifact contains 20,237 cell rows, including 693
range-eligible baseline-only cells, 183 matched cells, and 6,764 candidate-only
cells. Counts at different resolutions are projections of the same observations
and must not be summed as independent biological evidence.

## Human review and release state

The materializer reads committed verification consensus, quality-snapshot, and
occurrence-release decision artifacts. Each candidate occupies exactly one of
pending, reviewed positive, reviewed negative, uncertain, media failure, or
skipped. Skip and Can't view/media failure cannot become human-supported
contribution. Release-ready status additionally requires positive consensus,
valid coordinates, duplicate, quality, provenance, and date gates plus an exact
retained quality snapshot.

The current public campaigns still contain zero retained human outcomes. The
real artifacts therefore report:

| Measure | Value |
| --- | ---: |
| Flickr candidates | 13,501 |
| Geographically supported candidates | 13,416 |
| Unsupported/no-cell candidates | 85 |
| Pending candidates | 13,501 |
| Human-reviewed target positive | 0 |
| Human-reviewed non-target | 0 |
| Uncertain | 0 |
| Media failure | 0 |
| Skipped | 0 |
| Release-ready occurrence candidates | 0 |
| Human-supported additional cells | 0 |
| Release-ready additional cells | 0 |

The committed release-decision file is intentionally empty. The impact manifest
marks the geographic quality snapshot unavailable because no retained human
outcome supports one. No machine label or campaign membership is treated as a
human decision.

## Rollups and hierarchy availability

The summary artifact contains 385 rows: three global, 18 continent, and 364
country rollups across resolutions 3, 5, and 7. Global rows include every cell.
Country and continent rows include only unambiguously assigned cells; their totals
reconcile to global totals when the explicit unassigned group is included.

The current bundled boundary hierarchy has no admin1 geometry nodes, so no admin1
summary row is fabricated. The contract continues to support admin1 and the
manifest records the four designed scope levels, while this fixture's absent
admin1 rows remain inspectable.

## Immutable manifest

- Build ID: `geographic-impact:84b8d1b69c3dae1e329a3f6b`
- Manifest ID: `geographic-impact-manifest:7f6d74f020db6cc4b4ba93dd`
- Manifest fingerprint:
  `7f6d74f020db6cc4b4ba93dd0284b399a58163f49af1e9186ce45585feba40d3`
- Baseline snapshot: `gbif-occurrence-search-20260715`
- Flickr snapshot: `flickr:2026-07-15`
- Direct iNaturalist delta: unavailable, not zero

The manifest inventories all nine required logical artifacts. Every available
artifact has a schema, path, row count, byte count, checksum, rights identity,
source repository, and exact source commit. It supports multiple pinned commits
from the same repository, which is required because the baseline and Flickr
BioMiner artifacts come from different revisions.

| Artifact | Rows | Bytes | SHA-256 |
| --- | ---: | ---: | --- |
| `geographic_impact_cells.parquet` | 20,237 | 559,441 | `97b2422657d79bc8e682c4e51358c0316f6c942a31fea9ed608ef2c4ba420d94` |
| `geographic_impact_summary.parquet` | 385 | 38,351 | `056b0a05b5b82f4a00d20ba701275b1050e102ea58a5440cf4471235f14310cf` |
| `geographic_impact_manifest.json` | 1 | 7,330 | `df6be1d24fc41cedb32061a36c477eefe188c414661fc3c4cdd3886cbfd991c4` |
| `occurrence_release_decisions.json` | 0 decisions | 299 | `3cc571646b54b66b301edb3427d925f7bcf3f330ece57021b945d430a5164c19` |

All outputs are present in the credential-free repository storage inventory,
which now covers 99 immutable B2-replacement objects.

## Independent DuckDB cross-check

DuckDB 1.5.4 is pinned in the test dependency group. Its SQL independently reads
the baseline and Flickr Parquets, aggregates each source, executes a full outer
join, and compares every materialized count and state flag in both directions.
It reproduced:

- 57,603 baseline projection rows;
- 34,374 precision-supported Flickr projection rows;
- 20,237 full-outer cells;
- 693 baseline-only, 183 matched, and 6,764 candidate-only cells;
- 13,501 distinct Flickr photos, 13,416 with at least one supported cell;
- zero row mismatches;
- zero global-rollup mismatches.

It also verifies every available manifest artifact's exact byte count and
SHA-256 digest. A regression test proves stale artifact bytes fail closed.

## Commits

- `9f48a8e155055bf4c2f7a9d254fc549225fffa7d` —
  `feat(impact): build geographic impact cells`
- `ffef38ec4abc289d31011f8c74b762524c0caeec` —
  `feat(impact): join geographic review states`
- `b399cd4fe92640ad9a219142f8a77ac2122e632e` —
  `feat(impact): build geographic impact rollups`
- `3247b5de1032507ffe5161fec966534e17ba5e84` —
  `feat(impact): publish geographic impact manifest`
- `6bc3966a86d6e111f5b1790018d4ec02d36ee31f` —
  `test(impact): validate geographic impact artifacts`

GitHits records `geo-impact-2.5`, `geo-impact-2.5.1`, `geo-impact-2.5.2`,
`geo-impact-2.5.3`, `geo-impact-2.5.4`, and `geo-impact-2.5.5` are present. The
task-level request did not return through two bounded waits and was terminated.
Focused calls were not repeated after that outage. Every record truthfully uses
`githits_status: unavailable`; no external implementation or data was copied.

## Verification

- Full Python suite: 890 passed.
- Full frontend suite: 361 passed, one skipped; 113 files passed, one skipped.
- TypeScript project check: passed.
- Native Ruff and format: 140 files clean; 46 retained source-locked
  compatibility findings reported separately.
- Focused geographic contract/materialization/DuckDB suite: 50 passed.
- Deterministic Polars rebuild: passed.
- Independent DuckDB source/full-outer/rollup check: passed with zero mismatches.
- Judge demo bundle verifier: passed.
- Flickr geography handoff verifier: passed for 13,501 candidates.
- Geographic boundary and rights metadata verifier: passed.
- Repository-storage verifier: passed; 6 tables, 4 campaigns, 82 verification
  items, and 99 B2-replacement objects.
- BioMiner boundary verifier: passed with moving-`main`, staged, and untracked
  warnings recorded in
  `provenance/biominer_state/biominer_boundary_20260717T122911Z.json`.
- Provenance verifier: passed.
- `git diff --check`: passed.

The first full Python gate found only that two new modules needed Ruff's canonical
format. They were formatted before push and the complete suite then passed with
890 tests. This report does not claim that potential candidate-only cells are
human-supported or release-ready evidence.
