#!/usr/bin/env python3
"""Build a deterministic geography-aware quality sidecar for the Flickr audit."""

from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_VERSION = "taxalens-geographic-quality-snapshot:v1.0.0"
MINIMUM_DECISIVE_MILESTONE = 20
DECISIVE_STATUSES = {"complete_agreement", "adjudicated"}
UNCERTAIN_STATUSES = {"unresolved_disagreement", "uncertain_only"}


def canonical_json_bytes(value: object) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        allow_nan=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_path(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build_snapshot(
    campaign_packet: dict[str, Any],
    events_table: dict[str, Any],
    consensus_table: dict[str, Any],
    *,
    campaign_sha256: str,
    events_sha256: str,
    consensus_sha256: str,
) -> dict[str, Any]:
    campaign = campaign_packet["campaign"]
    campaign_id = str(campaign["campaignId"])
    selection = campaign_packet["selection"]
    geographic_audit = selection["geographicAuditStrata"]
    items = campaign_packet["items"]
    item_ids = {str(item["itemId"]) for item in items}
    bindings = geographic_audit["itemBindings"]
    if len(bindings) != len(items) or {row["itemId"] for row in bindings} != item_ids:
        raise ValueError("Geographic audit bindings do not cover campaign items exactly once.")

    consensus_by_item: dict[str, dict[str, Any]] = {}
    for row in consensus_table["rows"]:
        if row["campaign_id"] != campaign_id:
            continue
        item_id = str(row["item_id"])
        if item_id not in item_ids:
            raise ValueError("Consensus row references an unknown Flickr audit item.")
        if item_id in consensus_by_item:
            raise ValueError("Consensus table repeats a Flickr audit item.")
        consensus_by_item[item_id] = row

    non_scientific_by_item: dict[str, set[str]] = {}
    retained_event_count = 0
    for row in events_table["rows"]:
        if row["campaign_id"] != campaign_id:
            continue
        item_id = str(row["item_id"])
        if item_id not in item_ids:
            raise ValueError("Review event references an unknown Flickr audit item.")
        retained_event_count += 1
        outcome = str(row["outcome"])
        if outcome in {"cant_view", "skipped"}:
            non_scientific_by_item.setdefault(item_id, set()).add(outcome)

    binding_by_item = {str(row["itemId"]): row for row in bindings}
    item_states = {
        item_id: quality_state(
            consensus_by_item.get(item_id),
            non_scientific_by_item.get(item_id, set()),
        )
        for item_id in sorted(item_ids)
    }
    counts = Counter(state["state"] for state in item_states.values())
    decisive_count = counts["reviewed_positive"] + counts["reviewed_negative"]
    blockers = []
    if retained_event_count == 0:
        blockers.append("retained_human_outcomes_empty")
    if decisive_count == 0:
        blockers.append("decisive_sample_empty")
    elif decisive_count < MINIMUM_DECISIVE_MILESTONE:
        blockers.append("first_geographic_milestone_not_met")

    dimension_summaries = {}
    for dimension, receipts in geographic_audit["dimensions"].items():
        summaries = []
        for receipt in receipts:
            value = str(receipt["value"])
            assigned = [
                item_id
                for item_id, binding in binding_by_item.items()
                if binding["dimensions"][dimension] == value
            ]
            summaries.append(
                geographic_stratum_summary(
                    receipt,
                    assigned,
                    binding_by_item,
                    item_states,
                )
            )
        if sum(row["assignedOwnerGroupCount"] for row in summaries) != len(items):
            raise ValueError(f"Geographic quality dimension {dimension} does not reconcile.")
        dimension_summaries[dimension] = summaries

    payload = {
        "schemaVersion": SCHEMA_VERSION,
        "campaignId": campaign_id,
        "qualitySnapshotStatus": (
            "available" if not blockers else "provisional" if decisive_count > 0 else "unavailable"
        ),
        "scientificClaimAllowed": False,
        "firstDecisiveMilestone": MINIMUM_DECISIVE_MILESTONE,
        "blockers": blockers,
        "counts": {
            "assignedOwnerGroupCount": len(items),
            "retainedEventCount": retained_event_count,
            "consensusItemCount": len(consensus_by_item),
            "decisiveItemCount": decisive_count,
            "reviewedPositiveItemCount": counts["reviewed_positive"],
            "reviewedNegativeItemCount": counts["reviewed_negative"],
            "uncertainItemCount": counts["uncertain"],
            "mediaFailureItemCount": counts["media_failure"],
            "pendingItemCount": counts["pending"],
            "cantViewItemCount": sum(
                "cant_view" in outcomes for outcomes in non_scientific_by_item.values()
            ),
            "skippedItemCount": sum(
                "skipped" in outcomes for outcomes in non_scientific_by_item.values()
            ),
        },
        "sampling": {
            "design": campaign["samplingPlan"]["design"],
            "representative": selection["representative"],
            "independentUnit": campaign["samplingPlan"]["independentUnit"],
            "weightsPreserved": True,
            "nonScientificOutcomesExcludedFromDecisiveSample": True,
            "geographicDimensionsDoNotAlterInclusionProbability": True,
        },
        "dimensions": dimension_summaries,
        "sources": {
            "campaignPacketSha256": campaign_sha256,
            "eventsTableSha256": events_sha256,
            "consensusTableSha256": consensus_sha256,
            "geographicImpactArtifactSha256": geographic_audit["impactArtifact"]["sha256"],
        },
    }
    return {**payload, "snapshotSha256": sha256_bytes(canonical_json_bytes(payload))}


def quality_state(
    consensus: dict[str, Any] | None,
    non_scientific_outcomes: set[str],
) -> dict[str, str]:
    if consensus is None:
        return {"state": "pending", "outcome": "none"}
    status = str(consensus["status"])
    outcome = consensus["consensus_outcome"]
    if status in DECISIVE_STATUSES and outcome in {"yes", "no"}:
        return {
            "state": "reviewed_positive" if outcome == "yes" else "reviewed_negative",
            "outcome": str(outcome),
        }
    if status in UNCERTAIN_STATUSES:
        return {"state": "uncertain", "outcome": "none"}
    if status == "media_failure":
        return {"state": "media_failure", "outcome": "none"}
    if status in {"pending", "deferred"}:
        return {"state": "pending", "outcome": "none"}
    raise ValueError(f"Consensus state is inconsistent: {status}/{outcome}")


def geographic_stratum_summary(
    receipt: dict[str, Any],
    assigned_item_ids: list[str],
    binding_by_item: dict[str, dict[str, Any]],
    item_states: dict[str, dict[str, str]],
) -> dict[str, Any]:
    state_counts = Counter(item_states[item_id]["state"] for item_id in assigned_item_ids)
    decisive_ids = [
        item_id
        for item_id in assigned_item_ids
        if item_states[item_id]["state"] in {"reviewed_positive", "reviewed_negative"}
    ]
    positive_ids = [
        item_id for item_id in decisive_ids if item_states[item_id]["state"] == "reviewed_positive"
    ]
    weighted_decisive = sum(
        1 / float(binding_by_item[item_id]["inclusionProbability"]) for item_id in decisive_ids
    )
    weighted_positive = sum(
        1 / float(binding_by_item[item_id]["inclusionProbability"]) for item_id in positive_ids
    )
    return {
        "value": receipt["value"],
        "populationOwnerGroupCount": receipt["populationOwnerGroupCount"],
        "assignedOwnerGroupCount": len(assigned_item_ids),
        "decisiveItemCount": len(decisive_ids),
        "reviewedPositiveItemCount": state_counts["reviewed_positive"],
        "reviewedNegativeItemCount": state_counts["reviewed_negative"],
        "uncertainItemCount": state_counts["uncertain"],
        "mediaFailureItemCount": state_counts["media_failure"],
        "pendingItemCount": state_counts["pending"],
        "weightedDecisiveOwnerTotal": weighted_decisive,
        "weightedPositiveOwnerTotal": weighted_positive,
        "weightedTargetPrecisionEstimate": (
            weighted_positive / weighted_decisive if weighted_decisive > 0 else None
        ),
        "interval": None,
        "intervalAvailability": "unavailable",
        "intervalBlockers": (
            ["decisive_sample_empty"]
            if not decisive_ids
            else ["geographic_weighted_interval_not_implemented"]
        ),
    }


def read_object(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"Expected a JSON object: {path}")
    return value


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--campaign",
        type=Path,
        default=ROOT / "demo/source/verification/papilio-demoleus-flickr-audit.campaign.json",
    )
    parser.add_argument(
        "--events",
        type=Path,
        default=ROOT / "demo/repository_storage/supabase/verification_events.json",
    )
    parser.add_argument(
        "--consensus",
        type=Path,
        default=ROOT / "demo/repository_storage/supabase/verification_consensus.json",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT
        / "demo/source/verification/papilio-demoleus-flickr-geographic-quality.snapshot.json",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    snapshot = build_snapshot(
        read_object(args.campaign),
        read_object(args.events),
        read_object(args.consensus),
        campaign_sha256=sha256_path(args.campaign),
        events_sha256=sha256_path(args.events),
        consensus_sha256=sha256_path(args.consensus),
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(snapshot, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "output": str(args.output),
                "snapshotSha256": snapshot["snapshotSha256"],
                "status": snapshot["qualitySnapshotStatus"],
                "decisiveItemCount": snapshot["counts"]["decisiveItemCount"],
            },
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
