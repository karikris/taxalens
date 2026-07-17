"""Conservative deterministic identity rules for the baseline provider union."""

from __future__ import annotations

import hashlib
import json
import math
import re
from dataclasses import dataclass
from datetime import date
from typing import Literal
from urllib.parse import SplitResult, urlsplit, urlunsplit

ProviderSource = Literal["gbif", "inaturalist"]
IdentityMethod = Literal[
    "provider_identity",
    "inaturalist_via_gbif",
    "scoped_occurrence_id",
    "stable_source_reference",
    "strict_composite",
    "singleton",
]

PROVIDER_UNION_POLICY_VERSION = "baseline-provider-union-policy-v1.0.0"
IDENTITY_NORMALIZATION_VERSION = "baseline-provider-identity-normalization-v1.0.0"
INATURALIST_GBIF_DATASET_KEY = "50c9509d-22c7-4a22-a47d-8c48425ef4a7"

_SHA256 = re.compile(r"^[0-9a-f]{64}$")
_ISO_ALPHA2 = re.compile(r"^[A-Z]{2}$")


class BaselineProviderIdentityError(ValueError):
    """Raised when a provider identity cannot be normalized safely."""


@dataclass(frozen=True, slots=True)
class ProviderIdentityRecord:
    """Immutable provider record identity fields used by the match hierarchy."""

    record_id: str
    provider_source: ProviderSource
    delivery_provider: ProviderSource
    source_record_sha256: str
    provider_observation_id: str | None = None
    gbif_occurrence_key: str | None = None
    inaturalist_observation_id: str | None = None
    occurrence_id: str | None = None
    occurrence_namespace: str | None = None
    stable_source_reference: str | None = None
    source_dataset_key: str | None = None
    observer_id: str | None = None
    accepted_taxon_key: str | None = None
    event_date: date | None = None
    latitude: float | None = None
    longitude: float | None = None
    coordinate_uncertainty_m: float | None = None
    country_code: str | None = None
    admin1: str | None = None

    def __post_init__(self) -> None:
        _required_text(self.record_id, "record_id")
        if self.provider_source not in {"gbif", "inaturalist"}:
            raise BaselineProviderIdentityError("provider_source is unsupported")
        if self.delivery_provider not in {"gbif", "inaturalist"}:
            raise BaselineProviderIdentityError("delivery_provider is unsupported")
        if not _SHA256.fullmatch(self.source_record_sha256):
            raise BaselineProviderIdentityError("source_record_sha256 is invalid")
        if self.country_code is not None and not _ISO_ALPHA2.fullmatch(self.country_code):
            raise BaselineProviderIdentityError("country_code is invalid")
        _optional_coordinate(self.latitude, -90, 90, "latitude")
        _optional_coordinate(self.longitude, -180, 180, "longitude")
        if self.coordinate_uncertainty_m is not None and (
            not math.isfinite(self.coordinate_uncertainty_m) or self.coordinate_uncertainty_m < 0
        ):
            raise BaselineProviderIdentityError("coordinate uncertainty is invalid")


@dataclass(frozen=True, slots=True)
class ProviderIdentityBasis:
    """The strongest safe identity basis available for one provider record."""

    method: IdentityMethod
    priority: int
    namespace: str
    normalized_values: tuple[str, ...]
    identity_key: str


def classify_provider_source(
    *, delivery_provider: ProviderSource, source_dataset_key: str | None
) -> ProviderSource:
    """Classify original provider only from exact committed provenance."""

    if delivery_provider == "inaturalist":
        return "inaturalist"
    dataset_key = _text(source_dataset_key)
    if dataset_key == INATURALIST_GBIF_DATASET_KEY:
        return "inaturalist"
    return "gbif"


def identity_basis(record: ProviderIdentityRecord) -> ProviderIdentityBasis:
    """Select the strongest accepted identity without fuzzy inference."""

    inaturalist_id = _positive_integer_text(record.inaturalist_observation_id)
    if inaturalist_id is not None:
        return _basis("provider_identity", 1, "inaturalist", (inaturalist_id,))

    provider_observation_id = _text(record.provider_observation_id)
    if provider_observation_id is not None:
        return _basis(
            "provider_identity",
            1,
            record.provider_source,
            (provider_observation_id,),
        )

    gbif_key = _text(record.gbif_occurrence_key)
    if gbif_key is not None:
        return _basis("provider_identity", 1, "gbif", (gbif_key,))

    occurrence_id = _text(record.occurrence_id)
    occurrence_namespace = _occurrence_namespace(record)
    if occurrence_id is not None and occurrence_namespace is not None:
        return _basis(
            "scoped_occurrence_id",
            3,
            occurrence_namespace,
            (occurrence_id,),
        )

    stable_reference = normalize_stable_source_reference(record.stable_source_reference)
    if stable_reference is not None:
        return _basis(
            "stable_source_reference",
            4,
            record.provider_source,
            (stable_reference,),
        )

    composite = _strict_composite(record)
    if composite is not None:
        return _basis(
            "strict_composite",
            5,
            _composite_namespace(record),
            composite,
        )

    return _basis(
        "singleton",
        7,
        record.delivery_provider,
        (record.source_record_sha256,),
    )


