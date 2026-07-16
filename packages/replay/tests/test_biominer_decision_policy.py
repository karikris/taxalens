# Adapted from committed BioMiner tests/test_selective_decision_policy.py.
# Core policy tests are retained; calibration artifact integration tests remain deferred.

from __future__ import annotations

from dataclasses import replace
from datetime import UTC, datetime

import pytest
from packages.replay.src.biominer_decision_policy import (
    DECISION_POLICY_OPTIMIZATION_METRIC,
    DecisionPolicyCalibrationSample,
    SelectiveDecisionPolicyConfig,
    SelectivePredictionEvidence,
    apply_selective_decision_policy,
    fit_selective_decision_policy,
)
from packages.replay.src.biominer_nonmatch import score_nonmatch_evidence
from packages.replay.tests.test_biominer_nonmatch import _request, _sha

MODEL_FINGERPRINT = _sha("foundation-model")
CLASSIFIER_FINGERPRINT = _sha("classifier:target")
CALIBRATION_FINGERPRINT = _sha("calibrator:target")
SPLIT_FINGERPRINT = _sha("decision-split")
REGIONAL_KEY = "gbif:1939773"
CREATED_AT = datetime(2026, 7, 14, 7, 8, 9, 101112, tzinfo=UTC)
GIT_SHA = "b" * 40


def _config(*, objective: float = 0.75) -> SelectiveDecisionPolicyConfig:
    return SelectiveDecisionPolicyConfig(
        target_task="binary_target_verifier",
        route="adult_field",
        target_precision_objective=objective,
        model_fingerprint=MODEL_FINGERPRINT,
        classifier_fingerprint=CLASSIFIER_FINGERPRINT,
        calibration_fingerprint=CALIBRATION_FINGERPRINT,
        split_fingerprint=SPLIT_FINGERPRINT,
    )


def _samples() -> tuple[DecisionPolicyCalibrationSample, ...]:
    values = (
        ("p1", True, 0.82, 0.30),
        ("p2", True, 0.76, 0.20),
        ("p3", True, 0.67, 0.12),
        ("p4", True, 0.55, 0.10),
        ("n1", False, 0.80, 0.05),
        ("n2", False, 0.68, 0.15),
        ("n3", False, 0.60, 0.08),
        ("n4", False, 0.20, 0.02),
    )
    return tuple(
        DecisionPolicyCalibrationSample(
            sample_id=sample_id,
            leakage_component_id=f"component-{sample_id}",
            dataset_split="calibration",
            true_target=true_target,
            calibrated_target_probability=probability,
            competitor_margin=margin,
            sample_weight=1.0,
            route_compatible=True,
            reference_coverage_sufficient=True,
            geographic_evidence_sufficient=True,
            domain_negative_detected=False,
            out_of_distribution=False,
            visual_detail_sufficient=True,
            no_geo_global_fallback=False,
        )
        for sample_id, true_target, probability, margin in values
    )


def _policy():
    return fit_selective_decision_policy(_samples(), _config())


def _prediction_evidence(*, score=None, **changes) -> SelectivePredictionEvidence:
    nonmatch = score or score_nonmatch_evidence(_request())
    values = {
        "nonmatch_score": nonmatch,
        "model_fingerprint": MODEL_FINGERPRINT,
        "classifier_fingerprint": CLASSIFIER_FINGERPRINT,
        "calibration_fingerprint": CALIBRATION_FINGERPRINT,
        "route_compatible": True,
        "reference_coverage_sufficient": True,
        "geographic_evidence_sufficient": True,
        "domain_negative_detected": False,
        "out_of_distribution": False,
        "visual_detail_sufficient": True,
        "no_geo_global_fallback": False,
    }
    values.update(changes)
    return SelectivePredictionEvidence(**values)


def test_joint_threshold_search_meets_precision_and_persists_provenance() -> None:
    policy = _policy()

    assert policy.status == "fitted"
    assert policy.target_confirmation_enabled is True
    assert policy.target_probability_threshold == pytest.approx(0.55)
    assert policy.target_probability_threshold != pytest.approx(0.90)
    assert policy.competitor_margin_threshold == pytest.approx(0.10)
    assert policy.optimization_metric == DECISION_POLICY_OPTIMIZATION_METRIC
    assert policy.target_precision_objective == pytest.approx(0.75)
    assert policy.achieved_weighted_precision == pytest.approx(0.80)
    assert policy.achieved_weighted_recall == pytest.approx(1.0)
    assert policy.achieved_weighted_coverage == pytest.approx(5 / 8)
    assert policy.calibration_sample_count == 8
    assert policy.calibration_group_count == 8
    assert policy.model_fingerprint == MODEL_FINGERPRINT
    assert policy.classifier_fingerprint == CLASSIFIER_FINGERPRINT
    assert policy.calibration_fingerprint == CALIBRATION_FINGERPRINT
    assert policy.split_fingerprint == SPLIT_FINGERPRINT
    assert policy.decision_policy_fingerprint.startswith("sha256:")


def test_threshold_search_is_order_independent() -> None:
    assert fit_selective_decision_policy(_samples(), _config()) == (
        fit_selective_decision_policy(tuple(reversed(_samples())), _config())
    )


