# Phase 1 report — product foundation

## Outcome

Phase 1 turns the existing replay contracts into an installable, credential-free
TaxaLens product boundary. The repository now exposes a typed evidence facade,
deterministic evidence export, product-level integration coverage, and a human review
attestation ledger for migrated BioMiner code.

This phase does not create the real judge bundle. The current demo remains the
explicitly labelled schema-smoke fixture and makes no biological claim.

## Branch and pushed commits

The user explicitly selected direct work on `main` instead of the initially recommended
feature branch. Every numbered task was committed separately and pushed without history
rewrites.

- Starting SHA after Phase 0 reporting: `4376a919a451028fec47a8fe7981317f6e3b146a`
- Task 1.1: `59d39ce25a6e4ea673b29344fe3c3115d71e5b1e` — package replay tooling
- Task 1.2: `5dd705fdcf76fa46ddc523724c54c89541a912de` — add the product facade
- Task 1.3: `bb2d98c82c5b18d51138c3c452472c1b152916ea` — cover facade integration
- Task 1.4 and pushed Phase 1 SHA: `d9633936c3fcbf3f9be40e35c8f0788cc7802977` — attest migrated replay code

At the Phase 1 gate, local `HEAD` and `origin/main` both resolved to the pushed Phase 1
SHA.

## Product packaging

`pyproject.toml` and `uv.lock` provide a reproducible Python package and the `taxalens`
console script. Default installation needs no model, cloud, database, network, or
credential dependency. Capability groups keep replay, Parquet, demo, test, development,
and future vision dependencies explicit.

The CLI exposes:

- `taxalens doctor`
- `taxalens demo verify`
- `taxalens demo build`
- `taxalens demo replay --open`
- `taxalens provenance verify`

Replay launch remains truthfully unavailable until the browser application exists;
verification and schema-smoke build paths work now.

## Evidence facade

The `taxalens.product` package is the stable product-facing boundary. It provides all 12
required operations:

- run, pipeline, and stage loading;
- evidence record, candidate comparison, reference, geography, and comment-revision loading;
- dashboard and evaluation summary loading;
- lineage loading;
- deterministic evidence export.

The facade validates full Git SHAs, safe artifact paths, SHA-256 checksums, and JSON
payloads. Results are immutable TaxaLens contracts with bundle and artifact provenance.
Missing or invalid evidence is explicit, requires human review, and cannot authorize a
scientific claim. Lineage falls back only to a ledger present in the evidence artifact;
the facade does not reconstruct biological policy or import BioMiner modules.

## Integration evidence

The product tests cover:

- run and pipeline loading;
- absent product artifacts;
- metadata-only, human-blocked Phase 14 evidence;
- exact candidate ordering, duplicates, scores, and non-occurrence semantics;
- unavailable calibrated output and non-claiming stored smoke values;
- artifact-provided and missing lineage;
- byte-deterministic, internally checksummed exports;
- provenance across available, unavailable, and invalid states;
- immutable nested result payloads;
- manifest-root isolation and fail-closed checksum handling.

The full repository suite contains 552 passing tests at the phase gate.

## Human review attestations

`provenance/review_attestations.yaml` records 23 migration-introduction commits and five
provenance-bearing compatibility commits, covering all 25 components in the BioMiner
migration manifest. Each record includes exact source and destination SHAs, review
status, reviewer, review date, current test evidence, and accepted limitations.

Historical model and session fields remain `null` where the original commit evidence did
not identify them. The exact current model and session are recorded only for creation of
the new ledger and are not projected backward onto historical work.

## Phase gates

The final Phase 1 gate passed:

- `uv sync --locked`
- `uv run --locked pytest -q` — 552 passed
- `uv run python scripts/verify_provenance.py`
- `uv run python scripts/verify_demo.py demo/manifests/demo_manifest.example.json`
- `uv lock --check`
- Ruff lint and formatting checks for new Python product code and tests
- deterministic source and wheel build including `taxalens.product`
- YAML parse and cross-check of 23 migrations, five compatibility commits, and 25 components
- GitHits JSONL parsing and `git diff --check`

## Accepted limitations and Phase 2 handoff

- The current smoke bundle contains placeholders, not real rights-checked hero media or
  reviewed biological truth.
- Real reviewed Phase 13 results remain unavailable.
- Phase 14 candidates remain candidates, not occurrences, labels, verified references,
  or successful classifications.
- Phase 14 reference review, leakage-safe splits, ablations, calibration selection, and
  final evaluation remain blocked or incomplete.
- The attestation validates the current integrated tree and declared migration boundary;
  it does not recreate every historical environment or claim a fresh byte comparison for
  every copied file.
- The browser product and guided judge workflow are not part of this phase.

Phase 2 must therefore build a new versioned judge-bundle contract and populate it only
from committed, checksum-bound, rights-reviewed evidence. Unavailable scientific fields
must remain unavailable rather than being filled from the smoke fixture or legacy
family-first diagnostics.
