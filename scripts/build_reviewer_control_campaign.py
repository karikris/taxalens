#!/usr/bin/env python3
"""Build the bounded reviewer workflow-control campaign.

The six-item packet exercises a known target fixture, a procedural negative,
an unscored ambiguous case, duplicate handling, an intentional media failure,
and an unscored adjudication example. It reuses checksum-pinned repository
assets and creates no human review event, reviewer score, or scientific result.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from copy import deepcopy
from pathlib import Path
from typing import Any

from PIL import Image

PACKET_SCHEMA_VERSION = "taxalens-reviewer-control-campaign-packet:v1.0.0"
CAMPAIGN_SCHEMA_VERSION = "taxalens-verification-campaign:v1.0.0"
CONTROL_SET_SCHEMA_VERSION = "taxalens-reviewer-control-set:v1.0.0"
SELECTION_SEED = "taxalens-papilio-demoleus-reviewer-controls-v1"
TAXALENS_BASE_SHA = "adb202a9b28f28dd0cb6702945296cb714062236"
BIOMINER_CONTEXT_SHA = "94fa1f634ee3c63917c05d78181dd3cf9ceff940"

COMMONS_MANIFEST = {
    "path": "demo/source/verification/papilio-demoleus-commons.campaign.json",
    "sha256": "00087bce738f5098893eea7b8fce238d3c88f85a7ee643eceddfb22466d6087d",
}

TRACKED_MEDIA = {
    "known_target": {
        "path": "apps/web/src/review/assets/papilio-demoleus-open-wing.jpg",
        "sha256": "47248e36944cf91256c906e8454adcad99121da049260745d57f4cbffae65a78",
        "byteCount": 180_698,
        "mediaType": "image/jpeg",
    },
    "known_negative": {
        "path": (
            "apps/web/e2e/judge-layout.visual.spec.ts-snapshots/"
            "dashboard-1280x720-chromium-linux.png"
        ),
        "sha256": "4f715f98854825ce555265276189f96046c10d1b635d027980fae0d187845934",
        "byteCount": 116_584,
        "mediaType": "image/png",
    },
    "ambiguous": {
        "path": (
            "apps/web/e2e/verification.visual.spec.ts-snapshots/reference-review-chromium-linux.png"
        ),
        "sha256": "7a2960f08f59821fbc0da942cb19d05ee2df58b99a1c058fc7bde0c6c6b7c326",
        "byteCount": 680_147,
        "mediaType": "image/png",
    },
    "duplicate": {
        "path": "apps/web/src/review/assets/papilio-demoleus-open-wing.jpg",
        "sha256": "47248e36944cf91256c906e8454adcad99121da049260745d57f4cbffae65a78",
        "byteCount": 180_698,
        "mediaType": "image/jpeg",
    },
    "adjudication_example": {
        "path": "apps/web/src/review/assets/papilio-demoleus-closed-wing.jpg",
        "sha256": "3bd3248347c3b82a977b0890f192f2f0c93253eff13d38b4b54dedb08b39627b",
        "byteCount": 159_332,
        "mediaType": "image/jpeg",
    },
}

MISSING_MEDIA_DESCRIPTOR = b"taxalens intentionally absent reviewer control media v1\n"
MISSING_MEDIA_PATH = (
    "demo/fixture/papilio_pilot/verification/control-media/intentionally-missing.jpg"
)

MISSION_TARGET = {
    "acceptedTaxonKey": "gbif:1938069",
    "scientificName": "Papilio demoleus",
    "commonName": "lime swallowtail",
    "rank": "species",
    "authority": "Linnaeus, 1758",
}

SCENARIO_ORDER = (
    "known_target",
    "known_negative",
    "ambiguous",
    "duplicate",
    "media_failure",
    "adjudication_example",
)


def canonical_json(value: Any) -> str:
    return json.dumps(
        value,
        allow_nan=False,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_path(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def fingerprint(value: Any) -> str:
    return sha256_bytes(canonical_json(value).encode("utf-8"))


def verify_file(
    repo_root: Path,
    relative_path: str,
    expected_sha256: str,
    expected_byte_count: int | None,
) -> Path:
    path = repo_root / relative_path
    if not path.is_file():
        raise RuntimeError(f"Required control-campaign input is missing: {path}")
    if expected_byte_count is not None and path.stat().st_size != expected_byte_count:
        raise RuntimeError(f"Control-campaign input byte count changed: {path}")
    actual_sha256 = sha256_path(path)
    if actual_sha256 != expected_sha256:
        raise RuntimeError(
            f"Control-campaign input digest changed for {path}: "
            f"expected {expected_sha256}, got {actual_sha256}"
        )
    return path


def verify_inputs(
    repo_root: Path,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    commons_path = verify_file(
        repo_root,
        str(COMMONS_MANIFEST["path"]),
        str(COMMONS_MANIFEST["sha256"]),
        None,
    )
    commons = json.loads(commons_path.read_text(encoding="utf-8"))
    receipts: list[dict[str, Any]] = [
        {
            "inputId": "commons_campaign_manifest",
            "path": str(COMMONS_MANIFEST["path"]),
            "sha256": str(COMMONS_MANIFEST["sha256"]),
            "byteCount": commons_path.stat().st_size,
            "gitTracked": True,
            "status": "verified",
        }
    ]
    seen_paths: set[str] = set()
    for scenario_id, declared in TRACKED_MEDIA.items():
        relative_path = str(declared["path"])
        path = verify_file(
            repo_root,
            relative_path,
            str(declared["sha256"]),
            int(declared["byteCount"]),
        )
        with Image.open(path) as image:
            image.verify()
        with Image.open(path) as image:
            width, height = image.size
            decoded_format = str(image.format or "").lower()
        expected_format = str(declared["mediaType"]).split("/", 1)[1]
        if expected_format == "jpeg":
            expected_format = "jpeg"
        if decoded_format != expected_format:
            raise RuntimeError(
                f"Control media format changed for {relative_path}: "
                f"expected {expected_format}, got {decoded_format}"
            )
        if relative_path not in seen_paths:
            receipts.append(
                {
                    "inputId": f"media:{scenario_id}",
                    "path": relative_path,
                    "sha256": str(declared["sha256"]),
                    "byteCount": path.stat().st_size,
                    "mediaType": str(declared["mediaType"]),
                    "decodedWidth": width,
                    "decodedHeight": height,
                    "gitTracked": True,
                    "status": "verified",
                }
            )
            seen_paths.add(relative_path)
    missing_path = repo_root / MISSING_MEDIA_PATH
    if missing_path.exists():
        raise RuntimeError(
            f"The intentional media-failure control unexpectedly became available: {missing_path}"
        )
    receipts.append(
        {
            "inputId": "media:media_failure",
            "path": MISSING_MEDIA_PATH,
            "sha256": sha256_bytes(MISSING_MEDIA_DESCRIPTOR),
            "byteCount": len(MISSING_MEDIA_DESCRIPTOR),
            "mediaType": "image/jpeg",
            "gitTracked": False,
            "status": "intentionally_absent",
            "descriptor": MISSING_MEDIA_DESCRIPTOR.decode("utf-8").strip(),
        }
    )
    return commons, receipts


def commons_item(
    commons: dict[str, Any],
    source_item_id: str,
) -> dict[str, Any]:
    for item in commons["items"]:
        if item["itemId"] == source_item_id:
            return deepcopy(item)
    raise RuntimeError(f"Commons fixture item is unavailable: {source_item_id}")


def fixture_rights(relative_path: str) -> dict[str, Any]:
    return {
        "creator": "TaxaLens contributors",
        "rightsHolder": "TaxaLens contributors",
        "licenseName": "MIT",
        "licenseUri": "https://spdx.org/licenses/MIT.html",
        "policyStatus": "allowed",
        "attribution": "TaxaLens deterministic product fixture, MIT",
        "sourceUri": (
            f"https://github.com/karikris/taxalens/blob/{TAXALENS_BASE_SHA}/{relative_path}"
        ),
    }


def base_item(
    *,
    item_id: str,
    campaign_id: str,
    source: str,
    source_observation_id: str,
    source_media_id: str,
    media: dict[str, Any],
    target: dict[str, Any],
    provider_identity: dict[str, Any],
    expected_life_stage: str,
    expected_visual_domain: str,
    expected_view: str,
    duplicate_group_id: str,
    observation_group_id: str,
    owner_group_id: str,
    sampling_stratum_id: str,
    rights: dict[str, Any],
    question_fingerprint: str,
) -> dict[str, Any]:
    return {
        "itemId": item_id,
        "campaignId": campaign_id,
        "source": source,
        "sourceObservationId": source_observation_id,
        "sourceMediaId": source_media_id,
        "imageSha256": str(media["sha256"]),
        "imageByteCount": int(media["byteCount"]),
        "mediaType": str(media["mediaType"]),
        "previewUri": str(media["path"]),
        "targetTaxon": deepcopy(target),
        "providerSuppliedIdentity": deepcopy(provider_identity),
        "expectedLifeStage": expected_life_stage,
        "expectedVisualDomain": expected_visual_domain,
        "expectedView": expected_view,
        "duplicateGroupId": duplicate_group_id,
        "observationGroupId": observation_group_id,
        "ownerPhotographerGroupId": owner_group_id,
        "samplingStratumId": sampling_stratum_id,
        "inclusionProbability": None,
        "rights": deepcopy(rights),
        "questionFingerprint": question_fingerprint,
    }


def build_items(
    commons: dict[str, Any],
    campaign_id: str,
    question_fingerprint: str,
) -> list[dict[str, Any]]:
    open_wing = commons_item(
        commons,
        "commons-papilio-demoleus-open-wing",
    )
    closed_wing = commons_item(
        commons,
        "commons-papilio-demoleus-closed-wing",
    )
    known_target_media = TRACKED_MEDIA["known_target"]
    known_target = base_item(
        item_id="reviewer-control:known-target",
        campaign_id=campaign_id,
        source="wikimedia_commons",
        source_observation_id=str(open_wing["sourceObservationId"]),
        source_media_id=str(open_wing["sourceMediaId"]),
        media=known_target_media,
        target=MISSION_TARGET,
        provider_identity={
            **open_wing["providerSuppliedIdentity"],
            "verificationStatus": ("human_curated_fixture:not_independent_taxonomic_verification"),
        },
        expected_life_stage="adult",
        expected_visual_domain="live_field",
        expected_view="dorsal",
        duplicate_group_id=str(open_wing["duplicateGroupId"]),
        observation_group_id=str(open_wing["observationGroupId"]),
        owner_group_id=str(open_wing["ownerPhotographerGroupId"]),
        sampling_stratum_id="known_target",
        rights=open_wing["rights"],
        question_fingerprint=question_fingerprint,
    )
    known_negative_media = TRACKED_MEDIA["known_negative"]
    known_negative = base_item(
        item_id="reviewer-control:known-negative",
        campaign_id=campaign_id,
        source="taxalens_fixture",
        source_observation_id="taxalens-fixture:dashboard-no-organism",
        source_media_id="taxalens-fixture:dashboard-no-organism",
        media=known_negative_media,
        target=MISSION_TARGET,
        provider_identity={
            "providerTaxonKey": None,
            "scientificName": None,
            "commonName": None,
            "rawLabel": "TaxaLens dashboard screenshot procedural negative",
            "verificationStatus": "procedural_negative:not_biological_media",
        },
        expected_life_stage="unknown",
        expected_visual_domain="unsuitable",
        expected_view="unknown",
        duplicate_group_id=f"sha256:{known_negative_media['sha256']}",
        observation_group_id="taxalens-fixture:dashboard-no-organism",
        owner_group_id="taxalens-fixture:product-screenshot",
        sampling_stratum_id="known_negative",
        rights=fixture_rights(str(known_negative_media["path"])),
        question_fingerprint=question_fingerprint,
    )
    ambiguous_media = TRACKED_MEDIA["ambiguous"]
    ambiguous = base_item(
        item_id="reviewer-control:ambiguous",
        campaign_id=campaign_id,
        source="taxalens_fixture",
        source_observation_id="taxalens-fixture:embedded-reference-review",
        source_media_id="taxalens-fixture:embedded-reference-review",
        media=ambiguous_media,
        target=MISSION_TARGET,
        provider_identity={
            "providerTaxonKey": None,
            "scientificName": "Papilio demoleus",
            "commonName": "lime swallowtail",
            "rawLabel": "Interface screenshot containing an embedded reference image",
            "verificationStatus": ("workflow_ambiguity:not_a_standalone_source_observation"),
        },
        expected_life_stage="unknown",
        expected_visual_domain="ambiguous",
        expected_view="unknown",
        duplicate_group_id=f"sha256:{ambiguous_media['sha256']}",
        observation_group_id="taxalens-fixture:embedded-reference-review",
        owner_group_id="taxalens-fixture:product-screenshot",
        sampling_stratum_id="ambiguous",
        rights=fixture_rights(str(ambiguous_media["path"])),
        question_fingerprint=question_fingerprint,
    )
    duplicate_media = TRACKED_MEDIA["duplicate"]
    duplicate = base_item(
        item_id="reviewer-control:duplicate",
        campaign_id=campaign_id,
        source="wikimedia_commons",
        source_observation_id=str(open_wing["sourceObservationId"]),
        source_media_id=str(open_wing["sourceMediaId"]),
        media=duplicate_media,
        target=MISSION_TARGET,
        provider_identity={
            **open_wing["providerSuppliedIdentity"],
            "verificationStatus": ("intentional_duplicate:not_an_independent_observation"),
        },
        expected_life_stage="adult",
        expected_visual_domain="live_field",
        expected_view="dorsal",
        duplicate_group_id=str(open_wing["duplicateGroupId"]),
        observation_group_id=str(open_wing["observationGroupId"]),
        owner_group_id=str(open_wing["ownerPhotographerGroupId"]),
        sampling_stratum_id="duplicate",
        rights=open_wing["rights"],
        question_fingerprint=question_fingerprint,
    )
    missing_sha256 = sha256_bytes(MISSING_MEDIA_DESCRIPTOR)
    media_failure = base_item(
        item_id="reviewer-control:media-failure",
        campaign_id=campaign_id,
        source="taxalens_fixture",
        source_observation_id="taxalens-fixture:intentionally-missing-media",
        source_media_id="taxalens-fixture:intentionally-missing-media",
        media={
            "path": MISSING_MEDIA_PATH,
            "sha256": missing_sha256,
            "byteCount": len(MISSING_MEDIA_DESCRIPTOR),
            "mediaType": "image/jpeg",
        },
        target=MISSION_TARGET,
        provider_identity={
            "providerTaxonKey": None,
            "scientificName": None,
            "commonName": None,
            "rawLabel": "Intentionally absent media control",
            "verificationStatus": "intentionally_absent_media",
        },
        expected_life_stage="unknown",
        expected_visual_domain="unsuitable",
        expected_view="unknown",
        duplicate_group_id=f"sha256:{missing_sha256}",
        observation_group_id="taxalens-fixture:intentionally-missing-media",
        owner_group_id="taxalens-fixture:control-generator",
        sampling_stratum_id="media_failure",
        rights=fixture_rights(MISSING_MEDIA_PATH),
        question_fingerprint=question_fingerprint,
    )
    adjudication_media = TRACKED_MEDIA["adjudication_example"]
    adjudication = base_item(
        item_id="reviewer-control:adjudication-example",
        campaign_id=campaign_id,
        source="wikimedia_commons",
        source_observation_id=str(closed_wing["sourceObservationId"]),
        source_media_id=str(closed_wing["sourceMediaId"]),
        media=adjudication_media,
        target=MISSION_TARGET,
        provider_identity={
            **closed_wing["providerSuppliedIdentity"],
            "verificationStatus": ("conflict_exercise:not_a_prepopulated_human_decision"),
        },
        expected_life_stage="adult",
        expected_visual_domain="live_field",
        expected_view="dorsal",
        duplicate_group_id=str(closed_wing["duplicateGroupId"]),
        observation_group_id=str(closed_wing["observationGroupId"]),
        owner_group_id=str(closed_wing["ownerPhotographerGroupId"]),
        sampling_stratum_id="adjudication_example",
        rights=closed_wing["rights"],
        question_fingerprint=question_fingerprint,
    )
    return [
        known_target,
        known_negative,
        ambiguous,
        duplicate,
        media_failure,
        adjudication,
    ]


def scenario_definitions() -> list[dict[str, Any]]:
    definitions = {
        "known_target": {
            "itemId": "reviewer-control:known-target",
            "purpose": "procedural_positive_control",
            "scoredByReviewerControlMetrics": True,
            "expectedMediaState": "viewable",
            "expectedOutcome": "yes",
            "expectedWorkflow": "record_scientific_decision",
            "truthScope": "reviewer_workflow_fixture_only",
            "groundTruthBasis": (
                "Pinned rights-cleared human-curated Commons fixture metadata; "
                "not an independent expert taxonomic attestation."
            ),
        },
        "known_negative": {
            "itemId": "reviewer-control:known-negative",
            "purpose": "procedural_negative_control",
            "scoredByReviewerControlMetrics": True,
            "expectedMediaState": "viewable",
            "expectedOutcome": "no",
            "expectedWorkflow": "record_scientific_decision",
            "truthScope": "reviewer_workflow_fixture_only",
            "groundTruthBasis": (
                "The pinned TaxaLens dashboard screenshot contains no standalone "
                "biological observation and is a procedural negative."
            ),
        },
        "ambiguous": {
            "itemId": "reviewer-control:ambiguous",
            "purpose": "uncertainty_handling_exercise",
            "scoredByReviewerControlMetrics": False,
            "expectedMediaState": "viewable",
            "expectedOutcome": "cant_tell",
            "expectedWorkflow": "preserve_uncertainty_without_forcing_yes_or_no",
            "truthScope": "unscored_workflow_exercise",
            "groundTruthBasis": (
                "An interface screenshot containing an embedded image is not a "
                "standalone source observation; the exercise is intentionally unscored."
            ),
        },
        "duplicate": {
            "itemId": "reviewer-control:duplicate",
            "purpose": "duplicate_handling_exercise",
            "scoredByReviewerControlMetrics": False,
            "expectedMediaState": "viewable",
            "expectedOutcome": None,
            "expectedWorkflow": "record_duplicate_concern_without_double_counting",
            "truthScope": "unscored_workflow_exercise",
            "groundTruthBasis": (
                "The item is byte-identical to the known-target item and shares "
                "its duplicate and observation groups."
            ),
        },
        "media_failure": {
            "itemId": "reviewer-control:media-failure",
            "purpose": "media_failure_control",
            "scoredByReviewerControlMetrics": True,
            "expectedMediaState": "unviewable",
            "expectedOutcome": None,
            "expectedWorkflow": "record_cant_view_without_scientific_decision",
            "truthScope": "reviewer_workflow_fixture_only",
            "groundTruthBasis": (
                "The declared fixture path is intentionally absent and the "
                "builder fails if it becomes available."
            ),
        },
        "adjudication_example": {
            "itemId": "reviewer-control:adjudication-example",
            "purpose": "adjudication_workflow_exercise",
            "scoredByReviewerControlMetrics": False,
            "expectedMediaState": "viewable",
            "expectedOutcome": None,
            "expectedWorkflow": "retain_dissent_then_require_independent_adjudication",
            "truthScope": "unscored_workflow_exercise",
            "groundTruthBasis": (
                "The displayed source describes a ventral view while the exercise "
                "asks about dorsal-view support; no dissent or resolution is prefilled."
            ),
        },
    }
    return [
        {
            "scenarioId": scenario_id,
            **definitions[scenario_id],
            "prepopulatedEventIds": [],
        }
        for scenario_id in SCENARIO_ORDER
    ]


def build_packet(repo_root: Path) -> dict[str, Any]:
    commons, input_receipts = verify_inputs(repo_root)
    scenarios = scenario_definitions()
    question_fingerprint = fingerprint(
        {
            "domain": "taxalens.reviewer-control-question.v1",
            "prompt": "Does this picture support the presented verification label?",
            "outcomes": [
                "yes",
                "no",
                "cant_tell",
                "cant_view",
                "skipped",
            ],
        }
    )
    identity = {
        "schemaVersion": PACKET_SCHEMA_VERSION,
        "selectionSeed": SELECTION_SEED,
        "taxalensBaseSha": TAXALENS_BASE_SHA,
        "questionFingerprint": question_fingerprint,
        "inputArtifacts": [
            {
                "inputId": receipt["inputId"],
                "path": receipt["path"],
                "sha256": receipt["sha256"],
                "status": receipt["status"],
            }
            for receipt in input_receipts
        ],
        "scenarios": scenarios,
    }
    manifest_sha256 = fingerprint(identity)
    campaign_id = f"reviewer-controls-{manifest_sha256[:24]}"
    items = build_items(commons, campaign_id, question_fingerprint)
    control_truth = [
        {
            "itemId": scenario["itemId"],
            "expectedMediaState": scenario["expectedMediaState"],
            "expectedOutcome": scenario["expectedOutcome"],
        }
        for scenario in scenarios
        if scenario["scoredByReviewerControlMetrics"]
    ]
    control_set = {
        "schemaVersion": CONTROL_SET_SCHEMA_VERSION,
        "controlSetId": f"{campaign_id}-scored-truth",
        "groundTruthSha256": fingerprint(control_truth),
        "controls": control_truth,
    }
    campaign = {
        "schemaVersion": CAMPAIGN_SCHEMA_VERSION,
        "campaignId": campaign_id,
        "title": "Papilio demoleus reviewer workflow controls",
        "description": (
            "A private six-item workflow-control packet for positive, negative, "
            "ambiguity, duplicate, media-failure, and adjudication behavior."
        ),
        "kind": "quality_control",
        "status": "ready",
        "targetTaxon": MISSION_TARGET,
        "sourceProviders": [
            "wikimedia_commons",
            "taxalens_fixture",
        ],
        "reviewRequirement": {
            "requiredIndependentReviewers": 2,
            "secondReviewPolicy": "on_conflict_or_uncertain",
            "adjudicationRequiredOnConflict": True,
            "decisiveOutcomes": ["yes", "no"],
            "mediaRequiredOutcomes": ["yes", "no", "cant_tell"],
            "nonScientificOutcomes": ["cant_view", "skipped"],
        },
        "samplingPlan": {
            "planId": f"{campaign_id}-fixed-control-design",
            "purpose": "reviewer_quality_control",
            "design": "control_items",
            "representative": False,
            "blindReview": True,
            "selectionSeed": SELECTION_SEED,
            "targetSampleSize": len(items),
            "inclusionProbabilityRequired": False,
            "independentUnit": "duplicate_group",
            "groupingKeys": [
                "duplicate_group",
                "observation_group",
                "owner_group",
            ],
            "leakagePolicy": "not_applicable",
            "strata": [
                {
                    "stratumId": scenario_id,
                    "label": f"Reviewer control · {scenario_id.replace('_', ' ')}",
                    "populationCount": 1,
                    "targetSampleCount": 1,
                    "populationWeight": None,
                    "selectionNotes": (
                        "Fixed workflow-control case; not a probability sample "
                        "and not valid for scientific quality estimation."
                    ),
                }
                for scenario_id in SCENARIO_ORDER
            ],
            "qualityEstimationAllowed": False,
            "qualityEstimationBlockedReason": (
                "Workflow controls may assess reviewer handling but cannot "
                "estimate biological population quality."
            ),
        },
        "disclosurePolicy": {
            "mode": "blind",
            "revealAfterDecision": True,
            "hiddenBeforeDecision": [
                "controlScenario",
                "controlTruth",
                "expectedWorkflow",
            ],
        },
        "questionFingerprint": question_fingerprint,
        "manifestSha256": manifest_sha256,
        "taxalensSha": TAXALENS_BASE_SHA,
        "biominerSha": None,
        "publicReplay": False,
        "scientificClaimAllowed": False,
    }
    packet = {
        "schemaVersion": PACKET_SCHEMA_VERSION,
        "manifestSha256": manifest_sha256,
        "campaign": campaign,
        "items": items,
        "controlSet": control_set,
        "controlScenarios": scenarios,
        "provenance": {
            "generator": "scripts/build_reviewer_control_campaign.py",
            "taxalensBaseSha": TAXALENS_BASE_SHA,
            "biominerContextSha": BIOMINER_CONTEXT_SHA,
            "biominerContentUsed": False,
            "inputArtifacts": input_receipts,
        },
        "semantics": {
            "humanReviewEventsPrepopulated": False,
            "reviewerPerformancePrepopulated": False,
            "controlTruthScope": "reviewer_workflow_fixture_only",
            "knownTargetIsIndependentTaxonomicVerification": False,
            "bioMinerRoleSuitabilityUsedAsTaxonomicTruth": False,
            "ambiguousCaseScored": False,
            "adjudicationOutcomePrepopulated": False,
            "publicReplay": False,
            "scientificClaimAllowed": False,
        },
    }
    validate_packet(packet, repo_root)
    return packet


def validate_packet(packet: dict[str, Any], repo_root: Path) -> None:
    items = packet["items"]
    scenarios = packet["controlScenarios"]
    if [scenario["scenarioId"] for scenario in scenarios] != list(SCENARIO_ORDER):
        raise RuntimeError("Reviewer-control scenario order or coverage changed.")
    if len(items) != len(SCENARIO_ORDER):
        raise RuntimeError("Reviewer-control campaign must contain exactly six items.")
    item_by_id = {item["itemId"]: item for item in items}
    if len(item_by_id) != len(items):
        raise RuntimeError("Reviewer-control item IDs must be unique.")
    for scenario in scenarios:
        if scenario["itemId"] not in item_by_id:
            raise RuntimeError(
                f"Reviewer-control scenario item is unavailable: {scenario['scenarioId']}"
            )
        if scenario["prepopulatedEventIds"]:
            raise RuntimeError("Reviewer-control scenarios may not prepopulate events.")
    known = item_by_id["reviewer-control:known-target"]
    duplicate = item_by_id["reviewer-control:duplicate"]
    if (
        known["imageSha256"] != duplicate["imageSha256"]
        or known["duplicateGroupId"] != duplicate["duplicateGroupId"]
        or known["observationGroupId"] != duplicate["observationGroupId"]
    ):
        raise RuntimeError("Duplicate control is not byte and group identical.")
    media_failure = item_by_id["reviewer-control:media-failure"]
    if (repo_root / media_failure["previewUri"]).exists():
        raise RuntimeError("Media-failure control unexpectedly resolves to a local file.")
    if sha256_bytes(MISSING_MEDIA_DESCRIPTOR) != media_failure["imageSha256"]:
        raise RuntimeError("Media-failure descriptor identity changed.")
    controls = packet["controlSet"]["controls"]
    if packet["controlSet"]["groundTruthSha256"] != fingerprint(controls):
        raise RuntimeError("Reviewer-control truth fingerprint changed.")
    if {control["itemId"] for control in controls} != {
        "reviewer-control:known-target",
        "reviewer-control:known-negative",
        "reviewer-control:media-failure",
    }:
        raise RuntimeError("Only score-compatible procedural controls are allowed.")
    if packet["campaign"]["samplingPlan"]["qualityEstimationAllowed"]:
        raise RuntimeError("Reviewer controls may not estimate scientific quality.")
    if packet["campaign"]["scientificClaimAllowed"]:
        raise RuntimeError("Reviewer controls may not authorize a scientific claim.")
    if packet["semantics"]["humanReviewEventsPrepopulated"]:
        raise RuntimeError("Reviewer controls may not fabricate human outcomes.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("demo/source/verification/papilio-demoleus-reviewer-controls.campaign.json"),
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = args.repo_root.resolve()
    output = args.output
    if not output.is_absolute():
        output = repo_root / output
    packet = build_packet(repo_root)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(packet, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "campaignId": packet["campaign"]["campaignId"],
                "manifestSha256": packet["manifestSha256"],
                "output": str(output),
                "scenarioCount": len(packet["controlScenarios"]),
                "scoredControlCount": len(packet["controlSet"]["controls"]),
            },
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
