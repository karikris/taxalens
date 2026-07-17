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

GeographicContract: TypeAlias = Literal["baseline_occurrence_union"]
BaselineProviderSource: TypeAlias = Literal["gbif", "inaturalist"]
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
    "float32",
    "float64",
    "date32",
]

GEOGRAPHIC_SCHEMA_PACKAGE: Final = "packages.contracts.schema"
GEOGRAPHIC_SCHEMA_ENTRIES: Final[dict[GeographicContract, str]] = {
    "baseline_occurrence_union": "baseline_occurrence_union.schema.json",
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
    failures = tuple(
        sorted(
            {
                GeographicSchemaFailure(
                    instance_path=_json_pointer(error),
                    keyword=str(error.validator),
                )
                for error in validator.iter_errors(value)
            },
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


__all__ = [
    "BASELINE_OCCURRENCE_UNION_PARQUET_COLUMNS",
    "BASELINE_OCCURRENCE_UNION_SCHEMA_VERSION",
    "BASELINE_PROVIDER_UNION_POLICY_VERSION",
    "GEOGRAPHIC_SCHEMA_ENTRIES",
    "BaselineOccurrenceUnionRow",
    "GeographicContract",
    "GeographicSchemaError",
    "GeographicSchemaFailure",
    "GeographicSchemaValidation",
    "ParquetColumnContract",
    "assert_geographic_contract",
    "geographic_schema_documents",
    "validate_geographic_contract",
]
