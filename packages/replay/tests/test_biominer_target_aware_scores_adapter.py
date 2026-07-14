import json
from pathlib import Path

import pytest

from packages.replay.src.biominer_target_aware_scores_adapter import (
    TargetAwareScoresAdapterError,
    adapt_target_aware_candidate_scores,
)


def test_adapt_target_aware_candidate_scores_from_fixture() -> None:
    manifest = Path(
        "packages/replay/tests/fixtures/run_manifest_target_aware_candidate_scores.json"
    )
    result = adapt_target_aware_candidate_scores(
        manifest_path=manifest,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    scores = result["candidate_scores"]
    assert len(scores) == 3
    assert scores[0]["schema_version"] == "candidate_score:v1"
    assert scores[0]["biominer_commit"] == "1535c494f9403e22ed9b163f3ae0ce3706e17f4c"
    assert scores[0]["media_id"] == "photo-001"
    assert scores[0]["candidate_taxon_key"] == "gbif:54321"
    assert scores[0]["candidate_set_id"] == "cs-001"
    assert scores[0]["calibrated_label"] == "target_confirmed"
    assert abs(scores[0]["raw_similarity"] - 0.9123) < 1e-9
    assert abs(scores[0]["calibrated_score"] - 0.9211) < 1e-9

    assert scores[1]["candidate_taxon_key"] == "gbif:99999"
    assert scores[1]["calibrated_label"] == "competitor"
    assert scores[2]["candidate_set_id"] == "cs-002"
    assert scores[2]["calibrated_label"] == "abstain"

    compatibility = result["compatibility"]
    assert compatibility["source_path"] == str(manifest)
    assert compatibility["artifact_missing"] is False
    assert compatibility["rows_read"] == 3
    assert compatibility["artifact_path"].endswith("target_aware_candidate_scores.json")


def test_adapt_target_aware_candidate_scores_rejects_invalid_biominer_sha() -> None:
    manifest = Path(
        "packages/replay/tests/fixtures/run_manifest_target_aware_candidate_scores.json"
    )
    try:
        adapt_target_aware_candidate_scores(
            manifest_path=manifest,
            biominer_commit="short-sha",
        )
    except TargetAwareScoresAdapterError as exc:
        assert "40-character" in str(exc)
    else:
        assert False


def test_adapt_target_aware_candidate_scores_rejects_non_object_manifest(tmp_path: Path) -> None:
    manifest_path = tmp_path / "run_manifest_not_object.json"
    manifest_path.write_text("[1, 2, 3]", encoding="utf-8")

    try:
        adapt_target_aware_candidate_scores(
            manifest_path=manifest_path,
            biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
        )
    except TargetAwareScoresAdapterError as exc:
        assert "payload must be a JSON object" in str(exc)
    else:
        assert False


def test_adapt_target_aware_candidate_scores_rejects_invalid_manifest_json(tmp_path: Path) -> None:
    manifest_path = tmp_path / "run_manifest_invalid.json"
    manifest_path.write_text("{invalid_json:", encoding="utf-8")

    try:
        adapt_target_aware_candidate_scores(
            manifest_path=manifest_path,
            biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
        )
    except TargetAwareScoresAdapterError as exc:
        assert "Run manifest is not valid JSON" in str(exc)
    else:
        assert False


def test_adapt_target_aware_candidate_scores_rejects_unsupported_manifest_schema_version(tmp_path: Path) -> None:
    manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_target_aware_candidate_scores.json"
        ).read_text(encoding="utf-8")
    )
    manifest["schema_version"] = 2

    manifest_path = tmp_path / "tmp_unsupported_manifest.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    try:
        adapt_target_aware_candidate_scores(
            manifest_path=manifest_path,
            biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
        )
    except TargetAwareScoresAdapterError as exc:
        assert "Unsupported run manifest schema version" in str(exc)
    else:
        assert False


def test_adapt_target_aware_candidate_scores_without_artifact_returns_empty_result() -> None:
    manifest = Path("packages/replay/tests/fixtures/run_manifest.json")
    result = adapt_target_aware_candidate_scores(
        manifest_path=manifest,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["candidate_scores"] == []
    assert result["compatibility"]["artifact_missing"] is True
    assert "did not declare target-aware candidate score artifact path" in str(
        result["compatibility"]["notes"][0]
    )


def test_adapt_target_aware_candidate_scores_returns_empty_for_non_parseable_artifact(tmp_path: Path) -> None:
    manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_target_aware_candidate_scores.json"
        ).read_text(encoding="utf-8")
    )
    manifest["outputs"]["target_aware_candidate_scores"] = str(
        tmp_path / "target_aware_candidate_scores.json"
    )

    score_path = tmp_path / "target_aware_candidate_scores.json"
    score_path.write_text("{invalid_json", encoding="utf-8")

    manifest_path = tmp_path / "run_manifest_target_aware_candidate_scores.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    result = adapt_target_aware_candidate_scores(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["candidate_scores"] == []
    assert result["compatibility"]["artifact_missing"] is False
    assert "candidate score artifact was not parseable" in result["compatibility"]["notes"][0]


