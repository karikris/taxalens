"""BioMiner-compatible export of TaxaLens reference verification events."""

from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import polars as pl

from packages.replay.src.biominer_reference_review_packet_adapter import (
    REFERENCE_REVIEW_ADAPTER_VERSION,
)

REFERENCE_REVIEW_DECISION_IMPORT_SCHEMA_VERSION = (
    "reference-review-decision-import-v1.0.0"
)
REFERENCE_REVIEW_DECISION_IMPORT_FILE = "reference_review_decision_import.parquet"
TAXALENS_VERIFICATION_EVENT_SCHEMA_VERSION = "taxalens-verification-event:v1.2.0"

_REVIEWER_ID = re.compile(r"[a-z0-9][a-z0-9._:@/-]{2,127}\Z")
_SHA256 = re.compile(r"[0-9a-f]{64}\Z")
_GIT_SHA = re.compile(r"[0-9a-f]{40}\Z")
_REQUEST_ID = re.compile(r"reference-review-request:[0-9a-f]{64}\Z")
_MEDIA_ID = re.compile(r"reference-media:[0-9a-f]{64}\Z")
_DECISION_ID = re.compile(r"reference-review-decision:[0-9a-f]{64}\Z")
_LIFE_STAGES = frozenset({"adult", "larva", "pupa", "egg", "unknown"})
_VISUAL_DOMAINS = frozenset(
    {
        "live_field",
        "pinned_specimen",
        "artwork",
        "logo",
        "tattoo",
        "partial_wing",
        "dead_or_damaged_specimen",
        "ambiguous",
        "unsuitable",
    }
)
_VIEWS = frozenset(
    {"dorsal", "ventral", "lateral", "frontal", "oblique", "unknown"}
)
_CONFIDENCE = frozenset({"high", "medium", "low", "unknown"})
_SCIENTIFIC_OUTCOMES = frozenset({"yes", "no", "cant_tell"})
_NON_SCIENTIFIC_OUTCOMES = frozenset({"cant_view", "skipped"})
_EVENT_FIELDS = frozenset(
    {
        "schemaVersion",
        "eventId",
        "campaignId",
        "itemId",
        "reviewerId",
        "reviewRound",
        "outcome",
        "comment",
        "alternativeTaxon",
        "correctedLifeStage",
        "correctedVisualDomain",
        "correctedView",
        "mediaQuality",
        "duplicateConcern",
        "captiveOrCultivatedConcern",
        "exclusionReason",
        "confidence",
        "reviewedAt",
        "durationMs",
        "imageSha256",
        "questionSha256",
        "campaignManifestSha256",
        "taxalensSha",
        "biominerSha",
        "supersedesEventId",
        "conflictsWithDecisionId",
    }
)
_SORT_FIELDS = [
    "reference_media_id",
    "review_round",
    "verified_by",
    "reviewed_at",
    "review_request_id",
]


class ReferenceReviewDecisionExportError(ValueError):
    """Raised when TaxaLens events cannot be safely exported to BioMiner."""


def reference_review_decision_import_schema() -> dict[str, pl.DataType]:
    """Return the exact committed BioMiner decision-import schema."""
    return {
        "import_schema_version": pl.String,
        "review_request_id": pl.String,
        "reference_media_id": pl.String,
        "review_round": pl.UInt16,
        "verified_by": pl.String,
        "reviewed_at": pl.Datetime("us", "UTC"),
        "target_identity_verified": pl.Boolean,
        "verification_status": pl.String,
        "life_stage": pl.String,
        "visual_domain": pl.String,
        "view": pl.String,
        "review_confidence": pl.String,
        "review_notes": pl.String,
        "exclusion_reason": pl.String,
        "conflicts_with_decision_id": pl.String,
    }


def build_reference_review_decision_import(
    *,
    adapted_packet: Mapping[str, Any],
    events: Sequence[Mapping[str, Any]],
) -> pl.DataFrame:
    """Map append-only TaxaLens events to a BioMiner decision import frame."""
    campaigns, items = _validate_packet(adapted_packet)
    rows: list[dict[str, Any]] = []
    seen_event_ids: set[str] = set()
    for event in events:
        if set(event) != _EVENT_FIELDS:
            unknown = sorted(set(event) - _EVENT_FIELDS)
            missing = sorted(_EVENT_FIELDS - set(event))
            raise ReferenceReviewDecisionExportError(
                f"verification event fields differ: missing={missing}; unknown={unknown}"
            )
        event_id = _required_text(event["eventId"], "eventId")
        if event_id in seen_event_ids:
            raise ReferenceReviewDecisionExportError(
                f"verification event ID is repeated: {event_id}"
            )
        seen_event_ids.add(event_id)
        outcome = _required_text(event["outcome"], "outcome")
        if outcome in _NON_SCIENTIFIC_OUTCOMES:
            continue
        if outcome not in _SCIENTIFIC_OUTCOMES:
            raise ReferenceReviewDecisionExportError(
                f"unsupported verification outcome: {outcome}"
            )
        campaign_id = _required_text(event["campaignId"], "campaignId")
        item_id = _required_text(event["itemId"], "itemId")
        campaign = campaigns.get(campaign_id)
        item = items.get(item_id)
        if campaign is None or item is None or item["campaignId"] != campaign_id:
            raise ReferenceReviewDecisionExportError(
                "verification event has a stale campaign or item binding"
            )
        rows.append(_event_row(event, campaign, item))
    return pl.DataFrame(
        rows,
        schema=reference_review_decision_import_schema(),
        orient="row",
    ).sort(_SORT_FIELDS)


