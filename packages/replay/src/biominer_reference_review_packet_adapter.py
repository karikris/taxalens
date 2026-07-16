"""Fail-closed adapter for BioMiner reference-review packets."""

from __future__ import annotations

import hashlib
import io
import json
import re
from collections import defaultdict
from collections.abc import Mapping
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

import polars as pl

from packages.replay.src.validation import is_full_git_sha

REFERENCE_REVIEW_SOURCE_MANIFEST_VERSION = (
    "taxalens-biominer-reference-review-source-manifest:v1.0.0"
)
REFERENCE_REVIEW_ADAPTER_VERSION = "taxalens-biominer-reference-review-adapter:v1.0.0"
VERIFICATION_CAMPAIGN_VERSION = "taxalens-verification-campaign:v1.0.0"

_QUEUE_VERSION = "reference-review-queue-v1.0.0"
_PROVENANCE_VERSION = "reference-review-queue-provenance-v1.0.0"
_DECISION_IMPORT_VERSION = "reference-review-decision-import-v1.0.0"
_DECISIONS_VERSION = "reference-review-decisions-v1.0.0"
_EXPORT_REPORT_VERSION = "reference-review-export-report-v1.0.0"
_HISTORY_VERSION = "reference-review-history-v1.0.0"
_OBSERVATIONS_VERSION = "reference-observations-v1.2.0"
_MEDIA_CANDIDATES_VERSION = "reference-media-candidates-v1.0.0"
_MEDIA_OBJECTS_VERSION = "reference-media-objects-v1.1.0"

_SHA256 = re.compile(r"sha256:[0-9a-f]{64}\Z")
_BARE_SHA256 = re.compile(r"[0-9a-f]{64}\Z")
_REQUIRED_REPORT_ARTIFACTS = {
    "queue": "reference_review_queue.parquet",
    "queue_provenance": "reference_review_queue_provenance.parquet",
    "decision_template": "reference_review_decision_template.parquet",
    "decisions": "reference_review_decisions.parquet",
    "summary": "reference_review_export_summary.md",
}
_SOURCE_FILENAMES = {
    "observations": "reference_observations.parquet",
    "media_candidates": "reference_media_candidates.parquet",
    "media_objects": "reference_media_objects.parquet",
}

