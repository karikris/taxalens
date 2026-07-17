#!/usr/bin/env python3
"""Build deterministic Flickr geography with verification identity bindings."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path
from typing import Any

import polars as pl
from packages.replay.src.flickr_geography_verification import (
    DEFAULT_ASSIGNMENTS,
    DEFAULT_CAMPAIGN,
    DEFAULT_CONSENSUS,
    DEFAULT_LONG_PARQUET,
    VERIFICATION_GEOGRAPHY_SCHEMA_VERSION,
    build_committed_flickr_geography_verification,
)

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_ROOT = REPOSITORY_ROOT / "demo/source/biominer_phase14/flickr_geography"
OUTPUT_PARQUET = OUTPUT_ROOT / "flickr_geography_verification.parquet"
OUTPUT_MANIFEST = OUTPUT_ROOT / "flickr_geography_verification_manifest.json"
SOURCE_MANIFEST = OUTPUT_ROOT / "flickr_geography_long_manifest.json"
BUILD_MANIFEST_SCHEMA_VERSION = "taxalens-flickr-geography-verification-build:v1.0.0"


def _repository_path(path: Path) -> Path:
    return path if path.is_absolute() else REPOSITORY_ROOT / path


def _sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _canonical_json(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")


def _parquet_bytes(frame: pl.DataFrame) -> bytes:
    buffer = io.BytesIO()
    frame.write_parquet(buffer, compression="zstd", statistics=True)
    return buffer.getvalue()


def _photo_count(frame: pl.DataFrame, expression: pl.Expr) -> int:
    return frame.filter(expression).get_column("flickr_photo_id").n_unique()


def build_outputs() -> dict[Path, bytes]:
    frame = build_committed_flickr_geography_verification()
    parquet = _parquet_bytes(frame)
    source_manifest = json.loads(SOURCE_MANIFEST.read_text(encoding="utf-8"))
    scope = frame.row(0, named=True)
    input_paths = {
        "long_form_manifest": SOURCE_MANIFEST,
        "long_form_parquet": _repository_path(DEFAULT_LONG_PARQUET),
        "verification_campaign": _repository_path(DEFAULT_CAMPAIGN),
        "verification_assignments": _repository_path(DEFAULT_ASSIGNMENTS),
        "verification_consensus": _repository_path(DEFAULT_CONSENSUS),
    }
    inputs = {
        name: {
            "path": path.relative_to(REPOSITORY_ROOT).as_posix(),
            "sha256": _sha256(path.read_bytes()),
        }
        for name, path in input_paths.items()
    }
    identity = {
        "schema_version": BUILD_MANIFEST_SCHEMA_VERSION,
        "source_build_id": source_manifest["build_id"],
        "project_id": scope["project_id"],
        "run_id": scope["run_id"],
        "target_accepted_taxon_key": scope["target_accepted_taxon_key"],
        "flickr_snapshot_id": scope["flickr_snapshot_id"],
        "input_sha256": {name: value["sha256"] for name, value in inputs.items()},
    }
    build_id = f"flickr-geography-verification:{_sha256(_canonical_json(identity))[:24]}"
    campaign = pl.col("verification_item_id").is_not_null()
    manifest: dict[str, Any] = {
        **identity,
        "build_id": build_id,
        "scientific_name": scope["scientific_name"],
        "origin_repository": scope["origin_repository"],
        "origin_commit": scope["origin_commit"],
        "candidate_semantics": scope["candidate_semantics"],
        "scientific_claim_allowed": False,
        "inputs": inputs,
        "artifact": {
            "path": OUTPUT_PARQUET.relative_to(REPOSITORY_ROOT).as_posix(),
            "media_type": "application/vnd.apache.parquet",
            "schema_version": VERIFICATION_GEOGRAPHY_SCHEMA_VERSION,
            "row_count": frame.height,
            "byte_count": len(parquet),
            "sha256": _sha256(parquet),
            "columns": frame.columns,
        },
        "counts": {
            "photo_count": frame.get_column("flickr_photo_id").n_unique(),
            "long_row_count": frame.height,
            "campaign_photo_count": _photo_count(frame, campaign),
            "campaign_long_row_count": frame.filter(campaign).height,
            "not_in_campaign_photo_count": _photo_count(frame, ~campaign),
            "reviewer_assigned_photo_count": _photo_count(
                frame, pl.col("reviewer_assignment_count") > 0
            ),
            "pending_photo_count": _photo_count(frame, pl.col("human_review_state") == "pending"),
            "human_reviewed_photo_count": _photo_count(frame, pl.col("human_reviewed")),
            "human_supported_photo_count": _photo_count(frame, pl.col("human_supported")),
            "decisive_review_count": int(
                frame.group_by("flickr_photo_id")
                .agg(pl.col("decisive_review_count").first())
                .get_column("decisive_review_count")
                .sum()
            ),
            "final_test_campaign_photo_count": _photo_count(
                frame, campaign & (pl.col("dataset_split") == "final_test")
            ),
        },
        "review_semantics": {
            "campaign_membership_is_human_review": False,
            "machine_screening_is_human_label": False,
            "missing_consensus_for_campaign_item": "pending",
            "non_campaign_consensus_state": "not_requested",
            "skip_or_cant_view_is_human_support": False,
            "human_support_requires_decisive_yes_consensus": True,
            "release_ready_derived_here": False,
        },
    }
    return {
        OUTPUT_PARQUET: parquet,
        OUTPUT_MANIFEST: _canonical_json(manifest),
    }


def write_outputs(outputs: dict[Path, bytes]) -> None:
    for path, content in outputs.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)


def check_outputs(outputs: dict[Path, bytes]) -> list[str]:
    failures: list[str] = []
    for path, expected in outputs.items():
        if not path.is_file():
            failures.append(f"Flickr geography verification output is missing: {path}")
        elif path.read_bytes() != expected:
            failures.append(f"Flickr geography verification output is stale: {path}")
    return failures


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    arguments = parser.parse_args()
    outputs = build_outputs()
    if arguments.check:
        failures = check_outputs(outputs)
        if failures:
            raise SystemExit("\n".join(failures))
        manifest = json.loads(outputs[OUTPUT_MANIFEST])
        print(
            "verified Flickr verification geography: "
            f"photos={manifest['counts']['photo_count']}, "
            f"campaign={manifest['counts']['campaign_photo_count']}, "
            f"reviewed={manifest['counts']['human_reviewed_photo_count']}"
        )
        return 0
    write_outputs(outputs)
    print(f"wrote Flickr verification geography: {OUTPUT_ROOT.relative_to(REPOSITORY_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
