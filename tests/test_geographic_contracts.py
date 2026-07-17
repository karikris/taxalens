from __future__ import annotations

from dataclasses import FrozenInstanceError, fields

import pytest
from taxalens.product import (
    BASELINE_OCCURRENCE_UNION_PARQUET_COLUMNS,
    BASELINE_OCCURRENCE_UNION_SCHEMA_VERSION,
    BASELINE_PROVIDER_UNION_POLICY_VERSION,
    COUNTRY_HIERARCHY_SCHEMA_VERSION,
    GEOGRAPHIC_IMPACT_CELL_PARQUET_COLUMNS,
    GEOGRAPHIC_IMPACT_CELL_SCHEMA_VERSION,
    GEOGRAPHIC_IMPACT_MANIFEST_SCHEMA_VERSION,
    GEOGRAPHIC_IMPACT_SUMMARY_PARQUET_COLUMNS,
    GEOGRAPHIC_IMPACT_SUMMARY_SCHEMA_VERSION,
    BaselineOccurrenceUnionRow,
    CountryHierarchyDocument,
    GeographicImpactCellRow,
    GeographicImpactManifestDocument,
    GeographicImpactSummaryRow,
    GeographicSchemaError,
    assert_geographic_contract,
    geographic_schema_documents,
    validate_geographic_contract,
)


def test_baseline_union_contract_accepts_canonical_and_relationship_rows() -> None:
    canonical = _baseline_row()
    duplicate = {
        **canonical,
        "provider_relationship_id": _relationship_id("b"),
        "provider_observation_id": "gbif-row-repeat",
        "provider_relationship_kind": "same_provider_repeat",
        "match_method": "provider_identity",
        "duplicate_group_id": "duplicate:gbif:100",
        "exact_duplicate_removed": True,
        "canonical_flag": False,
    }
    unresolved = {
        **canonical,
        "canonical_observation_id": _observation_id("c"),
        "provider_relationship_id": _relationship_id("c"),
        "provider_relationship_kind": "unresolved_duplicate_candidate",
        "match_method": "unresolved_candidate",
        "duplicate_group_id": "duplicate-candidate:100",
        "unresolved_duplicate_group_id": "unresolved-provider-group:100",
    }

    for row in (canonical, duplicate, unresolved):
        validation = validate_geographic_contract("baseline_occurrence_union", row)
        assert validation.valid, validation
        assert validation.failures == ()


def test_baseline_union_contract_freezes_a_validated_python_row() -> None:
    row = BaselineOccurrenceUnionRow.from_mapping(_baseline_row())

    assert row.schema_version == BASELINE_OCCURRENCE_UNION_SCHEMA_VERSION
    assert row.provider_union_policy_version == BASELINE_PROVIDER_UNION_POLICY_VERSION
    assert row.canonical_flag is True
    assert row.to_dict() == _baseline_row()
    with pytest.raises(FrozenInstanceError):
        row.canonical_flag = False  # type: ignore[misc]


@pytest.mark.parametrize(
    "updates",
    [
        {"gbif_occurrence_key": None},
        {"centroid_latitude": None},
        {"has_geospatial_issue": True},
        {
            "exact_duplicate_removed": True,
            "canonical_flag": True,
            "duplicate_group_id": "duplicate:100",
        },
        {
            "match_method": "unresolved_candidate",
            "provider_relationship_kind": "canonical_source",
            "unresolved_duplicate_group_id": None,
        },
    ],
)
def test_baseline_union_contract_fails_closed_on_identity_and_geography(
    updates: dict[str, object],
) -> None:
    invalid = {**_baseline_row(), **updates}

    validation = validate_geographic_contract("baseline_occurrence_union", invalid)

    assert validation.valid is False
    assert validation.failures
    with pytest.raises(GeographicSchemaError) as captured:
        assert_geographic_contract("baseline_occurrence_union", invalid)
    assert captured.value.validation == validation


