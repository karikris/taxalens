from __future__ import annotations

import hashlib
import json
from dataclasses import FrozenInstanceError
from pathlib import Path

import pytest
from taxalens.product import EvidenceFacade

MANIFEST = Path("demo/manifests/demo_manifest.example.json")
TAXALENS_SHA = "1" * 40
BIOMINER_SHA = "2" * 40


def _canonical_json(value: object) -> bytes:
    return (
        json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n"
    ).encode()


def _build_facade(
    root: Path,
    artifacts: dict[str, object],
    *,
    bundle_id: str = "integration-bundle-v1",
) -> EvidenceFacade:
    (root / "provenance").mkdir(parents=True)
    (root / "provenance" / "biominer_migration_manifest.yaml").write_text(
        "product_boundary_version: test\n",
        encoding="utf-8",
    )
    (root / "pyproject.toml").write_text(
        '[project]\nname = "taxalens-facade-integration"\nversion = "0.0.0"\n',
        encoding="utf-8",
    )
    artifact_dir = root / "artifacts"
    artifact_dir.mkdir()
    inventory: list[dict[str, str]] = []
    for name, payload in artifacts.items():
        content = _canonical_json(payload)
        relative_path = Path("artifacts") / f"{name}.json"
        (root / relative_path).write_bytes(content)
        inventory.append(
            {
                "name": name,
                "path": relative_path.as_posix(),
                "sha256": hashlib.sha256(content).hexdigest(),
            }
        )
    manifest = {
        "demo_id": bundle_id,
        "taxalens_commit": TAXALENS_SHA,
        "source_biominer_commit": BIOMINER_SHA,
        "artifacts": inventory,
        "rights_summary": {"status": "fixture-only"},
        "openai_replay_mode": "stored_structured_outputs_only",
    }
    manifest_path = root / "manifest.json"
    manifest_path.write_bytes(_canonical_json(manifest))
    return EvidenceFacade(manifest_path)


def test_run_and_pipeline_load_through_product_contracts() -> None:
    facade = EvidenceFacade(MANIFEST)

    run = facade.load_run("smoke-run-0001")
    pipeline = facade.load_pipeline("smoke-run-0001")

    assert run.available and run.value is not None
    assert run.value.kind == "run"
    assert run.value.data["records_in"] == 3
    assert pipeline.available and pipeline.value is not None
    assert pipeline.value.run_id == "smoke-run-0001"
    assert tuple(stage.record_id for stage in pipeline.value.stages) == (
        "smoke-stage-trusted-registry",
        "smoke-stage-score",
    )
    assert {artifact.name for artifact in pipeline.provenance.artifacts} == {
        "run_summary",
        "stage_metrics",
    }


def test_missing_product_artifacts_are_explicitly_unavailable() -> None:
    facade = EvidenceFacade(MANIFEST)

    results = {
        "candidate_comparisons": facade.load_candidate_comparison("evid-002"),
        "reference_evidence": facade.load_reference_evidence("evid-002"),
        "geography": facade.load_geography("evid-002"),
        "comment_revisions": facade.load_comment_revision("revision-1"),
        "dashboard_summary": facade.load_dashboard_summary("smoke-run-0001"),
        "evaluation_summary": facade.load_evaluation_summary("smoke-run-0001"),
    }

    for artifact_name, result in results.items():
        assert result.status == "unavailable"
        assert result.value is None
        assert artifact_name in (result.reason or "")
        assert result.provenance.requested_artifacts == (artifact_name,)
        assert result.human_review_required is True
        assert result.scientific_claim_allowed is False


def test_incomplete_phase14_metadata_does_not_become_evaluation(
    tmp_path: Path,
) -> None:
    facade = _build_facade(
        tmp_path,
        {
            "reference_evidence": [
                {
                    "schema_version": "phase14-reference-metadata:v1",
                    "evidence_record_id": "phase14-candidate-001",
                    "status": "metadata_only_human_review_blocked",
                    "eligible_source_media_candidates": 838,
                    "human_verified_source_media": 0,
                    "human_verified_shortfall": 490,
                    "human_review_required": True,
                    "scientific_claim_allowed": False,
                }
            ]
        },
        bundle_id="phase14-incomplete-v1",
    )

    metadata = facade.load_reference_evidence("phase14-candidate-001")
    evaluation = facade.load_evaluation_summary()

    assert metadata.available and metadata.value is not None
    assert metadata.value.data["eligible_source_media_candidates"] == 838
    assert metadata.value.data["human_verified_source_media"] == 0
    assert metadata.value.data["human_verified_shortfall"] == 490
    assert metadata.human_review_required is True
    assert metadata.scientific_claim_allowed is False
    assert evaluation.status == "unavailable"
    assert evaluation.provenance.bundle_id == "phase14-incomplete-v1"


