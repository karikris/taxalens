"""Committed BioMiner evidence review policy for TaxaLens replay.

Copied without semantic changes from ``src/biominer/evidence/review_policy.py``
at BioMiner commit ``1535c494f9403e22ed9b163f3ae0ce3706e17f4c``.
BioMiner is licensed under the MIT License, copyright 2026 Kris Kari.
"""

from __future__ import annotations


REVIEW_QUEUE_BUCKETS = {"bronze", "in_review"}
ACTIONABLE_IN_REVIEW_REASONS = {
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


def comment_review_is_actionable(*, bucket: str, reason: str) -> bool:
    if bucket == "bronze":
        return True
    if bucket == "in_review":
        return reason in ACTIONABLE_IN_REVIEW_REASONS
    return False


__all__ = [
    "ACTIONABLE_IN_REVIEW_REASONS",
    "REVIEW_QUEUE_BUCKETS",
    "comment_review_is_actionable",
]
