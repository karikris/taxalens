"""Product-native facade over immutable, checksummed TaxaLens replay artifacts."""

from __future__ import annotations

import hashlib
import json
import os
import re
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from types import MappingProxyType
from typing import TypeAlias, TypeVar

from taxalens.product.contracts import (
    ArtifactProvenance,
    ArtifactView,
    EvidenceExport,
    ExportFile,
    FrozenJson,
    LineageView,
    PipelineView,
    ProductProvenance,
    ProductResult,
    freeze_json,
    thaw_json,
)

DEFAULT_MANIFEST = "demo/manifests/demo_manifest.example.json"
PRODUCT_PROVENANCE_SCHEMA = "taxalens-product-provenance:v1"
EVIDENCE_EXPORT_SCHEMA = "taxalens-evidence-export:v1"

_SHA_PATTERN = re.compile(r"[0-9a-f]{40}\Z")
_DIGEST_PATTERN = re.compile(r"[0-9a-f]{64}\Z")

T = TypeVar("T")


class FacadeError(ValueError):
    """Raised when a manifest or artifact violates the product boundary."""

    def __init__(
        self,
        message: str,
        *,
        artifact: ArtifactProvenance | None = None,
    ) -> None:
        super().__init__(message)
        self.artifact = artifact


@dataclass(frozen=True, slots=True)
class _ArtifactSpec:
    name: str
    path: str
    sha256: str


@dataclass(frozen=True, slots=True)
class _LoadedArtifact:
    payload: object
    provenance: ArtifactProvenance


def _sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _canonical_json(value: object) -> bytes:
    return (
        json.dumps(
            value,
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
        ).encode("utf-8")
        + b"\n"
    )


def _schema_versions(value: object) -> tuple[str, ...]:
    found: set[str] = set()

    def visit(item: object) -> None:
        if isinstance(item, dict):
            schema = item.get("schema_version")
            if isinstance(schema, str) and schema.strip():
                found.add(schema.strip())
            for nested in item.values():
                visit(nested)
        elif isinstance(item, list):
            for nested in item:
                visit(nested)

    visit(value)
    return tuple(sorted(found))


def _rows(value: object) -> tuple[Mapping[str, object], ...]:
    if isinstance(value, list):
        return tuple(item for item in value if isinstance(item, dict))
    if not isinstance(value, dict):
        return ()
    for key in ("records", "rows", "data"):
        nested = value.get(key)
        if isinstance(nested, list):
            return tuple(item for item in nested if isinstance(item, dict))
    return (value,)


def _string(value: object) -> str | None:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _record_id(row: Mapping[str, object], keys: tuple[str, ...]) -> str | None:
    for key in keys:
        value = _string(row.get(key))
        if value is not None:
            return value
    return None


def _frozen_mapping(row: Mapping[str, object]) -> Mapping[str, FrozenJson]:
    frozen = freeze_json(dict(row))
    if not isinstance(frozen, Mapping):
        raise TypeError("record did not freeze to a mapping")
    return frozen


