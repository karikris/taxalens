"""Fail-closed semantic verification for the truthful Papilio pilot fixture."""

from __future__ import annotations

import hashlib
import json
import re
from collections.abc import Iterator, Mapping, Sequence
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path, PurePosixPath
from typing import Any

from packages.replay.src.biominer_prototype_release_gate import (
    GO_PROTOTYPE_ONLY,
    evaluate_prototype_release_gate,
)

from taxalens.product.judge_bundle import (
    JUDGE_BUNDLE_SCHEMA_VERSION,
    JUDGE_BUNDLE_SECTION_NAMES,
    JudgeBundleError,
    compute_inventory_sha256,
    compute_payload_root_sha256,
    load_judge_bundle,
)
from taxalens.product.truthful_demo import (
    DEFAULT_TRUTHFUL_DEMO_ROOT,
    TRUTHFUL_DEMO_BIOMINER_SHA,
    TRUTHFUL_DEMO_BUNDLE_ID,
    TRUTHFUL_DEMO_HERO_ID,
    TRUTHFUL_DEMO_LEGACY_BIOMINER_SHA,
    TRUTHFUL_DEMO_TAXALENS_SHA,
    TRUTHFUL_DEMO_VERIFICATION_MANIFEST_SHA,
    TRUTHFUL_DEMO_VERIFICATION_MEDIA_SHA,
    TRUTHFUL_DEMO_VERIFICATION_USE_SCOPE,
)
from taxalens.product.verification_schema import (
    VerificationSchemaContract,
    validate_verification_schema,
)

DEFAULT_TRUTHFUL_DEMO_MANIFEST = DEFAULT_TRUTHFUL_DEMO_ROOT / "judge_bundle.json"


class TruthfulDemoFailure(StrEnum):
    """Stable failure codes for CI and mutation tests."""

    MISSING_FILE = "missing_file"
    CHECKSUM_MISMATCH = "checksum_mismatch"
    UNDECLARED_FILE = "undeclared_file"
    ORPHANED_ID = "orphaned_id"
    INCONSISTENT_COUNT = "inconsistent_count"
    MISSING_RIGHTS = "missing_rights"
    MISSING_ATTRIBUTION = "missing_attribution"
    CANDIDATE_AS_OCCURRENCE = "candidate_as_occurrence"
    UNVERIFIED_REFERENCE_AS_SUPPORT = "unverified_reference_as_support"
    RAW_SCORE_AS_PROBABILITY = "raw_score_as_probability"
    MISSING_BIOMINER_SHA = "missing_biominer_sha"
    UNSUPPORTED_GOLD_RESULT = "unsupported_gold_result"
    UNRESOLVED_PLACEHOLDER = "unresolved_placeholder"
    STALE_ARTIFACT_VERSION = "stale_artifact_version"
    CONTRACT_VIOLATION = "contract_violation"


class TruthfulDemoVerificationError(ValueError):
    """A truthful-fixture violation with a stable machine-readable code."""

    def __init__(
        self,
        code: TruthfulDemoFailure,
        detail: str,
        *,
        location: str | None = None,
    ) -> None:
        self.code = code
        self.detail = detail
        self.location = location
        prefix = f"[{code.value}]"
        if location:
            prefix += f" {location}:"
        super().__init__(f"{prefix} {detail}")


@dataclass(frozen=True, slots=True)
class TruthfulDemoVerification:
    """Summary returned only after every structural and semantic gate passes."""

    bundle_id: str
    biominer_sha: str
    taxalens_sha: str
    artifact_count: int
    section_count: int
    unavailable_section_count: int
    total_section_record_count: int
    media_asset_count: int
    hero_record_id: str
    hero_state: str


_EXPECTED_ARTIFACT_VERSIONS = {
    "attribution-manifest": "truthful-demo-attribution-manifest:v1.1.0",
    "biological-negatives": "truthful-demo-biological-negative-plan:v1.0.0",
    "biominer-analytics-import-receipt": "taxalens-biominer-analytics-import:v1.0.0",
    "biominer-flickr-geo-assignments-parquet": ("biominer-flickr-geo-assignments-parquet:v1.0.0"),
    "biominer-flickr-geo-clusters-parquet": "biominer-flickr-geo-clusters-parquet:v1.0.0",
    "biominer-flickr-geography-parquet": "biominer-flickr-geography-parquet:v1.0.0",
    "biominer-flickr-query-hits-parquet": "biominer-flickr-query-hits-parquet:v1.0.0",
    "candidate-sets": "truthful-demo-candidate-set:v1.0.0",
    "duplicate-summaries": "truthful-demo-duplicate-summary:v1.0.0",
    "flickr-candidate-summaries": "truthful-demo-flickr-candidate-summary:v1.0.0",
    "geographic-clusters": "truthful-demo-geographic-cluster-summary:v1.0.0",
    "geographic-baseline-geographic-spread": "taxon-geographic-spread-v1.0.0",
    "geographic-baseline-occurrence-union": "taxalens-baseline-occurrence-union:v1.0.0",
    "geographic-country-hierarchy": "taxalens-country-hierarchy:v1.0.0",
    "geographic-flickr-geography": "taxalens-flickr-geography-verification:v1.0.0",
    "geographic-geographic-impact-cells": "taxalens-geographic-impact-cell:v1.0.0",
    "geographic-geographic-impact-summary": "taxalens-geographic-impact-summary:v1.0.0",
    "geographic-impact-manifest": "taxalens-geographic-impact-manifest:v1.0.0",
    "geographic-release-decisions": "taxalens-occurrence-release-decisions:v1.0.0",
    "geographic-verification-consensus": "taxalens-repository-supabase-table:v1.0.0",
    "logical-associations": "truthful-demo-logical-association:v1.0.0",
    "pilot-metadata-snapshot": "taxalens-phase14-pilot-metadata:v1.1.0",
    "pipeline-stages": "truthful-demo-pipeline-stage:v1.0.0",
    "prototype-evidence-snapshot": "taxalens-biominer-prototype-evidence:v1.1.0",
    "query-definitions": "truthful-demo-query-definition:v1.0.0",
    "reference-readiness": "truthful-demo-reference-readiness:v1.0.0",
    "reference-shortfalls": "truthful-demo-reference-shortfall:v1.0.0",
    "rights-manifest": "truthful-demo-rights-manifest:v1.1.0",
    "run-summary": "truthful-demo-run-summary:v1.0.0",
    "selective-decision-metadata": "truthful-demo-decision-state:v1.0.0",
    "stage-metrics": "truthful-demo-metadata-metric:v1.0.0",
    "stored-analyst-request": "taxalens-stored-analyst-request:v1.0.0",
    "stored-analyst-run": "taxalens-research-analyst-run:v1.0.0",
    "verification-campaign-manifest": ("taxalens-verification-campaign-manifest:v1.0.0"),
    "verification-items": "taxalens-verification-items:v1.0.0",
    "verification-media-commons-papilio-demoleus-closed-wing": (
        "taxalens-verification-media:v1.0.0"
    ),
    "verification-media-commons-papilio-demoleus-lime-swallowtail": (
        "taxalens-verification-media:v1.0.0"
    ),
    "verification-media-commons-papilio-demoleus-open-wing": ("taxalens-verification-media:v1.0.0"),
    "visual-domain-negatives": "truthful-demo-visual-domain-negative-plan:v1.0.0",
}
_EXPECTED_GEOGRAPHIC_MANIFEST_SHA256 = (
    "d2ad9e8fd5314a26bd73fd27b7ead00d7e85e0f962a44319d5e0910c567a3b22"
)
_GEOGRAPHIC_BIOMINER_COMMITS = {
    "247b42f3206d48bb79e2dbf97c5a92e4f207ae71",
    "75461d9c065af0cd96b41cd1f845c2e920f7ae34",
}
_PLACEHOLDER_PATTERN = re.compile(
    r"\$\{[^}]+\}|<\s*(?:todo|fixme|placeholder)\s*>|"
    r"\b(?:TODO|FIXME|TBD|CHANGEME)\b|placeholder_(?:species|taxon|record)",
    re.IGNORECASE,
)
_OCCURRENCE_VALUES = {"occurrence", "confirmed_occurrence", "observed_occurrence"}
_SUPPORT_VALUES = {"support", "verified_support", "target_support"}
_RAW_SCORE_KEYS = {"raw_score", "raw_similarity", "raw_similarity_score"}
_PROBABILITY_KEYS = {"probability", "calibrated_probability", "target_probability"}
_GOLD_KEYS = {"gold_result", "gold_label", "gold_decision"}


