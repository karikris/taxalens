"""Versioned, artifact-first contract for the TaxaLens local judge bundle."""

from __future__ import annotations

import hashlib
import json
import re
from collections.abc import Mapping
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path, PurePosixPath

from taxalens.product.contracts import FrozenJson, freeze_json
from taxalens.product.geographic_contracts import (
    BASELINE_OCCURRENCE_UNION_SCHEMA_VERSION,
    COUNTRY_HIERARCHY_SCHEMA_VERSION,
    GEOGRAPHIC_IMPACT_MANIFEST_SCHEMA_VERSION,
    CountryHierarchyDocument,
    GeographicImpactArtifactEntry,
    GeographicImpactManifestDocument,
    GeographicSchemaError,
)

JUDGE_BUNDLE_V1_SCHEMA_VERSION = "taxalens-judge-bundle:v1.0.0"
JUDGE_BUNDLE_V2_SCHEMA_VERSION = "taxalens-judge-bundle:v2.0.0"
JUDGE_BUNDLE_SCHEMA_VERSION = JUDGE_BUNDLE_V2_SCHEMA_VERSION
JUDGE_BUNDLE_V1_SECTION_NAMES = (
    "run_summary",
    "pipeline_stages",
    "stage_metrics",
    "query_definitions",
    "logical_associations",
    "flickr_candidate_summaries",
    "duplicate_summaries",
    "geographic_clusters",
    "candidate_sets",
    "reference_readiness",
    "reference_shortfalls",
    "biological_negatives",
    "visual_domain_negatives",
    "yoloe_evidence",
    "full_frame_visual_input_metadata",
    "target_aware_score_metadata",
    "selective_decision_metadata",
    "comments",
    "candidate_revisions",
    "evaluation_summaries",
    "verification_campaigns",
    "verification_items",
    "verification_media",
    "verification_decisions",
    "verification_quality",
)
JUDGE_BUNDLE_GEOGRAPHIC_SECTION_NAMES = (
    "baseline_geographic_spread",
    "baseline_provider_union",
    "flickr_geography",
    "geographic_impact_cells",
    "geographic_impact_summary",
    "country_hierarchy",
)
JUDGE_BUNDLE_V2_SECTION_NAMES = (
    *JUDGE_BUNDLE_V1_SECTION_NAMES,
    *JUDGE_BUNDLE_GEOGRAPHIC_SECTION_NAMES,
)
# Current validator contract. V1 names remain exported for migration.
JUDGE_BUNDLE_SECTION_NAMES = JUDGE_BUNDLE_V2_SECTION_NAMES
JUDGE_SCREEN_NAMES = (
    "research_mission",
    "evidence_observatory",
    "evidence_lens",
    "butterfly_dashboard",
)

_ARTIFACT_ROLES_V1 = frozenset(
    (*JUDGE_BUNDLE_V1_SECTION_NAMES, "rights", "attribution", "openai_replay_traces", "other")
)
_ARTIFACT_ROLES_V2 = frozenset(
    (
        *JUDGE_BUNDLE_SECTION_NAMES,
        "geographic_impact_manifest",
        "rights",
        "attribution",
        "openai_replay_traces",
        "other",
    )
)
_TOP_LEVEL_FIELDS = frozenset(
    (
        "schema_version",
        "bundle_id",
        "title",
        "created_at",
        "target",
        "source_revisions",
        "artifact_inventory",
        "sections",
        "rights",
        "attribution",
        "openai_replay",
        "expected_ui_counts",
        "checksums",
    )
)
_AVAILABILITY = frozenset(("available", "partial", "unavailable"))
_CANDIDATE_SEMANTICS = frozenset(
    (
        "not_applicable",
        "hypothesis_not_occurrence",
        "candidate_reference_not_verified_support",
        "reviewed_evidence",
        "diagnostic_only",
    )
)
_NON_CLAIMING_SEMANTICS = frozenset(
    (
        "hypothesis_not_occurrence",
        "candidate_reference_not_verified_support",
        "diagnostic_only",
    )
)
_VERIFICATION_STATUSES = frozenset(
    (
        "metadata_only",
        "unreviewed",
        "human_review_pending",
        "human_verified",
        "machine_verified_contract",
        "unavailable",
    )
)
_RIGHTS_STATUSES = frozenset(("rights_verified", "license_checked", "blocked", "fixture_only"))
_SHA_PATTERN = re.compile(r"[0-9a-f]{40}\Z")
_DIGEST_PATTERN = re.compile(r"[0-9a-f]{64}\Z")
_ID_PATTERN = re.compile(r"[A-Za-z0-9][A-Za-z0-9._:-]*\Z")
_PATH_PART_PATTERN = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]*\Z")


class JudgeBundleError(ValueError):
    """Raised when a judge bundle violates its versioned product contract."""


@dataclass(frozen=True, slots=True)
class JudgeBundleValidation:
    """Summary of a successful structural and optional file validation."""

    bundle_id: str
    artifact_count: int
    section_count: int
    unavailable_section_count: int
    replay_trace_count: int
    inventory_sha256: str
    payload_root_sha256: str
    files_verified: bool


@dataclass(frozen=True, slots=True)
class JudgeBundleMigrationReceipt:
    """Evidence that a stored v1 bundle was projected to v2 without rewriting it."""

    source_schema_version: str
    target_schema_version: str
    applied: bool
    stored_files_rewritten: bool
    added_sections: tuple[str, ...]
    preserved_v1_fingerprint_sha256: str


@dataclass(frozen=True, slots=True)
class MigratedJudgeBundle:
    """One validated canonical v2 projection plus its migration receipt."""

    data: dict[str, object]
    validation: JudgeBundleValidation
    receipt: JudgeBundleMigrationReceipt


@dataclass(frozen=True, slots=True)
class LoadedJudgeBundle:
    """Immutable loaded manifest plus its validation result."""

    manifest_path: Path
    data: Mapping[str, FrozenJson]
    validation: JudgeBundleValidation
    source_schema_version: str
    migration_receipt: JudgeBundleMigrationReceipt | None


def canonical_json_bytes(value: object) -> bytes:
    """Return the canonical JSON bytes used by judge-bundle checksum fields."""

    return json.dumps(
        value,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
        allow_nan=False,
    ).encode("utf-8")