def test_adapt_target_aware_candidate_scores_marks_missing_artifact_file(tmp_path: Path) -> None:
    manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_target_aware_candidate_scores.json"
        ).read_text(encoding="utf-8")
    )
    missing_path = tmp_path / "missing_target_aware_candidate_scores.json"
    manifest["outputs"]["target_aware_candidate_scores"] = str(missing_path)

    manifest_path = tmp_path / "run_manifest_target_aware_candidate_scores.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    result = adapt_target_aware_candidate_scores(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["candidate_scores"] == []
    assert result["compatibility"]["artifact_missing"] is True
    assert str(missing_path) in result["compatibility"]["notes"][0]


def test_adapt_target_aware_candidate_scores_reports_empty_payload_notes(tmp_path: Path) -> None:
    manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_target_aware_candidate_scores.json"
        ).read_text(encoding="utf-8")
    )
    manifest["outputs"]["target_aware_candidate_scores"] = str(
        tmp_path / "target_aware_candidate_scores.json"
    )

    score_path = tmp_path / "target_aware_candidate_scores.json"
    score_path.write_text("{}", encoding="utf-8")

    manifest_path = tmp_path / "run_manifest_target_aware_candidate_scores.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    result = adapt_target_aware_candidate_scores(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["candidate_scores"] == []
    assert result["compatibility"]["rows_read"] == 0
    assert "candidate score artifact was empty or had no rows" in result["compatibility"]["notes"]


def test_adapt_target_aware_candidate_scores_skips_rows_without_identity(tmp_path: Path) -> None:
    manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_target_aware_candidate_scores.json"
        ).read_text(encoding="utf-8")
    )
    scores_payload = [
        {},
        json.loads(
            Path("packages/replay/tests/fixtures/target_aware_candidate_scores.json").read_text(
                encoding="utf-8"
            )
        )[0],
    ]

    manifest["outputs"]["target_aware_candidate_scores"] = str(
        tmp_path / "target_aware_candidate_scores.json"
    )

    score_path = tmp_path / "target_aware_candidate_scores.json"
    manifest_path = tmp_path / "run_manifest_target_aware_candidate_scores.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    score_path.write_text(json.dumps(scores_payload), encoding="utf-8")

    result = adapt_target_aware_candidate_scores(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert len(result["candidate_scores"]) == 1
    assert result["compatibility"]["skipped_rows"] == ["missing_candidate_identity_0"]
    assert any("skipped 1 candidate-score rows while adapting" in note for note in result["compatibility"]["notes"])


def test_adapt_target_aware_candidate_scores_extracts_rows_from_object_payload_keys(tmp_path: Path) -> None:
    manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_target_aware_candidate_scores.json"
        ).read_text(encoding="utf-8")
    )
    scores_payload = {
        "rows": [
            {
                "candidate_set_id": "cs-001",
                "accepted_taxon_key": "gbif:54321",
                "classification_decision": "target_confirmed",
            }
        ]
    }

    manifest["outputs"]["target_aware_candidate_scores"] = str(
        tmp_path / "target_aware_candidate_scores.json"
    )

    score_path = tmp_path / "target_aware_candidate_scores.json"
    score_path.write_text(json.dumps(scores_payload), encoding="utf-8")
    manifest_path = tmp_path / "run_manifest_target_aware_candidate_scores.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    result = adapt_target_aware_candidate_scores(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["compatibility"]["rows_read"] == 1
    assert len(result["candidate_scores"]) == 1
    assert result["candidate_scores"][0]["candidate_set_id"] == "cs-001"


def test_adapt_target_aware_candidate_scores_falls_back_to_candidate_scores_output_key(tmp_path: Path) -> None:
    manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_target_aware_candidate_scores.json"
        ).read_text(encoding="utf-8")
    )
    manifest["outputs"] = {
        "candidate_scores": str(tmp_path / "fallback_candidate_scores.json")
    }

    score_path = tmp_path / "fallback_candidate_scores.json"
    score_path.write_text(
        json.dumps(
            [
                {
                    "candidate_set_id": "cs-fallback",
                    "accepted_taxon_key": "gbif:54321",
                    "classification_decision": "target_confirmed",
                }
            ]
        ),
        encoding="utf-8",
    )

    manifest_path = tmp_path / "run_manifest_target_aware_candidate_scores.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    result = adapt_target_aware_candidate_scores(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert len(result["candidate_scores"]) == 1
    assert result["candidate_scores"][0]["candidate_set_id"] == "cs-fallback"
    assert result["compatibility"]["artifact_path"].endswith("fallback_candidate_scores.json")


