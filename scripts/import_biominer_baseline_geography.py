#!/usr/bin/env python3
"""Import and verify the pinned BioMiner baseline-geography handoff."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from io import BytesIO
from pathlib import Path, PurePosixPath
from tempfile import TemporaryDirectory
from typing import Any

import polars as pl

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = (
    REPOSITORY_ROOT
    / "demo/source/biominer_phase14/baseline_geography_import_manifest.json"
)
DEFAULT_BIOMINER_ROOT = REPOSITORY_ROOT.parent / "BioMiner"
IMPORT_SCHEMA_VERSION = "taxalens-biominer-baseline-geography-import:v1.0.0"
BIOMINER_COMMIT = "247b42f3206d48bb79e2dbf97c5a92e4f207ae71"
IMPORT_ROOT = PurePosixPath("demo/source/biominer_phase14/baseline_geography")
_SHA256 = re.compile(r"[0-9a-f]{64}\Z")
_SOURCE_ARTIFACT_IDS = frozenset(
    {
        "biominer-geographic-occurrence-evidence-parquet",
        "biominer-geographic-spread-manifest",
        "biominer-taxon-geographic-spread-parquet",
    }
)
_GENERATED_ARTIFACT_IDS = frozenset(
    {
        "biominer-geographic-qa-findings-parquet",
        "biominer-geographic-summary-manifest",
        "biominer-taxon-geographic-summary-parquet",
    }
)
_EXPECTED_POLICY = {
    "origin_code_commit_pinned": True,
    "source_runtime_artifacts_tracked_upstream": False,
    "source_runtime_artifacts_checksum_verified": True,
    "imported_artifacts_committed_in_taxalens": True,
    "summary_built_with_pinned_upstream_code": True,
    "engine_code_copied": False,
    "external_storage_required": False,
    "baseline_absence_proves_biological_absence": False,
}


def _reject_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def _load_object(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(
            path.read_text(encoding="utf-8"),
            object_pairs_hook=_reject_duplicate_keys,
            parse_constant=lambda value: (_ for _ in ()).throw(
                ValueError(f"non-JSON numeric constant: {value}")
            ),
        )
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError(f"cannot read baseline geography manifest: {path}") from error
    if not isinstance(value, dict):
        raise ValueError("baseline geography import manifest must be an object")
    return value


def _required_text(value: object, location: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{location} must be non-empty text")
    return value


def _safe_path(value: object, location: str) -> PurePosixPath:
    path = PurePosixPath(_required_text(value, location))
    if path.is_absolute() or not path.parts or ".." in path.parts or "." in path.parts:
        raise ValueError(f"{location} must be a safe repository-relative path")
    return path


def _sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _git(*arguments: str, cwd: Path) -> str:
    try:
        return subprocess.run(
            ["git", *arguments],
            cwd=cwd,
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
    except subprocess.CalledProcessError as error:
        raise ValueError(f"BioMiner git verification failed: {' '.join(arguments)}") from error


def _verify_origin(biominer_root: Path, *, require_head: bool) -> None:
    resolved = _git("rev-parse", "--verify", f"{BIOMINER_COMMIT}^{{commit}}", cwd=biominer_root)
    if resolved != BIOMINER_COMMIT:
        raise ValueError(f"BioMiner origin resolved to {resolved}; expected {BIOMINER_COMMIT}")
    _git(
        "cat-file",
        "-e",
        f"{BIOMINER_COMMIT}:src/biominer/registry/geographic_summary.py",
        cwd=biominer_root,
    )
    if require_head:
        head = _git("rev-parse", "HEAD", cwd=biominer_root)
        if head != BIOMINER_COMMIT:
            raise ValueError(
                f"BioMiner checkout is {head}; importing requires exact HEAD {BIOMINER_COMMIT}"
            )


def _validate_manifest(manifest: dict[str, Any]) -> list[dict[str, Any]]:
    if manifest.get("schema_version") != IMPORT_SCHEMA_VERSION:
        raise ValueError("baseline geography import schema differs")
    if manifest.get("origin_repository") != "karikris/BioMiner":
        raise ValueError("baseline geography import requires the BioMiner origin")
    if manifest.get("origin_commit") != BIOMINER_COMMIT:
        raise ValueError("baseline geography import origin commit differs")
    if manifest.get("source_license") != "MIT":
        raise ValueError("baseline geography source licence differs")
    if manifest.get("import_policy") != _EXPECTED_POLICY:
        raise ValueError("baseline geography import policy differs")
    artifacts = manifest.get("artifacts")
    if not isinstance(artifacts, list):
        raise ValueError("baseline geography artifacts must be an array")
    artifact_ids = [
        _required_text(
            item.get("artifact_id") if isinstance(item, dict) else None,
            f"artifacts[{index}].artifact_id",
        )
        for index, item in enumerate(artifacts)
    ]
    expected_ids = sorted(_SOURCE_ARTIFACT_IDS | _GENERATED_ARTIFACT_IDS)
    if artifact_ids != expected_ids:
        raise ValueError("baseline geography artifact allowlist differs")
    return artifacts


def _artifact_paths(entry: dict[str, Any], index: int) -> tuple[PurePosixPath | None, Path]:
    location = f"artifacts[{index}]"
    source_value = entry.get("source_path")
    source_path = (
        None
        if source_value is None
        else _safe_path(source_value, f"{location}.source_path")
    )
    imported_path = _safe_path(entry.get("imported_path"), f"{location}.imported_path")
    if imported_path == IMPORT_ROOT or IMPORT_ROOT not in imported_path.parents:
        raise ValueError(f"{location}.imported_path leaves the baseline geography root")
    destination = REPOSITORY_ROOT / imported_path
    return source_path, destination


def _verify_content(entry: dict[str, Any], content: bytes, index: int) -> None:
    location = f"artifacts[{index}]"
    artifact_id = _required_text(entry.get("artifact_id"), f"{location}.artifact_id")
    expected_bytes = entry.get("byte_count")
    if (
        not isinstance(expected_bytes, int)
        or isinstance(expected_bytes, bool)
        or expected_bytes < 1
    ):
        raise ValueError(f"{location}.byte_count must be a positive integer")
    if len(content) != expected_bytes:
        raise ValueError(f"{artifact_id} byte count differs")
    expected_sha = _required_text(entry.get("sha256"), f"{location}.sha256")
    if _SHA256.fullmatch(expected_sha) is None or _sha256(content) != expected_sha:
        raise ValueError(f"{artifact_id} checksum differs")
    media_type = _required_text(entry.get("media_type"), f"{location}.media_type")
    schema_version = _required_text(entry.get("schema_version"), f"{location}.schema_version")
    if media_type == "application/json":
        payload = json.loads(content, object_pairs_hook=_reject_duplicate_keys)
        if not isinstance(payload, dict) or payload.get("schema_version") != schema_version:
            raise ValueError(f"{artifact_id} JSON schema version differs")
        return
    if (
        media_type != "application/vnd.apache.parquet"
        or content[:4] != b"PAR1"
        or content[-4:] != b"PAR1"
    ):
        raise ValueError(f"{artifact_id} is not a complete declared Parquet artifact")
    frame = pl.read_parquet(BytesIO(content))
    row_count = entry.get("row_count")
    if not isinstance(row_count, int) or isinstance(row_count, bool) or frame.height != row_count:
        raise ValueError(f"{artifact_id} row count differs")
    if artifact_id != "biominer-geographic-qa-findings-parquet":
        versions = frame.get_column("schema_version").unique().to_list()
        if versions != [schema_version]:
            raise ValueError(f"{artifact_id} Parquet schema version differs")


def _generate_summary(
    *, biominer_root: Path, manifest: dict[str, Any], source_paths: dict[str, Path]
) -> dict[str, bytes]:
    build = manifest.get("summary_build")
    if not isinstance(build, dict):
        raise ValueError("summary_build must be an object")
    policy = build.get("policy")
    if not isinstance(policy, dict):
        raise ValueError("summary_build.policy must be an object")
    policy_values = dict(policy)
    policy_values.pop("policy_version", None)
    with TemporaryDirectory(prefix="taxalens-baseline-geography-") as output:
        interpreter = biominer_root / ".venv/bin/python"
        if not interpreter.is_file():
            interpreter = Path(sys.executable)
        program = """
