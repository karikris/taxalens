from __future__ import annotations

from dataclasses import FrozenInstanceError, fields

import pytest
from taxalens.product import (
    BASELINE_OCCURRENCE_UNION_PARQUET_COLUMNS,
    BASELINE_OCCURRENCE_UNION_SCHEMA_VERSION,
    BASELINE_PROVIDER_UNION_POLICY_VERSION,
    BaselineOccurrenceUnionRow,
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


def _observation_id(character: str) -> str:
    return f"baseline-observation:v1:sha256:{character * 64}"


def _relationship_id(character: str) -> str:
    return f"provider-relationship:v1:sha256:{character * 64}"
