from __future__ import annotations

import hashlib
import json
import shutil
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest
from taxalens.product import (
    TRUTHFUL_DEMO_BUNDLE_ID,
    TruthfulDemoFailure,
    TruthfulDemoVerificationError,
    compute_inventory_sha256,
    compute_payload_root_sha256,
    verify_truthful_demo,
)

SOURCE_ROOT = Path("demo/fixture/papilio_pilot")


def _copy_fixture(tmp_path: Path) -> Path:
    root = tmp_path / "papilio_pilot"
    shutil.copytree(SOURCE_ROOT, root)
    return root


def _read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _write_json(path: Path, payload: object) -> None:
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _save_manifest(root: Path, manifest: dict[str, Any]) -> None:
    inventory = manifest["artifact_inventory"]
    manifest["checksums"]["inventory_sha256"] = compute_inventory_sha256(inventory)
    manifest["checksums"]["payload_root_sha256"] = compute_payload_root_sha256(inventory)
    _write_json(root / "judge_bundle.json", manifest)


def _mutate_artifact(
    root: Path,
    artifact_id: str,
    mutation: Callable[[Any], None],
    *,
    update_record_count: bool = False,
) -> None:
    manifest = _read_json(root / "judge_bundle.json")
    artifact = next(
        row for row in manifest["artifact_inventory"] if row["artifact_id"] == artifact_id
    )
    path = root / artifact["path"]
    payload = _read_json(path)
    mutation(payload)
    _write_json(path, payload)
    content = path.read_bytes()
    if update_record_count:
        artifact["record_count"] = len(payload) if isinstance(payload, list) else 1
    artifact["bytes"] = len(content)
    artifact["sha256"] = hashlib.sha256(content).hexdigest()
    _save_manifest(root, manifest)


def _mutate_manifest(root: Path, mutation: Callable[[dict[str, Any]], None]) -> None:
    manifest = _read_json(root / "judge_bundle.json")
    mutation(manifest)
    _save_manifest(root, manifest)


def _apply_failure_mutation(root: Path, case: str) -> None:
    if case == "missing_file":
        (root / "data/candidate_sets.json").unlink()
    elif case == "checksum_mismatch":
        with (root / "data/candidate_sets.json").open("ab") as stream:
            stream.write(b"\n")
    elif case == "orphaned_id":
        _mutate_artifact(
            root,
            "run-summary",
            lambda payload: payload.update({"hero_record_id": "missing-hero"}),
        )
    elif case == "inconsistent_count":
        _mutate_manifest(
            root,
            lambda manifest: manifest["expected_ui_counts"]["section_records"].update(
                {"candidate_sets": 999}
            ),
        )
    elif case == "missing_rights":

        def remove_rights(manifest: dict[str, Any]) -> None:
            for item in manifest["rights"]["items"]:
                if "candidate-sets" in item["artifact_ids"]:
                    item["artifact_ids"].remove("candidate-sets")

        _mutate_manifest(root, remove_rights)
    elif case == "missing_attribution":

        def remove_attribution(manifest: dict[str, Any]) -> None:
            for item in manifest["attribution"]["entries"]:
                if "candidate-sets" in item["artifact_ids"]:
                    item["artifact_ids"].remove("candidate-sets")

        _mutate_manifest(root, remove_attribution)
    elif case == "verification_media_missing_rights":

        def remove_media_rights(payload: dict[str, Any]) -> None:
            item = next(
                row for row in payload["items"] if row["rights_id"].startswith("commons-rights-")
            )
            item["artifact_ids"] = []

        _mutate_artifact(root, "rights-manifest", remove_media_rights)
    elif case == "verification_media_missing_attribution":

        def remove_media_attribution(payload: dict[str, Any]) -> None:
            item = next(
                row
                for row in payload["entries"]
                if row["attribution_id"].startswith("commons-attribution-")
            )
            item["artifact_ids"] = []

        _mutate_artifact(root, "attribution-manifest", remove_media_attribution)
    elif case == "verification_media_hash_mismatch":
        _mutate_artifact(
            root,
            "verification-items",
            lambda payload: payload[0].update({"imageSha256": "0" * 64}),
        )
    elif case == "verification_media_byte_mismatch":
        _mutate_artifact(
            root,
            "verification-items",
            lambda payload: payload[0].update({"imageByteCount": payload[0]["imageByteCount"] + 1}),
        )
    elif case == "verification_media_incompatible_use_scope":

        def replace_media_use_scope(payload: dict[str, Any]) -> None:
            item = next(
                row for row in payload["items"] if row["rights_id"].startswith("commons-rights-")
            )
            item["use_scope"] = "scientific evidence and unrestricted model training"

        _mutate_artifact(root, "rights-manifest", replace_media_use_scope)
    elif case == "verification_media_without_item":
        _mutate_artifact(
            root,
            "verification-items",
            lambda payload: payload.pop(),
            update_record_count=True,
        )
        _mutate_manifest(
            root,
            lambda manifest: manifest["expected_ui_counts"]["section_records"].update(
                {"verification_items": 2}
            ),
        )
    elif case == "verification_item_without_campaign":
        _mutate_artifact(
            root,
            "verification-items",
            lambda payload: payload[0].update({"campaignId": "missing-campaign"}),
        )
    elif case == "verification_item_schema_extra_field":
        _mutate_artifact(
            root,
            "verification-items",
            lambda payload: payload[0].update({"undeclaredEvidence": True}),
        )
    elif case == "candidate_as_occurrence":
        _mutate_artifact(
            root,
            "candidate-sets",
            lambda payload: payload[0].update({"display_role": "occurrence"}),
        )
    elif case == "unverified_reference_as_support":
        _mutate_artifact(
            root,
            "candidate-sets",
            lambda payload: payload[0].update({"reference_support": True}),
        )
    elif case == "raw_score_as_probability":
        _mutate_artifact(
            root,
            "selective-decision-metadata",
            lambda payload: payload[0].update({"raw_similarity": 0.82, "probability": 0.82}),
        )
    elif case == "missing_biominer_sha":
        _mutate_manifest(
            root,
            lambda manifest: manifest["source_revisions"].update({"biominer_sha": None}),
        )
    elif case == "unsupported_gold_result":
        _mutate_artifact(
            root,
            "selective-decision-metadata",
            lambda payload: payload[0].update({"gold_result": "target_confirmed"}),
        )
    elif case == "release_gate_no_go":
        _mutate_artifact(
            root,
            "prototype-evidence-snapshot",
            lambda payload: payload["contracts"]["phase15_release"]["data"]["gate_summary"].update(
                {"passed": 13, "failed": 1}
            ),
        )
    elif case == "unresolved_placeholder":
        _mutate_artifact(
            root,
            "run-summary",
            lambda payload: payload["notes"].append("TODO replace with a successful result"),
        )
    elif case == "stale_artifact_version":

        def stale_version(manifest: dict[str, Any]) -> None:
            artifact = next(
                row
                for row in manifest["artifact_inventory"]
                if row["artifact_id"] == "candidate-sets"
            )
            artifact["schema_version"] = "truthful-demo-candidate-set:v0.9.0"

        _mutate_manifest(root, stale_version)
    elif case == "undeclared_file":
        _write_json(root / "unexpected.json", {"not": "inventoried"})
    else:
        raise AssertionError(f"unknown mutation case: {case}")


