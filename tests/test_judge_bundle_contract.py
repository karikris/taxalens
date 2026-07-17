from __future__ import annotations

import hashlib
import json
from copy import deepcopy
from dataclasses import FrozenInstanceError
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator
from taxalens.product import (
    BASELINE_OCCURRENCE_UNION_SCHEMA_VERSION,
    COUNTRY_HIERARCHY_SCHEMA_VERSION,
    GEOGRAPHIC_IMPACT_MANIFEST_SCHEMA_VERSION,
    JUDGE_BUNDLE_GEOGRAPHIC_SECTION_NAMES,
    JUDGE_BUNDLE_SCHEMA_VERSION,
    JUDGE_BUNDLE_SECTION_NAMES,
    JUDGE_BUNDLE_V1_SCHEMA_VERSION,
    JUDGE_BUNDLE_V1_SECTION_NAMES,
    JUDGE_BUNDLE_V2_SCHEMA_VERSION,
    JUDGE_BUNDLE_V2_SECTION_NAMES,
    JudgeBundleError,
    compute_inventory_sha256,
    compute_payload_root_sha256,
    load_judge_bundle,
    migrate_judge_bundle_v1_to_v2,
    validate_judge_bundle,
)

TAXALENS_SHA = "1" * 40
BIOMINER_SHA = "2" * 40
SCHEMA_PATH = Path("packages/contracts/schema/judge_bundle.schema.json")
V1_SCHEMA_PATH = Path("packages/contracts/schema/judge_bundle_v1.schema.json")
GEOGRAPHIC_SECTIONS_SCHEMA_PATH = Path(
    "packages/contracts/schema/judge_bundle_geographic_sections.schema.json"
)
GEOGRAPHIC_FIXTURE_PATH = Path("packages/contracts/fixtures/geographic_contract_cases.json")
TYPESCRIPT_PATH = Path("packages/contracts/src/judge_bundle_contract.ts")
TRUTHFUL_FIXTURE_PATH = Path("demo/fixture/papilio_pilot/judge_bundle.json")


def _artifact(
    root: Path,
    *,
    artifact_id: str,
    relative_path: str,
    role: str,
    payload: object,
) -> dict[str, object]:
    content = (
        json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n"
    ).encode()
    path = root / relative_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)
    record_count = len(payload) if isinstance(payload, list) else 1
    return {
        "artifact_id": artifact_id,
        "path": relative_path,
        "media_type": "application/json",
        "role": role,
        "sha256": hashlib.sha256(content).hexdigest(),
        "bytes": len(content),
        "record_count": record_count,
        "schema_version": f"{role}:v1",
        "source_repository": "karikris/BioMiner",
        "source_commit": BIOMINER_SHA,
        "required": True,
    }


def _available(artifact_id: str) -> dict[str, object]:
    return {
        "status": "available",
        "artifact_ids": [artifact_id],
        "reason": None,
        "candidate_semantics": "not_applicable",
        "verification_status": "machine_verified_contract",
        "human_review_required": True,
        "scientific_claim_allowed": False,
    }


def _unavailable(name: str) -> dict[str, object]:
    candidate_reference = {
        "candidate_sets",
        "reference_readiness",
        "reference_shortfalls",
        "biological_negatives",
        "visual_domain_negatives",
    }
    hypotheses = {
        "query_definitions",
        "logical_associations",
        "flickr_candidate_summaries",
        "duplicate_summaries",
        "geographic_clusters",
    }
    semantics = "not_applicable"
    if name in candidate_reference:
        semantics = "candidate_reference_not_verified_support"
    elif name in hypotheses:
        semantics = "hypothesis_not_occurrence"
    elif name in {
        "yoloe_evidence",
        "full_frame_visual_input_metadata",
        "target_aware_score_metadata",
        "selective_decision_metadata",
    }:
        semantics = "diagnostic_only"
    return {
        "status": "unavailable",
        "artifact_ids": [],
        "reason": f"{name} has not been imported into this contract fixture",
        "candidate_semantics": semantics,
        "verification_status": "unavailable",
        "human_review_required": True,
        "scientific_claim_allowed": False,
    }


