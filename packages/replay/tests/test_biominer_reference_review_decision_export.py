from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

import polars as pl
import pytest
from packages.replay.src.biominer_reference_review_decision_export import (
    REFERENCE_REVIEW_DECISION_IMPORT_FILE,
    REFERENCE_REVIEW_DECISION_IMPORT_SCHEMA_VERSION,
    ReferenceReviewDecisionExportError,
    build_reference_review_decision_import,
    reference_review_decision_import_schema,
    validate_reference_review_decision_import,
    write_reference_review_decision_import,
)
from packages.replay.src.biominer_reference_review_packet_adapter import (
    adapt_reference_review_packet,
)
from packages.replay.tests.reference_review_packet_fixture import (
    BIOMINER_SHA,
    TAXALENS_SHA,
    write_packet_fixture,
)


def _packet(tmp_path: Path) -> dict[str, Any]:
    return adapt_reference_review_packet(
        source_manifest_path=write_packet_fixture(tmp_path),
        biominer_commit=BIOMINER_SHA,
        taxalens_commit=TAXALENS_SHA,
    )


def _event(
    packet: dict[str, Any],
    *,
    event_id: str,
    outcome: str,
    reviewed_at: str,
    review_round: int = 1,
    reviewer: str = "reviewer-a",
    comment: str | None = None,
    exclusion_reason: str | None = None,
    confidence: str = "unknown",
    corrected_life_stage: str | None = None,
    corrected_visual_domain: str | None = None,
    corrected_view: str | None = None,
    conflict_id: str | None = None,
) -> dict[str, Any]:
    campaign = packet["campaigns"][0]
    item = packet["items"][0]
    return {
        "schemaVersion": "taxalens-verification-event:v1.3.0",
        "eventId": event_id,
        "campaignId": campaign["campaignId"],
        "itemId": item["itemId"],
        "reviewerId": reviewer,
        "reviewRound": review_round,
        "outcome": outcome,
        "comment": comment,
        "nonTargetCategory": None,
        "alternativeTaxon": None,
        "correctedLifeStage": corrected_life_stage,
        "correctedVisualDomain": corrected_visual_domain,
        "correctedView": corrected_view,
        "mediaQuality": "unknown",
        "duplicateConcern": False,
        "captiveOrCultivatedConcern": False,
        "exclusionReason": exclusion_reason,
        "confidence": confidence,
        "reviewedAt": reviewed_at,
        "durationMs": 1_000,
        "imageSha256": item["imageSha256"],
        "questionSha256": item["questionFingerprint"],
        "campaignManifestSha256": campaign["manifestSha256"],
        "taxalensSha": campaign["taxalensSha"],
        "biominerSha": campaign["biominerSha"],
        "supersedesEventId": None,
        "conflictsWithDecisionId": conflict_id,
    }


def test_maps_append_only_reference_events_to_exact_biominer_schema(
    tmp_path: Path,
) -> None:
    packet = _packet(tmp_path)
    conflict_id = "reference-review-decision:" + "a" * 64
    frame = build_reference_review_decision_import(
        adapted_packet=packet,
        events=[
            _event(
                packet,
                event_id="event-no",
                outcome="no",
                reviewer="reviewer-b",
                review_round=2,
                reviewed_at="2026-07-16T17:02:00.000Z",
                comment="The wing pattern contradicts the target.",
                exclusion_reason="Incorrect target identity.",
                confidence="high",
                corrected_life_stage="larva",
                corrected_visual_domain="unsuitable",
                corrected_view="ventral",
                conflict_id=conflict_id,
            ),
            _event(
                packet,
                event_id="event-yes",
                outcome="yes",
                reviewed_at="2026-07-16T17:00:00.000Z",
                confidence="medium",
            ),
            _event(
                packet,
                event_id="event-uncertain",
                outcome="cant_tell",
                reviewer="reviewer-c",
                reviewed_at="2026-07-16T17:01:00.000Z",
            ),
            _event(
                packet,
                event_id="event-media-failure",
                outcome="cant_view",
                reviewer="reviewer-d",
                reviewed_at="2026-07-16T17:03:00.000Z",
            ),
            _event(
                packet,
                event_id="event-skip",
                outcome="skipped",
                reviewer="reviewer-e",
                reviewed_at="2026-07-16T17:04:00.000Z",
            ),
        ],
    )

    assert frame.schema == reference_review_decision_import_schema()
    assert frame.height == 3
    assert set(frame["import_schema_version"]) == {REFERENCE_REVIEW_DECISION_IMPORT_SCHEMA_VERSION}
    rows = {str(row["verified_by"]): row for row in frame.iter_rows(named=True)}
    assert rows["reviewer-a"] == {
        "import_schema_version": REFERENCE_REVIEW_DECISION_IMPORT_SCHEMA_VERSION,
        "review_request_id": packet["items"][0]["itemId"],
        "reference_media_id": packet["items"][0]["sourceMediaId"],
        "review_round": 1,
        "verified_by": "reviewer-a",
        "reviewed_at": rows["reviewer-a"]["reviewed_at"],
        "target_identity_verified": True,
        "verification_status": "verified",
        "life_stage": "adult",
        "visual_domain": "live_field",
        "view": "dorsal",
        "review_confidence": "medium",
        "review_notes": None,
        "exclusion_reason": None,
        "conflicts_with_decision_id": None,
    }
    assert rows["reviewer-b"]["target_identity_verified"] is False
    assert rows["reviewer-b"]["verification_status"] == "excluded"
    assert rows["reviewer-b"]["life_stage"] == "larva"
    assert rows["reviewer-b"]["visual_domain"] == "unsuitable"
    assert rows["reviewer-b"]["view"] == "ventral"
    assert rows["reviewer-b"]["exclusion_reason"] == "Incorrect target identity."
    assert rows["reviewer-b"]["conflicts_with_decision_id"] == conflict_id
    assert rows["reviewer-c"]["target_identity_verified"] is None
    assert rows["reviewer-c"]["verification_status"] == "uncertain"
    assert rows["reviewer-c"]["review_notes"] == "Reviewer could not determine target identity."