def test_candidate_comparison_preserves_exact_upstream_semantics(
    tmp_path: Path,
) -> None:
    facade = _build_facade(
        tmp_path,
        {
            "candidate_comparisons": [
                {
                    "schema_version": "candidate-comparison:v1",
                    "evidence_record_id": "candidate-record-1",
                    "semantic_status": "candidate_not_occurrence_label_or_support",
                    "candidate_taxon_keys": ["target", "competitor", "target"],
                    "raw_scores": [0.41, 0.83, 0.41],
                    "scientific_claim_allowed": False,
                }
            ]
        },
    )

    result = facade.load_candidate_comparison("candidate-record-1")

    assert result.available and result.value is not None
    assert result.value.data["semantic_status"] == ("candidate_not_occurrence_label_or_support")
    assert result.value.data["candidate_taxon_keys"] == (
        "target",
        "competitor",
        "target",
    )
    assert result.value.data["raw_scores"] == (0.41, 0.83, 0.41)
    assert result.scientific_claim_allowed is False


def test_unavailable_calibrated_evidence_stays_null_and_non_claiming() -> None:
    facade = EvidenceFacade(MANIFEST)

    unavailable = facade.load_evidence_record("evid-002")
    stored_smoke_value = facade.load_evidence_record("evid-003")

    assert unavailable.available and unavailable.value is not None
    assert unavailable.value.data["decision"] == "insufficient_reference"
    assert unavailable.value.data["calibrated_output"] is None
    assert unavailable.value.data["decision_threshold"] is None
    assert unavailable.scientific_claim_allowed is False
    assert stored_smoke_value.available and stored_smoke_value.value is not None
    assert stored_smoke_value.value.data["calibrated_output"] == 0.57
    assert stored_smoke_value.scientific_claim_allowed is False


def test_lineage_is_complete_when_and_only_when_the_artifact_supplies_it(
    tmp_path: Path,
) -> None:
    facade = EvidenceFacade(MANIFEST)

    expected_steps = {
        "evid-001": "query_resolution",
        "evid-002": "reference_check",
        "evid-003": "scoring",
    }
    for evidence_record_id, expected_step in expected_steps.items():
        result = facade.load_lineage(evidence_record_id)
        assert result.available and result.value is not None
        assert tuple(event["step"] for event in result.value.events) == (expected_step,)
        assert result.provenance.operation == "load_lineage"
        assert result.provenance.requested_artifacts == (
            "lineage",
            "evidence_records",
        )
        assert tuple(item.name for item in result.provenance.artifacts) == ("evidence_records",)

    no_ledger = _build_facade(
        tmp_path,
        {
            "evidence_records": [
                {
                    "schema_version": "evidence_record:v1",
                    "evidence_record_id": "no-ledger",
                }
            ]
        },
    ).load_lineage("no-ledger")
    assert no_ledger.status == "unavailable"
    assert no_ledger.reason == "the evidence record has no artifact-provided ledger"


def test_export_is_byte_deterministic_and_internally_checksummed() -> None:
    facade = EvidenceFacade(MANIFEST)

    first = facade.export_evidence("evid-002")
    second = facade.export_evidence("evid-002")

    assert first.available and first.value is not None
    assert second.available and second.value is not None
    assert first.value.bundle_sha256 == second.value.bundle_sha256
    assert first.value.files == second.value.files
    for file in first.value.files:
        assert hashlib.sha256(file.content).hexdigest() == file.sha256
    export_manifest = json.loads(first.value.files[1].content)
    assert export_manifest["files"] == {"evidence.json": first.value.files[0].sha256}
    assert hashlib.sha256(first.value.files[1].content).hexdigest() == (first.value.bundle_sha256)


def test_provenance_propagates_for_available_unavailable_and_invalid_results(
    tmp_path: Path,
) -> None:
    facade = _build_facade(
        tmp_path,
        {
            "run_summary": {
                "schema_version": "run_summary:v1",
                "run_id": "run-1",
            }
        },
        bundle_id="provenance-integration-v1",
    )
    available = facade.load_run("run-1")
    unavailable = facade.load_evaluation_summary("run-1")
    (tmp_path / "artifacts" / "run_summary.json").write_text(
        '{"run_id":"tampered"}\n',
        encoding="utf-8",
    )
    invalid = facade.load_run("run-1")

    assert available.provenance.bundle_id == "provenance-integration-v1"
    assert available.provenance.bundle_taxalens_sha == TAXALENS_SHA
    assert available.provenance.bundle_biominer_sha == BIOMINER_SHA
    assert available.provenance.artifacts[0].checksum_verified is True
    assert unavailable.provenance.bundle_id == available.provenance.bundle_id
    assert invalid.status == "invalid"
    assert invalid.provenance.bundle_id == available.provenance.bundle_id
    assert invalid.provenance.artifacts[0].checksum_verified is False
    assert invalid.human_review_required is True
    assert invalid.scientific_claim_allowed is False


def test_product_results_and_nested_payloads_are_immutable() -> None:
    result = EvidenceFacade(MANIFEST).load_evidence_record("evid-002")

    assert result.value is not None
    with pytest.raises(FrozenInstanceError):
        result.reason = "changed"  # type: ignore[misc]
    with pytest.raises(TypeError):
        result.value.data["decision"] = "target_confirmed"  # type: ignore[index]
