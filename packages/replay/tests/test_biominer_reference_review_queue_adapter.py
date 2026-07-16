import json
from pathlib import Path

from packages.replay.src.biominer_reference_review_queue_adapter import (
    ReferenceReviewQueueAdapterError,
    adapt_reference_review_queue,
)


def test_adapt_reference_review_queue_from_fixture() -> None:
    manifest = Path("packages/replay/tests/fixtures/run_manifest_reference_review_queue.json")
    result = adapt_reference_review_queue(
        manifest_path=manifest,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    summary = result["reference_review_queue_summary"]
    assert summary is not None
    assert summary["schema_version"] == "reference_review_queue_summary:v1"
    assert summary["run_id"] == "fixture-review-queue-0001"
    assert summary["total_records"] == 4
    assert summary["pending_records"] == 1
    assert summary["in_review_records"] == 1
    assert summary["completed_records"] == 1
    assert summary["conflict_records"] == 1
    assert summary["cancelled_records"] == 0
    assert summary["unique_taxon_count"] == 3
    assert summary["unique_media_count"] == 3
    assert summary["max_review_priority"] == 3
    assert summary["max_required_review_count"] == 2

    records = result["reference_review_queue_records"]
    assert len(records) == 4
    assert records[0]["schema_version"] == "reference_review_queue_record:v1"
    assert records[1]["review_request_id"] == "request-002"
    assert records[1]["review_status"] == "in_review"
    assert records[1]["review_priority"] == 3
    assert records[1]["required_review_count"] == 2
    assert records[2]["review_status"] == "completed"
    assert records[3]["review_status"] == "conflict"

    compatibility = result["compatibility"]
    assert compatibility["artifact_missing"] is False
    assert compatibility["artifact_key"] == "reference_review_queue"
    assert compatibility["artifact_path"].endswith("reference_review_queue.json")
    assert compatibility["records_read"] == 4


def test_adapt_reference_review_queue_rejects_invalid_biominer_sha() -> None:
    manifest = Path("packages/replay/tests/fixtures/run_manifest_reference_review_queue.json")
    try:
        adapt_reference_review_queue(manifest_path=manifest, biominer_commit="short-sha")
    except ReferenceReviewQueueAdapterError as exc:
        assert "40-character" in str(exc)
    else:
        assert False


def test_adapt_reference_review_queue_without_artifact_returns_empty_result() -> None:
    manifest = Path("packages/replay/tests/fixtures/run_manifest.json")
    result = adapt_reference_review_queue(
        manifest_path=manifest,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["reference_review_queue_summary"] is None
    assert result["reference_review_queue_records"] == []
    assert result["compatibility"]["artifact_missing"] is True
    assert "run manifest did not declare reference review queue artifact path" in str(
        result["compatibility"]["notes"][0]
    )


def test_adapt_review_queue_falls_back_when_primary_path_is_not_string(
    tmp_path: Path,
) -> None:
    manifest = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_reference_review_queue.json").read_text(
            encoding="utf-8"
        )
    )
    manifest["outputs"]["reference_review_queue"] = None
    manifest["outputs"]["review_queue"] = "reference_review_queue.json"

    manifest_path = tmp_path / "run_manifest_reference_review_queue_fallback.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    (tmp_path / "reference_review_queue.json").write_text(
        Path("packages/replay/tests/fixtures/reference_review_queue.json").read_text(
            encoding="utf-8"
        ),
        encoding="utf-8",
    )

    result = adapt_reference_review_queue(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["reference_review_queue_summary"] is not None
    assert result["reference_review_queue_summary"]["total_records"] == 4
    assert result["compatibility"]["artifact_key"] == "review_queue"
    notes = result["compatibility"]["notes"]
    assert not any("did not declare reference review queue artifact path" in note for note in notes)


def test_adapt_reference_review_queue_normalizes_review_status_aliases() -> None:
    manifest = Path(
        "packages/replay/tests/fixtures/run_manifest_reference_review_queue_status_done.json"
    )
    result = adapt_reference_review_queue(
        manifest_path=manifest,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    summary = result["reference_review_queue_summary"]
    assert summary is not None
    assert summary["completed_records"] == 1
    assert summary["in_review_records"] == 1

    records = result["reference_review_queue_records"]
    assert len(records) == 2
    assert records[0]["review_status"] == "completed"
    assert records[1]["review_status"] == "in_review"


def test_adapt_reference_review_queue_normalizes_completed_status_alias() -> None:
    manifest = Path(
        "packages/replay/tests/fixtures/run_manifest_reference_review_queue_status_complete.json"
    )
    result = adapt_reference_review_queue(
        manifest_path=manifest,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    summary = result["reference_review_queue_summary"]
    assert summary is not None
    assert summary["completed_records"] == 1
    records = result["reference_review_queue_records"]
    assert len(records) == 1
    assert records[0]["review_status"] == "completed"


def test_adapt_reference_review_queue_normalizes_pass_and_done_review_status_aliases(
    tmp_path: Path,
) -> None:
    manifest_path = Path("packages/replay/tests/fixtures/run_manifest_reference_review_queue.json")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    artifact_path = json.loads(
        Path("packages/replay/tests/fixtures/reference_review_queue.json").read_text(
            encoding="utf-8"
        )
    )

    artifact_path[0]["review_status"] = "pass"
    artifact_path[1]["review_status"] = "done_review"

    artifact_file = tmp_path / "reference_review_queue_alias.json"
    artifact_file.write_text(json.dumps(artifact_path), encoding="utf-8")
    manifest["outputs"]["reference_review_queue"] = artifact_file.name

    manifest_file = tmp_path / "run_manifest_reference_review_queue_alias.json"
    manifest_file.write_text(json.dumps(manifest), encoding="utf-8")

    result = adapt_reference_review_queue(
        manifest_path=manifest_file,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    summary = result["reference_review_queue_summary"]
    assert summary is not None
    assert summary["pending_records"] == 0
    assert summary["in_review_records"] == 0
    assert summary["completed_records"] == 3

    records = result["reference_review_queue_records"]
    assert len(records) == 4
    assert records[0]["review_status"] == "completed"
    assert records[1]["review_status"] == "completed"


def test_adapt_reference_review_queue_normalizes_all_known_status_aliases(tmp_path: Path) -> None:
    manifest_path = Path("packages/replay/tests/fixtures/run_manifest_reference_review_queue.json")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    queue = json.loads(
        Path("packages/replay/tests/fixtures/reference_review_queue.json").read_text(
            encoding="utf-8"
        )
    )

    aliases = [
        ("done", "completed"),
        ("pass", "completed"),
        ("passed", "completed"),
        ("complete", "completed"),
        ("success", "completed"),
        ("succeeded", "completed"),
        ("done_review", "completed"),
        ("reviewed", "completed"),
    ]

    for status, expected in aliases:
        queue[0]["review_status"] = status
        artifact = tmp_path / "reference_review_queue_alias.json"
        artifact.write_text(json.dumps(queue), encoding="utf-8")
        manifest["outputs"]["reference_review_queue"] = artifact.name

        manifest_file = tmp_path / "run_manifest_reference_review_queue_alias.json"
        manifest_file.write_text(json.dumps(manifest), encoding="utf-8")

        result = adapt_reference_review_queue(
            manifest_path=manifest_file,
            biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
        )

        records = result["reference_review_queue_records"]
        assert records[0]["review_status"] == expected


def test_adapt_reference_review_queue_rejects_missing_manifest() -> None:
    try:
        adapt_reference_review_queue(
            manifest_path=Path("missing_reference_review_queue_manifest.json"),
            biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
        )
    except ReferenceReviewQueueAdapterError as exc:
        assert "Manifest not found" in str(exc)
    else:
        assert False


def test_adapt_reference_review_queue_rejects_invalid_json_manifest(tmp_path: Path) -> None:
    manifest = tmp_path / "run_manifest_invalid.json"
    manifest.write_text("{invalid_json:", encoding="utf-8")

    try:
        adapt_reference_review_queue(
            manifest_path=manifest,
            biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
        )
    except ReferenceReviewQueueAdapterError as exc:
        assert "Manifest is not valid JSON" in str(exc)
    else:
        assert False


def test_adapt_reference_review_queue_rejects_non_object_manifest(tmp_path: Path) -> None:
    manifest = tmp_path / "run_manifest_not_object.json"
    manifest.write_text("[1, 2, 3]", encoding="utf-8")

    try:
        adapt_reference_review_queue(
            manifest_path=manifest,
            biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
        )
    except ReferenceReviewQueueAdapterError as exc:
        assert "Manifest payload must be a JSON object" in str(exc)
    else:
        assert False


def test_adapt_reference_review_queue_treats_invalid_artifact_json_as_empty_result(
    tmp_path: Path,
) -> None:
    manifest = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_reference_review_queue.json").read_text(
            encoding="utf-8"
        )
    )
    manifest["outputs"]["reference_review_queue"] = "reference_review_queue_bad.json"

    manifest_path = tmp_path / "run_manifest_reference_review_queue_bad.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    (tmp_path / "reference_review_queue_bad.json").write_text("{invalid_json", encoding="utf-8")

    result = adapt_reference_review_queue(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["reference_review_queue_summary"] is None
    assert result["reference_review_queue_records"] == []
    assert result["compatibility"]["artifact_missing"] is False
    assert any(
        "review queue artifact could not be parsed" in note
        for note in result["compatibility"]["notes"]
    )


def test_adapt_reference_review_queue_treats_non_dict_outputs_as_missing(tmp_path: Path) -> None:
    manifest = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_reference_review_queue.json").read_text(
            encoding="utf-8"
        )
    )
    manifest["outputs"] = "not-a-dict"

    manifest_path = tmp_path / "run_manifest_reference_review_queue_bad_outputs.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    result = adapt_reference_review_queue(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["reference_review_queue_summary"] is None
    assert result["reference_review_queue_records"] == []
    assert result["compatibility"]["artifact_missing"] is True
    assert (
        "run manifest did not declare reference review queue artifact path"
        in result["compatibility"]["notes"][0]
    )


def test_adapt_reference_review_queue_treats_parquet_artifact_as_not_adapted(
    tmp_path: Path,
) -> None:
    manifest = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_reference_review_queue.json").read_text(
            encoding="utf-8"
        )
    )
    manifest["outputs"]["reference_review_queue"] = "reference_review_queue.parquet"

    manifest_path = tmp_path / "run_manifest_reference_review_queue_parquet.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    result = adapt_reference_review_queue(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["reference_review_queue_summary"] is None
    assert result["reference_review_queue_records"] == []
    assert result["compatibility"]["artifact_missing"] is False
    assert (
        result["compatibility"]["notes"][0]
        == "parquet review queue artifacts are not adapted in deterministic replay fixtures"
    )