def _bundle(root: Path) -> dict[str, object]:
    inventory = [
        _artifact(
            root,
            artifact_id="run-summary",
            relative_path="data/run_summary.json",
            role="run_summary",
            payload={"run_id": "judge-run-1"},
        ),
        _artifact(
            root,
            artifact_id="pipeline-stages",
            relative_path="data/pipeline_stages.json",
            role="pipeline_stages",
            payload=[{"stage_id": "ingest"}, {"stage_id": "score"}],
        ),
        _artifact(
            root,
            artifact_id="stage-metrics",
            relative_path="data/stage_metrics.json",
            role="stage_metrics",
            payload=[{"stage_id": "ingest"}, {"stage_id": "score"}],
        ),
    ]
    sections = {name: _unavailable(name) for name in JUDGE_BUNDLE_SECTION_NAMES}
    sections["run_summary"] = _available("run-summary")
    sections["pipeline_stages"] = _available("pipeline-stages")
    sections["stage_metrics"] = _available("stage-metrics")
    section_records = {name: 0 for name in JUDGE_BUNDLE_SECTION_NAMES}
    section_records.update({"run_summary": 1, "pipeline_stages": 2, "stage_metrics": 2})
    bundle: dict[str, object] = {
        "schema_version": JUDGE_BUNDLE_SCHEMA_VERSION,
        "bundle_id": "judge-contract-test-v1",
        "title": "TaxaLens judge contract test",
        "created_at": "2026-07-15T14:00:00Z",
        "target": {
            "accepted_taxon_key": "taxon-1",
            "scientific_name": "Papilio example",
            "rank": "species",
        },
        "source_revisions": {
            "taxalens_sha": TAXALENS_SHA,
            "biominer_sha": BIOMINER_SHA,
        },
        "artifact_inventory": inventory,
        "sections": sections,
        "rights": {
            "status": "fixture_only",
            "all_artifacts_covered": True,
            "all_media_rights_verified": False,
            "items": [
                {
                    "rights_id": "fixture-rights",
                    "artifact_ids": [
                        "run-summary",
                        "pipeline-stages",
                        "stage-metrics",
                    ],
                    "status": "fixture_only",
                    "license_name": "CC0-1.0",
                    "license_uri": "https://creativecommons.org/publicdomain/zero/1.0/",
                    "creator_or_owner": "TaxaLens",
                    "source_url": None,
                    "use_scope": "contract tests only",
                    "attribution_required": False,
                    "notes": ["No biological evidence is present."],
                }
            ],
        },
        "attribution": {"complete": True, "entries": []},
        "openai_replay": {
            "status": "not_used",
            "mode": "not_used",
            "credentials_required": False,
            "live_requests_allowed": False,
            "reason": "No OpenAI operation is represented in this contract fixture.",
            "traces": [],
        },
        "expected_ui_counts": {
            "section_records": section_records,
            "screen_items": {
                "research_mission": 1,
                "evidence_observatory": 2,
                "evidence_lens": 0,
                "butterfly_dashboard": 0,
            },
            "artifact_count": 3,
            "attribution_count": 0,
            "openai_replay_trace_count": 0,
            "unavailable_section_count": len(JUDGE_BUNDLE_SECTION_NAMES) - 3,
        },
        "checksums": {
            "algorithm": "sha256",
            "canonicalization": "json-sorted-keys-utf8-v1",
            "inventory_sha256": compute_inventory_sha256(inventory),
            "payload_root_sha256": compute_payload_root_sha256(inventory),
        },
    }
    return bundle


