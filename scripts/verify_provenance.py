#!/usr/bin/env python3
"""Validate TaxaLens migration provenance and manifest integrity."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Dict, List

HEX_SHA = re.compile(r"^[0-9a-f]{40}$")
REQUIRED_COMPONENT_FIELDS = {
    "component_id",
    "source_repository",
    "source_commit",
    "source_path",
    "destination_path",
    "migration_kind",
    "reason",
    "build_week_scope",
    "tests",
    "status",
}
REQUIRED_DOCS = [
    "UPSTREAM_BIOMINER.md",
    "BUILD_WEEK_BASELINE.md",
    "README.md",
    "AGENTS.md",
]


def parse_scalar(value: str):
    if value in {"null", "~", ""}:
        return None
    if (value.startswith("\"") and value.endswith("\"")) or (value.startswith("'") and value.endswith("'")):
        return value[1:-1]
    if value.lower() == "true":
        return True
    if value.lower() == "false":
        return False
    return value


def parse_manifest(path: Path) -> Dict[str, object]:
    text = path.read_text(encoding="utf-8")
    stripped = text.lstrip()
    if stripped.startswith("{") or stripped.startswith("["):
        return json.loads(text)

    data: Dict[str, object] = {}
    lines = text.splitlines()

    in_components = False
    current_component: Dict[str, object] | None = None
    components: List[Dict[str, object]] = []

    for raw in lines:
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        line = raw.split("#", 1)[0].rstrip()
        indent = len(raw) - len(raw.lstrip(" "))
        stripped_line = line.strip()

        if indent == 0 and not stripped_line.startswith("-"):
            if stripped_line == "components:":
                in_components = True
                continue
            if ":" in stripped_line:
                key, _, value = stripped_line.partition(":")
                key = key.strip()
                val = parse_scalar(value.strip())
                data[key] = {} if val == "" else val
            continue

        if not in_components:
            continue

        if indent == 2 and stripped_line.startswith("-"):
            if current_component:
                components.append(current_component)
            current_component = {}
            payload = stripped_line[1:].strip()
            if payload and ":" in payload:
                key, _, value = payload.partition(":")
                current_component[key.strip()] = parse_scalar(value.strip())
            continue

        if indent >= 4 and current_component is not None:
            if ":" in stripped_line:
                key, _, value = stripped_line.partition(":")
                current_component[key.strip()] = parse_scalar(value.strip())

    if current_component:
        components.append(current_component)
    data["components"] = components
    return data


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", default="provenance/biominer_migration_manifest.yaml")
    parser.add_argument("--upstream", default="UPSTREAM_BIOMINER.md")
    args = parser.parse_args()

    failures: List[str] = []
    warnings: List[str] = []
    manifest_path = Path(args.manifest)

    if not manifest_path.exists():
        failures.append(f"Missing migration manifest: {manifest_path}")
        print_report(failures, warnings)
        raise SystemExit(1)

    manifest = parse_manifest(manifest_path)
    if not isinstance(manifest, dict):
        failures.append("Manifest is not a mapping.")
        print_report(failures, warnings)
        raise SystemExit(1)

    for doc in REQUIRED_DOCS:
        if not Path(doc).exists():
            warnings.append(f"Baseline document missing (required by workflow): {doc}")

    components = manifest.get("components", [])
    if components is None:
        failures.append("Manifest missing `components:` key.")
    elif not isinstance(components, list):
        failures.append("Manifest components must be a list.")
    else:
        for idx, component in enumerate(components):
            if not isinstance(component, dict):
                failures.append(f"Component index {idx} is not a mapping.")
                continue
            missing = REQUIRED_COMPONENT_FIELDS - set(component)
            if missing:
                failures.append(f"Component {component.get('component_id', idx)} missing required fields: {', '.join(sorted(missing))}")

            source_commit = component.get("source_commit")
            if not isinstance(source_commit, str) or not HEX_SHA.fullmatch(source_commit):
                failures.append(f"Component {component.get('component_id', idx)} has invalid source_commit '{source_commit}'.")

            source_path = str(component.get("source_path", "")).lower()
            if "staged" in source_path or "working tree" in source_path or "working_tree" in source_path:
                failures.append(f"Component {component.get('component_id', idx)} references non-committed path '{source_path}'.")

            component_id = str(component.get("component_id", "")).lower()
            if "phase13" in component_id or "13" in component_id:
                is_pinned = bool(component.get("phase13_explicit_pinned", False))
                status = component.get("status")
                if not is_pinned or status != "migrated":
                    failures.append(
                        f"Component {component.get('component_id', idx)} is Phase 13-like but not explicitly committed+pinned.")

    source_repo = str(manifest.get("upstream_repository", "")).strip()
    if source_repo and source_repo != "karikris/BioMiner":
        warnings.append(f"Manifest upstream repository is {source_repo} (expected karikris/BioMiner).")

    upstream = Path(args.upstream)
    if not upstream.exists():
        warnings.append(f"Missing upstream tracking document: {args.upstream}")
    elif "pinned" not in upstream.read_text(encoding="utf-8").lower():
        failures.append(f"Upstream tracking document {args.upstream} does not contain a pinned SHA reference.")

    if failures:
        print_report(failures, warnings)
        raise SystemExit(1)

    print("Provenance manifest validation passed.")
    if warnings:
        print("WARNINGS:")
        for warning in warnings:
            print(f"  - {warning}")


def print_report(failures: List[str], warnings: List[str]) -> None:
    if warnings:
        print("WARNINGS:")
        for warning in warnings:
            print(f"  - {warning}")
    if failures:
        print("FAILURES:")
        for failure in failures:
            print(f"  - {failure}")
        print("Provenance validation failed.")


if __name__ == "__main__":
    main()
