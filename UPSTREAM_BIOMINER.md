# UPSTREAM_BIOMINER.md

## Frozen product boundary

- Current reviewed BioMiner handoff SHA: `67c1c2a3a2c9b909b256b3094913af342f4ccbed` on `main`.
- Boundary version: `artifact-first-product-boundary-v1.0.0`.
- Broad BioMiner module copying is frozen. Existing copied modules remain as provenance-bound compatibility contracts; they are not precedent for more copies.
- New integration order is: committed artifact, versioned schema, thin adapter, stable BioMiner command, small shared package, and copied source only after an explicit documented finding that every earlier option is unsuitable.
- BioMiner remains the scientific engine. TaxaLens owns the product facade, deterministic replay, browser analytics, evidence lineage, review operations, exports, and judge experience.
- The TaxaLens web application and other product consumers must use the TaxaLens evidence facade. They must not import `biominer_*` implementation modules directly.
- Product decisions use target-aware evidence only. Family-first output is legacy diagnostic/baseline evidence and cannot produce or replace a TaxaLens species decision.

The pin identifies the latest reviewed upstream handoff boundary. Each historical
migration below retains its own exact source commit; updating the boundary pin
does not rewrite component provenance.

## Phase 13, Phase 14, and Phase 15 availability

- Phase 13 evaluation schemas and machinery are committed, but no real reviewed Papilio evaluation result bundle is committed for TaxaLens to display.
- Phase 14 now includes a committed prototype-only Papilio few-shot report plus compact manifests for a frozen 81-record metadata-qualified support bank, reference embeddings, B0–B16 retrieval experiments, a selected raw-margin policy, and staged Flickr inference.
- Phase 15 includes a committed 14-of-14 prototype-entry GO audit, prototype release acceptance, final verification, and a post-Build-Week backlog.
- The GO decision authorizes explicit prototype integration only. It does not authorize a production-default change, scientific release, calibrated accuracy claim, or public display of the reference images.
- All 81 support rows are provider-supported and independently hash-pinned, but zero are independently human taxonomically verified. Seventy-nine are research-only and two lack owner evidence.
- The selected B13 policy always scores the target and uses a raw target-versus-competitor margin threshold of `0.10`. It is uncalibrated, emits no probabilities, and was not fitted from reviewed labels.
- Staged inference classified 13,496 of 13,501 planned Flickr records, scored the target and 34 species candidates for every classified record, and recorded five retryable source failures. These distributions are retrieval diagnostics, not classification accuracy, biological occurrence, or prevalence.
- The staged runner's `0.02` preselection abstention rule is distinct from the selected `0.10` integration policy and must not be conflated.
- Human review, calibration from independently reviewed labels, final-test scientific evaluation, public-display rights review, focused/masked visual-input ablations, and independent YOLOE routing validation remain blocked or deferred.
- A present path, candidate count, source-provider verification, or taxon match does not make a scientific claim available.
- Missing or blocked evidence must be returned as an explicit unavailable/review state through the product facade.

## Preserved selective decision policy

- `packages/replay/src/biominer_decision_policy.py` retains the complete committed BioMiner `src/biominer/ml/decision_policy.py` logic at `0561906d994d6b9e56e0b6405fdb68272759595f`.
- Only imports are redirected to preserved TaxaLens semantic-hash, non-match, target-task, and reference-route contracts; no threshold fitting, precision objective, quality gate, competitor/domain precedence, abstention, provenance, fingerprint, or validation logic was removed.
- All directly scoped upstream selective-policy tests are migrated. The final calibration-manifest integration tests remain upstream until the complete calibration implementation is migrated.

## Preserved target-aware output contract

- `packages/replay/src/biominer_target_aware_output.py` retains the complete committed BioMiner `src/biominer/bioclip/target_aware_output.py` logic at `1535c494f9403e22ed9b163f3ae0ce3706e17f4c`.
- Only imports are redirected to preserved TaxaLens semantic-hash, non-match, and Parquet modules; no physical schema, identity, candidate projection, nested evidence, provenance, numeric, decision, abstention, target-confirmation, validation, or writer logic was removed.
- The complete committed `tests/test_target_aware_output.py` suite is migrated with import-only adaptation.

## Preserved Parquet storage helper

