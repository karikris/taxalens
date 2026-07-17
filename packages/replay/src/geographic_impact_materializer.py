"""Materialize deterministic baseline/Flickr full-outer spatial-cell evidence."""

from __future__ import annotations

import hashlib
import json
import math
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

import h3
import polars as pl
from taxalens.product.geographic_contracts import (
    GEOGRAPHIC_IMPACT_CELL_PARQUET_COLUMNS,
    GEOGRAPHIC_IMPACT_CELL_SCHEMA_VERSION,
    GEOGRAPHIC_IMPACT_SUMMARY_PARQUET_COLUMNS,
    GEOGRAPHIC_IMPACT_SUMMARY_SCHEMA_VERSION,
    assert_geographic_contract,
)

from packages.replay.src.baseline_provider_identity import PROVIDER_UNION_POLICY_VERSION
from packages.replay.src.baseline_provider_union import baseline_occurrence_union_schema
from packages.replay.src.flickr_geography_verification import (
    VERIFICATION_GEOGRAPHY_SCHEMA_VERSION,
    flickr_geography_verification_schema,
)
from packages.replay.src.occurrence_release import (
    RELEASE_POLICY_VERSION,
    load_occurrence_release_decisions,
    load_quality_snapshot_ids,
    validate_occurrence_release_decisions,
)
from packages.replay.src.offline_country_lookup import OfflineCountryLookup

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_BASELINE_UNION = (
    REPOSITORY_ROOT
    / "demo/source/biominer_phase14/baseline_provider_union/baseline_occurrence_union.parquet"
)
DEFAULT_FLICKR_GEOGRAPHY = (
    REPOSITORY_ROOT
    / "demo/source/biominer_phase14/flickr_geography/flickr_geography_verification.parquet"
)
DEFAULT_COUNTRY_HIERARCHY = REPOSITORY_ROOT / "demo/source/geography/country_hierarchy.json"

GEOGRAPHIC_IMPACT_MATERIALIZATION_POLICY_VERSION = "geographic-impact-materialization-policy:v1.0.0"
OCCURRENCE_RELEASE_POLICY_VERSION = RELEASE_POLICY_VERSION
NEAREST_BASELINE_DISTANCE_METHOD = "haversine_cell_centroid"
MEAN_EARTH_RADIUS_KM = 6_371.0088

_CELL_KEYS = ["spatial_resolution", "spatial_cell_id"]


class GeographicImpactMaterializationError(ValueError):
    """Raised when impact cells cannot be materialized without invention."""


@dataclass(frozen=True, slots=True)
class GeographicImpactScope:
    project_id: str
    run_id: str
    registry_version: str
    accepted_taxon_key: str
    scientific_name: str
    baseline_snapshot_id: str
    flickr_snapshot_id: str
    grid_name: str
    grid_version: str
    country_hierarchy_id: str


def geographic_impact_cell_schema() -> dict[str, pl.DataType]:
    """Return the exact impact-cell physical schema in contract order."""

    physical = {
        "utf8": pl.String,
        "uint8": pl.UInt8,
        "uint64": pl.UInt64,
        "float64": pl.Float64,
        "date32": pl.Date,
        "boolean": pl.Boolean,
        "list_utf8": pl.List(pl.String),
    }
    return {
        column.name: physical[column.physical_type]
        for column in GEOGRAPHIC_IMPACT_CELL_PARQUET_COLUMNS
    }


def geographic_impact_summary_schema() -> dict[str, pl.DataType]:
    """Return the exact impact-summary physical schema in contract order."""

    physical = {
        "utf8": pl.String,
        "uint8": pl.UInt8,
        "uint64": pl.UInt64,
        "float64": pl.Float64,
        "date32": pl.Date,
        "list_utf8": pl.List(pl.String),
    }
    return {
        column.name: physical[column.physical_type]
        for column in GEOGRAPHIC_IMPACT_SUMMARY_PARQUET_COLUMNS
    }


