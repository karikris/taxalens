from __future__ import annotations

import importlib.util
import json
from pathlib import Path
from typing import Any

import pytest

ROOT = Path(__file__).resolve().parents[1]
RAW_PATH = ROOT / "demo" / "source" / "impact" / "verification-impact-study.raw.json"
SUMMARY_PATH = ROOT / "demo" / "source" / "impact" / "verification-impact-summary.json"
SCRIPT_PATH = ROOT / "scripts" / "summarize_verification_impact.py"
REPORT_PATH = ROOT / "docs" / "impact" / "verification-productivity-summary.md"


@pytest.fixture(scope="module")
def raw() -> dict[str, Any]:
    return json.loads(RAW_PATH.read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def summary() -> dict[str, Any]:
    return json.loads(SUMMARY_PATH.read_text(encoding="utf-8"))


def load_summarizer():
    spec = importlib.util.spec_from_file_location(
        "summarize_verification_impact",
        SCRIPT_PATH,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load the impact summarizer.")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_raw_study_is_a_disclosed_matched_scripted_pair(
    raw: dict[str, Any],
) -> None:
    assert raw["measurementKind"] == "scripted_browser_protocol"
    assert raw["claims"] == {
        "humanParticipants": 0,
        "humanProductivityMeasured": False,
        "humanTimeSavingsAllowed": False,
        "populationSavingsAllowed": False,
        "scientificQualityMeasured": False,
    }
    assert len(raw["sessions"]) == 2
    assert all(entry["scriptedRun"] is True for entry in raw["sessions"])
    sessions = {entry["rawSession"]["workflow"]: entry["rawSession"] for entry in raw["sessions"]}
    assert set(sessions) == {"manual_baseline", "taxalens_assisted"}
    assert (
        sessions["manual_baseline"]["taskSetId"]
        == sessions["taxalens_assisted"]["taskSetId"]
        == raw["taskSet"]["taskSetId"]
    )
    assert all(
        session["participantIdHash"] == sessions["manual_baseline"]["participantIdHash"]
        for session in sessions.values()
    )


def test_summary_recomputes_exactly_from_raw(
    raw: dict[str, Any],
    summary: dict[str, Any],
) -> None:
    module = load_summarizer()
    assert module.build_summary(raw, RAW_PATH.relative_to(ROOT)) == summary


def test_scripted_interaction_result_is_bounded_and_exact(
    summary: dict[str, Any],
) -> None:
    assert summary["sample"] == {
        "sessionCount": 2,
        "matchedPairCount": 1,
        "humanParticipantCount": 0,
        "scriptedPairCount": 1,
    }
    assert summary["measuredResult"] == {
        "metric": "scripted_action_count",
        "manual": 20,
        "assisted": 10,
        "absoluteChange": -10,
        "relativeChange": -0.5,
        "scope": "one frozen three-item scripted Chromium protocol",
    }
    assert summary["comparison"]["pagesOpened"] == {
        "manual": 4,
        "assisted": 1,
        "absoluteChange": -3,
        "relativeChange": -0.75,
    }
    assert summary["comparison"]["duplicatesInspected"] == {
        "manual": 3,
        "assisted": 0,
        "absoluteChange": -3,
        "relativeChange": -1.0,
    }
    assert summary["comparison"]["fieldsCompleted"] == {
        "manual": 10,
        "assisted": 4,
        "absoluteChange": -6,
        "relativeChange": -0.6,
    }
    assert summary["comparison"]["decisions"] == {
        "manual": 3,
        "assisted": 3,
        "absoluteChange": 0,
        "relativeChange": 0.0,
    }


def test_no_human_time_or_quality_savings_are_invented(
    summary: dict[str, Any],
) -> None:
    assert summary["timeSavings"]["availability"] == "unavailable"
    assert summary["qualityImpact"]["availability"] == "unavailable"
    assert summary["claimBoundaries"] == {
        "humanProductivityMeasured": False,
        "humanTimeSavingsAllowed": False,
        "populationSavingsAllowed": False,
        "scientificQualityMeasured": False,
        "extrapolationAllowed": False,
    }
    assert (
        summary["comparison"]["activeMilliseconds"]["assisted"]
        > (summary["comparison"]["activeMilliseconds"]["manual"])
    )
    assert "not a human study" in summary["limitations"][0]


def test_published_summary_uses_only_artifact_backed_bounded_wording(
    summary: dict[str, Any],
) -> None:
    report = REPORT_PATH.read_text(encoding="utf-8")
    measured = summary["measuredResult"]
    assert (f"{measured['assisted']} logged interactions instead of {measured['manual']}") in report
    assert "50% fewer scripted actions" in report
    assert summary["sourceRawArtifact"]["sha256"] in report
    assert summary["environment"]["taxalensSha"] in report
    assert "Human participants:\n  `0`" in report
    normalized = " ".join(report.split())
    assert "not a human productivity or time-savings result" in normalized
    assert "No result may be extrapolated" in normalized
