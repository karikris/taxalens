"""Adapt the checksum-verified BioMiner baseline-geography handoff."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any

import polars as pl
from scripts.import_biominer_baseline_geography import (
    DEFAULT_BIOMINER_ROOT,
    DEFAULT_MANIFEST,
    REPOSITORY_ROOT,
    import_biominer_baseline_geography,
)

BASELINE_GEOGRAPHY_ADAPTER_SCHEMA_VERSION = "taxalens-biominer-baseline-geography-adapter:v1.0.0"
TAXALENS_BASELINE_SPREAD_SCHEMA_VERSION = "taxalens-baseline-geographic-spread:v1.0.0"
TAXALENS_BASELINE_EVIDENCE_SCHEMA_VERSION = (
    "taxalens-baseline-geographic-occurrence-evidence:v1.0.0"
)
TAXALENS_BASELINE_SUMMARY_SCHEMA_VERSION = "taxalens-baseline-geographic-summary:v1.0.0"
TAXALENS_BASELINE_QA_SCHEMA_VERSION = "taxalens-baseline-geographic-qa:v1.0.0"

SPREAD_COLUMNS = (
    "schema_version",
    "registry_version",
    "accepted_taxon_key",
    "gbif_species_key",
    "scientific_name",
    "source",
    "source_dataset_key",
    "source_dataset_citation",
    "source_query_hash",
    "spatial_cell_id",
    "spatial_resolution",
    "country_code",
    "admin1",
    "bioregion",
    "centroid_latitude",
    "centroid_longitude",
    "occurrence_count",
    "georeferenced_occurrence_count",
    "range_inference_eligible_count",
    "preserved_specimen_count",
    "fossil_count",
    "geospatial_issue_count",
    "coordinate_uncertainty_summary",
    "earliest_occurrence_date",
    "latest_occurrence_date",
    "basis_of_record_counts",
    "establishment_means",
    "occurrence_status",
    "known_range_role",
    "evidence_confidence",
    "retrieved_at",
    "source_snapshot_version",
)

OCCURRENCE_EVIDENCE_COLUMNS = (
    "schema_version",
    "gbif_id",
    "registry_version",
    "accepted_taxon_key",
    "gbif_species_key",
    "scientific_name",
    "source",
    "source_dataset_key",
    "source_dataset_citation",
    "source_query_hash",
    "spatial_cell_id",
    "spatial_resolution",
    "country_code",
    "admin1",
    "bioregion",
    "centroid_latitude",
    "centroid_longitude",
    "coordinate_uncertainty_m",
    "event_date",
    "basis_of_record",
    "establishment_means",
    "occurrence_status",
    "known_range_role",
    "has_geospatial_issue",
    "preserved_specimen",
    "fossil",
    "range_inference_eligible",
    "taxon_key_match",
    "coordinate_valid",
    "exclusion_reason",
    "retrieved_at",
    "source_snapshot_version",
)

SUMMARY_COLUMNS = (
    "schema_version",
    "registry_version",
    "accepted_taxon_key",
    "scientific_name",
    "geographic_evidence_version",
    "cell_counts_by_resolution",
    "countries",
    "admin_regions",
    "occupied_envelope",
    "disconnected_range_component_count",
    "occurrence_density_summary",
    "data_deficient",
    "data_deficient_reasons",
    "suspicious_outlier_cell_count",
    "range_source_coverage",
    "known_introduced_regions",
    "current_evidence_count",
    "historical_evidence_count",
    "spread_fingerprint",
    "created_at",
)

QA_COLUMNS = ("severity", "code", "subject")
_SCOPED_COLUMNS = (
    "taxalens_schema_version",
    "project_id",
    "run_id",
    "baseline_snapshot_id",
    "grid_name",
    "grid_version",
    "origin_repository",
    "origin_commit",
    "import_manifest_sha256",
)


class BaselineGeographyAdapterError(ValueError):
    """Raised when the baseline-geography handoff cannot be preserved exactly."""


@dataclass(frozen=True, slots=True)
class BaselineGeographyScope:
    project_id: str
    run_id: str
    registry_version: str
    accepted_taxon_key: str
    scientific_name: str
    baseline_snapshot_id: str
    grid_name: str
    grid_version: str
    spatial_resolutions: tuple[int, ...]


@dataclass(frozen=True, slots=True)
class BaselineGeographyArtifact:
    artifact_id: str
    role: str
    imported_path: str
    schema_version: str
    row_count: int | None
    byte_count: int
    sha256: str


@dataclass(frozen=True, slots=True)
class BaselineGeographyHandoff:
    schema_version: str
    scope: BaselineGeographyScope
    origin_repository: str
    origin_commit: str
    import_manifest_sha256: str
    artifacts: tuple[BaselineGeographyArtifact, ...]
    spread: pl.DataFrame
    occurrence_evidence: pl.DataFrame
    summary: pl.DataFrame
    qa_findings: pl.DataFrame
    spread_manifest: dict[str, Any]
    summary_manifest: dict[str, Any]


def _load_object(path: Path, label: str) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise BaselineGeographyAdapterError(f"cannot read {label}: {path}") from error
    if not isinstance(payload, dict):
        raise BaselineGeographyAdapterError(f"{label} must contain a JSON object")
    return payload


def _required_text(value: object, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise BaselineGeographyAdapterError(f"{label} must be non-empty text")
    return value


def _imported_path(value: object) -> Path:
    path = PurePosixPath(_required_text(value, "artifact imported_path"))
    if path.is_absolute() or ".." in path.parts or "." in path.parts:
        raise BaselineGeographyAdapterError("artifact imported_path is unsafe")
    resolved = REPOSITORY_ROOT / path
    expected_root = REPOSITORY_ROOT / "demo/source/biominer_phase14/baseline_geography"
    if expected_root not in resolved.parents:
        raise BaselineGeographyAdapterError("artifact imported_path leaves the handoff root")
    return resolved


def _artifacts(manifest: dict[str, Any]) -> tuple[BaselineGeographyArtifact, ...]:
    rows = manifest.get("artifacts")
    if not isinstance(rows, list):
        raise BaselineGeographyAdapterError("import manifest artifacts must be an array")
    artifacts: list[BaselineGeographyArtifact] = []
    for index, row in enumerate(rows):
        if not isinstance(row, dict):
            raise BaselineGeographyAdapterError(f"artifacts[{index}] must be an object")
        count = row.get("row_count")
        if count is not None and (not isinstance(count, int) or isinstance(count, bool)):
            raise BaselineGeographyAdapterError(f"artifacts[{index}].row_count is invalid")
        byte_count = row.get("byte_count")
        if not isinstance(byte_count, int) or isinstance(byte_count, bool):
            raise BaselineGeographyAdapterError(f"artifacts[{index}].byte_count is invalid")
        artifact = BaselineGeographyArtifact(
            artifact_id=_required_text(row.get("artifact_id"), "artifact_id"),
            role=_required_text(row.get("role"), "artifact role"),
            imported_path=str(
                _imported_path(row.get("imported_path")).relative_to(REPOSITORY_ROOT)
            ),
            schema_version=_required_text(row.get("schema_version"), "artifact schema_version"),
            row_count=count,
            byte_count=byte_count,
            sha256=_required_text(row.get("sha256"), "artifact sha256"),
        )
        artifacts.append(artifact)
    return tuple(artifacts)


def _artifact_path(artifacts: tuple[BaselineGeographyArtifact, ...], artifact_id: str) -> Path:
    matches = [item for item in artifacts if item.artifact_id == artifact_id]
    if len(matches) != 1:
        raise BaselineGeographyAdapterError(f"expected one artifact {artifact_id}")
    return REPOSITORY_ROOT / matches[0].imported_path


def _require_columns(frame: pl.DataFrame, expected: tuple[str, ...], label: str) -> None:
    if tuple(frame.columns) != expected:
        raise BaselineGeographyAdapterError(f"{label} columns differ from the pinned schema")


def _require_unique_value(frame: pl.DataFrame, column: str, expected: object, label: str) -> None:
    values = frame.get_column(column).unique().to_list()
    if values != [expected]:
        raise BaselineGeographyAdapterError(f"{label} {column} differs: {values!r}")


def _scope_frame(
    frame: pl.DataFrame,
    *,
    schema_version: str,
    scope: BaselineGeographyScope,
    origin_repository: str,
    origin_commit: str,
    manifest_sha256: str,
    source_columns: tuple[str, ...],
) -> pl.DataFrame:
    scoped = frame.with_columns(
        pl.lit(schema_version).alias("taxalens_schema_version"),
        pl.lit(scope.project_id).alias("project_id"),
        pl.lit(scope.run_id).alias("run_id"),
        pl.lit(scope.baseline_snapshot_id).alias("baseline_snapshot_id"),
        pl.lit(scope.grid_name).alias("grid_name"),
        pl.lit(scope.grid_version).alias("grid_version"),
        pl.lit(origin_repository).alias("origin_repository"),
        pl.lit(origin_commit).alias("origin_commit"),
        pl.lit(manifest_sha256).alias("import_manifest_sha256"),
    ).select([*_SCOPED_COLUMNS, *source_columns])
    if not scoped.select(source_columns).equals(frame):
        raise AssertionError("baseline adapter changed an upstream evidence value")
    return scoped


def validate_biominer_baseline_geography_frames(
    spread: pl.DataFrame,
    occurrence_evidence: pl.DataFrame,
    summary: pl.DataFrame,
    qa_findings: pl.DataFrame,
    scope: BaselineGeographyScope,
) -> None:
    if (
        not scope.spatial_resolutions
        or tuple(sorted(set(scope.spatial_resolutions))) != scope.spatial_resolutions
        or any(
            isinstance(value, bool) or not isinstance(value, int) or not 0 <= value <= 15
            for value in scope.spatial_resolutions
        )
    ):
        raise BaselineGeographyAdapterError("unsupported spatial resolution")
    _require_columns(spread, SPREAD_COLUMNS, "geographic spread")
    _require_columns(
        occurrence_evidence,
        OCCURRENCE_EVIDENCE_COLUMNS,
        "geographic occurrence evidence",
    )
    _require_columns(summary, SUMMARY_COLUMNS, "geographic summary")
    _require_columns(qa_findings, QA_COLUMNS, "geographic QA")
    for frame, schema_version, label in (
        (spread, "taxon-geographic-spread-v1.0.0", "geographic spread"),
        (
            occurrence_evidence,
            "geographic-occurrence-evidence-v1.0.0",
            "geographic occurrence evidence",
        ),
        (summary, "taxon-geographic-summary-v1.0.0", "geographic summary"),
    ):
        _require_unique_value(frame, "schema_version", schema_version, label)
        _require_unique_value(frame, "registry_version", scope.registry_version, label)
        _require_unique_value(frame, "accepted_taxon_key", scope.accepted_taxon_key, label)
        _require_unique_value(frame, "scientific_name", scope.scientific_name, label)
    for frame, label in (
        (spread, "geographic spread"),
        (occurrence_evidence, "geographic occurrence evidence"),
    ):
        missing_provenance = frame.filter(
            pl.any_horizontal(
                *[
                    pl.col(column).is_null()
                    | (pl.col(column).cast(pl.String).str.strip_chars() == "")
                    for column in (
                        "source",
                        "source_dataset_key",
                        "source_query_hash",
                        "source_snapshot_version",
                    )
                ]
            )
        )
        if missing_provenance.height:
            raise BaselineGeographyAdapterError(f"{label} contains missing provider provenance")
        _require_unique_value(frame, "source", "GBIF", label)
        _require_unique_value(
            frame,
            "source_snapshot_version",
            scope.baseline_snapshot_id,
            label,
        )
        resolutions = sorted(frame.get_column("spatial_resolution").unique().to_list())
        if resolutions != list(scope.spatial_resolutions):
            raise BaselineGeographyAdapterError(f"{label} spatial resolutions differ")
    if summary.height != 1:
        raise BaselineGeographyAdapterError("geographic summary must contain one target row")
    if spread.get_column("earliest_occurrence_date").dtype != pl.Date:
        raise BaselineGeographyAdapterError("earliest occurrence date type differs")
    if spread.get_column("latest_occurrence_date").dtype != pl.Date:
        raise BaselineGeographyAdapterError("latest occurrence date type differs")
    if occurrence_evidence.get_column("event_date").dtype != pl.Date:
        raise BaselineGeographyAdapterError("occurrence event date type differs")
    invalid = spread.filter(
        (pl.col("range_inference_eligible_count") > pl.col("occurrence_count"))
        | (pl.col("preserved_specimen_count") > pl.col("occurrence_count"))
        | (pl.col("fossil_count") > pl.col("occurrence_count"))
        | (pl.col("geospatial_issue_count") > pl.col("occurrence_count"))
        | ~pl.col("evidence_confidence").is_between(0.0, 1.0)
    )
    if invalid.height:
        raise BaselineGeographyAdapterError(
            "geographic spread count or confidence invariant failed"
        )
    if qa_findings.filter(pl.col("severity") == "fatal").height:
        raise BaselineGeographyAdapterError("geographic summary QA contains fatal findings")


def _validate_source_manifests(
    *,
    spread_manifest: dict[str, Any],
    summary_manifest: dict[str, Any],
    artifacts: tuple[BaselineGeographyArtifact, ...],
    scope: BaselineGeographyScope,
) -> None:
    if spread_manifest.get("schema_version") != "geographic-spread-build-v1.0.0":
        raise BaselineGeographyAdapterError("geographic spread manifest schema differs")
    if spread_manifest.get("status") != "complete":
        raise BaselineGeographyAdapterError("geographic spread manifest is incomplete")
    expected_spread_identity = {
        "accepted_taxon_key": scope.accepted_taxon_key,
        "scientific_name": scope.scientific_name,
        "registry_version": scope.registry_version,
        "source_snapshot_version": scope.baseline_snapshot_id,
        "grid_name": scope.grid_name,
        "grid_version": scope.grid_version,
        "resolutions": list(scope.spatial_resolutions),
    }
    for key, expected in expected_spread_identity.items():
        if spread_manifest.get(key) != expected:
            raise BaselineGeographyAdapterError(f"geographic spread manifest {key} differs")
    if summary_manifest.get("schema_version") != "geographic-summary-build-v1.0.0":
        raise BaselineGeographyAdapterError("geographic summary manifest schema differs")
    if summary_manifest.get("status") != "complete":
        raise BaselineGeographyAdapterError("geographic summary manifest is incomplete")
    if summary_manifest.get("qa_status") != "passed" or summary_manifest.get("qa_fatal_count") != 0:
        raise BaselineGeographyAdapterError("geographic summary manifest QA failed")
    for key, expected in {
        "registry_version": scope.registry_version,
        "grid_name": scope.grid_name,
        "grid_version": scope.grid_version,
    }.items():
        if summary_manifest.get(key) != expected:
            raise BaselineGeographyAdapterError(f"geographic summary manifest {key} differs")
    by_id = {item.artifact_id: item for item in artifacts}
    expected_files = (
        (
            spread_manifest,
            "geographic_occurrence_evidence",
            "biominer-geographic-occurrence-evidence-parquet",
        ),
        (
            spread_manifest,
            "taxon_geographic_spread",
            "biominer-taxon-geographic-spread-parquet",
        ),
        (
            summary_manifest,
            "geographic_qa_findings",
            "biominer-geographic-qa-findings-parquet",
        ),
        (
            summary_manifest,
            "taxon_geographic_summary",
            "biominer-taxon-geographic-summary-parquet",
        ),
    )
    for source_manifest, file_key, artifact_id in expected_files:
        files = source_manifest.get("files")
        entry = files.get(file_key) if isinstance(files, dict) else None
        if not isinstance(entry, dict):
            raise BaselineGeographyAdapterError(f"source manifest lacks {file_key}")
        artifact = by_id[artifact_id]
        if (
            entry.get("row_count") != artifact.row_count
            or entry.get("byte_count") != artifact.byte_count
            or entry.get("sha256") != f"sha256:{artifact.sha256}"
        ):
            raise BaselineGeographyAdapterError(f"source manifest metadata differs for {file_key}")


def adapt_biominer_baseline_geography(
    *,
    import_manifest: str | Path = DEFAULT_MANIFEST,
    biominer_root: Path = DEFAULT_BIOMINER_ROOT,
) -> BaselineGeographyHandoff:
    """Return scoped frames while preserving every imported BioMiner evidence column."""

    manifest_path = Path(import_manifest)
    try:
        import_biominer_baseline_geography(
            biominer_root=biominer_root,
            manifest_path=manifest_path,
            check=True,
        )
    except ValueError as error:
        raise BaselineGeographyAdapterError(str(error)) from error
    manifest_bytes = manifest_path.read_bytes()
    manifest = _load_object(manifest_path, "baseline geography import manifest")
    artifacts = _artifacts(manifest)
    scope = BaselineGeographyScope(
        project_id=_required_text(manifest.get("project_id"), "project_id"),
        run_id=_required_text(manifest.get("run_id"), "run_id"),
        registry_version=_required_text(manifest.get("registry_version"), "registry_version"),
        accepted_taxon_key=_required_text(manifest.get("accepted_taxon_key"), "accepted_taxon_key"),
        scientific_name=_required_text(manifest.get("scientific_name"), "scientific_name"),
        baseline_snapshot_id=_required_text(
            manifest.get("baseline_snapshot_id"), "baseline_snapshot_id"
        ),
        grid_name=_required_text(manifest.get("grid_name"), "grid_name"),
        grid_version=_required_text(manifest.get("grid_version"), "grid_version"),
        spatial_resolutions=tuple(manifest.get("spatial_resolutions", ())),
    )
    origin_repository = _required_text(manifest.get("origin_repository"), "origin_repository")
    origin_commit = _required_text(manifest.get("origin_commit"), "origin_commit")
    manifest_sha256 = hashlib.sha256(manifest_bytes).hexdigest()
    spread = pl.read_parquet(_artifact_path(artifacts, "biominer-taxon-geographic-spread-parquet"))
    occurrence_evidence = pl.read_parquet(
        _artifact_path(artifacts, "biominer-geographic-occurrence-evidence-parquet")
    )
    summary = pl.read_parquet(
        _artifact_path(artifacts, "biominer-taxon-geographic-summary-parquet")
    )
    qa_findings = pl.read_parquet(
        _artifact_path(artifacts, "biominer-geographic-qa-findings-parquet")
    )
    validate_biominer_baseline_geography_frames(
        spread,
        occurrence_evidence,
        summary,
        qa_findings,
        scope,
    )
    spread_manifest = _load_object(
        _artifact_path(artifacts, "biominer-geographic-spread-manifest"),
        "geographic spread manifest",
    )
    summary_manifest = _load_object(
        _artifact_path(artifacts, "biominer-geographic-summary-manifest"),
        "geographic summary manifest",
    )
    _validate_source_manifests(
        spread_manifest=spread_manifest,
        summary_manifest=summary_manifest,
        artifacts=artifacts,
        scope=scope,
    )
    shared = {
        "scope": scope,
        "origin_repository": origin_repository,
        "origin_commit": origin_commit,
        "manifest_sha256": manifest_sha256,
    }
    return BaselineGeographyHandoff(
        schema_version=BASELINE_GEOGRAPHY_ADAPTER_SCHEMA_VERSION,
        scope=scope,
        origin_repository=origin_repository,
        origin_commit=origin_commit,
        import_manifest_sha256=manifest_sha256,
        artifacts=artifacts,
        spread=_scope_frame(
            spread,
            schema_version=TAXALENS_BASELINE_SPREAD_SCHEMA_VERSION,
            source_columns=SPREAD_COLUMNS,
            **shared,
        ),
        occurrence_evidence=_scope_frame(
            occurrence_evidence,
            schema_version=TAXALENS_BASELINE_EVIDENCE_SCHEMA_VERSION,
            source_columns=OCCURRENCE_EVIDENCE_COLUMNS,
            **shared,
        ),
        summary=_scope_frame(
            summary,
            schema_version=TAXALENS_BASELINE_SUMMARY_SCHEMA_VERSION,
            source_columns=SUMMARY_COLUMNS,
            **shared,
        ),
        qa_findings=_scope_frame(
            qa_findings,
            schema_version=TAXALENS_BASELINE_QA_SCHEMA_VERSION,
            source_columns=QA_COLUMNS,
            **shared,
        ),
        spread_manifest=spread_manifest,
        summary_manifest=summary_manifest,
    )


__all__ = [
    "BASELINE_GEOGRAPHY_ADAPTER_SCHEMA_VERSION",
    "BaselineGeographyAdapterError",
    "BaselineGeographyArtifact",
    "BaselineGeographyHandoff",
    "BaselineGeographyScope",
    "OCCURRENCE_EVIDENCE_COLUMNS",
    "QA_COLUMNS",
    "SPREAD_COLUMNS",
    "SUMMARY_COLUMNS",
    "adapt_biominer_baseline_geography",
    "validate_biominer_baseline_geography_frames",
]