_QUEUE_SCHEMA = {
    "schema_version": pl.String,
    "review_request_id": pl.String,
    "reference_media_id": pl.String,
    "reference_observation_id": pl.String,
    "canonical_reference_media_id": pl.String,
    "accepted_taxon_key": pl.String,
    "scientific_name": pl.String,
    "durable_preview_uri": pl.String,
    "media_object_fingerprint": pl.String,
    "duplicate_group_id": pl.String,
    "source": pl.String,
    "provider_media_id": pl.String,
    "provider_verification_status": pl.String,
    "creator": pl.String,
    "rights_holder": pl.String,
    "licence": pl.String,
    "licence_uri": pl.String,
    "licence_policy_status": pl.String,
    "attribution": pl.String,
    "life_stage": pl.String,
    "visual_domain": pl.String,
    "view": pl.String,
    "review_reason": pl.String,
    "review_priority": pl.UInt32,
    "required_review_count": pl.UInt8,
    "review_status": pl.String,
    "created_at": pl.Datetime("us", "UTC"),
    "reference_bank_version": pl.String,
    "input_fingerprint": pl.String,
}
_PROVENANCE_SCHEMA = {
    "schema_version": pl.String,
    "review_request_id": pl.String,
    "reference_media_id": pl.String,
    "source_binding_fingerprint": pl.String,
    "source_leaf_fingerprints": pl.List(pl.String),
    "queue_semantics_fingerprint": pl.String,
    "queue_row_fingerprint": pl.String,
    "input_fingerprint": pl.String,
}
_DECISION_TEMPLATE_SCHEMA = {
    "import_schema_version": pl.String,
    "review_request_id": pl.String,
    "reference_media_id": pl.String,
    "review_round": pl.UInt16,
    "verified_by": pl.String,
    "reviewed_at": pl.Datetime("us", "UTC"),
    "target_identity_verified": pl.Boolean,
    "verification_status": pl.String,
    "life_stage": pl.String,
    "visual_domain": pl.String,
    "view": pl.String,
    "review_confidence": pl.String,
    "review_notes": pl.String,
    "exclusion_reason": pl.String,
    "conflicts_with_decision_id": pl.String,
}
_DECISIONS_SCHEMA = {
    "schema_version": pl.String,
    "review_decision_id": pl.String,
    "review_request_id": pl.String,
    "reference_media_id": pl.String,
    "review_round": pl.UInt16,
    "verified_by": pl.String,
    "reviewed_at": pl.Datetime("us", "UTC"),
    "target_identity_verified": pl.Boolean,
    "verification_status": pl.String,
    "life_stage": pl.String,
    "visual_domain": pl.String,
    "view": pl.String,
    "review_confidence": pl.String,
    "review_notes": pl.String,
    "exclusion_reason": pl.String,
    "second_review_required": pl.Boolean,
    "conflicts_with_decision_id": pl.String,
    "decision_source_hash": pl.String,
}
_OBSERVATION_SCHEMA = {
    "schema_version": pl.String,
    "reference_observation_id": pl.String,
    "source": pl.String,
    "source_observation_id": pl.String,
    "source_taxon_id": pl.String,
    "supplied_scientific_name": pl.String,
    "accepted_taxon_key": pl.String,
    "reconciled_scientific_name": pl.String,
    "registry_version": pl.String,
    "taxon_reconciliation_status": pl.String,
    "identification_quality": pl.String,
    "community_taxon_status": pl.String,
    "identification_disagreement": pl.Boolean,
    "captive_or_cultivated": pl.Boolean,
    "observer_id": pl.String,
    "locality": pl.String,
    "life_stage": pl.String,
    "sex": pl.String,
    "observed_at": pl.Datetime("us", "UTC"),
    "latitude": pl.Float64,
    "longitude": pl.Float64,
    "coordinate_uncertainty": pl.Float64,
    "coordinates_obscured": pl.Boolean,
    "country": pl.String,
    "country_code": pl.String,
    "geo_cluster_id": pl.String,
    "distance_to_cluster_medoid_km": pl.Float64,
    "source_dataset_key": pl.String,
    "source_dataset_doi": pl.String,
    "source_record_url": pl.String,
    "source_record_hash": pl.String,
    "retrieved_at": pl.Datetime("us", "UTC"),
    "source_snapshot_version": pl.String,
    "source_query_fingerprint": pl.String,
    "fallback_level": pl.UInt8,
    "geospatial_issue": pl.Boolean,
    "preserved_specimen": pl.Boolean,
    "fossil": pl.Boolean,
    "occurrence_absent": pl.Boolean,
    "uncertain_taxon_match": pl.Boolean,
    "basis_of_record_suitable": pl.Boolean,
}
_MEDIA_CANDIDATE_SCHEMA = {
    "schema_version": pl.String,
    "reference_media_id": pl.String,
    "reference_observation_id": pl.String,
    "provider_media_id": pl.String,
    "source": pl.String,
    "media_identifier": pl.String,
    "media_type": pl.String,
    "width": pl.UInt32,
    "height": pl.UInt32,
    "creator": pl.String,
    "rights_holder": pl.String,
    "licence": pl.String,
    "licence_uri": pl.String,
    "attribution": pl.String,
    "occurrence_licence": pl.String,
    "original_provider": pl.String,
    "media_position": pl.UInt32,
    "source_checksum": pl.String,
    "source_checksum_algorithm": pl.String,
    "download_status": pl.String,
    "verification_status": pl.String,
    "exclusion_reason": pl.String,
    "licence_policy_status": pl.String,
    "retrieved_at": pl.Datetime("us", "UTC"),
    "source_snapshot_version": pl.String,
}
_MEDIA_OBJECT_SCHEMA = {
    "schema_version": pl.String,
    "reference_media_id": pl.String,
    "source_object_uri": pl.String,
    "content_type": pl.String,
    "source_byte_count": pl.UInt64,
    "decoded_width": pl.UInt32,
    "decoded_height": pl.UInt32,
    "sha256": pl.String,
    "perceptual_hash": pl.String,
    "duplicate_group_id": pl.String,
    "duplicate_type": pl.String,
    "canonical_reference_media_id": pl.String,
    "provider_mirror_ids": pl.List(pl.String),
    "downloaded_at": pl.Datetime("us", "UTC"),
    "download_attempt_count": pl.UInt32,
    "licence_policy_status": pl.String,
    "decode_status": pl.String,
    "quarantine_reason": pl.String,
    "object_fingerprint": pl.String,
}


class ReferenceReviewPacketAdapterError(ValueError):
    """Raised when a BioMiner review packet cannot be safely adapted."""


def adapt_reference_review_packet(
    *,
    source_manifest_path: str | Path,
    biominer_commit: str,
    taxalens_commit: str,
) -> dict[str, Any]:
    """Map a checksum-bound BioMiner review packet into TaxaLens campaigns and items."""
    _require_git_sha(biominer_commit, "biominer_commit")
    _require_git_sha(taxalens_commit, "taxalens_commit")
    manifest_path = Path(source_manifest_path).resolve()
    manifest_bytes = _read_bytes(manifest_path, "source manifest")
    manifest = _json_object(manifest_bytes, "source manifest")
    _validate_source_manifest(manifest, biominer_commit)

    report_path, report_bytes = _read_descriptor(
        manifest_path.parent,
        manifest["export_report"],
        "export report",
    )
    report = _json_object(report_bytes, "export report")
    packet_frames = _load_review_packet(report, report_path, biominer_commit)
    source_frames = {
        key: _read_parquet_descriptor(
            manifest_path.parent,
            manifest["source_artifacts"][key],
            key.replace("_", " "),
        )
        for key in sorted(_SOURCE_FILENAMES)
    }

    queue = packet_frames["queue"]
    provenance = packet_frames["queue_provenance"]
    template = packet_frames["decision_template"]
    decisions = packet_frames["decisions"]
    observations = source_frames["observations"]
    candidates = source_frames["media_candidates"]
    objects = source_frames["media_objects"]

    _validate_packet_frames(queue, provenance, template, decisions, report)
    _validate_source_frames(observations, candidates, objects)
    contexts = _bind_source_context(queue, observations, candidates, objects)

    manifest_sha = hashlib.sha256(manifest_bytes).hexdigest()
    campaigns, items = _build_campaigns_and_items(
        queue=queue,
        contexts=contexts,
        manifest_sha=manifest_sha,
        biominer_commit=biominer_commit,
        taxalens_commit=taxalens_commit,
    )
    return {
        "schemaVersion": REFERENCE_REVIEW_ADAPTER_VERSION,
        "sourceManifest": {
            "path": str(manifest_path),
            "sha256": manifest_sha,
            "fixtureOnly": manifest["fixture_only"],
            "biominerCommit": biominer_commit,
            "exportReportPath": str(report_path),
            "exportRunId": report["run_id"],
            "referenceBankVersion": report["reference_bank_version"],
        },
        "campaigns": campaigns,
        "items": items,
        "decisionTemplate": {
            "schemaVersion": _DECISION_IMPORT_VERSION,
            "rowCount": template.height,
            "fingerprint": _frame_fingerprint(template),
        },
        "semantics": {
            "sourceLabelsRemainCandidateEvidenceUntilReviewed": True,
            "reviewEventsMustBeAppendOnly": True,
            "preparedForBioMinerDecisionExport": True,
            "scientificClaimAllowed": False,
        },
    }


