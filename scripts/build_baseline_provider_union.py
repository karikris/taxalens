#!/usr/bin/env python3
"""Build or verify the committed baseline occurrence provider-union Parquets."""

from __future__ import annotations

import argparse
import io
from pathlib import Path

import polars as pl
from packages.replay.src.baseline_provider_union import (
    REPOSITORY_ROOT,
    build_committed_baseline_provider_union,
)

OUTPUT_ROOT = REPOSITORY_ROOT / "demo/source/biominer_phase14/baseline_provider_union"
OUTPUT_UNION = OUTPUT_ROOT / "baseline_occurrence_union.parquet"
OUTPUT_RELATIONSHIPS = OUTPUT_ROOT / "baseline_provider_relationships.parquet"


def parquet_bytes(frame: pl.DataFrame) -> bytes:
    buffer = io.BytesIO()
    frame.write_parquet(buffer, compression="zstd", statistics=True)
    return buffer.getvalue()


def build_outputs() -> dict[Path, bytes]:
    union, relationships = build_committed_baseline_provider_union()
    return {
        OUTPUT_UNION: parquet_bytes(union),
        OUTPUT_RELATIONSHIPS: parquet_bytes(relationships),
    }


def write_outputs(outputs: dict[Path, bytes]) -> None:
    for path, content in outputs.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)


def check_outputs(outputs: dict[Path, bytes]) -> list[str]:
    failures = []
    for path, expected in outputs.items():
        if not path.is_file():
            failures.append(f"baseline provider-union output is missing: {path}")
        elif path.read_bytes() != expected:
            failures.append(f"baseline provider-union output is stale: {path}")
    return failures


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    outputs = build_outputs()
    if args.check:
        failures = check_outputs(outputs)
        if failures:
            raise SystemExit("\n".join(failures))
        union = pl.read_parquet(OUTPUT_UNION)
        relationships = pl.read_parquet(OUTPUT_RELATIONSHIPS)
        print(
            "verified baseline provider union: "
            f"observations={relationships.height}, projections={union.height}"
        )
        return 0
    write_outputs(outputs)
    print(f"wrote baseline provider union: {OUTPUT_ROOT.relative_to(REPOSITORY_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
