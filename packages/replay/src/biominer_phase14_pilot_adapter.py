"""Adapt checksum-pinned BioMiner Phase 14 pilot metadata for TaxaLens."""

from __future__ import annotations

import hashlib
import json
import math
import re
from collections import Counter
from collections.abc import Mapping
from pathlib import Path, PurePosixPath
from typing import Any, TypedDict

from packages.replay.src.validation import is_full_git_sha

PILOT_METADATA_ADAPTER_SCHEMA_VERSION = "taxalens-phase14-pilot-metadata:v1.1.0"
COMPACT_IMPORT_SCHEMA_VERSION = "taxalens-biominer-compact-import:v1.1.0"
DEFAULT_IMPORT_MANIFEST = Path("demo/source/biominer_phase14/import_manifest.json")

SECTION_NAMES = (
    "geographic_workload",
    "candidate_clusters",
    "query_hit_metrics",
    "target_range_evidence",
    "regional_competitors",
    "trust_first_reference_plan",
    "biological_negatives",
    "visual_domain_negatives",
    "source_media_counts",
    "reference_shortfalls",
    "handoff_fingerprints",
)

_EXPECTED_ROLES = {
    "competitor_relationships": "competitor-relationship-source-v1.0.0",
    "experiment_matrix": "papilio-demoleus-phase14-experiment-matrix-v1.0.0",
    "geographic_workload_settings": "target-aware-reference-cli-settings-v1",
    "range_seed": "range-seed-v1",
    "reference_source_queries": ("papilio-demoleus-pilot-reference-source-queries-v1.0.0"),
    "geographic_workload_manifest": ("papilio-demoleus-pilot-geographic-workload-manifest-v1.0.0"),
    "reference_source_manifest": ("papilio-demoleus-pilot-reference-source-manifest-v1.0.0"),
}
_SHA256_PATTERN = re.compile(r"[0-9a-f]{64}\Z")
_PREFIXED_SHA256_PATTERN = re.compile(r"sha256:[0-9a-f]{64}\Z")
_COUNTRY_CODE_PATTERN = re.compile(r"[A-Z]{2}\Z")


class Phase14PilotAdapterError(ValueError):
    """Raised when imported BioMiner pilot metadata fails closed."""


class PilotContract(TypedDict):
    candidate_semantics: str
    verification_status: str
    human_review_required: bool
    scientific_claim_allowed: bool
    source_artifacts: list[dict[str, object]]
    data: dict[str, object]


