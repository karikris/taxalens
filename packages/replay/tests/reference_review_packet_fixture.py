from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import polars as pl
from packages.replay.src import biominer_reference_review_packet_adapter as adapter

BIOMINER_SHA = "94fa1f634ee3c63917c05d78181dd3cf9ceff940"
TAXALENS_SHA = "1fec3b9b6a7ffaf3b2dbdf02484a9aebf0b09b03"
NOW = datetime(2026, 7, 14, 1, 2, 3, tzinfo=UTC)


def write_packet_fixture(
    root: Path,
    *,
    source: str = "gbif",
) -> Path:
    packet = root / "packet"
    source_dir = root / "source"
    packet.mkdir()
    source_dir.mkdir()

    provider_media_id = "provider-photo-1"
    reference_media_id = "reference-media:" + "1" * 64
    reference_observation_id = "reference-observation:" + "2" * 64
    canonical_media_id = reference_media_id
    duplicate_group_id = "reference-duplicate-group:" + "3" * 32
    object_fingerprint = "sha256:" + "4" * 64
    image_sha = "sha256:" + "5" * 64
    accepted_taxon_key = "gbif:1938069"
    scientific_name = "Papilio demoleus"
    source_observation_id = "300000001" if source == "gbif" else "200000001"
    source_taxon_id = "1938069" if source == "gbif" else "12345"

    queue_row: dict[str, Any] = {
        "schema_version": adapter._QUEUE_VERSION,
        "review_request_id": "reference-review-request:" + "6" * 64,
        "reference_media_id": reference_media_id,
        "reference_observation_id": reference_observation_id,
        "canonical_reference_media_id": canonical_media_id,
        "accepted_taxon_key": accepted_taxon_key,
        "scientific_name": scientific_name,
        "durable_preview_uri": (
            "s3://biominer-references/sha256/55/" + "5" * 64 + ".jpg"
        ),
        "media_object_fingerprint": object_fingerprint,
        "duplicate_group_id": duplicate_group_id,
        "source": source,
        "provider_media_id": provider_media_id,
        "provider_verification_status": "accepted",
        "creator": "Example observer",
        "rights_holder": "Example observer",
        "licence": "CC-BY-4.0",
        "licence_uri": "https://creativecommons.org/licenses/by/4.0/",
        "licence_policy_status": "allowed",
        "attribution": "Example observer / CC BY 4.0",
        "life_stage": "adult",
        "visual_domain": "live_field",
        "view": "dorsal",
        "review_reason": "manual_identity_review",
        "review_priority": 100,
        "required_review_count": 1,
        "review_status": "pending",
        "created_at": NOW,
        "reference_bank_version": "papilio-demoleus-reference-bank-v1",
        "input_fingerprint": "",
    }
    leaves = ["sha256:" + "7" * 64]
    source_binding = adapter._payload_hash(
        {
            "domain": "biominer.reference-review.source-set.v1",
            "source_leaf_fingerprints": leaves,
        }
    )
    semantics = adapter._queue_semantics_fingerprint(queue_row)
    input_fingerprint = adapter._payload_hash(
        {
            "domain": "biominer.reference-review.request-input.v1",
            "queue_semantics_fingerprint": semantics,
            "source_binding_fingerprint": source_binding,
        }
    )
    queue_row["input_fingerprint"] = input_fingerprint
    queue = pl.DataFrame([queue_row], schema=adapter._QUEUE_SCHEMA)
    provenance = pl.DataFrame(
        [
            {
                "schema_version": adapter._PROVENANCE_VERSION,
                "review_request_id": queue_row["review_request_id"],
                "reference_media_id": reference_media_id,
                "source_binding_fingerprint": source_binding,
                "source_leaf_fingerprints": leaves,
                "queue_semantics_fingerprint": semantics,
                "queue_row_fingerprint": adapter._queue_row_fingerprint(queue_row),
                "input_fingerprint": input_fingerprint,
            }
        ],
        schema=adapter._PROVENANCE_SCHEMA,
    )
    template = pl.DataFrame(
        [
            {
                "import_schema_version": adapter._DECISION_IMPORT_VERSION,
                "review_request_id": queue_row["review_request_id"],
                "reference_media_id": reference_media_id,
                "review_round": 1,
                "verified_by": None,
                "reviewed_at": None,
                "target_identity_verified": None,
                "verification_status": None,
                "life_stage": "adult",
                "visual_domain": "live_field",
                "view": "dorsal",
                "review_confidence": None,
                "review_notes": None,
                "exclusion_reason": None,
                "conflicts_with_decision_id": None,
            }
        ],
        schema=adapter._DECISION_TEMPLATE_SCHEMA,
    )
    decisions = pl.DataFrame(schema=adapter._DECISIONS_SCHEMA)

    observation = pl.DataFrame(
        [
            {
                "schema_version": adapter._OBSERVATIONS_VERSION,
                "reference_observation_id": reference_observation_id,
                "source": source,
                "source_observation_id": source_observation_id,
                "source_taxon_id": source_taxon_id,
                "supplied_scientific_name": scientific_name,
                "accepted_taxon_key": accepted_taxon_key,
                "reconciled_scientific_name": scientific_name,
                "registry_version": "fixture-registry-v1",
                "taxon_reconciliation_status": "accepted_key_exact",
                "identification_quality": "research_grade",
                "community_taxon_status": "accepted",
                "identification_disagreement": False,
                "captive_or_cultivated": False,
                "observer_id": "observer-1",
                "locality": "Sydney",
                "life_stage": "adult",
                "sex": None,
                "observed_at": NOW,
                "latitude": -33.87,
                "longitude": 151.21,
                "coordinate_uncertainty": 10.0,
                "coordinates_obscured": False,
                "country": "Australia",
                "country_code": "AU",
                "geo_cluster_id": "geo-cluster-1",
                "distance_to_cluster_medoid_km": 1.5,
                "source_dataset_key": "dataset-1",
                "source_dataset_doi": None,
                "source_record_url": f"https://example.org/observations/{source_observation_id}",
                "source_record_hash": "sha256:" + "8" * 64,
                "retrieved_at": NOW,
                "source_snapshot_version": "fixture-snapshot-v1",
                "source_query_fingerprint": "sha256:" + "9" * 64,
                "fallback_level": 0,
                "geospatial_issue": False,
                "preserved_specimen": False,
                "fossil": False,
                "occurrence_absent": False,
                "uncertain_taxon_match": False,
                "basis_of_record_suitable": True,
            }
        ],
        schema=adapter._OBSERVATION_SCHEMA,
    )
    candidate = pl.DataFrame(
        [
            {
                "schema_version": adapter._MEDIA_CANDIDATES_VERSION,
                "reference_media_id": reference_media_id,
                "reference_observation_id": reference_observation_id,
                "provider_media_id": provider_media_id,
                "source": source,
                "media_identifier": "https://example.org/media/provider-photo-1.jpg",
                "media_type": "image/jpeg",
                "width": 1600,
                "height": 1200,
                "creator": "Example observer",
                "rights_holder": "Example observer",
                "licence": "CC-BY-4.0",
                "licence_uri": "https://creativecommons.org/licenses/by/4.0/",
                "attribution": "Example observer / CC BY 4.0",
                "occurrence_licence": "CC0-1.0",
                "original_provider": "Atlas of Living Australia",
                "media_position": 0,
                "source_checksum": None,
                "source_checksum_algorithm": None,
                "download_status": "complete",
                "verification_status": "accepted",
                "exclusion_reason": None,
                "licence_policy_status": "allowed",
                "retrieved_at": NOW,
                "source_snapshot_version": "fixture-snapshot-v1",
            }
        ],
        schema=adapter._MEDIA_CANDIDATE_SCHEMA,
    )
    media_object = pl.DataFrame(
        [
            {
                "schema_version": adapter._MEDIA_OBJECTS_VERSION,
                "reference_media_id": reference_media_id,
                "source_object_uri": queue_row["durable_preview_uri"],
                "content_type": "image/jpeg",
                "source_byte_count": 12345,
                "decoded_width": 1600,
                "decoded_height": 1200,
                "sha256": image_sha,
                "perceptual_hash": "dhash128-v1:" + "a" * 32,
                "duplicate_group_id": duplicate_group_id,
                "duplicate_type": "unique",
                "canonical_reference_media_id": canonical_media_id,
                "provider_mirror_ids": [],
                "downloaded_at": NOW,
                "download_attempt_count": 1,
                "licence_policy_status": "allowed",
                "decode_status": "valid",
                "quarantine_reason": None,
                "object_fingerprint": object_fingerprint,
            }
        ],
        schema=adapter._MEDIA_OBJECT_SCHEMA,
    )

    packet_frames = {
        "queue": queue,
        "queue_provenance": provenance,
        "decision_template": template,
        "decisions": decisions,
    }
    packet_paths: dict[str, Path] = {}
    for key, frame in packet_frames.items():
        path = packet / adapter._REQUIRED_REPORT_ARTIFACTS[key]
        frame.write_parquet(path)
        packet_paths[key] = path
    summary_path = packet / adapter._REQUIRED_REPORT_ARTIFACTS["summary"]
    summary_path.write_text("Reference review queue export fixture.\n", encoding="utf-8")
    packet_paths["summary"] = summary_path

    provenance_row = provenance.row(0, named=True)
    immutable_fingerprint = adapter._payload_hash(
        [
            {
                "review_request_id": queue_row["review_request_id"],
                "input_fingerprint": input_fingerprint,
                "source_binding_fingerprint": provenance_row[
                    "source_binding_fingerprint"
                ],
            }
        ]
    )
    history_id = "reference-review-history:" + adapter._payload_hash(
        {
            "schema_version": adapter._HISTORY_VERSION,
            "root_queue_fingerprint": immutable_fingerprint,
        }
    ).removeprefix("sha256:")
    artifacts = {
        key: _artifact_record(path)
        for key, path in sorted(packet_paths.items())
    }
    report = {
        "schema_version": adapter._EXPORT_REPORT_VERSION,
        "command": "references.export_review_queue",
        "status": "complete",
        "run_id": "taxalens-contract-fixture",
        "git_sha": BIOMINER_SHA,
        "reference_bank_version": queue_row["reference_bank_version"],
        "counts": {
            "queue_rows": queue.height,
            "queue_provenance_rows": provenance.height,
        },
        "outputs": {
            "queue_fingerprint": adapter._frame_fingerprint(queue),
            "queue_provenance_fingerprint": adapter._frame_fingerprint(provenance),
            "decision_template_fingerprint": adapter._frame_fingerprint(template),
            "artifact_uris": {
                key: str(path.resolve())
                for key, path in sorted(packet_paths.items())
            },
        },
        "history": {
            "schema_version": adapter._HISTORY_VERSION,
            "history_id": history_id,
            "revision": 0,
            "parent_report_sha256": None,
            "queue_fingerprint": adapter._frame_fingerprint(queue),
            "queue_provenance_fingerprint": adapter._frame_fingerprint(provenance),
            "decision_ledger_fingerprint": adapter._frame_fingerprint(decisions),
            "new_decision_ids": [],
        },
        "artifacts": artifacts,
    }
    report_path = packet / "reference_review_export_report.json"
    report_path.write_text(
        json.dumps(report, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )

    source_frames = {
        "observations": observation,
        "media_candidates": candidate,
        "media_objects": media_object,
    }
    source_paths: dict[str, Path] = {}
    for key, frame in source_frames.items():
        path = source_dir / adapter._SOURCE_FILENAMES[key]
        frame.write_parquet(path)
        source_paths[key] = path

    manifest = {
        "schema_version": adapter.REFERENCE_REVIEW_SOURCE_MANIFEST_VERSION,
        "biominer_commit": BIOMINER_SHA,
        "fixture_only": True,
        "export_report": _descriptor(report_path, root),
        "source_artifacts": {
            key: _descriptor(path, root) for key, path in sorted(source_paths.items())
        },
    }
    manifest_path = root / "reference_review_source_manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return manifest_path


def _artifact_record(path: Path) -> dict[str, Any]:
    content = path.read_bytes()
    return {
        "uri": str(path.resolve()),
        "committed": True,
        "byte_count": len(content),
        "sha256": "sha256:" + hashlib.sha256(content).hexdigest(),
    }


def _descriptor(path: Path, root: Path) -> dict[str, Any]:
    content = path.read_bytes()
    return {
        "path": path.relative_to(root).as_posix(),
        "byte_count": len(content),
        "sha256": "sha256:" + hashlib.sha256(content).hexdigest(),
    }
