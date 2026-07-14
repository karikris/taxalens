import json
from pathlib import Path

from packages.replay.src.biominer_reference_readiness_adapter import (
    ReferenceReadinessAdapterError,
    adapt_reference_readiness,
)


def test_adapt_reference_readiness_from_fixture() -> None:
    manifest = Path(
        "packages/replay/tests/fixtures/run_manifest_reference_readiness.json"
    )
    result = adapt_reference_readiness(
        manifest_path=manifest,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    summary = result["reference_readiness_summary"]
    assert summary is not None
    assert summary["schema_version"] == "reference_readiness_summary:v1"
    assert summary["run_id"] == "fixture-reference-readiness-0001"
    assert summary["status"] == "ready_with_documented_shortfalls"
    assert summary["permits_vision"] is True
    assert summary["candidate_set_count"] == 2
    assert summary["checks_total"] == 3
    assert summary["checks_warning"] == 1
    assert summary["checks_failed"] == 0
    assert summary["checks_pending"] == 0
    assert summary["support_manifest_rows"] == 12
    assert summary["support_manifest_file"] == "reference_support_manifest.parquet"
    assert summary["support_manifest_sha256"] == "sha256:support-manifest-0001"
    assert summary["summary_file"] == "reference_bank_summary.parquet"
    assert summary["candidate_set_ids"] == ["cs-001", "cs-002"]

    checks = result["reference_readiness_checks"]
    assert len(checks) == 3
    assert checks[0]["check_id"] == "artifact_integrity"
    assert checks[0]["status"] == "passed"
    assert checks[0]["observed_count"] == 0
    assert checks[0]["required_count"] == 0
    assert checks[0]["observed_type"] == "integer"
    assert checks[0]["required_type"] == "integer"
    assert checks[1]["check_id"] == "target_adult_minimum"
    assert checks[1]["status"] == "warning"
    assert checks[1]["observed_count"] == 1
    assert checks[1]["required_count"] == 1
    assert checks[1]["observed_type"] == "list"

    compatibility = result["compatibility"]
    assert compatibility["artifact_missing"] is False
    assert compatibility["artifact_key"] == "reference_readiness_manifest"
    assert compatibility["artifact_path"].endswith("reference_bank_readiness.json")
    assert compatibility["checks_read"] == 3


def test_adapt_reference_readiness_rejects_invalid_biominer_sha() -> None:
    manifest = Path(
        "packages/replay/tests/fixtures/run_manifest_reference_readiness.json"
    )
    try:
        adapt_reference_readiness(
            manifest_path=manifest,
            biominer_commit="short-sha",
        )
    except ReferenceReadinessAdapterError as exc:
        assert "40-character" in str(exc)
    else:
        assert False


def test_adapt_reference_readiness_without_artifact_returns_empty_result() -> None:
    manifest = Path("packages/replay/tests/fixtures/run_manifest.json")
    result = adapt_reference_readiness(
        manifest_path=manifest,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["reference_readiness_summary"] is None
    assert result["reference_readiness_checks"] == []
    assert result["compatibility"]["artifact_missing"] is True
    assert (
        "run manifest did not declare reference readiness artifact path"
        in str(result["compatibility"]["notes"][0])
    )


def test_adapt_reference_readiness_normalizes_status_aliases(tmp_path: Path) -> None:
    run_payload = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_reference_readiness.json").read_text(
            encoding="utf-8"
        )
    )
    readiness_payload = json.loads(
        Path("packages/replay/tests/fixtures/reference_bank_readiness.json").read_text(
            encoding="utf-8"
        )
    )

    readiness_payload["status"] = "READY_WITH_REPORTED_SHORTFALLS"
    readiness_payload["checks"][0]["status"] = "COMPLETED"
    readiness_payload["checks"][1]["status"] = "WARN"
    readiness_payload["checks"][2]["status"] = "FAILURE"

    manifest_path = tmp_path / "run_manifest_reference_readiness.json"
    artifact_path = tmp_path / "reference_bank_readiness.json"
    run_payload["outputs"]["reference_readiness_manifest"] = str(
        artifact_path.name
    )

    manifest_path.write_text(json.dumps(run_payload), encoding="utf-8")
    artifact_path.write_text(json.dumps(readiness_payload), encoding="utf-8")

    result = adapt_reference_readiness(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    summary = result["reference_readiness_summary"]
    checks = result["reference_readiness_checks"]
    assert summary is not None
    assert summary["status"] == "ready_with_reported_shortfalls"
    assert checks[0]["status"] == "passed"
    assert checks[1]["status"] == "warning"
    assert checks[2]["status"] == "failed"
    assert result["compatibility"]["checks_read"] == 3


def test_adapt_reference_readiness_normalizes_pascal_case_aliases(tmp_path: Path) -> None:
    run_payload = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_reference_readiness.json").read_text(
            encoding="utf-8"
        )
    )
    readiness_payload = json.loads(
        Path("packages/replay/tests/fixtures/reference_bank_readiness.json").read_text(
            encoding="utf-8"
        )
    )

    readiness_payload["checks"][0]["status"] = "PASSED"
    readiness_payload["checks"][1]["status"] = "WARN"
    readiness_payload["checks"][2]["status"] = "FAILED"

    manifest_path = tmp_path / "run_manifest_reference_readiness.json"
    artifact_path = tmp_path / "reference_bank_readiness.json"
    run_payload["outputs"]["reference_readiness_manifest"] = str(
        artifact_path.name
    )

    manifest_path.write_text(json.dumps(run_payload), encoding="utf-8")
    artifact_path.write_text(json.dumps(readiness_payload), encoding="utf-8")

    result = adapt_reference_readiness(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    checks = result["reference_readiness_checks"]
    assert checks[0]["status"] == "passed"
    assert checks[1]["status"] == "warning"
    assert checks[2]["status"] == "failed"


def test_adapt_reference_readiness_normalizes_failed_with_warning_status_alias(tmp_path: Path) -> None:
    run_payload = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_reference_readiness.json").read_text(
            encoding="utf-8"
        )
    )
    readiness_payload = json.loads(
        Path("packages/replay/tests/fixtures/reference_bank_readiness.json").read_text(
            encoding="utf-8"
        )
    )

    readiness_payload["checks"][0]["status"] = "failed_with_warning"

    manifest_path = tmp_path / "run_manifest_reference_readiness.json"
    artifact_path = tmp_path / "reference_bank_readiness.json"
    run_payload["outputs"]["reference_readiness_manifest"] = str(artifact_path.name)

    manifest_path.write_text(json.dumps(run_payload), encoding="utf-8")
    artifact_path.write_text(json.dumps(readiness_payload), encoding="utf-8")

    result = adapt_reference_readiness(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    summary = result["reference_readiness_summary"]
    checks = result["reference_readiness_checks"]

    assert checks[0]["status"] == "warning"
    assert summary is not None
    assert summary["checks_warning"] == 2


def test_adapt_reference_readiness_normalizes_succeeded_and_warned_aliases(tmp_path: Path) -> None:
    run_payload = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_reference_readiness.json").read_text(
            encoding="utf-8"
        )
    )
    readiness_payload = json.loads(
        Path("packages/replay/tests/fixtures/reference_bank_readiness.json").read_text(
            encoding="utf-8"
        )
    )

    readiness_payload["checks"][0]["status"] = "succeeded"
    readiness_payload["checks"][1]["status"] = "warned"

    manifest_path = tmp_path / "run_manifest_reference_readiness.json"
    artifact_path = tmp_path / "reference_bank_readiness.json"
    run_payload["outputs"]["reference_readiness_manifest"] = str(artifact_path.name)

    manifest_path.write_text(json.dumps(run_payload), encoding="utf-8")
    artifact_path.write_text(json.dumps(readiness_payload), encoding="utf-8")

    result = adapt_reference_readiness(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    checks = result["reference_readiness_checks"]
    assert checks[0]["status"] == "passed"
    assert checks[1]["status"] == "warning"


def test_adapt_reference_readiness_normalizes_successful_and_done_aliases(tmp_path: Path) -> None:
    run_payload = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_reference_readiness.json").read_text(
            encoding="utf-8"
        )
    )
    readiness_payload = json.loads(
        Path("packages/replay/tests/fixtures/reference_bank_readiness.json").read_text(
            encoding="utf-8"
        )
    )

    readiness_payload["checks"][0]["status"] = "successful"
    readiness_payload["checks"][1]["status"] = "done"

    manifest_path = tmp_path / "run_manifest_reference_readiness.json"
    artifact_path = tmp_path / "reference_bank_readiness.json"
    run_payload["outputs"]["reference_readiness_manifest"] = str(artifact_path.name)

    manifest_path.write_text(json.dumps(run_payload), encoding="utf-8")
    artifact_path.write_text(json.dumps(readiness_payload), encoding="utf-8")

    result = adapt_reference_readiness(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    checks = result["reference_readiness_checks"]
    assert checks[0]["status"] == "passed"
    assert checks[1]["status"] == "warning"


def test_adapt_reference_readiness_non_mapping_outputs_skips_artifact_path(
    tmp_path: Path,
) -> None:
    manifest_path = tmp_path / "run_manifest_reference_readiness.json"
    manifest_payload = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_reference_readiness.json").read_text(
            encoding="utf-8"
        )
    )
    manifest_payload["outputs"] = "not-a-mapping"
    manifest_path.write_text(json.dumps(manifest_payload), encoding="utf-8")

    result = adapt_reference_readiness(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["reference_readiness_summary"] is None
    assert result["reference_readiness_checks"] == []
    assert result["compatibility"]["artifact_missing"] is True
    assert result["compatibility"]["artifact_path"] is None
    assert (
        "run manifest did not declare reference readiness artifact path"
        in str(result["compatibility"]["notes"][0])
    )


def test_adapt_reference_readiness_non_list_checks_records_note(tmp_path: Path) -> None:
    run_payload = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_reference_readiness.json").read_text(
            encoding="utf-8"
        )
    )
    readiness_payload = json.loads(
        Path("packages/replay/tests/fixtures/reference_bank_readiness.json").read_text(
            encoding="utf-8"
        )
    )

    readiness_payload["checks"] = {"not": "a-list"}

    manifest_path = tmp_path / "run_manifest_reference_readiness.json"
    artifact_path = tmp_path / "reference_bank_readiness.json"
    run_payload["outputs"]["reference_readiness_manifest"] = str(artifact_path.name)

    manifest_path.write_text(json.dumps(run_payload), encoding="utf-8")
    artifact_path.write_text(json.dumps(readiness_payload), encoding="utf-8")

    result = adapt_reference_readiness(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    summary = result["reference_readiness_summary"]
    assert summary is not None
    assert summary["checks_total"] == 0
    assert summary["checks_passed"] == 0
    assert summary["checks_warning"] == 0
    assert summary["checks_failed"] == 0
    assert summary["checks_pending"] == 0
    assert result["compatibility"]["checks_read"] == 0
    assert (
        "reference readiness checks was missing or malformed"
        in result["compatibility"]["notes"]
    )
    assert "reference readiness checks were empty" in result["compatibility"]["notes"]


def test_adapt_reference_readiness_skips_non_mapping_checks(tmp_path: Path) -> None:
    run_payload = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_reference_readiness.json").read_text(
            encoding="utf-8"
        )
    )
    readiness_payload = json.loads(
        Path("packages/replay/tests/fixtures/reference_bank_readiness.json").read_text(
            encoding="utf-8"
        )
    )

    original_checks = readiness_payload["checks"]
    readiness_payload["checks"] = [
        "non-mapping-check",
        original_checks[1],
        original_checks[2],
    ]

    manifest_path = tmp_path / "run_manifest_reference_readiness.json"
    artifact_path = tmp_path / "reference_bank_readiness.json"
    run_payload["outputs"]["reference_readiness_manifest"] = str(artifact_path.name)

    manifest_path.write_text(json.dumps(run_payload), encoding="utf-8")
    artifact_path.write_text(json.dumps(readiness_payload), encoding="utf-8")

    result = adapt_reference_readiness(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    checks = result["reference_readiness_checks"]
    summary = result["reference_readiness_summary"]
    assert summary is not None
    assert len(checks) == 2
    assert checks[0]["check_id"] == "target_adult_minimum"
    assert checks[1]["check_id"] == "model_building_inputs_available"
    assert summary["checks_total"] == 2
    assert summary["checks_warning"] == 1
    assert summary["checks_passed"] == 1
    assert result["compatibility"]["checks_read"] == 2
    assert "non_mapping_readiness_check_0" in result["compatibility"]["skipped_checks"]
    assert "skipped 1 readiness checks while adapting" in result["compatibility"]["notes"]
    assert result["reference_readiness_summary"]["check_ids"][0] == "readiness_check_0"


def test_adapt_reference_readiness_normalizes_fail_and_failure_aliases(tmp_path: Path) -> None:
    run_payload = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_reference_readiness.json").read_text(
            encoding="utf-8"
        )
    )
    readiness_payload = json.loads(
        Path("packages/replay/tests/fixtures/reference_bank_readiness.json").read_text(
            encoding="utf-8"
        )
    )

    readiness_payload["checks"][0]["status"] = "fail"
    readiness_payload["checks"][1]["status"] = "failure"

    manifest_path = tmp_path / "run_manifest_reference_readiness.json"
    artifact_path = tmp_path / "reference_bank_readiness.json"
    run_payload["outputs"]["reference_readiness_manifest"] = str(artifact_path.name)

    manifest_path.write_text(json.dumps(run_payload), encoding="utf-8")
    artifact_path.write_text(json.dumps(readiness_payload), encoding="utf-8")

    result = adapt_reference_readiness(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    checks = result["reference_readiness_checks"]
    assert checks[0]["status"] == "failed"
    assert checks[1]["status"] == "failed"


def test_adapt_reference_readiness_normalizes_all_known_status_aliases(tmp_path: Path) -> None:
    run_payload = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_reference_readiness.json").read_text(
            encoding="utf-8"
        )
    )
    readiness_template = json.loads(
        Path("packages/replay/tests/fixtures/reference_bank_readiness.json").read_text(
            encoding="utf-8"
        )
    )

    aliases = [
        ("succeeded", "passed"),
        ("successful", "passed"),
        ("pass", "passed"),
        ("passed", "passed"),
        ("complete", "passed"),
        ("completed", "passed"),
        ("done", "passed"),
        ("failed", "failed"),
        ("fail", "failed"),
        ("failure", "failed"),
        ("failed_with_warning", "warning"),
        ("warning", "warning"),
        ("warn", "warning"),
        ("warned", "warning"),
        ("pending", "pending"),
    ]

    manifest_path = tmp_path / "run_manifest_reference_readiness.json"

    for status, expected in aliases:
        readiness_payload = json.loads(json.dumps(readiness_template))
        readiness_payload["checks"][0]["status"] = status
        artifact_path = tmp_path / f"reference_bank_readiness_{status}.json"
        run_payload["outputs"]["reference_readiness_manifest"] = artifact_path.name

        manifest_path.write_text(json.dumps(run_payload), encoding="utf-8")
        artifact_path.write_text(json.dumps(readiness_payload), encoding="utf-8")

        result = adapt_reference_readiness(
            manifest_path=manifest_path,
            biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
        )

        assert result["reference_readiness_checks"][0]["status"] == expected