class EvidenceFacade:
    """Load TaxaLens contracts without importing or reimplementing BioMiner policy."""

    def __init__(self, manifest: str | Path = DEFAULT_MANIFEST) -> None:
        manifest_path = Path(manifest)
        self._root = self._find_root(manifest_path)
        self._manifest_path = self._resolve_manifest(manifest_path)
        manifest_bytes = self._manifest_path.read_bytes()
        self._manifest_sha256 = _sha256_bytes(manifest_bytes)
        try:
            payload = json.loads(manifest_bytes)
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise FacadeError(f"demo manifest is not valid UTF-8 JSON: {error}") from error
        if not isinstance(payload, dict):
            raise FacadeError("demo manifest must be a JSON object")
        self._manifest = MappingProxyType(dict(payload))
        self._bundle_id = self._require_string(payload, "demo_id")
        self._taxalens_sha = self._require_sha(payload, "taxalens_commit")
        self._biominer_sha = self._require_sha(payload, "source_biominer_commit")
        self._artifacts = self._artifact_specs(payload.get("artifacts"))

    @staticmethod
    def _find_root(manifest: Path) -> Path:
        seeds = (Path.cwd(), manifest if manifest.is_dir() else manifest.parent)
        checked: set[Path] = set()
        for seed in seeds:
            for candidate in (seed, *seed.parents):
                resolved = candidate.resolve()
                if resolved in checked:
                    continue
                checked.add(resolved)
                if (resolved / "pyproject.toml").is_file() and (
                    resolved / "provenance" / "biominer_migration_manifest.yaml"
                ).is_file():
                    return resolved
        raise FacadeError("TaxaLens repository root could not be located")

    def _resolve_manifest(self, manifest: Path) -> Path:
        candidate = manifest if manifest.is_absolute() else self._root / manifest
        resolved = candidate.resolve()
        if not resolved.is_relative_to(self._root):
            raise FacadeError("demo manifest escapes the TaxaLens repository root")
        if not resolved.is_file():
            raise FacadeError(f"demo manifest is missing: {resolved}")
        return resolved

    @staticmethod
    def _require_string(payload: Mapping[str, object], key: str) -> str:
        value = _string(payload.get(key))
        if value is None:
            raise FacadeError(f"demo manifest requires non-empty {key}")
        return value

    @classmethod
    def _require_sha(cls, payload: Mapping[str, object], key: str) -> str:
        value = cls._require_string(payload, key)
        if not _SHA_PATTERN.fullmatch(value):
            raise FacadeError(f"demo manifest {key} must be a full Git SHA")
        return value

    @staticmethod
    def _artifact_specs(value: object) -> Mapping[str, _ArtifactSpec]:
        if not isinstance(value, list):
            raise FacadeError("demo manifest artifacts must be a list")
        specs: dict[str, _ArtifactSpec] = {}
        for index, row in enumerate(value):
            if not isinstance(row, dict):
                raise FacadeError(f"artifact {index} must be an object")
            name = _string(row.get("name"))
            path = _string(row.get("path"))
            sha256 = _string(row.get("sha256"))
            if name is None or path is None or sha256 is None:
                raise FacadeError(f"artifact {index} requires name, path, and sha256")
            if name in specs:
                raise FacadeError(f"duplicate artifact name: {name}")
            if not _DIGEST_PATTERN.fullmatch(sha256):
                raise FacadeError(f"artifact {name} has an invalid SHA-256")
            pure = PurePosixPath(path)
            if pure.is_absolute() or ".." in pure.parts:
                raise FacadeError(f"artifact {name} has an unsafe path")
            specs[name] = _ArtifactSpec(name=name, path=pure.as_posix(), sha256=sha256)
        return MappingProxyType(specs)

    def _artifact(self, name: str) -> _LoadedArtifact | None:
        spec = self._artifacts.get(name)
        if spec is None:
            return None
        path = (self._root / spec.path).resolve()
        if not path.is_relative_to(self._root):
            raise FacadeError(f"artifact {name} escapes the repository root")
        if not path.is_file():
            raise FacadeError(f"artifact {name} is missing: {spec.path}")
        content = path.read_bytes()
        actual = _sha256_bytes(content)
        provenance = ArtifactProvenance(
            name=name,
            path=spec.path,
            sha256=actual,
            schema_versions=(),
            checksum_verified=actual == spec.sha256,
        )
        if actual != spec.sha256:
            raise FacadeError(
                f"artifact {name} checksum does not match the manifest",
                artifact=provenance,
            )
        try:
            payload = json.loads(content)
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise FacadeError(
                f"artifact {name} is not valid UTF-8 JSON: {error}",
                artifact=provenance,
            ) from error
        return _LoadedArtifact(
            payload=payload,
            provenance=ArtifactProvenance(
                name=name,
                path=spec.path,
                sha256=actual,
                schema_versions=_schema_versions(payload),
                checksum_verified=True,
            ),
        )

    def _provenance(
        self,
        operation: str,
        requested: tuple[str, ...],
        artifacts: tuple[ArtifactProvenance, ...] = (),
    ) -> ProductProvenance:
        rights = self._manifest.get("rights_summary")
        rights_status = (
            _string(rights.get("status")) if isinstance(rights, dict) else None
        ) or "unavailable"
        replay_mode = _string(self._manifest.get("openai_replay_mode")) or "unavailable"
        return ProductProvenance(
            schema_version=PRODUCT_PROVENANCE_SCHEMA,
            operation=operation,
            bundle_id=self._bundle_id,
            manifest_path=self._manifest_path.relative_to(self._root).as_posix(),
            manifest_sha256=self._manifest_sha256,
            bundle_taxalens_sha=self._taxalens_sha,
            bundle_biominer_sha=self._biominer_sha,
            requested_artifacts=requested,
            artifacts=tuple(sorted(set(artifacts), key=lambda item: item.name)),
            rights_status=rights_status,
            replay_mode=replay_mode,
        )

    def _available(
        self,
        operation: str,
        requested: tuple[str, ...],
        value: T,
        artifacts: tuple[ArtifactProvenance, ...],
        source: Mapping[str, object] | None = None,
    ) -> ProductResult[T]:
        explicit_review = source.get("human_review_required") if source else None
        explicit_claim = source.get("scientific_claim_allowed") if source else None
        return ProductResult(
            status="available",
            value=value,
            reason=None,
            provenance=self._provenance(operation, requested, artifacts),
            human_review_required=explicit_review is not False,
            scientific_claim_allowed=explicit_claim is True,
        )

    def _unavailable(
        self,
        operation: str,
        requested: tuple[str, ...],
        reason: str,
        artifacts: tuple[ArtifactProvenance, ...] = (),
    ) -> ProductResult[T]:
        return ProductResult(
            status="unavailable",
            value=None,
            reason=reason,
            provenance=self._provenance(operation, requested, artifacts),
            human_review_required=True,
            scientific_claim_allowed=False,
        )

    def _invalid(
        self,
        operation: str,
        requested: tuple[str, ...],
        error: FacadeError,
    ) -> ProductResult[T]:
        artifacts = (error.artifact,) if error.artifact is not None else ()
        return ProductResult(
            status="invalid",
            value=None,
            reason=str(error),
            provenance=self._provenance(operation, requested, artifacts),
            human_review_required=True,
            scientific_claim_allowed=False,
        )

    def _load_view(
        self,
        *,
        artifact_name: str,
        operation: str,
        kind: str,
        id_keys: tuple[str, ...],
        record_id: str | None,
    ) -> ProductResult[ArtifactView]:
        requested = (artifact_name,)
        try:
            artifact = self._artifact(artifact_name)
        except FacadeError as error:
            return self._invalid(operation, requested, error)
        if artifact is None:
            return self._unavailable(
                operation,
                requested,
                f"{artifact_name} is not present in bundle {self._bundle_id}",
            )
        rows = _rows(artifact.payload)
        if not rows:
            return self._unavailable(
                operation,
                requested,
                f"{artifact_name} contains no product records",
                (artifact.provenance,),
            )
        row: Mapping[str, object] | None = None
        if record_id is None and len(rows) == 1:
            row = rows[0]
        elif record_id is not None:
            row = next(
                (item for item in rows if _record_id(item, id_keys) == record_id),
                None,
            )
        if row is None:
            label = record_id if record_id is not None else "an unambiguous record"
            return self._unavailable(
                operation,
                requested,
                f"{artifact_name} does not contain {label}",
                (artifact.provenance,),
            )
        resolved_id = _record_id(row, id_keys) or f"{artifact_name}:singleton"
        schema_version = _string(row.get("schema_version")) or "unavailable"
        view = ArtifactView(
            kind=kind,
            record_id=resolved_id,
            schema_version=schema_version,
            data=_frozen_mapping(row),
        )
        return self._available(
            operation,
            requested,
            view,
            (artifact.provenance,),
            row,
        )

    def load_run(self, run_id: str | None = None) -> ProductResult[ArtifactView]:
        return self._load_view(
            artifact_name="run_summary",
            operation="load_run",
            kind="run",
            id_keys=("run_id",),
            record_id=run_id,
        )

    def load_pipeline(self, run_id: str | None = None) -> ProductResult[PipelineView]:
        operation = "load_pipeline"
        requested = ("run_summary", "stage_metrics")
        try:
            run_artifact = self._artifact("run_summary")
            stage_artifact = self._artifact("stage_metrics")
        except FacadeError as error:
            return self._invalid(operation, requested, error)
        artifacts = tuple(
            item.provenance for item in (run_artifact, stage_artifact) if item is not None
        )
        if run_artifact is None or stage_artifact is None:
            return self._unavailable(
                operation,
                requested,
                "run_summary and stage_metrics are both required for a pipeline",
                artifacts,
            )
        run_rows = _rows(run_artifact.payload)
        selected_run = next(
            (row for row in run_rows if run_id is None or _record_id(row, ("run_id",)) == run_id),
            None,
        )
        if selected_run is None:
            return self._unavailable(
                operation,
                requested,
                f"run_summary does not contain run {run_id!r}",
                artifacts,
            )
        resolved_run_id = _record_id(selected_run, ("run_id",))
        if resolved_run_id is None:
            return self._unavailable(
                operation,
                requested,
                "run_summary has no run_id",
                artifacts,
            )
        stages = tuple(
            ArtifactView(
                kind="stage",
                record_id=_record_id(row, ("stage_id", "stage_name")) or f"stage:{index}",
                schema_version=_string(row.get("schema_version")) or "unavailable",
                data=_frozen_mapping(row),
            )
            for index, row in enumerate(_rows(stage_artifact.payload))
        )
        return self._available(
            operation,
            requested,
            PipelineView(run_id=resolved_run_id, stages=stages),
            artifacts,
            selected_run,
        )

    def load_stage(self, stage_id: str) -> ProductResult[ArtifactView]:
        return self._load_view(
            artifact_name="stage_metrics",
            operation="load_stage",
            kind="stage",
            id_keys=("stage_id", "stage_name"),
            record_id=stage_id,
        )

    def load_evidence_record(self, evidence_record_id: str) -> ProductResult[ArtifactView]:
        return self._load_view(
            artifact_name="evidence_records",
            operation="load_evidence_record",
            kind="evidence_record",
            id_keys=("evidence_record_id",),
            record_id=evidence_record_id,
        )

    def load_candidate_comparison(
        self,
        evidence_record_id: str,
    ) -> ProductResult[ArtifactView]:
        return self._load_view(
            artifact_name="candidate_comparisons",
            operation="load_candidate_comparison",
            kind="candidate_comparison",
            id_keys=("evidence_record_id", "record_id", "media_id"),
            record_id=evidence_record_id,
        )

    def load_reference_evidence(
        self,
        evidence_record_id: str,
    ) -> ProductResult[ArtifactView]:
        return self._load_view(
            artifact_name="reference_evidence",
            operation="load_reference_evidence",
            kind="reference_evidence",
            id_keys=("evidence_record_id", "record_id", "media_id"),
            record_id=evidence_record_id,
        )

    def load_geography(self, evidence_record_id: str) -> ProductResult[ArtifactView]:
        return self._load_view(
            artifact_name="geography",
            operation="load_geography",
            kind="geography",
            id_keys=("evidence_record_id", "record_id", "media_id"),
            record_id=evidence_record_id,
        )

    def load_comment_revision(self, revision_id: str) -> ProductResult[ArtifactView]:
        return self._load_view(
            artifact_name="comment_revisions",
            operation="load_comment_revision",
            kind="comment_revision",
            id_keys=("candidate_revision_id", "revision_id"),
            record_id=revision_id,
        )

    def load_dashboard_summary(
        self,
        run_id: str | None = None,
    ) -> ProductResult[ArtifactView]:
        return self._load_view(
            artifact_name="dashboard_summary",
            operation="load_dashboard_summary",
            kind="dashboard_summary",
            id_keys=("run_id",),
            record_id=run_id,
        )

    def load_evaluation_summary(
        self,
        run_id: str | None = None,
    ) -> ProductResult[ArtifactView]:
        return self._load_view(
            artifact_name="evaluation_summary",
            operation="load_evaluation_summary",
            kind="evaluation_summary",
            id_keys=("run_id",),
            record_id=run_id,
        )

    def load_lineage(self, evidence_record_id: str) -> ProductResult[LineageView]:
        dedicated = self._load_view(
            artifact_name="lineage",
            operation="load_lineage",
            kind="lineage",
            id_keys=("evidence_record_id", "record_id"),
            record_id=evidence_record_id,
        )
        if dedicated.status != "unavailable" or "is not present" not in (dedicated.reason or ""):
            if dedicated.available and dedicated.value is not None:
                raw_events = dedicated.value.data.get("events")
                events = raw_events if isinstance(raw_events, tuple) else ()
                mapped = tuple(item for item in events if isinstance(item, Mapping))
                return ProductResult(
                    status="available",
                    value=LineageView(evidence_record_id, mapped),
                    reason=None,
                    provenance=dedicated.provenance,
                    human_review_required=dedicated.human_review_required,
                    scientific_claim_allowed=dedicated.scientific_claim_allowed,
                )
            return ProductResult(
                status=dedicated.status,
                value=None,
                reason=dedicated.reason,
                provenance=dedicated.provenance,
                human_review_required=True,
                scientific_claim_allowed=False,
            )
        record = self.load_evidence_record(evidence_record_id)
        if not record.available or record.value is None:
            return ProductResult(
                status=record.status,
                value=None,
                reason=record.reason,
                provenance=record.provenance,
                human_review_required=True,
                scientific_claim_allowed=False,
            )
        raw_ledger = record.value.data.get("ledger")
        if not isinstance(raw_ledger, tuple):
            return self._unavailable(
                "load_lineage",
                ("lineage", "evidence_records"),
                "the evidence record has no artifact-provided ledger",
                record.provenance.artifacts,
            )
        events = tuple(item for item in raw_ledger if isinstance(item, Mapping))
        return self._available(
            "load_lineage",
            ("lineage", "evidence_records"),
            LineageView(evidence_record_id=evidence_record_id, events=events),
            record.provenance.artifacts,
            thaw_json(record.value.data),
        )

    @staticmethod
    def _describe_related(result: ProductResult[object]) -> dict[str, object]:
        value: object = None
        if isinstance(result.value, ArtifactView):
            value = thaw_json(result.value.data)
        elif isinstance(result.value, LineageView):
            value = [thaw_json(event) for event in result.value.events]
        return {
            "status": result.status,
            "reason": result.reason,
            "human_review_required": result.human_review_required,
            "scientific_claim_allowed": result.scientific_claim_allowed,
            "value": value,
        }

    def export_evidence(
        self,
        evidence_record_id: str,
        destination: str | Path | None = None,
    ) -> ProductResult[EvidenceExport]:
        operation = "export_evidence"
        record = self.load_evidence_record(evidence_record_id)
        if not record.available or record.value is None:
            return ProductResult(
                status=record.status,
                value=None,
                reason=record.reason,
                provenance=self._provenance(
                    operation,
                    ("evidence_records",),
                    record.provenance.artifacts,
                ),
                human_review_required=True,
                scientific_claim_allowed=False,
            )
        related: dict[str, ProductResult[object]] = {
            "candidate_comparison": self.load_candidate_comparison(evidence_record_id),
            "geography": self.load_geography(evidence_record_id),
            "lineage": self.load_lineage(evidence_record_id),
            "reference_evidence": self.load_reference_evidence(evidence_record_id),
        }
        artifacts = {
            artifact
            for result in (record, *related.values())
            for artifact in result.provenance.artifacts
        }
        provenance = self._provenance(
            operation,
            (
                "evidence_records",
                "candidate_comparisons",
                "geography",
                "lineage",
                "reference_evidence",
            ),
            tuple(artifacts),
        )
        evidence_payload = {
            "schema_version": EVIDENCE_EXPORT_SCHEMA,
            "evidence_record_id": evidence_record_id,
            "record": thaw_json(record.value.data),
            "related": {
                name: self._describe_related(result) for name, result in sorted(related.items())
            },
            "provenance": self._provenance_payload(provenance),
        }
        evidence_bytes = _canonical_json(evidence_payload)
        evidence_name = "evidence.json"
        evidence_digest = _sha256_bytes(evidence_bytes)
        manifest_payload = {
            "schema_version": "taxalens-evidence-export-manifest:v1",
            "bundle_id": self._bundle_id,
            "evidence_record_id": evidence_record_id,
            "files": {evidence_name: evidence_digest},
        }
        manifest_bytes = _canonical_json(manifest_payload)
        files = (
            ExportFile(evidence_name, evidence_digest, evidence_bytes),
            ExportFile("manifest.json", _sha256_bytes(manifest_bytes), manifest_bytes),
        )
        destination_value: str | None = None
        if destination is not None:
            root = Path(destination)
            try:
                root.mkdir(parents=True, exist_ok=True)
                for file in files:
                    temporary = root / f".{file.name}.tmp"
                    temporary.write_bytes(file.content)
                    os.replace(temporary, root / file.name)
            except OSError as error:
                return ProductResult(
                    status="unavailable",
                    value=None,
                    reason=f"evidence export failed: {error}",
                    provenance=provenance,
                    human_review_required=True,
                    scientific_claim_allowed=False,
                )
            destination_value = str(root)
        export = EvidenceExport(
            evidence_record_id=evidence_record_id,
            bundle_sha256=_sha256_bytes(manifest_bytes),
            files=files,
            destination=destination_value,
        )
        return ProductResult(
            status="available",
            value=export,
            reason=None,
            provenance=provenance,
            human_review_required=record.human_review_required,
            scientific_claim_allowed=record.scientific_claim_allowed,
        )

    @staticmethod
    def _provenance_payload(provenance: ProductProvenance) -> dict[str, object]:
        return {
            "schema_version": provenance.schema_version,
            "operation": provenance.operation,
            "bundle_id": provenance.bundle_id,
            "manifest_path": provenance.manifest_path,
            "manifest_sha256": provenance.manifest_sha256,
            "bundle_taxalens_sha": provenance.bundle_taxalens_sha,
            "bundle_biominer_sha": provenance.bundle_biominer_sha,
            "requested_artifacts": list(provenance.requested_artifacts),
            "artifacts": [
                {
                    "name": artifact.name,
                    "path": artifact.path,
                    "sha256": artifact.sha256,
                    "schema_versions": list(artifact.schema_versions),
                    "checksum_verified": artifact.checksum_verified,
                }
                for artifact in provenance.artifacts
            ],
            "rights_status": provenance.rights_status,
            "replay_mode": provenance.replay_mode,
        }


