# Geographic Impact production bundle size

Date: 2026-07-18 (Australia/Sydney)

Task: `geo-impact-8.4.3`

TaxaLens base revision: `9d7042d98fde4a0e53d6d6d2e8d56ed0d993d824`

## Result

The self-contained production replay contains **51,239,420 uncompressed bytes across 71 files**. This is a measured static-distribution size, not a transferred-byte or startup-download claim. The build emits no source maps, so the measurement excludes zero files.

| Category | Files | Bytes | Share of distribution |
| --- | ---: | ---: | ---: |
| DuckDB-Wasm runtime and Parquet extension | 4 | 43,275,877 | 84.46% |
| All Wasm | 2 | 42,229,955 | 82.42% |
| All JavaScript, including worker | 25 | 4,047,216 | 7.90% |
| All Parquet evidence | 6 | 3,228,629 | 6.30% |
| Geographic evidence group | 8 | 3,017,829 | 5.89% |
| MapLibre renderer vendor chunk | 1 | 1,027,752 | 2.01% |
| Dashboard JavaScript and CSS chunks | 2 | 301,624 | 0.59% |
| All CSS | 5 | 254,838 | 0.50% |
| Verification media copied under its stable public paths | 3 | 470,490 | 0.92% |

Product groups overlap and must not be summed. For example, geographic Parquets are included in both the geographic-evidence group and the all-Parquet category. The DuckDB worker JavaScript is included in both the DuckDB runtime group and all JavaScript.

## Geographic files

The 3,017,829-byte geographic-evidence group consists of:

| File role | Bytes |
| --- | ---: |
| Flickr audit geography Parquet | 941,398 |
| Flickr geography Parquet | 769,162 |
| Flickr workload assignments Parquet | 633,625 |
| Geographic Impact cells Parquet | 639,681 |
| Flickr workload clusters Parquet | 22,573 |
| Workload and verification JavaScript helpers | 9,826 |
| Legacy geographic-cluster JSON | 1,564 |

The baseline provider union, hierarchy and summary artifacts remain committed in the repository and judge-bundle contracts. The public map path emits the materialized impact cells it actually requests; this report does not claim every committed provenance artifact is a separately downloaded production file.

## Measurement method

`apps/web/scripts/report-geographic-bundle-size.mjs` walks `dist/web` after a clean Vite production build, sorts every relative path, excludes `*.map`, reads filesystem byte sizes and prints deterministic JSON. It reports extension categories and overlapping product groups separately.

Reproduce from `apps/web`:

```text
npm run build
npm run report:geographic-bundle-size
```

The production build also verifies the local MapLibre licence notices and public review-media checksums. The existing build warning for chunks above 500 kB remains visible and is not relabelled as a passing optimization claim.

## Interpretation

The static replay is dominated by the pinned DuckDB engine and local Parquet extension, not by MapLibre or geographic evidence. Because the replay is self-contained, those bytes trade network service dependencies for a larger static distribution. Browser caching, HTTP compression and request timing determine transferred bytes in a deployment and are intentionally outside this raw filesystem measurement.

Task 8.4.4 uses these exact measured bytes to set a transparent regression ceiling. It does not claim that 51.2 MB is an ideal product target or that every judge downloads all files before opening Geographic Impact.

## Environment

- Node.js: 22.22.1
- npm: 9.2.0
- OS: Linux 6.6.114.1-microsoft-standard-WSL2, x86_64
- Build output: `dist/web`
- Source maps emitted: none
