"""Build TaxaLens candidate-set summary records from BioMiner score artifacts."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, TypedDict

from packages.replay.src.validation import is_full_git_sha


class CandidateSetSummaryAdapterError(ValueError):
    """Raised when candidate-set summary artifacts cannot be adapted."""


class CandidateSetSummaryContract(TypedDict):
    schema_version: str
    biominer_commit: str | None
    run_id: str
    media_id: str
    target_taxon_key: str | None
    target_taxon_name: str | None
    total_candidates: int | None
    eligible_candidates: int | None
    candidate_names: list[str] | None
    candidate_version: int | None
    source_artifact: str | None


def _load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise CandidateSetSummaryAdapterError(f"File not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise CandidateSetSummaryAdapterError(f"Not valid JSON: {path}") from exc


def _load_manifest(path: Path) -> dict[str, Any]:
    payload = _load_json(path)
    if not isinstance(payload, dict):
        raise CandidateSetSummaryAdapterError("Run manifest payload must be a JSON object")
    return payload


def _first_str(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _to_int(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _artifact_path(payload: dict[str, Any], manifest_path: Path) -> Path | None:
    outputs = payload.get("outputs")
    if not isinstance(outputs, dict):
        return None
    for key in ("target_aware_candidate_scores", "candidate_scores", "target_scores"):
        value = outputs.get(key)
        if not isinstance(value, str):
            continue
        raw = value.strip()
        if not raw:
            continue
        path = Path(raw)
        if path.is_absolute():
            return path
        return (manifest_path.parent / path).resolve()
    return None


def _extract_rows(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        raw_rows = payload
    elif isinstance(payload, dict):
        raw_rows = (
            payload.get("rows")
            or payload.get("candidates")
            or payload.get("data")
            or []
        )
        if not isinstance(raw_rows, list):
            return []
    else:
        return []
    return [row for row in raw_rows if isinstance(row, dict)]


def _collect_candidate_keys_and_names(
    rows: list[dict[str, Any]]
) -> list[tuple[str, int, str]]:
    keyed = {}
    for row in rows:
        candidate_key = _first_str(row.get("accepted_taxon_key"))
        if candidate_key is None:
            continue
        if candidate_key in keyed:
            continue
        name = _first_str(row.get("scientific_name")) or _first_str(
            row.get("candidate_name")
        )
        name = name or candidate_key
        priority = _to_int(row.get("candidate_priority")) or 0
        keyed[candidate_key] = (priority, name)
    return sorted(
        [(candidate_key, priority, name) for candidate_key, (priority, name) in keyed.items()],
        key=lambda item: (item[1], item[0]),
    )


def _find_target_identity(rows: list[dict[str, Any]], manifest_payload: dict[str, Any]) -> tuple[str | None, str | None]:
    for row in rows:
        if row.get("target_candidate") is True:
            key = _first_str(row.get("accepted_taxon_key"))
            name = _first_str(row.get("scientific_name")) or _first_str(row.get("candidate_name"))
            return key, name

    taxon_scope = manifest_payload.get("taxon_scope", {})
    if not isinstance(taxon_scope, dict):
        return None, None
    return (
        _first_str(taxon_scope.get("accepted_taxon_key")),
        _first_str(taxon_scope.get("accepted_scientific_name")),
    )


def adapt_candidate_set_summaries(
    *,
    manifest_path: str | Path,
    biominer_commit: str,
) -> dict[str, Any]:
    if not is_full_git_sha(biominer_commit):
        raise CandidateSetSummaryAdapterError(
            "biominer_commit must be a full 40-character hexadecimal SHA"
        )

    manifest_path = Path(manifest_path)
    manifest_payload = _load_manifest(manifest_path)
    run_id = _first_str(manifest_payload.get("run_id")) or "unknown-run"

    score_path = _artifact_path(manifest_payload, manifest_path)
    notes: list[str] = []
    if score_path is None:
        return {
            "candidate_set_summaries": [],
            "compatibility": {
                "source_path": str(manifest_path),
                "source_artifact": None,
                "summary_rows_read": 0,
                "notes": ["run manifest did not provide a candidate score artifact"],
            },
        }

    if not score_path.exists():
        return {
            "candidate_set_summaries": [],
            "compatibility": {
                "source_path": str(manifest_path),
                "source_artifact": str(score_path),
                "summary_rows_read": 0,
                "notes": ["candidate score artifact was not present"],
            },
        }

    payload = _load_json(score_path)
    rows = _extract_rows(payload)
    if not rows:
        notes.append("candidate score artifact was empty")

    grouped: dict[str, list[dict[str, Any]]] = {}
    for index, row in enumerate(rows):
        if not isinstance(row, dict):
            notes.append(f"non_mapping_row_{index}")
            continue
        media_id = (
            _first_str(row.get("flickr_photo_id"))
            or _first_str(row.get("source_record_hash"))
            or _first_str(row.get("media_id"))
        )
        if media_id is None:
            notes.append(f"missing_media_id_row_{index}")
            continue
        grouped.setdefault(media_id, []).append(row)

    summaries: list[CandidateSetSummaryContract] = []
    for media_id, media_rows in sorted(grouped.items(), key=lambda item: item[0]):
        candidate_items = _collect_candidate_keys_and_names(media_rows)
        candidate_names = [name for _, _, name in candidate_items]
        target_taxon_key, target_taxon_name = _find_target_identity(media_rows, manifest_payload)
        summaries.append(
            CandidateSetSummaryContract(
                schema_version="candidate_set_summary:v1",
                biominer_commit=biominer_commit,
                run_id=run_id,
                media_id=media_id,
                target_taxon_key=target_taxon_key,
                target_taxon_name=target_taxon_name,
                total_candidates=len(candidate_items),
                eligible_candidates=len(candidate_items),
                candidate_names=candidate_names,
                candidate_version=1,
                source_artifact=str(score_path),
            )
        )

    if not summaries:
        notes.append("no valid candidate-set summaries were produced")

    return {
        "candidate_set_summaries": summaries,
        "compatibility": {
            "source_path": str(manifest_path),
            "source_artifact": str(score_path),
            "summary_rows_read": len(rows),
            "notes": notes,
        },
    }