def canonical_observation_id(basis: ProviderIdentityBasis) -> str:
    """Build a versioned canonical observation ID from one accepted basis."""

    digest = _digest(
        {
            "normalization_version": IDENTITY_NORMALIZATION_VERSION,
            "method": basis.method,
            "namespace": basis.namespace,
            "normalized_values": list(basis.normalized_values),
        }
    )
    return f"baseline-observation:v1:sha256:{digest}"


def provider_relationship_id(record: ProviderIdentityRecord) -> str:
    """Build an ID for one immutable provider relationship, not one map cell."""

    digest = _digest(
        {
            "normalization_version": IDENTITY_NORMALIZATION_VERSION,
            "record_id": record.record_id,
            "provider_source": record.provider_source,
            "delivery_provider": record.delivery_provider,
            "source_record_sha256": record.source_record_sha256,
        }
    )
    return f"provider-relationship:v1:sha256:{digest}"


def duplicate_group_id(canonical_ids: list[str] | tuple[str, ...]) -> str:
    """Build an exact duplicate group over sorted canonical member IDs."""

    members = _canonical_members(canonical_ids)
    return f"duplicate-group:v1:sha256:{_digest({'members': members})}"


def unresolved_duplicate_group_id(
    canonical_ids: list[str] | tuple[str, ...], *, reason_code: str
) -> str:
    """Build an unresolved group without merging any canonical member."""

    members = _canonical_members(canonical_ids)
    reason = _required_text(reason_code, "reason_code")
    digest = _digest(
        {
            "normalization_version": IDENTITY_NORMALIZATION_VERSION,
            "members": members,
            "reason_code": reason,
        }
    )
    return f"unresolved-provider-group:v1:sha256:{digest}"


def identity_contradictions(
    left: ProviderIdentityRecord, right: ProviderIdentityRecord
) -> tuple[str, ...]:
    """Return authoritative contradictions that block automatic linkage."""

    contradictions: list[str] = []
    _append_text_contradiction(
        contradictions,
        "accepted_taxon_key",
        left.accepted_taxon_key,
        right.accepted_taxon_key,
    )
    _append_text_contradiction(
        contradictions,
        "observer_id",
        left.observer_id,
        right.observer_id,
    )
    if left.event_date is not None and right.event_date is not None:
        if left.event_date != right.event_date:
            contradictions.append("event_date")
    if left.country_code is not None and right.country_code is not None:
        if left.country_code != right.country_code:
            contradictions.append("country_code")
    if left.latitude is not None and right.latitude is not None:
        if left.latitude != right.latitude:
            contradictions.append("latitude")
    if left.longitude is not None and right.longitude is not None:
        if left.longitude != right.longitude:
            contradictions.append("longitude")
    left_provider_id = _text(left.provider_observation_id)
    right_provider_id = _text(right.provider_observation_id)
    if (
        left.provider_source == right.provider_source
        and left_provider_id is not None
        and right_provider_id is not None
        and left_provider_id != right_provider_id
    ):
        contradictions.append("provider_observation_id")
    return tuple(sorted(set(contradictions)))


def normalize_stable_source_reference(value: str | None) -> str | None:
    """Normalize only URI syntax that cannot change record identity."""

    reference = _text(value)
    if reference is None:
        return None
    parsed = urlsplit(reference)
    if parsed.scheme.casefold() not in {"http", "https"} or not parsed.hostname:
        raise BaselineProviderIdentityError("stable source reference must be an HTTP(S) URL")
    if parsed.username is not None or parsed.password is not None:
        raise BaselineProviderIdentityError("stable source reference must not contain credentials")
    hostname = parsed.hostname.casefold()
    port = parsed.port
    if port is not None and not (
        (parsed.scheme.casefold() == "http" and port == 80)
        or (parsed.scheme.casefold() == "https" and port == 443)
    ):
        hostname = f"{hostname}:{port}"
    normalized = SplitResult(
        parsed.scheme.casefold(),
        hostname,
        parsed.path or "/",
        parsed.query,
        "",
    )
    return urlunsplit(normalized)


