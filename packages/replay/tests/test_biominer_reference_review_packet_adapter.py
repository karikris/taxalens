from pathlib import Path

from packages.replay.src.biominer_reference_review_queue_adapter import (
    ReferenceReviewPacketAdapterError,
    adapt_reference_review_packet,
)
from packages.replay.tests.reference_review_packet_fixture import (
    BIOMINER_SHA,
    TAXALENS_SHA,
    write_packet_fixture,
)


def test_adapt_reference_review_packet_into_verification_contracts(
    tmp_path: Path,
) -> None:
    manifest = write_packet_fixture(tmp_path)

    result = adapt_reference_review_packet(
        source_manifest_path=manifest,
        biominer_commit=BIOMINER_SHA,
        taxalens_commit=TAXALENS_SHA,
    )

    assert result["schemaVersion"] == (
        "taxalens-biominer-reference-review-adapter:v1.0.0"
    )
    assert result["sourceManifest"]["fixtureOnly"] is True
    assert result["sourceManifest"]["biominerCommit"] == BIOMINER_SHA
    assert result["decisionTemplate"] == {
        "schemaVersion": "reference-review-decision-import-v1.0.0",
        "rowCount": 1,
        "fingerprint": result["decisionTemplate"]["fingerprint"],
    }
    assert result["semantics"]["scientificClaimAllowed"] is False

    assert len(result["campaigns"]) == 1
    campaign = result["campaigns"][0]
    assert campaign["schemaVersion"] == "taxalens-verification-campaign:v1.0.0"
    assert campaign["kind"] == "reference_identity_verification"
    assert campaign["status"] == "ready"
    assert campaign["sourceProviders"] == ["gbif"]
    assert campaign["targetTaxon"]["acceptedTaxonKey"] == "gbif:1938069"
    assert campaign["reviewRequirement"]["requiredIndependentReviewers"] == 1
    assert campaign["samplingPlan"]["design"] == "targeted_priority"
    assert campaign["samplingPlan"]["qualityEstimationAllowed"] is False
    assert campaign["biominerSha"] == BIOMINER_SHA
    assert campaign["taxalensSha"] == TAXALENS_SHA
    assert campaign["publicReplay"] is False
    assert campaign["scientificClaimAllowed"] is False

    assert len(result["items"]) == 1
    item = result["items"][0]
    assert item["campaignId"] == campaign["campaignId"]
    assert item["source"] == "gbif"
    assert item["sourceObservationId"] == "300000001"
    assert item["sourceMediaId"] == "reference-media:" + "1" * 64
    assert item["imageSha256"] == "5" * 64
    assert item["imageByteCount"] == 12345
    assert item["mediaType"] == "image/jpeg"
    assert item["targetTaxon"] == campaign["targetTaxon"]
    assert item["rights"]["policyStatus"] == "allowed"
    assert item["sourceProvenance"] == {
        "provider": "gbif",
        "providerLabel": "GBIF",
        "originalProvider": "Atlas of Living Australia",
        "referenceObservationId": "reference-observation:" + "2" * 64,
        "sourceObservationId": "300000001",
        "providerMediaId": "provider-photo-1",
        "occurrenceLicense": "CC0-1.0",
        "mediaLicense": {
            "name": "CC-BY-4.0",
            "uri": "https://creativecommons.org/licenses/by/4.0/",
            "policyStatus": "allowed",
        },
        "observerId": "observer-1",
        "geography": {
            "locality": "Sydney",
            "country": "Australia",
            "countryCode": "AU",
            "latitude": -33.87,
            "longitude": 151.21,
            "coordinateUncertaintyMeters": 10.0,
            "coordinatesObscured": False,
            "geographicClusterId": "geo-cluster-1",
        },
        "providerVerificationStatus": "accepted",
    }
    assert item["questionFingerprint"] == campaign["questionFingerprint"]


def test_adapt_reference_review_packet_preserves_inaturalist_identity(
    tmp_path: Path,
) -> None:
    manifest = write_packet_fixture(tmp_path, source="inaturalist")

    result = adapt_reference_review_packet(
        source_manifest_path=manifest,
        biominer_commit=BIOMINER_SHA,
        taxalens_commit=TAXALENS_SHA,
    )

    campaign = result["campaigns"][0]
    item = result["items"][0]
    assert campaign["sourceProviders"] == ["inaturalist"]
    assert campaign["samplingPlan"]["strata"][0]["label"] == (
        "iNaturalist reference queue"
    )
    assert item["source"] == "inaturalist"
    assert item["sourceObservationId"] == "200000001"
    assert item["sourceProvenance"]["providerLabel"] == "iNaturalist"
    assert item["sourceProvenance"]["originalProvider"] == "iNaturalist"
    assert item["sourceProvenance"]["providerMediaId"] == "provider-photo-1"


def test_adapt_reference_review_packet_rejects_non_full_commits(
    tmp_path: Path,
) -> None:
    manifest = write_packet_fixture(tmp_path)

    for field in ("biominer_commit", "taxalens_commit"):
        kwargs = {
            "source_manifest_path": manifest,
            "biominer_commit": BIOMINER_SHA,
            "taxalens_commit": TAXALENS_SHA,
        }
        kwargs[field] = "short-sha"
        try:
            adapt_reference_review_packet(**kwargs)
        except ReferenceReviewPacketAdapterError as exc:
            assert "40-character" in str(exc)
        else:
            assert False
