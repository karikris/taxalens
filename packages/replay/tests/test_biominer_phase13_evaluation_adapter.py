from __future__ import annotations

import hashlib
import json
from pathlib import Path

import polars as pl
import pytest
from packages.replay.src.biominer_phase13_evaluation_adapter import (
    PHASE13_EVALUATION_ADAPTER_SCHEMA_VERSION,
    SECTION_NAMES,
    Phase13ArtifactPaths,
    Phase13EvaluationAdapterError,
    adapt_reviewed_evaluation_evidence,
)

BIOMINER_SHA = "75461d9c065af0cd96b41cd1f845c2e920f7ae34"
ZERO_DIGEST = "sha256:" + "0" * 64

REVIEWED_LABEL_SCHEMA = {
    "schema_version": pl.String,
    "source": pl.String,
    "flickr_photo_id": pl.String,
    "detection_id": pl.String,
    "crop_hash": pl.String,
    "label_level": pl.String,
    "is_butterfly": pl.Boolean,
    "accepted_taxon_key": pl.String,
    "scientific_name": pl.String,
    "family_key": pl.String,
    "family": pl.String,
    "genus_key": pl.String,
    "genus": pl.String,
    "label_source": pl.String,
    "reviewer_id": pl.String,
    "reviewed_at": pl.String,
    "review_confidence": pl.String,
    "review_notes": pl.String,
    "target_present": pl.Boolean,
    "label_certainty": pl.String,
    "life_stage": pl.String,
    "visual_domain": pl.String,
    "view": pl.String,
    "route": pl.String,
    "geo_cluster_id": pl.String,
    "source_query_tier": pl.String,
    "source_query_term": pl.String,
    "duplicate_group_id": pl.String,
    "observer_owner_group_id": pl.String,
    "dataset_split": pl.String,
    "second_review_status": pl.String,
    "ambiguity_reason": pl.String,
    "unsuitable_for_species_identification": pl.Boolean,
}

METRIC_SCHEMA = {
    "schema_version": pl.String,
    "input_fingerprint": pl.String,
    "configuration_fingerprint": pl.String,
    "evaluation_set": pl.String,
    "scope": pl.String,
    "stratum_dimension": pl.String,
    "stratum_value": pl.String,
    "metric_family": pl.String,
    "metric_name": pl.String,
    "metric_value": pl.Float64,
    "numerator": pl.Float64,
    "denominator": pl.Float64,
    "undefined_reason": pl.String,
    "item_count": pl.UInt32,
    "weighted_item_count": pl.Float64,
    "target_item_count": pl.UInt32,
    "weighted_target_item_count": pl.Float64,
}

CALIBRATION_SCHEMA = {
    "schema_version": pl.String,
    "input_fingerprint": pl.String,
    "configuration_fingerprint": pl.String,
    "evaluation_set": pl.String,
    "probability_kind": pl.String,
    "calibration_method": pl.String,
    "calibration_split_fingerprint": pl.String,
    "calibrator_fingerprint": pl.String,
    "confidence_interval_method": pl.String,
    "confidence_level": pl.Float64,
    "bin_index": pl.UInt32,
    "bin_lower_bound": pl.Float64,
    "bin_upper_bound": pl.Float64,
    "evaluation_item_count": pl.UInt32,
    "probability_sample_count": pl.UInt32,
    "missing_probability_count": pl.UInt32,
    "weighted_evaluation_item_count": pl.Float64,
    "weighted_probability_sample_count": pl.Float64,
    "weighted_probability_coverage": pl.Float64,
    "item_count": pl.UInt32,
    "weighted_item_count": pl.Float64,
    "effective_sample_size": pl.Float64,
    "mean_predicted_probability": pl.Float64,
    "observed_target_rate": pl.Float64,
    "observed_rate_ci_lower": pl.Float64,
    "observed_rate_ci_upper": pl.Float64,
    "absolute_gap": pl.Float64,
    "ece_contribution": pl.Float64,
}

