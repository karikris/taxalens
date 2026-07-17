from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path
from typing import Any

import pytest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = ROOT / "scripts/build_geographic_milestone_readiness.py"
CAMPAIGN_PATH = (
    ROOT / "demo/source/verification/papilio-demoleus-flickr-audit.campaign.json"
)
QUALITY_PATH = (
    ROOT
    / "demo/source/verification/papilio-demoleus-flickr-geographic-quality.snapshot.json"
)
READINESS_PATH = (
    ROOT
    / "demo/source/verification/papilio-demoleus-flickr-geographic-milestone-readiness.json"
)

spec = importlib.util.spec_from_file_location("geographic_milestone_readiness", SCRIPT_PATH)
assert spec is not None and spec.loader is not None
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def read(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_committed_readiness_is_ready_but_not_achieved() -> None:
    readiness = read(READINESS_PATH)
    rebuilt = module.build_readiness(
        read(CAMPAIGN_PATH),
        read(QUALITY_PATH),
        campaign_sha256=digest(CAMPAIGN_PATH),
        quality_snapshot_sha256=digest(QUALITY_PATH),
    )

    assert readiness == rebuilt
    assert readiness["status"] == "ready_for_import"
    assert readiness["structuralImportReady"] is True
    assert readiness["milestoneAchieved"] is False
    assert readiness["currentRetainedDecisiveItemCount"] == 0
    assert readiness["remainingDecisiveItemCount"] == 20
    assert readiness["availableBoundItemCount"] == 49
    assert readiness["scientificClaimAllowed"] is False
    assert "never count" in readiness["syntheticFixturePolicy"]


def test_synthetic_twenty_proves_capacity_without_counting_as_evidence() -> None:
    campaign = read(CAMPAIGN_PATH)
    events, consensus = synthetic_batch(campaign, 20)
    result = module.validate_milestone_import_batch(
        campaign,
        events,
        consensus,
        evidence_class="synthetic_fixture",
    )

    assert result["status"] == "validated"
    assert result["decisiveItemCount"] == 20
    assert result["countsTowardPublicMilestone"] is False
    assert result["weightedDecisiveOwnerTotal"] > 20
    assert len(result["representedGeographicDimensions"]["continent"]) >= 2
    assert len(result["representedGeographicDimensions"]["query_trust_tier"]) >= 2


def test_milestone_import_rejects_short_duplicate_and_unknown_batches() -> None:
    campaign = read(CAMPAIGN_PATH)
    events, consensus = synthetic_batch(campaign, 19)
    with pytest.raises(ValueError, match="at least 20 decisive items"):
        module.validate_milestone_import_batch(
            campaign,
            events,
            consensus,
            evidence_class="synthetic_fixture",
        )

    events, consensus = synthetic_batch(campaign, 20)
    with pytest.raises(ValueError, match="repeats event ID"):
        module.validate_milestone_import_batch(
            campaign,
            [*events, events[0]],
            consensus,
            evidence_class="synthetic_fixture",
        )

    events, consensus = synthetic_batch(campaign, 20)
    consensus[0] = {**consensus[0], "item_id": "unknown-item"}
    with pytest.raises(ValueError, match="unknown campaign item"):
        module.validate_milestone_import_batch(
            campaign,
            events,
            consensus,
            evidence_class="synthetic_fixture",
        )


def synthetic_batch(
    campaign: dict[str, Any],
    count: int,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    campaign_id = campaign["campaign"]["campaignId"]
    items = campaign["items"][:count]
    events = []
    consensus = []
    for index, item in enumerate(items):
        event_id = f"synthetic-event-{index:02d}"
        outcome = "yes" if index % 2 == 0 else "no"
        events.append(
            {
                "event_id": event_id,
                "campaign_id": campaign_id,
                "item_id": item["itemId"],
                "outcome": outcome,
                "reviewed_at": f"2026-07-18T00:{index:02d}:00Z",
                "image_sha256": item["imageSha256"],
                "question_sha256": campaign["campaign"]["questionFingerprint"],
                "campaign_manifest_sha256": campaign["campaign"]["manifestSha256"],
            }
        )
        consensus.append(
            {
                "campaign_id": campaign_id,
                "item_id": item["itemId"],
                "status": "complete_agreement",
                "consensus_outcome": outcome,
                "source_event_ids": [event_id],
            }
        )
    return events, consensus
