import json
import math
import statistics
from pathlib import Path

import pytest

REFERENCE_PATH = (
    Path(__file__).resolve().parents[3]
    / "demo"
    / "source"
    / "verification"
    / "target-precision-reference.json"
)


def test_committed_target_precision_reference() -> None:
    reference = json.loads(REFERENCE_PATH.read_text(encoding="utf-8"))
    confidence = reference["confidenceLevel"]
    z = statistics.NormalDist().inv_cdf(0.5 + confidence / 2)

    for row in reference["wilson"]:
        lower, upper = _wilson(
            row["successCount"],
            row["sampleCount"],
            z,
        )
        assert lower == pytest.approx(row["lower"], abs=1e-12)
        assert upper == pytest.approx(row["upper"], abs=1e-12)

    weights = reference["weighted"]["analysisWeights"]
    outcomes = reference["weighted"]["outcomes"]
    estimate = sum(
        weight * outcome for weight, outcome in zip(weights, outcomes, strict=True)
    ) / sum(weights)
    effective_sample_size = sum(weights) ** 2 / sum(
        weight * weight for weight in weights
    )
    assert estimate == pytest.approx(reference["weighted"]["estimate"], abs=1e-12)
    assert effective_sample_size == pytest.approx(
        reference["weighted"]["effectiveSampleSize"],
        abs=1e-12,
    )


def _wilson(successes: int, sample_count: int, z: float) -> tuple[float, float]:
    proportion = successes / sample_count
    denominator = 1 + z * z / sample_count
    center = (proportion + z * z / (2 * sample_count)) / denominator
    half_width = z / denominator * math.sqrt(
        proportion * (1 - proportion) / sample_count
        + z * z / (4 * sample_count * sample_count)
    )
    return max(0.0, center - half_width), min(1.0, center + half_width)