def adapt_current_pilot_metadata(
    import_manifest: str | Path = DEFAULT_IMPORT_MANIFEST,
) -> dict[str, object]:
    """Verify and adapt the bounded committed Papilio pilot metadata import."""

    manifest_path = _regular_file(Path(import_manifest))
    manifest = _load_json_object(manifest_path)
    if manifest.get("schema_version") != COMPACT_IMPORT_SCHEMA_VERSION:
        raise Phase14PilotAdapterError("unsupported compact import manifest schema")
    if manifest.get("origin_repository") != "karikris/BioMiner":
        raise Phase14PilotAdapterError("compact import has an unexpected origin repository")
    if manifest.get("license") != "MIT" or manifest.get("attribution") != (
        "Copyright (c) 2026 Kris Kari"
    ):
        raise Phase14PilotAdapterError("compact import rights metadata differs")
    origin_commit = _required_text(manifest.get("origin_commit"), "origin_commit")
    if not is_full_git_sha(origin_commit):
        raise Phase14PilotAdapterError("compact import origin_commit is not a full Git SHA")
    policy = _mapping(manifest.get("import_policy"), "import_policy")
    _require_exact_booleans(
        policy,
        {
            "committed_git_objects_only": True,
            "source_bytes_preserved": True,
            "untracked_sources_used": False,
            "scientific_results_claimed": False,
        },
        label="import_policy",
    )
    payloads, sources = _load_inventory(manifest_path, manifest)
    _validate_cross_file_contracts(payloads, sources)

    geographic = payloads["geographic_workload_manifest"]
    geographic_settings = payloads["geographic_workload_settings"]
    references = payloads["reference_source_manifest"]
    queries = payloads["reference_source_queries"]
    relationships = payloads["competitor_relationships"]
    range_seed = payloads["range_seed"]
    matrix = payloads["experiment_matrix"]
    if geographic.get("status") != "complete" or geographic.get("task") != "14.1":
        raise Phase14PilotAdapterError("geographic workload is not complete Task 14.1 metadata")
    if references.get("status") != (
        "metadata_complete_awaiting_human_review_and_additional_sources"
    ):
        raise Phase14PilotAdapterError("reference source metadata has an unexpected status")
    if references.get("candidate_semantics") != queries.get("candidate_semantics"):
        raise Phase14PilotAdapterError("reference candidate semantics differ")

    workload_semantics = _required_text(
        geographic.get("candidate_semantics"), "geographic candidate_semantics"
    )
    reference_semantics = _required_text(
        references.get("candidate_semantics"), "reference candidate_semantics"
    )
    geographic_counts = _nonnegative_count_mapping(geographic.get("counts"), "counts")
    reference_counts = _nonnegative_count_mapping(references.get("counts"), "counts")

    contracts: dict[str, PilotContract] = {
        "geographic_workload": _contract(
            candidate_semantics=workload_semantics,
            verification_status="committed_metadata_verified",
            human_review_required=True,
            sources=_sources(sources, "geographic_workload_manifest"),
            data={
                "target": geographic["target"],
                "phase": geographic["phase"],
                "task": geographic["task"],
                "status": geographic["status"],
                "counts": geographic_counts,
                "reference_quota": geographic["reference_quota"],
                "execution_constraints": geographic["execution_constraints"],
            },
        ),
        "candidate_clusters": _contract(
            candidate_semantics=workload_semantics,
            verification_status="summary_verified_payload_not_imported",
            human_review_required=True,
            sources=_sources(sources, "geographic_workload_manifest"),
            data={
                "located_cluster_count": geographic_counts["located_cluster_count"],
                "fallback_cluster_count": geographic_counts["fallback_cluster_count"],
                "eligible_reference_cluster_count": geographic_counts[
                    "eligible_reference_cluster_count"
                ],
                "unassigned_geotagged_record_count": geographic_counts[
                    "unassigned_geotagged_record_count"
                ],
                "outlier_record_count": geographic_counts["outlier_record_count"],
                "cluster_artifact": _artifact_identity(geographic, "clusters"),
                "assignment_artifact": _artifact_identity(geographic, "assignments"),
                "payload_rows_available": False,
            },
        ),
        "query_hit_metrics": _contract(
            candidate_semantics=workload_semantics,
            verification_status="committed_metadata_verified",
            human_review_required=True,
            sources=_sources(sources, "geographic_workload_manifest"),
            data={
                "query_hit_count": geographic_counts["query_hit_count"],
                "canonical_photo_count": geographic_counts["canonical_photo_count"],
                "geotagged_photo_count": geographic_counts["geotagged_photo_count"],
                "missing_coordinate_record_count": geographic_counts[
                    "missing_coordinate_record_count"
                ],
                "source": geographic["source"],
                "query_hit_artifact": _artifact_identity(geographic, "query_hits"),
            },
        ),
        "target_range_evidence": _contract(
            candidate_semantics="range_seed_for_candidate_planning_not_candidate_verification",
            verification_status="committed_range_seed_verified",
            human_review_required=True,
            sources=_sources(sources, "range_seed"),
            data=_range_summary(range_seed),
        ),
        "regional_competitors": _contract(
            candidate_semantics=reference_semantics,
            verification_status="candidate_plan_verified_not_reference_verified",
            human_review_required=True,
            sources=_sources(sources, "reference_source_queries", "reference_source_manifest"),
            data=_regional_competitors(queries),
        ),
        "trust_first_reference_plan": _contract(
            candidate_semantics=reference_semantics,
            verification_status="metadata_plan_verified_human_review_blocked",
            human_review_required=True,
            sources=_sources(
                sources,
                "geographic_workload_settings",
                "reference_source_queries",
                "reference_source_manifest",
                "experiment_matrix",
            ),
            data={
                "source_plan": references["source_plan"],
                "source_registry": _source_registry(geographic_settings, queries),
                "query_scope_policy": queries["query_scope_policy"],
                "acquisition_quotas": queries["acquisition_quotas"],
                "query_count": len(_list_of_mappings(queries.get("queries"), "queries")),
                "label_contract": matrix["label_contract"],
                "prerequisite_gates": matrix["prerequisite_gates"],
                "phase15_default_gate": matrix["phase15_default_gate"],
            },
        ),
        "biological_negatives": _contract(
            candidate_semantics="negative_candidate_plan_not_reviewed_negative_label",
            verification_status="partial_candidate_plan_verified",
            human_review_required=True,
            sources=_sources(
                sources,
                "reference_source_queries",
                "competitor_relationships",
            ),
            data=_biological_negatives(queries, relationships),
        ),
        "visual_domain_negatives": _contract(
            candidate_semantics="visual_domain_class_plan_not_selected_negative_media",
            verification_status="plan_verified_selection_unavailable",
            human_review_required=True,
            sources=_sources(sources, "reference_source_queries"),
            data=_visual_domain_negatives(queries),
        ),
        "source_media_counts": _contract(
            candidate_semantics=reference_semantics,
            verification_status="committed_metadata_counts_verified",
            human_review_required=True,
            sources=_sources(sources, "reference_source_manifest"),
            data={
                "counts": reference_counts,
                "status": references["status"],
                "execution_constraints": references["execution_constraints"],
                "materialization": references["materialization"],
            },
        ),
        "reference_shortfalls": _contract(
            candidate_semantics=reference_semantics,
            verification_status="shortfall_report_verified_unresolved",
            human_review_required=True,
            sources=_sources(sources, "reference_source_manifest"),
            data=dict(_mapping(references.get("shortfalls"), "shortfalls")),
        ),
        "handoff_fingerprints": _contract(
            candidate_semantics="artifact_identity_not_scientific_validation",
            verification_status="content_and_cross_references_verified",
            human_review_required=False,
            sources=list(sources.values()),
            data={
                "origin_repository": manifest["origin_repository"],
                "origin_commit": origin_commit,
                "import_manifest_sha256": _sha256_file(manifest_path),
                "imported_files": list(sources.values()),
                "declared_workload_artifacts": _validated_artifacts(
                    geographic, "geographic artifacts"
                ),
                "declared_reference_artifacts": _validated_artifacts(
                    references, "reference artifacts"
                ),
                "large_payloads_imported": False,
            },
        ),
    }
    if tuple(contracts) != SECTION_NAMES:
        raise AssertionError("pilot metadata section order changed")
    return {
        "schema_version": PILOT_METADATA_ADAPTER_SCHEMA_VERSION,
        "origin_repository": manifest["origin_repository"],
        "origin_commit": origin_commit,
        "target": geographic["target"],
        "metadata_only": True,
        "scientific_results_available": False,
        "contracts": contracts,
        "contract_count": len(contracts),
    }


