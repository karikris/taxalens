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

    payload["status"] = "done"
    source_path = tmp_path / "run_manifest_done.json"
    source_path.write_text(json.dumps(payload), encoding="utf-8")
    done_result = adapt_run_manifest(
        manifest_path=source_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )
    assert done_result["run_summary"]["status"] == "complete"


def test_adapt_run_manifest_normalizes_all_known_status_aliases(tmp_path: Path) -> None:
    source = Path("packages/replay/tests/fixtures/run_manifest.json")
    payload = json.loads(source.read_text(encoding="utf-8"))

    aliases = [
        ("SUCCEEDED", "complete"),
        ("succeeded", "complete"),
        ("pass", "complete"),
        ("passed", "complete"),
        ("complete", "complete"),
        ("completed", "complete"),
        ("done", "complete"),
        ("success", "complete"),
        ("running", "running"),
        ("failed", "failed"),
        ("error", "failed"),
        ("aborted", "failed"),
    ]

    for status, expected in aliases:
        payload["status"] = status
        source_path = tmp_path / f"run_manifest_status_{status.lower()}.json"
        source_path.write_text(json.dumps(payload), encoding="utf-8")
        result = adapt_run_manifest(
            manifest_path=source_path,
            biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
        )
        assert result["run_summary"]["status"] == expected


def test_adapt_run_manifest_rejects_missing_manifest() -> None:
    try:
        adapt_run_manifest(
            manifest_path=Path("missing_run_manifest.json"),
            biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
        )
    except RunManifestAdapterError as exc:
        assert "Run manifest not found" in str(exc)
    else:
        assert False


def test_adapt_run_manifest_rejects_invalid_json_manifest(tmp_path: Path) -> None:
    manifest = tmp_path / "run_manifest_invalid.json"
    manifest.write_text("{invalid_json:", encoding="utf-8")

    try:
        adapt_run_manifest(
            manifest_path=manifest,
            biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
        )
    except RunManifestAdapterError as exc:
        assert "Run manifest is not valid JSON" in str(exc)
    else:
        assert False


def test_adapt_run_manifest_rejects_non_object_manifest(tmp_path: Path) -> None:
    manifest = tmp_path / "run_manifest_not_object.json"
    manifest.write_text("[1, 2, 3]", encoding="utf-8")

    try:
        adapt_run_manifest(
            manifest_path=manifest,
            biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
        )
    except RunManifestAdapterError as exc:
        assert "Run manifest payload must be an object" in str(exc)
    else:
        assert False


def test_adapt_run_manifest_rejects_unsupported_schema_version(tmp_path: Path) -> None:
    manifest_payload = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest.json").read_text(encoding="utf-8")
    )
    manifest_payload["schema_version"] = 2

    manifest = tmp_path / "run_manifest_unsupported_schema.json"
    manifest.write_text(json.dumps(manifest_payload), encoding="utf-8")

    try:
        adapt_run_manifest(
            manifest_path=manifest,
            biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
        )
    except RunManifestAdapterError as exc:
        assert "Unsupported run manifest schema version" in str(exc)
    else:
        assert False


def test_adapt_run_manifest_notes_schema_and_output_missing_fields(tmp_path: Path) -> None:
    incomplete = {}
    manifest = tmp_path / "run_manifest_incomplete.json"
    manifest.write_text(json.dumps(incomplete), encoding="utf-8")

    result = adapt_run_manifest(
        manifest_path=manifest,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    compatibility = result["compatibility"]
    assert len(compatibility["missing_fields"]) == 15
    assert "run_id" in compatibility["missing_fields"]
    assert compatibility["notes"] == [
        "Manifest metrics field was missing or malformed; defaulted to empty metrics.",
        "Manifest outputs field was missing or malformed; defaulted to empty outputs.",
    ]
    assert result["run_summary"]["schema_version"] == "run_summary:v1"
    assert result["run_summary"]["status"] == "unknown"
    assert result["run_summary"]["records_in"] is None


def test_adapt_run_manifest_collects_missing_stage_names(tmp_path: Path) -> None:
    payload = {
        "run_id": "fixture-missing-stages",
        "status": "complete",
        "command": ["biominer", "run", "demo"],
        "git_sha": "1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
        "storage_backend": "local",
        "workstore_backend": "file",
        "started_at": "2026-07-15T00:00:00Z",
        "ended_at": "2026-07-15T00:01:00Z",
        "taxon_scope": {"input_name": "Papilio demoleus"},
        "query_counts": {"total": 12},
        "detection_counts": {},
        "bioclip_counts": {},
        "evidence_counts": {},
        "metrics": {},
        "outputs": {},
        "stages": [
            {"status": "complete"},
            "non-dict-stage",
            {"stage": "detect_objects", "status": "complete"},
        ],
    }

    manifest_path = tmp_path / "run_manifest_missing_stage_names.json"
    manifest_path.write_text(json.dumps(payload), encoding="utf-8")

    result = adapt_run_manifest(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["compatibility"]["missing_stage_names"] == [None]
    assert result["run_summary"]["stage_count"] == 3


def test_adapt_run_manifest_treats_blank_status_as_unknown(tmp_path: Path) -> None:
    manifest_payload = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest.json").read_text(encoding="utf-8")
    )
    manifest_payload["status"] = "   "

    manifest_path = tmp_path / "run_manifest_blank_status.json"
    manifest_path.write_text(json.dumps(manifest_payload), encoding="utf-8")

    result = adapt_run_manifest(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["run_summary"]["status"] == "unknown"
    assert "status" not in result["compatibility"]["missing_fields"]
