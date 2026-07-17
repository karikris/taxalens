"""Bind Flickr geography to committed verification identities and consensus."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import polars as pl

from packages.replay.src.flickr_geography_long import flickr_geography_long_schema

VERIFICATION_GEOGRAPHY_SCHEMA_VERSION = "taxalens-flickr-geography-verification:v1.0.0"
DEFAULT_LONG_PARQUET = Path(
    "demo/source/biominer_phase14/flickr_geography/flickr_geography_long.parquet"
)
DEFAULT_CAMPAIGN = Path("demo/source/verification/papilio-demoleus-flickr-audit.campaign.json")
DEFAULT_ASSIGNMENTS = Path("demo/repository_storage/supabase/verification_assignments.json")
DEFAULT_CONSENSUS = Path("demo/repository_storage/supabase/verification_consensus.json")
TABLE_SCHEMA_VERSION = "taxalens-repository-supabase-table:v1.0.0"


class FlickrGeographyVerificationError(ValueError):
    """Raised when verification identity cannot be bound without invention."""


def flickr_geography_verification_schema() -> dict[str, pl.DataType]:
    return {
        **flickr_geography_long_schema(),
        "verification_campaign_id": pl.String,
        "verification_item_id": pl.String,
        "verification_queue_state": pl.String,
        "duplicate_group_id": pl.String,
        "observation_group_id": pl.String,
        "owner_group_id": pl.String,
        "geographic_cluster_id": pl.String,
        "dataset_split": pl.String,
        "sampling_stratum_id": pl.String,
        "sampling_purpose": pl.String,
        "sampling_design": pl.String,
        "sampling_representative": pl.Boolean,
        "inclusion_probability": pl.Float64,
        "sampling_weight": pl.Float64,
        "campaign_manifest_sha256": pl.String,
        "question_fingerprint": pl.String,
        "machine_screening_state": pl.String,
        "campaign_coordinate_latitude": pl.Float64,
        "campaign_coordinate_longitude": pl.Float64,
        "coordinate_outlier": pl.Boolean,
        "reviewer_assignment_count": pl.UInt32,
        "consensus_status": pl.String,
        "consensus_outcome": pl.String,
        "effective_review_count": pl.UInt32,
        "decisive_review_count": pl.UInt32,
        "human_review_state": pl.String,
        "human_reviewed": pl.Boolean,
        "human_supported": pl.Boolean,
    }


def _load_object(path: Path, label: str) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise FlickrGeographyVerificationError(f"cannot read {label}: {path}") from error
    if not isinstance(payload, dict):
        raise FlickrGeographyVerificationError(f"{label} must be a JSON object")
    return payload


def _required_text(value: object, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise FlickrGeographyVerificationError(f"{label} must be non-empty text")
    return value


def _optional_text(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _mapping(value: object, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise FlickrGeographyVerificationError(f"{label} must be an object")
    return value


def _table_rows(path: Path, label: str) -> list[dict[str, Any]]:
    payload = _load_object(path, label)
    if payload.get("schema_version") != TABLE_SCHEMA_VERSION:
        raise FlickrGeographyVerificationError(f"{label} schema differs")
    rows = payload.get("rows")
    if not isinstance(rows, list) or not all(isinstance(row, dict) for row in rows):
        raise FlickrGeographyVerificationError(f"{label} rows must be objects")
    return rows


def _consensus_payload(row: dict[str, Any]) -> dict[str, Any]:
    payload = row.get("consensus_payload")
    return payload if isinstance(payload, dict) else row


def _consensus_by_item(rows: list[dict[str, Any]], campaign_id: str) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for row in rows:
        payload = _consensus_payload(row)
        row_campaign = _optional_text(payload.get("campaignId") or row.get("campaign_id"))
        if row_campaign != campaign_id:
            continue
        item_id = _required_text(payload.get("itemId") or row.get("item_id"), "consensus item id")
        if item_id in result:
            raise FlickrGeographyVerificationError("duplicate consensus item")
        result[item_id] = payload
    return result


def _assignment_counts(rows: list[dict[str, Any]], campaign_id: str) -> dict[str, int]:
    result: dict[str, int] = {}
    for row in rows:
        if _optional_text(row.get("campaign_id")) != campaign_id:
            continue
        item_id = _required_text(row.get("item_id"), "assignment item id")
        result[item_id] = result.get(item_id, 0) + 1
    return result


def _human_state(
    *, status: str, outcome: str | None, effective_count: int, decisive_count: int
) -> tuple[str, bool, bool]:
    if effective_count == 0 or status == "pending":
        return "pending", False, False
    if status in {"complete_agreement", "adjudicated"} and decisive_count > 0:
        if outcome == "yes":
            return "reviewed_target_positive", True, True
        if outcome == "no":
            return "reviewed_non_target", True, False
    if status in {"unresolved_disagreement", "uncertain_only"}:
        return "uncertain", True, False
    if status == "media_failure":
        return "media_failure", True, False
    if status == "deferred":
        return "deferred", True, False
    raise FlickrGeographyVerificationError("unsupported verification consensus state")


def _campaign_bindings(
    *,
    campaign_path: Path,
    assignment_path: Path,
    consensus_path: Path,
    expected_target: str,
) -> pl.DataFrame:
    packet = _load_object(campaign_path, "Flickr verification campaign")
    campaign = _mapping(packet.get("campaign"), "campaign")
    campaign_id = _required_text(campaign.get("campaignId"), "campaignId")
    target = _mapping(campaign.get("targetTaxon"), "campaign targetTaxon")
    if target.get("acceptedTaxonKey") != expected_target:
        raise FlickrGeographyVerificationError("campaign target differs")
    sampling = _mapping(campaign.get("samplingPlan"), "campaign samplingPlan")
    if campaign.get("scientificClaimAllowed") is not False:
        raise FlickrGeographyVerificationError("campaign scientific claim gate differs")
    consensus = _consensus_by_item(
        _table_rows(consensus_path, "verification consensus table"),
        campaign_id,
    )
    assignments = _assignment_counts(
        _table_rows(assignment_path, "verification assignment table"),
        campaign_id,
    )
    selection = _mapping(packet.get("selection"), "campaign selection")
    weights = _mapping(selection.get("samplingWeights"), "selection samplingWeights")
    raw_items = packet.get("items")
    if not isinstance(raw_items, list):
        raise FlickrGeographyVerificationError("campaign items must be an array")
    rows: list[dict[str, object]] = []
    seen_photos: set[str] = set()
    seen_items: set[str] = set()
    for index, raw in enumerate(raw_items):
        item = _mapping(raw, f"items[{index}]")
        item_id = _required_text(item.get("itemId"), "itemId")
        flickr = _mapping(item.get("flickrSource"), "flickrSource")
        photo_id = _required_text(flickr.get("flickrPhotoId"), "flickrPhotoId")
        if photo_id in seen_photos or item_id in seen_items:
            raise FlickrGeographyVerificationError("duplicate campaign photo or item")
        seen_photos.add(photo_id)
        seen_items.add(item_id)
        payload = consensus.get(item_id)
        status = (
            _required_text(payload.get("status"), "consensus status")
            if payload is not None
            else "pending"
        )
        outcome = _optional_text(payload.get("consensusOutcome")) if payload else None
        effective_count = int(payload.get("effectiveReviewCount", 0)) if payload else 0
        decisive_count = int(payload.get("decisiveReviewCount", 0)) if payload else 0
        state, human_reviewed, human_supported = _human_state(
            status=status,
            outcome=outcome,
            effective_count=effective_count,
            decisive_count=decisive_count,
        )
        coordinate = _mapping(flickr.get("coordinate"), "flickrSource.coordinate")
        rows.append(
            {
                "flickr_photo_id": photo_id,
                "verification_campaign_id": campaign_id,
                "verification_item_id": item_id,
                "verification_queue_state": "campaign_item",
                "duplicate_group_id": _required_text(
                    flickr.get("duplicateGroupId"), "duplicateGroupId"
                ),
                "observation_group_id": _required_text(
                    flickr.get("observationGroupId"), "observationGroupId"
                ),
                "owner_group_id": _required_text(flickr.get("ownerGroupId"), "ownerGroupId"),
                "geographic_cluster_id": _optional_text(flickr.get("geographicClusterId")),
                "dataset_split": _required_text(flickr.get("datasetPartition"), "datasetPartition"),
                "sampling_stratum_id": _required_text(
                    item.get("samplingStratumId"), "samplingStratumId"
                ),
                "sampling_purpose": _required_text(sampling.get("purpose"), "sampling purpose"),
                "sampling_design": _required_text(sampling.get("design"), "sampling design"),
                "sampling_representative": bool(sampling.get("representative")),
                "inclusion_probability": float(item["inclusionProbability"]),
                "sampling_weight": float(weights[item_id]),
                "campaign_manifest_sha256": _required_text(
                    campaign.get("manifestSha256"), "campaign manifest SHA-256"
                ),
                "question_fingerprint": _required_text(
                    item.get("questionFingerprint"), "questionFingerprint"
                ),
                "machine_screening_state": _required_text(
                    flickr.get("decisionState"), "decisionState"
                ),
                "campaign_coordinate_latitude": coordinate.get("latitude"),
                "campaign_coordinate_longitude": coordinate.get("longitude"),
                "coordinate_outlier": coordinate.get("outlier"),
                "reviewer_assignment_count": assignments.get(item_id, 0),
                "consensus_status": status,
                "consensus_outcome": outcome,
                "effective_review_count": effective_count,
                "decisive_review_count": decisive_count,
                "human_review_state": state,
                "human_reviewed": human_reviewed,
                "human_supported": human_supported,
            }
        )
    unknown_consensus = set(consensus) - seen_items
    unknown_assignments = set(assignments) - seen_items
    if unknown_consensus or unknown_assignments:
        raise FlickrGeographyVerificationError("review state names an unknown campaign item")
    schema = {
        name: dtype
        for name, dtype in flickr_geography_verification_schema().items()
        if name not in flickr_geography_long_schema()
    }
    return pl.DataFrame(rows, schema={"flickr_photo_id": pl.String, **schema})


def build_flickr_geography_verification(
    geography: pl.DataFrame,
    *,
    campaign_path: Path = DEFAULT_CAMPAIGN,
    assignment_path: Path = DEFAULT_ASSIGNMENTS,
    consensus_path: Path = DEFAULT_CONSENSUS,
) -> pl.DataFrame:
    """Left-bind all candidates to real campaign and consensus identities."""

    source_schema = flickr_geography_long_schema()
    if dict(geography.schema) != source_schema:
        raise FlickrGeographyVerificationError("Flickr long-form schema differs")
    targets = geography.get_column("target_accepted_taxon_key").unique().to_list()
    if len(targets) != 1:
        raise FlickrGeographyVerificationError("Flickr long form has multiple targets")
    bindings = _campaign_bindings(
        campaign_path=campaign_path,
        assignment_path=assignment_path,
        consensus_path=consensus_path,
        expected_target=str(targets[0]),
    )
    source = geography.with_columns(
        pl.lit(VERIFICATION_GEOGRAPHY_SCHEMA_VERSION).alias("schema_version")
    )
    joined = source.join(bindings, on="flickr_photo_id", how="left", validate="m:1")
    result = joined.with_columns(
        pl.col("verification_queue_state").fill_null("not_in_committed_campaign"),
        pl.col("reviewer_assignment_count").fill_null(0),
        pl.col("consensus_status").fill_null("not_requested"),
        pl.col("effective_review_count").fill_null(0),
        pl.col("decisive_review_count").fill_null(0),
        pl.col("human_review_state").fill_null("not_requested"),
        pl.col("human_reviewed").fill_null(False),
        pl.col("human_supported").fill_null(False),
    ).select(
        [pl.col(name).cast(dtype) for name, dtype in flickr_geography_verification_schema().items()]
    )
    campaign_rows = result.filter(pl.col("verification_item_id").is_not_null())
    if campaign_rows.get_column("flickr_photo_id").n_unique() != bindings.height:
        raise FlickrGeographyVerificationError("campaign photos do not reconcile")
    coordinate_mismatch = campaign_rows.filter(
        (
            pl.col("campaign_coordinate_latitude").is_not_null()
            & (pl.col("campaign_coordinate_latitude") != pl.col("latitude"))
        )
        | (
            pl.col("campaign_coordinate_longitude").is_not_null()
            & (pl.col("campaign_coordinate_longitude") != pl.col("longitude"))
        )
    )
    if coordinate_mismatch.height:
        raise FlickrGeographyVerificationError("campaign coordinates differ")
    if result.filter(pl.col("human_supported") & ~pl.col("human_reviewed")).height:
        raise FlickrGeographyVerificationError("human support lacks human review")
    return result.sort(["flickr_photo_id", "spatial_resolution"])


def build_committed_flickr_geography_verification() -> pl.DataFrame:
    return build_flickr_geography_verification(pl.read_parquet(DEFAULT_LONG_PARQUET))


__all__ = [
    "DEFAULT_ASSIGNMENTS",
    "DEFAULT_CAMPAIGN",
    "DEFAULT_CONSENSUS",
    "DEFAULT_LONG_PARQUET",
    "VERIFICATION_GEOGRAPHY_SCHEMA_VERSION",
    "FlickrGeographyVerificationError",
    "build_committed_flickr_geography_verification",
    "build_flickr_geography_verification",
    "flickr_geography_verification_schema",
]