def verify_truthful_demo(
    manifest_path: str | Path = DEFAULT_TRUTHFUL_DEMO_MANIFEST,
) -> TruthfulDemoVerification:
    """Verify exact files, contracts, references, rights, and display semantics."""

    manifest = Path(manifest_path)
    if not manifest.is_file() or manifest.is_symlink():
        _fail(TruthfulDemoFailure.MISSING_FILE, "judge bundle manifest is missing", manifest)
    root = manifest.resolve().parent
    bundle = _load_json_object(manifest, location="judge_bundle.json")

    _verify_bundle_identity(bundle)
    inventory, artifacts, payloads = _verify_inventory(bundle, root, manifest.resolve())
    _verify_versions(bundle, artifacts, payloads)
    _verify_biominer_sha(bundle, artifacts, payloads)
    _verify_analytics_receipt(artifacts, payloads)
    _verify_openai_replay(bundle, artifacts, payloads)
    _verify_references(bundle, artifacts, payloads)
    _verify_counts(bundle, artifacts, payloads)
    _verify_rights(bundle, artifacts, payloads)
    _verify_attribution(bundle, artifacts, payloads)
    _verify_verification_media_integrity(bundle, artifacts, payloads)
    _verify_semantics(bundle, payloads)
    _verify_checksum_roots(bundle, inventory)

    try:
        loaded = load_judge_bundle(manifest, verify_files=True)
    except JudgeBundleError as error:
        raise TruthfulDemoVerificationError(
            TruthfulDemoFailure.CONTRACT_VIOLATION,
            str(error),
            location="judge_bundle.json",
        ) from error

    summary = _object(payloads["run-summary"], "data/run_summary.json")
    rights = _object(payloads["rights-manifest"], "rights_manifest.json")
    return TruthfulDemoVerification(
        bundle_id=loaded.validation.bundle_id,
        biominer_sha=TRUTHFUL_DEMO_BIOMINER_SHA,
        taxalens_sha=TRUTHFUL_DEMO_TAXALENS_SHA,
        artifact_count=len(artifacts),
        section_count=len(JUDGE_BUNDLE_SECTION_NAMES),
        unavailable_section_count=_required_nonnegative_int(
            _object(bundle["expected_ui_counts"], "expected_ui_counts").get(
                "unavailable_section_count"
            ),
            "expected_ui_counts.unavailable_section_count",
        ),
        total_section_record_count=sum(
            _required_nonnegative_int(
                _object(bundle["expected_ui_counts"], "expected_ui_counts")["section_records"][
                    name
                ],
                f"expected_ui_counts.section_records.{name}",
            )
            for name in JUDGE_BUNDLE_SECTION_NAMES
        ),
        media_asset_count=_required_nonnegative_int(
            rights.get("media_asset_count"), "rights_manifest.media_asset_count"
        ),
        hero_record_id=TRUTHFUL_DEMO_HERO_ID,
        hero_state=_required_text(summary.get("hero_state"), "run_summary.hero_state"),
    )


def _verify_bundle_identity(bundle: Mapping[str, Any]) -> None:
    if bundle.get("schema_version") != JUDGE_BUNDLE_SCHEMA_VERSION:
        _fail(
            TruthfulDemoFailure.STALE_ARTIFACT_VERSION,
            f"expected stored fixture version {JUDGE_BUNDLE_SCHEMA_VERSION}",
            "judge_bundle.schema_version",
        )
    if bundle.get("bundle_id") != TRUTHFUL_DEMO_BUNDLE_ID:
        _fail(
            TruthfulDemoFailure.STALE_ARTIFACT_VERSION,
            f"expected bounded bundle {TRUTHFUL_DEMO_BUNDLE_ID}",
            "judge_bundle.bundle_id",
        )


def _verify_inventory(
    bundle: Mapping[str, Any],
    root: Path,
    manifest: Path,
) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]], dict[str, object]]:
    raw_inventory = bundle.get("artifact_inventory")
    if not isinstance(raw_inventory, list):
        _fail(
            TruthfulDemoFailure.CONTRACT_VIOLATION,
            "artifact_inventory must be an array",
            "judge_bundle.artifact_inventory",
        )
    inventory: list[dict[str, Any]] = []
    artifacts: dict[str, dict[str, Any]] = {}
    payloads: dict[str, object] = {}
    expected_paths: set[str] = set()
    for index, raw in enumerate(raw_inventory):
        location = f"judge_bundle.artifact_inventory[{index}]"
        artifact = _object(raw, location)
        artifact_id = _required_text(artifact.get("artifact_id"), f"{location}.artifact_id")
        relative = _safe_relative_path(artifact.get("path"), f"{location}.path")
        if artifact_id in artifacts or relative in expected_paths:
            _fail(
                TruthfulDemoFailure.ORPHANED_ID,
                "artifact IDs and paths must be unique",
                location,
            )
        path = root / relative
        if not path.is_file() or path.is_symlink():
            _fail(TruthfulDemoFailure.MISSING_FILE, "required artifact is missing", relative)
        expected_bytes = _required_nonnegative_int(artifact.get("bytes"), f"{location}.bytes")
        content = path.read_bytes()
        if len(content) != expected_bytes:
            _fail(
                TruthfulDemoFailure.CHECKSUM_MISMATCH,
                f"byte count is {len(content)}, expected {expected_bytes}",
                relative,
            )
        expected_digest = _required_text(artifact.get("sha256"), f"{location}.sha256")
        actual_digest = hashlib.sha256(content).hexdigest()
        if actual_digest != expected_digest:
            _fail(
                TruthfulDemoFailure.CHECKSUM_MISMATCH,
                f"SHA-256 is {actual_digest}, expected {expected_digest}",
                relative,
            )
        media_type = artifact.get("media_type")
        if media_type == "application/json" or (
            isinstance(media_type, str) and media_type.endswith("+json")
        ):
            try:
                payload = json.loads(
                    content,
                    object_pairs_hook=_reject_duplicate_keys,
                    parse_constant=_reject_non_json_constant,
                )
            except (UnicodeDecodeError, json.JSONDecodeError) as error:
                _fail(
                    TruthfulDemoFailure.CONTRACT_VIOLATION,
                    f"artifact is not strict UTF-8 JSON: {error}",
                    relative,
                )
        elif media_type == "application/vnd.apache.parquet":
            if content[:4] != b"PAR1" or content[-4:] != b"PAR1":
                _fail(
                    TruthfulDemoFailure.CONTRACT_VIOLATION,
                    "artifact does not have complete Parquet magic bytes",
                    relative,
                )
            payload = content
        elif media_type == "image/jpeg":
            if not content.startswith(b"\xff\xd8\xff") or not content.endswith(b"\xff\xd9"):
                _fail(
                    TruthfulDemoFailure.CONTRACT_VIOLATION,
                    "artifact does not have complete JPEG markers",
                    relative,
                )
            payload = content
        else:
            _fail(
                TruthfulDemoFailure.CONTRACT_VIOLATION,
                f"unsupported truthful-fixture media type: {media_type!r}",
                relative,
            )
        inventory.append(artifact)
        artifacts[artifact_id] = artifact
        payloads[artifact_id] = payload
        expected_paths.add(relative)

    actual_paths = {
        path.relative_to(root).as_posix()
        for path in root.rglob("*")
        if path.is_file() and path.resolve() != manifest
    }
    undeclared = sorted(actual_paths - expected_paths)
    if undeclared:
        _fail(
            TruthfulDemoFailure.UNDECLARED_FILE,
            f"files are absent from artifact_inventory: {undeclared}",
            "judge_bundle.artifact_inventory",
        )
    return inventory, artifacts, payloads


