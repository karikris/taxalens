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
