"""Adapt committed BioMiner Phase 13 evaluation evidence into TaxaLens sections.

The adapter consumes BioMiner's committed artifact contracts without importing
BioMiner runtime modules or recomputing scientific metrics. Missing artifacts and
undefined measurements remain explicit unavailable states.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from collections import Counter
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any, TypedDict

import polars as pl

from packages.replay.src.validation import is_full_git_sha

PHASE13_EVALUATION_ADAPTER_SCHEMA_VERSION = "taxalens-reviewed-evaluation-evidence:v1.0.0"
REVIEWED_LABEL_SCHEMA_VERSION = "reviewed-labels-v2"
FROZEN_HOLDOUT_REPORT_SCHEMA_VERSION = "frozen-evaluation-holdout-report-v1.1.0"
TARGET_VERIFICATION_REPORT_SCHEMA_VERSION = "target-verification-report-v1.2.0"
TARGET_VERIFICATION_METRIC_SCHEMA_VERSION = "target-verification-metric-v1.2.0"
TARGET_CALIBRATION_RELIABILITY_SCHEMA_VERSION = "target-calibration-reliability-v1.0.0"
TARGET_METRIC_CONFIDENCE_INTERVAL_SCHEMA_VERSION = "target-metric-confidence-interval-v1.0.0"

EVALUATION_SETS = ("balanced_challenge", "natural_stream")
SECTION_NAMES = (
    "reviewed_label_summary",
    "challenge_set",
    "natural_stream_set",
    "leakage_audit",
    "precision",
    "recall",
    "pr_auc",
    "coverage",
    "abstention",
    "calibration_bins",
    "competitor_confusion",
    "grouped_confidence_intervals",
    "geographic_slices",
    "life_stage_slices",
    "visual_domain_slices",
)

_SHA256_PATTERN = re.compile(r"sha256:[0-9a-f]{64}\Z")

_REVIEWED_LABEL_SCHEMA = {
    column: pl.String
    for column in {
        "schema_version",
        "source",
        "flickr_photo_id",
        "detection_id",
        "crop_hash",
        "label_level",
        "is_butterfly",
        "accepted_taxon_key",
        "scientific_name",
        "family_key",
        "family",
        "genus_key",
        "genus",
        "label_source",
        "reviewer_id",
        "reviewed_at",
        "review_confidence",
        "review_notes",
        "target_present",
        "label_certainty",
        "life_stage",
        "visual_domain",
        "view",
        "route",
        "geo_cluster_id",
        "source_query_tier",
        "source_query_term",
        "duplicate_group_id",
        "observer_owner_group_id",
        "dataset_split",
        "second_review_status",
        "ambiguity_reason",
        "unsuitable_for_species_identification",
    }
}
_REVIEWED_LABEL_SCHEMA.update(
    {
        "is_butterfly": pl.Boolean,
        "target_present": pl.Boolean,
        "unsuitable_for_species_identification": pl.Boolean,
    }
)

_TARGET_METRIC_SCHEMA = {
    column: pl.String
    for column in {
        "schema_version",
        "input_fingerprint",
        "configuration_fingerprint",
        "evaluation_set",
        "scope",
        "stratum_dimension",
        "stratum_value",
        "metric_family",
        "metric_name",
        "metric_value",
        "numerator",
        "denominator",
        "undefined_reason",
        "item_count",
        "weighted_item_count",
        "target_item_count",
        "weighted_target_item_count",
    }
}
_TARGET_METRIC_SCHEMA.update(
    {
        "metric_value": pl.Float64,
        "numerator": pl.Float64,
        "denominator": pl.Float64,
        "item_count": pl.UInt32,
        "weighted_item_count": pl.Float64,
        "target_item_count": pl.UInt32,
        "weighted_target_item_count": pl.Float64,
    }
)

_CALIBRATION_SCHEMA = {
    column: pl.String
    for column in {
        "schema_version",
        "input_fingerprint",
        "configuration_fingerprint",
        "evaluation_set",
        "probability_kind",
        "calibration_method",
        "calibration_split_fingerprint",
        "calibrator_fingerprint",
        "confidence_interval_method",
        "confidence_level",
        "bin_index",
        "bin_lower_bound",
        "bin_upper_bound",
        "evaluation_item_count",
        "probability_sample_count",
        "missing_probability_count",
        "weighted_evaluation_item_count",
        "weighted_probability_sample_count",
        "weighted_probability_coverage",
        "item_count",
        "weighted_item_count",
        "effective_sample_size",
        "mean_predicted_probability",
        "observed_target_rate",
        "observed_rate_ci_lower",
        "observed_rate_ci_upper",
        "absolute_gap",
        "ece_contribution",
    }
}
_CALIBRATION_SCHEMA.update(
    {
        column: pl.Float64
        for column in {
            "confidence_level",
            "bin_lower_bound",
            "bin_upper_bound",
            "weighted_evaluation_item_count",
            "weighted_probability_sample_count",
            "weighted_probability_coverage",
            "weighted_item_count",
            "effective_sample_size",
            "mean_predicted_probability",
            "observed_target_rate",
            "observed_rate_ci_lower",
            "observed_rate_ci_upper",
            "absolute_gap",
            "ece_contribution",
        }
    }
)
_CALIBRATION_SCHEMA.update(
    {
        column: pl.UInt32
        for column in {
            "bin_index",
            "evaluation_item_count",
            "probability_sample_count",
            "missing_probability_count",
            "item_count",
        }
    }
)

_CONFIDENCE_INTERVAL_SCHEMA = {
    column: pl.String
    for column in {
        "schema_version",
        "input_fingerprint",
        "metric_configuration_fingerprint",
        "bootstrap_configuration_fingerprint",
        "leakage_register_fingerprint",
        "evaluation_set",
        "metric_name",
        "point_estimate",
        "confidence_interval_lower",
        "confidence_interval_upper",
        "confidence_level",
        "interval_method",
        "interval_status",
        "undefined_reason",
        "bootstrap_replicates",
        "minimum_valid_replicates",
        "valid_replicates",
        "undefined_replicates",
        "independent_component_count",
        "minimum_component_size",
        "maximum_component_size",
        "random_seed",
        "improvement_claim_policy",
    }
}
_CONFIDENCE_INTERVAL_SCHEMA.update(
    {
        column: pl.Float64
        for column in {
            "point_estimate",
            "confidence_interval_lower",
            "confidence_interval_upper",
            "confidence_level",
        }
    }
)
_CONFIDENCE_INTERVAL_SCHEMA.update(
    {
        column: pl.UInt32
        for column in {
            "bootstrap_replicates",
            "minimum_valid_replicates",
            "valid_replicates",
            "undefined_replicates",
            "independent_component_count",
            "minimum_component_size",
            "maximum_component_size",
        }
    }
)
_CONFIDENCE_INTERVAL_SCHEMA["random_seed"] = pl.UInt64


class Phase13EvaluationAdapterError(ValueError):
    """Raised when supplied Phase 13 evidence violates a committed contract."""


class EvidenceSection(TypedDict):
    status: str
    reason: str | None
    scientific_claim_allowed: bool
    source_artifacts: list[dict[str, object]]
    data: object | None


@dataclass(frozen=True, slots=True)
class Phase13ArtifactPaths:
    """Explicit local paths to BioMiner Phase 13 artifacts; no discovery is performed."""

    reviewed_labels: Path | None = None
    frozen_holdout_report: Path | None = None
    target_verification_report: Path | None = None
    target_verification_metrics: Path | None = None
    calibration_reliability: Path | None = None
    confidence_intervals: Path | None = None


def adapt_reviewed_evaluation_evidence(
    *,
    biominer_commit: str,
    artifacts: Phase13ArtifactPaths | None = None,
) -> dict[str, object]:
    """Project only supplied and verified BioMiner evaluation artifacts."""

    if not is_full_git_sha(biominer_commit):
        raise Phase13EvaluationAdapterError(
            "biominer_commit must be a full 40-character hexadecimal SHA"
        )
    supplied = artifacts or Phase13ArtifactPaths()
    sections: dict[str, EvidenceSection] = {
        name: _unavailable("no committed BioMiner artifact was supplied for this section")
        for name in SECTION_NAMES
    }

    if supplied.reviewed_labels is not None:
        sections["reviewed_label_summary"] = _adapt_reviewed_label_summary(supplied.reviewed_labels)

    if supplied.frozen_holdout_report is not None:
        holdout_report, holdout_source = _load_report(
            supplied.frozen_holdout_report,
            schema_version=FROZEN_HOLDOUT_REPORT_SCHEMA_VERSION,
            biominer_commit=biominer_commit,
        )
        holdout_sections = _adapt_holdout_report(holdout_report, holdout_source)
        sections.update(holdout_sections)

    target_report: dict[str, Any] | None = None
    target_source: dict[str, object] | None = None
    if supplied.target_verification_report is not None:
        target_report, target_source = _load_report(
            supplied.target_verification_report,
            schema_version=TARGET_VERIFICATION_REPORT_SCHEMA_VERSION,
            biominer_commit=biominer_commit,
        )
        for section_name, metric_name in (
            ("precision", "precision"),
            ("recall", "recall"),
            ("pr_auc", "pr_auc"),
            ("coverage", "coverage"),
            ("abstention", "abstention_rate"),
        ):
            sections[section_name] = _adapt_overall_metric(
                target_report,
                target_source,
                metric_name=metric_name,
            )
        if supplied.target_verification_metrics is None:
            for name in (
                "geographic_slices",
                "life_stage_slices",
                "visual_domain_slices",
            ):
                sections[name] = _unavailable(
                    "the target-verification metrics companion was not supplied",
                    [target_source],
                )
        if supplied.calibration_reliability is None:
            sections["calibration_bins"] = _unavailable(
                "the calibration-reliability companion was not supplied",
                [target_source],
            )
        if supplied.confidence_intervals is None:
            sections["grouped_confidence_intervals"] = _unavailable(
                "the grouped confidence-interval companion was not supplied",
                [target_source],
            )

    if supplied.target_verification_metrics is not None:
        report, source = _require_target_report(target_report, target_source)
        metrics = _load_verified_parquet(
            supplied.target_verification_metrics,
            report=report,
            artifact_key="metrics",
            expected_schema=_TARGET_METRIC_SCHEMA,
            expected_schema_version=TARGET_VERIFICATION_METRIC_SCHEMA_VERSION,
        )
        metric_source = _parquet_source(
            supplied.target_verification_metrics,
            TARGET_VERIFICATION_METRIC_SCHEMA_VERSION,
            metrics.height,
        )
        sections["geographic_slices"] = _adapt_slices(
            metrics,
            metric_source,
            dimensions={"geographic_cluster", "country", "no_geo"},
            label="geographic",
        )
        sections["life_stage_slices"] = _adapt_slices(
            metrics,
            metric_source,
            dimensions={"life_stage"},
            label="life-stage",
        )
        sections["visual_domain_slices"] = _adapt_slices(
            metrics,
            metric_source,
            dimensions={"visual_domain"},
            label="visual-domain",
        )

    if supplied.calibration_reliability is not None:
        report, _ = _require_target_report(target_report, target_source)
        calibration = _load_verified_parquet(
            supplied.calibration_reliability,
            report=report,
            artifact_key="calibration_reliability",
            expected_schema=_CALIBRATION_SCHEMA,
            expected_schema_version=TARGET_CALIBRATION_RELIABILITY_SCHEMA_VERSION,
        )
        calibration_source = _parquet_source(
            supplied.calibration_reliability,
            TARGET_CALIBRATION_RELIABILITY_SCHEMA_VERSION,
            calibration.height,
        )
        sections["calibration_bins"] = _adapt_calibration_bins(
            calibration,
            calibration_source,
        )

    if supplied.confidence_intervals is not None:
        report, _ = _require_target_report(target_report, target_source)
        intervals = _load_verified_parquet(
            supplied.confidence_intervals,
            report=report,
            artifact_key="confidence_intervals",
            expected_schema=_CONFIDENCE_INTERVAL_SCHEMA,
            expected_schema_version=TARGET_METRIC_CONFIDENCE_INTERVAL_SCHEMA_VERSION,
        )
        interval_source = _parquet_source(
            supplied.confidence_intervals,
            TARGET_METRIC_CONFIDENCE_INTERVAL_SCHEMA_VERSION,
            intervals.height,
        )
        sections["grouped_confidence_intervals"] = _adapt_confidence_intervals(
            intervals,
            interval_source,
        )

    sections["competitor_confusion"] = _unavailable(
        "BioMiner target-verification-report-v1.2.0 does not publish a competitor "
        "confusion artifact"
    )
    available = tuple(name for name in SECTION_NAMES if sections[name]["status"] == "available")
    unavailable = tuple(name for name in SECTION_NAMES if name not in available)
    return {
        "schema_version": PHASE13_EVALUATION_ADAPTER_SCHEMA_VERSION,
        "biominer_commit": biominer_commit,
        "source_contracts": [
            REVIEWED_LABEL_SCHEMA_VERSION,
            FROZEN_HOLDOUT_REPORT_SCHEMA_VERSION,
            TARGET_VERIFICATION_REPORT_SCHEMA_VERSION,
            TARGET_VERIFICATION_METRIC_SCHEMA_VERSION,
            TARGET_CALIBRATION_RELIABILITY_SCHEMA_VERSION,
            TARGET_METRIC_CONFIDENCE_INTERVAL_SCHEMA_VERSION,
        ],
        "sections": sections,
        "availability": {
            "available_count": len(available),
            "unavailable_count": len(unavailable),
            "available_sections": list(available),
            "unavailable_sections": list(unavailable),
        },
        "adapter_policy": {
            "metrics_recomputed": False,
            "missing_outputs_invented": False,
            "remote_discovery_performed": False,
            "competitor_confusion_supported_by_source_contract": False,
        },
    }


def _adapt_reviewed_label_summary(path: Path) -> EvidenceSection:
    frame = _read_reviewed_labels(path)
    _require_physical_schema(
        frame,
        _REVIEWED_LABEL_SCHEMA,
        label="reviewed labels",
        allow_extra=True,
        allow_null=True,
    )
    _require_schema_version(frame, REVIEWED_LABEL_SCHEMA_VERSION, label="reviewed labels")
    data = {
        "schema_version": REVIEWED_LABEL_SCHEMA_VERSION,
        "row_count": frame.height,
        "counts_by_label_level": _counts(frame, "label_level"),
        "counts_by_dataset_split": _counts(frame, "dataset_split"),
        "counts_by_target_present": _counts(frame, "target_present"),
        "counts_by_label_certainty": _counts(frame, "label_certainty"),
        "counts_by_second_review_status": _counts(frame, "second_review_status"),
        "counts_by_life_stage": _counts(frame, "life_stage"),
        "counts_by_visual_domain": _counts(frame, "visual_domain"),
    }
    return _available(data, [_parquet_or_table_source(path, REVIEWED_LABEL_SCHEMA_VERSION, frame)])


def _adapt_holdout_report(
    report: Mapping[str, Any],
    source: dict[str, object],
) -> dict[str, EvidenceSection]:
    leakage = _mapping(report.get("leakage_validation"), "leakage_validation")
    if leakage.get("status") != "passed":
        raise Phase13EvaluationAdapterError("BioMiner holdout leakage validation did not pass")
    artifacts = _mapping(report.get("artifacts"), "artifacts")
    challenge_artifact = _report_artifact_metadata(artifacts, "balanced_challenge")
    natural_artifact = _report_artifact_metadata(artifacts, "natural_stream")
    leakage_artifact = _report_artifact_metadata(artifacts, "leakage_register")
    challenge_rows = _nonnegative_int(
        report.get("balanced_challenge_rows"), "balanced_challenge_rows"
    )
    natural_rows = _nonnegative_int(report.get("natural_stream_rows"), "natural_stream_rows")
    if challenge_artifact["row_count"] != challenge_rows:
        raise Phase13EvaluationAdapterError("balanced challenge report row counts disagree")
    if natural_artifact["row_count"] != natural_rows:
        raise Phase13EvaluationAdapterError("natural-stream report row counts disagree")
    challenge = {
        "evaluation_set": "balanced_challenge",
        "row_count": challenge_rows,
        "counts_by_class": _count_mapping(report.get("balanced_counts_by_class")),
        "artifact": challenge_artifact,
    }
    natural = {
        "evaluation_set": "natural_stream",
        "row_count": natural_rows,
        "counts_by_class": _count_mapping(report.get("natural_counts_by_class")),
        "sampling_weight_sum": _finite_number(
            report.get("natural_weight_sum"), "natural_weight_sum"
        ),
        "artifact": natural_artifact,
    }
    if sum(challenge["counts_by_class"].values()) != challenge_rows:
        raise Phase13EvaluationAdapterError("balanced challenge class counts disagree")
    if sum(natural["counts_by_class"].values()) != natural_rows:
        raise Phase13EvaluationAdapterError("natural-stream class counts disagree")
    leakage_register_count = _nonnegative_int(
        leakage.get("register_item_count"), "leakage_validation.register_item_count"
    )
    if leakage_artifact["row_count"] != leakage_register_count:
        raise Phase13EvaluationAdapterError("leakage-register report row counts disagree")
    partition_total = sum(
        _nonnegative_int(leakage.get(field), f"leakage_validation.{field}")
        for field in (
            "reference_item_count",
            "balanced_challenge_item_count",
            "natural_stream_item_count",
        )
    )
    if partition_total != leakage_register_count:
        raise Phase13EvaluationAdapterError("leakage partition counts disagree")
    leakage_data = {
        **dict(leakage),
        "artifact": leakage_artifact,
    }
    return {
        "challenge_set": _available(challenge, [source]),
        "natural_stream_set": _available(natural, [source]),
        "leakage_audit": _available(leakage_data, [source]),
    }


def _adapt_overall_metric(
    report: Mapping[str, Any],
    source: dict[str, object],
    *,
    metric_name: str,
) -> EvidenceSection:
    overall = _mapping(report.get("overall_metrics"), "overall_metrics")
    measurements: list[dict[str, object]] = []
    for evaluation_set in EVALUATION_SETS:
        raw_set = overall.get(evaluation_set)
        if not isinstance(raw_set, Mapping):
            measurements.append(
                {
                    "evaluation_set": evaluation_set,
                    "measurement_status": "unavailable",
                    "value": None,
                    "undefined_reason": "evaluation_set_missing_from_report",
                    "confidence_interval": None,
                }
            )
            continue
        raw_metric = raw_set.get(metric_name)
        if not isinstance(raw_metric, Mapping):
            measurements.append(
                {
                    "evaluation_set": evaluation_set,
                    "measurement_status": "unavailable",
                    "value": None,
                    "undefined_reason": "metric_missing_from_report",
                    "confidence_interval": None,
                }
            )
            continue
        value = _optional_finite_number(
            raw_metric.get("value"), f"{evaluation_set}.{metric_name}.value"
        )
        undefined_reason = _optional_text(raw_metric.get("undefined_reason"))
        interval = _embedded_interval(
            raw_metric,
            evaluation_set=evaluation_set,
            metric_name=metric_name,
        )
        measurements.append(
            {
                "evaluation_set": evaluation_set,
                "measurement_status": "available" if value is not None else "undefined",
                "value": value,
                "undefined_reason": undefined_reason,
                "confidence_interval": interval,
            }
        )
    if all(row["measurement_status"] == "unavailable" for row in measurements):
        return _unavailable(
            f"target-verification report contains no {metric_name} measurements",
            [source],
        )
    return _available(
        {"metric_name": metric_name, "measurements": measurements},
        [source],
    )


def _adapt_slices(
    metrics: pl.DataFrame,
    source: dict[str, object],
    *,
    dimensions: set[str],
    label: str,
) -> EvidenceSection:
    selected = metrics.filter(
        (pl.col("scope") == "stratum") & pl.col("stratum_dimension").is_in(sorted(dimensions))
    ).sort(["evaluation_set", "stratum_dimension", "stratum_value", "metric_name"])
    if selected.is_empty():
        return _unavailable(f"target metrics contain no {label} slice rows", [source])
    rows = [_metric_row(row) for row in selected.iter_rows(named=True)]
    return _available({"dimensions": sorted(dimensions), "rows": rows}, [source])


def _adapt_calibration_bins(
    calibration: pl.DataFrame,
    source: dict[str, object],
) -> EvidenceSection:
    if calibration.is_empty():
        return _unavailable("calibration reliability artifact contains no bins", [source])
    ordered = calibration.sort(["evaluation_set", "calibration_method", "bin_index"])
    rows: list[dict[str, object]] = []
    for row in ordered.iter_rows(named=True):
        normalized = dict(row)
        for field in (
            "bin_lower_bound",
            "bin_upper_bound",
            "weighted_probability_coverage",
            "mean_predicted_probability",
            "observed_target_rate",
            "observed_rate_ci_lower",
            "observed_rate_ci_upper",
            "absolute_gap",
            "ece_contribution",
        ):
            normalized[field] = _optional_finite_number(
                normalized[field], f"calibration_bins.{field}"
            )
        rows.append(normalized)
    return _available({"rows": rows}, [source])


def _adapt_confidence_intervals(
    intervals: pl.DataFrame,
    source: dict[str, object],
) -> EvidenceSection:
    if intervals.is_empty():
        return _unavailable("grouped confidence-interval artifact contains no rows", [source])
    ordered = intervals.sort(["evaluation_set", "metric_name"])
    rows: list[dict[str, object]] = []
    for row in ordered.iter_rows(named=True):
        normalized = dict(row)
        for field in (
            "point_estimate",
            "confidence_interval_lower",
            "confidence_interval_upper",
            "confidence_level",
        ):
            normalized[field] = _optional_finite_number(
                normalized[field], f"grouped_confidence_intervals.{field}"
            )
        normalized["measurement_status"] = (
            "available"
            if normalized["point_estimate"] is not None
            and normalized["interval_status"] == "available"
            else "undefined"
        )
        rows.append(normalized)
    return _available({"rows": rows}, [source])


def _metric_row(row: Mapping[str, Any]) -> dict[str, object]:
    return {
        "schema_version": row["schema_version"],
        "evaluation_set": row["evaluation_set"],
        "stratum_dimension": row["stratum_dimension"],
        "stratum_value": row["stratum_value"],
        "metric_family": row["metric_family"],
        "metric_name": row["metric_name"],
        "metric_value": _optional_finite_number(row["metric_value"], "metric_value"),
        "undefined_reason": row["undefined_reason"],
        "item_count": row["item_count"],
        "weighted_item_count": _finite_number(row["weighted_item_count"], "weighted_item_count"),
        "target_item_count": row["target_item_count"],
        "weighted_target_item_count": _finite_number(
            row["weighted_target_item_count"], "weighted_target_item_count"
        ),
    }


def _load_report(
    path: Path,
    *,
    schema_version: str,
    biominer_commit: str,
) -> tuple[dict[str, Any], dict[str, object]]:
    payload = _load_json_object(path)
    if payload.get("schema_version") != schema_version:
        raise Phase13EvaluationAdapterError(
            f"unsupported BioMiner report schema: {payload.get('schema_version')!r}"
        )
    if payload.get("status") != "complete":
        raise Phase13EvaluationAdapterError("BioMiner evaluation report is not complete")
    if payload.get("git_sha") != biominer_commit:
        raise Phase13EvaluationAdapterError(
            "BioMiner report Git SHA does not match the pinned commit"
        )
    if payload.get("network_requests") != 0:
        raise Phase13EvaluationAdapterError("BioMiner evaluation report used network requests")
    return payload, _json_source(path, schema_version)


def _load_verified_parquet(
    path: Path,
    *,
    report: Mapping[str, Any],
    artifact_key: str,
    expected_schema: Mapping[str, pl.DataType],
    expected_schema_version: str,
) -> pl.DataFrame:
    source = _regular_file(path)
    artifacts = _mapping(report.get("artifacts"), "artifacts")
    declared = _report_artifact_metadata(artifacts, artifact_key)
    actual_digest = _sha256_file(source)
    if declared["sha256"] != actual_digest:
        raise Phase13EvaluationAdapterError(
            f"{artifact_key} SHA-256 does not match the BioMiner report"
        )
    if declared["byte_count"] != source.stat().st_size:
        raise Phase13EvaluationAdapterError(
            f"{artifact_key} byte count does not match the BioMiner report"
        )
    try:
        frame = pl.read_parquet(source)
    except Exception as error:
        raise Phase13EvaluationAdapterError(
            f"cannot read {artifact_key} Parquet: {error}"
        ) from error
    _require_physical_schema(frame, expected_schema, label=artifact_key)
    _require_schema_version(frame, expected_schema_version, label=artifact_key)
    if declared["row_count"] != frame.height:
        raise Phase13EvaluationAdapterError(
            f"{artifact_key} row count does not match the BioMiner report"
        )
    return frame


def _read_reviewed_labels(path: Path) -> pl.DataFrame:
    source = _regular_file(path)
    try:
        if source.suffix.casefold() == ".parquet":
            return pl.read_parquet(source)
        if source.suffix.casefold() in {".jsonl", ".ndjson"}:
            return pl.read_ndjson(source)
        if source.suffix.casefold() == ".json":
            return pl.read_json(source)
    except Exception as error:
        raise Phase13EvaluationAdapterError(f"cannot read reviewed labels: {error}") from error
    raise Phase13EvaluationAdapterError(
        "reviewed labels must use BioMiner's .parquet, .jsonl, .ndjson, or .json formats"
    )


def _load_json_object(path: Path) -> dict[str, Any]:
    source = _regular_file(path)
    try:
        payload = json.loads(
            source.read_bytes(),
            object_pairs_hook=_reject_duplicate_keys,
            parse_constant=_reject_non_json_constant,
        )
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise Phase13EvaluationAdapterError(f"report is not strict UTF-8 JSON: {error}") from error
    if not isinstance(payload, dict):
        raise Phase13EvaluationAdapterError("BioMiner report must be a JSON object")
    return payload


def _require_target_report(
    report: dict[str, Any] | None,
    source: dict[str, object] | None,
) -> tuple[dict[str, Any], dict[str, object]]:
    if report is None or source is None:
        raise Phase13EvaluationAdapterError(
            "target-verification companion artifacts require the explicit BioMiner report"
        )
    return report, source


def _require_physical_schema(
    frame: pl.DataFrame,
    expected: Mapping[str, pl.DataType],
    *,
    label: str,
    allow_extra: bool = False,
    allow_null: bool = False,
) -> None:
    actual = dict(frame.schema)
    missing = sorted(set(expected) - set(actual))
    extra = [] if allow_extra else sorted(set(actual) - set(expected))
    mismatched = {
        column: {"expected": str(dtype), "actual": str(actual[column])}
        for column, dtype in expected.items()
        if column in actual
        and actual[column] != dtype
        and not (allow_null and actual[column] == pl.Null)
    }
    if missing or extra or mismatched:
        raise Phase13EvaluationAdapterError(
            f"{label} physical schema differs from the committed BioMiner contract; "
            f"missing={missing}, extra={extra}, mismatched={mismatched}"
        )


def _require_schema_version(frame: pl.DataFrame, expected: str, *, label: str) -> None:
    if frame.is_empty():
        return
    versions = set(frame["schema_version"].drop_nulls().to_list())
    if versions != {expected}:
        raise Phase13EvaluationAdapterError(
            f"{label} schema version differs from the committed BioMiner contract"
        )


def _report_artifact_metadata(
    artifacts: Mapping[str, Any],
    key: str,
) -> dict[str, object]:
    entry = _mapping(artifacts.get(key), f"artifacts.{key}")
    path = _required_text(entry.get("path"), f"artifacts.{key}.path")
    sha256 = _required_text(entry.get("sha256"), f"artifacts.{key}.sha256")
    if _SHA256_PATTERN.fullmatch(sha256) is None:
        raise Phase13EvaluationAdapterError(f"artifacts.{key}.sha256 is invalid")
    return {
        "path": path,
        "sha256": sha256,
        "byte_count": _nonnegative_int(entry.get("byte_count"), f"artifacts.{key}.byte_count"),
        "row_count": _nonnegative_int(entry.get("row_count"), f"artifacts.{key}.row_count"),
    }


def _embedded_interval(
    metric: Mapping[str, Any],
    *,
    evaluation_set: str,
    metric_name: str,
) -> dict[str, object] | None:
    fields = (
        "confidence_interval_lower",
        "confidence_interval_upper",
        "confidence_level",
        "interval_status",
        "valid_replicates",
        "undefined_replicates",
    )
    if not any(field in metric for field in fields):
        return None
    return {
        "lower": _optional_finite_number(
            metric.get("confidence_interval_lower"),
            f"{evaluation_set}.{metric_name}.confidence_interval_lower",
        ),
        "upper": _optional_finite_number(
            metric.get("confidence_interval_upper"),
            f"{evaluation_set}.{metric_name}.confidence_interval_upper",
        ),
        "confidence_level": _optional_finite_number(
            metric.get("confidence_level"),
            f"{evaluation_set}.{metric_name}.confidence_level",
        ),
        "status": _optional_text(metric.get("interval_status")),
        "valid_replicates": _optional_nonnegative_int(metric.get("valid_replicates")),
        "undefined_replicates": _optional_nonnegative_int(metric.get("undefined_replicates")),
    }


def _available(data: object, sources: list[dict[str, object]]) -> EvidenceSection:
    return {
        "status": "available",
        "reason": None,
        "scientific_claim_allowed": True,
        "source_artifacts": sources,
        "data": data,
    }


def _unavailable(
    reason: str,
    sources: list[dict[str, object]] | None = None,
) -> EvidenceSection:
    return {
        "status": "unavailable",
        "reason": reason,
        "scientific_claim_allowed": False,
        "source_artifacts": sources or [],
        "data": None,
    }


def _json_source(path: Path, schema_version: str) -> dict[str, object]:
    source = _regular_file(path)
    return {
        "path": str(source),
        "sha256": _sha256_file(source),
        "schema_versions": [schema_version],
        "row_count": None,
    }


def _parquet_source(path: Path, schema_version: str, row_count: int) -> dict[str, object]:
    source = _regular_file(path)
    return {
        "path": str(source),
        "sha256": _sha256_file(source),
        "schema_versions": [schema_version],
        "row_count": row_count,
    }


def _parquet_or_table_source(
    path: Path,
    schema_version: str,
    frame: pl.DataFrame,
) -> dict[str, object]:
    return _parquet_source(path, schema_version, frame.height)


def _regular_file(path: Path) -> Path:
    unresolved = Path(path)
    if unresolved.is_symlink():
        raise Phase13EvaluationAdapterError(f"artifact path must not be a symlink: {unresolved}")
    resolved = unresolved.resolve()
    if not resolved.is_file():
        raise Phase13EvaluationAdapterError(f"artifact is not a regular file: {resolved}")
    return resolved


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            digest.update(chunk)
    return "sha256:" + digest.hexdigest()


def _mapping(value: object, field: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise Phase13EvaluationAdapterError(f"{field} must be an object")
    return value


def _required_text(value: object, field: str) -> str:
    result = _optional_text(value)
    if result is None:
        raise Phase13EvaluationAdapterError(f"{field} must be a non-empty string")
    return result


def _optional_text(value: object) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str) or not value.strip():
        raise Phase13EvaluationAdapterError("expected a non-empty string or null")
    return value.strip()


def _nonnegative_int(value: object, field: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise Phase13EvaluationAdapterError(f"{field} must be a non-negative integer")
    return value


def _optional_nonnegative_int(value: object) -> int | None:
    if value is None:
        return None
    return _nonnegative_int(value, "optional integer")


def _finite_number(value: object, field: str) -> float:
    result = _optional_finite_number(value, field)
    if result is None:
        raise Phase13EvaluationAdapterError(f"{field} must be a finite number")
    return result


def _optional_finite_number(value: object, field: str) -> float | None:
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, int | float):
        raise Phase13EvaluationAdapterError(f"{field} must be a finite number or null")
    result = float(value)
    if not math.isfinite(result):
        raise Phase13EvaluationAdapterError(f"{field} must be finite")
    return result


def _count_mapping(value: object) -> dict[str, int]:
    mapping = _mapping(value, "class count mapping")
    result: dict[str, int] = {}
    for key, count in sorted(mapping.items()):
        result[str(key)] = _nonnegative_int(count, f"class count {key}")
    return result


def _counts(frame: pl.DataFrame, column: str) -> dict[str, int]:
    values = Counter(_count_key(value) for value in frame[column].to_list())
    return dict(sorted(values.items()))


def _count_key(value: object) -> str:
    if value is None:
        return "<null>"
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def _reject_duplicate_keys(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise Phase13EvaluationAdapterError(f"duplicate report key: {key}")
        result[key] = value
    return result


def _reject_non_json_constant(value: str) -> None:
    raise Phase13EvaluationAdapterError(f"non-JSON numeric constant in report: {value}")


__all__ = [
    "EVALUATION_SETS",
    "PHASE13_EVALUATION_ADAPTER_SCHEMA_VERSION",
    "Phase13ArtifactPaths",
    "Phase13EvaluationAdapterError",
    "SECTION_NAMES",
    "adapt_reviewed_evaluation_evidence",
]
