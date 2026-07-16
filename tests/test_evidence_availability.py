from __future__ import annotations

import json
from pathlib import Path
from types import MappingProxyType

import pytest
from taxalens.product.evidence_availability import (
    EVIDENCE_AVAILABILITY_SCHEMA_VERSION,
    EvidenceAvailabilityError,
    available_evidence,
    blocked_evidence,
    failed_evidence,
    measured_zero_evidence,
    not_applicable_evidence,
    unavailable_evidence,
    validate_evidence_availability,
)

MIGRATED_FIXTURE = Path("demo/source/verification/verification-evidence-availability.json")
CATEGORIES = (
    "media",
    "decision",
    "consensus",
    "quality",
    "calibration",
    "comments",
    "referenceReadiness",
)


def test_all_six_states_are_immutable_and_valid() -> None:
    states = (
        available_evidence({"count": 3, "labels": ["verified"]}),
        measured_zero_evidence(),
        unavailable_evidence("No snapshot was supplied."),
        blocked_evidence(
            "Review is incomplete.",
            ["second_review_missing", "adjudication_missing"],
        ),
        not_applicable_evidence("Calibration is not used for targeted review."),
        failed_evidence(
            "media_inspection_failed",
            "The media bytes could not be decoded.",
            True,
        ),
    )

    assert tuple(state["state"] for state in states) == (
        "available",
        "measured_zero",
        "unavailable",
        "blocked",
        "not_applicable",
        "failed",
    )
    assert all(state["schemaVersion"] == EVIDENCE_AVAILABILITY_SCHEMA_VERSION for state in states)
    assert all(validate_evidence_availability(state) == () for state in states)
    assert all(isinstance(state, MappingProxyType) for state in states)
    assert states[3]["blockers"] == (
        "adjudication_missing",
        "second_review_missing",
    )


@pytest.mark.parametrize("value", [0, -0.0, float("nan"), float("inf"), None])
def test_available_rejects_ambiguous_or_nonfinite_values(value: object) -> None:
    with pytest.raises(EvidenceAvailabilityError):
        available_evidence(value)


def test_constructors_and_validator_reject_malformed_states() -> None:
    with pytest.raises(EvidenceAvailabilityError):
        blocked_evidence("Blocked.", [])
    with pytest.raises(EvidenceAvailabilityError):
        blocked_evidence("Blocked.", ["same", "same"])
    with pytest.raises(EvidenceAvailabilityError):
        failed_evidence("INVALID-CODE", "Failed.", False)

    malformed_zero = dict(measured_zero_evidence())
    malformed_zero["value"] = -1
    assert validate_evidence_availability(malformed_zero) == (
        "measured-zero evidence value must equal numeric zero",
    )

    malformed_unavailable = dict(unavailable_evidence("Missing."))
    malformed_unavailable["unexpected"] = True
    assert validate_evidence_availability(malformed_unavailable) == (
        "unavailable evidence fields are invalid",
    )

    assert validate_evidence_availability(
        {
            "schemaVersion": EVIDENCE_AVAILABILITY_SCHEMA_VERSION,
            "state": "blocked",
            "reason": "Blocked.",
            "blockers": ["z", "a"],
        }
    ) == ("blocked evidence blockers must be non-empty unique sorted strings",)


def test_committed_verification_projection_has_python_contract_parity() -> None:
    migrated = json.loads(MIGRATED_FIXTURE.read_text(encoding="utf-8"))

    assert set(migrated) == {
        "schemaVersion",
        "campaignId",
        *CATEGORIES,
    }
    assert migrated["schemaVersion"] == ("taxalens-verification-evidence-availability:v1.0.0")
    assert migrated["campaignId"] == "verification-agent-quality-campaign-v1"
    assert all(validate_evidence_availability(migrated[name]) == () for name in CATEGORIES)
    assert not _contains_none(migrated)
    assert migrated["comments"]["state"] == "measured_zero"
    assert migrated["consensus"]["blockers"] == [
        "unresolved_conflict:commons-papilio-demoleus-open-wing"
    ]
    assert migrated["referenceReadiness"]["blockers"] == [
        "independent_taxonomic_verification_missing"
    ]


def _contains_none(value: object) -> bool:
    if value is None:
        return True
    if isinstance(value, dict):
        return any(_contains_none(child) for child in value.values())
    if isinstance(value, list):
        return any(_contains_none(child) for child in value)
    return False
