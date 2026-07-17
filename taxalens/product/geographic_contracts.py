"""Cross-language geographic row contracts for TaxaLens analytical artifacts."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import asdict, dataclass, fields
from importlib.resources import files
from json import loads
from typing import Final, Literal, TypeAlias

from jsonschema import FormatChecker
from jsonschema.exceptions import ValidationError
from jsonschema.validators import validator_for

BASELINE_OCCURRENCE_UNION_SCHEMA_VERSION: Final = (
    "taxalens-baseline-occurrence-union:v1.0.0"
)
BASELINE_PROVIDER_UNION_POLICY_VERSION: Final = "baseline-provider-union-policy-v1.0.0"
GEOGRAPHIC_IMPACT_CELL_SCHEMA_VERSION: Final = (
    "taxalens-geographic-impact-cell:v1.0.0"
)

GeographicContract: TypeAlias = Literal[
    "baseline_occurrence_union",
    "geographic_impact_cell",
]
BaselineProviderSource: TypeAlias = Literal["gbif", "inaturalist"]
EvidenceAvailability: TypeAlias = Literal["available", "unavailable"]
NearestBaselineDistanceStatus: TypeAlias = Literal[
    "available",
    "unavailable",
    "not_applicable",
]
NearestBaselineDistanceMethod: TypeAlias = Literal["haversine_cell_centroid"]
DataDeficientState: TypeAlias = Literal[
    "sufficient",
    "data_deficient",
    "unavailable",
]
GeographicContinent: TypeAlias = Literal[
    "Africa",
    "Antarctica",
    "Asia",
    "Europe",
    "North America",
    "Oceania",
    "South America",
]
KnownRangeRole: TypeAlias = Literal[
    "native",
    "introduced",
    "vagrant",
    "uncertain",
    "unknown",
]
BaselineProviderRelationshipKind: TypeAlias = Literal[
    "canonical_source",
    "same_provider_repeat",
    "inaturalist_via_gbif",
    "direct_inaturalist_equivalent",
    "scoped_occurrence_id_equivalent",
    "stable_source_reference_equivalent",
    "strict_composite_equivalent",
    "unresolved_duplicate_candidate",
]
BaselineProviderMatchMethod: TypeAlias = Literal[
    "singleton",
    "provider_identity",
    "inaturalist_via_gbif",
    "scoped_occurrence_id",
    "stable_source_reference",
    "strict_composite",
    "unresolved_candidate",
]
ParquetPhysicalType: TypeAlias = Literal[
    "utf8",
    "boolean",
    "uint8",
    "uint64",
    "float32",
    "float64",
    "date32",
    "list_utf8",
]

GEOGRAPHIC_SCHEMA_PACKAGE: Final = "packages.contracts.schema"
GEOGRAPHIC_SCHEMA_ENTRIES: Final[dict[GeographicContract, str]] = {
    "baseline_occurrence_union": "baseline_occurrence_union.schema.json",
    "geographic_impact_cell": "geographic_impact_cell.schema.json",
}


@dataclass(frozen=True, slots=True)
class ParquetColumnContract:
    """One ordered physical Parquet column."""

    name: str
    physical_type: ParquetPhysicalType
    nullable: bool


BASELINE_OCCURRENCE_UNION_PARQUET_COLUMNS: Final[tuple[ParquetColumnContract, ...]] = (
    ParquetColumnContract("schema_version", "utf8", False),
    ParquetColumnContract("baseline_snapshot_id", "utf8", False),
    ParquetColumnContract("project_id", "utf8", False),
    ParquetColumnContract("run_id", "utf8", False),
    ParquetColumnContract("registry_version", "utf8", False),
    ParquetColumnContract("accepted_taxon_key", "utf8", False),
    ParquetColumnContract("scientific_name", "utf8", False),
    ParquetColumnContract("canonical_observation_id", "utf8", False),
    ParquetColumnContract("provider_relationship_id", "utf8", False),
    ParquetColumnContract("provider_union_policy_version", "utf8", False),
    ParquetColumnContract("provider_source", "utf8", False),
    ParquetColumnContract("delivery_provider", "utf8", False),
    ParquetColumnContract("provider_observation_id", "utf8", True),
    ParquetColumnContract("gbif_occurrence_key", "utf8", True),
    ParquetColumnContract("inaturalist_observation_id", "utf8", True),
    ParquetColumnContract("source_dataset_key", "utf8", True),
    ParquetColumnContract("source_dataset_citation", "utf8", False),
    ParquetColumnContract("source_record_sha256", "utf8", False),
    ParquetColumnContract("spatial_cell_id", "utf8", True),
    ParquetColumnContract("spatial_resolution", "uint8", True),
    ParquetColumnContract("grid_name", "utf8", False),
    ParquetColumnContract("grid_version", "utf8", False),
    ParquetColumnContract("country_code", "utf8", True),
    ParquetColumnContract("country", "utf8", True),
    ParquetColumnContract("continent", "utf8", True),
    ParquetColumnContract("admin1", "utf8", True),
    ParquetColumnContract("centroid_latitude", "float64", True),
    ParquetColumnContract("centroid_longitude", "float64", True),
    ParquetColumnContract("event_date", "date32", True),
    ParquetColumnContract("coordinate_uncertainty_m", "float64", True),
    ParquetColumnContract("basis_of_record", "utf8", True),
    ParquetColumnContract("occurrence_status", "utf8", True),
    ParquetColumnContract("known_range_role", "utf8", False),
    ParquetColumnContract("range_inference_eligible", "boolean", False),
    ParquetColumnContract("evidence_confidence", "float32", False),
    ParquetColumnContract("coordinate_valid", "boolean", False),
    ParquetColumnContract("has_geospatial_issue", "boolean", False),
    ParquetColumnContract("preserved_specimen", "boolean", False),
    ParquetColumnContract("fossil", "boolean", False),
    ParquetColumnContract("exclusion_reason", "utf8", True),
    ParquetColumnContract("provider_relationship_kind", "utf8", False),
    ParquetColumnContract("match_method", "utf8", False),
    ParquetColumnContract("duplicate_group_id", "utf8", True),
    ParquetColumnContract("unresolved_duplicate_group_id", "utf8", True),
    ParquetColumnContract("exact_duplicate_removed", "boolean", False),
    ParquetColumnContract("canonical_flag", "boolean", False),
)

GEOGRAPHIC_IMPACT_CELL_PARQUET_COLUMNS: Final[tuple[ParquetColumnContract, ...]] = (
    ParquetColumnContract("schema_version", "utf8", False),
    ParquetColumnContract("geographic_impact_build_id", "utf8", False),
    ParquetColumnContract("project_id", "utf8", False),
    ParquetColumnContract("run_id", "utf8", False),
    ParquetColumnContract("registry_version", "utf8", False),
    ParquetColumnContract("accepted_taxon_key", "utf8", False),
    ParquetColumnContract("scientific_name", "utf8", False),
    ParquetColumnContract("baseline_snapshot_id", "utf8", False),
    ParquetColumnContract("flickr_snapshot_id", "utf8", False),
    ParquetColumnContract("provider_union_policy_version", "utf8", False),
    ParquetColumnContract("verification_projection_version", "utf8", False),
    ParquetColumnContract("release_policy_version", "utf8", False),
    ParquetColumnContract("verification_campaign_id", "utf8", True),
    ParquetColumnContract("quality_snapshot_id", "utf8", True),
    ParquetColumnContract("release_decision_id", "utf8", True),
    ParquetColumnContract("grid_name", "utf8", False),
    ParquetColumnContract("grid_version", "utf8", False),
    ParquetColumnContract("spatial_resolution", "uint8", False),
    ParquetColumnContract("spatial_cell_id", "utf8", False),
    ParquetColumnContract("parent_spatial_cell_id", "utf8", True),
    ParquetColumnContract("country_hierarchy_id", "utf8", False),
    ParquetColumnContract("continent", "utf8", False),
    ParquetColumnContract("country_code", "utf8", False),
    ParquetColumnContract("country", "utf8", False),
    ParquetColumnContract("admin1", "utf8", True),
    ParquetColumnContract("centroid_latitude", "float64", False),
    ParquetColumnContract("centroid_longitude", "float64", False),
    ParquetColumnContract("baseline_evidence_status", "utf8", False),
    ParquetColumnContract("provider_input_row_count", "uint64", True),
    ParquetColumnContract("baseline_union_count", "uint64", True),
    ParquetColumnContract(
        "baseline_range_inference_eligible_count", "uint64", True
    ),
    ParquetColumnContract("baseline_excluded_occurrence_count", "uint64", True),
    ParquetColumnContract("gbif_only_count", "uint64", True),
    ParquetColumnContract("inaturalist_origin_through_gbif_count", "uint64", True),
    ParquetColumnContract("direct_inaturalist_delta_status", "utf8", False),
    ParquetColumnContract("direct_inaturalist_delta_count", "uint64", True),
    ParquetColumnContract("duplicates_removed_count", "uint64", True),
    ParquetColumnContract(
        "unresolved_provider_duplicate_group_count", "uint64", True
    ),
    ParquetColumnContract("flickr_candidate_count", "uint64", False),
    ParquetColumnContract("flickr_visually_eligible_count", "uint64", False),
    ParquetColumnContract("reviewed_positive_count", "uint64", False),
    ParquetColumnContract("reviewed_negative_count", "uint64", False),
    ParquetColumnContract("uncertain_count", "uint64", False),
    ParquetColumnContract("pending_count", "uint64", False),
    ParquetColumnContract("media_failure_count", "uint64", False),
    ParquetColumnContract("skipped_count", "uint64", False),
    ParquetColumnContract("release_ready_count", "uint64", False),
    ParquetColumnContract("baseline_only_cell", "boolean", False),
    ParquetColumnContract("matched_cell", "boolean", False),
    ParquetColumnContract("candidate_only_cell", "boolean", False),
    ParquetColumnContract("reviewed_additional_cell", "boolean", False),
    ParquetColumnContract("release_ready_additional_cell", "boolean", False),
    ParquetColumnContract("nearest_baseline_distance_status", "utf8", False),
    ParquetColumnContract("nearest_baseline_distance_km", "float64", True),
    ParquetColumnContract("nearest_baseline_cell_id", "utf8", True),
    ParquetColumnContract("nearest_baseline_distance_method", "utf8", True),
    ParquetColumnContract("latest_baseline_event_date", "date32", True),
    ParquetColumnContract("latest_flickr_candidate_date", "date32", True),
    ParquetColumnContract("latest_reviewed_positive_date", "date32", True),
    ParquetColumnContract("latest_release_ready_date", "date32", True),
    ParquetColumnContract("data_deficient_state", "utf8", False),
    ParquetColumnContract("data_deficient_reasons", "list_utf8", False),
)


@dataclass(frozen=True, slots=True)
class BaselineOccurrenceUnionRow:
    """One immutable provider relationship in baseline_occurrence_union.parquet."""

    schema_version: str
    baseline_snapshot_id: str
    project_id: str
    run_id: str
    registry_version: str
    accepted_taxon_key: str
    scientific_name: str
    canonical_observation_id: str
    provider_relationship_id: str
    provider_union_policy_version: str
    provider_source: BaselineProviderSource
    delivery_provider: BaselineProviderSource
    provider_observation_id: str | None
    gbif_occurrence_key: str | None
    inaturalist_observation_id: str | None
    source_dataset_key: str | None
    source_dataset_citation: str
    source_record_sha256: str
    spatial_cell_id: str | None
    spatial_resolution: int | None
    grid_name: str
    grid_version: str
    country_code: str | None
    country: str | None
    continent: GeographicContinent | None
    admin1: str | None
    centroid_latitude: float | None
    centroid_longitude: float | None
    event_date: str | None
    coordinate_uncertainty_m: float | None
    basis_of_record: str | None
    occurrence_status: str | None
    known_range_role: KnownRangeRole
    range_inference_eligible: bool
    evidence_confidence: float
    coordinate_valid: bool
    has_geospatial_issue: bool
    preserved_specimen: bool
    fossil: bool
    exclusion_reason: str | None
    provider_relationship_kind: BaselineProviderRelationshipKind
    match_method: BaselineProviderMatchMethod
    duplicate_group_id: str | None
    unresolved_duplicate_group_id: str | None
    exact_duplicate_removed: bool
    canonical_flag: bool

    @classmethod
    def from_mapping(cls, value: Mapping[str, object]) -> BaselineOccurrenceUnionRow:
        """Validate and freeze one JSON-compatible row projection."""

        materialized = dict(value)
        assert_geographic_contract("baseline_occurrence_union", materialized)
        names = tuple(field.name for field in fields(cls))
        return cls(**{name: materialized[name] for name in names})  # type: ignore[arg-type]

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-compatible row in the contract's field order."""

        return asdict(self)