def compute_inventory_sha256(inventory: object) -> str:
    """Hash the canonical artifact inventory."""

    return hashlib.sha256(canonical_json_bytes(inventory)).hexdigest()


def compute_payload_root_sha256(inventory: object) -> str:
    """Hash the deterministic path, size, and digest projection of all payloads."""

    rows = _list(inventory, "artifact_inventory")
    projection: list[dict[str, object]] = []
    for index, value in enumerate(rows):
        row = _mapping(value, f"artifact_inventory[{index}]")
        projection.append(
            {
                "path": _string(row.get("path"), f"artifact_inventory[{index}].path"),
                "bytes": _nonnegative_int(row.get("bytes"), f"artifact_inventory[{index}].bytes"),
                "sha256": _digest(row.get("sha256"), f"artifact_inventory[{index}].sha256"),
            }
        )
    projection.sort(key=lambda item: str(item["path"]))
    return hashlib.sha256(canonical_json_bytes({"files": projection})).hexdigest()


def validate_judge_bundle(
    payload: object,
    *,
    bundle_root: str | Path | None = None,
    verify_files: bool = False,
) -> JudgeBundleValidation:
    """Validate the current v2 contract and optionally every artifact payload."""

    return _validate_judge_bundle_version(
        payload,
        schema_version=JUDGE_BUNDLE_V2_SCHEMA_VERSION,
        section_names=JUDGE_BUNDLE_V2_SECTION_NAMES,
        artifact_roles=_ARTIFACT_ROLES_V2,
        bundle_root=bundle_root,
        verify_files=verify_files,
    )


def _validate_judge_bundle_version(
    payload: object,
    *,
    schema_version: str,
    section_names: tuple[str, ...],
    artifact_roles: frozenset[str],
    bundle_root: str | Path | None,
    verify_files: bool,
) -> JudgeBundleValidation:
    """Validate one explicit judge-bundle version without implicit migration."""

    bundle = _mapping(payload, "judge bundle")
    if set(bundle) != _TOP_LEVEL_FIELDS:
        missing = sorted(_TOP_LEVEL_FIELDS - set(bundle))
        unexpected = sorted(set(bundle) - _TOP_LEVEL_FIELDS)
        raise JudgeBundleError(
            f"judge bundle fields must match the contract; "
            f"missing={missing}, unexpected={unexpected}"
        )
    if bundle.get("schema_version") != schema_version:
        raise JudgeBundleError(f"schema_version must be {schema_version!r}")
    bundle_id = _identifier(bundle.get("bundle_id"), "bundle_id")
    _string(bundle.get("title"), "title")
    _timestamp(bundle.get("created_at"), "created_at")
    _validate_target(bundle.get("target"))
    _validate_source_revisions(bundle.get("source_revisions"))

    root = Path(bundle_root).resolve() if bundle_root is not None else None
    if verify_files and root is None:
        raise JudgeBundleError("bundle_root is required when verify_files is true")
    inventory, artifacts = _validate_inventory(
        bundle.get("artifact_inventory"),
        artifact_roles=artifact_roles,
        bundle_root=root,
        verify_files=verify_files,
    )
    sections = _validate_sections(
        bundle.get("sections"),
        artifacts,
        section_names=section_names,
    )
    rights, attribution_required = _validate_rights(bundle.get("rights"), artifacts)
    attribution_count, attribution_complete = _validate_attribution(
        bundle.get("attribution"),
        artifacts,
        attribution_required,
    )
    replay_trace_count = _validate_openai_replay(bundle.get("openai_replay"), artifacts)
    unavailable_count = sum(section["status"] == "unavailable" for section in sections.values())
    _validate_expected_counts(
        bundle.get("expected_ui_counts"),
        sections=sections,
        artifacts=artifacts,
        attribution_count=attribution_count,
        replay_trace_count=replay_trace_count,
        unavailable_count=unavailable_count,
        section_names=section_names,
    )
    if schema_version == JUDGE_BUNDLE_V2_SCHEMA_VERSION:
        _validate_geographic_bundle_evidence(
            bundle,
            sections=sections,
            artifacts=artifacts,
            bundle_root=root,
            verify_files=verify_files,
        )

    if any(section["scientific_claim_allowed"] for section in sections.values()):
        if rights["status"] != "rights_verified":
            raise JudgeBundleError("scientific claims require bundle rights status rights_verified")
        if rights["all_media_rights_verified"] is not True:
            raise JudgeBundleError("scientific claims require all_media_rights_verified=true")
        if not attribution_complete:
            raise JudgeBundleError("scientific claims require complete attribution")

    inventory_sha256 = compute_inventory_sha256(inventory)
    payload_root_sha256 = compute_payload_root_sha256(inventory)
    _validate_checksums(
        bundle.get("checksums"),
        inventory_sha256=inventory_sha256,
        payload_root_sha256=payload_root_sha256,
    )
    return JudgeBundleValidation(
        bundle_id=bundle_id,
        artifact_count=len(inventory),
        section_count=len(sections),
        unavailable_section_count=unavailable_count,
        replay_trace_count=replay_trace_count,
        inventory_sha256=inventory_sha256,
        payload_root_sha256=payload_root_sha256,
        files_verified=verify_files,
    )


