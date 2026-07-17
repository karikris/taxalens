from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import polars as pl
import pytest
from packages.replay.src.occurrence_release import (
    OccurrenceReleaseError,
    occurrence_release_schema,
    validate_occurrence_release_decisions,
)

ROOT = Path(__file__).resolve().parents[1]
PROVIDER_MANIFEST = (
    ROOT
    / "demo/source/biominer_phase14/baseline_provider_union/baseline_provider_union_manifest.json"
)
IMPACT_MANIFEST = (
    ROOT / "demo/source/biominer_phase14/geographic_impact/geographic_impact_manifest.json"
)
QUALITY_SNAPSHOT = (
    ROOT / "demo/source/verification/papilio-demoleus-flickr-geographic-quality.snapshot.json"
)
RELEASE_DECISIONS = ROOT / "demo/source/verification/occurrence_release_decisions.json"
STORED_REPLAY = ROOT / "apps/web/src/agent/fixtures/geographicAnalystStoredReplay.json"
CAMPAIGN_ROOT = ROOT / "demo/source/verification"


def _json(path: Path) -> dict[str, object]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    assert isinstance(payload, dict)
    return payload


def test_baseline_provider_union_reconciles_without_double_counting() -> None:
    manifest = _json(PROVIDER_MANIFEST)
    composition = manifest["provider_composition"]
    reconciliation = manifest["reconciliation"]
    semantics = manifest["scientific_semantics"]
    assert isinstance(composition, dict)
    assert isinstance(reconciliation, dict)
    assert isinstance(semantics, dict)

    assert (
        composition["gbif_only"] + composition["inaturalist_origin_through_gbif"]
        == (composition["baseline_union"])
    )
    assert reconciliation["provider_partition_equals_baseline_union"] is True
    assert reconciliation["canonical_observations_equal_relationships"] is True
    direct_delta = composition["direct_inaturalist_delta"]
    assert isinstance(direct_delta, dict)
    assert direct_delta["status"] == "unavailable"
    assert direct_delta["count"] is None
    assert semantics["provider_origin_is_direct_provider_delta"] is False
    assert semantics["unknown_duplicate_matches_discarded"] is False


def test_committed_flickr_candidates_have_no_human_or_release_contribution() -> None:
    impact = _json(IMPACT_MANIFEST)
    quality = _json(QUALITY_SNAPSHOT)
    releases = _json(RELEASE_DECISIONS)

    assert impact["flickr_candidate_count"] == 13_501
    assert impact["pending_count"] == 13_501
    for field in (
        "reviewed_positive_count",
        "reviewed_negative_count",
        "uncertain_count",
        "media_failure_count",
        "skipped_count",
        "reviewed_additional_cell_count",
        "release_ready_count",
        "release_ready_additional_cell_count",
    ):
        assert impact[field] == 0
    assert quality["qualitySnapshotStatus"] == "unavailable"
    assert quality["scientificClaimAllowed"] is False
    assert quality["counts"]["retainedEventCount"] == 0
    assert releases["rows"] == []
    assert releases["scientific_claim_allowed"] is False


def test_skip_cant_view_and_targeted_campaigns_cannot_support_inference() -> None:
    audit = _json(CAMPAIGN_ROOT / "papilio-demoleus-flickr-audit.campaign.json")
    audit_campaign = audit["campaign"]
    assert isinstance(audit_campaign, dict)
    requirement = audit_campaign["reviewRequirement"]
    sampling = audit_campaign["samplingPlan"]
    assert isinstance(requirement, dict)
    assert isinstance(sampling, dict)
    assert requirement["nonScientificOutcomes"] == ["cant_view", "skipped"]
    assert sampling["representative"] is True
    assert sampling["qualityEstimationAllowed"] is True

    for filename in (
        "papilio-demoleus-reference-audit.campaign.json",
        "papilio-demoleus-reviewer-controls.campaign.json",
        "papilio-demoleus-commons.campaign.json",
    ):
        campaign_payload = _json(CAMPAIGN_ROOT / filename)
        campaign = campaign_payload["campaign"]
        assert isinstance(campaign, dict)
        targeted_sampling = campaign["samplingPlan"]
        assert isinstance(targeted_sampling, dict)
        assert targeted_sampling["representative"] is False
        assert targeted_sampling["qualityEstimationAllowed"] is False
        assert targeted_sampling["qualityEstimationBlockedReason"]


def test_positive_consensus_alone_cannot_be_release_ready() -> None:
    scope = {
        "project_id": "project:test",
        "run_id": "run:test",
        "accepted_taxon_key": "gbif:1938069",
        "baseline_snapshot_id": "baseline:test",
        "flickr_snapshot_id": "flickr:test",
    }
    row: dict[str, object] = {
        "release_decision_id": "release:test",
        "release_policy_version": "occurrence-release-policy:v1.0.0",
        **scope,
        "verification_campaign_id": "campaign:test",
        "verification_item_id": "item:test",
        "flickr_photo_id": "photo:test",
        "quality_snapshot_id": "quality:test",
        "decision_status": "release_ready",
        "decisive_positive_consensus": True,
        "coordinates_valid": True,
        "duplicate_gate_passed": True,
        "quality_gate_passed": False,
        "provenance_complete": True,
        "event_date": date(2026, 7, 1),
    }
    decisions = pl.DataFrame([row], schema=occurrence_release_schema())

    with pytest.raises(OccurrenceReleaseError, match="quality_gate_passed"):
        validate_occurrence_release_decisions(
            decisions,
            quality_snapshot_ids={"quality:test"},
            expected_scope=scope,
        )


def test_missing_baseline_is_unknown_and_candidate_language_stays_bounded() -> None:
    provider = _json(PROVIDER_MANIFEST)
    semantics = provider["scientific_semantics"]
    replay = _json(STORED_REPLAY)
    assert isinstance(semantics, dict)

    assert semantics["baseline_absence_proves_biological_absence"] is False
    answer = replay["answer"]
    assert isinstance(answer, str)
    assert "potential coverage contribution" in answer
    assert "not biological absence or new occurrences" in answer
    limitations = replay["limitations"]
    assert isinstance(limitations, list)
    assert any(
        isinstance(item, str) and item.startswith("No retained human review outcome")
        for item in limitations
    )