def _load_inventory(
    manifest_path: Path,
    manifest: Mapping[str, Any],
) -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, object]]]:
    raw_files = manifest.get("files")
    if not isinstance(raw_files, list):
        raise Phase14PilotAdapterError("compact import files must be an array")
    payloads: dict[str, dict[str, Any]] = {}
    sources: dict[str, dict[str, object]] = {}
    for index, raw in enumerate(raw_files):
        entry = _mapping(raw, f"files[{index}]")
        role = _required_text(entry.get("role"), f"files[{index}].role")
        if role not in _EXPECTED_ROLES or role in payloads:
            raise Phase14PilotAdapterError(f"unexpected or duplicate compact import role: {role}")
        relative = _safe_relative_path(entry.get("imported_path"))
        path = _regular_file(manifest_path.parent / relative)
        if not path.is_relative_to(manifest_path.parent.resolve()):
            raise Phase14PilotAdapterError(f"compact import {role} escapes its root")
        expected_digest = _required_text(entry.get("sha256"), f"files[{index}].sha256")
        if _SHA256_PATTERN.fullmatch(expected_digest) is None:
            raise Phase14PilotAdapterError(f"compact import {role} has an invalid SHA-256")
        if _sha256_file(path) != expected_digest:
            raise Phase14PilotAdapterError(f"compact import {role} failed SHA-256 verification")
        byte_count = _nonnegative_int(entry.get("byte_count"), f"files[{index}].byte_count")
        if path.stat().st_size != byte_count:
            raise Phase14PilotAdapterError(f"compact import {role} byte count differs")
        schema_version = _required_text(
            entry.get("schema_version"), f"files[{index}].schema_version"
        )
        if schema_version != _EXPECTED_ROLES[role]:
            raise Phase14PilotAdapterError(f"compact import {role} schema declaration differs")
        payload = _load_json_object(path)
        if payload.get("schema_version") != schema_version:
            raise Phase14PilotAdapterError(f"compact import {role} payload schema differs")
        payloads[role] = payload
        sources[role] = {
            "role": role,
            "source_path": _safe_relative_path(entry.get("source_path")),
            "imported_path": relative,
            "byte_count": byte_count,
            "sha256": expected_digest,
            "schema_version": schema_version,
            "checksum_verified": True,
        }
    missing = sorted(set(_EXPECTED_ROLES) - set(payloads))
    if missing:
        raise Phase14PilotAdapterError(f"compact import is missing roles: {missing}")
    return payloads, sources