def _geographic_bundle(root: Path) -> tuple[dict[str, object], dict[str, object]]:
    bundle = _bundle(root)
    fixtures = json.loads(GEOGRAPHIC_FIXTURE_PATH.read_text(encoding="utf-8"))
    manifest = deepcopy(fixtures["positive"]["geographic_impact_manifest"])
    hierarchy = deepcopy(fixtures["positive"]["country_hierarchy"])
    manifest.update(
        {
            "accepted_taxon_key": "taxon-1",
            "scientific_name": "Papilio example",
            "source_commits": [
                {"repository": "karikris/taxalens", "commit_sha": TAXALENS_SHA},
                {"repository": "karikris/BioMiner", "commit_sha": BIOMINER_SHA},
            ],
        }
    )
    role_by_logical_name = {
        "baseline_geographic_spread": "baseline_geographic_spread",
        "baseline_occurrence_union": "baseline_provider_union",
        "flickr_geography": "flickr_geography",
        "verification_consensus": "verification_decisions",
        "quality_snapshot": "verification_quality",
        "release_decisions": "verification_quality",
        "geographic_impact_cells": "geographic_impact_cells",
        "geographic_impact_summary": "geographic_impact_summary",
        "country_hierarchy": "country_hierarchy",
    }
    schema_by_logical_name = {
        "baseline_occurrence_union": BASELINE_OCCURRENCE_UNION_SCHEMA_VERSION,
        "country_hierarchy": COUNTRY_HIERARCHY_SCHEMA_VERSION,
    }
    geographic_descriptors: list[dict[str, object]] = []
    for entry in manifest["artifacts"]:
        logical_name = entry["logical_name"]
        row_count = entry["row_count"]
        payload = (
            hierarchy
            if logical_name == "country_hierarchy"
            else [{"row": index, "logical_name": logical_name} for index in range(row_count)]
        )
        descriptor = _artifact(
            root,
            artifact_id=f"geo-{logical_name.replace('_', '-')}",
            relative_path=f"geographic/{logical_name}.json",
            role=role_by_logical_name[logical_name],
            payload=payload,
        )
        repository = entry["source_repository"]
        descriptor.update(
            {
                "record_count": row_count,
                "schema_version": schema_by_logical_name.get(logical_name, entry["schema_version"]),
                "source_repository": repository,
                "source_commit": (
                    TAXALENS_SHA if str(repository).lower() == "karikris/taxalens" else BIOMINER_SHA
                ),
            }
        )
        entry.update(
            {
                "path": descriptor["path"],
                "media_type": descriptor["media_type"],
                "schema_version": descriptor["schema_version"],
                "sha256": descriptor["sha256"],
                "byte_size": descriptor["bytes"],
                "row_count": descriptor["record_count"],
                "source_commit": descriptor["source_commit"],
            }
        )
        if logical_name == "release_decisions":
            entry["snapshot_id"] = manifest["release_policy_version"]
        geographic_descriptors.append(descriptor)

    manifest_descriptor = _artifact(
        root,
        artifact_id="geographic-impact-manifest",
        relative_path="geographic/geographic_impact_manifest.json",
        role="geographic_impact_manifest",
        payload=manifest,
    )
    manifest_descriptor.update(
        {
            "schema_version": GEOGRAPHIC_IMPACT_MANIFEST_SCHEMA_VERSION,
            "source_repository": "karikris/taxalens",
            "source_commit": TAXALENS_SHA,
        }
    )
    inventory = bundle["artifact_inventory"]
    assert isinstance(inventory, list)
    inventory.extend([*geographic_descriptors, manifest_descriptor])

    sections = bundle["sections"]
    expected = bundle["expected_ui_counts"]
    assert isinstance(sections, dict) and isinstance(expected, dict)
    section_records = expected["section_records"]
    assert isinstance(section_records, dict)
    ids_by_role: dict[str, list[str]] = {}
    for descriptor in geographic_descriptors:
        role = str(descriptor["role"])
        ids_by_role.setdefault(role, []).append(str(descriptor["artifact_id"]))
    descriptors_by_id = {
        str(descriptor["artifact_id"]): descriptor for descriptor in geographic_descriptors
    }
    for role, artifact_ids in ids_by_role.items():
        section = _available(artifact_ids[0])
        section["artifact_ids"] = artifact_ids
        sections[role] = section
        section_records[role] = sum(
            int(descriptors_by_id[artifact_id]["record_count"]) for artifact_id in artifact_ids
        )

    rights = bundle["rights"]
    assert isinstance(rights, dict)
    rights_items = rights["items"]
    assert isinstance(rights_items, list)
    rights_items[0]["artifact_ids"] = [item["artifact_id"] for item in inventory]
    expected["artifact_count"] = len(inventory)
    expected["unavailable_section_count"] = sum(
        section["status"] == "unavailable" for section in sections.values()
    )
    _refresh_bundle_checksums(bundle)
    return bundle, manifest


