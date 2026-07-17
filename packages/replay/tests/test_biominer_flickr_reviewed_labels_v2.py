from __future__ import annotations

import hashlib
import io
import json
import os
import subprocess
import tarfile
from pathlib import Path
from typing import Any

import polars as pl
import pytest
from packages.replay.src.biominer_flickr_reviewed_labels_v2 import (
    FLICKR_REVIEWED_LABELS_V2_FILE,
    FlickrReviewedLabelsV2Error,
    build_flickr_reviewed_labels_v2,
    flickr_reviewed_labels_v2_schema,
    validate_flickr_reviewed_labels_v2,
    write_flickr_reviewed_labels_v2,
)

BIOMINER_SHA = "dcd494321abc0666ea692b5759f84bc4c7e08ba9"


def test_builds_exact_typed_reviewed_label_schema() -> None:
    frame = build_flickr_reviewed_labels_v2([_row()])

    assert dict(frame.schema) == flickr_reviewed_labels_v2_schema()
    assert frame.columns[:33] == list(flickr_reviewed_labels_v2_schema())[:33]
    assert frame.schema["reviewed_at"] == pl.String
    assert frame.schema["taxalens_inclusion_probability"] == pl.Float64
    assert frame.schema["taxalens_effective_event_ids"] == pl.List(pl.String)


def test_parquet_export_is_byte_deterministic_and_round_trip_valid(
    tmp_path: Path,
) -> None:
    rows = [
        _row(flickr_photo_id="200", detection_id="media:200"),
        _row(flickr_photo_id="100", detection_id="media:100"),
    ]
    first_path = tmp_path / "first" / FLICKR_REVIEWED_LABELS_V2_FILE
    second_path = tmp_path / "second" / FLICKR_REVIEWED_LABELS_V2_FILE

    first = write_flickr_reviewed_labels_v2(
        rows=rows,
        output_path=first_path,
    )
    second = write_flickr_reviewed_labels_v2(
        rows=list(reversed(rows)),
        output_path=second_path,
    )

    assert first.to_dicts() == second.to_dicts()
    assert first_path.read_bytes() == second_path.read_bytes()
    assert (
        hashlib.sha256(first_path.read_bytes()).hexdigest()
        == hashlib.sha256(second_path.read_bytes()).hexdigest()
    )
    round_trip = pl.read_parquet(first_path)
    validate_flickr_reviewed_labels_v2(round_trip)
    assert dict(round_trip.schema) == flickr_reviewed_labels_v2_schema()


def test_rejects_failure_discovery_weights() -> None:
    row = _row(
        taxalens_sampling_purpose="failure_discovery",
        taxalens_sampling_design="targeted_priority",
        taxalens_inclusion_probability=None,
        taxalens_sampling_weight=None,
        taxalens_quality_estimation_allowed=False,
    )
    row.update(_sampling_binding(row, inclusion_probability_required=False))
    invalid = {**row, "taxalens_sampling_weight": 2.0}

    with pytest.raises(
        FlickrReviewedLabelsV2Error,
        match="failure-discovery labels cannot carry weights",
    ):
        build_flickr_reviewed_labels_v2([invalid])


def test_rejects_duplicate_and_owner_group_leakage() -> None:
    first = _row(flickr_photo_id="100", detection_id="media:100")
    duplicate_crossing_owner = _row(
        flickr_photo_id="200",
        detection_id="media:200",
        duplicate_group_id=first["duplicate_group_id"],
        observer_owner_group_id="flickr-owner:owner-b",
    )
    with pytest.raises(
        FlickrReviewedLabelsV2Error,
        match="duplicate group crosses owner or dataset split",
    ):
        build_flickr_reviewed_labels_v2([first, duplicate_crossing_owner])

    owner_crossing_split = _row(
        flickr_photo_id="200",
        detection_id="media:200",
        duplicate_group_id="duplicate:200",
        dataset_split="model_selection",
    )
    with pytest.raises(
        FlickrReviewedLabelsV2Error,
        match="owner group crosses dataset splits",
    ):
        build_flickr_reviewed_labels_v2([first, owner_crossing_split])


