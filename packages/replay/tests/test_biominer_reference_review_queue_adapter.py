from pathlib import Path

from packages.replay.src.biominer_reference_review_queue_adapter import (
    ReferenceReviewQueueAdapterError,
    adapt_reference_review_queue,
)


def test_adapt_reference_review_queue_from_fixture() -> None:
    manifest = Path(
        "packages/replay/tests/fixtures/run_manifest_reference_review_queue.json"
    )
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
    assert summary["unique_taxon_count"] == 2
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
    manifest = Path(
        "packages/replay/tests/fixtures/run_manifest_reference_review_queue.json"
    )
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
    assert (
        "run manifest did not declare reference review queue artifact path"
        in str(result["compatibility"]["notes"][0])
    )