def _verify_versions(
    bundle: Mapping[str, Any],
    artifacts: Mapping[str, Mapping[str, Any]],
    payloads: Mapping[str, object],
) -> None:
    if set(artifacts) != set(_EXPECTED_ARTIFACT_VERSIONS):
        missing = sorted(set(_EXPECTED_ARTIFACT_VERSIONS) - set(artifacts))
        unexpected = sorted(set(artifacts) - set(_EXPECTED_ARTIFACT_VERSIONS))
        _fail(
            TruthfulDemoFailure.STALE_ARTIFACT_VERSION,
            f"bounded artifact set differs; missing={missing}, unexpected={unexpected}",
            "judge_bundle.artifact_inventory",
        )
    for artifact_id, expected in _EXPECTED_ARTIFACT_VERSIONS.items():
        artifact = artifacts[artifact_id]
        if artifact.get("schema_version") != expected:
            _fail(
                TruthfulDemoFailure.STALE_ARTIFACT_VERSION,
                f"expected {expected}",
                f"artifact:{artifact_id}.schema_version",
            )
        payload = payloads[artifact_id]
        if isinstance(payload, dict) and "schema_version" in payload:
            if payload["schema_version"] != expected:
                _fail(
                    TruthfulDemoFailure.STALE_ARTIFACT_VERSION,
                    f"payload schema must match inventory version {expected}",
                    str(artifact["path"]),
                )
        if artifact_id.startswith("verification-media-") and (
            artifact.get("source_repository") != "karikris/TaxaLens"
            or artifact.get("source_commit") != TRUTHFUL_DEMO_VERIFICATION_MEDIA_SHA
        ):
            _fail(
                TruthfulDemoFailure.STALE_ARTIFACT_VERSION,
                (
                    "verification media must retain the pinned TaxaLens source commit "
                    f"{TRUTHFUL_DEMO_VERIFICATION_MEDIA_SHA}"
                ),
                f"artifact:{artifact_id}.source_commit",
            )
    geographic_manifest = artifacts["geographic-impact-manifest"]
    if geographic_manifest.get("sha256") != _EXPECTED_GEOGRAPHIC_MANIFEST_SHA256:
        _fail(
            TruthfulDemoFailure.STALE_ARTIFACT_VERSION,
            "geographic impact manifest differs from the frozen fixture",
            "artifact:geographic-impact-manifest.sha256",
        )
        if artifact_id in {
            "verification-campaign-manifest",
            "verification-items",
        } and (
            artifact.get("source_repository") != "karikris/TaxaLens"
            or artifact.get("source_commit") != TRUTHFUL_DEMO_VERIFICATION_MANIFEST_SHA
        ):
            _fail(
                TruthfulDemoFailure.STALE_ARTIFACT_VERSION,
                (
                    "verification manifest projections must retain the pinned TaxaLens "
                    f"source commit {TRUTHFUL_DEMO_VERIFICATION_MANIFEST_SHA}"
                ),
                f"artifact:{artifact_id}.source_commit",
            )
    revisions = _object(bundle.get("source_revisions"), "source_revisions")
    if revisions.get("taxalens_sha") != TRUTHFUL_DEMO_TAXALENS_SHA:
        _fail(
            TruthfulDemoFailure.STALE_ARTIFACT_VERSION,
            f"expected TaxaLens source {TRUTHFUL_DEMO_TAXALENS_SHA}",
            "source_revisions.taxalens_sha",
        )


def _verify_biominer_sha(
    bundle: Mapping[str, Any],
    artifacts: Mapping[str, Mapping[str, Any]],
    payloads: Mapping[str, object],
) -> None:
    revisions = _object(bundle.get("source_revisions"), "source_revisions")
    if revisions.get("biominer_sha") != TRUTHFUL_DEMO_BIOMINER_SHA:
        _fail(
            TruthfulDemoFailure.MISSING_BIOMINER_SHA,
            f"expected pinned BioMiner SHA {TRUTHFUL_DEMO_BIOMINER_SHA}",
            "source_revisions.biominer_sha",
        )
    for artifact_id, artifact in artifacts.items():
        if artifact.get("source_repository") == "karikris/BioMiner":
            if artifact.get("source_commit") not in {
                TRUTHFUL_DEMO_BIOMINER_SHA,
                TRUTHFUL_DEMO_LEGACY_BIOMINER_SHA,
                *_GEOGRAPHIC_BIOMINER_COMMITS,
            }:
                _fail(
                    TruthfulDemoFailure.MISSING_BIOMINER_SHA,
                    "BioMiner-derived artifact lacks an admitted pinned source SHA",
                    f"artifact:{artifact_id}.source_commit",
                )
    snapshot = _object(payloads["pilot-metadata-snapshot"], "pilot_metadata_snapshot")
    if snapshot.get("origin_commit") != TRUTHFUL_DEMO_LEGACY_BIOMINER_SHA:
        _fail(
            TruthfulDemoFailure.MISSING_BIOMINER_SHA,
            "pilot metadata snapshot lacks the historical pinned source SHA",
            "source/pilot_metadata_snapshot.json",
        )
    prototype = _object(payloads["prototype-evidence-snapshot"], "prototype_evidence_snapshot")
    if (
        prototype.get("origin_repository") != "karikris/BioMiner"
        or prototype.get("origin_commit") != TRUTHFUL_DEMO_BIOMINER_SHA
    ):
        _fail(
            TruthfulDemoFailure.MISSING_BIOMINER_SHA,
            "prototype evidence snapshot lacks the current pinned BioMiner source SHA",
            "source/prototype_evidence_snapshot.json",
        )
    expected_boundary = {
        "status": "prototype_only_available_with_limitations",
        "prototype_integration_authorized": True,
        "production_default_change_authorized": False,
        "scientific_release_authorized": False,
        "public_reference_image_display_authorized": False,
        "scientific_claim_allowed": False,
        "contract_count": 10,
    }
    for field, expected in expected_boundary.items():
        if prototype.get(field) != expected:
            _fail(
                TruthfulDemoFailure.UNSUPPORTED_GOLD_RESULT,
                f"prototype evidence boundary {field} must be {expected!r}",
                "source/prototype_evidence_snapshot.json",
            )
    release_gate = evaluate_prototype_release_gate(prototype)
    if release_gate["decision"] != GO_PROTOTYPE_ONLY:
        failed = [
            gate["gate_id"] for gate in release_gate["gate_results"] if gate["status"] == "failed"
        ]
        _fail(
            TruthfulDemoFailure.UNSUPPORTED_GOLD_RESULT,
            f"prototype release gate returned NO_GO: {', '.join(failed)}",
            "source/prototype_evidence_snapshot.json",
        )


def _verify_analytics_receipt(
    artifacts: Mapping[str, Mapping[str, Any]],
    payloads: Mapping[str, object],
) -> None:
    receipt = _object(payloads["biominer-analytics-import-receipt"], "analytics_import_receipt")
    if (
        receipt.get("origin_repository") != "karikris/BioMiner"
        or receipt.get("origin_commit") != TRUTHFUL_DEMO_LEGACY_BIOMINER_SHA
    ):
        _fail(
            TruthfulDemoFailure.MISSING_BIOMINER_SHA,
            "analytics receipt does not identify the pinned BioMiner revision",
            "source/analytics_import_receipt.json",
        )
    if receipt.get("scientific_claim_allowed") is not False:
        _fail(
            TruthfulDemoFailure.UNSUPPORTED_GOLD_RESULT,
            "analytics import cannot authorize a scientific claim",
            "source/analytics_import_receipt.json",
        )
    source_manifest = _object(receipt.get("source_manifest"), "analytics source_manifest")
    if source_manifest.get("sha256") != (
        "a62abef7cbac8638da219e53e08ab6760bedcd4f49d6396bfa0d1891d96e5cf2"
    ):
        _fail(
            TruthfulDemoFailure.CHECKSUM_MISMATCH,
            "analytics receipt lacks the pinned BioMiner manifest checksum",
            "source/analytics_import_receipt.json",
        )

    rows = _array(receipt.get("artifacts"), "analytics receipt artifacts")
    expected_ids = {
        "biominer-flickr-query-hits-parquet",
        "biominer-flickr-geography-parquet",
        "biominer-flickr-geo-assignments-parquet",
        "biominer-flickr-geo-clusters-parquet",
    }
    observed_ids: set[str] = set()
    for index, raw in enumerate(rows):
        row = _object(raw, f"analytics receipt artifacts[{index}]")
        artifact_id = _required_text(row.get("artifact_id"), "analytics artifact_id")
        observed_ids.add(artifact_id)
        artifact = artifacts.get(artifact_id)
        if artifact is None:
            _fail(
                TruthfulDemoFailure.ORPHANED_ID,
                f"analytics receipt references missing artifact {artifact_id}",
                "source/analytics_import_receipt.json",
            )
        comparisons = {
            "path": row.get("fixture_path"),
            "sha256": row.get("sha256"),
            "bytes": row.get("byte_count"),
            "record_count": row.get("record_count"),
            "schema_version": row.get("schema_version"),
        }
        for field, expected in comparisons.items():
            if artifact.get(field) != expected:
                _fail(
                    TruthfulDemoFailure.CHECKSUM_MISMATCH,
                    f"{artifact_id} {field} differs from the analytics receipt",
                    "source/analytics_import_receipt.json",
                )
        if artifact.get("media_type") != "application/vnd.apache.parquet":
            _fail(
                TruthfulDemoFailure.CONTRACT_VIOLATION,
                f"{artifact_id} must be a Parquet artifact",
                f"artifact:{artifact_id}.media_type",
            )
    if observed_ids != expected_ids:
        _fail(
            TruthfulDemoFailure.ORPHANED_ID,
            "analytics receipt artifact set differs from the bounded replay",
            "source/analytics_import_receipt.json",
        )


