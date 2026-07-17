from __future__ import annotations

import json
from pathlib import Path

import pytest
from taxalens.product import (
    JUDGE_BUNDLE_GEOGRAPHIC_SECTION_NAMES,
    JUDGE_BUNDLE_V1_SCHEMA_VERSION,
    JUDGE_BUNDLE_V2_SCHEMA_VERSION,
    TRUTHFUL_DEMO_BIOMINER_SHA,
    TRUTHFUL_DEMO_BUNDLE_ID,
    TRUTHFUL_DEMO_HERO_ID,
    TRUTHFUL_DEMO_LEGACY_BIOMINER_SHA,
    build_truthful_demo_fixture,
    load_judge_bundle,
)

FIXTURE_ROOT = Path("demo/fixture/papilio_pilot")
MANIFEST_PATH = FIXTURE_ROOT / "judge_bundle.json"
VERIFICATION_MANIFEST_PATH = Path("demo/source/verification/papilio-demoleus-commons.campaign.json")
RASTER_SUFFIXES = {".gif", ".jpeg", ".jpg", ".png", ".webp"}


def _json(relative_path: str) -> object:
    return json.loads((FIXTURE_ROOT / relative_path).read_text(encoding="utf-8"))


def test_committed_fixture_is_a_valid_checksum_verified_judge_bundle() -> None:
    loaded = load_judge_bundle(MANIFEST_PATH, verify_files=True)

    assert loaded.validation.bundle_id == TRUTHFUL_DEMO_BUNDLE_ID
    assert loaded.validation.artifact_count == 30
    assert loaded.validation.section_count == 31
    assert loaded.validation.unavailable_section_count == 14
    assert loaded.validation.replay_trace_count == 1
    assert loaded.source_schema_version == JUDGE_BUNDLE_V1_SCHEMA_VERSION
    assert loaded.data["schema_version"] == JUDGE_BUNDLE_V2_SCHEMA_VERSION
    assert loaded.migration_receipt is not None
    assert loaded.migration_receipt.applied is True
    assert loaded.migration_receipt.stored_files_rewritten is False
    assert loaded.migration_receipt.added_sections == JUDGE_BUNDLE_GEOGRAPHIC_SECTION_NAMES
    assert loaded.data["source_revisions"]["biominer_sha"] == TRUTHFUL_DEMO_BIOMINER_SHA
    assert loaded.data["target"] == {
        "accepted_taxon_key": "gbif:1938069",
        "scientific_name": "Papilio demoleus",
        "rank": "species",
    }
    assert all(
        section["scientific_claim_allowed"] is False for section in loaded.data["sections"].values()
    )


def test_hero_truthfully_awaits_review_without_an_image_or_classification() -> None:
    summary = _json("data/run_summary.json")
    records = _json("data/selective_decision_metadata.json")
    assert isinstance(summary, dict)
    assert isinstance(records, list)
    assert len(records) == 1
    hero = records[0]

    assert summary["hero_record_id"] == TRUTHFUL_DEMO_HERO_ID
    assert summary["hero_state"] == "awaiting_human_review"
    assert summary["target_classification"] == {
        "status": "unavailable",
        "value": None,
        "reason": "No human-verified target image classification is committed.",
    }
    assert summary["media"]["included_image_count"] == 0
    assert summary["detection_data"]["record_count"] == 0
    assert summary["full_frame_transformations"]["record_count"] == 0
    assert summary["schema_smoke_record_included"] is False

    assert hero["evidence_record_id"] == TRUTHFUL_DEMO_HERO_ID
    assert hero["state"] == "awaiting_human_review"
    assert hero["target_classification"] is None
    assert hero["decision"] is None
    assert hero["media_id"] is None
    assert hero["image_path"] is None
    assert hero["candidate_visual_scores"] == []
    assert hero["schema_smoke_record"] is False
    assert hero["human_review_required"] is True
    assert hero["scientific_claim_allowed"] is False
    assert all(gate["satisfied"] is False for gate in hero["gates"])


