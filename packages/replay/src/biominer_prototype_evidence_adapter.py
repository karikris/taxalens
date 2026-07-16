"""Adapt checksum-pinned BioMiner Phase 14/15 prototype evidence for TaxaLens."""

from __future__ import annotations

import hashlib
import json
import math
import re
from collections.abc import Mapping
from pathlib import Path, PurePosixPath
from typing import Any, TypedDict

from packages.replay.src.validation import is_full_git_sha

PROTOTYPE_EVIDENCE_ADAPTER_SCHEMA_VERSION = "taxalens-biominer-prototype-evidence:v1.1.0"
PROTOTYPE_IMPORT_SCHEMA_VERSION = "taxalens-biominer-prototype-import:v1.0.0"
DEFAULT_PROTOTYPE_IMPORT_MANIFEST = Path("demo/source/biominer_phase15/import_manifest.json")
PROTOTYPE_SECTION_NAMES = (
    "reference_bank",
    "vision_runtime",
    "benchmark",
    "selected_policy",
    "staged_inference",
    "evidence_semantics",
    "phase15_release",
    "provider_support_goal_verification",
    "human_work_backlog",
    "handoff_fingerprints",
)
_SHA256 = re.compile(r"[0-9a-f]{64}\Z")


class PrototypeEvidenceAdapterError(ValueError):
    """Raised when imported BioMiner prototype evidence fails closed."""


class PrototypeContract(TypedDict):
    candidate_semantics: str
    verification_status: str
    human_review_required: bool
    scientific_claim_allowed: bool
    source_artifacts: list[dict[str, object]]
    data: dict[str, object]


