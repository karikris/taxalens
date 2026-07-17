"""Fail-closed occurrence-release decision contracts for geographic evidence."""

from __future__ import annotations

import json
from collections.abc import Mapping, Set
from datetime import date
from pathlib import Path
from typing import Any

import polars as pl

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_RELEASE_DECISIONS = (
    REPOSITORY_ROOT / "demo/source/verification/occurrence_release_decisions.json"
)
DEFAULT_QUALITY_SNAPSHOTS = (
    REPOSITORY_ROOT / "demo/repository_storage/supabase/verification_quality_snapshots.json"
)
RELEASE_DECISION_SCHEMA_VERSION = "taxalens-occurrence-release-decisions:v1.0.0"
RELEASE_POLICY_VERSION = "occurrence-release-policy:v1.0.0"
QUALITY_TABLE_SCHEMA_VERSION = "taxalens-repository-supabase-table:v1.0.0"

_RELEASE_GATES = (
    "decisive_positive_consensus",
    "coordinates_valid",
    "duplicate_gate_passed",
    "quality_gate_passed",
    "provenance_complete",
)


class OccurrenceReleaseError(ValueError):
    """Raised when release readiness is missing evidence or gates."""


def occurrence_release_schema() -> dict[str, pl.DataType]:
    return {
        "release_decision_id": pl.String,
        "release_policy_version": pl.String,
        "project_id": pl.String,
        "run_id": pl.String,
        "accepted_taxon_key": pl.String,
        "baseline_snapshot_id": pl.String,
        "flickr_snapshot_id": pl.String,
        "verification_campaign_id": pl.String,
        "verification_item_id": pl.String,
        "flickr_photo_id": pl.String,
        "quality_snapshot_id": pl.String,
        "decision_status": pl.String,
        "decisive_positive_consensus": pl.Boolean,
        "coordinates_valid": pl.Boolean,
        "duplicate_gate_passed": pl.Boolean,
        "quality_gate_passed": pl.Boolean,
        "provenance_complete": pl.Boolean,
        "event_date": pl.Date,
    }


def load_occurrence_release_decisions(
    path: str | Path = DEFAULT_RELEASE_DECISIONS,
) -> pl.DataFrame:
    payload = _load_object(path, "occurrence-release decisions")
    if payload.get("schema_version") != RELEASE_DECISION_SCHEMA_VERSION:
        raise OccurrenceReleaseError("occurrence-release decision schema differs")
    if payload.get("release_policy_version") != RELEASE_POLICY_VERSION:
        raise OccurrenceReleaseError("occurrence-release policy differs")
    if payload.get("scientific_claim_allowed") is not False:
        raise OccurrenceReleaseError("release decision container claim gate differs")
    raw_rows = payload.get("rows")
    if not isinstance(raw_rows, list):
        raise OccurrenceReleaseError("occurrence-release rows must be an array")
    rows = [_release_row(raw, index) for index, raw in enumerate(raw_rows)]
    frame = pl.DataFrame(rows, schema=occurrence_release_schema())
    _validate_unique_decisions(frame)
    return frame


def load_quality_snapshot_ids(
    path: str | Path = DEFAULT_QUALITY_SNAPSHOTS,
) -> frozenset[str]:
    payload = _load_object(path, "verification quality snapshots")
    if payload.get("schema_version") != QUALITY_TABLE_SCHEMA_VERSION:
        raise OccurrenceReleaseError("quality snapshot table schema differs")
    rows = payload.get("rows")
    if not isinstance(rows, list):
        raise OccurrenceReleaseError("quality snapshot rows must be an array")
    result: set[str] = set()
    for index, raw in enumerate(rows):
        if not isinstance(raw, dict):
            raise OccurrenceReleaseError(f"quality snapshot row {index} differs")
        nested = raw.get("quality_snapshot_payload")
        payload_row = nested if isinstance(nested, dict) else raw
        snapshot_id = payload_row.get("qualitySnapshotId") or payload_row.get("quality_snapshot_id")
        value = _required_text(snapshot_id, f"quality snapshot row {index} ID")
        if value in result:
            raise OccurrenceReleaseError("quality snapshot identity is duplicated")
        result.add(value)
    return frozenset(result)