def _validate_cross_file_contracts(
    payloads: Mapping[str, Mapping[str, Any]],
    sources: Mapping[str, Mapping[str, object]],
) -> None:
    geographic = payloads["geographic_workload_manifest"]
    geographic_settings = payloads["geographic_workload_settings"]
    references = payloads["reference_source_manifest"]
    queries = payloads["reference_source_queries"]
    relationships = payloads["competitor_relationships"]
    range_seed = payloads["range_seed"]
    matrix = payloads["experiment_matrix"]
    target_keys = {
        _mapping(geographic.get("target"), "geographic.target").get("accepted_taxon_key"),
        _mapping(
            _mapping(geographic_settings.get("pilot"), "settings.pilot").get("target"),
            "settings.pilot.target",
        ).get("accepted_taxon_key"),
        _mapping(references.get("target"), "references.target").get("accepted_taxon_key"),
        _mapping(matrix.get("target"), "matrix.target").get("accepted_taxon_key"),
        range_seed.get("accepted_taxon_key"),
    }
    if target_keys != {"gbif:1938069"}:
        raise Phase14PilotAdapterError("pilot target identity differs across imported artifacts")
    _source_registry(geographic_settings, queries)
    _require_prefixed_digest_match(
        _mapping(geographic.get("competitor_plan"), "competitor_plan").get(
            "relationship_source_sha256"
        ),
        sources["competitor_relationships"]["sha256"],
        "geographic competitor relationship",
    )
    _require_prefixed_digest_match(
        _mapping(references.get("source_plan"), "source_plan").get("sha256"),
        sources["reference_source_queries"]["sha256"],
        "reference source plan",
    )
    _require_prefixed_digest_match(
        _mapping(references.get("experiment_matrix"), "experiment_matrix").get("sha256"),
        sources["experiment_matrix"]["sha256"],
        "experiment matrix",
    )
    evidence_sources = _mapping(queries.get("evidence_sources"), "evidence_sources")
    _require_prefixed_digest_match(
        evidence_sources.get("reviewed_false_winner_relationships_sha256"),
        sources["competitor_relationships"]["sha256"],
        "false-winner relationship",
    )
    counts = _nonnegative_count_mapping(geographic.get("counts"), "geographic.counts")
    source = _mapping(geographic.get("source"), "geographic.source")
    if counts.get("query_hit_count") != source.get("input_row_count"):
        raise Phase14PilotAdapterError("geographic query-hit counts disagree")
    query_rows = _list_of_mappings(queries.get("queries"), "queries")
    source_plan = _mapping(references.get("source_plan"), "source_plan")
    if source_plan.get("query_count") != len(query_rows):
        raise Phase14PilotAdapterError("reference source query counts disagree")
    if source_plan.get("queried_species_count") != len(
        {row.get("accepted_taxon_key") for row in query_rows}
    ):
        raise Phase14PilotAdapterError("reference queried-species counts disagree")
    relationship_rows = _list_of_mappings(relationships.get("relationships"), "relationships")
    if any(row.get("subject_accepted_taxon_key") != "gbif:1938069" for row in relationship_rows):
        raise Phase14PilotAdapterError("competitor relationship target differs")
    label_contract = _mapping(matrix.get("label_contract"), "label_contract")
    _require_exact_booleans(
        label_contract,
        {
            "flickr_query_match_is_label": False,
            "gbif_taxon_match_is_human_image_label": False,
            "source_candidate_is_human_image_label": False,
            "uncertain_or_conflicting_review_is_eligible": False,
        },
        label="label_contract",
    )
    phase15 = _mapping(matrix.get("phase15_default_gate"), "phase15_default_gate")
    _require_exact_booleans(
        phase15,
        {"authorized": False, "current_default_must_remain_unchanged": True},
        label="phase15_default_gate",
    )


