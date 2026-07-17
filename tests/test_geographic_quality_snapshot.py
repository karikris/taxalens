from __future__ import annotations

import copy
import hashlib
import importlib.util
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = ROOT / "scripts/build_geographic_quality_snapshot.py"
CAMPAIGN_PATH = (
    ROOT / "demo/source/verification/papilio-demoleus-flickr-audit.campaign.json"
)
EVENTS_PATH = ROOT / "demo/repository_storage/supabase/verification_events.json"
CONSENSUS_PATH = ROOT / "demo/repository_storage/supabase/verification_consensus.json"
SNAPSHOT_PATH = (
    ROOT
    / "demo/source/verification/papilio-demoleus-flickr-geographic-quality.snapshot.json"
)

spec = importlib.util.spec_from_file_location("geographic_quality_snapshot", SCRIPT_PATH)
assert spec is not None and spec.loader is not None
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def read(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_committed_snapshot_is_empty_fail_closed_and_deterministic() -> None:
    snapshot = read(SNAPSHOT_PATH)
    rebuilt = module.build_snapshot(
        read(CAMPAIGN_PATH),
        read(EVENTS_PATH),
        read(CONSENSUS_PATH),
        campaign_sha256=digest(CAMPAIGN_PATH),
        events_sha256=digest(EVENTS_PATH),
        consensus_sha256=digest(CONSENSUS_PATH),
    )

    assert rebuilt == snapshot
    assert snapshot["qualitySnapshotStatus"] == "unavailable"
    assert snapshot["scientificClaimAllowed"] is False
    assert snapshot["blockers"] == [
        "retained_human_outcomes_empty",
        "decisive_sample_empty",
    ]
    assert snapshot["counts"] == {
        "assignedOwnerGroupCount": 49,
        "retainedEventCount": 0,
        "consensusItemCount": 0,
        "decisiveItemCount": 0,
        "reviewedPositiveItemCount": 0,
        "reviewedNegativeItemCount": 0,
        "uncertainItemCount": 0,
        "mediaFailureItemCount": 0,
        "pendingItemCount": 49,
        "cantViewItemCount": 0,
        "skippedItemCount": 0,
    }
    assert snapshot["sampling"]["weightsPreserved"] is True
    assert snapshot["sampling"]["nonScientificOutcomesExcludedFromDecisiveSample"] is True
    assert all(
        row["weightedTargetPrecisionEstimate"] is None
        for rows in snapshot["dimensions"].values()
        for row in rows
    )


def test_weighted_geographic_summary_excludes_skip_and_cant_view() -> None:
    campaign = read(CAMPAIGN_PATH)
    items = campaign["items"][:5]
    campaign_id = campaign["campaign"]["campaignId"]
    outcomes = ["yes", "no", "cant_view", "skipped", "cant_tell"]
    events = {"rows": []}
    for index, (item, outcome) in enumerate(zip(items, outcomes, strict=True)):
        events["rows"].append(
            {
                "event_id": f"event-{index}",
                "campaign_id": campaign_id,
                "item_id": item["itemId"],
                "outcome": outcome,
            }
        )
    consensus = {
        "rows": [
            {
                "campaign_id": campaign_id,
                "item_id": items[0]["itemId"],
                "status": "complete_agreement",
                "consensus_outcome": "yes",
            },
            {
                "campaign_id": campaign_id,
                "item_id": items[1]["itemId"],
                "status": "adjudicated",
                "consensus_outcome": "no",
            },
            {
                "campaign_id": campaign_id,
                "item_id": items[4]["itemId"],
                "status": "uncertain_only",
                "consensus_outcome": None,
            },
        ]
    }
    snapshot = module.build_snapshot(
        campaign,
        events,
        consensus,
        campaign_sha256="a" * 64,
        events_sha256="b" * 64,
        consensus_sha256="c" * 64,
    )

    assert snapshot["counts"]["decisiveItemCount"] == 2
    assert snapshot["counts"]["uncertainItemCount"] == 1
    assert snapshot["counts"]["cantViewItemCount"] == 1
    assert snapshot["counts"]["skippedItemCount"] == 1
    assert snapshot["qualitySnapshotStatus"] == "provisional"
    assert snapshot["blockers"] == ["first_geographic_milestone_not_met"]
    assert sum(
        row["decisiveItemCount"] for row in snapshot["dimensions"]["continent"]
    ) == 2


def test_snapshot_rejects_consensus_for_an_unknown_item() -> None:
    campaign = read(CAMPAIGN_PATH)
    consensus = {
        "rows": [
            {
                "campaign_id": campaign["campaign"]["campaignId"],
                "item_id": "unknown",
                "status": "complete_agreement",
                "consensus_outcome": "yes",
            }
        ]
    }
    try:
        module.build_snapshot(
            copy.deepcopy(campaign),
            {"rows": []},
            consensus,
            campaign_sha256="a" * 64,
            events_sha256="b" * 64,
            consensus_sha256="c" * 64,
        )
    except ValueError as error:
        assert "unknown Flickr audit item" in str(error)
    else:
        raise AssertionError("Unknown consensus item was accepted")
