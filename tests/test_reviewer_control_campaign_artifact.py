from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import jsonschema
import pytest
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PACKET_PATH = (
    ROOT / "demo" / "source" / "verification" / "papilio-demoleus-reviewer-controls.campaign.json"
)
SCHEMA_PATH = ROOT / "packages" / "contracts" / "schema" / "verification.schema.json"


@pytest.fixture(scope="module")
def packet() -> dict[str, Any]:
    return json.loads(PACKET_PATH.read_text(encoding="utf-8"))


def canonical_fingerprint(value: Any) -> str:
    payload = json.dumps(
        value,
        allow_nan=False,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode()
    return hashlib.sha256(payload).hexdigest()


def test_control_campaign_and_items_satisfy_authoritative_schema(
    packet: dict[str, Any],
) -> None:
    base = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    for definition, values in (
        ("verificationCampaign", [packet["campaign"]]),
        ("verificationItem", packet["items"]),
    ):
        schema = {
            "$schema": base["$schema"],
            "$defs": base["$defs"],
            "$ref": f"#/$defs/{definition}",
        }
        validator = jsonschema.Draft202012Validator(
            schema,
            format_checker=jsonschema.FormatChecker(),
        )
        for value in values:
            validator.validate(value)


def test_all_required_control_scenarios_are_present_once(
    packet: dict[str, Any],
) -> None:
    expected = [
        "known_target",
        "known_negative",
        "ambiguous",
        "duplicate",
        "media_failure",
        "adjudication_example",
    ]
    scenarios = packet["controlScenarios"]
    assert [scenario["scenarioId"] for scenario in scenarios] == expected
    assert len(packet["items"]) == len(expected)
    assert {item["samplingStratumId"] for item in packet["items"]} == set(expected)
    assert all(scenario["prepopulatedEventIds"] == [] for scenario in scenarios)


def test_control_truth_is_scoped_fingerprinted_and_metric_compatible(
    packet: dict[str, Any],
) -> None:
    control_set = packet["controlSet"]
    assert control_set["schemaVersion"] == "taxalens-reviewer-control-set:v1.0.0"
    assert control_set["groundTruthSha256"] == canonical_fingerprint(control_set["controls"])
    assert control_set["controls"] == [
        {
            "itemId": "reviewer-control:known-target",
            "expectedMediaState": "viewable",
            "expectedOutcome": "yes",
        },
        {
            "itemId": "reviewer-control:known-negative",
            "expectedMediaState": "viewable",
            "expectedOutcome": "no",
        },
        {
            "itemId": "reviewer-control:media-failure",
            "expectedMediaState": "unviewable",
            "expectedOutcome": None,
        },
    ]
    assert packet["semantics"]["controlTruthScope"] == ("reviewer_workflow_fixture_only")
    assert packet["semantics"]["knownTargetIsIndependentTaxonomicVerification"] is False
    assert packet["semantics"]["bioMinerRoleSuitabilityUsedAsTaxonomicTruth"] is False


def test_duplicate_control_is_byte_and_group_identical(
    packet: dict[str, Any],
) -> None:
    items = {item["itemId"]: item for item in packet["items"]}
    known = items["reviewer-control:known-target"]
    duplicate = items["reviewer-control:duplicate"]
    assert duplicate["imageSha256"] == known["imageSha256"]
    assert duplicate["imageByteCount"] == known["imageByteCount"]
    assert duplicate["duplicateGroupId"] == known["duplicateGroupId"]
    assert duplicate["observationGroupId"] == known["observationGroupId"]
    assert duplicate["sourceMediaId"] == known["sourceMediaId"]


def test_tracked_control_media_are_decodable_and_checksum_verified(
    packet: dict[str, Any],
) -> None:
    receipts = packet["provenance"]["inputArtifacts"]
    tracked_media = [
        receipt
        for receipt in receipts
        if receipt["inputId"].startswith("media:") and receipt["status"] == "verified"
    ]
    assert len(tracked_media) == 4
    for receipt in tracked_media:
        path = ROOT / receipt["path"]
        assert path.is_file()
        content = path.read_bytes()
        assert len(content) == receipt["byteCount"]
        assert hashlib.sha256(content).hexdigest() == receipt["sha256"]
        with Image.open(path) as image:
            image.verify()


def test_media_failure_is_intentional_and_not_a_scientific_result(
    packet: dict[str, Any],
) -> None:
    item = next(
        item for item in packet["items"] if item["itemId"] == "reviewer-control:media-failure"
    )
    receipt = next(
        receipt
        for receipt in packet["provenance"]["inputArtifacts"]
        if receipt["inputId"] == "media:media_failure"
    )
    assert receipt["status"] == "intentionally_absent"
    assert not (ROOT / item["previewUri"]).exists()
    descriptor = (receipt["descriptor"] + "\n").encode()
    assert len(descriptor) == item["imageByteCount"]
    assert hashlib.sha256(descriptor).hexdigest() == item["imageSha256"]
    assert packet["campaign"]["scientificClaimAllowed"] is False


def test_ambiguity_and_adjudication_are_unscored_workflow_exercises(
    packet: dict[str, Any],
) -> None:
    scenarios = {scenario["scenarioId"]: scenario for scenario in packet["controlScenarios"]}
    assert scenarios["ambiguous"]["expectedOutcome"] == "cant_tell"
    assert scenarios["ambiguous"]["scoredByReviewerControlMetrics"] is False
    assert scenarios["adjudication_example"]["expectedOutcome"] is None
    assert scenarios["adjudication_example"]["scoredByReviewerControlMetrics"] is False
    assert packet["semantics"]["ambiguousCaseScored"] is False
    assert packet["semantics"]["adjudicationOutcomePrepopulated"] is False


def test_campaign_is_blind_nonrepresentative_and_contains_no_result(
    packet: dict[str, Any],
) -> None:
    campaign = packet["campaign"]
    assert campaign["kind"] == "quality_control"
    assert campaign["samplingPlan"]["purpose"] == "reviewer_quality_control"
    assert campaign["samplingPlan"]["design"] == "control_items"
    assert campaign["samplingPlan"]["representative"] is False
    assert campaign["samplingPlan"]["qualityEstimationAllowed"] is False
    assert campaign["samplingPlan"]["blindReview"] is True
    assert campaign["publicReplay"] is False
    assert campaign["scientificClaimAllowed"] is False
    assert packet["semantics"]["humanReviewEventsPrepopulated"] is False
    assert packet["semantics"]["reviewerPerformancePrepopulated"] is False
    assert "events" not in packet
    assert "quality" not in packet
