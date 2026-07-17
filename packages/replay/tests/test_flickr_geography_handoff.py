from __future__ import annotations

import json
from pathlib import Path

import polars as pl
import pytest
from packages.replay.src.biominer_flickr_geography_handoff import (
    DEFAULT_MANIFEST,
    FlickrGeographyHandoffError,
    verify_flickr_geography_handoff,
)
from packages.replay.src.flickr_geography_long import (
    FlickrGeographyLongError,
    build_flickr_geography_long,
    load_flickr_geography_scope,
)
from packages.replay.src.flickr_geography_verification import (
    build_committed_flickr_geography_verification,
)
from scripts.build_flickr_geography_long import (
    build_outputs as build_long_outputs,
)
from scripts.build_flickr_geography_long import (
    check_outputs as check_long_outputs,
)
from scripts.build_flickr_geography_verification import (
    build_outputs as build_verification_outputs,
)
from scripts.build_flickr_geography_verification import (
    check_outputs as check_verification_outputs,
)

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
SOURCE_PARQUET = REPOSITORY_ROOT / "demo/source/biominer_phase14/analytics/flickr_geography.parquet"


def test_real_flickr_geography_handoff_is_checksum_and_precision_verified() -> None:
    frame = verify_flickr_geography_handoff()

    assert frame.height == 13_501
    assert frame.get_column("flickr_photo_id").n_unique() == 13_501
    assert frame.get_column("country_code").null_count() == 13_501
    assert frame.get_column("admin1").null_count() == 13_501
    assert {
        row["coordinate_quality"]: row["len"]
        for row in frame.group_by("coordinate_quality").len().iter_rows(named=True)
    } == {
        "flickr_world": 27,
        "flickr_country": 54,
        "flickr_region": 390,
        "flickr_city": 5_094,
        "flickr_street": 7_932,
        "unknown_precision": 4,
    }


def test_rejects_handoff_with_changed_observed_count(tmp_path: Path) -> None:
    payload = json.loads(DEFAULT_MANIFEST.read_text(encoding="utf-8"))
    payload["observed_counts"]["canonical_photo_count"] = 1
    manifest = tmp_path / "flickr_geography_handoff_manifest.json"
    manifest.write_text(json.dumps(payload), encoding="utf-8")

    with pytest.raises(FlickrGeographyHandoffError, match="observed counts differ"):
        verify_flickr_geography_handoff(manifest_path=manifest)


def test_committed_long_and_verification_outputs_are_deterministic() -> None:
    long_outputs = build_long_outputs()
    verification_outputs = build_verification_outputs()

    assert check_long_outputs(long_outputs) == []
    assert check_verification_outputs(verification_outputs) == []


def test_real_verification_binding_preserves_pending_zero_outcome_state() -> None:
    frame = build_committed_flickr_geography_verification()
    photos = frame.unique("flickr_photo_id")

    assert photos.height == 13_501
    assert photos.filter(pl.col("verification_item_id").is_not_null()).height == 49
    assert photos.filter(pl.col("human_review_state") == "pending").height == 49
    assert photos.filter(pl.col("dataset_split") == "final_test").height == 49
    assert photos.filter(pl.col("reviewer_assignment_count") > 0).height == 0
    assert photos.filter(pl.col("human_reviewed")).height == 0
    assert photos.filter(pl.col("human_supported")).height == 0


@pytest.mark.parametrize(
    ("quality", "expected_resolutions", "unsupported_status"),
    (
        ("flickr_world", (), "unsupported_precision"),
        ("flickr_country", (), "unsupported_precision"),
        ("flickr_region", (3,), "unsupported_precision"),
        ("flickr_city", (3, 5), "unsupported_precision"),
        ("flickr_street", (3, 5, 7), "unsupported_precision"),
        ("unknown_precision", (), "unsupported_precision"),
        ("invalid", (), "invalid_coordinate"),
        ("missing", (), "unavailable_geography"),
    ),
)
def test_precision_policy_never_populates_an_unsupported_cell(
    quality: str,
    expected_resolutions: tuple[int, ...],
    unsupported_status: str,
) -> None:
    source = _precision_source(quality)
    normalized = build_flickr_geography_long(
        source,
        scope=load_flickr_geography_scope(),
    )
    supported = normalized.filter(pl.col("cell_supported"))
    unsupported = normalized.filter(~pl.col("cell_supported"))

    assert normalized.height == 3
    assert tuple(supported.get_column("spatial_resolution").to_list()) == expected_resolutions
    assert unsupported.get_column("spatial_cell_id").null_count() == unsupported.height
    if unsupported.height:
        assert set(unsupported.get_column("cell_support_status").to_list()) == {unsupported_status}
    if quality != "flickr_street":
        assert normalized.filter(
            (pl.col("spatial_resolution") == 7) & pl.col("cell_supported")
        ).is_empty()


def test_rejects_city_precision_with_a_manufactured_local_cell() -> None:
    source = _precision_source("flickr_city")
    local_cell = (
        pl.read_parquet(SOURCE_PARQUET)
        .filter(pl.col("local_cell_id").is_not_null())
        .get_column("local_cell_id")
        .item(0)
    )
    source = source.with_columns(pl.lit(local_cell).alias("local_cell_id"))

    with pytest.raises(FlickrGeographyLongError, match="cell support differs at resolution 7"):
        build_flickr_geography_long(
            source,
            scope=load_flickr_geography_scope(),
        )


def test_long_form_preserves_source_warnings_for_every_resolution() -> None:
    source = _precision_source("flickr_region")
    normalized = build_flickr_geography_long(
        source,
        scope=load_flickr_geography_scope(),
    )

    assert (
        normalized.get_column("geography_warning").to_list()
        == ["coordinate_precision_limits_cells"] * 3
    )
    assert (
        normalized.get_column("geography_warnings").to_list()
        == [["coordinate_precision_limits_cells"]] * 3
    )


def _precision_source(quality: str) -> pl.DataFrame:
    real = pl.read_parquet(SOURCE_PARQUET)
    street = real.filter(pl.col("local_cell_id").is_not_null()).row(0, named=True)
    row = dict(street)
    row["flickr_photo_id"] = f"precision-{quality}"
    row["source_record_hash"] = f"sha256:{quality}"
    row["coordinate_quality"] = quality
    row["coarse_cell_id"] = None
    row["regional_cell_id"] = None
    row["local_cell_id"] = None
    row["geography_warning"] = "coordinate_precision_limits_cells"
    row["geography_warnings"] = ["coordinate_precision_limits_cells"]
    if quality in {"flickr_region", "flickr_city", "flickr_street"}:
        row["coarse_cell_id"] = street["coarse_cell_id"]
    if quality in {"flickr_city", "flickr_street"}:
        row["regional_cell_id"] = street["regional_cell_id"]
    if quality == "flickr_street":
        row["local_cell_id"] = street["local_cell_id"]
        row["geography_warning"] = None
        row["geography_warnings"] = []
    if quality == "invalid":
        row.update(
            {
                "latitude": None,
                "longitude": None,
                "coordinate_accuracy": None,
                "coordinate_source": None,
                "geotag_available": False,
                "geography_warning": "invalid_latitude",
                "geography_warnings": ["invalid_latitude"],
            }
        )
    if quality == "missing":
        row.update(
            {
                "latitude": None,
                "longitude": None,
                "coordinate_accuracy": None,
                "coordinate_source": None,
                "geotag_available": False,
                "geography_warning": "coordinates_missing",
                "geography_warnings": ["coordinates_missing"],
            }
        )
    return pl.DataFrame([row], schema=dict(real.schema))