def _validate_source_manifest(manifest: Mapping[str, Any], biominer_commit: str) -> None:
    expected_fields = {
        "schema_version",
        "biominer_commit",
        "fixture_only",
        "export_report",
        "source_artifacts",
    }
    if set(manifest) != expected_fields:
        raise ReferenceReviewPacketAdapterError(
            "source manifest fields do not match the supported contract"
        )
    if manifest["schema_version"] != REFERENCE_REVIEW_SOURCE_MANIFEST_VERSION:
        raise ReferenceReviewPacketAdapterError("unsupported source manifest schema")
    if manifest["biominer_commit"] != biominer_commit:
        raise ReferenceReviewPacketAdapterError("source manifest BioMiner commit is stale")
    if not isinstance(manifest["fixture_only"], bool):
        raise ReferenceReviewPacketAdapterError("fixture_only must be Boolean")
    _validate_descriptor(manifest["export_report"], "export report")
    sources = manifest["source_artifacts"]
    if not isinstance(sources, Mapping) or set(sources) != set(_SOURCE_FILENAMES):
        raise ReferenceReviewPacketAdapterError("source artifact ledger is incomplete")
    for key, filename in _SOURCE_FILENAMES.items():
        _validate_descriptor(sources[key], key.replace("_", " "))
        if Path(str(sources[key]["path"])).name != filename:
            raise ReferenceReviewPacketAdapterError(
                f"{key.replace('_', ' ')} artifact filename is incompatible"
            )


def _load_review_packet(
    report: Mapping[str, Any],
    report_path: Path,
    biominer_commit: str,
) -> dict[str, pl.DataFrame]:
    if (
        report.get("schema_version") != _EXPORT_REPORT_VERSION
        or report.get("command") != "references.export_review_queue"
        or report.get("status") != "complete"
    ):
        raise ReferenceReviewPacketAdapterError("review export report identity is incompatible")
    if report.get("git_sha") != biominer_commit:
        raise ReferenceReviewPacketAdapterError("review export report BioMiner commit is stale")
    artifacts = report.get("artifacts")
    if not isinstance(artifacts, Mapping) or set(artifacts) != set(
        _REQUIRED_REPORT_ARTIFACTS
    ):
        raise ReferenceReviewPacketAdapterError("review export artifact ledger is incomplete")

    contents: dict[str, bytes] = {}
    packet_dir = report_path.parent.resolve()
    for key, filename in _REQUIRED_REPORT_ARTIFACTS.items():
        record = artifacts[key]
        _validate_report_artifact_record(record, key)
        artifact_path = Path(str(record["uri"]))
        if (
            not artifact_path.is_absolute()
            or artifact_path.resolve().parent != packet_dir
            or artifact_path.name != filename
        ):
            raise ReferenceReviewPacketAdapterError(
                f"review export artifact path is incompatible: {key}"
            )
        content = _read_bytes(artifact_path, f"review export artifact {key}")
        _validate_content_binding(content, record, f"review export artifact {key}")
        contents[key] = content

    outputs = report.get("outputs")
    expected_uris = {
        key: str((packet_dir / filename).resolve())
        for key, filename in sorted(_REQUIRED_REPORT_ARTIFACTS.items())
    }
    if not isinstance(outputs, Mapping) or outputs.get("artifact_uris") != expected_uris:
        raise ReferenceReviewPacketAdapterError(
            "review export artifact URI projection is inconsistent"
        )
    return {
        key: _read_parquet_bytes(contents[key], key.replace("_", " "))
        for key in ("queue", "queue_provenance", "decision_template", "decisions")
    }


