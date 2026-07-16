from __future__ import annotations

import json
from pathlib import Path

import pytest
from taxalens.product.verification_schema import (
    VERIFICATION_SCHEMA_CONTRACTS,
    VerificationSchemaError,
    VerificationSchemaFailure,
    assert_verification_schema,
    validate_verification_schema,
    verification_schema_documents,
)

CAMPAIGN_MANIFEST = Path("demo/source/verification/papilio-demoleus-commons.campaign.json")
JUDGE_BUNDLE = Path("demo/fixture/papilio_pilot/judge_bundle.json")


def test_python_loads_the_same_six_authoritative_entry_schemas() -> None:
    documents = verification_schema_documents()
    root = documents["verification.schema.json"]

    assert isinstance(root, dict)
    assert root["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    assert len(documents) == 7
    assert VERIFICATION_SCHEMA_CONTRACTS == (
        "campaign",
        "item",
        "event",
        "consensus",
        "quality_snapshot",
        "judge_bundle_verification_sections",
    )


def test_python_accepts_campaign_items_events_consensus_and_quality_shapes() -> None:
    campaign, items = _campaign_and_items()
    event = _event(campaign, items[0])
    consensus = _consensus(campaign, items[0], event)
    quality = _quality_snapshot(campaign)

    cases = {
        "campaign": [campaign],
        "item": items,
        "event": [event],
        "consensus": [consensus],
        "quality_snapshot": [quality],
    }
    for contract, values in cases.items():
        for value in values:
            validation = validate_verification_schema(contract, value)  # type: ignore[arg-type]
            assert validation.valid, validation
            assert validation.failures == ()


def test_python_accepts_current_judge_bundle_verification_sections() -> None:
    bundle = json.loads(JUDGE_BUNDLE.read_text(encoding="utf-8"))
    sections = {
        name: bundle["sections"][name]
        for name in (
            "verification_campaigns",
            "verification_items",
            "verification_media",
            "verification_decisions",
            "verification_quality",
        )
    }

    validation = validate_verification_schema(
        "judge_bundle_verification_sections",
        sections,
    )

    assert validation.valid
    assert validation.failures == ()


def test_python_normalizes_fail_closed_errors_and_assertion() -> None:
    campaign, _ = _campaign_and_items()
    invalid = {**campaign, "campaignId": "", "unexpected": True}

    validation = validate_verification_schema("campaign", invalid)

    assert validation.valid is False
    assert validation.failures == (
        VerificationSchemaFailure("", "additionalProperties"),
        VerificationSchemaFailure("/campaignId", "minLength"),
    )
    with pytest.raises(VerificationSchemaError) as captured:
        assert_verification_schema("campaign", invalid)
    assert captured.value.validation == validation


def _campaign_and_items() -> tuple[dict[str, object], list[dict[str, object]]]:
    source = json.loads(CAMPAIGN_MANIFEST.read_text(encoding="utf-8"))
    campaign = {
        **source["campaign"],
        "manifestSha256": source["manifestSha256"],
    }
    items = []
    for source_item in source["items"]:
        item = {
            key: value
            for key, value in source_item.items()
            if key not in {"previewAsset", "verificationLabel"}
        }
        item["previewUri"] = source_item["previewAsset"]
        items.append(item)
    return campaign, items


def _event(
    campaign: dict[str, object],
    item: dict[str, object],
) -> dict[str, object]:
    return {
        "schemaVersion": "taxalens-verification-event:v1.3.0",
        "eventId": "schema-parity-event-1",
        "campaignId": campaign["campaignId"],
        "itemId": item["itemId"],
        "reviewerId": "schema-parity-reviewer",
        "reviewRound": 1,
        "outcome": "yes",
        "comment": None,
        "nonTargetCategory": None,
        "alternativeTaxon": None,
        "correctedLifeStage": None,
        "correctedVisualDomain": None,
        "correctedView": None,
        "mediaQuality": "high",
        "duplicateConcern": False,
        "captiveOrCultivatedConcern": False,
        "exclusionReason": None,
        "confidence": "high",
        "reviewedAt": "2026-07-16T21:45:00Z",
        "durationMs": 1000,
        "imageSha256": item["imageSha256"],
        "questionSha256": item["questionFingerprint"],
        "campaignManifestSha256": campaign["manifestSha256"],
        "taxalensSha": campaign["taxalensSha"],
        "biominerSha": campaign["biominerSha"],
        "supersedesEventId": None,
        "conflictsWithDecisionId": None,
    }


def _consensus(
    campaign: dict[str, object],
    item: dict[str, object],
    event: dict[str, object],
) -> dict[str, object]:
    signature = {
        "outcome": "yes",
        "nonTargetCategory": None,
        "alternativeAcceptedTaxonKey": None,
        "lifeStage": item["expectedLifeStage"],
        "visualDomain": item["expectedVisualDomain"],
        "view": item["expectedView"],
    }
    return {
        "schemaVersion": "taxalens-verification-consensus:v1.0.0",
        "campaignId": campaign["campaignId"],
        "itemId": item["itemId"],
        "requiredReviewCount": 1,
        "effectiveReviewCount": 1,
        "decisiveReviewCount": 1,
        "effectiveReviewerIds": ["schema-parity-reviewer"],
        "latestEvents": [event],
        "decisiveEvents": [event],
        "status": "complete_agreement",
        "consensusOutcome": "yes",
        "resolvedSignature": signature,
        "conflictingFields": [],
        "conflictEventIds": [],
        "secondReviewRequired": False,
        "adjudicationRequired": False,
        "supportEligibility": "not_applicable",
        "supportEligibilityBlockers": [],
        "finalTestEligibility": "not_applicable",
        "finalTestEligibilityBlockers": [],
        "resolvedAt": event["reviewedAt"],
    }


def _quality_snapshot(campaign: dict[str, object]) -> dict[str, object]:
    zero_coverage = {
        "schemaVersion": "taxalens-verification-coverage:v1.0.0",
        **{
            name: 0
            for name in (
                "eligibleItems",
                "attemptedItems",
                "unattemptedItems",
                "decisivelyReviewedItems",
                "resolvedYesItems",
                "resolvedNoItems",
                "uncertainItems",
                "mediaFailureItems",
                "deferredItems",
                "pendingItems",
                "effectiveReviewCount",
                "decisiveReviewCount",
                "yesReviewCount",
                "noReviewCount",
                "cantTellReviewCount",
                "cantViewReviewCount",
                "skippedReviewCount",
                "inspectedItems",
                "viewableItems",
            )
        },
        "reviewCoverage": None,
        "inspectionCoverage": None,
        "viewabilityRate": None,
    }
    digest = "a" * 64
    return {
        "schemaVersion": "taxalens-verification-quality-snapshot:v1.1.0",
        "capturedAt": "2026-07-16T21:45:00Z",
        "campaign": {
            "campaignId": campaign["campaignId"],
            "title": campaign["title"],
            "kind": campaign["kind"],
            "status": campaign["status"],
            "targetTaxon": campaign["targetTaxon"],
            "sourceProviders": campaign["sourceProviders"],
            "samplingPlanId": campaign["samplingPlan"]["planId"],  # type: ignore[index]
            "samplingPurpose": campaign["samplingPlan"]["purpose"],  # type: ignore[index]
            "samplingDesign": campaign["samplingPlan"]["design"],  # type: ignore[index]
        },
        "counts": {
            "eligibleItems": 0,
            "attemptedItems": 0,
            "decisivelyReviewedItems": 0,
            "decisiveQualitySampleItems": 0,
            "correctQualitySampleItems": 0,
            "errorQualitySampleItems": 0,
            "unresolvedConflictItems": 0,
            "adjudicatedItems": 0,
            "anonymousReviewerCount": 0,
        },
        "coverage": zero_coverage,
        "precision": {
            "method": "simple_random_wilson",
            "availability": "unavailable",
            "estimateBlockers": ["decisive_sample_empty"],
            "pointEstimate": None,
            "intervalMethod": "simple_random_wilson",
            "intervalAvailability": "unavailable",
            "intervalBlockers": ["decisive_sample_empty"],
            "confidenceLevel": 0.95,
            "interval": None,
            "effectiveSampleSize": None,
            "decisiveSampleCount": 0,
            "representedStrata": [],
            "strata": [
                {
                    "stratumId": "schema-parity",
                    "label": "Schema parity",
                    "decisiveSampleCount": 0,
                    "populationWeight": None,
                    "estimate": None,
                }
            ],
        },
        "agreement": {
            "pairwise": {
                "availability": "unavailable",
                "blockers": ["reviewer_overlap_insufficient"],
                "overlappingItemCount": 0,
                "anonymousReviewerCount": 0,
                "pairCount": 0,
                "percentAgreement": None,
            },
            "nominalAlpha": {
                "availability": "unavailable",
                "blockers": ["reviewer_overlap_insufficient"],
                "overlappingItemCount": 0,
                "alpha": None,
            },
        },
        "conflicts": {
            "conflictedItems": 0,
            "unresolvedConflictItems": 0,
            "adjudicatedItems": 0,
            "denominatorAttemptedItems": 0,
            "conflictRate": None,
        },
        "referenceReadiness": {
            "status": "unavailable",
            "blockers": ["reference_evidence_unavailable"],
        },
        "reviewedLabelLeakage": {
            "status": "unavailable",
            "blockers": ["reviewed_labels_unavailable"],
        },
        "referenceBank": None,
        "reviewerControl": None,
        "milestone": {
            "schemaVersion": "taxalens-verification-review-milestones:v1.0.0",
            "milestonePlanId": "schema-parity-plan",
            "decisiveSampleCount": 0,
            "status": "not_due",
            "releaseEvaluationAllowed": False,
            "currentMilestone": None,
            "nextMilestone": 20,
            "evaluatedMilestones": [],
            "missedMilestones": [],
        },
        "fingerprints": {
            name: digest
            for name in (
                "campaignManifestSha256",
                "questionSha256",
                "samplingPlanSha256",
                "decisionLedgerSha256",
                "reviewedLabelsSha256",
                "referenceReadinessSha256",
                "reviewedLabelLeakageSha256",
                "releasePolicySha256",
                "milestonePlanSha256",
            )
        },
        "release": {
            "status": "not_evaluated",
            "evaluatedAtMilestone": None,
            "blockers": ["review_milestone_not_due"],
            "missingRequiredStrata": [],
        },
        "snapshotSha256": digest,
    }
