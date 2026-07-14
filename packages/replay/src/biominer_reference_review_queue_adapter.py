"""Adapter for BioMiner reference review queue artifacts."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, TypedDict


class ReferenceReviewQueueAdapterError(ValueError):
    """Raised when a BioMiner reference-review queue artifact cannot be adapted."""


class ReviewQueueRecordContract(TypedDict):
    schema_version: str
    biominer_commit: str | None
    review_request_id: str | None
    reference_media_id: str | None
    reference_observation_id: str | None
    accepted_taxon_key: str | None
    scientific_name: str | None
    source: str | None
    provider_media_id: str | None
    review_status: str | None
    review_priority: int | None
    required_review_count: int | None
    life_stage: str | None
    visual_domain: str | None
    review_reason: str | None
    reference_bank_version: str | None
    created_at: str | None
    artifact_path: str | None


class ReviewQueueSummaryContract(TypedDict):
    schema_version: str
    biominer_commit: str | None
    run_id: str
    source_manifest_path: str | None
    review_queue_artifact_path: str | None
    total_records: int | None
    pending_records: int | None
    in_review_records: int | None
    completed_records: int | None
    conflict_records: int | None
    cancelled_records: int | None
    unique_taxon_count: int | None
    unique_media_count: int | None
    max_review_priority: int | None
    max_required_review_count: int | None


def _load_payload(path: Path) -> list[dict[str, Any]] | None:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ReferenceReviewQueueAdapterError(f"Review queue artifact not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ReferenceReviewQueueAdapterError(
            f"Review queue artifact is not valid JSON: {path}"
        ) from exc

    if isinstance(raw, dict):
        return _extract_records_from_dict(raw)
    if isinstance(raw, list):
        return [item for item in raw if isinstance(item, dict)]
    return None


def _extract_records_from_dict(payload: dict[str, Any]) -> list[dict[str, Any]]:
    rows = payload.get("rows") or payload.get("review_queue")
    if isinstance(rows, list):
        return [item for item in rows if isinstance(item, dict)]
    return []


def _to_str(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _to_int(value: Any) -> int | None:
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
    text = str(value).strip()
    if not text:
        return None
    try:
        return int(text)
    except (TypeError, ValueError):
        return None


def _safe_path(manifest_path: Path, key: str, outputs: Any) -> tuple[Path, str] | None:
    if not isinstance(outputs, dict):
        return None
    raw = _to_str(outputs.get(key))
    if raw is None:
        return None
    path = Path(raw)
    if not path.is_absolute():
        path = (manifest_path.parent / path).resolve()
    return path, key


def _artifact_path(manifest_payload: dict[str, Any], manifest_path: Path) -> tuple[Path, str] | None:
    outputs = manifest_payload.get("outputs")
    for key in (
        "reference_review_queue",
        "review_queue",
        "reference_review",
        "reference_review_artifact",
    ):
        resolved = _safe_path(manifest_path, key, outputs)
        if resolved is not None:
            return resolved
    return None


def _status_bucket(status: str | None) -> str:
    if status is None:
        return "unknown"
    value = status.strip().lower()
    if value in {"pending", "in_review", "completed", "conflict", "second_review_required", "cancelled"}:
        return value
    if value == "reviewed":
        return "completed"
    return "other"


def adapt_reference_review_queue(
    *,
    manifest_path: str | Path,
    biominer_commit: str,
) -> dict[str, Any]:
    """Adapt BioMiner reference_review_queue.parquet (or JSON fixture) into TaxaLens records."""
    if not isinstance(biominer_commit, str) or len(biominer_commit) != 40:
        raise ReferenceReviewQueueAdapterError("biominer_commit must be a full 40-character SHA")

    manifest_path = Path(manifest_path)
    try:
        manifest_payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ReferenceReviewQueueAdapterError(f"Manifest not found: {manifest_path}") from exc
    except json.JSONDecodeError as exc:
        raise ReferenceReviewQueueAdapterError(
            f"Manifest is not valid JSON: {manifest_path}"
        ) from exc
    if not isinstance(manifest_payload, dict):
        raise ReferenceReviewQueueAdapterError("Manifest payload must be a JSON object")

    artifact = _artifact_path(manifest_payload, manifest_path)
    compatibility_notes: list[str] = []
    if artifact is None:
        return {
            "reference_review_queue_summary": None,
            "reference_review_queue_records": [],
            "compatibility": {
                "source_path": str(manifest_path),
                "artifact_key": None,
                "artifact_path": None,
                "artifact_missing": True,
                "records_read": 0,
                "notes": ["run manifest did not declare reference review queue artifact path"],
            },
        }

    artifact_path, artifact_key = artifact
    if artifact_path.suffix.lower() == ".parquet":
        return {
            "reference_review_queue_summary": None,
            "reference_review_queue_records": [],
            "compatibility": {
                "source_path": str(manifest_path),
                "artifact_key": artifact_key,
                "artifact_path": str(artifact_path),
                "artifact_missing": False,
                "records_read": 0,
                "notes": [
                    "parquet review queue artifacts are not adapted in deterministic replay fixtures",
                ],
            },
        }
    if not artifact_path.exists():
        return {
            "reference_review_queue_summary": None,
            "reference_review_queue_records": [],
            "compatibility": {
                "source_path": str(manifest_path),
                "artifact_key": artifact_key,
                "artifact_path": str(artifact_path),
                "artifact_missing": True,
                "records_read": 0,
                "notes": [f"reference review queue artifact missing at {artifact_path}"],
            },
        }

    try:
        records = _load_payload(artifact_path)
    except ReferenceReviewQueueAdapterError:
        compatibility_notes.append(f"reference review queue artifact could not be parsed at {artifact_path}")
        return {
            "reference_review_queue_summary": None,
            "reference_review_queue_records": [],
            "compatibility": {
                "source_path": str(manifest_path),
                "artifact_key": artifact_key,
                "artifact_path": str(artifact_path),
                "artifact_missing": False,
                "records_read": 0,
                "notes": compatibility_notes,
            },
        }

    if records is None:
        compatibility_notes.append("review queue payload was missing rows and could not be adapted")
        records = []

    summary_buckets: dict[str, int] = {
        "pending": 0,
        "in_review": 0,
        "completed": 0,
        "conflict": 0,
        "cancelled": 0,
        "other": 0,
    }
    unique_taxa: set[str] = set()
    unique_media: set[str] = set()
    max_review_priority: int | None = None
    max_required_review_count: int | None = None

    adapted_records: list[ReviewQueueRecordContract] = []
    for index, raw_row in enumerate(records):
        if not isinstance(raw_row, dict):
            compatibility_notes.append(f"non-mapping_review_queue_row_{index}")
            continue

        status_bucket = _status_bucket(_to_str(raw_row.get("review_status")))
        if status_bucket in summary_buckets:
            summary_buckets[status_bucket] += 1
        else:
            summary_buckets["other"] += 1

        taxon_key = _to_str(raw_row.get("accepted_taxon_key"))
        media_id = _to_str(raw_row.get("reference_media_id"))
        if taxon_key is not None:
            unique_taxa.add(taxon_key)
        if media_id is not None:
            unique_media.add(media_id)

        priority = _to_int(raw_row.get("review_priority"))
        if priority is not None and (max_review_priority is None or priority > max_review_priority):
            max_review_priority = priority
        required_count = _to_int(raw_row.get("required_review_count"))
        if required_count is not None and (
            max_required_review_count is None
            or required_count > max_required_review_count
        ):
            max_required_review_count = required_count

        adapted_records.append(
            ReviewQueueRecordContract(
                schema_version="reference_review_queue_record:v1",
                biominer_commit=biominer_commit,
                review_request_id=_to_str(raw_row.get("review_request_id")),
                reference_media_id=media_id,
                reference_observation_id=_to_str(raw_row.get("reference_observation_id")),
                accepted_taxon_key=taxon_key,
                scientific_name=_to_str(raw_row.get("scientific_name")),
                source=_to_str(raw_row.get("source")),
                provider_media_id=_to_str(raw_row.get("provider_media_id")),
                review_status=_to_str(raw_row.get("review_status")),
                review_priority=priority,
                required_review_count=required_count,
                life_stage=_to_str(raw_row.get("life_stage")),
                visual_domain=_to_str(raw_row.get("visual_domain")),
                review_reason=_to_str(raw_row.get("review_reason")),
                reference_bank_version=_to_str(raw_row.get("reference_bank_version")),
                created_at=_to_str(raw_row.get("created_at")),
                artifact_path=str(artifact_path),
            )
        )

    if not adapted_records:
        compatibility_notes.append("review queue artifact contained no review records")

    summary: ReviewQueueSummaryContract = {
        "schema_version": "reference_review_queue_summary:v1",
        "biominer_commit": biominer_commit,
        "run_id": _to_str(manifest_payload.get("run_id")) or "unknown-run",
        "source_manifest_path": str(manifest_path),
        "review_queue_artifact_path": str(artifact_path),
        "total_records": len(adapted_records),
        "pending_records": summary_buckets["pending"],
        "in_review_records": summary_buckets["in_review"],
        "completed_records": summary_buckets["completed"],
        "conflict_records": summary_buckets["conflict"],
        "cancelled_records": summary_buckets["cancelled"],
        "unique_taxon_count": len(unique_taxa),
        "unique_media_count": len(unique_media),
        "max_review_priority": max_review_priority,
        "max_required_review_count": max_required_review_count,
    }

    return {
        "reference_review_queue_summary": summary,
        "reference_review_queue_records": adapted_records,
        "compatibility": {
            "source_path": str(manifest_path),
            "artifact_key": artifact_key,
            "artifact_path": str(artifact_path),
            "artifact_missing": False,
            "records_read": len(adapted_records),
            "notes": compatibility_notes,
        },
    }
