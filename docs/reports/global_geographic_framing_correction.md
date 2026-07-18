# Global geographic framing correction

Date: 2026-07-18

Task: `geo-global-framing-1.0`

Starting TaxaLens SHA: `89c953797eea088350a3f3797ab4cb5bbaf5884d`

## Finding

The prior Global → Europe → Sweden judge journey was a deterministic browser and
capture fixture, not a scientific conclusion about *Papilio demoleus*. The
selected Swedish Flickr item was an unreviewed candidate with no retained human
outcome. It was useful for exercising the zero-selected-baseline UI path, but it
was not justified as the project's representative geographic story.

Administrative drilldown still solves a real analytical problem: a researcher
can narrow a global evidence comparison to inspect country-scale workload,
precision, provider composition, and review maturity. That capability does not
require TaxaLens to promote any named country. The application therefore keeps
optional drilldown while the canonical replay and public presentation remain at
Global scope.

## Correction

- The hosted verifier, browser journey, visual capture, stored analyst replay,
  README, Judge Guide, and presentation now use Global as their canonical scope.
- Obsolete Europe/Sweden capture frames and regional visual baselines were
  removed.
- Drilldown tests select available scopes from checksum-verified artifacts or
  rendered rankings instead of embedding a country name, ISO code, regional
  cell, or candidate record.
- The stored deterministic analysis now reports the global H3 resolution 3
  comparison: 19,201 eligible baseline observations, 13,416 Flickr candidates,
  1,221 potential coverage-gap cells, zero human-supported cells, and zero
  release-ready cells.
- Historical task reports and provenance receipts remain immutable evidence of
  the earlier run; they are not current product instructions or canonical
  presentation material.

No source candidate was deleted merely because its coordinates fall in Sweden.
Those rows remain unreviewed hypotheses in the source artifact. This correction
removes the hard-coded narrative and does not manufacture a biological absence
or a taxon decision.

## Repository rule and enforcement

The Geographic Impact ADR, human decisions, and agent instructions now require
Global canonical framing. Optional real-country selection must be read from a
verified artifact in response to researcher interaction. Isolated contract/unit
fixtures must use clearly synthetic identities.

`apps/web/scripts/verify-global-geographic-framing.mjs` enforces the rule for
canonical public and release files. It loads the verified country hierarchy and
fails on a named country, country scope, hard-coded H3 cell, or hard-coded Flickr
record. It also requires the stored replay to remain Global. The guard runs as
part of every production build.

## GitHits

- Task record: `geo-global-framing-1.0`
- Subtask record: `geo-global-framing-1.0.1`
- Adopted pattern: derive scenario inputs from verified data rather than fixing
  a real administrative geography in the canonical test story.
- Licence note: the reviewed reference implementation is MIT licensed; no
  external code was copied.

## Verification

Passed on 2026-07-18:

```text
npm run check
npm test
  543 passed, 1 intentionally skipped
npx vitest run <nine focused geographic and analyst test files>
  37 passed
npx playwright test <focused Geographic Impact browser files> --project=chromium --workers=1
  8 passed after the scope-selection correction
npx playwright test e2e/geographic-impact.performance.spec.ts --config=playwright.performance.config.ts --project=chromium --workers=1
  3 passed
npm run verify:build
  Global Geographic Impact framing verified across 7 canonical files
  production build and static replay verification passed
uv run --locked python scripts/verify_provenance.py
  passed
```

The performance journey selected its continent and country from current ranked
artifact data. External request count remained zero.