def _verify_openai_replay(
    bundle: Mapping[str, Any],
    artifacts: Mapping[str, Mapping[str, Any]],
    payloads: Mapping[str, object],
) -> None:
    replay = _object(bundle.get("openai_replay"), "openai_replay")
    traces = _array(replay.get("traces"), "openai_replay.traces")
    expected = _object(bundle.get("expected_ui_counts"), "expected_ui_counts")
    if (
        replay.get("status") != "available"
        or replay.get("mode") != "stored_structured_outputs_only"
        or replay.get("credentials_required") is not False
        or replay.get("live_requests_allowed") is not False
        or len(traces) != 1
        or expected.get("openai_replay_trace_count") != 1
    ):
        _fail(
            TruthfulDemoFailure.CONTRACT_VIOLATION,
            "truthful fixture requires one credential-free stored analyst trace",
            "openai_replay",
        )

    trace = _object(traces[0], "openai_replay.traces[0]")
    request_id = _required_text(
        trace.get("request_artifact_id"), "openai_replay.traces[0].request_artifact_id"
    )
    response_id = _required_text(
        trace.get("response_artifact_id"), "openai_replay.traces[0].response_artifact_id"
    )
    if (
        trace.get("trace_id") != "papilio-target-resolution-stored-replay"
        or trace.get("sequence") != 1
        or trace.get("model") != "gpt-5.6-sol"
        or trace.get("occurred_at") is not None
        or trace.get("stored_output_only") is not True
        or request_id != "stored-analyst-request"
        or response_id != "stored-analyst-run"
        or artifacts[request_id].get("role") != "openai_replay_traces"
        or artifacts[response_id].get("role") != "openai_replay_traces"
        or trace.get("prompt_sha256") != artifacts[request_id].get("sha256")
        or trace.get("response_sha256") != artifacts[response_id].get("sha256")
    ):
        _fail(
            TruthfulDemoFailure.CONTRACT_VIOLATION,
            "stored analyst trace does not match its checksum-bound artifacts",
            "openai_replay.traces[0]",
        )

    request = _object(payloads[request_id], str(artifacts[request_id]["path"]))
    run = _object(payloads[response_id], str(artifacts[response_id]["path"]))
    target = _object(bundle.get("target"), "target")
    request_target = _object(request.get("target"), "stored request target")
    storage = _object(request.get("storage"), "stored request storage")
    output = _object(run.get("output"), "stored run output")
    output_target = _object(output.get("target"), "stored run output target")
    if (
        request.get("schemaVersion") != "taxalens-stored-analyst-request:v1.0.0"
        or request.get("requestKind") != "evidence_explanation"
        or request.get("reasoningEffort") != "medium"
        or storage
        != {
            "credentialsRequired": False,
            "liveRequestExecuted": False,
            "storedOutputOnly": True,
        }
        or request_target.get("acceptedTaxonKey") != target.get("accepted_taxon_key")
        or request_target.get("scientificName") != target.get("scientific_name")
        or run.get("schemaVersion") != "taxalens-research-analyst-run:v1.0.0"
        or run.get("model") != "gpt-5.6-sol"
        or run.get("reasoningEffort") != request.get("reasoningEffort")
        or run.get("responseStatus") != "completed"
        or output.get("requestKind") != request.get("requestKind")
        or output_target.get("acceptedTaxonKey") != target.get("accepted_taxon_key")
        or output_target.get("scientificName") != target.get("scientific_name")
        or output.get("scientificClaimAllowed") is not False
        or output.get("unsupportedClaimsRejected") is not True
    ):
        _fail(
            TruthfulDemoFailure.CONTRACT_VIOLATION,
            "stored analyst request or output changed the bounded public contract",
            "agent stored replay",
        )

    receipts = _array(run.get("toolReceipts"), "stored run toolReceipts")
    results = _array(run.get("toolResults"), "stored run toolResults")
    response_ids = _string_array(run.get("responseIds"), "stored run responseIds")
    budget = _object(run.get("budget"), "stored run budget")
    request_budget = _object(request.get("budget"), "stored request budget")
    if (
        len(receipts) != 1
        or len(results) != 1
        or len(response_ids) != 2
        or any(not re.fullmatch(r"stored-replay-turn-[0-9]{2}", item) for item in response_ids)
        or budget.get("usedToolCalls") != len(receipts)
        or budget.get("usedResponseTurns") != len(response_ids)
        or budget.get("maxToolCalls") != request_budget.get("maxToolCalls")
        or budget.get("maxResponseTurns") != request_budget.get("maxResponseTurns")
        or budget.get("exhausted") is not False
    ):
        _fail(
            TruthfulDemoFailure.CONTRACT_VIOLATION,
            "stored analyst trace counts or budgets differ",
            "agent/stored_analyst_run.json",
        )

    known = set(artifacts)
    returned_ids: set[str] = set()
    for index, (raw_receipt, raw_result) in enumerate(zip(receipts, results, strict=True)):
        receipt = _object(raw_receipt, f"stored receipt[{index}]")
        result = _object(raw_result, f"stored result[{index}]")
        receipt_ids = set(
            _string_array(receipt.get("artifactIds"), f"stored receipt[{index}].artifactIds")
        )
        result_ids = set(
            _string_array(result.get("artifactIds"), f"stored result[{index}].artifactIds")
        )
        if (
            receipt.get("sequence") != index + 1
            or (index == 0 and receipt.get("tool") != "resolve_taxon")
            or receipt.get("tool") != result.get("tool")
            or receipt.get("resultStatus") != result.get("status")
            or receipt_ids != result_ids
            or not result_ids.issubset(known)
            or result.get("scientificClaimAllowed") is not False
        ):
            _fail(
                TruthfulDemoFailure.CONTRACT_VIOLATION,
                "stored tool receipt and public result differ",
                f"agent tool trace[{index}]",
            )
        returned_ids.update(result_ids)

    nested_ids = {
        artifact_id
        for collection_name in ("plan", "evidenceBackedClaims", "unavailableEvidence")
        for raw in _array(output.get(collection_name), f"stored output {collection_name}")
        for artifact_id in _string_array(
            _object(raw, f"stored output {collection_name} item").get("artifactIds"),
            f"stored output {collection_name} artifactIds",
        )
    }
    approval = _object(output.get("approvalBoundary"), "stored output approvalBoundary")
    nested_ids.update(
        artifact_id
        for raw in _array(approval.get("items"), "stored output approval items")
        for artifact_id in _string_array(
            _object(raw, "stored approval item").get("artifactIds"),
            "stored approval item artifactIds",
        )
    )
    output_ids = set(_string_array(output.get("artifactIds"), "stored output artifactIds"))
    if output_ids != nested_ids or not output_ids.issubset(returned_ids):
        _fail(
            TruthfulDemoFailure.ORPHANED_ID,
            "stored output citations are not covered by its deterministic tool results",
            "agent/stored_analyst_run.json",
        )

    forbidden_keys = {
        "privateReasoning",
        "private_reasoning",
        "encrypted_content",
        "chainOfThought",
        "chain_of_thought",
        "rawResponseItems",
    }
    for location, mapping in _walk_mappings(run, "agent/stored_analyst_run.json"):
        present = forbidden_keys.intersection(mapping)
        if present:
            _fail(
                TruthfulDemoFailure.CONTRACT_VIOLATION,
                f"stored public output contains private fields: {sorted(present)}",
                location,
            )


