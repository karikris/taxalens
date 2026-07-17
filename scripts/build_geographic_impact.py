#!/usr/bin/env python3
"""Build or verify committed Geographic Impact Lens analytical artifacts."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path

import polars as pl
from packages.replay.src.geographic_impact_manifest import build_geographic_impact_manifest
from packages.replay.src.geographic_impact_materializer import (
    DEFAULT_BASELINE_UNION,
    DEFAULT_COUNTRY_HIERARCHY,
    DEFAULT_FLICKR_GEOGRAPHY,
    GEOGRAPHIC_IMPACT_MATERIALIZATION_POLICY_VERSION,
    OCCURRENCE_RELEASE_POLICY_VERSION,
    REPOSITORY_ROOT,
    build_committed_geographic_impact_cells,
    build_committed_geographic_impact_summaries,
)
from packages.replay.src.occurrence_release import (
    DEFAULT_QUALITY_SNAPSHOTS,
    DEFAULT_RELEASE_DECISIONS,
)
from packages.replay.src.offline_country_lookup import DEFAULT_COUNTRY_BOUNDARIES

OUTPUT_ROOT = REPOSITORY_ROOT / "demo/source/biominer_phase14/geographic_impact"
OUTPUT_CELLS = OUTPUT_ROOT / "geographic_impact_cells.parquet"
OUTPUT_SUMMARY = OUTPUT_ROOT / "geographic_impact_summary.parquet"
OUTPUT_MANIFEST = OUTPUT_ROOT / "geographic_impact_manifest.json"


def sha256_bytes(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def canonical_json_bytes(value: object) -> bytes:
    return (
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n"
    ).encode("utf-8")


def parquet_bytes(frame: pl.DataFrame) -> bytes:
    buffer = io.BytesIO()
    frame.write_parquet(buffer, compression="zstd", statistics=True)
    return buffer.getvalue()


def geographic_impact_build_id() -> str:
    identity = {
        "materialization_policy_version": GEOGRAPHIC_IMPACT_MATERIALIZATION_POLICY_VERSION,
        "release_policy_version": OCCURRENCE_RELEASE_POLICY_VERSION,
        "inputs": {
            path.relative_to(REPOSITORY_ROOT).as_posix(): sha256_bytes(path.read_bytes())
            for path in (
                DEFAULT_BASELINE_UNION,
                DEFAULT_FLICKR_GEOGRAPHY,
                DEFAULT_COUNTRY_HIERARCHY,
                DEFAULT_COUNTRY_BOUNDARIES,
                DEFAULT_RELEASE_DECISIONS,
                DEFAULT_QUALITY_SNAPSHOTS,
            )
        },
    }
    return f"geographic-impact:{sha256_bytes(canonical_json_bytes(identity))[:24]}"


def build_outputs() -> dict[Path, bytes]:
    cells = build_committed_geographic_impact_cells(
        geographic_impact_build_id=geographic_impact_build_id()
    )
    summaries = build_committed_geographic_impact_summaries(cells)
    cells_content = parquet_bytes(cells)
    summaries_content = parquet_bytes(summaries)
    manifest = build_geographic_impact_manifest(
        cells,
        summaries,
        cells_content=cells_content,
        summaries_content=summaries_content,
        cells_path=OUTPUT_CELLS,
        summaries_path=OUTPUT_SUMMARY,
    )
    return {
        OUTPUT_CELLS: cells_content,
        OUTPUT_SUMMARY: summaries_content,
        OUTPUT_MANIFEST: canonical_json_bytes(manifest),
    }


def write_outputs(outputs: dict[Path, bytes]) -> None:
    for path, content in outputs.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)


def check_outputs(outputs: dict[Path, bytes]) -> list[str]:
    failures = []
    for path, expected in outputs.items():
        if not path.is_file():
            failures.append(f"geographic impact output is missing: {path}")
        elif path.read_bytes() != expected:
            failures.append(f"geographic impact output is stale: {path}")
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
        cells = pl.read_parquet(OUTPUT_CELLS)
        summaries = pl.read_parquet(OUTPUT_SUMMARY)
        print(
            "verified geographic impact artifacts: "
            f"cells={cells.height}, summaries={summaries.height}, "
            f"build_id={cells.item(0, 'geographic_impact_build_id')}"
        )
        return 0
    write_outputs(outputs)
    print(
        "wrote geographic impact artifacts: "
        + ", ".join(path.relative_to(REPOSITORY_ROOT).as_posix() for path in outputs)
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
