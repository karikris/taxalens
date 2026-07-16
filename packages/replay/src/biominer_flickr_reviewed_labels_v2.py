"""Typed BioMiner reviewed-labels-v2 handoff for Flickr verification."""

from __future__ import annotations

import hashlib
import json
import math
import re
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

import polars as pl

BIOMINER_REVIEWED_LABEL_SCHEMA_VERSION = "reviewed-labels-v2"
FLICKR_REVIEWED_LABELS_V2_FILE = "flickr_reviewed_labels_v2.parquet"

_SHA256 = re.compile(r"[0-9a-f]{64}\Z")
_GIT_SHA = re.compile(r"[0-9a-f]{40}\Z")
_SORT_FIELDS = [
    "flickr_photo_id",
    "detection_id",
    "reviewer_id",
    "reviewed_at",
]
_CORE_SCHEMA: dict[str, pl.DataType] = {
    "schema_version": pl.String,
    "source": pl.String,
    "flickr_photo_id": pl.String,
    "detection_id": pl.String,
    "crop_hash": pl.String,
    "label_level": pl.String,
    "is_butterfly": pl.Boolean,
    "accepted_taxon_key": pl.String,
    "scientific_name": pl.String,
    "family_key": pl.String,
    "family": pl.String,
    "genus_key": pl.String,
    "genus": pl.String,
    "label_source": pl.String,
    "reviewer_id": pl.String,
    "reviewed_at": pl.String,
    "review_confidence": pl.String,
    "review_notes": pl.String,
    "target_present": pl.Boolean,
    "label_certainty": pl.String,
    "life_stage": pl.String,
    "visual_domain": pl.String,
    "view": pl.String,
    "route": pl.String,
    "geo_cluster_id": pl.String,
    "source_query_tier": pl.String,
    "source_query_term": pl.String,
    "duplicate_group_id": pl.String,
    "observer_owner_group_id": pl.String,
    "dataset_split": pl.String,
    "second_review_status": pl.String,
    "ambiguity_reason": pl.String,
    "unsuitable_for_species_identification": pl.Boolean,
}
_PROVENANCE_SCHEMA: dict[str, pl.DataType] = {
    "taxalens_campaign_id": pl.String,
    "taxalens_campaign_manifest_sha256": pl.String,
    "taxalens_question_sha256": pl.String,
    "taxalens_taxalens_sha": pl.String,
    "taxalens_biominer_sha": pl.String,
    "taxalens_sampling_plan_id": pl.String,
    "taxalens_sampling_purpose": pl.String,
    "taxalens_sampling_design": pl.String,
    "taxalens_sampling_plan_json": pl.String,
    "taxalens_sampling_plan_sha256": pl.String,
    "taxalens_inclusion_probability": pl.Float64,
    "taxalens_sampling_weight": pl.Float64,
    "taxalens_decision_ledger_sha256": pl.String,
    "taxalens_effective_event_ids": pl.List(pl.String),
    "taxalens_reviewer_group_ids": pl.List(pl.String),
    "taxalens_blind_review": pl.Boolean,
    "taxalens_quality_estimation_allowed": pl.Boolean,
    "taxalens_scientific_claim_allowed": pl.Boolean,
}
_CAMPAIGN_BINDINGS = (
    "taxalens_campaign_id",
    "taxalens_campaign_manifest_sha256",
    "taxalens_taxalens_sha",
    "taxalens_biominer_sha",
    "taxalens_sampling_plan_id",
    "taxalens_sampling_purpose",
    "taxalens_sampling_design",
    "taxalens_sampling_plan_json",
    "taxalens_sampling_plan_sha256",
    "taxalens_decision_ledger_sha256",
    "taxalens_blind_review",
    "taxalens_quality_estimation_allowed",
    "taxalens_scientific_claim_allowed",
)


class FlickrReviewedLabelsV2Error(ValueError):
    """Raised when a Flickr reviewed-label export is unsafe or incompatible."""


def flickr_reviewed_labels_v2_schema() -> dict[str, pl.DataType]:
    """Return the exact BioMiner core followed by TaxaLens provenance fields."""
    return {**_CORE_SCHEMA, **_PROVENANCE_SCHEMA}


def build_flickr_reviewed_labels_v2(
    rows: Sequence[Mapping[str, Any]],
) -> pl.DataFrame:
    """Build a deterministically ordered, physically typed export frame."""
    if not rows:
        raise FlickrReviewedLabelsV2Error(
            "reviewed-label export has no scientific decision rows"
        )
    expected_fields = set(flickr_reviewed_labels_v2_schema())
    canonical_rows: list[dict[str, Any]] = []
    for index, row in enumerate(rows):
        actual_fields = set(row)
        if actual_fields != expected_fields:
            raise FlickrReviewedLabelsV2Error(
                "reviewed-label row fields differ: "
                f"row={index}; missing={sorted(expected_fields - actual_fields)}; "
                f"unknown={sorted(actual_fields - expected_fields)}"
            )
        canonical_rows.append(dict(row))
    frame = pl.DataFrame(
        canonical_rows,
        schema=flickr_reviewed_labels_v2_schema(),
        orient="row",
    ).sort(_SORT_FIELDS)
    validate_flickr_reviewed_labels_v2(frame)
    return frame