FacadeSource: TypeAlias = EvidenceFacade | str | Path


def _facade(source: FacadeSource) -> EvidenceFacade:
    return source if isinstance(source, EvidenceFacade) else EvidenceFacade(source)


def load_run(
    source: FacadeSource = DEFAULT_MANIFEST,
    run_id: str | None = None,
) -> ProductResult[ArtifactView]:
    return _facade(source).load_run(run_id)


def load_pipeline(
    source: FacadeSource = DEFAULT_MANIFEST,
    run_id: str | None = None,
) -> ProductResult[PipelineView]:
    return _facade(source).load_pipeline(run_id)


def load_stage(source: FacadeSource, stage_id: str) -> ProductResult[ArtifactView]:
    return _facade(source).load_stage(stage_id)


def load_evidence_record(
    source: FacadeSource,
    evidence_record_id: str,
) -> ProductResult[ArtifactView]:
    return _facade(source).load_evidence_record(evidence_record_id)


def load_candidate_comparison(
    source: FacadeSource,
    evidence_record_id: str,
) -> ProductResult[ArtifactView]:
    return _facade(source).load_candidate_comparison(evidence_record_id)


def load_reference_evidence(
    source: FacadeSource,
    evidence_record_id: str,
) -> ProductResult[ArtifactView]:
    return _facade(source).load_reference_evidence(evidence_record_id)


