# Geographic Impact Task 2.4 report

Status: complete and pushed to `main`

## Revisions

- TaxaLens starting SHA: `5ccdae5fdbf2075c2722082a01251f83f24a368d`
- TaxaLens task push SHA: `0eb50061ab7238ae83d09d520ca86c046e59d774`
- Verified remote `origin/main`: `0eb50061ab7238ae83d09d520ca86c046e59d774`
- BioMiner geographic artifact origin: `247b42f3206d48bb79e2dbf97c5a92e4f207ae71`
- BioMiner provider-identity implementation inspected at task start:
  `31aafd3b35ba28bd694a495c36a4d386c4e297db`
- BioMiner `main` at the final boundary check:
  `3dbdb0ce118478e8a1eac16b1b50b0e76e39d5b4`
- Codex session: `019f65d0-3ca9-7870-9eb2-37c14ed02517`
- Primary model: `configured-model`
- Reasoning effort: `xhigh`

BioMiner advanced during the task. The build did not silently consume its moving
working tree: all baseline occurrence and spread bytes remain checksum-bound to
the exact geographic handoff at `247b42f…`.

## Canonical provider policy

The new identity module implements the accepted conservative hierarchy:

1. namespaced provider observation identity;
2. a verified iNaturalist observation identity represented through GBIF;
3. source-scoped Darwin Core occurrence identity;
4. normalized stable source reference;
5. a complete, source-scoped observer/taxon/date/location composite;
6. a source-fingerprint singleton when no safe shared identity exists.

Provider relationships and canonical observations have different identifiers.
This allows an exact direct iNaturalist observation and its GBIF-delivered mirror
to share a canonical observation while preserving both delivery relationships.
Coordinate coincidence, dates, taxon labels, or media URLs alone do not merge
records. Ambiguous candidates retain separate canonical IDs inside an explicit
unresolved group.

## Committed provider union

The checksum-verified BioMiner artifact contains 19,201 distinct GBIF occurrence
keys. Every occurrence has one H3 projection at resolutions 3, 5, and 7. TaxaLens
therefore commits 57,603 cell rows but requires downstream observation counts to
use distinct canonical IDs.

| Measure | Value |
| --- | ---: |
| Baseline union observations | 19,201 |
| Spatial projection rows | 57,603 |
| Provider relationships | 19,201 |
| GBIF-only observations | 4,017 |
| iNaturalist-origin observations delivered through GBIF | 15,184 |
| Direct iNaturalist delta | unavailable |
| Exact cross-provider duplicates removed | 0 |
| Unresolved provider duplicate groups | 0 |
| Range-inference-eligible observations | 630 |
| Range-inference-excluded observations | 18,571 |
| Source datasets | 91 |

The exact iNaturalist-origin classification uses committed GBIF dataset key
`50c9509d-22c7-4a22-a47d-8c48425ef4a7`. It does not claim those rows were loaded
from a direct iNaturalist snapshot. No such snapshot is committed, so the direct
iNaturalist delta is `unavailable` with a null count, not zero. No provider fetch
was performed to complete the display.

The observed input has no cross-provider duplicate to remove and no ambiguous
group to report. Those zeroes describe only this committed input; they are not a
claim that duplicates cannot exist in other snapshots.

## Artifacts and provenance

| Artifact | Rows | Bytes | SHA-256 |
| --- | ---: | ---: | --- |
| `baseline_occurrence_union.parquet` | 57,603 | 3,343,827 | `242e280b78a75b79dffb2012d24163d7ce62d07eeac908a31f55510afc486445` |
| `baseline_provider_relationships.parquet` | 19,201 | 2,207,970 | `f5eee31f587a35743f08f2eec8a3f2b252d8d30b1186706ca1badabc3cf88a4f` |
| `baseline_provider_union_manifest.json` | 1 | 5,680 | `4b18ff6a3173a80c5586bb75b9c3b71328f37e5257ec791518f4f21a74401233` |

Provider-union build ID:
`baseline-provider-union:20b02fbef5d3117cf97539df`.

The relationship artifact retains dataset keys, source fingerprints, delivery
provider, original-provider classification, match method, canonical status,
duplicate fields, and citation availability. The imported occurrence snapshot
contains no dataset citations; all 19,201 relationships therefore use explicit
“citation unavailable in committed baseline snapshot” text rather than invented
citations.

One canonical observation lacks a provider country code. Fifteen non-null codes
have no matching Natural Earth 1:110m boundary, covering 2,066 observations.
Those codes remain intact while country and continent labels remain unavailable.
TaxaLens does not infer labels or local coordinates from the low-resolution map.

All three artifacts are included in the credential-free repository storage
inventory. It now covers 95 immutable B2-replacement objects.

## Commits

- `d0354bd52218eb44082a489a328975429906e8ca` —
  `feat(geography): define baseline occurrence identity`
- `cdee00c9e16e349d722733cd951709abce8d0fee` —
  `feat(geography): build deduplicated baseline union`
- `52d0cb4dad32e4a81296ab7c02d6be298c8cc99c` —
  `feat(geography): report baseline provider composition`
- `0eb50061ab7238ae83d09d520ca86c046e59d774` —
  `test(geography): cover cross-provider deduplication`

GitHits records `geo-impact-2.4`, `geo-impact-2.4.1`,
`geo-impact-2.4.2`, `geo-impact-2.4.3`, and `geo-impact-2.4.4` are present. The
task-level request did not return through two bounded waits and was terminated.
Focused calls were not repeated after that outage. Every record truthfully uses
`githits_status: unavailable`; no external implementation or provider data was
copied.

## Verification

- Full Python suite: 869 passed.
- Focused provider, adapter, and cross-language contract suite: 64 passed.
- Native Ruff and format: 130 files clean; 46 retained source-locked
  compatibility findings reported separately.
- Baseline provider-union deterministic rebuild: passed.
- Provider partitions and observation/projection counts: reconciled.
- Source and output SHA-256 checks: passed.
- Repository-storage check: passed; 6 tables, 4 campaigns, 82 verification
  items, and 95 B2-replacement objects.
- BioMiner boundary verifier: passed with the moving-`main` and known untracked
  working-tree warnings recorded in
  `provenance/biominer_state/biominer_boundary_20260717T113838Z.json`.
- Provenance verifier: passed.
- `git diff --check`: passed.

The first full-suite invocation had 868 passes and one environment-only failure:
its nested native-lint test could not resolve the `ruff` executable because
`.venv/bin` was absent from `PATH`. The unsupported `--check` flag was also used
once for the BioMiner verifier. The complete gate was rerun with `.venv/bin` on
`PATH` and the supported `--dry-run` verifier option; all 869 tests and the
boundary gate then passed. Both attempts are reported rather than hiding the
corrected invocation.

This task establishes the baseline provider union only. It does not report
Flickr contribution, reviewed geographic evidence, or release-ready occurrence
candidates; those remain later tasks with separate scientific gates.