INTERVAL_SCHEMA = {
    "schema_version": pl.String,
    "input_fingerprint": pl.String,
    "metric_configuration_fingerprint": pl.String,
    "bootstrap_configuration_fingerprint": pl.String,
    "leakage_register_fingerprint": pl.String,
    "evaluation_set": pl.String,
    "metric_name": pl.String,
    "point_estimate": pl.Float64,
    "confidence_interval_lower": pl.Float64,
    "confidence_interval_upper": pl.Float64,
    "confidence_level": pl.Float64,
    "interval_method": pl.String,
    "interval_status": pl.String,
    "undefined_reason": pl.String,
    "bootstrap_replicates": pl.UInt32,
    "minimum_valid_replicates": pl.UInt32,
    "valid_replicates": pl.UInt32,
    "undefined_replicates": pl.UInt32,
    "independent_component_count": pl.UInt32,
    "minimum_component_size": pl.UInt32,
    "maximum_component_size": pl.UInt32,
    "random_seed": pl.UInt64,
    "improvement_claim_policy": pl.String,
}


def _reviewed_label() -> dict[str, object]:
    return {
        "schema_version": "reviewed-labels-v2",
        "source": "synthetic-test-fixture",
        "flickr_photo_id": "photo-1",
        "detection_id": "detection-1",
        "crop_hash": "sha256:" + "1" * 64,
        "label_level": "species",
        "is_butterfly": True,
        "accepted_taxon_key": "taxon-1",
        "scientific_name": "Papilio demoleus",
        "family_key": "family-1",
        "family": "Papilionidae",
        "genus_key": "genus-1",
        "genus": "Papilio",
        "label_source": "human_review",
        "reviewer_id": "synthetic-reviewer",
        "reviewed_at": "2026-07-14T00:00:00Z",
        "review_confidence": "high",
        "review_notes": "synthetic adapter fixture",
        "target_present": True,
        "label_certainty": "high",
        "life_stage": "adult",
        "visual_domain": "field",
        "view": "dorsal",
        "route": "adult_field",
        "geo_cluster_id": "geo-1",
        "source_query_tier": "T1",
        "source_query_term": "synthetic query",
        "duplicate_group_id": "duplicate-1",
        "observer_owner_group_id": "owner-1",
        "dataset_split": "final_test",
        "second_review_status": "completed",
        "ambiguity_reason": None,
        "unsuitable_for_species_identification": False,
    }


def _metric_row(dimension: str, value: str, metric_name: str) -> dict[str, object]:
    return {
        "schema_version": "target-verification-metric-v1.2.0",
        "input_fingerprint": ZERO_DIGEST,
        "configuration_fingerprint": ZERO_DIGEST,
        "evaluation_set": "balanced_challenge",
        "scope": "stratum",
        "stratum_dimension": dimension,
        "stratum_value": value,
        "metric_family": "selective_classification",
        "metric_name": metric_name,
        "metric_value": 0.8,
        "numerator": 8.0,
        "denominator": 10.0,
        "undefined_reason": None,
        "item_count": 10,
        "weighted_item_count": 10.0,
        "target_item_count": 5,
        "weighted_target_item_count": 5.0,
    }


def _calibration_row() -> dict[str, object]:
    return {
        "schema_version": "target-calibration-reliability-v1.0.0",
        "input_fingerprint": ZERO_DIGEST,
        "configuration_fingerprint": ZERO_DIGEST,
        "evaluation_set": "balanced_challenge",
        "probability_kind": "calibrated_target_probability",
        "calibration_method": "isotonic",
        "calibration_split_fingerprint": ZERO_DIGEST,
        "calibrator_fingerprint": ZERO_DIGEST,
        "confidence_interval_method": "kish_effective_n_wilson_score",
        "confidence_level": 0.95,
        "bin_index": 0,
        "bin_lower_bound": 0.0,
        "bin_upper_bound": 0.2,
        "evaluation_item_count": 10,
        "probability_sample_count": 10,
        "missing_probability_count": 0,
        "weighted_evaluation_item_count": 10.0,
        "weighted_probability_sample_count": 10.0,
        "weighted_probability_coverage": 1.0,
        "item_count": 2,
        "weighted_item_count": 2.0,
        "effective_sample_size": 2.0,
        "mean_predicted_probability": 0.1,
        "observed_target_rate": 0.0,
        "observed_rate_ci_lower": 0.0,
        "observed_rate_ci_upper": 0.6576,
        "absolute_gap": 0.1,
        "ece_contribution": 0.02,
    }