def _source_registry(
    settings: Mapping[str, Any],
    queries: Mapping[str, Any],
) -> dict[str, object]:
    commands = _mapping(settings.get("commands"), "settings.commands")
    command_names = (
        "build-geographic-spread",
        "build-regional-competitor-evidence",
        "fetch-metadata",
    )
    registry_versions = {
        _required_text(
            _mapping(commands.get(name), f"settings.commands.{name}").get("registry_version"),
            f"settings.commands.{name}.registry_version",
        )
        for name in command_names
    }
    if len(registry_versions) != 1:
        raise Phase14PilotAdapterError("pilot command registry versions differ")

    query_rows = _list_of_mappings(queries.get("queries"), "queries")
    snapshot_versions = {
        _required_text(row.get("source_snapshot_version"), "query source_snapshot_version")
        for row in query_rows
    }
    if len(snapshot_versions) != 1:
        raise Phase14PilotAdapterError("reference query source snapshot versions differ")

    fetch_metadata = _mapping(commands.get("fetch-metadata"), "settings.commands.fetch-metadata")
    if (
        fetch_metadata.get("queries")
        != "config/pilot/papilio_demoleus_reference_source_queries.json"
    ):
        raise Phase14PilotAdapterError("fetch-metadata query source differs")

    return {
        "registry_name": "BioMiner butterflies registry",
        "registry_version": next(iter(registry_versions)),
        "source_snapshot_version": next(iter(snapshot_versions)),
        "accepted_identity_namespace": "gbif",
    }


def _range_summary(range_seed: Mapping[str, Any]) -> dict[str, object]:
    regions = _list_of_mappings(range_seed.get("regions"), "regions")
    seen_codes: set[str] = set()
    status_counts: Counter[str] = Counter()
    normalized: list[dict[str, object]] = []
    for index, region in enumerate(regions):
        name = _required_text(region.get("region"), f"regions[{index}].region")
        status = _required_text(region.get("range_status"), f"regions[{index}].range_status")
        countries = _list_of_mappings(region.get("countries"), f"regions[{index}].countries")
        normalized_countries: list[dict[str, str]] = []
        for country in countries:
            code = _required_text(country.get("code"), "country.code")
            if _COUNTRY_CODE_PATTERN.fullmatch(code) is None or code in seen_codes:
                raise Phase14PilotAdapterError(f"invalid or duplicate range country code: {code}")
            seen_codes.add(code)
            normalized_countries.append(
                {"code": code, "name": _required_text(country.get("name"), "country.name")}
            )
        status_counts[status] += 1
        normalized.append(
            {
                "region": name,
                "range_status": status,
                "requires_occurrence_support": region.get("requires_occurrence_support") is True,
                "taxonomic_caution": region.get("taxonomic_caution") is True,
                "countries": normalized_countries,
            }
        )
    return {
        "accepted_taxon_key": range_seed["accepted_taxon_key"],
        "scientific_name": range_seed["scientific_name"],
        "region_count": len(normalized),
        "country_count": len(seen_codes),
        "region_counts_by_status": dict(sorted(status_counts.items())),
        "regions": normalized,
    }


