from __future__ import annotations

from packages.replay.src.biominer_evidence_review_policy import (
    ACTIONABLE_IN_REVIEW_REASONS,
    REVIEW_QUEUE_BUCKETS,
    comment_review_is_actionable,
)


def test_review_policy_preserves_committed_biominer_constants() -> None:
    assert REVIEW_QUEUE_BUCKETS == {"bronze", "in_review"}
    assert ACTIONABLE_IN_REVIEW_REASONS == {
        "ambiguous_species_margin",
        "species_conflict",
        "taxonomy_inconsistent",
        "missing_event_date",
        "missing_geo",
        "unknown_life_stage",
        "low_confidence",
        "text_vision_conflict",
        "detected_object_without_bioclip_score",
    }


def test_bronze_records_are_always_actionable_for_comment_review() -> None:
    assert comment_review_is_actionable(bucket="bronze", reason="")
    assert comment_review_is_actionable(bucket="bronze", reason="unrecognized_reason")


def test_in_review_records_require_an_actionable_reason() -> None:
    for reason in ACTIONABLE_IN_REVIEW_REASONS:
        assert comment_review_is_actionable(bucket="in_review", reason=reason)

    assert not comment_review_is_actionable(
        bucket="in_review", reason="insufficient_reference_coverage"
    )
    assert not comment_review_is_actionable(bucket="in_review", reason="")


def test_non_queue_buckets_are_not_actionable() -> None:
    for bucket in ("gold", "silver", "bin", ""):
        assert not comment_review_is_actionable(bucket=bucket, reason="species_conflict")
