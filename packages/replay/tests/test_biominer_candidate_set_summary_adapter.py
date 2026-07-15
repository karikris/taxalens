import json
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


def test_adapt_candidate_set_summaries_treats_non_string_output_values_as_missing_artifact(
    tmp_path: Path,
) -> None:
    manifest = json.loads(
        Path("packages/replay/tests/fixtures/run_manifest_target_aware_candidate_scores.json").read_text(
            encoding="utf-8"
        )
    )
    manifest["outputs"] = {
        "target_aware_candidate_scores": 101,
        "candidate_scores": {"path": "candidate_scores_payload.json"},
        "target_scores": None,
    }

    manifest_path = tmp_path / "run_manifest_target_aware_candidate_scores_non_string_outputs.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    result = adapt_candidate_set_summaries(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["candidate_set_summaries"] == []
    assert result["compatibility"]["source_artifact"] is None
    assert "run manifest did not provide a candidate score artifact" in str(
        result["compatibility"]["notes"][0]
    )


def test_adapt_candidate_set_summaries_rejects_missing_manifest() -> None:
    try:
        adapt_candidate_set_summaries(
            manifest_path=Path("tmp_missing_candidate_set_manifest.json"),
            biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
        )
    except CandidateSetSummaryAdapterError as exc:
        assert "File not found" in str(exc)
    else:
        assert False


def test_adapt_candidate_set_summaries_rejects_invalid_manifest_json(tmp_path: Path) -> None:
    manifest_path = tmp_path / "run_manifest_invalid.json"
    manifest_path.write_text("{invalid_json:", encoding="utf-8")

    try:
        adapt_candidate_set_summaries(
            manifest_path=manifest_path,
            biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
        )
    except CandidateSetSummaryAdapterError as exc:
        assert "Not valid JSON" in str(exc)
    else:
        assert False


def test_adapt_candidate_set_summaries_rejects_non_object_manifest(tmp_path: Path) -> None:
    manifest_path = tmp_path / "run_manifest_not_object.json"
    manifest_path.write_text("[1, 2, 3]", encoding="utf-8")

    try:
        adapt_candidate_set_summaries(
            manifest_path=manifest_path,
            biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
        )
    except CandidateSetSummaryAdapterError as exc:
        assert "Run manifest payload must be a JSON object" in str(exc)
    else:
        assert False


