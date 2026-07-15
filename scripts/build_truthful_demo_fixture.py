#!/usr/bin/env python3
"""Rebuild the committed truthful Papilio pilot fixture."""

from __future__ import annotations

import argparse

from taxalens.product.truthful_demo import (
    DEFAULT_TRUTHFUL_DEMO_ROOT,
    build_truthful_demo_fixture,
)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("destination", nargs="?", default=DEFAULT_TRUTHFUL_DEMO_ROOT)
    parser.add_argument("--replace", action="store_true")
    args = parser.parse_args()
    manifest = build_truthful_demo_fixture(args.destination, replace=args.replace)
    print(f"Built and verified {manifest}")


if __name__ == "__main__":
    main()
