#!/usr/bin/env python3
"""Fetch the exact signed DuckDB-Wasm Parquet extension used by the local replay."""

from __future__ import annotations

import argparse
import hashlib
import urllib.request
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
EXTENSION_URL = "https://extensions.duckdb.org/v1.4.3/wasm_mvp/parquet.duckdb_extension.wasm"
EXTENSION_SHA256 = "0785c6c95d003eff4faa7b3b4b660f02c9c92f6d68d135ddf330d42e3a650600"
EXTENSION_BYTES = 2_867_304
DEFAULT_DESTINATION = REPOSITORY_ROOT / "apps/web/src/data/vendor/parquet.duckdb_extension.wasm"


def _verify(content: bytes) -> None:
    if len(content) != EXTENSION_BYTES:
        raise ValueError(f"DuckDB extension has {len(content)} bytes; expected {EXTENSION_BYTES}")
    digest = hashlib.sha256(content).hexdigest()
    if digest != EXTENSION_SHA256:
        raise ValueError(f"DuckDB extension SHA-256 is {digest}; expected {EXTENSION_SHA256}")
    if content[:4] != b"\x00asm":
        raise ValueError("DuckDB extension is not a WebAssembly binary")


def import_duckdb_wasm_extension(
    destination: Path = DEFAULT_DESTINATION,
    *,
    check: bool = False,
) -> Path:
    if check:
        content = destination.read_bytes()
    else:
        request = urllib.request.Request(
            EXTENSION_URL,
            headers={"Accept-Encoding": "identity", "User-Agent": "TaxaLens fixture importer"},
        )
        with urllib.request.urlopen(request, timeout=60) as response:
            content = response.read()
        _verify(content)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(content)
    _verify(content)
    return destination


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--destination", type=Path, default=DEFAULT_DESTINATION)
    parser.add_argument("--check", action="store_true")
    arguments = parser.parse_args()
    path = import_duckdb_wasm_extension(arguments.destination, check=arguments.check)
    action = "verified" if arguments.check else "imported"
    print(f"{action} signed DuckDB-Wasm Parquet extension: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
