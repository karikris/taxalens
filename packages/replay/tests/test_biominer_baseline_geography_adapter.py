from __future__ import annotations

import json
from collections.abc import Callable
from pathlib import Path

import polars as pl
import pytest
from packages.replay.src.biominer_baseline_geography_adapter import (
    BASELINE_GEOGRAPHY_ADAPTER_SCHEMA_VERSION,
    OCCURRENCE_EVIDENCE_COLUMNS,
    QA_COLUMNS,
    SPREAD_COLUMNS,
    SUMMARY_COLUMNS,
    BaselineGeographyAdapterError,
    BaselineGeographyHandoff,
    adapt_biominer_baseline_geography,
    validate_biominer_baseline_geography_frames,
)
from scripts.import_biominer_baseline_geography import DEFAULT_MANIFEST

BASELINE_ROOT = DEFAULT_MANIFEST.parent / "baseline_geography"
BIOMINER_SHA = "247b42f3206d48bb79e2dbf97c5a92e4f207ae71"


def _changed_manifest(tmp_path: Path, change: Callable[[dict[str, object]], None]) -> Path:
    payload = json.loads(DEFAULT_MANIFEST.read_text(encoding="utf-8"))
    change(payload)
    destination = tmp_path / "baseline_geography_import_manifest.json"
    destination.write_text(json.dumps(payload), encoding="utf-8")
    return destination


def _source_frames(
    handoff: BaselineGeographyHandoff,
) -> tuple[pl.DataFrame, pl.DataFrame, pl.DataFrame, pl.DataFrame]:
    return (
        handoff.spread.select(SPREAD_COLUMNS),
        handoff.occurrence_evidence.select(OCCURRENCE_EVIDENCE_COLUMNS),
        handoff.summary.select(SUMMARY_COLUMNS),
        handoff.qa_findings.select(QA_COLUMNS),
    )


def test_adapts_real_checksum_verified_baseline_geography() -> None:
    handoff = adapt_biominer_baseline_geography()

    assert handoff.schema_version == BASELINE_GEOGRAPHY_ADAPTER_SCHEMA_VERSION
    assert handoff.origin_commit == BIOMINER_SHA
    assert handoff.scope.project_id == "taxalens-papilio-demoleus-judge-replay"
    assert handoff.scope.run_id == "papilio-demoleus-pilot-20260715"
    assert handoff.scope.accepted_taxon_key == "gbif:1938069"
    assert handoff.scope.registry_version == "butterflies-v2-20260712"
    assert handoff.scope.baseline_snapshot_id == "gbif-occurrence-search-20260715"
    assert handoff.scope.spatial_resolutions == (3, 5, 7)
    assert handoff.spread.height == 16_678
    assert handoff.occurrence_evidence.height == 57_603
    assert handoff.summary.height == 1
    assert handoff.qa_findings.height == 1
    assert handoff.summary_manifest["qa_status"] == "passed"
    assert handoff.summary_manifest["qa_fatal_count"] == 0


def test_adapter_preserves_every_upstream_evidence_column() -> None:
    handoff = adapt_biominer_baseline_geography()
    spread, evidence, summary, qa = _source_frames(handoff)

    assert spread.equals(pl.read_parquet(BASELINE_ROOT / "taxon_geographic_spread.parquet"))
    assert evidence.equals(
        pl.read_parquet(BASELINE_ROOT / "geographic_occurrence_evidence.parquet")
    )
    assert summary.equals(pl.read_parquet(BASELINE_ROOT / "taxon_geographic_summary.parquet"))
    assert qa.equals(pl.read_parquet(BASELINE_ROOT / "geographic_qa_findings.parquet"))
    assert spread.select(
        "source_dataset_key",
        "source_dataset_citation",
        "range_inference_eligible_count",
        "preserved_specimen_count",
        "fossil_count",
        "geospatial_issue_count",
        "coordinate_uncertainty_summary",
        "earliest_occurrence_date",
        "latest_occurrence_date",
        "known_range_role",
        "evidence_confidence",
    ).equals(
        pl.read_parquet(BASELINE_ROOT / "taxon_geographic_spread.parquet").select(
            "source_dataset_key",
            "source_dataset_citation",
            "range_inference_eligible_count",
            "preserved_specimen_count",
            "fossil_count",
            "geospatial_issue_count",
            "coordinate_uncertainty_summary",
            "earliest_occurrence_date",
            "latest_occurrence_date",
            "known_range_role",
            "evidence_confidence",
        )
    )


def test_rejects_wrong_target_taxon(tmp_path: Path) -> None:
    manifest = _changed_manifest(
        tmp_path,
        lambda payload: payload.__setitem__("accepted_taxon_key", "gbif:999999"),
    )

    with pytest.raises(BaselineGeographyAdapterError, match="accepted_taxon_key differs"):
        adapt_biominer_baseline_geography(import_manifest=manifest)


def test_rejects_wrong_registry_version(tmp_path: Path) -> None:
    manifest = _changed_manifest(
        tmp_path,
        lambda payload: payload.__setitem__("registry_version", "butterflies-wrong"),
    )

    with pytest.raises(BaselineGeographyAdapterError, match="registry_version differs"):
        adapt_biominer_baseline_geography(import_manifest=manifest)


def test_rejects_missing_baseline_snapshot(tmp_path: Path) -> None:
    manifest = _changed_manifest(
        tmp_path,
        lambda payload: payload.__setitem__("baseline_snapshot_id", None),
    )

    with pytest.raises(BaselineGeographyAdapterError, match="baseline_snapshot_id"):
        adapt_biominer_baseline_geography(import_manifest=manifest)


def test_rejects_changed_artifact_checksum(tmp_path: Path) -> None:
    def change(payload: dict[str, object]) -> None:
        artifacts = payload["artifacts"]
        assert isinstance(artifacts, list)
        artifact = artifacts[0]
        assert isinstance(artifact, dict)
        artifact["sha256"] = "0" * 64

    manifest = _changed_manifest(tmp_path, change)

    with pytest.raises(BaselineGeographyAdapterError, match="checksum differs"):
        adapt_biominer_baseline_geography(import_manifest=manifest)


def test_rejects_unknown_spatial_resolution(tmp_path: Path) -> None:
    manifest = _changed_manifest(
        tmp_path,
        lambda payload: payload.__setitem__("spatial_resolutions", [3, 5, 16]),
    )

    with pytest.raises(BaselineGeographyAdapterError, match="unsupported spatial resolution"):
        adapt_biominer_baseline_geography(import_manifest=manifest)


@pytest.mark.parametrize(
    "column",
    ("source", "source_dataset_key", "source_query_hash", "source_snapshot_version"),
)
def test_rejects_missing_provider_provenance(column: str) -> None:
    handoff = adapt_biominer_baseline_geography()
    spread, evidence, summary, qa = _source_frames(handoff)
    spread = spread.with_columns(pl.lit("").alias(column))

    with pytest.raises(BaselineGeographyAdapterError, match="missing provider provenance"):
        validate_biominer_baseline_geography_frames(
            spread,
            evidence,
            summary,
            qa,
            handoff.scope,
        )


def test_rejects_manifest_without_provider_origin(tmp_path: Path) -> None:
    manifest = _changed_manifest(
        tmp_path,
        lambda payload: payload.__setitem__("origin_repository", None),
    )

    with pytest.raises(BaselineGeographyAdapterError, match="requires the BioMiner origin"):
        adapt_biominer_baseline_geography(import_manifest=manifest)