def test_verifies_the_committed_truthful_fixture() -> None:
    result = verify_truthful_demo(SOURCE_ROOT / "judge_bundle.json")

    assert result.bundle_id == TRUTHFUL_DEMO_BUNDLE_ID
    assert result.artifact_count == 39
    assert result.section_count == 31
    assert result.unavailable_section_count == 6
    assert result.total_section_record_count == 135_625
    assert result.media_asset_count == 3
    assert result.hero_state == "awaiting_human_review"


@pytest.mark.parametrize(
    ("case", "failure"),
    [
        ("missing_file", TruthfulDemoFailure.MISSING_FILE),
        ("checksum_mismatch", TruthfulDemoFailure.CHECKSUM_MISMATCH),
        ("orphaned_id", TruthfulDemoFailure.ORPHANED_ID),
        ("inconsistent_count", TruthfulDemoFailure.INCONSISTENT_COUNT),
        ("missing_rights", TruthfulDemoFailure.MISSING_RIGHTS),
        ("missing_attribution", TruthfulDemoFailure.MISSING_ATTRIBUTION),
        (
            "verification_media_missing_rights",
            TruthfulDemoFailure.MISSING_RIGHTS,
        ),
        (
            "verification_media_missing_attribution",
            TruthfulDemoFailure.MISSING_ATTRIBUTION,
        ),
        (
            "verification_media_hash_mismatch",
            TruthfulDemoFailure.CHECKSUM_MISMATCH,
        ),
        (
            "verification_media_byte_mismatch",
            TruthfulDemoFailure.CHECKSUM_MISMATCH,
        ),
        (
            "verification_media_incompatible_use_scope",
            TruthfulDemoFailure.MISSING_RIGHTS,
        ),
        (
            "verification_media_without_item",
            TruthfulDemoFailure.ORPHANED_ID,
        ),
        (
            "verification_item_without_campaign",
            TruthfulDemoFailure.ORPHANED_ID,
        ),
        (
            "verification_item_schema_extra_field",
            TruthfulDemoFailure.CONTRACT_VIOLATION,
        ),
        ("candidate_as_occurrence", TruthfulDemoFailure.CANDIDATE_AS_OCCURRENCE),
        (
            "unverified_reference_as_support",
            TruthfulDemoFailure.UNVERIFIED_REFERENCE_AS_SUPPORT,
        ),
        ("raw_score_as_probability", TruthfulDemoFailure.RAW_SCORE_AS_PROBABILITY),
        ("missing_biominer_sha", TruthfulDemoFailure.MISSING_BIOMINER_SHA),
        ("unsupported_gold_result", TruthfulDemoFailure.UNSUPPORTED_GOLD_RESULT),
        ("release_gate_no_go", TruthfulDemoFailure.UNSUPPORTED_GOLD_RESULT),
        ("unresolved_placeholder", TruthfulDemoFailure.UNRESOLVED_PLACEHOLDER),
        ("stale_artifact_version", TruthfulDemoFailure.STALE_ARTIFACT_VERSION),
        ("undeclared_file", TruthfulDemoFailure.UNDECLARED_FILE),
    ],
)
def test_each_truthfulness_mutation_has_a_stable_failure_code(
    tmp_path: Path,
    case: str,
    failure: TruthfulDemoFailure,
) -> None:
    root = _copy_fixture(tmp_path)
    _apply_failure_mutation(root, case)

    with pytest.raises(TruthfulDemoVerificationError) as captured:
        verify_truthful_demo(root / "judge_bundle.json")

    assert captured.value.code is failure
    assert f"[{failure.value}]" in str(captured.value)
