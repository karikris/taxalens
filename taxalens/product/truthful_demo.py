"""Build the bounded, metadata-only Papilio pilot judge fixture."""

from __future__ import annotations

import hashlib
import json
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from packages.replay.src.biominer_phase14_pilot_adapter import (
    DEFAULT_IMPORT_MANIFEST,
    adapt_current_pilot_metadata,
)

from taxalens.product.judge_bundle import (
    JUDGE_BUNDLE_SCHEMA_VERSION,
    JUDGE_BUNDLE_SECTION_NAMES,
    compute_inventory_sha256,
    compute_payload_root_sha256,
    load_judge_bundle,
)

TRUTHFUL_DEMO_SCHEMA_VERSION = "taxalens-truthful-demo-fixture:v1.0.0"
TRUTHFUL_DEMO_BUNDLE_ID = "papilio-demoleus-pilot-75461d9c-v1"
TRUTHFUL_DEMO_CREATED_AT = "2026-07-15T15:30:00Z"
TRUTHFUL_DEMO_BIOMINER_SHA = "75461d9c065af0cd96b41cd1f845c2e920f7ae34"
TRUTHFUL_DEMO_TAXALENS_SHA = "188187d73ca8e0ef2c670bdf6cefcb20c8a59d9d"
TRUTHFUL_DEMO_HERO_ID = "papilio-demoleus-pilot-awaiting-review"
DEFAULT_TRUTHFUL_DEMO_ROOT = Path("demo/fixture/papilio_pilot")
DEFAULT_ANALYTICS_IMPORT_MANIFEST = Path(
    "demo/source/biominer_phase14/analytics_import_manifest.json"
)

_BIOMINER_REPOSITORY = "karikris/BioMiner"
_TAXALENS_REPOSITORY = "karikris/TaxaLens"


@dataclass(frozen=True, slots=True)
class _ArtifactSpec:
    artifact_id: str
    path: str
    role: str
    schema_version: str
    source_repository: str
    source_commit: str
    payload: object | bytes
    record_count: int
    media_type: str = "application/json"


def _pilot_contract(pilot: dict[str, Any], name: str) -> dict[str, Any]:
    contracts = pilot["contracts"]
    if not isinstance(contracts, dict):
        raise ValueError("pilot contracts must be an object")
    contract = contracts[name]
    if not isinstance(contract, dict):
        raise ValueError(f"pilot contract {name} must be an object")
    return contract


def _record(
    pilot: dict[str, Any],
    contract_name: str,
    *,
    record_id: str,
    data: object | None = None,
) -> dict[str, Any]:
    contract = _pilot_contract(pilot, contract_name)
    return {
        "record_id": record_id,
        "candidate_semantics": contract["candidate_semantics"],
        "verification_status": contract["verification_status"],
        "human_review_required": contract["human_review_required"],
        "scientific_claim_allowed": False,
        "source_artifacts": contract["source_artifacts"],
        "data": contract["data"] if data is None else data,
    }


