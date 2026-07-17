#!/usr/bin/env python3
"""Verify bundled country boundaries, hierarchy, rights and offline policy."""

from __future__ import annotations

import argparse

from packages.replay.src.geographic_boundaries import DEFAULT_OUTPUT_ROOT
from packages.replay.src.geographic_boundary_verifier import verify_geographic_boundaries


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", nargs="?", default=DEFAULT_OUTPUT_ROOT)
    args = parser.parse_args()

    report = verify_geographic_boundaries(args.root)
    print(
        "verified offline geographic boundaries: "
        f"features={report['boundary_feature_count']}, "
        f"countries={report['selectable_country_count']}, "
        f"continents={report['continent_count']}, "
        f"runtime_bytes={report['runtime_byte_count']}"
    )


if __name__ == "__main__":
    main()
