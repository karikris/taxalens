import json
from pathlib import Path

from packages.replay.src.biominer_stage_metrics_adapter import (
    StageMetricsAdapterError,
    adapt_stage_metrics,
)


def test_adapt_stage_metrics_from_fixture() -> None:
    fixture = Path("packages/replay/tests/fixtures/run_manifest_stage_metrics.json")
    result = adapt_stage_metrics(
        manifest_path=fixture,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    stage_metrics = result["stage_metrics"]
    assert len(stage_metrics) == 7

    resolve = next(item for item in stage_metrics if item["stage_id"] == "resolve_taxon_scope")
    assert resolve["schema_version"] == "stage_metric:v1"
    assert resolve["biominer_commit"] == "1535c494f9403e22ed9b163f3ae0ce3706e17f4c"
    assert resolve["join_type"] == "hash_join"

    detect = next(item for item in stage_metrics if item["stage_id"] == "detect_objects")
    assert detect["rows_in"] == 44
    assert detect["rows_out"] == 37
    assert detect["cache_hits"] == 0
    assert detect["retries"] == 2
    assert detect["join_type"] == "nearest_neighbour"
    assert detect["bytes_scanned"] == 10240
    assert detect["bytes_written"] == 4096

    score = next(item for item in stage_metrics if item["stage_id"] == "score_bioclip")
    assert score["rows_out"] == 37
    assert score["bytes_scanned"] is None
    assert score["bytes_written"] is None
    assert score["cache_misses"] == 2
    assert score["retries"] == 1
    assert score["produced_sha256"] == "sha256:abc123"

    target = next(item for item in stage_metrics if item["stage_id"] == "target_aware_scoring")
    assert target["operation_type"] == "target_aware_scoring"
    assert target["schema_version_ref"] == "target-aware-candidate-scores-v1.0.0"
    assert target["output_artifact_id"] == "staging/target_aware_object_scores.parquet"

    compatibility = result["compatibility"]
    assert compatibility["unknown_stages"] == ["mystery_custom_stage"]
    assert compatibility["source_path"] == str(fixture)
    assert any("mystery_custom_stage" in str(note) for note in compatibility["notes"])


def test_adapt_stage_metrics_rejects_invalid_biominer_sha() -> None:
    fixture = Path("packages/replay/tests/fixtures/run_manifest_stage_metrics.json")
    try:
        adapt_stage_metrics(manifest_path=fixture, biominer_commit="short-sha")
    except StageMetricsAdapterError as exc:
        assert "40-character" in str(exc)
    else:
        assert False


def test_adapt_stage_metrics_rejects_manifest_without_stages() -> None:
    fixture = Path("packages/replay/tests/fixtures/run_manifest_stage_metrics_missing_stages.json")
    try:
        adapt_stage_metrics(
            manifest_path=fixture,
            biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
        )
    except StageMetricsAdapterError as exc:
        assert "stages" in str(exc)
    else:
        assert False


def test_adapt_stage_metrics_normalizes_stage_status_aliases() -> None:
    fixture = Path("packages/replay/tests/fixtures/run_manifest_stage_metrics_status_passed.json")
    result = adapt_stage_metrics(
        manifest_path=fixture,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    stage_metrics = result["stage_metrics"]
    assert len(stage_metrics) == 1
    unknown = stage_metrics[0]
    assert unknown["stage_id"] == "mystery_custom_stage"
    assert unknown["operation_type"] == "complete"
    assert unknown["join_type"] == "other"


def test_adapt_stage_metrics_normalizes_completed_status_alias() -> None:
    fixture = Path(
        "packages/replay/tests/fixtures/run_manifest_stage_metrics_status_completed.json"
    )
    result = adapt_stage_metrics(
        manifest_path=fixture,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    stage_metrics = result["stage_metrics"]
    assert len(stage_metrics) == 1
    unknown = stage_metrics[0]
    assert unknown["stage_id"] == "mystery_custom_stage"
    assert unknown["operation_type"] == "complete"
    assert unknown["join_type"] == "other"


def test_adapt_stage_metrics_normalizes_in_progress_and_awaiting_manual_review_aliases(
    tmp_path: Path,
) -> None:
    source = Path("packages/replay/tests/fixtures/run_manifest_stage_metrics_status_passed.json")
    payload = json.loads(source.read_text(encoding="utf-8"))

    payload["stages"][0]["status"] = "IN_PROGRESS"
    in_progress_path = tmp_path / "run_manifest_stage_metrics_status_in_progress.json"
    in_progress_path.write_text(json.dumps(payload), encoding="utf-8")
    in_progress = adapt_stage_metrics(
        manifest_path=in_progress_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )
    metric = in_progress["stage_metrics"][0]
    assert metric["operation_type"] == "running"
    assert metric["join_type"] == "other"

    payload["stages"][0]["status"] = "awaiting_manual_review"
    awaiting_path = tmp_path / "run_manifest_stage_metrics_status_awaiting_manual_review.json"
    awaiting_path.write_text(json.dumps(payload), encoding="utf-8")
    awaiting = adapt_stage_metrics(
        manifest_path=awaiting_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )
    metric = awaiting["stage_metrics"][0]
    assert metric["operation_type"] == "awaiting_manual_review"
    assert metric["join_type"] == "other"


def test_adapt_stage_metrics_normalizes_pending_and_skipped_status_aliases(
    tmp_path: Path,
) -> None:
    source = Path("packages/replay/tests/fixtures/run_manifest_stage_metrics_status_passed.json")
    payload = json.loads(source.read_text(encoding="utf-8"))

    payload["stages"][0]["status"] = "pending"
    pending_path = tmp_path / "run_manifest_stage_metrics_status_pending.json"
    pending_path.write_text(json.dumps(payload), encoding="utf-8")
    pending = adapt_stage_metrics(
        manifest_path=pending_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )
    metric = pending["stage_metrics"][0]
    assert metric["operation_type"] == "pending"

    payload["stages"][0]["status"] = "skipped"
    skipped_path = tmp_path / "run_manifest_stage_metrics_status_skipped.json"
    skipped_path.write_text(json.dumps(payload), encoding="utf-8")
    skipped = adapt_stage_metrics(
        manifest_path=skipped_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )
    metric = skipped["stage_metrics"][0]
    assert metric["operation_type"] == "skipped"


def test_adapt_stage_metrics_normalizes_done_and_succeeded_status_aliases(
    tmp_path: Path,
) -> None:
    source = Path("packages/replay/tests/fixtures/run_manifest_stage_metrics_status_passed.json")
    payload = json.loads(source.read_text(encoding="utf-8"))

    payload["stages"][0]["status"] = "done"
    done_path = tmp_path / "run_manifest_stage_metrics_status_done.json"
    done_path.write_text(json.dumps(payload), encoding="utf-8")
    done = adapt_stage_metrics(
        manifest_path=done_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )
    assert done["stage_metrics"][0]["operation_type"] == "complete"

    payload["stages"][0]["status"] = "SUCCEEDED"
    succeeded_path = tmp_path / "run_manifest_stage_metrics_status_succeeded.json"
    succeeded_path.write_text(json.dumps(payload), encoding="utf-8")
    succeeded = adapt_stage_metrics(
        manifest_path=succeeded_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )
    assert succeeded["stage_metrics"][0]["operation_type"] == "complete"

    payload["stages"][0]["status"] = "success"
    success_path = tmp_path / "run_manifest_stage_metrics_status_success.json"
    success_path.write_text(json.dumps(payload), encoding="utf-8")
    success_result = adapt_stage_metrics(
        manifest_path=success_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )
    assert success_result["stage_metrics"][0]["operation_type"] == "complete"


def test_adapt_stage_metrics_normalizes_all_known_status_aliases(tmp_path: Path) -> None:
    source = Path("packages/replay/tests/fixtures/run_manifest_stage_metrics_status_passed.json")
    base_payload = json.loads(source.read_text(encoding="utf-8"))

    aliases = [
        ("succeeded", "complete"),
        ("pass", "complete"),
        ("passed", "complete"),
        ("complete", "complete"),
        ("completed", "complete"),
        ("done", "complete"),
        ("success", "complete"),
        ("running", "running"),
        ("in_progress", "running"),
        ("failed", "failed"),
        ("pending", "pending"),
        ("skipped", "skipped"),
        ("awaiting_manual_review", "awaiting_manual_review"),
    ]

    for status, expected in aliases:
        payload = json.loads(json.dumps(base_payload))
        payload["stages"][0]["status"] = status
        manifest_path = tmp_path / f"run_manifest_stage_metrics_status_{status}.json"
        manifest_path.write_text(json.dumps(payload), encoding="utf-8")

        result = adapt_stage_metrics(
            manifest_path=manifest_path,
            biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
        )
        assert result["stage_metrics"][0]["operation_type"] == expected


def test_adapt_stage_metrics_collects_missing_stage_records(tmp_path: Path) -> None:
    source = Path("packages/replay/tests/fixtures/run_manifest_stage_metrics.json")
    payload = json.loads(source.read_text(encoding="utf-8"))

    payload["stages"] = [
        {"status": "complete", "metrics": {"rows_in": 1}},
        {"status": "complete"},
        {
            "stage": "detect_objects",
            "status": "complete",
            "metrics": {"rows_in": 10, "rows_out": 9},
        },
        "not-a-stage-record",
    ]

    manifest_path = tmp_path / "run_manifest_stage_metrics_malformed_stage.json"
    manifest_path.write_text(json.dumps(payload), encoding="utf-8")

    result = adapt_stage_metrics(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert len(result["stage_metrics"]) == 1
    assert result["stage_metrics"][0]["stage_id"] == "detect_objects"
    assert result["compatibility"]["missing_stage_records"] == [
        "missing_stage_name_0",
        "missing_stage_name_1",
        "non_object_stage_record_3",
    ]
    assert any(
        "some stage records were missing expected fields" in note
        for note in result["compatibility"]["notes"]
    )


def test_adapt_stage_metrics_tolerates_non_object_metrics_and_outputs(tmp_path: Path) -> None:
    payload = {
        "stages": [
            {
                "stage": "detect_objects",
                "status": "complete",
                "metrics": "not-a-metrics-mapping",
                "outputs": ["not", "a", "mapping"],
            }
        ]
    }

    manifest_path = tmp_path / "run_manifest_stage_metrics_bad_stage_payloads.json"
    manifest_path.write_text(json.dumps(payload), encoding="utf-8")

    result = adapt_stage_metrics(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    metric = result["stage_metrics"][0]
    assert metric["stage_id"] == "detect_objects"
    assert metric["operation_type"] == "object_detection"
    assert metric["join_type"] == "nearest_neighbour"
    assert metric["rows_in"] is None
    assert metric["rows_out"] is None
    assert metric["cache_hits"] is None
    assert metric["input_artifact_id"] is None
    assert metric["output_artifact_id"] is None
    assert metric["input_keys"] == ["source_records"]
    assert metric["output_keys"] == ["object_detections", "object_scores"]

    compatibility = result["compatibility"]
    assert compatibility["unknown_stages"] == []
    assert compatibility["missing_stage_records"] == []
    assert any("best-effort metric aliases" in note for note in compatibility["notes"])


def test_adapt_stage_metrics_skips_non_string_output_value_and_falls_back(
    tmp_path: Path,
) -> None:
    payload = {
        "stages": [
            {
                "stage": "detect_objects",
                "status": "complete",
                "outputs": {
                    "object_detections": [],
                    "path": "staging/object_detections.parquet",
                    "object_scores": "staging/object_scores.parquet",
                },
            }
        ]
    }

    manifest_path = tmp_path / "run_manifest_stage_metrics_non_string_output_value.json"
    manifest_path.write_text(json.dumps(payload), encoding="utf-8")

    result = adapt_stage_metrics(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    metric = result["stage_metrics"][0]
    assert metric["operation_type"] == "object_detection"
    assert metric["input_artifact_id"] is None
    assert metric["output_artifact_id"] == "staging/object_detections.parquet"
    assert metric["artifact_uri"] == "staging/object_detections.parquet"


def test_adapt_stage_metrics_skips_non_string_input_artifact_value_and_falls_back(
    tmp_path: Path,
) -> None:
    payload = {
        "stages": [
            {
                "stage": "detect_objects",
                "status": "complete",
                "outputs": {
                    "input": {"artifact": "invalid"},
                    "source": "staging/source_records.parquet",
                    "object_detections": "staging/object_detections.parquet",
                },
            }
        ]
    }

    manifest_path = tmp_path / "run_manifest_stage_metrics_non_string_input_value.json"
    manifest_path.write_text(json.dumps(payload), encoding="utf-8")

    result = adapt_stage_metrics(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    metric = result["stage_metrics"][0]
    assert metric["operation_type"] == "object_detection"
    assert metric["input_artifact_id"] == "staging/source_records.parquet"
    assert metric["output_artifact_id"] == "staging/object_detections.parquet"


def test_adapt_stage_metrics_returns_none_when_no_string_outputs(tmp_path: Path) -> None:
    payload = {
        "stages": [
            {
                "stage": "detect_objects",
                "status": "complete",
                "outputs": {"input": {"artifact": "invalid"}, "path": 123, "object_scores": []},
            }
        ]
    }

    manifest_path = tmp_path / "run_manifest_stage_metrics_no_string_outputs.json"
    manifest_path.write_text(json.dumps(payload), encoding="utf-8")

    result = adapt_stage_metrics(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    metric = result["stage_metrics"][0]
    assert metric["input_artifact_id"] is None
    assert metric["output_artifact_id"] is None
    assert metric["artifact_uri"] is None


def test_adapt_stage_metrics_treats_blank_output_value_as_missing(tmp_path: Path) -> None:
    payload = {
        "stages": [
            {
                "stage": "detect_objects",
                "status": "complete",
                "inputs": {
                    "source_records": "staging/source_records.parquet",
                },
                "outputs": {
                    "object_detections": "   ",
                    "object_scores": "\t",
                    "path": "",
                },
            }
        ]
    }

    manifest_path = tmp_path / "run_manifest_stage_metrics_blank_output_value.json"
    manifest_path.write_text(json.dumps(payload), encoding="utf-8")

    result = adapt_stage_metrics(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    metric = result["stage_metrics"][0]
    assert metric["operation_type"] == "object_detection"
    assert metric["input_artifact_id"] == "staging/source_records.parquet"
    assert metric["output_artifact_id"] is None
    assert metric["artifact_uri"] is None
