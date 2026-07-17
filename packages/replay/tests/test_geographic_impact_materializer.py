from __future__ import annotations

import polars as pl
import pytest
from packages.replay.src.geographic_impact_materializer import (
    DEFAULT_BASELINE_UNION,
    NEAREST_BASELINE_DISTANCE_METHOD,
    _haversine_km,
    _with_nearest_baseline_distance,
    geographic_impact_cell_schema,
    geographic_impact_summary_schema,
)
from packages.replay.src.offline_country_lookup import (
    OfflineCountryLookup,
    OfflineCountryLookupError,
)
from scripts.build_geographic_impact import (
    OUTPUT_CELLS,
    OUTPUT_SUMMARY,
    geographic_impact_build_id,
)


@pytest.fixture(scope="module")
def committed_cells() -> pl.DataFrame:
    return pl.read_parquet(OUTPUT_CELLS)


@pytest.fixture(scope="module")
def committed_summaries() -> pl.DataFrame:
    return pl.read_parquet(OUTPUT_SUMMARY)


def test_offline_country_lookup_assigns_only_unambiguous_bundled_polygons() -> None:
    lookup = OfflineCountryLookup.from_path()

    assert lookup.assign(latitude=-33.8688, longitude=151.2093).country_code == "AU"  # type: ignore[union-attr]
    assert lookup.assign(latitude=28.6139, longitude=77.209).country_code == "IN"  # type: ignore[union-attr]
    assert lookup.assign(latitude=0.0, longitude=-140.0) is None


def test_offline_country_lookup_rejects_invalid_coordinates() -> None:
    lookup = OfflineCountryLookup.from_path()

    with pytest.raises(OfflineCountryLookupError, match="latitude"):
        lookup.assign(latitude=91.0, longitude=0.0)


def test_committed_cells_are_a_real_full_outer_join(
    committed_cells: pl.DataFrame,
) -> None:
    assert committed_cells.schema == geographic_impact_cell_schema()
    assert committed_cells.height == 20_237
    assert (
        committed_cells.select(
            pl.struct(["spatial_resolution", "spatial_cell_id"]).n_unique()
        ).item()
        == committed_cells.height
    )
    assert committed_cells.get_column("geographic_impact_build_id").unique().to_list() == [
        geographic_impact_build_id()
    ]


def test_committed_cell_counts_reconcile_at_each_resolution(
    committed_cells: pl.DataFrame,
) -> None:
    by_resolution = {
        row["spatial_resolution"]: row
        for row in committed_cells.group_by("spatial_resolution")
        .agg(
            pl.len().alias("cell_count"),
            pl.col("baseline_union_count").sum(),
            pl.col("baseline_range_inference_eligible_count").sum(),
            pl.col("flickr_candidate_count").sum(),
            pl.col("candidate_only_cell").sum().alias("candidate_only_cell_count"),
        )
        .iter_rows(named=True)
    }

    assert by_resolution == {
        3: {
            "spatial_resolution": 3,
            "cell_count": 2_155,
            "baseline_union_count": 19_201,
            "baseline_range_inference_eligible_count": 630,
            "flickr_candidate_count": 13_416,
            "candidate_only_cell_count": 1_221,
        },
        5: {
            "spatial_resolution": 5,
            "cell_count": 7_163,
            "baseline_union_count": 19_201,
            "baseline_range_inference_eligible_count": 630,
            "flickr_candidate_count": 13_026,
            "candidate_only_cell_count": 3_075,
        },
        7: {
            "spatial_resolution": 7,
            "cell_count": 10_919,
            "baseline_union_count": 19_201,
            "baseline_range_inference_eligible_count": 630,
            "flickr_candidate_count": 7_932,
            "candidate_only_cell_count": 2_468,
        },
    }


def test_committed_cells_preserve_zero_review_and_unassigned_scope(
    committed_cells: pl.DataFrame,
) -> None:
    assert committed_cells.get_column("reviewed_positive_count").sum() == 0
    assert committed_cells.get_column("release_ready_count").sum() == 0
    assert committed_cells.get_column("reviewed_additional_cell").sum() == 0
    assert committed_cells.get_column("release_ready_additional_cell").sum() == 0
    assert committed_cells.filter(pl.col("country_code").is_null()).height == 2_160
    assert committed_cells.filter(
        pl.col("country_code").is_null()
        & (pl.col("continent").is_not_null() | pl.col("country").is_not_null())
    ).is_empty()