def _verify_references(
    bundle: Mapping[str, Any],
    artifacts: Mapping[str, Mapping[str, Any]],
    payloads: Mapping[str, object],
) -> None:
    known_artifacts = set(artifacts)
    sections = _object(bundle.get("sections"), "sections")
    if set(sections) != set(JUDGE_BUNDLE_SECTION_NAMES):
        _fail(
            TruthfulDemoFailure.ORPHANED_ID,
            "section IDs do not match the judge contract",
            "judge_bundle.sections",
        )
    for name, raw in sections.items():
        section = _object(raw, f"sections.{name}")
        _require_known_artifact_ids(
            section.get("artifact_ids"), known_artifacts, f"sections.{name}.artifact_ids"
        )
    for container_name in ("rights", "attribution"):
        container = _object(bundle.get(container_name), container_name)
        key = "items" if container_name == "rights" else "entries"
        for index, raw in enumerate(_array(container.get(key), f"{container_name}.{key}")):
            entry = _object(raw, f"{container_name}.{key}[{index}]")
            _require_known_artifact_ids(
                entry.get("artifact_ids"),
                known_artifacts,
                f"{container_name}.{key}[{index}].artifact_ids",
            )
    for artifact_id, key in (
        ("rights-manifest", "items"),
        ("attribution-manifest", "entries"),
    ):
        payload = _object(payloads[artifact_id], str(artifacts[artifact_id]["path"]))
        for index, raw in enumerate(_array(payload.get(key), f"{artifact_id}.{key}")):
            entry = _object(raw, f"{artifact_id}.{key}[{index}]")
            _require_known_artifact_ids(
                entry.get("artifact_ids"),
                known_artifacts,
                f"{artifact_id}.{key}[{index}].artifact_ids",
            )

    summary = _object(payloads["run-summary"], "run_summary")
    decision_rows = _array(payloads["selective-decision-metadata"], "decision_rows")
    hero_ids = {
        _required_text(
            _object(row, f"decision_rows[{index}]").get("evidence_record_id"),
            f"decision_rows[{index}].evidence_record_id",
        )
        for index, row in enumerate(decision_rows)
    }
    if summary.get("hero_record_id") not in hero_ids:
        _fail(
            TruthfulDemoFailure.ORPHANED_ID,
            "run-summary hero_record_id has no decision record",
            "data/run_summary.json",
        )
    candidate_rows = _array(payloads["candidate-sets"], "candidate_sets")
    candidate_keys = {
        _required_text(
            _object(_object(row, "candidate row").get("candidate"), "candidate").get(
                "accepted_taxon_key"
            ),
            "candidate.accepted_taxon_key",
        )
        for row in candidate_rows
    }
    for index, raw in enumerate(decision_rows):
        decision = _object(raw, f"decision_rows[{index}]")
        plan = _array(decision.get("candidate_plan"), f"decision_rows[{index}].candidate_plan")
        plan_keys = {
            _required_text(
                _object(item, "candidate_plan item").get("accepted_taxon_key"),
                "candidate_plan.accepted_taxon_key",
            )
            for item in plan
        }
        if plan_keys != candidate_keys:
            _fail(
                TruthfulDemoFailure.ORPHANED_ID,
                "hero candidate plan does not resolve exactly to candidate_sets",
                f"decision_rows[{index}].candidate_plan",
            )


def _verify_counts(
    bundle: Mapping[str, Any],
    artifacts: Mapping[str, Mapping[str, Any]],
    payloads: Mapping[str, object],
) -> None:
    observed_counts: dict[str, int] = {}
    analytics_receipt = _object(
        payloads["biominer-analytics-import-receipt"], "analytics_import_receipt"
    )
    analytics_counts = {
        _required_text(
            _object(row, "analytics row").get("artifact_id"), "artifact_id"
        ): _required_nonnegative_int(
            _object(row, "analytics row").get("record_count"), "record_count"
        )
        for row in _array(analytics_receipt.get("artifacts"), "analytics artifacts")
    }
    geographic_manifest = _object(
        payloads["geographic-impact-manifest"], "geographic impact manifest"
    )
    geographic_counts = {
        _required_text(
            _object(row, "geographic artifact").get("path"), "path"
        ): _required_nonnegative_int(
            _object(row, "geographic artifact").get("row_count"), "row_count"
        )
        for row in _array(geographic_manifest.get("artifacts"), "geographic artifacts")
        if _object(row, "geographic artifact").get("availability") == "available"
    }
    for artifact_id, artifact in artifacts.items():
        declared = _required_nonnegative_int(
            artifact.get("record_count"), f"artifact:{artifact_id}.record_count"
        )
        payload = payloads[artifact_id]
        geographic_count = geographic_counts.get(str(artifact.get("path")))
        if geographic_count is not None:
            observed = geographic_count
        elif isinstance(payload, bytes):
            observed = (
                1
                if artifact.get("role") == "verification_media"
                else analytics_counts.get(artifact_id, -1)
            )
        elif artifact.get("role") == "attribution":
            observed = len(_array(_object(payload, artifact_id).get("entries"), "entries"))
        elif isinstance(payload, list):
            observed = len(payload)
        else:
            observed = 1
        if declared != observed:
            _fail(
                TruthfulDemoFailure.INCONSISTENT_COUNT,
                f"record_count is {declared}, payload has {observed}",
                str(artifact["path"]),
            )
        role = str(artifact.get("role"))
        if role in JUDGE_BUNDLE_SECTION_NAMES:
            observed_counts[role] = observed_counts.get(role, 0) + observed

    expected = _object(bundle.get("expected_ui_counts"), "expected_ui_counts")
    section_records = _object(expected.get("section_records"), "section_records")
    for name in JUDGE_BUNDLE_SECTION_NAMES:
        declared = _required_nonnegative_int(section_records.get(name), f"section_records.{name}")
        if declared != observed_counts.get(name, 0):
            _fail(
                TruthfulDemoFailure.INCONSISTENT_COUNT,
                f"expected {declared}, observed {observed_counts.get(name, 0)}",
                f"expected_ui_counts.section_records.{name}",
            )
    if expected.get("artifact_count") != len(artifacts):
        _fail(
            TruthfulDemoFailure.INCONSISTENT_COUNT,
            f"artifact_count must be {len(artifacts)}",
            "expected_ui_counts.artifact_count",
        )

    candidate_rows = _array(payloads["candidate-sets"], "candidate_sets")
    decision_rows = _array(payloads["selective-decision-metadata"], "decision_rows")
    if len(decision_rows) != 1:
        _fail(
            TruthfulDemoFailure.INCONSISTENT_COUNT,
            "truthful fixture requires exactly one hero decision state",
            "data/selective_decision_metadata.json",
        )
    hero = _object(decision_rows[0], "hero")
    if len(_array(hero.get("candidate_plan"), "hero.candidate_plan")) != len(candidate_rows):
        _fail(
            TruthfulDemoFailure.INCONSISTENT_COUNT,
            "hero candidate-plan count differs from candidate_sets",
            "hero.candidate_plan",
        )
    metrics = {
        _required_text(_object(row, "metric").get("metric_id"), "metric.metric_id"): _object(
            row, "metric"
        ).get("value")
        for row in _array(payloads["stage-metrics"], "stage_metrics")
    }
    snapshot = _object(payloads["pilot-metadata-snapshot"], "pilot_metadata_snapshot")
    contracts = _object(snapshot.get("contracts"), "snapshot.contracts")
    hits = _object(_object(contracts["query_hit_metrics"], "query_hit_metrics")["data"], "hits")
    source_counts = _object(
        _object(_object(contracts["source_media_counts"], "source_media_counts")["data"], "source")[
            "counts"
        ],
        "source.counts",
    )
    exact_metrics = {
        "flickr-query-hits": hits["query_hit_count"],
        "canonical-flickr-photos": hits["canonical_photo_count"],
        "eligible-source-media-candidates": source_counts["eligible_source_media_candidate_count"],
        "human-verified-source-media": source_counts["human_verified_source_media_count"],
    }
    if metrics != exact_metrics:
        _fail(
            TruthfulDemoFailure.INCONSISTENT_COUNT,
            "displayed metadata metrics differ from the verified BioMiner snapshot",
            "data/stage_metrics.json",
        )


