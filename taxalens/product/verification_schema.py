"""Cross-language validation for authoritative TaxaLens verification schemas."""

from __future__ import annotations

from dataclasses import dataclass
from importlib.resources import files
from json import loads
from typing import Final, Literal, TypeAlias

from jsonschema import FormatChecker
from jsonschema.exceptions import ValidationError
from jsonschema.validators import validator_for
from referencing import Registry, Resource

VerificationSchemaContract: TypeAlias = Literal[
    "campaign",
    "item",
    "event",
    "consensus",
    "quality_snapshot",
    "judge_bundle_verification_sections",
]

VERIFICATION_SCHEMA_CONTRACTS: Final[tuple[VerificationSchemaContract, ...]] = (
    "campaign",
    "item",
    "event",
    "consensus",
    "quality_snapshot",
    "judge_bundle_verification_sections",
)
VERIFICATION_SCHEMA_PACKAGE: Final = "packages.contracts.schema"
VERIFICATION_SCHEMA_ROOT: Final = "verification.schema.json"
VERIFICATION_SCHEMA_ENTRIES: Final[dict[VerificationSchemaContract, str]] = {
    "campaign": "verification_campaign.schema.json",
    "item": "verification_item.schema.json",
    "event": "verification_event.schema.json",
    "consensus": "verification_consensus.schema.json",
    "quality_snapshot": "verification_quality_snapshot.schema.json",
    "judge_bundle_verification_sections": (
        "judge_bundle_verification_sections.schema.json"
    ),
}


@dataclass(frozen=True, slots=True)
class VerificationSchemaFailure:
    """One normalized structural validation failure."""

    instance_path: str
    keyword: str


@dataclass(frozen=True, slots=True)
class VerificationSchemaValidation:
    """Portable validation result shared with the TypeScript boundary."""

    contract: VerificationSchemaContract
    valid: bool
    failures: tuple[VerificationSchemaFailure, ...]


class VerificationSchemaError(ValueError):
    """Raised when evidence fails an authoritative verification schema."""

    def __init__(self, validation: VerificationSchemaValidation) -> None:
        details = ", ".join(
            f"{failure.instance_path or '/'}:{failure.keyword}"
            for failure in validation.failures
        )
        super().__init__(
            f"{validation.contract} failed verification schema validation: {details}"
        )
        self.validation = validation


def validate_verification_schema(
    contract: VerificationSchemaContract,
    value: object,
) -> VerificationSchemaValidation:
    """Validate one value against the named authoritative entry schema."""

    validator = _validators()[contract]
    failures = tuple(
        sorted(
            {
                VerificationSchemaFailure(
                    instance_path=_json_pointer(error),
                    keyword=str(error.validator),
                )
                for error in validator.iter_errors(value)
            },
            key=lambda failure: (failure.instance_path, failure.keyword),
        )
    )
    return VerificationSchemaValidation(
        contract=contract,
        valid=not failures,
        failures=failures,
    )


def assert_verification_schema(
    contract: VerificationSchemaContract,
    value: object,
) -> None:
    """Raise a typed failure when evidence violates its entry schema."""

    validation = validate_verification_schema(contract, value)
    if not validation.valid:
        raise VerificationSchemaError(validation)


def verification_schema_documents() -> dict[str, object]:
    """Return fresh parsed copies of the root and six entry schemas."""

    schema_files = files(VERIFICATION_SCHEMA_PACKAGE)
    names = (VERIFICATION_SCHEMA_ROOT, *VERIFICATION_SCHEMA_ENTRIES.values())
    return {
        name: loads(schema_files.joinpath(name).read_text(encoding="utf-8"))
        for name in names
    }


_VALIDATORS: dict[VerificationSchemaContract, object] | None = None


def _validators() -> dict[VerificationSchemaContract, object]:
    global _VALIDATORS
    if _VALIDATORS is not None:
        return _VALIDATORS
    documents = verification_schema_documents()
    root = documents[VERIFICATION_SCHEMA_ROOT]
    if not isinstance(root, dict) or not isinstance(root.get("$id"), str):
        raise VerificationSchemaError(
            VerificationSchemaValidation(
                contract="campaign",
                valid=False,
                failures=(
                    VerificationSchemaFailure("", "invalid_schema_root"),
                ),
            )
        )
    registry = Registry().with_resource(
        root["$id"],
        Resource.from_contents(root),
    )
    built: dict[VerificationSchemaContract, object] = {}
    for contract, name in VERIFICATION_SCHEMA_ENTRIES.items():
        entry = documents[name]
        if not isinstance(entry, dict):
            raise TypeError(f"{name} must contain a JSON object")
        validator_class = validator_for(entry)
        validator_class.check_schema(entry)
        built[contract] = validator_class(
            entry,
            registry=registry,
            format_checker=FormatChecker(),
        )
    _VALIDATORS = built
    return built


def _json_pointer(error: ValidationError) -> str:
    if not error.absolute_path:
        return ""
    return "/" + "/".join(
        str(part).replace("~", "~0").replace("/", "~1")
        for part in error.absolute_path
    )


__all__ = [
    "VERIFICATION_SCHEMA_CONTRACTS",
    "VERIFICATION_SCHEMA_ENTRIES",
    "VerificationSchemaContract",
    "VerificationSchemaError",
    "VerificationSchemaFailure",
    "VerificationSchemaValidation",
    "assert_verification_schema",
    "validate_verification_schema",
    "verification_schema_documents",
]