def test_policy_fit_rejects_out_of_contract_competitor_margin() -> None:
    samples = (replace(_samples()[0], competitor_margin=2.01), *_samples()[1:])

    with pytest.raises(ValueError, match="competitor_margin must be between -2 and 2"):
        fit_selective_decision_policy(samples, _config())


def test_infeasible_precision_objective_disables_target_confirmation() -> None:
    samples = tuple(
        replace(
            sample,
            calibrated_target_probability=(0.99 if not sample.true_target else 0.30),
            competitor_margin=(0.50 if not sample.true_target else 0.10),
        )
        for sample in _samples()
    )

    policy = fit_selective_decision_policy(samples, _config(objective=1.0))
    decision = apply_selective_decision_policy(policy, _prediction_evidence())

    assert policy.status == "infeasible"
    assert policy.target_confirmation_enabled is False
    assert policy.target_probability_threshold is None
    assert policy.competitor_margin_threshold is None
    assert decision.classification_decision == "abstain"
    assert decision.abstained is True
    assert decision.abstention_reason == "decision_policy_infeasible"


def test_target_confirmation_requires_every_configured_condition() -> None:
    policy = _policy()

    decision = apply_selective_decision_policy(policy, _prediction_evidence())

    assert decision.classification_decision == "target_confirmed"
    assert decision.abstained is False
    assert decision.abstention_reason is None
    assert decision.model_decision_threshold == pytest.approx(policy.target_probability_threshold)
    assert decision.competitor_margin_threshold == pytest.approx(policy.competitor_margin_threshold)
    assert decision.threshold_provenance == policy.decision_policy_fingerprint


@pytest.mark.parametrize(
    ("changes", "outcome", "reason"),
    (
        (
            {"route_compatible": False},
            "abstain",
            "incompatible_route",
        ),
        (
            {"reference_coverage_sufficient": False},
            "insufficient_reference_coverage",
            "insufficient_reference_coverage",
        ),
        (
            {"out_of_distribution": True},
            "out_of_distribution",
            "out_of_distribution",
        ),
        (
            {"visual_detail_sufficient": False},
            "insufficient_visual_detail",
            "insufficient_visual_detail",
        ),
        (
            {"no_geo_global_fallback": True},
            "no_geo_global_fallback",
            "no_geo_global_fallback",
        ),
        (
            {"geographic_evidence_sufficient": False},
            "target_probable_review",
            "weak_geographic_evidence",
        ),
    ),
)
def test_fail_closed_conditions_prevent_confirmation(changes, outcome, reason) -> None:
    decision = apply_selective_decision_policy(
        _policy(),
        _prediction_evidence(**changes),
    )

    assert decision.classification_decision == outcome
    assert decision.abstained is True
    assert decision.abstention_reason == reason


def test_low_competitor_margin_abstains_even_with_high_target_probability() -> None:
    request = _request()
    close_competitor = replace(request.candidates[1], reference_score=0.77)
    score = score_nonmatch_evidence(
        replace(request, candidates=(request.candidates[0], close_competitor))
    )

    decision = apply_selective_decision_policy(
        _policy(),
        _prediction_evidence(score=score),
    )

    assert score.competitor_margin == pytest.approx(0.05)
    assert decision.classification_decision == "abstain"
    assert decision.abstention_reason == "competitor_margin_below_threshold"


def test_strong_known_competitor_becomes_identified_nonmatch() -> None:
    request = _request()
    strong_competitor = replace(request.candidates[1], calibrated_probability=0.93)
    score = score_nonmatch_evidence(
        replace(request, candidates=(request.candidates[0], strong_competitor))
    )

    decision = apply_selective_decision_policy(
        _policy(),
        _prediction_evidence(score=score),
    )

    assert score.nonmatch_margin is not None and score.nonmatch_margin < 0.0
    assert decision.classification_decision == "known_regional_competitor"
    assert decision.abstained is False
    assert decision.winning_nonmatch_accepted_taxon_key == REGIONAL_KEY


def test_domain_negative_outcome_precedes_target_threshold() -> None:
    decision = apply_selective_decision_policy(
        _policy(),
        _prediction_evidence(domain_negative_detected=True),
    )

    assert decision.classification_decision == "pinned_specimen"
    assert decision.abstained is False
    assert decision.abstention_reason is None


def test_unidentified_domain_negative_abstains_with_persisted_reason() -> None:
    score = score_nonmatch_evidence(replace(_request(), domain_negatives=()))

    decision = apply_selective_decision_policy(
        _policy(),
        _prediction_evidence(score=score, domain_negative_detected=True),
    )

    assert decision.classification_decision == "abstain"
    assert decision.abstained is True
    assert decision.abstention_reason == "domain_negative_without_supported_outcome"
    assert decision.abstention_reason in _policy().abstention_rules


def test_policy_fingerprint_mismatch_fails_closed() -> None:
    with pytest.raises(ValueError, match="model fingerprint"):
        apply_selective_decision_policy(
            _policy(),
            _prediction_evidence(model_fingerprint=_sha("wrong-model")),
        )
