# Phase 2 report — truthful judge bundle

## Outcome

Phase 2 turns the artifact-first product boundary into a deterministic, self-contained judge bundle for the bounded *Papilio demoleus* pilot. The bundle uses real checksum-verified BioMiner metadata, records every unavailable scientific field, and keeps the hero in `awaiting_human_review` because no committed human-verified target classification exists.

No raster image, detection, full-frame transformation, candidate visual score, calibrated probability, or Phase 13 result is included. The bundle demonstrates the decision gates without claiming a successful classification, occurrence, or verified reference.

## Pushed task commits and phase SHA

Every numbered task was committed separately on `main` and pushed without rewriting history.

- Task 2.1: `7c765e3307e3d695a6021ae2831fdab5435e9151` — define the judge-bundle contract
- Task 2.2: `8d0be647e6096f4c6b54c610dbac7e13e3e89c17` — import a verified BioMiner handoff
- Task 2.3: `7a97a6fd35d153209e3d4230a5ab347d08d95458` — adapt reviewed evaluation evidence
- Task 2.4: `188187d73ca8e0ef2c670bdf6cefcb20c8a59d9d` — adapt current pilot metadata
- Task 2.5: `f425932515c6b0a33608e021f47d8f580b16106e` — build the truthful pilot fixture
- Task 2.6 and pushed Phase 2 SHA: `b78cd0240c4f150e72734ade7272013e32cd8149` — verify the truthful judge bundle

At the Phase 2 gate, local `HEAD` and `origin/main` both resolved to `b78cd0240c4f150e72734ade7272013e32cd8149`.

## Bundle identity and integrity

- Bundle ID: `papilio-demoleus-pilot-75461d9c-v1`
- Entry point: `demo/fixture/papilio_pilot/judge_bundle.json`
- BioMiner source SHA: `75461d9c065af0cd96b41cd1f845c2e920f7ae34`
- TaxaLens source revision recorded by the bundle: `188187d73ca8e0ef2c670bdf6cefcb20c8a59d9d`
- Artifact count: 17
- Required section count: 20
- Section record count: 29
- Explicitly unavailable sections: 6
- Inventory SHA-256: `4e1b6b3bf8e7ac20dac7c824624bd6583612f7117ca45cf9cf06adf8632d5ef9`
- Payload-root SHA-256: `b842cdbb22c26b1a016d1481e41dd756e4f44938b0e042d1cd89967f90c58a87`

The deterministic builder regenerates every inventoried JSON byte and reloads the result through the strict judge-bundle validator. The bundle directory is closed: any missing, changed, stale, or undeclared payload fails verification.

## Truthful evidence state

The verified BioMiner metadata contributes exact planning and workload values, including:

- 76,485 Flickr query hits;
- 13,501 canonical photos;
- 76 located candidate clusters;
- five regional competitor candidates;
- 838 eligible source-media candidates;
- zero human-verified source-media records;
- source-candidate and human-review shortfalls of 247 and 490.

These values remain metadata and candidate-planning evidence. Every scientific-claim flag is false. Candidate rows cannot be displayed as occurrences, and unverified references cannot be displayed as target support.

The hero record is `papilio-demoleus-pilot-awaiting-review`. It has no media ID, image path, classification, decision, candidate visual score, or gold result. All five decision gates remain unsatisfied pending rights-cleared media and human review.

## Rights and attribution

All 17 JSON payloads have complete MIT rights and attribution coverage for BioMiner or TaxaLens, with Kris Kari identified as creator or owner. The fixture contains zero media assets. `all_media_rights_verified` remains false deliberately rather than treating an empty media set as vacuously verified.

No external image was fetched or admitted. The compact BioMiner metadata remains attributed to BioMiner commit `75461d9c065af0cd96b41cd1f845c2e920f7ae34`.

## Verification policy

The truthful verifier emits stable machine-readable codes and fails on all required classes:

- missing files and checksum mismatches;
- orphaned IDs and inconsistent counts;
- missing rights or attribution;
- candidates displayed as occurrences;
- unverified references displayed as support;
- raw scores displayed as probabilities;
- missing BioMiner SHA;
- unsupported gold results;
- unresolved placeholders;
- stale artifact versions.

It also rejects undeclared files. Mutation tests independently exercise every failure code. The standalone verifier and the `taxalens demo verify` and `taxalens demo build` defaults now select the truthful bundle. The legacy contract-smoke manifest remains verifiable only when explicitly supplied.

## Phase gates

The final Phase 2 gate passed:

- `uv sync --locked`
- `uv run --locked pytest -q` — 622 passed
- `uv run python scripts/verify_provenance.py`
- `uv run python scripts/verify_demo.py`
- explicit legacy smoke-manifest verification
- BioMiner boundary verification against the pinned SHA with its snapshot written outside the repository
- `uv lock --check`
- focused Ruff formatting and lint checks for all new or modified Python files
- deterministic source and wheel build including the truthful verifier
- GitHits JSONL parsing and `git diff --check`

## BioMiner boundary decision

TaxaLens inspected the pinned BioMiner repository and imported only committed compact artifacts and declared contracts. No missing BioMiner producer or engine implementation was proven during Tasks 2.2–2.6, so BioMiner source was not modified. Referenced large Parquet payloads and local untracked BioMiner files were not copied, interpreted as committed evidence, or staged.

## Accepted limitations and Phase 3 handoff

- There is no human-verified target classification or licensed hero image.
- There is no real pilot detection, full-frame transformation, target-aware visual score, or calibrated probability.
- Phase 13 result artifacts and competitor-confusion evidence remain unavailable.
- Geographic cluster rows and other referenced large payloads are represented only by verified summaries and fingerprints.
- Candidate and range plans are hypotheses, not occurrences, labels, or verified support.
- The OpenAI replay section is `not_used`; no live request or stored output is represented by this fixture.
- The browser judge application does not yet exist.

Phase 3 must load this exact verified bundle into a deterministic static web application. UI components must preserve the same unavailable states and non-claiming semantics; they must not reinterpret target names, candidates, raw values, or missing evidence as successful scientific results.