def test_baseline_union_contract_requires_every_ordered_parquet_column() -> None:
    documents = geographic_schema_documents()
    schema = documents["baseline_occurrence_union.schema.json"]
    assert isinstance(schema, dict)
    schema_fields = schema["properties"]
    required_fields = schema["required"]
    python_fields = [field.name for field in fields(BaselineOccurrenceUnionRow)]
    parquet_fields = [column.name for column in BASELINE_OCCURRENCE_UNION_PARQUET_COLUMNS]

    assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    assert schema_fields["schema_version"]["const"] == BASELINE_OCCURRENCE_UNION_SCHEMA_VERSION
    assert required_fields == parquet_fields == python_fields
    assert len(parquet_fields) == len(set(parquet_fields))


def test_impact_cell_contract_accepts_available_and_unavailable_baselines() -> None:
    available = _impact_cell_row()
    unavailable = {
        **available,
        "baseline_evidence_status": "unavailable",
        "provider_input_row_count": None,
        "baseline_union_count": None,
        "baseline_range_inference_eligible_count": None,
        "baseline_excluded_occurrence_count": None,
        "gbif_only_count": None,
        "inaturalist_origin_through_gbif_count": None,
        "direct_inaturalist_delta_status": "unavailable",
        "direct_inaturalist_delta_count": None,
        "duplicates_removed_count": None,
        "unresolved_provider_duplicate_group_count": None,
        "flickr_candidate_count": 1,
        "flickr_visually_eligible_count": 1,
        "reviewed_positive_count": 0,
        "pending_count": 1,
        "verification_campaign_id": None,
        "baseline_only_cell": False,
        "matched_cell": False,
        "candidate_only_cell": False,
        "reviewed_additional_cell": False,
        "release_ready_additional_cell": False,
        "nearest_baseline_distance_status": "unavailable",
        "latest_baseline_event_date": None,
        "latest_reviewed_positive_date": None,
        "data_deficient_state": "unavailable",
        "data_deficient_reasons": ["baseline_snapshot_unavailable"],
    }

    for row in (available, unavailable):
        validation = validate_geographic_contract("geographic_impact_cell", row)
        assert validation.valid, validation
        assert validation.failures == ()


def test_impact_cell_contract_freezes_a_validated_python_row() -> None:
    value = _impact_cell_row()
    row = GeographicImpactCellRow.from_mapping(value)

    assert row.schema_version == GEOGRAPHIC_IMPACT_CELL_SCHEMA_VERSION
    assert row.data_deficient_reasons == ()
    assert row.to_dict() == value
    with pytest.raises(FrozenInstanceError):
        row.matched_cell = False  # type: ignore[misc]


def test_impact_cell_contract_accepts_human_supported_release_ready_cell() -> None:
    candidate_only = {
        **_impact_cell_row(),
        "provider_input_row_count": 0,
        "baseline_union_count": 0,
        "baseline_range_inference_eligible_count": 0,
        "baseline_excluded_occurrence_count": 0,
        "gbif_only_count": 0,
        "inaturalist_origin_through_gbif_count": 0,
        "duplicates_removed_count": 0,
        "flickr_candidate_count": 3,
        "flickr_visually_eligible_count": 3,
        "reviewed_positive_count": 1,
        "pending_count": 2,
        "release_ready_count": 1,
        "release_decision_id": "release-decision:2026-07-17",
        "matched_cell": False,
        "candidate_only_cell": True,
        "reviewed_additional_cell": True,
        "release_ready_additional_cell": True,
        "nearest_baseline_distance_status": "available",
        "nearest_baseline_distance_km": 121.5,
        "nearest_baseline_cell_id": "baseline-cell:nearest",
        "nearest_baseline_distance_method": "haversine_cell_centroid",
        "latest_baseline_event_date": None,
        "latest_flickr_candidate_date": "2026-06-20",
        "latest_reviewed_positive_date": "2026-06-20",
        "latest_release_ready_date": "2026-06-20",
        "data_deficient_state": "data_deficient",
        "data_deficient_reasons": ["no_range_inference_eligible_baseline_rows"],
    }

    assert_geographic_contract("geographic_impact_cell", candidate_only)


