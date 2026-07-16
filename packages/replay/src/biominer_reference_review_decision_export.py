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
TAXALENS_VERIFICATION_EVENT_SCHEMA_VERSION = "taxalens-verification-event:v1.3.0"

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
_MEDIA_QUALITY = frozenset({"high", "medium", "low", "unusable", "unknown"})
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
        "nonTargetCategory",
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
        if outcome not in _SCIENTIFIC_OUTCOMES | _NON_SCIENTIFIC_OUTCOMES:
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
        _validate_event_completeness(event)
        _validate_event_source_binding(event, campaign, item)
        if outcome in _NON_SCIENTIFIC_OUTCOMES:
            continue
        rows.append(_event_row(event, item))
    frame = pl.DataFrame(
        rows,
        schema=reference_review_decision_import_schema(),
        orient="row",
    ).sort(_SORT_FIELDS)
    validate_reference_review_decision_import(
        frame=frame,
        adapted_packet=adapted_packet,
    )
    return frame


def validate_reference_review_decision_import(
    *,
    frame: pl.DataFrame,
    adapted_packet: Mapping[str, Any],
) -> None:
    """Validate a handoff with the committed BioMiner import semantics."""
    expected_schema = reference_review_decision_import_schema()
    if frame.schema != expected_schema:
        missing = [field for field in expected_schema if field not in frame.schema]
        unknown = [field for field in frame.schema if field not in expected_schema]
        raise ReferenceReviewDecisionExportError(
            "review decision import physical schema differs: "
            f"missing={missing}; unknown={unknown}"
        )
    _, items = _validate_packet(adapted_packet)
    reviewer_rounds: set[tuple[str, str, int]] = set()
    for row in frame.iter_rows(named=True):
        if (
            row["import_schema_version"]
            != REFERENCE_REVIEW_DECISION_IMPORT_SCHEMA_VERSION
        ):
            raise ReferenceReviewDecisionExportError(
                "review decision import schema version is unsupported"
            )
        request_id = _required_text(row["review_request_id"], "review_request_id")
        media_id = _required_text(row["reference_media_id"], "reference_media_id")
        item = items.get(request_id)
        if item is None:
            raise ReferenceReviewDecisionExportError(
                "review decision import has an unknown review request"
            )
        if media_id != item["sourceMediaId"]:
            raise ReferenceReviewDecisionExportError(
                "review decision import media does not match its queue request"
            )
        reviewer = _required_text(row["verified_by"], "verified_by")
        if _REVIEWER_ID.fullmatch(reviewer) is None:
            raise ReferenceReviewDecisionExportError(
                "verified_by must be a canonical lowercase ASCII reviewer identifier"
            )
        review_round = row["review_round"]
        key = (request_id, reviewer, review_round)
        if key in reviewer_rounds:
            raise ReferenceReviewDecisionExportError(
                "review decision import repeats a reviewer round"
            )
        reviewer_rounds.add(key)
        if (
            isinstance(review_round, bool)
            or not isinstance(review_round, int)
            or review_round < 1
            or review_round > 65_535
        ):
            raise ReferenceReviewDecisionExportError(
                "review_round must fit a positive UInt16"
            )
        reviewed_at = row["reviewed_at"]
        if (
            not isinstance(reviewed_at, datetime)
            or reviewed_at.tzinfo is None
            or reviewed_at.utcoffset() != UTC.utcoffset(reviewed_at)
        ):
            raise ReferenceReviewDecisionExportError(
                "reviewed_at must be a UTC datetime"
            )
        _choice(row["life_stage"], _LIFE_STAGES, "life_stage")
        _choice(row["visual_domain"], _VISUAL_DOMAINS, "visual_domain")
        _choice(row["view"], _VIEWS, "view")
        _choice(row["review_confidence"], _CONFIDENCE, "review_confidence")
        notes = _optional_text(row["review_notes"], "review_notes")
        exclusion = _optional_text(row["exclusion_reason"], "exclusion_reason")
        conflict_id = _optional_text(
            row["conflicts_with_decision_id"],
            "conflicts_with_decision_id",
        )
        if conflict_id is not None and _DECISION_ID.fullmatch(conflict_id) is None:
            raise ReferenceReviewDecisionExportError(
                "conflicts_with_decision_id is not a BioMiner review decision ID"
            )
        status = row["verification_status"]
        identity = row["target_identity_verified"]
        if status == "verified":
            complete = identity is True and exclusion is None
        elif status == "excluded":
            complete = identity is False and exclusion is not None
        elif status == "uncertain":
            complete = identity is None and notes is not None and exclusion is None
        else:
            raise ReferenceReviewDecisionExportError(
                f"verification_status is unsupported: {status}"
            )
        if not complete:
            raise ReferenceReviewDecisionExportError(
                "review decision import contains an incomplete decisive outcome"
            )
    sorted_frame = frame.sort(_SORT_FIELDS)
    if frame.to_dicts() != sorted_frame.to_dicts():
        raise ReferenceReviewDecisionExportError(
            "review decision import rows are not deterministically sorted"
        )


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
    outcome = str(event["outcome"])
    if event["nonTargetCategory"] is not None:
        raise ReferenceReviewDecisionExportError(
            "reference events cannot carry a Flickr non-target category"
        )
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


def _validate_event_source_binding(
    event: Mapping[str, Any],
    campaign: Mapping[str, Any],
    item: Mapping[str, Any],
) -> None:
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


def _validate_event_completeness(event: Mapping[str, Any]) -> None:
    alternative = event["alternativeTaxon"]
    if alternative is not None:
        if not isinstance(alternative, Mapping):
            raise ReferenceReviewDecisionExportError(
                "alternativeTaxon must be an object or null"
            )
        accepted_key = alternative.get("acceptedTaxonKey")
        scientific_name = alternative.get("scientificName")
        if (
            not isinstance(accepted_key, str)
            or accepted_key.strip() == ""
            or not isinstance(scientific_name, str)
            or scientific_name.strip() == ""
        ):
            raise ReferenceReviewDecisionExportError(
                "verification event has an incomplete decisive outcome"
            )
    if event["outcome"] == "yes" and (
        alternative is not None or event["exclusionReason"] is not None
    ):
        raise ReferenceReviewDecisionExportError(
            "verification event has an incomplete decisive outcome"
        )
    _choice(event["mediaQuality"], _MEDIA_QUALITY, "mediaQuality")
    if not isinstance(event["duplicateConcern"], bool) or not isinstance(
        event["captiveOrCultivatedConcern"], bool
    ):
        raise ReferenceReviewDecisionExportError(
            "verification event reference concerns must be Boolean"
        )
    duration = event["durationMs"]
    if duration is not None and (
        isinstance(duration, bool) or not isinstance(duration, int) or duration < 0
    ):
        raise ReferenceReviewDecisionExportError(
            "verification event durationMs must be non-negative or null"
        )
    if event["supersedesEventId"] == event["eventId"]:
        raise ReferenceReviewDecisionExportError(
            "verification event cannot supersede itself"
        )


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
