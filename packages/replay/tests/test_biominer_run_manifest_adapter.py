from __future__ import annotations

import json
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


def test_adapt_run_manifest_normalizes_completed_alias(tmp_path: Path) -> None:
    source = Path("packages/replay/tests/fixtures/run_manifest.json")
    payload = json.loads(source.read_text(encoding="utf-8"))
    payload["status"] = "COMPLETED"

    source_path = tmp_path / "run_manifest.json"
    source_path.write_text(json.dumps(payload), encoding="utf-8")

    result = adapt_run_manifest(
        manifest_path=source_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["run_summary"]["status"] == "complete"


def test_adapt_run_manifest_normalizes_error_aliases(tmp_path: Path) -> None:
    source = Path("packages/replay/tests/fixtures/run_manifest.json")
    payload = json.loads(source.read_text(encoding="utf-8"))

    payload["status"] = "SUCCESS"
    source_path = tmp_path / "run_manifest_success.json"
    source_path.write_text(json.dumps(payload), encoding="utf-8")
    success_result = adapt_run_manifest(
        manifest_path=source_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )
    assert success_result["run_summary"]["status"] == "complete"

    payload["status"] = "ERROR"
    source_path = tmp_path / "run_manifest_error.json"
    source_path.write_text(json.dumps(payload), encoding="utf-8")
    error_result = adapt_run_manifest(
        manifest_path=source_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )
    assert error_result["run_summary"]["status"] == "failed"

    payload["status"] = "aborted"
    source_path = tmp_path / "run_manifest_aborted.json"
    source_path.write_text(json.dumps(payload), encoding="utf-8")
    aborted_result = adapt_run_manifest(
        manifest_path=source_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )
    assert aborted_result["run_summary"]["status"] == "failed"

    payload["status"] = "pass"
    source_path = tmp_path / "run_manifest_pass.json"
    source_path.write_text(json.dumps(payload), encoding="utf-8")
    pass_result = adapt_run_manifest(
        manifest_path=source_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )
    assert pass_result["run_summary"]["status"] == "complete"