def _interval_row() -> dict[str, object]:
    return {
        "schema_version": "target-metric-confidence-interval-v1.0.0",
        "input_fingerprint": ZERO_DIGEST,
        "metric_configuration_fingerprint": ZERO_DIGEST,
        "bootstrap_configuration_fingerprint": ZERO_DIGEST,
        "leakage_register_fingerprint": ZERO_DIGEST,
        "evaluation_set": "balanced_challenge",
        "metric_name": "precision",
        "point_estimate": 0.9,
        "confidence_interval_lower": 0.8,
        "confidence_interval_upper": 0.98,
        "confidence_level": 0.95,
        "interval_method": "within-evaluation-set-identity-component-percentile",
        "interval_status": "available",
        "undefined_reason": None,
        "bootstrap_replicates": 2000,
        "minimum_valid_replicates": 1600,
        "valid_replicates": 2000,
        "undefined_replicates": 0,
        "independent_component_count": 5,
        "minimum_component_size": 1,
        "maximum_component_size": 3,
        "random_seed": 20260714,
        "improvement_claim_policy": "point_estimates_alone_do_not_establish_improvement",
    }


def _sha256(path: Path) -> str:
    return "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest()


def _artifact(path: Path, row_count: int) -> dict[str, object]:
    return {
        "path": str(path),
        "row_count": row_count,
        "byte_count": path.stat().st_size,
        "sha256": _sha256(path),
    }


def _metric_entry(value: float | None, reason: str | None = None) -> dict[str, object]:
    return {
        "value": value,
        "undefined_reason": reason,
        "confidence_interval_lower": None if value is None else max(0.0, value - 0.1),
        "confidence_interval_upper": None if value is None else min(1.0, value + 0.1),
        "confidence_level": 0.95,
        "interval_status": "undefined" if value is None else "available",
        "valid_replicates": 0 if value is None else 2000,
        "undefined_replicates": 2000 if value is None else 0,
    }


def _write_artifacts(tmp_path: Path, *, undefined_recall: bool = False) -> Phase13ArtifactPaths:
    reviewed = tmp_path / "reviewed_labels.parquet"
    metrics = tmp_path / "target_verification_metrics.parquet"
    calibration = tmp_path / "target_calibration_reliability.parquet"
    intervals = tmp_path / "target_metric_confidence_intervals.parquet"
    pl.DataFrame([_reviewed_label()], schema=REVIEWED_LABEL_SCHEMA).write_parquet(reviewed)
    pl.DataFrame(
        [
            _metric_row("geographic_cluster", "geo-1", "precision"),
            _metric_row("life_stage", "adult", "recall"),
            _metric_row("visual_domain", "field", "coverage"),
        ],
        schema=METRIC_SCHEMA,
    ).write_parquet(metrics)
    pl.DataFrame([_calibration_row()], schema=CALIBRATION_SCHEMA).write_parquet(calibration)
    pl.DataFrame([_interval_row()], schema=INTERVAL_SCHEMA).write_parquet(intervals)

    holdout_report = tmp_path / "frozen_evaluation_holdouts_report.json"
    holdout_report.write_text(
        json.dumps(
            {
                "schema_version": "frozen-evaluation-holdout-report-v1.1.0",
                "status": "complete",
                "git_sha": BIOMINER_SHA,
                "network_requests": 0,
                "balanced_challenge_rows": 12,
                "natural_stream_rows": 20,
                "balanced_counts_by_class": {"verified_target": 6, "other_papilio": 6},
                "natural_counts_by_class": {"verified_target": 4, "non_target": 16},
                "natural_weight_sum": 25.0,
                "leakage_validation": {
                    "status": "passed",
                    "register_fingerprint": ZERO_DIGEST,
                    "register_item_count": 40,
                    "reference_item_count": 8,
                    "balanced_challenge_item_count": 12,
                    "natural_stream_item_count": 20,
                    "coverage_by_dimension": {"exact_hash": 40},
                },
                "artifacts": {
                    "balanced_challenge": {
                        "path": "balanced_challenge_holdout.parquet",
                        "row_count": 12,
                        "byte_count": 100,
                        "sha256": ZERO_DIGEST,
                    },
                    "natural_stream": {
                        "path": "natural_stream_holdout.parquet",
                        "row_count": 20,
                        "byte_count": 100,
                        "sha256": ZERO_DIGEST,
                    },
                    "leakage_register": {
                        "path": "evaluation_leakage_register.parquet",
                        "row_count": 40,
                        "byte_count": 100,
                        "sha256": ZERO_DIGEST,
                    },
                },
            },
            sort_keys=True,
        ),
        encoding="utf-8",
    )

    metric_values = {
        "precision": _metric_entry(0.91),
        "recall": _metric_entry(None, "zero_denominator")
        if undefined_recall
        else _metric_entry(0.82),
        "pr_auc": _metric_entry(0.88),
        "coverage": _metric_entry(0.74),
        "abstention_rate": _metric_entry(0.26),
    }
    target_report = tmp_path / "target_verification_report.json"
    target_report.write_text(
        json.dumps(
            {
                "schema_version": "target-verification-report-v1.2.0",
                "status": "complete",
                "git_sha": BIOMINER_SHA,
                "network_requests": 0,
                "overall_metrics": {
                    "balanced_challenge": metric_values,
                    "natural_stream": metric_values,
                },
                "artifacts": {
                    "metrics": _artifact(metrics, 3),
                    "calibration_reliability": _artifact(calibration, 1),
                    "confidence_intervals": _artifact(intervals, 1),
                },
            },
            sort_keys=True,
        ),
        encoding="utf-8",
    )
    return Phase13ArtifactPaths(
        reviewed_labels=reviewed,
        frozen_holdout_report=holdout_report,
        target_verification_report=target_report,
        target_verification_metrics=metrics,
        calibration_reliability=calibration,
        confidence_intervals=intervals,
    )