def adapt_prototype_evidence(
    import_manifest: str | Path = DEFAULT_PROTOTYPE_IMPORT_MANIFEST,
) -> dict[str, object]:
    """Verify and normalize the fixed committed prototype evidence set."""

    manifest_path = _regular_file(Path(import_manifest))
    manifest = _load_object(manifest_path)
    if manifest.get("schema_version") != PROTOTYPE_IMPORT_SCHEMA_VERSION:
        raise PrototypeEvidenceAdapterError("unsupported prototype import manifest schema")
    if manifest.get("origin_repository") != "karikris/BioMiner":
        raise PrototypeEvidenceAdapterError("prototype import origin repository differs")
    origin_commit = _text(manifest.get("origin_commit"), "origin_commit")
    if not is_full_git_sha(origin_commit):
        raise PrototypeEvidenceAdapterError("prototype origin_commit is not a full Git SHA")
    if manifest.get("source_license") != "MIT":
        raise PrototypeEvidenceAdapterError("prototype import source license differs")
    policy = _mapping(manifest.get("import_policy"), "import_policy")
    expected_policy = {
        "committed_git_objects_only": True,
        "exact_source_bytes_preserved": True,
        "untracked_sources_used": False,
        "reference_media_imported": False,
        "model_files_imported": False,
        "databases_or_caches_imported": False,
        "scientific_claim_allowed": False,
        "public_reference_image_display_allowed": False,
    }
    if dict(policy) != expected_policy:
        raise PrototypeEvidenceAdapterError("prototype import policy differs")

    payloads, sources = _load_inventory(manifest_path, manifest)
    report = payloads["phase14-prototype-report"]
    support = payloads["prototype-support-bank-manifest"]
    embeddings = payloads["prototype-embeddings-manifest"]
    benchmark = payloads["prototype-benchmark-manifest"]
    selected_policy = payloads["prototype-policy-manifest"]
    staged = payloads["prototype-staged-flickr-manifest"]
    go_no_go = payloads["phase15-go-no-go"]
    acceptance = payloads["phase15-release-acceptance"]
    final = payloads["phase15-final-verification"]
    backlog = payloads["phase15-backlog"]
    goal_verification = payloads["provider-support-goal-verification"]
    _validate_cross_file_contracts(
        report=report,
        support=support,
        embeddings=embeddings,
        benchmark=benchmark,
        selected_policy=selected_policy,
        staged=staged,
        go_no_go=go_no_go,
        acceptance=acceptance,
        final=final,
        backlog=backlog,
        goal_verification=goal_verification,
    )

    reference_bank = _mapping(report.get("reference_bank"), "report.reference_bank")
    vision = _mapping(report.get("vision_runtime"), "report.vision_runtime")
    benchmark_report = _mapping(report.get("benchmark"), "report.benchmark")
    policy_report = _mapping(report.get("selected_policy"), "report.selected_policy")
    staged_report = _mapping(
        report.get("staged_flickr_inference"), "report.staged_flickr_inference"
    )
    semantics = _mapping(report.get("evidence_semantics"), "report.evidence_semantics")
    release_authorization = _mapping(go_no_go.get("authorization"), "go_no_go.authorization")
    release_decision = _mapping(final.get("release_decision"), "final.release_decision")

    contracts: dict[str, PrototypeContract] = {
        "reference_bank": _contract(
            candidate_semantics=(
                "provider_supported_prototype_reference_not_human_verified_support"
            ),
            verification_status="prototype_bank_frozen_with_known_shortfalls",
            sources=_sources(
                sources,
                "prototype-support-bank-manifest",
                "phase14-prototype-report",
                "phase15-release-acceptance",
            ),
            data={
                "status": support["status"],
                "bank_status": support["bank_status"],
                "classification_authorised": support["classification_authorised"],
                "human_verification_complete": support["human_verification_complete"],
                "reference_bank_version": _mapping(support.get("execution"), "support.execution")[
                    "reference_bank_version"
                ],
                "counts": dict(_mapping(support.get("counts"), "support.counts")),
                "composition": dict(
                    _mapping(reference_bank.get("composition"), "reference_bank.composition")
                ),
                "trust_distribution": dict(
                    _mapping(
                        reference_bank.get("trust_distribution"),
                        "reference_bank.trust_distribution",
                    )
                ),
                "geographic_layer_distribution": dict(
                    _mapping(
                        reference_bank.get("geographic_layer_distribution"),
                        "reference_bank.geographic_layer_distribution",
                    )
                ),
                "licence_policy_distribution": dict(
                    _mapping(
                        reference_bank.get("licence_policy_distribution"),
                        "reference_bank.licence_policy_distribution",
                    )
                ),
                "route_distribution": dict(
                    _mapping(
                        reference_bank.get("route_distribution"),
                        "reference_bank.route_distribution",
                    )
                ),
                "split_distribution": dict(
                    _mapping(
                        reference_bank.get("split_distribution"),
                        "reference_bank.split_distribution",
                    )
                ),
                "support_shortfalls": dict(
                    _mapping(report.get("support_shortfalls"), "report.support_shortfalls")
                ),
                "public_reference_image_display_allowed": False,
            },
        ),
        "vision_runtime": _contract(
            candidate_semantics="runtime_evidence_not_taxonomic_validation",
            verification_status="prototype_runtime_verified",
            sources=_sources(
                sources,
                "prototype-embeddings-manifest",
                "prototype-vision-smoke-manifest",
                "phase14-prototype-report",
                "phase15-final-verification",
            ),
            data={
                "bioclip": dict(_mapping(vision.get("bioclip"), "vision.bioclip")),
                "yoloe": dict(_mapping(vision.get("yoloe"), "vision.yoloe")),
                "embedding_counts": dict(_mapping(embeddings.get("counts"), "embeddings.counts")),
                "embedding_routes": dict(
                    _mapping(embeddings.get("route_counts"), "embeddings.route_counts")
                ),
                "embedding_model": dict(_mapping(embeddings.get("model"), "embeddings.model")),
                "embedding_validation": dict(
                    _mapping(embeddings.get("validation"), "embeddings.validation")
                ),
                "smoke": dict(_mapping(final.get("real_smoke"), "final.real_smoke")),
                "resume_and_cache": dict(
                    _mapping(final.get("resume_and_cache"), "final.resume_and_cache")
                ),
            },
        ),
        "benchmark": _contract(
            candidate_semantics=(
                "provider_supported_retrieval_consistency_not_classification_accuracy"
            ),
            verification_status="prototype_benchmark_complete",
            sources=_sources(
                sources,
                "prototype-benchmark-manifest",
                "phase14-prototype-report",
            ),
            data={
                "status": benchmark["status"],
                "execution": dict(_mapping(benchmark.get("execution"), "benchmark.execution")),
                "records_scored": benchmark_report["records_scored"],
                "records_skipped": benchmark_report["records_skipped"],
                "prediction_rows": benchmark_report["prediction_rows"],
                "candidate_score_rows": benchmark_report["candidate_score_rows"],
                "metric_semantics": benchmark_report["metric_semantics"],
                "experiments": list(
                    _list(benchmark_report.get("experiments"), "benchmark.experiments")
                ),
                "model_selection_comparison": dict(
                    _mapping(
                        benchmark_report.get("model_selection_comparison"),
                        "benchmark.model_selection_comparison",
                    )
                ),
                "human_verified_records": 0,
                "classification_accuracy_reported": False,
            },
        ),
        "selected_policy": _contract(
            candidate_semantics="prototype_raw_margin_decision_support_not_probability",
            verification_status="prototype_policy_selected_uncalibrated",
            sources=_sources(
                sources,
                "prototype-policy-manifest",
                "phase14-prototype-report",
            ),
            data={
                "status": selected_policy["status"],
                "policy_status": selected_policy["policy_status"],
                "selected_policy": dict(
                    _mapping(
                        selected_policy.get("selected_policy"),
                        "selected_policy.selected_policy",
                    )
                ),
                "margin_policy": dict(
                    _mapping(
                        selected_policy.get("margin_policy"),
                        "selected_policy.margin_policy",
                    )
                ),
                "selection_evidence": dict(
                    _mapping(
                        selected_policy.get("selection_evidence"),
                        "selected_policy.selection_evidence",
                    )
                ),
                "calibration": dict(
                    _mapping(selected_policy.get("calibration"), "selected_policy.calibration")
                ),
                "frozen_identity": dict(
                    _mapping(
                        selected_policy.get("frozen_identity"),
                        "selected_policy.frozen_identity",
                    )
                ),
                "report_model_selection": dict(
                    _mapping(
                        policy_report.get("model_selection"),
                        "policy_report.model_selection",
                    )
                ),
                "report_calibration_audit": dict(
                    _mapping(
                        policy_report.get("calibration_coverage_audit"),
                        "policy_report.calibration_coverage_audit",
                    )
                ),
                "final_test_used_for_selection": policy_report["final_test_used_for_selection"],
            },
        ),
        "staged_inference": _contract(
            candidate_semantics="prototype_screening_distribution_not_accuracy_or_prevalence",
            verification_status="prototype_staged_inference_complete_with_retryable_failures",
            sources=_sources(
                sources,
                "prototype-staged-flickr-manifest",
                "phase14-prototype-report",
                "phase15-final-verification",
            ),
            data={
                **dict(staged_report),
                "staged_manifest_status": staged["status"],
                "staged_manifest_validation": dict(
                    _mapping(staged.get("validation"), "staged.validation")
                ),
                "staged_manifest_semantics": dict(
                    _mapping(staged.get("semantics"), "staged.semantics")
                ),
                "stage_progression": list(_list(final.get("staged_runs"), "final.staged_runs")),
            },
        ),
        "evidence_semantics": _contract(
            candidate_semantics="explicit_claim_boundary",
            verification_status="prototype_semantics_verified",
            sources=_sources(
                sources,
                "phase14-prototype-report",
                "phase15-go-no-go",
                "phase15-release-acceptance",
            ),
            data={
                **dict(semantics),
                "required_statement": report["required_statement"],
                "known_limitations": list(
                    _list(report.get("known_limitations"), "report.known_limitations")
                ),
            },
        ),
        "phase15_release": _contract(
            candidate_semantics="prototype_release_authorization_not_scientific_release",
            verification_status="prototype_only_go_accepted_with_limitations",
            sources=_sources(
                sources,
                "phase15-go-no-go",
                "phase15-release-acceptance",
                "phase15-final-verification",
            ),
            data={
                "decision": go_no_go["decision"],
                "gate_summary": dict(
                    _mapping(go_no_go.get("gate_summary"), "go_no_go.gate_summary")
                ),
                "authorization": dict(release_authorization),
                "controls": dict(_mapping(go_no_go.get("controls"), "go_no_go.controls")),
                "prototype_limitations": list(
                    _list(
                        go_no_go.get("prototype_limitations"),
                        "go_no_go.prototype_limitations",
                    )
                ),
                "acceptance_status": acceptance["status"],
                "release_decision": dict(release_decision),
                "scientific_release_authorized": False,
                "production_default_change_authorized": False,
                "public_reference_image_display_authorized": False,
            },
        ),
        "provider_support_goal_verification": _contract(
            candidate_semantics=(
                "direct_user_confirmation_of_prototype_support_role_suitability"
                "_not_independent_taxonomic_verification"
            ),
            verification_status="user_goal_suitability_verified_complete",
            human_review_required=False,
            sources=_sources(
                sources,
                "provider-support-goal-verification",
                "phase15-release-acceptance",
            ),
            data={
                "status": goal_verification["status"],
                "assertion_source": goal_verification["assertion_source"],
                "asserted_by": goal_verification["asserted_by"],
                "verification_completed_on": goal_verification["verification_completed_on"],
                "recorded_at": goal_verification["recorded_at"],
                "reference_bank_version": goal_verification["reference_bank_version"],
                "goal": goal_verification["goal"],
                "provider_supported_record_count": goal_verification[
                    "provider_supported_record_count"
                ],
                "verified_record_count": goal_verification["verified_record_count"],
                "records_meeting_goal_count": goal_verification[
                    "records_meeting_goal_count"
                ],
                "all_provider_supported_records_verified": goal_verification[
                    "all_provider_supported_records_verified"
                ],
                "all_verified_records_meet_goal": goal_verification[
                    "all_verified_records_meet_goal"
                ],
                "semantics": dict(
                    _mapping(
                        goal_verification.get("semantics"),
                        "goal_verification.semantics",
                    )
                ),
            },
        ),
        "human_work_backlog": _contract(
            candidate_semantics="human_and_engineering_work_not_completed_evidence",
            verification_status="deferred_non_blocking_for_prototype",
            sources=_sources(sources, "phase15-backlog"),
            data={
                "status": backlog["status"],
                "non_blocking_statement": backlog["non_blocking_statement"],
                "items": list(_list(backlog.get("items"), "backlog.items")),
            },
        ),
        "handoff_fingerprints": _contract(
            candidate_semantics="artifact_identity_not_scientific_validation",
            verification_status="content_and_cross_references_verified",
            human_review_required=False,
            sources=list(sources.values()),
            data={
                "origin_repository": manifest["origin_repository"],
                "origin_commit": origin_commit,
                "import_manifest_sha256": _sha256(manifest_path),
                "imported_artifact_count": len(sources),
                "imported_files": list(sources.values()),
                "reference_media_imported": False,
                "model_files_imported": False,
                "databases_or_caches_imported": False,
            },
        ),
    }
    return {
        "schema_version": PROTOTYPE_EVIDENCE_ADAPTER_SCHEMA_VERSION,
        "origin_repository": manifest["origin_repository"],
        "origin_commit": origin_commit,
        "target": dict(_mapping(report.get("target"), "report.target")),
        "status": "prototype_only_available_with_limitations",
        "prototype_integration_authorized": release_authorization["prototype_integration"],
        "production_default_change_authorized": False,
        "scientific_release_authorized": False,
        "public_reference_image_display_authorized": False,
        "scientific_claim_allowed": False,
        "contract_count": len(contracts),
        "contracts": contracts,
    }