def _metadata_payloads(pilot: dict[str, Any]) -> list[_ArtifactSpec]:
    target = pilot["target"]
    workload = _pilot_contract(pilot, "geographic_workload")["data"]
    hits = _pilot_contract(pilot, "query_hit_metrics")["data"]
    competitors = _pilot_contract(pilot, "regional_competitors")["data"]
    source_media = _pilot_contract(pilot, "source_media_counts")["data"]

    run_summary = {
        "schema_version": "truthful-demo-run-summary:v1.0.0",
        "run_id": "papilio-demoleus-pilot-metadata-20260715",
        "fixture_schema_version": TRUTHFUL_DEMO_SCHEMA_VERSION,
        "fixture_kind": "truthful_metadata_pilot",
        "hero_record_id": TRUTHFUL_DEMO_HERO_ID,
        "hero_state": "awaiting_human_review",
        "status": source_media["status"],
        "target_under_study": target,
        "target_classification": {
            "status": "unavailable",
            "value": None,
            "reason": "No human-verified target image classification is committed.",
        },
        "media": {
            "status": "unavailable",
            "licensed_image_count": 0,
            "included_image_count": 0,
            "reason": (
                "No committed image has both a human-verified label and a fixture rights record."
            ),
        },
        "detection_data": {
            "status": "unavailable",
            "record_count": 0,
            "reason": "BioMiner reports zero YOLOE images processed for this pilot metadata stage.",
        },
        "full_frame_transformations": {
            "status": "unavailable",
            "record_count": 0,
            "reason": (
                "No pilot media was processed, so no real transformed full frame is available."
            ),
        },
        "candidate_evidence": {
            "status": "metadata_only",
            "regional_competitor_candidate_count": competitors["candidate_count"],
            "candidate_visual_score_count": 0,
            "reason": (
                "The committed candidates are planning hypotheses, not verified image support."
            ),
        },
        "human_review": {
            "status": "pending",
            "verified_source_media_count": source_media["counts"][
                "human_verified_source_media_count"
            ],
            "required_before_classification": True,
        },
        "scientific_claim_allowed": False,
        "schema_smoke_record_included": False,
        "notes": [
            "The target name identifies the research subject; it is not an image classification.",
            (
                "All displayed counts are projections of checksum-verified committed BioMiner "
                "metadata."
            ),
        ],
    }

    pipeline_stages = [
        {
            "stage_id": "compact-metadata-import",
            "status": "available",
            "verification_status": "content_and_cross_references_verified",
            "record_count": 6,
            "scientific_claim_allowed": False,
        },
        {
            "stage_id": "geographic-workload",
            "status": "metadata_available",
            "verification_status": "committed_metadata_verified",
            "record_count": workload["counts"]["query_hit_count"],
            "scientific_claim_allowed": False,
        },
        {
            "stage_id": "reference-candidate-metadata",
            "status": "metadata_available",
            "verification_status": "committed_metadata_counts_verified",
            "record_count": source_media["counts"]["eligible_source_media_candidate_count"],
            "scientific_claim_allowed": False,
        },
        {
            "stage_id": "licensed-media-selection",
            "status": "unavailable",
            "verification_status": "unavailable",
            "record_count": 0,
            "reason": "No eligible media was admitted to the fixture.",
            "scientific_claim_allowed": False,
        },
        {
            "stage_id": "yoloe-detection",
            "status": "unavailable",
            "verification_status": "unavailable",
            "record_count": 0,
            "reason": "No pilot image was processed by YOLOE.",
            "scientific_claim_allowed": False,
        },
        {
            "stage_id": "full-frame-transformation",
            "status": "unavailable",
            "verification_status": "unavailable",
            "record_count": 0,
            "reason": "No admitted image exists to transform.",
            "scientific_claim_allowed": False,
        },
        {
            "stage_id": "target-aware-scoring",
            "status": "unavailable",
            "verification_status": "unavailable",
            "record_count": 0,
            "reason": "No real candidate visual scores are committed.",
            "scientific_claim_allowed": False,
        },
        {
            "stage_id": "human-review",
            "status": "pending",
            "verification_status": "human_review_pending",
            "record_count": 0,
            "reason": "Human-verified source media count is zero.",
            "scientific_claim_allowed": False,
        },
    ]

    stage_metrics = [
        {
            "metric_id": "flickr-query-hits",
            "metric_kind": "source_metadata_count",
            "value": hits["query_hit_count"],
            "verification_status": "committed_metadata_verified",
            "scientific_claim_allowed": False,
        },
        {
            "metric_id": "canonical-flickr-photos",
            "metric_kind": "source_metadata_count",
            "value": hits["canonical_photo_count"],
            "verification_status": "committed_metadata_verified",
            "scientific_claim_allowed": False,
        },
        {
            "metric_id": "eligible-source-media-candidates",
            "metric_kind": "source_metadata_count",
            "value": source_media["counts"]["eligible_source_media_candidate_count"],
            "verification_status": "committed_metadata_counts_verified",
            "scientific_claim_allowed": False,
        },
        {
            "metric_id": "human-verified-source-media",
            "metric_kind": "review_count",
            "value": source_media["counts"]["human_verified_source_media_count"],
            "verification_status": "committed_metadata_counts_verified",
            "scientific_claim_allowed": False,
        },
    ]

    query_definitions = [
        _record(
            pilot,
            "trust_first_reference_plan",
            record_id="trust-first-reference-query-plan",
        )
    ]
    logical_associations = [
        _record(
            pilot,
            "target_range_evidence",
            record_id="target-range-planning-hypothesis",
        ),
        _record(
            pilot,
            "biological_negatives",
            record_id="reviewed-false-winner-relationship-plan",
            data={
                "reviewed_false_winner_relationship_count": _pilot_contract(
                    pilot, "biological_negatives"
                )["data"]["reviewed_false_winner_relationship_count"],
                "relationship_use": "candidate planning only",
            },
        ),
    ]
    flickr_candidate_summaries = [
        _record(pilot, "query_hit_metrics", record_id="flickr-query-hit-summary")
    ]
    duplicate_summaries = [
        {
            "record_id": "reference-metadata-deduplication-summary",
            "candidate_semantics": "candidate_reference_not_verified_support",
            "verification_status": "committed_metadata_counts_verified",
            "human_review_required": True,
            "scientific_claim_allowed": False,
            "source_artifacts": _pilot_contract(pilot, "source_media_counts")["source_artifacts"],
            "data": {
                "deduplicated_observation_count": source_media["counts"][
                    "deduplicated_observation_count"
                ],
                "deduplicated_media_candidate_count": source_media["counts"][
                    "deduplicated_media_candidate_count"
                ],
                "duplicate_relationship_rows_available": False,
            },
        }
    ]
    geographic_clusters = [
        _record(pilot, "candidate_clusters", record_id="geographic-cluster-summary")
    ]
    candidate_sets = [
        {
            "record_id": f"regional-competitor-{index}",
            "candidate_semantics": _pilot_contract(pilot, "regional_competitors")[
                "candidate_semantics"
            ],
            "verification_status": _pilot_contract(pilot, "regional_competitors")[
                "verification_status"
            ],
            "human_review_required": True,
            "scientific_claim_allowed": False,
            "minimum_per_species": competitors["minimum_per_species"],
            "maximum_per_species": competitors["maximum_per_species"],
            "candidate": candidate,
        }
        for index, candidate in enumerate(competitors["candidates"], start=1)
    ]
    reference_readiness = [
        _record(pilot, "source_media_counts", record_id="reference-source-readiness")
    ]
    reference_shortfalls = [
        _record(pilot, "reference_shortfalls", record_id="reference-source-shortfalls")
    ]
    biological_negatives = [
        _record(pilot, "biological_negatives", record_id="biological-negative-plan")
    ]
    visual_domain_negatives = [
        _record(pilot, "visual_domain_negatives", record_id="visual-domain-negative-plan")
    ]
    selective_decision = [
        {
            "schema_version": "truthful-demo-decision-state:v1.0.0",
            "evidence_record_id": TRUTHFUL_DEMO_HERO_ID,
            "record_kind": "decision_mechanics_fixture",
            "schema_smoke_record": False,
            "target_under_study": target,
            "media_id": None,
            "image_path": None,
            "state": "awaiting_human_review",
            "target_classification": None,
            "decision": None,
            "candidate_visual_scores": [],
            "candidate_plan": competitors["candidates"],
            "gates": [
                {"gate": "licensed_media_in_fixture", "satisfied": False},
                {"gate": "real_detection_data", "satisfied": False},
                {"gate": "real_full_frame_transformation", "satisfied": False},
                {"gate": "real_candidate_visual_scores", "satisfied": False},
                {"gate": "human_verified_target_classification", "satisfied": False},
            ],
            "allowed_transition": "human_review_of_rights-cleared_source_media",
            "display_label": "Awaiting human review",
            "candidate_semantics": "diagnostic_only",
            "verification_status": "human_review_pending",
            "human_review_required": True,
            "scientific_claim_allowed": False,
            "unavailable_reason": (
                "No committed human-verified target classification or admitted image exists."
            ),
        }
    ]

    common = {
        "source_repository": _BIOMINER_REPOSITORY,
        "source_commit": TRUTHFUL_DEMO_BIOMINER_SHA,
    }
    specs = [
        _ArtifactSpec(
            "run-summary",
            "data/run_summary.json",
            "run_summary",
            "truthful-demo-run-summary:v1.0.0",
            _TAXALENS_REPOSITORY,
            TRUTHFUL_DEMO_TAXALENS_SHA,
            run_summary,
            1,
        ),
        _ArtifactSpec(
            "pipeline-stages",
            "data/pipeline_stages.json",
            "pipeline_stages",
            "truthful-demo-pipeline-stage:v1.0.0",
            _TAXALENS_REPOSITORY,
            TRUTHFUL_DEMO_TAXALENS_SHA,
            pipeline_stages,
            len(pipeline_stages),
        ),
        _ArtifactSpec(
            "stage-metrics",
            "data/stage_metrics.json",
            "stage_metrics",
            "truthful-demo-metadata-metric:v1.0.0",
            **common,
            payload=stage_metrics,
            record_count=len(stage_metrics),
        ),
        _ArtifactSpec(
            "query-definitions",
            "data/query_definitions.json",
            "query_definitions",
            "truthful-demo-query-definition:v1.0.0",
            **common,
            payload=query_definitions,
            record_count=len(query_definitions),
        ),
        _ArtifactSpec(
            "logical-associations",
            "data/logical_associations.json",
            "logical_associations",
            "truthful-demo-logical-association:v1.0.0",
            **common,
            payload=logical_associations,
            record_count=len(logical_associations),
        ),
        _ArtifactSpec(
            "flickr-candidate-summaries",
            "data/flickr_candidate_summaries.json",
            "flickr_candidate_summaries",
            "truthful-demo-flickr-candidate-summary:v1.0.0",
            **common,
            payload=flickr_candidate_summaries,
            record_count=len(flickr_candidate_summaries),
        ),
        _ArtifactSpec(
            "duplicate-summaries",
            "data/duplicate_summaries.json",
            "duplicate_summaries",
            "truthful-demo-duplicate-summary:v1.0.0",
            **common,
            payload=duplicate_summaries,
            record_count=len(duplicate_summaries),
        ),
        _ArtifactSpec(
            "geographic-clusters",
            "data/geographic_clusters.json",
            "geographic_clusters",
            "truthful-demo-geographic-cluster-summary:v1.0.0",
            **common,
            payload=geographic_clusters,
            record_count=len(geographic_clusters),
        ),
        _ArtifactSpec(
            "candidate-sets",
            "data/candidate_sets.json",
            "candidate_sets",
            "truthful-demo-candidate-set:v1.0.0",
            **common,
            payload=candidate_sets,
            record_count=len(candidate_sets),
        ),
        _ArtifactSpec(
            "reference-readiness",
            "data/reference_readiness.json",
            "reference_readiness",
            "truthful-demo-reference-readiness:v1.0.0",
            **common,
            payload=reference_readiness,
            record_count=len(reference_readiness),
        ),
        _ArtifactSpec(
            "reference-shortfalls",
            "data/reference_shortfalls.json",
            "reference_shortfalls",
            "truthful-demo-reference-shortfall:v1.0.0",
            **common,
            payload=reference_shortfalls,
            record_count=len(reference_shortfalls),
        ),
        _ArtifactSpec(
            "biological-negatives",
            "data/biological_negatives.json",
            "biological_negatives",
            "truthful-demo-biological-negative-plan:v1.0.0",
            **common,
            payload=biological_negatives,
            record_count=len(biological_negatives),
        ),
        _ArtifactSpec(
            "visual-domain-negatives",
            "data/visual_domain_negatives.json",
            "visual_domain_negatives",
            "truthful-demo-visual-domain-negative-plan:v1.0.0",
            **common,
            payload=visual_domain_negatives,
            record_count=len(visual_domain_negatives),
        ),
        _ArtifactSpec(
            "selective-decision-metadata",
            "data/selective_decision_metadata.json",
            "selective_decision_metadata",
            "truthful-demo-decision-state:v1.0.0",
            _TAXALENS_REPOSITORY,
            TRUTHFUL_DEMO_TAXALENS_SHA,
            selective_decision,
            len(selective_decision),
        ),
        _ArtifactSpec(
            "pilot-metadata-snapshot",
            "source/pilot_metadata_snapshot.json",
            "other",
            pilot["schema_version"],
            **common,
            payload=pilot,
            record_count=1,
        ),
    ]
    return specs


