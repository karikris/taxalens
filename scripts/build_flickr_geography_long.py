#!/usr/bin/env python3
"""Build the deterministic precision-aware Flickr geography long form."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path
from typing import Any

import polars as pl
from packages.replay.src.biominer_flickr_geography_handoff import DEFAULT_MANIFEST
from packages.replay.src.flickr_geography_long import (
    FLICKR_GEOGRAPHY_LONG_SCHEMA_VERSION,
    build_committed_flickr_geography_long,
)

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_ROOT = REPOSITORY_ROOT / "demo/source/biominer_phase14/flickr_geography"
OUTPUT_PARQUET = OUTPUT_ROOT / "flickr_geography_long.parquet"
OUTPUT_MANIFEST = OUTPUT_ROOT / "flickr_geography_long_manifest.json"
BUILD_MANIFEST_SCHEMA_VERSION = "taxalens-flickr-geography-long-build:v1.0.0"


def _sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _canonical_json(value: object) -> bytes:
    return (
        json.dumps(
            value,
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
            separators=(",", ": "),
        )
        + "\n"
    ).encode("utf-8")


def _parquet_bytes(frame: pl.DataFrame) -> bytes:
    buffer = io.BytesIO()
    frame.write_parquet(buffer, compression="zstd", statistics=True)
    return buffer.getvalue()


def _count_mapping(frame: pl.DataFrame, column: str) -> dict[str, int]:
    return {
        str(row[column]): int(row["len"])
        for row in frame.group_by(column).len().sort(column).iter_rows(named=True)
    }


def build_outputs() -> dict[Path, bytes]:
    frame = build_committed_flickr_geography_long()
    parquet = _parquet_bytes(frame)
    source_manifest_sha256 = _sha256(DEFAULT_MANIFEST.read_bytes())
    scope = frame.row(0, named=True)
    identity = {
        "schema_version": BUILD_MANIFEST_SCHEMA_VERSION,
        "source_handoff_sha256": source_manifest_sha256,
        "project_id": scope["project_id"],
        "run_id": scope["run_id"],
        "target_accepted_taxon_key": scope["target_accepted_taxon_key"],
        "flickr_snapshot_id": scope["flickr_snapshot_id"],
        "grid_name": scope["grid_name"],
        "grid_version": scope["grid_version"],
    }
    build_id = f"flickr-geography-long:{_sha256(_canonical_json(identity))[:24]}"
    by_resolution: dict[str, dict[str, int]] = {}
    for resolution in sorted(frame.get_column("spatial_resolution").unique().to_list()):
        rows = frame.filter(pl.col("spatial_resolution") == resolution)
        by_resolution[str(resolution)] = {
            "row_count": rows.height,
            "supported_count": rows.filter(pl.col("cell_supported")).height,
            "unsupported_count": rows.filter(~pl.col("cell_supported")).height,
            "occupied_cell_count": rows.filter(pl.col("cell_supported"))
            .get_column("spatial_cell_id")
            .n_unique(),
        }
    manifest: dict[str, Any] = {
        **identity,
        "build_id": build_id,
        "scientific_name": scope["scientific_name"],
        "origin_repository": scope["origin_repository"],
        "origin_commit": scope["origin_commit"],
        "candidate_semantics": scope["candidate_semantics"],
        "scientific_claim_allowed": False,
        "source_handoff": {
            "path": DEFAULT_MANIFEST.relative_to(REPOSITORY_ROOT).as_posix(),
            "sha256": source_manifest_sha256,
            "artifact_sha256": scope["source_artifact_sha256"],
        },
        "artifact": {
            "path": OUTPUT_PARQUET.relative_to(REPOSITORY_ROOT).as_posix(),
            "media_type": "application/vnd.apache.parquet",
            "schema_version": FLICKR_GEOGRAPHY_LONG_SCHEMA_VERSION,
            "row_count": frame.height,
            "byte_count": len(parquet),
            "sha256": _sha256(parquet),
            "columns": frame.columns,
        },
        "counts": {
            "photo_count": frame.get_column("flickr_photo_id").n_unique(),
            "long_row_count": frame.height,
            "supported_cell_row_count": frame.filter(pl.col("cell_supported")).height,
            "unsupported_cell_row_count": frame.filter(~pl.col("cell_supported")).height,
            "cell_support_status": _count_mapping(frame, "cell_support_status"),
            "by_resolution": by_resolution,
            "country_code_available_row_count": frame.get_column("country_code")
            .is_not_null()
            .sum(),
            "admin1_available_row_count": frame.get_column("admin1").is_not_null().sum(),
        },
        "normalization_policy": {
            "one_row_per_photo_per_declared_resolution": True,
            "unsupported_spatial_cell_id": None,
            "unsupported_finer_resolution_populated": False,
            "filter_for_spatial_join": "cell_supported = true",
            "country_or_admin_inference_performed": False,
            "source_warnings_preserved": True,
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
            failures.append(f"Flickr geography long-form output is missing: {path}")
        elif path.read_bytes() != expected:
            failures.append(f"Flickr geography long-form output is stale: {path}")
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
            "verified Flickr geography long form: "
            f"photos={manifest['counts']['photo_count']}, "
            f"rows={manifest['counts']['long_row_count']}, "
            f"supported={manifest['counts']['supported_cell_row_count']}"
        )
        return 0
    write_outputs(outputs)
    print(f"wrote Flickr geography long form: {OUTPUT_ROOT.relative_to(REPOSITORY_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
