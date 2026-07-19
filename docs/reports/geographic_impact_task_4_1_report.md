# Geographic Impact Task 4.1 report

Status: complete and pushed to `main`

## Revisions

- TaxaLens starting SHA: `7d3e70c2ac935600d8f457a42a9c28c481352e74`
- TaxaLens subtask push SHA: `df055fb6d65041c2e90968849846f5ad8dffc49d`
- Verified remote `origin/main`: `df055fb6d65041c2e90968849846f5ad8dffc49d`
- BioMiner baseline evidence origin: `247b42f3206d48bb79e2dbf97c5a92e4f207ae71`
- BioMiner Flickr evidence origin: `75461d9c065af0cd96b41cd1f845c2e920f7ae34`
- BioMiner local `main` after the task gate: `4a9a7fa53af26b1b6414536a93def82b6076f6ca`
- Codex session: `019f65d0-3ca9-7870-9eb2-37c14ed02517`
- Primary model: `configured-model`
- Reasoning effort: `xhigh`

BioMiner advanced independently during the task. No moving BioMiner `main`
content was consumed. The Geographic Impact contracts and artifacts remain bound
to their exact recorded BioMiner commits and checksums.

## Runtime selection and rights

TaxaLens now pins `maplibre-gl@5.24.0` and
`@vis.gl/react-maplibre@8.1.1` as exact direct browser dependencies. The
MapLibre-only wrapper was selected instead of the combined compatibility entry
point. The lockfile adds 49 transitive package paths; every observed package
declares MIT, ISC, BSD-2-Clause, BSD-3-Clause or `(MIT OR Apache-2.0)`.

The dependency verifier binds the exact installed versions, lockfile integrity,
licence identifiers and direct licence-file checksums. The production build also
emits `THIRD_PARTY_NOTICES.txt` and fails unless it contains the complete
installed notices for both direct packages. Natural Earth boundaries remain
public-domain data with visible voluntary attribution.

GitHits reported no known advisory affecting either selected direct version at
the time of review. The task-level npm audit reported zero vulnerabilities.

## Self-contained world map

The Dashboard now presents a separate TaxaLens Geographic Impact Lens after the
preserved Flickr Workload Map. Its first slice renders the committed normalized
Natural Earth 110m country boundaries through:

- a version-8 in-memory style object;
- a direct local GeoJSON source object;
- separate selectable-country and boundary-only fills;
- a local country stroke layer;
- local navigation and metric scale controls; and
- a visible boundary and renderer attribution caption.

The style contains no tile, glyph, font, sprite, image or source URL. Labels are
not rendered because they would require a glyph source. The map exposes an
explicit no-WebGL fallback and a synchronized-table-oriented explanation rather
than failing silently.

The hosted v1 fixture is represented truthfully: countries are an orientation
layer, while blue baseline and amber Flickr impact layers remain unavailable
until the v2 facade is connected. The component marks scientific impact claims
as disallowed in this state.

## Real-browser corrections and network guard

The initial Playwright invocation could not launch Chromium because the host did
not expose `libnspr4.so` through its default loader path. The exact test was
rerun using the already documented local extracted-browser-library path; this is
a development-host accommodation, not an application dependency.

The real browser test then exposed an actual camera failure. Exact-world
`maxBounds` can make MapLibre's resize constraint singular when a viewport is
wider than the zoom-zero world. Removing that redundant constraint and using an
explicit global center/zoom fixed startup. `renderWorldCopies=false` still
prevents repeated worlds; Task 4.2 will own controlled scope-specific camera
bounds.

The committed Chromium guard is installed before navigation and:

- observes and blocks HTTP(S) requests outside the preview origin;
- separately observes WebSockets, workers and service workers;
- audits browser performance-resource entries;
- requires the actual MapLibre canvas to reach its loaded state;
- rejects uncaught browser errors; and
- verifies the user-visible no-external-assets disclosure.

The production map loaded in the browser in approximately one second during the
passing run and made zero external-origin requests. This is a test observation,
not a hosted performance claim.

## Commits

- `95f9081567d6c96abdc5b5614d7e401d15ad4f03` —
  `build(map): add offline map rendering`
- `77cf416989338545eb8d71dfcb7c8e2ac8029ed6` —
  `feat(map): add self-contained world map`
- `df055fb6d65041c2e90968849846f5ad8dffc49d` —
  `test(map): forbid external map requests`

GitHits records `geo-impact-4.1`, `geo-impact-4.1.1`,
`geo-impact-4.1.2`, and `geo-impact-4.1.3` are present. The broad solution
search returned no relevant source, after which package-scoped pinned source
review supplied the dependency and local-data patterns. The network subtask's
exact Playwright package index failed, so a cross-project solution was used for
the general event-observation pattern. Adopted and rejected patterns, licence
notes, solution IDs and feedback are recorded without copying an external
implementation wholesale.

## Verification

- Full frontend suite: 403 passed, one skipped; 121 files passed, one skipped.
- Focused map unit suite: 6 passed.
- TypeScript project check: passed.
- Production build: passed.
- Real Chromium local-map network guard: passed.
- External-origin requests: zero.
- Browser page errors: zero.
- Direct map dependency verification: passed; 2 direct and 49 transitive paths.
- Deployed map notices: passed; 2 complete direct notices, 10,172 bytes.
- npm audit: zero vulnerabilities.
- Static deployment tests: 3 passed.
- Offline boundary verifier: passed; 177 features, 175 selectable countries,
  7 continents and 508,277 verified runtime bytes.
- Truthful fixture tests: 10 passed.
- Truthful demo verifier: passed; 30 artifacts, 36 records and 3 media items.
- Provenance verifier: passed.
- `git diff --check`: passed.

This task establishes only the offline rendering and network boundary. It does
not claim that evidence layers, drilldown scope, slicers, bubbles, impact
metrics, human-supported contribution or release-ready contribution are already
implemented.
