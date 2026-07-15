"""Adapter for committed BioMiner reference-readiness artifacts.

This adapter reads BioMiner readiness manifests and projects them into
TaxaLens contracts without importing BioMiner runtime modules.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, TypedDict

from packages.replay.src.validation import is_full_git_sha


class ReferenceReadinessAdapterError(ValueError):
    """Raised when a BioMiner reference-readiness artifact cannot be adapted."""


REFERENCE_BANK_READINESS_FILE = "reference_bank_readiness.json"


class ReferenceReadinessSummaryContract(TypedDict):
    schema_version: str
    biominer_commit: str | None
    run_id: str
    source_manifest_path: str | None
    readiness_artifact_path: str | None
    status: str | None
    permits_vision: bool | None
    target_accepted_taxon_key: str | None
    registry_version: str | None
    reference_bank_version: str | None
    policy_version: str | None
    policy_fingerprint: str | None
    readiness_artifact_schema_version: str | None
    created_at: str | None
    git_sha: str | None
    checks_total: int | None
    checks_passed: int | None
    checks_warning: int | None
    checks_failed: int | None
    checks_pending: int | None
    documented_shortfall_count: int | None
    candidate_set_count: int | None
    candidate_set_fingerprint_count: int | None
    support_manifest_rows: int | None
    eligible_support_rows: int | None
    pending_review_count: int | None
    pending_target_review_count: int | None
    unresolved_duplicate_count: int | None
    licence_blocker_count: int | None
    attribution_blocker_count: int | None
    unverified_support_count: int | None
    route_separation_conflict_count: int | None
    split_leakage_count: int | None
    structural_issue_count: int | None
    model_input_fingerprint: str | None
    support_manifest_file: str | None
    support_manifest_sha256: str | None
    summary_file: str | None
    summary_sha256: str | None
    candidate_set_ids: list[str]
    check_ids: list[str]


class ReferenceReadinessCheckContract(TypedDict):
    check_id: str | None
    status: str | None
    observed_count: int | None
    required_count: int | None
    observed_type: str | None
    required_type: str | None
    affected_species_count: int | None
    affected_clusters_count: int | None
    affected_routes_count: int | None
    evidence_fields: list[str] | None


def _load_payload(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ReferenceReadinessAdapterError(f"Manifest not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ReferenceReadinessAdapterError(f"Manifest is not valid JSON: {path}") from exc

    if not isinstance(payload, dict):
        raise ReferenceReadinessAdapterError("Manifest payload must be a JSON object")
    return payload


def _to_str(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _normalize_status(value: Any) -> str | None:
    text = _to_str(value)
    if text is None:
        return None
    normalized = text.lower()
    status_map = {
        "succeeded": "passed",
        "successful": "passed",
        "pass": "passed",
        "passed": "passed",
        "complete": "passed",
        "completed": "passed",
        "done": "passed",
        "failed": "failed",
        "fail": "failed",
        "failure": "failed",
        "failed_with_warning": "warning",
        "warning": "warning",
        "warn": "warning",
        "warned": "warning",
        "pending": "pending",
    }
    return status_map.get(normalized, normalized)


def _to_bool(value: Any) -> bool | None:
    if isinstance(value, bool):
        return value
    if value is None:
        return None
    text = str(value).strip().lower()
    if text in {"1", "true", "yes", "y", "on"}:
        return True
    if text in {"0", "false", "no", "off"}:
        return False
    return None


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


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    normalized: list[str] = []
    for item in value:
        text = _to_str(item)
        if text is not None:
            normalized.append(text)
    return normalized


def _value_count(value: Any) -> tuple[int | None, str | None]:
    if value is None:
        return None, "null"
    if isinstance(value, bool):
        return None, "boolean"
    if isinstance(value, int):
        return value, "integer"
    if isinstance(value, float):
        if value.is_integer():
            return int(value), "integer"
        return None, "float"
    if isinstance(value, list):
        return len(value), "list"
    if isinstance(value, dict):
        return len(value), "object"
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None, "string"
        return _to_int(text), "string"
    return None, type(value).__name__


def _resolve_output_path(manifest_path: Path, raw: str) -> Path:
    path = Path(raw)
    if not path.is_absolute():
        path = (manifest_path.parent / path).resolve()
    if path.is_dir():
        return path / REFERENCE_BANK_READINESS_FILE
    return path


def _artifact_path(payload: dict[str, Any], manifest_path: Path) -> tuple[Path, str] | None:
    outputs = payload.get("outputs")
    if not isinstance(outputs, dict):
        return None

    for key in (
        "reference_readiness_manifest",
        "reference_readiness",
        "readiness_manifest",
        "reference_readiness_file",
        "readiness",
    ):
        value = outputs.get(key)
        if not isinstance(value, str):
            continue
        raw = value.strip()
        if not raw:
            continue
        return _resolve_output_path(manifest_path, raw), key
    return None


def _artifact_meta(payload: Any) -> tuple[str | None, str | None]:
    if not isinstance(payload, dict):
        return None, None
    return _to_str(payload.get("file")), _to_str(payload.get("sha256"))


def _adapt_check(check: Any, index: int, notes: list[str]) -> ReferenceReadinessCheckContract | None:
    if not isinstance(check, dict):
        notes.append(f"non_mapping_readiness_check_{index}")
        return None

    status = _normalize_status(check.get("status"))
    observed = check.get("observed")
    required = check.get("required")
    observed_count, observed_type = _value_count(observed)
    required_count, required_type = _value_count(required)
    evidence = check.get("evidence")
    evidence_fields: list[str] | None = None
    if isinstance(evidence, dict):
        evidence_fields = sorted(str(key) for key in evidence.keys())

    affected_species = check.get("affected_species")
    affected_clusters = check.get("affected_clusters")
    affected_routes = check.get("affected_routes")

    return ReferenceReadinessCheckContract(
        check_id=_to_str(check.get("check_id")),
        status=status,
        observed_count=observed_count,
        required_count=required_count,
        observed_type=observed_type,
        required_type=required_type,
        affected_species_count=len(_string_list(affected_species)),
        affected_clusters_count=len(_string_list(affected_clusters)),
        affected_routes_count=len(_string_list(affected_routes)),
        evidence_fields=evidence_fields,
    )


def _readiness_check_status_counts(
    rows: list[ReferenceReadinessCheckContract],
) -> dict[str, int]:
    return {
        "passed": sum(1 for row in rows if row["status"] == "passed"),
        "warning": sum(1 for row in rows if row["status"] == "warning"),
        "failed": sum(1 for row in rows if row["status"] == "failed"),
        "pending": sum(1 for row in rows if row["status"] == "pending"),
    }


def adapt_reference_readiness(
    *,
    manifest_path: str | Path,
    biominer_commit: str,
) -> dict[str, Any]:
    """Adapt BioMiner reference-readiness manifest output into TaxaLens contract."""
    if not is_full_git_sha(biominer_commit):
        raise ReferenceReadinessAdapterError(
            "biominer_commit must be a full 40-character hexadecimal SHA"
        )

    manifest_path = Path(manifest_path)
    run_payload = _load_payload(manifest_path)
    if "schema_version" in run_payload:
        manifest_schema_version = run_payload.get("schema_version")
        if isinstance(manifest_schema_version, bool) or manifest_schema_version not in (
            1,
            "1",
        ):
            # Keep to committed contract behavior only.
            raise ReferenceReadinessAdapterError("Unsupported run manifest schema version")

    artifact = _artifact_path(run_payload, manifest_path)
    notes: list[str] = []
    if artifact is None:
        return {
            "reference_readiness_summary": None,
            "reference_readiness_checks": [],
            "compatibility": {
                "source_path": str(manifest_path),
                "artifact_path": None,
                "artifact_missing": True,
                "checks_read": 0,
                "notes": ["run manifest did not declare reference readiness artifact path"],
            },
        }

    artifact_path, artifact_key = artifact
    if not artifact_path.exists():
        return {
            "reference_readiness_summary": None,
            "reference_readiness_checks": [],
            "compatibility": {
                "source_path": str(manifest_path),
                "artifact_path": str(artifact_path),
                "artifact_key": artifact_key,
                "artifact_missing": True,
                "checks_read": 0,
                "notes": [f"reference readiness artifact missing at {artifact_path}"],
            },
        }

    try:
        readiness_payload = _load_payload(artifact_path)
    except ReferenceReadinessAdapterError:
        notes.append(f"reference readiness artifact was not parseable at {artifact_path}")
        return {
            "reference_readiness_summary": None,
            "reference_readiness_checks": [],
            "compatibility": {
                "source_path": str(manifest_path),
                "artifact_path": str(artifact_path),
                "artifact_missing": False,
                "checks_read": 0,
                "notes": notes,
            },
        }

    if "schema_version" in readiness_payload:
        readiness_schema = _to_str(readiness_payload["schema_version"])
        if readiness_schema is None:
            notes.append("reference readiness schema_version was missing or invalid")
    else:
        readiness_schema = None
        notes.append("reference readiness schema_version was missing")

    checks_rows = []
    skipped_checks: list[str] = []
    raw_checks = readiness_payload.get("checks")
    if not isinstance(raw_checks, list):
        notes.append("reference readiness checks was missing or malformed")
    else:
        for index, item in enumerate(raw_checks):
            check = _adapt_check(item, index, skipped_checks)
            if check is not None:
                checks_rows.append(check)

    if skipped_checks:
        notes.extend(skipped_checks)
        notes.append(f"skipped {len(skipped_checks)} readiness checks while adapting")

    status_counts = _readiness_check_status_counts(checks_rows)
    counts_payload = readiness_payload.get("counts")
    if not isinstance(counts_payload, dict):
        counts_payload = {}
        notes.append("readiness counts block was missing or malformed")

    artifacts_payload = readiness_payload.get("artifacts")
    support_file, support_sha = _artifact_meta(
        artifacts_payload.get("support_manifest") if isinstance(artifacts_payload, dict) else None
    )
    summary_file, summary_sha = _artifact_meta(
        artifacts_payload.get("summary") if isinstance(artifacts_payload, dict) else None
    )

    candidate_set_ids = _string_list(readiness_payload.get("candidate_set_ids"))
    candidate_set_fingerprints = _string_list(readiness_payload.get("candidate_set_fingerprints"))

    documented_shortfalls = readiness_payload.get("documented_shortfalls")
    documented_shortfall_count = _to_int(counts_payload.get("documented_shortfall_count"))
    if isinstance(documented_shortfalls, list):
        documented_shortfall_count = len(documented_shortfalls)

    check_ids = []
    raw_checks_for_ids = raw_checks if isinstance(raw_checks, list) else []
    for index, check in enumerate(raw_checks_for_ids):
        if isinstance(check, dict):
            check_ids.append(_to_str(check.get("check_id")) or f"readiness_check_{index}")
        else:
            check_ids.append(f"readiness_check_{index}")

    summary: ReferenceReadinessSummaryContract = {
        "schema_version": "reference_readiness_summary:v1",
        "biominer_commit": biominer_commit,
        "run_id": _to_str(run_payload.get("run_id")) or "unknown-run",
        "source_manifest_path": str(manifest_path),
        "readiness_artifact_path": str(artifact_path),
        "status": _normalize_status(readiness_payload.get("status")),
        "permits_vision": _to_bool(readiness_payload.get("permits_vision")),
        "target_accepted_taxon_key": _to_str(
            readiness_payload.get("target_accepted_taxon_key")
        ),
        "registry_version": _to_str(readiness_payload.get("registry_version")),
        "reference_bank_version": _to_str(readiness_payload.get("reference_bank_version")),
        "policy_version": _to_str(readiness_payload.get("policy_version")),
        "policy_fingerprint": _to_str(readiness_payload.get("policy_fingerprint")),
        "readiness_artifact_schema_version": readiness_schema,
        "created_at": _to_str(readiness_payload.get("created_at")),
        "git_sha": _to_str(readiness_payload.get("git_sha")),
        "checks_total": len(checks_rows),
        "checks_passed": status_counts["passed"],
        "checks_warning": status_counts["warning"],
        "checks_failed": status_counts["failed"],
        "checks_pending": status_counts["pending"],
        "documented_shortfall_count": documented_shortfall_count,
        "candidate_set_count": len(candidate_set_ids),
        "candidate_set_fingerprint_count": len(candidate_set_fingerprints),
        "support_manifest_rows": _to_int(counts_payload.get("support_manifest_rows")),
        "eligible_support_rows": _to_int(counts_payload.get("eligible_support_rows")),
        "pending_review_count": _to_int(counts_payload.get("pending_review_count")),
        "pending_target_review_count": _to_int(
            counts_payload.get("pending_target_review_count")
        ),
        "unresolved_duplicate_count": _to_int(
            counts_payload.get("unresolved_duplicate_count")
        ),
        "licence_blocker_count": _to_int(counts_payload.get("licence_blocker_count")),
        "attribution_blocker_count": _to_int(
            counts_payload.get("attribution_blocker_count")
        ),
        "unverified_support_count": _to_int(counts_payload.get("unverified_support_count")),
        "route_separation_conflict_count": _to_int(
            counts_payload.get("route_separation_conflict_count")
        ),
        "split_leakage_count": _to_int(counts_payload.get("split_leakage_count")),
        "structural_issue_count": _to_int(counts_payload.get("structural_issue_count")),
        "model_input_fingerprint": _to_str(readiness_payload.get("model_input_fingerprint")),
        "support_manifest_file": support_file,
        "support_manifest_sha256": support_sha,
        "summary_file": summary_file,
        "summary_sha256": summary_sha,
        "candidate_set_ids": candidate_set_ids,
        "check_ids": check_ids,
    }

    if not candidate_set_ids:
        notes.append("reference readiness payload had no candidate_set_ids")

    if not checks_rows:
        notes.append("reference readiness checks were empty")

    compatibility_notes = [*notes]

    return {
        "reference_readiness_summary": summary,
        "reference_readiness_checks": checks_rows,
        "compatibility": {
            "source_path": str(manifest_path),
            "artifact_path": str(artifact_path),
            "artifact_key": artifact_key,
            "artifact_missing": False,
            "checks_read": len(checks_rows),
            "skipped_checks": skipped_checks,
            "notes": compatibility_notes,
            "readiness_schema_version": readiness_schema,
        },
    }