@dataclass(frozen=True, slots=True)
class GeographicImpactCellRow:
    """One immutable baseline/Flickr full-outer-join spatial cell."""

    schema_version: str
    geographic_impact_build_id: str
    project_id: str
    run_id: str
    registry_version: str
    accepted_taxon_key: str
    scientific_name: str
    baseline_snapshot_id: str
    flickr_snapshot_id: str
    provider_union_policy_version: str
    verification_projection_version: str
    release_policy_version: str
    verification_campaign_id: str | None
    quality_snapshot_id: str | None
    release_decision_id: str | None
    grid_name: str
    grid_version: str
    spatial_resolution: int
    spatial_cell_id: str
    parent_spatial_cell_id: str | None
    country_hierarchy_id: str
    continent: GeographicContinent
    country_code: str
    country: str
    admin1: str | None
    centroid_latitude: float
    centroid_longitude: float
    baseline_evidence_status: EvidenceAvailability
    provider_input_row_count: int | None
    baseline_union_count: int | None
    baseline_range_inference_eligible_count: int | None
    baseline_excluded_occurrence_count: int | None
    gbif_only_count: int | None
    inaturalist_origin_through_gbif_count: int | None
    direct_inaturalist_delta_status: EvidenceAvailability
    direct_inaturalist_delta_count: int | None
    duplicates_removed_count: int | None
    unresolved_provider_duplicate_group_count: int | None
    flickr_candidate_count: int
    flickr_visually_eligible_count: int
    reviewed_positive_count: int
    reviewed_negative_count: int
    uncertain_count: int
    pending_count: int
    media_failure_count: int
    skipped_count: int
    release_ready_count: int
    baseline_only_cell: bool
    matched_cell: bool
    candidate_only_cell: bool
    reviewed_additional_cell: bool
    release_ready_additional_cell: bool
    nearest_baseline_distance_status: NearestBaselineDistanceStatus
    nearest_baseline_distance_km: float | None
    nearest_baseline_cell_id: str | None
    nearest_baseline_distance_method: NearestBaselineDistanceMethod | None
    latest_baseline_event_date: str | None
    latest_flickr_candidate_date: str | None
    latest_reviewed_positive_date: str | None
    latest_release_ready_date: str | None
    data_deficient_state: DataDeficientState
    data_deficient_reasons: tuple[str, ...]

    @classmethod
    def from_mapping(cls, value: Mapping[str, object]) -> GeographicImpactCellRow:
        """Validate and freeze one JSON-compatible impact-cell projection."""

        materialized = dict(value)
        assert_geographic_contract("geographic_impact_cell", materialized)
        names = tuple(field.name for field in fields(cls))
        values = {name: materialized[name] for name in names}
        reasons = values["data_deficient_reasons"]
        assert isinstance(reasons, list)
        values["data_deficient_reasons"] = tuple(reasons)
        return cls(**values)  # type: ignore[arg-type]

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-compatible row in the contract's field order."""

        value = asdict(self)
        value["data_deficient_reasons"] = list(self.data_deficient_reasons)
        return value


