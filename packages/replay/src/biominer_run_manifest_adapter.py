"""Adapter for committed BioMiner run manifest files.

This adapter reads local JSON run manifests produced by BioMiner and projects them
into TaxaLens replay contracts without importing BioMiner runtime packages.
"""

from __future__ import annotations

import json
from pathlib import Path
from dataclasses import dataclass
from typing import Any, TypedDict

class RunManifestAdapterError(ValueError):
    pass


class RunSummaryContract(TypedDict):
    schema_version: str
    biominer_commit: str | None
    run_id: str
    title: str | None
    source_manifest_path: str | None
    source_biominer_run_artifact: str | None
    status: str | None
    started_at: str | None
    completed_at: str | None
    records_in: int | None
    records_out: int | None
    stage_count: int | None
    expected_output_artifacts: list[str]
    notes: list[str] | None


@dataclass(frozen=True)
class CompatibilityReport:
    source_path: str
    missing_fields: tuple[str, ...]
    missing_stage_names: tuple[str, ...]
    notes: tuple[str, ...]


def _load_payload(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise RunManifestAdapterError(f"Run manifest not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise RunManifestAdapterError(f"Run manifest is not valid JSON: {path}") from exc

    if not isinstance(payload, dict):
        raise RunManifestAdapterError("Run manifest payload must be an object")
    return payload


def _required_str(payload: dict[str, Any], key: str, *, fallback: str | None = None) -> str | None:
    value = payload.get(key)
    if value is None:
        return fallback
    if not isinstance(value, str) or not value:
        return fallback
    return value


def _required_int(payload: dict[str, Any], key: str, *, fallback: int | None = None) -> int | None:
    value = payload.get(key)
    if value is None:
        return fallback
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def _list_of_strings(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value if str(item)]
    return []


def _normalize_status(value: Any) -> str | None:
    raw = str(value or "").strip().lower()
    if not raw:
        return None
    mapping = {
        "succeeded": "complete",
        "pass": "complete",
        "passed": "complete",
        "complete": "complete",
        "completed": "complete",
        "done": "complete",
        "success": "complete",
        "running": "running",
        "failed": "failed",
        "error": "failed",
        "aborted": "failed",
    }
    return mapping.get(raw, raw)


def _run_summary_from_payload(
    payload: dict[str, Any], source_path: str, biominer_commit: str
) -> tuple[RunSummaryContract, CompatibilityReport]:
    required = [
        "run_id",
        "status",
        "command",
        "git_sha",
        "storage_backend",
        "workstore_backend",
        "started_at",
        "ended_at",
        "taxon_scope",
        "query_counts",
        "detection_counts",
        "bioclip_counts",
        "evidence_counts",
        "metrics",
        "outputs",
    ]

    missing_fields = [name for name in required if payload.get(name) is None]

    outputs = payload.get("outputs")
    if not isinstance(outputs, dict):
        outputs = {}

    stage_names = [
        _stage_name(record) for record in payload.get("stages", ()) if isinstance(record, dict)
    ]
    missing_stage_names = tuple(
        name for name in stage_names if not isinstance(name, str) or not name.strip()
    )

    notes = []
    if not isinstance(payload.get("metrics"), dict):
        notes.append("Manifest metrics field was missing or malformed; defaulted to empty metrics.")
    if not isinstance(payload.get("outputs"), dict):
        notes.append("Manifest outputs field was missing or malformed; defaulted to empty outputs.")

    taxon_scope = payload.get("taxon_scope") or {}
    if not isinstance(taxon_scope, dict):
        notes.append("taxon_scope field was missing or malformed; expected object map.")
        taxon_scope = {}

    summary: RunSummaryContract = {
        "schema_version": "run_summary:v1",
        "biominer_commit": biominer_commit,
        "run_id": payload.get("run_id") or "unknown-run",
        "title": _required_str(taxon_scope, "input_name") or _required_str(taxon_scope, "accepted_scientific_name"),
        "source_manifest_path": source_path,
        "source_biominer_run_artifact": source_path,
        "status": _normalize_status(payload.get("status")) or "unknown",
        "started_at": _required_str(payload, "started_at"),
        "completed_at": _required_str(payload, "ended_at"),
        "records_in": _required_int(payload.get("query_counts", {}), "total", fallback=None),
        "records_out": _required_int(payload.get("evidence_counts", {}), "kept", fallback=None),
        "stage_count": _required_int({"x": len(payload.get("stages", ()) or ())}, "x", fallback=None),
        "expected_output_artifacts": list(outputs.keys()) if outputs else [],
        "notes": _list_of_strings(payload.get("notes")) if isinstance(payload.get("notes"), list) else None,
    }

    return summary, CompatibilityReport(
        source_path=source_path,
        missing_fields=tuple(missing_fields),
        missing_stage_names=tuple(missing_stage_names),
        notes=tuple(notes),
    )


def _stage_name(record: dict[str, Any]) -> str | None:
    raw = record.get("stage")
    if isinstance(raw, str):
        return raw
    return None


def adapt_run_manifest(
    *,
    manifest_path: str | Path,
    biominer_commit: str,
) -> dict[str, Any]:
    """Adapt a committed BioMiner run manifest into a TaxaLens RunSummary.

    Returns a dictionary with `run_summary` and a `compatibility` report.
    """
    if not biominer_commit or not isinstance(biominer_commit, str):
        raise RunManifestAdapterError("biominer_commit is required")
    if len(biominer_commit) != 40:
        raise RunManifestAdapterError("biominer_commit must be a full 40-character SHA")

    path = Path(manifest_path)
    payload = _load_payload(path)
    if "schema_version" in payload and payload["schema_version"] not in (1, "1"):
        # BioMiner's current contract currently expects value 1.
        raise RunManifestAdapterError("Unsupported run manifest schema version")

    summary, report = _run_summary_from_payload(payload, str(manifest_path), biominer_commit)
    return {
        "run_summary": summary,
        "compatibility": {
            "source_path": report.source_path,
            "missing_fields": list(report.missing_fields),
            "missing_stage_names": list(report.missing_stage_names),
            "notes": list(report.notes),
        },
    }
