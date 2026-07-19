# Geographic Impact Task 2.3 report

Status: complete and pushed to `main`

## Revisions

- TaxaLens starting SHA: `6a7b344f8fd063ca31c64c1c248b3c2bae1437ab`
- TaxaLens task push SHA: `8e7c3f4b4f15eed98e87b3464c54b57b7b96caab`
- Verified remote `origin/main`: `8e7c3f4b4f15eed98e87b3464c54b57b7b96caab`
- Natural Earth source commit: `f1890d9f152c896d250a77557a5751a93d494776`
- Natural Earth release: `v5.1.2`
- Codex session: `019f65d0-3ca9-7870-9eb2-37c14ed02517`
- Primary model: `configured-model`
- Reasoning effort: `xhigh`

Task 2.3 is not a BioMiner engine migration. It consumes a commit-pinned,
publisher-maintained public-domain boundary dataset for offline display and
navigation only.

## Rights decision

The selected source is Natural Earth Admin 0 – Countries at 1:110m. Natural
Earth's official Terms of Use place its raster and vector data in the public
domain and permit modification, redistribution and commercial use without
permission or required credit. TaxaLens nevertheless bundles the publisher's
suggested voluntary credit.

The geoBoundaries simplified global layer was also reviewed. It is a viable CC
BY 4.0 source but requires attribution and offers no material advantage for this
low-resolution display layer. Derived TopoJSON packages and higher-resolution
Natural Earth layers were also rejected because they add transformation,
dependency or payload cost before a measured need.

The full source and rights decision is in
`docs/rights/offline-geographic-boundaries.md`.

## Committed publication

| Artifact | Records | Bytes | SHA-256 |
| --- | ---: | ---: | --- |
| Exact Natural Earth source GeoJSON | 177 | 838,726 | `6866c877d39cba9c357620878839b336d569f8c662d3cfab4cb1dbe2d39c977f` |
| Normalized country boundary GeoJSON | 177 | 353,229 | `a65b36344ace327fdc546bf2613eff026680905e9d2a634443713bb0d07abf33` |
| ISO country mapping | 175 | 51,457 | `4b70b5b4b00e4713caf933dd53a57b383361773fe029b1cc2938b6e94479777d` |
| Country hierarchy | 183 | 102,491 | `f7181eff58f5d68cf0c9987c320b10bb4d9e22220f45af30e33f4de4cb198a54` |
| Rights and attribution | 1 | 1,100 | `b2d519d5d8a4fd6e340eda13de29c4e8c8beb019bfbaf078e96d7b99ae94e3ed` |
| Geographic boundary manifest | 1 | 4,642 | `c99124704c61a90bc45fc5f09dadb7c565f48e3b794b7f3f05216f8a9671a19e` |

The runtime boundary payload is 508,277 uncompressed bytes. The exact publisher
source is retained in repository provenance but is not a browser runtime asset.
The complete source, derivative, hierarchy, mapping, attribution and manifest
are covered by the repository Backblaze B2 replacement inventory, which now
contains 92 objects and requires no external storage credential.

## Hierarchy and political-geography handling

The hierarchy contains:

- 1 global node;
- 7 continent nodes;
- 175 selectable ISO alpha-2 country nodes;
- 0 admin1 nodes at this task boundary.

All 177 source geometries remain visible. Northern Cyprus and Somaliland have
no resolved source ISO alpha-2 identity, so they remain explicit boundary-only,
non-selectable features; TaxaLens does not invent codes. The source classifies
French Southern and Antarctic Lands as `Seven seas (open ocean)`. TaxaLens maps
that one feature to the source's own `REGION_UN` value, Africa, and records the
override in both mapping and manifest.

These polygons are generalized cartographic display geometry. They do not
rewrite country/admin fields on baseline or Flickr evidence, do not establish
legal borders and do not prove biological presence or absence.

## Verification

The boundary verifier checks:

- the exact publisher source checksum, byte count, release and commit;
- every derived checksum, byte count, path and deterministic rebuild;
- unique Natural Earth feature IDs;
- unique selectable ISO alpha-2 country identities;
- Polygon/MultiPolygon structure, closed rings, finite coordinates and bbox
  containment;
- global/continent/country hierarchy connectivity;
- geometry, ISO mapping and hierarchy reconciliation;
- public-domain rights and voluntary attribution;
- false external tile, font, sprite, analytics, telemetry and general request
  permissions;
- successful verification with network primitives disabled.

The structural geometry gate does not claim to be a complete self-intersection
or legal-boundary certification. No geometry library was added for an unsupported
claim.

## Commits

- `ef344a5` — `docs(rights): select offline geographic boundaries`
- `6b2eb94` — `data(geography): add offline country hierarchy`
- `8e7c3f4` — `test(geography): verify bundled boundaries`

GitHits records `geo-impact-2.3`, `geo-impact-2.3.1`,
`geo-impact-2.3.2` and `geo-impact-2.3.3` are present. The task-level request did
not return through two bounded waits and was terminated. All records truthfully
use `githits_status: unavailable`; source and licence findings come from the
publishers' official pages and exact Git objects, not a fabricated GitHits result.

## Gate results

- Full Python suite: 850 passed.
- Boundary, hierarchy, storage and contract focused gate: 45 passed.
- Frontend country-hierarchy contract/facade gate: 8 passed.
- Native Ruff and format: 125 files clean; 46 retained source-locked
  compatibility findings reported separately.
- Deterministic boundary import check: passed.
- Boundary, rights and attribution verifier: passed.
- Repository-storage check: passed; 6 tables, 4 campaigns and 82 verification
  items, plus 92 object entries.
- Truthful judge fixture: passed; its existing v1 public replay remains
  operational and migrates fail-closed to v2.
- Provenance verifier: passed.
- `git diff --check`: passed.

The boundary publication is repository-contained. Wiring only its verified
runtime subset into the hosted MapLibre build remains part of Task 4.1; this
task does not report that future rendering work as complete.