def _refresh_bundle_checksums(bundle: dict[str, object]) -> None:
    inventory = bundle["artifact_inventory"]
    checksums = bundle["checksums"]
    assert isinstance(inventory, list) and isinstance(checksums, dict)
    checksums["inventory_sha256"] = compute_inventory_sha256(inventory)
    checksums["payload_root_sha256"] = compute_payload_root_sha256(inventory)


def _rewrite_manifest(
    root: Path,
    bundle: dict[str, object],
    manifest: dict[str, object],
) -> None:
    inventory = bundle["artifact_inventory"]
    assert isinstance(inventory, list)
    descriptor = next(
        item for item in inventory if item["artifact_id"] == "geographic-impact-manifest"
    )
    content = (
        json.dumps(manifest, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n"
    ).encode()
    (root / descriptor["path"]).write_bytes(content)
    descriptor["bytes"] = len(content)
    descriptor["sha256"] = hashlib.sha256(content).hexdigest()
    _refresh_bundle_checksums(bundle)


def _set_manifest_artifact_row_count(
    root: Path,
    bundle: dict[str, object],
    manifest: dict[str, object],
    logical_name: str,
    row_count: int,
) -> None:
    entry = next(item for item in manifest["artifacts"] if item["logical_name"] == logical_name)
    entry["row_count"] = row_count
    inventory = bundle["artifact_inventory"]
    expected = bundle["expected_ui_counts"]
    assert isinstance(inventory, list) and isinstance(expected, dict)
    descriptor = next(item for item in inventory if item["path"] == entry["path"])
    descriptor["record_count"] = row_count
    section_records = expected["section_records"]
    assert isinstance(section_records, dict)
    role = descriptor["role"]
    section_records[role] = sum(
        int(item["record_count"])
        for item in inventory
        if item["role"] == role and item["record_count"] is not None
    )
    _rewrite_manifest(root, bundle, manifest)


def _project_v1_fixture_to_v2_shape() -> dict[str, object]:
    bundle = json.loads(TRUTHFUL_FIXTURE_PATH.read_text(encoding="utf-8"))
    return migrate_judge_bundle_v1_to_v2(bundle).data


def test_schema_declares_every_required_judge_bundle_section() -> None:
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    v1_schema = json.loads(V1_SCHEMA_PATH.read_text(encoding="utf-8"))
    typescript = TYPESCRIPT_PATH.read_text(encoding="utf-8")

    Draft202012Validator.check_schema(schema)
    Draft202012Validator.check_schema(v1_schema)
    assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    assert JUDGE_BUNDLE_SCHEMA_VERSION == JUDGE_BUNDLE_V2_SCHEMA_VERSION
    assert schema["properties"]["schema_version"]["const"] == (JUDGE_BUNDLE_V2_SCHEMA_VERSION)
    assert v1_schema["properties"]["schema_version"]["const"] == (JUDGE_BUNDLE_V1_SCHEMA_VERSION)
    assert set(schema["$defs"]["sections"]["required"]) == set(JUDGE_BUNDLE_SECTION_NAMES)
    assert set(schema["$defs"]["sectionRecords"]["required"]) == set(JUDGE_BUNDLE_SECTION_NAMES)
    assert set(v1_schema["$defs"]["sections"]["required"]) == set(JUDGE_BUNDLE_V1_SECTION_NAMES)
    for section_name in JUDGE_BUNDLE_SECTION_NAMES:
        assert f"'{section_name}'," in typescript


def test_geographic_extension_preserves_v1_and_reserves_v2_sections() -> None:
    expected_geographic = (
        "baseline_geographic_spread",
        "baseline_provider_union",
        "flickr_geography",
        "geographic_impact_cells",
        "geographic_impact_summary",
        "country_hierarchy",
    )
    schema = json.loads(GEOGRAPHIC_SECTIONS_SCHEMA_PATH.read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    projection = {
        "schema_version": "taxalens-judge-bundle-geographic-sections:v1.0.0",
        "sections": {
            name: {
                "status": "unavailable",
                "artifact_ids": [],
                "reason": f"{name} is not present in the v1 bundle",
                "candidate_semantics": "not_applicable",
                "verification_status": "unavailable",
                "human_review_required": True,
                "scientific_claim_allowed": False,
            }
            for name in expected_geographic
        },
    }

    assert JUDGE_BUNDLE_SECTION_NAMES == JUDGE_BUNDLE_V2_SECTION_NAMES
    assert JUDGE_BUNDLE_GEOGRAPHIC_SECTION_NAMES == expected_geographic
    assert JUDGE_BUNDLE_V2_SECTION_NAMES == (
        *JUDGE_BUNDLE_V1_SECTION_NAMES,
        *expected_geographic,
    )
    assert len(JUDGE_BUNDLE_V2_SECTION_NAMES) == len(set(JUDGE_BUNDLE_V2_SECTION_NAMES))
    assert tuple(schema["$defs"]["geographicSections"]["required"]) == (expected_geographic)
    assert list(Draft202012Validator(schema).iter_errors(projection)) == []


def test_contract_validates_inventory_sections_rights_counts_and_files(
    tmp_path: Path,
) -> None:
    bundle = _bundle(tmp_path)

    result = validate_judge_bundle(
        bundle,
        bundle_root=tmp_path,
        verify_files=True,
    )

    assert result.bundle_id == "judge-contract-test-v1"
    assert result.artifact_count == 3
    assert result.section_count == len(JUDGE_BUNDLE_V2_SECTION_NAMES)
    assert result.unavailable_section_count == len(JUDGE_BUNDLE_V2_SECTION_NAMES) - 3
    assert result.files_verified is True


def test_loading_returns_an_immutable_strict_json_contract(tmp_path: Path) -> None:
    bundle = _bundle(tmp_path)
    manifest = tmp_path / "judge_bundle.json"
    manifest.write_text(json.dumps(bundle, sort_keys=True), encoding="utf-8")

    loaded = load_judge_bundle(manifest)

    assert loaded.validation.files_verified is True
    assert loaded.data["bundle_id"] == "judge-contract-test-v1"
    assert loaded.source_schema_version == JUDGE_BUNDLE_V2_SCHEMA_VERSION
    assert loaded.migration_receipt is None
    with pytest.raises(FrozenInstanceError):
        loaded.manifest_path = Path("changed")  # type: ignore[misc]
    with pytest.raises(TypeError):
        loaded.data["bundle_id"] = "changed"  # type: ignore[index]


def test_v2_geographic_bundle_reconciles_manifest_inventory_and_hierarchy(
    tmp_path: Path,
) -> None:
    bundle, _ = _geographic_bundle(tmp_path)
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))

    result = validate_judge_bundle(
        bundle,
        bundle_root=tmp_path,
        verify_files=True,
    )

    assert result.artifact_count == 13
    assert result.section_count == len(JUDGE_BUNDLE_V2_SECTION_NAMES)
    assert result.files_verified is True
    assert list(Draft202012Validator(schema, format_checker=None).iter_errors(bundle)) == []


