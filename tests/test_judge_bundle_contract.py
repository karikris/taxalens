from __future__ import annotations

import hashlib
import json
from dataclasses import FrozenInstanceError
from pathlib import Path

import pytest
from taxalens.product import (
    JUDGE_BUNDLE_SCHEMA_VERSION,
    JUDGE_BUNDLE_SECTION_NAMES,
    JudgeBundleError,
    compute_inventory_sha256,
    compute_payload_root_sha256,
    load_judge_bundle,
    validate_judge_bundle,
)

TAXALENS_SHA = "1" * 40
BIOMINER_SHA = "2" * 40
SCHEMA_PATH = Path("packages/contracts/schema/judge_bundle.schema.json")
TYPESCRIPT_PATH = Path("packages/contracts/src/judge_bundle_contract.ts")


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


def test_schema_declares_every_required_judge_bundle_section() -> None:
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    typescript = TYPESCRIPT_PATH.read_text(encoding="utf-8")

    assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    assert schema["properties"]["schema_version"]["const"] == (JUDGE_BUNDLE_SCHEMA_VERSION)
    assert set(schema["$defs"]["sections"]["required"]) == set(JUDGE_BUNDLE_SECTION_NAMES)
    assert set(schema["$defs"]["sectionRecords"]["required"]) == set(JUDGE_BUNDLE_SECTION_NAMES)
    for section_name in JUDGE_BUNDLE_SECTION_NAMES:
        assert f"'{section_name}'," in typescript


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
    assert result.section_count == 25
    assert result.unavailable_section_count == 22
    assert result.files_verified is True


def test_loading_returns_an_immutable_strict_json_contract(tmp_path: Path) -> None:
    bundle = _bundle(tmp_path)
    manifest = tmp_path / "judge_bundle.json"
    manifest.write_text(json.dumps(bundle, sort_keys=True), encoding="utf-8")

    loaded = load_judge_bundle(manifest)

    assert loaded.validation.files_verified is True
    assert loaded.data["bundle_id"] == "judge-contract-test-v1"
    with pytest.raises(FrozenInstanceError):
        loaded.manifest_path = Path("changed")  # type: ignore[misc]
    with pytest.raises(TypeError):
        loaded.data["bundle_id"] = "changed"  # type: ignore[index]


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
