"""Build the immutable inventory for one Geographic Impact materialization."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping
from pathlib import Path
from typing import Any

import polars as pl
from taxalens.product.geographic_contracts import (
    GEOGRAPHIC_IMPACT_MANIFEST_SCHEMA_VERSION,
    GeographicImpactManifestDocument,
)

from packages.replay.src.geographic_impact_materializer import (
    DEFAULT_BASELINE_UNION,
    DEFAULT_COUNTRY_HIERARCHY,
    DEFAULT_FLICKR_GEOGRAPHY,
    REPOSITORY_ROOT,
)
from packages.replay.src.occurrence_release import (
    DEFAULT_RELEASE_DECISIONS,
)

BASELINE_SPREAD = (
    REPOSITORY_ROOT
    / "demo/source/biominer_phase14/baseline_geography/taxon_geographic_spread.parquet"
)
VERIFICATION_CONSENSUS = (
    REPOSITORY_ROOT / "demo/repository_storage/supabase/verification_consensus.json"
)

BIOMINER_BASELINE_COMMIT = "247b42f3206d48bb79e2dbf97c5a92e4f207ae71"
BIOMINER_FLICKR_COMMIT = "75461d9c065af0cd96b41cd1f845c2e920f7ae34"
TAXALENS_BASELINE_UNION_COMMIT = "cdee00c9e16e349d722733cd951709abce8d0fee"
TAXALENS_VERIFICATION_STORAGE_COMMIT = "e85b0d225cfdad4932de95d745b936ae85a61097"
TAXALENS_RELEASE_AND_CELLS_COMMIT = "ffef38ec4abc289d31011f8c74b762524c0caeec"
TAXALENS_SUMMARY_COMMIT = "b399cd4fe92640ad9a219142f8a77ac2122e632e"
TAXALENS_COUNTRY_HIERARCHY_COMMIT = "6b2eb94d8998ce07d4ebd93e1613fcb0126dd0c0"

MANIFEST_CREATED_AT = "2026-07-17T12:11:22Z"
MANIFEST_GENERATOR = "taxalens-geographic-impact-builder:v1.0.0"

_PARQUET_MEDIA_TYPE = "application/vnd.apache.parquet"
_TAXALENS_RIGHTS = "taxalens-mit-fixture"
_BIOMINER_RIGHTS = "biominer-mit-metadata"


class GeographicImpactManifestError(ValueError):
    """Raised when the manifest cannot be reconciled with its artifacts."""


def build_geographic_impact_manifest(
    cells: pl.DataFrame,
    summaries: pl.DataFrame,
    *,
    cells_content: bytes,
    summaries_content: bytes,
    cells_path: Path,
    summaries_path: Path,
) -> dict[str, object]:
    """Create one deterministic, contract-validated materialization manifest."""

    if not cells.height or not summaries.height:
        raise GeographicImpactManifestError("impact outputs are empty")
    hierarchy = _read_json(DEFAULT_COUNTRY_HIERARCHY)
    global_rows = summaries.filter(pl.col("scope_level") == "global").sort("spatial_resolution")
    if global_rows.height != cells.get_column("spatial_resolution").n_unique():
        raise GeographicImpactManifestError("global summary coverage differs")
    canonical_global = global_rows.row(0, named=True)
    build_ids = cells.get_column("geographic_impact_build_id").unique().to_list()
    if build_ids != [canonical_global["geographic_impact_build_id"]]:
        raise GeographicImpactManifestError("cell and summary build identities differ")
    hierarchy_nodes = hierarchy.get("nodes")
    if not isinstance(hierarchy_nodes, list):
        raise GeographicImpactManifestError("country hierarchy nodes are missing")
    flickr_totals = _flickr_photo_totals()
    release_ready_count = _release_ready_photo_count()

    artifacts = [
        _available_parquet(
            "baseline_geographic_spread",
            BASELINE_SPREAD,
            schema_version="taxon-geographic-spread-v1.0.0",
            snapshot_id=str(canonical_global["baseline_snapshot_id"]),
            source_repository="karikris/BioMiner",
            source_commit=BIOMINER_BASELINE_COMMIT,
            rights_id=_BIOMINER_RIGHTS,
        ),
        _available_parquet(
            "baseline_occurrence_union",
            DEFAULT_BASELINE_UNION,
            schema_version="taxalens-baseline-occurrence-union:v1.0.0",
            snapshot_id=str(canonical_global["baseline_snapshot_id"]),
            source_repository="karikris/taxalens",
            source_commit=TAXALENS_BASELINE_UNION_COMMIT,
            rights_id=_TAXALENS_RIGHTS,
        ),
        _available_parquet(
            "flickr_geography",
            DEFAULT_FLICKR_GEOGRAPHY,
            schema_version="taxalens-flickr-geography-verification:v1.0.0",
            snapshot_id=str(canonical_global["flickr_snapshot_id"]),
            source_repository="karikris/BioMiner",
            source_commit=BIOMINER_FLICKR_COMMIT,
            rights_id=_BIOMINER_RIGHTS,
        ),
        _available_json(
            "verification_consensus",
            VERIFICATION_CONSENSUS,
            schema_version="taxalens-repository-supabase-table:v1.0.0",
            row_count=_json_row_count(VERIFICATION_CONSENSUS, "row_count"),
            source_commit=TAXALENS_VERIFICATION_STORAGE_COMMIT,
        ),
        _unavailable(
            "quality_snapshot",
            "No retained human outcomes support a geographic quality snapshot; the repository "
            "mirror contains an explicit empty quality-snapshot table contract.",
        ),
        _available_json(
            "release_decisions",
            DEFAULT_RELEASE_DECISIONS,
            schema_version="taxalens-occurrence-release-decisions:v1.0.0",
            row_count=_json_array_count(DEFAULT_RELEASE_DECISIONS, "rows"),
            source_commit=TAXALENS_RELEASE_AND_CELLS_COMMIT,
        ),
        _available_content(
            "geographic_impact_cells",
            cells_path,
            cells_content,
            media_type=_PARQUET_MEDIA_TYPE,
            schema_version=str(cells.item(0, "schema_version")),
            row_count=cells.height,
            source_repository="karikris/taxalens",
            source_commit=TAXALENS_RELEASE_AND_CELLS_COMMIT,
            rights_id=_TAXALENS_RIGHTS,
        ),
        _available_content(
            "geographic_impact_summary",
            summaries_path,
            summaries_content,
            media_type=_PARQUET_MEDIA_TYPE,
            schema_version=str(summaries.item(0, "schema_version")),
            row_count=summaries.height,
            source_repository="karikris/taxalens",
            source_commit=TAXALENS_SUMMARY_COMMIT,
            rights_id=_TAXALENS_RIGHTS,
        ),
        _available_json(
            "country_hierarchy",
            DEFAULT_COUNTRY_HIERARCHY,
            schema_version=str(hierarchy["schema_version"]),
            row_count=len(hierarchy_nodes),
            source_commit=TAXALENS_COUNTRY_HIERARCHY_COMMIT,
            rights_id="natural-earth-public-domain-boundaries",
        ),
    ]
    base: dict[str, object] = {
        "schema_version": GEOGRAPHIC_IMPACT_MANIFEST_SCHEMA_VERSION,
        "geographic_impact_build_id": str(canonical_global["geographic_impact_build_id"]),
        "created_at": MANIFEST_CREATED_AT,
        "project_id": str(canonical_global["project_id"]),
        "run_id": str(canonical_global["run_id"]),
        "registry_version": str(canonical_global["registry_version"]),
        "accepted_taxon_key": str(canonical_global["accepted_taxon_key"]),
        "scientific_name": str(canonical_global["scientific_name"]),
        "baseline_snapshot_id": str(canonical_global["baseline_snapshot_id"]),
        "flickr_snapshot_id": str(canonical_global["flickr_snapshot_id"]),
        "provider_union_policy_version": str(canonical_global["provider_union_policy_version"]),
        "verification_projection_version": str(canonical_global["verification_projection_version"]),
        "release_policy_version": str(canonical_global["release_policy_version"]),
        "country_hierarchy_id": str(canonical_global["country_hierarchy_id"]),
        "spatial_resolutions": sorted(
            int(value) for value in cells.get_column("spatial_resolution").unique().to_list()
        ),
        "summary_scope_levels": ["global", "continent", "country", "admin1"],
        "source_commits": _source_commits(artifacts),
        "artifacts": artifacts,
        "impact_cell_count": cells.height,
        "summary_row_count": summaries.height,
        "hierarchy_node_count": len(hierarchy_nodes),
        "baseline_evidence_status": str(canonical_global["baseline_evidence_status"]),
        "baseline_union_count": int(canonical_global["baseline_union_count"]),
        "direct_inaturalist_delta_status": str(canonical_global["direct_inaturalist_delta_status"]),
        "direct_inaturalist_delta_count": canonical_global["direct_inaturalist_delta_count"],
        "flickr_candidate_count": flickr_totals["flickr_candidate_count"],
        "geographically_supported_flickr_candidate_count": flickr_totals[
            "geographically_supported_flickr_candidate_count"
        ],
        "geographically_unsupported_flickr_candidate_count": flickr_totals[
            "geographically_unsupported_flickr_candidate_count"
        ],
        "reviewed_positive_count": flickr_totals["reviewed_positive_count"],
        "reviewed_negative_count": flickr_totals["reviewed_negative_count"],
        "uncertain_count": flickr_totals["uncertain_count"],
        "pending_count": flickr_totals["pending_count"],
        "media_failure_count": flickr_totals["media_failure_count"],
        "skipped_count": flickr_totals["skipped_count"],
        "release_ready_count": release_ready_count,
        "baseline_only_cell_count": int(cells.get_column("baseline_only_cell").sum()),
        "matched_cell_count": int(cells.get_column("matched_cell").sum()),
        "candidate_only_cell_count": int(cells.get_column("candidate_only_cell").sum()),
        "reviewed_additional_cell_count": int(cells.get_column("reviewed_additional_cell").sum()),
        "release_ready_additional_cell_count": int(
            cells.get_column("release_ready_additional_cell").sum()
        ),
        "unassigned_cartographic_cell_count": cells.filter(pl.col("country_code").is_null()).height,
        "generated_by": MANIFEST_GENERATOR,
    }
    fingerprint = _sha256(_canonical_json_bytes(base))
    document = {
        **base,
        "manifest_id": f"geographic-impact-manifest:{fingerprint[:24]}",
        "deterministic_fingerprint_sha256": fingerprint,
    }
    # Reorder the two derived identity fields into the public contract order.
    ordered = {
        "schema_version": document.pop("schema_version"),
        "manifest_id": document.pop("manifest_id"),
        "geographic_impact_build_id": document.pop("geographic_impact_build_id"),
        **document,
    }
    return GeographicImpactManifestDocument.from_mapping(ordered).to_dict()


def _available_parquet(
    logical_name: str,
    path: Path,
    *,
    schema_version: str,
    snapshot_id: str,
    source_repository: str,
    source_commit: str,
    rights_id: str,
) -> dict[str, object]:
    content = path.read_bytes()
    row_count = pl.scan_parquet(path).select(pl.len()).collect().item()
    return _available_content(
        logical_name,
        path,
        content,
        media_type=_PARQUET_MEDIA_TYPE,
        schema_version=schema_version,
        row_count=int(row_count),
        snapshot_id=snapshot_id,
        source_repository=source_repository,
        source_commit=source_commit,
        rights_id=rights_id,
    )


def _available_json(
    logical_name: str,
    path: Path,
    *,
    schema_version: str,
    row_count: int,
    source_commit: str,
    rights_id: str = _TAXALENS_RIGHTS,
) -> dict[str, object]:
    return _available_content(
        logical_name,
        path,
        path.read_bytes(),
        media_type="application/json",
        schema_version=schema_version,
        row_count=row_count,
        source_repository="karikris/taxalens",
        source_commit=source_commit,
        rights_id=rights_id,
    )


def _available_content(
    logical_name: str,
    path: Path,
    content: bytes,
    *,
    media_type: str,
    schema_version: str,
    row_count: int,
    source_repository: str,
    source_commit: str,
    rights_id: str,
    snapshot_id: str | None = None,
) -> dict[str, object]:
    return {
        "logical_name": logical_name,
        "availability": "available",
        "path": path.relative_to(REPOSITORY_ROOT).as_posix(),
        "media_type": media_type,
        "schema_version": schema_version,
        "sha256": _sha256(content),
        "byte_size": len(content),
        "row_count": row_count,
        "snapshot_id": snapshot_id,
        "source_repository": source_repository,
        "source_commit": source_commit,
        "rights_id": rights_id,
        "unavailable_reason": None,
    }


def _unavailable(logical_name: str, reason: str) -> dict[str, object]:
    return {
        "logical_name": logical_name,
        "availability": "unavailable",
        "path": None,
        "media_type": None,
        "schema_version": None,
        "sha256": None,
        "byte_size": None,
        "row_count": None,
        "snapshot_id": None,
        "source_repository": None,
        "source_commit": None,
        "rights_id": None,
        "unavailable_reason": reason,
    }


def _source_commits(artifacts: list[dict[str, object]]) -> list[dict[str, str]]:
    pairs = {
        (str(artifact["source_repository"]), str(artifact["source_commit"]))
        for artifact in artifacts
        if artifact["source_repository"] is not None
    }
    return [
        {"repository": repository, "commit_sha": commit} for repository, commit in sorted(pairs)
    ]


def _flickr_photo_totals() -> dict[str, int]:
    frame = pl.read_parquet(
        DEFAULT_FLICKR_GEOGRAPHY,
        columns=["flickr_photo_id", "cell_supported", "human_review_state"],
    )
    inconsistent = (
        frame.group_by("flickr_photo_id")
        .agg(pl.col("human_review_state").n_unique().alias("state_count"))
        .filter(pl.col("state_count") != 1)
    )
    if inconsistent.height:
        raise GeographicImpactManifestError("Flickr review state differs across resolutions")
    photos = frame.group_by("flickr_photo_id").agg(
        pl.col("cell_supported").any().alias("geographically_supported"),
        pl.col("human_review_state").first(),
    )
    states = {
        "reviewed_positive_count": ["reviewed_target_positive"],
        "reviewed_negative_count": ["reviewed_non_target"],
        "uncertain_count": ["uncertain"],
        "pending_count": ["not_requested", "pending"],
        "media_failure_count": ["media_failure"],
        "skipped_count": ["deferred"],
    }
    totals = {
        output_name: photos.filter(pl.col("human_review_state").is_in(source_states)).height
        for output_name, source_states in states.items()
    }
    if sum(totals.values()) != photos.height:
        raise GeographicImpactManifestError("Flickr review-state totals do not reconcile")
    supported = photos.filter(pl.col("geographically_supported")).height
    return {
        "flickr_candidate_count": photos.height,
        "geographically_supported_flickr_candidate_count": supported,
        "geographically_unsupported_flickr_candidate_count": photos.height - supported,
        **totals,
    }


def _release_ready_photo_count() -> int:
    rows = _read_json(DEFAULT_RELEASE_DECISIONS).get("rows")
    if not isinstance(rows, list):
        raise GeographicImpactManifestError("release-decision rows are missing")
    photo_ids = {
        row["flickr_photo_id"]
        for row in rows
        if isinstance(row, dict) and row.get("decision_status") == "release_ready"
    }
    return len(photo_ids)


def _read_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise GeographicImpactManifestError(f"JSON artifact is not an object: {path}")
    return value


def _json_row_count(path: Path, field: str) -> int:
    value = _read_json(path).get(field)
    if not isinstance(value, int) or value < 0:
        raise GeographicImpactManifestError(f"JSON artifact has no valid {field}: {path}")
    return value


def _json_array_count(path: Path, field: str) -> int:
    value = _read_json(path).get(field)
    if not isinstance(value, list):
        raise GeographicImpactManifestError(f"JSON artifact has no valid {field}: {path}")
    return len(value)


def _canonical_json_bytes(value: Mapping[str, object]) -> bytes:
    return (
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n"
    ).encode("utf-8")


def _sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


__all__ = [
    "MANIFEST_CREATED_AT",
    "MANIFEST_GENERATOR",
    "GeographicImpactManifestError",
    "build_geographic_impact_manifest",
]
