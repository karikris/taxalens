import json
from pathlib import Path

from packages.replay.src.biominer_object_evidence_summary_adapter import (
    ObjectEvidenceSummaryAdapterError,
    adapt_object_evidence_summary,
)


def test_adapt_object_evidence_summary_from_fixture() -> None:
    manifest = Path("packages/replay/tests/fixtures/run_manifest_object_evidence_summary.json")
    result = adapt_object_evidence_summary(
        manifest_path=manifest,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    summary = result["object_evidence_summary"]
    assert summary["schema_version"] == "object_evidence_summary:v1"
    assert summary["run_id"] == "fixture-object-evidence-summary-0001"
    assert summary["object_evidence_rows"] == 3
    assert summary["photo_summary_rows"] == 3
    assert summary["object_occurrence_bin_counts"] == {
        "adult": 2,
        "larva": 1,
    }
    assert summary["photo_occurrence_bin_counts"] == {
        "single_image": 2,
        "multi_image": 1,
    }

    compatibility = result["compatibility"]
    assert compatibility["artifact_missing"] is False
    assert compatibility["object_rows_read"] == 3
    assert compatibility["photo_rows_read"] == 3


def test_adapt_object_evidence_summary_rejects_invalid_biominer_sha() -> None:
    manifest = Path("packages/replay/tests/fixtures/run_manifest_object_evidence_summary.json")
    try:
        adapt_object_evidence_summary(
            manifest_path=manifest,
            biominer_commit="short-sha",
        )
    except ObjectEvidenceSummaryAdapterError as exc:
        assert "40-character" in str(exc)
    else:
        assert False


def test_adapt_object_evidence_summary_missing_artifacts() -> None:
    manifest = Path("packages/replay/tests/fixtures/run_manifest.json")
    result = adapt_object_evidence_summary(
        manifest_path=manifest,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    summary = result["object_evidence_summary"]
    assert summary["object_evidence_rows"] is None
    assert summary["photo_summary_rows"] is None
    assert summary["object_occurrence_bin_counts"] == {}
    assert summary["photo_occurrence_bin_counts"] == {}
    assert result["compatibility"]["artifact_missing"] is True


def test_adapt_object_evidence_summary_rejects_missing_manifest() -> None:
    try:
        adapt_object_evidence_summary(
            manifest_path=Path("tmp_missing_object_evidence_manifest.json"),
            biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
        )
    except ObjectEvidenceSummaryAdapterError as exc:
        assert "Run manifest not found" in str(exc)
    else:
        assert False


def test_adapt_object_evidence_summary_rejects_invalid_manifest_json(tmp_path: Path) -> None:
    manifest_path = tmp_path / "run_manifest_invalid.json"
    manifest_path.write_text("{invalid_json:", encoding="utf-8")

    try:
        adapt_object_evidence_summary(
            manifest_path=manifest_path,
            biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
        )
    except ObjectEvidenceSummaryAdapterError as exc:
        assert "Run manifest is not valid JSON" in str(exc)
    else:
        assert False


def test_adapt_object_evidence_summary_rejects_non_object_manifest(tmp_path: Path) -> None:
    manifest_path = tmp_path / "run_manifest_not_object.json"
    manifest_path.write_text("[1, 2, 3]", encoding="utf-8")

    try:
        adapt_object_evidence_summary(
            manifest_path=manifest_path,
            biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
        )
    except ObjectEvidenceSummaryAdapterError as exc:
        assert "Run manifest payload must be a JSON object" in str(exc)
    else:
        assert False


def test_adapt_object_evidence_summary_prefers_joined_output_key(tmp_path: Path) -> None:
    manifest = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_object_evidence_summary.json").read_text(
            encoding="utf-8"
        )
    )
    manifest["outputs"] = {
        "object_evidence_joined": "object_evidence.json",
        "photo_summary": "photo_summary.json",
    }

    manifest_path = tmp_path / "run_manifest_object_evidence_summary.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    (
        tmp_path / "object_evidence.json"
    ).write_text(
        Path("packages/replay/tests/fixtures/object_evidence.json").read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    (
        tmp_path / "photo_summary.json"
    ).write_text(
        Path("packages/replay/tests/fixtures/photo_summary.json").read_text(encoding="utf-8"),
        encoding="utf-8",
    )

    result = adapt_object_evidence_summary(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["object_evidence_summary"]["object_evidence_rows"] == 3
    assert result["compatibility"]["artifact_missing"] is False


def test_adapt_object_evidence_summary_prefers_photo_evidence_summary_key(tmp_path: Path) -> None:
    manifest = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_object_evidence_summary.json").read_text(
            encoding="utf-8"
        )
    )
    manifest["outputs"] = {
        "object_evidence": "object_evidence.json",
        "photo_evidence_summary": "photo_summary.json",
    }

    manifest_path = tmp_path / "run_manifest_object_evidence_summary.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    (
        tmp_path / "object_evidence.json"
    ).write_text(
        Path("packages/replay/tests/fixtures/object_evidence.json").read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    (
        tmp_path / "photo_summary.json"
    ).write_text(
        Path("packages/replay/tests/fixtures/photo_summary.json").read_text(encoding="utf-8"),
        encoding="utf-8",
    )

    result = adapt_object_evidence_summary(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["object_evidence_summary"]["photo_summary_rows"] == 3
    assert result["compatibility"]["artifact_missing"] is False


def test_adapt_object_evidence_summary_handles_parquet_paths_as_missing(tmp_path: Path) -> None:
    manifest = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_object_evidence_summary.json").read_text(
            encoding="utf-8"
        )
    )
    manifest["outputs"]["object_evidence"] = "object_evidence.parquet"
    manifest["outputs"]["photo_summary"] = "photo_summary.parquet"

    manifest_path = tmp_path / "run_manifest_object_evidence_summary.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    result = adapt_object_evidence_summary(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    compatibility = result["compatibility"]
    assert compatibility["artifact_missing"] is True
    assert compatibility["object_rows_read"] == 0
    assert compatibility["photo_rows_read"] == 0
    assert compatibility["notes"][0].startswith("object_evidence artifact is parquet")


