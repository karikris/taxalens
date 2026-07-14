"""Adapt committed BioMiner query definition and geography artifacts."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, TypedDict


class QueryGeographyAdapterError(ValueError):
    """Raised when committed BioMiner query/geography artifacts cannot be adapted."""


class QueryDefinitionContract(TypedDict):
    schema_version: str
    biominer_commit: str | None
    query_definition_id: str
    logical_query_id: str | None
    canonical_keyword_id: str | None
    keyword_id: str | None
    registry_schema_version: str | None
    compiler_version: str | None
    registry_version: str | None
    accepted_taxon_key: str | None
    accepted_scientific_name: str | None
    accepted_rank: str | None
    family_key: str | None
    family: str | None
    genus_key: str | None
    genus: str | None
    species_key: str | None
    species: str | None
    name_id: str | None
    source_term: str | None
    normalized_query_term: str | None
    normalized_match_key: str | None
    language: str | None
    api_language_code: str | None
    script: str | None
    region: str | None
    bcp47: str | None
    bbox: str | None
    name_class: str | None
    source: str | None
    source_taxon_id: str | None
    lineage_check: str | None
    trust_tier: str | None
    original_trust_tier: str | None
    effective_trust_tier: str | None
    confidence: str | None
    precision_tier: str | None
    search_field: str | None
    search_priority: int | None
    enabled: bool | None
    disabled_reason: str | None
    query_eligible: bool | None
    query_disabled_reason: str | None
    species_specificity_score: float | None


class QueryDefinitionSummaryContract(TypedDict):
    schema_version: str
    biominer_commit: str | None
    run_id: str
    source_manifest_path: str | None
    query_definition_artifact_path: str | None
    total_query_definitions: int | None
    eligible_query_definitions: int | None
    ineligible_query_definitions: int | None
    disabled_query_definitions: int | None
    query_definitions_by_source: dict[str, int] | None
    query_definitions_by_rank: dict[str, int] | None
    max_search_priority: int | None
    query_curation_rule_count: int | None


class GeographicSpreadRecordContract(TypedDict):
    schema_version: str | None
    registry_version: str | None
    accepted_taxon_key: str | None
    gbif_species_key: int | None
    scientific_name: str | None
    source: str | None
    source_dataset_key: str | None
    source_dataset_citation: str | None
    source_query_hash: str | None
    spatial_cell_id: str | None
    spatial_resolution: int | None
    country_code: str | None
    admin1: str | None
    bioregion: str | None
    centroid_latitude: float | None
    centroid_longitude: float | None
    occurrence_count: int | None
    georeferenced_occurrence_count: int | None
    range_inference_eligible_count: int | None
    preserved_specimen_count: int | None
    fossil_count: int | None
    geospatial_issue_count: int | None
    coordinate_uncertainty_summary: dict[str, int] | None
    earliest_occurrence_date: str | None
    latest_occurrence_date: str | None
    known_range_role: str | None
    taxon_key_match: bool | None
    coordinate_valid: bool | None


class GeographicOccurrenceEvidenceContract(TypedDict):
    schema_version: str | None
    source: str | None
    gbif_id: str | None
    accepted_taxon_key: str | None
    scientific_name: str | None
    source_dataset_key: str | None
    source_dataset_name: str | None
    basis_of_record: str | None
    country_code: str | None
    admin1_code: str | None
    coordinate_latitude: float | None
    coordinate_longitude: float | None
    event_date: str | None
    coordinate_uncertainty_m: float | None
    georeferenced: bool | None
    preserved_specimen: bool | None
    range_inference_eligible: bool | None
    known_range_role: str | None


class GeographicSpreadManifestSummaryContract(TypedDict):
    schema_version: str
    biominer_commit: str | None
    run_id: str
    source_manifest_path: str | None
    geographic_spread_manifest_path: str | None
    taxon_geographic_spread_artifact_path: str | None
    geographic_occurrence_evidence_artifact_path: str | None
    status: str | None
    retrieved_at: str | None
    resumed: bool | None
    completed_occurrence_count: int | None
    invalid_coordinate_count: int | None
    taxon_key_mismatch_count: int | None
    range_inference_eligible_occurrence_count: int | None
    evidence_row_count: int | None
    evidence_confidence_method: str | None
    spread_row_count: int | None
    checkpoint_part_count: int | None
    source_total_records: int | None
    source: str | None
    source_query_hash: str | None
    source_snapshot_version: str | None


class TaxonGeographicSummaryRecordContract(TypedDict):
    schema_version: str | None
    registry_version: str | None
    accepted_taxon_key: str | None
    scientific_name: str | None
    geographic_evidence_version: str | None
    cell_counts_by_resolution: list[dict[str, int]] | None
    countries: list[str] | None
    admin_regions: list[str] | None
    occupied_envelope: dict[str, float | bool | str] | None
    disconnected_range_component_count: int | None
    occurrence_density_summary: dict[str, float] | None
    data_deficient: bool | None
    data_deficient_reasons: list[str] | None
    suspicious_outlier_cell_count: int | None
    range_source_coverage: list[dict[str, int]] | None
    known_introduced_regions: list[str] | None
    current_evidence_count: int | None
    historical_evidence_count: int | None
    spread_fingerprint: str | None
    created_at: str | None


class GeographicSummaryManifestSummaryContract(TypedDict):
    schema_version: str
    biominer_commit: str | None
    run_id: str
    source_manifest_path: str | None
    geographic_summary_manifest_path: str | None
    taxon_geographic_summary_artifact_path: str | None
    geographic_qa_findings_artifact_path: str | None
    status: str | None
    qa_status: str | None
    qa_fatal_count: int | None
    qa_warning_count: int | None
    summary_row_count: int | None
    qa_row_count: int | None
    created_at: str | None
    policy_version: str | None
    grid_name: str | None
    grid_version: str | None


def _first_str(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _to_int(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        if value.is_integer():
            return int(value)
        return None
    if value is None:
        return None
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None


def _to_float(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if value is None:
        return None
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return None


def _to_bool(value: Any) -> bool | None:
    if isinstance(value, bool):
        return value
    if value is None:
        return None
    text = str(value).strip().lower()
    if text in {"1", "true", "yes", "on", "y"}:
        return True
    if text in {"0", "false", "no", "off", "n"}:
        return False
    return None


def _to_float_dict(value: Any) -> dict[str, float] | None:
    if not isinstance(value, dict):
        return None
    out: dict[str, float] = {}
    for key, raw in value.items():
        key_text = _first_str(key)
        if key_text is None:
            continue
        number = _to_float(raw)
        if number is None:
            continue
        out[key_text] = number
    return out or None


def _to_int_dict(value: Any) -> dict[str, int] | None:
    if not isinstance(value, dict):
        return None
    out: dict[str, int] = {}
    for key, raw in value.items():
        key_text = _first_str(key)
        if key_text is None:
            continue
        number = _to_int(raw)
        if number is None:
            continue
        out[key_text] = number
    return out or None


def _to_string_dict(value: Any) -> dict[str, str] | None:
    if not isinstance(value, dict):
        return None
    out: dict[str, str] = {}
    for key, raw in value.items():
        key_text = _first_str(key)
        value_text = _first_str(raw)
        if key_text is None or value_text is None:
            continue
        out[key_text] = value_text
    return out or None


def _to_string_list(value: Any) -> list[str] | None:
    if not isinstance(value, list):
        return None
    out: list[str] = []
    for item in value:
        item_text = _first_str(item)
        if item_text is not None:
            out.append(item_text)
    return out or None


def _is_parquet_path(path: Path) -> bool:
    return path.suffix.lower() == ".parquet"


def _load_json(payload_path: Path) -> Any:
    try:
        return json.loads(payload_path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise QueryGeographyAdapterError(f"Artifact not found: {payload_path}") from exc
    except json.JSONDecodeError as exc:
        raise QueryGeographyAdapterError(
            f"Artifact is not valid JSON: {payload_path}"
        ) from exc


def _load_manifest(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise QueryGeographyAdapterError(f"Run manifest not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise QueryGeographyAdapterError(f"Run manifest is not valid JSON: {path}") from exc
    if not isinstance(payload, dict):
        raise QueryGeographyAdapterError("Run manifest payload must be a JSON object")
    return payload


def _extract_rows(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        rows = payload
    elif isinstance(payload, dict):
        candidate = (
            payload.get("rows")
            or payload.get("data")
            or payload.get("definitions")
            or payload.get("query_definitions")
            or payload.get("candidates")
        )
        if isinstance(candidate, list):
            rows = candidate
        else:
            return []
    else:
        return []
    return [row for row in rows if isinstance(row, dict)]


def _resolve_artifact_path(
    outputs: Any,
    manifest_dir: Path,
    *keys: str,
) -> Path | None:
    if not isinstance(outputs, dict):
        return None
    for key in keys:
        raw = _first_str(outputs.get(key))
        if raw is None:
            continue
        path = Path(raw)
        if not path.is_absolute():
            path = (manifest_dir / path).resolve()
        return path
    return None


def _bucket_count(rows: list[dict[str, Any]], key: str) -> dict[str, int]:
    buckets: dict[str, int] = {}
    for row in rows:
        bucket = _first_str(row.get(key))
        if bucket is None:
            continue
        buckets[bucket] = buckets.get(bucket, 0) + 1
    return buckets


def _map_query_definition(
    row: dict[str, Any],
    biominer_commit: str | None,
) -> QueryDefinitionContract:
    return {
        "schema_version": _first_str(row.get("registry_schema_version")) or "query_definition:v1",
        "biominer_commit": biominer_commit,
        "query_definition_id": _first_str(row.get("query_definition_id"))
        or "unknown-query-definition-id",
        "logical_query_id": _first_str(row.get("logical_query_id")),
        "canonical_keyword_id": _first_str(row.get("canonical_keyword_id")),
        "keyword_id": _first_str(row.get("keyword_id")),
        "registry_schema_version": _first_str(row.get("registry_schema_version")),
        "compiler_version": _first_str(row.get("compiler_version")),
        "registry_version": _first_str(row.get("registry_version")),
        "accepted_taxon_key": _first_str(row.get("accepted_taxon_key")),
        "accepted_scientific_name": _first_str(row.get("accepted_scientific_name")),
        "accepted_rank": _first_str(row.get("accepted_rank")),
        "family_key": _first_str(row.get("family_key")),
        "family": _first_str(row.get("family")),
        "genus_key": _first_str(row.get("genus_key")),
        "genus": _first_str(row.get("genus")),
        "species_key": _first_str(row.get("species_key")),
        "species": _first_str(row.get("species")),
        "name_id": _first_str(row.get("name_id")),
        "source_term": _first_str(row.get("source_term")),
        "normalized_query_term": _first_str(row.get("normalized_query_term")),
        "normalized_match_key": _first_str(row.get("normalized_match_key")),
        "language": _first_str(row.get("language")),
        "api_language_code": _first_str(row.get("api_language_code")),
        "script": _first_str(row.get("script")),
        "region": _first_str(row.get("region")),
        "bcp47": _first_str(row.get("bcp47")),
        "bbox": _first_str(row.get("bbox")),
        "name_class": _first_str(row.get("name_class")),
        "source": _first_str(row.get("source")),
        "source_taxon_id": _first_str(row.get("source_taxon_id")),
        "lineage_check": _first_str(row.get("lineage_check")),
        "trust_tier": _first_str(row.get("trust_tier")),
        "original_trust_tier": _first_str(row.get("original_trust_tier")),
        "effective_trust_tier": _first_str(row.get("effective_trust_tier")),
        "confidence": _first_str(row.get("confidence")),
        "precision_tier": _first_str(row.get("precision_tier")),
        "search_field": _first_str(row.get("search_field")),
        "search_priority": _to_int(row.get("search_priority")),
        "enabled": _to_bool(row.get("enabled")),
        "disabled_reason": _first_str(row.get("disabled_reason")),
        "query_eligible": _to_bool(row.get("query_eligible")),
        "query_disabled_reason": _first_str(row.get("query_disabled_reason")),
        "species_specificity_score": _to_float(row.get("species_specificity_score")),
    }


def _build_query_summary(
    rows: list[dict[str, Any]],
    run_id: str,
    source_manifest_path: str,
    artifact_path: Path | None,
    biominer_commit: str | None,
) -> QueryDefinitionSummaryContract:
    total = len(rows)
    eligible = sum(1 for row in rows if _to_bool(row.get("query_eligible")) is True)
    ineligible = sum(1 for row in rows if _to_bool(row.get("query_eligible")) is False)
    disabled = sum(1 for row in rows if _to_bool(row.get("enabled")) is False)

    max_priority: int | None = None
    for row in rows:
        candidate = _to_int(row.get("search_priority"))
        if candidate is not None and (max_priority is None or candidate > max_priority):
            max_priority = candidate

    raw_rule_count = 0
    for row in rows:
        rules = row.get("query_curation_rules")
        if isinstance(rules, list):
            raw_rule_count += len(rules)

    return {
        "schema_version": "query_definition_summary:v1",
        "biominer_commit": biominer_commit,
        "run_id": run_id,
        "source_manifest_path": source_manifest_path,
        "query_definition_artifact_path": str(artifact_path) if artifact_path else None,
        "total_query_definitions": total if total else None,
        "eligible_query_definitions": eligible if eligible else None,
        "ineligible_query_definitions": ineligible if ineligible else None,
        "disabled_query_definitions": disabled if disabled else None,
        "query_definitions_by_source": _to_int_dict(_bucket_count(rows, "source")),
        "query_definitions_by_rank": _to_int_dict(_bucket_count(rows, "accepted_rank")),
        "max_search_priority": max_priority,
        "query_curation_rule_count": raw_rule_count if raw_rule_count else None,
    }


def _map_geographic_spread_row(
    row: dict[str, Any]
) -> GeographicSpreadRecordContract:
    return {
        "schema_version": _first_str(row.get("schema_version")),
        "registry_version": _first_str(row.get("registry_version")),
        "accepted_taxon_key": _first_str(row.get("accepted_taxon_key")),
        "gbif_species_key": _to_int(row.get("gbif_species_key")),
        "scientific_name": _first_str(row.get("scientific_name")),
        "source": _first_str(row.get("source")),
        "source_dataset_key": _first_str(row.get("source_dataset_key")),
        "source_dataset_citation": _first_str(row.get("source_dataset_citation")),
        "source_query_hash": _first_str(row.get("source_query_hash")),
        "spatial_cell_id": _first_str(row.get("spatial_cell_id")),
        "spatial_resolution": _to_int(row.get("spatial_resolution")),
        "country_code": _first_str(row.get("country_code")),
        "admin1": _first_str(row.get("admin1")),
        "bioregion": _first_str(row.get("bioregion")),
        "centroid_latitude": _to_float(row.get("centroid_latitude")),
        "centroid_longitude": _to_float(row.get("centroid_longitude")),
        "occurrence_count": _to_int(row.get("occurrence_count")),
        "georeferenced_occurrence_count": _to_int(row.get("georeferenced_occurrence_count")),
        "range_inference_eligible_count": _to_int(row.get("range_inference_eligible_count")),
        "preserved_specimen_count": _to_int(row.get("preserved_specimen_count")),
        "fossil_count": _to_int(row.get("fossil_count")),
        "geospatial_issue_count": _to_int(row.get("geospatial_issue_count")),
        "coordinate_uncertainty_summary": _to_int_dict(
            row.get("coordinate_uncertainty_summary")
        ),
        "earliest_occurrence_date": _first_str(row.get("earliest_occurrence_date")),
        "latest_occurrence_date": _first_str(row.get("latest_occurrence_date")),
        "known_range_role": _first_str(row.get("known_range_role")),
        "taxon_key_match": _to_bool(row.get("taxon_key_match")),
        "coordinate_valid": _to_bool(row.get("coordinate_valid")),
    }


def _map_occurrence_evidence_row(
    row: dict[str, Any]
) -> GeographicOccurrenceEvidenceContract:
    return {
        "schema_version": _first_str(row.get("schema_version")),
        "source": _first_str(row.get("source")),
        "gbif_id": _first_str(row.get("gbif_id")) or _first_str(row.get("gbifId")),
        "accepted_taxon_key": _first_str(row.get("accepted_taxon_key")),
        "scientific_name": _first_str(row.get("scientific_name")),
        "source_dataset_key": _first_str(row.get("source_dataset_key")),
        "source_dataset_name": _first_str(row.get("source_dataset_name")),
        "basis_of_record": _first_str(row.get("basis_of_record")),
        "country_code": _first_str(row.get("country_code")),
        "admin1_code": _first_str(row.get("admin1_code")),
        "coordinate_latitude": _to_float(row.get("coordinate_latitude")),
        "coordinate_longitude": _to_float(row.get("coordinate_longitude")),
        "event_date": _first_str(row.get("event_date")) or _first_str(row.get("eventDate")),
        "coordinate_uncertainty_m": _to_float(row.get("coordinate_uncertainty_m")),
        "georeferenced": _to_bool(row.get("georeferenced")),
        "preserved_specimen": _to_bool(row.get("preserved_specimen")),
        "range_inference_eligible": _to_bool(row.get("range_inference_eligible")),
        "known_range_role": _first_str(row.get("known_range_role")),
    }


def _map_taxon_geographic_summary_row(
    row: dict[str, Any]
) -> TaxonGeographicSummaryRecordContract:
    occupied_envelope = row.get("occupied_envelope")
    if not isinstance(occupied_envelope, dict):
        occupied_envelope = _to_string_dict(occupied_envelope)

    return {
        "schema_version": _first_str(row.get("schema_version")),
        "registry_version": _first_str(row.get("registry_version")),
        "accepted_taxon_key": _first_str(row.get("accepted_taxon_key")),
        "scientific_name": _first_str(row.get("scientific_name")),
        "geographic_evidence_version": _first_str(row.get("geographic_evidence_version")),
        "cell_counts_by_resolution": (
            row.get("cell_counts_by_resolution")
            if isinstance(row.get("cell_counts_by_resolution"), list)
            else None
        ),
        "countries": _to_string_list(row.get("countries")),
        "admin_regions": _to_string_list(row.get("admin_regions")),
        "occupied_envelope": (
            {str(key): value for key, value in occupied_envelope.items()}
            if isinstance(occupied_envelope, dict)
            else occupied_envelope
        ),
        "disconnected_range_component_count": _to_int(row.get("disconnected_range_component_count")),
        "occurrence_density_summary": _to_float_dict(row.get("occurrence_density_summary")),
        "data_deficient": _to_bool(row.get("data_deficient")),
        "data_deficient_reasons": _to_string_list(row.get("data_deficient_reasons")),
        "suspicious_outlier_cell_count": _to_int(row.get("suspicious_outlier_cell_count")),
        "range_source_coverage": (
            row.get("range_source_coverage")
            if isinstance(row.get("range_source_coverage"), list)
            else None
        ),
        "known_introduced_regions": _to_string_list(row.get("known_introduced_regions")),
        "current_evidence_count": _to_int(row.get("current_evidence_count")),
        "historical_evidence_count": _to_int(row.get("historical_evidence_count")),
        "spread_fingerprint": _first_str(row.get("spread_fingerprint")),
        "created_at": _first_str(row.get("created_at")),
    }


def _map_geographic_spread_manifest_summary(
    payload: dict[str, Any] | None,
    run_id: str,
    source_manifest_path: str,
    spread_artifact_path: Path | None,
    occurrence_artifact_path: Path | None,
    manifest_path: Path | None,
    spread_rows: list[dict[str, Any]],
    occurrence_rows: list[dict[str, Any]],
    biominer_commit: str | None,
) -> GeographicSpreadManifestSummaryContract:
    if payload is None:
        return {
            "schema_version": "geographic_spread_manifest_summary:v1",
            "biominer_commit": biominer_commit,
            "run_id": run_id,
            "source_manifest_path": source_manifest_path,
            "geographic_spread_manifest_path": str(manifest_path) if manifest_path else None,
            "taxon_geographic_spread_artifact_path": str(spread_artifact_path)
            if spread_artifact_path
            else None,
            "geographic_occurrence_evidence_artifact_path": str(occurrence_artifact_path)
            if occurrence_artifact_path
            else None,
            "status": None,
            "retrieved_at": None,
            "resumed": None,
            "completed_occurrence_count": None,
            "invalid_coordinate_count": None,
            "taxon_key_mismatch_count": None,
            "range_inference_eligible_occurrence_count": None,
            "evidence_row_count": len(occurrence_rows),
            "evidence_confidence_method": None,
            "spread_row_count": len(spread_rows),
            "checkpoint_part_count": None,
            "source_total_records": None,
            "source": None,
            "source_query_hash": None,
            "source_snapshot_version": None,
        }

    identity = payload.get("identity")
    if not isinstance(identity, dict):
        identity = {}

    return {
        "schema_version": "geographic_spread_manifest_summary:v1",
        "biominer_commit": biominer_commit,
        "run_id": _first_str(payload.get("run_id")) or run_id,
        "source_manifest_path": source_manifest_path,
        "geographic_spread_manifest_path": str(manifest_path) if manifest_path else None,
        "taxon_geographic_spread_artifact_path": str(spread_artifact_path)
        if spread_artifact_path
        else None,
        "geographic_occurrence_evidence_artifact_path": str(occurrence_artifact_path)
        if occurrence_artifact_path
        else None,
        "status": _first_str(payload.get("status")),
        "retrieved_at": _first_str(payload.get("retrieved_at")),
        "resumed": _to_bool(payload.get("resumed")),
        "completed_occurrence_count": _to_int(payload.get("completed_occurrence_count")),
        "invalid_coordinate_count": _to_int(payload.get("invalid_coordinate_count")),
        "taxon_key_mismatch_count": _to_int(payload.get("taxon_key_mismatch_count")),
        "range_inference_eligible_occurrence_count": _to_int(
            payload.get("range_inference_eligible_occurrence_count")
        ),
        "evidence_row_count": _to_int(payload.get("evidence_row_count"))
        if _to_int(payload.get("evidence_row_count")) is not None
        else len(occurrence_rows),
        "evidence_confidence_method": _first_str(payload.get("evidence_confidence_method")),
        "spread_row_count": _to_int(payload.get("spread_row_count"))
        if _to_int(payload.get("spread_row_count")) is not None
        else len(spread_rows),
        "checkpoint_part_count": _to_int(payload.get("checkpoint_part_count")),
        "source_total_records": _to_int(payload.get("source_total_records")),
        "source": _first_str(payload.get("source"))
        or _first_str(identity.get("source")),
        "source_query_hash": _first_str(payload.get("source_query_hash"))
        or _first_str(identity.get("source_query_hash")),
        "source_snapshot_version": _first_str(payload.get("source_snapshot_version"))
        or _first_str(identity.get("source_snapshot_version")),
    }


def _map_geographic_summary_manifest_summary(
    payload: dict[str, Any] | None,
    run_id: str,
    source_manifest_path: str,
    summary_artifact_path: Path | None,
    qa_artifact_path: Path | None,
    manifest_path: Path | None,
    summary_rows: list[dict[str, Any]],
    biominer_commit: str | None,
) -> GeographicSummaryManifestSummaryContract:
    policy = payload.get("policy") if isinstance(payload, dict) else None
    if not isinstance(policy, dict):
        policy = {}

    summary_row_count = (
        _to_int(payload.get("summary_row_count")) if isinstance(payload, dict) else None
    )
    if summary_row_count is None:
        summary_row_count = len(summary_rows)

    return {
        "schema_version": "geographic_summary_manifest_summary:v1",
        "biominer_commit": biominer_commit,
        "run_id": _first_str(payload.get("run_id")) or run_id if isinstance(payload, dict) else run_id,
        "source_manifest_path": source_manifest_path,
        "geographic_summary_manifest_path": str(manifest_path) if manifest_path else None,
        "taxon_geographic_summary_artifact_path": str(summary_artifact_path)
        if summary_artifact_path
        else None,
        "geographic_qa_findings_artifact_path": str(qa_artifact_path) if qa_artifact_path else None,
        "status": _first_str(payload.get("status")) if isinstance(payload, dict) else None,
        "qa_status": _first_str(payload.get("qa_status")) if isinstance(payload, dict) else None,
        "qa_fatal_count": _to_int(payload.get("qa_fatal_count")) if isinstance(payload, dict) else None,
        "qa_warning_count": _to_int(payload.get("qa_warning_count")) if isinstance(payload, dict) else None,
        "summary_row_count": summary_row_count,
        "qa_row_count": _to_int(payload.get("qa_row_count")) if isinstance(payload, dict) else None,
        "created_at": _first_str(payload.get("created_at")) if isinstance(payload, dict) else None,
        "policy_version": _first_str(policy.get("policy_version")),
        "grid_name": _first_str(payload.get("grid_name")) if isinstance(payload, dict) else None,
        "grid_version": _first_str(payload.get("grid_version")) if isinstance(payload, dict) else None,
    }


def adapt_query_geography_artifacts(
    *, manifest_path: str | Path, biominer_commit: str
) -> dict[str, Any]:
    if not isinstance(biominer_commit, str) or len(biominer_commit) != 40:
        raise QueryGeographyAdapterError("biominer_commit must be a full 40-character SHA")

    manifest_path = Path(manifest_path)
    manifest_payload = _load_manifest(manifest_path)
    run_id = _first_str(manifest_payload.get("run_id")) or "unknown-run"
    outputs = manifest_payload.get("outputs")

    query_path = _resolve_artifact_path(
        outputs, manifest_path.parent, "query_definitions", "flickr_query_definitions"
    )
    spread_path = _resolve_artifact_path(
        outputs, manifest_path.parent, "taxon_geographic_spread", "geographic_spread"
    )
    occurrence_path = _resolve_artifact_path(
        outputs,
        manifest_path.parent,
        "geographic_occurrence_evidence",
        "occurrence_evidence",
    )
    spread_manifest_path = _resolve_artifact_path(
        outputs, manifest_path.parent, "geographic_spread_manifest"
    )
    summary_path = _resolve_artifact_path(
        outputs, manifest_path.parent, "taxon_geographic_summary", "geographic_summary"
    )
    summary_manifest_path = _resolve_artifact_path(
        outputs,
        manifest_path.parent,
        "geographic_summary_manifest",
        "geographic_summary_manifest_file",
    )
    qa_findings_path = _resolve_artifact_path(
        outputs,
        manifest_path.parent,
        "geographic_qa_findings",
        "taxon_geographic_qa_findings",
    )

    notes: list[str] = []
    query_rows_raw: list[dict[str, Any]] = []
    spread_rows_raw: list[dict[str, Any]] = []
    occurrence_rows_raw: list[dict[str, Any]] = []
    summary_rows_raw: list[dict[str, Any]] = []
    compatibility_query_rows = 0
    compatibility_spread_rows = 0
    compatibility_occurrence_rows = 0
    compatibility_summary_rows = 0

    if query_path is None:
        notes.append("run manifest did not declare query definition artifact path")
    elif _is_parquet_path(query_path):
        notes.append(
            f"query definitions artifact is parquet and not parsed in deterministic replay fixtures: {query_path}"
        )
    else:
        try:
            query_payload = _load_json(query_path)
            query_rows_raw = _extract_rows(query_payload)
            compatibility_query_rows = len(query_rows_raw)
        except QueryGeographyAdapterError as exc:
            notes.append(f"failed to parse query definitions artifact at {query_path}")
            notes.append(str(exc))

    if spread_path is None:
        notes.append("run manifest did not declare taxon_geographic_spread artifact path")
    elif _is_parquet_path(spread_path):
        notes.append(
            f"taxon_geographic_spread artifact is parquet and not parsed in deterministic replay fixtures: {spread_path}"
        )
    else:
        try:
            spread_payload = _load_json(spread_path)
            spread_rows_raw = _extract_rows(spread_payload)
            compatibility_spread_rows = len(spread_rows_raw)
        except QueryGeographyAdapterError as exc:
            notes.append(f"failed to parse taxon_geographic_spread artifact at {spread_path}")
            notes.append(str(exc))

    if occurrence_path is None:
        notes.append(
            "run manifest did not declare geographic_occurrence_evidence artifact path"
        )
    elif _is_parquet_path(occurrence_path):
        notes.append(
            f"geographic_occurrence_evidence artifact is parquet and not parsed in deterministic replay fixtures: {occurrence_path}"
        )
    else:
        try:
            occurrence_payload = _load_json(occurrence_path)
            occurrence_rows_raw = _extract_rows(occurrence_payload)
            compatibility_occurrence_rows = len(occurrence_rows_raw)
        except QueryGeographyAdapterError as exc:
            notes.append(
                f"failed to parse geographic_occurrence_evidence artifact at {occurrence_path}"
            )
            notes.append(str(exc))

    if summary_path is None:
        notes.append("run manifest did not declare taxon_geographic_summary artifact path")
    elif _is_parquet_path(summary_path):
        notes.append(
            f"taxon_geographic_summary artifact is parquet and not parsed in deterministic replay fixtures: {summary_path}"
        )
    else:
        try:
            summary_payload = _load_json(summary_path)
            summary_rows_raw = _extract_rows(summary_payload)
            compatibility_summary_rows = len(summary_rows_raw)
        except QueryGeographyAdapterError as exc:
            notes.append(f"failed to parse taxon_geographic_summary artifact at {summary_path}")
            notes.append(str(exc))

    spread_manifest_payload: dict[str, Any] | None = None
    if spread_manifest_path is None:
        notes.append("run manifest did not declare geographic_spread_manifest artifact path")
    elif _is_parquet_path(spread_manifest_path):
        notes.append(
            f"geographic_spread_manifest is parquet and not parsed in deterministic replay fixtures: {spread_manifest_path}"
        )
    else:
        try:
            loaded_spread_manifest = _load_json(spread_manifest_path)
            if isinstance(loaded_spread_manifest, dict):
                spread_manifest_payload = loaded_spread_manifest
            else:
                notes.append(
                    f"geographic_spread_manifest was not a JSON object at {spread_manifest_path}"
                )
        except QueryGeographyAdapterError:
            notes.append(
                f"failed to parse geographic_spread_manifest at {spread_manifest_path}"
            )

    summary_manifest_payload: dict[str, Any] | None = None
    if summary_manifest_path is None:
        notes.append("run manifest did not declare geographic_summary_manifest artifact path")
    elif _is_parquet_path(summary_manifest_path):
        notes.append(
            f"geographic_summary_manifest is parquet and not parsed in deterministic replay fixtures: {summary_manifest_path}"
        )
    else:
        try:
            loaded_summary_manifest = _load_json(summary_manifest_path)
            if isinstance(loaded_summary_manifest, dict):
                summary_manifest_payload = loaded_summary_manifest
            else:
                notes.append(
                    f"geographic_summary_manifest was not a JSON object at {summary_manifest_path}"
                )
        except QueryGeographyAdapterError:
            notes.append(
                f"failed to parse geographic_summary_manifest at {summary_manifest_path}"
            )

    query_definitions = [
        _map_query_definition(row, biominer_commit) for row in query_rows_raw
    ]
    spread_rows = [_map_geographic_spread_row(row) for row in spread_rows_raw]
    occurrence_rows = [
        _map_occurrence_evidence_row(row) for row in occurrence_rows_raw
    ]
    summary_rows = [
        _map_taxon_geographic_summary_row(row) for row in summary_rows_raw
    ]

    query_definition_summary = _build_query_summary(
        query_rows_raw,
        run_id=run_id,
        source_manifest_path=str(manifest_path),
        artifact_path=query_path,
        biominer_commit=biominer_commit,
    )

    geographic_spread_manifest_summary = _map_geographic_spread_manifest_summary(
        payload=spread_manifest_payload,
        run_id=run_id,
        source_manifest_path=str(manifest_path),
        spread_artifact_path=spread_path,
        occurrence_artifact_path=occurrence_path,
        manifest_path=spread_manifest_path,
        spread_rows=spread_rows,
        occurrence_rows=occurrence_rows,
        biominer_commit=biominer_commit,
    )
    geographic_summary_manifest_summary = _map_geographic_summary_manifest_summary(
        payload=summary_manifest_payload,
        run_id=run_id,
        source_manifest_path=str(manifest_path),
        summary_artifact_path=summary_path,
        qa_artifact_path=qa_findings_path,
        manifest_path=summary_manifest_path,
        summary_rows=summary_rows_raw,
        biominer_commit=biominer_commit,
    )

    return {
        "query_definitions": query_definitions,
        "query_definition_summary": query_definition_summary,
        "geographic_spread_rows": spread_rows,
        "geographic_occurrence_evidence_rows": occurrence_rows,
        "taxon_geographic_summary_rows": summary_rows,
        "geographic_spread_manifest_summary": geographic_spread_manifest_summary,
        "geographic_summary_manifest_summary": geographic_summary_manifest_summary,
        "compatibility": {
            "source_path": str(manifest_path),
            "run_id": run_id,
            "query_definition_path": str(query_path) if query_path else None,
            "query_definition_rows_read": compatibility_query_rows,
            "taxon_geographic_spread_path": str(spread_path) if spread_path else None,
            "taxon_geographic_spread_rows_read": compatibility_spread_rows,
            "geographic_occurrence_evidence_path": str(occurrence_path)
            if occurrence_path
            else None,
            "geographic_occurrence_evidence_rows_read": compatibility_occurrence_rows,
            "taxon_geographic_summary_path": str(summary_path) if summary_path else None,
            "taxon_geographic_summary_rows_read": compatibility_summary_rows,
            "geographic_spread_manifest_path": str(spread_manifest_path)
            if spread_manifest_path
            else None,
            "geographic_summary_manifest_path": str(summary_manifest_path)
            if summary_manifest_path
            else None,
            "geographic_qa_findings_path": str(qa_findings_path)
            if qa_findings_path
            else None,
            "notes": notes,
        },
    }
