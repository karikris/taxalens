"""Stable product contracts returned by the TaxaLens evidence facade."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from types import MappingProxyType
from typing import Generic, Literal, TypeAlias, TypeVar

JsonScalar: TypeAlias = str | int | float | bool | None
FrozenJson: TypeAlias = JsonScalar | tuple["FrozenJson", ...] | Mapping[str, "FrozenJson"]
ResultStatus: TypeAlias = Literal["available", "unavailable", "invalid"]

T = TypeVar("T")


def freeze_json(value: object) -> FrozenJson:
    """Return an immutable representation of JSON-compatible data."""

    if value is None or isinstance(value, str | int | float | bool):
        return value
    if isinstance(value, list | tuple):
        return tuple(freeze_json(item) for item in value)
    if isinstance(value, dict):
        return MappingProxyType({str(key): freeze_json(item) for key, item in value.items()})
    raise TypeError(f"value is not JSON-compatible: {type(value).__name__}")


def thaw_json(value: FrozenJson) -> object:
    """Return ordinary JSON-compatible containers from an immutable value."""

    if isinstance(value, Mapping):
        return {key: thaw_json(item) for key, item in value.items()}
    if isinstance(value, tuple):
        return [thaw_json(item) for item in value]
    return value


@dataclass(frozen=True, slots=True)
class ArtifactProvenance:
    """One verified artifact used to produce a facade result."""

    name: str
    path: str
    sha256: str
    schema_versions: tuple[str, ...]
    checksum_verified: bool


@dataclass(frozen=True, slots=True)
class ProductProvenance:
    """Bundle and operation identity attached to every facade response."""

    schema_version: str
    operation: str
    bundle_id: str
    manifest_path: str
    manifest_sha256: str
    bundle_taxalens_sha: str
    bundle_biominer_sha: str
    requested_artifacts: tuple[str, ...]
    artifacts: tuple[ArtifactProvenance, ...]
    rights_status: str
    replay_mode: str


@dataclass(frozen=True, slots=True)
class ProductResult(Generic[T]):
    """Available or explicit unavailable/invalid product evidence."""

    status: ResultStatus
    value: T | None
    reason: str | None
    provenance: ProductProvenance
    human_review_required: bool
    scientific_claim_allowed: bool

    @property
    def available(self) -> bool:
        return self.status == "available"


@dataclass(frozen=True, slots=True)
class ArtifactView:
    """Immutable product projection of one artifact record."""

    kind: str
    record_id: str
    schema_version: str
    data: Mapping[str, FrozenJson]


@dataclass(frozen=True, slots=True)
class PipelineView:
    """Ordered pipeline stages for a single replay run."""

    run_id: str
    stages: tuple[ArtifactView, ...]


@dataclass(frozen=True, slots=True)
class LineageView:
    """Artifact-provided lineage events for one evidence record."""

    evidence_record_id: str
    events: tuple[Mapping[str, FrozenJson], ...]


@dataclass(frozen=True, slots=True)
class ExportFile:
    """One deterministic file in an evidence export."""

    name: str
    sha256: str
    content: bytes


@dataclass(frozen=True, slots=True)
class EvidenceExport:
    """Deterministic product-level export for one evidence record."""

    evidence_record_id: str
    bundle_sha256: str
    files: tuple[ExportFile, ...]
    destination: str | None


__all__ = [
    "ArtifactProvenance",
    "ArtifactView",
    "EvidenceExport",
    "ExportFile",
    "FrozenJson",
    "LineageView",
    "PipelineView",
    "ProductProvenance",
    "ProductResult",
    "freeze_json",
    "thaw_json",
]
