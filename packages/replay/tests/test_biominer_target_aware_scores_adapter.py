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