def _analytics_payloads(import_manifest: str | Path) -> list[_ArtifactSpec]:
    """Load only analytics bytes covered by the pinned BioMiner import receipt."""

    manifest_path = Path(import_manifest)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if not isinstance(manifest, dict):
        raise ValueError("analytics import manifest must be an object")
    if manifest.get("schema_version") != "taxalens-biominer-analytics-import:v1.0.0":
        raise ValueError("analytics import manifest schema version differs")
    if manifest.get("origin_repository") != _BIOMINER_REPOSITORY:
        raise ValueError("analytics import manifest requires the BioMiner origin")
    if manifest.get("origin_commit") != TRUTHFUL_DEMO_BIOMINER_SHA:
        raise ValueError("analytics import manifest requires the pinned BioMiner revision")
    if manifest.get("scientific_claim_allowed") is not False:
        raise ValueError("analytics import cannot authorize a scientific claim")
    source_manifest = manifest.get("source_manifest")
    if not isinstance(source_manifest, dict) or source_manifest.get("sha256") != (
        "a62abef7cbac8638da219e53e08ab6760bedcd4f49d6396bfa0d1891d96e5cf2"
    ):
        raise ValueError("analytics import lacks the pinned BioMiner source-manifest checksum")

    artifacts = manifest.get("artifacts")
    if not isinstance(artifacts, list) or len(artifacts) != 4:
        raise ValueError("analytics import must contain exactly four Parquet artifacts")
    specs = [
        _ArtifactSpec(
            artifact_id="biominer-analytics-import-receipt",
            path="source/analytics_import_receipt.json",
            role="other",
            schema_version="taxalens-biominer-analytics-import:v1.0.0",
            source_repository=_TAXALENS_REPOSITORY,
            source_commit=TRUTHFUL_DEMO_TAXALENS_SHA,
            payload=manifest,
            record_count=1,
        )
    ]
    seen_ids: set[str] = set()
    repository_root = Path(__file__).resolve().parents[2]
    for index, raw in enumerate(artifacts):
        if not isinstance(raw, dict):
            raise ValueError(f"analytics artifacts[{index}] must be an object")
        artifact_id = raw.get("artifact_id")
        imported_path = raw.get("imported_path")
        fixture_path = raw.get("fixture_path")
        schema_version = raw.get("schema_version")
        expected_sha = raw.get("sha256")
        expected_bytes = raw.get("byte_count")
        record_count = raw.get("record_count")
        if not all(
            isinstance(value, str) and value
            for value in (artifact_id, imported_path, fixture_path, schema_version, expected_sha)
        ):
            raise ValueError(f"analytics artifacts[{index}] text fields are incomplete")
        assert isinstance(artifact_id, str)
        assert isinstance(imported_path, str)
        assert isinstance(fixture_path, str)
        assert isinstance(schema_version, str)
        assert isinstance(expected_sha, str)
        if artifact_id in seen_ids:
            raise ValueError(f"duplicate analytics artifact id: {artifact_id}")
        seen_ids.add(artifact_id)
        if not isinstance(expected_bytes, int) or isinstance(expected_bytes, bool):
            raise ValueError(f"{artifact_id} byte_count must be an integer")
        if not isinstance(record_count, int) or isinstance(record_count, bool):
            raise ValueError(f"{artifact_id} record_count must be an integer")
        source_path = Path(imported_path)
        output_path = Path(fixture_path)
        if (
            source_path.is_absolute()
            or output_path.is_absolute()
            or ".." in source_path.parts
            or ".." in output_path.parts
        ):
            raise ValueError(f"{artifact_id} paths must stay within the repository and fixture")
        content = (repository_root / source_path).read_bytes()
        if len(content) != expected_bytes or hashlib.sha256(content).hexdigest() != expected_sha:
            raise ValueError(f"{artifact_id} imported bytes differ from the pinned receipt")
        if content[:4] != b"PAR1" or content[-4:] != b"PAR1":
            raise ValueError(f"{artifact_id} is not a complete Parquet artifact")
        specs.append(
            _ArtifactSpec(
                artifact_id=artifact_id,
                path=output_path.as_posix(),
                role="other",
                schema_version=schema_version,
                source_repository=_BIOMINER_REPOSITORY,
                source_commit=TRUTHFUL_DEMO_BIOMINER_SHA,
                payload=content,
                record_count=record_count,
                media_type="application/vnd.apache.parquet",
            )
        )
    return specs