def _validate_packet_frames(
    queue: pl.DataFrame,
    provenance: pl.DataFrame,
    template: pl.DataFrame,
    decisions: pl.DataFrame,
    report: Mapping[str, Any],
) -> None:
    _validate_schema(queue, _QUEUE_SCHEMA, "review queue")
    _validate_schema(provenance, _PROVENANCE_SCHEMA, "review queue provenance")
    _validate_schema(template, _DECISION_TEMPLATE_SCHEMA, "decision template")
    _validate_schema(decisions, _DECISIONS_SCHEMA, "decision ledger")
    _validate_versions(queue, "schema_version", _QUEUE_VERSION, "review queue")
    _validate_versions(
        provenance,
        "schema_version",
        _PROVENANCE_VERSION,
        "review queue provenance",
    )
    _validate_versions(
        template,
        "import_schema_version",
        _DECISION_IMPORT_VERSION,
        "decision template",
    )
    if not decisions.is_empty():
        raise ReferenceReviewPacketAdapterError("root review packet decision ledger is not empty")
    _validate_queue_integrity(queue, provenance)
    _validate_decision_template(queue, template)

    counts = report.get("counts")
    outputs = report.get("outputs")
    if (
        not isinstance(counts, Mapping)
        or counts.get("queue_rows") != queue.height
        or counts.get("queue_provenance_rows") != provenance.height
    ):
        raise ReferenceReviewPacketAdapterError("review export report counts are inconsistent")
    expected_fingerprints = {
        "queue_fingerprint": _frame_fingerprint(queue),
        "queue_provenance_fingerprint": _frame_fingerprint(provenance),
        "decision_template_fingerprint": _frame_fingerprint(template),
    }
    if not isinstance(outputs, Mapping) or any(
        outputs.get(key) != value for key, value in expected_fingerprints.items()
    ):
        raise ReferenceReviewPacketAdapterError(
            "review export report fingerprints are inconsistent"
        )
    _validate_history(report.get("history"), queue, provenance, decisions)


def _validate_queue_integrity(queue: pl.DataFrame, provenance: pl.DataFrame) -> None:
    if queue.is_empty():
        raise ReferenceReviewPacketAdapterError("review queue is empty")
    if queue["review_request_id"].n_unique() != queue.height:
        raise ReferenceReviewPacketAdapterError("review queue has duplicate review requests")
    if queue["reference_media_id"].n_unique() != queue.height:
        raise ReferenceReviewPacketAdapterError("review queue has duplicate media")
    if provenance["review_request_id"].n_unique() != provenance.height:
        raise ReferenceReviewPacketAdapterError("review queue provenance has duplicate requests")
    if set(queue["review_request_id"]) != set(provenance["review_request_id"]):
        raise ReferenceReviewPacketAdapterError(
            "review queue provenance does not cover the complete queue"
        )

    provenance_by_request = {
        str(row["review_request_id"]): row for row in provenance.iter_rows(named=True)
    }
    canonical_by_group: dict[str, str] = {}
    for row in queue.iter_rows(named=True):
        if row["schema_version"] != _QUEUE_VERSION or row["review_status"] != "pending":
            raise ReferenceReviewPacketAdapterError("review queue state is incompatible")
        if _provider(row["source"]) not in {"gbif", "inaturalist"}:
            raise ReferenceReviewPacketAdapterError("unsupported reference source provider")
        if not isinstance(row["required_review_count"], int) or row[
            "required_review_count"
        ] < 1:
            raise ReferenceReviewPacketAdapterError("review quorum is invalid")
        if _required_text(row["accepted_taxon_key"], "accepted taxon key") is None:
            raise ReferenceReviewPacketAdapterError("review item target taxon is unresolved")
        _required_text(row["scientific_name"], "scientific name")
        _validate_rights_row(row)

        group_id = _required_text(row["duplicate_group_id"], "duplicate group")
        canonical_id = _required_text(
            row["canonical_reference_media_id"],
            "canonical reference media ID",
        )
        previous = canonical_by_group.setdefault(group_id, canonical_id)
        if previous != canonical_id:
            raise ReferenceReviewPacketAdapterError(
                "duplicate group has conflicting canonical media"
            )

        source = provenance_by_request[str(row["review_request_id"])]
        if source["reference_media_id"] != row["reference_media_id"]:
            raise ReferenceReviewPacketAdapterError(
                "review queue provenance media binding is inconsistent"
            )
        leaves = source["source_leaf_fingerprints"]
        if not leaves or leaves != sorted(set(leaves)):
            raise ReferenceReviewPacketAdapterError(
                "review queue provenance leaves are invalid"
            )
        fingerprint_values = [
            *leaves,
            source["source_binding_fingerprint"],
            source["queue_semantics_fingerprint"],
            source["queue_row_fingerprint"],
            source["input_fingerprint"],
        ]
        if any(
            not isinstance(value, str) or _SHA256.fullmatch(value) is None
            for value in fingerprint_values
        ):
            raise ReferenceReviewPacketAdapterError(
                "review queue provenance fingerprint is invalid"
            )
        expected_source = _payload_hash(
            {
                "domain": "biominer.reference-review.source-set.v1",
                "source_leaf_fingerprints": sorted(leaves),
            }
        )
        expected_semantics = _queue_semantics_fingerprint(row)
        expected_input = _payload_hash(
            {
                "domain": "biominer.reference-review.request-input.v1",
                "queue_semantics_fingerprint": expected_semantics,
                "source_binding_fingerprint": expected_source,
            }
        )
        if (
            source["source_binding_fingerprint"] != expected_source
            or source["queue_semantics_fingerprint"] != expected_semantics
            or source["input_fingerprint"] != expected_input
            or row["input_fingerprint"] != expected_input
            or source["queue_row_fingerprint"] != _queue_row_fingerprint(row)
        ):
            raise ReferenceReviewPacketAdapterError("review queue provenance is stale")


