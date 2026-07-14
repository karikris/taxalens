# BioMiner Phase 12 contract audit (committed HEAD)

- Source repository: `../BioMiner`
- Committed SHA: `1535c494f9403e22ed9b163f3ae0ce3706e17f4c`
- Source tree reviewed from committed history only (`git show`/`git ls-files` style inspection, no staging tree copies).
- Scope note: BioMiner local untracked `.DS_Store` is ignored and does not affect this audit.

## Files inspected

- `src/biominer/run/stages.py`
- `src/biominer/run/manifest.py`
- `src/biominer/run/paths.py`
- `src/biominer/evidence/join.py`
- `src/biominer/evidence/metrics.py`
- `src/biominer/bioclip/target_aware_output.py`
- `src/biominer/bioclip/target_aware_scoring.py`
- `src/biominer/vision/target_full_frame.py`
- `src/biominer/reference_workflow_cli.py`
- `docs/schemas/target_aware_few_shot_contracts.md`

## Stable artifact stage names (committed)

From `src/biominer/run/stages.py`:

- `resolve_taxon_scope`
- `build_registry`
- `geographic_spread`
- `compile_queries`
- `enqueue_flickr_work`
- `poll_flickr`
- `flickr_geo_clustering`
- `regional_candidate_generation`
- `reference_metadata`
- `reference_media`
- `reference_review`
- `reference_embeddings`
- `reference_prototypes`
- `classifier_training`
- `classifier_calibration`
- `reference_readiness`
- `flickr_detection`
- `flickr_embedding`
- `target_aware_scoring`
- `evidence`
- `evaluation`
- `detect_objects`
- `score_bioclip`
- `join_evidence`
- `summarize`
- `queue_comment_review`
- `review_comments`
- `apply_comment_review`

## Stable run artifact keys (committed)

From `src/biominer/run/paths.py` `RUN_ARTIFACT_RELATIVE_PATHS` and related constants:

- `manifest`: `run_manifest.json`
- `registry`
- `staging`
- `reports`
- `species`
- `state`
- `metrics`: `reports/run_metrics.json`
- `vision_stage_metrics`: `reports/vision_stage_metrics.json`
- `vision_stage_summary`: `reports/vision_stage_summary.md`
- `review_queue`: `reports/review_queue.parquet`
- `visual_qa_findings`: `reports/visual_qa_findings.parquet`
- `reviewed_object_evidence`: `staging/object_evidence_reviewed.parquet`
- `query_definitions`: `registry/flickr_query_definitions.parquet`
- `source_records`: `staging/canonical_source_records.parquet`
- `object_detections`: `staging/object_detections.parquet`
- `object_scores`: `staging/object_bioclip_scores.parquet`
- `object_evidence`: `staging/object_evidence_joined.parquet`
- `photo_summary`: `staging/photo_evidence_summary.parquet`
- `taxon_geographic_spread`: `registry/geography/taxon_geographic_spread.parquet`
- `geographic_occurrence_evidence`: `registry/geography/geographic_occurrence_evidence.parquet`
- `geographic_spread_manifest`: `registry/geography/geographic_spread_manifest.json`
- `flickr_geography`: `flickr/geography/flickr_geography.parquet`
- `flickr_geo_clusters`: `flickr/geography/flickr_geo_clusters.parquet`
- `flickr_geo_assignments`: `flickr/geography/flickr_geo_assignments.parquet`
- `regional_candidates`: `candidates/regional_candidate_species.parquet`
- `reference_observations`: `references/metadata/reference_observations.parquet`
- `reference_media_candidates`: `references/media/reference_media_candidates.parquet`
- `reference_media_objects`: `references/media/reference_media_objects.parquet`
- `reference_review_queue`: `references/review/reference_review_queue.parquet`
- `reference_review_decisions`: `references/review/reference_review_decisions.parquet`
- `reference_readiness_manifest`: `references/readiness/reference_bank_readiness.json`
- `reference_support_manifest`: `references/readiness/reference_support_manifest.parquet`
- `reference_bank_summary`: `references/readiness/reference_bank_summary.parquet`
- `reference_embeddings`: `references/embeddings/reference_embeddings.parquet`
- `reference_prototypes`: `references/prototypes/reference_prototypes.parquet`
- `target_aware_object_scores`: `scores/target_aware_object_scores.parquet`
- `target_aware_candidate_scores`: `scores/target_aware_candidate_scores.parquet`

## Target-aware artifacts and contracts found

From `src/biominer/bioclip/target_aware_scoring.py`:

- Schema versions: `target-aware-object-scores-v1.0.0`, `target-aware-candidate-scores-v1.0.0`.
- Object score output file defaults: `target_aware_object_scores.parquet`.
- Candidate score output file defaults: `target_aware_candidate_scores.parquet`.
- Additional score metadata includes calibrated/nonmatch scores, thresholds, competitor and nonmatch margins, route fields, and quality flags.

## Open gaps and exclusions

- Full CLI/task orchestration details remain in `reference_workflow_cli.py` and are large; this audit captures stable contracts only.
- Phase 13 markers were not identified in the committed stage constants and artifact layout, and are therefore treated as intentionally excluded unless separately pinned.
- Several helper artifacts include richer model/calibration manifests not yet adapted in TaxaLens.
- BioMiner imports should continue to be read via stable manifest and artifact paths only; no staged or uncommitted inputs were included.

## Recommended adapter scope for TaxaLens

1. Start from run manifest + `RUN_ARTIFACT_RELATIVE_PATHS`.
2. Build adapters for:
   - run summaries (`manifest`, `metrics`, `vision_stage_*`),
   - target-aware score artifacts,
   - geographic + source definitions,
   - reference readyness and evidence review queue fields,
   - object evidence evidence counts/summary.
3. Keep `RunStage` values as stable strings even when stage metadata is absent.
