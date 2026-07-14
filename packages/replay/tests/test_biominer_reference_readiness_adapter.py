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


def test_adapt_reference_readiness_rejects_missing_manifest_path() -> None:
    missing_manifest = Path(
        "/tmp/does-not-exist-reference-readiness-manifest.json"
    )
    try:
        adapt_reference_readiness(
            manifest_path=missing_manifest,
            biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
        )
    except ReferenceReadinessAdapterError as exc:
        assert "Manifest not found" in str(exc)
    else:
        assert False


def test_adapt_reference_readiness_rejects_invalid_manifest_json(tmp_path: Path) -> None:
    manifest_path = tmp_path / "run_manifest_reference_readiness_invalid.json"
    manifest_path.write_text("{", encoding="utf-8")

    try:
        adapt_reference_readiness(
            manifest_path=manifest_path,
            biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
        )
    except ReferenceReadinessAdapterError as exc:
        assert "Manifest is not valid JSON" in str(exc)
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
    assert result["reference_readiness_summary"]["check_ids"][1] == "target_adult_minimum"
    assert result["reference_readiness_summary"]["check_ids"][2] == "model_building_inputs_available"


def test_adapt_reference_readiness_empty_checks_list_reports_empty_checks(
    tmp_path: Path,
) -> None:
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
    readiness_payload["checks"] = []
    manifest_payload["outputs"]["reference_readiness_manifest"] = "reference_bank_readiness.json"

    manifest_path = tmp_path / "run_manifest_reference_readiness_empty_checks.json"
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
    assert summary["checks_total"] == 0
    assert summary["checks_warning"] == 0
    assert summary["checks_failed"] == 0
    assert summary["checks_pending"] == 0
    assert result["reference_readiness_checks"] == []
    assert "reference readiness checks were empty" in result["compatibility"]["notes"]


def test_adapt_reference_readiness_uses_fallback_check_id_for_blank_values(tmp_path: Path) -> None:
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

    readiness_payload["checks"][0]["check_id"] = "   "
    readiness_payload["checks"][1]["check_id"] = None

    manifest_path = tmp_path / "run_manifest_reference_readiness_blank_check_id.json"
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
    assert checks[0]["check_id"] is None
    assert checks[1]["check_id"] is None
    assert summary["check_ids"][0] == "readiness_check_0"
    assert summary["check_ids"][1] == "readiness_check_1"


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


def test_adapt_reference_readiness_leaves_unknown_status_unchanged_and_unclassified(
    tmp_path: Path,
) -> None:
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
    readiness_payload["checks"][0]["status"] = "IN_PROGRESS"
    readiness_payload["checks"][1]["status"] = "SKIPPED"
    readiness_payload["checks"][2]["status"] = "HALTED"

    manifest_path = tmp_path / "run_manifest_reference_readiness_unknown_check_status.json"
    artifact_path = tmp_path / "reference_bank_readiness_unknown_status.json"
    run_payload["outputs"]["reference_readiness_manifest"] = artifact_path.name

    manifest_path.write_text(json.dumps(run_payload), encoding="utf-8")
    artifact_path.write_text(json.dumps(readiness_payload), encoding="utf-8")

    result = adapt_reference_readiness(
        manifest_path=manifest_path,
        biominer_commit="1535c494f8403e22ed9b163f3ae0ce3706e17f4c",
    )

    checks = result["reference_readiness_checks"]
    summary = result["reference_readiness_summary"]
    assert checks[0]["status"] == "in_progress"
    assert checks[1]["status"] == "skipped"
    assert checks[2]["status"] == "halted"
    assert summary["checks_passed"] == 0
    assert summary["checks_warning"] == 0
    assert summary["checks_failed"] == 0
    assert summary["checks_pending"] == 0


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


