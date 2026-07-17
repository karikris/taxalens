# Geographic Impact Task 1.1 report

Status: complete

Task: 1.1 — Define baseline and impact data contracts

Date: 2026-07-17

Starting TaxaLens SHA:
`3c51cfe06da607ead868b7535032d8cdbdb59d12`

Subtask push SHA:
`2c8fe60fb77a3d886368b57e69ec6fb7e4f7d9b1`

Verified remote `main` after subtask push:
`2c8fe60fb77a3d886368b57e69ec6fb7e4f7d9b1`

Observed BioMiner SHA:
`dcd494321abc0666ea692b5759f84bc4c7e08ba9`

## Completed subtasks

| Subtask | Commit | Result |
| --- | --- | --- |
| 1.1.1 Baseline occurrence union | `c75fb25` | Added strict JSON Schema, TypeScript, Python and ordered Parquet contracts for canonical observations, provider relationships, duplicate groups, source provenance, coordinate quality and range-inference eligibility |
| 1.1.2 Geographic impact cells | `51a4607` | Added full-outer cell contracts with explicit baseline/direct-provider availability, review-state partitions, release-gated counts, candidate-only and additional-cell states, dates, distance and data deficiency |
| 1.1.3 Impact summaries and hierarchy | `187d3ee` | Added global/continent/country/admin1 rollups, a flat connected country hierarchy, and a checksum- and source-commit-bound impact manifest |
| 1.1.4 Cross-language parity | `2c8fe60` | Added shared positive and fail-closed fixtures independently validated by Python and AJV, plus representative TypeScript `satisfies` checks |

No judge-bundle or public-replay fixture was migrated in this task. The new
fixture corpus is contract test evidence only; it is not retained human review
evidence and does not change the current zero-outcome public campaigns.

## Contract semantics

- Unavailable baseline evidence and unavailable direct iNaturalist deltas are
  nullable states, never measured zeroes.
- The baseline union reconciles canonical observations, provider-delivered
  rows, exact duplicates removed and unresolved duplicate groups.
- Skip and media-failure/Can’t-view outcomes remain separate from positive,
  negative and uncertain evidence and never support an additional-cell claim.
- Human-supported additional cells and release-ready additional cells are
  separate counts. Release-ready rows require explicit release-decision
  evidence.
- Flat rollup rows are the analytical authority. Navigation trees are derived
  from a separate, connected parent hierarchy.
- Manifest artifacts carry availability, schema, checksum, row count, source
  repository, exact source commit, rights and snapshot identities.

## GitHits and rights

Task-level record: `provenance/githits.jsonl#geo-impact-1.1`

Subtask records:

- `geo-impact-1.1.1`;
- `geo-impact-1.1.2`;
- `geo-impact-1.1.3`;
- `geo-impact-1.1.4`.

The broad task search used general contract, immutable-storage and geospatial
analytics patterns from CC0-1.0, CC-BY-4.0 and MIT sources. Focused searches
used only validation and structural categories from MIT and Apache-2.0
references; generated examples were rejected and negative feedback was
recorded where their sources or orchestration were not authoritative. No
external code or prose was copied.

## Task-level verification

| Check | Result |
| --- | --- |
| Python geographic, parity, availability and verification-schema gate | 45 passed |
| Frontend AJV geographic and verification-schema gate | 2 files passed; 6 tests passed |
| TypeScript application check | Passed |
| Standalone geographic TypeScript contract compile | Passed |
| Draft 2020-12 AJV strict compilation | Passed for all five geographic schemas |
| Python `jsonschema` plus frozen typed-dataclass validation | Passed for the shared fixture corpus |
| Provenance verifier | Passed |
| BioMiner boundary verifier | Passed with expected retained-pin/newer-HEAD and user-owned untracked-content warnings |
| JSON/JSONL parsing | Passed |
| `git diff --check` | Passed |

The boundary verifier's nominal dry-run emitted a timestamped snapshot. It was
removed before the task report because this contract-only task did not update
the retained boundary snapshot.

## Push verification

The four numbered subtask commits were pushed directly from local `main` to
remote `main` without force. `git ls-remote` and local `git rev-parse HEAD`
both returned:

`2c8fe60fb77a3d886368b57e69ec6fb7e4f7d9b1`

No branch or pull request was created. The unrelated modified AI provenance
report and untracked zone-identifier file were not staged.