def test_committed_candidate_only_cells_have_same_resolution_baseline_proximity(
    committed_cells: pl.DataFrame,
) -> None:
    candidate_only = committed_cells.filter(pl.col("candidate_only_cell"))

    assert candidate_only.height == 6_764
    assert candidate_only.get_column("nearest_baseline_distance_status").unique().to_list() == [
        "available"
    ]
    assert candidate_only.get_column("nearest_baseline_distance_method").unique().to_list() == [
        NEAREST_BASELINE_DISTANCE_METHOD
    ]
    assert candidate_only.filter(
        pl.col("nearest_baseline_distance_km").is_null()
        | (pl.col("nearest_baseline_distance_km") <= 0)
        | pl.col("nearest_baseline_cell_id").is_null()
    ).is_empty()

    baseline_identities = committed_cells.select(
        pl.col("spatial_resolution").alias("spatial_resolution"),
        pl.col("spatial_cell_id").alias("nearest_baseline_cell_id"),
        pl.col("baseline_range_inference_eligible_count").alias("nearest_eligible_count"),
    )
    reconciled = candidate_only.join(
        baseline_identities,
        on=["spatial_resolution", "nearest_baseline_cell_id"],
        how="left",
        validate="m:1",
    )
    assert reconciled.filter(pl.col("nearest_eligible_count").fill_null(0) == 0).is_empty()


def test_committed_data_deficiency_reasons_are_derived_from_canonical_evidence(
    committed_cells: pl.DataFrame,
) -> None:
    assert committed_cells.get_column("data_deficient_state").unique().to_list() == [
        "data_deficient"
    ]
    assert committed_cells.filter(
        ~pl.col("data_deficient_reasons").list.contains("direct_inaturalist_delta_unavailable")
    ).is_empty()
    assert committed_cells.filter(
        pl.col("data_deficient_reasons").list.contains("no_baseline_rows_in_cell")
        != (pl.col("baseline_union_count") == 0)
    ).is_empty()
    assert committed_cells.filter(
        pl.col("data_deficient_reasons").list.contains("no_range_inference_eligible_baseline")
        != (
            (pl.col("baseline_union_count") > 0)
            & (pl.col("baseline_range_inference_eligible_count") == 0)
        )
    ).is_empty()
    assert committed_cells.filter(
        pl.col("data_deficient_reasons").list.contains("unresolved_provider_duplicates")
        != (pl.col("unresolved_provider_duplicate_group_count") > 0)
    ).is_empty()

    baseline = pl.read_parquet(DEFAULT_BASELINE_UNION)
    canonical = pl.col("canonical_flag")
    expected = baseline.group_by(["spatial_resolution", "spatial_cell_id"]).agg(
        pl.col("canonical_observation_id")
        .filter(canonical & (pl.col("preserved_specimen") | pl.col("fossil")))
        .n_unique()
        .alias("preserved_or_fossil_count"),
        pl.col("canonical_observation_id")
        .filter(canonical & pl.col("coordinate_uncertainty_m").is_null())
        .n_unique()
        .alias("unknown_uncertainty_count"),
        pl.col("canonical_observation_id")
        .filter(canonical & pl.col("has_geospatial_issue"))
        .n_unique()
        .alias("geospatial_issue_count"),
    )
    reconciled = committed_cells.join(
        expected,
        on=["spatial_resolution", "spatial_cell_id"],
        how="left",
        validate="m:1",
    ).with_columns(
        pl.col("preserved_or_fossil_count").fill_null(0),
        pl.col("unknown_uncertainty_count").fill_null(0),
        pl.col("geospatial_issue_count").fill_null(0),
    )
    for reason, expected_condition in (
        (
            "preserved_specimen_or_fossil_only",
            (pl.col("baseline_union_count") > 0)
            & (pl.col("preserved_or_fossil_count") == pl.col("baseline_union_count")),
        ),
        (
            "coordinate_uncertainty_unavailable_for_all_baseline_rows",
            (pl.col("baseline_union_count") > 0)
            & (pl.col("unknown_uncertainty_count") == pl.col("baseline_union_count")),
        ),
        (
            "all_baseline_rows_have_geospatial_issues",
            (pl.col("baseline_union_count") > 0)
            & (pl.col("geospatial_issue_count") == pl.col("baseline_union_count")),
        ),
    ):
        assert reconciled.filter(
            pl.col("data_deficient_reasons").list.contains(reason) != expected_condition
        ).is_empty()