def _validate_decision_template(queue: pl.DataFrame, template: pl.DataFrame) -> None:
    if template.height != queue.height:
        raise ReferenceReviewPacketAdapterError(
            "decision template does not cover the complete queue"
        )
    queue_by_request = {
        str(row["review_request_id"]): row for row in queue.iter_rows(named=True)
    }
    if template["review_request_id"].n_unique() != template.height:
        raise ReferenceReviewPacketAdapterError("decision template has duplicate requests")
    for row in template.iter_rows(named=True):
        request_id = str(row["review_request_id"])
        queue_row = queue_by_request.get(request_id)
        if queue_row is None or row["reference_media_id"] != queue_row["reference_media_id"]:
            raise ReferenceReviewPacketAdapterError(
                "decision template source binding is inconsistent"
            )
        if row["review_round"] != 1:
            raise ReferenceReviewPacketAdapterError("decision template review round is invalid")
        if any(
            row[field] is not None
            for field in (
                "verified_by",
                "reviewed_at",
                "target_identity_verified",
                "verification_status",
                "review_confidence",
                "review_notes",
                "exclusion_reason",
                "conflicts_with_decision_id",
            )
        ):
            raise ReferenceReviewPacketAdapterError(
                "decision template contains a prefilled human decision"
            )
        if any(
            row[field] != queue_row[field]
            for field in ("life_stage", "visual_domain", "view")
        ):
            raise ReferenceReviewPacketAdapterError(
                "decision template proposals do not match the queue"
            )


def _validate_history(
    history: Any,
    queue: pl.DataFrame,
    provenance: pl.DataFrame,
    decisions: pl.DataFrame,
) -> None:
    if not isinstance(history, Mapping):
        raise ReferenceReviewPacketAdapterError("review export history binding is missing")
    immutable_fingerprint = _payload_hash(
        [
            {
                "review_request_id": row["review_request_id"],
                "input_fingerprint": row["input_fingerprint"],
                "source_binding_fingerprint": next(
                    provenance_row["source_binding_fingerprint"]
                    for provenance_row in provenance.iter_rows(named=True)
                    if provenance_row["review_request_id"] == row["review_request_id"]
                ),
            }
            for row in queue.iter_rows(named=True)
        ]
    )
    history_id = "reference-review-history:" + _payload_hash(
        {
            "schema_version": _HISTORY_VERSION,
            "root_queue_fingerprint": immutable_fingerprint,
        }
    ).removeprefix("sha256:")
    expected = {
        "schema_version": _HISTORY_VERSION,
        "history_id": history_id,
        "revision": 0,
        "parent_report_sha256": None,
        "queue_fingerprint": _frame_fingerprint(queue),
        "queue_provenance_fingerprint": _frame_fingerprint(provenance),
        "decision_ledger_fingerprint": _frame_fingerprint(decisions),
        "new_decision_ids": [],
    }
    if dict(history) != expected:
        raise ReferenceReviewPacketAdapterError("review export history binding is stale")


def _validate_source_frames(
    observations: pl.DataFrame,
    candidates: pl.DataFrame,
    objects: pl.DataFrame,
) -> None:
    _validate_schema(observations, _OBSERVATION_SCHEMA, "reference observations")
    _validate_schema(candidates, _MEDIA_CANDIDATE_SCHEMA, "reference media candidates")
    _validate_schema(objects, _MEDIA_OBJECT_SCHEMA, "reference media objects")
    _validate_versions(
        observations,
        "schema_version",
        _OBSERVATIONS_VERSION,
        "reference observations",
    )
    _validate_versions(
        candidates,
        "schema_version",
        _MEDIA_CANDIDATES_VERSION,
        "reference media candidates",
    )
    _validate_versions(
        objects,
        "schema_version",
        _MEDIA_OBJECTS_VERSION,
        "reference media objects",
    )
    for frame, field, label in (
        (observations, "reference_observation_id", "reference observations"),
        (candidates, "reference_media_id", "reference media candidates"),
        (objects, "reference_media_id", "reference media objects"),
    ):
        if frame[field].n_unique() != frame.height:
            raise ReferenceReviewPacketAdapterError(f"{label} have duplicate identities")


def _bind_source_context(
    queue: pl.DataFrame,
    observations: pl.DataFrame,
    candidates: pl.DataFrame,
    objects: pl.DataFrame,
) -> dict[str, dict[str, Mapping[str, Any]]]:
    observation_by_id = {
        str(row["reference_observation_id"]): row
        for row in observations.iter_rows(named=True)
    }
    candidate_by_id = {
        str(row["reference_media_id"]): row
        for row in candidates.iter_rows(named=True)
    }
    object_by_id = {
        str(row["reference_media_id"]): row for row in objects.iter_rows(named=True)
    }
    contexts: dict[str, dict[str, Mapping[str, Any]]] = {}
    for queue_row in queue.iter_rows(named=True):
        media_id = str(queue_row["reference_media_id"])
        observation_id = str(queue_row["reference_observation_id"])
        candidate = candidate_by_id.get(media_id)
        media_object = object_by_id.get(media_id)
        observation = observation_by_id.get(observation_id)
        if candidate is None or media_object is None or observation is None:
            raise ReferenceReviewPacketAdapterError(
                "review queue source context is incomplete"
            )
        _validate_context_binding(queue_row, observation, candidate, media_object)
        contexts[str(queue_row["review_request_id"])] = {
            "observation": observation,
            "candidate": candidate,
            "media_object": media_object,
        }
    return contexts


