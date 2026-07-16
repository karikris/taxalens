#!/usr/bin/env python3
"""Import the fixed BioMiner Phase 14/15 compact prototype artifact set."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path, PurePosixPath
from typing import Any

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = REPOSITORY_ROOT / "demo/source/biominer_phase15/import_manifest.json"
DEFAULT_BIOMINER_ROOT = REPOSITORY_ROOT.parent / "BioMiner"
IMPORT_SCHEMA_VERSION = "taxalens-biominer-prototype-import:v1.0.0"
BIOMINER_COMMIT = "74a7d648a562efa744e6502ef504a23b63b4e02f"
_SHA256 = re.compile(r"[0-9a-f]{64}\Z")
_IMPORT_PREFIX = PurePosixPath("demo/source/biominer_phase15/artifacts")

EXPECTED_SOURCE_PATHS = (
    "examples/species/papilio_demoleus/pilot_build_week_prototype_mode_manifest.json",
    "examples/species/papilio_demoleus/pilot_build_week_prototype_report_manifest.json",
    "examples/species/papilio_demoleus/pilot_metadata_qualified_support_manifest.json",
    "examples/species/papilio_demoleus/pilot_prototype_acquisition_manifest.json",
    "examples/species/papilio_demoleus/pilot_prototype_b0_b16_manifest.json",
    "examples/species/papilio_demoleus/pilot_prototype_download_manifest.json",
    "examples/species/papilio_demoleus/pilot_prototype_duplicate_resolution_manifest.json",
    "examples/species/papilio_demoleus/pilot_prototype_embeddings_manifest.json",
    "examples/species/papilio_demoleus/pilot_prototype_evidence_manifest.json",
    "examples/species/papilio_demoleus/pilot_prototype_policy_manifest.json",
    "examples/species/papilio_demoleus/pilot_prototype_qa_manifest.json",
    "examples/species/papilio_demoleus/pilot_prototype_selection_manifest.json",
    "examples/species/papilio_demoleus/pilot_prototype_support_bank_manifest.json",
    "examples/species/papilio_demoleus/pilot_prototype_vision_smoke_manifest.json",
    "examples/species/papilio_demoleus/pilot_provider_support_goal_verification.json",
    "examples/species/papilio_demoleus/pilot_staged_flickr_manifest.json",
    "reports/phase14/papilio_demoleus_build_week_prototype_report.json",
    "reports/phase15/post_build_week_backlog.json",
    "reports/phase15/prototype_final_verification.json",
    "reports/phase15/prototype_go_no_go.json",
    "reports/phase15/prototype_release_acceptance.json",
)


def _reject_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def _load_object(path: Path) -> dict[str, Any]:
    value = json.loads(
        path.read_text(encoding="utf-8"),
        object_pairs_hook=_reject_duplicate_keys,
        parse_constant=lambda value: (_ for _ in ()).throw(
            ValueError(f"non-JSON numeric constant: {value}")
        ),
    )
    if not isinstance(value, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return value


def _required_text(value: object, location: str) -> str:
    if not isinstance(value, str) or not value:
        raise ValueError(f"{location} must be non-empty text")
    return value


def _safe_path(value: object, location: str) -> PurePosixPath:
    text = _required_text(value, location)
    path = PurePosixPath(text)
    if path.is_absolute() or ".." in path.parts or "." in path.parts:
        raise ValueError(f"{location} must be a safe repository-relative path")
    return path


def _git(*args: str, cwd: Path, text: bool = True) -> str | bytes:
    completed = subprocess.run(
        ["git", *args],
        cwd=cwd,
        check=True,
        capture_output=True,
        text=text,
    )
    return completed.stdout


def _committed_bytes(biominer_root: Path, commit: str, source_path: str) -> bytes:
    value = _git("show", f"{commit}:{source_path}", cwd=biominer_root, text=False)
    assert isinstance(value, bytes)
    return value


def import_biominer_prototype_artifacts(
    *,
    biominer_root: Path = DEFAULT_BIOMINER_ROOT,
    manifest_path: Path = DEFAULT_MANIFEST,
    check: bool = False,
) -> tuple[Path, ...]:
    """Verify and import exact committed JSON bytes from a fixed allowlist."""

    manifest = _load_object(manifest_path)
    if manifest.get("schema_version") != IMPORT_SCHEMA_VERSION:
        raise ValueError("prototype import manifest schema differs")
    if manifest.get("origin_repository") != "karikris/BioMiner":
        raise ValueError("prototype import requires the BioMiner origin")
    if manifest.get("origin_commit") != BIOMINER_COMMIT:
        raise ValueError("prototype import origin commit differs")
    if manifest.get("source_license") != "MIT":
        raise ValueError("prototype import source license differs")
    policy = manifest.get("import_policy")
    expected_policy = {
        "committed_git_objects_only": True,
        "exact_source_bytes_preserved": True,
        "untracked_sources_used": False,
        "reference_media_imported": False,
        "model_files_imported": False,
        "databases_or_caches_imported": False,
        "scientific_claim_allowed": False,
        "public_reference_image_display_allowed": False,
    }
    if policy != expected_policy:
        raise ValueError("prototype import policy differs")

    actual_head = _git("rev-parse", "HEAD", cwd=biominer_root)
    assert isinstance(actual_head, str)
    if actual_head.strip() != BIOMINER_COMMIT:
        raise ValueError(
            f"BioMiner HEAD is {actual_head.strip()}; expected pinned commit {BIOMINER_COMMIT}"
        )

    artifacts = manifest.get("artifacts")
    if not isinstance(artifacts, list):
        raise ValueError("prototype import artifacts must be an array")
    source_paths = [
        _required_text(
            artifact.get("source_path") if isinstance(artifact, dict) else None,
            f"artifacts[{index}].source_path",
        )
        for index, artifact in enumerate(artifacts)
    ]
    if tuple(sorted(source_paths)) != EXPECTED_SOURCE_PATHS:
        raise ValueError("prototype import source allowlist differs")

    imported: list[Path] = []
    seen_ids: set[str] = set()
    seen_destinations: set[PurePosixPath] = set()
    for index, raw in enumerate(artifacts):
        if not isinstance(raw, dict):
            raise ValueError(f"artifacts[{index}] must be an object")
        location = f"artifacts[{index}]"
        artifact_id = _required_text(raw.get("artifact_id"), f"{location}.artifact_id")
        if artifact_id in seen_ids:
            raise ValueError(f"duplicate prototype artifact id: {artifact_id}")
        seen_ids.add(artifact_id)
        source_path = _safe_path(raw.get("source_path"), f"{location}.source_path")
        imported_path = _safe_path(raw.get("imported_path"), f"{location}.imported_path")
        if imported_path == _IMPORT_PREFIX or _IMPORT_PREFIX not in imported_path.parents:
            raise ValueError(f"{location}.imported_path leaves the prototype import root")
        if imported_path in seen_destinations:
            raise ValueError(f"duplicate prototype import destination: {imported_path}")
        seen_destinations.add(imported_path)
        if source_path.suffix != ".json" or imported_path.suffix != ".json":
            raise ValueError(f"{artifact_id} must remain a JSON artifact")
        expected_sha = _required_text(raw.get("sha256"), f"{location}.sha256")
        if _SHA256.fullmatch(expected_sha) is None:
            raise ValueError(f"{artifact_id} SHA-256 is invalid")
        expected_bytes = raw.get("byte_count")
        if not isinstance(expected_bytes, int) or isinstance(expected_bytes, bool):
            raise ValueError(f"{artifact_id} byte_count must be an integer")
        expected_schema = _required_text(raw.get("schema_version"), f"{location}.schema_version")

        content = _committed_bytes(biominer_root, BIOMINER_COMMIT, source_path.as_posix())
        if len(content) != expected_bytes:
            raise ValueError(f"{artifact_id} byte count differs")
        if hashlib.sha256(content).hexdigest() != expected_sha:
            raise ValueError(f"{artifact_id} checksum differs")
        payload = json.loads(
            content,
            object_pairs_hook=_reject_duplicate_keys,
            parse_constant=lambda value: (_ for _ in ()).throw(
                ValueError(f"non-JSON numeric constant: {value}")
            ),
        )
        if not isinstance(payload, dict) or payload.get("schema_version") != expected_schema:
            raise ValueError(f"{artifact_id} schema version differs")

        destination = REPOSITORY_ROOT / imported_path
        if check:
            if not destination.is_file() or destination.is_symlink():
                raise ValueError(f"imported prototype artifact is missing: {destination}")
            if destination.read_bytes() != content:
                raise ValueError(f"imported prototype artifact differs: {destination}")
        else:
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(content)
        imported.append(destination)
    return tuple(imported)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--biominer-root", type=Path, default=DEFAULT_BIOMINER_ROOT)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--check", action="store_true")
    arguments = parser.parse_args()
    paths = import_biominer_prototype_artifacts(
        biominer_root=arguments.biominer_root,
        manifest_path=arguments.manifest,
        check=arguments.check,
    )
    action = "verified" if arguments.check else "imported"
    print(f"{action} {len(paths)} pinned BioMiner prototype artifacts")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