- `packages/replay/src/biominer_storage_parquet.py` is a mechanical copy of committed BioMiner `src/biominer/storage/parquet.py` at `1535c494f9403e22ed9b163f3ae0ce3706e17f4c`.
- The complete atomic write, overwrite, batched write, bounded read, part metadata, schema normalization, compression, temporary cleanup, and bucket-view logic is retained.
- Polars and PyArrow are explicit runtime prerequisites. Dependency-manifest creation remains a separate packaging task.

## Preserved non-match evidence scoring

- `packages/replay/src/biominer_nonmatch.py` retains the complete committed BioMiner `src/biominer/ml/nonmatch.py` logic at `1535c494f9403e22ed9b163f3ae0ce3706e17f4c`.
- Only imports are redirected to preserved TaxaLens semantic-hash, calibration-output, target-task, and reference-route contracts; no target, competitor, domain-negative, calibrated, margin, identity, outcome, fingerprint, or validation logic was removed.
- The complete committed `tests/test_nonmatch_scoring.py` suite is migrated with import-only adaptation.

## Extracted ML scoring vocabularies

- `packages/replay/src/biominer_calibration_contract.py` extracts the exact `CALIBRATED_PROBABILITY_KIND` value from committed BioMiner `src/biominer/ml/calibration.py` at `1535c494f9403e22ed9b163f3ae0ce3706e17f4c`.
- `packages/replay/src/biominer_training_task_contract.py` extracts the exact immutable `TARGET_TASKS` vocabulary from committed BioMiner `src/biominer/ml/training_features.py` at the same SHA.
- These are narrow stable-contract extractions. Calibration fitting, artifact loading, feature construction, and training-table logic remain intact upstream and must enter TaxaLens through committed artifacts, versioned schemas, or a stable BioMiner interface.

## Preserved visual-input fusion

- `packages/replay/src/biominer_visual_input_fusion.py` retains the complete committed BioMiner `src/biominer/bioclip/visual_input_fusion.py` logic at `1535c494f9403e22ed9b163f3ae0ce3706e17f4c`.
- Only imports are redirected to preserved TaxaLens semantic-hash, route, full-frame attention, and target orchestration contracts; no embedding reuse, scoring, fusion, competitor, disagreement, review, fingerprint, validation, or payload logic was removed.
- The complete committed `tests/test_visual_input_fusion.py` suite is migrated with import-only adaptation.
- Product and service integration remains intentionally deferred; the scientific fusion contract is preserved first.

## Extracted reference-route vocabulary

- `packages/replay/src/biominer_reference_routes.py` extracts the exact immutable `REFERENCE_ROUTES` vocabulary from committed BioMiner `src/biominer/references/readiness.py` at `1535c494f9403e22ed9b163f3ae0ce3706e17f4c`.
- This is a narrow stable-contract extraction used by several scoring and prompt modules; it is not represented as migration of the 4,000-line reference-readiness publication subsystem.
- The full readiness implementation and its acquisition, deduplication, review, schema, reporting, and storage dependencies remain in BioMiner. TaxaLens consumes their committed manifests and explicit handoffs.

## Preserved target full-frame orchestration

- `packages/replay/src/biominer_target_full_frame.py` retains the complete committed BioMiner `src/biominer/vision/target_full_frame.py` logic at `1535c494f9403e22ed9b163f3ae0ce3706e17f4c`.
- Only imports are redirected to preserved TaxaLens contracts; no scoring-unit, route, full-image identity, embedding, attention-evidence, schema-validation, or no-crop policy logic was removed.
- The complete committed `tests/test_target_full_frame.py` suite is migrated with import-only adaptation.
- This migration preserves orchestration logic without yet coupling it to a TaxaLens service or UI; that marriage remains a later adapter task.

## Preserved detection schema contract

- `packages/replay/src/biominer_detection_schema.py` retains the complete committed BioMiner `src/biominer/detection/schema.py` logic at `1535c494f9403e22ed9b163f3ae0ce3706e17f4c`.
- Only internal detector-base, policy, and routing imports are redirected to preserved TaxaLens modules; no schema columns, row construction, stable identity, geometry, mask, filtering, NMS, or routing logic was removed.
- Polars is an explicit runtime prerequisite. Dependency-manifest creation remains a separate repository-packaging task.

## Preserved full-frame attention contract

