"""Adapt BioMiner target-aware candidate-score artifacts into TaxaLens contracts."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, TypedDict

from packages.replay.src.validation import is_full_git_sha


class TargetAwareScoresAdapterError(ValueError):
    """Raised when target-aware scoring artifacts cannot be adapted."""


class CandidateScoreContract(TypedDict):
    schema_version: str
    biominer_commit: str | None
    media_id: str | None
    candidate_set_id: str | None
    candidate_taxon_key: str | None
    candidate_name: str | None
    raw_similarity: float | None
    calibrated_score: float | None
    calibrated_label: str | None
    competitor_margin: float | None
    threshold_version: str | None
    threshold_value: float | None
    score_artifact_uri: str | None


def _load_manifest(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise TargetAwareScoresAdapterError(f"Run manifest not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise TargetAwareScoresAdapterError(
            f"Run manifest is not valid JSON: {path}"
        ) from exc

    if not isinstance(payload, dict):
        raise TargetAwareScoresAdapterError("Run manifest payload must be a JSON object")
    return payload


def _load_payload(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise TargetAwareScoresAdapterError(f"Candidate score artifact not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise TargetAwareScoresAdapterError(
            f"Candidate score artifact is not valid JSON: {path}"
        ) from exc


def _first_str(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _to_float(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


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


def _pick_float(value_map: dict[str, Any], *keys: str) -> float | None:
    for key in keys:
        value = _to_float(value_map.get(key))
        if value is not None:
            return value
    return None


def _pick_str(value_map: dict[str, Any], *keys: str) -> str | None:
    for key in keys:
        value = _first_str(value_map.get(key))
        if value is not None:
            return value
    return None


def _artifact_path(payload: dict[str, Any], manifest_path: Path) -> Path | None:
    outputs = payload.get("outputs")
    if not isinstance(outputs, dict):
        return None
    path_value: str | None = None
    for key in ("target_aware_candidate_scores", "candidate_scores", "target_scores"):
        raw = outputs.get(key)
        if not isinstance(raw, str):
            continue
        stripped = raw.strip()
        if not stripped:
            continue
        path_value = stripped
        break
    if path_value is None:
        return None
    path = Path(path_value)
    if path.is_absolute():
        return path
    return (manifest_path.parent / path).resolve()


def _extract_rows(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        candidate_rows = payload
    elif isinstance(payload, dict):
        candidate_rows = (
            payload.get("rows")
            or payload.get("candidates")
            or payload.get("data")
            or []
        )
        if not isinstance(candidate_rows, list):
            return []
    else:
        return []
    if not isinstance(candidate_rows, list):
        return []
    return [row for row in candidate_rows if isinstance(row, dict)]


def _map_label(row: dict[str, Any]) -> str | None:
    decision = _first_str(
        row.get("decision")
        or row.get("classification_decision")
        or row.get("decision_code")
    )
    if decision:
        normalized = decision.strip().lower()
        if normalized == "target_confirmed":
            return "target_confirmed"
        if normalized in {"target_probable_review", "target_probable"}:
            return "target_probable"
        if normalized == "abstain":
            return "abstain"
        if normalized in {
            "known_regional_competitor",
            "known_nonregional_competitor",
            "known_competitor",
        }:
            return "competitor"
        if normalized in {"negative", "other_butterfly", "non_butterfly_insect"}:
            return "negative"
        if normalized in {"other_insect"}:
            return "negative"
        return "other"
    if _to_bool(row.get("target_candidate")) is True:
        return "target_probable"
    if _to_bool(row.get("abstained")) is True:
        return "abstain"
    if row.get("target_accepted_taxon_key") and row.get("accepted_taxon_key"):
        target_key = _first_str(row["target_accepted_taxon_key"])
        candidate_key = _first_str(row["accepted_taxon_key"])
        if target_key is not None and candidate_key is not None and candidate_key != target_key:
            return "competitor"
    return "other"


def adapt_target_aware_candidate_scores(
    *,
    manifest_path: str | Path,
    biominer_commit: str,
) -> dict[str, Any]:
    if not is_full_git_sha(biominer_commit):
        raise TargetAwareScoresAdapterError(
            "biominer_commit must be a full 40-character hexadecimal SHA"
        )

    path = Path(manifest_path)
    manifest_payload = _load_manifest(path)
    if "schema_version" in manifest_payload and manifest_payload["schema_version"] not in (1, "1"):
        raise TargetAwareScoresAdapterError("Unsupported run manifest schema version")

    score_artifact = _artifact_path(manifest_payload, path)
    notes: list[str] = []
    skipped_rows: list[str] = []

    if score_artifact is None:
        return {
            "candidate_scores": [],
            "compatibility": {
                "source_path": str(path),
                "artifact_path": None,
                "artifact_missing": True,
                "rows_read": 0,
                "skipped_rows": skipped_rows,
                "notes": ["run manifest did not declare target-aware candidate score artifact path"],
            },
        }

    if not score_artifact.exists():
        return {
            "candidate_scores": [],
            "compatibility": {
                "source_path": str(path),
                "artifact_path": str(score_artifact),
                "artifact_missing": True,
                "rows_read": 0,
                "skipped_rows": skipped_rows,
                "notes": [f"target-aware candidate score artifact was not present at {score_artifact}"],
            },
        }

    try:
        score_payload = _load_payload(score_artifact)
    except TargetAwareScoresAdapterError:
        notes.append(f"candidate score artifact was not parseable at {score_artifact}")
        return {
            "candidate_scores": [],
            "compatibility": {
                "source_path": str(path),
                "artifact_path": str(score_artifact),
                "artifact_missing": False,
                "rows_read": 0,
                "skipped_rows": skipped_rows,
                "notes": notes,
            },
        }

    rows = _extract_rows(score_payload)
    if not rows:
        notes.append("candidate score artifact was empty or had no rows")

    candidate_scores: list[CandidateScoreContract] = []
    for index, row in enumerate(rows):
        if not isinstance(row, dict):
            skipped_rows.append(f"non_mapping_row_{index}")
            continue

        candidate_set_id = _first_str(row.get("candidate_set_id"))
        candidate_taxon_key = _first_str(row.get("accepted_taxon_key"))
        if candidate_set_id is None and candidate_taxon_key is None:
            skipped_rows.append(f"missing_candidate_identity_{index}")
            continue

        candidate_scores.append(
            CandidateScoreContract(
                schema_version="candidate_score:v1",
                biominer_commit=biominer_commit,
                media_id=_pick_str(row, "flickr_photo_id", "source_record_hash", "media_id"),
                candidate_set_id=candidate_set_id,
                candidate_taxon_key=candidate_taxon_key,
                candidate_name=_pick_str(
                    row,
                    "scientific_name",
                    "candidate_name",
                ),
                raw_similarity=_pick_float(
                    row,
                    "text_ensemble_similarity",
                    "reference_centroid_similarity",
                    "nearest_reference_similarity",
                    "best_competitor_reference_similarity",
                    "regional_classifier_decision_score",
                ),
                calibrated_score=_pick_float(
                    row,
                    "calibrated_probability",
                    "regional_calibrated_probability",
                    "calibrated_non_target_probability",
                    "target_competitor_margin",
                ),
                calibrated_label=_map_label(row),
                competitor_margin=_pick_float(row, "competitor_margin", "target_competitor_margin"),
                threshold_version=_pick_str(
                    row,
                    "calibration_version",
                    "classifier_version",
                    "calibration_id",
                ),
                threshold_value=_pick_float(row, "competitor_margin_threshold"),
                score_artifact_uri=str(score_artifact),
            )
        )

    if skipped_rows:
        notes.append(
            f"skipped {len(skipped_rows)} candidate-score rows while adapting"
        )

    return {
        "candidate_scores": candidate_scores,
        "compatibility": {
            "source_path": str(path),
            "artifact_path": str(score_artifact),
            "artifact_missing": False,
            "rows_read": len(rows),
            "skipped_rows": skipped_rows,
            "notes": notes,
        },
    }