def _verify_rights(
    bundle: Mapping[str, Any],
    artifacts: Mapping[str, Mapping[str, Any]],
    payloads: Mapping[str, object],
) -> None:
    rights = _object(bundle.get("rights"), "rights")
    items = _array(rights.get("items"), "rights.items")
    if rights.get("all_artifacts_covered") is not True or not items:
        _fail(
            TruthfulDemoFailure.MISSING_RIGHTS,
            "rights must declare non-empty complete artifact coverage",
            "judge_bundle.rights",
        )
    covered: set[str] = set()
    for index, raw in enumerate(items):
        item = _object(raw, f"rights.items[{index}]")
        covered.update(
            _string_array(item.get("artifact_ids"), f"rights.items[{index}].artifact_ids")
        )
        for key in ("license_name", "license_uri", "creator_or_owner", "source_url", "use_scope"):
            if not isinstance(item.get(key), str) or not str(item[key]).strip():
                _fail(
                    TruthfulDemoFailure.MISSING_RIGHTS,
                    f"rights item requires {key}",
                    f"rights.items[{index}]",
                )
        if item.get("status") not in {"license_checked", "rights_verified"}:
            _fail(
                TruthfulDemoFailure.MISSING_RIGHTS,
                "truthful payload rights must be checked or verified",
                f"rights.items[{index}].status",
            )
    if covered != set(artifacts):
        _fail(
            TruthfulDemoFailure.MISSING_RIGHTS,
            f"rights coverage differs; missing={sorted(set(artifacts) - covered)}",
            "judge_bundle.rights",
        )
    media_artifact_ids = {
        artifact_id
        for artifact_id, artifact in artifacts.items()
        if artifact.get("role") == "verification_media"
    }
    if len(media_artifact_ids) != 3 or rights.get("all_media_rights_verified") is not True:
        _fail(
            TruthfulDemoFailure.MISSING_RIGHTS,
            "the three verification-media artifacts require verified media rights",
            "judge_bundle.rights",
        )
    rights_payload = _object(payloads["rights-manifest"], "rights_manifest")
    payload_covered = {
        artifact_id
        for raw in _array(rights_payload.get("items"), "rights_manifest.items")
        for artifact_id in _string_array(
            _object(raw, "rights item").get("artifact_ids"), "rights item artifact_ids"
        )
    }
    if payload_covered != set(artifacts):
        _fail(
            TruthfulDemoFailure.MISSING_RIGHTS,
            "rights_manifest.json does not cover every inventory artifact",
            "rights_manifest.json",
        )
    if (
        rights_payload.get("media_asset_count") != 3
        or rights_payload.get("licensed_image_count") != 3
        or rights_payload.get("included_image_count") != 3
        or rights_payload.get("all_media_rights_verified") is not True
    ):
        _fail(
            TruthfulDemoFailure.MISSING_RIGHTS,
            "rights manifest must register all three licensed verification images",
            "rights_manifest",
        )


def _verify_attribution(
    bundle: Mapping[str, Any],
    artifacts: Mapping[str, Mapping[str, Any]],
    payloads: Mapping[str, object],
) -> None:
    attribution = _object(bundle.get("attribution"), "attribution")
    entries = _array(attribution.get("entries"), "attribution.entries")
    if attribution.get("complete") is not True or not entries:
        _fail(
            TruthfulDemoFailure.MISSING_ATTRIBUTION,
            "attribution must be explicitly complete and non-empty",
            "judge_bundle.attribution",
        )
    required = {
        artifact_id
        for raw in _array(_object(bundle["rights"], "rights").get("items"), "rights.items")
        if _object(raw, "rights item").get("attribution_required") is True
        for artifact_id in _string_array(
            _object(raw, "rights item").get("artifact_ids"), "rights artifact_ids"
        )
    }
    covered = _attribution_coverage(entries, "attribution.entries")
    if not required.issubset(covered):
        _fail(
            TruthfulDemoFailure.MISSING_ATTRIBUTION,
            f"missing attribution for {sorted(required - covered)}",
            "judge_bundle.attribution",
        )
    payload = _object(payloads["attribution-manifest"], "attribution_manifest")
    payload_entries = _array(payload.get("entries"), "attribution_manifest.entries")
    payload_covered = _attribution_coverage(payload_entries, "attribution_manifest.entries")
    if payload.get("complete") is not True or payload_covered != set(artifacts):
        _fail(
            TruthfulDemoFailure.MISSING_ATTRIBUTION,
            "attribution_manifest.json must cover every inventory artifact",
            "attribution_manifest.json",
        )