def test_fixture_uses_real_candidate_metadata_without_promoting_it_to_evidence() -> None:
    snapshot = _json("source/pilot_metadata_snapshot.json")
    candidates = _json("data/candidate_sets.json")
    shortfalls = _json("data/reference_shortfalls.json")
    metrics = _json("data/stage_metrics.json")
    assert isinstance(snapshot, dict)
    assert isinstance(candidates, list)
    assert isinstance(shortfalls, list)
    assert isinstance(metrics, list)

    assert snapshot["origin_commit"] == TRUTHFUL_DEMO_LEGACY_BIOMINER_SHA
    assert snapshot["metadata_only"] is True
    assert snapshot["scientific_results_available"] is False
    assert [row["candidate"]["scientific_name"] for row in candidates] == [
        "Papilio memnon",
        "Papilio polytes",
        "Papilio helenus",
        "Papilio paris",
        "Papilio machaon",
    ]
    assert all(row["scientific_claim_allowed"] is False for row in candidates)
    assert shortfalls[0]["data"]["source_candidate_shortfall"] == 247
    assert shortfalls[0]["data"]["human_verified_shortfall"] == 490
    assert {row["metric_id"]: row["value"] for row in metrics} == {
        "flickr-query-hits": 76_485,
        "canonical-flickr-photos": 13_501,
        "eligible-source-media-candidates": 838,
        "human-verified-source-media": 0,
    }


def test_rights_manifest_registers_commons_review_media_and_covers_every_payload() -> None:
    loaded = load_judge_bundle(MANIFEST_PATH, verify_files=True)
    rights = _json("rights_manifest.json")
    assert isinstance(rights, dict)

    assert rights["media_asset_count"] == 3
    assert rights["licensed_image_count"] == 3
    assert rights["included_image_count"] == 3
    assert rights["all_media_rights_verified"] is True
    assert loaded.data["rights"]["all_artifacts_covered"] is True
    assert loaded.data["rights"]["all_media_rights_verified"] is True
    assert loaded.data["attribution"]["complete"] is True
    rasters = [path for path in FIXTURE_ROOT.rglob("*") if path.suffix.lower() in RASTER_SUFFIXES]
    assert len(rasters) == 3
    media_rights = [
        item for item in rights["items"] if item["rights_id"].startswith("commons-rights-")
    ]
    assert len(media_rights) == 3
    assert all(item["source_title"] and item["source_url"] for item in media_rights)
    assert all(item["license_name"] == "CC BY-SA 4.0" for item in media_rights)
    assert all(item["license_uri"] for item in media_rights)
    assert all(item["sha256"] and item["bytes"] > 0 for item in media_rights)
    assert all("human-verification" in item["use_scope"] for item in media_rights)
    media_types = [artifact["media_type"] for artifact in loaded.data["artifact_inventory"]]
    assert media_types.count("application/json") == 23
    assert media_types.count("application/vnd.apache.parquet") == 4
    assert media_types.count("image/jpeg") == 3
    media_section = loaded.data["sections"]["verification_media"]
    assert media_section["status"] == "available"
    assert len(media_section["artifact_ids"]) == 3
    assert media_section["scientific_claim_allowed"] is False


def test_verification_campaign_and_items_are_projected_from_one_manifest() -> None:
    source = json.loads(VERIFICATION_MANIFEST_PATH.read_text(encoding="utf-8"))
    committed_campaign = FIXTURE_ROOT / "verification/campaign_manifest.json"
    projected_items = _json("verification/items.json")
    assert isinstance(source, dict)
    assert isinstance(projected_items, list)

    assert committed_campaign.read_bytes() == VERIFICATION_MANIFEST_PATH.read_bytes()
    assert [item["itemId"] for item in projected_items] == [
        item["itemId"] for item in source["items"]
    ]
    assert all(item["scientificClaimAllowed"] is False for item in projected_items)
    assert all(
        item["mediaArtifactId"] == f"verification-media-{item['itemId']}"
        for item in projected_items
    )
    assert all(
        item["previewUri"] == f"verification/media/{item['previewAsset']}"
        for item in projected_items
    )


def test_prototype_snapshot_is_aggregate_only_and_preserves_claim_boundaries() -> None:
    snapshot = _json("source/prototype_evidence_snapshot.json")
    assert isinstance(snapshot, dict)

    assert snapshot["origin_commit"] == TRUTHFUL_DEMO_BIOMINER_SHA
    assert snapshot["status"] == "prototype_only_available_with_limitations"
    assert snapshot["prototype_integration_authorized"] is True
    assert snapshot["scientific_release_authorized"] is False
    assert snapshot["production_default_change_authorized"] is False
    assert snapshot["public_reference_image_display_authorized"] is False
    assert snapshot["scientific_claim_allowed"] is False

    contracts = snapshot["contracts"]
    assert contracts["reference_bank"]["data"]["counts"]["prototype_support"] == 81
    assert contracts["reference_bank"]["data"]["counts"]["human_verified"] == 0
    goal = contracts["provider_support_goal_verification"]["data"]
    assert goal["verified_record_count"] == 81
    assert goal["records_meeting_goal_count"] == 81
    assert goal["semantics"]["independent_human_taxonomic_verification_claimed"] is False
    assert (
        contracts["benchmark"]["data"]["model_selection_comparison"]["B0"][
            "target_scoreability_rate"
        ]
        == 0.1
    )
    assert (
        contracts["benchmark"]["data"]["model_selection_comparison"]["B13"][
            "target_scoreability_rate"
        ]
        == 1.0
    )
    assert contracts["selected_policy"]["data"]["margin_policy"]["threshold"] == 0.1
    staged = contracts["staged_inference"]["data"]
    assert staged["classified"] == 13_496
    assert staged["candidate_score_rows"] == 634_312
    assert staged["staged_preselection_abstention"]["abstained"] == 12_296
    assert (
        staged["staged_preselection_abstention"]["reason_counts"]["uncalibrated_margin_below_0_02"]
        == 1_602
    )