@pytest.mark.parametrize(
    ("updates", "expected_keyword"),
    [
        ({"provider_input_row_count": 8}, "count_reconciliation"),
        ({"baseline_range_inference_eligible_count": 5}, "count_reconciliation"),
        ({"gbif_only_count": 4}, "provider_count_reconciliation"),
        ({"pending_count": 2}, "count_reconciliation"),
        ({"flickr_visually_eligible_count": 3}, "count_reconciliation"),
        (
            {"release_ready_count": 2, "release_decision_id": "release:invalid"},
            "release_state_invariant",
        ),
        ({"candidate_only_cell": True}, "cell_state_invariant"),
        ({"verification_campaign_id": None}, "identity_required"),
        ({"direct_inaturalist_delta_count": 1}, "type"),
    ],
)
def test_impact_cell_contract_fails_closed_on_inconsistent_states(
    updates: dict[str, object],
    expected_keyword: str,
) -> None:
    invalid = {**_impact_cell_row(), **updates}

    validation = validate_geographic_contract("geographic_impact_cell", invalid)

    assert validation.valid is False
    assert expected_keyword in {failure.keyword for failure in validation.failures}


def test_impact_cell_contract_requires_every_ordered_parquet_column() -> None:
    documents = geographic_schema_documents()
    schema = documents["geographic_impact_cell.schema.json"]
    assert isinstance(schema, dict)
    schema_fields = schema["properties"]
    required_fields = schema["required"]
    python_fields = [field.name for field in fields(GeographicImpactCellRow)]
    parquet_fields = [column.name for column in GEOGRAPHIC_IMPACT_CELL_PARQUET_COLUMNS]

    assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    assert schema_fields["schema_version"]["const"] == GEOGRAPHIC_IMPACT_CELL_SCHEMA_VERSION
    assert required_fields == parquet_fields == python_fields
    assert len(parquet_fields) == len(set(parquet_fields))


def test_impact_summary_contract_reconciles_scope_rollup() -> None:
    value = _impact_summary_row()

    validation = validate_geographic_contract("geographic_impact_summary", value)
    row = GeographicImpactSummaryRow.from_mapping(value)

    assert validation.valid, validation
    assert row.scope_level == "global"
    assert row.to_dict() == value


@pytest.mark.parametrize(
    ("updates", "expected_keyword"),
    [
        ({"pending_count": 2}, "count_reconciliation"),
        ({"provider_input_row_count": 8}, "count_reconciliation"),
        ({"flickr_occupied_cell_count": 3}, "cell_count_reconciliation"),
        ({"reviewed_additional_cell_count": 2}, "cell_count_reconciliation"),
    ],
)
def test_impact_summary_contract_rejects_non_reconciling_rollups(
    updates: dict[str, object],
    expected_keyword: str,
) -> None:
    validation = validate_geographic_contract(
        "geographic_impact_summary",
        {**_impact_summary_row(), **updates},
    )

    assert validation.valid is False
    assert expected_keyword in {failure.keyword for failure in validation.failures}


def test_impact_summary_contract_requires_ordered_parquet_columns() -> None:
    schema = geographic_schema_documents()["geographic_impact_summary.schema.json"]
    assert isinstance(schema, dict)
    python_fields = [field.name for field in fields(GeographicImpactSummaryRow)]
    parquet_fields = [column.name for column in GEOGRAPHIC_IMPACT_SUMMARY_PARQUET_COLUMNS]

    assert schema["properties"]["schema_version"]["const"] == (
        GEOGRAPHIC_IMPACT_SUMMARY_SCHEMA_VERSION
    )
    assert schema["required"] == parquet_fields == python_fields


