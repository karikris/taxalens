"""Materialize the conservative baseline occurrence provider union."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping
from datetime import date, datetime
from pathlib import Path
from typing import Any

import polars as pl
from taxalens.product.geographic_contracts import (
    BASELINE_OCCURRENCE_UNION_PARQUET_COLUMNS,
    BASELINE_OCCURRENCE_UNION_SCHEMA_VERSION,
)

from packages.replay.src.baseline_provider_identity import (
    INATURALIST_GBIF_DATASET_KEY,
    PROVIDER_UNION_POLICY_VERSION,
    ProviderIdentityRecord,
    canonical_observation_id,
    classify_provider_source,
    identity_basis,
    provider_relationship_id,
)
from packages.replay.src.biominer_baseline_geography_adapter import (
    BaselineGeographyHandoff,
    adapt_biominer_baseline_geography,
)

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_COUNTRY_MAPPING = (
    REPOSITORY_ROOT / "demo/source/geography/natural_earth_110m_iso_country_mapping.json"
)

PROVIDER_RELATIONSHIP_SCHEMA_VERSION = "taxalens-baseline-provider-relationship:v1.0.0"
SOURCE_CITATION_UNAVAILABLE = "unavailable_in_committed_baseline_snapshot"

_SPATIAL_FIELDS = {
    "spatial_cell_id",
    "spatial_resolution",
    "centroid_latitude",
    "centroid_longitude",
}


class BaselineProviderUnionError(ValueError):
    """Raised when a baseline provider union cannot be built safely."""


def baseline_occurrence_union_schema() -> dict[str, pl.DataType]:
    """Return the exact physical contract schema in canonical column order."""

    physical = {
        "utf8": pl.String,
        "uint8": pl.UInt8,
        "float64": pl.Float64,
        "float32": pl.Float32,
        "date32": pl.Date,
        "boolean": pl.Boolean,
    }
    return {
        column.name: physical[column.physical_type]
        for column in BASELINE_OCCURRENCE_UNION_PARQUET_COLUMNS
    }


def provider_relationship_schema() -> dict[str, pl.DataType]:
    """Return the one-row-per-provider relationship audit schema."""

    return {
        "schema_version": pl.String,
        "baseline_snapshot_id": pl.String,
        "project_id": pl.String,
        "run_id": pl.String,
        "registry_version": pl.String,
        "accepted_taxon_key": pl.String,
        "scientific_name": pl.String,
        "canonical_observation_id": pl.String,
        "provider_relationship_id": pl.String,
        "provider_union_policy_version": pl.String,
        "provider_source": pl.String,
        "delivery_provider": pl.String,
        "provider_observation_id": pl.String,
        "gbif_occurrence_key": pl.String,
        "inaturalist_observation_id": pl.String,
        "source_dataset_key": pl.String,
        "source_dataset_citation": pl.String,
        "source_dataset_citation_status": pl.String,
        "source_record_sha256": pl.String,
        "provider_relationship_kind": pl.String,
        "match_method": pl.String,
        "duplicate_group_id": pl.String,
        "unresolved_duplicate_group_id": pl.String,
        "exact_duplicate_removed": pl.Boolean,
        "canonical_flag": pl.Boolean,
        "spatial_projection_count": pl.UInt8,
        "range_inference_eligible": pl.Boolean,
    }


def build_baseline_provider_union(
    handoff: BaselineGeographyHandoff,
    *,
    country_mapping: Mapping[str, Any],
) -> tuple[pl.DataFrame, pl.DataFrame]:
    """Build long-form map rows plus one-row-per-provider relationship audit."""

    if not isinstance(handoff, BaselineGeographyHandoff):
        raise TypeError("handoff must be BaselineGeographyHandoff")
    countries = _country_mapping_frame(country_mapping)
    evidence = handoff.occurrence_evidence
    spread = handoff.spread
    _validate_projection_source(evidence, handoff)

    confidence_keys = [
        "registry_version",
        "accepted_taxon_key",
        "source",
        "source_dataset_key",
        "spatial_cell_id",
        "spatial_resolution",
        "source_snapshot_version",
    ]
    confidence = spread.select([*confidence_keys, "evidence_confidence"])
    if confidence.select(pl.struct(confidence_keys).n_unique()).item() != confidence.height:
        raise BaselineProviderUnionError("spread confidence join keys are not unique")
    enriched = evidence.join(confidence, on=confidence_keys, how="left", validate="m:1")
    if enriched.height != evidence.height or enriched["evidence_confidence"].null_count():
        raise BaselineProviderUnionError("spread confidence did not reconcile to evidence")

    relationships = _build_relationships(enriched, handoff)
    identity_columns = [
        pl.col("gbif_occurrence_key"),
        pl.col("canonical_observation_id"),
        pl.col("provider_relationship_id"),
        pl.col("provider_source"),
        pl.col("delivery_provider"),
        pl.col("provider_observation_id"),
        pl.col("inaturalist_observation_id"),
        pl.col("source_dataset_citation").alias("resolved_source_dataset_citation"),
        pl.col("source_record_sha256"),
        pl.col("provider_relationship_kind"),
        pl.col("match_method"),
        pl.col("duplicate_group_id"),
        pl.col("unresolved_duplicate_group_id"),
        pl.col("exact_duplicate_removed"),
        pl.col("canonical_flag"),
    ]
    union = enriched.join(
        relationships.select(identity_columns),
        left_on="gbif_id",
        right_on="gbif_occurrence_key",
        how="left",
        validate="m:1",
    ).join(countries, on="country_code", how="left", validate="m:1")
    union = (
        union.with_columns(
            pl.lit(BASELINE_OCCURRENCE_UNION_SCHEMA_VERSION).alias("schema_version"),
            pl.lit(PROVIDER_UNION_POLICY_VERSION).alias("provider_union_policy_version"),
        )
        .select(
            pl.col("schema_version"),
            pl.col("baseline_snapshot_id"),
            pl.col("project_id"),
            pl.col("run_id"),
            pl.col("registry_version"),
            pl.col("accepted_taxon_key"),
            pl.col("scientific_name"),
            pl.col("canonical_observation_id"),
            pl.col("provider_relationship_id"),
            pl.col("provider_union_policy_version"),
            pl.col("provider_source"),
            pl.col("delivery_provider"),
            pl.col("provider_observation_id"),
            pl.col("gbif_id").alias("gbif_occurrence_key"),
            pl.col("inaturalist_observation_id"),
            pl.col("source_dataset_key"),
            pl.col("resolved_source_dataset_citation").alias("source_dataset_citation"),
            pl.col("source_record_sha256"),
            pl.col("spatial_cell_id"),
            pl.col("spatial_resolution"),
            pl.col("grid_name"),
            pl.col("grid_version"),
            pl.col("country_code"),
            pl.col("country"),
            pl.col("continent"),
            pl.col("admin1"),
            pl.col("centroid_latitude"),
            pl.col("centroid_longitude"),
            pl.col("event_date"),
            pl.col("coordinate_uncertainty_m"),
            pl.col("basis_of_record"),
            pl.col("occurrence_status"),
            pl.col("known_range_role"),
            pl.col("range_inference_eligible"),
            pl.col("evidence_confidence"),
            pl.col("coordinate_valid"),
            pl.col("has_geospatial_issue"),
            pl.col("preserved_specimen"),
            pl.col("fossil"),
            pl.col("exclusion_reason"),
            pl.col("provider_relationship_kind"),
            pl.col("match_method"),
            pl.col("duplicate_group_id"),
            pl.col("unresolved_duplicate_group_id"),
            pl.col("exact_duplicate_removed"),
            pl.col("canonical_flag"),
        )
        .select(
            [pl.col(name).cast(dtype) for name, dtype in baseline_occurrence_union_schema().items()]
        )
        .sort(["canonical_observation_id", "spatial_resolution"])
    )
    _validate_union(union, relationships, handoff)
    return union, relationships


def build_committed_baseline_provider_union(
    *,
    country_mapping_path: str | Path = DEFAULT_COUNTRY_MAPPING,
) -> tuple[pl.DataFrame, pl.DataFrame]:
    """Build from checksum-verified committed source artifacts only."""

    handoff = adapt_biominer_baseline_geography()
    try:
        mapping = json.loads(Path(country_mapping_path).read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise BaselineProviderUnionError("country mapping is unreadable") from error
    if not isinstance(mapping, dict):
        raise BaselineProviderUnionError("country mapping must be an object")
    return build_baseline_provider_union(handoff, country_mapping=mapping)


def _build_relationships(evidence: pl.DataFrame, handoff: BaselineGeographyHandoff) -> pl.DataFrame:
    source_record_columns = [
        column
        for column in evidence.columns
        if column
        not in {
            *_SPATIAL_FIELDS,
            "evidence_confidence",
            "taxalens_schema_version",
        }
    ]
    invariant_columns = [column for column in source_record_columns if column != "gbif_id"]
    variation = (
        evidence.group_by("gbif_id")
        .agg([pl.col(column).n_unique().alias(column) for column in invariant_columns])
        .filter(pl.any_horizontal([pl.col(column) != 1 for column in invariant_columns]))
    )
    if variation.height:
        raise BaselineProviderUnionError("provider fields vary across spatial projections")
    records = evidence.sort(["gbif_id", "spatial_resolution"]).unique(
        subset=["gbif_id"], keep="first", maintain_order=True
    )
    rows: list[dict[str, Any]] = []
    for row in records.iter_rows(named=True):
        source_record_sha256 = _source_record_sha256(row, source_record_columns)
        provider_source = classify_provider_source(
            delivery_provider="gbif",
            source_dataset_key=row["source_dataset_key"],
        )
        gbif_id = _required_text(row["gbif_id"], "gbif_id")
        provider_observation_id = gbif_id if provider_source == "gbif" else None
        identity_record = ProviderIdentityRecord(
            record_id=f"gbif:{gbif_id}",
            provider_source=provider_source,
            delivery_provider="gbif",
            source_record_sha256=source_record_sha256,
            provider_observation_id=provider_observation_id,
            gbif_occurrence_key=gbif_id,
            source_dataset_key=row["source_dataset_key"],
            accepted_taxon_key=row["accepted_taxon_key"],
            event_date=row["event_date"],
            latitude=None,
            longitude=None,
            coordinate_uncertainty_m=row["coordinate_uncertainty_m"],
            country_code=row["country_code"],
            admin1=row["admin1"],
        )
        basis = identity_basis(identity_record)
        source_dataset_key = _required_text(row["source_dataset_key"], "source_dataset_key")
        source_citation = row["source_dataset_citation"]
        citation_status = "available"
        if not isinstance(source_citation, str) or not source_citation.strip():
            source_citation = (
                "Citation unavailable in committed baseline snapshot "
                f"(GBIF dataset key: {source_dataset_key})."
            )
            citation_status = SOURCE_CITATION_UNAVAILABLE
        inaturalist_via_gbif = provider_source == "inaturalist"
        rows.append(
            {
                "schema_version": PROVIDER_RELATIONSHIP_SCHEMA_VERSION,
                "baseline_snapshot_id": handoff.scope.baseline_snapshot_id,
                "project_id": handoff.scope.project_id,
                "run_id": handoff.scope.run_id,
                "registry_version": handoff.scope.registry_version,
                "accepted_taxon_key": handoff.scope.accepted_taxon_key,
                "scientific_name": handoff.scope.scientific_name,
                "canonical_observation_id": canonical_observation_id(basis),
                "provider_relationship_id": provider_relationship_id(identity_record),
                "provider_union_policy_version": PROVIDER_UNION_POLICY_VERSION,
                "provider_source": provider_source,
                "delivery_provider": "gbif",
                "provider_observation_id": provider_observation_id,
                "gbif_occurrence_key": gbif_id,
                "inaturalist_observation_id": None,
                "source_dataset_key": source_dataset_key,
                "source_dataset_citation": source_citation,
                "source_dataset_citation_status": citation_status,
                "source_record_sha256": source_record_sha256,
                "provider_relationship_kind": (
                    "inaturalist_via_gbif" if inaturalist_via_gbif else "canonical_source"
                ),
                "match_method": (
                    "inaturalist_via_gbif" if inaturalist_via_gbif else "provider_identity"
                ),
                "duplicate_group_id": None,
                "unresolved_duplicate_group_id": None,
                "exact_duplicate_removed": False,
                "canonical_flag": True,
                "spatial_projection_count": len(handoff.scope.spatial_resolutions),
                "range_inference_eligible": bool(row["range_inference_eligible"]),
            }
        )
    relationships = pl.DataFrame(rows, schema=provider_relationship_schema()).sort(
        "canonical_observation_id"
    )
    if relationships["provider_relationship_id"].n_unique() != relationships.height:
        raise BaselineProviderUnionError("provider relationship identity is not unique")
    if relationships["canonical_observation_id"].n_unique() != relationships.height:
        raise BaselineProviderUnionError("canonical observation identity is not unique")
    return relationships


def _country_mapping_frame(mapping: Mapping[str, Any]) -> pl.DataFrame:
    if mapping.get("schema_version") != "taxalens-offline-country-mapping:v1.0.0":
        raise BaselineProviderUnionError("country mapping schema differs")
    raw_countries = mapping.get("countries")
    if not isinstance(raw_countries, list):
        raise BaselineProviderUnionError("country mapping countries must be an array")
    rows = []
    for raw in raw_countries:
        if not isinstance(raw, dict):
            raise BaselineProviderUnionError("country mapping item must be an object")
        rows.append(
            {
                "country_code": raw.get("country_code"),
                "country": raw.get("country"),
                "continent": raw.get("continent"),
            }
        )
    frame = pl.DataFrame(
        rows,
        schema={"country_code": pl.String, "country": pl.String, "continent": pl.String},
    )
    if frame["country_code"].n_unique() != frame.height:
        raise BaselineProviderUnionError("country mapping code is not unique")
    return frame


def _validate_projection_source(evidence: pl.DataFrame, handoff: BaselineGeographyHandoff) -> None:
    if evidence.height == 0:
        raise BaselineProviderUnionError("baseline occurrence evidence is empty")
    grouped = evidence.group_by("gbif_id").agg(
        pl.col("spatial_resolution").sort().alias("resolutions"),
        pl.len().alias("projection_count"),
    )
    expected = list(handoff.scope.spatial_resolutions)
    invalid = grouped.filter(
        (pl.col("projection_count") != len(expected)) | (pl.col("resolutions") != pl.lit(expected))
    )
    if invalid.height:
        raise BaselineProviderUnionError("GBIF spatial projections do not reconcile")
    if evidence["gbif_id"].n_unique() * len(expected) != evidence.height:
        raise BaselineProviderUnionError("GBIF occurrence projection count differs")


def _validate_union(
    union: pl.DataFrame,
    relationships: pl.DataFrame,
    handoff: BaselineGeographyHandoff,
) -> None:
    if union.schema != baseline_occurrence_union_schema():
        raise BaselineProviderUnionError("baseline union physical schema differs")
    if union.height != handoff.occurrence_evidence.height:
        raise BaselineProviderUnionError("baseline union projection rows differ")
    if union["canonical_observation_id"].n_unique() != relationships.height:
        raise BaselineProviderUnionError("baseline union canonical count differs")
    if union["provider_relationship_id"].n_unique() != relationships.height:
        raise BaselineProviderUnionError("baseline union relationship count differs")
    if union.filter(pl.col("exact_duplicate_removed")).height:
        raise BaselineProviderUnionError("spatial projections were marked as provider duplicates")
    if union.filter(~pl.col("canonical_flag")).height:
        raise BaselineProviderUnionError("GBIF-only input unexpectedly has noncanonical rows")
    expected_inaturalist = relationships.filter(
        pl.col("source_dataset_key") == INATURALIST_GBIF_DATASET_KEY
    ).height
    observed_inaturalist = relationships.filter(pl.col("provider_source") == "inaturalist").height
    if expected_inaturalist != observed_inaturalist:
        raise BaselineProviderUnionError("iNaturalist-origin composition differs")


def _source_record_sha256(row: Mapping[str, Any], columns: list[str]) -> str:
    payload = {
        column: _json_value(row[column])
        for column in sorted(columns)
        if column not in _SPATIAL_FIELDS
    }
    content = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(content).hexdigest()


def _json_value(value: Any) -> Any:
    if isinstance(value, datetime | date):
        return value.isoformat()
    if isinstance(value, tuple):
        return [_json_value(item) for item in value]
    return value


def _required_text(value: object, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise BaselineProviderUnionError(f"{label} must be non-empty")
    return value


__all__ = [
    "BaselineProviderUnionError",
    "DEFAULT_COUNTRY_MAPPING",
    "PROVIDER_RELATIONSHIP_SCHEMA_VERSION",
    "SOURCE_CITATION_UNAVAILABLE",
    "baseline_occurrence_union_schema",
    "build_baseline_provider_union",
    "build_committed_baseline_provider_union",
    "provider_relationship_schema",
]
