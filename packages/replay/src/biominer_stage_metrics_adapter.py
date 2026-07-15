"""Map BioMiner run-manifest stage records into TaxaLens StageMetric contracts."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, TypedDict

from packages.replay.src.validation import is_full_git_sha


class StageMetricsAdapterError(ValueError):
    """Raised when a BioMiner run manifest cannot be adapted to TaxaLens stage metrics."""


class StageMetricContract(TypedDict):
    schema_version: str
    biominer_commit: str | None
    stage_id: str
    stage_name: str | None
    operation_type: str | None
    join_type: str | None
    input_keys: list[str] | None
    output_keys: list[str] | None
    input_artifact_id: str | None
    output_artifact_id: str | None
    rows_in: int | None
    rows_out: int | None
    expected_rows: int | None
    elapsed_seconds: float | None
    peak_memory_mb: int | None
    bytes_scanned: int | None
    bytes_written: int | None
    cache_hits: int | None
    cache_misses: int | None
    retries: int | None
    artifact_uri: str | None
    produced_sha256: str | None
    schema_version_ref: str | None


@dataclass(frozen=True)
class StageSpec:
    operation_type: str
    join_type: str | None
    input_keys: tuple[str, ...] = ()
    output_keys: tuple[str, ...] = ()


KNOWN_STAGE_SPECS: dict[str, StageSpec] = {
    "resolve_taxon_scope": StageSpec(
        "taxonomic_scope_resolution",
        "hash_join",
        input_keys=("taxon_name",),
        output_keys=("taxon_scope",),
    ),
    "build_registry": StageSpec(
        "registry_build",
        "hash_join",
        input_keys=("registry_path", "registry_manifest"),
        output_keys=("registry_dir", "query_definitions"),
    ),
    "compile_queries": StageSpec(
        "query_generation",
        "semi_join",
        input_keys=("registry_query_definitions",),
        output_keys=("query_definitions",),
    ),
    "enqueue_flickr_work": StageSpec(
        "work_queueing",
        "grouped_aggregation",
        input_keys=("query_definitions",),
        output_keys=("workstore_stage",),
    ),
    "poll_flickr": StageSpec(
        "media_retrieval",
        "hash_join",
        input_keys=("workstore_stage",),
        output_keys=("source_records",),
    ),
    "geographic_spread": StageSpec(
        "spatial_enrichment",
        "spatial_cell_join",
        input_keys=("registry_artifacts", "taxonomy"),
        output_keys=("taxon_geographic_spread", "geographic_summary"),
    ),
    "flickr_geo_clustering": StageSpec(
        "spatial_clustering",
        "spatial_cell_join",
        input_keys=("flickr_geography",),
        output_keys=("flickr_geo_clusters", "flickr_geo_assignments"),
    ),
    "regional_candidate_generation": StageSpec(
        "candidate_projection",
        "semi_join",
        input_keys=("flickr_geo_assignments", "species_context"),
        output_keys=("regional_candidates",),
    ),
    "reference_metadata": StageSpec(
        "candidate_enrichment",
        "grouped_aggregation",
        input_keys=("regional_candidates",),
        output_keys=("reference_observations", "reference_bank_manifest"),
    ),
    "reference_media": StageSpec(
        "media_joining",
        "hash_join",
        input_keys=("reference_observations",),
        output_keys=("reference_media",),
    ),
    "reference_review": StageSpec(
        "reference_hardening",
        "hash_join",
        input_keys=("reference_media", "manual_review_queue"),
        output_keys=("reference_review_queue", "reference_review_decisions"),
    ),
    "reference_embeddings": StageSpec(
        "reference_embedding",
        "matrix_scoring",
        input_keys=("reference_media",),
        output_keys=("reference_embeddings",),
    ),
    "reference_prototypes": StageSpec(
        "prototype_fitting",
        "matrix_scoring",
        input_keys=("reference_embeddings",),
        output_keys=("reference_prototypes",),
    ),
    "classifier_training": StageSpec(
        "classifier_training",
        "matrix_scoring",
        input_keys=("reference_prototypes", "regional_candidates"),
        output_keys=("classifiers",),
    ),
    "classifier_calibration": StageSpec(
        "calibration_fitting",
        "grouped_aggregation",
        input_keys=("classifiers",),
        output_keys=("calibrators",),
    ),
    "reference_readiness": StageSpec(
        "readiness_checks",
        "hash_join",
        input_keys=("reference_support_manifest", "model_fingerprints"),
        output_keys=("reference_readiness_manifest",),
    ),
    "flickr_detection": StageSpec(
        "object_detection",
        "nearest_neighbour",
        input_keys=("source_records",),
        output_keys=("object_detections",),
    ),
    "flickr_embedding": StageSpec(
        "detection_scoring",
        "matrix_scoring",
        input_keys=("object_detections",),
        output_keys=("object_scores",),
    ),
    "target_aware_scoring": StageSpec(
        "target_aware_scoring",
        "matrix_scoring",
        input_keys=("object_scores", "reference_support"),
        output_keys=("target_aware_object_scores", "target_aware_candidate_scores"),
    ),
    "evidence": StageSpec(
        "evidence_join",
        "grouped_aggregation",
        input_keys=("target_aware_candidate_scores",),
        output_keys=("candidate_evidence",),
    ),
    "evaluation": StageSpec(
        "evidence_evaluation",
        "grouped_aggregation",
        input_keys=("candidate_evidence",),
        output_keys=("evaluation",),
    ),
    "detect_objects": StageSpec(
        "object_detection",
        "nearest_neighbour",
        input_keys=("source_records",),
        output_keys=("object_detections",),
    ),
    "score_bioclip": StageSpec(
        "visual_scoring",
        "matrix_scoring",
        input_keys=("object_detections", "candidate_set"),
        output_keys=("object_scores",),
    ),
    "join_evidence": StageSpec(
        "evidence_join",
        "hash_join",
        input_keys=("object_scores", "object_detections"),
        output_keys=("object_evidence",),
    ),
    "summarize": StageSpec(
        "result_summary",
        "grouped_aggregation",
        input_keys=("object_evidence", "photo_summary"),
        output_keys=("review_queue", "visual_qa_findings"),
    ),
    "queue_comment_review": StageSpec(
        "review_queue_build",
        "grouped_aggregation",
        input_keys=("object_evidence",),
        output_keys=("comment_review_state",),
    ),
    "review_comments": StageSpec(
        "comment_retrieval",
        "grouped_aggregation",
        input_keys=("comment_review_state",),
        output_keys=("comment_review_state",),
    ),
    "apply_comment_review": StageSpec(
        "evidence_rewrite",
        "grouped_aggregation",
        input_keys=("comment_review_state", "object_evidence"),
        output_keys=("object_evidence_reviewed",),
    ),
}


def _normalize_status(value: Any) -> str | None:
    raw = str(value or "").strip().lower()
    if not raw:
        return None
    status_map = {
        "succeeded": "complete",
        "pass": "complete",
        "passed": "complete",
        "complete": "complete",
        "completed": "complete",
        "done": "complete",
        "success": "complete",
        "running": "running",
        "in_progress": "running",
        "failed": "failed",
        "pending": "pending",
        "skipped": "skipped",
        "awaiting_manual_review": "awaiting_manual_review",
    }
    return status_map.get(raw, raw)


def _load_payload(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise StageMetricsAdapterError(f"Manifest not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise StageMetricsAdapterError(f"Manifest is not valid JSON: {path}") from exc

    if not isinstance(payload, dict):
        raise StageMetricsAdapterError("Manifest payload must be a JSON object")
    return payload


def _to_int(value: object) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        if value.is_integer():
            return int(value)
        return None
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _to_float(value: object) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    return None


def _to_str(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _first_non_empty(value: Any, *, fallback: str | None = None) -> str | None:
    if not isinstance(value, str):
        return fallback
    text = value.strip()
    return text or fallback


def _to_output_uri(outputs: dict[str, Any]) -> str | None:
    if not outputs:
        return None
    for key in ("artifact", "manifest", "path", "uri", "output"):
        if _first_non_empty(outputs.get(key)) is not None:
            return _first_non_empty(outputs.get(key))
    for value in outputs.values():
        maybe = _first_non_empty(value)
        if maybe is not None:
            return maybe
    return None


def _to_input_artifact_id(outputs: dict[str, Any]) -> str | None:
    for key in ("input", "source", "state_db", "source_records", "registry_dir", "query_definitions"):
        value = _first_non_empty(outputs.get(key))
        if value is not None:
            return value
    return None


def _pick_int(metrics: dict[str, Any], *keys: str) -> int | None:
    for key in keys:
        value = _to_int(metrics.get(key))
        if value is not None:
            return value
    return None


def _stage_operation_and_join(stage: str, status: str | None) -> tuple[str, str | None]:
    if stage in KNOWN_STAGE_SPECS:
        spec = KNOWN_STAGE_SPECS[stage]
        return spec.operation_type, spec.join_type
    if status in {"awaiting_manual_review", "complete", "running", "failed", "pending", "skipped"}:
        return status, "other"
    return stage, "other"


def adapt_stage_metrics(
    *,
    manifest_path: str | Path,
    biominer_commit: str,
) -> dict[str, Any]:
    if not is_full_git_sha(biominer_commit):
        raise StageMetricsAdapterError(
            "biominer_commit must be a full 40-character hexadecimal SHA"
        )

    payload = _load_payload(Path(manifest_path))
    raw_stages = payload.get("stages")
    if not isinstance(raw_stages, list):
        raise StageMetricsAdapterError("Manifest stages must be an array")

    stage_metrics: list[StageMetricContract] = []
    unknown_stages: list[str] = []
    missing_stage_records: list[str] = []

    for index, record in enumerate(raw_stages):
        if not isinstance(record, dict):
            missing_stage_records.append(f"non_object_stage_record_{index}")
            continue

        stage = str(record.get("stage") or "").strip()
        if not stage:
            missing_stage_records.append(f"missing_stage_name_{index}")
            continue

        metrics = record.get("metrics")
        if not isinstance(metrics, dict):
            metrics = {}
        outputs = record.get("outputs")
        if not isinstance(outputs, dict):
            outputs = {}

        status = _normalize_status(record.get("status"))
        operation_type, join_type = _stage_operation_and_join(stage, status)
        spec = KNOWN_STAGE_SPECS.get(stage)

        if spec is None:
            unknown_stages.append(stage)

        stage_rows_in = _pick_int(
            metrics,
            "rows_in",
            "records_in",
            "records_seen",
            "images_seen",
            "flickr_work_items",
            "compiled_definitions",
            "source_records_inserted",
            "compiled_queries",
        )
        stage_rows_out = _pick_int(
            metrics,
            "rows_out",
            "rows_written",
            "records_out",
            "detections_written",
            "objects_scored",
            "object_evidence_rows",
            "photo_summary_rows",
            "review_queue_rows",
            "source_records_inserted",
            "registry_query_definition_rows",
        )
        stage_expected_rows = _pick_int(
            metrics,
            "expected_rows",
            "expected_row_count",
            "query_definition_rows_expected",
        )
        stage_elapsed_seconds = _to_float(
            metrics.get("elapsed_seconds") or metrics.get("total_seconds")
        )
        peak_memory_mb = _pick_int(metrics, "peak_memory_mb", "peak_memory_bytes")
        stage_bytes_scanned = _pick_int(
            metrics,
            "bytes_scanned",
            "input_bytes",
            "bytes_read",
            "source_bytes",
        )
        stage_bytes_written = _pick_int(
            metrics,
            "bytes_written",
            "output_bytes",
            "bytes_out",
            "written_bytes",
        )
        stage_cache_hits = _pick_int(
            metrics,
            "cache_hits",
            "cache_hit_count",
            "cache_reuses",
        )
        stage_cache_misses = _pick_int(
            metrics,
            "cache_misses",
            "cache_miss_count",
            "cache_misfetch",
        )
        stage_retries = _pick_int(
            metrics,
            "retries",
            "retry_count",
            "detector_batch_retries",
            "bioclip_batch_retries",
        )

        stage_metrics.append(
            StageMetricContract(
                schema_version="stage_metric:v1",
                biominer_commit=biominer_commit,
                stage_id=stage,
                stage_name=stage,
                operation_type=operation_type,
                join_type=join_type,
                input_keys=list(spec.input_keys) if spec is not None else sorted(outputs.keys()),
                output_keys=list(spec.output_keys) if spec is not None else sorted(outputs.keys()),
                input_artifact_id=_to_input_artifact_id(outputs),
                output_artifact_id=_to_output_uri(outputs),
                rows_in=stage_rows_in,
                rows_out=stage_rows_out,
                expected_rows=stage_expected_rows,
                elapsed_seconds=stage_elapsed_seconds,
                peak_memory_mb=peak_memory_mb,
                bytes_scanned=stage_bytes_scanned,
                bytes_written=stage_bytes_written,
                cache_hits=stage_cache_hits,
                cache_misses=stage_cache_misses,
                retries=stage_retries,
                artifact_uri=_to_output_uri(outputs),
                produced_sha256=_to_str(
                    metrics.get("produced_sha256")
                    or metrics.get("output_sha256")
                ),
                schema_version_ref=_to_str(metrics.get("schema_version_ref"))
                or _to_str(metrics.get("schema_version")),
            )
        )

    notes = [
        "legacy and target-aware stage names mapped using stable operation/join profiles where known.",
        "best-effort metric aliases were applied when canonical metric keys were unavailable.",
    ]
    if unknown_stages:
        notes.append(
            "unknown stage names were preserved as-is and mapped with operation=stage_name and join_type=other."
        )
    if missing_stage_records:
        notes.append(
            "some stage records were missing expected fields and were either skipped or partially adapted."
        )

    return {
        "stage_metrics": stage_metrics,
        "compatibility": {
            "source_path": str(manifest_path),
            "unknown_stages": unknown_stages,
            "missing_stage_records": missing_stage_records,
            "notes": notes,
        },
    }