def test_country_hierarchy_contract_requires_connected_flat_nodes() -> None:
    value = _country_hierarchy()

    document = CountryHierarchyDocument.from_mapping(value)

    assert document.schema_version == COUNTRY_HIERARCHY_SCHEMA_VERSION
    assert [node.scope_level for node in document.nodes] == [
        "global",
        "continent",
        "country",
    ]
    assert document.to_dict() == value


def test_country_hierarchy_contract_rejects_missing_parent() -> None:
    value = _country_hierarchy()
    nodes = [dict(node) for node in value["nodes"]]  # type: ignore[union-attr]
    nodes[2]["parent_scope_id"] = "continent:missing"

    validation = validate_geographic_contract(
        "country_hierarchy",
        {**value, "nodes": nodes},
    )

    assert validation.valid is False
    assert "parent_required" in {failure.keyword for failure in validation.failures}


def test_geographic_impact_manifest_binds_inventory_and_counts() -> None:
    value = _impact_manifest()

    document = GeographicImpactManifestDocument.from_mapping(value)

    assert document.schema_version == GEOGRAPHIC_IMPACT_MANIFEST_SCHEMA_VERSION
    assert len(document.artifacts) == 9
    assert document.to_dict() == value


def test_geographic_impact_manifest_rejects_review_without_evidence() -> None:
    value = _impact_manifest()
    artifacts = [dict(item) for item in value["artifacts"]]  # type: ignore[union-attr]
    index = next(
        index
        for index, item in enumerate(artifacts)
        if item["logical_name"] == "verification_consensus"
    )
    artifacts[index] = _unavailable_artifact("verification_consensus")

    validation = validate_geographic_contract(
        "geographic_impact_manifest",
        {**value, "artifacts": artifacts},
    )

    assert validation.valid is False
    assert "review_evidence_required" in {failure.keyword for failure in validation.failures}


def _baseline_row() -> dict[str, object]:
    return {
        "schema_version": BASELINE_OCCURRENCE_UNION_SCHEMA_VERSION,
        "baseline_snapshot_id": "baseline:gbif-2026-07-15",
        "project_id": "project:papilio-demoleus",
        "run_id": "run:geographic-impact",
        "registry_version": "butterflies-v2-20260712",
        "accepted_taxon_key": "gbif:1938069",
        "scientific_name": "Papilio demoleus",
        "canonical_observation_id": _observation_id("a"),
        "provider_relationship_id": _relationship_id("a"),
        "provider_union_policy_version": BASELINE_PROVIDER_UNION_POLICY_VERSION,
        "provider_source": "gbif",
        "delivery_provider": "gbif",
        "provider_observation_id": "gbif:100",
        "gbif_occurrence_key": "100",
        "inaturalist_observation_id": None,
        "source_dataset_key": "dataset:gbif-example",
        "source_dataset_citation": "Example GBIF occurrence dataset",
        "source_record_sha256": "d" * 64,
        "spatial_cell_id": "8360a9fffffffff",
        "spatial_resolution": 3,
        "grid_name": "hierarchical_global_grid",
        "grid_version": "h3:4.5.0",
        "country_code": "IN",
        "country": "India",
        "continent": "Asia",
        "admin1": "Karnataka",
        "centroid_latitude": 12.9716,
        "centroid_longitude": 77.5946,
        "event_date": "2026-06-10",
        "coordinate_uncertainty_m": 25.0,
        "basis_of_record": "HUMAN_OBSERVATION",
        "occurrence_status": "PRESENT",
        "known_range_role": "native",
        "range_inference_eligible": True,
        "evidence_confidence": 0.8,
        "coordinate_valid": True,
        "has_geospatial_issue": False,
        "preserved_specimen": False,
        "fossil": False,
        "exclusion_reason": None,
        "provider_relationship_kind": "canonical_source",
        "match_method": "singleton",
        "duplicate_group_id": None,
        "unresolved_duplicate_group_id": None,
        "exact_duplicate_removed": False,
        "canonical_flag": True,
    }


