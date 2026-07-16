from __future__ import annotations

import hashlib
import json
import shutil
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest
from packages.replay.src.biominer_prototype_evidence_adapter import (
    DEFAULT_PROTOTYPE_IMPORT_MANIFEST,
    PROTOTYPE_EVIDENCE_ADAPTER_SCHEMA_VERSION,
    PROTOTYPE_SECTION_NAMES,
    PrototypeEvidenceAdapterError,
    adapt_prototype_evidence,
)

BIOMINER_SHA = "74a7d648a562efa744e6502ef504a23b63b4e02f"


def _copy_import(tmp_path: Path) -> Path:
    destination = tmp_path / "demo/source/biominer_phase15"
    shutil.copytree(DEFAULT_PROTOTYPE_IMPORT_MANIFEST.parent, destination)
    return destination / "import_manifest.json"


def _mutate_artifact(
    manifest_path: Path,
    artifact_id: str,
    mutation: Callable[[dict[str, Any]], None],
) -> None:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    artifact = next(row for row in manifest["artifacts"] if row["artifact_id"] == artifact_id)
    root = manifest_path.resolve().parents[3]
    path = root / artifact["imported_path"]
    payload = json.loads(path.read_text(encoding="utf-8"))
    mutation(payload)
    path.write_text(json.dumps(payload, sort_keys=True), encoding="utf-8")
    content = path.read_bytes()
    artifact["byte_count"] = len(content)
    artifact["sha256"] = hashlib.sha256(content).hexdigest()
    manifest_path.write_text(json.dumps(manifest, sort_keys=True), encoding="utf-8")


def test_adapts_real_prototype_evidence_with_explicit_boundaries() -> None:
    result = adapt_prototype_evidence()

    assert result["schema_version"] == PROTOTYPE_EVIDENCE_ADAPTER_SCHEMA_VERSION
    assert result["origin_commit"] == BIOMINER_SHA
    assert result["target"] == {
        "accepted_taxon_key": "gbif:1938069",
        "scientific_name": "Papilio demoleus",
    }
    assert result["status"] == "prototype_only_available_with_limitations"
    assert result["prototype_integration_authorized"] is True
    assert result["production_default_change_authorized"] is False
    assert result["scientific_release_authorized"] is False
    assert result["public_reference_image_display_authorized"] is False
    assert result["scientific_claim_allowed"] is False
    assert tuple(result["contracts"]) == PROTOTYPE_SECTION_NAMES


def test_reference_runtime_and_policy_contracts_preserve_exact_semantics() -> None:
    contracts = adapt_prototype_evidence()["contracts"]
    bank = contracts["reference_bank"]["data"]
    runtime = contracts["vision_runtime"]["data"]
    policy = contracts["selected_policy"]["data"]

    assert bank["counts"]["prototype_support"] == 81
    assert bank["counts"]["provider_supported"] == 81
    assert bank["counts"]["human_verified"] == 0
    assert bank["licence_policy_distribution"] == {
        "allowed": 2,
        "research_only": 79,
        "denied": 0,
        "quarantined": 0,
    }
    assert bank["route_distribution"] == {
        "adult_field": 80,
        "larval": 1,
        "pinned_specimen": 0,
    }
    assert bank["public_reference_image_display_allowed"] is False

    assert runtime["bioclip"]["embedding_dimension"] == 1024
    assert runtime["bioclip"]["frozen_support_embeddings"] == 81
    assert runtime["yoloe"]["role"] == "gate_and_router_only"
    assert runtime["embedding_validation"]["resume_without_model_recomputation"] is True
    assert runtime["smoke"]["images"] == 5
    assert runtime["resume_and_cache"]["support_embedding_resume_reused"] == 81

    assert policy["selected_policy"]["experiment_id"] == "B13"
    assert policy["selected_policy"]["target_always_scored"] is True
    assert policy["selected_policy"]["higher_rank_pruning_permitted"] is False
    assert policy["margin_policy"]["threshold"] == 0.1
    assert policy["margin_policy"]["scores_are_probabilities"] is False
    assert policy["calibration"]["status"] == (
        "not_fitted_insufficient_independently_reviewed_labels"
    )
    assert policy["calibration"]["calibrator_fingerprint"] is None
    assert policy["calibration"]["probabilities_emitted"] is False
    assert policy["report_model_selection"]["coverage"] == 0.8
    assert policy["final_test_used_for_selection"] is False


def test_user_goal_verification_is_complete_without_becoming_taxonomic_truth() -> None:
    goal = adapt_prototype_evidence()["contracts"][
        "provider_support_goal_verification"
    ]

    assert goal["human_review_required"] is False
    assert goal["verification_status"] == "user_goal_suitability_verified_complete"
    assert goal["data"]["status"] == "verified_complete"
    assert goal["data"]["assertion_source"] == "direct_user_confirmation"
    assert goal["data"]["provider_supported_record_count"] == 81
    assert goal["data"]["verified_record_count"] == 81
    assert goal["data"]["records_meeting_goal_count"] == 81
    assert goal["data"]["all_provider_supported_records_verified"] is True
    assert goal["data"]["all_verified_records_meet_goal"] is True
    assert (
        goal["data"]["semantics"][
            "independent_human_taxonomic_verification_claimed"
        ]
        is False
    )
    assert goal["scientific_claim_allowed"] is False