def test_missing_phase13_artifacts_are_all_explicitly_unavailable() -> None:
    result = adapt_reviewed_evaluation_evidence(biominer_commit=BIOMINER_SHA)

    assert result["schema_version"] == PHASE13_EVALUATION_ADAPTER_SCHEMA_VERSION
    assert result["availability"]["available_count"] == 0
    assert result["availability"]["unavailable_count"] == len(SECTION_NAMES)
    assert tuple(result["sections"]) == SECTION_NAMES
    assert all(section["data"] is None for section in result["sections"].values())
    assert result["sections"]["competitor_confusion"]["scientific_claim_allowed"] is False
    assert result["adapter_policy"]["missing_outputs_invented"] is False


def test_adapts_verified_phase13_reports_and_companion_artifacts(tmp_path: Path) -> None:
    artifacts = _write_artifacts(tmp_path)
    result = adapt_reviewed_evaluation_evidence(
        biominer_commit=BIOMINER_SHA,
        artifacts=artifacts,
    )

    assert result["availability"] == {
        "available_count": 14,
        "unavailable_count": 1,
        "available_sections": [name for name in SECTION_NAMES if name != "competitor_confusion"],
        "unavailable_sections": ["competitor_confusion"],
    }
    sections = result["sections"]
    assert sections["reviewed_label_summary"]["data"]["row_count"] == 1
    assert sections["reviewed_label_summary"]["data"]["counts_by_target_present"] == {"true": 1}
    assert sections["challenge_set"]["data"]["row_count"] == 12
    assert sections["natural_stream_set"]["data"]["sampling_weight_sum"] == 25.0
    assert sections["leakage_audit"]["data"]["status"] == "passed"
    assert sections["precision"]["data"]["measurements"][0]["value"] == 0.91
    assert len(sections["calibration_bins"]["data"]["rows"]) == 1
    assert len(sections["grouped_confidence_intervals"]["data"]["rows"]) == 1
    assert sections["geographic_slices"]["data"]["rows"][0]["stratum_value"] == "geo-1"
    assert sections["life_stage_slices"]["data"]["rows"][0]["stratum_value"] == "adult"
    assert sections["visual_domain_slices"]["data"]["rows"][0]["stratum_value"] == "field"
    assert "does not publish" in sections["competitor_confusion"]["reason"]


def test_preserves_undefined_metric_without_replacing_it_with_zero(tmp_path: Path) -> None:
    artifacts = _write_artifacts(tmp_path, undefined_recall=True)
    result = adapt_reviewed_evaluation_evidence(
        biominer_commit=BIOMINER_SHA,
        artifacts=artifacts,
    )

    measurements = result["sections"]["recall"]["data"]["measurements"]
    assert measurements[0]["measurement_status"] == "undefined"
    assert measurements[0]["value"] is None
    assert measurements[0]["undefined_reason"] == "zero_denominator"