def test_empty_scientific_event_set_keeps_exact_physical_schema(
    tmp_path: Path,
) -> None:
    packet = _packet(tmp_path)
    frame = build_reference_review_decision_import(
        adapted_packet=packet,
        events=[
            _event(
                packet,
                event_id="event-skip-only",
                outcome="skipped",
                reviewed_at="2026-07-16T17:04:00.000Z",
            )
        ],
    )

    assert frame.is_empty()
    assert frame.schema == reference_review_decision_import_schema()
    assert frame.schema["review_round"] == pl.UInt16


def test_round_trip_rejects_stale_queue_binding(tmp_path: Path) -> None:
    packet = _packet(tmp_path)
    event = _event(
        packet,
        event_id="event-stale",
        outcome="yes",
        reviewed_at="2026-07-16T17:00:00.000Z",
    )
    event["campaignManifestSha256"] = "0" * 64

    with pytest.raises(
        ReferenceReviewDecisionExportError,
        match="campaignManifestSha256 has a stale source binding",
    ):
        build_reference_review_decision_import(
            adapted_packet=packet,
            events=[event],
        )


def test_round_trip_rejects_invalid_reviewer(tmp_path: Path) -> None:
    packet = _packet(tmp_path)

    with pytest.raises(
        ReferenceReviewDecisionExportError,
        match="canonical lowercase ASCII reviewer identifier",
    ):
        build_reference_review_decision_import(
            adapted_packet=packet,
            events=[
                _event(
                    packet,
                    event_id="event-reviewer",
                    outcome="yes",
                    reviewer="Reviewer Ä",
                    reviewed_at="2026-07-16T17:00:00.000Z",
                )
            ],
        )


def test_round_trip_rejects_altered_source_fingerprint(tmp_path: Path) -> None:
    packet = _packet(tmp_path)
    packet["sourceManifest"]["sha256"] = "0" * 64

    with pytest.raises(
        ReferenceReviewDecisionExportError,
        match="reference campaign source binding is stale",
    ):
        build_reference_review_decision_import(
            adapted_packet=packet,
            events=[],
        )


def test_round_trip_rejects_incomplete_decisive_outcome(tmp_path: Path) -> None:
    packet = _packet(tmp_path)
    event = _event(
        packet,
        event_id="event-incomplete",
        outcome="no",
        reviewed_at="2026-07-16T17:00:00.000Z",
    )
    event["alternativeTaxon"] = {
        "acceptedTaxonKey": "gbif:123",
        "scientificName": "",
    }

    with pytest.raises(
        ReferenceReviewDecisionExportError,
        match="incomplete decisive outcome",
    ):
        build_reference_review_decision_import(
            adapted_packet=packet,
            events=[event],
        )


def test_round_trip_rejects_unsupported_event_and_parquet_fields(
    tmp_path: Path,
) -> None:
    packet = _packet(tmp_path)
    event = _event(
        packet,
        event_id="event-unknown",
        outcome="yes",
        reviewed_at="2026-07-16T17:00:00.000Z",
    )
    event["unexpected"] = "field"
    with pytest.raises(
        ReferenceReviewDecisionExportError,
        match=r"unknown=\['unexpected'\]",
    ):
        build_reference_review_decision_import(
            adapted_packet=packet,
            events=[event],
        )

    valid = build_reference_review_decision_import(
        adapted_packet=packet,
        events=[
            _event(
                packet,
                event_id="event-valid",
                outcome="yes",
                reviewed_at="2026-07-16T17:00:00.000Z",
            )
        ],
    )
    with pytest.raises(
        ReferenceReviewDecisionExportError,
        match=r"unknown=\['unexpected'\]",
    ):
        validate_reference_review_decision_import(
            frame=valid.with_columns(pl.lit("x").alias("unexpected")),
            adapted_packet=packet,
        )


def test_parquet_export_is_byte_deterministic_and_round_trip_valid(
    tmp_path: Path,
) -> None:
    packet = _packet(tmp_path)
    events = [
        _event(
            packet,
            event_id="event-deterministic",
            outcome="yes",
            reviewed_at="2026-07-16T17:00:00.000Z",
        )
    ]
    first_path = tmp_path / "first" / REFERENCE_REVIEW_DECISION_IMPORT_FILE
    second_path = tmp_path / "second" / REFERENCE_REVIEW_DECISION_IMPORT_FILE
    write_reference_review_decision_import(
        adapted_packet=packet,
        events=events,
        output_path=first_path,
    )
    write_reference_review_decision_import(
        adapted_packet=packet,
        events=events,
        output_path=second_path,
    )

    first_bytes = first_path.read_bytes()
    second_bytes = second_path.read_bytes()
    assert first_bytes == second_bytes
    assert hashlib.sha256(first_bytes).hexdigest() == hashlib.sha256(second_bytes).hexdigest()
    round_trip = pl.read_parquet(first_path)
    validate_reference_review_decision_import(
        frame=round_trip,
        adapted_packet=packet,
    )