def _validate_geographic_bundle_evidence(
    bundle: Mapping[str, object],
    *,
    sections: Mapping[str, Mapping[str, object]],
    artifacts: Mapping[str, Mapping[str, object]],
    bundle_root: Path | None,
    verify_files: bool,
) -> None:
    """Reconcile available v2 geography against its immutable verification manifest."""

    geographic_available = any(
        sections[name].get("status") != "unavailable"
        for name in JUDGE_BUNDLE_GEOGRAPHIC_SECTION_NAMES
    )
    manifest_descriptors = [
        artifact
        for artifact in artifacts.values()
        if artifact.get("role") == "geographic_impact_manifest"
    ]
    if not geographic_available:
        if manifest_descriptors:
            raise JudgeBundleError(
                "geographic impact manifest requires at least one available geographic section"
            )
        return
    if not verify_files or bundle_root is None:
        raise JudgeBundleError("available geographic impact sections require verify_files=true")
    if len(manifest_descriptors) != 1:
        raise JudgeBundleError(
            "available geographic impact sections require exactly one geographic impact manifest"
        )

    descriptor = manifest_descriptors[0]
    _require_auxiliary_json_descriptor(
        descriptor,
        label="geographic impact manifest",
        schema_version=GEOGRAPHIC_IMPACT_MANIFEST_SCHEMA_VERSION,
    )
    manifest_value = _load_strict_json_artifact(
        bundle_root,
        descriptor,
        label="geographic impact manifest",
    )
    try:
        manifest = GeographicImpactManifestDocument.from_mapping(manifest_value)
    except GeographicSchemaError as error:
        raise JudgeBundleError(str(error)) from error

    target = _mapping(bundle.get("target"), "target")
    if manifest.accepted_taxon_key != target.get(
        "accepted_taxon_key"
    ) or manifest.scientific_name != target.get("scientific_name"):
        raise JudgeBundleError("geographic impact manifest target identity mismatch")
    declared_source_commits = {
        (source.repository.lower(), source.commit_sha) for source in manifest.source_commits
    }
    artifact_source_commits = {
        (str(entry.source_repository).lower(), str(entry.source_commit))
        for entry in manifest.artifacts
        if entry.availability == "available"
    }
    if declared_source_commits != artifact_source_commits:
        raise JudgeBundleError(
            "geographic impact manifest source commits do not match available artifacts"
        )

    inventory_by_path = {str(item["path"]): item for item in artifacts.values()}
    manifest_artifacts = {item.logical_name: item for item in manifest.artifacts}
    linked_descriptors: dict[str, Mapping[str, object]] = {}
    for logical_name, entry in manifest_artifacts.items():
        if entry.availability == "unavailable":
            continue
        if entry.path is None:
            raise JudgeBundleError(
                f"geographic impact artifact {logical_name} has no path identity"
            )
        linked = inventory_by_path.get(entry.path)
        if linked is None:
            raise JudgeBundleError(
                f"geographic impact artifact {logical_name} is missing from judge inventory"
            )
        _reconcile_geographic_artifact_descriptor(logical_name, entry, linked)
        linked_descriptors[logical_name] = linked

    _validate_geographic_section_links(
        manifest_artifacts=manifest_artifacts,
        linked_descriptors=linked_descriptors,
        sections=sections,
    )
    _validate_provider_union_provenance(manifest, manifest_artifacts)
    _validate_review_and_release_evidence(manifest, manifest_artifacts)
    _validate_country_hierarchy_artifact(
        manifest,
        manifest_artifacts=manifest_artifacts,
        bundle_root=bundle_root,
    )


def _require_auxiliary_json_descriptor(
    descriptor: Mapping[str, object],
    *,
    label: str,
    schema_version: str,
) -> None:
    if descriptor.get("media_type") != "application/json":
        raise JudgeBundleError(f"{label} must use application/json")
    if descriptor.get("schema_version") != schema_version:
        raise JudgeBundleError(f"{label} has the wrong schema identity")
    if descriptor.get("record_count") != 1:
        raise JudgeBundleError(f"{label} must declare exactly one record")
    if descriptor.get("required") is not True:
        raise JudgeBundleError(f"{label} must be a required artifact")


def _load_strict_json_artifact(
    bundle_root: Path,
    descriptor: Mapping[str, object],
    *,
    label: str,
) -> Mapping[str, object]:
    relative_path = _safe_path(descriptor.get("path"), f"{label}.path")
    candidate = bundle_root.joinpath(*PurePosixPath(relative_path).parts).resolve()
    if not candidate.is_relative_to(bundle_root):
        raise JudgeBundleError(f"{label} path escapes bundle root")
    try:
        value = json.loads(
            candidate.read_bytes(),
            object_pairs_hook=_reject_duplicate_keys,
            parse_constant=_reject_non_json_constant,
        )
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise JudgeBundleError(f"{label} is not strict UTF-8 JSON: {error}") from error
    return _mapping(value, label)


def _reconcile_geographic_artifact_descriptor(
    logical_name: str,
    entry: GeographicImpactArtifactEntry,
    descriptor: Mapping[str, object],
) -> None:
    if descriptor.get("required") is not True:
        raise JudgeBundleError(f"geographic impact artifact {logical_name} must be required")
    expected = {
        "media_type": entry.media_type,
        "schema_version": entry.schema_version,
        "sha256": entry.sha256,
        "bytes": entry.byte_size,
        "record_count": entry.row_count,
        "source_commit": entry.source_commit,
    }
    for field, value in expected.items():
        if descriptor.get(field) != value:
            raise JudgeBundleError(f"geographic impact artifact {logical_name} {field} mismatch")
    if str(descriptor.get("source_repository")).lower() != str(entry.source_repository).lower():
        raise JudgeBundleError(
            f"geographic impact artifact {logical_name} source_repository mismatch"
        )


def _validate_geographic_section_links(
    *,
    manifest_artifacts: Mapping[str, GeographicImpactArtifactEntry],
    linked_descriptors: Mapping[str, Mapping[str, object]],
    sections: Mapping[str, Mapping[str, object]],
) -> None:
    section_by_logical_name = {
        "baseline_geographic_spread": "baseline_geographic_spread",
        "baseline_occurrence_union": "baseline_provider_union",
        "flickr_geography": "flickr_geography",
        "geographic_impact_cells": "geographic_impact_cells",
        "geographic_impact_summary": "geographic_impact_summary",
        "country_hierarchy": "country_hierarchy",
    }
    for logical_name, section_name in section_by_logical_name.items():
        entry = manifest_artifacts[logical_name]
        section = sections[section_name]
        if entry.availability == "unavailable":
            if section.get("status") != "unavailable":
                raise JudgeBundleError(
                    f"section {section_name} is available without manifest evidence"
                )
            continue
        descriptor = linked_descriptors[logical_name]
        if (
            section.get("status") == "unavailable"
            or descriptor.get("artifact_id") not in section.get("artifact_ids", [])
            or descriptor.get("role") != section_name
        ):
            raise JudgeBundleError(
                f"section {section_name} does not bind its geographic impact artifact"
            )
    support_section_by_logical_name = {
        "verification_consensus": "verification_decisions",
        "quality_snapshot": "verification_quality",
        "release_decisions": "verification_quality",
    }
    for logical_name, section_name in support_section_by_logical_name.items():
        entry = manifest_artifacts[logical_name]
        if entry.availability == "unavailable":
            continue
        descriptor = linked_descriptors[logical_name]
        section = sections[section_name]
        if (
            section.get("status") == "unavailable"
            or descriptor.get("artifact_id") not in section.get("artifact_ids", [])
            or descriptor.get("role") != section_name
        ):
            raise JudgeBundleError(f"section {section_name} does not bind {logical_name} evidence")


