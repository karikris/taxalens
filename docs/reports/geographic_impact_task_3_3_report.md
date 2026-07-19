# Geographic Impact Task 3.3 report

Status: complete and pushed to `main`

## Revisions

- TaxaLens starting SHA: `a5946d8423b84249d908cdf38ececfa94ca29f56`
- TaxaLens subtask push SHA: `dc76d8cc4a3f8e50397e237c516c8f47d3ae0aea`
- Verified remote `origin/main`: `dc76d8cc4a3f8e50397e237c516c8f47d3ae0aea`
- BioMiner baseline evidence origin: `247b42f3206d48bb79e2dbf97c5a92e4f207ae71`
- BioMiner Flickr evidence origin: `75461d9c065af0cd96b41cd1f845c2e920f7ae34`
- BioMiner local `main` at the task gate: `d71bceabf75748a25df39d0025e8da907f295f8c`
- Codex session: `019f65d0-3ca9-7870-9eb2-37c14ed02517`
- Primary model: `configured-model`
- Reasoning effort: `xhigh`

BioMiner advanced independently during this task. No moving BioMiner `main`
content was consumed. Browser analytics remain bound to the exact baseline and
Flickr commits and checksums in the Geographic Impact manifest.

## Stale-query cancellation

`queryGeographicImpact` now requires an `AbortSignal`. Its two potentially long
analytical selects use DuckDB-Wasm's pending result stream and `cancelSent`, with
abort races around both stream acquisition and collection. A cancelled query
terminates its dedicated worker and rejects with `AbortError`.

`GeographicImpactQueryController` owns one latest request. Starting any query
cancels its predecessor, and disposal cancels active work and blocks later
execution. The generation guard also rejects stale output from an executor that
ignores its signal, so a superseded scope, target, resolution or metric cannot
update a consumer.

## Scoped cache

The controller uses a bounded immutable LRU cache. Its key includes:

- bundle ID;
- project and run IDs;
- target accepted taxon key;
- baseline and Flickr snapshot IDs;
- scope level and ID;
- spatial resolution;
- evidence mode; and
- metric.

The default bounds are six results and 60,000 total cell rows. Only successful
results still owned by the current request enter the cache. Aborts, failures and
stale completions never do. Hits retain immutable scientific values, wrap the
engineering envelope with `scoped_memory_cache_hit`, and expose hit, miss,
eviction, entry and retained-row statistics.

## Bounded browser memory

All five Parquet views and both Arrow result sets now project explicit columns;
the browser query contains no `SELECT *`. DuckDB receives a transferable copy of
each verified facade buffer, so worker registration cannot detach the canonical
artifact bytes required for later queries.

Raw baseline occurrence and Flickr photo rows remain inside DuckDB. Only
preaggregated impact cells and rollups cross into JavaScript. The map projection
helper emits deterministic centroid-only GeoJSON with a default 5,000-feature
ceiling, selected-metric ranking, exact source/emitted/omitted counts and an
explicit truncation flag. It never manufactures polygons from centroids.

## Real-browser lifecycle corrections

The new real Chromium benchmark exposed two failures hidden by the former SQL
test double:

1. calling `dropFiles` while Parquet handles were closing could fail with
   `file is in use`; dedicated worker termination now releases that private
   in-memory filesystem after connection close;
2. a metric expression in the `ORDER BY` of the `UNION ALL BY NAME` rollup was
   rejected by DuckDB; the union now materializes in a CTE and ordering occurs
   in the outer select.

Setup queries now add the failing source/view label to DuckDB errors. The
benchmark did not pass until the production worker, both queries, decoding,
reconciliation and teardown completed successfully.

## Measured baseline

The committed baseline is documented in
`docs/performance/geographic_impact_lens_browser_baseline.md`. One local
Chromium run through the actual production path measured:

| Operation | Time | Cardinality |
| --- | ---: | ---: |
| Seven-file artifact load | 128.7 ms | 5,506,400 bytes |
| First global resolution-3 query | 949.5 ms | 2,155 cells |
| Scoped-cache hit | 0.1 ms | 2,155 cells |
| India drilldown | 819.4 ms | 208 cells |
| Bounded feature construction | 5.3 ms | 2,155 features |

The global query reconciled 19,201 deduplicated baseline observations, 13,416
geographically supported Flickr candidates and 1,221 candidate-only cells. It
made zero external-origin requests. Precise renderer-heap telemetry observed a
16,834,429-byte increase across artifact load, two cached results and feature
construction, but this does not measure DuckDB worker/Wasm peak memory.

These values are a reproducible development-host baseline, not a hosted latency
claim. No arbitrary regression threshold was introduced; repeated production
build measurements and tolerances remain Task 8.4 work.

## Commits

- `3875ddb25fea5b5112bc67838b8bb82222ceb174` —
  `perf(impact): cancel stale geographic queries`
- `e36d6d3f22f97f4b34c16f1ad27889a8c9c05604` —
  `perf(impact): cache geographic analytics`
- `82786e3e8fbfa1076342bd6683ce69707821fe08` —
  `perf(impact): bound geographic browser memory`
- `dc76d8cc4a3f8e50397e237c516c8f47d3ae0aea` —
  `docs(perf): benchmark Geographic Impact Lens`

GitHits records `geo-impact-3.3`, `geo-impact-3.3.1`, `geo-impact-3.3.2`,
`geo-impact-3.3.3`, and `geo-impact-3.3.4` are present. The broad GitHits
request returned no result through three bounded waits and was terminated once.
Every task/subtask record therefore truthfully marks GitHits unavailable and
uses local TaxaLens, DuckDB-Wasm and Apache Arrow evidence with MIT or
Apache-2.0 licence notes. No external implementation was copied.

## Verification

- Full Python suite: 890 passed.
- Full frontend suite: 397 passed, one skipped; 119 files passed, one skipped.
- Focused browser geographic suite: 36 passed.
- TypeScript project check and production build: passed.
- Real Chromium/DuckDB-Wasm performance journey: passed.
- Global browser result: 2,155 cells; 19,201 baseline union count; 13,416
  geographically supported Flickr candidates; 1,221 candidate-only cells.
- Country drilldown: India, 208 cells and 568 geographically supported Flickr
  candidates.
- External-origin browser requests: zero.
- Geographic Impact verifier: zero mismatches; 20,237 cells, 693 baseline-only,
  183 matched and 6,764 candidate-only projection cells.
- Deterministic Geographic Impact rebuild: passed; 20,237 cells and 385
  summaries.
- Judge demo bundle verifier: passed.
- Provenance verifier: passed.
- Repository-storage verifier: passed; 6 tables, 4 campaigns and 82 items.
- BioMiner boundary verifier: passed with moving-`main` and known untracked
  content recorded in
  `provenance/biominer_state/biominer_boundary_20260717T135233Z.json`.
- `git diff --check`: passed.

The first full Python invocation had 889 passes and one environment-only failure:
the nested native-lint test could not resolve bare `ruff` because `.venv/bin` was
not on `PATH`. The identical suite was rerun with `.venv/bin` on `PATH`; all 890
tests passed. Both attempts are reported.

This task improves the generalized v2 browser analytics path. It does not claim
that the Geographic Impact map UI is implemented, that candidate-only cells are
human-supported, or that any Flickr candidate is release-ready.
