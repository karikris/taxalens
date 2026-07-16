# Verification workflow impact: bounded scripted result

TaxaLens required **10 logged interactions instead of 20** in one matched,
three-item scripted Chromium protocol: 50% fewer scripted actions. The assisted
path opened one page instead of four, required four field completions instead
of ten, and required no manual duplicate inspection instead of three. Both
paths recorded exactly three decisions.

This is an interaction-burden result, not a human productivity or time-savings
result.

## What was measured

The explicit Playwright study used the same three rights-cleared Commons items,
decision count, scripted actor, 1280×720 viewport, and local machine for both
paths:

| Measure | Manual fixture | TaxaLens assisted | Change |
| --- | ---: | ---: | ---: |
| Logged actions | 20 | 10 | −10 (−50%) |
| Pages opened | 4 | 1 | −3 (−75%) |
| Duplicate groups inspected manually | 3 | 0 | −3 |
| Fields completed | 10 | 4 | −6 (−60%) |
| Decisions | 3 | 3 | 0 |
| Active browser-protocol time | 753 ms | 2,752 ms | +1,999 ms |

The assisted run took longer in this single automation run because it prepared
and verified the local cache and exercised the real app. No active-time saving
is claimed.

## Evidence and reproducibility

- Raw events:
  `demo/source/impact/verification-impact-study.raw.json`
- Raw SHA-256:
  `0be376bba0c2e2aef99d031a148bbfe61686da47e6bf9663f1373efc44496618`
- Recomputed summary:
  `demo/source/impact/verification-impact-summary.json`
- Summary SHA-256:
  `bdf0209ba1e4a4645075e54c8a70d9954a3e733b693f45a77a0cff7929226e49`
- TaxaLens build measured:
  `f62ac135e9222ea4c39933f420b2e96aa73ce742`
- Browser:
  Chromium `149.0.7827.55` on Linux x64
- Human participants:
  `0`

Recompute the committed summary:

```bash
uv run python scripts/summarize_verification_impact.py
uv run pytest -q tests/test_verification_impact_artifacts.py
```

Collect a new explicit scripted browser run after installing Playwright’s
Chromium dependencies:

```bash
cd apps/web
TAXALENS_RUN_IMPACT_STUDY=1 \
TAXALENS_IMPACT_OUTPUT=../../demo/source/impact/verification-impact-study.raw.json \
npx playwright test e2e/impact-study.measure.spec.ts \
  --project=chromium --workers=1
```

Then rerun the summarizer. A new browser run is expected to change timestamps
and time measurements; action counts change only if the frozen protocol or
product workflow changes.

## Claim boundary

This sample contains one scripted pair and zero humans. The scripted Yes
interactions are disposable browser inputs, not human labels. The study did not
measure taxonomic quality, reviewer accuracy, scientific quality, population
savings, or human time savings. No result may be extrapolated beyond this
three-item scripted protocol. A matched human study remains required before
making a productivity or time-savings claim.