def _validate_provider_union_provenance(
    manifest: GeographicImpactManifestDocument,
    manifest_artifacts: Mapping[str, GeographicImpactArtifactEntry],
) -> None:
    provider_union = manifest_artifacts["baseline_occurrence_union"]
    if manifest.baseline_evidence_status == "unavailable":
        if provider_union.availability != "unavailable":
            raise JudgeBundleError("unavailable baseline evidence cannot declare a provider union")
        return
    if (
        provider_union.availability != "available"
        or provider_union.schema_version != BASELINE_OCCURRENCE_UNION_SCHEMA_VERSION
        or provider_union.sha256 is None
        or provider_union.source_commit is None
        or provider_union.snapshot_id != manifest.baseline_snapshot_id
    ):
        raise JudgeBundleError("baseline provider union lacks deduplication provenance")


def _validate_review_and_release_evidence(
    manifest: GeographicImpactManifestDocument,
    manifest_artifacts: Mapping[str, GeographicImpactArtifactEntry],
) -> None:
    reviewed_or_attempted = (
        manifest.reviewed_positive_count
        + manifest.reviewed_negative_count
        + manifest.uncertain_count
        + manifest.media_failure_count
        + manifest.skipped_count
    )
    consensus = manifest_artifacts["verification_consensus"]
    quality = manifest_artifacts["quality_snapshot"]
    release = manifest_artifacts["release_decisions"]
    if reviewed_or_attempted > 0 and (
        consensus.availability != "available" or not consensus.row_count
    ):
        raise JudgeBundleError("reviewed geographic contribution lacks review evidence")
    if manifest.reviewed_positive_count > 0 and (
        quality.availability != "available" or not quality.row_count
    ):
        raise JudgeBundleError("reviewed geographic contribution lacks quality evidence")
    if manifest.release_ready_count > 0 and (
        release.availability != "available"
        or not release.row_count
        or release.snapshot_id != manifest.release_policy_version
    ):
        raise JudgeBundleError("release-ready geographic contribution lacks release-gate evidence")


def _validate_country_hierarchy_artifact(
    manifest: GeographicImpactManifestDocument,
    *,
    manifest_artifacts: Mapping[str, GeographicImpactArtifactEntry],
    bundle_root: Path,
) -> None:
    entry = manifest_artifacts["country_hierarchy"]
    if (
        entry.schema_version != COUNTRY_HIERARCHY_SCHEMA_VERSION
        or entry.media_type != "application/json"
    ):
        raise JudgeBundleError("country hierarchy has the wrong schema identity")
    descriptor = {
        "path": entry.path,
    }
    value = _load_strict_json_artifact(
        bundle_root,
        descriptor,
        label="country hierarchy",
    )
    try:
        hierarchy = CountryHierarchyDocument.from_mapping(value)
    except GeographicSchemaError as error:
        raise JudgeBundleError(str(error)) from error
    if (
        hierarchy.country_hierarchy_id != manifest.country_hierarchy_id
        or len(hierarchy.nodes) != manifest.hierarchy_node_count
    ):
        raise JudgeBundleError("country hierarchy identity or node count mismatch")


def migrate_judge_bundle_v1_to_v2(
    payload: object,
    *,
    bundle_root: str | Path | None = None,
    verify_files: bool = False,
) -> MigratedJudgeBundle:
    """Validate v1, add unavailable geography, and return a canonical v2 copy."""

    source = _mapping(payload, "judge bundle")
    source_bytes = canonical_json_bytes(source)
    _validate_judge_bundle_version(
        source,
        schema_version=JUDGE_BUNDLE_V1_SCHEMA_VERSION,
        section_names=JUDGE_BUNDLE_V1_SECTION_NAMES,
        artifact_roles=_ARTIFACT_ROLES_V1,
        bundle_root=bundle_root,
        verify_files=verify_files,
    )
    preserved_fingerprint = _v1_preservation_fingerprint(source)

    migrated = deepcopy(dict(source))
    migrated["schema_version"] = JUDGE_BUNDLE_V2_SCHEMA_VERSION
    sections = migrated.get("sections")
    expected_counts = migrated.get("expected_ui_counts")
    if not isinstance(sections, dict) or not isinstance(expected_counts, dict):
        raise JudgeBundleError("validated v1 bundle lost section or expected-count objects")
    section_records = expected_counts.get("section_records")
    unavailable_count = expected_counts.get("unavailable_section_count")
    if not isinstance(section_records, dict) or not isinstance(unavailable_count, int):
        raise JudgeBundleError("validated v1 bundle lost deterministic section counts")
    for name in JUDGE_BUNDLE_GEOGRAPHIC_SECTION_NAMES:
        sections[name] = _migrated_unavailable_geographic_section(name)
        section_records[name] = 0
    expected_counts["unavailable_section_count"] = unavailable_count + len(
        JUDGE_BUNDLE_GEOGRAPHIC_SECTION_NAMES
    )

    validation = validate_judge_bundle(
        migrated,
        bundle_root=bundle_root,
        verify_files=verify_files,
    )
    if canonical_json_bytes(source) != source_bytes:
        raise JudgeBundleError("v1-to-v2 migration mutated its source bundle")
    if _v1_preservation_fingerprint(migrated) != preserved_fingerprint:
        raise JudgeBundleError("v1-to-v2 migration changed preserved v1 evidence")
    receipt = JudgeBundleMigrationReceipt(
        source_schema_version=JUDGE_BUNDLE_V1_SCHEMA_VERSION,
        target_schema_version=JUDGE_BUNDLE_V2_SCHEMA_VERSION,
        applied=True,
        stored_files_rewritten=False,
        added_sections=JUDGE_BUNDLE_GEOGRAPHIC_SECTION_NAMES,
        preserved_v1_fingerprint_sha256=preserved_fingerprint,
    )
    return MigratedJudgeBundle(data=migrated, validation=validation, receipt=receipt)


