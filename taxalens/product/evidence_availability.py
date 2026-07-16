"""Explicit, JSON-portable evidence availability contracts."""

from __future__ import annotations

import math
import re
from collections.abc import Callable, Mapping, Sequence
from types import MappingProxyType
from typing import Final, TypeAlias

from taxalens.product.contracts import FrozenJson, freeze_json

EVIDENCE_AVAILABILITY_SCHEMA_VERSION: Final = "taxalens-evidence-availability:v1.0.0"
EVIDENCE_AVAILABILITY_STATES: Final = (
    "available",
    "measured_zero",
    "unavailable",
    "blocked",
    "not_applicable",
    "failed",
)

EvidenceAvailability: TypeAlias = Mapping[str, FrozenJson]
AvailableValidator: TypeAlias = Callable[[object], bool]

_ERROR_CODE = re.compile(r"^[a-z][a-z0-9_]{0,119}$")


class EvidenceAvailabilityError(ValueError):
    """Raised when an evidence availability envelope cannot be constructed."""


def available_evidence(value: object) -> EvidenceAvailability:
    """Construct immutable available evidence without nullable or zero ambiguity."""

    if value is None:
        raise EvidenceAvailabilityError("available evidence cannot contain None")
    if _is_number(value) and value == 0:
        raise EvidenceAvailabilityError(
            "measured numeric zero must use the measured_zero evidence state"
        )
    if isinstance(value, float) and not math.isfinite(value):
        raise EvidenceAvailabilityError("available numeric evidence must be finite")
    try:
        frozen = freeze_json(value)
    except TypeError as error:
        raise EvidenceAvailabilityError(str(error)) from error
    return _freeze_envelope(
        {
            "schemaVersion": EVIDENCE_AVAILABILITY_SCHEMA_VERSION,
            "state": "available",
            "value": frozen,
        }
    )


def measured_zero_evidence() -> EvidenceAvailability:
    """Construct evidence for an observed numeric zero."""

    return _freeze_envelope(
        {
            "schemaVersion": EVIDENCE_AVAILABILITY_SCHEMA_VERSION,
            "state": "measured_zero",
            "value": 0,
        }
    )


def unavailable_evidence(reason: str) -> EvidenceAvailability:
    """Construct evidence that was not available for measurement."""

    return _freeze_envelope(
        {
            "schemaVersion": EVIDENCE_AVAILABILITY_SCHEMA_VERSION,
            "state": "unavailable",
            "reason": _bounded_text(reason, "unavailable evidence reason"),
        }
    )


def blocked_evidence(reason: str, blockers: Sequence[str]) -> EvidenceAvailability:
    """Construct evidence withheld by explicit canonical blockers."""

    canonical_blockers = tuple(
        sorted(_bounded_text(blocker, "blocked evidence blocker") for blocker in blockers)
    )
    if not canonical_blockers:
        raise EvidenceAvailabilityError("blocked evidence requires at least one blocker")
    if len(set(canonical_blockers)) != len(canonical_blockers):
        raise EvidenceAvailabilityError("blocked evidence blockers must be unique")
    return _freeze_envelope(
        {
            "schemaVersion": EVIDENCE_AVAILABILITY_SCHEMA_VERSION,
            "state": "blocked",
            "reason": _bounded_text(reason, "blocked evidence reason"),
            "blockers": canonical_blockers,
        }
    )


def not_applicable_evidence(reason: str) -> EvidenceAvailability:
    """Construct evidence that is outside the operation's scientific scope."""

    return _freeze_envelope(
        {
            "schemaVersion": EVIDENCE_AVAILABILITY_SCHEMA_VERSION,
            "state": "not_applicable",
            "reason": _bounded_text(reason, "not-applicable evidence reason"),
        }
    )


def failed_evidence(
    error_code: str,
    message: str,
    retryable: bool,
) -> EvidenceAvailability:
    """Construct structured evidence for an execution or inspection failure."""

    canonical_code = _bounded_text(error_code, "failed evidence error code")
    if _ERROR_CODE.fullmatch(canonical_code) is None:
        raise EvidenceAvailabilityError("failed evidence error code must be lower snake case")
    if not isinstance(retryable, bool):
        raise EvidenceAvailabilityError("failed evidence retryable must be boolean")
    return _freeze_envelope(
        {
            "schemaVersion": EVIDENCE_AVAILABILITY_SCHEMA_VERSION,
            "state": "failed",
            "errorCode": canonical_code,
            "message": _bounded_text(message, "failed evidence message", maximum=2_000),
            "retryable": retryable,
        }
    )


