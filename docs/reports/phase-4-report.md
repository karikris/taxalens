# Phase 4 report — provenance-bound research mission

## Outcome

Phase 4 delivers a bounded research-mission workflow for the submitted *Papilio demoleus* replay.
The interface exposes target, region, retrieval, reference, evidence, budget, execution-mode, and
device controls while keeping every scientific value behind the checksum-verifying browser facade.

The mission works without OpenAI. It produces a frozen, versioned plan from local verified evidence,
fingerprints the complete canonical plan with browser SHA-256, and permits only the submitted static
fixture to enter `replay_launched`. Live work remains unavailable and explicitly not approved.

## Pushed task commits and phase SHA

Every numbered task was committed separately on `main` and pushed without rewriting history.

- Starting SHA after Phase 3 reporting: `42639093d2de0d8554ecc510b0f8c011461c303d`
- Task 4.1: `e1a608dc5358b8626b483eb5274c0ed864eea97e` — add the research mission interface
- Task 4.2: `f2648d0b0d4bef27827a96b619742854d195e91f` — generate the deterministic evidence plan
- Task 4.3 and pushed Phase 4 task SHA: `d0254d81003c6a5a4bc7cdcb04bcc6fc425dfe90`
  — launch the provenance-bound replay

At the Phase 4 gate, local `HEAD` and `origin/main` both resolved to
`d0254d81003c6a5a4bc7cdcb04bcc6fc425dfe90`.

## Artifact-backed mission interface

The React Aria form exposes every required mission input with a label, description, bounded control,
and explicit disabled state where applicable. The form projects its verified baseline through the
single evidence facade:

- the target identity and five eligible regional candidate hypotheses;
- the eight-region, 40-country range-planning hierarchy;
- 22 registry-linked physical query definitions;
- the committed 314-request baseline and 100,000-request ceiling;
- source-candidate and human-review shortfalls;
- ordered pipeline stages, stopping conditions, and incomplete prerequisites.

Regions remain planning hypotheses. Candidates remain distinct from labels, occurrences, and verified
support. The target always remains scoreable, and the plan validator refuses a candidate budget that
would prune any of the five eligible candidates.

## Deterministic evidence plan

`taxalens-evidence-plan-v1.0.0` is a pure local projection of the validated draft and verified replay.
It contains the target, source-registry identity, region, query strategy, eight ordered stages,
approved budgets, four unavailable stages, 20 artifact expectations, explicit approval requirements,
and a `plan_only` execution capability.

Validation collects stable issues for an unsupported target or region, insufficient API or candidate
budget, live mode, unsupported policy, and an overlong device annotation. The generator uses no model,
network, time, randomness, or executor. Unit tests prove repeatable JSON ordering, deep freezing, and
the absence of these external calls.

The baseline plan fingerprint is
`sha256:f983de321a83c728f3a75dd08c9ff0d4504b96422aaa96e16d30d22e5b518133`.
The fingerprint covers the entire plan, including the pinned source-registry contract. Tests pin that
golden value, prove a cloned plan hashes identically, and prove a content change produces a different
fingerprint.

## BioMiner registry contract

The Phase 3 compact import did not contain the committed BioMiner workload configuration that defines
the source-registry version. Phase 4 therefore imported exactly one proven missing artifact:
`config/pilot/papilio_demoleus_geographic_workload.json` from
`karikris/BioMiner@75461d9c065af0cd96b41cd1f845c2e920f7ae34`.

The imported file is 4,734 bytes and has SHA-256
`c3196ca753090d6062edad6b524c0fd662fb3202070a7c05b61f3e6f4334c7e2`, byte-for-byte identical to
the pinned BioMiner file. Compact-import schema v1.1 validates its target and requires all three
registry-using commands to agree on `butterflies-v2-20260712`. It also requires all 22 query rows to
agree on source snapshot `gbif-reference-search-20260715` and verifies the configured query path.

The adapter regenerates the truthful fixture with this contract, and the browser reads it only after
the normal 17-artifact inventory and payload-root checks pass. No BioMiner execution subsystem or
unrelated source module was copied.

## Replay launch and approval boundary

Plan preparation computes the fingerprint before enabling launch. The launch transition rejects a
plan unless it is replay-only, launches no work, uses no OpenAI, matches the submitted target and
registry, and is backed by all 17 verified fixture artifacts plus both verified bundle roots.

A successful transition emits the frozen
`taxalens-replay-launch-receipt-v1.0.0` receipt and opens Observatory. The receipt shows the exact plan
fingerprint, registry version and source snapshot, bundle identity, 17-of-17 verification, TaxaLens
and BioMiner revisions, and supported capabilities. It records live approval as `not_approved`, with
no approved fingerprint, and declares both live actions and remote requests false.

The UI leaves the live-work action disabled and states that separate explicit approval and unavailable
infrastructure would be required. Browser tests confirm plan generation and replay launch make no new
request after the static fixture has loaded.

## Phase gates

The final Phase 4 gate passed:

- `uv sync --locked`;
- `uv run --locked pytest -q` — 623 passed;
- `npm ci` and `npm audit --audit-level=low` — zero vulnerabilities;
- strict TypeScript project check;
- Vitest — 26 passed across nine files;
- production Vite build and static fixture verifier;
- Chromium Playwright — five flows, including deterministic planning, disabled live work,
  provenance-bound launch, active-view handoff, and no additional launch requests;
- `uv run --locked python scripts/verify_provenance.py`;
- `uv run --locked python scripts/verify_demo.py`;
- BioMiner boundary verification against the pinned SHA with its snapshot written outside the
  repository;
- `uv lock --check`, GitHits JSONL parsing, and `git diff --check`;
- visual inspection at 1280×720 and 390×844 with no horizontal overflow.

## BioMiner boundary decision

The pinned BioMiner repository remained at
`75461d9c065af0cd96b41cd1f845c2e920f7ae34`. Its authoritative registry configuration closed a
specific product-provenance gap through the artifact-first import path. BioMiner itself was not
modified.

Its pre-existing untracked configuration, documentation, query-term, and log paths remained
untouched and were not treated as evidence.

## Accepted limitations and Phase 5 handoff

- Only the committed fixture replay can launch; live execution and remote scientific APIs remain
  unsupported.
- The launch receipt is local client state and is intentionally cleared by replay reset.
- No licensed hero image, verified reference support, reviewed target label, occurrence, detection,
  transformation, calibrated probability, or Phase 14 scientific-success claim is available.
- The current Observatory proves bundle and launch provenance. Phase 5 must add the accessible
  pipeline visualization, artifact counts, failure inspection, lineage, and replay comparison without
  weakening the facade or approval boundary.

Phase 5 can consume the frozen plan and launch receipt as its local run identity. It must continue to
display unavailable evidence explicitly and must not reinterpret planning candidates as scientific
results.