def _migrated_unavailable_geographic_section(name: str) -> dict[str, object]:
    candidate_semantics = (
        "hypothesis_not_occurrence"
        if name
        in {
            "flickr_geography",
            "geographic_impact_cells",
            "geographic_impact_summary",
        }
        else "not_applicable"
    )
    return {
        "status": "unavailable",
        "artifact_ids": [],
        "reason": (
            f"{name} is not present in the source v1 bundle; "
            "migration did not invent geographic evidence"
        ),
        "candidate_semantics": candidate_semantics,
        "verification_status": "unavailable",
        "human_review_required": True,
        "scientific_claim_allowed": False,
    }


def _v1_preservation_fingerprint(bundle: Mapping[str, object]) -> str:
    """Hash every v1-owned value whose meaning migration must preserve."""

    sections = _mapping(bundle.get("sections"), "sections")
    expected_counts = _mapping(bundle.get("expected_ui_counts"), "expected_ui_counts")
    section_records = _mapping(
        expected_counts.get("section_records"),
        "expected_ui_counts.section_records",
    )
    projection = {
        key: bundle[key]
        for key in (
            "bundle_id",
            "title",
            "created_at",
            "target",
            "source_revisions",
            "artifact_inventory",
            "rights",
            "attribution",
            "openai_replay",
            "checksums",
        )
    }
    projection["sections"] = {name: sections[name] for name in JUDGE_BUNDLE_V1_SECTION_NAMES}
    projection["expected_ui_counts"] = {
        key: expected_counts[key]
        for key in (
            "screen_items",
            "artifact_count",
            "attribution_count",
            "openai_replay_trace_count",
        )
    }
    projection["expected_ui_counts"]["section_records"] = {
        name: section_records[name] for name in JUDGE_BUNDLE_V1_SECTION_NAMES
    }
    return hashlib.sha256(canonical_json_bytes(projection)).hexdigest()


def load_judge_bundle(
    manifest: str | Path,
    *,
    verify_files: bool = True,
) -> LoadedJudgeBundle:
    """Load strict JSON and validate it relative to its own bundle directory."""

    manifest_path = Path(manifest).resolve()
    if not manifest_path.is_file():
        raise JudgeBundleError(f"judge bundle manifest is missing: {manifest_path}")
    try:
        payload = json.loads(
            manifest_path.read_bytes(),
            object_pairs_hook=_reject_duplicate_keys,
            parse_constant=_reject_non_json_constant,
        )
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise JudgeBundleError(
            f"judge bundle manifest is not strict UTF-8 JSON: {error}"
        ) from error
    source = _mapping(payload, "judge bundle")
    source_schema_version = _string(source.get("schema_version"), "schema_version")
    migration_receipt: JudgeBundleMigrationReceipt | None = None
    if source_schema_version == JUDGE_BUNDLE_V1_SCHEMA_VERSION:
        migrated = migrate_judge_bundle_v1_to_v2(
            source,
            bundle_root=manifest_path.parent,
            verify_files=verify_files,
        )
        canonical = migrated.data
        validation = migrated.validation
        migration_receipt = migrated.receipt
    elif source_schema_version == JUDGE_BUNDLE_V2_SCHEMA_VERSION:
        canonical = deepcopy(dict(source))
        validation = validate_judge_bundle(
            canonical,
            bundle_root=manifest_path.parent,
            verify_files=verify_files,
        )
    else:
        raise JudgeBundleError(
            f"unsupported judge bundle schema_version: {source_schema_version!r}"
        )
    frozen = freeze_json(canonical)
    if not isinstance(frozen, Mapping):
        raise JudgeBundleError("judge bundle did not freeze to a mapping")
    return LoadedJudgeBundle(
        manifest_path=manifest_path,
        data=frozen,
        validation=validation,
        source_schema_version=source_schema_version,
        migration_receipt=migration_receipt,
    )


def _validate_target(value: object) -> None:
    target = _mapping(value, "target")
    _string(target.get("accepted_taxon_key"), "target.accepted_taxon_key")
    _string(target.get("scientific_name"), "target.scientific_name")
    _string(target.get("rank"), "target.rank")


def _validate_source_revisions(value: object) -> None:
    revisions = _mapping(value, "source_revisions")
    _git_sha(revisions.get("taxalens_sha"), "source_revisions.taxalens_sha")
    _git_sha(revisions.get("biominer_sha"), "source_revisions.biominer_sha")


def _validate_inventory(
    value: object,
    *,
    artifact_roles: frozenset[str],
    bundle_root: Path | None,
    verify_files: bool,
) -> tuple[list[object], dict[str, Mapping[str, object]]]:
    inventory = _list(value, "artifact_inventory")
    if not inventory:
        raise JudgeBundleError("artifact_inventory must not be empty")
    artifacts: dict[str, Mapping[str, object]] = {}
    paths: set[str] = set()
    for index, item in enumerate(inventory):
        label = f"artifact_inventory[{index}]"
        artifact = _mapping(item, label)
        artifact_id = _identifier(artifact.get("artifact_id"), f"{label}.artifact_id")
        if artifact_id in artifacts:
            raise JudgeBundleError(f"duplicate artifact_id: {artifact_id}")
        path = _safe_path(artifact.get("path"), f"{label}.path")
        if path in paths:
            raise JudgeBundleError(f"duplicate artifact path: {path}")
        paths.add(path)
        _string(artifact.get("media_type"), f"{label}.media_type")
        _choice(artifact.get("role"), artifact_roles, f"{label}.role")
        expected_sha256 = _digest(artifact.get("sha256"), f"{label}.sha256")
        expected_bytes = _nonnegative_int(artifact.get("bytes"), f"{label}.bytes")
        record_count = artifact.get("record_count")
        if record_count is not None:
            _nonnegative_int(record_count, f"{label}.record_count")
        schema_version = artifact.get("schema_version")
        if schema_version is not None:
            _string(schema_version, f"{label}.schema_version")
        _string(artifact.get("source_repository"), f"{label}.source_repository")
        _git_sha(artifact.get("source_commit"), f"{label}.source_commit")
        _boolean(artifact.get("required"), f"{label}.required")
        if verify_files:
            if bundle_root is None:
                raise JudgeBundleError("bundle root is unavailable")
            _verify_artifact_file(
                bundle_root,
                path,
                expected_bytes=expected_bytes,
                expected_sha256=expected_sha256,
            )
        artifacts[artifact_id] = artifact
    return inventory, artifacts