def test_available_geography_requires_verified_manifest_payload(tmp_path: Path) -> None:
    bundle, _ = _geographic_bundle(tmp_path)

    with pytest.raises(JudgeBundleError, match="require verify_files=true"):
        validate_judge_bundle(bundle, verify_files=False)

    inventory = bundle["artifact_inventory"]
    rights = bundle["rights"]
    expected = bundle["expected_ui_counts"]
    assert isinstance(inventory, list) and isinstance(rights, dict) and isinstance(expected, dict)
    inventory[:] = [
        item for item in inventory if item["artifact_id"] != "geographic-impact-manifest"
    ]
    rights["items"][0]["artifact_ids"] = [item["artifact_id"] for item in inventory]
    expected["artifact_count"] = len(inventory)
    _refresh_bundle_checksums(bundle)
    with pytest.raises(JudgeBundleError, match="exactly one geographic impact manifest"):
        validate_judge_bundle(bundle, bundle_root=tmp_path, verify_files=True)


def test_geographic_manifest_requires_complete_identity(tmp_path: Path) -> None:
    bundle, manifest = _geographic_bundle(tmp_path)
    del manifest["project_id"]
    _rewrite_manifest(tmp_path, bundle, manifest)

    with pytest.raises(JudgeBundleError, match="geographic schema validation"):
        validate_judge_bundle(bundle, bundle_root=tmp_path, verify_files=True)