def validate_flickr_reviewed_labels_v2(frame: pl.DataFrame) -> None:
    """Validate physical schema, bindings, sampling weights, and leakage groups."""
    if not isinstance(frame, pl.DataFrame):
        raise TypeError("reviewed labels must be a Polars DataFrame")
    expected_schema = flickr_reviewed_labels_v2_schema()
    if dict(frame.schema) != expected_schema or frame.columns != list(expected_schema):
        missing = sorted(set(expected_schema) - set(frame.columns))
        unknown = sorted(set(frame.columns) - set(expected_schema))
        raise FlickrReviewedLabelsV2Error(
            "reviewed-label physical schema differs: "
            f"missing={missing}; unknown={unknown}"
        )
    if frame.is_empty():
        raise FlickrReviewedLabelsV2Error(
            "reviewed-label export has no scientific decision rows"
        )
    if frame.to_dicts() != frame.sort(_SORT_FIELDS).to_dicts():
        raise FlickrReviewedLabelsV2Error(
            "reviewed-label rows are not deterministically sorted"
        )

    rows = frame.to_dicts()
    _validate_campaign_bindings(rows)
    duplicate_bindings: dict[str, tuple[str, str]] = {}
    owner_splits: dict[str, str] = {}
    photo_ids: set[str] = set()
    for row in rows:
        _validate_row_provenance(row)
        photo_id = _required_text(row["flickr_photo_id"], "flickr_photo_id")
        if photo_id in photo_ids:
            raise FlickrReviewedLabelsV2Error(
                f"Flickr photo is repeated in reviewed labels: {photo_id}"
            )
        photo_ids.add(photo_id)
        duplicate_group = _required_text(
            row["duplicate_group_id"], "duplicate_group_id"
        )
        owner_group = _required_text(
            row["observer_owner_group_id"], "observer_owner_group_id"
        )
        dataset_split = _required_text(row["dataset_split"], "dataset_split")
        binding = (owner_group, dataset_split)
        previous_duplicate = duplicate_bindings.get(duplicate_group)
        if previous_duplicate is not None and previous_duplicate != binding:
            raise FlickrReviewedLabelsV2Error(
                "reviewed-label duplicate group crosses owner or dataset split"
            )
        duplicate_bindings[duplicate_group] = binding
        previous_split = owner_splits.get(owner_group)
        if previous_split is not None and previous_split != dataset_split:
            raise FlickrReviewedLabelsV2Error(
                "reviewed-label owner group crosses dataset splits"
            )
        owner_splits[owner_group] = dataset_split


def write_flickr_reviewed_labels_v2(
    *,
    rows: Sequence[Mapping[str, Any]],
    output_path: str | Path,
) -> pl.DataFrame:
    """Write a deterministic Zstandard-compressed Parquet handoff."""
    path = Path(output_path)
    if path.name != FLICKR_REVIEWED_LABELS_V2_FILE:
        raise FlickrReviewedLabelsV2Error(
            f"reviewed-label filename must be {FLICKR_REVIEWED_LABELS_V2_FILE}"
        )
    frame = build_flickr_reviewed_labels_v2(rows)
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.write_parquet(
        path,
        compression="zstd",
        compression_level=9,
        statistics=True,
    )
    return frame


def _validate_campaign_bindings(rows: list[dict[str, Any]]) -> None:
    for field in _CAMPAIGN_BINDINGS:
        values = {_hashable(row[field]) for row in rows}
        if len(values) != 1:
            raise FlickrReviewedLabelsV2Error(
                f"reviewed-label rows do not share one {field}"
            )