def _verify_artifact_file(
    root: Path,
    relative_path: str,
    *,
    expected_bytes: int,
    expected_sha256: str,
) -> None:
    candidate = root
    for part in PurePosixPath(relative_path).parts:
        candidate = candidate / part
        if candidate.is_symlink():
            raise JudgeBundleError(f"artifact path contains a symlink: {relative_path}")
    resolved = candidate.resolve()
    if not resolved.is_relative_to(root):
        raise JudgeBundleError(f"artifact path escapes bundle root: {relative_path}")
    if not resolved.is_file():
        raise JudgeBundleError(f"artifact is missing: {relative_path}")
    if resolved.stat().st_size != expected_bytes:
        raise JudgeBundleError(f"artifact byte count mismatch: {relative_path}")
    actual = hashlib.sha256(resolved.read_bytes()).hexdigest()
    if actual != expected_sha256:
        raise JudgeBundleError(f"artifact checksum mismatch: {relative_path}")


def _validate_sections(
    value: object,
    artifacts: Mapping[str, Mapping[str, object]],
    *,
    section_names: tuple[str, ...],
) -> dict[str, Mapping[str, object]]:
    sections = _mapping(value, "sections")
    actual_names = set(sections)
    expected_names = set(section_names)
    if actual_names != expected_names:
        missing = sorted(expected_names - actual_names)
        unexpected = sorted(actual_names - expected_names)
        raise JudgeBundleError(
            f"sections must match the contract; missing={missing}, unexpected={unexpected}"
        )
    validated: dict[str, Mapping[str, object]] = {}
    for name in section_names:
        label = f"sections.{name}"
        section = _mapping(sections[name], label)
        status = _choice(section.get("status"), _AVAILABILITY, f"{label}.status")
        artifact_ids = _artifact_references(
            section.get("artifact_ids"), artifacts, f"{label}.artifact_ids"
        )
        for artifact_id in artifact_ids:
            if artifacts[artifact_id].get("role") != name:
                raise JudgeBundleError(
                    f"{label} references artifact {artifact_id} with a different role"
                )
        reason = section.get("reason")
        if reason is not None:
            _string(reason, f"{label}.reason")
        semantics = _choice(
            section.get("candidate_semantics"),
            _CANDIDATE_SEMANTICS,
            f"{label}.candidate_semantics",
        )
        verification = _choice(
            section.get("verification_status"),
            _VERIFICATION_STATUSES,
            f"{label}.verification_status",
        )
        human_review = _boolean(
            section.get("human_review_required"),
            f"{label}.human_review_required",
        )
        scientific_claim = _boolean(
            section.get("scientific_claim_allowed"),
            f"{label}.scientific_claim_allowed",
        )
        if status == "unavailable":
            if artifact_ids:
                raise JudgeBundleError(f"{label} unavailable section has artifacts")
            if not isinstance(reason, str) or not reason.strip():
                raise JudgeBundleError(f"{label} unavailable section requires a reason")
            if human_review is not True or scientific_claim is not False:
                raise JudgeBundleError(
                    f"{label} unavailable section must require review and forbid claims"
                )
            if verification != "unavailable":
                raise JudgeBundleError(
                    f"{label} unavailable section requires unavailable verification"
                )
        elif not artifact_ids:
            raise JudgeBundleError(f"{label} {status} section requires artifacts")
        if status == "partial" and (human_review is not True or scientific_claim is not False):
            raise JudgeBundleError(f"{label} partial section must require review and forbid claims")
        if scientific_claim and (
            status != "available" or verification != "human_verified" or human_review is not False
        ):
            raise JudgeBundleError(
                f"{label} scientific claims require available human-verified evidence"
            )
        if scientific_claim and semantics in _NON_CLAIMING_SEMANTICS:
            raise JudgeBundleError(
                f"{label} candidate semantics do not authorize a scientific claim"
            )
        validated[name] = section
    campaign_status = validated["verification_campaigns"]["status"]
    item_status = validated["verification_items"]["status"]
    media_status = validated["verification_media"]["status"]
    if item_status != "unavailable" and campaign_status == "unavailable":
        raise JudgeBundleError(
            "verification_items cannot be displayed without verification_campaigns"
        )
    if media_status != "unavailable" and item_status == "unavailable":
        raise JudgeBundleError("verification_media cannot be displayed without verification_items")
    if media_status != "unavailable":
        for artifact_id in validated["verification_media"]["artifact_ids"]:
            media_type = artifacts[str(artifact_id)].get("media_type")
            if not isinstance(media_type, str) or not media_type.startswith("image/"):
                raise JudgeBundleError(
                    f"verification_media artifact {artifact_id} must use an image media type"
                )
    return validated


def _validate_rights(
    value: object,
    artifacts: Mapping[str, Mapping[str, object]],
) -> tuple[Mapping[str, object], set[str]]:
    rights = _mapping(value, "rights")
    _choice(rights.get("status"), _RIGHTS_STATUSES, "rights.status")
    declared_coverage = _boolean(
        rights.get("all_artifacts_covered"), "rights.all_artifacts_covered"
    )
    _boolean(
        rights.get("all_media_rights_verified"),
        "rights.all_media_rights_verified",
    )
    items = _list(rights.get("items"), "rights.items")
    if not items:
        raise JudgeBundleError("rights.items must not be empty")
    covered: set[str] = set()
    attribution_required: set[str] = set()
    rights_ids: set[str] = set()
    for index, value_item in enumerate(items):
        label = f"rights.items[{index}]"
        item = _mapping(value_item, label)
        rights_id = _identifier(item.get("rights_id"), f"{label}.rights_id")
        if rights_id in rights_ids:
            raise JudgeBundleError(f"duplicate rights_id: {rights_id}")
        rights_ids.add(rights_id)
        refs = _artifact_references(item.get("artifact_ids"), artifacts, f"{label}.artifact_ids")
        if not refs:
            raise JudgeBundleError(f"{label}.artifact_ids must not be empty")
        covered.update(refs)
        _choice(item.get("status"), _RIGHTS_STATUSES, f"{label}.status")
        for key in ("license_name", "license_uri", "creator_or_owner", "source_url"):
            field = item.get(key)
            if field is not None:
                _string(field, f"{label}.{key}")
        _string(item.get("use_scope"), f"{label}.use_scope")
        required = _boolean(item.get("attribution_required"), f"{label}.attribution_required")
        if required:
            attribution_required.update(refs)
        notes = _list(item.get("notes"), f"{label}.notes")
        for note_index, note in enumerate(notes):
            _string(note, f"{label}.notes[{note_index}]")
    actual_coverage = covered == set(artifacts)
    if declared_coverage is not actual_coverage or not actual_coverage:
        raise JudgeBundleError("rights must cover every artifact exactly or by overlap")
    return rights, attribution_required


