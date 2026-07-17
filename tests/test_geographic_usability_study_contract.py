from __future__ import annotations

import copy
import json
from pathlib import Path

import jsonschema
import pytest

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "packages/contracts/schema/geographic_usability_study.schema.json"
RAW_PATH = ROOT / "demo/source/impact/geographic-impact-usability-study.raw.json"


def test_empty_geographic_study_packet_is_valid_and_claims_nothing() -> None:
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    packet = json.loads(RAW_PATH.read_text(encoding="utf-8"))
    validator = jsonschema.Draft202012Validator(
        schema,
        format_checker=jsonschema.FormatChecker(),
    )

    assert list(validator.iter_errors(packet)) == []
    assert packet["status"] == "pending_human_data"
    assert packet["claims"] == {
        "humanParticipantCount": 0,
        "humanUsabilityMeasured": False,
        "humanTimeSavingsAllowed": False,
        "studyObservationsAreReviewEvidence": False,
    }
    assert packet["sessions"] == []


def test_contract_rejects_synthetic_participant_and_direct_identity() -> None:
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    packet = json.loads(RAW_PATH.read_text(encoding="utf-8"))
    session = valid_session()
    packet["sessions"] = [session]
    jsonschema.Draft202012Validator(schema).validate(packet)

    synthetic = copy.deepcopy(packet)
    synthetic["sessions"][0]["participant"]["synthetic"] = True
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.Draft202012Validator(schema).validate(synthetic)

    identified = copy.deepcopy(packet)
    identified["sessions"][0]["participant"]["email"] = "person@example.test"
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.Draft202012Validator(schema).validate(identified)


def valid_session() -> dict[str, object]:
    task_ids = [
        "identify_country_gap",
        "find_candidate_record",
        "inspect_provenance",
        "begin_verification",
        "interpret_evidence_state",
    ]
    return {
        "schemaVersion": "taxalens-geographic-usability-session:v1.0.0",
        "sessionId": "session-001",
        "participant": {
            "participantIdHash": "a" * 64,
            "synthetic": False,
            "consentRecorded": True,
            "quotationConsent": False,
            "experienceBand": "1_to_3_years",
            "roleCategory": "biodiversity_research",
        },
        "environment": {
            "browserName": "chromium",
            "browserVersion": "149",
            "platform": "linux",
            "viewportWidth": 1280,
            "viewportHeight": 720,
            "externalMapRequests": 0,
        },
        "startedAt": "2026-07-18T01:00:00Z",
        "completedAt": "2026-07-18T01:05:00Z",
        "status": "completed",
        "withdrawnDataRetentionAllowed": False,
        "tasks": [
            {
                "taskId": task_id,
                "sequence": index,
                "status": "completed",
                "startedAt": f"2026-07-18T01:0{index - 1}:00Z",
                "endedAt": f"2026-07-18T01:0{index}:00Z",
                "activeMilliseconds": 60_000,
                "actionCount": 1,
                "moderatorHelpCount": 0,
                "errors": [],
                "selectedCountryCode": "IN" if index == 1 else None,
                "selectedSpatialCellId": None,
                "selectedRecordId": None,
                "inspectedArtifactIds": [],
                "interpretationAnswers": [],
                "confidence": 4,
                "comment": None,
            }
            for index, task_id in enumerate(task_ids, start=1)
        ],
    }
