# Geographic Impact Lens Task 5.2 Report

## Scope

Task 5.2 adds deterministic nearest-baseline proximity, maturity-qualified
candidate range-edge state, temporal comparison semantics and inspectable
baseline data-deficiency classification. TaxaLens started this task at
`ba75ad8c80db9b102177569c133cc79adad38dfa` on `main`.

The implementation consumes the committed baseline evidence derived from
BioMiner commit `247b42f3206d48bb79e2dbf97c5a92e4f207ae71`. No moving BioMiner
working-tree content was consumed.

## Baseline proximity

Every candidate-only cell is compared with range-inference-eligible baseline
cells at the same H3 resolution. The committed method is
`haversine_cell_centroid`, uses a fixed 6,371.0088 km mean Earth radius and
resolves equal-distance ties by lexical baseline cell ID.

All 6,764 candidate-only cells have an available comparison:

| H3 resolution | Candidate-only cells | Minimum distance | Maximum distance |
| ---: | ---: | ---: | ---: |
| 3 | 1,221 | 96.577414 km | 8,227.537098 km |
| 5 | 3,075 | 14.079307 km | 8,257.832660 km |
| 7 | 2,468 | 2.011456 km | 8,256.296092 km |

These are distances between cell centroids. They are not distances to a
proven biological range boundary and do not establish a new range.

## Candidate range-edge maturity

The browser derives one of five states from reconciled cell evidence:

- `potential`;
- `human_supported`;
- `release_ready`;
- `data_deficient`; or
- `unavailable`.

A candidate-only cell needs an available nearest-baseline calculation before
it can be potential, human-supported or release-ready. Human-supported state
requires target-positive review. Release-ready state additionally requires
the occurrence-release gates. A missing comparison caused by explicit
baseline deficiency is data-deficient; other non-comparable and
non-candidate cells are unavailable. The selected-geography panel exposes
exact counts for every state.

The committed campaigns retain zero human outcomes, so no cell is presented
as human-supported or release-ready.

## Temporal contribution

The deterministic calculator accepts exact `YYYY-MM-DD` dates, records a
signed UTC day interval and distinguishes later, same and earlier dates.
Missing Flickr observation dates are unavailable. A missing credible
baseline date is data-deficient. Partial and invalid dates fail closed.

The committed baseline union contains event dates, but the committed Flickr
geography handoff has no Flickr observation-date field. The public temporal
contribution therefore remains unavailable. TaxaLens does not substitute
upload time, review-event time or a date inferred from a Flickr photo ID. A
later date would remain evidence context and would not independently establish
novelty or biological change.

## Data deficiency

Cell state is derived from additive canonical evidence reasons rather than a
literal placeholder. The current artifact exposes:

| Reason | Cells |
| --- | ---: |
| Direct iNaturalist delta unavailable | 20,237 |
| No range-inference-eligible baseline in cell | 13,295 |
| All baseline rows have geospatial issues | 13,054 |
| No baseline rows in cell | 6,066 |
| Coordinate uncertainty unavailable for all baseline rows | 2,827 |
| Preserved-specimen or fossil evidence only | 877 |
| Credible eligible-baseline date unavailable | 2 |

All 20,237 current cells are data-deficient because a direct iNaturalist
snapshot is unavailable. This does not erase the deduplicated GBIF baseline,
does not prove biological absence and does not prevent inspectable proximity
where eligible baseline evidence exists. Unresolved provider duplicates and
missing reviewed-quality identity are also supported reason codes, with zero
current affected cells.

TaxaLens did not invent cell-level high-uncertainty or outdated-date
thresholds. The pinned upstream summary policy has global eligibility and
current-window settings but no cell-level high-uncertainty threshold.

## Artifact identity

- Geographic impact build ID:
  `geographic-impact:84b8d1b69c3dae1e329a3f6b`
- Geographic impact manifest ID:
  `geographic-impact-manifest:e3c532a1c6310d2a0906cacc`
- Cells: 20,237
- Summaries: 385
- Cell artifact SHA-256:
  `a02927ffbb4dc09fca582c61e6ceab51af6d12f8998cf0f7762ebfe26a4ea1c9`

## Commits

- `3d34d19` — `feat(impact): calculate baseline proximity`
- `fc1d637` — `feat(impact): classify range-edge candidates`
- `6d1b250` — `feat(impact): calculate temporal contribution`
- `ce05ac9` — `feat(impact): expose baseline data deficiency`

GitHits records `geo-impact-5.2` and `geo-impact-5.2.1` through
`geo-impact-5.2.4` are present. The broad search and one focused search timed
out after one bounded attempt. The other focused searches returned no
relevant source and received negative feedback. No external implementation
was copied.

## Verification

- Full frontend suite: 469 passed, one skipped; 137 files passed, one skipped.
- Geographic materializer, manifest, DuckDB, contract and judge-bundle tests:
  74 passed.
- TypeScript project check: passed.
- Production build and offline map distribution verification: passed.
- Geographic impact verifier: 20,237 cells and zero mismatches.
- Chromium exact table/map journey, no-WebGL fallback and external-origin
  network guard: three passed.
- BioMiner boundary verifier: passed with moving-upstream warnings; snapshot
  retained in `provenance/biominer_state`.
- Provenance verifier: passed.
- `git diff --check`: passed.

Allowed language is limited to potential, human-supported or release-ready
candidate range extension at the corresponding maturity tier. Unqualified
“new range”, species absence, verified occurrence and confirmed knowledge-gain
claims remain blocked.
