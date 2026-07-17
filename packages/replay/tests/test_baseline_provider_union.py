from __future__ import annotations

import hashlib
import json
from pathlib import Path

import polars as pl
import pytest
from packages.replay.src.baseline_provider_union import (
    BaselineProviderUnionError,
    baseline_occurrence_union_schema,
    build_baseline_provider_union,
    build_committed_baseline_provider_union,
)
from packages.replay.src.baseline_provider_identity import INATURALIST_GBIF_DATASET_KEY
from packages.replay.src.biominer_baseline_geography_adapter import (
    adapt_biominer_baseline_geography,
)
from scripts.build_baseline_provider_union import (
    OUTPUT_MANIFEST,
    OUTPUT_RELATIONSHIPS,
    OUTPUT_UNION,
    build_outputs,
)


@pytest.fixture(scope="module")
def committed_union() -> tuple[pl.DataFrame, pl.DataFrame]:
    return build_committed_baseline_provider_union()


@pytest.fixture(scope="module")
def generated_outputs() -> dict[Path, bytes]:
    return build_outputs()


def test_committed_union_counts_observations_not_spatial_projections(
    committed_union: tuple[pl.DataFrame, pl.DataFrame],
) -> None:
    union, relationships = committed_union

    assert union.schema == baseline_occurrence_union_schema()
    assert union.height == 57_603
    assert relationships.height == 19_201
    assert union.get_column("canonical_observation_id").n_unique() == 19_201
    assert union.get_column("provider_relationship_id").n_unique() == 19_201
    assert sorted(union.get_column("spatial_resolution").unique().to_list()) == [3, 5, 7]


def test_provider_composition_reconciles_without_direct_snapshot(
    committed_union: tuple[pl.DataFrame, pl.DataFrame],
) -> None:
    _, relationships = committed_union

    assert relationships.filter(pl.col("provider_source") == "gbif").height == 4_017
    assert (
        relationships.filter(
            (pl.col("provider_source") == "inaturalist") & (pl.col("delivery_provider") == "gbif")
        ).height
        == 15_184
    )
    assert relationships.filter(pl.col("delivery_provider") == "inaturalist").is_empty()
    assert relationships.filter(pl.col("exact_duplicate_removed")).is_empty()
    assert relationships.get_column("unresolved_duplicate_group_id").drop_nulls().is_empty()


def test_provider_composition_is_a_disjoint_canonical_partition(
    committed_union: tuple[pl.DataFrame, pl.DataFrame],
) -> None:
    union, relationships = committed_union
    gbif_only = relationships.filter(pl.col("provider_source") == "gbif")
    inaturalist_via_gbif = relationships.filter(pl.col("provider_source") == "inaturalist")

    assert gbif_only.select(
        "delivery_provider", "provider_relationship_kind", "match_method"
    ).unique().rows() == [("gbif", "canonical_source", "provider_identity")]
    assert inaturalist_via_gbif.select(
        "delivery_provider", "provider_relationship_kind", "match_method"
    ).unique().rows() == [("gbif", "inaturalist_via_gbif", "inaturalist_via_gbif")]
    assert (
        inaturalist_via_gbif.get_column("source_dataset_key").unique().to_list()
        == [INATURALIST_GBIF_DATASET_KEY]
    )
    assert gbif_only.filter(
        pl.col("source_dataset_key") == INATURALIST_GBIF_DATASET_KEY
    ).is_empty()

    gbif_ids = set(gbif_only.get_column("canonical_observation_id"))
    inaturalist_ids = set(inaturalist_via_gbif.get_column("canonical_observation_id"))
    assert gbif_ids.isdisjoint(inaturalist_ids)
    assert len(gbif_ids | inaturalist_ids) == relationships.height
    assert union.get_column("canonical_observation_id").is_in(gbif_ids | inaturalist_ids).all()