def test_adapt_candidate_set_summaries_falls_back_to_candidate_scores_key(tmp_path: Path) -> None:
    manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_target_aware_candidate_scores.json"
        ).read_text(encoding="utf-8")
    )
    manifest["outputs"] = {
        "candidate_scores": "candidate_scores_payload.json"
    }

    manifest_path = tmp_path / "run_manifest_target_aware_candidate_scores.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    (tmp_path / "candidate_scores_payload.json").write_text(
        json.dumps(
            [
                {
                    "flickr_photo_id": "photo-001",
                    "accepted_taxon_key": "gbif:11111",
                    "scientific_name": "Species One",
                    "target_candidate": True,
                },
                {
                    "flickr_photo_id": "photo-001",
                    "accepted_taxon_key": "gbif:11112",
                    "scientific_name": "Species Two",
                    "target_candidate": False,
                },
            ],
            )
        ,
        encoding="utf-8",
    )

    result = adapt_candidate_set_summaries(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    summaries = result["candidate_set_summaries"]
    assert len(summaries) == 1
    assert summaries[0]["media_id"] == "photo-001"
    assert summaries[0]["total_candidates"] == 2


def test_adapt_candidate_set_summaries_falls_back_to_candidate_scores_when_primary_key_non_string(
    tmp_path: Path,
) -> None:
    manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_target_aware_candidate_scores.json"
        ).read_text(encoding="utf-8")
    )
    manifest["outputs"]["target_aware_candidate_scores"] = []
    manifest["outputs"]["candidate_scores"] = "candidate_scores_fallback.json"

    manifest_path = tmp_path / "run_manifest_target_aware_candidate_scores_fallback.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    (tmp_path / "candidate_scores_fallback.json").write_text(
        json.dumps(
            {
                "candidates": [
                    {
                        "flickr_photo_id": "photo-010",
                        "accepted_taxon_key": "gbif:77777",
                        "scientific_name": "Fallback Candidate",
                        "target_candidate": True,
                    }
                ]
            }
        ),
        encoding="utf-8",
    )

    result = adapt_candidate_set_summaries(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert len(result["candidate_set_summaries"]) == 1
    assert result["candidate_set_summaries"][0]["media_id"] == "photo-010"
    assert result["candidate_set_summaries"][0]["total_candidates"] == 1
    assert result["compatibility"]["source_artifact"].endswith("candidate_scores_fallback.json")
    notes = result["compatibility"]["notes"]
    assert not any("candidate score artifact" in note for note in notes)

def test_adapt_candidate_set_summaries_falls_back_to_target_scores_key(tmp_path: Path) -> None:
    manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_target_aware_candidate_scores.json"
        ).read_text(encoding="utf-8")
    )
    manifest["outputs"] = {
        "target_scores": "target_scores_payload.json"
    }

    manifest_path = tmp_path / "run_manifest_target_aware_candidate_scores.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    (tmp_path / "target_scores_payload.json").write_text(
        json.dumps(
            {
                "candidates": [
                    {
                        "source_record_hash": "photo-002",
                        "accepted_taxon_key": "gbif:22222",
                        "candidate_name": "Candidate One",
                        "candidate_priority": "1",
                    },
                    {
                        "source_record_hash": "photo-002",
                        "accepted_taxon_key": "gbif:22223",
                        "candidate_name": "Candidate Two",
                        "candidate_priority": "0",
                    },
                ]
            }
        ),
        encoding="utf-8",
    )

    result = adapt_candidate_set_summaries(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    summaries = result["candidate_set_summaries"]
    assert len(summaries) == 1
    assert summaries[0]["media_id"] == "photo-002"
    assert summaries[0]["total_candidates"] == 2
    assert summaries[0]["candidate_names"] == ["Candidate Two", "Candidate One"]


def test_adapt_candidate_set_summaries_extracts_mapping_rows_only_and_falls_back_taxon_scope(tmp_path: Path) -> None:
    manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_target_aware_candidate_scores.json"
        ).read_text(encoding="utf-8")
    )
    manifest["outputs"] = {
        "target_aware_candidate_scores": "mixed_candidate_scores.json"
    }
    manifest["taxon_scope"] = {
        "accepted_taxon_key": "gbif:fallback",
        "accepted_scientific_name": "Fallback species",
    }

    manifest_path = tmp_path / "run_manifest_target_aware_candidate_scores.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    (tmp_path / "mixed_candidate_scores.json").write_text(
        json.dumps(
            {
                "data": [
                    {"flickr_photo_id": "photo-003", "accepted_taxon_key": "gbif:333", "scientific_name": "S1"},
                    4,
                    {"media_id": "photo-004", "accepted_taxon_key": "gbif:444"},
                ]
            }
        ),
        encoding="utf-8",
    )

    result = adapt_candidate_set_summaries(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    summaries = result["candidate_set_summaries"]
    assert len(summaries) == 2
    media_ids = sorted(item["media_id"] for item in summaries)
    assert media_ids == ["photo-003", "photo-004"]
    for summary in summaries:
        assert summary["target_taxon_key"] == "gbif:fallback"
        assert summary["target_taxon_name"] == "Fallback species"
        assert summary["candidate_names"] == ["S1"] if summary["media_id"] == "photo-003" else ["gbif:444"]


def test_adapt_candidate_set_summaries_reports_empty_notes_for_empty_payload(tmp_path: Path) -> None:
    manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_target_aware_candidate_scores.json"
        ).read_text(encoding="utf-8")
    )
    manifest["outputs"] = {
        "target_aware_candidate_scores": "empty_candidate_scores.json"
    }

    manifest_path = tmp_path / "run_manifest_target_aware_candidate_scores.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    (tmp_path / "empty_candidate_scores.json").write_text("{}", encoding="utf-8")

    result = adapt_candidate_set_summaries(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["candidate_set_summaries"] == []
    assert any("candidate score artifact was empty" in note for note in result["compatibility"]["notes"])
    assert result["compatibility"]["summary_rows_read"] == 0


def test_adapt_candidate_set_summaries_marks_missing_artifact_file(tmp_path: Path) -> None:
    manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_target_aware_candidate_scores.json"
        ).read_text(encoding="utf-8")
    )
    missing_path = tmp_path / "missing_candidate_scores.json"
    manifest["outputs"]["target_aware_candidate_scores"] = str(missing_path)

    manifest_path = tmp_path / "run_manifest_target_aware_candidate_scores.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    result = adapt_candidate_set_summaries(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["candidate_set_summaries"] == []
    compatibility = result["compatibility"]
    assert compatibility["source_artifact"] == str(missing_path)
    assert compatibility["summary_rows_read"] == 0
    assert "candidate score artifact was not present" in str(compatibility["notes"][0])


def test_adapt_candidate_set_summaries_records_missing_media_id_notes(tmp_path: Path) -> None:
    manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_target_aware_candidate_scores.json"
        ).read_text(encoding="utf-8")
    )
    manifest["outputs"]["target_aware_candidate_scores"] = "candidate_scores_payload.json"

    manifest_path = tmp_path / "run_manifest_target_aware_candidate_scores.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    (tmp_path / "candidate_scores_payload.json").write_text(
        json.dumps(
            [
                {
                    "flickr_photo_id": "photo-001",
                    "accepted_taxon_key": "gbif:11111",
                    "scientific_name": "Species One",
                    "target_candidate": True,
                },
                {
                    "accepted_taxon_key": "gbif:11112",
                    "scientific_name": "Species Two",
                },
                {
                    "flickr_photo_id": "",
                    "accepted_taxon_key": "gbif:11113",
                    "scientific_name": "Species Three",
                },
            ],
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    result = adapt_candidate_set_summaries(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    summaries = result["candidate_set_summaries"]
    assert len(summaries) == 1
    assert summaries[0]["media_id"] == "photo-001"
    assert summaries[0]["total_candidates"] == 1
    assert summaries[0]["candidate_names"] == ["Species One"]
    assert "missing_media_id_row_1" in result["compatibility"]["notes"]
    assert "missing_media_id_row_2" in result["compatibility"]["notes"]