def test_rejects_companion_artifact_whose_digest_differs_from_report(tmp_path: Path) -> None:
    artifacts = _write_artifacts(tmp_path)
    assert artifacts.target_verification_metrics is not None
    with artifacts.target_verification_metrics.open("ab") as stream:
        stream.write(b"tamper")

    with pytest.raises(Phase13EvaluationAdapterError, match="SHA-256"):
        adapt_reviewed_evaluation_evidence(
            biominer_commit=BIOMINER_SHA,
            artifacts=artifacts,
        )


def test_rejects_companion_with_wrong_physical_schema_even_when_report_matches(
    tmp_path: Path,
) -> None:
    artifacts = _write_artifacts(tmp_path)
    assert artifacts.target_verification_metrics is not None
    assert artifacts.target_verification_report is not None
    metrics = pl.read_parquet(artifacts.target_verification_metrics).with_columns(
        pl.col("item_count").cast(pl.Int64)
    )
    metrics.write_parquet(artifacts.target_verification_metrics)
    report = json.loads(artifacts.target_verification_report.read_text(encoding="utf-8"))
    report["artifacts"]["metrics"] = _artifact(
        artifacts.target_verification_metrics,
        metrics.height,
    )
    artifacts.target_verification_report.write_text(json.dumps(report), encoding="utf-8")

    with pytest.raises(Phase13EvaluationAdapterError, match="physical schema"):
        adapt_reviewed_evaluation_evidence(
            biominer_commit=BIOMINER_SHA,
            artifacts=artifacts,
        )


def test_rejects_target_companion_without_authoritative_report(tmp_path: Path) -> None:
    metrics = tmp_path / "target_verification_metrics.parquet"
    pl.DataFrame(
        [_metric_row("life_stage", "adult", "recall")],
        schema=METRIC_SCHEMA,
    ).write_parquet(metrics)

    with pytest.raises(Phase13EvaluationAdapterError, match="require the explicit"):
        adapt_reviewed_evaluation_evidence(
            biominer_commit=BIOMINER_SHA,
            artifacts=Phase13ArtifactPaths(target_verification_metrics=metrics),
        )


@pytest.mark.parametrize(
    "field,value,match",
    [
        ("schema_version", "target-verification-report-v9", "unsupported"),
        ("git_sha", "1" * 40, "pinned commit"),
        ("status", "partial", "not complete"),
        ("network_requests", 1, "network requests"),
    ],
)
def test_rejects_untrusted_target_report_state(
    tmp_path: Path,
    field: str,
    value: object,
    match: str,
) -> None:
    report = tmp_path / "target_verification_report.json"
    payload = {
        "schema_version": "target-verification-report-v1.2.0",
        "status": "complete",
        "git_sha": BIOMINER_SHA,
        "network_requests": 0,
        "overall_metrics": {},
        "artifacts": {},
    }
    payload[field] = value
    report.write_text(json.dumps(payload), encoding="utf-8")

    with pytest.raises(Phase13EvaluationAdapterError, match=match):
        adapt_reviewed_evaluation_evidence(
            biominer_commit=BIOMINER_SHA,
            artifacts=Phase13ArtifactPaths(target_verification_report=report),
        )


def test_rejects_invalid_biominer_commit() -> None:
    with pytest.raises(Phase13EvaluationAdapterError, match="40-character"):
        adapt_reviewed_evaluation_evidence(biominer_commit="short")


def test_target_report_without_companions_does_not_invent_bins_or_slices(
    tmp_path: Path,
) -> None:
    artifacts = _write_artifacts(tmp_path)
    assert artifacts.target_verification_report is not None
    report_only = Phase13ArtifactPaths(
        target_verification_report=artifacts.target_verification_report
    )

    result = adapt_reviewed_evaluation_evidence(
        biominer_commit=BIOMINER_SHA,
        artifacts=report_only,
    )

    assert result["sections"]["precision"]["status"] == "available"
    for name in (
        "calibration_bins",
        "grouped_confidence_intervals",
        "geographic_slices",
        "life_stage_slices",
        "visual_domain_slices",
    ):
        assert result["sections"][name]["status"] == "unavailable"
        assert result["sections"][name]["data"] is None