def _regional_competitors(queries: Mapping[str, Any]) -> dict[str, object]:
    quotas = _mapping(queries.get("acquisition_quotas"), "acquisition_quotas")
    selected = _mapping(
        quotas.get("selected_regional_competitors"), "selected_regional_competitors"
    )
    keys = _string_list(selected.get("species"), "selected competitor species")
    names = {
        _required_text(row.get("accepted_taxon_key"), "query accepted_taxon_key"): _required_text(
            row.get("scientific_name"), "query scientific_name"
        )
        for row in _list_of_mappings(queries.get("queries"), "queries")
    }
    if any(key not in names for key in keys):
        raise Phase14PilotAdapterError("selected regional competitor lacks a source query")
    return {
        "candidate_count": len(keys),
        "minimum_per_species": selected["minimum_per_species"],
        "maximum_per_species": selected["maximum_per_species"],
        "candidates": [{"accepted_taxon_key": key, "scientific_name": names[key]} for key in keys],
    }


def _biological_negatives(
    queries: Mapping[str, Any],
    relationships: Mapping[str, Any],
) -> dict[str, object]:
    quotas = _mapping(queries.get("acquisition_quotas"), "acquisition_quotas")
    group_names = (
        "reviewed_false_winner_genera",
        "historical_false_winner_species",
        "broader_papilionidae",
        "other_insect_or_moth_negatives",
    )
    groups = {name: dict(_mapping(quotas.get(name), name)) for name in group_names}
    relationship_rows = _list_of_mappings(relationships.get("relationships"), "relationships")
    return {
        "groups": groups,
        "reviewed_false_winner_relationship_count": len(relationship_rows),
        "reviewed_false_winner_relationships": [dict(row) for row in relationship_rows],
        "all_groups_resolved": False,
    }


def _visual_domain_negatives(queries: Mapping[str, Any]) -> dict[str, object]:
    quotas = _mapping(queries.get("acquisition_quotas"), "acquisition_quotas")
    domain = _mapping(quotas.get("domain_negatives"), "domain_negatives")
    return {
        "classes": _string_list(domain.get("classes"), "domain negative classes"),
        "status": _required_text(domain.get("status"), "domain negatives status"),
        "selected_media_count": 0,
        "selection_artifact_available": False,
    }


def _artifact_identity(payload: Mapping[str, Any], key: str) -> dict[str, object]:
    return _validated_artifacts(payload, "artifacts")[key]


def _validated_artifacts(
    payload: Mapping[str, Any],
    label: str,
) -> dict[str, dict[str, object]]:
    artifacts = _mapping(payload.get("artifacts"), label)
    result: dict[str, dict[str, object]] = {}
    for key, raw in sorted(artifacts.items()):
        artifact = _mapping(raw, f"{label}.{key}")
        sha256 = _required_text(artifact.get("sha256"), f"{label}.{key}.sha256")
        if _PREFIXED_SHA256_PATTERN.fullmatch(sha256) is None:
            raise Phase14PilotAdapterError(f"{label}.{key}.sha256 is invalid")
        normalized: dict[str, object] = {
            "path": _required_text(artifact.get("path"), f"{label}.{key}.path"),
            "byte_count": _nonnegative_int(artifact.get("byte_count"), f"{label}.{key}.byte_count"),
            "sha256": sha256,
        }
        if "row_count" in artifact:
            normalized["row_count"] = _nonnegative_int(
                artifact.get("row_count"), f"{label}.{key}.row_count"
            )
        result[str(key)] = normalized
    return result


