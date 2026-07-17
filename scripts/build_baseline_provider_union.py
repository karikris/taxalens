#!/usr/bin/env python3
"""Build or verify the committed baseline occurrence provider-union Parquets."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path
from typing import Any

import polars as pl
from packages.replay.src.baseline_provider_identity import PROVIDER_UNION_POLICY_VERSION
from packages.replay.src.baseline_provider_union import (
    DEFAULT_COUNTRY_MAPPING,
    PROVIDER_RELATIONSHIP_SCHEMA_VERSION,
    REPOSITORY_ROOT,
    build_committed_baseline_provider_union,
)
from taxalens.product.geographic_contracts import (
    BASELINE_OCCURRENCE_UNION_SCHEMA_VERSION,
)

OUTPUT_ROOT = REPOSITORY_ROOT / "demo/source/biominer_phase14/baseline_provider_union"
OUTPUT_UNION = OUTPUT_ROOT / "baseline_occurrence_union.parquet"
OUTPUT_RELATIONSHIPS = OUTPUT_ROOT / "baseline_provider_relationships.parquet"
OUTPUT_MANIFEST = OUTPUT_ROOT / "baseline_provider_union_manifest.json"
BASELINE_IMPORT_MANIFEST = (
    REPOSITORY_ROOT / "demo/source/biominer_phase14/baseline_geography_import_manifest.json"
)
BASELINE_OCCURRENCE_EVIDENCE = (
    REPOSITORY_ROOT
    / "demo/source/biominer_phase14/baseline_geography/geographic_occurrence_evidence.parquet"
)
BASELINE_SPREAD = (
    REPOSITORY_ROOT
    / "demo/source/biominer_phase14/baseline_geography/taxon_geographic_spread.parquet"
)
MANIFEST_SCHEMA_VERSION = "taxalens-baseline-provider-union-manifest:v1.0.0"
BIOMINER_ORIGIN_COMMIT = "247b42f3206d48bb79e2dbf97c5a92e4f207ae71"
NATURAL_EARTH_ORIGIN_COMMIT = "f1890d9f152c896d250a77557a5751a93d494776"


def sha256_bytes(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def canonical_json_bytes(value: object) -> bytes:
    return (
        json.dumps(
            value,
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
            separators=(",", ": "),
        )
        + "\n"
    ).encode("utf-8")


def parquet_bytes(frame: pl.DataFrame) -> bytes:
    buffer = io.BytesIO()
    frame.write_parquet(buffer, compression="zstd", statistics=True)
    return buffer.getvalue()


def _artifact(
    *,
    path: Path,
    content: bytes,
    role: str,
    schema_version: str,
    row_count: int | None,
    origin_repository: str,
    origin_commit: str | None,
) -> dict[str, Any]:
    return {
        "path": str(path.relative_to(REPOSITORY_ROOT)),
        "role": role,
        "schema_version": schema_version,
        "row_count": row_count,
        "byte_count": len(content),
        "sha256": sha256_bytes(content),
        "origin_repository": origin_repository,
        "origin_commit": origin_commit,
    }


def build_manifest(
    union: pl.DataFrame,
    relationships: pl.DataFrame,
    *,
    union_content: bytes,
    relationships_content: bytes,
) -> dict[str, Any]:
    import_manifest_content = BASELINE_IMPORT_MANIFEST.read_bytes()
    import_manifest = json.loads(import_manifest_content)
    occurrence_source = next(
        artifact
        for artifact in import_manifest["artifacts"]
        if artifact["role"] == "baseline_occurrence_evidence"
    )
    occurrence_content = BASELINE_OCCURRENCE_EVIDENCE.read_bytes()
    spread_content = BASELINE_SPREAD.read_bytes()
    country_mapping_content = DEFAULT_COUNTRY_MAPPING.read_bytes()
    canonical_geography = union.filter(pl.col("spatial_resolution") == 3)
    if canonical_geography.height != relationships.height:
        raise ValueError("one canonical geography projection per relationship is required")

    baseline_union = relationships.height
    gbif_only = relationships.filter(pl.col("provider_source") == "gbif").height
    inaturalist_origin = relationships.filter(
        (pl.col("provider_source") == "inaturalist") & (pl.col("delivery_provider") == "gbif")
    ).height
    direct_inaturalist = relationships.filter(pl.col("delivery_provider") == "inaturalist").height
    duplicates_removed = relationships.filter(pl.col("exact_duplicate_removed")).height
    unresolved_groups = (
        relationships.get_column("unresolved_duplicate_group_id").drop_nulls().n_unique()
    )
    unmapped_codes = (
        canonical_geography.filter(
            pl.col("country_code").is_not_null() & pl.col("country").is_null()
        )
        .get_column("country_code")
        .unique()
        .sort()
        .to_list()
    )
    country_code_present = canonical_geography.filter(pl.col("country_code").is_not_null()).height
    country_label_present = canonical_geography.filter(pl.col("country").is_not_null()).height

    source_artifacts = [
        _artifact(
            path=BASELINE_IMPORT_MANIFEST,
            content=import_manifest_content,
            role="baseline_geography_import_manifest",
            schema_version=import_manifest["schema_version"],
            row_count=None,
            origin_repository="karikris/BioMiner",
            origin_commit=BIOMINER_ORIGIN_COMMIT,
        ),
        _artifact(
            path=BASELINE_OCCURRENCE_EVIDENCE,
            content=occurrence_content,
            role="baseline_occurrence_evidence",
            schema_version="geographic-occurrence-evidence-v1.0.0",
            row_count=union.height,
            origin_repository="karikris/BioMiner",
            origin_commit=BIOMINER_ORIGIN_COMMIT,
        ),
        _artifact(
            path=BASELINE_SPREAD,
            content=spread_content,
            role="baseline_geographic_spread",
            schema_version="taxon-geographic-spread-v1.0.0",
            row_count=pl.read_parquet(BASELINE_SPREAD).height,
            origin_repository="karikris/BioMiner",
            origin_commit=BIOMINER_ORIGIN_COMMIT,
        ),
        _artifact(
            path=DEFAULT_COUNTRY_MAPPING,
            content=country_mapping_content,
            role="offline_country_mapping",
            schema_version="taxalens-offline-country-mapping:v1.0.0",
            row_count=None,
            origin_repository="nvkelso/natural-earth-vector",
            origin_commit=NATURAL_EARTH_ORIGIN_COMMIT,
        ),
    ]
    output_artifacts = [
        _artifact(
            path=OUTPUT_UNION,
            content=union_content,
            role="baseline_occurrence_union",
            schema_version=BASELINE_OCCURRENCE_UNION_SCHEMA_VERSION,
            row_count=union.height,
            origin_repository="karikris/taxalens",
            origin_commit=None,
        ),
        _artifact(
            path=OUTPUT_RELATIONSHIPS,
            content=relationships_content,
            role="baseline_provider_relationships",
            schema_version=PROVIDER_RELATIONSHIP_SCHEMA_VERSION,
            row_count=relationships.height,
            origin_repository="karikris/taxalens",
            origin_commit=None,
        ),
    ]
    manifest: dict[str, Any] = {
        "schema_version": MANIFEST_SCHEMA_VERSION,
        "provider_union_policy_version": PROVIDER_UNION_POLICY_VERSION,
        "builder": {
            "path": "scripts/build_baseline_provider_union.py",
            "output_commit_recorded_by_git_history": True,
        },
        "scope": {
            "project_id": relationships.item(0, "project_id"),
            "run_id": relationships.item(0, "run_id"),
            "accepted_taxon_key": relationships.item(0, "accepted_taxon_key"),
            "scientific_name": relationships.item(0, "scientific_name"),
            "registry_version": relationships.item(0, "registry_version"),
            "baseline_snapshot_id": relationships.item(0, "baseline_snapshot_id"),
        },
        "provider_composition": {
            "baseline_union": baseline_union,
            "gbif_only": gbif_only,
            "inaturalist_origin_through_gbif": inaturalist_origin,
            "direct_inaturalist_delta": {
                "status": "unavailable",
                "count": None,
                "snapshot_id": None,
                "reason": "No committed direct iNaturalist occurrence snapshot exists.",
            },
            "duplicates_removed": duplicates_removed,
            "unresolved_provider_duplicate_groups": unresolved_groups,
        },
        "record_counts": {
            "provider_input_observations": baseline_union + duplicates_removed,
            "canonical_observations": baseline_union,
            "provider_relationships": relationships.height,
            "spatial_projection_rows": union.height,
            "spatial_resolutions": sorted(
                union.get_column("spatial_resolution").unique().to_list()
            ),
            "source_datasets": relationships.get_column("source_dataset_key").n_unique(),
            "range_inference_eligible": relationships.filter(
                pl.col("range_inference_eligible")
            ).height,
            "range_inference_excluded": relationships.filter(
                ~pl.col("range_inference_eligible")
            ).height,
        },
        "citation_availability": {
            "available": relationships.filter(
                pl.col("source_dataset_citation_status") == "available"
            ).height,
            "unavailable_in_committed_baseline_snapshot": relationships.filter(
                pl.col("source_dataset_citation_status")
                == "unavailable_in_committed_baseline_snapshot"
            ).height,
        },
        "geography_availability": {
            "country_code_present": country_code_present,
            "country_code_missing": baseline_union - country_code_present,
            "country_label_present": country_label_present,
            "country_label_unavailable": baseline_union - country_label_present,
            "country_codes_without_110m_boundary": unmapped_codes,
            "country_code_policy": (
                "Preserve provider country codes; do not infer labels or coordinates when "
                "the committed low-resolution hierarchy has no matching boundary."
            ),
        },
        "direct_inaturalist_policy": {
            "fetch_performed": False,
            "display_zero_permitted": False,
            "provider_comparison_permitted": False,
        },
        "source_artifacts": source_artifacts,
        "output_artifacts": output_artifacts,
        "reconciliation": {
            "provider_partition_equals_baseline_union": (
                gbif_only + inaturalist_origin == baseline_union
            ),
            "canonical_observations_equal_relationships": (
                union.get_column("canonical_observation_id").n_unique() == relationships.height
            ),
            "projection_rows_equal_source_evidence": (
                union.height == occurrence_source["row_count"]
            ),
            "direct_inaturalist_observed_rows": direct_inaturalist,
        },
        "scientific_semantics": {
            "baseline_absence_proves_biological_absence": False,
            "provider_origin_is_direct_provider_delta": False,
            "spatial_projection_is_independent_observation": False,
            "unknown_duplicate_matches_discarded": False,
        },
    }
    fingerprint_payload = canonical_json_bytes(manifest)
    manifest["build_id"] = f"baseline-provider-union:{sha256_bytes(fingerprint_payload)[:24]}"
    manifest["content_fingerprint"] = f"sha256:{sha256_bytes(fingerprint_payload)}"
    validate_manifest(manifest)
    return manifest


def validate_manifest(manifest: dict[str, Any]) -> None:
    composition = manifest["provider_composition"]
    direct_delta = composition["direct_inaturalist_delta"]
    reconciliation = manifest["reconciliation"]
    if (
        composition["gbif_only"] + composition["inaturalist_origin_through_gbif"]
        != composition["baseline_union"]
    ):
        raise ValueError("provider composition does not reconcile")
    if direct_delta != {
        "status": "unavailable",
        "count": None,
        "snapshot_id": None,
        "reason": "No committed direct iNaturalist occurrence snapshot exists.",
    }:
        raise ValueError("direct iNaturalist availability semantics differ")
    if not all(
        reconciliation[key]
        for key in (
            "provider_partition_equals_baseline_union",
            "canonical_observations_equal_relationships",
            "projection_rows_equal_source_evidence",
        )
    ):
        raise ValueError("provider union reconciliation failed")
    if reconciliation["direct_inaturalist_observed_rows"] != 0:
        raise ValueError("direct iNaturalist rows exist without a committed snapshot")


def build_outputs() -> dict[Path, bytes]:
    union, relationships = build_committed_baseline_provider_union()
    union_content = parquet_bytes(union)
    relationships_content = parquet_bytes(relationships)
    manifest = build_manifest(
        union,
        relationships,
        union_content=union_content,
        relationships_content=relationships_content,
    )
    return {
        OUTPUT_UNION: union_content,
        OUTPUT_RELATIONSHIPS: relationships_content,
        OUTPUT_MANIFEST: canonical_json_bytes(manifest),
    }


def write_outputs(outputs: dict[Path, bytes]) -> None:
    for path, content in outputs.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)


def check_outputs(outputs: dict[Path, bytes]) -> list[str]:
    failures = []
    for path, expected in outputs.items():
        if not path.is_file():
            failures.append(f"baseline provider-union output is missing: {path}")
        elif path.read_bytes() != expected:
            failures.append(f"baseline provider-union output is stale: {path}")
    return failures


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    outputs = build_outputs()
    if args.check:
        failures = check_outputs(outputs)
        if failures:
            raise SystemExit("\n".join(failures))
        union = pl.read_parquet(OUTPUT_UNION)
        relationships = pl.read_parquet(OUTPUT_RELATIONSHIPS)
        print(
            "verified baseline provider union: "
            f"observations={relationships.height}, projections={union.height}"
        )
        return 0
    write_outputs(outputs)
    print(f"wrote baseline provider union: {OUTPUT_ROOT.relative_to(REPOSITORY_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
