from __future__ import annotations

import copy
import hashlib
import importlib.util
import json
from pathlib import Path
from typing import Any

import pytest
from tests.test_geographic_usability_study_contract import valid_session

ROOT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = ROOT / "scripts/summarize_geographic_usability_study.py"
RAW_PATH = ROOT / "demo/source/impact/geographic-impact-usability-study.raw.json"
SCHEMA_PATH = ROOT / "packages/contracts/schema/geographic_usability_study.schema.json"
SUMMARY_PATH = ROOT / "demo/source/impact/geographic-impact-usability-study.summary.json"

spec = importlib.util.spec_from_file_location("geographic_usability_summary", SCRIPT_PATH)
assert spec is not None and spec.loader is not None
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def read(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_committed_report_is_pending_with_null_metrics() -> None:
    raw = read(RAW_PATH)
    schema = read(SCHEMA_PATH)
    summary = read(SUMMARY_PATH)
    rebuilt = module.build_summary(
        raw,
        schema,
        raw_sha256=digest(RAW_PATH),
        schema_sha256=digest(SCHEMA_PATH),
    )

    assert summary == rebuilt
    assert summary["status"] == "pending_human_data"
    assert summary["sample"]["analysisEligibleSessionCount"] == 0
    assert summary["interpretation"]["accuracy"] is None
    assert summary["claims"] == {
        "humanUsabilityMeasured": False,
        "humanTimeSavingsAllowed": False,
        "causalProductImpactAllowed": False,
        "studyObservationsAreReviewEvidence": False,
    }
    assert summary["humanWorkRemaining"]
    assert all(
        metrics["activeMilliseconds"]
        == {
            "count": 0,
            "minimum": None,
            "median": None,
            "maximum": None,
        }
        for metrics in summary["taskMetrics"].values()
    )


def test_report_summarizes_a_valid_genuine_session_without_identity() -> None:
    raw = read(RAW_PATH)
    schema = read(SCHEMA_PATH)
    session = valid_session()
    session["tasks"][4]["interpretationAnswers"] = [
        {"statementId": "candidate_present", "answer": "supported", "correct": True},
        {
            "statementId": "biological_absence",
            "answer": "unsupported",
            "correct": True,
        },
    ]
    session["tasks"][0]["errors"] = ["navigation"]
    raw["status"] = "collecting"
    raw["claims"]["humanParticipantCount"] = 1
    raw["claims"]["humanUsabilityMeasured"] = True
    raw["sessions"] = [session]

    summary = module.build_summary(
        raw,
        schema,
        raw_sha256="c" * 64,
        schema_sha256="b" * 64,
    )

    assert summary["status"] == "available_descriptive"
    assert summary["sample"]["analysisEligibleSessionCount"] == 1
    assert summary["taskMetrics"]["identify_country_gap"]["activeMilliseconds"]["median"] == 60_000
    assert summary["interpretation"] == {
        "answerCount": 2,
        "correctAnswerCount": 2,
        "accuracy": 1,
    }
    assert summary["errors"] == {"total": 1, "byCategory": {"navigation": 1}}
    serialized = json.dumps(summary)
    assert session["participant"]["participantIdHash"] not in serialized
    assert "comment" not in serialized


def test_import_rejects_claim_mismatch_and_nonchronological_tasks() -> None:
    raw = read(RAW_PATH)
    schema = read(SCHEMA_PATH)
    raw["sessions"] = [valid_session()]
    with pytest.raises(ValueError, match="participant claim"):
        module.build_summary(
            raw,
            schema,
            raw_sha256="a" * 64,
            schema_sha256="b" * 64,
        )

    raw = read(RAW_PATH)
    raw["status"] = "collecting"
    raw["claims"]["humanParticipantCount"] = 1
    raw["claims"]["humanUsabilityMeasured"] = True
    session = copy.deepcopy(valid_session())
    session["tasks"][1]["startedAt"] = "2026-07-18T00:00:00Z"
    raw["sessions"] = [session]
    with pytest.raises(ValueError, match="not chronological"):
        module.build_summary(
            raw,
            schema,
            raw_sha256="a" * 64,
            schema_sha256="b" * 64,
        )
