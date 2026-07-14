from __future__ import annotations

from pathlib import Path

from packages.replay.src.biominer_run_manifest_adapter import adapt_run_manifest, RunManifestAdapterError


def test_adapt_run_manifest_from_fixture() -> None:
    fixture = Path("packages/replay/tests/fixtures/run_manifest.json")
    result = adapt_run_manifest(
        manifest_path=fixture,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["run_summary"]["run_id"] == "fixture-run-0001"
    assert result["run_summary"]["schema_version"] == "run_summary:v1"
    assert result["compatibility"]["source_path"] == str(fixture)
    assert result["run_summary"]["biominer_commit"] == "1535c494f9403e22ed9b163f3ae0ce3706e17f4c"


def test_adapt_run_manifest_rejects_invalid_biominer_sha() -> None:
    fixture = Path("packages/replay/tests/fixtures/run_manifest.json")
    try:
        adapt_run_manifest(manifest_path=fixture, biominer_commit="short-sha")
    except RunManifestAdapterError as exc:
        assert "full 40-character" in str(exc)
    else:
        assert False


def test_adapt_run_manifest_normalizes_status_aliases() -> None:
    fixture = Path("packages/replay/tests/fixtures/run_manifest_status_passed.json")
    result = adapt_run_manifest(
        manifest_path=fixture,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["run_summary"]["status"] == "complete"
    assert result["run_summary"]["run_id"] == "fixture-run-status-passed-0001"


def test_adapt_run_manifest_normalizes_completed_status_alias() -> None:
    fixture = Path("packages/replay/tests/fixtures/run_manifest_status_completed.json")
    result = adapt_run_manifest(
        manifest_path=fixture,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["run_summary"]["status"] == "complete"
    assert result["run_summary"]["run_id"] == "fixture-run-status-completed-0001"