def _contract(
    *,
    candidate_semantics: str,
    verification_status: str,
    human_review_required: bool,
    sources: list[dict[str, object]],
    data: dict[str, object],
) -> PilotContract:
    return {
        "candidate_semantics": candidate_semantics,
        "verification_status": verification_status,
        "human_review_required": human_review_required,
        "scientific_claim_allowed": False,
        "source_artifacts": sources,
        "data": data,
    }


def _sources(
    sources: Mapping[str, dict[str, object]],
    *roles: str,
) -> list[dict[str, object]]:
    return [sources[role] for role in roles]


def _load_json_object(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(
            path.read_bytes(),
            object_pairs_hook=_reject_duplicate_keys,
            parse_constant=_reject_non_json_constant,
        )
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise Phase14PilotAdapterError(f"artifact is not strict UTF-8 JSON: {error}") from error
    if not isinstance(payload, dict):
        raise Phase14PilotAdapterError("artifact must be a JSON object")
    return payload


def _regular_file(path: Path) -> Path:
    if path.is_symlink():
        raise Phase14PilotAdapterError(f"artifact path must not be a symlink: {path}")
    resolved = path.resolve()
    if not resolved.is_file():
        raise Phase14PilotAdapterError(f"artifact is not a regular file: {resolved}")
    return resolved


def _safe_relative_path(value: object) -> str:
    text = _required_text(value, "imported_path")
    path = PurePosixPath(text)
    if (
        path.is_absolute()
        or path.as_posix() != text
        or any(part in {"", ".", ".."} for part in path.parts)
    ):
        raise Phase14PilotAdapterError(f"unsafe compact import path: {text}")
    return text


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def _require_prefixed_digest_match(value: object, bare_digest: object, label: str) -> None:
    expected = _required_text(value, f"{label} SHA-256")
    if _PREFIXED_SHA256_PATTERN.fullmatch(expected) is None or expected != f"sha256:{bare_digest}":
        raise Phase14PilotAdapterError(f"{label} SHA-256 cross-reference differs")


def _mapping(value: object, field: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise Phase14PilotAdapterError(f"{field} must be an object")
    return value


def _list_of_mappings(value: object, field: str) -> list[Mapping[str, Any]]:
    if not isinstance(value, list) or not all(isinstance(item, Mapping) for item in value):
        raise Phase14PilotAdapterError(f"{field} must be an array of objects")
    return value


def _string_list(value: object, field: str) -> list[str]:
    if not isinstance(value, list):
        raise Phase14PilotAdapterError(f"{field} must be an array")
    result = [_required_text(item, field) for item in value]
    if len(result) != len(set(result)):
        raise Phase14PilotAdapterError(f"{field} must contain unique strings")
    return result


def _required_text(value: object, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise Phase14PilotAdapterError(f"{field} must be a non-empty string")
    return value.strip()


def _nonnegative_int(value: object, field: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise Phase14PilotAdapterError(f"{field} must be a non-negative integer")
    return value


def _nonnegative_count_mapping(value: object, field: str) -> dict[str, int]:
    raw = _mapping(value, field)
    return {
        str(key): _nonnegative_int(count, f"{field}.{key}") for key, count in sorted(raw.items())
    }


def _require_exact_booleans(
    payload: Mapping[str, Any],
    expected: Mapping[str, bool],
    *,
    label: str,
) -> None:
    for key, value in expected.items():
        if payload.get(key) is not value:
            raise Phase14PilotAdapterError(f"{label}.{key} must be {value}")


def _reject_duplicate_keys(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise Phase14PilotAdapterError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def _reject_non_json_constant(value: str) -> None:
    if not math.isfinite(float(value)):
        raise Phase14PilotAdapterError(f"non-JSON numeric constant: {value}")
    raise Phase14PilotAdapterError(f"unexpected numeric constant: {value}")


__all__ = [
    "COMPACT_IMPORT_SCHEMA_VERSION",
    "DEFAULT_IMPORT_MANIFEST",
    "PILOT_METADATA_ADAPTER_SCHEMA_VERSION",
    "Phase14PilotAdapterError",
    "SECTION_NAMES",
    "adapt_current_pilot_metadata",
]