def test_provider_union_requires_deduplication_provenance(tmp_path: Path) -> None:
    bundle, manifest = _geographic_bundle(tmp_path)
    provider_union = next(
        item
        for item in manifest["artifacts"]
        if item["logical_name"] == "baseline_occurrence_union"
    )
    provider_union["schema_version"] = "baseline-occurrence-union:unknown"
    inventory = bundle["artifact_inventory"]
    assert isinstance(inventory, list)
    descriptor = next(item for item in inventory if item["path"] == provider_union["path"])
    descriptor["schema_version"] = provider_union["schema_version"]
    _rewrite_manifest(tmp_path, bundle, manifest)

    with pytest.raises(JudgeBundleError, match="lacks deduplication provenance"):
        validate_judge_bundle(bundle, bundle_root=tmp_path, verify_files=True)


def test_geographic_impact_counts_must_reconcile_to_artifacts(tmp_path: Path) -> None:
    bundle, manifest = _geographic_bundle(tmp_path)
    manifest["impact_cell_count"] = 4
    _rewrite_manifest(tmp_path, bundle, manifest)

    with pytest.raises(JudgeBundleError, match="artifact_count_reconciliation"):
        validate_judge_bundle(bundle, bundle_root=tmp_path, verify_files=True)


def test_country_hierarchy_identity_must_match_impact_manifest(tmp_path: Path) -> None:
    bundle, manifest = _geographic_bundle(tmp_path)
    fixtures = json.loads(GEOGRAPHIC_FIXTURE_PATH.read_text(encoding="utf-8"))
    hierarchy = deepcopy(fixtures["positive"]["country_hierarchy"])
    hierarchy["country_hierarchy_id"] = "country-hierarchy:different"
    content = (
        json.dumps(hierarchy, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n"
    ).encode()
    entry = next(
        item for item in manifest["artifacts"] if item["logical_name"] == "country_hierarchy"
    )
    inventory = bundle["artifact_inventory"]
    assert isinstance(inventory, list)
    descriptor = next(item for item in inventory if item["path"] == entry["path"])
    (tmp_path / descriptor["path"]).write_bytes(content)
    descriptor["bytes"] = entry["byte_size"] = len(content)
    descriptor["sha256"] = entry["sha256"] = hashlib.sha256(content).hexdigest()
    _rewrite_manifest(tmp_path, bundle, manifest)

    with pytest.raises(JudgeBundleError, match="hierarchy identity or node count mismatch"):
        validate_judge_bundle(bundle, bundle_root=tmp_path, verify_files=True)


def test_reviewed_contribution_requires_review_and_quality_evidence(tmp_path: Path) -> None:
    bundle, manifest = _geographic_bundle(tmp_path)
    _set_manifest_artifact_row_count(
        tmp_path,
        bundle,
        manifest,
        "verification_consensus",
        0,
    )

    with pytest.raises(JudgeBundleError, match="lacks review evidence"):
        validate_judge_bundle(bundle, bundle_root=tmp_path, verify_files=True)


def test_release_ready_contribution_requires_release_gate_evidence(tmp_path: Path) -> None:
    bundle, manifest = _geographic_bundle(tmp_path)
    _set_manifest_artifact_row_count(
        tmp_path,
        bundle,
        manifest,
        "release_decisions",
        1,
    )
    release = next(
        item for item in manifest["artifacts"] if item["logical_name"] == "release_decisions"
    )
    release["snapshot_id"] = None
    manifest["release_ready_count"] = 1
    manifest["release_ready_additional_cell_count"] = 1
    _rewrite_manifest(tmp_path, bundle, manifest)

    with pytest.raises(JudgeBundleError, match="lacks release-gate evidence"):
        validate_judge_bundle(bundle, bundle_root=tmp_path, verify_files=True)


def test_v1_migration_preserves_evidence_and_adds_only_unavailable_geography() -> None:
    source = json.loads(TRUTHFUL_FIXTURE_PATH.read_text(encoding="utf-8"))
    source_before = json.loads(json.dumps(source))

    migrated = migrate_judge_bundle_v1_to_v2(source)

    assert source == source_before
    assert migrated.data["schema_version"] == JUDGE_BUNDLE_V2_SCHEMA_VERSION
    assert migrated.validation.section_count == len(JUDGE_BUNDLE_V2_SECTION_NAMES)
    assert migrated.validation.unavailable_section_count == 14
    assert migrated.receipt.source_schema_version == JUDGE_BUNDLE_V1_SCHEMA_VERSION
    assert migrated.receipt.target_schema_version == JUDGE_BUNDLE_V2_SCHEMA_VERSION
    assert migrated.receipt.applied is True
    assert migrated.receipt.stored_files_rewritten is False
    assert migrated.receipt.added_sections == JUDGE_BUNDLE_GEOGRAPHIC_SECTION_NAMES
    assert len(migrated.receipt.preserved_v1_fingerprint_sha256) == 64

    for field in (
        "bundle_id",
        "title",
        "created_at",
        "target",
        "source_revisions",
        "artifact_inventory",
        "rights",
        "attribution",
        "openai_replay",
        "checksums",
    ):
        assert migrated.data[field] == source[field]
    for name in JUDGE_BUNDLE_V1_SECTION_NAMES:
        assert migrated.data["sections"][name] == source["sections"][name]
        assert (
            migrated.data["expected_ui_counts"]["section_records"][name]
            == source["expected_ui_counts"]["section_records"][name]
        )
    for name in JUDGE_BUNDLE_GEOGRAPHIC_SECTION_NAMES:
        section = migrated.data["sections"][name]
        assert section["status"] == "unavailable"
        assert section["artifact_ids"] == []
        assert section["scientific_claim_allowed"] is False
        assert "did not invent geographic evidence" in section["reason"]
        assert migrated.data["expected_ui_counts"]["section_records"][name] == 0


def test_v1_migration_rejects_invalid_source_before_projection() -> None:
    source = json.loads(TRUTHFUL_FIXTURE_PATH.read_text(encoding="utf-8"))
    del source["sections"]["run_summary"]

    with pytest.raises(JudgeBundleError, match="sections must match"):
        migrate_judge_bundle_v1_to_v2(source)


def test_loader_rejects_unknown_future_bundle_version(tmp_path: Path) -> None:
    source = json.loads(TRUTHFUL_FIXTURE_PATH.read_text(encoding="utf-8"))
    source["schema_version"] = "taxalens-judge-bundle:v99.0.0"
    manifest = tmp_path / "judge_bundle.json"
    manifest.write_text(json.dumps(source), encoding="utf-8")

    with pytest.raises(JudgeBundleError, match="unsupported judge bundle schema_version"):
        load_judge_bundle(manifest, verify_files=False)


def test_contract_rejects_missing_required_section(tmp_path: Path) -> None:
    bundle = _bundle(tmp_path)
    sections = bundle["sections"]
    assert isinstance(sections, dict)
    del sections["evaluation_summaries"]

    with pytest.raises(JudgeBundleError, match="sections must match"):
        validate_judge_bundle(bundle)


def test_contract_rejects_unknown_or_wrong_role_artifact_references(
    tmp_path: Path,
) -> None:
    unknown = _bundle(tmp_path / "unknown")
    unknown_sections = unknown["sections"]
    assert isinstance(unknown_sections, dict)
    unknown_sections["run_summary"]["artifact_ids"] = ["missing"]
    with pytest.raises(JudgeBundleError, match="unknown artifact_id"):
        validate_judge_bundle(unknown)

    wrong_role = _bundle(tmp_path / "wrong-role")
    wrong_sections = wrong_role["sections"]
    assert isinstance(wrong_sections, dict)
    wrong_sections["run_summary"]["artifact_ids"] = ["stage-metrics"]
    with pytest.raises(JudgeBundleError, match="different role"):
        validate_judge_bundle(wrong_role)


def test_unavailable_and_partial_sections_fail_closed(tmp_path: Path) -> None:
    unavailable = _bundle(tmp_path / "unavailable")
    sections = unavailable["sections"]
    assert isinstance(sections, dict)
    sections["evaluation_summaries"]["scientific_claim_allowed"] = True
    with pytest.raises(JudgeBundleError, match="forbid claims"):
        validate_judge_bundle(unavailable)

    partial = _bundle(tmp_path / "partial")
    partial_sections = partial["sections"]
    assert isinstance(partial_sections, dict)
    partial_sections["run_summary"]["status"] = "partial"
    partial_sections["run_summary"]["scientific_claim_allowed"] = True
    with pytest.raises(JudgeBundleError, match="partial section"):
        validate_judge_bundle(partial)


def test_contract_rejects_verification_relationship_gaps() -> None:
    item_without_campaign = _project_v1_fixture_to_v2_shape()
    campaign = item_without_campaign["sections"]["verification_campaigns"]
    campaign.update(
        {
            "status": "unavailable",
            "artifact_ids": [],
            "reason": "campaign removed by mutation",
            "verification_status": "unavailable",
            "human_review_required": True,
        }
    )
    with pytest.raises(JudgeBundleError, match="items cannot be displayed"):
        validate_judge_bundle(item_without_campaign)

    media_without_items = _project_v1_fixture_to_v2_shape()
    items = media_without_items["sections"]["verification_items"]
    items.update(
        {
            "status": "unavailable",
            "artifact_ids": [],
            "reason": "items removed by mutation",
            "verification_status": "unavailable",
        }
    )
    with pytest.raises(JudgeBundleError, match="media cannot be displayed"):
        validate_judge_bundle(media_without_items)

    non_image_media = _project_v1_fixture_to_v2_shape()
    artifact = next(
        row for row in non_image_media["artifact_inventory"] if row["role"] == "verification_media"
    )
    artifact["media_type"] = "application/octet-stream"
    with pytest.raises(JudgeBundleError, match="must use an image media type"):
        validate_judge_bundle(non_image_media)


def test_scientific_claim_requires_verified_rights_and_attribution(
    tmp_path: Path,
) -> None:
    bundle = _bundle(tmp_path)
    sections = bundle["sections"]
    assert isinstance(sections, dict)
    sections["run_summary"].update(
        {
            "candidate_semantics": "reviewed_evidence",
            "verification_status": "human_verified",
            "human_review_required": False,
            "scientific_claim_allowed": True,
        }
    )

    with pytest.raises(JudgeBundleError, match="rights status rights_verified"):
        validate_judge_bundle(bundle)


def test_contract_rejects_tampered_counts_and_checksum_roots(tmp_path: Path) -> None:
    counts = _bundle(tmp_path / "counts")
    expected = counts["expected_ui_counts"]
    assert isinstance(expected, dict)
    expected["artifact_count"] = 4
    with pytest.raises(JudgeBundleError, match="artifact_count"):
        validate_judge_bundle(counts)

    checksums = _bundle(tmp_path / "checksums")
    declared = checksums["checksums"]
    assert isinstance(declared, dict)
    declared["payload_root_sha256"] = "0" * 64
    with pytest.raises(JudgeBundleError, match="payload_root_sha256"):
        validate_judge_bundle(checksums)


def test_contract_rejects_unsafe_paths_and_tampered_files(tmp_path: Path) -> None:
    unsafe = _bundle(tmp_path / "unsafe")
    inventory = unsafe["artifact_inventory"]
    assert isinstance(inventory, list)
    inventory[0]["path"] = "../outside.json"
    with pytest.raises(JudgeBundleError, match="safe relative path"):
        validate_judge_bundle(unsafe)

    tampered_root = tmp_path / "tampered"
    tampered = _bundle(tampered_root)
    (tampered_root / "data/run_summary.json").write_text("tampered\n", encoding="utf-8")
    with pytest.raises(JudgeBundleError, match="byte count mismatch|checksum mismatch"):
        validate_judge_bundle(
            tampered,
            bundle_root=tampered_root,
            verify_files=True,
        )


def test_strict_loader_rejects_duplicate_keys_and_non_json_numbers(
    tmp_path: Path,
) -> None:
    duplicate = tmp_path / "duplicate.json"
    duplicate.write_text('{"bundle_id":"one","bundle_id":"two"}', encoding="utf-8")
    with pytest.raises(JudgeBundleError, match="duplicate JSON object key"):
        load_judge_bundle(duplicate, verify_files=False)

    non_json = tmp_path / "non-json.json"
    non_json.write_text('{"value":NaN}', encoding="utf-8")
    with pytest.raises(JudgeBundleError, match="non-JSON numeric constant"):
        load_judge_bundle(non_json, verify_files=False)
