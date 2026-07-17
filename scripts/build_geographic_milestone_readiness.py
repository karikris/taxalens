#!/usr/bin/env python3
"""Publish and validate first-20 geographic review import readiness."""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_VERSION = "taxalens-geographic-milestone-import-readiness:v1.0.0"
FIRST_DECISIVE_MILESTONE = 20
DECISIVE_STATUSES = {"complete_agreement", "adjudicated"}


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


def validate_milestone_import_batch(
    campaign_packet: dict[str, Any],
    events: list[dict[str, Any]],
    consensus_rows: list[dict[str, Any]],
    *,
    evidence_class: str,
) -> dict[str, Any]:
    if evidence_class not in {"retained_human", "synthetic_fixture"}:
        raise ValueError("Milestone import evidence class is unsupported.")
    campaign_id = str(campaign_packet["campaign"]["campaignId"])
    audit = campaign_packet["selection"]["geographicAuditStrata"]
    bindings = {str(row["itemId"]): row for row in audit["itemBindings"]}
    if len(bindings) != len(campaign_packet["items"]):
        raise ValueError("Geographic milestone bindings are incomplete.")

    event_by_id: dict[str, dict[str, Any]] = {}
    for event in events:
        event_id = required_text(event, "event_id")
        if event_id in event_by_id:
            raise ValueError(f"Milestone import repeats event ID {event_id}.")
        if required_text(event, "campaign_id") != campaign_id:
            raise ValueError("Milestone event belongs to another campaign.")
        item_id = required_text(event, "item_id")
        if item_id not in bindings:
            raise ValueError("Milestone event references an unknown campaign item.")
        if event.get("outcome") not in {"yes", "no", "cant_tell", "cant_view", "skipped"}:
            raise ValueError("Milestone event outcome is unsupported.")
        reviewed_at = required_text(event, "reviewed_at")
        try:
            datetime.fromisoformat(reviewed_at.replace("Z", "+00:00"))
        except ValueError as error:
            raise ValueError("Milestone event reviewed_at is invalid.") from error
        for field in ("image_sha256", "question_sha256", "campaign_manifest_sha256"):
            value = required_text(event, field)
            if len(value) != 64 or any(character not in "0123456789abcdef" for character in value):
                raise ValueError(f"Milestone event {field} is not a SHA-256 digest.")
        event_by_id[event_id] = event

    consensus_by_item: dict[str, dict[str, Any]] = {}
    for consensus in consensus_rows:
        if required_text(consensus, "campaign_id") != campaign_id:
            raise ValueError("Milestone consensus belongs to another campaign.")
        item_id = required_text(consensus, "item_id")
        if item_id not in bindings:
            raise ValueError("Milestone consensus references an unknown campaign item.")
        if item_id in consensus_by_item:
            raise ValueError("Milestone import repeats item consensus.")
        status = consensus.get("status")
        outcome = consensus.get("consensus_outcome")
        if status not in DECISIVE_STATUSES or outcome not in {"yes", "no"}:
            raise ValueError("Milestone import contains a non-decisive consensus row.")
        source_event_ids = consensus.get("source_event_ids")
        if not isinstance(source_event_ids, list) or not source_event_ids:
            raise ValueError("Milestone consensus has no source events.")
        source_events = []
        for event_id in source_event_ids:
            source_event = event_by_id.get(str(event_id))
            if source_event is None:
                raise ValueError("Milestone consensus source event is unavailable.")
            if source_event["item_id"] != item_id:
                raise ValueError("Milestone consensus source event belongs to another item.")
            source_events.append(source_event)
        if not any(event["outcome"] == outcome for event in source_events):
            raise ValueError("Milestone consensus is unsupported by a matching decisive event.")
        consensus_by_item[item_id] = consensus

    decisive_count = len(consensus_by_item)
    if decisive_count < FIRST_DECISIVE_MILESTONE:
        raise ValueError(
            f"Milestone import requires at least {FIRST_DECISIVE_MILESTONE} decisive items."
        )
    weighted_total = 0.0
    for item_id in consensus_by_item:
        probability = bindings[item_id]["inclusionProbability"]
        if not isinstance(probability, (int, float)) or not 0 < probability <= 1:
            raise ValueError("Milestone import lost a valid primary inclusion probability.")
        weighted_total += 1 / probability

    represented = {}
    for dimension in audit["dimensions"]:
        represented[dimension] = sorted(
            {
                str(bindings[item_id]["dimensions"][dimension])
                for item_id in consensus_by_item
            }
        )
    return {
        "status": "validated",
        "evidenceClass": evidence_class,
        "countsTowardPublicMilestone": evidence_class == "retained_human",
        "decisiveItemCount": decisive_count,
        "weightedDecisiveOwnerTotal": weighted_total,
        "representedGeographicDimensions": represented,
        "eventCount": len(events),
        "consensusCount": len(consensus_rows),
    }


