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
