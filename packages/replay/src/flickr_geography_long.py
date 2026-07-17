"""Normalize precision-aware Flickr geography into deterministic long form."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import polars as pl

from packages.replay.src.biominer_flickr_geography_handoff import (
    DEFAULT_BIOMINER_ROOT,
    DEFAULT_MANIFEST,
    EXPECTED_COLUMNS,
    verify_flickr_geography_handoff,
)

FLICKR_GEOGRAPHY_LONG_SCHEMA_VERSION = "taxalens-flickr-geography-long:v1.0.0"
CANDIDATE_SEMANTICS = "flickr_candidate_evidence_not_taxonomic_identity_or_occurrence"
CELL_COLUMNS = {3: "coarse_cell_id", 5: "regional_cell_id", 7: "local_cell_id"}
PRECISION_SUPPORT = {
    "flickr_world": (),
    "flickr_country": (),
    "flickr_region": (3,),
    "flickr_city": (3, 5),
    "flickr_street": (3, 5, 7),
    "unknown_precision": (),
    "invalid": (),
    "missing": (),
}


class FlickrGeographyLongError(ValueError):
    """Raised when Flickr geography cannot be normalized without invention."""


@dataclass(frozen=True, slots=True)
class FlickrGeographyScope:
    project_id: str
    run_id: str
    target_accepted_taxon_key: str
    scientific_name: str
    flickr_snapshot_id: str
    grid_name: str
    grid_version: str
    origin_repository: str
    origin_commit: str
    source_artifact_sha256: str


def flickr_geography_long_schema() -> dict[str, pl.DataType]:
    return {
        "schema_version": pl.String,
        "project_id": pl.String,
        "run_id": pl.String,
        "target_accepted_taxon_key": pl.String,
        "scientific_name": pl.String,
        "flickr_snapshot_id": pl.String,
        "source": pl.String,
        "flickr_photo_id": pl.String,
        "source_record_hash": pl.String,
        "spatial_resolution": pl.UInt8,
        "spatial_cell_id": pl.String,
        "cell_supported": pl.Boolean,
        "cell_support_status": pl.String,
        "grid_name": pl.String,
        "grid_version": pl.String,
        "latitude": pl.Float64,
        "longitude": pl.Float64,
        "coordinate_accuracy": pl.Float64,
        "coordinate_source": pl.String,
        "geotag_available": pl.Boolean,
        "country_code": pl.String,
        "admin1": pl.String,
        "coordinate_quality": pl.String,
        "geography_warning": pl.String,
        "geography_warnings": pl.List(pl.String),
        "geography_config_fingerprint": pl.String,
        "origin_repository": pl.String,
        "origin_commit": pl.String,
        "source_artifact_sha256": pl.String,
        "candidate_semantics": pl.String,
    }


def _required_text(value: object, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise FlickrGeographyLongError(f"{label} must be non-empty text")
    return value


def load_flickr_geography_scope(manifest_path: Path = DEFAULT_MANIFEST) -> FlickrGeographyScope:
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise FlickrGeographyLongError("cannot load Flickr geography handoff") from error
    if not isinstance(manifest, dict):
        raise FlickrGeographyLongError("Flickr geography handoff must be an object")
    contract = manifest.get("geography_contract")
    artifact = manifest.get("artifact")
    if not isinstance(contract, dict) or not isinstance(artifact, dict):
        raise FlickrGeographyLongError("Flickr geography handoff sections are missing")
    return FlickrGeographyScope(
        project_id=_required_text(manifest.get("project_id"), "project_id"),
        run_id=_required_text(manifest.get("run_id"), "run_id"),
        target_accepted_taxon_key=_required_text(
            manifest.get("accepted_taxon_key"), "accepted_taxon_key"
        ),
        scientific_name=_required_text(manifest.get("scientific_name"), "scientific_name"),
        flickr_snapshot_id=_required_text(manifest.get("flickr_snapshot_id"), "flickr_snapshot_id"),
        grid_name=_required_text(contract.get("grid_name"), "grid_name"),
        grid_version=_required_text(contract.get("grid_version"), "grid_version"),
        origin_repository=_required_text(manifest.get("origin_repository"), "origin_repository"),
        origin_commit=_required_text(manifest.get("origin_commit"), "origin_commit"),
        source_artifact_sha256=_required_text(artifact.get("sha256"), "artifact.sha256"),
    )


def _validate_source(frame: pl.DataFrame) -> None:
    if tuple(frame.columns) != EXPECTED_COLUMNS:
        raise FlickrGeographyLongError("Flickr geography source columns differ")
    if frame.get_column("flickr_photo_id").n_unique() != frame.height:
        raise FlickrGeographyLongError("Flickr photo identity is not unique")
    observed_qualities = set(frame.get_column("coordinate_quality").unique().to_list())
    unknown = observed_qualities - set(PRECISION_SUPPORT)
    if unknown:
        raise FlickrGeographyLongError(f"unknown coordinate quality: {sorted(unknown)!r}")
    for quality, supported_resolutions in PRECISION_SUPPORT.items():
        rows = frame.filter(pl.col("coordinate_quality") == quality)
        for resolution, column in CELL_COLUMNS.items():
            has_cell = rows.get_column(column).is_not_null()
            expected = resolution in supported_resolutions
            if rows.height and has_cell.all() != expected:
                raise FlickrGeographyLongError(
                    f"{quality} cell support differs at resolution {resolution}"
                )


def _support_status(cell_column: str) -> pl.Expr:
    return (
        pl.when(pl.col(cell_column).is_not_null())
        .then(pl.lit("supported"))
        .when(pl.col("coordinate_quality") == "invalid")
        .then(pl.lit("invalid_coordinate"))
        .when(~pl.col("geotag_available"))
        .then(pl.lit("unavailable_geography"))
        .otherwise(pl.lit("unsupported_precision"))
    )


def build_flickr_geography_long(
    source: pl.DataFrame,
    *,
    scope: FlickrGeographyScope,
) -> pl.DataFrame:
    """Return three rows per source photo without populating unsupported cells."""

    if not isinstance(scope, FlickrGeographyScope):
        raise TypeError("scope must be FlickrGeographyScope")
    _validate_source(source)
    source_fields = (
        "source",
        "flickr_photo_id",
        "source_record_hash",
        "latitude",
        "longitude",
        "coordinate_accuracy",
        "coordinate_source",
        "geotag_available",
        "country_code",
        "admin1",
        "coordinate_quality",
        "geography_warning",
        "geography_warnings",
        "geography_config_fingerprint",
    )
    frames: list[pl.DataFrame] = []
    for resolution, cell_column in CELL_COLUMNS.items():
        frames.append(
            source.select([*source_fields, cell_column])
            .with_columns(
                pl.lit(FLICKR_GEOGRAPHY_LONG_SCHEMA_VERSION).alias("schema_version"),
                pl.lit(scope.project_id).alias("project_id"),
                pl.lit(scope.run_id).alias("run_id"),
                pl.lit(scope.target_accepted_taxon_key).alias("target_accepted_taxon_key"),
                pl.lit(scope.scientific_name).alias("scientific_name"),
                pl.lit(scope.flickr_snapshot_id).alias("flickr_snapshot_id"),
                pl.lit(resolution, dtype=pl.UInt8).alias("spatial_resolution"),
                pl.col(cell_column).alias("spatial_cell_id"),
                pl.col(cell_column).is_not_null().alias("cell_supported"),
                _support_status(cell_column).alias("cell_support_status"),
                pl.lit(scope.grid_name).alias("grid_name"),
                pl.lit(scope.grid_version).alias("grid_version"),
                pl.lit(scope.origin_repository).alias("origin_repository"),
                pl.lit(scope.origin_commit).alias("origin_commit"),
                pl.lit(scope.source_artifact_sha256).alias("source_artifact_sha256"),
                pl.lit(CANDIDATE_SEMANTICS).alias("candidate_semantics"),
            )
            .select(
                [pl.col(name).cast(dtype) for name, dtype in flickr_geography_long_schema().items()]
            )
        )
    normalized = pl.concat(frames).sort(["flickr_photo_id", "spatial_resolution"])
    if normalized.height != source.height * len(CELL_COLUMNS):
        raise AssertionError("Flickr long-form row count differs")
    if normalized.filter(pl.col("cell_supported") & pl.col("spatial_cell_id").is_null()).height:
        raise AssertionError("supported Flickr cell has no identity")
    unexpected_cells = normalized.filter(
        ~pl.col("cell_supported") & pl.col("spatial_cell_id").is_not_null()
    )
    if unexpected_cells.height:
        raise AssertionError("unsupported Flickr cell was populated")
    return normalized


def build_committed_flickr_geography_long(
    *,
    manifest_path: Path = DEFAULT_MANIFEST,
    biominer_root: Path = DEFAULT_BIOMINER_ROOT,
) -> pl.DataFrame:
    source = verify_flickr_geography_handoff(
        manifest_path=manifest_path,
        biominer_root=biominer_root,
    )
    return build_flickr_geography_long(
        source,
        scope=load_flickr_geography_scope(manifest_path),
    )


__all__ = [
    "CANDIDATE_SEMANTICS",
    "CELL_COLUMNS",
    "FLICKR_GEOGRAPHY_LONG_SCHEMA_VERSION",
    "PRECISION_SUPPORT",
    "FlickrGeographyLongError",
    "FlickrGeographyScope",
    "build_committed_flickr_geography_long",
    "build_flickr_geography_long",
    "flickr_geography_long_schema",
    "load_flickr_geography_scope",
]