def test_generated_parquet_passes_pinned_biominer_validation(
    tmp_path: Path,
) -> None:
    biominer_root = Path(__file__).resolve().parents[3].parent / "BioMiner"
    if not biominer_root.is_dir():
        pytest.skip("committed sibling BioMiner checkout is unavailable")
    archive = subprocess.run(
        ["git", "-C", str(biominer_root), "archive", "--format=tar", BIOMINER_SHA],
        check=True,
        capture_output=True,
    ).stdout
    pinned_root = tmp_path / "pinned-biominer"
    pinned_root.mkdir()
    with tarfile.open(fileobj=io.BytesIO(archive), mode="r:") as source:
        source.extractall(pinned_root, filter="data")

    output = tmp_path / FLICKR_REVIEWED_LABELS_V2_FILE
    write_flickr_reviewed_labels_v2(rows=[_row()], output_path=output)
    validation_script = """
import json
import sys
import polars as pl
from biominer.evaluation.labels import (
    REVIEWED_LABEL_SCHEMA,
    normalize_reviewed_label_frame,
    validate_reviewed_label_frame,
)
source = pl.read_parquet(sys.argv[1])
normalized = normalize_reviewed_label_frame(source)
print(json.dumps({
    "findings": validate_reviewed_label_frame(normalized),
    "core_columns": normalized.columns[:len(REVIEWED_LABEL_SCHEMA)],
    "extra_columns": normalized.columns[len(REVIEWED_LABEL_SCHEMA):],
    "ledger": normalized["taxalens_decision_ledger_sha256"].item(),
}))
"""
    interpreter = biominer_root / ".venv/bin/python"
    if not interpreter.is_file():
        pytest.skip("BioMiner validation environment is unavailable")
    environment = os.environ.copy()
    environment["PYTHONPATH"] = str(pinned_root / "src")
    completed = subprocess.run(
        [
            str(interpreter),
            "-c",
            validation_script,
            str(output),
        ],
        cwd=pinned_root,
        env=environment,
        check=True,
        capture_output=True,
        text=True,
    )
    result = json.loads(completed.stdout)

    assert result["findings"] == []
    assert result["core_columns"] == list(flickr_reviewed_labels_v2_schema())[:33]
    assert result["extra_columns"] == sorted(list(flickr_reviewed_labels_v2_schema())[33:])
    assert result["ledger"] == "d" * 64


def _row(**overrides: Any) -> dict[str, Any]:
    row: dict[str, Any] = {
        "schema_version": "reviewed-labels-v2",
        "source": "flickr",
        "flickr_photo_id": "100",
        "detection_id": "media:100",
        "crop_hash": f"sha256:{'c' * 64}",
        "label_level": "species",
        "is_butterfly": True,
        "accepted_taxon_key": "gbif:1938069",
        "scientific_name": "Papilio demoleus",
        "family_key": "gbif:9417",
        "family": "Papilionidae",
        "genus_key": "gbif:1938052",
        "genus": "Papilio",
        "label_source": "taxalens_human_verification",
        "reviewer_id": "reviewer-a",
        "reviewed_at": "2026-07-16T12:00:00.000Z",
        "review_confidence": "high",
        "review_notes": "",
        "target_present": True,
        "label_certainty": "high",
        "life_stage": "adult",
        "visual_domain": "live_field",
        "view": "dorsal",
        "route": "adult_field",
        "geo_cluster_id": "geo:sydney",
        "source_query_tier": "T1",
        "source_query_term": "Papilio demoleus",
        "duplicate_group_id": "duplicate:100",
        "observer_owner_group_id": "flickr-owner:owner-a",
        "dataset_split": "final_test",
        "second_review_status": "completed",
        "ambiguity_reason": "",
        "unsuitable_for_species_identification": False,
        "taxalens_campaign_id": "campaign:test",
        "taxalens_campaign_manifest_sha256": "a" * 64,
        "taxalens_question_sha256": "b" * 64,
        "taxalens_taxalens_sha": "a" * 40,
        "taxalens_biominer_sha": BIOMINER_SHA,
        "taxalens_sampling_plan_id": "sampling:test",
        "taxalens_sampling_purpose": "quality_estimation",
        "taxalens_sampling_design": "clustered_random",
        "taxalens_inclusion_probability": 0.5,
        "taxalens_sampling_weight": 2.0,
        "taxalens_decision_ledger_sha256": "d" * 64,
        "taxalens_effective_event_ids": ["event-1"],
        "taxalens_reviewer_group_ids": ["reviewer-a"],
        "taxalens_blind_review": True,
        "taxalens_quality_estimation_allowed": True,
        "taxalens_scientific_claim_allowed": False,
    }
    row.update(overrides)
    row.update(_sampling_binding(row, inclusion_probability_required=True))
    return row


def _sampling_binding(
    row: dict[str, Any],
    *,
    inclusion_probability_required: bool,
) -> dict[str, str]:
    plan = {
        "blindReview": row["taxalens_blind_review"],
        "design": row["taxalens_sampling_design"],
        "inclusionProbabilityRequired": inclusion_probability_required,
        "planId": row["taxalens_sampling_plan_id"],
        "purpose": row["taxalens_sampling_purpose"],
    }
    encoded = json.dumps(plan, sort_keys=True, separators=(",", ":"))
    return {
        "taxalens_sampling_plan_json": encoded,
        "taxalens_sampling_plan_sha256": hashlib.sha256(encoded.encode()).hexdigest(),
    }