def test_adapt_reference_readiness_rejects_unsupported_schema_version(
    tmp_path: Path,
) -> None:
    run_payload = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_reference_readiness.json").read_text(
            encoding="utf-8"
        )
    )
    run_payload["schema_version"] = 2

    manifest_path = tmp_path / "run_manifest_reference_readiness_v2.json"
    manifest_path.write_text(json.dumps(run_payload), encoding="utf-8")

    try:
        adapt_reference_readiness(
            manifest_path=manifest_path,
            biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
        )
    except ReferenceReadinessAdapterError as exc:
        assert "Unsupported run manifest schema version" in str(exc)
    else:
        assert False


def test_adapt_reference_readiness_falls_back_to_reference_readiness_key(tmp_path: Path) -> None:
    manifest_payload = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_reference_readiness.json").read_text(
            encoding="utf-8"
        )
    )
    readiness_payload = json.loads(
        Path("packages/replay/tests/fixtures/reference_bank_readiness.json").read_text(
            encoding="utf-8"
        )
    )

    manifest_path = tmp_path / "run_manifest_reference_readiness_fallback.json"
    artifact_path = tmp_path / "reference_readiness_payload.json"
    manifest_payload["outputs"] = {
        "reference_readiness": artifact_path.name
    }

    manifest_path.write_text(json.dumps(manifest_payload), encoding="utf-8")
    artifact_path.write_text(json.dumps(readiness_payload), encoding="utf-8")

    result = adapt_reference_readiness(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["reference_readiness_summary"] is not None
    assert result["compatibility"]["artifact_key"] == "reference_readiness"
    assert result["compatibility"]["checks_read"] == 3


def test_adapt_reference_readiness_resolves_manifest_directory_to_reference_bank_readiness_file(tmp_path: Path) -> None:
    manifest_payload = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_reference_readiness.json").read_text(
            encoding="utf-8"
        )
    )
    readiness_payload = json.loads(
        Path("packages/replay/tests/fixtures/reference_bank_readiness.json").read_text(
            encoding="utf-8"
        )
    )

    artifact_directory = tmp_path / "reference_readiness"
    artifact_directory.mkdir()
    artifact_file = artifact_directory / "reference_bank_readiness.json"
    artifact_file.write_text(json.dumps(readiness_payload), encoding="utf-8")

    manifest_path = tmp_path / "run_manifest_reference_readiness_dir.json"
    manifest_payload["outputs"]["reference_readiness_manifest"] = str(artifact_directory)
    manifest_path.write_text(json.dumps(manifest_payload), encoding="utf-8")

    result = adapt_reference_readiness(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["reference_readiness_summary"] is not None
    assert result["compatibility"]["artifact_path"] == str(artifact_file)
    assert result["compatibility"]["checks_read"] == 3


def test_adapt_reference_readiness_handles_invalid_artifact_json(tmp_path: Path) -> None:
    manifest_payload = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_reference_readiness.json").read_text(
            encoding="utf-8"
        )
    )
    manifest_path = tmp_path / "run_manifest_reference_readiness_invalid_payload.json"
    artifact_path = tmp_path / "reference_bank_readiness.json"
    manifest_payload["outputs"]["reference_readiness_manifest"] = artifact_path.name

    manifest_path.write_text(json.dumps(manifest_payload), encoding="utf-8")
    artifact_path.write_text("{", encoding="utf-8")

    result = adapt_reference_readiness(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["reference_readiness_summary"] is None
    assert result["reference_readiness_checks"] == []
    assert result["compatibility"]["checks_read"] == 0
    assert any(
        "reference readiness artifact was not parseable" in note
        for note in result["compatibility"]["notes"]
    )


def test_adapt_reference_readiness_treats_non_dict_outputs_as_missing_artifact(tmp_path: Path) -> None:
    manifest_payload = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_reference_readiness.json").read_text(
            encoding="utf-8"
        )
    )
    manifest_payload["outputs"] = "not-a-dict"

    manifest_path = tmp_path / "run_manifest_reference_readiness_bad_outputs.json"
    manifest_path.write_text(json.dumps(manifest_payload), encoding="utf-8")

    result = adapt_reference_readiness(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["reference_readiness_summary"] is None
    assert result["reference_readiness_checks"] == []
    assert result["compatibility"]["artifact_missing"] is True
    assert (
        "run manifest did not declare reference readiness artifact path"
        in result["compatibility"]["notes"][0]
    )


def test_adapt_reference_readiness_skips_non_list_checks(tmp_path: Path) -> None:
    manifest_payload = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_reference_readiness.json").read_text(
            encoding="utf-8"
        )
    )
    readiness_payload = json.loads(
        Path("packages/replay/tests/fixtures/reference_bank_readiness.json").read_text(
            encoding="utf-8"
        )
    )
    readiness_payload["checks"] = {"unexpected": "object"}

    manifest_payload["outputs"]["reference_readiness_manifest"] = "reference_bank_readiness.json"
    manifest_path = tmp_path / "run_manifest_reference_readiness_bad_checks.json"
    manifest_path.write_text(json.dumps(manifest_payload), encoding="utf-8")
    (tmp_path / "reference_bank_readiness.json").write_text(
        json.dumps(readiness_payload), encoding="utf-8"
    )

    result = adapt_reference_readiness(
        manifest_path=manifest_path,
        biominer_commit="1535c494f8403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["reference_readiness_summary"] is not None
    assert result["reference_readiness_summary"]["checks_total"] == 0
    assert result["reference_readiness_summary"]["checks_warning"] == 0
    assert result["reference_readiness_summary"]["checks_failed"] == 0
    assert result["reference_readiness_summary"]["checks_pending"] == 0
    assert result["compatibility"]["checks_read"] == 0
    assert result["compatibility"]["notes"] == ["reference readiness checks was missing or malformed"]


def test_adapt_reference_readiness_records_note_for_missing_counts_block(tmp_path: Path) -> None:
    manifest_payload = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_reference_readiness.json").read_text(
            encoding="utf-8"
        )
    )
    readiness_payload = json.loads(
        Path("packages/replay/tests/fixtures/reference_bank_readiness.json").read_text(
            encoding="utf-8"
        )
    )
    readiness_payload["counts"] = ["not-a-dict"]
    manifest_payload["outputs"]["reference_readiness_manifest"] = "reference_bank_readiness.json"

    manifest_path = tmp_path / "run_manifest_reference_readiness_bad_counts.json"
    manifest_path.write_text(json.dumps(manifest_payload), encoding="utf-8")
    (tmp_path / "reference_bank_readiness.json").write_text(
        json.dumps(readiness_payload), encoding="utf-8"
    )

    result = adapt_reference_readiness(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    summary = result["reference_readiness_summary"]
    assert summary is not None
    assert summary["support_manifest_rows"] is None
    assert summary["eligible_support_rows"] is None
    assert (
        "readiness counts block was missing or malformed"
        in result["compatibility"]["notes"]
    )
    assert result["compatibility"]["checks_read"] == 3


def test_adapt_reference_readiness_non_list_candidate_set_ids(tmp_path: Path) -> None:
    manifest_payload = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_reference_readiness.json").read_text(
            encoding="utf-8"
        )
    )
    readiness_payload = json.loads(
        Path("packages/replay/tests/fixtures/reference_bank_readiness.json").read_text(
            encoding="utf-8"
        )
    )
    readiness_payload["candidate_set_ids"] = "not-a-list"
    manifest_payload["outputs"]["reference_readiness_manifest"] = "reference_bank_readiness.json"

    manifest_path = tmp_path / "run_manifest_reference_readiness_bad_candidate_set_ids.json"
    manifest_path.write_text(json.dumps(manifest_payload), encoding="utf-8")
    (tmp_path / "reference_bank_readiness.json").write_text(
        json.dumps(readiness_payload), encoding="utf-8"
    )

    result = adapt_reference_readiness(
        manifest_path=manifest_path,
        biominer_commit="1535c494f8403e22ed9b163f3ae0ce3706e17f4c",
    )

    summary = result["reference_readiness_summary"]
    assert summary is not None
    assert summary["candidate_set_ids"] == []
    assert summary["candidate_set_count"] == 0
    assert (
        "reference readiness payload had no candidate_set_ids"
        in result["compatibility"]["notes"]
    )


