#!/usr/bin/env python3
"""Import the four pinned BioMiner Parquet analytics artifacts fail-closed."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from pathlib import Path
from typing import Any

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = REPOSITORY_ROOT / "demo/source/biominer_phase14/analytics_import_manifest.json"
DEFAULT_BIOMINER_ROOT = REPOSITORY_ROOT.parent / "BioMiner"


def _load_object(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return value


def _load_object_bytes(content: bytes, location: str) -> dict[str, Any]:
    try:
        value = json.loads(content.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError(f"{location} must contain UTF-8 JSON") from error
    if not isinstance(value, dict):
        raise ValueError(f"{location} must contain a JSON object")
    return value


def _required_text(value: object, location: str) -> str:
    if not isinstance(value, str) or not value:
        raise ValueError(f"{location} must be non-empty text")
    return value


def _git_object_bytes(biominer_root: Path, commit: str, relative_path: str) -> bytes:
    path = Path(relative_path)
    if path.is_absolute() or ".." in path.parts:
        raise ValueError(f"BioMiner source path must stay within the repository: {relative_path}")
    try:
        return subprocess.run(
            ["git", "show", f"{commit}:{path.as_posix()}"],
            cwd=biominer_root,
            check=True,
            capture_output=True,
        ).stdout
    except subprocess.CalledProcessError as error:
        raise ValueError(
            f"BioMiner pinned object is unavailable: {commit}:{path.as_posix()}"
        ) from error


def _source_bytes(biominer_root: Path, commit: str, relative_path: str) -> bytes:
    path = Path(relative_path)
    if path.is_absolute() or ".." in path.parts:
        raise ValueError(f"BioMiner source path must stay within the repository: {relative_path}")
    try:
        return _git_object_bytes(biominer_root, commit, relative_path)
    except ValueError:
        source_path = biominer_root / path
        if (
            not source_path.is_file()
            or source_path.is_symlink()
            or biominer_root.resolve() not in source_path.resolve().parents
        ):
            raise
        return source_path.read_bytes()


def import_biominer_analytics(
    *,
    biominer_root: Path = DEFAULT_BIOMINER_ROOT,
    manifest_path: Path = DEFAULT_MANIFEST,
    check: bool = False,
) -> tuple[Path, ...]:
    """Verify the pinned origin and copy, or check, every declared Parquet byte."""

    manifest = _load_object(manifest_path)
    expected_commit = _required_text(manifest.get("origin_commit"), "origin_commit")
    commit_check = subprocess.run(
        ["git", "cat-file", "-e", f"{expected_commit}^{{commit}}"],
        cwd=biominer_root,
        check=False,
        capture_output=True,
    )
    if commit_check.returncode != 0:
        raise ValueError(f"BioMiner expected pinned commit {expected_commit} is unavailable")

    source_manifest_entry = manifest.get("source_manifest")
    if not isinstance(source_manifest_entry, dict):
        raise ValueError("source_manifest must be an object")
    source_manifest_path = _required_text(source_manifest_entry.get("path"), "source_manifest.path")
    expected_manifest_sha = _required_text(
        source_manifest_entry.get("sha256"), "source_manifest.sha256"
    )
    source_manifest_content = _git_object_bytes(
        biominer_root, expected_commit, source_manifest_path
    )
    if hashlib.sha256(source_manifest_content).hexdigest() != expected_manifest_sha:
        raise ValueError("BioMiner geographic workload manifest checksum differs")
    source_manifest = _load_object_bytes(source_manifest_content, source_manifest_path)
    source_artifacts = source_manifest.get("artifacts")
    if not isinstance(source_artifacts, dict):
        raise ValueError("BioMiner source manifest artifacts must be an object")
    source_counts = source_manifest.get("counts")
    if not isinstance(source_counts, dict):
        raise ValueError("BioMiner source manifest counts must be an object")
    expected_record_counts = {
        "query_hits": source_counts.get("query_hit_count"),
        "geography": source_counts.get("geotagged_photo_count"),
        "assignments": source_counts.get("geotagged_photo_count"),
        "clusters": (
            source_counts.get("located_cluster_count", 0)
            + source_counts.get("fallback_cluster_count", 0)
        ),
    }

    artifacts = manifest.get("artifacts")
    if not isinstance(artifacts, list) or len(artifacts) != 4:
        raise ValueError("analytics import manifest must declare exactly four artifacts")

    imported: list[Path] = []
    seen_ids: set[str] = set()
    for index, raw in enumerate(artifacts):
        if not isinstance(raw, dict):
            raise ValueError(f"artifacts[{index}] must be an object")
        artifact_id = _required_text(raw.get("artifact_id"), f"artifacts[{index}].artifact_id")
        if artifact_id in seen_ids:
            raise ValueError(f"duplicate analytics artifact id: {artifact_id}")
        seen_ids.add(artifact_id)
        source_key = _required_text(
            raw.get("source_artifact_key"), f"artifacts[{index}].source_artifact_key"
        )
        source_entry = source_artifacts.get(source_key)
        if not isinstance(source_entry, dict):
            raise ValueError(f"BioMiner source manifest lacks artifact {source_key}")
        source_relative = _required_text(raw.get("source_path"), f"artifacts[{index}].source_path")
        if source_entry.get("path") != source_relative:
            raise ValueError(f"{artifact_id} path differs from the BioMiner source manifest")
        expected_bytes = raw.get("byte_count")
        if not isinstance(expected_bytes, int) or isinstance(expected_bytes, bool):
            raise ValueError(f"{artifact_id} byte_count must be an integer")
        if source_entry.get("byte_count") != expected_bytes:
            raise ValueError(f"{artifact_id} byte count differs from the BioMiner source manifest")
        expected_sha = _required_text(raw.get("sha256"), f"artifacts[{index}].sha256")
        if source_entry.get("sha256") != f"sha256:{expected_sha}":
            raise ValueError(f"{artifact_id} checksum differs from the BioMiner source manifest")
        record_count = raw.get("record_count")
        if record_count != expected_record_counts.get(source_key):
            raise ValueError(
                f"{artifact_id} record count differs from the BioMiner source manifest"
            )

        destination = REPOSITORY_ROOT / _required_text(
            raw.get("imported_path"), f"artifacts[{index}].imported_path"
        )
        if check:
            if not destination.is_file():
                raise ValueError(f"imported analytics artifact is missing: {destination}")
            content = destination.read_bytes()
            if (
                len(content) != expected_bytes
                or hashlib.sha256(content).hexdigest() != expected_sha
            ):
                raise ValueError(f"imported analytics artifact differs: {destination}")
        else:
            content = _source_bytes(biominer_root, expected_commit, source_relative)
            if (
                len(content) != expected_bytes
                or hashlib.sha256(content).hexdigest() != expected_sha
            ):
                raise ValueError(f"{artifact_id} source bytes fail the pinned import contract")
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(content)
        if content[:4] != b"PAR1" or content[-4:] != b"PAR1":
            raise ValueError(f"{artifact_id} is not a complete Parquet file")
        imported.append(destination)
    return tuple(imported)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--biominer-root", type=Path, default=DEFAULT_BIOMINER_ROOT)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--check", action="store_true")
    arguments = parser.parse_args()
    paths = import_biominer_analytics(
        biominer_root=arguments.biominer_root,
        manifest_path=arguments.manifest,
        check=arguments.check,
    )
    action = "verified" if arguments.check else "imported"
    print(f"{action} {len(paths)} pinned BioMiner analytics artifacts")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