def write_reference_review_decision_import(
    *,
    adapted_packet: Mapping[str, Any],
    events: Sequence[Mapping[str, Any]],
    output_path: str | Path,
) -> pl.DataFrame:
    """Write a deterministic BioMiner-compatible Parquet handoff."""
    frame = build_reference_review_decision_import(
        adapted_packet=adapted_packet,
        events=events,
    )
    path = Path(output_path)
    if path.name != REFERENCE_REVIEW_DECISION_IMPORT_FILE:
        raise ReferenceReviewDecisionExportError(
            f"decision import filename must be {REFERENCE_REVIEW_DECISION_IMPORT_FILE}"
        )
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.write_parquet(
        path,
        compression="zstd",
        compression_level=9,
        statistics=True,
    )
    return frame


def _validate_packet(
    packet: Mapping[str, Any],
) -> tuple[dict[str, Mapping[str, Any]], dict[str, Mapping[str, Any]]]:
    if packet.get("schemaVersion") != REFERENCE_REVIEW_ADAPTER_VERSION:
        raise ReferenceReviewDecisionExportError(
            "reference review packet adapter schema is unsupported"
        )
    source_manifest = packet.get("sourceManifest")
    if not isinstance(source_manifest, Mapping):
        raise ReferenceReviewDecisionExportError(
            "reference review packet source manifest is missing"
        )
    manifest_sha = source_manifest.get("sha256")
    biominer_commit = source_manifest.get("biominerCommit")
    if not isinstance(manifest_sha, str) or _SHA256.fullmatch(manifest_sha) is None:
        raise ReferenceReviewDecisionExportError(
            "reference review source fingerprint is invalid"
        )
    if not isinstance(biominer_commit, str) or _GIT_SHA.fullmatch(
        biominer_commit
    ) is None:
        raise ReferenceReviewDecisionExportError(
            "reference review BioMiner commit is invalid"
        )
    raw_campaigns = packet.get("campaigns")
    raw_items = packet.get("items")
    if not isinstance(raw_campaigns, list) or not isinstance(raw_items, list):
        raise ReferenceReviewDecisionExportError(
            "reference review campaigns or items are missing"
        )
    campaigns: dict[str, Mapping[str, Any]] = {}
    for campaign in raw_campaigns:
        if not isinstance(campaign, Mapping):
            raise ReferenceReviewDecisionExportError("reference campaign is invalid")
        campaign_id = _required_text(campaign.get("campaignId"), "campaignId")
        if campaign_id in campaigns:
            raise ReferenceReviewDecisionExportError(
                f"reference campaign is repeated: {campaign_id}"
            )
        if (
            campaign.get("kind") != "reference_identity_verification"
            or campaign.get("manifestSha256") != manifest_sha
            or campaign.get("biominerSha") != biominer_commit
        ):
            raise ReferenceReviewDecisionExportError(
                "reference campaign source binding is stale"
            )
        campaigns[campaign_id] = campaign
    items: dict[str, Mapping[str, Any]] = {}
    for item in raw_items:
        if not isinstance(item, Mapping):
            raise ReferenceReviewDecisionExportError("reference item is invalid")
        item_id = _required_text(item.get("itemId"), "itemId")
        media_id = _required_text(item.get("sourceMediaId"), "sourceMediaId")
        if (
            _REQUEST_ID.fullmatch(item_id) is None
            or _MEDIA_ID.fullmatch(media_id) is None
            or item.get("campaignId") not in campaigns
        ):
            raise ReferenceReviewDecisionExportError(
                "reference item source identity is invalid"
            )
        if item_id in items:
            raise ReferenceReviewDecisionExportError(
                f"reference item is repeated: {item_id}"
            )
        items[item_id] = item
    return campaigns, items