def test_benchmark_and_staged_inference_are_not_accuracy_or_prevalence() -> None:
    contracts = adapt_prototype_evidence()["contracts"]
    benchmark = contracts["benchmark"]["data"]
    staged = contracts["staged_inference"]["data"]
    semantics = contracts["evidence_semantics"]["data"]

    assert benchmark["records_scored"] == 81
    assert benchmark["records_skipped"] == 0
    assert len(benchmark["experiments"]) == 19
    assert benchmark["human_verified_records"] == 0
    assert benchmark["classification_accuracy_reported"] is False
    assert benchmark["model_selection_comparison"]["B0"]["target_scoreability_rate"] == 0.1
    assert benchmark["model_selection_comparison"]["B13"]["target_scoreability_rate"] == 1.0

    assert staged["planned"] == 13_501
    assert staged["classified"] == 13_496
    assert staged["retryable_failures"] == 5
    assert staged["species_candidates_per_classified_record"] == 34
    assert staged["target_scored_rate"] == 1.0
    assert staged["staged_preselection_abstention"]["abstained"] == 12_296
    assert "distinct" in staged["staged_preselection_abstention"]["policy_note"]
    assert staged["staged_manifest_semantics"]["scores_are_calibrated_probabilities"] is False

    assert semantics["classification_accuracy"] is None
    assert semantics["calibration_error"] is None
    assert semantics["raw_scores_are_probabilities"] is False
    assert semantics["provider_supported_is_human_verified"] is False


def test_release_contract_is_prototype_go_only_and_backlog_remains_open() -> None:
    contracts = adapt_prototype_evidence()["contracts"]
    release = contracts["phase15_release"]["data"]
    backlog = contracts["human_work_backlog"]["data"]

    assert release["decision"] == "GO"
    assert release["gate_summary"] == {
        "required": 14,
        "passed": 14,
        "failed": 0,
        "pass_rate": 1.0,
    }
    assert release["authorization"]["prototype_integration"] is True
    assert release["authorization"]["explicit_prototype_mode_only"] is True
    assert release["scientific_release_authorized"] is False
    assert release["production_default_change_authorized"] is False
    assert release["public_reference_image_display_authorized"] is False
    assert release["release_decision"] == {
        "prototype": "accepted_with_limitations",
        "scientific_release": "not_authorized",
        "production_default": "unchanged",
        "public_reference_images": "not_authorized",
    }

    assert backlog["status"] == "deferred_does_not_block_prototype"
    assert len(backlog["items"]) == 10
    assert backlog["items"][0]["exact_count"]["reference_records_pending"] == 81
    assert "goal-suitability review is already complete" in backlog["items"][0]["work"]
    assert backlog["items"][5]["exact_count"]["research_only_references"] == 79
    assert backlog["items"][6]["exact_count"]["human_verified_calibration_records"] == 0


def test_every_contract_forbids_scientific_claims() -> None:
    contracts = adapt_prototype_evidence()["contracts"]

    for contract in contracts.values():
        assert contract["candidate_semantics"]
        assert contract["verification_status"]
        assert isinstance(contract["human_review_required"], bool)
        assert contract["scientific_claim_allowed"] is False
        assert contract["source_artifacts"]
        assert all(source["checksum_verified"] is True for source in contract["source_artifacts"])


def test_rejects_tampered_imported_bytes(tmp_path: Path) -> None:
    manifest_path = _copy_import(tmp_path)
    path = manifest_path.parent / "artifacts/manifests/pilot_prototype_policy_manifest.json"
    path.write_text(path.read_text(encoding="utf-8") + "\n", encoding="utf-8")

    with pytest.raises(PrototypeEvidenceAdapterError, match="imported bytes differ"):
        adapt_prototype_evidence(manifest_path)


def test_rejects_provider_support_promoted_to_human_verification(tmp_path: Path) -> None:
    manifest_path = _copy_import(tmp_path)
    _mutate_artifact(
        manifest_path,
        "prototype-support-bank-manifest",
        lambda payload: payload["semantics"].update({"provider_supported_is_human_verified": True}),
    )

    with pytest.raises(PrototypeEvidenceAdapterError, match="promoted"):
        adapt_prototype_evidence(manifest_path)


def test_rejects_scientific_or_public_release_authorization(tmp_path: Path) -> None:
    manifest_path = _copy_import(tmp_path)
    _mutate_artifact(
        manifest_path,
        "phase15-go-no-go",
        lambda payload: payload["authorization"].update(
            {
                "scientific_release": True,
                "public_reference_image_display": True,
            }
        ),
    )

    with pytest.raises(PrototypeEvidenceAdapterError, match="release authorization differs"):
        adapt_prototype_evidence(manifest_path)


def test_rejects_conflated_staged_and_selected_abstention_policies(
    tmp_path: Path,
) -> None:
    manifest_path = _copy_import(tmp_path)
    _mutate_artifact(
        manifest_path,
        "phase14-prototype-report",
        lambda payload: payload["staged_flickr_inference"]["staged_preselection_abstention"].update(
            {"policy_note": "This is the selected policy."}
        ),
    )

    with pytest.raises(PrototypeEvidenceAdapterError, match="policies are conflated"):
        adapt_prototype_evidence(manifest_path)