def _validate_cross_file_contracts(
    *,
    report: Mapping[str, Any],
    support: Mapping[str, Any],
    embeddings: Mapping[str, Any],
    benchmark: Mapping[str, Any],
    selected_policy: Mapping[str, Any],
    staged: Mapping[str, Any],
    go_no_go: Mapping[str, Any],
    acceptance: Mapping[str, Any],
    final: Mapping[str, Any],
    backlog: Mapping[str, Any],
    goal_verification: Mapping[str, Any],
) -> None:
    if report.get("status") != "complete_prototype_only":
        raise PrototypeEvidenceAdapterError("Phase 14 report is not prototype-complete")
    target = _mapping(report.get("target"), "report.target")
    for label, payload in (
        ("support", support),
        ("selected_policy", selected_policy),
        ("staged", staged),
        ("acceptance", acceptance),
    ):
        if "target" in payload and _mapping(payload.get("target"), f"{label}.target") != target:
            raise PrototypeEvidenceAdapterError(f"{label} target differs from Phase 14 report")

    report_bank = _mapping(report.get("reference_bank"), "report.reference_bank")
    support_counts = _mapping(support.get("counts"), "support.counts")
    acceptance_bank = _mapping(acceptance.get("reference_bank"), "acceptance.reference_bank")
    expected_bank_counts = {
        "prototype_support": 81,
        "provider_supported": 81,
        "human_verified": 0,
    }
    for key, expected in expected_bank_counts.items():
        if (
            report_bank.get(key) != expected
            or support_counts.get(key) != expected
            or (acceptance_bank.get("records" if key == "prototype_support" else key) != expected)
        ):
            raise PrototypeEvidenceAdapterError(f"reference-bank {key} differs")
    licence = _mapping(
        report_bank.get("licence_policy_distribution"),
        "report.reference_bank.licence_policy_distribution",
    )
    if licence.get("allowed") != 2 or licence.get("research_only") != 79:
        raise PrototypeEvidenceAdapterError("reference-bank licence distribution differs")
    if support.get("bank_status") != "prototype_only":
        raise PrototypeEvidenceAdapterError("support bank is not prototype-only")
    support_semantics = _mapping(support.get("semantics"), "support.semantics")
    if support_semantics.get("provider_supported_is_human_verified") is not False:
        raise PrototypeEvidenceAdapterError("provider support is promoted to human verification")
    goal_semantics = _mapping(
        goal_verification.get("semantics"),
        "goal_verification.semantics",
    )
    if (
        goal_verification.get("status") != "verified_complete"
        or goal_verification.get("assertion_source") != "direct_user_confirmation"
        or goal_verification.get("reference_bank_version")
        != _mapping(support.get("execution"), "support.execution").get(
            "reference_bank_version"
        )
        or goal_verification.get("provider_supported_record_count") != 81
        or goal_verification.get("verified_record_count") != 81
        or goal_verification.get("records_meeting_goal_count") != 81
        or goal_verification.get("all_provider_supported_records_verified") is not True
        or goal_verification.get("all_verified_records_meet_goal") is not True
        or goal_semantics.get("verification_is_user_goal_suitability_confirmation")
        is not True
        or goal_semantics.get("independent_human_taxonomic_verification_claimed")
        is not False
        or goal_semantics.get("classification_accuracy_authorized") is not False
        or goal_semantics.get("scientific_release_authorized") is not False
        or goal_semantics.get("production_default_change_authorized") is not False
    ):
        raise PrototypeEvidenceAdapterError(
            "provider-support goal verification boundary differs"
        )

    embedding_counts = _mapping(embeddings.get("counts"), "embeddings.counts")
    embedding_validation = _mapping(embeddings.get("validation"), "embeddings.validation")
    if embedding_counts.get("embedded") != 81 or embedding_counts.get("human_verified") != 0:
        raise PrototypeEvidenceAdapterError("prototype embedding counts differ")
    if not all(
        embedding_validation.get(key) is True
        for key in (
            "complete_support_coverage",
            "finite_embeddings",
            "unit_normalized_embeddings",
            "resume_without_model_recomputation",
        )
    ):
        raise PrototypeEvidenceAdapterError("prototype embedding validation is incomplete")

    report_benchmark = _mapping(report.get("benchmark"), "report.benchmark")
    benchmark_execution = _mapping(benchmark.get("execution"), "benchmark.execution")
    benchmark_semantics = _mapping(benchmark.get("semantics"), "benchmark.semantics")
    if (
        report_benchmark.get("records_scored") != 81
        or benchmark_execution.get("records_scored") != 81
        or benchmark_execution.get("experiment_rows_per_record") != 19
    ):
        raise PrototypeEvidenceAdapterError("prototype benchmark execution differs")
    if (
        benchmark_semantics.get("classification_accuracy_reported") is not False
        or benchmark_semantics.get("raw_scores_are_probabilities") is not False
        or benchmark_semantics.get("human_verified_records") != 0
    ):
        raise PrototypeEvidenceAdapterError("prototype benchmark semantics differ")

    report_policy = _mapping(report.get("selected_policy"), "report.selected_policy")
    policy = _mapping(selected_policy.get("selected_policy"), "selected_policy.selected_policy")
    margin = _mapping(selected_policy.get("margin_policy"), "selected_policy.margin_policy")
    calibration = _mapping(selected_policy.get("calibration"), "selected_policy.calibration")
    if (
        report_policy.get("experiment_id") != "B13"
        or policy.get("experiment_id") != "B13"
        or policy.get("target_always_scored") is not True
        or policy.get("higher_rank_pruning_permitted") is not False
        or margin.get("threshold") != 0.1
        or margin.get("scores_are_probabilities") is not False
        or calibration.get("status") != "not_fitted_insufficient_independently_reviewed_labels"
        or calibration.get("calibrator_fingerprint") is not None
        or calibration.get("human_verified_calibration_records") != 0
        or calibration.get("probabilities_emitted") is not False
    ):
        raise PrototypeEvidenceAdapterError("selected prototype policy differs")

    staged_counts = _mapping(staged.get("counts"), "staged.counts")
    staged_validation = _mapping(staged.get("validation"), "staged.validation")
    staged_semantics = _mapping(staged.get("semantics"), "staged.semantics")
    report_staged = _mapping(
        report.get("staged_flickr_inference"), "report.staged_flickr_inference"
    )
    if (
        staged_counts.get("planned") != report_staged.get("planned")
        or staged_counts.get("classified") != report_staged.get("classified")
        or staged_counts.get("retryable_operational_failures")
        != report_staged.get("retryable_failures")
        or staged_counts.get("candidate_score_rows") != report_staged.get("candidate_score_rows")
        or staged_counts.get("classified") != 13_496
    ):
        raise PrototypeEvidenceAdapterError("staged inference counts differ")
    if (
        staged_validation.get("target_scored_for_every_classified_record") is not True
        or staged_validation.get("higher_rank_pruning_applied") is not False
        or staged_semantics.get("scores_are_calibrated_probabilities") is not False
        or staged_semantics.get("model_output_is_taxonomic_validation") is not False
    ):
        raise PrototypeEvidenceAdapterError("staged inference semantics differ")
    preselection = _mapping(
        report_staged.get("staged_preselection_abstention"),
        "report.staged_preselection_abstention",
    )
    if preselection.get("abstained") != 12_296 or "0.10" not in _text(
        preselection.get("policy_note"), "staged preselection policy_note"
    ):
        raise PrototypeEvidenceAdapterError("staged and selected abstention policies are conflated")

    evidence_semantics = _mapping(report.get("evidence_semantics"), "report.evidence_semantics")
    if (
        evidence_semantics.get("classification_accuracy") is not None
        or evidence_semantics.get("classification_accuracy_reported") is not False
        or evidence_semantics.get("calibration_error") is not None
        or evidence_semantics.get("raw_scores_are_probabilities") is not False
    ):
        raise PrototypeEvidenceAdapterError("Phase 14 evidence semantics differ")

    gate_summary = _mapping(go_no_go.get("gate_summary"), "go_no_go.gate_summary")
    authorization = _mapping(go_no_go.get("authorization"), "go_no_go.authorization")
    acceptance_authorization = _mapping(acceptance.get("authorization"), "acceptance.authorization")
    release = _mapping(final.get("release_decision"), "final.release_decision")
    if (
        go_no_go.get("decision") != "GO"
        or gate_summary.get("required") != 14
        or gate_summary.get("passed") != 14
        or gate_summary.get("failed") != 0
        or authorization.get("prototype_integration") is not True
        or authorization.get("explicit_prototype_mode_only") is not True
        or authorization.get("scientific_release") is not False
        or authorization.get("production_default_change") is not False
        or authorization.get("public_reference_image_display") is not False
        or acceptance.get("status") != "accepted_prototype_only_with_limitations"
        or acceptance_bank.get("user_goal_verified") != 81
        or acceptance_bank.get("user_goal_suitable") != 81
        or acceptance_authorization.get("scientific_release") is not False
        or final.get("status") != "passed_prototype_only"
        or release.get("scientific_release") != "not_authorized"
        or release.get("production_default") != "unchanged"
        or release.get("public_reference_images") != "not_authorized"
    ):
        raise PrototypeEvidenceAdapterError("Phase 15 release authorization differs")
    if backlog.get("status") != "deferred_does_not_block_prototype":
        raise PrototypeEvidenceAdapterError("post-Build-Week backlog status differs")


