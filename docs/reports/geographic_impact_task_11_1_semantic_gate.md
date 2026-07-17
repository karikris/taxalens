# Geographic Impact scientific-semantic release gate

Date: 2026-07-18 (Australia/Sydney)

Task: `geo-impact-11.1.2`

TaxaLens input SHA: `3d9e0c17017283dc5701cd63684c24bcdcbe2d5f`

## Result

The Geographic Impact scientific semantics pass a fail-closed release audit. The committed replay contains 13,501 Flickr candidate rows and zero retained human outcomes, so it exposes potential coverage contribution only. It authorizes no human-supported or release-ready occurrence contribution.

## Enforced boundaries

| Boundary | Release evidence |
| --- | --- |
| Provider union | 4,017 GBIF-only plus 15,184 iNaturalist-origin-through-GBIF observations reconcile to the 19,201-observation canonical baseline union. Direct iNaturalist delta remains unavailable, not zero. |
| Candidate versus occurrence | The stored analyst replay describes candidate-only cells as potential coverage contribution and explicitly says they are not biological absence or new occurrences. |
| Review versus release | A positive consensus still fails release when any coordinate, duplicate, quality or provenance gate fails. |
| Skip and Can't view | Both are non-scientific outcomes and cannot contribute to the decisive sample or human-supported cells. |
| Sampling validity | The targeted reference audit, reviewer-control packet and fixed Commons fixture are explicitly non-representative and blocked from population-quality estimation. |
| Current human evidence | The geographic quality snapshot has zero retained events and is unavailable; occurrence-release decisions contain zero rows. |
| Data deficiency | Missing selected-baseline evidence is unknown and does not prove biological absence. |
| Model scores | The existing scientific release suite continues to assert that raw similarity scores are not probabilities. |
| External map network | `apps/web/e2e/geographic-impact.network.spec.ts` passed in the Task 11.1.1 browser gate and rejects every external origin during map startup. |

## Verification commands

```text
uv run pytest -q tests/test_geographic_release_semantics.py tests/test_release_scientific_semantics.py packages/replay/tests/test_occurrence_release.py
cd apps/web && LD_LIBRARY_PATH=/tmp/taxalens-playwright-libs/root/usr/lib/x86_64-linux-gnu npx playwright test --config=playwright.config.ts --project=chromium e2e/geographic-impact.network.spec.ts
git diff --check
```

The shared-library path supplies the browser runtime libraries installed for the release gate; the test itself performs a real Chromium launch and blocks every non-host origin. No public claim should advance until real retained human outcomes and all occurrence-release gates are present.
