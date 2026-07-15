"""Adapt BioMiner object evidence and photo-summary artifacts into TaxaLens summary."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, TypedDict

from packages.replay.src.validation import is_full_git_sha


class ObjectEvidenceSummaryAdapterError(ValueError):
    """Raised when object evidence artifacts cannot be adapted for replay."""


class ObjectEvidenceSummaryContract(TypedDict):
    schema_version: str
    biominer_commit: str | None
    run_id: str
    source_manifest_path: str | None
    object_evidence_artifact_path: str | None
    photo_summary_artifact_path: str | None
    object_evidence_rows: int | None
    photo_summary_rows: int | None
    object_occurrence_bin_counts: dict[str, int] | None
    photo_occurrence_bin_counts: dict[str, int] | None


def _first_str(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ObjectEvidenceSummaryAdapterError(f"Artifact not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ObjectEvidenceSummaryAdapterError(
            f"Artifact is not valid JSON: {path}"
        ) from exc


def _load_manifest(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ObjectEvidenceSummaryAdapterError(f"Run manifest not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ObjectEvidenceSummaryAdapterError(f"Run manifest is not valid JSON: {path}") from exc
    if not isinstance(payload, dict):
        raise ObjectEvidenceSummaryAdapterError("Run manifest payload must be a JSON object")
    return payload


def _extract_rows(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        source_rows = payload
    elif isinstance(payload, dict):
        source_rows = payload.get("rows") or payload.get("data") or []
        if not isinstance(source_rows, list):
            return []
    else:
        return []
    return [row for row in source_rows if isinstance(row, dict)]


def _resolve_artifact_path(
    outputs: Any,
    manifest_dir: Path,
    *keys: str,
) -> Path | None:
    if not isinstance(outputs, dict):
        return None
    for key in keys:
        value = outputs.get(key)
        if not isinstance(value, str):
            continue
        raw = value.strip()
        if not raw:
            continue
        path = Path(raw)
        if not path.is_absolute():
            path = (manifest_dir / path).resolve()
        return path
    return None


def _bucket_counts(rows: list[dict[str, Any]], key: str) -> dict[str, int]:
    buckets: dict[str, int] = {}
    for row in rows:
        value = _first_str(row.get(key))
        if value is None:
            continue
        buckets[value] = buckets.get(value, 0) + 1
    return buckets


def _is_parquet_path(path: Path) -> bool:
    return path.suffix.lower() == ".parquet"


def adapt_object_evidence_summary(
    *, manifest_path: str | Path, biominer_commit: str
) -> dict[str, Any]:
    if not is_full_git_sha(biominer_commit):
        raise ObjectEvidenceSummaryAdapterError(
            "biominer_commit must be a full 40-character hexadecimal SHA"
        )

    manifest_path = Path(manifest_path)
    manifest_payload = _load_manifest(manifest_path)
    run_id = _first_str(manifest_payload.get("run_id")) or "unknown-run"
    outputs = manifest_payload.get("outputs")

    object_path = _resolve_artifact_path(
        outputs, manifest_path.parent, "object_evidence", "object_evidence_joined"
    )
    photo_path = _resolve_artifact_path(
        outputs, manifest_path.parent, "photo_summary", "photo_evidence_summary"
    )
    notes: list[str] = []

    object_rows: list[dict[str, Any]] = []
    photo_rows: list[dict[str, Any]] = []
    artifact_missing = object_path is None and photo_path is None

    if object_path is None:
        notes.append("run manifest did not declare object_evidence artifact path")
    elif _is_parquet_path(object_path):
        notes.append(
            f"object_evidence artifact is parquet and not parsed in deterministic replay fixtures: {object_path}"
        )
        artifact_missing = True
    else:
        try:
            object_rows = _extract_rows(_load_json(object_path))
        except ObjectEvidenceSummaryAdapterError:
            notes.append(f"failed to parse object_evidence artifact at {object_path}")
            artifact_missing = True

    if photo_path is None:
        notes.append("run manifest did not declare photo_summary artifact path")
        artifact_missing = True
    elif _is_parquet_path(photo_path):
        notes.append(
            f"photo_summary artifact is parquet and not parsed in deterministic replay fixtures: {photo_path}"
        )
        artifact_missing = True
    else:
        try:
            photo_rows = _extract_rows(_load_json(photo_path))
        except ObjectEvidenceSummaryAdapterError:
            notes.append(f"failed to parse photo_summary artifact at {photo_path}")
            artifact_missing = True

    return {
        "object_evidence_summary": ObjectEvidenceSummaryContract(
            schema_version="object_evidence_summary:v1",
            biominer_commit=biominer_commit,
            run_id=run_id,
            source_manifest_path=str(manifest_path),
            object_evidence_artifact_path=str(object_path) if object_path else None,
            photo_summary_artifact_path=str(photo_path) if photo_path else None,
            object_evidence_rows=len(object_rows) if object_rows else None,
            photo_summary_rows=len(photo_rows) if photo_rows else None,
            object_occurrence_bin_counts=_bucket_counts(object_rows, "occurrence_bin"),
            photo_occurrence_bin_counts=_bucket_counts(photo_rows, "photo_occurrence_bin"),
        ),
        "compatibility": {
            "source_path": str(manifest_path),
            "run_id": run_id,
            "object_evidence_path": str(object_path) if object_path else None,
            "photo_summary_path": str(photo_path) if photo_path else None,
            "artifact_missing": artifact_missing,
            "object_rows_read": len(object_rows),
            "photo_rows_read": len(photo_rows),
            "notes": notes,
        },
    }
