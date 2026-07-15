#!/usr/bin/env python3
"""Import one explicit, content-addressed BioMiner handoff into TaxaLens."""

from __future__ import annotations

import argparse
import json
from collections.abc import Sequence

from taxalens.product import HandoffImportError, import_biominer_handoff


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--archive", help="Local BioMiner .tar.gz handoff archive")
    source.add_argument(
        "--uri",
        help="Explicit file:// or https:// handoff object URI; prefixes are rejected",
    )
    parser.add_argument(
        "--sha256",
        required=True,
        help="Required expected archive SHA-256, bare or sha256-prefixed",
    )
    parser.add_argument("--cache-dir", required=True, help="Verified local archive cache")
    parser.add_argument(
        "--destination",
        required=True,
        help="Atomic publication directory for verified payload files",
    )
    parser.add_argument("--receipt", required=True, help="Atomic JSON import receipt path")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        receipt = import_biominer_handoff(
            archive=args.archive,
            uri=args.uri,
            expected_sha256=args.sha256,
            cache_dir=args.cache_dir,
            destination=args.destination,
            receipt_path=args.receipt,
        )
    except (HandoffImportError, OSError) as error:
        parser.error(str(error))
    print(json.dumps(receipt, indent=2, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