- `packages/replay/src/biominer_full_frame_attention.py` retains the complete committed BioMiner `src/biominer/vision/full_frame_attention.py` logic at `1535c494f9403e22ed9b163f3ae0ce3706e17f4c`.
- Only the semantic-hash and decoded-image imports are redirected to their preserved TaxaLens copies; no canvas, geometry, mask, quality, fingerprint, evidence, or preprocessing logic was removed.
- The complete committed `tests/test_full_frame_attention.py` suite is migrated with import-only adaptation.
- Pillow is an explicit runtime prerequisite for this module. TaxaLens does not yet have a Python dependency manifest, so installation and locking remain a later repository-packaging task rather than an implicit dependency change here.

## Preserved detection policy and runtime profiles

- `packages/replay/src/biominer_detection_policy.py` retains the complete committed BioMiner `src/biominer/detection/policy.py` logic at `1535c494f9403e22ed9b163f3ae0ce3706e17f4c`.
- The only compatibility edit redirects the internal routing import to TaxaLens's preserved routing module; no policy fields, defaults, validation, eligibility rules, or runtime profiles were removed.
- Integration with detector pipeline, sidecars, and target full-frame orchestration remains an upstream engine responsibility exposed through artifacts and the TaxaLens facade.

## Preserved detection routing contract

- `packages/replay/src/biominer_detection_routing.py` is a mechanical copy of committed BioMiner `src/biominer/detection/routing.py` at `1535c494f9403e22ed9b163f3ae0ce3706e17f4c`.
- The complete domain routing, score/review/exclude policy, validation, threshold, fail-closed, and fingerprint logic is retained; it routes detector evidence and does not make a species decision.
- All directly scoped upstream routing tests are retained. Tests that begin exercising BioMiner `detection.policy` remain upstream until that complete module is migrated.

## Preserved detector base contract

- `packages/replay/src/biominer_detector_base.py` is a mechanical copy of committed BioMiner `src/biominer/detection/detector_base.py` at `1535c494f9403e22ed9b163f3ae0ce3706e17f4c`.
- The complete image, detection-candidate, label, prompt, mask, protocol, and fake-backend logic is retained for later full-frame integration; TaxaLens adds no semantic adapter behavior inside the copied module.
- Broader BioMiner detector pipeline, sidecar, and backend behavior remains upstream and is not planned for source migration.

## Upstream engine summary

TaxaLens treats `karikris/BioMiner` as the upstream research engine and treats this repository as the product, replay, and evidence-observability layer.

## Migratable boundary

- BioMiner is the upstream contract source for evidence artifacts and workflow metadata.
- Only committed, pushed BioMiner content referenced by a full SHA is eligible.
- Phase 13 code/schema availability does not make reviewed evaluation outputs available.
- Phase 14 compact metadata manifests may be consumed with candidate and review semantics preserved.
- Large run artifacts require an explicit content-addressed handoff archive, expected SHA-256, embedded inventory, source SHA, and verified receipt.
- TaxaLens does not import staged, uncommitted, or locally modified BioMiner work.
- TaxaLens does not list remote prefixes or local run directories to discover a handoff.
- No further broad module copying is approved.

## Pinned SHA

- `biominer_repository`: `karikris/BioMiner`
- `pinned_sha`: `67c1c2a3a2c9b909b256b3094913af342f4ccbed`
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

- Future integrations must use the frozen priority order and record source SHAs, artifact fingerprints, schema versions, availability, rights, and candidate/reference semantics.

## Excluded work

- Any staged/uncommitted BioMiner files and changes are excluded.
- Any unpinned, unreviewed, or unmaterialized Phase 13 result is excluded.
- Reference image bytes and any public display of the prototype bank are excluded.
- Any interpretation of provider-supported rows as independently human-verified labels is excluded.
- Any interpretation of raw similarity or raw margin as a probability, accuracy, occurrence, or prevalence estimate is excluded.
- Any scientific release, production-default change, or calibrated performance claim is excluded until the explicit human-review and evaluation gates are satisfied.
- Any legacy family-first result is excluded from the TaxaLens target-aware decision path.

## Compatibility constraints

- Do not assume local BioMiner staging state in production mapping.
- All mapping must run from committed artifact outputs, verified handoffs, or deterministic fixtures that are labelled as fixtures.
- Every product-facing result must pass through a TaxaLens facade and include provenance plus an explicit availability state.
- Candidate/reference contracts must state candidate semantics, verification status, human-review requirement, and whether a scientific claim is allowed.
- Only human-verified, rights-checked references may support a production decision.
- No source-image collections, model weights, or credentials are to be committed into TaxaLens.
