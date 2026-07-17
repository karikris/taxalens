#!/usr/bin/env python3
"""Import or verify the pinned Natural Earth offline boundary publication."""

from __future__ import annotations

import argparse

from packages.replay.src.geographic_boundaries import (
    DEFAULT_OUTPUT_ROOT,
    DEFAULT_SOURCE,
    write_geographic_boundaries,
)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", nargs="?", default=DEFAULT_SOURCE)
    parser.add_argument("--output-root", default=DEFAULT_OUTPUT_ROOT)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    manifest = write_geographic_boundaries(
        args.source,
        output_root=args.output_root,
        check=args.check,
    )
    counts = manifest["counts"]
    action = "verified" if args.check else "imported"
    print(
        f"{action} Natural Earth boundaries: "
        f"features={counts['boundary_feature_count']}, "
        f"countries={counts['selectable_country_count']}, "
        f"continents={counts['continent_count']}"
    )


if __name__ == "__main__":
    main()