def validate_occurrence_release_decisions(
    decisions: pl.DataFrame,
    *,
    quality_snapshot_ids: Set[str],
    expected_scope: Mapping[str, str],
) -> None:
    if dict(decisions.schema) != occurrence_release_schema():
        raise OccurrenceReleaseError("occurrence-release physical schema differs")
    _validate_unique_decisions(decisions)
    for name in (
        "project_id",
        "run_id",
        "accepted_taxon_key",
        "baseline_snapshot_id",
        "flickr_snapshot_id",
    ):
        expected = _required_text(expected_scope.get(name), f"expected {name}")
        if decisions.filter(pl.col(name) != expected).height:
            raise OccurrenceReleaseError(f"release decision {name} differs")
    unknown_status = set(decisions.get_column("decision_status").unique().to_list()) - {
        "blocked",
        "release_ready",
    }
    if unknown_status:
        raise OccurrenceReleaseError("release decision status is unsupported")
    ready = decisions.filter(pl.col("decision_status") == "release_ready")
    for gate in _RELEASE_GATES:
        if ready.filter(~pl.col(gate)).height:
            raise OccurrenceReleaseError(f"release-ready decision failed {gate}")
    missing_quality = set(ready.get_column("quality_snapshot_id").to_list()) - set(
        quality_snapshot_ids
    )
    if missing_quality:
        raise OccurrenceReleaseError("release-ready decision quality snapshot is unavailable")
    if ready.get_column("event_date").null_count():
        raise OccurrenceReleaseError("release-ready decision event date is unavailable")


def _release_row(raw: object, index: int) -> dict[str, object]:
    if not isinstance(raw, dict):
        raise OccurrenceReleaseError(f"release row {index} must be an object")
    row: dict[str, object] = {}
    for name in occurrence_release_schema():
        value = raw.get(name)
        if name == "event_date":
            if value is None:
                row[name] = None
            elif isinstance(value, str):
                try:
                    row[name] = date.fromisoformat(value)
                except ValueError as error:
                    raise OccurrenceReleaseError(
                        f"release row {index} event date differs"
                    ) from error
            else:
                raise OccurrenceReleaseError(f"release row {index} event date differs")
        elif name in _RELEASE_GATES:
            if not isinstance(value, bool):
                raise OccurrenceReleaseError(f"release row {index} {name} differs")
            row[name] = value
        else:
            row[name] = _required_text(value, f"release row {index} {name}")
    return row


def _validate_unique_decisions(frame: pl.DataFrame) -> None:
    for column in ("release_decision_id", "flickr_photo_id"):
        if frame.get_column(column).n_unique() != frame.height:
            raise OccurrenceReleaseError(f"{column} is duplicated")


def _load_object(path: str | Path, label: str) -> dict[str, Any]:
    try:
        payload = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise OccurrenceReleaseError(f"{label} is unreadable") from error
    if not isinstance(payload, dict):
        raise OccurrenceReleaseError(f"{label} must be an object")
    return payload


def _required_text(value: object, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise OccurrenceReleaseError(f"{label} must be non-empty")
    return value


__all__ = [
    "DEFAULT_QUALITY_SNAPSHOTS",
    "DEFAULT_RELEASE_DECISIONS",
    "QUALITY_TABLE_SCHEMA_VERSION",
    "RELEASE_DECISION_SCHEMA_VERSION",
    "RELEASE_POLICY_VERSION",
    "OccurrenceReleaseError",
    "load_occurrence_release_decisions",
    "load_quality_snapshot_ids",
    "occurrence_release_schema",
    "validate_occurrence_release_decisions",
]
