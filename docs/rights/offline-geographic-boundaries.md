# Offline geographic boundary rights and source decision

Status: approved for the TaxaLens Geographic Impact Lens display layer

## Selected source

TaxaLens will bundle Natural Earth's **Admin 0 – Countries**, 1:110 million
GeoJSON layer from release `v5.1.2`:

- publisher: Natural Earth;
- source repository: `nvkelso/natural-earth-vector`;
- exact source commit: `f1890d9f152c896d250a77557a5751a93d494776`;
- source path: `geojson/ne_110m_admin_0_countries.geojson`;
- source URL: <https://github.com/nvkelso/natural-earth-vector/blob/f1890d9f152c896d250a77557a5751a93d494776/geojson/ne_110m_admin_0_countries.geojson>;
- release: <https://github.com/nvkelso/natural-earth-vector/releases/tag/v5.1.2>;
- official terms: <https://www.naturalearthdata.com/about/terms-of-use/>;
- intended use: low-resolution display, navigation, scope bounds and accessible
  country/continent selection;
- prohibited inference: authoritative borders, legal status, precise containment,
  occurrence coordinates or biological absence.

The exact upstream bytes inspected during this decision are 838,726 bytes with
SHA-256 `6866c877d39cba9c357620878839b336d569f8c662d3cfab4cb1dbe2d39c977f`.
They contain 177 polygon or multipolygon features. The bundled derivative and
its own checksum will be recorded in the data manifest in Subtask 2.3.2.

## Rights and redistribution

Natural Earth's official Terms of Use declare all Natural Earth raster and
vector map data public domain. The terms permit modification, electronic
distribution, printing, personal, educational and commercial use without
permission. Credit is not required.

TaxaLens will nevertheless display the voluntary credit:

> Made with Natural Earth. Free vector and raster map data @ naturalearthdata.com.

The public-domain grant covers the source data. TaxaLens-authored normalization,
manifests, tests and application code remain under the repository's MIT licence.

## Why this layer

The 1:110m source is the appropriate Natural Earth scale for a self-contained
global and continent browser view. It is already published as GeoJSON, is under
one megabyte before TaxaLens normalization, has only polygonal geometry and
includes names, stable Natural Earth IDs, ISO fields, continent fields, label
points and cartographic metadata. Using the primary GeoJSON avoids a derived
package dependency and lets the verifier bind the deployed bytes directly to a
publisher release and commit.

The generalized linework is deliberately unsuitable for precise point-in-country
classification. Candidate country/admin values continue to come from committed
evidence artifacts when available. The map boundary is visual and navigational;
it must not manufacture geography for Flickr or baseline records.

## Normalization limits

The source inspection found:

- 148 `Polygon` and 29 `MultiPolygon` features;
- source continent values covering the seven TaxaLens continents plus one
  `Seven seas (open ocean)` feature;
- two boundary features, Northern Cyprus and Somaliland, without resolved
  two-letter ISO identities;
- some source `ISO_A2` values set to `-99`, with `ISO_A2_EH` resolving all but
  those two boundary-only features.

TaxaLens therefore will:

1. retain every source feature and its Natural Earth identity in the local
   boundary GeoJSON;
2. use a valid `ISO_A2_EH` value for selectable country identity where present;
3. keep Northern Cyprus and Somaliland visible as non-selectable,
   boundary-only features rather than inventing ISO codes;
4. preserve the original continent value in provenance;
5. normalize the `Seven seas (open ocean)` feature through an explicit,
   documented hierarchy override rather than silently coercing it;
6. provide exactly the seven continent scopes required by the TaxaLens
   country-hierarchy contract;
7. publish scope bounds and centroids as display-navigation metadata, not
   occurrence coordinates.

Political boundaries and labels are cartographic source statements. They are not
TaxaLens scientific findings or endorsements.

## Alternatives reviewed

### geoBoundaries simplified global data

The official simplified dataset is available under CC BY 4.0 and requires
attribution. It is a viable source, but its extra attribution obligation and
different political-boundary policy provide no material advantage for this
small-scale display layer. It remains a future option if TaxaLens needs a
country-specific or differently stated boundary product.

### Derived TopoJSON packages

Prebuilt world-atlas/TopoJSON packages can reduce transfer size and are useful
when topology sharing is required. They introduce another transformation and
package provenance layer, while the selected primary source is already within
the current static replay budget. TaxaLens can generate a deterministic local
derivative later if measured bundle performance requires it; no runtime package
or remote data request is justified now.

### Higher-resolution Natural Earth layers

The 1:50m and 1:10m layers provide more geometry than the global judge replay
needs and increase bundle, parsing and rendering costs. They are rejected until
a measured country-scale requirement demonstrates that 1:110m is inadequate.

## Required verification before release

The data may be committed only with a manifest and automated checks for:

- exact upstream release, commit, source path, source SHA-256 and local SHA-256;
- public-domain rights and voluntary attribution text;
- expected feature IDs and valid polygonal GeoJSON geometry;
- finite longitude/latitude coordinates within geographic domains;
- unique selectable ISO alpha-2 country codes;
- explicit boundary-only feature handling;
- exactly seven continent parents and no orphan selectable country;
- hierarchy/geometry feature agreement;
- deterministic bounds and centroids;
- no external source, tile, font, sprite, telemetry or analytics dependency.

GitHits was unavailable for this task after one bounded task-level attempt. The
selection therefore relies on the exact upstream Git object, the Natural Earth
publisher's official terms and dataset documentation, the reviewed geoBoundaries
publisher page and local TaxaLens contract evidence. No external implementation
code was copied.