def test_adapt_object_evidence_summary_falls_back_to_object_evidence_joined_on_non_string_path(
    tmp_path: Path,
) -> None:
    manifest = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_object_evidence_summary.json").read_text(
            encoding="utf-8"
        )
    )
    manifest["outputs"]["object_evidence"] = {}
    manifest["outputs"]["object_evidence_joined"] = "object_evidence.json"

    manifest_path = tmp_path / "run_manifest_object_evidence_summary_fallback.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    (tmp_path / "object_evidence.json").write_text(
        Path("packages/replay/tests/fixtures/object_evidence.json").read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    (tmp_path / "photo_summary.json").write_text(
        Path("packages/replay/tests/fixtures/photo_summary.json").read_text(encoding="utf-8"),
        encoding="utf-8",
    )

    result = adapt_object_evidence_summary(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["object_evidence_summary"]["object_evidence_rows"] == 3
    notes = result["compatibility"]["notes"]
    assert not any(
        "did not declare object_evidence artifact path" in note for note in notes
    )
    assert not any("failed to parse object_evidence artifact" in note for note in notes)


def test_adapt_object_evidence_summary_collects_notes_for_parse_errors(tmp_path: Path) -> None:
    manifest = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_object_evidence_summary.json").read_text(
            encoding="utf-8"
        )
    )
    manifest["outputs"]["object_evidence"] = "object_evidence.json"
    manifest["outputs"]["photo_summary"] = "photo_summary_bad.json"

    manifest_path = tmp_path / "run_manifest_object_evidence_summary.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    (tmp_path / "object_evidence.json").write_text(
        Path("packages/replay/tests/fixtures/object_evidence.json").read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    (tmp_path / "photo_summary_bad.json").write_text("{invalid_json", encoding="utf-8")

    result = adapt_object_evidence_summary(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    notes = result["compatibility"]["notes"]
    assert result["object_evidence_summary"]["object_evidence_rows"] == 3
    assert result["object_evidence_summary"]["photo_summary_rows"] is None
    assert result["compatibility"]["artifact_missing"] is True
    assert any("failed to parse photo_summary artifact" in note for note in notes)


def test_adapt_object_evidence_summary_collects_notes_for_object_parse_error(tmp_path: Path) -> None:
    manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_object_evidence_summary.json"
        ).read_text(encoding="utf-8")
    )
    manifest["outputs"]["object_evidence"] = "object_evidence_bad.json"
    manifest["outputs"]["photo_summary"] = "photo_summary.json"

    manifest_path = tmp_path / "run_manifest_object_evidence_summary_bad_object.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    (tmp_path / "object_evidence_bad.json").write_text("{invalid_json", encoding="utf-8")
    (tmp_path / "photo_summary.json").write_text(
        Path("packages/replay/tests/fixtures/photo_summary.json").read_text(encoding="utf-8"),
        encoding="utf-8",
    )

    result = adapt_object_evidence_summary(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    summary = result["object_evidence_summary"]
    compatibility = result["compatibility"]
    assert summary["object_evidence_rows"] is None
    assert summary["photo_summary_rows"] == 3
    assert compatibility["artifact_missing"] is True
    assert any("failed to parse object_evidence artifact" in note for note in compatibility["notes"])
    assert compatibility["object_rows_read"] == 0


def test_adapt_object_evidence_summary_treats_non_dict_outputs_as_missing(tmp_path: Path) -> None:
    manifest = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_object_evidence_summary.json").read_text(
            encoding="utf-8"
        )
    )
    manifest["outputs"] = "not-a-dict"

    manifest_path = tmp_path / "run_manifest_object_evidence_summary.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    result = adapt_object_evidence_summary(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    compatibility = result["compatibility"]
    assert compatibility["artifact_missing"] is True
    assert compatibility["object_evidence_path"] is None
    assert compatibility["photo_summary_path"] is None
    assert (
        "did not declare object_evidence artifact path"
        in compatibility["notes"][0]
    )


def test_adapt_object_evidence_summary_extracts_only_mapping_rows(tmp_path: Path) -> None:
    manifest = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_object_evidence_summary.json").read_text(
            encoding="utf-8"
        )
    )
    manifest["outputs"] = {
        "object_evidence": "object_evidence_mixed.json",
        "photo_summary": "photo_summary_mixed.json",
    }

    manifest_path = tmp_path / "run_manifest_object_evidence_summary.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    (tmp_path / "object_evidence_mixed.json").write_text(
        json.dumps([
            {"occurrence_bin": "adult"},
            123,
            None,
            {"occurrence_bin": "larva"},
        ]),
        encoding="utf-8",
    )
    (tmp_path / "photo_summary_mixed.json").write_text(
        json.dumps([
            {"photo_occurrence_bin": "single_image"},
            "not_a_row",
        ]),
        encoding="utf-8",
    )

    result = adapt_object_evidence_summary(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    summary = result["object_evidence_summary"]
    compatibility = result["compatibility"]
    assert summary["object_evidence_rows"] == 2
    assert summary["photo_summary_rows"] == 1
    assert compatibility["object_rows_read"] == 2
    assert compatibility["photo_rows_read"] == 1
    assert summary["object_occurrence_bin_counts"] == {"adult": 1, "larva": 1}
    assert summary["photo_occurrence_bin_counts"] == {"single_image": 1}
