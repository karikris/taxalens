# Geographic Impact Task 8.4 report

Date: 2026-07-18 (Australia/Sydney)

Task: `geo-impact-8.4` — performance and bundle budgets

Starting TaxaLens SHA: `8d3bbbc10da728895d541e497ccb06645e17c0a8`

## Completed subtasks

| Subtask | Commit | Result |
| --- | --- | --- |
| 8.4.1 | `4836397` | Five fresh Chromium contexts measure application-to-map readiness with exactly 2,155 global features. |
| 8.4.2 | `9d7042d` | Five samples cover global-to-continent, continent-to-country and Flickr-candidate filtering; a MapLibre marker lifecycle race was removed. |
| 8.4.3 | `e75e8bd` | A deterministic report accounts for every raw production byte and documents the major product groups. |
| 8.4.4 | `550200b` | Committed latency and raw-byte baselines now fail measured regressions; verified decoded scopes use a bounded per-lens LRU. |

GitHits records exist for `geo-impact-8.4` and each of `geo-impact-8.4.1` through `geo-impact-8.4.4`, including reviewed patterns and licence notes.

## Measured gate

The complete Chromium performance suite passed all three paths in 60 seconds:

- the real local DuckDB-Wasm analytical path reconciled 2,155 global cells, 19,201 baseline-union observations, 13,416 geographically supported Flickr candidates and 1,221 candidate-only cells with zero external-origin requests;
- repeated interaction medians were 1,051.87 ms for Global to Asia, 1,084.41 ms for Asia to India and 163.87 ms for the Flickr-candidate filter;
- fresh-context global map initialization p95 was 2,503.90 ms across five samples.

The interaction report retains minimum, median, p95 and maximum. The regression gate uses the five-sample median for headless-WebGL interactions because the maximum is not a stable percentile at that sample size and sporadic renderer scheduling affected individual observations. Fresh-context startup remains gated at p95. No CI command rewrites the committed baseline.

Returning to a previously verified scope no longer creates another DuckDB-Wasm worker. A per-mounted-lens LRU keeps at most eight completed scope results and 30,000 preaggregated rows. Uncached work remains cancellable, no raw occurrence dataset is converted to JavaScript records and cache state is not shared between sessions.

## Production distribution

The post-change production build contains 51,240,488 raw bytes. The performance verifier passed these measured ceilings:

| Product group | Current bytes | Ceiling |
| --- | ---: | ---: |
| Complete distribution | 51,240,488 | 52,776,602.60 |
| Geographic evidence | 3,017,829 | 3,222,629 |
| MapLibre renderer vendor | 1,027,752 | 1,093,288 |
| Dashboard chunks | 302,692 | 334,392 |

Source maps remain excluded from the production distribution. The dominant cost remains the local DuckDB-Wasm runtime; the report does not imply that every user downloads all artifacts before opening the lens.

## Verification

- Frontend: 544 passed, 1 skipped across 155 files.
- Focused cache and map lifecycle tests: 10 passed.
- Chromium performance: 3 passed.
- Performance-budget unit tests: 3 passed.
- TypeScript project check: passed.
- Production build and offline map/media distribution verifiers: passed.
- Provenance manifest verifier: passed.
- `git diff --check`: passed.

## Scientific state

Performance work did not alter evidence semantics. The committed campaigns still contain zero retained human Flickr outcomes and zero release-ready rows. Candidate-only cells remain potential coverage-gap evidence, not verified occurrences or biological absence claims.
