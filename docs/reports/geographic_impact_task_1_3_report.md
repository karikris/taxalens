# Geographic Impact Task 1.3 report

Status: complete

Task: 1.3 — Generalize the product facade

Date: 2026-07-17

Starting TaxaLens SHA:
`a5ab231ed9fb57d4d130bead39ef065437c6957f`

Subtask push SHA:
`0e75291fe9b885e1418191f82c36c1ddbaf25678`

Verified remote `main` after the task push:
`0e75291fe9b885e1418191f82c36c1ddbaf25678`

Observed BioMiner SHA:
`dcd494321abc0666ea692b5759f84bc4c7e08ba9`

## Completed subtasks

| Subtask | Commit | Result |
| --- | --- | --- |
| 1.3.1 Fixture/product separation | `707bab2` | Added independent bundle verifier, loader and project facade boundaries; isolated exact Papilio IDs and SHAs in `PapilioJudgeFixtureValidator` |
| 1.3.2 Geographic loaders | `b03f700` | Added role- and schema-selected Geographic Impact input, summary, country hierarchy and record-context loaders with explicit unavailable states |
| 1.3.3 Runtime counts | `0fac6f4` | Removed the fixed 13,501 workload assertion and other product count literals; counts now come from verified manifests or reconcile through source relationships |
| 1.3.4 Scoped reads | `0e75291` | Required project, run, target taxon, baseline snapshot and Flickr snapshot identity for every geographic read and blocked every mismatch without returning artifact handles |

## General facade boundary

`BundleVerifier` performs contract migration and generic semantic validation.
`BundleLoader` owns transport and verified artifact loading.
`TaxaLensProjectFacade` exposes immutable section, role and artifact reads.
`PapilioJudgeFixtureValidator` is the explicit adapter for the frozen public
fixture. The generic classes contain no Papilio bundle ID, source SHA or pilot
count.

The current public v1 fixture still validates first and migrates in memory to
v2. Its six Geographic Impact sections remain explicitly unavailable. The
facade does not reinterpret Flickr workload artifacts as baseline or impact
evidence and does not manufacture rows, coordinates, reviews or snapshots.

## Geographic loader and isolation result

The four geographic loader functions select verified artifacts through v2
section roles and supported schema versions. Opaque artifact IDs in the
synthetic tests prove that product selection does not depend on a pilot file
name. Any available geographic section also requires one verified
`geographic_impact_manifest` artifact.

Every read requires one immutable compound identity:

- project ID;
- run ID;
- target accepted taxon key;
- baseline snapshot ID; and
- Flickr snapshot ID.

Each value is checked against the geographic-impact manifest, and the target
taxon is also checked against the judge bundle. The isolation suite covers all
five fields across all four loaders. A mismatch or blank field returns an
unavailable result with no data artifacts and no manifest handle.

## Runtime-count result

The Flickr Workload Map now obtains its assignment expectation from the
checksummed artifact descriptor instead of comparing to 13,501. The component
asks the facade for the two semantic workload schemas instead of filtering
hard-coded artifact IDs.

Prototype operational values are read from the verified evidence snapshot and
validated through relationships: bank partitions reconcile, selection counts
and coverage reconcile, staged plans reconcile with classified and retryable
rows, score rows reconcile with the candidate domain, shortfalls and reason
counts reconcile, gate counts reconcile and imported file counts match the
handoff inventory. A mutation test changes one verified operational count and
confirms that the product projects the changed value instead of enforcing a
Papilio literal.

Static bundle and review-media counts now come from verified manifests. Exact
Papilio values remain only in fixture tests and deterministic evaluation
expectations.

## GitHits and rights

Task-level record: `provenance/githits.jsonl#geo-impact-1.3`

Subtask records:

- `geo-impact-1.3.1`;
- `geo-impact-1.3.2`;
- `geo-impact-1.3.3`;
- `geo-impact-1.3.4`.

The task adopted dependency-injection, role/schema selection, runtime-manifest
reconciliation and compound-scope isolation categories from reviewed MIT,
Apache-2.0, MPL-2.0 and ISC references. Generated implementations were not
copied. No media, boundary data, runtime dependency or external code was
added.

## Task-level verification

| Check | Result |
| --- | --- |
| Full frontend Vitest suite | 361 passed; 1 intentional skip |
| Product facade and geographic Python gate | 70 passed |
| TypeScript application check | Passed |
| Production and static replay build | Passed; 1,667 modules transformed |
| Truthful public demo verifier | Passed; 30 artifacts, 36 records, 3 media items |
| Public review-media tests | 4 passed |
| Static deployment tests | 3 passed |
| Native Ruff check and format gate | Passed; 110 files clean |
| Source-locked compatibility lint | Reported the expected 46 retained findings |
| BioMiner boundary verifier | Passed with expected retained-pin and user-owned untracked-content warnings |
| Provenance verifier | Passed |
| `git diff --check` | Passed |

The boundary verifier's timestamped dry-run snapshot was removed after the
check because Task 1.3 does not update the retained BioMiner boundary.

## Push verification

The four numbered subtask commits were pushed directly from local `main` to
remote `main` without force. `git ls-remote` and local `git rev-parse HEAD`
both returned:

`0e75291fe9b885e1418191f82c36c1ddbaf25678`

No branch or pull request was created. The unrelated modified AI provenance
report and untracked zone-identifier file were not staged. Human-review,
baseline occurrence and release-ready counts were not fabricated.
