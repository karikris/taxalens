# Geographic Impact Task 4.2 report

Status: complete and pushed to `main`

## Revisions

- TaxaLens starting SHA: `bd979dcf37a64cc99e00f3c12c47210c0eb14180`
- TaxaLens subtask push SHA: `fe3a2aa115ca68be5a9039c10e1c839311e9f98e`
- Verified remote `origin/main`: `fe3a2aa115ca68be5a9039c10e1c839311e9f98e`
- BioMiner baseline evidence origin: `247b42f3206d48bb79e2dbf97c5a92e4f207ae71`
- BioMiner Flickr evidence origin: `75461d9c065af0cd96b41cd1f845c2e920f7ae34`
- BioMiner local `main` after the task gate: `534b2894b24f393367555e9a04ad73da31609bb9`
- Codex session: `019f65d0-3ca9-7870-9eb2-37c14ed02517`
- Primary model: `configured-model`
- Reasoning effort: `xhigh`

BioMiner advanced independently during this task. No moving BioMiner `main`
content was consumed. The navigation hierarchy remains the checksum-verified
Natural Earth artifact already committed to TaxaLens.

## Semantic scope state

Geographic scope is now one validated hierarchy identity rather than a camera
position or a collection of independent filters. The scope index verifies the
country-hierarchy schema, unique scope IDs, level prefixes, parent identities,
finite centroids and finite bounds before exposing:

- one Global node;
- seven continent nodes;
- 175 country nodes; and
- zero admin1 nodes in the current committed hierarchy.

The type and traversal contract supports admin1, but the interface does not
invent regional choices until a verified hierarchy supplies them.

Scope is encoded as the `geo` query key inside the existing Dashboard hash. The
canonical Global route remains `#dashboard`; for example, India is
`#dashboard?geo=country%3AIN`. User scope changes create history entries, while
hash changes restore state. Unknown or repeated scope parameters fail closed to
Global with a visible explanation rather than guessing a geography.

## Slicers and breadcrumbs

The controlled Continent and Country slicers derive their values from the exact
selected ancestry. Country choices are limited to the selected continent;
changing continent clears country/admin1 scope, and Reset returns to Global.
The Country control remains disabled until a continent is selected.

The accessible breadcrumb uses a labelled navigation landmark and ordered list.
All ancestors are native buttons, the selected scope is non-interactive and
marked `aria-current="page"`, and visual separators are hidden from assistive
technology. Native controls provide keyboard behavior without duplicate custom
key handlers.

## Camera and boundary synchronization

Scope changes now drive the MapLibre camera through a typed safe `MapRef`:

- Global uses a direct center/zoom jump instead of fitting exact 360-degree
  bounds;
- ordinary continent, country and future admin1 nodes use their committed
  hierarchy bounds with bounded zoom and padding;
- non-global nodes whose committed geometry spans the full longitude range use
  their committed centroid and a level-specific fallback zoom; and
- animated movements are non-essential, so MapLibre honors
  `prefers-reduced-motion` by falling through to an immediate jump.

The map records the selected and completed camera scope in the DOM for truthful
browser verification. Selectable boundary clicks use only exact `country_code`
properties and resolve them against the country hierarchy. Boundary-only or
unknown features do nothing. Map clicks, slicers, breadcrumbs and history all
dispatch the same semantic scope transition before the camera follows it.

Transient user pan/zoom does not alter semantic scope or browser history.

## Commits

- `889c3977f76ec9e383ce2d9dc8bea9b46bd86b3c` —
  `feat(map): add geographic scope state`
- `92c0e1b2153f693cc4daf1c52d897218ce053646` —
  `feat(map): add geographic slicers`
- `39659925369b81dbf21c5712924e96eeb8430a40` —
  `feat(map): add geographic breadcrumbs`
- `fe3a2aa115ca68be5a9039c10e1c839311e9f98e` —
  `feat(map): synchronize map drilldown`

GitHits records `geo-impact-4.2`, `geo-impact-4.2.1`,
`geo-impact-4.2.2`, `geo-impact-4.2.3` and `geo-impact-4.2.4` are present.
The broad search returned no relevant solution, after which pinned React
MapLibre and MapLibre source supplied two camera-control approaches and the
relevant edge cases. The URL-state search supplied validation/history concepts.
The breadcrumb result's redundant native-button key handlers were explicitly
rejected and received negative feedback. Every record includes adopted and
rejected patterns and licence notes; no external implementation was copied.

## Verification

- Full frontend suite: 417 passed, one skipped; 125 files passed, one skipped.
- Focused geographic state, slicer, breadcrumb, camera and map integration
  tests: passed.
- TypeScript project check: passed.
- Production build and deployed map-notice verifier: passed.
- Chromium geographic scope journey: passed in 7.3 seconds.
- Chromium offline map network guard: passed.
- Country deep link: passed.
- Keyboard breadcrumb activation: passed.
- Global, continent and country camera completion: passed.
- Full-span Oceania camera fallback: passed.
- Browser back/forward restoration: passed.
- Reset to Global: passed.
- Exact map-feature country selection integration: passed.
- External-origin requests: zero in the map network journey.
- Offline boundary verifier: passed; 177 features, 175 selectable countries,
  7 continents and 508,277 verified runtime bytes.
- Provenance verifier: passed.
- npm audit: zero vulnerabilities.
- `git diff --check`: passed.

This task implements geographic navigation only. The map still does not render
blue baseline bubbles, amber Flickr states, impact metrics, human-supported
additional cells or release-ready contribution; those remain gated by the next
numbered tasks.
