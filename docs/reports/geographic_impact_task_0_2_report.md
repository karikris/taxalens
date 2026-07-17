# Geographic Impact Task 0.2 report

Status: complete

Task: 0.2 — Freeze the Geographic Impact semantic contract

Date: 2026-07-17

Starting TaxaLens SHA: `5e40553d18116a835b067329cd4258058934c02e`

Subtask push SHA: `51087a60d2d3328b06d7aaa745a9482c41af3805`

Verified remote `main` after subtask push:
`51087a60d2d3328b06d7aaa745a9482c41af3805`

Observed BioMiner SHA:
`dcd494321abc0666ea692b5759f84bc4c7e08ba9`

## Completed subtasks

| Subtask | Commit | Result |
| --- | --- | --- |
| 0.2.1 Geographic Impact ADR | `7cd309b` | Froze evidence vocabulary, maturity states, grid/scope rules, contribution metrics, accessibility, scaling, deterministic authority, and offline network policy |
| 0.2.2 Baseline provider union | `081f3b0` | Froze deterministic GBIF/iNaturalist identity, provider relationships, exact count reconciliation, unresolved duplicates, and direct-provider unavailable behavior |
| 0.2.3 Human and upstream decisions | `51087a6` | Froze workload/impact separation, artifact-first boundary, non-absence semantics, provider deduplication, quality gates, and reviewed/release distinction |

The current BioMiner reviewed-label v2 contract is acknowledged without
misrepresenting its synthetic test fixtures as retained human outcomes. The
TaxaLens campaign state remains zero until attributable events are committed
or imported. BioMiner's legacy reviewed-label v1 migration removal and
five-image cap removal remain separately pinned in provenance.

## GitHits and rights

Task-level record: `provenance/githits.jsonl#geo-impact-0.2`

Subtask records:

- `geo-impact-0.2.1`;
- `geo-impact-0.2.2`;
- `geo-impact-0.2.3`.

The task inspected GBIF portal16 (Apache-2.0), Atlas of Living Australia
biocache-hubs (MPL-1.1), iNaturalist, Splink, dedupe, and
research-repo-doctor (MIT). Focused ADR/Croissant repositories remained in
GitHits indexing and were recorded as unavailable for that subtask. No
external code or prose was copied.

## Task-level verification

| Check | Result |
| --- | --- |
| Geographic architecture documentation validation | Passed |
| Provenance and migration-manifest validation | Passed |
| BioMiner boundary verifier | Passed with expected newer-checkout and untracked-content warnings; snapshot written outside the repository |
| BioMiner boundary tests | 3 passed |
| `git diff --check` | Passed |

## Push verification

The three numbered subtask commits were pushed directly from local `main` to
remote `main` without force. `git ls-remote` and local `git rev-parse HEAD`
both returned:

`51087a60d2d3328b06d7aaa745a9482c41af3805`

No branch or pull request was created. The unrelated modified provenance
report and untracked zone-identifier file were not staged.
