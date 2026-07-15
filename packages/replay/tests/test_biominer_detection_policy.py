from __future__ import annotations

from dataclasses import replace

import pytest

from packages.replay.src.biominer_detection_policy import (
    DetectionPolicy,
    DetectionRunPolicy,
    MAC_M5PRO_64GB_SETTINGS,
    VisionRuntimeSettings,
    detection_is_bioclip_eligible,
    runtime_profile,
    validate_vision_runtime_settings,
    vision_runtime_settings,
)
from packages.replay.src.biominer_detection_routing import DetectionRoutingPolicy


def _row(
    prompt: str | None = "butterfly",
    *,
    label: str = "butterfly_like",
    score: object = 0.9,
    status: str = "detected",
) -> dict[str, object]:
    return {
        "detection_status": status,
        "detector_label": label,
        "detector_score": score,
        "detector_prompt": prompt,
    }


def test_detection_policy_defaults_match_object_pipeline_profile() -> None:
    policy = DetectionPolicy()
    run_policy = DetectionRunPolicy()

    assert policy.backend == "yoloe26"
    assert policy.box_score_threshold == 0.20
    assert policy.nms_iou_threshold == 0.50
    assert policy.max_boxes_per_image == 8
    assert policy.crop_target_px == 336
    assert run_policy.download_workers == 4
    assert run_policy.detector_workers == 1
    assert run_policy.max_inflight_images == 32
    assert run_policy.crop_batch_size == 24
    assert run_policy.adaptive_batching is False
    assert run_policy.min_detector_batch_size == 1
    assert run_policy.create_crop_metadata is True


def test_vision_runtime_settings_bridge_existing_detection_policies() -> None:
    settings = VisionRuntimeSettings(
        profile_name="test_profile",
        device="mps",
        yolo_checkpoint="yoloe-26s-seg.pt",
        yolo_imgsz=768,
        yolo_conf=0.25,
        yolo_iou=0.45,
        yolo_max_det=6,
        possible_adult_route_threshold=0.25,
        ambiguous_insect_review_threshold=0.25,
        detector_batch_size=16,
        crop_batch_size=24,
        crop_padding_ratio=0.08,
        crop_target_px=336,
        bioclip_model="hf-hub:imageomics/bioclip-2.5-vith14",
        bioclip_top_k=10,
        parquet_compression="zstd",
        parquet_part_rows=2048,
        delete_images_after_commit=True,
        retain_debug_crops=False,
        debug_crop_limit=12,
    )

    detection = settings.to_detection_policy(DetectionPolicy(backend="fake", min_box_area_ratio=0.01))
    runtime = settings.to_detection_run_policy(DetectionRunPolicy(download_workers=2, max_inflight_images=5))
    target_runtime = settings.to_detection_run_policy(DetectionRunPolicy(create_crop_metadata=False))

    assert detection.backend == "fake"
    assert detection.box_score_threshold == 0.25
    assert detection.nms_iou_threshold == 0.45
    assert detection.min_box_area_ratio == 0.01
    assert detection.max_boxes_per_image == 6
    assert detection.crop_padding_ratio == 0.08
    assert detection.crop_target_px == 336
    assert detection.retain_debug_crops is False
    assert detection.debug_crop_limit == 12
    assert runtime.download_workers == 2
    assert runtime.max_inflight_images == 5
    assert runtime.detector_batch_size == 16
    assert runtime.crop_batch_size == 24
    assert runtime.parquet_batch_rows == 2048
    assert runtime.adaptive_batching is False
    assert target_runtime.create_crop_metadata is False


def test_vision_runtime_settings_validate_overrides_and_adaptive_fields() -> None:
    settings = VisionRuntimeSettings().with_overrides(
        adaptive_batching=True,
        detector_batch_size=8,
        crop_batch_size=12,
        min_detector_batch_size=2,
        max_detector_batch_size=16,
        min_crop_batch_size=3,
        max_crop_batch_size=24,
        yolo_sidecar_transport="image_path",
        mps_memory_safety_margin_mb=1024,
    )

    assert validate_vision_runtime_settings(settings) == settings
    assert settings.adaptive_batching is True
    assert settings.min_detector_batch_size == 2
    assert settings.max_crop_batch_size == 24
    assert settings.yolo_sidecar_transport == "image_path"
    assert settings.mps_memory_safety_margin_mb == 1024


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"detector_batch_size": 0}, "detector_batch_size"),
        ({"crop_batch_size": 25}, "crop_batch_size"),
        ({"min_detector_batch_size": 9, "max_detector_batch_size": 4}, "min_detector_batch_size"),
        ({"crop_padding_ratio": 0.75}, "crop_padding_ratio"),
        ({"crop_target_px": 0}, "crop_target_px"),
        ({"yolo_sidecar_transport": "pipe_dream"}, "yolo_sidecar_transport"),
        ({"not_a_setting": True}, "unknown vision runtime setting"),
    ],
)
def test_vision_runtime_settings_reject_invalid_overrides(
    overrides: dict[str, object], message: str
) -> None:
    with pytest.raises(ValueError, match=message):
        VisionRuntimeSettings().with_overrides(**overrides)


def test_none_overrides_leave_existing_values_unchanged() -> None:
    settings = VisionRuntimeSettings(device="cpu")
    assert settings.with_overrides(device=None) == settings