def _validate_context_binding(
    queue: Mapping[str, Any],
    observation: Mapping[str, Any],
    candidate: Mapping[str, Any],
    media_object: Mapping[str, Any],
) -> None:
    provider = _provider(queue["source"])
    if (
        _provider(observation["source"]) != provider
        or _provider(candidate["source"]) != provider
        or candidate["reference_observation_id"] != queue["reference_observation_id"]
        or candidate["provider_media_id"] != queue["provider_media_id"]
        or observation["accepted_taxon_key"] != queue["accepted_taxon_key"]
        or observation["reconciled_scientific_name"] != queue["scientific_name"]
    ):
        raise ReferenceReviewPacketAdapterError("reference source identity changed")
    if (
        candidate["verification_status"] != queue["provider_verification_status"]
        or candidate["creator"] != queue["creator"]
        or candidate["rights_holder"] != queue["rights_holder"]
        or candidate["licence"] != queue["licence"]
        or candidate["licence_uri"] != queue["licence_uri"]
        or candidate["attribution"] != queue["attribution"]
    ):
        raise ReferenceReviewPacketAdapterError("reference rights or provider state changed")
    if (
        candidate["download_status"] != "complete"
        or candidate["media_type"] not in {"StillImage", media_object["content_type"]}
        or media_object["decode_status"] != "valid"
        or media_object["quarantine_reason"] is not None
    ):
        raise ReferenceReviewPacketAdapterError("reference media is not displayable")
    if (
        media_object["object_fingerprint"] != queue["media_object_fingerprint"]
        or media_object["source_object_uri"] != queue["durable_preview_uri"]
        or media_object["duplicate_group_id"] != queue["duplicate_group_id"]
        or media_object["canonical_reference_media_id"]
        != queue["canonical_reference_media_id"]
        or media_object["licence_policy_status"] != queue["licence_policy_status"]
    ):
        raise ReferenceReviewPacketAdapterError("reference media fingerprint changed")
    if (
        not isinstance(media_object["sha256"], str)
        or _SHA256.fullmatch(media_object["sha256"]) is None
        or not isinstance(media_object["source_byte_count"], int)
        or media_object["source_byte_count"] < 1
        or not str(media_object["content_type"]).startswith("image/")
    ):
        raise ReferenceReviewPacketAdapterError("reference media identity is invalid")