def test_adapt_reference_readiness_records_note_for_missing_schema_version(tmp_path: Path) -> None:
    manifest_payload = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_reference_readiness.json").read_text(
            encoding="utf-8"
        )
    )
    readiness_payload = json.loads(
        Path("packages/replay/tests/fixtures/reference_bank_readiness.json").read_text(
            encoding="utf-8"
        )
    )
    readiness_payload.pop("schema_version", None)
    manifest_payload["outputs"]["reference_readiness_manifest"] = "reference_bank_readiness.json"

    manifest_path = tmp_path / "run_manifest_reference_readiness_missing_schema.json"
    manifest_path.write_text(json.dumps(manifest_payload), encoding="utf-8")
    (tmp_path / "reference_bank_readiness.json").write_text(
        json.dumps(readiness_payload), encoding="utf-8"
    )

    result = adapt_reference_readiness(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    summary = result["reference_readiness_summary"]
    assert summary is not None
    assert summary["readiness_artifact_schema_version"] is None
    assert (
        "readiness schema_version was missing"
        in result["compatibility"]["notes"]
    )


def test_adapt_reference_readiness_handles_invalid_artifacts_payload(tmp_path: Path) -> None:
    manifest_payload = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_reference_readiness.json").read_text(
            encoding="utf-8"
        )
    )
    readiness_payload = json.loads(
        Path("packages/replay/tests/fixtures/reference_bank_readiness.json").read_text(
            encoding="utf-8"
        )
    )
    readiness_payload["artifacts"] = "not-a-dict"
    manifest_payload["outputs"]["reference_readiness_manifest"] = "reference_bank_readiness.json"

    manifest_path = tmp_path / "run_manifest_reference_readiness_invalid_artifacts.json"
    manifest_path.write_text(json.dumps(manifest_payload), encoding="utf-8")
    (tmp_path / "reference_bank_readiness.json").write_text(
        json.dumps(readiness_payload), encoding="utf-8"
    )

    result = adapt_reference_readiness(
        manifest_path=manifest_path,
        biominer_commit="1535c494f8403e22ed9b163f3ae0ce3706e17f4c",
    )

    summary = result["reference_readiness_summary"]
    assert summary is not None
    assert summary["support_manifest_file"] is None
    assert summary["summary_file"] is None
    assert summary["support_manifest_sha256"] is None
    assert summary["summary_sha256"] is None
    assert result["compatibility"]["checks_read"] == 3