@dataclass(frozen=True, slots=True)
class GeographicSchemaFailure:
    """One normalized JSON Schema validation failure."""

    instance_path: str
    keyword: str


@dataclass(frozen=True, slots=True)
class GeographicSchemaValidation:
    """Portable validation result shared with the TypeScript boundary."""

    contract: GeographicContract
    valid: bool
    failures: tuple[GeographicSchemaFailure, ...]


class GeographicSchemaError(ValueError):
    """Raised when a geographic artifact row violates its contract."""

    def __init__(self, validation: GeographicSchemaValidation) -> None:
        details = ", ".join(
            f"{failure.instance_path or '/'}:{failure.keyword}"
            for failure in validation.failures
        )
        super().__init__(f"{validation.contract} failed geographic schema validation: {details}")
        self.validation = validation


def geographic_schema_documents() -> dict[str, object]:
    """Return fresh parsed copies of all geographic entry schemas."""

    schema_files = files(GEOGRAPHIC_SCHEMA_PACKAGE)
    return {
        name: loads(schema_files.joinpath(name).read_text(encoding="utf-8"))
        for name in GEOGRAPHIC_SCHEMA_ENTRIES.values()
    }


def validate_geographic_contract(
    contract: GeographicContract,
    value: object,
) -> GeographicSchemaValidation:
    """Validate one JSON-compatible row against a geographic entry schema."""

    validator = _validators()[contract]
    failure_set = {
        GeographicSchemaFailure(
            instance_path=_json_pointer(error),
            keyword=str(error.validator),
        )
        for error in validator.iter_errors(value)
    }
    if not failure_set and contract == "geographic_impact_cell":
        assert isinstance(value, Mapping)
        failure_set.update(_impact_cell_semantic_failures(value))
    failures = tuple(
        sorted(
            failure_set,
            key=lambda failure: (failure.instance_path, failure.keyword),
        )
    )
    return GeographicSchemaValidation(
        contract=contract,
        valid=not failures,
        failures=failures,
    )


