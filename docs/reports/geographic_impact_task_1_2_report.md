# Geographic Impact Task 1.2 report

Status: complete

Task: 1.2 — Upgrade the judge bundle to v2

Date: 2026-07-17

Starting TaxaLens SHA:
`0fba80124208e26df9ba9bab381c124af22841a1`

Subtask and compatibility-gate push SHA:
`7129fc15072e00699a66dc916a3f09094de4b6cc`

Verified remote `main` after the task push:
`7129fc15072e00699a66dc916a3f09094de4b6cc`

Observed BioMiner SHA:
`dcd494321abc0666ea692b5759f84bc4c7e08ba9`

## Completed subtasks

| Subtask | Commit | Result |
| --- | --- | --- |
| 1.2.1 Geographic-impact sections | `233752d` | Added the six exact v2 geographic section names while retaining an immutable v1 section tuple |
| 1.2.2 Bundle schema v2 | `6bdc25f` | Published `taxalens-judge-bundle:v2.0.0`, preserved the exact v1 JSON Schema and documented the breaking semantic boundary |
| 1.2.3 V1-to-v2 migration | `a82f9be` | Added non-mutating Python and browser migrations with pre/post validation, a preservation fingerprint and a no-rewrite receipt |
| 1.2.4 Geographic verification | `1e55022` | Required a checksummed geographic-impact manifest and rejected identity, provider provenance, count, hierarchy, review, quality and release-gate inconsistencies |

Compatibility gate commit `7129fc1` updated v2-derived UI expectations and the
deterministic mission-plan fingerprint, applied the repository's native format
contract, and validated the reviewed-label handoff against the observed
BioMiner `main` SHA.

## Compatibility result

The committed public fixture remains byte-for-byte v1. Its Python and browser
loaders validate the stored v1 contract first, project it to canonical v2 in
memory and add only six unavailable geographic sections with zero record
counts. The migration does not change the artifact inventory, source SHAs,
rights, attribution, replay traces, checksums or any legacy section.

The canonical migrated fixture contains 31 sections: 8 available, 9 partial
and 14 unavailable. The six additional unavailable states are contract
descriptors, not evidence. The raw stored fixture still contains 25 sections
and 8 unavailable states.

A generated v2 contract fixture validates with available geographic sections,
a `geographic_impact_manifest` auxiliary artifact, linked provider-union and
impact artifacts, a connected country hierarchy, review evidence and explicit
release-policy binding. It is test data only and is not a retained campaign or
public scientific result.

## Fail-closed geographic verification

For available v2 geography, descriptor-only validation is prohibited. The
bundle verifier requires checksummed payload verification and reconciles:

- target and source-commit identities;
- the exact baseline-union schema, baseline snapshot and provider-union policy;
- artifact paths, schema versions, digests, sizes, row counts and required
  status;
- impact-cell, summary and hierarchy totals;
- country hierarchy ID, node count and connected parent structure;
- consensus and quality evidence for reviewed contribution; and
- a non-empty release-decision artifact bound to the configured release-policy
  snapshot before a release-ready count can be non-zero.

No Parquet payload is converted to JavaScript or read by the generic manifest
verifier. Typed adapters and materialization checks remain responsible for
Parquet row validation.

## GitHits and rights

Task-level record: `provenance/githits.jsonl#geo-impact-1.2`

Subtask records:

- `geo-impact-1.2.1`;
- `geo-impact-1.2.2`;
- `geo-impact-1.2.3`;
- `geo-impact-1.2.4`.

The task used versioning, migration and fail-closed relationship categories
from reviewed MIT and Apache-2.0 references. Generated implementations were
rejected, negative feedback was recorded, and no external code or prose was
copied. No new media, boundary dataset or third-party runtime asset was added.

## Task-level verification

| Check | Result |
| --- | --- |
| Full Python suite | 814 passed |
| Full frontend Vitest suite | 353 passed; 1 intentional skip |
| TypeScript application check | Passed |
| Production replay build | Passed; 1,664 modules transformed |
| Truthful public demo verifier | Passed; 30 artifacts, 36 records, 3 media items |
| Judge-bundle v1/v2 and migration tests | Passed |
| Synthetic available-v2 geographic fixture | Passed JSON Schema and Python semantic verification |
| Native Ruff check and format gate | Passed; 110 files clean |
| Source-locked compatibility lint | Reported the expected 46 retained findings |
| Reviewed-label BioMiner interoperability | Passed at `dcd494321abc0666ea692b5759f84bc4c7e08ba9` |
| BioMiner boundary verifier | Passed with expected retained-pin and user-owned untracked-content warnings |
| Provenance verifier | Passed |
| JSON and JSONL parsing | Passed |
| `git diff --check` | Passed |

The boundary verifier's timestamped dry-run snapshot was removed after the
check because Task 1.2 does not change the retained BioMiner boundary snapshot.

## Push verification

The numbered subtask and compatibility-gate commits were pushed directly from
local `main` to remote `main` without force. `git ls-remote` and local
`git rev-parse HEAD` both returned:

`7129fc15072e00699a66dc916a3f09094de4b6cc`

No branch or pull request was created. The unrelated modified AI provenance
report and untracked zone-identifier file were not staged. No human review
outcome, baseline occurrence row or geographic contribution was fabricated.