def _event_row(
    event: Mapping[str, Any],
    campaign: Mapping[str, Any],
    item: Mapping[str, Any],
) -> dict[str, Any]:
    if event["schemaVersion"] != TAXALENS_VERIFICATION_EVENT_SCHEMA_VERSION:
        raise ReferenceReviewDecisionExportError(
            "verification event schema is unsupported"
        )
    reviewer = _required_text(event["reviewerId"], "reviewerId")
    if _REVIEWER_ID.fullmatch(reviewer) is None:
        raise ReferenceReviewDecisionExportError(
            "reviewerId must be a canonical lowercase ASCII reviewer identifier"
        )
    review_round = event["reviewRound"]
    if (
        isinstance(review_round, bool)
        or not isinstance(review_round, int)
        or review_round < 1
        or review_round > 65_535
    ):
        raise ReferenceReviewDecisionExportError(
            "reviewRound must fit a positive UInt16"
        )
    reviewed_at = _utc_datetime(event["reviewedAt"])
    for event_field, expected in (
        ("imageSha256", item["imageSha256"]),
        ("questionSha256", item["questionFingerprint"]),
        ("campaignManifestSha256", campaign["manifestSha256"]),
        ("taxalensSha", campaign["taxalensSha"]),
        ("biominerSha", campaign["biominerSha"]),
    ):
        if event[event_field] != expected:
            raise ReferenceReviewDecisionExportError(
                f"verification event {event_field} has a stale source binding"
            )
    outcome = str(event["outcome"])
    comment = _optional_text(event["comment"], "comment")
    exclusion = _optional_text(event["exclusionReason"], "exclusionReason")
    conflict_id = _optional_text(
        event["conflictsWithDecisionId"],
        "conflictsWithDecisionId",
    )
    if conflict_id is not None and _DECISION_ID.fullmatch(conflict_id) is None:
        raise ReferenceReviewDecisionExportError(
            "conflictsWithDecisionId is not a BioMiner review decision ID"
        )
    confidence = _choice(event["confidence"], _CONFIDENCE, "confidence")
    life_stage = _proposal(
        event["correctedLifeStage"],
        item.get("expectedLifeStage"),
        _LIFE_STAGES,
        "unknown",
        "life stage",
    )
    visual_domain = _proposal(
        event["correctedVisualDomain"],
        item.get("expectedVisualDomain"),
        _VISUAL_DOMAINS,
        "ambiguous",
        "visual domain",
    )
    view = _proposal(
        event["correctedView"],
        item.get("expectedView"),
        _VIEWS,
        "unknown",
        "view",
    )
    if outcome == "yes":
        status = "verified"
        identity: bool | None = True
        exclusion = None
    elif outcome == "no":
        status = "excluded"
        identity = False
        exclusion = exclusion or "Reviewer selected No for target identity."
    else:
        status = "uncertain"
        identity = None
        exclusion = None
        comment = comment or "Reviewer could not determine target identity."
    return {
        "import_schema_version": REFERENCE_REVIEW_DECISION_IMPORT_SCHEMA_VERSION,
        "review_request_id": event["itemId"],
        "reference_media_id": item["sourceMediaId"],
        "review_round": review_round,
        "verified_by": reviewer,
        "reviewed_at": reviewed_at,
        "target_identity_verified": identity,
        "verification_status": status,
        "life_stage": life_stage,
        "visual_domain": visual_domain,
        "view": view,
        "review_confidence": confidence,
        "review_notes": comment,
        "exclusion_reason": exclusion,
        "conflicts_with_decision_id": conflict_id,
    }


def _proposal(
    corrected: Any,
    expected: Any,
    allowed: frozenset[str],
    fallback: str,
    label: str,
) -> str:
    value = corrected if corrected is not None else expected
    if value is None:
        return fallback
    return _choice(value, allowed, label)


def _choice(value: Any, allowed: frozenset[str], label: str) -> str:
    text = _required_text(value, label)
    if text not in allowed:
        raise ReferenceReviewDecisionExportError(f"{label} is unsupported: {text}")
    return text


def _required_text(value: Any, label: str) -> str:
    if not isinstance(value, str) or value == "" or value != value.strip():
        raise ReferenceReviewDecisionExportError(
            f"{label} must be nonblank canonical text"
        )
    return value


def _optional_text(value: Any, label: str) -> str | None:
    if value is None:
        return None
    return _required_text(value, label)


def _utc_datetime(value: Any) -> datetime:
    if not isinstance(value, str):
        raise ReferenceReviewDecisionExportError(
            "reviewedAt must be a normalized UTC instant"
        )
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ReferenceReviewDecisionExportError(
            "reviewedAt must be a normalized UTC instant"
        ) from error
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ReferenceReviewDecisionExportError(
            "reviewedAt must be a normalized UTC instant"
        )
    normalized = parsed.astimezone(UTC)
    if normalized.isoformat(timespec="milliseconds").replace("+00:00", "Z") != value:
        raise ReferenceReviewDecisionExportError(
            "reviewedAt must be a normalized millisecond UTC instant"
        )
    return normalized
