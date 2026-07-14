from pathlib import Path

from packages.replay.src.biominer_query_geography_adapter import (
    QueryGeographyAdapterError,
    adapt_query_geography_artifacts,
)


def test_adapt_query_geography_artifacts_from_fixture() -> None:
    manifest = Path("packages/replay/tests/fixtures/run_manifest_query_geography.json")
    result = adapt_query_geography_artifacts(
        manifest_path=manifest,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    query_rows = result["query_definitions"]
    assert len(query_rows) == 3
    assert query_rows[0]["query_definition_id"] == "qd-001"
    assert query_rows[1]["query_eligible"] is False
    assert query_rows[2]["enabled"] is False

    summary = result["query_definition_summary"]
    assert summary["run_id"] == "fixture-query-geography-0001"
    assert summary["total_query_definitions"] == 3
    assert summary["eligible_query_definitions"] == 2
    assert summary["ineligible_query_definitions"] == 1
    assert summary["disabled_query_definitions"] == 1
    assert summary["query_definitions_by_source"] == {"registry": 2, "api": 1}
    assert summary["query_definitions_by_rank"] == {"species": 1, "genus": 1, "family": 1}
    assert summary["max_search_priority"] == 3

    assert len(result["geographic_spread_rows"]) == 2
    assert len(result["geographic_occurrence_evidence_rows"]) == 2
    assert len(result["taxon_geographic_summary_rows"]) == 1
    assert result["geographic_occurrence_evidence_rows"][0]["admin1_code"] == "KA"
    assert result["taxon_geographic_summary_rows"][0]["occupied_envelope"] == {
        "south": 8.1,
        "north": 26.8,
        "west": 73.0,
        "east": 83.9,
        "crosses_dateline": False,
    }
    assert result["taxon_geographic_summary_rows"][0]["range_source_coverage"] == [
        {"gbif": 2},
        {"iNaturalist": 1},
    ]

    spread_manifest_summary = result["geographic_spread_manifest_summary"]
    assert spread_manifest_summary["status"] == "complete"
    assert spread_manifest_summary["evidence_row_count"] == 2
    assert spread_manifest_summary["spread_row_count"] == 2

    summary_manifest_summary = result["geographic_summary_manifest_summary"]
    assert summary_manifest_summary["status"] == "complete"
    assert summary_manifest_summary["qa_warning_count"] == 2
    assert summary_manifest_summary["summary_row_count"] == 1

    compatibility = result["compatibility"]
    assert compatibility["query_definition_rows_read"] == 3
    assert compatibility["taxon_geographic_spread_rows_read"] == 2
    assert compatibility["taxon_geographic_summary_rows_read"] == 1
    assert compatibility["geographic_occurrence_evidence_rows_read"] == 2


def test_adapt_query_geography_artifacts_rejects_invalid_biominer_sha() -> None:
    manifest = Path("packages/replay/tests/fixtures/run_manifest_query_geography.json")
    try:
        adapt_query_geography_artifacts(manifest_path=manifest, biominer_commit="bad-sha")
    except QueryGeographyAdapterError as exc:
        assert "40-character" in str(exc)
    else:
        assert False


def test_adapt_query_geography_artifacts_missing_artifacts() -> None:
    manifest = Path("packages/replay/tests/fixtures/run_manifest.json")
    result = adapt_query_geography_artifacts(
        manifest_path=manifest,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["query_definitions"] == []
    assert result["geographic_spread_rows"] == []
    assert result["query_definition_summary"]["query_definition_artifact_path"] is None
    notes = result["compatibility"]["notes"]
    assert any("did not declare query definition artifact path" in note for note in notes)


def test_adapt_query_geography_artifacts_normalizes_structured_range_source_coverage() -> None:
    manifest = Path(
        "packages/replay/tests/fixtures/run_manifest_query_geography_structured_summary.json"
    )
    result = adapt_query_geography_artifacts(
        manifest_path=manifest,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )
    row = result["taxon_geographic_summary_rows"][0]
    assert row["range_source_coverage"] == [
        {"gbif": 2},
        {"iNaturalist": 1},
    ]


def test_adapt_query_geography_artifacts_normalizes_passed_statuses() -> None:
    manifest = Path(
        "packages/replay/tests/fixtures/run_manifest_query_geography_status_passed.json"
    )
    result = adapt_query_geography_artifacts(
        manifest_path=manifest,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["geographic_spread_manifest_summary"]["status"] == "complete"
    assert result["geographic_summary_manifest_summary"]["status"] == "complete"
    assert result["geographic_summary_manifest_summary"]["qa_status"] == "complete"