def _contract(
    *,
    candidate_semantics: str,
    verification_status: str,
    sources: list[dict[str, object]],
    data: dict[str, object],
    human_review_required: bool = True,
) -> PrototypeContract:
    return {
        "candidate_semantics": candidate_semantics,
        "verification_status": verification_status,
        "human_review_required": human_review_required,
        "scientific_claim_allowed": False,
        "source_artifacts": sources,
        "data": data,
    }


def _load_inventory(
    manifest_path: Path,
    manifest: Mapping[str, Any],
) -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, object]]]:
    rows = _list(manifest.get("artifacts"), "artifacts")
    payloads: dict[str, dict[str, Any]] = {}
    sources: dict[str, dict[str, object]] = {}
    root = manifest_path.resolve().parents[3]
    for index, raw in enumerate(rows):
        row = _mapping(raw, f"artifacts[{index}]")
        artifact_id = _text(row.get("artifact_id"), f"artifacts[{index}].artifact_id")
        if artifact_id in payloads:
            raise PrototypeEvidenceAdapterError(f"duplicate artifact_id: {artifact_id}")
        imported_path = _safe_path(row.get("imported_path"), f"artifacts[{index}].imported_path")
        path = _regular_file(root / imported_path)
        content = path.read_bytes()
        expected_bytes = row.get("byte_count")
        expected_sha = _text(row.get("sha256"), f"artifacts[{index}].sha256")
        if (
            not isinstance(expected_bytes, int)
            or isinstance(expected_bytes, bool)
            or expected_bytes < 0
            or _SHA256.fullmatch(expected_sha) is None
        ):
            raise PrototypeEvidenceAdapterError(f"{artifact_id} import identity is invalid")
        if len(content) != expected_bytes or hashlib.sha256(content).hexdigest() != expected_sha:
            raise PrototypeEvidenceAdapterError(f"{artifact_id} imported bytes differ")
        try:
            payload = json.loads(
                content,
                object_pairs_hook=_reject_duplicate_keys,
                parse_constant=_reject_constant,
            )
        except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
            raise PrototypeEvidenceAdapterError(
                f"{artifact_id} is not strict JSON: {error}"
            ) from error
        if not isinstance(payload, dict):
            raise PrototypeEvidenceAdapterError(f"{artifact_id} must contain an object")
        schema_version = _text(row.get("schema_version"), f"artifacts[{index}].schema_version")
        if payload.get("schema_version") != schema_version:
            raise PrototypeEvidenceAdapterError(f"{artifact_id} schema version differs")
        _reject_nonfinite(payload, artifact_id)
        payloads[artifact_id] = payload
        sources[artifact_id] = {
            "artifact_id": artifact_id,
            "source_path": _text(row.get("source_path"), f"artifacts[{index}].source_path"),
            "imported_path": imported_path.as_posix(),
            "schema_version": schema_version,
            "sha256": expected_sha,
            "byte_count": expected_bytes,
            "checksum_verified": True,
        }
    if len(payloads) != 21:
        raise PrototypeEvidenceAdapterError("prototype import must contain 21 artifacts")
    return payloads, sources


