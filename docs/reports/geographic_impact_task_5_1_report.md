# Geographic Impact Task 5.1 report

Status: complete and pushed to `main`

## Revisions and evidence identity

- TaxaLens starting SHA: `5cd8433b802d383a670fbbb1cd317c45189d8c69`
- TaxaLens subtask gate SHA: `f4324d13e90f1bc6770b61c079979543c12a40fb`
- BioMiner baseline evidence origin:
  `247b42f3206d48bb79e2dbf97c5a92e4f207ae71`
- BioMiner Flickr evidence origin:
  `75461d9c065af0cd96b41cd1f845c2e920f7ae34`
- BioMiner local `main` observed at the task gate:
  `66de5f5e6202be533bb704b39a131d5c72bd718d`
- Materialized impact artifact SHA-256:
  `97b2422657d79bc8e682c4e51358c0316f6c942a31fea9ed608ef2c4ba420d94`
- Baseline snapshot: `gbif-occurrence-search-20260715`
- Flickr snapshot: `flickr:2026-07-15`
- Codex session: `019f65d0-3ca9-7870-9eb2-37c14ed02517`
- Primary model: `configured-model`
- Reasoning effort: `xhigh`

BioMiner advanced independently during this task and had modified and
untracked local report work at the final check. No moving BioMiner content was
read into the implementation. The exact pinned baseline and Flickr origins
above remain the only upstream evidence inputs.

## Deterministic contribution tiers

TaxaLens now has one browser-side scientific calculator for three nested
geographic maturity tiers.

Potential coverage-gap cells require:

- available selected-baseline evidence;
- zero range-inference-eligible baseline observations in the cell; and
- at least one Flickr candidate in the same cell and resolution.

Human-supported additional cells additionally require at least one
human-reviewed target-positive result. Reviewed non-target, uncertain,
pending, media-failure, Skip and Can't view outcomes do not contribute.

Release-ready additional cells additionally require complete record-level
occurrence-release evidence:

- decisive positive consensus;
- valid coordinates;
- duplicate gate passed;
- quality gate passed and a quality snapshot identity;
- complete provenance;
- an explicit release-ready decision identity; and
- an event date.

A non-zero release aggregate without a caller-supplied cell-to-decision gate
projection fails closed. The current replay has an explicit empty release
decision artifact, so zero release-ready cells is a valid evidence state.

Every calculator recomputes its state from exact counts and reconciles the
materialized boolean. A stale or contradictory materialized flag stops the
projection rather than reaching the product.

## Coverage uplift

Coverage uplift is calculated at one selected scope and spatial resolution:

```text
additional occupied cells / baseline occupied eligible cells × 100
```

Candidate, human-supported and release-ready uplift remain separate. The
calculator exposes the exact numerator, exact denominator and unrounded
percentage. Presentation rounds only for display.

If baseline evidence is unavailable, the result is `unavailable`. If the
available baseline has zero occupied eligible cells, the result is
`zero_denominator`; TaxaLens does not return `0%`, `Infinity` or `NaN`.
A zero contribution numerator with a positive baseline denominator is a valid
`0%` result.

For the committed Global resolution-3 replay, the exact selected-scope values
are:

- 2,155 cells;
- 168 baseline occupied eligible cells;
- 1,221 potential coverage-gap cells;
- 0 human-supported additional cells;
- 0 release-ready additional cells;
- 726.7857142857143% candidate uplift;
- 0% human-supported uplift; and
- 0% release-ready uplift.

The large candidate ratio is a coarse-grid potential comparison, not a
confirmed knowledge gain, occurrence count or range claim. The public panel
shows the numerator and denominator next to the percentage.

## Commits

- `a489c33` — `feat(impact): calculate potential coverage cells`
- `2f646e8` — `feat(impact): calculate reviewed additional cells`
- `2ad21e6` — `feat(impact): calculate release-ready contribution`
- `f4324d1` — `feat(impact): calculate spatial coverage uplift`

GitHits records `geo-impact-5.1` and `geo-impact-5.1.1` through
`geo-impact-5.1.4` are present. The broad task request timed out after one
bounded attempt and is recorded as unavailable. Focused searches returned no
quality-threshold source and received negative feedback. The implementation
therefore uses the already-reviewed local materializer, release-decision
validator, browser reconciliation code and pinned upstream contract. No
external implementation was copied.

## Verification

- Full frontend suite: 461 passed, one skipped; 136 files passed, one skipped.
- Geographic materializer, manifest, DuckDB, contract and judge-bundle tests:
  71 passed.
- Focused contribution and selected-detail tests: 17 passed.
- Zero baseline denominator: passed.
- Unavailable baseline: passed.
- Missing review evidence: passed.
- Skip, Can't view, negative, uncertain and media-failure exclusion: passed.
- Blocked or incomplete release gates: passed.
- Non-zero release count without gate projection: failed closed as expected.
- TypeScript project check: passed.
- Production build and local distribution verification: passed.
- Geographic materialization verifier: 20,237 cells and zero mismatches.
- Chromium exact table/map journey, no-WebGL fallback and external-origin
  network guard: three passed.
- BioMiner boundary and provenance verifiers: passed with recorded upstream
  drift warnings.
- `git diff --check`: passed.

No human review outcome or occurrence-release decision was fabricated. The
only scientific language enabled by this task is potential, human-supported
or release-ready coverage contribution at the corresponding verified maturity
tier.