def validate_evidence_availability(
    value: object,
    validate_available_value: AvailableValidator | None = None,
) -> tuple[str, ...]:
    """Return deterministic failures for one availability envelope."""

    if not isinstance(value, Mapping):
        return ("evidence availability must be an object",)
    if value.get("schemaVersion") != EVIDENCE_AVAILABILITY_SCHEMA_VERSION:
        return ("evidence availability schema version is unsupported",)
    state = value.get("state")
    if state not in EVIDENCE_AVAILABILITY_STATES:
        return ("evidence availability state is unsupported",)

    failures: list[str] = []
    if state == "available":
        _validate_available(value, validate_available_value, failures)
    elif state == "measured_zero":
        _require_keys(value, {"schemaVersion", "state", "value"}, "measured-zero", failures)
        if value.get("value") != 0 or isinstance(value.get("value"), bool):
            failures.append("measured-zero evidence value must equal numeric zero")
    elif state in {"unavailable", "not_applicable"}:
        _require_keys(value, {"schemaVersion", "state", "reason"}, state, failures)
        if not _valid_text(value.get("reason")):
            failures.append(f"{state} evidence reason must be non-empty")
    elif state == "blocked":
        _validate_blocked(value, failures)
    elif state == "failed":
        _validate_failed(value, failures)
    return tuple(failures)


def _validate_available(
    value: Mapping[object, object],
    validate_available_value: AvailableValidator | None,
    failures: list[str],
) -> None:
    _require_keys(value, {"schemaVersion", "state", "value"}, "available", failures)
    candidate = value.get("value")
    if candidate is None:
        failures.append("available evidence value must not be None")
    if _is_number(candidate):
        if candidate == 0:
            failures.append("numeric zero must use measured_zero evidence")
        if isinstance(candidate, float) and not math.isfinite(candidate):
            failures.append("available numeric evidence must be finite")
    if validate_available_value is not None and not validate_available_value(candidate):
        failures.append("available evidence value is invalid")


def _validate_blocked(
    value: Mapping[object, object],
    failures: list[str],
) -> None:
    _require_keys(
        value,
        {"schemaVersion", "state", "reason", "blockers"},
        "blocked",
        failures,
    )
    if not _valid_text(value.get("reason")):
        failures.append("blocked evidence reason must be non-empty")
    blockers = value.get("blockers")
    valid_blockers = (
        isinstance(blockers, list | tuple)
        and bool(blockers)
        and all(_valid_text(blocker) for blocker in blockers)
    )
    if (
        not valid_blockers
        or len(set(blockers)) != len(blockers)
        or list(blockers) != sorted(blockers)
    ):
        failures.append("blocked evidence blockers must be non-empty unique sorted strings")


def _validate_failed(
    value: Mapping[object, object],
    failures: list[str],
) -> None:
    _require_keys(
        value,
        {"schemaVersion", "state", "errorCode", "message", "retryable"},
        "failed",
        failures,
    )
    error_code = value.get("errorCode")
    if not isinstance(error_code, str) or _ERROR_CODE.fullmatch(error_code) is None:
        failures.append("failed evidence error code is invalid")
    if not _valid_text(value.get("message")):
        failures.append("failed evidence message must be non-empty")
    if not isinstance(value.get("retryable"), bool):
        failures.append("failed evidence retryable must be boolean")


def _require_keys(
    value: Mapping[object, object],
    expected: set[str],
    label: str,
    failures: list[str],
) -> None:
    if set(value) != expected:
        failures.append(f"{label} evidence fields are invalid")


def _freeze_envelope(value: dict[str, FrozenJson]) -> EvidenceAvailability:
    return MappingProxyType(value)


def _bounded_text(value: str, label: str, *, maximum: int = 1_200) -> str:
    if not isinstance(value, str):
        raise EvidenceAvailabilityError(f"{label} must be text")
    canonical = value.strip()
    if not 1 <= len(canonical) <= maximum:
        raise EvidenceAvailabilityError(f"{label} must contain between 1 and {maximum} characters")
    return canonical


def _valid_text(value: object) -> bool:
    return isinstance(value, str) and 0 < len(value.strip()) <= 2_000


def _is_number(value: object) -> bool:
    return isinstance(value, int | float) and not isinstance(value, bool)


__all__ = [
    "EVIDENCE_AVAILABILITY_SCHEMA_VERSION",
    "EVIDENCE_AVAILABILITY_STATES",
    "EvidenceAvailability",
    "EvidenceAvailabilityError",
    "available_evidence",
    "blocked_evidence",
    "failed_evidence",
    "measured_zero_evidence",
    "not_applicable_evidence",
    "unavailable_evidence",
    "validate_evidence_availability",
]
