from __future__ import annotations

import copy
import json
from collections.abc import Iterator, Mapping
from pathlib import Path

from packages.replay.src.biominer_prototype_evidence_adapter import (
    adapt_prototype_evidence,
)
from packages.replay.src.biominer_prototype_release_gate import (
    NO_GO,
    evaluate_prototype_release_gate,
)

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "demo" / "fixture" / "papilio_pilot"


def _json(relative_path: str) -> object:
    return json.loads((FIXTURE / relative_path).read_text(encoding="utf-8"))


def _mappings(value: object) -> Iterator[Mapping[str, object]]:
    if isinstance(value, Mapping):
        yield value
        for child in value.values():
            yield from _mappings(child)
    elif isinstance(value, list):
        for child in value:
            yield from _mappings(child)


def test_release_candidates_remain_hypotheses_not_occurrences() -> None:
    candidates = _json("data/candidate_sets.json")
    decisions = _json("data/selective_decision_metadata.json")
    bundle = _json("judge_bundle.json")
    assert isinstance(candidates, list)
    assert isinstance(decisions, list)
    assert isinstance(bundle, dict)

    assert candidates
    assert all(
        row["candidate_semantics"] == "source_taxon_match_not_human_verified_image_label"
        and row["verification_status"] == "candidate_plan_verified_not_reference_verified"
        and row["human_review_required"] is True
        and row["scientific_claim_allowed"] is False
        for row in candidates
    )
    assert decisions
    assert all(
        row["candidate_semantics"] == "diagnostic_only"
        and row["state"] == "awaiting_human_review"
        and row["target_classification"] is None
        and row["scientific_claim_allowed"] is False
        for row in decisions
    )
    allowed_section_semantics = {
        "candidate_reference_not_verified_support",
        "diagnostic_only",
        "hypothesis_not_occurrence",
        "not_applicable",
    }
    sections = bundle["sections"]
    assert isinstance(sections, dict)
    assert {
        section["candidate_semantics"] for section in sections.values()
    } <= allowed_section_semantics
    assert all(
        row.get("display_role") != "occurrence"
        for row in _mappings([candidates, decisions, sections])
    )


def test_release_separates_role_suitability_from_taxonomic_verification() -> None:
    snapshot = _json("source/prototype_evidence_snapshot.json")
    assert isinstance(snapshot, dict)
    contract = snapshot["contracts"]["provider_support_goal_verification"]
    data = contract["data"]
    semantics = data["semantics"]

    assert contract["candidate_semantics"] == (
        "direct_user_confirmation_of_prototype_support_role_suitability_"
        "not_independent_taxonomic_verification"
    )
    assert data["provider_supported_record_count"] == 81
    assert data["verified_record_count"] == 81
    assert semantics["verification_is_user_goal_suitability_confirmation"] is True
    assert semantics["independent_human_taxonomic_verification_claimed"] is False
    assert semantics["classification_accuracy_authorized"] is False
    assert semantics["scientific_release_authorized"] is False
    assert contract["scientific_claim_allowed"] is False


def test_release_never_promotes_raw_prototype_scores_to_probabilities() -> None:
    snapshot = _json("source/prototype_evidence_snapshot.json")
    assert isinstance(snapshot, dict)
    contracts = snapshot["contracts"]
    evidence_semantics = contracts["evidence_semantics"]["data"]
    selected_policy = contracts["selected_policy"]["data"]

    assert evidence_semantics["raw_scores_are_probabilities"] is False
    assert evidence_semantics["classification_accuracy"] is None
    assert evidence_semantics["calibration_error"] is None
    assert selected_policy["margin_policy"]["score_kind"] == (
        "raw_top1_minus_top2_similarity_margin"
    )
    assert selected_policy["margin_policy"]["scores_are_probabilities"] is False
    assert selected_policy["calibration"]["probabilities_emitted"] is False
    assert selected_policy["calibration"]["calibrator_fingerprint"] is None


def test_release_gate_fails_closed_when_scientific_semantics_drift() -> None:
    for mutation in ("scientific_release", "raw_probability"):
        prototype = copy.deepcopy(adapt_prototype_evidence())
        if mutation == "scientific_release":
            prototype["scientific_release_authorized"] = True
        else:
            prototype["contracts"]["evidence_semantics"]["data"]["raw_scores_are_probabilities"] = (
                True
            )

        receipt = evaluate_prototype_release_gate(prototype)

        assert receipt["decision"] == NO_GO
        assert receipt["failed_gate_count"] >= 1
        assert receipt["scientific_claim_allowed"] is False
        assert receipt["authorization"]["prototype_integration"] is False
        assert receipt["authorization"]["scientific_release"] is False
        assert receipt["authorization"]["scientific_claim"] is False