def load_geography(
    source: FacadeSource,
    evidence_record_id: str,
) -> ProductResult[ArtifactView]:
    return _facade(source).load_geography(evidence_record_id)


def load_comment_revision(
    source: FacadeSource,
    revision_id: str,
) -> ProductResult[ArtifactView]:
    return _facade(source).load_comment_revision(revision_id)


def load_dashboard_summary(
    source: FacadeSource = DEFAULT_MANIFEST,
    run_id: str | None = None,
) -> ProductResult[ArtifactView]:
    return _facade(source).load_dashboard_summary(run_id)


def load_evaluation_summary(
    source: FacadeSource = DEFAULT_MANIFEST,
    run_id: str | None = None,
) -> ProductResult[ArtifactView]:
    return _facade(source).load_evaluation_summary(run_id)


def load_lineage(
    source: FacadeSource,
    evidence_record_id: str,
) -> ProductResult[LineageView]:
    return _facade(source).load_lineage(evidence_record_id)


def export_evidence(
    source: FacadeSource,
    evidence_record_id: str,
    destination: str | Path | None = None,
) -> ProductResult[EvidenceExport]:
    return _facade(source).export_evidence(evidence_record_id, destination)


__all__ = [
    "DEFAULT_MANIFEST",
    "EVIDENCE_EXPORT_SCHEMA",
    "PRODUCT_PROVENANCE_SCHEMA",
    "EvidenceFacade",
    "FacadeError",
    "export_evidence",
    "load_candidate_comparison",
    "load_comment_revision",
    "load_dashboard_summary",
    "load_evaluation_summary",
    "load_evidence_record",
    "load_geography",
    "load_lineage",
    "load_pipeline",
    "load_reference_evidence",
    "load_run",
    "load_stage",
]