def build_geographic_impact_cells(
    baseline: pl.DataFrame,
    flickr: pl.DataFrame,
    *,
    geographic_impact_build_id: str,
    country_lookup: OfflineCountryLookup,
    country_hierarchy: Mapping[str, Any],
    release_decisions: pl.DataFrame,
    quality_snapshot_ids: frozenset[str],
) -> pl.DataFrame:
    """Preaggregate and full-outer join one compatible baseline/Flickr scope."""

    build_id = _required_text(geographic_impact_build_id, "geographic impact build ID")
    if not isinstance(country_lookup, OfflineCountryLookup):
        raise TypeError("country_lookup must be OfflineCountryLookup")
    scope = _validate_inputs(baseline, flickr, country_hierarchy)
    baseline_cells = _aggregate_baseline(baseline)
    flickr_cells = aggregate_flickr_review_states(
        flickr,
        release_decisions=release_decisions,
        quality_snapshot_ids=quality_snapshot_ids,
        scope=scope,
    )
    joined = baseline_cells.join(
        flickr_cells,
        on=_CELL_KEYS,
        how="full",
        coalesce=True,
        validate="1:1",
    )
    cell_scope = _cell_scope_frame(joined.select(_CELL_KEYS), country_lookup)
    joined = joined.join(cell_scope, on=_CELL_KEYS, how="left", validate="1:1")

    count_columns = [
        "provider_input_row_count",
        "baseline_union_count",
        "baseline_range_inference_eligible_count",
        "baseline_excluded_occurrence_count",
        "gbif_only_count",
        "inaturalist_origin_through_gbif_count",
        "duplicates_removed_count",
        "unresolved_provider_duplicate_group_count",
        "_preserved_or_fossil_count",
        "_unknown_coordinate_uncertainty_count",
        "_geospatial_issue_count",
        "flickr_candidate_count",
        "flickr_visually_eligible_count",
        "reviewed_positive_count",
        "reviewed_negative_count",
        "uncertain_count",
        "pending_count",
        "media_failure_count",
        "skipped_count",
        "release_ready_count",
    ]
    joined = joined.with_columns([pl.col(column).fill_null(0) for column in count_columns])
    joined = _with_nearest_baseline_distance(joined)
    eligible = pl.col("baseline_range_inference_eligible_count")
    candidates = pl.col("flickr_candidate_count")
    data_deficient_reasons = pl.concat_list(
        pl.lit("direct_inaturalist_delta_unavailable"),
        pl.when(pl.col("baseline_union_count") == 0)
        .then(pl.lit("no_baseline_rows_in_cell"))
        .otherwise(pl.lit(None, dtype=pl.String)),
        pl.when(
            (pl.col("baseline_union_count") > 0)
            & (pl.col("baseline_range_inference_eligible_count") == 0)
        )
        .then(pl.lit("no_range_inference_eligible_baseline"))
        .otherwise(pl.lit(None, dtype=pl.String)),
        pl.when(pl.col("unresolved_provider_duplicate_group_count") > 0)
        .then(pl.lit("unresolved_provider_duplicates"))
        .otherwise(pl.lit(None, dtype=pl.String)),
        pl.when(
            (pl.col("baseline_union_count") > 0)
            & (pl.col("_preserved_or_fossil_count") == pl.col("baseline_union_count"))
        )
        .then(pl.lit("preserved_specimen_or_fossil_only"))
        .otherwise(pl.lit(None, dtype=pl.String)),
        pl.when(
            (pl.col("baseline_union_count") > 0)
            & (pl.col("_unknown_coordinate_uncertainty_count") == pl.col("baseline_union_count"))
        )
        .then(pl.lit("coordinate_uncertainty_unavailable_for_all_baseline_rows"))
        .otherwise(pl.lit(None, dtype=pl.String)),
        pl.when(
            (pl.col("baseline_union_count") > 0)
            & (pl.col("_geospatial_issue_count") == pl.col("baseline_union_count"))
        )
        .then(pl.lit("all_baseline_rows_have_geospatial_issues"))
        .otherwise(pl.lit(None, dtype=pl.String)),
        pl.when(
            (pl.col("baseline_range_inference_eligible_count") > 0)
            & pl.col("latest_baseline_event_date").is_null()
        )
        .then(pl.lit("credible_baseline_date_unavailable"))
        .otherwise(pl.lit(None, dtype=pl.String)),
        pl.when((pl.col("reviewed_positive_count") > 0) & pl.col("quality_snapshot_id").is_null())
        .then(pl.lit("reviewed_quality_snapshot_unavailable"))
        .otherwise(pl.lit(None, dtype=pl.String)),
    ).list.drop_nulls()
    joined = joined.with_columns(data_deficient_reasons.alias("_data_deficient_reasons"))

    cells = (
        joined.with_columns(
            pl.lit(GEOGRAPHIC_IMPACT_CELL_SCHEMA_VERSION).alias("schema_version"),
            pl.lit(build_id).alias("geographic_impact_build_id"),
            pl.lit(scope.project_id).alias("project_id"),
            pl.lit(scope.run_id).alias("run_id"),
            pl.lit(scope.registry_version).alias("registry_version"),
            pl.lit(scope.accepted_taxon_key).alias("accepted_taxon_key"),
            pl.lit(scope.scientific_name).alias("scientific_name"),
            pl.lit(scope.baseline_snapshot_id).alias("baseline_snapshot_id"),
            pl.lit(scope.flickr_snapshot_id).alias("flickr_snapshot_id"),
            pl.lit(PROVIDER_UNION_POLICY_VERSION).alias("provider_union_policy_version"),
            pl.lit(VERIFICATION_GEOGRAPHY_SCHEMA_VERSION).alias("verification_projection_version"),
            pl.lit(OCCURRENCE_RELEASE_POLICY_VERSION).alias("release_policy_version"),
            pl.lit(scope.grid_name).alias("grid_name"),
            pl.lit(scope.grid_version).alias("grid_version"),
            pl.lit(scope.country_hierarchy_id).alias("country_hierarchy_id"),
            pl.lit("available").alias("baseline_evidence_status"),
            pl.lit("unavailable").alias("direct_inaturalist_delta_status"),
            pl.lit(None, dtype=pl.UInt64).alias("direct_inaturalist_delta_count"),
            ((eligible > 0) & (candidates == 0)).alias("baseline_only_cell"),
            ((eligible > 0) & (candidates > 0)).alias("matched_cell"),
            ((eligible == 0) & (candidates > 0)).alias("candidate_only_cell"),
            ((eligible == 0) & (pl.col("reviewed_positive_count") > 0)).alias(
                "reviewed_additional_cell"
            ),
            ((eligible == 0) & (pl.col("release_ready_count") > 0)).alias(
                "release_ready_additional_cell"
            ),
            pl.col("nearest_baseline_distance_status"),
            pl.col("nearest_baseline_distance_km"),
            pl.col("nearest_baseline_cell_id"),
            pl.col("nearest_baseline_distance_method"),
            pl.lit(None, dtype=pl.Date).alias("latest_flickr_candidate_date"),
            pl.when(pl.col("_data_deficient_reasons").list.len() > 0)
            .then(pl.lit("data_deficient"))
            .otherwise(pl.lit("sufficient"))
            .alias("data_deficient_state"),
            pl.col("_data_deficient_reasons").alias("data_deficient_reasons"),
        )
        .select(
            [pl.col(name).cast(dtype) for name, dtype in geographic_impact_cell_schema().items()]
        )
        .sort(_CELL_KEYS)
    )
    _validate_cells(cells, baseline_cells, flickr_cells)
    return cells


