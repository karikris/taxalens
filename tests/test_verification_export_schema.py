from __future__ import annotations

import json
from pathlib import Path

from taxalens.product import validate_verification_schema

SOURCE_MANIFEST = Path("demo/source/verification/papilio-demoleus-commons.campaign.json")
BUNDLED_ITEMS = Path("demo/fixture/papilio_pilot/verification/items.json")
JUDGE_BUNDLE = Path("demo/fixture/papilio_pilot/judge_bundle.json")
VERIFICATION_SECTION_NAMES = (
    "verification_campaigns",
    "verification_items",
    "verification_media",
    "verification_decisions",
    "verification_quality",
)


def test_normalized_campaign_and_item_exports_validate_and_match() -> None:
    source = _read_json(SOURCE_MANIFEST)
    bundle_items = _read_json(BUNDLED_ITEMS)
    campaign = {
        **source["campaign"],
        "manifestSha256": source["manifestSha256"],
    }

    assert validate_verification_schema("campaign", campaign).valid

    source_items = sorted(
        (_normalize_source_item(item) for item in source["items"]),
        key=lambda item: item["itemId"],
    )
    projected_items = sorted(
        (_normalize_bundled_item(item) for item in bundle_items),
        key=lambda item: item["itemId"],
    )
    assert projected_items == source_items
    for item in (*source_items, *projected_items):
        validation = validate_verification_schema("item", item)
        assert validation.valid, validation


def test_exported_sections_validate_and_absence_remains_explicit() -> None:
    bundle = _read_json(JUDGE_BUNDLE)
    sections = {name: bundle["sections"][name] for name in VERIFICATION_SECTION_NAMES}

    validation = validate_verification_schema(
        "judge_bundle_verification_sections",
        sections,
    )

    assert validation.valid, validation
    expected_empty_artifacts = {
        "verification_decisions": (
            "geographic-verification-consensus",
            "verification_decisions",
        ),
        "verification_quality": (
            "geographic-release-decisions",
            "verification_quality",
        ),
    }
    artifacts = {artifact["artifact_id"]: artifact for artifact in bundle["artifact_inventory"]}
    for name, (artifact_id, role) in expected_empty_artifacts.items():
        section = sections[name]
        assert section["status"] == "partial"
        assert section["artifact_ids"] == [artifact_id]
        assert section["reason"]
        assert section["verification_status"] == "human_review_pending"
        assert section["human_review_required"] is True
        assert section["scientific_claim_allowed"] is False
        assert artifacts[artifact_id]["role"] == role
        assert artifacts[artifact_id]["record_count"] == 0


def _normalize_source_item(item: dict[str, object]) -> dict[str, object]:
    normalized = {
        key: value
        for key, value in item.items()
        if key not in {"previewAsset", "verificationLabel"}
    }
    normalized["previewUri"] = f"verification/media/{item['previewAsset']}"
    return normalized


def _normalize_bundled_item(item: dict[str, object]) -> dict[str, object]:
    return {
        key: value
        for key, value in item.items()
        if key
        not in {
            "mediaArtifactId",
            "previewAsset",
            "verificationLabel",
            "scientificClaimAllowed",
        }
    }


def _read_json(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))
