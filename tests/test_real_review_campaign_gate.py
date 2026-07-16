from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

ROOT = Path(__file__).resolve().parents[1]
CAMPAIGN_DIR = ROOT / "demo" / "source" / "verification"
PACKET_PATHS = {
    "flickr": CAMPAIGN_DIR / "papilio-demoleus-flickr-audit.campaign.json",
    "reference": CAMPAIGN_DIR / "papilio-demoleus-reference-audit.campaign.json",
    "control": CAMPAIGN_DIR / "papilio-demoleus-reviewer-controls.campaign.json",
}


@pytest.fixture(scope="module")
def packets() -> dict[str, dict[str, Any]]:
    return {
        packet_id: json.loads(path.read_text(encoding="utf-8"))
        for packet_id, path in PACKET_PATHS.items()
    }


def test_bounded_campaign_counts_and_sampling_designs_are_frozen(
    packets: dict[str, dict[str, Any]],
) -> None:
    assert {packet_id: len(packet["items"]) for packet_id, packet in packets.items()} == {
        "flickr": 49,
        "reference": 24,
        "control": 6,
    }
    designs = {
        packet_id: packet["campaign"]["samplingPlan"]["design"]
        for packet_id, packet in packets.items()
    }
    assert designs == {
        "flickr": "stratified_random",
        "reference": "targeted_priority",
        "control": "control_items",
    }
    assert packets["flickr"]["campaign"]["samplingPlan"]["representative"] is True
    assert packets["flickr"]["campaign"]["samplingPlan"]["qualityEstimationAllowed"] is True
    for packet_id in ("reference", "control"):
        plan = packets[packet_id]["campaign"]["samplingPlan"]
        assert plan["representative"] is False
        assert plan["qualityEstimationAllowed"] is False
        assert plan["qualityEstimationBlockedReason"]


def test_every_campaign_and_media_identity_is_fingerprinted(
    packets: dict[str, dict[str, Any]],
) -> None:
    campaign_ids: set[str] = set()
    item_ids: set[str] = set()
    for packet in packets.values():
        campaign = packet["campaign"]
        assert len(campaign["manifestSha256"]) == 64
        assert len(campaign["questionFingerprint"]) == 64
        assert len(campaign["taxalensSha"]) == 40
        assert campaign["campaignId"] not in campaign_ids
        campaign_ids.add(campaign["campaignId"])
        for item in packet["items"]:
            assert len(item["imageSha256"]) == 64
            assert item["imageByteCount"] > 0
            assert item["questionFingerprint"] == campaign["questionFingerprint"]
            assert item["itemId"] not in item_ids
            item_ids.add(item["itemId"])


def test_rights_are_verified_and_restricted_media_stays_private(
    packets: dict[str, dict[str, Any]],
) -> None:
    for packet_id, packet in packets.items():
        for item in packet["items"]:
            rights = item["rights"]
            assert rights["policyStatus"] in {"allowed", "restricted"}
            assert rights["licenseName"]
            assert rights["licenseUri"].startswith("https://")
            assert rights["attribution"]
            assert rights["sourceUri"].startswith(("http://", "https://"))
            if rights["policyStatus"] == "restricted":
                assert packet_id == "reference"
                assert packet["campaign"]["publicReplay"] is False
    assert {item["rights"]["policyStatus"] for item in packets["flickr"]["items"]} == {"allowed"}
    assert {item["rights"]["policyStatus"] for item in packets["control"]["items"]} == {"allowed"}
    assert "restricted" in {
        item["rights"]["policyStatus"] for item in packets["reference"]["items"]
    }


def test_packets_contain_no_fabricated_human_or_scientific_result(
    packets: dict[str, dict[str, Any]],
) -> None:
    for packet in packets.values():
        campaign = packet["campaign"]
        assert campaign["scientificClaimAllowed"] is False
        assert campaign["publicReplay"] is False
        assert packet["semantics"]["scientificClaimAllowed"] is False
        assert "events" not in packet
        assert "consensus" not in packet
        assert "quality" not in packet
    assert packets["flickr"]["semantics"]["humanReviewResultsPrepopulated"] is False
    assert packets["reference"]["semantics"]["humanReviewResultsPrepopulated"] is False
    assert (
        packets["reference"]["semantics"]["providerRoleSuitabilityIsTaxonomicVerification"] is False
    )
    boundary = packets["reference"]["provenance"]["providerRoleSuitabilityBoundary"]
    assert boundary["appliesToThisSelectedSet"] is False
    assert boundary["independentTaxonomicVerificationClaimed"] is False
    assert packets["control"]["semantics"]["humanReviewEventsPrepopulated"] is False
    assert packets["control"]["semantics"]["reviewerPerformancePrepopulated"] is False
    assert packets["control"]["semantics"]["adjudicationOutcomePrepopulated"] is False


def test_independence_and_intentional_control_exceptions_are_explicit(
    packets: dict[str, dict[str, Any]],
) -> None:
    flickr = packets["flickr"]["items"]
    assert len({item["ownerPhotographerGroupId"] for item in flickr}) == len(flickr)
    reference = packets["reference"]["items"]
    assert len({item["observationGroupId"] for item in reference}) == len(reference)
    assert len({item["imageSha256"] for item in reference}) == len(reference)

    controls = {item["itemId"]: item for item in packets["control"]["items"]}
    known = controls["reviewer-control:known-target"]
    duplicate = controls["reviewer-control:duplicate"]
    assert duplicate["imageSha256"] == known["imageSha256"]
    assert duplicate["duplicateGroupId"] == known["duplicateGroupId"]
    assert duplicate["observationGroupId"] == known["observationGroupId"]
    assert packets["control"]["campaign"]["samplingPlan"]["independentUnit"] == ("duplicate_group")