def _validate_attribution(
    value: object,
    artifacts: Mapping[str, Mapping[str, object]],
    required_artifacts: set[str],
) -> tuple[int, bool]:
    attribution = _mapping(value, "attribution")
    declared_complete = _boolean(attribution.get("complete"), "attribution.complete")
    entries = _list(attribution.get("entries"), "attribution.entries")
    covered: set[str] = set()
    ids: set[str] = set()
    for index, value_entry in enumerate(entries):
        label = f"attribution.entries[{index}]"
        entry = _mapping(value_entry, label)
        attribution_id = _identifier(entry.get("attribution_id"), f"{label}.attribution_id")
        if attribution_id in ids:
            raise JudgeBundleError(f"duplicate attribution_id: {attribution_id}")
        ids.add(attribution_id)
        covered.update(
            _artifact_references(entry.get("artifact_ids"), artifacts, f"{label}.artifact_ids")
        )
        _string(entry.get("display_text"), f"{label}.display_text")
        for key in (
            "creator",
            "source_title",
            "source_url",
            "license_name",
            "license_uri",
        ):
            field = entry.get(key)
            if field is not None:
                _string(field, f"{label}.{key}")
    actual_complete = required_artifacts.issubset(covered)
    if declared_complete is not actual_complete:
        raise JudgeBundleError("attribution.complete differs from required artifact coverage")
    return len(entries), actual_complete


def _validate_openai_replay(
    value: object,
    artifacts: Mapping[str, Mapping[str, object]],
) -> int:
    replay = _mapping(value, "openai_replay")
    status = _choice(
        replay.get("status"),
        frozenset(("available", "unavailable", "not_used")),
        "openai_replay.status",
    )
    mode = _choice(
        replay.get("mode"),
        frozenset(("stored_structured_outputs_only", "not_used")),
        "openai_replay.mode",
    )
    if _boolean(replay.get("credentials_required"), "openai_replay.credentials_required"):
        raise JudgeBundleError("judge replay must not require OpenAI credentials")
    if _boolean(replay.get("live_requests_allowed"), "openai_replay.live_requests_allowed"):
        raise JudgeBundleError("judge replay must not allow live OpenAI requests")
    reason = replay.get("reason")
    if reason is not None:
        _string(reason, "openai_replay.reason")
    traces = _list(replay.get("traces"), "openai_replay.traces")
    if status == "available" and mode != "stored_structured_outputs_only":
        raise JudgeBundleError("available OpenAI replay requires stored output mode")
    if status == "unavailable" and (not isinstance(reason, str) or not reason.strip()):
        raise JudgeBundleError("unavailable OpenAI replay requires a reason")
    if status == "not_used" and (mode != "not_used" or traces):
        raise JudgeBundleError("not-used OpenAI replay must use not_used mode and no traces")
    trace_ids: set[str] = set()
    sequences: list[int] = []
    for index, value_trace in enumerate(traces):
        label = f"openai_replay.traces[{index}]"
        trace = _mapping(value_trace, label)
        trace_id = _identifier(trace.get("trace_id"), f"{label}.trace_id")
        if trace_id in trace_ids:
            raise JudgeBundleError(f"duplicate OpenAI replay trace_id: {trace_id}")
        trace_ids.add(trace_id)
        sequences.append(_nonnegative_int(trace.get("sequence"), f"{label}.sequence"))
        for key in ("stage_id", "model"):
            field = trace.get(key)
            if field is not None:
                _string(field, f"{label}.{key}")
        occurred_at = trace.get("occurred_at")
        if occurred_at is not None:
            _timestamp(occurred_at, f"{label}.occurred_at")
        for key in ("request_artifact_id", "response_artifact_id"):
            artifact_id = trace.get(key)
            if artifact_id is not None:
                _identifier(artifact_id, f"{label}.{key}")
                if artifact_id not in artifacts:
                    raise JudgeBundleError(f"{label}.{key} references unknown artifact")
        for key in ("prompt_sha256", "response_sha256"):
            digest = trace.get(key)
            if digest is not None:
                _digest(digest, f"{label}.{key}")
        if trace.get("stored_output_only") is not True:
            raise JudgeBundleError(f"{label}.stored_output_only must be true")
    if sequences != list(range(1, len(sequences) + 1)):
        raise JudgeBundleError("OpenAI replay trace sequence must be contiguous from 1")
    return len(traces)


