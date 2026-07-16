import hashlib
import json
from pathlib import Path

import polars as pl
from packages.replay.src import biominer_reference_review_packet_adapter as adapter
from packages.replay.src.biominer_reference_review_queue_adapter import (
    ReferenceReviewPacketAdapterError,
    adapt_reference_review_packet,
)
from packages.replay.tests.reference_review_packet_fixture import (
    BIOMINER_SHA,
    TAXALENS_SHA,
    write_packet_fixture,
)


def _adapt(manifest: Path) -> dict[str, object]:
    return adapt_reference_review_packet(
        source_manifest_path=manifest,
        biominer_commit=BIOMINER_SHA,
        taxalens_commit=TAXALENS_SHA,
    )


def _assert_adapter_error(manifest: Path, message: str) -> None:
    try:
        _adapt(manifest)
    except ReferenceReviewPacketAdapterError as exc:
        assert message in str(exc)
    else:
        assert False


def _descriptor(path: Path, root: Path) -> dict[str, object]:
    content = path.read_bytes()
    return {
        "path": path.relative_to(root).as_posix(),
        "byte_count": len(content),
        "sha256": "sha256:" + hashlib.sha256(content).hexdigest(),
    }


def _rewrite_source_frame(
    manifest_path: Path,
    key: str,
    frame: pl.DataFrame,
) -> None:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    root = manifest_path.parent
    path = root / manifest["source_artifacts"][key]["path"]
    frame.write_parquet(path)
    manifest["source_artifacts"][key] = _descriptor(path, root)
    manifest_path.write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _rewrite_packet_queue(manifest_path: Path, queue: pl.DataFrame) -> None:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    root = manifest_path.parent
    report_path = root / manifest["export_report"]["path"]
    report = json.loads(report_path.read_text(encoding="utf-8"))
    queue_path = Path(report["artifacts"]["queue"]["uri"])
    queue.write_parquet(queue_path)
    report["artifacts"]["queue"] = {
        **_descriptor(queue_path, queue_path.parent),
        "uri": str(queue_path.resolve()),
        "committed": True,
    }
    report["artifacts"]["queue"].pop("path")
    report_path.write_text(
        json.dumps(report, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    manifest["export_report"] = _descriptor(report_path, root)
    manifest_path.write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
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


def test_adapt_reference_review_packet_rejects_stale_queue_provenance(
    tmp_path: Path,
) -> None:
    manifest = write_packet_fixture(tmp_path)
    queue_path = tmp_path / "packet/reference_review_queue.parquet"
    queue = pl.read_parquet(queue_path).with_columns(
        pl.lit("changed operational reason").alias("review_reason")
    )
    _rewrite_packet_queue(manifest, queue)

    _assert_adapter_error(manifest, "review queue provenance is stale")


def test_adapt_reference_review_packet_rejects_changed_media_fingerprint(
    tmp_path: Path,
) -> None:
    manifest = write_packet_fixture(tmp_path)
    objects = pl.read_parquet(
        tmp_path / "source/reference_media_objects.parquet"
    ).with_columns(
        pl.lit("sha256:" + "f" * 64).alias("object_fingerprint")
    )
    _rewrite_source_frame(manifest, "media_objects", objects)

    _assert_adapter_error(manifest, "reference media fingerprint changed")


def test_adapt_reference_review_packet_rejects_changed_source_identity(
    tmp_path: Path,
) -> None:
    manifest = write_packet_fixture(tmp_path)
    candidates = pl.read_parquet(
        tmp_path / "source/reference_media_candidates.parquet"
    ).with_columns(pl.lit("changed-provider-media").alias("provider_media_id"))
    _rewrite_source_frame(manifest, "media_candidates", candidates)

    _assert_adapter_error(manifest, "reference source identity changed")


def test_adapt_reference_review_packet_rejects_duplicate_group_conflict(
    tmp_path: Path,
) -> None:
    write_packet_fixture(tmp_path)
    queue = pl.read_parquet(tmp_path / "packet/reference_review_queue.parquet")
    provenance = pl.read_parquet(
        tmp_path / "packet/reference_review_queue_provenance.parquet"
    )
    queue_row = queue.row(0, named=True)
    second_queue_row = {
        **queue_row,
        "review_request_id": "reference-review-request:" + "a" * 64,
        "reference_media_id": "reference-media:" + "b" * 64,
        "canonical_reference_media_id": "reference-media:" + "c" * 64,
    }
    provenance_row = provenance.row(0, named=True)
    second_provenance_row = {
        **provenance_row,
        "review_request_id": second_queue_row["review_request_id"],
        "reference_media_id": second_queue_row["reference_media_id"],
    }
    conflicting_queue = pl.DataFrame(
        [queue_row, second_queue_row],
        schema=adapter._QUEUE_SCHEMA,
    )
    covering_provenance = pl.DataFrame(
        [provenance_row, second_provenance_row],
        schema=adapter._PROVENANCE_SCHEMA,
    )

    try:
        adapter._validate_queue_integrity(conflicting_queue, covering_provenance)
    except ReferenceReviewPacketAdapterError as exc:
        assert "duplicate group has conflicting canonical media" in str(exc)
    else:
        assert False


def test_adapt_reference_review_packet_rejects_missing_rights(
    tmp_path: Path,
) -> None:
    manifest = write_packet_fixture(tmp_path)
    queue = pl.read_parquet(
        tmp_path / "packet/reference_review_queue.parquet"
    ).with_columns(pl.lit(None, dtype=pl.String).alias("attribution"))
    _rewrite_packet_queue(manifest, queue)

    _assert_adapter_error(manifest, "attribution is missing or noncanonical")


def test_adapt_reference_review_packet_rejects_unsupported_source_schema(
    tmp_path: Path,
) -> None:
    manifest = write_packet_fixture(tmp_path)
    observations = pl.read_parquet(
        tmp_path / "source/reference_observations.parquet"
    ).drop("observer_id")
    _rewrite_source_frame(manifest, "observations", observations)

    _assert_adapter_error(manifest, "reference observations has an unsupported schema")
