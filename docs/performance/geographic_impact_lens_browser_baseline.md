# Geographic Impact Lens browser performance baseline

Date: 2026-07-17 (Australia/Sydney)

Task: `geo-impact-3.3.4`

TaxaLens base revision: `82786e3e8fbfa1076342bd6683ce69707821fe08`

Impact manifest: `geographic-impact-manifest:7f6d74f020db6cc4b4ba93dd`

Impact build: `geographic-impact:84b8d1b69c3dae1e329a3f6b`

## Result

The dedicated Chromium benchmark completes the real production DuckDB-Wasm full-outer cell comparison, a same-input scoped-cache hit, an India drilldown and bounded map-feature construction using the committed v2 geographic artifacts. It makes no external-origin request.

| Operation | Measured time | Result cardinality |
| --- | ---: | ---: |
| Load seven manifest-bound geographic files | 128.7 ms | 5,506,400 bytes |
| First global resolution-3 query | 949.5 ms | 2,155 cells |
| Repeat global query from scoped cache | 0.1 ms | 2,155 cached cells |
| Drill down to India | 819.4 ms | 208 cells |
| Build bounded centroid features | 5.3 ms | 2,155 features |

The cache timing is a single high-resolution browser observation, not a zero-cost claim.

The query registered 4,883,017 bytes of selected Parquet sources. Its global result reconciled:

- 19,201 deduplicated baseline observations;
- 13,416 geographically supported Flickr candidates;
- 1,221 candidate-only resolution-3 cells;
- 2,155 source/materialized full-outer cells.

The India drilldown reconciled 568 geographically supported Flickr candidates. The cache reported one hit, two misses, two entries and 2,363 retained cell rows. Map projection emitted all 2,155 global cells, omitted none and did not hit the 5,000-feature ceiling.

Chromium exposed precise renderer-heap telemetry for this run. Used JavaScript heap rose from 5,883,272 to 22,717,701 bytes, a 16,834,429-byte increase after artifact loading, two retained query results and feature construction. This is a renderer-realm observation, not a DuckDB worker/Wasm peak-memory measurement.

## Measurement method

The isolated benchmark in `apps/web/e2e/geographic-impact.performance.spec.ts`:

1. opens a minimal same-origin Vite page without starting the judge application;
2. fetches the committed impact manifest, five Parquets and country hierarchy through local Playwright route fulfilment;
3. constructs the production `TaxaLensProjectFacade` with manifest-bound descriptors;
4. invokes the production `GeographicImpactQueryController` and `queryGeographicImpact` path;
5. starts the real DuckDB-Wasm worker, verifies DuckDB `v1.4.3`, verifies and loads the bundled Parquet extension, and executes the production SQL;
6. repeats the exact global input to exercise the scoped in-memory cache;
7. changes only the scope to `country:IN` and executes another real worker query;
8. invokes `buildBoundedGeographicImpactFeatures`; and
9. asserts exact artifact-backed counts and zero external-origin requests.

The timed artifact-load interval excludes Vite module loading and general application startup. The first-query interval includes DuckDB worker/Wasm startup, local extension verification/loading, in-memory file registration, both analytical queries, decoding, source/materialized reconciliation and worker teardown. No raw occurrence or Flickr row is converted to a JavaScript object.

Reproduce from `apps/web` with:

```text
LD_LIBRARY_PATH=/tmp/taxalens-playwright-libs/root/usr/lib/x86_64-linux-gnu \
  npx playwright test \
  --config=playwright.performance.config.ts \
  --project=chromium \
  --workers=1
```

The `LD_LIBRARY_PATH` prefix is specific to this WSL test host's locally extracted Chromium libraries and is not an application requirement.

## Environment

- Playwright: 1.61.1
- Chromium user agent: Chrome 149.0.7827.55, Playwright Desktop Chrome profile
- Node.js: 22.22.1
- npm: 9.2.0
- OS: Linux 6.6.114.1-microsoft-standard-WSL2, x86_64
- CPU visible to WSL: 18 logical CPUs, Intel Core Ultra 7 265K
- Memory visible to WSL: 75,880,755,200 bytes
- DuckDB-Wasm package: 1.32.0
- DuckDB engine: v1.4.3
- Evidence resolution: 3
- Scope sequence: global, then India (`country:IN`)
- Evidence mode: comparison
- Metric: record count

## Interpretation limits

This is one reproducible local development-server baseline, not a hosted-service latency claim or a statistically stable benchmark distribution. Route fulfilment checks exact byte counts and production manifest bindings; checksum and bundle verification remain separate release gates. Browser `performance.memory` does not expose worker/Wasm peak allocation, and no forced garbage collection was used. This original Task 3.3 run deliberately established no regression threshold; the repeated Task 8.4 measurements below add the first measured tolerances.

The run also exposed and now covers two real-browser-only lifecycle failures: registered in-memory files must be released by dedicated worker termination rather than `dropFiles` racing open Parquet handles, and rollup ordering must be applied outside the `UNION ALL BY NAME` compound query. The benchmark did not pass until both production paths completed cleanly.

## Task 8.4 repeated browser gate

Task 8.4 added five fresh-context startup observations plus five in-session observations for each controlled interaction. The committed baseline is `apps/web/performance/geographic-impact-performance-baseline.json`; CI never rewrites it automatically.

| Operation | Gated statistic | Committed baseline | Regression ceiling | Completion signal |
| --- | --- | ---: | ---: | --- |
| Global map initialization | p95 | 2,475.30 ms | 3,225.30 ms | map loaded, global camera, 2,155 features, blue and amber evidence present |
| Global → Asia | median | 1,312.36 ms | 2,812.36 ms | URL, camera scope and 2,879-cell table agree |
| Asia → India | median | 1,227.21 ms | 2,227.21 ms | URL, camera scope and 2,526-cell table agree |
| All evidence → Flickr candidates | median | 187.57 ms | 937.57 ms | exact live status and 1,319-cell table agree |

Each ceiling equals the measured baseline plus the larger of its recorded relative or absolute tolerance. Fresh-context startup uses p95. Interaction gates use the median of five samples because p95 over five observations is the single maximum and proved dominated by nondeterministic headless-WebGL scheduling on this WSL host; minimum, median, p95 and maximum remain emitted for diagnosis. A sustained interaction regression still moves the median and fails the gate. These are regression tripwires for this replay and test host class, not universal service-level objectives.

The repeated drilldown test also exposed a transient MapLibre image-lifecycle race. Local excluded and uncertain marker images are now registered once per map lifecycle, and symbol layers are passed directly to the source rather than through a fragment. Repeated continent/country transitions complete without degrading to the static fallback.

Scope changes originally rebuilt a DuckDB-Wasm worker even when returning to a scope already verified during the same mounted lens session. The map now retains a per-lens LRU capped at eight decoded scopes and 30,000 preaggregated cell rows. Only completed results enter the cache; uncached queries remain abortable, raw Parquet is not retained as JavaScript records, and no cache is shared across sessions.
