# Geographic Impact Task 11.1.1 technical gate

Date: 2026-07-18 (Australia/Sydney)

Starting TaxaLens SHA: `769ce9545c42ccaa8d8d6b9d2242d9e62e2359c8`

Observed BioMiner `main`: `c7eaa9bf3696a25a0c8229837819dccec4fb9d66`

Consumed BioMiner artifact commits:

- baseline geography: `247b42f3206d48bb79e2dbf97c5a92e4f207ae71`;
- Flickr geography: `75461d9c065af0cd96b41cd1f845c2e920f7ae34`.

## Result

The complete local technical gate passes after two release-harness repairs:

1. the direct Geographic Impact verifier now adds the repository root before importing the
   repository packages, and a subprocess regression test proves it runs from an unrelated working
   directory; and
2. browser performance tests now use a dedicated one-worker Vite development harness because they
   intentionally import source modules. The production-preview E2E matrix excludes those three
   measurements and runs them separately.

Bundle-v2 migration also made three old E2E assertions ambiguous or stale. They now scope the
stored research answer separately from the geographic replay and expect the canonical migrated
section ledger: 8 available, 9 partial, and 14 unavailable.

## Automated receipts

| Gate | Current result |
| --- | --- |
| Full Python | 909 passed in 27.43 seconds |
| Full Vitest | 544 passed, 1 intentional skip; 154 files passed, 1 skipped |
| TypeScript | Passed |
| Native Ruff check and format | 147 native files clean |
| Source-locked Ruff report | 46 retained compatibility findings across 14 files; reported, not suppressed |
| JSON Schema and cross-language parity | Passed inside the full Python and frontend suites |
| Judge bundle and rights/attribution | 30 artifacts, 36 records, 3 rights-covered media items; passed |
| BioMiner prototype import | 21 pinned artifacts passed |
| BioMiner analytics import | 4 pinned artifacts passed |
| BioMiner baseline geography import | 6 pinned artifacts passed |
| Flickr geography handoff | 13,501 candidate rows passed |
| Geographic boundaries | 177 features, 175 selectable countries, 7 continents; passed |
| Geographic Impact DuckDB cross-check | 20,237 cells and zero differences; passed |
| Repository Supabase/B2 mirror | 6 tables, 4 campaigns, 82 items; passed |
| BioMiner boundary | Passed; retained pin available; unrelated upstream untracked paths warned and excluded |
| Supabase migration contract | 4 migrations passed in local PostgreSQL |
| Public review media | 4 tests passed; only the 3 approved Commons images accepted |
| Offline map dependency licences | Passed; direct dependencies 2, transitive paths 49 |
| Production and static deployment build | Passed; 73 fingerprinted files |
| Deployment fingerprint during the pre-commit gate | `32eaa4ed4895399c24887b8a116fb4f3654b90f740b79f465175da8ea603529e` bound to starting SHA |
| Browser E2E | 67 passed, 1 explicit measurement skip in 35.2 seconds |
| Browser matrix | Chromium full; Firefox smoke; WebKit smoke passed |
| Dedicated performance E2E | 3 passed in 1.2 minutes |
| Visual regression | 20 passed in 30.8 seconds |
| Map network guard | Passed with zero external requests |
| No-WebGL and no-WASM states | Passed in the E2E matrix |
| Performance budget verifier | 3 tests plus current distribution budgets passed |
| npm audit | 0 vulnerabilities |
| Tracked secret-pattern scan | No PEM private keys, AWS access keys, GitHub tokens, or OpenAI-style keys matched |
| Sensitive tracked filenames | Only `apps/web/src/vite-env.d.ts`; no key/certificate file |
| Tracked large-file scan | No tracked file over 5 MiB |
| Provenance | Passed |
| `git diff --check` | Passed before the release commit |

The WebKit runtime passed both map and verification smoke tests. Playwright's package-based host
validator incorrectly reported two missing Ubuntu packages despite the temporary runtime library
set being sufficient, so the run used `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1`. This bypassed
only the preliminary package-name check; WebKit launched and exercised the real product.

## Performance measurements

Dedicated one-worker measurements reported:

- artifact load: 132.6 ms for 7 files / 5,589,959 bytes;
- first full-outer query: 910.5 ms for 2,155 cells;
- scoped cache hit: 0 ms;
- India drilldown query: 762.9 ms;
- bounded map feature construction: 5.2 ms for 2,155 features;
- repeated application-map initialization p95: 2,458.6 ms against a 3,225.3 ms ceiling; and
- zero external requests.

The interaction budget uses the median for the continent and country drilldown. One dev-server
country sample was a 17,770.51 ms outlier, but the measured country median was 1,060.78 ms and the
configured gate passed. No unsupported latency claim is made from that outlier.

## Exact commands

```text
uv run --locked pytest
uv run --locked python scripts/verify_native_lint.py
uv run --locked python scripts/verify_demo.py
uv run --locked python scripts/verify_geographic_boundaries.py
uv run --locked python scripts/verify_geographic_impact.py
uv run --locked python scripts/import_biominer_prototype_artifacts.py --check
uv run --locked python scripts/import_biominer_analytics.py --check
uv run --locked python scripts/import_biominer_baseline_geography.py --check
uv run --locked python scripts/verify_flickr_geography_handoff.py
uv run --locked python scripts/build_repository_storage.py --check
uv run --locked python scripts/verify_biominer_boundary.py
uv run --locked python scripts/verify_provenance.py
npm --prefix apps/web test
npm --prefix apps/web run check
npm --prefix apps/web run test:map-dependencies
npm --prefix apps/web run test:deployment
npm --prefix apps/web run test:performance-budgets
npm --prefix apps/web run build:deployment
npm --prefix apps/web run test:media-static
npm --prefix apps/web run test:supabase
npm --prefix apps/web audit --audit-level=high
PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 npm --prefix apps/web run test:e2e
npm --prefix apps/web run test:performance
PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 npm --prefix apps/web run test:visual
git diff --check
```

Browser commands also set the existing temporary Playwright `LD_LIBRARY_PATH`. The BioMiner
boundary verifier wrote a timestamped diagnostic snapshot during its check; that transient file was
removed rather than committed. The user's modified AI provenance report and untracked agent-policy
content were not staged or changed.

## Known non-failing diagnostics

- Vite reports chunks larger than its generic 500 kB advisory threshold; measured distribution
  budgets pass.
- DuckDB-Wasm's development worker references an absent source-map file; the worker and production
  build operate correctly.
- Source-locked BioMiner compatibility files retain 46 reported Ruff findings under the declared
  boundary; native TaxaLens files are clean.
- No retained human outcome, QualitySnapshot, or occurrence-release decision exists. Technical
  release readiness does not authorize a scientific claim.