def test_stored_agent_replay_is_public_credential_free_and_checksum_bound() -> None:
    loaded = load_judge_bundle(MANIFEST_PATH, verify_files=True)
    request = _json("agent/stored_analyst_request.json")
    run = _json("agent/stored_analyst_run.json")
    assert isinstance(request, dict)
    assert isinstance(run, dict)

    replay = loaded.data["openai_replay"]
    assert replay["status"] == "available"
    assert replay["mode"] == "stored_structured_outputs_only"
    assert replay["credentials_required"] is False
    assert replay["live_requests_allowed"] is False
    assert len(replay["traces"]) == 1
    trace = replay["traces"][0]
    assert trace["occurred_at"] is None
    assert trace["stored_output_only"] is True
    assert trace["prompt_sha256"] == next(
        item["sha256"]
        for item in loaded.data["artifact_inventory"]
        if item["artifact_id"] == "stored-analyst-request"
    )
    assert trace["response_sha256"] == next(
        item["sha256"]
        for item in loaded.data["artifact_inventory"]
        if item["artifact_id"] == "stored-analyst-run"
    )
    assert request["storage"] == {
        "credentialsRequired": False,
        "liveRequestExecuted": False,
        "storedOutputOnly": True,
    }
    assert run["responseIds"] == ["stored-replay-turn-01", "stored-replay-turn-02"]
    assert run["toolReceipts"][0]["tool"] == "resolve_taxon"
    assert run["toolResults"][0]["artifactIds"] == ["query-definitions"]
    assert run["output"]["scientificClaimAllowed"] is False


def test_unavailable_real_pipeline_outputs_are_named_and_empty() -> None:
    loaded = load_judge_bundle(MANIFEST_PATH, verify_files=True)
    expected = {
        "yoloe_evidence",
        "full_frame_visual_input_metadata",
        "target_aware_score_metadata",
        "comments",
        "candidate_revisions",
        "evaluation_summaries",
        "verification_decisions",
        "verification_quality",
        *JUDGE_BUNDLE_GEOGRAPHIC_SECTION_NAMES,
    }
    observed = {
        name
        for name, section in loaded.data["sections"].items()
        if section["status"] == "unavailable"
    }

    assert observed == expected
    for name in observed:
        section = loaded.data["sections"][name]
        assert section["artifact_ids"] == ()
        assert section["reason"]
        assert section["verification_status"] == "unavailable"
        assert section["human_review_required"] is True
    for name in JUDGE_BUNDLE_GEOGRAPHIC_SECTION_NAMES:
        assert loaded.data["expected_ui_counts"]["section_records"][name] == 0
        assert "did not invent geographic evidence" in loaded.data["sections"][name]["reason"]


def test_builder_reproduces_every_committed_fixture_byte(tmp_path: Path) -> None:
    generated_root = tmp_path / "papilio_pilot"
    generated_manifest = build_truthful_demo_fixture(generated_root)

    assert generated_manifest == generated_root / "judge_bundle.json"
    expected_paths = sorted(
        path.relative_to(FIXTURE_ROOT) for path in FIXTURE_ROOT.rglob("*") if path.is_file()
    )
    generated_paths = sorted(
        path.relative_to(generated_root) for path in generated_root.rglob("*") if path.is_file()
    )
    assert generated_paths == expected_paths
    for relative_path in expected_paths:
        assert (generated_root / relative_path).read_bytes() == (
            FIXTURE_ROOT / relative_path
        ).read_bytes()


def test_builder_refuses_to_replace_an_existing_destination_without_opt_in(
    tmp_path: Path,
) -> None:
    destination = tmp_path / "existing"
    destination.mkdir()

    with pytest.raises(FileExistsError, match="destination already exists"):
        build_truthful_demo_fixture(destination)
