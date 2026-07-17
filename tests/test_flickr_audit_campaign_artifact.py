from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any

import jsonschema
import pytest

ROOT = Path(__file__).resolve().parents[1]
CAMPAIGN_PATH = (
    ROOT / "demo" / "source" / "verification" / "papilio-demoleus-flickr-audit.campaign.json"
)
SCHEMA_ROOT = ROOT / "packages" / "contracts" / "schema"


@pytest.fixture(scope="module")
def packet() -> dict[str, Any]:
    return json.loads(CAMPAIGN_PATH.read_text(encoding="utf-8"))


def test_campaign_and_every_item_satisfy_authoritative_schemas(
    packet: dict[str, Any],
) -> None:
    base_schema = _load_schema("verification.schema.json")
    campaign_schema = {
        "$schema": base_schema["$schema"],
        "$defs": base_schema["$defs"],
        "$ref": "#/$defs/verificationCampaign",
    }
    item_schema = {
        "$schema": base_schema["$schema"],
        "$defs": base_schema["$defs"],
        "$ref": "#/$defs/verificationItem",
    }

    jsonschema.Draft202012Validator(
        campaign_schema,
        format_checker=jsonschema.FormatChecker(),
    ).validate(packet["campaign"])
    item_validator = jsonschema.Draft202012Validator(
        item_schema,
        format_checker=jsonschema.FormatChecker(),
    )
    for item in packet["items"]:
        item_validator.validate(item)


def test_campaign_is_bounded_blind_and_contains_required_audit_slices(
    packet: dict[str, Any],
) -> None:
    campaign = packet["campaign"]
    items = packet["items"]
    assert 40 <= len(items) <= 60
    assert len(items) == 49
    assert campaign["samplingPlan"]["targetSampleSize"] == len(items)
    assert campaign["samplingPlan"]["independentUnit"] == "owner_group"
    assert campaign["samplingPlan"]["design"] == "stratified_random"
    assert campaign["samplingPlan"]["blindReview"] is True
    assert campaign["disclosurePolicy"]["mode"] == "blind"
    assert campaign["scientificClaimAllowed"] is False
    assert campaign["publicReplay"] is False

    strata = [item["samplingStratumId"].split("--", maxsplit=1) for item in items]
    assert {screen for screen, _ in strata} == {
        "target_candidate",
        "abstention",
        "competitor",
        "negative",
    }
    assert {
        "south_asia",
        "southeast_asia",
        "other_geo",
        "no_usable_geo",
    }.issubset({geography for _, geography in strata})
    assert len({item["flickrSource"]["query"]["trustTier"] for item in items}) >= 2


def test_campaign_has_one_checksum_verified_observation_per_owner(
    packet: dict[str, Any],
) -> None:
    items = packet["items"]
    grouping_fields = (
        "ownerPhotographerGroupId",
        "observationGroupId",
        "duplicateGroupId",
    )
    for field in grouping_fields:
        values = [item[field] for item in items]
        assert len(values) == len(set(values))

    for item in items:
        source = item["flickrSource"]
        media = source["fullFrameMedia"]
        assert media["checksumVerified"] is True
        assert media["sha256"] == item["imageSha256"]
        assert media["byteCount"] == item["imageByteCount"]
        assert len(media["sha256"]) == 64
        assert media["byteCount"] > 0
        assert media["mediaType"].startswith("image/")
        assert media["rights"]["policyStatus"] == "allowed"
        assert media["rights"]["attribution"]
        assert media["rights"]["sourceUri"].startswith("https://www.flickr.com/")
        assert media["rights"]["licenseUri"].startswith("https://")


def test_sampling_receipt_records_probabilities_weights_and_zero_takes(
    packet: dict[str, Any],
) -> None:
    selection = packet["selection"]
    items = packet["items"]
    strata = {receipt["stratumId"]: receipt for receipt in selection["strata"]}
    selected_counts = Counter(item["samplingStratumId"] for item in items)

    assert selection["representative"] is True
    assert selection["qualityEstimationAllowed"] is True
    assert selection["scientificClaimAllowed"] is False
    assert selection["zeroTakeStrataAuthorizeEstimate"] is False
    assert selection["sourceRecordCount"] == sum(
        receipt["populationOwnerGroupCount"] for receipt in strata.values()
    )
    for stratum_id, count in selected_counts.items():
        receipt = strata[stratum_id]
        assert receipt["selectedOwnerGroupCount"] == count
        assert receipt["selectedCanonicalRecordCount"] == count
        assert receipt["inclusionProbability"] == pytest.approx(
            count / receipt["populationOwnerGroupCount"]
        )
        for item in (row for row in items if row["samplingStratumId"] == stratum_id):
            assert item["inclusionProbability"] == pytest.approx(receipt["inclusionProbability"])
            assert selection["samplingWeights"][item["itemId"]] == pytest.approx(
                1 / receipt["inclusionProbability"]
            )


def test_no_usable_geo_is_explicit_and_not_fabricated(
    packet: dict[str, Any],
) -> None:
    rows = [
        item["flickrSource"]
        for item in packet["items"]
        if item["samplingStratumId"].endswith("--no_usable_geo")
    ]
    assert len(rows) == 1
    assert rows[0]["geographicClusterId"] is None
    assert rows[0]["coordinate"] == {
        "latitude": None,
        "longitude": None,
        "outlier": None,
    }
    assert packet["semantics"]["noUsableGeoMeansNoLocalGeographicEvidence"] is True