def _impact_cell_row() -> dict[str, object]:
    return {
        "schema_version": GEOGRAPHIC_IMPACT_CELL_SCHEMA_VERSION,
        "geographic_impact_build_id": "geographic-impact:2026-07-17",
        "project_id": "project:papilio-demoleus",
        "run_id": "run:geographic-impact",
        "registry_version": "butterflies-v2-20260712",
        "accepted_taxon_key": "gbif:1938069",
        "scientific_name": "Papilio demoleus",
        "baseline_snapshot_id": "baseline:gbif-2026-07-15",
        "flickr_snapshot_id": "flickr:2026-07-15",
        "provider_union_policy_version": BASELINE_PROVIDER_UNION_POLICY_VERSION,
        "verification_projection_version": "verification-projection:v2",
        "release_policy_version": "occurrence-release-policy:v1",
        "verification_campaign_id": "campaign:flickr-audit",
        "quality_snapshot_id": "quality:flickr-audit:2026-07-17",
        "release_decision_id": None,
        "grid_name": "hierarchical_global_grid",
        "grid_version": "h3:4.5.0",
        "spatial_resolution": 3,
        "spatial_cell_id": "8360a9fffffffff",
        "parent_spatial_cell_id": "8260affffffffff",
        "country_hierarchy_id": "country-hierarchy:natural-earth-v1",
        "continent": "Asia",
        "country_code": "IN",
        "country": "India",
        "admin1": "Karnataka",
        "centroid_latitude": 12.9716,
        "centroid_longitude": 77.5946,
        "baseline_evidence_status": "available",
        "provider_input_row_count": 7,
        "baseline_union_count": 5,
        "baseline_range_inference_eligible_count": 4,
        "baseline_excluded_occurrence_count": 1,
        "gbif_only_count": 3,
        "inaturalist_origin_through_gbif_count": 2,
        "direct_inaturalist_delta_status": "unavailable",
        "direct_inaturalist_delta_count": None,
        "duplicates_removed_count": 2,
        "unresolved_provider_duplicate_group_count": 1,
        "flickr_candidate_count": 2,
        "flickr_visually_eligible_count": 2,
        "reviewed_positive_count": 1,
        "reviewed_negative_count": 0,
        "uncertain_count": 0,
        "pending_count": 1,
        "media_failure_count": 0,
        "skipped_count": 0,
        "release_ready_count": 0,
        "baseline_only_cell": False,
        "matched_cell": True,
        "candidate_only_cell": False,
        "reviewed_additional_cell": False,
        "release_ready_additional_cell": False,
        "nearest_baseline_distance_status": "not_applicable",
        "nearest_baseline_distance_km": None,
        "nearest_baseline_cell_id": None,
        "nearest_baseline_distance_method": None,
        "latest_baseline_event_date": "2026-06-10",
        "latest_flickr_candidate_date": "2026-06-20",
        "latest_reviewed_positive_date": "2026-06-20",
        "latest_release_ready_date": None,
        "data_deficient_state": "sufficient",
        "data_deficient_reasons": [],
    }