def build_readiness(
    campaign_packet: dict[str, Any],
    quality_snapshot: dict[str, Any],
    *,
    campaign_sha256: str,
    quality_snapshot_sha256: str,
) -> dict[str, Any]:
    campaign_id = str(campaign_packet["campaign"]["campaignId"])
    if quality_snapshot["campaignId"] != campaign_id:
        raise ValueError("Geographic quality snapshot belongs to another campaign.")
    current = int(quality_snapshot["counts"]["decisiveItemCount"])
    binding_count = len(
        campaign_packet["selection"]["geographicAuditStrata"]["itemBindings"]
    )
    structural_ready = binding_count >= FIRST_DECISIVE_MILESTONE
    achieved = current >= FIRST_DECISIVE_MILESTONE
    payload = {
        "schemaVersion": SCHEMA_VERSION,
        "campaignId": campaign_id,
        "status": "achieved" if achieved else "ready_for_import" if structural_ready else "blocked",
        "structuralImportReady": structural_ready,
        "milestoneAchieved": achieved,
        "scientificClaimAllowed": False,
        "firstDecisiveMilestone": FIRST_DECISIVE_MILESTONE,
        "currentRetainedDecisiveItemCount": current,
        "remainingDecisiveItemCount": max(0, FIRST_DECISIVE_MILESTONE - current),
        "availableBoundItemCount": binding_count,
        "acceptedDecisiveOutcomes": ["yes", "no"],
        "nonDecisiveOutcomes": ["cant_tell", "cant_view", "skipped"],
        "requiredEventFields": [
            "event_id",
            "campaign_id",
            "item_id",
            "outcome",
            "reviewed_at",
            "image_sha256",
            "question_sha256",
            "campaign_manifest_sha256",
        ],
        "requiredConsensusFields": [
            "campaign_id",
            "item_id",
            "status",
            "consensus_outcome",
            "source_event_ids",
        ],
        "syntheticFixturePolicy": (
            "Synthetic batches may validate importer capacity but never count toward retained "
            "human outcomes or milestone achievement."
        ),
        "sources": {
            "campaignPacketSha256": campaign_sha256,
            "geographicQualitySnapshotFileSha256": quality_snapshot_sha256,
            "geographicQualitySnapshotSha256": quality_snapshot["snapshotSha256"],
        },
    }
    return {**payload, "readinessSha256": sha256_bytes(canonical_json_bytes(payload))}


def required_text(row: dict[str, Any], field: str) -> str:
    value = row.get(field)
    if not isinstance(value, str) or not value.strip() or value != value.strip():
        raise ValueError(f"Milestone import {field} is missing or non-canonical.")
    return value


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
        default=ROOT
        / "demo/source/verification/papilio-demoleus-flickr-audit.campaign.json",
    )
    parser.add_argument(
        "--quality-snapshot",
        type=Path,
        default=ROOT
        / "demo/source/verification/papilio-demoleus-flickr-geographic-quality.snapshot.json",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT
        / "demo/source/verification/papilio-demoleus-flickr-geographic-milestone-readiness.json",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    readiness = build_readiness(
        read_object(args.campaign),
        read_object(args.quality_snapshot),
        campaign_sha256=sha256_path(args.campaign),
        quality_snapshot_sha256=sha256_path(args.quality_snapshot),
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(readiness, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "output": str(args.output),
                "status": readiness["status"],
                "remaining": readiness["remainingDecisiveItemCount"],
            },
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