def test_geographic_audit_strata_preserve_primary_sampling_and_reconcile(
    packet: dict[str, Any],
) -> None:
    selection = packet["selection"]
    items = packet["items"]
    audit = selection["geographicAuditStrata"]

    assert audit["schemaVersion"] == "taxalens-flickr-geographic-audit-strata:v1.0.0"
    assert audit["primarySamplingDesignUnchanged"] is True
    assert audit["reportingDimensionsDoNotAlterInclusionProbability"] is True
    assert audit["reviewerDisclosureAllowedBeforeDecision"] is False
    assert all(audit["representationRequirements"].values())
    assert audit["impactArtifact"] == {
        "path": (
            "demo/source/biominer_phase14/geographic_impact/"
            "geographic_impact_cells.parquet"
        ),
        "sha256": "a02927ffbb4dc09fca582c61e6ceab51af6d12f8998cf0f7762ebfe26a4ea1c9",
        "byteCount": 639_681,
    }

    bindings = {row["itemId"]: row for row in audit["itemBindings"]}
    assert len(bindings) == len(items) == 49
    for item in items:
        binding = bindings[item["itemId"]]
        assert binding["ownerPhotographerGroupId"] == item["ownerPhotographerGroupId"]
        assert binding["primarySamplingStratumId"] == item["samplingStratumId"]
        assert binding["inclusionProbability"] == item["inclusionProbability"]

    assert set(audit["dimensions"]) == {
        "continent",
        "country",
        "coordinate_support",
        "coverage",
        "raw_screening_score_band",
        "query_trust_tier",
    }
    for receipts in audit["dimensions"].values():
        assert sum(row["populationOwnerGroupCount"] for row in receipts) == selection[
            "sourceRecordCount"
        ]
        assert sum(row["selectedOwnerGroupCount"] for row in receipts) == len(items)
        assert all(
            row["zeroTake"] is (row["selectedOwnerGroupCount"] == 0) for row in receipts
        )


def test_geographic_audit_represents_required_dimensions_without_overclaim(
    packet: dict[str, Any],
) -> None:
    audit = packet["selection"]["geographicAuditStrata"]
    selected_values = {
        dimension: {
            row["value"] for row in receipts if row["selectedOwnerGroupCount"] > 0
        }
        for dimension, receipts in audit["dimensions"].items()
    }

    assert {"Asia", "Europe", "North America", "Oceania"}.issubset(
        selected_values["continent"]
    )
    assert len(selected_values["country"] - {"unavailable"}) >= 2
    assert "no_usable_geo" in selected_values["coordinate_support"]
    assert {"baseline_covered_cell", "candidate_only_cell"}.issubset(
        selected_values["coverage"]
    )
    assert {"low", "middle", "high"}.issubset(selected_values["raw_screening_score_band"])
    assert len(selected_values["query_trust_tier"]) >= 2
    assert (
        audit["dimensionSemantics"]["raw_screening_score_band"]
        == "Bands the historical raw top-1 model similarity at <0.6, 0.6–<0.8 and >=0.8; "
        "it is not a probability or human label."
    )
    assert "not biological absence" in audit["dimensionSemantics"]["coverage"]


def test_provenance_discloses_historical_cache_and_live_rights_checks(
    packet: dict[str, Any],
) -> None:
    provenance = packet["provenance"]
    inputs = provenance["inputArtifacts"]
    assert provenance["biominerSha"] == ("94fa1f634ee3c63917c05d78181dd3cf9ceff940")
    assert provenance["gitTrackedInputCount"] == 4
    assert provenance["historicalCacheInputCount"] == 3
    assert "not content at BioMiner HEAD" in provenance["historicalCacheDisclosure"]
    assert {row["role"] for row in inputs} == {
        "committed_population_contract",
        "geographic_audit_reporting",
        "historical_screening_cache",
    }
    assert all(len(row["sha256"]) == 64 for row in inputs)
    assert all(row["byteCount"] > 0 for row in inputs)

    media = provenance["mediaVerification"]
    assert len(media) == len(packet["items"])
    assert len({row["flickrPhotoId"] for row in media}) == len(media)
    assert all(row["decodedWidth"] > 0 and row["decodedHeight"] > 0 for row in media)
    assert all(row["byteCount"] > 0 and len(row["sha256"]) == 64 for row in media)
    assert provenance["flickrRightsRegistry"]["method"] == ("flickr.photos.licenses.getInfo")


def test_campaign_contains_no_fabricated_human_result(
    packet: dict[str, Any],
) -> None:
    assert packet["semantics"] == {
        "flickrSearchResultsAreHypotheses": True,
        "screeningClassesAreHumanTruth": False,
        "modelScoresAreProbabilities": False,
        "humanReviewResultsPrepopulated": False,
        "oneSelectedRecordPerOwnerGroup": True,
        "noUsableGeoMeansNoLocalGeographicEvidence": True,
        "publicReplay": False,
        "scientificClaimAllowed": False,
    }
    assert all(
        item["providerSuppliedIdentity"]
        == {
            "providerTaxonKey": None,
            "scientificName": None,
            "commonName": None,
            "rawLabel": None,
            "verificationStatus": None,
        }
        for item in packet["items"]
    )
    assert all(
        item["flickrSource"]["postDecisionEvidence"]["decisionReason"] is None
        for item in packet["items"]
    )


def _load_schema(name: str) -> dict[str, Any]:
    return json.loads((SCHEMA_ROOT / name).read_text(encoding="utf-8"))
