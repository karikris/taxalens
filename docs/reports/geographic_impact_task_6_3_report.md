# Geographic Impact Lens Task 6.3 Report

## Scope

Task 6.3 binds Geographic Impact review semantics to immutable verification
quality evidence. TaxaLens started the task on `main` at
`8a484a5f5439191969a18eb2f015da994ca3dc77` and completed its three numbered
subtasks at implementation head
`f3958c7937ff22a5d55baf29d8020510b803ec60`.

The committed public Flickr audit still contains zero retained human outcomes
and no retained `VerificationQualitySnapshot`. The map therefore displays zero
decisive outcomes, an unavailable quality snapshot and next milestone, no
confidence interval, and a release gate that has not been evaluated. It does
not turn contract coverage into scientific quality evidence.

## QualitySnapshot projection

The geographic review projection now exposes one deterministic campaign
quality record per exact campaign. Every supplied snapshot is validated before
projection, and only the latest retained snapshot for that campaign can supply:

- snapshot identity and capture time;
- sampling purpose and design;
- snapshot decisive sample count;
- point-estimate and confidence-interval availability;
- current and next evaluated milestone state; and
- campaign quality release state and blockers.

Current append-only ledger outcomes remain a separate count from the immutable
snapshot sample. An absent snapshot is represented as unavailable with an
explicit reason; TaxaLens does not synthesize an all-zero snapshot.

## Sampling and inference gate

Reviewed examples remain visible for both representative audits and targeted
failure-discovery queues. Population-quality output requires both a
representative design and `qualityEstimationAllowed` in the campaign sampling
contract. If either gate fails, the map:

- labels population inference blocked;
- displays the exact campaign blocked reason;
- retains the decisive reviewed-example count; and
- suppresses point estimates and confidence intervals, even if an inconsistent
  input object contains estimate-like values.

For an eligible representative design, an estimate is displayed only from a
retained snapshot whose precision is available. A confidence interval is
displayed only when that same snapshot marks the interval available and
provides its confidence level and bounds.

## Milestone and release semantics

The quality panel presents current decisive ledger outcomes, retained snapshot
sample size, next retained milestone, milestone status, population-inference
status, and campaign quality release state as independent facts. Release
blockers are listed in text. A campaign-level quality release status never
makes an individual Flickr candidate release-ready; positive consensus,
coordinates, duplicate, quality, provenance and exact snapshot gates still
must pass for each candidate.

Skip and Can’t view remain workflow outcomes and do not contribute to decisive
review, human-supported cells or occurrence release.

## Commits

- `b0f1f5e` — `feat(map): bind reviewed contribution to quality state`
- `8901cb2` — `fix(map): block unweighted quality inference`
- `f3958c7` — `feat(map): show geographic quality gates`

GitHits records `geo-impact-6.3` and `geo-impact-6.3.1` through
`geo-impact-6.3.3` are present. Each focused search returned no TypeScript
source above the quality threshold, received negative feedback, and fell back
to the local validated campaign, milestone, quality-snapshot and release-gate
contracts. No external implementation was copied.

The updated root `AGENTS.md` and every file in `docs/agents/` were read before
resuming this task. The agent pack, its Windows metadata file, and the
concurrently modified `submission/AI_CODE_PROVENANCE_REPORT.md` were not
modified or staged.

## Verification

- Full frontend suite: 515 passed, one skipped; 148 files passed, one skipped.
- Focused quality, geographic contract and zero-state tests: 14 passed across
  four frontend files.
- Python verification-schema and geographic-contract tests: 37 passed.
- TypeScript project check: passed.
- Production build, review-asset verification, offline-map distribution check
  and public review-media verification: passed.
- Provenance verifier: passed.
- `git diff --check`: passed.

The production build retained its existing large-chunk advisory; it did not
fail the configured build gate. No live OpenAI call, external map request or
scientific release action was performed.

## Upstream boundary

This task changed only TaxaLens quality projection and presentation logic. It
did not consume the concurrently changing local BioMiner checkout or add a new
upstream artifact. The established BioMiner pins remain unchanged: baseline
geography `247b42f3206d48bb79e2dbf97c5a92e4f207ae71` and Flickr geography
`75461d9c065af0cd96b41cd1f845c2e920f7ae34`.

The scientific boundary remains unchanged: a Flickr result is candidate
evidence until human review and every configured occurrence-release gate pass.
