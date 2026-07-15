from __future__ import annotations

from dataclasses import FrozenInstanceError

import pytest

from packages.replay.src.biominer_detector_base import (
    COARSE_DETECTOR_LABELS,
    DecodedImage,
    DetectionCandidate,
    FakeObjectDetector,
    detector_label_is_taxon_like,
    normalize_detector_label,
    normalize_detector_prompt,
    normalize_mask_polygon_xyn,
)


def _image() -> DecodedImage:
    return DecodedImage(width=2, height=2, mode="RGB", data=b"\x00" * 12)


def _candidate(*, mask_polygon_xyn=None, **overrides) -> DetectionCandidate:  # noqa: ANN001
    values = {
        "label": "butterfly_like",
        "score": 0.91,
        "bbox_xyxy": (0.0, 0.0, 2.0, 2.0),
        "mask_polygon_xyn": mask_polygon_xyn,
        **overrides,
    }
    return DetectionCandidate(**values)


def test_decoded_image_requires_positive_rgb_dimensions_and_exact_data() -> None:
    assert _image().source_uri is None
    with pytest.raises(ValueError, match="positive"):
        DecodedImage(width=0, height=2, mode="RGB", data=b"")
    with pytest.raises(ValueError, match="RGB bytes only"):
        DecodedImage(width=2, height=2, mode="RGBA", data=b"\x00" * 16)
    with pytest.raises(ValueError, match="does not match expected 12"):
        DecodedImage(width=2, height=2, mode="RGB", data=b"\x00" * 11)


def test_detection_candidate_contract_normalizes_legacy_labels_and_rejects_taxa() -> None:
    assert {
        "adult_butterfly",
        "possible_adult_butterfly",
        "pinned_specimen",
        "artifact",
        "no_relevant_organism",
    }.issubset(COARSE_DETECTOR_LABELS)
    assert normalize_detector_label("butterfly") == "butterfly_like"
    assert normalize_detector_label("life stage") == "caterpillar"
    assert normalize_detector_label("museum label") == "artifact"
    assert DetectionCandidate(label="butterfly", score=0.9, bbox_xyxy=(0, 0, 1, 1)).label == "butterfly_like"
    with pytest.raises(ValueError, match="taxonomic"):
        DetectionCandidate(label="Papilio demoleus", score=0.9, bbox_xyxy=(0, 0, 1, 1))


def test_detector_label_validation_rejects_unknown_non_taxonomic_labels() -> None:
    assert detector_label_is_taxon_like("Papilio demoleus") is True
    assert detector_label_is_taxon_like("butterfly") is False
    with pytest.raises(ValueError, match="coarse object label"):
        normalize_detector_label("vehicle")


def test_detection_candidate_normalizes_prompt_and_validates_class_id() -> None:
    candidate = _candidate(detector_prompt=" Butterfly   Wing ", detector_class_id=0)
    assert candidate.detector_prompt == "butterfly wing"
    with pytest.raises(ValueError, match="non-negative integer"):
        _candidate(detector_class_id=True)
    with pytest.raises(ValueError, match="non-negative integer"):
        _candidate(detector_class_id=-1)


def test_detector_prompt_must_be_non_empty() -> None:
    assert normalize_detector_prompt("  PINNED   specimen ") == "pinned specimen"
    with pytest.raises(ValueError, match="non-empty"):
        normalize_detector_prompt("  ")


def test_detection_candidate_validates_prompt_set_fingerprint() -> None:
    fingerprint = "sha256:" + "a" * 64
    assert _candidate(detector_prompt_set_fingerprint=fingerprint).detector_prompt_set_fingerprint == fingerprint
    with pytest.raises(ValueError, match="sha256 fingerprint"):
        _candidate(detector_prompt_set_fingerprint="sha256:short")
    with pytest.raises(ValueError, match="sha256 fingerprint"):
        _candidate(detector_prompt_set_fingerprint="sha256:" + "z" * 64)


def test_detection_candidate_canonicalizes_mask_polygon_as_immutable_normalized_metadata() -> None:
    mutable_polygon = [[0.1000004, 0.2], [0.9, 0.2], [0.5, 0.8]]

    candidate = _candidate(mask_polygon_xyn=mutable_polygon)
    mutable_polygon[0][0] = 0.7

    assert candidate.mask_polygon_xyn == ((0.1, 0.2), (0.9, 0.2), (0.5, 0.8))
    with pytest.raises(FrozenInstanceError):
        candidate.mask_polygon_xyn = None  # type: ignore[misc]


@pytest.mark.parametrize(
    "polygon",
    (
        [[0.1, 0.2], [0.9, 0.2]],
        [[-0.1, 0.2], [0.9, 0.2], [0.5, 0.8]],
        [[0.1, 0.2], [0.9, float("inf")], [0.5, 0.8]],
        [[True, 0.2], [0.9, 0.2], [0.5, 0.8]],
        [["bad", 0.2], [0.9, 0.2], [0.5, 0.8]],
        [[0.1], [0.9, 0.2], [0.5, 0.8]],
        "not-a-polygon",
    ),
)
def test_detection_candidate_rejects_invalid_normalized_mask_polygon(polygon) -> None:  # noqa: ANN001
    with pytest.raises(ValueError, match="mask_polygon_xyn"):
        _candidate(mask_polygon_xyn=polygon)


def test_mask_polygon_accepts_array_like_values_and_normalizes_signed_zero() -> None:
    class ArrayLike:
        def tolist(self):  # noqa: ANN201
            return [[-0.0, 0.0], [1.0, 0.0], [0.5, 1.0]]

    assert normalize_mask_polygon_xyn(ArrayLike()) == ((0.0, 0.0), (1.0, 0.0), (0.5, 1.0))
    assert normalize_mask_polygon_xyn([]) is None
    assert normalize_mask_polygon_xyn(None) is None


def test_fake_detector_returns_configured_batches_and_empty_fallbacks() -> None:
    first = _candidate(label="butterfly")
    second = _candidate(label="life_stage")
    detector = FakeObjectDetector([[first], [second]])

    detections = detector.detect_batch([_image(), _image(), _image()])

    assert detector.backend == "fake"
    assert detector.model_id == "fake-detector"
    assert [len(batch) for batch in detections] == [1, 1, 0]
    assert detections[1][0].label == "caterpillar"


def test_fake_detector_copies_input_and_output_batches() -> None:
    candidate = _candidate()
    configured = [[candidate]]
    detector = FakeObjectDetector(configured)
    configured[0].clear()

    first = detector.detect_batch([_image()])
    first[0].clear()

    assert detector.detect_batch([_image()]) == [[candidate]]