def test_nearest_baseline_distance_uses_haversine_and_lexical_tie_breaking() -> None:
    joined = pl.DataFrame(
        {
            "spatial_resolution": [3, 3, 3, 5],
            "spatial_cell_id": ["baseline-z", "baseline-a", "candidate", "unmatched"],
            "centroid_latitude": [0.0, 0.0, 0.0, 1.0],
            "centroid_longitude": [-1.0, 1.0, 0.0, 1.0],
            "baseline_range_inference_eligible_count": [1, 1, 0, 0],
            "flickr_candidate_count": [0, 0, 1, 1],
        },
        schema={
            "spatial_resolution": pl.UInt8,
            "spatial_cell_id": pl.String,
            "centroid_latitude": pl.Float64,
            "centroid_longitude": pl.Float64,
            "baseline_range_inference_eligible_count": pl.UInt64,
            "flickr_candidate_count": pl.UInt64,
        },
    )

    actual = _with_nearest_baseline_distance(joined)
    candidate = actual.filter(pl.col("spatial_cell_id") == "candidate").row(0, named=True)
    unmatched = actual.filter(pl.col("spatial_cell_id") == "unmatched").row(0, named=True)

    assert candidate["nearest_baseline_distance_status"] == "available"
    assert candidate["nearest_baseline_cell_id"] == "baseline-a"
    assert candidate["nearest_baseline_distance_method"] == NEAREST_BASELINE_DISTANCE_METHOD
    assert candidate["nearest_baseline_distance_km"] == pytest.approx(
        _haversine_km(0.0, 0.0, 0.0, 1.0)
    )
    assert unmatched["nearest_baseline_distance_status"] == "unavailable"
    assert unmatched["nearest_baseline_distance_km"] is None


def test_committed_summaries_cover_supported_hierarchy_scopes(
    committed_summaries: pl.DataFrame,
) -> None:
    assert committed_summaries.schema == geographic_impact_summary_schema()
    assert committed_summaries.get_column("geographic_impact_build_id").unique().to_list() == [
        geographic_impact_build_id()
    ]
    assert committed_summaries.group_by("scope_level").len().sort("scope_level").to_dicts() == [
        {"scope_level": "continent", "len": 18},
        {"scope_level": "country", "len": 364},
        {"scope_level": "global", "len": 3},
    ]
    assert committed_summaries.filter(pl.col("scope_level") == "admin1").is_empty()


def test_global_summaries_reconcile_exactly_with_cells(
    committed_cells: pl.DataFrame,
    committed_summaries: pl.DataFrame,
) -> None:
    summary = (
        committed_summaries.filter(pl.col("scope_level") == "global")
        .select(
            "spatial_resolution",
            "cell_count",
            "baseline_union_count",
            "flickr_candidate_count",
            "candidate_only_cell_count",
        )
        .sort("spatial_resolution")
    )
    expected = (
        committed_cells.group_by("spatial_resolution")
        .agg(
            pl.len().cast(pl.UInt64).alias("cell_count"),
            pl.col("baseline_union_count").sum(),
            pl.col("flickr_candidate_count").sum(),
            pl.col("candidate_only_cell").sum().alias("candidate_only_cell_count"),
        )
        .sort("spatial_resolution")
    )
    assert summary.equals(expected)


def test_assigned_rollups_plus_unassigned_cells_reconcile_to_global(
    committed_cells: pl.DataFrame,
    committed_summaries: pl.DataFrame,
) -> None:
    countries = (
        committed_summaries.filter(pl.col("scope_level") == "country")
        .group_by("spatial_resolution")
        .agg(
            pl.col("cell_count").sum().alias("assigned_cell_count"),
            pl.col("baseline_union_count").sum().alias("assigned_baseline_count"),
            pl.col("flickr_candidate_count").sum().alias("assigned_flickr_count"),
        )
    )
    unassigned = (
        committed_cells.filter(pl.col("country_code").is_null())
        .group_by("spatial_resolution")
        .agg(
            pl.len().cast(pl.UInt64).alias("unassigned_cell_count"),
            pl.col("baseline_union_count").sum().alias("unassigned_baseline_count"),
            pl.col("flickr_candidate_count").sum().alias("unassigned_flickr_count"),
        )
    )
    global_rows = committed_summaries.filter(pl.col("scope_level") == "global")
    reconciled = global_rows.join(countries, on="spatial_resolution").join(
        unassigned, on="spatial_resolution"
    )

    assert reconciled.filter(
        (pl.col("cell_count") != pl.col("assigned_cell_count") + pl.col("unassigned_cell_count"))
        | (
            pl.col("baseline_union_count")
            != pl.col("assigned_baseline_count") + pl.col("unassigned_baseline_count")
        )
        | (
            pl.col("flickr_candidate_count")
            != pl.col("assigned_flickr_count") + pl.col("unassigned_flickr_count")
        )
    ).is_empty()
