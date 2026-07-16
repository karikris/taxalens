#!/usr/bin/env python3
"""Verify BioMiner migration boundary assumptions.

This script intentionally reads only committed BioMiner output contracts by default.
It writes a JSON snapshot under provenance/biominer_state/ for auditability.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional


REQUIRED_COMPONENT_FIELDS = {
    "component_id",
    "source_repository",
    "source_commit",
    "source_path",
    "destination_path",
    "migration_kind",
    "reason",
    "build_week_scope",
    "source_license",
    "changes",
    "tests",
    "status",
}


HEX_SHA = re.compile(r"^[0-9a-f]{40}$")


class VerificationError(Exception):
    pass


def run(cmd: list[str], cwd: Path) -> str:
    result = subprocess.run(
        cmd,
        cwd=str(cwd),
        check=True,
        text=True,
        capture_output=True,
    )
    return result.stdout.strip()


def find_biominer_path() -> List[Path]:
    candidates: List[Path] = []
    env_root = os.environ.get("BIOMINER_REPO")
    if env_root:
        candidates.append(Path(env_root).resolve())
    candidates.extend([Path("../BioMiner").resolve(), Path("./BioMiner").resolve()])

    seen = []
    for cand in candidates:
        if cand in seen:
            continue
        seen.append(cand)
        if (cand / ".git").is_dir():
            return [cand]
    return []


def parse_simple_yaml(path: Path) -> Dict[str, object]:
    text = path.read_text(encoding="utf-8")
    stripped = text.lstrip()
    if stripped.startswith("{") or stripped.startswith("["):
        return json.loads(text)

    data: Dict[str, object] = {}
    lines = text.splitlines()
    current_component: Dict[str, object] = {}
    components: List[Dict[str, object]] = []
    in_components = False

    for raw_line in lines:
        if not raw_line.strip() or raw_line.lstrip().startswith("#"):
            continue
        line = raw_line.split("#", 1)[0].rstrip()
        indent = len(raw_line) - len(raw_line.lstrip(" "))
        stripped_line = line.strip()

        if indent == 0 and not stripped_line.startswith("-"):
            if stripped_line == "components:":
                in_components = True
                if components:
                    data["components"] = components
                continue
            in_components = False
            key, _, value = stripped_line.partition(":")
            key = key.strip()
            value = value.strip()
            if value:
                data[key] = normalize_scalar(value)
            else:
                data[key] = {}
            continue

        if not in_components:
            continue

        if indent == 2 and stripped_line.startswith("-"):
            if current_component:
                components.append(current_component)
            current_component = {}
            payload = stripped_line[1:].strip()
            if payload:
                key, _, value = payload.partition(":")
                current_component[key.strip()] = normalize_scalar(value.strip())
            continue

        if indent >= 4 and current_component is not None:
            key, _, value = stripped_line.partition(":")
            current_component[key.strip()] = normalize_scalar(value.strip())

    if current_component:
        components.append(current_component)
    if components and "components" not in data:
        data["components"] = components
    return data


def normalize_scalar(value: str):
    if value in {"null", "~", ""}:
        return None
    if (value.startswith("\"") and value.endswith("\"")) or (
        value.startswith("'") and value.endswith("'")
    ):
        return value[1:-1]
    if value.lower() == "true":
        return True
    if value.lower() == "false":
        return False
    return value


def parse_pinned_sha(text: str) -> Optional[str]:
    match = re.search(r"`([0-9a-f]{40})`", text)
    if match:
        return match.group(1)
    match = re.search(r"\b([0-9a-f]{40})\b", text)
    if match:
        return match.group(1)
    return None


def pinned_sha_from_upstream_doc(path: Path) -> Optional[str]:
    if not path.exists():
        return None
    return parse_pinned_sha(path.read_text(encoding="utf-8"))


def inspect_pinned_revision(path: Path, pinned_sha: str, head: str) -> dict[str, object]:
    try:
        resolved = run(
            ["git", "rev-parse", "--verify", f"{pinned_sha}^{{commit}}"],
            path,
        )
    except subprocess.CalledProcessError:
        return {
            "available": False,
            "resolved_sha": None,
            "head_matches": False,
        }
    return {
        "available": resolved == pinned_sha,
        "resolved_sha": resolved,
        "head_matches": resolved == head,
    }


def collect_git_status(path: Path) -> Dict[str, List[str]]:
    status = run(["git", "status", "--short", "--ignore-submodules=all"], path)
    staged: List[str] = []
    untracked: List[str] = []

    if status:
        for line in status.splitlines():
            state, filename = line[:2], line[3:]
            if state[0] == "?":
                untracked.append(line)
            elif state.strip():
                staged.append(line)

    return {"raw": status.splitlines(), "staged": staged, "untracked": untracked}


def write_state_snapshot(dest: Path, payload: Dict[str, object]) -> Path:
    dest.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out = dest / f"biominer_boundary_{now}.json"
    out.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
    return out


def has_phase13_signal(path: Path) -> bool:
    scan_root = path.resolve()
    for root, dirs, files in os.walk(scan_root, topdown=True):
        dirs[:] = sorted(directory for directory in dirs if directory != ".git")
        files.sort()
        lower_path = Path(root).relative_to(scan_root).as_posix().lower()
        if "phase13" in lower_path or "task13" in lower_path:
            return True
        for file in files:
            lower_file = file.lower()
            if "13" in lower_file and ("phase" in lower_path or "task" in lower_path):
                return True
    return False


def check_component_contracts(manifest: Dict[str, object], failures: List[str], warnings: List[str]) -> None:
    components = manifest.get("components", [])
    if not isinstance(components, list):
        return

    for idx, component in enumerate(components):
        if not isinstance(component, dict):
            warnings.append(f"Component {idx} is not a mapping and was skipped.")
            continue

        missing = REQUIRED_COMPONENT_FIELDS - set(component)
        if missing:
            failures.append(f"Component {component.get('component_id', idx)} missing required field(s): {', '.join(sorted(missing))}")

        source_commit = str(component.get("source_commit", "")) if component.get("source_commit") is not None else ""
        if source_commit and not HEX_SHA.fullmatch(source_commit):
            failures.append(f"Component {component.get('component_id', idx)} has non-full SHA '{source_commit}'.")

        source_path = str(component.get("source_path", "")).lower()
        if "staged" in source_path or "working tree" in source_path or "working_tree" in source_path:
            failures.append(f"Component {component.get('component_id', idx)} points to staged/working-tree content ({source_path}).")

        component_id = str(component.get("component_id", "")).lower()
        if "phase13" in component_id or "phase_13" in component_id:
            if component.get("phase13_explicit_pinned") is not True:
                warnings.append(f"Component {component.get('component_id', idx)} appears Phase 13 and is not explicitly pinned/approved.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--biominer-path", default=None, help="Path to BioMiner repository")
    parser.add_argument("--upstream-doc", default="UPSTREAM_BIOMINER.md")
    parser.add_argument("--manifest", default="provenance/biominer_migration_manifest.yaml")
    parser.add_argument("--snapshot-dir", default="provenance/biominer_state")
    parser.add_argument("--dry-run", action="store_true", help="Run checks and print state without enforcing strict failure policy")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]

    failures: List[str] = []
    warnings: List[str] = []

    biominer_path: Optional[Path] = None
    if args.biominer_path:
        explicit = Path(args.biominer_path).resolve()
        if (explicit / ".git").is_dir():
            biominer_path = explicit
        else:
            failures.append(f"Explicit BioMiner path '{args.biominer_path}' is not a git repo.")
    else:
        found = find_biominer_path()
        if not found:
            failures.append("No BioMiner repository found in ../BioMiner, ./BioMiner, or BIOMINER_REPO.")
        else:
            biominer_path = found[0]

    if biominer_path is None:
        print("\n".join(failures), file=sys.stderr)
        print("Boundary verification failed.")
        sys.exit(1)

    branch = run(["git", "branch", "--show-current"], biominer_path)
    head = run(["git", "rev-parse", "HEAD"], biominer_path)
    status = collect_git_status(biominer_path)

    upstream_doc = (repo_root / args.upstream_doc).resolve()
    manifest_path = (repo_root / args.manifest).resolve()

    pinned_sha = pinned_sha_from_upstream_doc(upstream_doc)
    if pinned_sha is None and manifest_path.exists():
        manifest_doc = parse_simple_yaml(manifest_path)
        pinned_sha = manifest_doc.get("pinned_biominer_sha")  # type: ignore[assignment]

    if not pinned_sha:
        failures.append("Pinned BioMiner SHA could not be found in UPSTREAM_BIOMINER.md or manifest metadata.")

    pinned_revision: dict[str, object] = {
        "available": False,
        "resolved_sha": None,
        "head_matches": False,
    }
    if pinned_sha:
        pinned_revision = inspect_pinned_revision(biominer_path, pinned_sha, head)
        if not pinned_revision["available"]:
            failures.append(
                f"Pinned BioMiner commit is unavailable or resolves differently: {pinned_sha}."
            )
        elif pinned_revision["head_matches"]:
            warnings.append(f"BioMiner local HEAD matches pinned SHA {pinned_sha}.")
        else:
            warnings.append(
                "BioMiner local HEAD differs from the retained evidence pin; "
                f"pinned={pinned_sha}, local HEAD={head}. "
                "The pinned commit remains available and migrations must use "
                "commit-qualified Git objects."
            )

    if status["staged"]:
        warnings.append(
            f"BioMiner has staged content: {len(status['staged'])} path(s); migration must exclude all staged content."
        )

    if status["untracked"]:
        warnings.append(
            f"BioMiner has untracked content: {', '.join(entry[3:] for entry in status['untracked'])}."
        )

    if has_phase13_signal(biominer_path):
        warnings.append("BioMiner worktree contains a phase-13-style path marker. Phase 13 remains excluded unless explicitly pinned.")

    manifest_data = parse_simple_yaml(manifest_path) if manifest_path.exists() else None
    if manifest_data is None:
        failures.append(f"Manifest missing or unreadable: {manifest_path}")
    else:
        check_component_contracts(manifest_data, failures, warnings)

    phase13_pinned = False
    if manifest_data is not None:
        phase13_pinned = bool(manifest_data.get("phase13_exclusion"))

    output = {
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "taxalens": {
            "branch": run(["git", "branch", "--show-current"], repo_root),
            "head": run(["git", "rev-parse", "HEAD"], repo_root),
        },
        "biominer": {
            "path": str(biominer_path),
            "branch": branch,
            "head": head,
            "status": status,
            "phase13_signal": has_phase13_signal(biominer_path),
            "pinned_revision": pinned_revision,
        },
        "pinned_sha": pinned_sha,
        "phase13_excluded": bool(manifest_data and manifest_data.get("phase13_exclusion", True)),
        "manifest_path": str(manifest_path),
        "failures": failures,
        "warnings": warnings,
        "phase13_pinned": phase13_pinned,
    }

    snapshot = write_state_snapshot(Path(args.snapshot_dir), output)
    print(f"Boundary snapshot written to: {snapshot}")

    if warnings:
        print("WARNINGS:")
        for warning in warnings:
            print(f"  - {warning}")

    if failures:
        print("FAILURES:")
        for failure in failures:
            print(f"  - {failure}")
        print("Boundary verification failed.")
        if args.dry_run:
            print("Dry-run complete with failures.")
            sys.exit(0)
        sys.exit(1)

    print("Boundary verification passed.")


if __name__ == "__main__":
    main()