def _build_campaigns_and_items(
    *,
    queue: pl.DataFrame,
    contexts: Mapping[str, Mapping[str, Mapping[str, Any]]],
    manifest_sha: str,
    biominer_commit: str,
    taxalens_commit: str,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    grouped: dict[tuple[str, str, int], list[Mapping[str, Any]]] = defaultdict(list)
    for row in queue.iter_rows(named=True):
        grouped[
            (
                str(row["accepted_taxon_key"]),
                str(row["scientific_name"]),
                int(row["required_review_count"]),
            )
        ].append(row)

    campaigns: list[dict[str, Any]] = []
    items: list[dict[str, Any]] = []
    for (taxon_key, scientific_name, quorum), rows in sorted(grouped.items()):
        providers = sorted({_provider(row["source"]) for row in rows})
        question_fingerprint = hashlib.sha256(
            json.dumps(
                {
                    "domain": "taxalens.reference-identity-question.v1",
                    "accepted_taxon_key": taxon_key,
                    "scientific_name": scientific_name,
                    "required_independent_reviewers": quorum,
                },
                sort_keys=True,
                separators=(",", ":"),
            ).encode("utf-8")
        ).hexdigest()
        campaign_digest = hashlib.sha256(
            json.dumps(
                {
                    "manifest_sha256": manifest_sha,
                    "taxon": taxon_key,
                    "quorum": quorum,
                    "providers": providers,
                },
                sort_keys=True,
                separators=(",", ":"),
            ).encode("utf-8")
        ).hexdigest()
        campaign_id = f"biominer-reference-{campaign_digest[:24]}"
        target_taxon = {
            "acceptedTaxonKey": taxon_key,
            "scientificName": scientific_name,
            "commonName": None,
            "rank": "other",
            "authority": None,
        }
        strata = [
            {
                "stratumId": f"provider-{provider}",
                "label": f"{_provider_label(provider)} reference queue",
                "populationCount": None,
                "targetSampleCount": sum(
                    _provider(row["source"]) == provider for row in rows
                ),
                "populationWeight": None,
                "selectionNotes": (
                    "BioMiner priority review queue; not a probability sample."
                ),
            }
            for provider in providers
        ]
        campaigns.append(
            {
                "schemaVersion": VERIFICATION_CAMPAIGN_VERSION,
                "campaignId": campaign_id,
                "title": f"{scientific_name} reference identity verification",
                "description": (
                    "Review checksum-bound GBIF and iNaturalist reference images "
                    "without promoting provider labels to verified evidence."
                ),
                "kind": "reference_identity_verification",
                "status": "ready",
                "targetTaxon": target_taxon,
                "sourceProviders": providers,
                "reviewRequirement": {
                    "requiredIndependentReviewers": quorum,
                    "secondReviewPolicy": (
                        "always" if quorum > 1 else "on_conflict_or_uncertain"
                    ),
                    "adjudicationRequiredOnConflict": quorum > 1,
                    "decisiveOutcomes": ["yes", "no"],
                    "mediaRequiredOutcomes": ["yes", "no", "cant_tell"],
                    "nonScientificOutcomes": ["cant_view", "skipped"],
                },
                "samplingPlan": {
                    "planId": f"{campaign_id}-priority-queue",
                    "purpose": "reference_readiness",
                    "design": "targeted_priority",
                    "representative": False,
                    "blindReview": False,
                    "selectionSeed": None,
                    "targetSampleSize": len(rows),
                    "inclusionProbabilityRequired": False,
                    "independentUnit": "duplicate_group",
                    "groupingKeys": [
                        "duplicate_group",
                        "observation_group",
                        "owner_group",
                    ],
                    "leakagePolicy": "support_only",
                    "strata": strata,
                    "qualityEstimationAllowed": False,
                    "qualityEstimationBlockedReason": (
                        "A targeted reference-readiness queue cannot estimate "
                        "population accuracy without a probability sample."
                    ),
                },
                "disclosurePolicy": {
                    "mode": "unblinded",
                    "revealAfterDecision": False,
                    "hiddenBeforeDecision": [],
                },
                "questionFingerprint": question_fingerprint,
                "manifestSha256": manifest_sha,
                "taxalensSha": taxalens_commit,
                "biominerSha": biominer_commit,
                "publicReplay": False,
                "scientificClaimAllowed": False,
            }
        )
        for row in rows:
            context = contexts[str(row["review_request_id"])]
            observation = context["observation"]
            media_object = context["media_object"]
            creator = str(row["creator"])
            owner_digest = hashlib.sha256(
                f"{_provider(row['source'])}\0{creator}".encode()
            ).hexdigest()
            items.append(
                {
                    "itemId": row["review_request_id"],
                    "campaignId": campaign_id,
                    "source": _provider(row["source"]),
                    "sourceObservationId": observation["source_observation_id"],
                    "sourceMediaId": row["reference_media_id"],
                    "imageSha256": str(media_object["sha256"]).removeprefix("sha256:"),
                    "imageByteCount": media_object["source_byte_count"],
                    "mediaType": media_object["content_type"],
                    "previewUri": row["durable_preview_uri"],
                    "targetTaxon": target_taxon,
                    "providerSuppliedIdentity": {
                        "providerTaxonKey": observation["source_taxon_id"],
                        "scientificName": observation["supplied_scientific_name"],
                        "commonName": None,
                        "rawLabel": observation["supplied_scientific_name"],
                        "verificationStatus": row["provider_verification_status"],
                    },
                    "expectedLifeStage": row["life_stage"],
                    "expectedVisualDomain": row["visual_domain"],
                    "expectedView": row["view"],
                    "duplicateGroupId": row["duplicate_group_id"],
                    "observationGroupId": row["reference_observation_id"],
                    "ownerPhotographerGroupId": f"biominer-owner:{owner_digest}",
                    "samplingStratumId": f"provider-{_provider(row['source'])}",
                    "inclusionProbability": None,
                    "rights": {
                        "creator": row["creator"],
                        "rightsHolder": row["rights_holder"],
                        "licenseName": row["licence"],
                        "licenseUri": row["licence_uri"],
                        "policyStatus": _rights_policy(row["licence_policy_status"]),
                        "attribution": row["attribution"],
                        "sourceUri": observation["source_record_url"],
                    },
                    "questionFingerprint": question_fingerprint,
                }
            )
    return campaigns, items


def _validate_rights_row(row: Mapping[str, Any]) -> None:
    for field, label in (
        ("creator", "creator"),
        ("rights_holder", "rights holder"),
        ("licence", "media licence"),
        ("licence_uri", "media licence URI"),
        ("attribution", "attribution"),
    ):
        _required_text(row[field], label)
    if row["licence_policy_status"] not in {"allowed", "research_only"}:
        raise ReferenceReviewPacketAdapterError("reference media rights are not reviewable")


def _rights_policy(value: Any) -> str:
    if value == "allowed":
        return "allowed"
    if value == "research_only":
        return "restricted"
    raise ReferenceReviewPacketAdapterError("reference media rights policy is unsupported")


def _provider(value: Any) -> str:
    text = str(value).strip().lower()
    if text == "gbif":
        return "gbif"
    if text in {"inaturalist", "i_naturalist"}:
        return "inaturalist"
    return text


def _provider_label(provider: str) -> str:
    return "GBIF" if provider == "gbif" else "iNaturalist"


def _validate_schema(
    frame: pl.DataFrame,
    expected: Mapping[str, pl.DataType],
    label: str,
) -> None:
    if frame.schema != pl.Schema(expected):
        raise ReferenceReviewPacketAdapterError(f"{label} has an unsupported schema")


def _validate_versions(
    frame: pl.DataFrame,
    field: str,
    expected: str,
    label: str,
) -> None:
    versions = set(frame[field].drop_nulls())
    if versions != {expected}:
        raise ReferenceReviewPacketAdapterError(f"{label} has an unsupported schema version")


def _queue_semantics_fingerprint(row: Mapping[str, Any]) -> str:
    excluded = {
        "created_at",
        "durable_preview_uri",
        "review_priority",
        "review_reason",
        "review_request_id",
        "review_status",
        "input_fingerprint",
    }
    payload = {field: row[field] for field in _QUEUE_SCHEMA if field not in excluded}
    return _payload_hash(
        {
            "domain": "biominer.reference-review.queue-semantics.v1",
            "queue": payload,
        }
    )


def _queue_row_fingerprint(row: Mapping[str, Any]) -> str:
    return _payload_hash(
        {
            "domain": "biominer.reference-review.queue-row.v1",
            "queue": {field: row[field] for field in _QUEUE_SCHEMA},
        }
    )


def _frame_fingerprint(frame: pl.DataFrame) -> str:
    return _payload_hash(
        {
            "schema": [(name, str(dtype)) for name, dtype in frame.schema.items()],
            "rows": [_jsonable(row) for row in frame.iter_rows(named=True)],
        }
    )


def _payload_hash(payload: Any) -> str:
    encoded = json.dumps(
        _jsonable(payload),
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=True,
    ).encode("utf-8")
    return "sha256:" + hashlib.sha256(encoded).hexdigest()


def _jsonable(value: Any) -> Any:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            raise ReferenceReviewPacketAdapterError("naive datetime in review packet")
        return value.astimezone(UTC).isoformat(timespec="microseconds")
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, Mapping):
        return {str(key): _jsonable(item) for key, item in sorted(value.items())}
    if isinstance(value, (list, tuple, set, frozenset)):
        return [_jsonable(item) for item in value]
    return value


