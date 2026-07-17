#!/usr/bin/env python3
"""Verify the committed precision-aware BioMiner Flickr geography handoff."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from pathlib import Path, PurePosixPath
from typing import Any

import polars as pl

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = (
    REPOSITORY_ROOT / "demo/source/biominer_phase14/flickr_geography_handoff_manifest.json"
)
DEFAULT_BIOMINER_ROOT = REPOSITORY_ROOT.parent / "BioMiner"
HANDOFF_SCHEMA_VERSION = "taxalens-biominer-flickr-geography-handoff:v1.0.0"
BIOMINER_COMMIT = "75461d9c065af0cd96b41cd1f845c2e920f7ae34"
EXPECTED_COLUMNS = (
    "schema_version",
    "source",
    "flickr_photo_id",
    "source_record_hash",
    "latitude",
    "longitude",
    "coordinate_accuracy",
    "coordinate_source",
    "geotag_available",
    "country_code",
    "admin1",
    "coarse_cell_id",
    "regional_cell_id",
    "local_cell_id",
    "coordinate_quality",
    "geography_warning",
    "geography_warnings",
    "geography_config_fingerprint",
)


class FlickrGeographyHandoffError(ValueError):
    """Raised when the committed Flickr geography handoff differs."""


def _reject_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise FlickrGeographyHandoffError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def _load_object(path: Path, label: str) -> dict[str, Any]:
    try:
        payload = json.loads(
            path.read_text(encoding="utf-8"),
            object_pairs_hook=_reject_duplicate_keys,
        )
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise FlickrGeographyHandoffError(f"cannot read {label}: {path}") from error
    if not isinstance(payload, dict):
        raise FlickrGeographyHandoffError(f"{label} must contain a JSON object")
    return payload


def _required_text(value: object, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise FlickrGeographyHandoffError(f"{label} must be non-empty text")
    return value


def _mapping(value: object, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise FlickrGeographyHandoffError(f"{label} must be an object")
    return value


def _safe_repository_path(value: object, label: str) -> Path:
    path = PurePosixPath(_required_text(value, label))
    if path.is_absolute() or ".." in path.parts or "." in path.parts:
        raise FlickrGeographyHandoffError(f"{label} must be repository-relative")
    return REPOSITORY_ROOT / path


def _sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _git_bytes(biominer_root: Path, commit: str, path: str) -> bytes:
    try:
        resolved = subprocess.run(
            ["git", "rev-parse", "--verify", f"{commit}^{{commit}}"],
            cwd=biominer_root,
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
        if resolved != commit:
            raise FlickrGeographyHandoffError("BioMiner origin commit resolves differently")
        return subprocess.run(
            ["git", "show", f"{commit}:{path}"],
            cwd=biominer_root,
            check=True,
            capture_output=True,
        ).stdout
    except subprocess.CalledProcessError as error:
        raise FlickrGeographyHandoffError(
            f"pinned BioMiner object is unavailable: {commit}:{path}"
        ) from error


def _count_mapping(frame: pl.DataFrame, column: str) -> dict[str, int]:
    result: dict[str, int] = {}
    for row in frame.group_by(column).len().iter_rows(named=True):
        key = "none" if row[column] is None else str(row[column])
        result[key] = int(row["len"])
    return result


def _verify_source_receipts(
    manifest: dict[str, Any], biominer_root: Path
) -> tuple[dict[str, Any], dict[str, Any]]:
    source_descriptor = _mapping(manifest.get("source_manifest"), "source_manifest")
    source_path = _required_text(source_descriptor.get("path"), "source_manifest.path")
    source_content = _git_bytes(biominer_root, BIOMINER_COMMIT, source_path)
    if _sha256(source_content) != source_descriptor.get("sha256"):
        raise FlickrGeographyHandoffError("BioMiner workload manifest checksum differs")
    try:
        source_manifest = json.loads(source_content, object_pairs_hook=_reject_duplicate_keys)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise FlickrGeographyHandoffError("BioMiner workload manifest is invalid") from error
    if not isinstance(source_manifest, dict):
        raise FlickrGeographyHandoffError("BioMiner workload manifest must be an object")

    import_descriptor = _mapping(
        manifest.get("analytics_import_manifest"), "analytics_import_manifest"
    )
    import_path = _safe_repository_path(
        import_descriptor.get("path"), "analytics_import_manifest.path"
    )
    import_content = import_path.read_bytes()
    if _sha256(import_content) != import_descriptor.get("sha256"):
        raise FlickrGeographyHandoffError("analytics import manifest checksum differs")
    import_manifest = _load_object(import_path, "analytics import manifest")
    if import_manifest.get("origin_commit") != BIOMINER_COMMIT:
        raise FlickrGeographyHandoffError("analytics import origin commit differs")
    return source_manifest, import_manifest


def _verify_artifact_receipts(
    manifest: dict[str, Any],
    source_manifest: dict[str, Any],
    import_manifest: dict[str, Any],
) -> tuple[Path, dict[str, Any]]:
    artifact = _mapping(manifest.get("artifact"), "artifact")
    if artifact.get("artifact_id") != "biominer-flickr-geography-parquet":
        raise FlickrGeographyHandoffError("Flickr geography artifact id differs")
    artifact_path = _safe_repository_path(artifact.get("path"), "artifact.path")
    content = artifact_path.read_bytes()
    if (
        len(content) != artifact.get("byte_count")
        or _sha256(content) != artifact.get("sha256")
        or content[:4] != b"PAR1"
        or content[-4:] != b"PAR1"
    ):
        raise FlickrGeographyHandoffError("Flickr geography artifact bytes differ")

    import_artifacts = import_manifest.get("artifacts")
    if not isinstance(import_artifacts, list):
        raise FlickrGeographyHandoffError("analytics import artifacts must be an array")
    matches = [
        row
        for row in import_artifacts
        if isinstance(row, dict) and row.get("artifact_id") == artifact["artifact_id"]
    ]
    if len(matches) != 1:
        raise FlickrGeographyHandoffError("analytics import lacks Flickr geography")
    imported = matches[0]
    if (
        imported.get("imported_path") != artifact_path.relative_to(REPOSITORY_ROOT).as_posix()
        or imported.get("record_count") != artifact.get("row_count")
        or imported.get("byte_count") != artifact.get("byte_count")
        or imported.get("sha256") != artifact.get("sha256")
    ):
        raise FlickrGeographyHandoffError("analytics import artifact metadata differs")

    source_artifacts = source_manifest.get("artifacts")
    source_geography = (
        source_artifacts.get("geography") if isinstance(source_artifacts, dict) else None
    )
    if not isinstance(source_geography, dict):
        raise FlickrGeographyHandoffError("BioMiner workload lacks Flickr geography")
    if (
        source_geography.get("path") != imported.get("source_path")
        or source_geography.get("byte_count") != artifact.get("byte_count")
        or source_geography.get("sha256") != f"sha256:{artifact.get('sha256')}"
    ):
        raise FlickrGeographyHandoffError("BioMiner workload artifact metadata differs")
    return artifact_path, artifact


def verify_flickr_geography_handoff(
    *,
    manifest_path: Path = DEFAULT_MANIFEST,
    biominer_root: Path = DEFAULT_BIOMINER_ROOT,
) -> pl.DataFrame:
    """Verify and return the immutable Flickr candidate-geography frame."""

    manifest = _load_object(manifest_path, "Flickr geography handoff manifest")
    if manifest.get("schema_version") != HANDOFF_SCHEMA_VERSION:
        raise FlickrGeographyHandoffError("Flickr geography handoff schema differs")
    if manifest.get("origin_repository") != "karikris/BioMiner":
        raise FlickrGeographyHandoffError("Flickr geography origin repository differs")
    if manifest.get("origin_commit") != BIOMINER_COMMIT:
        raise FlickrGeographyHandoffError("Flickr geography origin commit differs")
    if manifest.get("source_license") != "MIT":
        raise FlickrGeographyHandoffError("Flickr geography source licence differs")
    if manifest.get("scientific_claim_allowed") is not False:
        raise FlickrGeographyHandoffError("Flickr geography scientific claim gate differs")

    source_manifest, import_manifest = _verify_source_receipts(manifest, biominer_root)
    artifact_path, artifact = _verify_artifact_receipts(manifest, source_manifest, import_manifest)
    frame = pl.read_parquet(artifact_path)
    if frame.height != artifact.get("row_count") or tuple(frame.columns) != EXPECTED_COLUMNS:
        raise FlickrGeographyHandoffError("Flickr geography Parquet contract differs")
    for column, expected in (
        ("schema_version", artifact.get("schema_version")),
        ("source", "flickr"),
    ):
        if frame.get_column(column).unique().to_list() != [expected]:
            raise FlickrGeographyHandoffError(f"Flickr geography {column} differs")
    if frame.get_column("flickr_photo_id").n_unique() != frame.height:
        raise FlickrGeographyHandoffError("Flickr geography photo identity is not unique")

    contract = _mapping(manifest.get("geography_contract"), "geography_contract")
    fingerprint = _required_text(
        contract.get("geography_config_fingerprint"),
        "geography_config_fingerprint",
    )
    if frame.get_column("geography_config_fingerprint").unique().to_list() != [fingerprint]:
        raise FlickrGeographyHandoffError("Flickr geography config fingerprint differs")
    precision_support = _mapping(contract.get("precision_support"), "precision_support")
    cell_columns = {3: "coarse_cell_id", 5: "regional_cell_id", 7: "local_cell_id"}
    for quality, supported in precision_support.items():
        rows = frame.filter(pl.col("coordinate_quality") == quality)
        if not isinstance(supported, list):
            raise FlickrGeographyHandoffError("precision support must contain arrays")
        for resolution, column in cell_columns.items():
            expected_support = resolution in supported
            if rows.get_column(column).is_not_null().all() != expected_support:
                raise FlickrGeographyHandoffError(
                    f"{quality} support differs at resolution {resolution}"
                )

    observed = _mapping(manifest.get("observed_counts"), "observed_counts")
    if (
        observed.get("canonical_photo_count") != frame.height
        or observed.get("geotag_available_count") != frame.get_column("geotag_available").sum()
        or observed.get("coordinate_quality") != _count_mapping(frame, "coordinate_quality")
        or observed.get("primary_warnings") != _count_mapping(frame, "geography_warning")
    ):
        raise FlickrGeographyHandoffError("Flickr geography observed counts differ")
    supported_counts = {
        str(resolution): frame.get_column(column).is_not_null().sum()
        for resolution, column in cell_columns.items()
    }
    if observed.get("supported_cell_rows") != supported_counts:
        raise FlickrGeographyHandoffError("Flickr supported-cell counts differ")
    if (
        observed.get("country_code_available_count")
        != frame.get_column("country_code").is_not_null().sum()
        or observed.get("admin1_available_count") != frame.get_column("admin1").is_not_null().sum()
    ):
        raise FlickrGeographyHandoffError("Flickr geography admin availability differs")
    return frame


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--biominer-root", type=Path, default=DEFAULT_BIOMINER_ROOT)
    arguments = parser.parse_args()
    frame = verify_flickr_geography_handoff(
        manifest_path=arguments.manifest,
        biominer_root=arguments.biominer_root,
    )
    print(f"verified {frame.height} committed Flickr candidate-geography rows")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