def _validate_row_provenance(row: Mapping[str, Any]) -> None:
    if (
        row["schema_version"] != BIOMINER_REVIEWED_LABEL_SCHEMA_VERSION
        or row["source"] != "flickr"
    ):
        raise FlickrReviewedLabelsV2Error(
            "reviewed-label source or schema version is unsupported"
        )
    for field in (
        "taxalens_campaign_manifest_sha256",
        "taxalens_question_sha256",
        "taxalens_sampling_plan_sha256",
        "taxalens_decision_ledger_sha256",
    ):
        value = _required_text(row[field], field)
        if _SHA256.fullmatch(value) is None:
            raise FlickrReviewedLabelsV2Error(f"{field} must be a SHA-256 digest")
    for field in ("taxalens_taxalens_sha", "taxalens_biominer_sha"):
        value = _required_text(row[field], field)
        if _GIT_SHA.fullmatch(value) is None:
            raise FlickrReviewedLabelsV2Error(f"{field} must be a full Git SHA")

    sampling_json = _required_text(
        row["taxalens_sampling_plan_json"],
        "taxalens_sampling_plan_json",
    )
    sampling_sha = hashlib.sha256(sampling_json.encode()).hexdigest()
    if sampling_sha != row["taxalens_sampling_plan_sha256"]:
        raise FlickrReviewedLabelsV2Error(
            "sampling plan JSON does not match its SHA-256"
        )
    try:
        sampling_plan = json.loads(sampling_json)
    except json.JSONDecodeError as error:
        raise FlickrReviewedLabelsV2Error(
            "sampling plan JSON is invalid"
        ) from error
    if not isinstance(sampling_plan, dict):
        raise FlickrReviewedLabelsV2Error("sampling plan JSON must be an object")
    expected_plan_fields = {
        "planId": row["taxalens_sampling_plan_id"],
        "purpose": row["taxalens_sampling_purpose"],
        "design": row["taxalens_sampling_design"],
        "blindReview": row["taxalens_blind_review"],
    }
    for field, expected in expected_plan_fields.items():
        if sampling_plan.get(field) != expected:
            raise FlickrReviewedLabelsV2Error(
                f"sampling plan JSON conflicts with {field}"
            )

    event_ids = _string_list(
        row["taxalens_effective_event_ids"],
        "taxalens_effective_event_ids",
    )
    reviewer_ids = _string_list(
        row["taxalens_reviewer_group_ids"],
        "taxalens_reviewer_group_ids",
    )
    if not event_ids or not reviewer_ids:
        raise FlickrReviewedLabelsV2Error(
            "reviewed labels require effective events and reviewer groups"
        )
    if event_ids != sorted(set(event_ids)) or reviewer_ids != sorted(
        set(reviewer_ids)
    ):
        raise FlickrReviewedLabelsV2Error(
            "effective events and reviewer groups must be sorted and unique"
        )

    purpose = _required_text(
        row["taxalens_sampling_purpose"],
        "taxalens_sampling_purpose",
    )
    probability = row["taxalens_inclusion_probability"]
    weight = row["taxalens_sampling_weight"]
    quality_allowed = row["taxalens_quality_estimation_allowed"]
    probability_required = sampling_plan.get("inclusionProbabilityRequired")
    if purpose == "failure_discovery":
        if probability is not None or weight is not None or quality_allowed:
            raise FlickrReviewedLabelsV2Error(
                "failure-discovery labels cannot carry weights or quality authority"
            )
        if probability_required is not False:
            raise FlickrReviewedLabelsV2Error(
                "failure-discovery sampling plan cannot require probabilities"
            )
        return
    if purpose == "quality_estimation":
        if not quality_allowed or probability_required is not True:
            raise FlickrReviewedLabelsV2Error(
                "quality-estimation labels require an authorized probability design"
            )
        if not _valid_probability(probability) or not _valid_weight(weight):
            raise FlickrReviewedLabelsV2Error(
                "quality-estimation labels require valid probability and weight"
            )
        assert isinstance(probability, float)
        assert isinstance(weight, float)
        if not math.isclose(weight, 1 / probability, rel_tol=1e-12, abs_tol=1e-12):
            raise FlickrReviewedLabelsV2Error(
                "reviewed-label sampling weight is not inverse probability"
            )
        return
    if probability is not None or weight is not None or quality_allowed:
        raise FlickrReviewedLabelsV2Error(
            "non-audit reviewed labels cannot carry sampling weights or quality authority"
        )


def _valid_probability(value: object) -> bool:
    return (
        isinstance(value, float)
        and math.isfinite(value)
        and value > 0
        and value <= 1
    )


def _valid_weight(value: object) -> bool:
    return isinstance(value, float) and math.isfinite(value) and value >= 1


def _required_text(value: object, field: str) -> str:
    if not isinstance(value, str) or value.strip() == "":
        raise FlickrReviewedLabelsV2Error(f"{field} must be non-empty text")
    return value


def _string_list(value: object, field: str) -> list[str]:
    if not isinstance(value, list) or any(
        not isinstance(item, str) or item.strip() == "" for item in value
    ):
        raise FlickrReviewedLabelsV2Error(f"{field} must be a list of text")
    return value


def _hashable(value: object) -> object:
    if isinstance(value, list):
        return tuple(value)
    return value


__all__ = [
    "BIOMINER_REVIEWED_LABEL_SCHEMA_VERSION",
    "FLICKR_REVIEWED_LABELS_V2_FILE",
    "FlickrReviewedLabelsV2Error",
    "build_flickr_reviewed_labels_v2",
    "flickr_reviewed_labels_v2_schema",
    "validate_flickr_reviewed_labels_v2",
    "write_flickr_reviewed_labels_v2",
]