def _basis(
    method: IdentityMethod,
    priority: int,
    namespace: str,
    values: tuple[str, ...],
) -> ProviderIdentityBasis:
    normalized_namespace = _required_text(namespace, "identity namespace").casefold()
    normalized_values = tuple(_required_text(value, "identity value") for value in values)
    identity_key = _digest(
        {
            "normalization_version": IDENTITY_NORMALIZATION_VERSION,
            "method": method,
            "namespace": normalized_namespace,
            "normalized_values": list(normalized_values),
        }
    )
    return ProviderIdentityBasis(
        method=method,
        priority=priority,
        namespace=normalized_namespace,
        normalized_values=normalized_values,
        identity_key=identity_key,
    )


def _occurrence_namespace(record: ProviderIdentityRecord) -> str | None:
    explicit = _text(record.occurrence_namespace)
    if explicit is not None:
        return explicit.casefold()
    dataset = _text(record.source_dataset_key)
    if dataset is not None:
        return f"{record.provider_source}:dataset:{dataset.casefold()}"
    return None


def _composite_namespace(record: ProviderIdentityRecord) -> str:
    dataset = _text(record.source_dataset_key)
    return (
        f"{record.provider_source}:dataset:{dataset.casefold()}"
        if dataset is not None
        else record.provider_source
    )


def _strict_composite(record: ProviderIdentityRecord) -> tuple[str, ...] | None:
    observer = _text(record.observer_id)
    taxon = _text(record.accepted_taxon_key)
    country = _text(record.country_code)
    if (
        observer is None
        or taxon is None
        or record.event_date is None
        or record.latitude is None
        or record.longitude is None
        or country is None
    ):
        return None
    admin1 = _text(record.admin1) or "<unavailable>"
    uncertainty = (
        "<unavailable>"
        if record.coordinate_uncertainty_m is None
        else _number(record.coordinate_uncertainty_m)
    )
    return (
        observer.casefold(),
        taxon,
        record.event_date.isoformat(),
        _number(record.latitude),
        _number(record.longitude),
        uncertainty,
        country,
        admin1.casefold(),
    )


def _canonical_members(values: list[str] | tuple[str, ...]) -> list[str]:
    members = sorted(set(values))
    if len(members) < 2:
        raise BaselineProviderIdentityError("duplicate group requires at least two members")
    if any(not value.startswith("baseline-observation:v1:sha256:") for value in members):
        raise BaselineProviderIdentityError("duplicate group member identity is invalid")
    return members


def _append_text_contradiction(
    contradictions: list[str], label: str, left: str | None, right: str | None
) -> None:
    left_value = _text(left)
    right_value = _text(right)
    if left_value is not None and right_value is not None:
        if left_value.casefold() != right_value.casefold():
            contradictions.append(label)


def _positive_integer_text(value: str | None) -> str | None:
    text = _text(value)
    if text is None:
        return None
    if not text.isdigit() or int(text) <= 0:
        raise BaselineProviderIdentityError("iNaturalist observation ID is invalid")
    return str(int(text))


def _required_text(value: str, label: str) -> str:
    normalized = _text(value)
    if normalized is None:
        raise BaselineProviderIdentityError(f"{label} must be non-empty")
    return normalized


def _text(value: str | None) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    return normalized or None


def _optional_coordinate(value: float | None, minimum: float, maximum: float, label: str) -> None:
    if value is None:
        return
    if isinstance(value, bool) or not isinstance(value, int | float):
        raise BaselineProviderIdentityError(f"{label} must be numeric")
    if not math.isfinite(value) or not minimum <= value <= maximum:
        raise BaselineProviderIdentityError(f"{label} is outside its geographic domain")


def _number(value: float) -> str:
    return format(float(value), ".8f")


def _digest(value: object) -> str:
    content = json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(content).hexdigest()


__all__ = [
    "BaselineProviderIdentityError",
    "IDENTITY_NORMALIZATION_VERSION",
    "INATURALIST_GBIF_DATASET_KEY",
    "PROVIDER_UNION_POLICY_VERSION",
    "ProviderIdentityBasis",
    "ProviderIdentityRecord",
    "canonical_observation_id",
    "classify_provider_source",
    "duplicate_group_id",
    "identity_basis",
    "identity_contradictions",
    "normalize_stable_source_reference",
    "provider_relationship_id",
    "unresolved_duplicate_group_id",
]