def test_adapt_reference_review_queue_skips_non_mapping_rows(tmp_path: Path) -> None:
    manifest = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_reference_review_queue.json").read_text(
            encoding="utf-8"
        )
    )
    manifest["outputs"]["reference_review_queue"] = "reference_review_queue_mixed.json"

    manifest_path = tmp_path / "run_manifest_reference_review_queue_mixed.json"
    payload = [
        {
            "review_request_id": "request-good-001",
            "review_status": "done",
            "accepted_taxon_key": "gbif:11111",
            "reference_media_id": "media-001",
        },
        "invalid_row",
        {
            "review_request_id": "request-good-002",
            "review_status": "pass",
            "accepted_taxon_key": "gbif:22222",
        },
    ]
    (tmp_path / "reference_review_queue_mixed.json").write_text(
        json.dumps(payload), encoding="utf-8"
    )
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    result = adapt_reference_review_queue(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    records = result["reference_review_queue_records"]
    assert len(records) == 2
    assert records[0]["review_request_id"] == "request-good-001"
    assert records[0]["review_status"] == "completed"
    assert records[1]["review_request_id"] == "request-good-002"
    assert records[1]["review_status"] == "completed"
    assert any(
        "non-mapping_review_queue_row_1" in note for note in result["compatibility"]["notes"]
    )


def test_adapt_reference_review_queue_treats_non_string_output_values_as_missing_artifact(
    tmp_path: Path,
) -> None:
    manifest = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_reference_review_queue.json").read_text(
            encoding="utf-8"
        )
    )
    manifest["outputs"]["reference_review_queue"] = {"path": "reference_review_queue.json"}
    manifest["outputs"]["review_queue"] = []

    manifest_path = tmp_path / "run_manifest_reference_review_queue_bad_outputs.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    result = adapt_reference_review_queue(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["reference_review_queue_summary"] is None
    assert result["reference_review_queue_records"] == []
    assert result["compatibility"]["artifact_missing"] is True
    notes = result["compatibility"]["notes"]
    assert any("did not declare reference review queue artifact path" in note for note in notes)