def _canonical_file_bytes(payload: object) -> bytes:
    return (json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode()


def _section(
    *,
    status: str,
    artifact_ids: list[str],
    reason: str | None,
    candidate_semantics: str,
    verification_status: str,
    human_review_required: bool = True,
) -> dict[str, object]:
    return {
        "status": status,
        "artifact_ids": artifact_ids,
        "reason": reason,
        "candidate_semantics": candidate_semantics,
        "verification_status": verification_status,
        "human_review_required": human_review_required,
        "scientific_claim_allowed": False,
    }


def _sections() -> dict[str, dict[str, object]]:
    available = {
        "run_summary": ("run-summary", "not_applicable", "machine_verified_contract", "available"),
        "pipeline_stages": (
            "pipeline-stages",
            "diagnostic_only",
            "machine_verified_contract",
            "available",
        ),
        "stage_metrics": ("stage-metrics", "diagnostic_only", "metadata_only", "available"),
        "query_definitions": (
            "query-definitions",
            "hypothesis_not_occurrence",
            "metadata_only",
            "available",
        ),
        "logical_associations": (
            "logical-associations",
            "hypothesis_not_occurrence",
            "metadata_only",
            "partial",
        ),
        "flickr_candidate_summaries": (
            "flickr-candidate-summaries",
            "hypothesis_not_occurrence",
            "metadata_only",
            "available",
        ),
        "duplicate_summaries": (
            "duplicate-summaries",
            "diagnostic_only",
            "metadata_only",
            "partial",
        ),
        "geographic_clusters": (
            "geographic-clusters",
            "hypothesis_not_occurrence",
            "metadata_only",
            "partial",
        ),
        "candidate_sets": (
            "candidate-sets",
            "candidate_reference_not_verified_support",
            "unreviewed",
            "partial",
        ),
        "reference_readiness": (
            "reference-readiness",
            "candidate_reference_not_verified_support",
            "human_review_pending",
            "partial",
        ),
        "reference_shortfalls": (
            "reference-shortfalls",
            "candidate_reference_not_verified_support",
            "human_review_pending",
            "partial",
        ),
        "biological_negatives": (
            "biological-negatives",
            "candidate_reference_not_verified_support",
            "unreviewed",
            "partial",
        ),
        "visual_domain_negatives": (
            "visual-domain-negatives",
            "candidate_reference_not_verified_support",
            "unreviewed",
            "partial",
        ),
        "selective_decision_metadata": (
            "selective-decision-metadata",
            "diagnostic_only",
            "human_review_pending",
            "partial",
        ),
    }
    reasons = {
        "yoloe_evidence": (
            "BioMiner reports zero YOLOE images processed; no detection artifact is committed."
        ),
        "full_frame_visual_input_metadata": (
            "No admitted image or real pilot full-frame transformation is committed."
        ),
        "target_aware_score_metadata": (
            "No real pilot image or candidate visual score artifact is committed."
        ),
        "comments": "No human review comment artifact is committed for this pilot.",
        "candidate_revisions": "No human candidate revision artifact is committed for this pilot.",
        "evaluation_summaries": "No Phase 13 result artifact is supplied to this fixture.",
    }
    sections: dict[str, dict[str, object]] = {}
    for name in JUDGE_BUNDLE_SECTION_NAMES:
        if name in available:
            artifact_id, semantics, verification, status = available[name]
            sections[name] = _section(
                status=status,
                artifact_ids=[artifact_id],
                reason=(
                    None
                    if status == "available"
                    else (
                        "Committed metadata is present, but payload rows or human review are "
                        "incomplete."
                    )
                ),
                candidate_semantics=semantics,
                verification_status=verification,
            )
        else:
            semantics = "diagnostic_only"
            if name in {"comments", "candidate_revisions", "evaluation_summaries"}:
                semantics = "not_applicable"
            sections[name] = _section(
                status="unavailable",
                artifact_ids=[],
                reason=reasons[name],
                candidate_semantics=semantics,
                verification_status="unavailable",
            )
    return sections


def build_truthful_demo_fixture(
    destination: str | Path = DEFAULT_TRUTHFUL_DEMO_ROOT,
    *,
    import_manifest: str | Path = DEFAULT_IMPORT_MANIFEST,
    analytics_import_manifest: str | Path = DEFAULT_ANALYTICS_IMPORT_MANIFEST,
    replace: bool = False,
) -> Path:
    """Build, checksum, and validate the deterministic truthful pilot fixture."""

    pilot = adapt_current_pilot_metadata(import_manifest)
    if pilot["origin_commit"] != TRUTHFUL_DEMO_BIOMINER_SHA:
        raise ValueError("truthful demo requires the pinned BioMiner pilot revision")
    if pilot["scientific_results_available"] is not False:
        raise ValueError("truthful demo expects metadata-only BioMiner input")

    root = Path(destination)
    if root.exists():
        if not replace:
            raise FileExistsError(f"destination already exists: {root}")
        if root.is_symlink() or not root.is_dir():
            raise ValueError(f"destination must be a real directory: {root}")
        shutil.rmtree(root)
    root.mkdir(parents=True)

    specs = [*_metadata_payloads(pilot), *_analytics_payloads(analytics_import_manifest)]
    biominer_ids = [
        spec.artifact_id for spec in specs if spec.source_repository == _BIOMINER_REPOSITORY
    ]
    taxalens_ids = [
        spec.artifact_id for spec in specs if spec.source_repository == _TAXALENS_REPOSITORY
    ]
    rights_payload = {
        "schema_version": "truthful-demo-rights-manifest:v1.0.0",
        "media_asset_count": 0,
        "licensed_image_count": 0,
        "included_image_count": 0,
        "all_media_rights_verified": False,
        "all_artifacts_covered": True,
        "media_policy": (
            "No image is admitted without a committed license, attribution, and human-review "
            "record."
        ),
        "items": [
            {
                "rights_id": "biominer-mit-metadata",
                "artifact_ids": biominer_ids,
                "license_name": "MIT",
                "license_uri": "https://opensource.org/license/mit",
                "creator_or_owner": "Kris Kari",
                "source_url": "https://github.com/karikris/BioMiner",
                "derivative_status": "TaxaLens deterministic metadata projection",
                "permitted_use": "TaxaLens judge replay and redistribution under MIT",
                "attribution_required": True,
            },
            {
                "rights_id": "taxalens-mit-fixture",
                "artifact_ids": [*taxalens_ids, "rights-manifest", "attribution-manifest"],
                "license_name": "MIT",
                "license_uri": "https://opensource.org/license/mit",
                "creator_or_owner": "Kris Kari",
                "source_url": "https://github.com/karikris/TaxaLens",
                "derivative_status": "original fixture structure and explicit unavailable states",
                "permitted_use": "TaxaLens judge replay and redistribution under MIT",
                "attribution_required": True,
            },
        ],
        "notes": [
            (
                "all_media_rights_verified is deliberately false, not vacuously true, because "
                "no media is included."
            ),
            (
                "The target taxon name and candidate metadata are not image labels or occurrence "
                "claims."
            ),
        ],
    }
    attribution_payload = {
        "schema_version": "truthful-demo-attribution-manifest:v1.0.0",
        "complete": True,
        "entries": [
            {
                "attribution_id": "biominer-pilot-metadata",
                "artifact_ids": biominer_ids,
                "display_text": (
                    "BioMiner pilot metadata, copyright (c) 2026 Kris Kari, MIT License."
                ),
                "creator": "Kris Kari",
                "source_title": "BioMiner",
                "source_url": "https://github.com/karikris/BioMiner",
                "license_name": "MIT",
                "license_uri": "https://opensource.org/license/mit",
            },
            {
                "attribution_id": "taxalens-truthful-fixture",
                "artifact_ids": [*taxalens_ids, "rights-manifest", "attribution-manifest"],
                "display_text": (
                    "TaxaLens truthful pilot fixture, copyright (c) 2026 Kris Kari, MIT License."
                ),
                "creator": "Kris Kari",
                "source_title": "TaxaLens",
                "source_url": "https://github.com/karikris/TaxaLens",
                "license_name": "MIT",
                "license_uri": "https://opensource.org/license/mit",
            },
        ],
    }
    specs.extend(
        [
            _ArtifactSpec(
                "rights-manifest",
                "rights_manifest.json",
                "rights",
                rights_payload["schema_version"],
                _TAXALENS_REPOSITORY,
                TRUTHFUL_DEMO_TAXALENS_SHA,
                rights_payload,
                1,
            ),
            _ArtifactSpec(
                "attribution-manifest",
                "attribution_manifest.json",
                "attribution",
                attribution_payload["schema_version"],
                _TAXALENS_REPOSITORY,
                TRUTHFUL_DEMO_TAXALENS_SHA,
                attribution_payload,
                len(attribution_payload["entries"]),
            ),
        ]
    )

    inventory: list[dict[str, object]] = []
    record_counts: dict[str, int] = {}
    for spec in sorted(specs, key=lambda item: item.artifact_id):
        content = (
            spec.payload
            if isinstance(spec.payload, bytes)
            else _canonical_file_bytes(spec.payload)
        )
        path = root / spec.path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        inventory.append(
            {
                "artifact_id": spec.artifact_id,
                "path": spec.path,
                "media_type": spec.media_type,
                "role": spec.role,
                "sha256": hashlib.sha256(content).hexdigest(),
                "bytes": len(content),
                "record_count": spec.record_count,
                "schema_version": spec.schema_version,
                "source_repository": spec.source_repository,
                "source_commit": spec.source_commit,
                "required": True,
            }
        )
        if spec.role in JUDGE_BUNDLE_SECTION_NAMES:
            record_counts[spec.role] = spec.record_count

    sections = _sections()
    section_records = {name: record_counts.get(name, 0) for name in JUDGE_BUNDLE_SECTION_NAMES}
    all_ids = [row["artifact_id"] for row in inventory]
    bundle = {
        "schema_version": JUDGE_BUNDLE_SCHEMA_VERSION,
        "bundle_id": TRUTHFUL_DEMO_BUNDLE_ID,
        "title": "Truthful Papilio demoleus metadata pilot",
        "created_at": TRUTHFUL_DEMO_CREATED_AT,
        "target": {**pilot["target"], "rank": "species"},
        "source_revisions": {
            "taxalens_sha": TRUTHFUL_DEMO_TAXALENS_SHA,
            "biominer_sha": TRUTHFUL_DEMO_BIOMINER_SHA,
        },
        "artifact_inventory": inventory,
        "sections": sections,
        "rights": {
            "status": "license_checked",
            "all_artifacts_covered": True,
            "all_media_rights_verified": False,
            "items": [
                {
                    "rights_id": "biominer-mit-metadata",
                    "artifact_ids": biominer_ids,
                    "status": "license_checked",
                    "license_name": "MIT",
                    "license_uri": "https://opensource.org/license/mit",
                    "creator_or_owner": "Kris Kari",
                    "source_url": "https://github.com/karikris/BioMiner",
                    "use_scope": "metadata-only judge replay",
                    "attribution_required": True,
                    "notes": ["No BioMiner image or scientific result artifact is included."],
                },
                {
                    "rights_id": "taxalens-mit-fixture",
                    "artifact_ids": [item for item in all_ids if item not in biominer_ids],
                    "status": "license_checked",
                    "license_name": "MIT",
                    "license_uri": "https://opensource.org/license/mit",
                    "creator_or_owner": "Kris Kari",
                    "source_url": "https://github.com/karikris/TaxaLens",
                    "use_scope": "truthful fixture structure and replay metadata",
                    "attribution_required": True,
                    "notes": ["No image is included; media rights are not asserted vacuously."],
                },
            ],
        },
        "attribution": {
            "complete": True,
            "entries": attribution_payload["entries"],
        },
        "openai_replay": {
            "status": "not_used",
            "mode": "not_used",
            "credentials_required": False,
            "live_requests_allowed": False,
            "reason": (
                "No OpenAI request or stored OpenAI output is represented in this pilot fixture."
            ),
            "traces": [],
        },
        "expected_ui_counts": {
            "section_records": section_records,
            "screen_items": {
                "research_mission": 10,
                "evidence_observatory": 7,
                "evidence_lens": 11,
                "butterfly_dashboard": 1,
            },
            "artifact_count": len(inventory),
            "attribution_count": len(attribution_payload["entries"]),
            "openai_replay_trace_count": 0,
            "unavailable_section_count": sum(
                section["status"] == "unavailable" for section in sections.values()
            ),
        },
        "checksums": {
            "algorithm": "sha256",
            "canonicalization": "json-sorted-keys-utf8-v1",
            "inventory_sha256": compute_inventory_sha256(inventory),
            "payload_root_sha256": compute_payload_root_sha256(inventory),
        },
    }
    manifest_path = root / "judge_bundle.json"
    manifest_path.write_bytes(_canonical_file_bytes(bundle))
    loaded = load_judge_bundle(manifest_path, verify_files=True)
    if loaded.validation.bundle_id != TRUTHFUL_DEMO_BUNDLE_ID:
        raise AssertionError("generated truthful demo bundle identity changed")
    return manifest_path


__all__ = [
    "DEFAULT_ANALYTICS_IMPORT_MANIFEST",
    "DEFAULT_TRUTHFUL_DEMO_ROOT",
    "TRUTHFUL_DEMO_BIOMINER_SHA",
    "TRUTHFUL_DEMO_BUNDLE_ID",
    "TRUTHFUL_DEMO_HERO_ID",
    "TRUTHFUL_DEMO_SCHEMA_VERSION",
    "TRUTHFUL_DEMO_TAXALENS_SHA",
    "build_truthful_demo_fixture",
]
