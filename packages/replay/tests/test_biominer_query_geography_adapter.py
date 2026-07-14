import json
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


def test_adapt_query_geography_artifacts_marks_parquet_artifacts_as_unparsed(
    tmp_path: Path,
) -> None:
    manifest = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_query_geography.json").read_text(
            encoding="utf-8"
        )
    )
    manifest["outputs"]["query_definitions"] = "query_definitions.parquet"
    manifest["outputs"]["taxon_geographic_spread"] = "taxon_geographic_spread.parquet"
    manifest["outputs"]["geographic_occurrence_evidence"] = (
        "geographic_occurrence_evidence.parquet"
    )
    manifest["outputs"]["taxon_geographic_summary"] = "taxon_geographic_summary.parquet"
    manifest["outputs"]["geographic_spread_manifest"] = "geographic_spread_manifest.parquet"
    manifest["outputs"]["geographic_summary_manifest"] = "geographic_summary_manifest.parquet"
    manifest["outputs"]["geographic_qa_findings"] = "geographic_qa_findings.parquet"

    manifest_path = tmp_path / "run_manifest_query_geography_parquet.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    result = adapt_query_geography_artifacts(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["query_definitions"] == []
    assert result["geographic_spread_rows"] == []
    assert result["geographic_occurrence_evidence_rows"] == []
    assert result["taxon_geographic_summary_rows"] == []
    assert result["query_definition_summary"]["total_query_definitions"] is None
    assert result["compatibility"]["query_definition_rows_read"] == 0
    assert result["compatibility"]["taxon_geographic_spread_rows_read"] == 0
    assert result["compatibility"]["geographic_occurrence_evidence_rows_read"] == 0
    assert result["compatibility"]["taxon_geographic_summary_rows_read"] == 0
    assert (
        "query definitions artifact is parquet and not parsed in deterministic replay fixtures: "
        f"{manifest_path.parent / 'query_definitions.parquet'}"
        in result["compatibility"]["notes"]
    )
    assert (
        "taxon_geographic_spread artifact is parquet and not parsed in deterministic replay fixtures: "
        f"{manifest_path.parent / 'taxon_geographic_spread.parquet'}"
        in result["compatibility"]["notes"]
    )
    assert (
        "geographic_occurrence_evidence artifact is parquet and not parsed in deterministic replay fixtures: "
        f"{manifest_path.parent / 'geographic_occurrence_evidence.parquet'}"
        in result["compatibility"]["notes"]
    )
    assert (
        "taxon_geographic_summary artifact is parquet and not parsed in deterministic replay fixtures: "
        f"{manifest_path.parent / 'taxon_geographic_summary.parquet'}"
        in result["compatibility"]["notes"]
    )
    assert (
        "geographic_spread_manifest is parquet and not parsed in deterministic replay fixtures: "
        f"{manifest_path.parent / 'geographic_spread_manifest.parquet'}"
        in result["compatibility"]["notes"]
    )
    assert (
        "geographic_summary_manifest is parquet and not parsed in deterministic replay fixtures: "
        f"{manifest_path.parent / 'geographic_summary_manifest.parquet'}"
        in result["compatibility"]["notes"]
    )


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


def test_adapt_query_geography_artifacts_normalizes_qa_status_aliases() -> None:
    manifest = Path(
        "packages/replay/tests/fixtures/run_manifest_query_geography_status_alias.json"
    )
    result = adapt_query_geography_artifacts(
        manifest_path=manifest,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["geographic_summary_manifest_summary"]["status"] == "complete"
    assert result["geographic_summary_manifest_summary"]["qa_status"] == "warning"


def test_adapt_query_geography_artifacts_normalizes_completed_status_alias() -> None:
    manifest = Path(
        "packages/replay/tests/fixtures/run_manifest_query_geography_status_completed.json"
    )
    result = adapt_query_geography_artifacts(
        manifest_path=manifest,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["geographic_summary_manifest_summary"]["status"] == "complete"
    assert result["geographic_summary_manifest_summary"]["qa_status"] == "complete"


def test_adapt_query_geography_artifacts_normalizes_success_aliases(tmp_path: Path) -> None:
    manifest = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_query_geography_status_passed.json").read_text(
            encoding="utf-8"
        )
    )
    spread_manifest = json.loads(
        Path("packages/replay/tests/fixtures/geographic_spread_manifest_passed.json").read_text(
            encoding="utf-8"
        )
    )
    summary_manifest = json.loads(
        Path("packages/replay/tests/fixtures/geographic_summary_manifest_passed.json").read_text(
            encoding="utf-8"
        )
    )

    spread_manifest["status"] = "SUCCESS"
    summary_manifest["status"] = "SUCCESS"
    summary_manifest["qa_status"] = "warn"

    manifest["outputs"]["geographic_spread_manifest"] = "geographic_spread_manifest_alias.json"
    manifest["outputs"]["geographic_summary_manifest"] = "geographic_summary_manifest_alias.json"

    manifest_path = tmp_path / "run_manifest_query_geography_alias.json"
    spread_path = tmp_path / "geographic_spread_manifest_alias.json"
    summary_path = tmp_path / "geographic_summary_manifest_alias.json"

    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    spread_path.write_text(json.dumps(spread_manifest), encoding="utf-8")
    summary_path.write_text(json.dumps(summary_manifest), encoding="utf-8")

    result = adapt_query_geography_artifacts(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert (
        result["geographic_spread_manifest_summary"]["status"] == "complete"
    )
    assert (
        result["geographic_summary_manifest_summary"]["status"] == "complete"
    )
    assert (
        result["geographic_summary_manifest_summary"]["qa_status"] == "warning"
    )


def test_adapt_query_geography_artifacts_preserves_ok_status(tmp_path: Path) -> None:
    manifest = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_query_geography_status_passed.json").read_text(
            encoding="utf-8"
        )
    )
    spread_manifest = json.loads(
        Path("packages/replay/tests/fixtures/geographic_spread_manifest_passed.json").read_text(
            encoding="utf-8"
        )
    )
    summary_manifest = json.loads(
        Path("packages/replay/tests/fixtures/geographic_summary_manifest_passed.json").read_text(
            encoding="utf-8"
        )
    )

    spread_manifest["status"] = "OK"
    summary_manifest["status"] = "OK"
    summary_manifest["qa_status"] = "OK"

    manifest["outputs"]["geographic_spread_manifest"] = "geographic_spread_manifest_ok.json"
    manifest["outputs"]["geographic_summary_manifest"] = "geographic_summary_manifest_ok.json"

    manifest_path = tmp_path / "run_manifest_query_geography_ok.json"
    spread_path = tmp_path / "geographic_spread_manifest_ok.json"
    summary_path = tmp_path / "geographic_summary_manifest_ok.json"

    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    spread_path.write_text(json.dumps(spread_manifest), encoding="utf-8")
    summary_path.write_text(json.dumps(summary_manifest), encoding="utf-8")

    result = adapt_query_geography_artifacts(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["geographic_spread_manifest_summary"]["status"] == "ok"
    assert result["geographic_summary_manifest_summary"]["status"] == "ok"
    assert result["geographic_summary_manifest_summary"]["qa_status"] == "ok"


def test_adapt_query_geography_artifacts_normalizes_succeeded_status_aliases(tmp_path: Path) -> None:
    manifest = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_query_geography_status_passed.json").read_text(
            encoding="utf-8"
        )
    )
    spread_manifest = json.loads(
        Path("packages/replay/tests/fixtures/geographic_spread_manifest_passed.json").read_text(
            encoding="utf-8"
        )
    )
    summary_manifest = json.loads(
        Path("packages/replay/tests/fixtures/geographic_summary_manifest_passed.json").read_text(
            encoding="utf-8"
        )
    )

    spread_manifest["status"] = "succeeded"
    summary_manifest["status"] = "succeeded"
    summary_manifest["qa_status"] = "succeeded"

    manifest["outputs"]["geographic_spread_manifest"] = "geographic_spread_manifest_succeeded.json"
    manifest["outputs"]["geographic_summary_manifest"] = "geographic_summary_manifest_succeeded.json"

    manifest_path = tmp_path / "run_manifest_query_geography_succeeded.json"
    spread_path = tmp_path / "geographic_spread_manifest_succeeded.json"
    summary_path = tmp_path / "geographic_summary_manifest_succeeded.json"

    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    spread_path.write_text(json.dumps(spread_manifest), encoding="utf-8")
    summary_path.write_text(json.dumps(summary_manifest), encoding="utf-8")

    result = adapt_query_geography_artifacts(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["geographic_spread_manifest_summary"]["status"] == "complete"
    assert result["geographic_summary_manifest_summary"]["status"] == "complete"
    assert result["geographic_summary_manifest_summary"]["qa_status"] == "complete"


def test_adapt_query_geography_artifacts_normalizes_pass_alias(tmp_path: Path) -> None:
    manifest = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_query_geography_status_passed.json").read_text(
            encoding="utf-8"
        )
    )
    spread_manifest = json.loads(
        Path("packages/replay/tests/fixtures/geographic_spread_manifest_passed.json").read_text(
            encoding="utf-8"
        )
    )
    summary_manifest = json.loads(
        Path("packages/replay/tests/fixtures/geographic_summary_manifest_passed.json").read_text(
            encoding="utf-8"
        )
    )

    spread_manifest["status"] = "PASS"
    summary_manifest["status"] = "PASS"
    summary_manifest["qa_status"] = "PASS"

    manifest["outputs"]["geographic_spread_manifest"] = "geographic_spread_manifest_alias_pass.json"
    manifest["outputs"]["geographic_summary_manifest"] = "geographic_summary_manifest_alias_pass.json"

    manifest_path = tmp_path / "run_manifest_query_geography_alias_pass.json"
    spread_path = tmp_path / "geographic_spread_manifest_alias_pass.json"
    summary_path = tmp_path / "geographic_summary_manifest_alias_pass.json"

    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    spread_path.write_text(json.dumps(spread_manifest), encoding="utf-8")
    summary_path.write_text(json.dumps(summary_manifest), encoding="utf-8")

    result = adapt_query_geography_artifacts(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["geographic_spread_manifest_summary"]["status"] == "complete"
    assert result["geographic_summary_manifest_summary"]["status"] == "complete"
    assert result["geographic_summary_manifest_summary"]["qa_status"] == "complete"


def test_adapt_query_geography_artifacts_preserves_partial_and_incomplete_statuses(
    tmp_path: Path,
) -> None:
    manifest = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_query_geography_status_passed.json").read_text(
            encoding="utf-8"
        )
    )
    spread_manifest = json.loads(
        Path("packages/replay/tests/fixtures/geographic_spread_manifest_passed.json").read_text(
            encoding="utf-8"
        )
    )
    summary_manifest = json.loads(
        Path("packages/replay/tests/fixtures/geographic_summary_manifest_passed.json").read_text(
            encoding="utf-8"
        )
    )

    spread_manifest["status"] = "partial"
    summary_manifest["status"] = "incomplete"
    summary_manifest["qa_status"] = "partial"

    manifest["outputs"]["geographic_spread_manifest"] = "geographic_spread_manifest_partial.json"
    manifest["outputs"]["geographic_summary_manifest"] = "geographic_summary_manifest_incomplete.json"

    manifest_path = tmp_path / "run_manifest_query_geography_partial.json"
    spread_path = tmp_path / "geographic_spread_manifest_partial.json"
    summary_path = tmp_path / "geographic_summary_manifest_incomplete.json"

    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    spread_path.write_text(json.dumps(spread_manifest), encoding="utf-8")
    summary_path.write_text(json.dumps(summary_manifest), encoding="utf-8")

    result = adapt_query_geography_artifacts(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["geographic_spread_manifest_summary"]["status"] == "partial"
    assert result["geographic_summary_manifest_summary"]["status"] == "incomplete"
    assert result["geographic_summary_manifest_summary"]["qa_status"] == "partial"


def test_adapt_query_geography_artifacts_normalizes_all_known_status_aliases(tmp_path: Path) -> None:
    source_manifest = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_query_geography_status_passed.json").read_text(
            encoding="utf-8"
        )
    )
    spread_template = json.loads(
        Path("packages/replay/tests/fixtures/geographic_spread_manifest_passed.json").read_text(
            encoding="utf-8"
        )
    )
    summary_template = json.loads(
        Path("packages/replay/tests/fixtures/geographic_summary_manifest_passed.json").read_text(
            encoding="utf-8"
        )
    )

    aliases = [
        ("succeeded", "complete"),
        ("pass", "complete"),
        ("passed", "complete"),
        ("complete", "complete"),
        ("completed", "complete"),
        ("done", "complete"),
        ("success", "complete"),
        ("warn", "warning"),
        ("warning", "warning"),
        ("failed", "failed"),
        ("running", "running"),
        ("ok", "ok"),
        ("incomplete", "incomplete"),
        ("partial", "partial"),
        ("unknown", "unknown"),
    ]

    for status, expected in aliases:
        manifest = json.loads(json.dumps(source_manifest))
        spread_manifest = json.loads(json.dumps(spread_template))
        summary_manifest = json.loads(json.dumps(summary_template))

        manifest["outputs"]["geographic_spread_manifest"] = f"geographic_spread_manifest_{status}.json"
        manifest["outputs"]["geographic_summary_manifest"] = f"geographic_summary_manifest_{status}.json"

        spread_manifest["status"] = status
        summary_manifest["status"] = status
        summary_manifest["qa_status"] = status

        manifest_path = tmp_path / f"run_manifest_query_geography_{status}.json"
        spread_path = tmp_path / f"geographic_spread_manifest_{status}.json"
        summary_path = tmp_path / f"geographic_summary_manifest_{status}.json"

        manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
        spread_path.write_text(json.dumps(spread_manifest), encoding="utf-8")
        summary_path.write_text(json.dumps(summary_manifest), encoding="utf-8")

        result = adapt_query_geography_artifacts(
            manifest_path=manifest_path,
            biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
        )

        assert result["geographic_spread_manifest_summary"]["status"] == expected
        assert result["geographic_summary_manifest_summary"]["status"] == expected
        assert result["geographic_summary_manifest_summary"]["qa_status"] == (
            "warning" if status in {"warn", "warning"} else expected
        )