def _validate_expected_counts(
    value: object,
    *,
    sections: Mapping[str, Mapping[str, object]],
    artifacts: Mapping[str, Mapping[str, object]],
    attribution_count: int,
    replay_trace_count: int,
    unavailable_count: int,
    section_names: tuple[str, ...],
) -> None:
    counts = _mapping(value, "expected_ui_counts")
    section_records = _mapping(counts.get("section_records"), "expected_ui_counts.section_records")
    if set(section_records) != set(section_names):
        raise JudgeBundleError(
            "expected_ui_counts.section_records must contain every judge section"
        )
    for name in section_names:
        expected = _nonnegative_int(
            section_records[name], f"expected_ui_counts.section_records.{name}"
        )
        section = sections[name]
        if section["status"] == "unavailable" and expected != 0:
            raise JudgeBundleError(f"unavailable section {name} must have UI count zero")
        record_counts = [
            artifacts[artifact_id].get("record_count") for artifact_id in section["artifact_ids"]
        ]
        if record_counts and all(isinstance(item, int) for item in record_counts):
            observed = sum(int(item) for item in record_counts)
            if expected != observed:
                raise JudgeBundleError(
                    f"expected UI count for {name} is {expected}, artifact records total {observed}"
                )
    screen_items = _mapping(counts.get("screen_items"), "expected_ui_counts.screen_items")
    if set(screen_items) != set(JUDGE_SCREEN_NAMES):
        raise JudgeBundleError(
            "expected_ui_counts.screen_items must contain all four product screens"
        )
    for name in JUDGE_SCREEN_NAMES:
        _nonnegative_int(screen_items[name], f"expected_ui_counts.screen_items.{name}")
    exact_counts = {
        "artifact_count": len(artifacts),
        "attribution_count": attribution_count,
        "openai_replay_trace_count": replay_trace_count,
        "unavailable_section_count": unavailable_count,
    }
    for key, actual in exact_counts.items():
        expected = _nonnegative_int(counts.get(key), f"expected_ui_counts.{key}")
        if expected != actual:
            raise JudgeBundleError(f"expected_ui_counts.{key} is {expected}, actual is {actual}")


def _validate_checksums(
    value: object,
    *,
    inventory_sha256: str,
    payload_root_sha256: str,
) -> None:
    checksums = _mapping(value, "checksums")
    if checksums.get("algorithm") != "sha256":
        raise JudgeBundleError("checksums.algorithm must be sha256")
    if checksums.get("canonicalization") != "json-sorted-keys-utf8-v1":
        raise JudgeBundleError("checksums.canonicalization must be json-sorted-keys-utf8-v1")
    declared_inventory = _digest(checksums.get("inventory_sha256"), "checksums.inventory_sha256")
    declared_root = _digest(checksums.get("payload_root_sha256"), "checksums.payload_root_sha256")
    if declared_inventory != inventory_sha256:
        raise JudgeBundleError("checksums.inventory_sha256 does not match inventory")
    if declared_root != payload_root_sha256:
        raise JudgeBundleError("checksums.payload_root_sha256 does not match inventory")


def _artifact_references(
    value: object,
    artifacts: Mapping[str, Mapping[str, object]],
    label: str,
) -> tuple[str, ...]:
    refs = _list(value, label)
    result: list[str] = []
    for index, item in enumerate(refs):
        artifact_id = _identifier(item, f"{label}[{index}]")
        if artifact_id in result:
            raise JudgeBundleError(f"{label} contains duplicate artifact_id {artifact_id}")
        if artifact_id not in artifacts:
            raise JudgeBundleError(f"{label} references unknown artifact_id {artifact_id}")
        result.append(artifact_id)
    return tuple(result)


def _mapping(value: object, label: str) -> Mapping[str, object]:
    if not isinstance(value, dict):
        raise JudgeBundleError(f"{label} must be an object")
    return value


def _list(value: object, label: str) -> list[object]:
    if not isinstance(value, list):
        raise JudgeBundleError(f"{label} must be an array")
    return value


def _string(value: object, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise JudgeBundleError(f"{label} must be a non-empty string")
    return value


def _identifier(value: object, label: str) -> str:
    result = _string(value, label)
    if not _ID_PATTERN.fullmatch(result):
        raise JudgeBundleError(f"{label} has invalid identifier syntax")
    return result


def _safe_path(value: object, label: str) -> str:
    result = _string(value, label)
    pure = PurePosixPath(result)
    if (
        pure.is_absolute()
        or pure.as_posix() != result
        or any(not _PATH_PART_PATTERN.fullmatch(part) for part in pure.parts)
    ):
        raise JudgeBundleError(f"{label} must be a normalized safe relative path")
    return result


def _git_sha(value: object, label: str) -> str:
    result = _string(value, label)
    if not _SHA_PATTERN.fullmatch(result):
        raise JudgeBundleError(f"{label} must be a full lowercase Git SHA")
    return result


def _digest(value: object, label: str) -> str:
    result = _string(value, label)
    if not _DIGEST_PATTERN.fullmatch(result):
        raise JudgeBundleError(f"{label} must be a lowercase SHA-256 digest")
    return result


def _nonnegative_int(value: object, label: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise JudgeBundleError(f"{label} must be a non-negative integer")
    return value


def _boolean(value: object, label: str) -> bool:
    if not isinstance(value, bool):
        raise JudgeBundleError(f"{label} must be a boolean")
    return value


def _timestamp(value: object, label: str) -> str:
    result = _string(value, label)
    try:
        parsed = datetime.fromisoformat(result.replace("Z", "+00:00"))
    except ValueError as error:
        raise JudgeBundleError(f"{label} must be an ISO-8601 timestamp") from error
    if parsed.tzinfo is None:
        raise JudgeBundleError(f"{label} must include a timezone")
    return result


def _choice(value: object, choices: frozenset[str], label: str) -> str:
    result = _string(value, label)
    if result not in choices:
        raise JudgeBundleError(f"{label} must be one of {sorted(choices)}")
    return result


def _reject_duplicate_keys(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise JudgeBundleError(f"duplicate JSON object key: {key}")
        result[key] = value
    return result


def _reject_non_json_constant(value: str) -> None:
    raise JudgeBundleError(f"non-JSON numeric constant: {value}")


__all__ = [
    "JUDGE_BUNDLE_GEOGRAPHIC_SECTION_NAMES",
    "JUDGE_BUNDLE_SCHEMA_VERSION",
    "JUDGE_BUNDLE_SECTION_NAMES",
    "JUDGE_BUNDLE_V1_SCHEMA_VERSION",
    "JUDGE_BUNDLE_V1_SECTION_NAMES",
    "JUDGE_BUNDLE_V2_SCHEMA_VERSION",
    "JUDGE_BUNDLE_V2_SECTION_NAMES",
    "JudgeBundleError",
    "JudgeBundleMigrationReceipt",
    "JudgeBundleValidation",
    "LoadedJudgeBundle",
    "MigratedJudgeBundle",
    "canonical_json_bytes",
    "compute_inventory_sha256",
    "compute_payload_root_sha256",
    "load_judge_bundle",
    "migrate_judge_bundle_v1_to_v2",
    "validate_judge_bundle",
]
