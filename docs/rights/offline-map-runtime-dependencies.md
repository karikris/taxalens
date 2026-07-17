# Offline map runtime dependency decision

Status: approved for the self-contained TaxaLens Geographic Impact Lens

## Selected packages

TaxaLens pins two direct browser dependencies:

| Package | Version | Licence | Installed licence SHA-256 | Purpose |
| --- | --- | --- | --- | --- |
| `maplibre-gl` | 5.24.0 | BSD-3-Clause | `ee5fc05a0677eaf69601d2c7db0d9ecd6cc27c3abc1d0733bc9ed34707cf8ef2` | WebGL geographic rendering engine |
| `@vis.gl/react-maplibre` | 8.1.1 | MIT | `c80c7101e5039d2f5359729c5fa6b4d58c6904bf7ba75bd6cafd0078438d6634` | React lifecycle and typed Source/Layer components |

The hashes bind the licence files installed from the exact npm packages. The package-lock integrity values bind the distributed package archives.

## Licence and dependency review

GitHits registry metadata and the installed package metadata agree on the direct licences. The installed MapLibre notice includes its BSD-3-Clause grant and bundled third-party notices. The installed React wrapper notice includes its MIT grant and retained Mapbox GL/Style BSD notices.

The lockfile change adds 49 package paths. Every added package declares one of:

- MIT;
- ISC;
- BSD-2-Clause;
- BSD-3-Clause; or
- `(MIT OR Apache-2.0)`.

No copyleft, source-available or unknown licence identifier appears in the added package set. The installed direct licence texts and all required notices must remain available with the distributed application; the Task 4.1 release gate will verify the deployed notice asset after the map runtime enters the production bundle.

Version-specific GitHits checks reported zero known advisories affecting either selected direct version. `npm install` audited the resulting 225-package application tree and reported zero vulnerabilities. This observation is dated 2026-07-17 and does not replace the final release audit.

## Package choice

`@vis.gl/react-maplibre` is selected instead of the combined `react-map-gl` compatibility entry point. It exposes the same MapLibre-specific React lifecycle without adding a second renderer API surface. `maplibre-gl` remains an explicit direct dependency even though the wrapper marks it as an optional peer, keeping the runtime and its licence visible in the TaxaLens manifest and lockfile.

The implementation may use:

- an in-memory local style object;
- committed GeoJSON objects;
- explicit Source and Layer components;
- local navigation controls; and
- MapLibre's WebGL renderer.

It may not use:

- remote style URLs;
- external raster or vector tiles;
- remote glyphs, fonts or sprites;
- remote GeoJSON;
- Mapbox access tokens;
- telemetry or analytics; or
- renderer-side clustering that obscures exact scientific cell states.

## Evidence reviewed

- `maplibre-gl@5.24.0` npm metadata and installed package notice;
- `@vis.gl/react-maplibre@8.1.1` npm metadata and installed package notice;
- pinned `visgl/react-map-gl` direct-GeoJSON and clustered-source examples at commit `f295bd524e01b7fc0fb9c9e9d1d5bd47b055b67d`;
- the exact depth-two GitHits dependency graphs;
- the existing TaxaLens Natural Earth boundary rights decision; and
- the generated npm package-lock and installed package metadata.

No upstream implementation was copied. TaxaLens adopts only the documented component/API structure and rejects every remote URL in the reviewed examples.
