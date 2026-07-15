# UPSTREAM_BIOMINER.md

## Preserved detector base contract

- `packages/replay/src/biominer_detector_base.py` is a mechanical copy of committed BioMiner `src/biominer/detection/detector_base.py` at `1535c494f9403e22ed9b163f3ae0ce3706e17f4c`.
- The complete image, detection-candidate, label, prompt, mask, protocol, and fake-backend logic is retained for later full-frame integration; TaxaLens adds no semantic adapter behavior inside the copied module.
- Broader BioMiner detector pipeline, schema, sidecar, and backend tests remain upstream until their complete implementation dependencies are migrated.

## Upstream engine summary

TaxaLens treats `karikris/BioMiner` as the upstream research engine and treats this repository as the product, replay, and evidence-observability layer.

## Migratable boundary

- BioMiner is the upstream contract source for evidence artifacts and workflow metadata.
- BioMiner Phase 12 has been pushed and can be selectively consumed when referenced by a committed SHA.
- Phase 12 migration must use committed, pushed SHAs only.
- BioMiner Phase 13 is currently active/in-progress and is excluded unless a commit is explicitly pinned and verified as committed.
- TaxaLens does not import staged, uncommitted, or locally modified BioMiner work.
- Adapters should prefer committed artifact contracts and stable interfaces before any code extraction.

## Pinned SHA

- `biominer_repository`: `karikris/BioMiner`
- `pinned_sha`: `1535c494f9403e22ed9b163f3ae0ce3706e17f4c`
- `branch`: `main`

## Contracts consumed (current phase)

- Target-aware candidate score frame contract (`src/biominer/bioclip/target_aware_output.py`)
  has been consumed through `packages/replay/src/biominer_target_aware_scores_adapter.py` with
  fixture-backed tests in `packages/replay/tests/test_biominer_target_aware_scores_adapter.py`.
- Reference readiness contract (`src/biominer/references/readiness.py`)
  has been consumed through `packages/replay/src/biominer_reference_readiness_adapter.py` with
  fixture-backed tests in `packages/replay/tests/test_biominer_reference_readiness_adapter.py`.
- Reference review queue contract (`src/biominer/references/schemas.py`)
  has been consumed through `packages/replay/src/biominer_reference_review_queue_adapter.py` with
  fixture-backed tests in `packages/replay/tests/test_biominer_reference_review_queue_adapter.py`.
- Query-definition contract (`src/biominer/registry/compiler.py`)
  has been consumed through `packages/replay/src/biominer_query_geography_adapter.py` with
  fixture-backed tests in `packages/replay/tests/test_biominer_query_geography_adapter.py`.
- Geographic spread/occurrence/summary contracts (`src/biominer/registry/geographic_spread.py`,
  `src/biominer/registry/geographic_summary.py`)
  have been consumed through `packages/replay/src/biominer_query_geography_adapter.py` with
  fixture-backed tests in `packages/replay/tests/test_biominer_query_geography_adapter.py`.
- Object evidence summary via evidence joins and metrics (`src/biominer/evidence/join.py`,
  `src/biominer/evidence/metrics.py`)
  has been consumed through `packages/replay/src/biominer_object_evidence_summary_adapter.py` with
  fixture-backed tests in `packages/replay/tests/test_biominer_object_evidence_summary_adapter.py`.
- Evidence comment-review eligibility policy (`src/biominer/evidence/review_policy.py`)
  has been copied intact into
  `packages/replay/src/biominer_evidence_review_policy.py` with exhaustive policy
  tests in `packages/replay/tests/test_biominer_evidence_review_policy.py`.
- Visual-domain BioCLIP gate policy (`src/biominer/vision/gates.py`) has been
  copied intact into `packages/replay/src/biominer_vision_gates.py`, including
  routed, review, exclusion, and legacy modes, with upstream-equivalent tests in
  `packages/replay/tests/test_biominer_vision_gates.py`.
- Canonical semantic fingerprint encoding
  (`src/biominer/common/semantic_hash.py`) has been copied intact into
  `packages/replay/src/biominer_semantic_hash.py` with its complete
  golden-vector and failure-mode suite in
  `packages/replay/tests/test_biominer_semantic_hash.py`.

- Future migrations should be implemented as contracts and adapters with source SHAs recorded per component.

## Excluded work

- Any staged/uncommitted BioMiner files and changes are excluded.
- Any unpinned or in-progress Phase 13 materials are excluded.

## Compatibility constraints

- Do not assume local BioMiner staging state in production mapping.
- All mapping must run from local fixture files and committed artifact outputs.
- No source-image collections, model weights, or credentials are to be committed into TaxaLens.