import json
import sys
import polars as pl
from biominer.registry.geographic_summary import GeographicSummaryPolicy, build_geographic_summary

build_geographic_summary(
    spread=pl.read_parquet(sys.argv[1]),
    occurrence_evidence=pl.read_parquet(sys.argv[2]),
    taxa=pl.DataFrame([{
        "accepted_taxon_key": sys.argv[4],
        "scientific_name": sys.argv[5],
        "rank": "SPECIES",
    }]),
    registry_version=sys.argv[6],
    policy=GeographicSummaryPolicy(**json.loads(sys.argv[8])),
    output_dir=sys.argv[3],
    created_at=sys.argv[7],
)
"""
        try:
            subprocess.run(
                [
                    str(interpreter),
                    "-c",
                    program,
                    str(source_paths["biominer-taxon-geographic-spread-parquet"]),
                    str(source_paths["biominer-geographic-occurrence-evidence-parquet"]),
                    output,
                    _required_text(manifest.get("accepted_taxon_key"), "accepted_taxon_key"),
                    _required_text(manifest.get("scientific_name"), "scientific_name"),
                    _required_text(manifest.get("registry_version"), "registry_version"),
                    _required_text(build.get("created_at"), "summary_build.created_at"),
                    json.dumps(policy_values, sort_keys=True),
                ],
                cwd=biominer_root,
                check=True,
                capture_output=True,
                text=True,
            )
        except subprocess.CalledProcessError as error:
            raise ValueError("pinned BioMiner geographic summary builder failed") from error
        output_root = Path(output)
        return {
            "biominer-geographic-qa-findings-parquet": (
                output_root / "geographic_qa_findings.parquet"
            ).read_bytes(),
            "biominer-geographic-summary-manifest": (
                output_root / "geographic_summary_manifest.json"
            ).read_bytes(),
            "biominer-taxon-geographic-summary-parquet": (
                output_root / "taxon_geographic_summary.parquet"
            ).read_bytes(),
        }


def import_biominer_baseline_geography(
    *,
    biominer_root: Path = DEFAULT_BIOMINER_ROOT,
    manifest_path: Path = DEFAULT_MANIFEST,
    check: bool = False,
) -> tuple[Path, ...]:
    """Verify committed imports, or rebuild them from the pinned BioMiner checkout."""

    manifest = _load_object(manifest_path)
    artifacts = _validate_manifest(manifest)
    _verify_origin(biominer_root, require_head=not check)
    generated: dict[str, bytes] = {}
    source_paths: dict[str, Path] = {}
    if not check:
        for index, entry in enumerate(artifacts):
            artifact_id = str(entry["artifact_id"])
            source_path, _ = _artifact_paths(entry, index)
            if artifact_id in _SOURCE_ARTIFACT_IDS:
                if source_path is None:
                    raise ValueError(f"{artifact_id} source path is missing")
                path = biominer_root / source_path
                if not path.is_file() or path.is_symlink():
                    raise ValueError(f"BioMiner runtime artifact is unavailable: {source_path}")
                source_paths[artifact_id] = path
        generated = _generate_summary(
            biominer_root=biominer_root,
            manifest=manifest,
            source_paths=source_paths,
        )

    imported: list[Path] = []
    for index, entry in enumerate(artifacts):
        artifact_id = str(entry["artifact_id"])
        _, destination = _artifact_paths(entry, index)
        if check:
            if not destination.is_file() or destination.is_symlink():
                raise ValueError(f"imported baseline geography artifact is missing: {destination}")
            content = destination.read_bytes()
        elif artifact_id in _SOURCE_ARTIFACT_IDS:
            content = source_paths[artifact_id].read_bytes()
        else:
            content = generated[artifact_id]
        _verify_content(entry, content, index)
        if not check:
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
    paths = import_biominer_baseline_geography(
        biominer_root=arguments.biominer_root,
        manifest_path=arguments.manifest,
        check=arguments.check,
    )
    action = "verified" if arguments.check else "imported"
    print(f"{action} {len(paths)} pinned BioMiner baseline geography artifacts")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