def test_detection_policy_and_runtime_settings_carry_routing_policy() -> None:
    routing = DetectionRoutingPolicy(
        version="custom-routing-v2",
        possible_adult_route_enabled=False,
        possible_adult_route_threshold=0.5,
        ambiguous_insect_review_enabled=False,
        ambiguous_insect_review_threshold=0.6,
    )
    detection = DetectionPolicy(routing_policy=routing)
    settings = VisionRuntimeSettings(
        possible_adult_route_enabled=True,
        possible_adult_route_threshold=0.45,
        ambiguous_insect_review_enabled=True,
        ambiguous_insect_review_threshold=0.55,
    )

    bridged = settings.to_detection_policy(detection)

    assert bridged.routing_policy == DetectionRoutingPolicy(
        version="custom-routing-v2",
        possible_adult_route_enabled=True,
        possible_adult_route_threshold=0.45,
        ambiguous_insect_review_enabled=True,
        ambiguous_insect_review_threshold=0.55,
    )


def test_runtime_settings_require_detector_floor_at_or_below_enabled_route_thresholds() -> None:
    assert validate_vision_runtime_settings(
        VisionRuntimeSettings(
            yolo_conf=0.35,
            possible_adult_route_threshold=0.35,
            ambiguous_insect_review_threshold=0.35,
        )
    ).yolo_conf == 0.35

    with pytest.raises(ValueError, match="possible_adult_route_threshold"):
        validate_vision_runtime_settings(
            VisionRuntimeSettings(yolo_conf=0.36, possible_adult_route_threshold=0.35)
        )
    with pytest.raises(ValueError, match="ambiguous_insect_review_threshold"):
        validate_vision_runtime_settings(
            VisionRuntimeSettings(
                yolo_conf=0.36,
                possible_adult_route_enabled=False,
                ambiguous_insect_review_threshold=0.35,
            )
        )

    assert validate_vision_runtime_settings(
        VisionRuntimeSettings(
            yolo_conf=0.8,
            possible_adult_route_enabled=False,
            possible_adult_route_threshold=0.1,
            ambiguous_insect_review_enabled=False,
            ambiguous_insect_review_threshold=0.1,
        )
    ).yolo_conf == 0.8


@pytest.mark.parametrize(
    ("changes", "message"),
    [
        ({"yolo_imgsz": 0}, "yolo_imgsz"),
        ({"debug_crop_limit": -1}, "debug_crop_limit"),
        ({"mps_memory_safety_margin_mb": 0}, "mps_memory_safety_margin_mb"),
        ({"min_crop_batch_size": 4, "max_crop_batch_size": 3}, "min_crop_batch_size"),
        ({"yolo_conf": -0.1}, "yolo_conf"),
        ({"yolo_iou": 1.1}, "yolo_iou"),
    ],
)
def test_runtime_settings_validate_remaining_numeric_boundaries(
    changes: dict[str, object], message: str
) -> None:
    with pytest.raises(ValueError, match=message):
        validate_vision_runtime_settings(replace(VisionRuntimeSettings(), **changes))


def test_detection_eligibility_uses_route_action_and_never_crosses_route_domains() -> None:
    policy = DetectionPolicy()

    assert detection_is_bioclip_eligible(_row("butterfly"), policy) is True
    assert detection_is_bioclip_eligible(_row("caterpillar", label="caterpillar"), policy) is True
    assert detection_is_bioclip_eligible(_row("pinned butterfly specimen"), policy) is True
    assert detection_is_bioclip_eligible(_row("insect", label="insect_like"), policy) is True
    assert detection_is_bioclip_eligible(_row("pupa", label="pupa"), policy) is False
    assert detection_is_bioclip_eligible(_row("moth", label="moth_like"), policy) is False
    assert detection_is_bioclip_eligible(_row("drawing", label="hard_negative"), policy) is False
    assert detection_is_bioclip_eligible(_row(None, status="no_detection"), policy) is False


def test_detection_eligibility_honours_persisted_route_action() -> None:
    assert detection_is_bioclip_eligible({"detection_status": "detected", "routing_action": "score"}) is True
    assert detection_is_bioclip_eligible({"detection_status": "detected", "routing_action": "review"}) is True
    assert detection_is_bioclip_eligible({"detection_status": "detected", "routing_action": "exclude"}) is False
    assert detection_is_bioclip_eligible({"detection_status": "detected", "routing_action": "unknown"}) is False
    assert detection_is_bioclip_eligible({"detection_status": "no_detection", "routing_action": "score"}) is False


def test_mac_m5pro_profile_preserves_single_accelerator_worker_defaults() -> None:
    profile = runtime_profile("mac_m5pro_64gb")
    settings = vision_runtime_settings("mac_m5pro_64gb")

    assert settings == MAC_M5PRO_64GB_SETTINGS
    assert settings.device == "mps"
    assert settings.yolo_imgsz == 768
    assert settings.detector_batch_size == 16
    assert settings.crop_batch_size == 24
    assert settings.bioclip_model == "hf-hub:imageomics/bioclip-2.5-vith14"
    assert profile.detection_policy.image_max_side_px == 1280
    assert profile.run_policy.detector_workers == 1
    assert profile.bioclip_workers == 1
    assert profile.run_policy.max_inflight_images == 32
    assert profile.worker_shard_target_mb == 64
    assert profile.compacted_shard_target_mb == 256


def test_unknown_runtime_profile_fails_with_known_profile_names() -> None:
    with pytest.raises(ValueError, match="mac_m5pro_64gb"):
        runtime_profile("unknown")
