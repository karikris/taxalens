from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

import jsonschema
import pytest

ROOT = Path(__file__).resolve().parents[1]
PACKET_PATH = (
    ROOT / "demo" / "source" / "verification" / "papilio-demoleus-reference-audit.campaign.json"
)
SCHEMA_PATH = ROOT / "packages" / "contracts" / "schema" / "verification.schema.json"


@pytest.fixture(scope="module")
def packet() -> dict[str, Any]:
    return json.loads(PACKET_PATH.read_text(encoding="utf-8"))


def test_reference_campaign_and_items_satisfy_authoritative_schema(
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


def test_reference_audit_is_bounded_targeted_and_not_an_accuracy_sample(
    packet: dict[str, Any],
) -> None:
    campaign = packet["campaign"]
    assert len(packet["items"]) == 24
    assert 20 <= len(packet["items"]) <= 30
    assert campaign["kind"] == "reference_identity_verification"
    assert campaign["sourceProviders"] == ["gbif", "inaturalist"]
    assert campaign["samplingPlan"]["design"] == "targeted_priority"
    assert campaign["samplingPlan"]["representative"] is False
    assert campaign["samplingPlan"]["qualityEstimationAllowed"] is False
    assert campaign["samplingPlan"]["qualityEstimationBlockedReason"]
    assert campaign["publicReplay"] is False
    assert campaign["scientificClaimAllowed"] is False
    assert packet["selection"]["qualityEstimationAllowed"] is False


def test_required_reference_roles_and_providers_are_present(
    packet: dict[str, Any],
) -> None:
    counts = Counter(item["samplingStratumId"] for item in packet["items"])
    assert counts == Counter(
        {
            "likely_conflict_fallback_competitor": 1,
            "target_larva": 1,
            "target_pupa": 1,
            "target_egg": 1,
            "specimen_or_pinned": 1,
            "unsuitable_basis": 1,
            "target_adult_gbif": 5,
            "target_adult_inaturalist": 5,
            "competitor_adult_gbif": 4,
            "competitor_adult_inaturalist": 4,
        }
    )
    assert {item["source"] for item in packet["items"]} == {
        "gbif",
        "inaturalist",
    }
    assert any(item["expectedLifeStage"] == "larva" for item in packet["items"])
    assert any(item["expectedVisualDomain"] == "pinned_specimen" for item in packet["items"])
    assert any(item["expectedVisualDomain"] == "unsuitable" for item in packet["items"])
    conflict = next(
        item
        for item in packet["items"]
        if item["samplingStratumId"] == "likely_conflict_fallback_competitor"
    )
    assert conflict["targetTaxon"]["acceptedTaxonKey"] != "gbif:1938069"
    assert conflict["expectedLifeStage"] == "adult"
    assert conflict["sourceProvenance"]["fallbackLevel"] >= 2


def test_reference_items_are_independent_checksum_verified_media(
    packet: dict[str, Any],
) -> None:
    items = packet["items"]
    observations = [item["observationGroupId"] for item in items]
    media_hashes = [item["imageSha256"] for item in items]
    assert len(set(observations)) == len(items)
    assert len(set(media_hashes)) == len(items)
    for item in items:
        assert len(item["imageSha256"]) == 64
        assert item["imageByteCount"] > 0
        assert item["mediaType"].startswith("image/")
        assert item["previewUri"].startswith("https://")
        assert item["rights"]["policyStatus"] in {"allowed", "restricted"}
        assert item["rights"]["attribution"]
        license_version = re.search(
            r"/([0-9]+(?:\.[0-9]+)?)/?$",
            item["rights"]["licenseUri"],
        )
        assert license_version is not None
        assert item["rights"]["licenseName"].endswith(license_version.group(1))
        assert item["sourceProvenance"]["provider"] == item["source"]
        assert item["sourceProvenance"]["sourceObservationId"] == item["sourceObservationId"]
        assert item["inclusionProbability"] is None


def test_provider_role_attestation_is_context_not_a_selected_label(
    packet: dict[str, Any],
) -> None:
    boundary = packet["provenance"]["providerRoleSuitabilityBoundary"]
    assert boundary["verifiedRecordCount"] == 81
    assert boundary["appliesToThisSelectedSet"] is False
    assert boundary["independentTaxonomicVerificationClaimed"] is False
    assert "does not expose the 81 frozen row identities" in boundary["reason"]
    assert packet["semantics"]["providerRoleSuitabilityIsTaxonomicVerification"] is False
    assert packet["semantics"]["providerTaxonLabelsAreCandidateEvidence"] is True


def test_reference_packet_contains_no_human_result_or_claim(
    packet: dict[str, Any],
) -> None:
    assert packet["semantics"]["humanReviewResultsPrepopulated"] is False
    assert packet["semantics"]["likelyConflictIsAReviewPriorityNotAResult"] is True
    assert packet["semantics"]["scientificClaimAllowed"] is False
    assert all(
        item["providerSuppliedIdentity"]["verificationStatus"] != "human_verified"
        for item in packet["items"]
    )
    assert all(
        item["targetTaxon"]["scientificName"] == item["providerSuppliedIdentity"]["scientificName"]
        for item in packet["items"]
    )


def test_media_receipt_covers_every_selected_item(packet: dict[str, Any]) -> None:
    receipts = packet["provenance"]["mediaVerification"]
    assert len(receipts) == len(packet["items"])
    assert len({row["referenceObservationId"] for row in receipts}) == len(receipts)
    assert all(row["byteCount"] > 0 for row in receipts)
    assert all(len(row["sha256"]) == 64 for row in receipts)
    assert all(row["decodedWidth"] > 0 and row["decodedHeight"] > 0 for row in receipts)
    inputs = packet["provenance"]["inputArtifacts"]
    assert {row["role"] for row in inputs} == {
        "phase15_manifest_pinned_candidate_frame",
        "selection_contract",
        "context_only_role_suitability_attestation",
    }
    assert all(len(row["sha256"]) == 64 and row["byteCount"] > 0 for row in inputs)
