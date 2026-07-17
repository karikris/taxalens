# Geographic Impact Lens Task 7.2 Report

## Scope

Task 7.2 adds artifact-grounded geographic analyst workflows, a public
credential-free GPT-5.6 replay and deterministic safety evaluations. TaxaLens
started the task at `7e80ec8b2fe72440aa609435b6943675b6ec2f32`.

## Workflows

The country-contribution workflow answers “What evidence could Flickr add to
this country?” only after exact `inspect_geographic_impact` and bounded
`list_candidate_gap_cells` receipts. Its counts and wording come from those
receipts; candidate-only cells remain potential coverage contribution.

Review recommendations retain explicit objectives for unbiased audit,
geographic coverage gaps, failure discovery, reference shortfall and conflict
adjudication. Each objective carries its sampling consequence. Targeted queues
are never described as supporting unweighted population inference.

Country comparison uses pairwise deterministic tool receipts and ranks
candidate-only cells as human-reviewable potential. It does not call them
reviewed evidence added.

## Stored replay

The public Agent workspace now includes a credential-free stored geographic
replay for Sweden at H3 resolution 7. The committed replay records:

- zero baseline occurrence-evidence rows;
- 529 Flickr candidate-evidence rows;
- 12 candidate-only spatial cells;
- zero human-supported additional cells; and
- zero release-ready additional cells.

The 12 cell records reconcile to 529 candidates. The replay validates its
canonical fingerprint, Geographic Impact manifest fingerprint, exact source
artifact digests and commits, tool sequence, facts, terminology and no-action
boundary. It displays “Live request: No” and “Credential: Not required.” No
default CI path makes an OpenAI call.

## Evaluation

Twenty-four table-driven cases cover provider double counting, candidate
versus reviewed maturity, data deficiency, unavailable direct iNaturalist
delta, no-geo records, range-edge candidates, invalid quality samples, blocked
release, artifact citations, prohibited terminology and model-memory
arithmetic. All cases pass. This evaluates deterministic safety and grounding;
it is not a claim about live model accuracy or human productivity.

## Commits

- `afd6349` — `feat(agent): explain geographic contribution`
- `db55150` — `feat(agent): recommend geographic reviews`
- `4f67598` — `feat(agent): compare geographic scopes`
- `ae32932` — `feat(agent): replay geographic analysis`
- `2bee6ff` — `test(agent): evaluate geographic analyst`
- `681e7d4` — `fix(agent): expose geographic stored replay`
- `9183d58` — `test(agent): cover geographic public replay`

GitHits records `geo-impact-7.2` and `geo-impact-7.2.1` through
`geo-impact-7.2.5` are present. The broad generated example was rejected as
synthetic and not biodiversity-safe. The 7.2.1 focused call timed out after
120 seconds and was not retried for later subtasks. No external implementation
was copied.

## Verification

- Full frontend suite: 533 passed, one skipped; 153 files passed, one skipped.
- Focused geographic workflow, replay, panel and evaluation tests: 14 passed
  across four files before the full suite.
- Existing agent evaluation suite: 9 passed across three files.
- TypeScript project check: passed.
- Production build, review-asset verification, offline-map distribution check
  and public review-media verification: passed.
- Provenance verifier and `git diff --check`: passed.

The existing large-chunk build advisory remains non-failing. The protected
other-session `docs/agents/`, Windows metadata and provenance-report changes
were not modified or staged.