def test_adapt_reference_readiness_rejects_string_schema_version_two(tmp_path: Path) -> None:
    manifest_payload = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_reference_readiness.json").read_text(
            encoding="utf-8"
        )
    )
    manifest_payload["schema_version"] = "2"

    manifest_path = tmp_path / "run_manifest_reference_readiness_v2_string.json"
    manifest_path.write_text(json.dumps(manifest_payload), encoding="utf-8")

    try:
        adapt_reference_readiness(
            manifest_path=manifest_path,
            biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
        )
    except ReferenceReadinessAdapterError as exc:
        assert "Unsupported run manifest schema version" in str(exc)
    else:
        assert False


def test_adapt_reference_readiness_rejects_null_schema_version(
    tmp_path: Path,
) -> None:
    manifest_payload = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_reference_readiness.json").read_text(
            encoding="utf-8"
        )
    )
    manifest_payload["schema_version"] = None

    manifest_path = tmp_path / "run_manifest_reference_readiness_vnull.json"
    manifest_path.write_text(json.dumps(manifest_payload), encoding="utf-8")

    try:
        adapt_reference_readiness(
            manifest_path=manifest_path,
            biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
        )
    except ReferenceReadinessAdapterError as exc:
        assert "Unsupported run manifest schema version" in str(exc)
    else:
        assert False


