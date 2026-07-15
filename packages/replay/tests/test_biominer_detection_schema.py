from __future__ import annotations

from datetime import UTC, datetime

import polars as pl
import pytest

from packages.replay.src.biominer_detection_policy import DetectionPolicy
from packages.replay.src.biominer_detection_routing import DetectionRoutingPolicy
from packages.replay.src.biominer_detection_schema import (
    DETECTION_OUTPUT_SCHEMA,
    DETECTION_SCHEMA_VERSION,
    build_detection_rows,
    detection_id_for,
    empty_detection_frame,
)
from packages.replay.src.biominer_detector_base import DecodedImage, DetectionCandidate


def _image() -> DecodedImage:
    return DecodedImage(width=4, height=4, mode="RGB", data=b"\xff" * 48)


def _record(photo_id: str = "photo-1") -> dict[str, object]:
    return {
        "source": "flickr",
        "flickr_photo_id": photo_id,
        "source_record_hash": "sha256:source",
        "image_url": f"https://example.test/{photo_id}.jpg",
        "photo_page_url": f"https://example.test/{photo_id}",
    }


def _rows(
    detections: list[DetectionCandidate],
    *,
    record: dict[str, object] | None = None,
    policy: DetectionPolicy | None = None,
) -> list[dict[str, object]]:
    return build_detection_rows(
        record=dict(record or _record()),
        image=_image(),
        detections=detections,
        detector_backend="fake",
        detector_model_id="fake-detector",
        detector_model_version="v1",
        detector_checkpoint="checkpoint-a",
        detected_at=datetime(2026, 1, 1, tzinfo=UTC),
        policy=policy or DetectionPolicy(backend="fake", min_box_area_ratio=0.0),
    )


def test_empty_detection_frame_has_stable_complete_schema() -> None:
    frame = empty_detection_frame()

    assert frame.height == 0
    assert frame.schema == pl.Schema(DETECTION_OUTPUT_SCHEMA)
    assert frame.schema["mask_polygon_xyn"] == pl.List(pl.List(pl.Float64))
    assert DETECTION_SCHEMA_VERSION == "object-detection-v2"
    assert "detector_crop_mask" not in DETECTION_OUTPUT_SCHEMA
    assert "segmentation_crop_mask" not in DETECTION_OUTPUT_SCHEMA


def test_detection_id_is_stable_and_includes_normalized_prompt() -> None:
    base = {
        "source": "flickr",
        "flickr_photo_id": "photo-prompt",
        "detector_checkpoint": "checkpoint-a",
        "bbox_xyxyn": (0.0, 0.0, 1.0, 1.0),
        "detector_label": "possible_adult_butterfly",
    }

    assert detection_id_for(**base, detector_prompt="butterfly wing") != detection_id_for(
        **base, detector_prompt="lepidoptera"
    )
    assert detection_id_for(**base, detector_prompt=" Butterfly   Wing ") == detection_id_for(
        **base, detector_prompt="butterfly wing"
    )
    assert detection_id_for(**base).startswith("sha256:")


def test_detection_rows_keep_lineage_geometry_mask_and_routing_fields() -> None:
    polygon = ((0.125, 0.125), (0.875, 0.125), (0.5, 0.875))
    candidate = DetectionCandidate(
        label="adult_butterfly",
        score=0.91,
        bbox_xyxy=(0.5, 0.5, 3.5, 3.5),
        objectness_score=0.88,
        detector_prompt="butterfly",
        detector_class_id=0,
        detector_prompt_set_fingerprint="sha256:" + "a" * 64,
        mask_polygon_xyn=polygon,
    )

    row = _rows([candidate])[0]

    assert row["source"] == "flickr"
    assert row["flickr_photo_id"] == "photo-1"
    assert row["source_record_hash"] == "sha256:source"
    assert row["prediction_source"] == "object_detector:fake"
    assert row["bbox_xyxy"] == [0.5, 0.5, 3.5, 3.5]
    assert row["bbox_xyxyn"] == [0.125, 0.125, 0.875, 0.875]
    assert row["bbox_xywhn"] == [0.5, 0.5, 0.75, 0.75]
    assert row["mask_polygon_xyn"] == [list(point) for point in polygon]
    assert row["box_area_ratio"] == pytest.approx(0.5625)
    assert row["detector_prompt"] == "butterfly"
    assert row["detector_class_id"] == 0
    assert row["detection_route"] == "adult_butterfly_field"
    assert row["routing_action"] == "score"
    assert row["bioclip_route"] == "adult_field"
    assert row["schema_version"] == DETECTION_SCHEMA_VERSION
    assert row["detection_id"] == detection_id_for(
        source="flickr",
        flickr_photo_id="photo-1",
        detector_checkpoint="checkpoint-a",
        bbox_xyxyn=row["bbox_xyxyn"],
        detector_label="adult_butterfly",
        detector_prompt="butterfly",
    )
    assert pl.DataFrame([row], schema=DETECTION_OUTPUT_SCHEMA)["mask_polygon_xyn"].to_list() == [
        [list(point) for point in polygon]
    ]


