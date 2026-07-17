# Offline geographic boundary bundle size

Measured publication: Natural Earth Admin 0 – Countries, 1:110m, release
`v5.1.2`, source commit `f1890d9f152c896d250a77557a5751a93d494776`.

| File | Intended deployment role | Bytes |
| --- | --- | ---: |
| `natural_earth_110m_countries.geojson` | Low-resolution country geometry | 353,229 |
| `country_hierarchy.json` | Global, continent and country navigation | 102,491 |
| `natural_earth_110m_iso_country_mapping.json` | ISO-to-feature and scope mapping | 51,457 |
| `natural_earth_attribution.json` | Rights and voluntary credit | 1,100 |
| **Runtime boundary payload** | Four files above | **508,277** |
| `geographic_boundaries_manifest.json` | Build and verification metadata | 4,642 |
| `natural_earth_110m_admin_0_countries.source.geojson` | Exact publisher source retained for provenance; not a browser runtime asset | 838,726 |
| **Complete repository evidence footprint** | Runtime, manifest and exact source | **1,351,645** |

The normalized browser geometry is 353,229 bytes, 57.9% smaller than the
838,726-byte exact publisher GeoJSON while retaining all 177 geometries and
their coordinate precision. The reduction removes unused source properties and
uses compact deterministic GeoJSON; it does not simplify or otherwise alter
geometry.

These are uncompressed committed byte counts. They are measurements, not a load
time or memory claim. The public replay does not need the retained exact source
file at runtime. A later static-deployment task must copy only the verified
runtime payload and manifest into the hosted build, then report the measured
compressed transfer and parsed memory behavior.