def _verify_verification_media_integrity(
    bundle: Mapping[str, Any],
    artifacts: Mapping[str, Mapping[str, Any]],
    payloads: Mapping[str, object],
) -> None:
    sections = _object(bundle.get("sections"), "sections")
    verification_section_names = (
        "verification_campaigns",
        "verification_items",
        "verification_media",
        "verification_decisions",
        "verification_quality",
    )
    _require_verification_schema(
        "judge_bundle_verification_sections",
        {
            name: _object(sections.get(name), f"sections.{name}")
            for name in verification_section_names
        },
        location="judge_bundle.sections.verification",
    )
    expected_sections = {
        "verification_campaigns": ["verification-campaign-manifest"],
        "verification_items": ["verification-items"],
        "verification_media": sorted(
            artifact_id
            for artifact_id, artifact in artifacts.items()
            if artifact.get("role") == "verification_media"
        ),
    }
    for section_name, expected_ids in expected_sections.items():
        section = _object(sections.get(section_name), f"sections.{section_name}")
        actual_ids = sorted(
            _string_array(
                section.get("artifact_ids"),
                f"sections.{section_name}.artifact_ids",
            )
        )
        if section.get("status") != "available" or actual_ids != sorted(expected_ids):
            _fail(
                TruthfulDemoFailure.ORPHANED_ID,
                f"{section_name} must expose exactly {sorted(expected_ids)}",
                f"sections.{section_name}",
            )

    manifest = _object(
        payloads["verification-campaign-manifest"],
        "verification/campaign_manifest.json",
    )
    manifest_sha256 = _required_text(
        manifest.get("manifestSha256"),
        "verification campaign manifestSha256",
    )
    unsigned_manifest = {key: value for key, value in manifest.items() if key != "manifestSha256"}
    computed_manifest_sha256 = hashlib.sha256(
        json.dumps(
            unsigned_manifest,
            ensure_ascii=False,
            separators=(",", ":"),
        ).encode()
    ).hexdigest()
    if computed_manifest_sha256 != manifest_sha256:
        _fail(
            TruthfulDemoFailure.CHECKSUM_MISMATCH,
            "verification campaign manifest identity differs",
            "verification/campaign_manifest.json",
        )

    campaign = _object(manifest.get("campaign"), "verification campaign")
    campaign_id = _required_text(campaign.get("campaignId"), "verification campaignId")
    if (
        campaign.get("manifestSha256") is not None
        or campaign.get("scientificClaimAllowed") is not False
        or campaign.get("publicReplay") is not True
    ):
        _fail(
            TruthfulDemoFailure.CONTRACT_VIOLATION,
            "verification campaign must remain public, unsigned internally, and non-scientific",
            "verification campaign",
        )
    _require_verification_schema(
        "campaign",
        {**campaign, "manifestSha256": manifest_sha256},
        location="verification/campaign_manifest.json:campaign",
    )
    semantics = _object(manifest.get("semantics"), "verification semantics")
    if semantics.get("scientificClaimAllowed") is not False:
        _fail(
            TruthfulDemoFailure.UNVERIFIED_REFERENCE_AS_SUPPORT,
            "verification manifest cannot authorize a scientific claim",
            "verification semantics",
        )

    source_rows = _array(manifest.get("items"), "verification manifest items")
    projected_rows = _array(payloads["verification-items"], "verification/items.json")
    source_items = _verification_items_by_id(
        source_rows,
        location="verification manifest items",
    )
    projected_items = _verification_items_by_id(
        projected_rows,
        location="verification/items.json",
    )
    if set(source_items) != set(projected_items):
        _fail(
            TruthfulDemoFailure.ORPHANED_ID,
            (
                "verification item projection differs; "
                f"missing={sorted(set(source_items) - set(projected_items))}, "
                f"unexpected={sorted(set(projected_items) - set(source_items))}"
            ),
            "verification/items.json",
        )

    media_artifact_ids = set(expected_sections["verification_media"])
    expected_media_ids = {f"verification-media-{item_id}" for item_id in source_items}
    if media_artifact_ids != expected_media_ids:
        _fail(
            TruthfulDemoFailure.ORPHANED_ID,
            (
                "displayed verification media differs from review items; "
                f"missing={sorted(expected_media_ids - media_artifact_ids)}, "
                f"unexpected={sorted(media_artifact_ids - expected_media_ids)}"
            ),
            "sections.verification_media",
        )

    bundle_rights = _array(
        _object(bundle.get("rights"), "rights").get("items"),
        "rights.items",
    )
    payload_rights = _array(
        _object(payloads["rights-manifest"], "rights_manifest").get("items"),
        "rights_manifest.items",
    )
    bundle_attribution = _array(
        _object(bundle.get("attribution"), "attribution").get("entries"),
        "attribution.entries",
    )
    payload_attribution = _array(
        _object(payloads["attribution-manifest"], "attribution_manifest").get("entries"),
        "attribution_manifest.entries",
    )

    for item_id, source_item in source_items.items():
        projected = projected_items[item_id]
        for key, expected in source_item.items():
            if key in {
                "campaignId",
                "imageByteCount",
                "imageSha256",
                "mediaType",
                "previewAsset",
            }:
                continue
            if projected.get(key) != expected:
                _fail(
                    TruthfulDemoFailure.ORPHANED_ID,
                    f"projected verification item field {key} differs from its manifest",
                    f"verification/items.json:{item_id}",
                )
        if (
            source_item.get("campaignId") != campaign_id
            or projected.get("campaignId") != campaign_id
        ):
            _fail(
                TruthfulDemoFailure.ORPHANED_ID,
                "verification item does not resolve to its campaign",
                f"verification/items.json:{item_id}.campaignId",
            )

        media_artifact_id = f"verification-media-{item_id}"
        artifact = artifacts[media_artifact_id]
        preview_asset = _required_text(
            source_item.get("previewAsset"),
            f"verification manifest item {item_id}.previewAsset",
        )
        expected_path = f"verification/media/{preview_asset}"
        source_contract = {
            key: value
            for key, value in source_item.items()
            if key not in {"previewAsset", "verificationLabel"}
        }
        source_contract["previewUri"] = expected_path
        projected_contract = {
            key: value
            for key, value in projected.items()
            if key
            not in {
                "mediaArtifactId",
                "previewAsset",
                "verificationLabel",
                "scientificClaimAllowed",
            }
        }
        _require_verification_schema(
            "item",
            source_contract,
            location=f"verification manifest item {item_id}",
        )
        _require_verification_schema(
            "item",
            projected_contract,
            location=f"verification/items.json:{item_id}",
        )
        if (
            projected.get("mediaArtifactId") != media_artifact_id
            or projected.get("previewAsset") != preview_asset
            or projected.get("previewUri") != expected_path
            or projected.get("mediaType") != source_item.get("mediaType")
            or projected.get("scientificClaimAllowed") is not False
            or artifact.get("path") != expected_path
            or artifact.get("media_type") != source_item.get("mediaType")
        ):
            _fail(
                TruthfulDemoFailure.ORPHANED_ID,
                "displayed verification image does not resolve exactly to its review item",
                f"verification/items.json:{item_id}",
            )
        if artifact.get("sha256") != source_item.get("imageSha256") or projected.get(
            "imageSha256"
        ) != source_item.get("imageSha256"):
            _fail(
                TruthfulDemoFailure.CHECKSUM_MISMATCH,
                "verification item image hash differs from the displayed artifact",
                f"verification/items.json:{item_id}.imageSha256",
            )
        if artifact.get("bytes") != source_item.get("imageByteCount") or projected.get(
            "imageByteCount"
        ) != source_item.get("imageByteCount"):
            _fail(
                TruthfulDemoFailure.CHECKSUM_MISMATCH,
                "verification item byte count differs from the displayed artifact",
                f"verification/items.json:{item_id}.imageByteCount",
            )
        if source_contract != projected_contract:
            _fail(
                TruthfulDemoFailure.CONTRACT_VIOLATION,
                "normalized verification item export differs from its source contract",
                f"verification/items.json:{item_id}",
            )

        identity = _object(
            source_item.get("providerSuppliedIdentity"),
            f"verification manifest item {item_id}.providerSuppliedIdentity",
        )
        item_rights = _object(
            source_item.get("rights"),
            f"verification manifest item {item_id}.rights",
        )
        if item_rights.get("policyStatus") != "allowed":
            _fail(
                TruthfulDemoFailure.MISSING_RIGHTS,
                "displayed verification media requires an allowed rights policy",
                f"verification manifest item {item_id}.rights.policyStatus",
            )

        bundle_right = _single_artifact_entry(
            bundle_rights,
            media_artifact_id,
            location="rights.items",
            failure=TruthfulDemoFailure.MISSING_RIGHTS,
        )
        payload_right = _single_artifact_entry(
            payload_rights,
            media_artifact_id,
            location="rights_manifest.items",
            failure=TruthfulDemoFailure.MISSING_RIGHTS,
        )
        expected_rights = {
            "license_name": item_rights.get("licenseName"),
            "license_uri": item_rights.get("licenseUri"),
            "creator_or_owner": item_rights.get("creator"),
            "source_url": item_rights.get("sourceUri"),
            "use_scope": TRUTHFUL_DEMO_VERIFICATION_USE_SCOPE,
            "attribution_required": True,
        }
        if bundle_right.get("status") != "rights_verified" or any(
            bundle_right.get(key) != value for key, value in expected_rights.items()
        ):
            _fail(
                TruthfulDemoFailure.MISSING_RIGHTS,
                "bundle media rights differ from the verification manifest or use scope",
                f"rights.items:{media_artifact_id}",
            )
        expected_payload_rights = {
            **expected_rights,
            "status": "rights_verified",
            "rights_holder": item_rights.get("rightsHolder"),
            "source_title": identity.get("rawLabel"),
            "sha256": artifact.get("sha256"),
            "bytes": artifact.get("bytes"),
        }
        if any(payload_right.get(key) != value for key, value in expected_payload_rights.items()):
            _fail(
                TruthfulDemoFailure.MISSING_RIGHTS,
                "rights manifest media entry differs from its item or inventory",
                f"rights_manifest.items:{media_artifact_id}",
            )

        expected_attribution = {
            "display_text": item_rights.get("attribution"),
            "creator": item_rights.get("creator"),
            "source_title": identity.get("rawLabel"),
            "source_url": item_rights.get("sourceUri"),
            "license_name": item_rights.get("licenseName"),
            "license_uri": item_rights.get("licenseUri"),
        }
        for entries, location in (
            (bundle_attribution, "attribution.entries"),
            (payload_attribution, "attribution_manifest.entries"),
        ):
            attribution = _single_artifact_entry(
                entries,
                media_artifact_id,
                location=location,
                failure=TruthfulDemoFailure.MISSING_ATTRIBUTION,
            )
            if any(attribution.get(key) != value for key, value in expected_attribution.items()):
                _fail(
                    TruthfulDemoFailure.MISSING_ATTRIBUTION,
                    "verification media attribution differs from its manifest item",
                    f"{location}:{media_artifact_id}",
                )


def _require_verification_schema(
    contract: VerificationSchemaContract,
    value: object,
    *,
    location: str,
) -> None:
    validation = validate_verification_schema(contract, value)
    if validation.valid:
        return
    failures = ", ".join(
        f"{failure.instance_path or '/'}:{failure.keyword}" for failure in validation.failures
    )
    _fail(
        TruthfulDemoFailure.CONTRACT_VIOLATION,
        f"{contract} failed authoritative JSON Schema validation: {failures}",
        location,
    )


def _verification_items_by_id(
    rows: Sequence[object],
    *,
    location: str,
) -> dict[str, Mapping[str, Any]]:
    items: dict[str, Mapping[str, Any]] = {}
    for index, raw in enumerate(rows):
        item = _object(raw, f"{location}[{index}]")
        item_id = _required_text(item.get("itemId"), f"{location}[{index}].itemId")
        if item_id in items:
            _fail(
                TruthfulDemoFailure.ORPHANED_ID,
                f"duplicate verification item ID {item_id}",
                location,
            )
        items[item_id] = item
    return items


def _single_artifact_entry(
    entries: Sequence[object],
    artifact_id: str,
    *,
    location: str,
    failure: TruthfulDemoFailure,
) -> Mapping[str, Any]:
    matches = []
    for index, raw in enumerate(entries):
        entry = _object(raw, f"{location}[{index}]")
        artifact_ids = _string_array(
            entry.get("artifact_ids"),
            f"{location}[{index}].artifact_ids",
        )
        if artifact_id in artifact_ids:
            matches.append((entry, artifact_ids))
    if len(matches) != 1 or matches[0][1] != [artifact_id]:
        _fail(
            failure,
            "verification media requires exactly one dedicated entry",
            f"{location}:{artifact_id}",
        )
    return matches[0][0]


def _attribution_coverage(entries: Sequence[object], location: str) -> set[str]:
    covered: set[str] = set()
    for index, raw in enumerate(entries):
        entry = _object(raw, f"{location}[{index}]")
        covered.update(
            _string_array(entry.get("artifact_ids"), f"{location}[{index}].artifact_ids")
        )
        for key in (
            "display_text",
            "creator",
            "source_title",
            "source_url",
            "license_name",
            "license_uri",
        ):
            if not isinstance(entry.get(key), str) or not str(entry[key]).strip():
                _fail(
                    TruthfulDemoFailure.MISSING_ATTRIBUTION,
                    f"attribution entry requires {key}",
                    f"{location}[{index}]",
                )
    return covered


