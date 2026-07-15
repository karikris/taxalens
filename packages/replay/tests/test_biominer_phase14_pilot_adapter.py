from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path

import pytest
from packages.replay.src.biominer_phase14_pilot_adapter import (
    DEFAULT_IMPORT_MANIFEST,
    PILOT_METADATA_ADAPTER_SCHEMA_VERSION,
    SECTION_NAMES,
    Phase14PilotAdapterError,
    adapt_current_pilot_metadata,
)

BIOMINER_SHA = "75461d9c065af0cd96b41cd1f845c2e920f7ae34"
REQUIRED_SEMANTIC_FIELDS = {
    "candidate_semantics",
    "verification_status",
    "human_review_required",
    "scientific_claim_allowed",
}


def _copy_import(tmp_path: Path) -> Path:
    destination = tmp_path / "biominer_phase14"
    shutil.copytree(DEFAULT_IMPORT_MANIFEST.parent, destination)
    return destination / "import_manifest.json"


def test_adapts_real_committed_phase14_metadata() -> None:
    result = adapt_current_pilot_metadata()

    assert result["schema_version"] == PILOT_METADATA_ADAPTER_SCHEMA_VERSION
    assert result["origin_commit"] == BIOMINER_SHA
    assert result["target"] == {
        "accepted_taxon_key": "gbif:1938069",
        "scientific_name": "Papilio demoleus",
    }
    assert result["metadata_only"] is True
    assert result["scientific_results_available"] is False
    assert result["contract_count"] == 11
    assert tuple(result["contracts"]) == SECTION_NAMES

    contracts = result["contracts"]
    workload = contracts["geographic_workload"]["data"]
    assert workload["counts"]["query_hit_count"] == 76_485
    assert workload["counts"]["canonical_photo_count"] == 13_501
    assert workload["counts"]["located_cluster_count"] == 76
    assert workload["counts"]["allocated_target_reference_quota"] == 100

    query_hits = contracts["query_hit_metrics"]["data"]
    assert query_hits["source"]["input_row_count"] == query_hits["query_hit_count"]
    assert query_hits["query_hit_artifact"]["sha256"].startswith("sha256:")

    range_evidence = contracts["target_range_evidence"]["data"]
    assert range_evidence["region_count"] == 8
    assert range_evidence["country_count"] == 40
    assert range_evidence["region_counts_by_status"]["taxonomically_cautionary"] == 1

    competitors = contracts["regional_competitors"]["data"]
    assert competitors["candidate_count"] == 5
    assert [row["scientific_name"] for row in competitors["candidates"]] == [
        "Papilio memnon",
        "Papilio polytes",
        "Papilio helenus",
        "Papilio paris",
        "Papilio machaon",
    ]

    source_registry = contracts["trust_first_reference_plan"]["data"]["source_registry"]
    assert source_registry == {
        "registry_name": "BioMiner butterflies registry",
        "registry_version": "butterflies-v2-20260712",
        "source_snapshot_version": "gbif-reference-search-20260715",
        "accepted_identity_namespace": "gbif",
    }

    source_counts = contracts["source_media_counts"]["data"]["counts"]
    assert source_counts["media_candidate_count"] == 142_873
    assert source_counts["eligible_source_media_candidate_count"] == 838
    assert source_counts["human_verified_source_media_count"] == 0

    shortfalls = contracts["reference_shortfalls"]["data"]
    assert shortfalls["source_candidate_shortfall"] == 247
    assert shortfalls["human_verified_shortfall"] == 490


def test_every_contract_has_required_semantics_and_forbids_scientific_claims() -> None:
    result = adapt_current_pilot_metadata()

    for contract in result["contracts"].values():
        assert REQUIRED_SEMANTIC_FIELDS <= set(contract)
        assert contract["candidate_semantics"]
        assert contract["verification_status"]
        assert isinstance(contract["human_review_required"], bool)
        assert contract["scientific_claim_allowed"] is False


def test_cluster_contract_exposes_summary_not_uncommitted_payload() -> None:
    clusters = adapt_current_pilot_metadata()["contracts"]["candidate_clusters"]

    assert clusters["verification_status"] == "summary_verified_payload_not_imported"
    assert clusters["data"]["located_cluster_count"] == 76
    assert clusters["data"]["payload_rows_available"] is False
    assert clusters["scientific_claim_allowed"] is False


