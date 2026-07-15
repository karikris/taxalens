"""Stable target-task vocabulary extracted from committed BioMiner."""

from __future__ import annotations


TARGET_TASKS = frozenset(
    {
        "binary_target_verifier",
        "regional_multiclass",
        "visual_domain",
        "larval_target_verifier",
    }
)


__all__ = ["TARGET_TASKS"]