def _sources(
    sources: Mapping[str, dict[str, object]],
    *artifact_ids: str,
) -> list[dict[str, object]]:
    return [sources[artifact_id] for artifact_id in artifact_ids]


def _load_object(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(
            path.read_text(encoding="utf-8"),
            object_pairs_hook=_reject_duplicate_keys,
            parse_constant=_reject_constant,
        )
    except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
        raise PrototypeEvidenceAdapterError(f"{path} is not strict JSON: {error}") from error
    if not isinstance(value, dict):
        raise PrototypeEvidenceAdapterError(f"{path} must contain an object")
    return value


def _mapping(value: object, location: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise PrototypeEvidenceAdapterError(f"{location} must be an object")
    return value


def _list(value: object, location: str) -> list[Any]:
    if not isinstance(value, list):
        raise PrototypeEvidenceAdapterError(f"{location} must be an array")
    return value


def _text(value: object, location: str) -> str:
    if not isinstance(value, str) or not value:
        raise PrototypeEvidenceAdapterError(f"{location} must be non-empty text")
    return value


def _safe_path(value: object, location: str) -> PurePosixPath:
    path = PurePosixPath(_text(value, location))
    if path.is_absolute() or ".." in path.parts or "." in path.parts:
        raise PrototypeEvidenceAdapterError(f"{location} is unsafe")
    return path


def _regular_file(path: Path) -> Path:
    if not path.is_file() or path.is_symlink():
        raise PrototypeEvidenceAdapterError(f"required regular file is missing: {path}")
    return path


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _reject_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate key {key!r}")
        result[key] = value
    return result


def _reject_constant(value: str) -> None:
    raise ValueError(f"non-JSON numeric constant {value}")


def _reject_nonfinite(value: object, location: str) -> None:
    if isinstance(value, float) and not math.isfinite(value):
        raise PrototypeEvidenceAdapterError(f"{location} contains a non-finite number")
    if isinstance(value, list):
        for index, item in enumerate(value):
            _reject_nonfinite(item, f"{location}[{index}]")
    elif isinstance(value, Mapping):
        for key, item in value.items():
            _reject_nonfinite(item, f"{location}.{key}")
