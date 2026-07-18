# Geographic Impact production bundle size

Date: 2026-07-18 (Australia/Sydney)

Task: `geo-impact-8.4.3`

TaxaLens base revision: `9d7042d98fde4a0e53d6d6d2e8d56ed0d993d824`

## Result

The self-contained production replay contains **50,071,505 uncompressed bytes across 81 files**. This is a measured static-distribution size, not a transferred-byte or startup-download claim. The build emits no source maps, so the measurement excludes zero files.

| Category | Files | Bytes | Share of distribution |
| --- | ---: | ---: | ---: |
| DuckDB-Wasm runtime and Parquet extension | 5 | 38,012,035 | 75.92% |
| All Wasm | 2 | 37,109,890 | 74.11% |
| All JavaScript, including worker | 28 | 3,936,698 | 7.86% |
| All Parquet evidence | 9 | 7,127,688 | 14.24% |
| Geographic evidence group | 16 | 7,044,964 | 14.07% |
| MapLibre renderer vendor chunk | 1 | 1,027,752 | 2.05% |
| Dashboard JavaScript and CSS chunks | 2 | 342,724 | 0.68% |
| All CSS | 5 | 254,838 | 0.51% |
| Verification media copied under its stable public paths | 3 | 470,490 | 0.94% |

Product groups overlap and must not be summed. For example, geographic Parquets are included in both the geographic-evidence group and the all-Parquet category. The DuckDB worker JavaScript is included in both the DuckDB runtime group and all JavaScript.

## Geographic files

The 7,044,964-byte geographic-evidence group consists of:

| File role | Bytes |
| --- | ---: |
| Deduplicated baseline occurrence union | 3,343,827 |
| Flickr verification geography | 941,398 |
| Legacy Flickr geography | 769,162 |
| Flickr workload assignments | 633,625 |
| Geographic Impact cells | 639,681 |
| Baseline geographic spread | 513,562 |
| Country hierarchy | 102,491 |
| Geographic Impact summary | 41,670 |
| Flickr workload clusters | 22,573 |
| Geographic impact/workload JavaScript | 27,469 |
| Geographic Impact manifest | 7,330 |
| Legacy geographic-cluster JSON | 1,564 |
| Verification consensus and release decisions | 612 |

The group now includes every v2 baseline, Flickr, impact, hierarchy, consensus and release artifact carried by the credential-free bundle. Record context and review projection consume those already checksum-verified bundle bytes; Vite no longer emits duplicate Flickr-geography and impact-cell Parquets.

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

Task 8.4.4 uses these exact measured bytes to set transparent regression ceilings:

| Budget | Baseline | Ceiling |
| --- | ---: | ---: |
| Total raw distribution | 50,071,505 bytes | 51,573,650.15 bytes |
| Geographic evidence group | 7,044,964 bytes | 7,397,212.2 bytes |
| MapLibre renderer vendor | 1,027,752 bytes | 1,093,288 bytes |
| Dashboard chunks | 342,724 bytes | 376,996.4 bytes |

The ceiling is the measured baseline plus the larger of its recorded relative or absolute tolerance. This does not claim that 51.2 MB is an ideal product target or that every judge downloads all files before opening Geographic Impact.

## Environment

- Node.js: 22.22.1
- npm: 9.2.0
- OS: Linux 6.6.114.1-microsoft-standard-WSL2, x86_64
- Build output: `dist/web`
- Source maps emitted: none