def test_negative_contracts_preserve_unresolved_human_work() -> None:
    contracts = adapt_current_pilot_metadata()["contracts"]
    biological = contracts["biological_negatives"]
    visual = contracts["visual_domain_negatives"]

    assert biological["data"]["reviewed_false_winner_relationship_count"] == 5
    assert biological["data"]["all_groups_resolved"] is False
    assert biological["data"]["groups"]["other_insect_or_moth_negatives"]["status"] == (
        "unresolved_requires_registry_linked_taxa"
    )
    assert visual["data"]["classes"] == [
        "illustration",
        "pinned_specimen",
        "garden_scene",
        "fruit_or_flower_closeup",
        "clutter",
    ]
    assert visual["data"]["status"] == "unresolved_requires_human_review"
    assert visual["data"]["selected_media_count"] == 0
    assert visual["data"]["selection_artifact_available"] is False


def test_handoff_contract_verifies_exact_imported_bytes_without_large_payloads() -> None:
    handoff = adapt_current_pilot_metadata()["contracts"]["handoff_fingerprints"]

    assert handoff["verification_status"] == "content_and_cross_references_verified"
    assert handoff["human_review_required"] is False
    assert handoff["data"]["origin_commit"] == BIOMINER_SHA
    assert len(handoff["data"]["imported_files"]) == 7
    assert all(row["checksum_verified"] is True for row in handoff["data"]["imported_files"])
    assert handoff["data"]["large_payloads_imported"] is False


def test_rejects_tampered_imported_source(tmp_path: Path) -> None:
    manifest_path = _copy_import(tmp_path)
    source_path = manifest_path.parent / "pilot_geographic_workload_manifest.json"
    source_path.write_text(source_path.read_text(encoding="utf-8") + "\n", encoding="utf-8")

    with pytest.raises(Phase14PilotAdapterError, match="SHA-256"):
        adapt_current_pilot_metadata(manifest_path)


def test_rejects_unsafe_import_path(tmp_path: Path) -> None:
    manifest_path = _copy_import(tmp_path)
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    payload["files"][0]["imported_path"] = "../escape.json"
    manifest_path.write_text(json.dumps(payload), encoding="utf-8")

    with pytest.raises(Phase14PilotAdapterError, match="unsafe compact import path"):
        adapt_current_pilot_metadata(manifest_path)


def test_rejects_cross_file_fingerprint_mismatch(tmp_path: Path) -> None:
    manifest_path = _copy_import(tmp_path)
    reference_path = manifest_path.parent / "pilot_reference_source_manifest.json"
    reference = json.loads(reference_path.read_text(encoding="utf-8"))
    reference["source_plan"]["sha256"] = "sha256:" + "0" * 64
    reference_path.write_text(json.dumps(reference, separators=(",", ":")), encoding="utf-8")

    import_payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    imported = next(
        row for row in import_payload["files"] if row["role"] == "reference_source_manifest"
    )
    content = reference_path.read_bytes()

    imported["byte_count"] = len(content)
    imported["sha256"] = hashlib.sha256(content).hexdigest()
    manifest_path.write_text(json.dumps(import_payload), encoding="utf-8")

    with pytest.raises(Phase14PilotAdapterError, match="source plan SHA-256"):
        adapt_current_pilot_metadata(manifest_path)


def test_rejects_mixed_source_registry_versions(tmp_path: Path) -> None:
    manifest_path = _copy_import(tmp_path)
    settings_path = manifest_path.parent / "papilio_demoleus_geographic_workload.json"
    settings = json.loads(settings_path.read_text(encoding="utf-8"))
    settings["commands"]["fetch-metadata"]["registry_version"] = "different-registry-v1"
    settings_path.write_text(json.dumps(settings, separators=(",", ":")), encoding="utf-8")

    import_payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    imported = next(
        row for row in import_payload["files"] if row["role"] == "geographic_workload_settings"
    )
    content = settings_path.read_bytes()
    imported["byte_count"] = len(content)
    imported["sha256"] = hashlib.sha256(content).hexdigest()
    manifest_path.write_text(json.dumps(import_payload), encoding="utf-8")

    with pytest.raises(Phase14PilotAdapterError, match="registry versions differ"):
        adapt_current_pilot_metadata(manifest_path)


@pytest.mark.parametrize(
    "field,value,match",
    [
        ("origin_commit", "short", "full Git SHA"),
        ("origin_repository", "someone/else", "origin repository"),
        ("schema_version", "future-import-v2", "unsupported"),
    ],
)
def test_rejects_untrusted_import_identity(
    tmp_path: Path,
    field: str,
    value: object,
    match: str,
) -> None:
    manifest_path = _copy_import(tmp_path)
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    payload[field] = value
    manifest_path.write_text(json.dumps(payload), encoding="utf-8")

    with pytest.raises(Phase14PilotAdapterError, match=match):
        adapt_current_pilot_metadata(manifest_path)
