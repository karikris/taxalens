from __future__ import annotations

from datetime import date

import polars as pl
import pytest
from packages.replay.src.geographic_impact_materializer import (
    GeographicImpactScope,
    aggregate_flickr_review_states,
)
from packages.replay.src.occurrence_release import (
    OccurrenceReleaseError,
    load_occurrence_release_decisions,
    load_quality_snapshot_ids,
    occurrence_release_schema,
    validate_occurrence_release_decisions,
)

FLICKR_PATH = "demo/source/biominer_phase14/flickr_geography/flickr_geography_verification.parquet"
SCOPE = GeographicImpactScope(
    project_id="taxalens-papilio-demoleus-judge-replay",
    run_id="papilio-demoleus-pilot-20260715",
    registry_version="butterflies-v2-20260712",
    accepted_taxon_key="gbif:1938069",
    scientific_name="Papilio demoleus",
    baseline_snapshot_id="gbif-occurrence-search-20260715",
    flickr_snapshot_id="flickr:2026-07-15",
    grid_name="hierarchical_global_grid",
    grid_version="h3:4.5.0",
    country_hierarchy_id="country-hierarchy:natural-earth-v5.1.2-110m",
)


def test_committed_release_and_quality_inputs_are_explicitly_empty() -> None:
    decisions = load_occurrence_release_decisions()

    assert decisions.schema == occurrence_release_schema()
    assert decisions.is_empty()
    assert load_quality_snapshot_ids() == frozenset()


def test_release_ready_decision_requires_every_gate_and_quality_snapshot() -> None:
    decision = _decisions([_release_row()])
    scope = _expected_scope()

    validate_occurrence_release_decisions(
        decision,
        quality_snapshot_ids={"quality:test"},
        expected_scope=scope,
    )

    failed_gate = decision.with_columns(pl.lit(False).alias("duplicate_gate_passed"))
    with pytest.raises(OccurrenceReleaseError, match="duplicate_gate_passed"):
        validate_occurrence_release_decisions(
            failed_gate,
            quality_snapshot_ids={"quality:test"},
            expected_scope=scope,
        )
    with pytest.raises(OccurrenceReleaseError, match="quality snapshot"):
        validate_occurrence_release_decisions(
            decision,
            quality_snapshot_ids=set(),
            expected_scope=scope,
        )


def test_positive_consensus_and_release_decision_advance_each_supported_cell() -> None:
    flickr = pl.read_parquet(FLICKR_PATH)
    source = flickr.filter(
        pl.col("verification_item_id").is_not_null()
        & (pl.col("coordinate_quality") == "flickr_street")
    ).row(0, named=True)
    photo_id = source["flickr_photo_id"]
    reviewed = _set_human_state(
        flickr,
        photo_id=photo_id,
        state="reviewed_target_positive",
        outcome="yes",
        supported=True,
    )
    decision = _decisions(
        [
            _release_row(
                flickr_photo_id=photo_id,
                verification_campaign_id=source["verification_campaign_id"],
                verification_item_id=source["verification_item_id"],
            )
        ]
    )

    cells = aggregate_flickr_review_states(
        reviewed,
        release_decisions=decision,
        quality_snapshot_ids=frozenset({"quality:test"}),
        scope=SCOPE,
    )

    assert cells.get_column("reviewed_positive_count").sum() == 3
    assert cells.get_column("release_ready_count").sum() == 3
    assert cells.get_column("pending_count").sum() == 34_371
    assert cells.filter(pl.col("release_decision_id").is_not_null()).height == 3
    assert cells.filter(pl.col("quality_snapshot_id") == "quality:test").height == 3


def test_cant_view_and_skip_remain_non_supporting_review_buckets() -> None:
    flickr = pl.read_parquet(FLICKR_PATH)
    photos = (
        flickr.filter(
            pl.col("verification_item_id").is_not_null()
            & (pl.col("coordinate_quality") == "flickr_street")
        )
        .get_column("flickr_photo_id")
        .unique(maintain_order=True)
        .head(2)
        .to_list()
    )
    projected = _set_human_state(
        flickr,
        photo_id=photos[0],
        state="media_failure",
        outcome=None,
        supported=False,
    )
    projected = _set_human_state(
        projected,
        photo_id=photos[1],
        state="deferred",
        outcome=None,
        supported=False,
    )

    cells = aggregate_flickr_review_states(
        projected,
        release_decisions=_decisions([]),
        quality_snapshot_ids=frozenset(),
        scope=SCOPE,
    )

    assert cells.get_column("media_failure_count").sum() == 3
    assert cells.get_column("skipped_count").sum() == 3
    assert cells.get_column("reviewed_positive_count").sum() == 0
    assert cells.get_column("release_ready_count").sum() == 0
    assert cells.get_column("pending_count").sum() == 34_368


def _set_human_state(
    frame: pl.DataFrame,
    *,
    photo_id: str,
    state: str,
    outcome: str | None,
    supported: bool,
) -> pl.DataFrame:
    selected = pl.col("flickr_photo_id") == photo_id
    consensus_status = {
        "reviewed_target_positive": "complete_agreement",
        "media_failure": "media_failure",
        "deferred": "deferred",
    }[state]
    return frame.with_columns(
        pl.when(selected)
        .then(pl.lit(state))
        .otherwise(pl.col("human_review_state"))
        .alias("human_review_state"),
        pl.when(selected)
        .then(pl.lit(consensus_status))
        .otherwise(pl.col("consensus_status"))
        .alias("consensus_status"),
        pl.when(selected)
        .then(pl.lit(outcome))
        .otherwise(pl.col("consensus_outcome"))
        .alias("consensus_outcome"),
        pl.when(selected)
        .then(pl.lit(1))
        .otherwise(pl.col("effective_review_count"))
        .alias("effective_review_count"),
        pl.when(selected)
        .then(pl.lit(1 if state == "reviewed_target_positive" else 0))
        .otherwise(pl.col("decisive_review_count"))
        .alias("decisive_review_count"),
        pl.when(selected)
        .then(pl.lit(True))
        .otherwise(pl.col("human_reviewed"))
        .alias("human_reviewed"),
        pl.when(selected)
        .then(pl.lit(supported))
        .otherwise(pl.col("human_supported"))
        .alias("human_supported"),
    )


def _decisions(rows: list[dict[str, object]]) -> pl.DataFrame:
    return pl.DataFrame(rows, schema=occurrence_release_schema())


def _release_row(**updates: object) -> dict[str, object]:
    row: dict[str, object] = {
        "release_decision_id": "release:test",
        "release_policy_version": "occurrence-release-policy:v1.0.0",
        **_expected_scope(),
        "verification_campaign_id": "campaign:test",
        "verification_item_id": "item:test",
        "flickr_photo_id": "photo:test",
        "quality_snapshot_id": "quality:test",
        "decision_status": "release_ready",
        "decisive_positive_consensus": True,
        "coordinates_valid": True,
        "duplicate_gate_passed": True,
        "quality_gate_passed": True,
        "provenance_complete": True,
        "event_date": date(2026, 7, 1),
    }
    row.update(updates)
    return row


def _expected_scope() -> dict[str, str]:
    return {
        "project_id": SCOPE.project_id,
        "run_id": SCOPE.run_id,
        "accepted_taxon_key": SCOPE.accepted_taxon_key,
        "baseline_snapshot_id": SCOPE.baseline_snapshot_id,
        "flickr_snapshot_id": SCOPE.flickr_snapshot_id,
    }