def test_detection_rows_clamp_reversed_boxes_to_original_canvas() -> None:
    row = _rows(
        [DetectionCandidate(label="butterfly", score=0.9, bbox_xyxy=(5.0, 3.0, -1.0, 1.0))]
    )[0]

    assert row["bbox_xyxy"] == [0.0, 1.0, 4.0, 3.0]
    assert row["bbox_xyxyn"] == [0.0, 0.25, 1.0, 0.75]
    assert row["bbox_xywhn"] == [0.5, 0.5, 1.0, 0.5]
    assert row["box_area_ratio"] == 0.5


def test_no_detection_row_is_explicit_and_routed_as_excluded() -> None:
    row = _rows([])[0]

    assert row["detection_status"] == "no_detection"
    assert row["detector_label"] == "no_relevant_organism"
    assert row["failure_reason"] == "no_relevant_organism"
    assert row["bbox_xyxy"] == []
    assert row["routing_action"] == "exclude"
    assert row["detection_route"] == "no_relevant_organism"
    assert row["crop_storage_policy"] == "not_created"
    assert row["detected_at"] == "2026-01-01T00:00:00+00:00"


def test_candidate_prompt_fingerprint_falls_back_to_batch_fingerprint() -> None:
    fingerprint = "sha256:" + "b" * 64
    rows = build_detection_rows(
        record=_record(),
        image=_image(),
        detections=[
            DetectionCandidate(
                label="butterfly",
                score=0.9,
                bbox_xyxy=(0.0, 0.0, 2.0, 2.0),
            )
        ],
        detector_backend="fake",
        detector_model_id="fake-detector",
        detector_model_version="v1",
        detector_checkpoint="checkpoint-a",
        detector_prompt_set_fingerprint=fingerprint,
        detected_at="recorded-time",
        policy=DetectionPolicy(backend="fake", min_box_area_ratio=0.0),
    )

    assert rows[0]["detector_prompt_set_fingerprint"] == fingerprint
    assert rows[0]["detected_at"] == "recorded-time"


def test_detection_filter_applies_score_area_and_max_box_limits() -> None:
    policy = DetectionPolicy(
        backend="fake",
        box_score_threshold=0.5,
        min_box_area_ratio=0.1,
        max_boxes_per_image=1,
        nms_iou_threshold=1.0,
    )
    rows = _rows(
        [
            DetectionCandidate(label="butterfly", score=0.4, bbox_xyxy=(0, 0, 4, 4)),
            DetectionCandidate(label="butterfly", score=0.8, bbox_xyxy=(0, 0, 1, 1)),
            DetectionCandidate(label="butterfly", score=0.7, bbox_xyxy=(0, 0, 3, 3)),
            DetectionCandidate(label="butterfly", score=0.9, bbox_xyxy=(1, 1, 4, 4)),
        ],
        policy=policy,
    )

    assert len(rows) == 1
    assert rows[0]["detector_score"] == 0.9


def test_nms_suppresses_overlap_only_within_the_same_route_identity() -> None:
    policy = DetectionPolicy(
        backend="fake",
        min_box_area_ratio=0.0,
        nms_iou_threshold=0.5,
        routing_policy=DetectionRoutingPolicy(ambiguous_insect_review_threshold=0.2),
    )
    rows = _rows(
        [
            DetectionCandidate(
                label="adult_butterfly",
                score=0.95,
                bbox_xyxy=(0, 0, 3, 3),
                detector_prompt="butterfly",
            ),
            DetectionCandidate(
                label="adult_butterfly",
                score=0.80,
                bbox_xyxy=(0.2, 0.2, 3.2, 3.2),
                detector_prompt="butterfly",
            ),
            DetectionCandidate(
                label="insect_like",
                score=0.70,
                bbox_xyxy=(0.2, 0.2, 3.2, 3.2),
                detector_prompt="insect",
            ),
        ],
        policy=policy,
    )

    assert [(row["detector_score"], row["routing_action"]) for row in rows] == [
        (0.95, "score"),
        (0.70, "review"),
    ]


def test_detection_rows_require_record_identity() -> None:
    with pytest.raises(ValueError, match="flickr_photo_id"):
        build_detection_rows(
            record={"source": "flickr"},
            image=_image(),
            detections=[],
            detector_backend="fake",
            detector_model_id="fake-detector",
            detector_model_version="v1",
            detector_checkpoint="checkpoint-a",
        )
