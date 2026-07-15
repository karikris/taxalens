from __future__ import annotations

from pathlib import Path

from taxalens.product import EvidenceFacade, export_evidence, load_run

MANIFEST = Path("demo/manifests/demo_manifest.example.json")


def test_facade_loads_run_pipeline_stage_and_evidence() -> None:
    facade = EvidenceFacade(MANIFEST)

    run = facade.load_run("smoke-run-0001")
    pipeline = facade.load_pipeline("smoke-run-0001")
    stage = facade.load_stage("smoke-stage-score")
    evidence = facade.load_evidence_record("evid-002")

    assert run.available
    assert pipeline.available and pipeline.value is not None
    assert len(pipeline.value.stages) == 2
    assert stage.available
    assert evidence.available
    assert evidence.scientific_claim_allowed is False
    assert evidence.provenance.artifacts[0].checksum_verified is True
    assert evidence.provenance.bundle_id == "smoke-contract-v1"


def test_facade_keeps_missing_scientific_artifacts_unavailable() -> None:
    facade = EvidenceFacade(MANIFEST)

    results = (
        facade.load_candidate_comparison("evid-002"),
        facade.load_reference_evidence("evid-002"),
        facade.load_geography("evid-002"),
        facade.load_comment_revision("revision-missing"),
        facade.load_dashboard_summary("smoke-run-0001"),
        facade.load_evaluation_summary("smoke-run-0001"),
    )

    assert all(result.status == "unavailable" for result in results)
    assert all(result.provenance.bundle_id == "smoke-contract-v1" for result in results)
    assert all(result.scientific_claim_allowed is False for result in results)


def test_facade_uses_artifact_ledger_as_lineage() -> None:
    result = EvidenceFacade(MANIFEST).load_lineage("evid-002")

    assert result.available and result.value is not None
    assert result.value.evidence_record_id == "evid-002"
    assert len(result.value.events) == 1
    assert result.value.events[0]["step"] == "reference_check"


def test_facade_export_is_deterministic_and_preserves_unavailable_states(
    tmp_path: Path,
) -> None:
    facade = EvidenceFacade(MANIFEST)
    first = facade.export_evidence("evid-002", tmp_path / "first")
    second = export_evidence(facade, "evid-002", tmp_path / "second")

    assert first.available and first.value is not None
    assert second.available and second.value is not None
    assert first.value.bundle_sha256 == second.value.bundle_sha256
    assert [file.content for file in first.value.files] == [
        file.content for file in second.value.files
    ]
    evidence = (tmp_path / "first" / "evidence.json").read_text(encoding="utf-8")
    assert '"candidate_comparison":{"human_review_required":true' in evidence
    assert '"status":"unavailable"' in evidence


def test_module_level_load_run_api() -> None:
    result = load_run(MANIFEST, "smoke-run-0001")
    assert result.available