def _verify_semantics(bundle: Mapping[str, Any], payloads: Mapping[str, object]) -> None:
    for location, value in (("judge_bundle.json", bundle), *payloads.items()):
        for item_location, item in _walk(value, str(location)):
            if isinstance(item, str) and _PLACEHOLDER_PATTERN.search(item):
                _fail(
                    TruthfulDemoFailure.UNRESOLVED_PLACEHOLDER,
                    f"placeholder text remains: {item!r}",
                    item_location,
                )
        for item_location, mapping in _walk_mappings(value, str(location)):
            _verify_candidate_not_occurrence(mapping, item_location)
            _verify_unverified_not_support(mapping, item_location)
            _verify_raw_score_not_probability(mapping, item_location)
            for key in _GOLD_KEYS:
                if mapping.get(key) is not None:
                    _fail(
                        TruthfulDemoFailure.UNSUPPORTED_GOLD_RESULT,
                        f"metadata-only v1 fixture cannot contain {key}",
                        item_location,
                    )
    summary = _object(payloads["run-summary"], "run_summary")
    decisions = _array(payloads["selective-decision-metadata"], "decisions")
    hero = _object(decisions[0], "hero")
    if summary.get("hero_state") != "awaiting_human_review" or hero.get("state") != (
        "awaiting_human_review"
    ):
        _fail(
            TruthfulDemoFailure.UNSUPPORTED_GOLD_RESULT,
            "metadata-only hero must remain awaiting_human_review",
            "hero.state",
        )
    for field in ("target_classification", "decision", "media_id", "image_path"):
        if hero.get(field) is not None:
            _fail(
                TruthfulDemoFailure.UNSUPPORTED_GOLD_RESULT,
                f"metadata-only hero requires {field}=null",
                f"hero.{field}",
            )


def _verify_candidate_not_occurrence(mapping: Mapping[str, Any], location: str) -> None:
    semantics = mapping.get("candidate_semantics")
    if not isinstance(semantics, str) or semantics in {"not_applicable", "reviewed_evidence"}:
        return
    for key in ("display_role", "display_as", "evidence_role"):
        value = mapping.get(key)
        if isinstance(value, str) and value.casefold() in _OCCURRENCE_VALUES:
            _fail(
                TruthfulDemoFailure.CANDIDATE_AS_OCCURRENCE,
                f"{semantics} cannot be displayed as {value}",
                location,
            )
    for key in ("occurrence_claim", "confirmed_occurrence", "is_occurrence"):
        if mapping.get(key) is True:
            _fail(
                TruthfulDemoFailure.CANDIDATE_AS_OCCURRENCE,
                f"{semantics} cannot assert {key}",
                location,
            )


def _verify_unverified_not_support(mapping: Mapping[str, Any], location: str) -> None:
    unverified = mapping.get("human_review_required") is True or mapping.get(
        "verification_status"
    ) in {"metadata_only", "unreviewed", "human_review_pending", "unavailable"}
    if not unverified:
        return
    for key in ("display_role", "display_as", "evidence_role", "support_status"):
        value = mapping.get(key)
        if isinstance(value, str) and value.casefold() in _SUPPORT_VALUES:
            _fail(
                TruthfulDemoFailure.UNVERIFIED_REFERENCE_AS_SUPPORT,
                f"unverified reference cannot be displayed as {value}",
                location,
            )
    for key in ("reference_support", "supports_target", "verified_support"):
        if mapping.get(key) is True:
            _fail(
                TruthfulDemoFailure.UNVERIFIED_REFERENCE_AS_SUPPORT,
                f"unverified reference cannot assert {key}",
                location,
            )
    if mapping.get("scientific_claim_allowed") is True:
        _fail(
            TruthfulDemoFailure.UNVERIFIED_REFERENCE_AS_SUPPORT,
            "unverified record cannot allow a scientific claim",
            location,
        )


def _verify_raw_score_not_probability(mapping: Mapping[str, Any], location: str) -> None:
    raw_keys = _RAW_SCORE_KEYS.intersection(mapping)
    probability_keys = _PROBABILITY_KEYS.intersection(mapping)
    display_kind = mapping.get("score_display_kind") or mapping.get("display_as")
    if raw_keys and (
        probability_keys
        or (isinstance(display_kind, str) and display_kind.casefold() == "probability")
    ):
        _fail(
            TruthfulDemoFailure.RAW_SCORE_AS_PROBABILITY,
            f"raw fields {sorted(raw_keys)} cannot be presented as probability",
            location,
        )


def _verify_checksum_roots(bundle: Mapping[str, Any], inventory: list[dict[str, Any]]) -> None:
    checksums = _object(bundle.get("checksums"), "checksums")
    inventory_digest = compute_inventory_sha256(inventory)
    payload_digest = compute_payload_root_sha256(inventory)
    if checksums.get("inventory_sha256") != inventory_digest:
        _fail(
            TruthfulDemoFailure.CHECKSUM_MISMATCH,
            "inventory checksum root differs",
            "checksums.inventory_sha256",
        )
    if checksums.get("payload_root_sha256") != payload_digest:
        _fail(
            TruthfulDemoFailure.CHECKSUM_MISMATCH,
            "payload checksum root differs",
            "checksums.payload_root_sha256",
        )


def _require_known_artifact_ids(value: object, known: set[str], location: str) -> None:
    refs = _string_array(value, location)
    unknown = sorted(set(refs) - known)
    if unknown:
        _fail(
            TruthfulDemoFailure.ORPHANED_ID,
            f"unknown artifact IDs: {unknown}",
            location,
        )


def _load_json_object(path: Path, *, location: str) -> dict[str, Any]:
    try:
        payload = json.loads(
            path.read_bytes(),
            object_pairs_hook=_reject_duplicate_keys,
            parse_constant=_reject_non_json_constant,
        )
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        _fail(
            TruthfulDemoFailure.CONTRACT_VIOLATION,
            f"file is not strict UTF-8 JSON: {error}",
            location,
        )
    return _object(payload, location)


def _object(value: object, location: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        _fail(TruthfulDemoFailure.CONTRACT_VIOLATION, "expected an object", location)
    return value


def _array(value: object, location: str) -> list[object]:
    if not isinstance(value, list):
        _fail(TruthfulDemoFailure.CONTRACT_VIOLATION, "expected an array", location)
    return value


def _string_array(value: object, location: str) -> list[str]:
    rows = _array(value, location)
    if any(not isinstance(item, str) or not item for item in rows):
        _fail(TruthfulDemoFailure.CONTRACT_VIOLATION, "expected string IDs", location)
    return rows


def _required_text(value: object, location: str) -> str:
    if not isinstance(value, str) or not value.strip():
        _fail(TruthfulDemoFailure.CONTRACT_VIOLATION, "expected non-empty text", location)
    return value


def _required_nonnegative_int(value: object, location: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        _fail(
            TruthfulDemoFailure.CONTRACT_VIOLATION,
            "expected a non-negative integer",
            location,
        )
    return value


def _safe_relative_path(value: object, location: str) -> str:
    text = _required_text(value, location)
    path = PurePosixPath(text)
    if (
        path.is_absolute()
        or path.as_posix() != text
        or any(part in {"", ".", ".."} for part in path.parts)
    ):
        _fail(
            TruthfulDemoFailure.CONTRACT_VIOLATION,
            "expected a normalized relative path",
            location,
        )
    return text


def _walk(value: object, location: str) -> Iterator[tuple[str, object]]:
    yield location, value
    if isinstance(value, dict):
        for key, item in value.items():
            yield from _walk(item, f"{location}.{key}")
    elif isinstance(value, list):
        for index, item in enumerate(value):
            yield from _walk(item, f"{location}[{index}]")


def _walk_mappings(value: object, location: str) -> Iterator[tuple[str, Mapping[str, Any]]]:
    for item_location, item in _walk(value, location):
        if isinstance(item, dict):
            yield item_location, item


def _reject_duplicate_keys(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise json.JSONDecodeError(f"duplicate object key {key!r}", key, 0)
        result[key] = value
    return result


def _reject_non_json_constant(value: str) -> None:
    raise json.JSONDecodeError(f"non-JSON numeric constant {value!r}", value, 0)


def _fail(
    code: TruthfulDemoFailure,
    detail: str,
    location: str | Path | None = None,
) -> Any:
    raise TruthfulDemoVerificationError(
        code,
        detail,
        location=None if location is None else str(location),
    )


__all__ = [
    "DEFAULT_TRUTHFUL_DEMO_MANIFEST",
    "TruthfulDemoFailure",
    "TruthfulDemoVerification",
    "TruthfulDemoVerificationError",
    "verify_truthful_demo",
]