def _impact_summary_row() -> dict[str, object]:
    return {
        "schema_version": GEOGRAPHIC_IMPACT_SUMMARY_SCHEMA_VERSION,
        "geographic_impact_build_id": "geographic-impact:2026-07-17",
        "project_id": "project:papilio-demoleus",
        "run_id": "run:geographic-impact",
        "registry_version": "butterflies-v2-20260712",
        "accepted_taxon_key": "gbif:1938069",
        "scientific_name": "Papilio demoleus",
        "baseline_snapshot_id": "baseline:gbif-2026-07-15",
        "flickr_snapshot_id": "flickr:2026-07-15",
        "provider_union_policy_version": BASELINE_PROVIDER_UNION_POLICY_VERSION,
        "verification_projection_version": "verification-projection:v2",
        "release_policy_version": "occurrence-release-policy:v1",
        "country_hierarchy_id": "country-hierarchy:test-v1",
        "spatial_resolution": 3,
        "scope_level": "global",
        "scope_id": "global",
        "scope_name": "Global",
        "parent_scope_id": None,
        "continent": None,
        "country_code": None,
        "country": None,
        "admin1": None,
        "baseline_evidence_status": "available",
        "provider_input_row_count": 7,
        "baseline_union_count": 5,
        "baseline_range_inference_eligible_count": 4,
        "baseline_excluded_occurrence_count": 1,
        "gbif_only_count": 3,
        "inaturalist_origin_through_gbif_count": 2,
        "direct_inaturalist_delta_status": "unavailable",
        "direct_inaturalist_delta_count": None,
        "duplicates_removed_count": 2,
        "unresolved_provider_duplicate_group_count": 1,
        "cell_count": 3,
        "baseline_occupied_cell_count": 1,
        "flickr_candidate_count": 2,
        "flickr_visually_eligible_count": 2,
        "reviewed_positive_count": 1,
        "reviewed_negative_count": 0,
        "uncertain_count": 0,
        "pending_count": 1,
        "media_failure_count": 0,
        "skipped_count": 0,
        "release_ready_count": 0,
        "flickr_occupied_cell_count": 2,
        "baseline_only_cell_count": 0,
        "matched_cell_count": 1,
        "candidate_only_cell_count": 1,
        "reviewed_additional_cell_count": 1,
        "release_ready_additional_cell_count": 0,
        "nearest_baseline_distance_status": "available",
        "maximum_nearest_baseline_distance_km": 121.5,
        "latest_baseline_event_date": "2026-06-10",
        "latest_flickr_candidate_date": "2026-06-20",
        "latest_reviewed_positive_date": "2026-06-20",
        "latest_release_ready_date": None,
        "data_deficient_state": "sufficient",
        "data_deficient_reasons": [],
    }


def _country_hierarchy() -> dict[str, object]:
    return {
        "schema_version": COUNTRY_HIERARCHY_SCHEMA_VERSION,
        "country_hierarchy_id": "country-hierarchy:test-v1",
        "boundary_dataset_id": "boundary:test",
        "boundary_dataset_version": "v1",
        "created_at": "2026-07-17T08:00:00Z",
        "root_scope_id": "global",
        "nodes": [
            {
                "scope_level": "global",
                "scope_id": "global",
                "scope_name": "Global",
                "parent_scope_id": None,
                "continent": None,
                "country_code": None,
                "country": None,
                "admin1_code": None,
                "admin1": None,
                "geometry_feature_id": None,
                "centroid_latitude": 0.0,
                "centroid_longitude": 0.0,
                "bounds": [-180.0, -90.0, 180.0, 90.0],
                "sort_key": "00-global",
            },
            {
                "scope_level": "continent",
                "scope_id": "continent:asia",
                "scope_name": "Asia",
                "parent_scope_id": "global",
                "continent": "Asia",
                "country_code": None,
                "country": None,
                "admin1_code": None,
                "admin1": None,
                "geometry_feature_id": "continent:asia",
                "centroid_latitude": 34.0,
                "centroid_longitude": 100.0,
                "bounds": [25.0, -10.0, 180.0, 80.0],
                "sort_key": "01-asia",
            },
            {
                "scope_level": "country",
                "scope_id": "country:IN",
                "scope_name": "India",
                "parent_scope_id": "continent:asia",
                "continent": "Asia",
                "country_code": "IN",
                "country": "India",
                "admin1_code": None,
                "admin1": None,
                "geometry_feature_id": "country:IN",
                "centroid_latitude": 22.0,
                "centroid_longitude": 79.0,
                "bounds": [68.0, 6.0, 98.0, 36.0],
                "sort_key": "02-IN",
            },
        ],
    }


