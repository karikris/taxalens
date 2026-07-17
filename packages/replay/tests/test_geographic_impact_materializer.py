from __future__ import annotations

import polars as pl
import pytest
from packages.replay.src.geographic_impact_materializer import (
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