def _read_parquet_descriptor(
    base: Path,
    descriptor: Any,
    label: str,
) -> pl.DataFrame:
    _, content = _read_descriptor(base, descriptor, label)
    return _read_parquet_bytes(content, label)


def _read_parquet_bytes(content: bytes, label: str) -> pl.DataFrame:
    try:
        return pl.read_parquet(io.BytesIO(content))
    except Exception as exc:
        raise ReferenceReviewPacketAdapterError(f"{label} is not valid Parquet") from exc


def _read_descriptor(
    base: Path,
    descriptor: Any,
    label: str,
) -> tuple[Path, bytes]:
    _validate_descriptor(descriptor, label)
    path = Path(str(descriptor["path"]))
    if not path.is_absolute():
        path = (base / path).resolve()
    content = _read_bytes(path, label)
    _validate_content_binding(content, descriptor, label)
    return path, content


def _validate_descriptor(descriptor: Any, label: str) -> None:
    if not isinstance(descriptor, Mapping) or set(descriptor) != {
        "path",
        "sha256",
        "byte_count",
    }:
        raise ReferenceReviewPacketAdapterError(f"{label} descriptor is malformed")
    if not isinstance(descriptor["path"], str) or not descriptor["path"].strip():
        raise ReferenceReviewPacketAdapterError(f"{label} path is invalid")
    if not isinstance(descriptor["sha256"], str) or _SHA256.fullmatch(
        descriptor["sha256"]
    ) is None:
        raise ReferenceReviewPacketAdapterError(f"{label} SHA-256 is invalid")
    if (
        isinstance(descriptor["byte_count"], bool)
        or not isinstance(descriptor["byte_count"], int)
        or descriptor["byte_count"] < 1
    ):
        raise ReferenceReviewPacketAdapterError(f"{label} byte count is invalid")


def _validate_report_artifact_record(record: Any, label: str) -> None:
    if not isinstance(record, Mapping):
        raise ReferenceReviewPacketAdapterError(
            f"review export artifact record is malformed: {label}"
        )
    if record.get("committed") is not True or not isinstance(record.get("uri"), str):
        raise ReferenceReviewPacketAdapterError(
            f"review export artifact record is uncommitted: {label}"
        )
    if not isinstance(record.get("sha256"), str) or _SHA256.fullmatch(
        record["sha256"]
    ) is None:
        raise ReferenceReviewPacketAdapterError(
            f"review export artifact digest is invalid: {label}"
        )
    if (
        isinstance(record.get("byte_count"), bool)
        or not isinstance(record.get("byte_count"), int)
        or record["byte_count"] < 0
    ):
        raise ReferenceReviewPacketAdapterError(
            f"review export artifact byte count is invalid: {label}"
        )


def _validate_content_binding(content: bytes, record: Mapping[str, Any], label: str) -> None:
    if (
        len(content) != record["byte_count"]
        or "sha256:" + hashlib.sha256(content).hexdigest() != record["sha256"]
    ):
        raise ReferenceReviewPacketAdapterError(f"{label} content binding changed")


def _json_object(content: bytes, label: str) -> dict[str, Any]:
    try:
        payload = json.loads(content)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ReferenceReviewPacketAdapterError(f"{label} is not valid JSON") from exc
    if not isinstance(payload, dict):
        raise ReferenceReviewPacketAdapterError(f"{label} must be a JSON object")
    return payload


def _read_bytes(path: Path, label: str) -> bytes:
    try:
        return path.read_bytes()
    except FileNotFoundError as exc:
        raise ReferenceReviewPacketAdapterError(f"{label} not found: {path}") from exc


def _required_text(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value or value != value.strip():
        raise ReferenceReviewPacketAdapterError(f"{label} is missing or noncanonical")
    return value


def _require_git_sha(value: str, label: str) -> None:
    if not is_full_git_sha(value):
        raise ReferenceReviewPacketAdapterError(
            f"{label} must be a full 40-character hexadecimal SHA"
        )


__all__ = [
    "REFERENCE_REVIEW_ADAPTER_VERSION",
    "REFERENCE_REVIEW_SOURCE_MANIFEST_VERSION",
    "ReferenceReviewPacketAdapterError",
    "adapt_reference_review_packet",
]