def test_adapt_query_geography_artifacts_rejects_invalid_manifest_json(tmp_path: Path) -> None:
    manifest_text = Path(
        "packages/replay/tests/fixtures/run_manifest_query_geography_status_passed.json"
    ).read_text(encoding="utf-8")
    invalid_manifest = tmp_path / "invalid_query_geography_manifest.json"
    invalid_manifest.write_text(manifest_text.rstrip("}"), encoding="utf-8")

    try:
        adapt_query_geography_artifacts(
            manifest_path=invalid_manifest,
            biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
        )
    except QueryGeographyAdapterError as exc:
        assert "not valid JSON" in str(exc).lower()
    else:
        assert False


def test_adapt_query_geography_artifacts_continues_when_one_artifact_is_malformed(
    tmp_path: Path,
) -> None:
    source_manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_query_geography.json"
        ).read_text(encoding="utf-8")
    )
    spread_payload = json.loads(
        Path("packages/replay/tests/fixtures/taxon_geographic_spread.json").read_text(
            encoding="utf-8"
        )
    )
    occurrence_payload = json.loads(
        Path("packages/replay/tests/fixtures/geographic_occurrence_evidence.json").read_text(
            encoding="utf-8"
        )
    )
    summary_payload = json.loads(
        Path("packages/replay/tests/fixtures/taxon_geographic_summary.json").read_text(
            encoding="utf-8"
        )
    )
    spread_manifest = json.loads(
        Path("packages/replay/tests/fixtures/geographic_spread_manifest.json").read_text(
            encoding="utf-8"
        )
    )
    summary_manifest = json.loads(
        Path("packages/replay/tests/fixtures/geographic_summary_manifest_passed.json").read_text(
            encoding="utf-8"
        )
    )

    source_manifest["outputs"]["query_definitions"] = "bad_query_definitions.json"
    source_manifest["outputs"]["taxon_geographic_spread"] = "taxon_geographic_spread.json"
    source_manifest["outputs"]["geographic_occurrence_evidence"] = "geographic_occurrence_evidence.json"
    source_manifest["outputs"]["taxon_geographic_summary"] = "taxon_geographic_summary.json"
    source_manifest["outputs"]["geographic_spread_manifest"] = "geographic_spread_manifest.json"
    source_manifest["outputs"]["geographic_summary_manifest"] = "geographic_summary_manifest.json"

    manifest_path = tmp_path / "run_manifest_query_geography.json"
    bad_query_path = tmp_path / "bad_query_definitions.json"
    spread_payload_path = tmp_path / "taxon_geographic_spread.json"
    occurrence_payload_path = tmp_path / "geographic_occurrence_evidence.json"
    summary_payload_path = tmp_path / "taxon_geographic_summary.json"
    spread_manifest_path = tmp_path / "geographic_spread_manifest.json"
    summary_manifest_path = tmp_path / "geographic_summary_manifest.json"

    manifest_path.write_text(json.dumps(source_manifest), encoding="utf-8")
    bad_query_path.write_text("[", encoding="utf-8")
    spread_payload_path.write_text(json.dumps(spread_payload), encoding="utf-8")
    occurrence_payload_path.write_text(json.dumps(occurrence_payload), encoding="utf-8")
    summary_payload_path.write_text(json.dumps(summary_payload), encoding="utf-8")
    spread_manifest_path.write_text(json.dumps(spread_manifest), encoding="utf-8")
    summary_manifest_path.write_text(json.dumps(summary_manifest), encoding="utf-8")

    result = adapt_query_geography_artifacts(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["query_definitions"] == []
    assert result["query_definition_summary"]["total_query_definitions"] is None
    assert result["compatibility"]["query_definition_rows_read"] == 0
    assert any(
        "failed to parse query definitions artifact" in note
        for note in result["compatibility"]["notes"]
    )
    assert len(result["geographic_spread_rows"]) == 2
    assert len(result["geographic_occurrence_evidence_rows"]) == 2


def test_adapt_query_geography_artifacts_reports_non_object_manifest_payloads(
    tmp_path: Path,
) -> None:
    source_manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_query_geography.json"
        ).read_text(encoding="utf-8")
    )
    source_manifest["outputs"]["query_definitions"] = "query_definitions.json"
    source_manifest["outputs"]["taxon_geographic_spread"] = "taxon_geographic_spread.json"
    source_manifest["outputs"]["geographic_occurrence_evidence"] = (
        "geographic_occurrence_evidence.json"
    )
    source_manifest["outputs"]["taxon_geographic_summary"] = "taxon_geographic_summary.json"
    source_manifest["outputs"]["geographic_spread_manifest"] = "spread_manifest_bad.json"
    source_manifest["outputs"]["geographic_summary_manifest"] = "summary_manifest_bad.json"

    manifest_path = tmp_path / "run_manifest_query_geography_non_object_manifests.json"
    manifest_path.write_text(json.dumps(source_manifest), encoding="utf-8")

    (tmp_path / "query_definitions.json").write_text(
        Path("packages/replay/tests/fixtures/query_definitions.json").read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    (tmp_path / "taxon_geographic_spread.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_spread.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_occurrence_evidence.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_occurrence_evidence.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "taxon_geographic_summary.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_summary.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "spread_manifest_bad.json").write_text(json.dumps([1, 2, 3]), encoding="utf-8")
    (tmp_path / "summary_manifest_bad.json").write_text(json.dumps([1, 2]), encoding="utf-8")

    result = adapt_query_geography_artifacts(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert len(result["query_definitions"]) == 3
    assert len(result["geographic_spread_rows"]) == 2
    assert len(result["geographic_occurrence_evidence_rows"]) == 2
    assert len(result["taxon_geographic_summary_rows"]) == 1
    assert result["geographic_spread_manifest_summary"]["status"] is None
    assert result["geographic_summary_manifest_summary"]["status"] is None
    assert result["geographic_summary_manifest_summary"]["qa_status"] is None
    assert (
        f"geographic_spread_manifest was not a JSON object at {manifest_path.parent / 'spread_manifest_bad.json'}"
        in result["compatibility"]["notes"]
    )
    assert (
        f"geographic_summary_manifest was not a JSON object at {manifest_path.parent / 'summary_manifest_bad.json'}"
        in result["compatibility"]["notes"]
    )


def test_adapt_query_geography_artifacts_ignores_non_mapping_query_rows(tmp_path: Path) -> None:
    source_manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_query_geography.json"
        ).read_text(encoding="utf-8")
    )
    source_manifest["outputs"]["query_definitions"] = "query_definitions_mixed.json"

    manifest_path = tmp_path / "run_manifest_query_geography_mixed_queries.json"
    manifest_path.write_text(json.dumps(source_manifest), encoding="utf-8")
    (tmp_path / "query_definitions_mixed.json").write_text(
        json.dumps([
            {"query_definition_id": "qd-mixed-001", "query_eligible": True, "enabled": True},
            "not-a-mapping",
            5,
        ]),
        encoding="utf-8",
    )

    # Keep other artifacts valid to exercise only query-definition row filtering behavior.
    (tmp_path / "taxon_geographic_spread.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_spread.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_occurrence_evidence.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_occurrence_evidence.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "taxon_geographic_summary.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_summary.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_spread_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_spread_manifest.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_summary_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_summary_manifest_passed.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )

    result = adapt_query_geography_artifacts(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert len(result["query_definitions"]) == 1
    assert result["query_definitions"][0]["query_definition_id"] == "qd-mixed-001"
    assert result["query_definition_summary"]["total_query_definitions"] == 1
    assert result["query_definition_summary"]["query_curation_rule_count"] == 0


def test_adapt_query_geography_artifacts_uses_definitions_key_in_query_definitions_payload(
    tmp_path: Path,
) -> None:
    source_manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_query_geography.json"
        ).read_text(encoding="utf-8")
    )
    source_manifest["outputs"]["query_definitions"] = "query_definitions_keyed.json"

    manifest_path = tmp_path / "run_manifest_query_geography_query_definitions_keyed.json"
    manifest_path.write_text(json.dumps(source_manifest), encoding="utf-8")
    (tmp_path / "query_definitions_keyed.json").write_text(
        json.dumps({"definitions": [
            {"query_definition_id": "qd-keyed-001", "query_eligible": True, "enabled": True},
        ]}),
        encoding="utf-8",
    )

    # Keep remaining artifacts valid so only query-definition extraction path is evaluated.
    (tmp_path / "taxon_geographic_spread.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_spread.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_occurrence_evidence.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_occurrence_evidence.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "taxon_geographic_summary.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_summary.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_spread_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_spread_manifest.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_summary_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_summary_manifest_passed.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )

    result = adapt_query_geography_artifacts(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert len(result["query_definitions"]) == 1
    assert result["query_definitions"][0]["query_definition_id"] == "qd-keyed-001"
    assert result["query_definition_summary"]["total_query_definitions"] == 1


def test_adapt_query_geography_artifacts_prefers_rows_key_even_when_empty(
    tmp_path: Path,
) -> None:
    source_manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_query_geography.json"
        ).read_text(encoding="utf-8")
    )
    source_manifest["outputs"]["query_definitions"] = "query_definitions_rows_empty_with_definitions.json"

    manifest_path = tmp_path / "run_manifest_query_geography_rows_empty_with_definitions.json"
    manifest_path.write_text(json.dumps(source_manifest), encoding="utf-8")
    (tmp_path / "query_definitions_rows_empty_with_definitions.json").write_text(
        json.dumps(
            {
                "rows": [],
                "definitions": [
                    {
                        "query_definition_id": "qd-legacy-001",
                        "query_eligible": True,
                        "enabled": True,
                    }
                ],
            }
        ),
        encoding="utf-8",
    )

    # Keep remaining artifacts valid so this test focuses on query-definition extraction precedence.
    (tmp_path / "taxon_geographic_spread.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_spread.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_occurrence_evidence.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_occurrence_evidence.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "taxon_geographic_summary.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_summary.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_spread_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_spread_manifest.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_summary_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_summary_manifest_passed.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )

    result = adapt_query_geography_artifacts(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["query_definitions"] == []
    assert result["query_definition_summary"]["total_query_definitions"] is None
    assert result["query_definition_summary"]["eligible_query_definitions"] is None
    assert result["query_definition_summary"]["ineligible_query_definitions"] is None
    assert result["query_definition_summary"]["disabled_query_definitions"] is None
    assert result["query_definition_summary"]["query_definitions_by_source"] is None
    assert result["query_definition_summary"]["query_definitions_by_rank"] is None
    assert result["query_definition_summary"]["max_search_priority"] is None
    assert result["query_definition_summary"]["query_curation_rule_count"] is None
    assert result["compatibility"]["query_definition_rows_read"] == 0


def test_adapt_query_geography_artifacts_prefers_empty_rows_key_over_candidates(
    tmp_path: Path,
) -> None:
    source_manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_query_geography.json"
        ).read_text(encoding="utf-8")
    )
    source_manifest["outputs"]["query_definitions"] = "query_definitions_rows_empty_with_candidates.json"

    manifest_path = tmp_path / "run_manifest_query_geography_rows_empty_with_candidates.json"
    manifest_path.write_text(json.dumps(source_manifest), encoding="utf-8")
    (tmp_path / "query_definitions_rows_empty_with_candidates.json").write_text(
        json.dumps(
            {
                "rows": [],
                "candidates": [
                    {
                        "query_definition_id": "qd-candidate-001",
                        "query_eligible": False,
                        "enabled": True,
                    }
                ],
            }
        ),
        encoding="utf-8",
    )

    (tmp_path / "taxon_geographic_spread.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_spread.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_occurrence_evidence.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_occurrence_evidence.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "taxon_geographic_summary.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_summary.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_spread_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_spread_manifest.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_summary_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_summary_manifest_passed.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )

    result = adapt_query_geography_artifacts(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["query_definitions"] == []
    assert result["query_definition_summary"]["total_query_definitions"] is None
    assert result["query_definition_summary"]["eligible_query_definitions"] is None
    assert result["query_definition_summary"]["ineligible_query_definitions"] is None
    assert result["query_definition_summary"]["disabled_query_definitions"] is None
    assert result["query_definition_summary"]["query_curation_rule_count"] is None
    assert result["compatibility"]["query_definition_rows_read"] == 0


def test_adapt_query_geography_artifacts_prefers_rows_key_when_non_list(
    tmp_path: Path,
) -> None:
    source_manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_query_geography.json"
        ).read_text(encoding="utf-8")
    )
    source_manifest["outputs"]["query_definitions"] = "query_definitions_rows_bad_with_definitions.json"

    manifest_path = tmp_path / "run_manifest_query_geography_rows_bad_with_definitions.json"
    manifest_path.write_text(json.dumps(source_manifest), encoding="utf-8")
    (tmp_path / "query_definitions_rows_bad_with_definitions.json").write_text(
        json.dumps(
            {
                "rows": {"query_definition_id": "qd-bad-rows"},
                "definitions": [
                    {
                        "query_definition_id": "qd-legacy-001",
                        "query_eligible": True,
                        "enabled": True,
                    }
                ],
            }
        ),
        encoding="utf-8",
    )

    # Keep remaining artifacts valid so this test isolates query-definition extraction precedence.
    (tmp_path / "taxon_geographic_spread.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_spread.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_occurrence_evidence.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_occurrence_evidence.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "taxon_geographic_summary.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_summary.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_spread_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_spread_manifest.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_summary_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_summary_manifest_passed.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )

    result = adapt_query_geography_artifacts(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["query_definitions"] == []
    assert result["query_definition_summary"]["total_query_definitions"] is None
    assert result["query_definition_summary"]["eligible_query_definitions"] is None
    assert result["query_definition_summary"]["ineligible_query_definitions"] is None
    assert result["query_definition_summary"]["disabled_query_definitions"] is None
    assert result["query_definition_summary"]["query_definitions_by_source"] is None
    assert result["query_definition_summary"]["query_definitions_by_rank"] is None
    assert result["query_definition_summary"]["max_search_priority"] is None
    assert result["query_definition_summary"]["query_curation_rule_count"] is None
    assert result["compatibility"]["query_definition_rows_read"] == 0


def test_adapt_query_geography_artifacts_ignores_empty_query_definitions_object(
    tmp_path: Path,
) -> None:
    source_manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_query_geography.json"
        ).read_text(encoding="utf-8")
    )
    source_manifest["outputs"]["query_definitions"] = "query_definitions_empty_object.json"

    manifest_path = tmp_path / "run_manifest_query_geography_empty_object.json"
    manifest_path.write_text(json.dumps(source_manifest), encoding="utf-8")
    (tmp_path / "query_definitions_empty_object.json").write_text(
        json.dumps({}),
        encoding="utf-8",
    )

    # Keep other artifacts valid so this test focuses on query-definition extraction.
    (tmp_path / "taxon_geographic_spread.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_spread.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_occurrence_evidence.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_occurrence_evidence.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "taxon_geographic_summary.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_summary.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_spread_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_spread_manifest.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_summary_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_summary_manifest_passed.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )

    result = adapt_query_geography_artifacts(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["query_definitions"] == []
    assert result["query_definition_summary"]["total_query_definitions"] is None
    assert result["query_definition_summary"]["eligible_query_definitions"] is None
    assert result["query_definition_summary"]["ineligible_query_definitions"] is None
    assert result["query_definition_summary"]["disabled_query_definitions"] is None
    assert result["query_definition_summary"]["query_definitions_by_source"] is None
    assert result["query_definition_summary"]["query_definitions_by_rank"] is None
    assert result["query_definition_summary"]["max_search_priority"] is None
    assert result["query_definition_summary"]["query_curation_rule_count"] is None
    assert result["compatibility"]["query_definition_rows_read"] == 0


def test_adapt_query_geography_artifacts_prefers_empty_candidates_key_as_authoritative(
    tmp_path: Path,
) -> None:
    source_manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_query_geography.json"
        ).read_text(encoding="utf-8")
    )
    source_manifest["outputs"]["query_definitions"] = (
        "query_definitions_empty_candidates_key.json"
    )

    manifest_path = tmp_path / "run_manifest_query_geography_empty_candidates_key.json"
    manifest_path.write_text(json.dumps(source_manifest), encoding="utf-8")
    (tmp_path / "query_definitions_empty_candidates_key.json").write_text(
        json.dumps({"candidates": []}),
        encoding="utf-8",
    )

    # Keep other artifacts valid so this test isolates query-definition payload authority.
    (tmp_path / "taxon_geographic_spread.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_spread.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_occurrence_evidence.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_occurrence_evidence.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "taxon_geographic_summary.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_summary.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_spread_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_spread_manifest.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_summary_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_summary_manifest_passed.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )

    result = adapt_query_geography_artifacts(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["query_definitions"] == []
    assert result["query_definition_summary"]["total_query_definitions"] is None
    assert result["query_definition_summary"]["eligible_query_definitions"] is None
    assert result["query_definition_summary"]["ineligible_query_definitions"] is None
    assert result["query_definition_summary"]["disabled_query_definitions"] is None
    assert result["query_definition_summary"]["query_curation_rule_count"] is None
    assert result["compatibility"]["query_definition_rows_read"] == 0


def test_adapt_query_geography_artifacts_treats_query_definitions_key_empty_array(
    tmp_path: Path,
) -> None:
    source_manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_query_geography.json"
        ).read_text(encoding="utf-8")
    )
    source_manifest["outputs"]["query_definitions"] = "query_definitions_empty_object_key.json"

    manifest_path = tmp_path / "run_manifest_query_geography_query_definitions_empty_object_key.json"
    manifest_path.write_text(json.dumps(source_manifest), encoding="utf-8")
    (tmp_path / "query_definitions_empty_object_key.json").write_text(
        json.dumps({"query_definitions": []}),
        encoding="utf-8",
    )

    # Keep other artifacts valid so this test exercises only query-definition extraction.
    (tmp_path / "taxon_geographic_spread.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_spread.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_occurrence_evidence.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_occurrence_evidence.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "taxon_geographic_summary.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_summary.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_spread_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_spread_manifest.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_summary_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_summary_manifest_passed.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )

    result = adapt_query_geography_artifacts(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["query_definitions"] == []
    assert result["query_definition_summary"]["total_query_definitions"] is None
    assert result["query_definition_summary"]["eligible_query_definitions"] is None
    assert result["query_definition_summary"]["ineligible_query_definitions"] is None
    assert result["query_definition_summary"]["disabled_query_definitions"] is None
    assert result["query_definition_summary"]["query_definitions_by_source"] is None
    assert result["query_definition_summary"]["query_definitions_by_rank"] is None
    assert result["query_definition_summary"]["max_search_priority"] is None
    assert result["query_definition_summary"]["query_curation_rule_count"] is None
    assert result["compatibility"]["query_definition_rows_read"] == 0


def test_adapt_query_geography_artifacts_prefers_query_definitions_key_after_missing_rows_and_data(
    tmp_path: Path,
) -> None:
    source_manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_query_geography.json"
        ).read_text(encoding="utf-8")
    )
    source_manifest["outputs"]["query_definitions"] = (
        "query_definitions_query_key.json"
    )

    manifest_path = tmp_path / "run_manifest_query_geography_query_key.json"
    manifest_path.write_text(json.dumps(source_manifest), encoding="utf-8")
    (tmp_path / "query_definitions_query_key.json").write_text(
        json.dumps(
            {
                "query_definitions": [
                    {
                        "query_definition_id": "qd-query-001",
                        "query_eligible": True,
                        "enabled": True,
                    }
                ],
                "candidates": [
                    {
                        "query_definition_id": "qd-candidate-001",
                        "query_eligible": False,
                        "enabled": False,
                    }
                ],
            }
        ),
        encoding="utf-8",
    )

    # Keep remaining artifacts valid so this test targets query-definition payload key precedence.
    (tmp_path / "taxon_geographic_spread.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_spread.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_occurrence_evidence.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_occurrence_evidence.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "taxon_geographic_summary.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_summary.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_spread_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_spread_manifest.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_summary_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_summary_manifest_passed.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )

    result = adapt_query_geography_artifacts(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert len(result["query_definitions"]) == 1
    assert result["query_definitions"][0]["query_definition_id"] == "qd-query-001"
    assert result["query_definition_summary"]["total_query_definitions"] == 1
    assert result["query_definition_summary"]["eligible_query_definitions"] == 1
    assert result["query_definition_summary"]["disabled_query_definitions"] == 0


def test_adapt_query_geography_artifacts_prefers_data_key_when_rows_missing(tmp_path: Path) -> None:
    source_manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_query_geography.json"
        ).read_text(encoding="utf-8")
    )
    source_manifest["outputs"]["query_definitions"] = "query_definitions_data_key_only.json"

    manifest_path = tmp_path / "run_manifest_query_geography_data_key.json"
    manifest_path.write_text(json.dumps(source_manifest), encoding="utf-8")
    (tmp_path / "query_definitions_data_key_only.json").write_text(
        json.dumps(
            {
                "data": [
                    {"query_definition_id": "qd-data-key-001", "query_eligible": True, "enabled": True}
                ],
                "definitions": [
                    {
                        "query_definition_id": "qd-definition-ignored",
                        "query_eligible": False,
                        "enabled": False,
                    }
                ],
            }
        ),
        encoding="utf-8",
    )

    (tmp_path / "taxon_geographic_spread.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_spread.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_occurrence_evidence.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_occurrence_evidence.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "taxon_geographic_summary.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_summary.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_spread_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_spread_manifest.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_summary_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_summary_manifest_passed.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )

    result = adapt_query_geography_artifacts(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert len(result["query_definitions"]) == 1
    assert result["query_definitions"][0]["query_definition_id"] == "qd-data-key-001"
    assert result["query_definition_summary"]["total_query_definitions"] == 1
    assert result["query_definition_summary"]["query_definitions_by_rank"] is None


def test_adapt_query_geography_artifacts_prefers_rows_key_over_data_and_definitions(
    tmp_path: Path,
) -> None:
    source_manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_query_geography.json"
        ).read_text(encoding="utf-8")
    )
    source_manifest["outputs"]["query_definitions"] = (
        "query_definitions_rows_and_data_and_definitions.json"
    )

    manifest_path = tmp_path / "run_manifest_query_geography_rows_and_data_and_definitions.json"
    manifest_path.write_text(json.dumps(source_manifest), encoding="utf-8")
    (tmp_path / "query_definitions_rows_and_data_and_definitions.json").write_text(
        json.dumps(
            {
                "rows": [
                    {
                        "query_definition_id": "qd-rows-key-001",
                        "query_eligible": False,
                        "enabled": False,
                    }
                ],
                "data": [
                    {
                        "query_definition_id": "qd-data-key-ignored",
                        "query_eligible": True,
                        "enabled": True,
                    }
                ],
                "definitions": [
                    {
                        "query_definition_id": "qd-definition-ignored",
                        "query_eligible": True,
                        "enabled": True,
                    }
                ],
            }
        ),
        encoding="utf-8",
    )

    (tmp_path / "taxon_geographic_spread.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_spread.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_occurrence_evidence.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_occurrence_evidence.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "taxon_geographic_summary.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_summary.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_spread_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_spread_manifest.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_summary_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_summary_manifest_passed.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )

    result = adapt_query_geography_artifacts(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert len(result["query_definitions"]) == 1
    assert result["query_definitions"][0]["query_definition_id"] == "qd-rows-key-001"
    assert result["query_definition_summary"]["total_query_definitions"] == 1
    assert result["query_definition_summary"]["ineligible_query_definitions"] == 1
    assert result["query_definition_summary"]["disabled_query_definitions"] == 1


def test_adapt_query_geography_artifacts_treats_non_list_candidates_key_as_no_rows(
    tmp_path: Path,
) -> None:
    source_manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_query_geography.json"
        ).read_text(encoding="utf-8")
    )
    source_manifest["outputs"]["query_definitions"] = (
        "query_definitions_candidates_non_list.json"
    )

    manifest_path = tmp_path / "run_manifest_query_geography_candidates_non_list.json"
    manifest_path.write_text(json.dumps(source_manifest), encoding="utf-8")
    (tmp_path / "query_definitions_candidates_non_list.json").write_text(
        json.dumps(
            {
                "candidates": {
                    "query_definition_id": "qd-candidates-not-list",
                    "query_eligible": False,
                    "enabled": False,
                }
            }
        ),
        encoding="utf-8",
    )

    (tmp_path / "taxon_geographic_spread.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_spread.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_occurrence_evidence.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_occurrence_evidence.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "taxon_geographic_summary.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_summary.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_spread_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_spread_manifest.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_summary_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_summary_manifest_passed.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )

    result = adapt_query_geography_artifacts(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["query_definitions"] == []
    assert result["query_definition_summary"]["total_query_definitions"] is None
    assert result["query_definition_summary"]["eligible_query_definitions"] is None
    assert result["query_definition_summary"]["ineligible_query_definitions"] is None
    assert result["query_definition_summary"]["disabled_query_definitions"] is None
    assert result["query_definition_summary"]["query_curation_rule_count"] is None
    assert result["compatibility"]["query_definition_rows_read"] == 0


def test_adapt_query_geography_artifacts_treats_non_list_definitions_key_as_no_rows(
    tmp_path: Path,
) -> None:
    source_manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_query_geography.json"
        ).read_text(encoding="utf-8")
    )
    source_manifest["outputs"]["query_definitions"] = (
        "query_definitions_definitions_non_list.json"
    )

    manifest_path = tmp_path / "run_manifest_query_geography_definitions_non_list.json"
    manifest_path.write_text(json.dumps(source_manifest), encoding="utf-8")
    (tmp_path / "query_definitions_definitions_non_list.json").write_text(
        json.dumps(
            {
                "definitions": {
                    "query_definition_id": "qd-definitions-should-ignore",
                    "query_eligible": True,
                    "enabled": False,
                },
                "candidates": [
                    {
                        "query_definition_id": "qd-candidate-ignored",
                        "query_eligible": False,
                        "enabled": False,
                    }
                ],
            }
        ),
        encoding="utf-8",
    )

    # Keep remaining artifacts valid so this test focuses on authoritative key behavior.
    (tmp_path / "taxon_geographic_spread.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_spread.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_occurrence_evidence.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_occurrence_evidence.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "taxon_geographic_summary.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_summary.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_spread_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_spread_manifest.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_summary_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_summary_manifest_passed.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )

    result = adapt_query_geography_artifacts(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["query_definitions"] == []
    assert result["query_definition_summary"]["total_query_definitions"] is None
    assert result["query_definition_summary"]["eligible_query_definitions"] is None
    assert result["query_definition_summary"]["ineligible_query_definitions"] is None
    assert result["query_definition_summary"]["disabled_query_definitions"] is None
    assert result["query_definition_summary"]["query_curation_rule_count"] is None
    assert result["compatibility"]["query_definition_rows_read"] == 0


def test_adapt_query_geography_artifacts_treats_non_list_data_key_as_no_rows(
    tmp_path: Path,
) -> None:
    source_manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_query_geography.json"
        ).read_text(encoding="utf-8")
    )
    source_manifest["outputs"]["query_definitions"] = (
        "query_definitions_data_non_list.json"
    )

    manifest_path = tmp_path / "run_manifest_query_geography_data_non_list.json"
    manifest_path.write_text(json.dumps(source_manifest), encoding="utf-8")
    (tmp_path / "query_definitions_data_non_list.json").write_text(
        json.dumps(
            {
                "data": {
                    "query_definition_id": "qd-data-not-list",
                    "query_eligible": True,
                    "enabled": True,
                },
                "definitions": [
                    {
                        "query_definition_id": "qd-definition-ignored",
                        "query_eligible": False,
                        "enabled": False,
                    }
                ],
            }
        ),
        encoding="utf-8",
    )

    # Keep remaining artifacts valid so this test focuses on authoritative key behavior.
    (tmp_path / "taxon_geographic_spread.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_spread.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_occurrence_evidence.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_occurrence_evidence.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "taxon_geographic_summary.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_summary.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_spread_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_spread_manifest.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_summary_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_summary_manifest_passed.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )

    result = adapt_query_geography_artifacts(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["query_definitions"] == []
    assert result["query_definition_summary"]["total_query_definitions"] is None
    assert result["query_definition_summary"]["eligible_query_definitions"] is None
    assert result["query_definition_summary"]["ineligible_query_definitions"] is None
    assert result["query_definition_summary"]["disabled_query_definitions"] is None
    assert result["query_definition_summary"]["query_curation_rule_count"] is None
    assert result["compatibility"]["query_definition_rows_read"] == 0


def test_adapt_query_geography_artifacts_definitions_key_uses_summary_counts_for_valid_rows(
    tmp_path: Path,
) -> None:
    source_manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_query_geography.json"
        ).read_text(encoding="utf-8")
    )
    source_manifest["outputs"]["query_definitions"] = "query_definitions_mixed_keyed.json"

    manifest_path = tmp_path / "run_manifest_query_geography_mixed_keyed.json"
    manifest_path.write_text(json.dumps(source_manifest), encoding="utf-8")
    (tmp_path / "query_definitions_mixed_keyed.json").write_text(
        json.dumps({
            "definitions": [
                {
                    "query_definition_id": "qd-mixed-keyed-001",
                    "query_eligible": True,
                    "enabled": True,
                    "source": "registry",
                    "accepted_rank": "species",
                    "search_priority": 4,
                    "query_curation_rules": [{"name": "name_contains_family"}],
                },
                "not-a-mapping",
                5,
                {
                    "query_definition_id": "qd-mixed-keyed-002",
                    "query_eligible": False,
                    "enabled": False,
                    "source": "api",
                    "accepted_rank": "genus",
                    "search_priority": 2,
                    "query_curation_rules": [
                        {"name": "high_trust_tier"},
                        {"name": "has_species_rank"},
                    ],
                },
                {
                    "query_definition_id": "qd-mixed-keyed-003",
                    "query_eligible": False,
                    "enabled": False,
                    "source": "registry",
                    "accepted_rank": "family",
                    "search_priority": 1,
                },
            ]
        }),
        encoding="utf-8",
    )

    # Keep other artifacts valid so this test targets query-definition summary behavior only.
    (tmp_path / "taxon_geographic_spread.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_spread.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_occurrence_evidence.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_occurrence_evidence.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "taxon_geographic_summary.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_summary.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_spread_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_spread_manifest.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_summary_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_summary_manifest_passed.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )

    result = adapt_query_geography_artifacts(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert len(result["query_definitions"]) == 3
    assert result["query_definition_summary"]["total_query_definitions"] == 3
    assert result["query_definition_summary"]["eligible_query_definitions"] == 1
    assert result["query_definition_summary"]["ineligible_query_definitions"] == 2
    assert result["query_definition_summary"]["disabled_query_definitions"] == 2
    assert result["query_definition_summary"]["query_definitions_by_source"] == {
        "registry": 2,
        "api": 1,
    }
    assert result["query_definition_summary"]["query_definitions_by_rank"] == {
        "species": 1,
        "genus": 1,
        "family": 1,
    }
    assert result["query_definition_summary"]["max_search_priority"] == 4
    assert result["query_definition_summary"]["query_curation_rule_count"] == 3


def test_adapt_query_geography_artifacts_prefers_rows_key_over_definitions_key(
    tmp_path: Path,
) -> None:
    source_manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_query_geography.json"
        ).read_text(encoding="utf-8")
    )
    source_manifest["outputs"]["query_definitions"] = "query_definitions_multi_key.json"

    manifest_path = tmp_path / "run_manifest_query_geography_multi_key.json"
    manifest_path.write_text(json.dumps(source_manifest), encoding="utf-8")
    (tmp_path / "query_definitions_multi_key.json").write_text(
        json.dumps(
            {
                "rows": [
                    {
                        "query_definition_id": "qd-rows-001",
                        "query_eligible": False,
                        "enabled": False,
                        "source": "api",
                        "accepted_rank": "family",
                        "search_priority": 8,
                        "query_curation_rules": [
                            {"name": "rows-wins"},
                        ],
                    }
                ],
                "definitions": [
                    {
                        "query_definition_id": "qd-definitions-001",
                        "query_eligible": True,
                        "enabled": True,
                        "source": "registry",
                        "accepted_rank": "species",
                        "search_priority": 2,
                        "query_curation_rules": [{"name": "definitions-loses"}],
                    }
                ],
                "query_definitions": [
                    {
                        "query_definition_id": "qd-legacy-001",
                        "query_eligible": True,
                        "enabled": True,
                        "source": "registry",
                        "accepted_rank": "species",
                        "search_priority": 3,
                        "query_curation_rules": [{"name": "legacy-loses"}],
                    }
                ],
            }
        ),
        encoding="utf-8",
    )

    # Keep other artifacts valid so this test isolates query-definition extraction behavior.
    (tmp_path / "taxon_geographic_spread.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_spread.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_occurrence_evidence.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_occurrence_evidence.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "taxon_geographic_summary.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_summary.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_spread_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_spread_manifest.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_summary_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_summary_manifest_passed.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )

    result = adapt_query_geography_artifacts(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert len(result["query_definitions"]) == 1
    assert result["query_definitions"][0]["query_definition_id"] == "qd-rows-001"
    assert result["query_definition_summary"]["total_query_definitions"] == 1
    assert result["query_definition_summary"]["eligible_query_definitions"] == 0
    assert result["query_definition_summary"]["ineligible_query_definitions"] == 1
    assert result["query_definition_summary"]["disabled_query_definitions"] == 1
    assert result["query_definition_summary"]["query_definitions_by_source"] == {"api": 1}
    assert result["query_definition_summary"]["query_definitions_by_rank"] == {"family": 1}
    assert result["query_definition_summary"]["max_search_priority"] == 8
    assert result["query_definition_summary"]["query_curation_rule_count"] == 1


def test_adapt_query_geography_artifacts_prefers_data_key_after_rows(
    tmp_path: Path,
) -> None:
    source_manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_query_geography.json"
        ).read_text(encoding="utf-8")
    )
    source_manifest["outputs"]["query_definitions"] = "query_definitions_data_key.json"

    manifest_path = tmp_path / "run_manifest_query_geography_data_key.json"
    manifest_path.write_text(json.dumps(source_manifest), encoding="utf-8")
    (tmp_path / "query_definitions_data_key.json").write_text(
        json.dumps({
            "data": [
                {
                    "query_definition_id": "qd-data-001",
                    "query_eligible": True,
                    "enabled": True,
                    "source": "registry",
                    "accepted_rank": "species",
                    "search_priority": 9,
                    "query_curation_rules": [{"name": "data-priority"}],
                },
                42,
                {
                    "query_definition_id": "qd-data-002",
                    "query_eligible": False,
                    "enabled": False,
                    "source": "api",
                    "accepted_rank": "genus",
                    "search_priority": 4,
                },
            ]
        }),
        encoding="utf-8",
    )

    # Keep other artifacts valid so this test targets query-definition key precedence only.
    (tmp_path / "taxon_geographic_spread.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_spread.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_occurrence_evidence.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_occurrence_evidence.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "taxon_geographic_summary.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_summary.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_spread_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_spread_manifest.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_summary_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_summary_manifest_passed.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )

    result = adapt_query_geography_artifacts(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert len(result["query_definitions"]) == 2
    assert result["query_definitions"][0]["query_definition_id"] == "qd-data-001"
    assert result["query_definitions"][1]["query_definition_id"] == "qd-data-002"
    assert result["query_definition_summary"]["total_query_definitions"] == 2
    assert result["query_definition_summary"]["eligible_query_definitions"] == 1
    assert result["query_definition_summary"]["ineligible_query_definitions"] == 1
    assert result["query_definition_summary"]["disabled_query_definitions"] == 1
    assert result["query_definition_summary"]["query_definitions_by_source"] == {
        "registry": 1,
        "api": 1,
    }
    assert result["query_definition_summary"]["query_definitions_by_rank"] == {
        "species": 1,
        "genus": 1,
    }
    assert result["query_definition_summary"]["max_search_priority"] == 9
    assert result["query_definition_summary"]["query_curation_rule_count"] == 1


def test_adapt_query_geography_artifacts_prefers_candidates_key_after_data(
    tmp_path: Path,
) -> None:
    source_manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_query_geography.json"
        ).read_text(encoding="utf-8")
    )
    source_manifest["outputs"]["query_definitions"] = "query_definitions_candidates_key.json"

    manifest_path = tmp_path / "run_manifest_query_geography_candidates_key.json"
    manifest_path.write_text(json.dumps(source_manifest), encoding="utf-8")
    (tmp_path / "query_definitions_candidates_key.json").write_text(
        json.dumps({
            "candidates": [
                {
                    "query_definition_id": "qd-candidate-001",
                    "query_eligible": False,
                    "enabled": True,
                    "source": "registry",
                    "accepted_rank": "species",
                    "search_priority": 7,
                    "query_curation_rules": [{"name": "candidate-priority"}],
                },
                None,
                {
                    "query_definition_id": "qd-candidate-002",
                    "query_eligible": False,
                    "enabled": False,
                    "source": "api",
                    "accepted_rank": "family",
                    "search_priority": 6,
                },
            ]
        }),
        encoding="utf-8",
    )

    # Keep other artifacts valid so this test targets query-definition payload shape behavior only.
    (tmp_path / "taxon_geographic_spread.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_spread.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_occurrence_evidence.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_occurrence_evidence.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "taxon_geographic_summary.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_summary.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_spread_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_spread_manifest.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_summary_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_summary_manifest_passed.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )

    result = adapt_query_geography_artifacts(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert len(result["query_definitions"]) == 2
    assert result["query_definitions"][0]["query_definition_id"] == "qd-candidate-001"
    assert result["query_definitions"][1]["query_definition_id"] == "qd-candidate-002"
    assert result["query_definition_summary"]["total_query_definitions"] == 2
    assert result["query_definition_summary"]["eligible_query_definitions"] == 0
    assert result["query_definition_summary"]["ineligible_query_definitions"] == 2
    assert result["query_definition_summary"]["disabled_query_definitions"] == 1
    assert result["query_definition_summary"]["query_definitions_by_source"] == {
        "registry": 1,
        "api": 1,
    }
    assert result["query_definition_summary"]["query_definitions_by_rank"] == {
        "species": 1,
        "family": 1,
    }
    assert result["query_definition_summary"]["max_search_priority"] == 7
    assert result["query_definition_summary"]["query_curation_rule_count"] == 1


def test_adapt_query_geography_artifacts_ignores_dict_payload_without_known_rows_key(
    tmp_path: Path,
) -> None:
    source_manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_query_geography.json"
        ).read_text(encoding="utf-8")
    )
    source_manifest["outputs"]["query_definitions"] = "query_definitions_legacy_object.json"

    manifest_path = tmp_path / "run_manifest_query_geography_legacy_object.json"
    manifest_path.write_text(json.dumps(source_manifest), encoding="utf-8")
    (tmp_path / "query_definitions_legacy_object.json").write_text(
        json.dumps({"legacy": [{"query_definition_id": "qd-legacy-001", "query_eligible": True}]}),
        encoding="utf-8",
    )

    # Keep other artifacts valid so this test isolates query-definition payload structure.
    (tmp_path / "taxon_geographic_spread.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_spread.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_occurrence_evidence.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_occurrence_evidence.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "taxon_geographic_summary.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_summary.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_spread_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_spread_manifest.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_summary_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_summary_manifest_passed.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )

    result = adapt_query_geography_artifacts(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["query_definitions"] == []
    assert result["query_definition_summary"]["total_query_definitions"] is None
    assert result["query_definition_summary"]["eligible_query_definitions"] is None
    assert result["query_definition_summary"]["ineligible_query_definitions"] is None
    assert result["query_definition_summary"]["disabled_query_definitions"] is None
    assert result["query_definition_summary"]["query_definitions_by_source"] is None
    assert result["query_definition_summary"]["query_definitions_by_rank"] is None
    assert result["query_definition_summary"]["max_search_priority"] is None
    assert result["query_definition_summary"]["query_curation_rule_count"] is None
    assert result["compatibility"]["query_definition_rows_read"] == 0


def test_adapt_query_geography_artifacts_ignores_scalar_query_definitions_payload(
    tmp_path: Path,
) -> None:
    source_manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_query_geography.json"
        ).read_text(encoding="utf-8")
    )
    source_manifest["outputs"]["query_definitions"] = "query_definitions_scalar.json"

    manifest_path = tmp_path / "run_manifest_query_geography_scalar.json"
    manifest_path.write_text(json.dumps(source_manifest), encoding="utf-8")
    (tmp_path / "query_definitions_scalar.json").write_text(
        json.dumps("not-a-row-collection"),
        encoding="utf-8",
    )

    # Keep other artifacts valid so this test targets query-definition payload behavior only.
    (tmp_path / "taxon_geographic_spread.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_spread.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_occurrence_evidence.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_occurrence_evidence.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "taxon_geographic_summary.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_summary.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_spread_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_spread_manifest.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_summary_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_summary_manifest_passed.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )

    result = adapt_query_geography_artifacts(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["query_definitions"] == []
    assert result["query_definition_summary"]["total_query_definitions"] is None
    assert result["query_definition_summary"]["eligible_query_definitions"] is None
    assert result["query_definition_summary"]["ineligible_query_definitions"] is None
    assert result["query_definition_summary"]["disabled_query_definitions"] is None
    assert result["query_definition_summary"]["query_definitions_by_source"] is None
    assert result["query_definition_summary"]["query_definitions_by_rank"] is None
    assert result["query_definition_summary"]["max_search_priority"] is None
    assert result["query_definition_summary"]["query_curation_rule_count"] is None
    assert result["compatibility"]["query_definition_rows_read"] == 0


def test_adapt_query_geography_artifacts_ignores_non_list_query_curation_rules(
    tmp_path: Path,
) -> None:
    source_manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_query_geography.json"
        ).read_text(encoding="utf-8")
    )
    source_manifest["outputs"]["query_definitions"] = "query_definitions_non_list_rules.json"

    manifest_path = tmp_path / "run_manifest_query_geography_non_list_rules.json"
    manifest_path.write_text(json.dumps(source_manifest), encoding="utf-8")
    (tmp_path / "query_definitions_non_list_rules.json").write_text(
        json.dumps(
            [
                {
                    "query_definition_id": "qd-rule-object",
                    "query_eligible": True,
                    "enabled": True,
                    "source": "registry",
                    "accepted_rank": "species",
                    "search_priority": 11,
                    "query_curation_rules": {"name": "not-a-list"},
                },
                {
                    "query_definition_id": "qd-rule-null",
                    "query_eligible": False,
                    "enabled": False,
                    "source": "api",
                    "accepted_rank": "family",
                    "search_priority": 3,
                    "query_curation_rules": "not-a-list",
                },
            ]
        ),
        encoding="utf-8",
    )

    # Keep other artifacts valid so this test targets query-definition summary behavior only.
    (tmp_path / "taxon_geographic_spread.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_spread.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_occurrence_evidence.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_occurrence_evidence.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "taxon_geographic_summary.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_summary.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_spread_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_spread_manifest.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_summary_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_summary_manifest_passed.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )

    result = adapt_query_geography_artifacts(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert len(result["query_definitions"]) == 2
    assert result["query_definitions"][0]["query_definition_id"] == "qd-rule-object"
    assert result["query_definitions"][1]["query_definition_id"] == "qd-rule-null"
    assert result["query_definition_summary"]["total_query_definitions"] == 2
    assert result["query_definition_summary"]["eligible_query_definitions"] == 1
    assert result["query_definition_summary"]["ineligible_query_definitions"] == 1
    assert result["query_definition_summary"]["disabled_query_definitions"] == 1
    assert result["query_definition_summary"]["query_definitions_by_source"] == {
        "registry": 1,
        "api": 1,
    }
    assert result["query_definition_summary"]["query_definitions_by_rank"] == {
        "species": 1,
        "family": 1,
    }
    assert result["query_definition_summary"]["max_search_priority"] == 11
    assert result["query_definition_summary"]["query_curation_rule_count"] == 0


def test_adapt_query_geography_artifacts_counts_only_mapping_rows_for_compatibility(
    tmp_path: Path,
) -> None:
    source_manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_query_geography.json"
        ).read_text(encoding="utf-8")
    )
    source_manifest["outputs"]["query_definitions"] = "query_definitions_mixed_rows_count.json"

    manifest_path = tmp_path / "run_manifest_query_geography_mixed_rows_count.json"
    manifest_path.write_text(json.dumps(source_manifest), encoding="utf-8")
    (tmp_path / "query_definitions_mixed_rows_count.json").write_text(
        json.dumps(
            [
                {"query_definition_id": "qd-valid-001", "query_eligible": True, "enabled": True},
                "skip-me",
                42,
                {"query_definition_id": "qd-valid-002", "query_eligible": False, "enabled": False},
            ]
        ),
        encoding="utf-8",
    )

    # Keep remaining artifacts valid so this test focuses on rows-read compatibility behavior.
    (tmp_path / "taxon_geographic_spread.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_spread.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_occurrence_evidence.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_occurrence_evidence.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "taxon_geographic_summary.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_summary.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_spread_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_spread_manifest.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_summary_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_summary_manifest_passed.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )

    result = adapt_query_geography_artifacts(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert len(result["query_definitions"]) == 2
    assert result["query_definitions"][0]["query_definition_id"] == "qd-valid-001"
    assert result["query_definitions"][1]["query_definition_id"] == "qd-valid-002"
    assert result["compatibility"]["query_definition_rows_read"] == 2


def test_adapt_query_geography_artifacts_prefers_empty_query_definitions_list(
    tmp_path: Path,
) -> None:
    source_manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_query_geography.json"
        ).read_text(encoding="utf-8")
    )
    source_manifest["outputs"]["query_definitions"] = "query_definitions_empty.json"

    manifest_path = tmp_path / "run_manifest_query_geography_empty.json"
    manifest_path.write_text(json.dumps(source_manifest), encoding="utf-8")
    (tmp_path / "query_definitions_empty.json").write_text(json.dumps([]), encoding="utf-8")

    # Keep remaining artifacts valid so this test only exercises query-definition extraction.
    (tmp_path / "taxon_geographic_spread.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_spread.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_occurrence_evidence.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_occurrence_evidence.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "taxon_geographic_summary.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_summary.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_spread_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_spread_manifest.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_summary_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_summary_manifest_passed.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )

    result = adapt_query_geography_artifacts(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["query_definitions"] == []
    assert result["query_definition_summary"]["total_query_definitions"] is None
    assert result["query_definition_summary"]["eligible_query_definitions"] is None
    assert result["query_definition_summary"]["ineligible_query_definitions"] is None
    assert result["query_definition_summary"]["disabled_query_definitions"] is None
    assert result["query_definition_summary"]["query_definitions_by_source"] is None
    assert result["query_definition_summary"]["query_definitions_by_rank"] is None
    assert result["query_definition_summary"]["max_search_priority"] is None
    assert result["query_definition_summary"]["query_curation_rule_count"] is None
    assert result["compatibility"]["query_definition_rows_read"] == 0


def test_adapt_query_geography_artifacts_uses_flickr_query_definitions_output_key(
    tmp_path: Path,
) -> None:
    source_manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_query_geography.json"
        ).read_text(encoding="utf-8")
    )
    source_manifest["outputs"] = {
        **(source_manifest.get("outputs") or {}),
        "query_definitions": None,
        "flickr_query_definitions": "flickr_query_definitions.json",
    }

    manifest_path = tmp_path / "run_manifest_query_geography_flickr_key.json"
    manifest_path.write_text(json.dumps(source_manifest), encoding="utf-8")
    (tmp_path / "flickr_query_definitions.json").write_text(
        json.dumps([
            {
                "query_definition_id": "qd-flickr-001",
                "query_eligible": True,
                "enabled": True,
            },
        ]),
        encoding="utf-8",
    )

    # Keep other artifacts valid so this test focuses on fallback output key handling.
    (tmp_path / "taxon_geographic_spread.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_spread.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_occurrence_evidence.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_occurrence_evidence.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "taxon_geographic_summary.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_summary.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_spread_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_spread_manifest.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_summary_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_summary_manifest_passed.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )

    result = adapt_query_geography_artifacts(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert len(result["query_definitions"]) == 1
    assert result["query_definitions"][0]["query_definition_id"] == "qd-flickr-001"
    assert result["query_definition_summary"]["total_query_definitions"] == 1
    assert result["query_definition_summary"]["eligible_query_definitions"] == 1
    assert result["query_definition_summary"]["ineligible_query_definitions"] is None
    assert result["query_definition_summary"]["disabled_query_definitions"] is None
    assert result["query_definition_summary"]["query_definitions_by_source"] is None
    assert result["query_definition_summary"]["query_definitions_by_rank"] is None
    assert result["query_definition_summary"]["query_curation_rule_count"] == 0
    assert result["compatibility"]["query_definition_rows_read"] == 1


def test_adapt_query_geography_artifacts_treats_blank_query_definitions_output_as_missing(
    tmp_path: Path,
) -> None:
    source_manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_query_geography.json"
        ).read_text(encoding="utf-8")
    )
    source_manifest["outputs"]["query_definitions"] = "   "

    manifest_path = tmp_path / "run_manifest_query_geography_blank_query_definitions.json"
    manifest_path.write_text(json.dumps(source_manifest), encoding="utf-8")

    # Keep other artifacts valid so only query-definition path edge behavior is exercised.
    (tmp_path / "taxon_geographic_spread.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_spread.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_occurrence_evidence.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_occurrence_evidence.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "taxon_geographic_summary.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_summary.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_spread_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_spread_manifest.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_summary_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_summary_manifest_passed.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )

    result = adapt_query_geography_artifacts(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["query_definitions"] == []
    assert result["query_definition_summary"]["query_definition_artifact_path"] is None
    assert result["query_definition_summary"]["total_query_definitions"] is None
    assert result["compatibility"]["query_definition_rows_read"] == 0
    assert any(
        "did not declare query definition artifact path" in note
        for note in result["compatibility"]["notes"]
    )


def test_adapt_query_geography_artifacts_normalizes_search_priority_types(
    tmp_path: Path,
) -> None:
    source_manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_query_geography.json"
        ).read_text(encoding="utf-8")
    )
    source_manifest["outputs"]["query_definitions"] = "query_definitions_search_priority.json"

    manifest_path = tmp_path / "run_manifest_query_geography_search_priority_types.json"
    manifest_path.write_text(json.dumps(source_manifest), encoding="utf-8")
    (tmp_path / "query_definitions_search_priority.json").write_text(
        json.dumps(
            [
                {
                    "query_definition_id": "qd-priority-001",
                    "query_eligible": True,
                    "enabled": True,
                    "search_priority": "10",
                },
                {
                    "query_definition_id": "qd-priority-002",
                    "query_eligible": False,
                    "enabled": False,
                    "search_priority": 3.9,
                },
                {
                    "query_definition_id": "qd-priority-003",
                    "query_eligible": False,
                    "enabled": False,
                    "search_priority": "not-a-number",
                },
            ]
        ),
        encoding="utf-8",
    )

    # Keep remaining artifacts valid so this test focuses on query-definition priority normalization.
    (tmp_path / "taxon_geographic_spread.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_spread.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_occurrence_evidence.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_occurrence_evidence.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "taxon_geographic_summary.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_summary.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_spread_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_spread_manifest.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_summary_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_summary_manifest_passed.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )

    result = adapt_query_geography_artifacts(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert len(result["query_definitions"]) == 3
    assert result["query_definitions"][0]["query_definition_id"] == "qd-priority-001"
    assert result["query_definition_summary"]["max_search_priority"] == 10


def test_adapt_query_geography_artifacts_prefers_flickr_query_definitions_for_blank_primary_key(
    tmp_path: Path,
) -> None:
    source_manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_query_geography.json"
        ).read_text(encoding="utf-8")
    )
    source_manifest["outputs"] = {
        **(source_manifest.get("outputs") or {}),
        "query_definitions": "   ",
        "flickr_query_definitions": "flickr_query_definitions_blank_fallback.json",
    }

    manifest_path = (
        tmp_path / "run_manifest_query_geography_flickr_fallback_on_blank_primary.json"
    )
    manifest_path.write_text(json.dumps(source_manifest), encoding="utf-8")
    (tmp_path / "flickr_query_definitions_blank_fallback.json").write_text(
        json.dumps(
            [
                {
                    "query_definition_id": "qd-fallback-001",
                    "query_eligible": True,
                    "enabled": False,
                },
                {
                    "query_definition_id": "qd-fallback-002",
                    "query_eligible": False,
                    "enabled": True,
                },
            ]
        ),
        encoding="utf-8",
    )

    # Keep other artifacts valid so this test isolates query-definition fallback-key behavior.
    (tmp_path / "taxon_geographic_spread.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_spread.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_occurrence_evidence.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_occurrence_evidence.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "taxon_geographic_summary.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_summary.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_spread_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_spread_manifest.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_summary_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_summary_manifest_passed.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )

    result = adapt_query_geography_artifacts(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert len(result["query_definitions"]) == 2
    assert result["query_definitions"][0]["query_definition_id"] == "qd-fallback-001"
    assert result["query_definitions"][1]["query_definition_id"] == "qd-fallback-002"
    assert result["query_definition_summary"]["total_query_definitions"] == 2
    assert result["query_definition_summary"]["eligible_query_definitions"] == 1
    assert result["query_definition_summary"]["ineligible_query_definitions"] == 1
    assert result["query_definition_summary"]["disabled_query_definitions"] == 1
    assert result["compatibility"]["query_definition_rows_read"] == 2


def test_adapt_query_geography_artifacts_normalizes_bool_like_eligibility_fields(
    tmp_path: Path,
) -> None:
    source_manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_query_geography.json"
        ).read_text(encoding="utf-8")
    )
    source_manifest["outputs"]["query_definitions"] = "query_definitions_bool_like.json"

    manifest_path = tmp_path / "run_manifest_query_geography_bool_like.json"
    manifest_path.write_text(json.dumps(source_manifest), encoding="utf-8")
    (tmp_path / "query_definitions_bool_like.json").write_text(
        json.dumps(
            [
                {
                    "query_definition_id": "qd-bool-001",
                    "query_eligible": "1",
                    "enabled": "0",
                },
                {
                    "query_definition_id": "qd-bool-002",
                    "query_eligible": "0",
                    "enabled": "1",
                },
                {
                    "query_definition_id": "qd-bool-003",
                    "query_eligible": "yes",
                    "enabled": "no",
                },
                {
                    "query_definition_id": "qd-bool-004",
                    "query_eligible": "n",
                    "enabled": "y",
                },
            ]
        ),
        encoding="utf-8",
    )

    # Keep remaining artifacts valid so this test isolates bool normalization behavior.
    (tmp_path / "taxon_geographic_spread.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_spread.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_occurrence_evidence.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_occurrence_evidence.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "taxon_geographic_summary.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_summary.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_spread_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_spread_manifest.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_summary_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_summary_manifest_passed.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )

    result = adapt_query_geography_artifacts(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert len(result["query_definitions"]) == 4
    assert result["query_definitions"][0]["query_definition_id"] == "qd-bool-001"
    assert result["query_definitions"][3]["query_definition_id"] == "qd-bool-004"
    assert result["query_definition_summary"]["total_query_definitions"] == 4
    assert result["query_definition_summary"]["eligible_query_definitions"] == 3
    assert result["query_definition_summary"]["ineligible_query_definitions"] == 1
    assert result["query_definition_summary"]["disabled_query_definitions"] == 1


def test_adapt_query_geography_artifacts_ignores_non_object_query_definitions_payload(
    tmp_path: Path,
) -> None:
    source_manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_query_geography.json"
        ).read_text(encoding="utf-8")
    )
    source_manifest["outputs"]["query_definitions"] = "query_definitions_number_payload.json"

    manifest_path = tmp_path / "run_manifest_query_geography_number_payload.json"
    manifest_path.write_text(json.dumps(source_manifest), encoding="utf-8")
    (tmp_path / "query_definitions_number_payload.json").write_text("123", encoding="utf-8")

    # Keep other artifacts valid so this test isolates query-definition payload shape behavior.
    (tmp_path / "taxon_geographic_spread.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_spread.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_occurrence_evidence.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_occurrence_evidence.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "taxon_geographic_summary.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_summary.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_spread_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_spread_manifest.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_summary_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_summary_manifest_passed.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )

    result = adapt_query_geography_artifacts(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["query_definitions"] == []
    assert result["query_definition_summary"]["total_query_definitions"] is None
    assert result["query_definition_summary"]["eligible_query_definitions"] is None
    assert result["query_definition_summary"]["ineligible_query_definitions"] is None
    assert result["query_definition_summary"]["disabled_query_definitions"] is None
    assert result["query_definition_summary"]["query_definitions_by_source"] is None
    assert result["query_definition_summary"]["query_definitions_by_rank"] is None
    assert result["query_definition_summary"]["max_search_priority"] is None
    assert result["query_definition_summary"]["query_curation_rule_count"] is None
    assert result["compatibility"]["query_definition_rows_read"] == 0


def test_adapt_query_geography_artifacts_coerces_non_string_bucket_fields(
    tmp_path: Path,
) -> None:
    source_manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_query_geography.json"
        ).read_text(encoding="utf-8")
    )
    source_manifest["outputs"]["query_definitions"] = "query_definitions_bucket_types.json"

    manifest_path = tmp_path / "run_manifest_query_geography_bucket_types.json"
    manifest_path.write_text(json.dumps(source_manifest), encoding="utf-8")
    (tmp_path / "query_definitions_bucket_types.json").write_text(
        json.dumps(
            [
                {
                    "query_definition_id": "qd-bucket-001",
                    "query_eligible": True,
                    "enabled": True,
                    "source": 1,
                    "accepted_rank": 2,
                },
                {
                    "query_definition_id": "qd-bucket-002",
                    "query_eligible": False,
                    "enabled": False,
                    "source": True,
                    "accepted_rank": False,
                },
            ]
        ),
        encoding="utf-8",
    )

    # Keep other artifacts valid so this test only checks bucket coercion in query-definition summary.
    (tmp_path / "taxon_geographic_spread.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_spread.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_occurrence_evidence.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_occurrence_evidence.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "taxon_geographic_summary.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_summary.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_spread_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_spread_manifest.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_summary_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_summary_manifest_passed.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )

    result = adapt_query_geography_artifacts(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert len(result["query_definitions"]) == 2
    assert result["query_definition_summary"]["query_definitions_by_source"] == {"1": 1, "true": 1}
    assert result["query_definition_summary"]["query_definitions_by_rank"] == {"2": 1, "false": 1}


def test_adapt_query_geography_artifacts_ignores_blank_buckets(
    tmp_path: Path,
) -> None:
    source_manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_query_geography.json"
        ).read_text(encoding="utf-8")
    )
    source_manifest["outputs"]["query_definitions"] = "query_definitions_blank_buckets.json"

    manifest_path = tmp_path / "run_manifest_query_geography_blank_buckets.json"
    manifest_path.write_text(json.dumps(source_manifest), encoding="utf-8")
    (tmp_path / "query_definitions_blank_buckets.json").write_text(
        json.dumps(
            [
                {
                    "query_definition_id": "qd-blank-bucket-001",
                    "query_eligible": True,
                    "enabled": True,
                    "source": "registry",
                    "accepted_rank": "species",
                },
                {
                    "query_definition_id": "qd-blank-bucket-002",
                    "query_eligible": False,
                    "enabled": False,
                    "source": "",
                    "accepted_rank": None,
                },
                {
                    "query_definition_id": "qd-blank-bucket-003",
                    "query_eligible": False,
                    "enabled": True,
                    "source": "   ",
                    "accepted_rank": "   ",
                },
            ]
        ),
        encoding="utf-8",
    )

    # Keep other artifacts valid so this test is scoped to query-definition bucket behavior.
    (tmp_path / "taxon_geographic_spread.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_spread.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_occurrence_evidence.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_occurrence_evidence.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "taxon_geographic_summary.json").write_text(
        Path("packages/replay/tests/fixtures/taxon_geographic_summary.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_spread_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_spread_manifest.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )
    (tmp_path / "geographic_summary_manifest.json").write_text(
        Path("packages/replay/tests/fixtures/geographic_summary_manifest_passed.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )

    result = adapt_query_geography_artifacts(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert len(result["query_definitions"]) == 3
    assert result["query_definition_summary"]["query_definitions_by_source"] == {"registry": 1}
    assert result["query_definition_summary"]["query_definitions_by_rank"] == {"species": 1}