def _impact_manifest() -> dict[str, object]:
    baseline_snapshot = "baseline:gbif-2026-07-15"
    flickr_snapshot = "flickr:2026-07-15"
    artifacts = [
        _available_artifact(
            "baseline_geographic_spread", 5, baseline_snapshot, "karikris/BioMiner"
        ),
        _available_artifact("baseline_occurrence_union", 7, baseline_snapshot, "karikris/taxalens"),
        _available_artifact("flickr_geography", 2, flickr_snapshot, "karikris/BioMiner"),
        _available_artifact("verification_consensus", 2),
        _available_artifact("quality_snapshot", 1),
        _available_artifact("release_decisions", 0),
        _available_artifact("geographic_impact_cells", 3),
        _available_artifact("geographic_impact_summary", 4),
        _available_artifact("country_hierarchy", 3),
    ]
    return {
        "schema_version": GEOGRAPHIC_IMPACT_MANIFEST_SCHEMA_VERSION,
        "manifest_id": "geographic-impact-manifest:test",
        "geographic_impact_build_id": "geographic-impact:2026-07-17",
        "created_at": "2026-07-17T08:00:00Z",
        "project_id": "project:papilio-demoleus",
        "run_id": "run:geographic-impact",
        "registry_version": "butterflies-v2-20260712",
        "accepted_taxon_key": "gbif:1938069",
        "scientific_name": "Papilio demoleus",
        "baseline_snapshot_id": baseline_snapshot,
        "flickr_snapshot_id": flickr_snapshot,
        "provider_union_policy_version": BASELINE_PROVIDER_UNION_POLICY_VERSION,
        "verification_projection_version": "verification-projection:v2",
        "release_policy_version": "occurrence-release-policy:v1",
        "country_hierarchy_id": "country-hierarchy:test-v1",
        "spatial_resolutions": [2, 3],
        "summary_scope_levels": ["global", "continent", "country", "admin1"],
        "source_commits": [
            {"repository": "karikris/taxalens", "commit_sha": "a" * 40},
            {"repository": "karikris/BioMiner", "commit_sha": "b" * 40},
        ],
        "artifacts": artifacts,
        "impact_cell_count": 3,
        "summary_row_count": 4,
        "hierarchy_node_count": 3,
        "baseline_evidence_status": "available",
        "baseline_union_count": 5,
        "direct_inaturalist_delta_status": "unavailable",
        "direct_inaturalist_delta_count": None,
        "flickr_candidate_count": 2,
        "reviewed_positive_count": 1,
        "reviewed_negative_count": 0,
        "uncertain_count": 0,
        "pending_count": 1,
        "media_failure_count": 0,
        "skipped_count": 0,
        "release_ready_count": 0,
        "candidate_only_cell_count": 1,
        "reviewed_additional_cell_count": 1,
        "release_ready_additional_cell_count": 0,
        "deterministic_fingerprint_sha256": "f" * 64,
        "generated_by": "taxalens-geographic-impact-builder:v1",
    }


def _available_artifact(
    logical_name: str,
    row_count: int,
    snapshot_id: str | None = None,
    repository: str = "karikris/taxalens",
) -> dict[str, object]:
    return {
        "logical_name": logical_name,
        "availability": "available",
        "path": f"artifacts/{logical_name}.json",
        "media_type": "application/json",
        "schema_version": f"{logical_name}:v1",
        "sha256": "c" * 64,
        "byte_size": 100,
        "row_count": row_count,
        "snapshot_id": snapshot_id,
        "source_repository": repository,
        "source_commit": "b" * 40 if repository == "karikris/BioMiner" else "a" * 40,
        "rights_id": "rights:mit",
        "unavailable_reason": None,
    }


def _unavailable_artifact(logical_name: str) -> dict[str, object]:
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
        "unavailable_reason": "not_materialized",
    }


def _observation_id(character: str) -> str:
    return f"baseline-observation:v1:sha256:{character * 64}"


def _relationship_id(character: str) -> str:
    return f"provider-relationship:v1:sha256:{character * 64}"