def test_adapt_reference_readiness_accepts_string_schema_version_one(tmp_path: Path) -> None:
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
    manifest_payload["schema_version"] = "1"

    manifest_path = tmp_path / "run_manifest_reference_readiness_schema_v1_string.json"
    artifact_path = tmp_path / "reference_bank_readiness.json"
    manifest_payload["outputs"]["reference_readiness_manifest"] = artifact_path.name
    manifest_path.write_text(json.dumps(manifest_payload), encoding="utf-8")
    artifact_path.write_text(json.dumps(readiness_payload), encoding="utf-8")

    result = adapt_reference_readiness(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["reference_readiness_summary"] is not None
    assert result["reference_readiness_summary"]["run_id"] == "fixture-reference-readiness-0001"
    assert result["compatibility"]["artifact_path"] == str(artifact_path)


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


def test_adapt_reference_readiness_falls_back_to_readiness_manifest_key(tmp_path: Path) -> None:
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

    manifest_path = tmp_path / "run_manifest_reference_readiness_fallback_ready_manifest.json"
    artifact_path = tmp_path / "reference_readiness_manifest_payload.json"
    manifest_payload["outputs"] = {
        "readiness_manifest": str(artifact_path)
    }

    manifest_path.write_text(json.dumps(manifest_payload), encoding="utf-8")
    artifact_path.write_text(json.dumps(readiness_payload), encoding="utf-8")

    result = adapt_reference_readiness(
        manifest_path=manifest_path,
        biominer_commit="1535c494f8403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["reference_readiness_summary"] is not None
    assert result["compatibility"]["artifact_key"] == "readiness_manifest"
    assert result["compatibility"]["artifact_path"] == str(artifact_path)
    assert result["compatibility"]["checks_read"] == 3


def test_adapt_reference_readiness_skips_none_output_value_and_falls_back(tmp_path: Path) -> None:
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

    manifest_path = tmp_path / "run_manifest_reference_readiness_none_output_value.json"
    artifact_path = tmp_path / "reference_readiness_payload.json"
    manifest_payload["outputs"] = {
        "reference_readiness_manifest": None,
        "reference_readiness_file": artifact_path.name,
    }

    manifest_path.write_text(json.dumps(manifest_payload), encoding="utf-8")
    artifact_path.write_text(json.dumps(readiness_payload), encoding="utf-8")

    result = adapt_reference_readiness(
        manifest_path=manifest_path,
        biominer_commit="1535c494f8403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["reference_readiness_summary"] is not None
    assert result["compatibility"]["artifact_key"] == "reference_readiness_file"
    assert result["compatibility"]["artifact_path"] == str(artifact_path)
    assert result["compatibility"]["checks_read"] == 3


def test_adapt_reference_readiness_skips_non_string_output_value_and_falls_back(tmp_path: Path) -> None:
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

    manifest_path = tmp_path / "run_manifest_reference_readiness_non_string_output_value.json"
    artifact_path = tmp_path / "reference_readiness_payload.json"
    manifest_payload["outputs"] = {
        "reference_readiness_manifest": 1234,
        "reference_readiness_file": artifact_path.name,
    }

    manifest_path.write_text(json.dumps(manifest_payload), encoding="utf-8")
    artifact_path.write_text(json.dumps(readiness_payload), encoding="utf-8")

    result = adapt_reference_readiness(
        manifest_path=manifest_path,
        biominer_commit="1535c494f8403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["reference_readiness_summary"] is not None
    assert result["compatibility"]["artifact_key"] == "reference_readiness_file"
    assert result["compatibility"]["artifact_path"] == str(artifact_path)
    assert result["compatibility"]["checks_read"] == 3


def test_adapt_reference_readiness_falls_back_to_reference_readiness_file_key(tmp_path: Path) -> None:
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

    manifest_path = tmp_path / "run_manifest_reference_readiness_fallback_file.json"
    artifact_path = tmp_path / "reference_readiness_payload.json"
    manifest_payload["outputs"] = {
        "reference_readiness_file": artifact_path.name
    }

    manifest_path.write_text(json.dumps(manifest_payload), encoding="utf-8")
    artifact_path.write_text(json.dumps(readiness_payload), encoding="utf-8")

    result = adapt_reference_readiness(
        manifest_path=manifest_path,
        biominer_commit="1535c494f8403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["reference_readiness_summary"] is not None
    assert result["compatibility"]["artifact_key"] == "reference_readiness_file"
    assert result["compatibility"]["artifact_path"] == str(artifact_path)
    assert result["compatibility"]["checks_read"] == 3


def test_adapt_reference_readiness_falls_back_to_readiness_key(tmp_path: Path) -> None:
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

    manifest_path = tmp_path / "run_manifest_reference_readiness_fallback_key.json"
    artifact_path = tmp_path / "readiness_payload.json"
    manifest_payload["outputs"] = {
        "readiness": str(artifact_path)
    }

    manifest_path.write_text(json.dumps(manifest_payload), encoding="utf-8")
    artifact_path.write_text(json.dumps(readiness_payload), encoding="utf-8")

    result = adapt_reference_readiness(
        manifest_path=manifest_path,
        biominer_commit="1535c494f8403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["reference_readiness_summary"] is not None
    assert result["compatibility"]["artifact_key"] == "readiness"
    assert result["compatibility"]["artifact_path"] == str(artifact_path)
    assert result["compatibility"]["checks_read"] == 3


def test_adapt_reference_readiness_trims_artifact_path_and_resolves_relative_path(tmp_path: Path) -> None:
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

    manifest_path = tmp_path / "run_manifest_reference_readiness_trimmed.json"
    artifact_path = tmp_path / "reference_bank_readiness.json"
    manifest_payload["outputs"]["reference_readiness_manifest"] = "  ./reference_bank_readiness.json  "

    manifest_path.write_text(json.dumps(manifest_payload), encoding="utf-8")
    artifact_path.write_text(json.dumps(readiness_payload), encoding="utf-8")

    result = adapt_reference_readiness(
        manifest_path=manifest_path,
        biominer_commit="1535c494f8403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["reference_readiness_summary"] is not None
    assert result["compatibility"]["artifact_path"] == str(artifact_path)
    assert result["compatibility"]["checks_read"] == 3


def test_adapt_reference_readiness_skips_empty_output_key_and_falls_back(tmp_path: Path) -> None:
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

    manifest_payload["outputs"] = {
        "reference_readiness_manifest": "   ",
        "reference_readiness_file": "readiness.json",
    }

    manifest_path = tmp_path / "run_manifest_reference_readiness_empty_key.json"
    artifact_path = tmp_path / "readiness.json"
    manifest_path.write_text(json.dumps(manifest_payload), encoding="utf-8")
    artifact_path.write_text(json.dumps(readiness_payload), encoding="utf-8")

    result = adapt_reference_readiness(
        manifest_path=manifest_path,
        biominer_commit="1535c494f8403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["reference_readiness_summary"] is not None
    assert result["compatibility"]["artifact_key"] == "reference_readiness_file"
    assert result["compatibility"]["artifact_path"] == str(artifact_path)
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


def test_adapt_reference_readiness_reports_missing_reference_readiness_file_from_directory(
    tmp_path: Path,
) -> None:
    manifest_payload = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_reference_readiness.json").read_text(
            encoding="utf-8"
        )
    )

    artifact_directory = tmp_path / "reference_readiness"
    artifact_directory.mkdir()
    manifest_path = tmp_path / "run_manifest_reference_readiness_dir_missing.json"
    manifest_payload["outputs"]["reference_readiness_manifest"] = str(artifact_directory)
    manifest_path.write_text(json.dumps(manifest_payload), encoding="utf-8")

    result = adapt_reference_readiness(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["reference_readiness_summary"] is None
    assert result["reference_readiness_checks"] == []
    assert result["compatibility"]["artifact_missing"] is True
    assert str(artifact_directory / "reference_bank_readiness.json") in str(
        result["compatibility"]["notes"][0]
    )


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


def test_adapt_reference_readiness_none_checks_treated_as_no_checks(tmp_path: Path) -> None:
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
    readiness_payload["checks"] = None

    manifest_payload["outputs"]["reference_readiness_manifest"] = "reference_bank_readiness.json"
    manifest_path = tmp_path / "run_manifest_reference_readiness_none_checks.json"
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
    assert summary["checks_total"] == 0
    assert summary["checks_warning"] == 0
    assert summary["checks_failed"] == 0
    assert summary["checks_pending"] == 0
    assert result["reference_readiness_checks"] == []
    assert (
        "reference readiness checks was missing or malformed"
        in result["compatibility"]["notes"]
    )


def test_adapt_reference_readiness_non_list_checks_does_not_emit_check_ids(tmp_path: Path) -> None:
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
    readiness_payload.pop("checks", None)

    manifest_payload["outputs"]["reference_readiness_manifest"] = "reference_bank_readiness.json"
    manifest_path = tmp_path / "run_manifest_reference_readiness_no_checks.json"
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
    assert summary["checks_total"] == 0
    assert summary["check_ids"] == []
    assert "reference readiness checks was missing or malformed" in result["compatibility"]["notes"]


def test_adapt_reference_readiness_non_mapping_checks_with_no_checks_list_uses_empty_check_ids(tmp_path: Path) -> None:
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
    readiness_payload["checks"] = {"not": "a-list"}

    manifest_payload["outputs"]["reference_readiness_manifest"] = "reference_bank_readiness.json"
    manifest_path = tmp_path / "run_manifest_reference_readiness_checks_object.json"
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
    assert summary["checks_total"] == 0
    assert summary["check_ids"] == []
    assert (
        "reference readiness checks was missing or malformed"
        in result["compatibility"]["notes"]
    )


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


def test_adapt_reference_readiness_empty_candidate_set_fingerprints_stays_zero_count(tmp_path: Path) -> None:
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
    readiness_payload["candidate_set_fingerprints"] = []
    manifest_payload["outputs"]["reference_readiness_manifest"] = "reference_bank_readiness.json"

    manifest_path = tmp_path / "run_manifest_reference_readiness_empty_candidate_set_fingerprints.json"
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
    assert summary["candidate_set_fingerprint_count"] == 0


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


def test_adapt_reference_readiness_non_string_candidate_set_ids_are_stringified(tmp_path: Path) -> None:
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
    readiness_payload["candidate_set_ids"] = ["valid-id", 1234, None, "  spaced  "]
    manifest_payload["outputs"]["reference_readiness_manifest"] = "reference_bank_readiness.json"

    manifest_path = tmp_path / "run_manifest_reference_readiness_candidate_set_id_types.json"
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
    assert summary["candidate_set_ids"] == ["valid-id", "1234", "spaced"]
    assert summary["candidate_set_count"] == 3


def test_adapt_reference_readiness_blank_candidate_set_ids_are_dropped_and_noted(
    tmp_path: Path,
) -> None:
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
    readiness_payload["candidate_set_ids"] = ["   ", "", None]
    manifest_payload["outputs"]["reference_readiness_manifest"] = "reference_bank_readiness.json"

    manifest_path = (
        tmp_path / "run_manifest_reference_readiness_candidate_set_ids_blank.json"
    )
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


def test_adapt_reference_readiness_non_string_candidate_set_fingerprints_are_stringified(
    tmp_path: Path,
) -> None:
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
    readiness_payload["candidate_set_fingerprints"] = [
        "  fp-01  ",
        None,
        9999,
        "",
        "  ",
    ]
    manifest_payload["outputs"]["reference_readiness_manifest"] = "reference_bank_readiness.json"

    manifest_path = (
        tmp_path / "run_manifest_reference_readiness_candidate_set_fingerprint_types.json"
    )
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
    assert summary["candidate_set_fingerprint_count"] == 3


def test_adapt_reference_readiness_check_affected_collections_are_stringified(
    tmp_path: Path,
) -> None:
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
    readiness_payload["checks"][0]["affected_species"] = ["A1", None, "  "]
    readiness_payload["checks"][0]["affected_clusters"] = [1, "C2", ""]
    readiness_payload["checks"][0]["affected_routes"] = []
    manifest_payload["outputs"]["reference_readiness_manifest"] = "reference_bank_readiness.json"

    manifest_path = tmp_path / "run_manifest_reference_readiness_check_affected_fields.json"
    manifest_path.write_text(json.dumps(manifest_payload), encoding="utf-8")
    (tmp_path / "reference_bank_readiness.json").write_text(
        json.dumps(readiness_payload), encoding="utf-8"
    )

    result = adapt_reference_readiness(
        manifest_path=manifest_path,
        biominer_commit="1535c494f8403e22ed9b163f3ae0ce3706e17f4c",
    )

    checks = result["reference_readiness_checks"]
    assert checks[0]["affected_species_count"] == 1
    assert checks[0]["affected_clusters_count"] == 2
    assert checks[0]["affected_routes_count"] == 0


def test_adapt_reference_readiness_deterministic_evidence_fields_order(tmp_path: Path) -> None:
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
    readiness_payload["checks"][0]["evidence"] = {"zeta": "val", "alpha": "val", "mu": "val"}
    manifest_payload["outputs"]["reference_readiness_manifest"] = "reference_bank_readiness.json"

    manifest_path = tmp_path / "run_manifest_reference_readiness_evidence_fields_order.json"
    manifest_path.write_text(json.dumps(manifest_payload), encoding="utf-8")
    (tmp_path / "reference_bank_readiness.json").write_text(
        json.dumps(readiness_payload), encoding="utf-8"
    )

    result = adapt_reference_readiness(
        manifest_path=manifest_path,
        biominer_commit="1535c494f8403e22ed9b163f3ae0ce3706e17f4c",
    )

    checks = result["reference_readiness_checks"]
    assert checks[0]["evidence_fields"] == ["alpha", "mu", "zeta"]


def test_adapt_reference_readiness_evidence_fields_stringify_and_sort_non_string_keys(
    tmp_path: Path,
) -> None:
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
    readiness_payload["checks"][0]["evidence"] = {
        "zeta": "val",
        2: "num",
        None: "none",
        "alpha": "val",
    }
    manifest_payload["outputs"]["reference_readiness_manifest"] = "reference_bank_readiness.json"

    manifest_path = tmp_path / "run_manifest_reference_readiness_evidence_non_string_keys.json"
    manifest_path.write_text(json.dumps(manifest_payload), encoding="utf-8")
    (tmp_path / "reference_bank_readiness.json").write_text(
        json.dumps(readiness_payload, default=str), encoding="utf-8"
    )

    result = adapt_reference_readiness(
        manifest_path=manifest_path,
        biominer_commit="1535c494f8403e22ed9b163f3ae0ce3706e17f4c",
    )

    checks = result["reference_readiness_checks"]
    assert checks[0]["evidence_fields"] == ["2", "alpha", "none", "zeta"]


def test_adapt_reference_readiness_non_mapping_evidence_field_is_none(tmp_path: Path) -> None:
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
    readiness_payload["checks"][0]["evidence"] = ["not", "a", "mapping"]
    manifest_payload["outputs"]["reference_readiness_manifest"] = "reference_bank_readiness.json"

    manifest_path = tmp_path / "run_manifest_reference_readiness_evidence_non_mapping.json"
    manifest_path.write_text(json.dumps(manifest_payload), encoding="utf-8")
    (tmp_path / "reference_bank_readiness.json").write_text(
        json.dumps(readiness_payload), encoding="utf-8"
    )

    result = adapt_reference_readiness(
        manifest_path=manifest_path,
        biominer_commit="1535c494f8403e22ed9b163f3ae0ce3706e17f4c",
    )

    checks = result["reference_readiness_checks"]
    assert checks[0]["evidence_fields"] is None


def test_adapt_reference_readiness_nested_artifacts_non_mapping_values_are_ignored(tmp_path: Path) -> None:
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
    readiness_payload["artifacts"] = {
        "support_manifest": ["not", "a", "mapping"],
        "summary": 1234,
    }
    manifest_payload["outputs"]["reference_readiness_manifest"] = "reference_bank_readiness.json"

    manifest_path = tmp_path / "run_manifest_reference_readiness_nested_artifacts_non_mapping.json"
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


def test_adapt_reference_readiness_non_list_candidate_set_fingerprints(tmp_path: Path) -> None:
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
    readiness_payload["candidate_set_fingerprints"] = "not-a-list"
    manifest_payload["outputs"]["reference_readiness_manifest"] = "reference_bank_readiness.json"

    manifest_path = tmp_path / "run_manifest_reference_readiness_bad_candidate_set_fingerprints.json"
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
    assert summary["candidate_set_fingerprint_count"] == 0


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


def test_adapt_reference_readiness_prefers_documented_shortfalls_list_length_for_count(tmp_path: Path) -> None:
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
    readiness_payload["counts"]["documented_shortfall_count"] = "not-int"
    manifest_payload["outputs"]["reference_readiness_manifest"] = "reference_bank_readiness.json"

    manifest_path = tmp_path / "run_manifest_reference_readiness_bad_documented_shortfall_count.json"
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
    assert summary["documented_shortfall_count"] == 1


def test_adapt_reference_readiness_string_counts_are_coerced_to_ints(tmp_path: Path) -> None:
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
    readiness_payload["counts"] = {
        "support_manifest_rows": "12",
        "eligible_support_rows": "4",
        "pending_review_count": "not-a-number",
    }
    manifest_payload["outputs"]["reference_readiness_manifest"] = "reference_bank_readiness.json"

    manifest_path = tmp_path / "run_manifest_reference_readiness_string_counts.json"
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
    assert summary["support_manifest_rows"] == 12
    assert summary["eligible_support_rows"] == 4
    assert summary["pending_review_count"] is None


def test_adapt_reference_readiness_non_dict_counts_falls_back_to_defaults(tmp_path: Path) -> None:
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
    readiness_payload["counts"] = "not-a-dict"
    manifest_payload["outputs"]["reference_readiness_manifest"] = "reference_bank_readiness.json"

    manifest_path = tmp_path / "run_manifest_reference_readiness_non_dict_counts.json"
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
    assert summary["support_manifest_rows"] is None
    assert summary["eligible_support_rows"] is None
    assert summary["pending_review_count"] is None
    assert (
        "readiness counts block was missing or malformed"
        in result["compatibility"]["notes"]
    )
    assert result["compatibility"]["checks_read"] == 3