def build_committed_geographic_impact_cells(
    *,
    geographic_impact_build_id: str,
    baseline_path: str | Path = DEFAULT_BASELINE_UNION,
    flickr_path: str | Path = DEFAULT_FLICKR_GEOGRAPHY,
    country_hierarchy_path: str | Path = DEFAULT_COUNTRY_HIERARCHY,
) -> pl.DataFrame:
    """Build cells from repository-contained, checksum-verified handoffs."""

    try:
        country_hierarchy = json.loads(Path(country_hierarchy_path).read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise GeographicImpactMaterializationError("country hierarchy is unreadable") from error
    if not isinstance(country_hierarchy, dict):
        raise GeographicImpactMaterializationError("country hierarchy must be an object")
    return build_geographic_impact_cells(
        pl.read_parquet(baseline_path),
        pl.read_parquet(flickr_path),
        geographic_impact_build_id=geographic_impact_build_id,
        country_lookup=OfflineCountryLookup.from_path(),
        country_hierarchy=country_hierarchy,
        release_decisions=load_occurrence_release_decisions(),
        quality_snapshot_ids=load_quality_snapshot_ids(),
    )


def build_geographic_impact_summaries(
    cells: pl.DataFrame,
    *,
    country_hierarchy: Mapping[str, Any],
) -> pl.DataFrame:
    """Roll materialized cells up to every supported hierarchy scope."""

    if cells.schema != geographic_impact_cell_schema():
        raise GeographicImpactMaterializationError("impact cell schema differs")
    if not cells.height:
        raise GeographicImpactMaterializationError("impact cells are empty")
    if country_hierarchy.get("schema_version") != "taxalens-country-hierarchy:v1.0.0":
        raise GeographicImpactMaterializationError("country hierarchy schema differs")
    hierarchy_id = _required_text(
        country_hierarchy.get("country_hierarchy_id"), "country hierarchy ID"
    )
    if cells.get_column("country_hierarchy_id").unique().to_list() != [hierarchy_id]:
        raise GeographicImpactMaterializationError("cell country hierarchy differs")
    nodes = country_hierarchy.get("nodes")
    if not isinstance(nodes, list):
        raise GeographicImpactMaterializationError("country hierarchy nodes are missing")
    hierarchy_nodes = [node for node in nodes if isinstance(node, dict)]
    global_nodes = [node for node in hierarchy_nodes if node.get("scope_level") == "global"]
    if len(global_nodes) != 1:
        raise GeographicImpactMaterializationError("country hierarchy global scope differs")
    by_continent = _hierarchy_node_index(hierarchy_nodes, "continent", "continent")
    by_country = _hierarchy_node_index(hierarchy_nodes, "country", "country_code")
    by_admin1 = _admin1_node_index(hierarchy_nodes)

    rows: list[dict[str, object]] = []
    for resolution_cells in cells.partition_by("spatial_resolution", maintain_order=True):
        rows.append(_summarize_scope(resolution_cells, global_nodes[0]))
        for continent in sorted(
            resolution_cells.get_column("continent").drop_nulls().unique().to_list()
        ):
            node = by_continent.get(_required_text(continent, "continent"))
            if node is None:
                raise GeographicImpactMaterializationError(
                    "cell continent is absent from country hierarchy"
                )
            rows.append(
                _summarize_scope(resolution_cells.filter(pl.col("continent") == continent), node)
            )
        for country_code in sorted(
            resolution_cells.get_column("country_code").drop_nulls().unique().to_list()
        ):
            code = _required_text(country_code, "country code")
            node = by_country.get(code)
            if node is None:
                raise GeographicImpactMaterializationError(
                    "cell country is absent from country hierarchy"
                )
            rows.append(
                _summarize_scope(resolution_cells.filter(pl.col("country_code") == code), node)
            )
        admin1_pairs = (
            resolution_cells.filter(pl.col("admin1").is_not_null())
            .select("country_code", "admin1")
            .unique()
            .sort(["country_code", "admin1"])
        )
        for country_code, admin1 in admin1_pairs.iter_rows():
            pair = (
                _required_text(country_code, "admin1 country code"),
                _required_text(admin1, "admin1 name"),
            )
            node = by_admin1.get(pair)
            if node is None:
                raise GeographicImpactMaterializationError(
                    "cell admin1 is absent from country hierarchy"
                )
            rows.append(
                _summarize_scope(
                    resolution_cells.filter(
                        (pl.col("country_code") == pair[0]) & (pl.col("admin1") == pair[1])
                    ),
                    node,
                )
            )

    summaries = pl.DataFrame(rows).select(
        [pl.col(name).cast(dtype) for name, dtype in geographic_impact_summary_schema().items()]
    )
    level_order = pl.Enum(["global", "continent", "country", "admin1"])
    summaries = (
        summaries.with_columns(pl.col("scope_level").cast(level_order).alias("_scope_order"))
        .sort(["spatial_resolution", "_scope_order", "scope_id"])
        .drop("_scope_order")
    )
    _validate_summaries(summaries, cells)
    return summaries


def build_committed_geographic_impact_summaries(
    cells: pl.DataFrame,
    *,
    country_hierarchy_path: str | Path = DEFAULT_COUNTRY_HIERARCHY,
) -> pl.DataFrame:
    """Build hierarchy rollups from committed geographic inputs."""

    try:
        country_hierarchy = json.loads(Path(country_hierarchy_path).read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise GeographicImpactMaterializationError("country hierarchy is unreadable") from error
    if not isinstance(country_hierarchy, dict):
        raise GeographicImpactMaterializationError("country hierarchy must be an object")
    return build_geographic_impact_summaries(cells, country_hierarchy=country_hierarchy)


def _summarize_scope(
    cells: pl.DataFrame,
    node: Mapping[str, object],
) -> dict[str, object]:
    if not cells.height:
        raise GeographicImpactMaterializationError("summary scope is empty")
    single_columns = (
        "geographic_impact_build_id",
        "project_id",
        "run_id",
        "registry_version",
        "accepted_taxon_key",
        "scientific_name",
        "baseline_snapshot_id",
        "flickr_snapshot_id",
        "provider_union_policy_version",
        "verification_projection_version",
        "release_policy_version",
        "country_hierarchy_id",
        "spatial_resolution",
        "baseline_evidence_status",
        "direct_inaturalist_delta_status",
    )
    identity: dict[str, object] = {}
    for column in single_columns:
        values = cells.get_column(column).unique().to_list()
        if len(values) != 1:
            raise GeographicImpactMaterializationError(f"summary {column} is not single-scope")
        identity[column] = values[0]

    summed_columns = (
        "provider_input_row_count",
        "baseline_union_count",
        "baseline_range_inference_eligible_count",
        "baseline_excluded_occurrence_count",
        "gbif_only_count",
        "inaturalist_origin_through_gbif_count",
        "duplicates_removed_count",
        "unresolved_provider_duplicate_group_count",
        "flickr_candidate_count",
        "flickr_visually_eligible_count",
        "reviewed_positive_count",
        "reviewed_negative_count",
        "uncertain_count",
        "pending_count",
        "media_failure_count",
        "skipped_count",
        "release_ready_count",
    )
    totals = {column: int(cells.get_column(column).sum()) for column in summed_columns}
    candidate_only = cells.filter(pl.col("candidate_only_cell"))
    available_distances = candidate_only.filter(
        pl.col("nearest_baseline_distance_status") == "available"
    )
    if not candidate_only.height:
        nearest_status = "not_applicable"
        maximum_distance: float | None = None
    elif available_distances.height == candidate_only.height:
        nearest_status = "available"
        maximum_distance = float(
            available_distances.get_column("nearest_baseline_distance_km").max()
        )
    else:
        nearest_status = "unavailable"
        maximum_distance = None
    reasons = sorted(
        {
            _required_text(reason, "data-deficiency reason")
            for cell_reasons in cells.get_column("data_deficient_reasons").to_list()
            for reason in cell_reasons
        }
    )
    deficiency_states = set(cells.get_column("data_deficient_state").unique().to_list())
    if "unavailable" in deficiency_states:
        deficiency_state = "unavailable"
    elif "data_deficient" in deficiency_states:
        deficiency_state = "data_deficient"
    else:
        deficiency_state = "sufficient"

    return {
        "schema_version": GEOGRAPHIC_IMPACT_SUMMARY_SCHEMA_VERSION,
        **identity,
        "scope_level": node["scope_level"],
        "scope_id": node["scope_id"],
        "scope_name": node["scope_name"],
        "parent_scope_id": node["parent_scope_id"],
        "continent": node["continent"],
        "country_code": node["country_code"],
        "country": node["country"],
        "admin1": node["admin1"],
        **totals,
        "direct_inaturalist_delta_count": None,
        "cell_count": cells.height,
        "baseline_occupied_cell_count": int(
            cells.get_column("baseline_range_inference_eligible_count").gt(0).sum()
        ),
        "flickr_occupied_cell_count": int(cells.get_column("flickr_candidate_count").gt(0).sum()),
        "baseline_only_cell_count": int(cells.get_column("baseline_only_cell").sum()),
        "matched_cell_count": int(cells.get_column("matched_cell").sum()),
        "candidate_only_cell_count": candidate_only.height,
        "reviewed_additional_cell_count": int(cells.get_column("reviewed_additional_cell").sum()),
        "release_ready_additional_cell_count": int(
            cells.get_column("release_ready_additional_cell").sum()
        ),
        "nearest_baseline_distance_status": nearest_status,
        "maximum_nearest_baseline_distance_km": maximum_distance,
        "latest_baseline_event_date": cells.get_column("latest_baseline_event_date").max(),
        "latest_flickr_candidate_date": cells.get_column("latest_flickr_candidate_date").max(),
        "latest_reviewed_positive_date": cells.get_column("latest_reviewed_positive_date").max(),
        "latest_release_ready_date": cells.get_column("latest_release_ready_date").max(),
        "data_deficient_state": deficiency_state,
        "data_deficient_reasons": reasons,
    }


def _hierarchy_node_index(
    nodes: list[dict[str, object]],
    level: str,
    key: str,
) -> dict[str, dict[str, object]]:
    indexed: dict[str, dict[str, object]] = {}
    for node in nodes:
        if node.get("scope_level") != level:
            continue
        value = _required_text(node.get(key), f"{level} hierarchy {key}")
        if value in indexed:
            raise GeographicImpactMaterializationError(f"duplicate {level} hierarchy {key}")
        indexed[value] = node
    return indexed


def _admin1_node_index(
    nodes: list[dict[str, object]],
) -> dict[tuple[str, str], dict[str, object]]:
    indexed: dict[tuple[str, str], dict[str, object]] = {}
    for node in nodes:
        if node.get("scope_level") != "admin1":
            continue
        key = (
            _required_text(node.get("country_code"), "admin1 hierarchy country code"),
            _required_text(node.get("admin1"), "admin1 hierarchy name"),
        )
        if key in indexed:
            raise GeographicImpactMaterializationError("duplicate admin1 hierarchy identity")
        indexed[key] = node
    return indexed


def _validate_summaries(summaries: pl.DataFrame, cells: pl.DataFrame) -> None:
    if summaries.schema != geographic_impact_summary_schema():
        raise GeographicImpactMaterializationError("impact summary physical schema differs")
    summary_keys = ["spatial_resolution", "scope_level", "scope_id"]
    if summaries.select(pl.struct(summary_keys).n_unique()).item() != summaries.height:
        raise GeographicImpactMaterializationError("impact summary identity is not unique")
    global_rows = summaries.filter(pl.col("scope_level") == "global")
    if global_rows.height != cells.get_column("spatial_resolution").n_unique():
        raise GeographicImpactMaterializationError("global summary coverage differs")
    for row in summaries.iter_rows(named=True):
        assert_geographic_contract("geographic_impact_summary", _json_row(row))

    global_counts = global_rows.sort("spatial_resolution").select(
        "spatial_resolution",
        "cell_count",
        "baseline_union_count",
        "flickr_candidate_count",
    )
    cell_counts = (
        cells.group_by("spatial_resolution")
        .agg(
            pl.len().cast(pl.UInt64).alias("cell_count"),
            pl.col("baseline_union_count").sum(),
            pl.col("flickr_candidate_count").sum(),
        )
        .sort("spatial_resolution")
    )
    if not global_counts.equals(cell_counts):
        raise GeographicImpactMaterializationError("global summary totals differ from cells")


def _aggregate_baseline(frame: pl.DataFrame) -> pl.DataFrame:
    canonical = pl.col("canonical_flag")
    eligible = canonical & pl.col("range_inference_eligible")
    return (
        frame.group_by(_CELL_KEYS)
        .agg(
            pl.col("provider_relationship_id").n_unique().alias("provider_input_row_count"),
            pl.col("canonical_observation_id")
            .filter(canonical)
            .n_unique()
            .alias("baseline_union_count"),
            pl.col("canonical_observation_id")
            .filter(eligible)
            .n_unique()
            .alias("baseline_range_inference_eligible_count"),
            pl.col("canonical_observation_id")
            .filter(canonical & (pl.col("provider_source") == "gbif"))
            .n_unique()
            .alias("gbif_only_count"),
            pl.col("canonical_observation_id")
            .filter(canonical & (pl.col("provider_relationship_kind") == "inaturalist_via_gbif"))
            .n_unique()
            .alias("inaturalist_origin_through_gbif_count"),
            pl.col("provider_relationship_id")
            .filter(pl.col("exact_duplicate_removed"))
            .n_unique()
            .alias("duplicates_removed_count"),
            pl.col("unresolved_duplicate_group_id")
            .drop_nulls()
            .n_unique()
            .alias("unresolved_provider_duplicate_group_count"),
            pl.col("canonical_observation_id")
            .filter(canonical & (pl.col("preserved_specimen") | pl.col("fossil")))
            .n_unique()
            .alias("_preserved_or_fossil_count"),
            pl.col("canonical_observation_id")
            .filter(canonical & pl.col("coordinate_uncertainty_m").is_null())
            .n_unique()
            .alias("_unknown_coordinate_uncertainty_count"),
            pl.col("canonical_observation_id")
            .filter(canonical & pl.col("has_geospatial_issue"))
            .n_unique()
            .alias("_geospatial_issue_count"),
            pl.col("event_date").filter(eligible).max().alias("latest_baseline_event_date"),
        )
        .with_columns(
            (
                pl.col("baseline_union_count") - pl.col("baseline_range_inference_eligible_count")
            ).alias("baseline_excluded_occurrence_count")
        )
        .select(
            *_CELL_KEYS,
            "provider_input_row_count",
            "baseline_union_count",
            "baseline_range_inference_eligible_count",
            "baseline_excluded_occurrence_count",
            "gbif_only_count",
            "inaturalist_origin_through_gbif_count",
            "duplicates_removed_count",
            "unresolved_provider_duplicate_group_count",
            "_preserved_or_fossil_count",
            "_unknown_coordinate_uncertainty_count",
            "_geospatial_issue_count",
            "latest_baseline_event_date",
        )
    )


def aggregate_flickr_review_states(
    frame: pl.DataFrame,
    *,
    release_decisions: pl.DataFrame,
    quality_snapshot_ids: frozenset[str],
    scope: GeographicImpactScope,
) -> pl.DataFrame:
    expected_scope = {
        "project_id": scope.project_id,
        "run_id": scope.run_id,
        "accepted_taxon_key": scope.accepted_taxon_key,
        "baseline_snapshot_id": scope.baseline_snapshot_id,
        "flickr_snapshot_id": scope.flickr_snapshot_id,
    }
    validate_occurrence_release_decisions(
        release_decisions,
        quality_snapshot_ids=quality_snapshot_ids,
        expected_scope=expected_scope,
    )
    allowed_states = {
        "not_requested",
        "pending",
        "reviewed_target_positive",
        "reviewed_non_target",
        "uncertain",
        "media_failure",
        "deferred",
    }
    observed_states = set(frame.get_column("human_review_state").unique().to_list())
    unknown_states = observed_states - allowed_states
    if unknown_states:
        raise GeographicImpactMaterializationError(
            f"Flickr human review state is unsupported: {sorted(unknown_states)!r}"
        )
    release = release_decisions.rename(
        {name: f"release_{name}" for name in release_decisions.columns if name != "flickr_photo_id"}
    )
    unknown_release_photos = set(release.get_column("flickr_photo_id").to_list()) - set(
        frame.get_column("flickr_photo_id").unique().to_list()
    )
    if unknown_release_photos:
        raise GeographicImpactMaterializationError("release decision names an unknown Flickr photo")
    joined = frame.join(release, on="flickr_photo_id", how="left", validate="m:1")
    ready = pl.col("release_decision_status") == "release_ready"
    release_rows = joined.filter(ready)
    if release_rows.height:
        mismatch = release_rows.filter(
            (pl.col("human_review_state") != "reviewed_target_positive")
            | ~pl.col("human_supported")
            | (pl.col("consensus_outcome") != "yes")
            | (pl.col("decisive_review_count") == 0)
            | (pl.col("verification_campaign_id") != pl.col("release_verification_campaign_id"))
            | (pl.col("verification_item_id") != pl.col("release_verification_item_id"))
        )
        if mismatch.height:
            raise GeographicImpactMaterializationError(
                "release-ready decision differs from verification consensus"
            )
    supported = joined.filter(pl.col("cell_supported"))
    identity_columns = [*_CELL_KEYS, "flickr_photo_id"]
    if supported.select(pl.struct(identity_columns).n_unique()).item() != supported.height:
        raise GeographicImpactMaterializationError("Flickr cell/photo identity is duplicated")
    grouped = supported.group_by(_CELL_KEYS).agg(
        pl.col("flickr_photo_id").n_unique().alias("flickr_candidate_count"),
        pl.col("flickr_photo_id")
        .filter(pl.col("machine_screening_state") == "target")
        .n_unique()
        .alias("flickr_visually_eligible_count"),
        pl.col("flickr_photo_id")
        .filter(pl.col("human_review_state") == "reviewed_target_positive")
        .n_unique()
        .alias("reviewed_positive_count"),
        pl.col("flickr_photo_id")
        .filter(pl.col("human_review_state") == "reviewed_non_target")
        .n_unique()
        .alias("reviewed_negative_count"),
        pl.col("flickr_photo_id")
        .filter(pl.col("human_review_state") == "uncertain")
        .n_unique()
        .alias("uncertain_count"),
        pl.col("flickr_photo_id")
        .filter(pl.col("human_review_state").is_in(["not_requested", "pending"]))
        .n_unique()
        .alias("pending_count"),
        pl.col("flickr_photo_id")
        .filter(pl.col("human_review_state") == "media_failure")
        .n_unique()
        .alias("media_failure_count"),
        pl.col("flickr_photo_id")
        .filter(pl.col("human_review_state") == "deferred")
        .n_unique()
        .alias("skipped_count"),
        pl.col("flickr_photo_id").filter(ready).n_unique().alias("release_ready_count"),
        pl.col("verification_campaign_id")
        .drop_nulls()
        .unique()
        .sort()
        .alias("_verification_campaign_ids"),
        pl.col("release_quality_snapshot_id")
        .filter(ready)
        .drop_nulls()
        .unique()
        .sort()
        .alias("_quality_snapshot_ids"),
        pl.col("release_release_decision_id")
        .filter(ready)
        .drop_nulls()
        .unique()
        .sort()
        .alias("_release_decision_ids"),
        pl.col("release_event_date").filter(ready).max().alias("latest_reviewed_positive_date"),
        pl.col("release_event_date").filter(ready).max().alias("latest_release_ready_date"),
    )
    return grouped.with_columns(
        pl.col("_verification_campaign_ids")
        .map_elements(
            lambda values: _identity_set("verification-campaign", values),
            return_dtype=pl.String,
        )
        .alias("verification_campaign_id"),
        pl.col("_quality_snapshot_ids")
        .map_elements(
            lambda values: _identity_set("quality-snapshot", values),
            return_dtype=pl.String,
        )
        .alias("quality_snapshot_id"),
        pl.col("_release_decision_ids")
        .map_elements(
            lambda values: _identity_set("occurrence-release-decision", values),
            return_dtype=pl.String,
        )
        .alias("release_decision_id"),
    ).drop(
        "_verification_campaign_ids",
        "_quality_snapshot_ids",
        "_release_decision_ids",
    )


def _cell_scope_frame(cells: pl.DataFrame, lookup: OfflineCountryLookup) -> pl.DataFrame:
    rows: list[dict[str, object]] = []
    for row in cells.sort(_CELL_KEYS).iter_rows(named=True):
        resolution = int(row["spatial_resolution"])
        cell_id = _required_text(row["spatial_cell_id"], "spatial cell ID")
        if not h3.is_valid_cell(cell_id) or h3.get_resolution(cell_id) != resolution:
            raise GeographicImpactMaterializationError("spatial cell identity differs from H3")
        latitude, longitude = h3.cell_to_latlng(cell_id)
        parent = h3.cell_to_parent(cell_id, resolution - 1) if resolution > 0 else None
        country = lookup.assign(latitude=latitude, longitude=longitude)
        rows.append(
            {
                "spatial_resolution": resolution,
                "spatial_cell_id": cell_id,
                "parent_spatial_cell_id": parent,
                "continent": country.continent if country else None,
                "country_code": country.country_code if country else None,
                "country": country.country if country else None,
                "admin1": None,
                "centroid_latitude": latitude,
                "centroid_longitude": longitude,
            }
        )
    return pl.DataFrame(
        rows,
        schema={
            "spatial_resolution": pl.UInt8,
            "spatial_cell_id": pl.String,
            "parent_spatial_cell_id": pl.String,
            "continent": pl.String,
            "country_code": pl.String,
            "country": pl.String,
            "admin1": pl.String,
            "centroid_latitude": pl.Float64,
            "centroid_longitude": pl.Float64,
        },
    )


def _with_nearest_baseline_distance(joined: pl.DataFrame) -> pl.DataFrame:
    """Attach deterministic same-resolution candidate-to-baseline proximity."""

    required = {
        "spatial_resolution",
        "spatial_cell_id",
        "centroid_latitude",
        "centroid_longitude",
        "baseline_range_inference_eligible_count",
        "flickr_candidate_count",
    }
    if not required.issubset(joined.columns):
        raise GeographicImpactMaterializationError(
            "nearest baseline distance input columns are missing"
        )

    baseline_by_resolution: dict[int, list[tuple[str, float, float]]] = {}
    for row in joined.filter(pl.col("baseline_range_inference_eligible_count") > 0).iter_rows(
        named=True
    ):
        resolution = int(row["spatial_resolution"])
        baseline_by_resolution.setdefault(resolution, []).append(
            (
                _required_text(row["spatial_cell_id"], "baseline spatial cell ID"),
                float(row["centroid_latitude"]),
                float(row["centroid_longitude"]),
            )
        )
    for baselines in baseline_by_resolution.values():
        baselines.sort(key=lambda item: item[0])

    proximity_rows: list[dict[str, object]] = []
    for row in joined.iter_rows(named=True):
        eligible_count = int(row["baseline_range_inference_eligible_count"])
        candidate_count = int(row["flickr_candidate_count"])
        if eligible_count > 0:
            proximity_rows.append(_unavailable_distance_row("not_applicable"))
            continue
        baselines = baseline_by_resolution.get(int(row["spatial_resolution"]), [])
        if candidate_count == 0 or not baselines:
            proximity_rows.append(_unavailable_distance_row("unavailable"))
            continue

        latitude = float(row["centroid_latitude"])
        longitude = float(row["centroid_longitude"])
        nearest_cell_id, nearest_distance = min(
            [
                (
                    baseline_cell_id,
                    _haversine_km(
                        latitude,
                        longitude,
                        baseline_latitude,
                        baseline_longitude,
                    ),
                )
                for baseline_cell_id, baseline_latitude, baseline_longitude in baselines
            ],
            key=lambda item: (item[1], item[0]),
        )
        proximity_rows.append(
            {
                "nearest_baseline_distance_status": "available",
                "nearest_baseline_distance_km": nearest_distance,
                "nearest_baseline_cell_id": nearest_cell_id,
                "nearest_baseline_distance_method": NEAREST_BASELINE_DISTANCE_METHOD,
            }
        )

    proximity = pl.DataFrame(
        proximity_rows,
        schema={
            "nearest_baseline_distance_status": pl.String,
            "nearest_baseline_distance_km": pl.Float64,
            "nearest_baseline_cell_id": pl.String,
            "nearest_baseline_distance_method": pl.String,
        },
    )
    return joined.hstack(proximity)


def _unavailable_distance_row(status: str) -> dict[str, object]:
    return {
        "nearest_baseline_distance_status": status,
        "nearest_baseline_distance_km": None,
        "nearest_baseline_cell_id": None,
        "nearest_baseline_distance_method": None,
    }


def _haversine_km(
    latitude_a: float,
    longitude_a: float,
    latitude_b: float,
    longitude_b: float,
) -> float:
    """Return centroid great-circle distance using a fixed mean Earth radius."""

    latitude_a_radians = math.radians(latitude_a)
    latitude_b_radians = math.radians(latitude_b)
    latitude_delta = latitude_b_radians - latitude_a_radians
    longitude_delta = math.radians(longitude_b - longitude_a)
    haversine = (
        math.sin(latitude_delta / 2.0) ** 2
        + math.cos(latitude_a_radians)
        * math.cos(latitude_b_radians)
        * math.sin(longitude_delta / 2.0) ** 2
    )
    return 2.0 * MEAN_EARTH_RADIUS_KM * math.asin(math.sqrt(min(1.0, haversine)))


def _validate_inputs(
    baseline: pl.DataFrame,
    flickr: pl.DataFrame,
    country_hierarchy: Mapping[str, Any],
) -> GeographicImpactScope:
    if dict(baseline.schema) != baseline_occurrence_union_schema():
        raise GeographicImpactMaterializationError("baseline union schema differs")
    if dict(flickr.schema) != flickr_geography_verification_schema():
        raise GeographicImpactMaterializationError("Flickr verification geography schema differs")
    if not baseline.height or not flickr.height:
        raise GeographicImpactMaterializationError("geographic impact input is empty")
    baseline_scope = _single_values(
        baseline,
        [
            "project_id",
            "run_id",
            "registry_version",
            "accepted_taxon_key",
            "scientific_name",
            "baseline_snapshot_id",
            "grid_name",
            "grid_version",
            "provider_union_policy_version",
        ],
    )
    flickr_scope = _single_values(
        flickr,
        [
            "project_id",
            "run_id",
            "target_accepted_taxon_key",
            "scientific_name",
            "flickr_snapshot_id",
            "grid_name",
            "grid_version",
        ],
    )
    for baseline_name, flickr_name in (
        ("project_id", "project_id"),
        ("run_id", "run_id"),
        ("accepted_taxon_key", "target_accepted_taxon_key"),
        ("scientific_name", "scientific_name"),
        ("grid_name", "grid_name"),
        ("grid_version", "grid_version"),
    ):
        if baseline_scope[baseline_name] != flickr_scope[flickr_name]:
            raise GeographicImpactMaterializationError(
                f"baseline and Flickr {baseline_name} differ"
            )
    if baseline_scope["provider_union_policy_version"] != PROVIDER_UNION_POLICY_VERSION:
        raise GeographicImpactMaterializationError("provider union policy differs")
    baseline_resolutions = sorted(baseline.get_column("spatial_resolution").unique().to_list())
    flickr_resolutions = sorted(flickr.get_column("spatial_resolution").unique().to_list())
    if baseline_resolutions != flickr_resolutions:
        raise GeographicImpactMaterializationError("spatial resolutions differ")
    if country_hierarchy.get("schema_version") != "taxalens-country-hierarchy:v1.0.0":
        raise GeographicImpactMaterializationError("country hierarchy schema differs")
    hierarchy_id = _required_text(
        country_hierarchy.get("country_hierarchy_id"), "country hierarchy ID"
    )
    return GeographicImpactScope(
        project_id=baseline_scope["project_id"],
        run_id=baseline_scope["run_id"],
        registry_version=baseline_scope["registry_version"],
        accepted_taxon_key=baseline_scope["accepted_taxon_key"],
        scientific_name=baseline_scope["scientific_name"],
        baseline_snapshot_id=baseline_scope["baseline_snapshot_id"],
        flickr_snapshot_id=flickr_scope["flickr_snapshot_id"],
        grid_name=baseline_scope["grid_name"],
        grid_version=baseline_scope["grid_version"],
        country_hierarchy_id=hierarchy_id,
    )


def _validate_cells(
    cells: pl.DataFrame,
    baseline_cells: pl.DataFrame,
    flickr_cells: pl.DataFrame,
) -> None:
    if cells.schema != geographic_impact_cell_schema():
        raise GeographicImpactMaterializationError("impact cell physical schema differs")
    expected_keys = pl.concat(
        [baseline_cells.select(_CELL_KEYS), flickr_cells.select(_CELL_KEYS)]
    ).unique()
    if cells.height != expected_keys.height:
        raise GeographicImpactMaterializationError("full outer cell count differs")
    if cells.select(pl.struct(_CELL_KEYS).n_unique()).item() != cells.height:
        raise GeographicImpactMaterializationError("impact cell identity is not unique")
    invalid_reconciliation = cells.filter(
        (
            pl.col("provider_input_row_count")
            != pl.col("baseline_union_count") + pl.col("duplicates_removed_count")
        )
        | (
            pl.col("baseline_union_count")
            != pl.col("baseline_range_inference_eligible_count")
            + pl.col("baseline_excluded_occurrence_count")
        )
        | (
            pl.col("baseline_union_count")
            != pl.col("gbif_only_count") + pl.col("inaturalist_origin_through_gbif_count")
        )
        | (pl.col("pending_count") != pl.col("flickr_candidate_count"))
    )
    if invalid_reconciliation.height:
        raise GeographicImpactMaterializationError("impact cell counts do not reconcile")
    for row in cells.iter_rows(named=True):
        assert_geographic_contract("geographic_impact_cell", _json_row(row))


def _single_values(frame: pl.DataFrame, columns: list[str]) -> dict[str, str]:
    values: dict[str, str] = {}
    for column in columns:
        unique = frame.get_column(column).drop_nulls().unique().to_list()
        if len(unique) != 1:
            raise GeographicImpactMaterializationError(f"{column} is not single-scope")
        values[column] = _required_text(unique[0], column)
    return values


def _json_row(row: Mapping[str, Any]) -> dict[str, Any]:
    return {
        key: value.isoformat() if isinstance(value, date) else value for key, value in row.items()
    }


def _identity_set(prefix: str, values: object) -> str | None:
    if isinstance(values, pl.Series):
        raw_values = values.to_list()
    elif isinstance(values, list | tuple):
        raw_values = list(values)
    else:
        raise GeographicImpactMaterializationError("identity set has an unsupported value")
    items = sorted({_required_text(value, f"{prefix} identity") for value in raw_values})
    if not items:
        return None
    if len(items) == 1:
        return items[0]
    digest = hashlib.sha256(
        json.dumps(items, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    return f"{prefix}-set:v1:sha256:{digest}"


def _required_text(value: object, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise GeographicImpactMaterializationError(f"{label} must be non-empty")
    return value


__all__ = [
    "DEFAULT_BASELINE_UNION",
    "DEFAULT_COUNTRY_HIERARCHY",
    "DEFAULT_FLICKR_GEOGRAPHY",
    "GEOGRAPHIC_IMPACT_MATERIALIZATION_POLICY_VERSION",
    "OCCURRENCE_RELEASE_POLICY_VERSION",
    "GeographicImpactMaterializationError",
    "GeographicImpactScope",
    "aggregate_flickr_review_states",
    "build_committed_geographic_impact_cells",
    "build_committed_geographic_impact_summaries",
    "build_geographic_impact_cells",
    "build_geographic_impact_summaries",
    "geographic_impact_cell_schema",
    "geographic_impact_summary_schema",
]