def assert_geographic_contract(contract: GeographicContract, value: object) -> None:
    """Raise a typed error when a geographic row violates its schema."""

    validation = validate_geographic_contract(contract, value)
    if not validation.valid:
        raise GeographicSchemaError(validation)


_VALIDATORS: dict[GeographicContract, object] | None = None


def _validators() -> dict[GeographicContract, object]:
    global _VALIDATORS
    if _VALIDATORS is not None:
        return _VALIDATORS
    documents = geographic_schema_documents()
    built: dict[GeographicContract, object] = {}
    for contract, name in GEOGRAPHIC_SCHEMA_ENTRIES.items():
        entry = documents[name]
        if not isinstance(entry, dict):
            raise TypeError(f"{name} must contain a JSON object")
        validator_class = validator_for(entry)
        validator_class.check_schema(entry)
        built[contract] = validator_class(entry, format_checker=FormatChecker())
    _VALIDATORS = built
    return built


def _json_pointer(error: ValidationError) -> str:
    if not error.absolute_path:
        return ""
    return "/" + "/".join(
        str(part).replace("~", "~0").replace("/", "~1") for part in error.absolute_path
    )


def _impact_cell_semantic_failures(
    value: Mapping[str, object],
) -> set[GeographicSchemaFailure]:
    """Enforce reconciliations that JSON Schema cannot express portably."""

    failures: set[GeographicSchemaFailure] = set()

    def fail(path: str, keyword: str) -> None:
        failures.add(GeographicSchemaFailure(path, keyword))

    baseline_available = value["baseline_evidence_status"] == "available"
    flickr_count = int(value["flickr_candidate_count"])  # type: ignore[arg-type]
    reviewed_positive = int(value["reviewed_positive_count"])  # type: ignore[arg-type]
    reviewed_negative = int(value["reviewed_negative_count"])  # type: ignore[arg-type]
    uncertain = int(value["uncertain_count"])  # type: ignore[arg-type]
    pending = int(value["pending_count"])  # type: ignore[arg-type]
    media_failure = int(value["media_failure_count"])  # type: ignore[arg-type]
    skipped = int(value["skipped_count"])  # type: ignore[arg-type]
    release_ready = int(value["release_ready_count"])  # type: ignore[arg-type]

    review_total = (
        reviewed_positive
        + reviewed_negative
        + uncertain
        + pending
        + media_failure
        + skipped
    )
    if review_total != flickr_count:
        fail("/flickr_candidate_count", "count_reconciliation")
    if int(value["flickr_visually_eligible_count"]) > flickr_count:  # type: ignore[arg-type]
        fail("/flickr_visually_eligible_count", "count_reconciliation")
    if release_ready > reviewed_positive:
        fail("/release_ready_count", "release_state_invariant")
    if flickr_count == 0 and any(
        value[name] is not None
        for name in (
            "latest_flickr_candidate_date",
            "latest_reviewed_positive_date",
            "latest_release_ready_date",
        )
    ):
        fail("/latest_flickr_candidate_date", "date_state_invariant")
    if reviewed_positive == 0 and value["latest_reviewed_positive_date"] is not None:
        fail("/latest_reviewed_positive_date", "date_state_invariant")
    if release_ready == 0 and value["latest_release_ready_date"] is not None:
        fail("/latest_release_ready_date", "date_state_invariant")

    reviewed_or_attempted = (
        reviewed_positive + reviewed_negative + uncertain + media_failure + skipped
    )
    if reviewed_or_attempted > 0 and value["verification_campaign_id"] is None:
        fail("/verification_campaign_id", "identity_required")
    if release_ready > 0 and value["release_decision_id"] is None:
        fail("/release_decision_id", "identity_required")

    if not baseline_available:
        if flickr_count == 0:
            fail("/flickr_candidate_count", "full_outer_source_required")
        if value["nearest_baseline_distance_status"] != "unavailable":
            fail("/nearest_baseline_distance_status", "distance_state_invariant")
        if value["latest_baseline_event_date"] is not None:
            fail("/latest_baseline_event_date", "date_state_invariant")
        return failures

    provider_input = int(value["provider_input_row_count"])  # type: ignore[arg-type]
    baseline_union = int(value["baseline_union_count"])  # type: ignore[arg-type]
    baseline_eligible = int(  # type: ignore[arg-type]
        value["baseline_range_inference_eligible_count"]
    )
    baseline_excluded = int(  # type: ignore[arg-type]
        value["baseline_excluded_occurrence_count"]
    )
    gbif_only = int(value["gbif_only_count"])  # type: ignore[arg-type]
    inaturalist_via_gbif = int(  # type: ignore[arg-type]
        value["inaturalist_origin_through_gbif_count"]
    )
    duplicates_removed = int(value["duplicates_removed_count"])  # type: ignore[arg-type]

    if provider_input != baseline_union + duplicates_removed:
        fail("/provider_input_row_count", "count_reconciliation")
    if baseline_union != baseline_eligible + baseline_excluded:
        fail("/baseline_union_count", "count_reconciliation")
    provider_union_parts = gbif_only + inaturalist_via_gbif
    if value["direct_inaturalist_delta_status"] == "available":
        provider_union_parts += int(  # type: ignore[arg-type]
            value["direct_inaturalist_delta_count"]
        )
    if baseline_union != provider_union_parts:
        fail("/baseline_union_count", "provider_count_reconciliation")
    if baseline_union == 0 and flickr_count == 0:
        fail("/spatial_cell_id", "full_outer_source_required")

    expected_flags = {
        "baseline_only_cell": baseline_eligible > 0 and flickr_count == 0,
        "matched_cell": baseline_eligible > 0 and flickr_count > 0,
        "candidate_only_cell": baseline_eligible == 0 and flickr_count > 0,
        "reviewed_additional_cell": baseline_eligible == 0 and reviewed_positive > 0,
        "release_ready_additional_cell": baseline_eligible == 0 and release_ready > 0,
    }
    for name, expected in expected_flags.items():
        if value[name] != expected:
            fail(f"/{name}", "cell_state_invariant")

    if baseline_eligible > 0 and value["nearest_baseline_distance_status"] != "not_applicable":
        fail("/nearest_baseline_distance_status", "distance_state_invariant")

    return failures


__all__ = [
    "BASELINE_OCCURRENCE_UNION_PARQUET_COLUMNS",
    "BASELINE_OCCURRENCE_UNION_SCHEMA_VERSION",
    "BASELINE_PROVIDER_UNION_POLICY_VERSION",
    "GEOGRAPHIC_IMPACT_CELL_PARQUET_COLUMNS",
    "GEOGRAPHIC_IMPACT_CELL_SCHEMA_VERSION",
    "GEOGRAPHIC_SCHEMA_ENTRIES",
    "BaselineOccurrenceUnionRow",
    "GeographicContract",
    "GeographicImpactCellRow",
    "GeographicSchemaError",
    "GeographicSchemaFailure",
    "GeographicSchemaValidation",
    "ParquetColumnContract",
    "assert_geographic_contract",
    "geographic_schema_documents",
    "validate_geographic_contract",
]
