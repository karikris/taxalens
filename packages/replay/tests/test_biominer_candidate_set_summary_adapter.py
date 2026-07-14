from pathlib import Path

from packages.replay.src.biominer_candidate_set_summary_adapter import (
    CandidateSetSummaryAdapterError,
    adapt_candidate_set_summaries,
)


def test_adapt_candidate_set_summaries_from_fixture() -> None:
    manifest = Path(
        "packages/replay/tests/fixtures/run_manifest_target_aware_candidate_scores.json"
    )
    result = adapt_candidate_set_summaries(
        manifest_path=manifest,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    summaries = result["candidate_set_summaries"]
    assert len(summaries) == 2
    photo_001 = next(item for item in summaries if item["media_id"] == "photo-001")
    photo_002 = next(item for item in summaries if item["media_id"] == "photo-002")

    assert photo_001["run_id"] == "fixture-target-aware-scores-0001"
    assert photo_001["target_taxon_key"] == "gbif:54321"
    assert photo_001["total_candidates"] == 2
    assert photo_001["eligible_candidates"] == 2
    assert photo_001["candidate_names"] == ["Papilio demoleus", "Papilio polytes"]
    assert photo_001["candidate_version"] == 1

    assert photo_002["total_candidates"] == 1
    assert photo_002["candidate_names"] == ["Papilio demoleus"]
    assert photo_002["source_artifact"].endswith("target_aware_candidate_scores.json")

    compatibility = result["compatibility"]
    assert compatibility["source_artifact"].endswith("target_aware_candidate_scores.json")
    assert compatibility["summary_rows_read"] == 3


def test_adapt_candidate_set_summaries_rejects_invalid_biominer_sha() -> None:
    manifest = Path(
        "packages/replay/tests/fixtures/run_manifest_target_aware_candidate_scores.json"
    )
    try:
        adapt_candidate_set_summaries(
            manifest_path=manifest,
            biominer_commit="bad-sha",
        )
    except CandidateSetSummaryAdapterError as exc:
        assert "40-character" in str(exc)
    else:
        assert False


def test_adapt_candidate_set_summaries_without_artifact() -> None:
    manifest = Path("packages/replay/tests/fixtures/run_manifest.json")
    result = adapt_candidate_set_summaries(
        manifest_path=manifest,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )
    assert result["candidate_set_summaries"] == []
    assert "candidate score artifact" in str(result["compatibility"]["notes"][0])