def test_adapt_target_aware_candidate_scores_extracts_rows_from_candidates_key(tmp_path: Path) -> None:
    manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_target_aware_candidate_scores.json"
        ).read_text(encoding="utf-8")
    )
    manifest["outputs"]["target_aware_candidate_scores"] = str(
        tmp_path / "target_aware_candidate_scores.json"
    )

    score_payload = {
        "candidates": [
            {
                "candidate_set_id": "cs-candidates",
                "accepted_taxon_key": "gbif:54321",
                "classification_decision": "abstain",
            }
        ]
    }
    score_path = tmp_path / "target_aware_candidate_scores.json"
    score_path.write_text(json.dumps(score_payload), encoding="utf-8")

    manifest_path = tmp_path / "run_manifest_target_aware_candidate_scores.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    result = adapt_target_aware_candidate_scores(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["compatibility"]["rows_read"] == 1
    assert len(result["candidate_scores"]) == 1
    assert result["candidate_scores"][0]["calibrated_label"] == "abstain"
@pytest.mark.parametrize(
    ("decision", "expected_label"),
    [
        ("target_confirmed", "target_confirmed"),
        ("TARGET_PROBABLE", "target_probable"),
        ("target_probable_review", "target_probable"),
        ("abstain", "abstain"),
        ("known_regional_competitor", "competitor"),
        ("KNOWN_NONREGIONAL_COMPETITOR", "competitor"),
        ("known_competitor", "competitor"),
        ("other_butterfly", "negative"),
        ("non_butterfly_insect", "negative"),
        ("OTHER_INSECT", "negative"),
    ],
)
def test_adapt_target_aware_candidate_scores_normalizes_decision_aliases(
    decision: str, expected_label: str, tmp_path: Path
) -> None:
    manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_target_aware_candidate_scores.json"
        ).read_text(encoding="utf-8")
    )
    scores_payload = [
        json.loads(
            Path("packages/replay/tests/fixtures/target_aware_candidate_scores.json").read_text(
                encoding="utf-8"
            )
        )[0]
    ]

    scores_payload[0]["classification_decision"] = decision

    manifest["outputs"]["target_aware_candidate_scores"] = str(
        tmp_path / "target_aware_candidate_scores.json"
    )

    score_path = tmp_path / "target_aware_candidate_scores.json"
    manifest_path = tmp_path / "run_manifest_target_aware_candidate_scores.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    score_path.write_text(json.dumps(scores_payload), encoding="utf-8")

    result = adapt_target_aware_candidate_scores(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["candidate_scores"][0]["calibrated_label"] == expected_label


def test_adapt_target_aware_candidate_scores_returns_other_for_unknown_decision(
    tmp_path: Path,
) -> None:
    manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_target_aware_candidate_scores.json"
        ).read_text(encoding="utf-8")
    )
    scores_payload = [
        json.loads(
            Path("packages/replay/tests/fixtures/target_aware_candidate_scores.json").read_text(
                encoding="utf-8"
            )
        )[0]
    ]
    scores_payload[0]["classification_decision"] = "mystery_status_42"

    manifest["outputs"]["target_aware_candidate_scores"] = str(
        tmp_path / "target_aware_candidate_scores.json"
    )

    score_path = tmp_path / "target_aware_candidate_scores.json"
    manifest_path = tmp_path / "run_manifest_target_aware_candidate_scores.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    score_path.write_text(json.dumps(scores_payload), encoding="utf-8")

    result = adapt_target_aware_candidate_scores(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    assert result["candidate_scores"][0]["calibrated_label"] == "other"


def test_adapt_target_aware_candidate_scores_prefers_fallback_labels(tmp_path: Path) -> None:
    manifest = json.loads(
        Path(
            "packages/replay/tests/fixtures/run_manifest_target_aware_candidate_scores.json"
        ).read_text(encoding="utf-8")
    )
    row_0 = json.loads(
        Path("packages/replay/tests/fixtures/target_aware_candidate_scores.json").read_text(
            encoding="utf-8"
        )
    )[0]
    row_1 = json.loads(
        Path("packages/replay/tests/fixtures/target_aware_candidate_scores.json").read_text(
            encoding="utf-8"
        )
    )[0]
    row_2 = json.loads(
        Path("packages/replay/tests/fixtures/target_aware_candidate_scores.json").read_text(
            encoding="utf-8"
        )
    )[0]

    row_0.pop("classification_decision", None)
    row_0["target_candidate"] = True
    row_0["abstained"] = False

    row_1.pop("classification_decision", None)
    row_1["target_candidate"] = False
    row_1["abstained"] = True

    row_2.pop("classification_decision", None)
    row_2["target_accepted_taxon_key"] = "gbif:00001"
    row_2["accepted_taxon_key"] = "gbif:00002"
    row_2["target_candidate"] = False
    row_2["abstained"] = False

    manifest["outputs"]["target_aware_candidate_scores"] = str(
        tmp_path / "target_aware_candidate_scores.json"
    )

    score_path = tmp_path / "target_aware_candidate_scores.json"
    manifest_path = tmp_path / "run_manifest_target_aware_candidate_scores.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    score_path.write_text(
        json.dumps([row_0, row_1, row_2]), encoding="utf-8"
    )

    result = adapt_target_aware_candidate_scores(
        manifest_path=manifest_path,
        biominer_commit="1535c494f9403e22ed9b163f3ae0ce3706e17f4c",
    )

    labels = [row["calibrated_label"] for row in result["candidate_scores"]]
    assert labels == ["target_probable", "abstain", "competitor"]