def test_every_provider_audit_field_is_projection_invariant(
    committed_union: tuple[pl.DataFrame, pl.DataFrame],
) -> None:
    union, relationships = committed_union
    audit_fields = [
        "provider_relationship_id",
        "provider_source",
        "delivery_provider",
        "provider_observation_id",
        "gbif_occurrence_key",
        "inaturalist_observation_id",
        "source_dataset_key",
        "source_record_sha256",
        "provider_relationship_kind",
        "match_method",
        "duplicate_group_id",
        "unresolved_duplicate_group_id",
        "exact_duplicate_removed",
        "canonical_flag",
    ]
    varying = (
        union.group_by("canonical_observation_id")
        .agg(
            *[pl.col(field).n_unique().alias(field) for field in audit_fields],
            pl.len().alias("projection_count"),
        )
        .filter(
            pl.any_horizontal(
                *[pl.col(field) != 1 for field in audit_fields],
                pl.col("projection_count") != 3,
            )
        )
    )

    assert varying.is_empty()
    assert union.get_column("provider_relationship_id").n_unique() == relationships.height


def test_provider_relationship_is_invariant_across_cell_projections(
    committed_union: tuple[pl.DataFrame, pl.DataFrame],
) -> None:
    union, _ = committed_union
    varying = (
        union.group_by("canonical_observation_id")
        .agg(
            pl.col("provider_relationship_id").n_unique().alias("relationship_count"),
            pl.col("source_record_sha256").n_unique().alias("source_fingerprint_count"),
            pl.len().alias("projection_count"),
        )
        .filter(
            (pl.col("relationship_count") != 1)
            | (pl.col("source_fingerprint_count") != 1)
            | (pl.col("projection_count") != 3)
        )
    )
    assert varying.is_empty()


def test_missing_citations_and_small_boundary_gaps_remain_explicit(
    committed_union: tuple[pl.DataFrame, pl.DataFrame],
) -> None:
    union, relationships = committed_union

    assert (
        relationships.filter(
            pl.col("source_dataset_citation_status") == "unavailable_in_committed_baseline_snapshot"
        ).height
        == 19_201
    )
    assert union.get_column("source_dataset_citation").null_count() == 0
    assert (
        union.filter(pl.col("country_code").is_not_null() & pl.col("country").is_null())
        .get_column("country_code")
        .n_unique()
        == 15
    )


def test_composition_manifest_marks_direct_inaturalist_delta_unavailable(
    generated_outputs: dict[Path, bytes],
) -> None:
    manifest = json.loads(generated_outputs[OUTPUT_MANIFEST])
    composition = manifest["provider_composition"]

    assert composition["baseline_union"] == 19_201
    assert composition["gbif_only"] + composition["inaturalist_origin_through_gbif"] == 19_201
    assert composition["direct_inaturalist_delta"] == {
        "status": "unavailable",
        "count": None,
        "snapshot_id": None,
        "reason": "No committed direct iNaturalist occurrence snapshot exists.",
    }
    assert manifest["record_counts"]["spatial_projection_rows"] == 57_603
    assert manifest["record_counts"]["range_inference_eligible"] == 630


def test_generated_artifacts_are_byte_deterministic_and_fingerprinted(
    generated_outputs: dict[Path, bytes],
) -> None:
    manifest = json.loads(generated_outputs[OUTPUT_MANIFEST])
    artifacts = {artifact["path"]: artifact for artifact in manifest["output_artifacts"]}

    for path in (OUTPUT_UNION, OUTPUT_RELATIONSHIPS, OUTPUT_MANIFEST):
        assert path.read_bytes() == generated_outputs[path]
    for path in (OUTPUT_UNION, OUTPUT_RELATIONSHIPS):
        artifact = artifacts[str(path.relative_to(Path.cwd()))]
        assert artifact["byte_count"] == len(generated_outputs[path])
        assert artifact["sha256"] == hashlib.sha256(generated_outputs[path]).hexdigest()


def test_unknown_country_mapping_schema_fails_closed() -> None:
    handoff = adapt_biominer_baseline_geography()

    with pytest.raises(BaselineProviderUnionError, match="country mapping schema"):
        build_baseline_provider_union(
            handoff,
            country_mapping={"schema_version": "changed", "countries": []},
        )
