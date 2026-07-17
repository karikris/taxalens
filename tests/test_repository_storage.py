from __future__ import annotations

import json
import subprocess
from pathlib import Path, PurePosixPath

from scripts.build_repository_storage import (
    BACKBLAZE_ROOT,
    OUTPUT_ROOT,
    REPOSITORY_ROOT,
    SUPABASE_ROOT,
    SUPABASE_TABLES,
    build_outputs,
    check_outputs,
    sha256_file,
)


def read_json(path: Path) -> dict[str, object]:
    value = json.loads(path.read_text(encoding="utf-8"))
    assert isinstance(value, dict)
    return value


def test_repository_storage_build_is_current() -> None:
    assert check_outputs(build_outputs()) == []


def test_supabase_repository_snapshot_is_complete_and_truthful() -> None:
    manifest = read_json(OUTPUT_ROOT / "manifest.json")
    assert manifest["supabase"] == {
        "assignment_count": 0,
        "campaign_count": 4,
        "consensus_row_count": 0,
        "event_count": 0,
        "item_count": 82,
        "quality_snapshot_count": 0,
        "table_count": 6,
    }
    tables = {table: read_json(SUPABASE_ROOT / f"{table}.json") for table in SUPABASE_TABLES}
    assert tables["verification_campaigns"]["row_count"] == 4
    assert tables["verification_items"]["row_count"] == 82
    for table in SUPABASE_TABLES[2:]:
        assert tables[table]["row_count"] == 0
        assert tables[table]["rows"] == []

    campaigns = tables["verification_campaigns"]["rows"]
    items = tables["verification_items"]["rows"]
    assert isinstance(campaigns, list)
    assert isinstance(items, list)
    campaign_ids = {row["campaign_id"] for row in campaigns}
    assert len(campaign_ids) == 4
    assert all(row["campaign_id"] in campaign_ids for row in items)
    assert sum(row["public_replay"] is True for row in campaigns) == 1
    assert all(row["scientific_claim_allowed"] is False for row in campaigns)

    campaign_targets = {row["campaign_id"]: row["target_taxon"] for row in campaigns}
    for row in items:
        item = row["source_payload"]["item"]
        assert item["targetTaxon"] == campaign_targets[row["campaign_id"]]

    competitor = next(
        row["source_payload"]["item"]
        for row in items
        if row["sampling_stratum_id"] == "competitor_adult_gbif"
    )
    assert competitor["targetTaxon"]["acceptedTaxonKey"] == "gbif:1938069"
    assert competitor["providerSuppliedIdentity"]["providerTaxonKey"] != "1938069"


def test_b2_repository_manifest_covers_every_committed_demo_object() -> None:
    manifest = read_json(BACKBLAZE_ROOT / "object_manifest.json")
    objects = manifest["objects"]
    assert isinstance(objects, list)
    expected_paths = {
        path.relative_to(REPOSITORY_ROOT).as_posix()
        for root in (
            REPOSITORY_ROOT / "demo/fixture/papilio_pilot",
            REPOSITORY_ROOT / "demo/source",
        )
        for path in root.rglob("*")
        if path.is_file()
    }
    actual_paths = {row["repository_path"] for row in objects}
    assert actual_paths == expected_paths
    assert manifest["object_count"] == len(objects)
    assert manifest["total_bytes"] == sum(row["bytes"] for row in objects)
    assert manifest["credentials_included"] is False
    assert manifest["signed_urls_included"] is False

    object_keys = set()
    for row in objects:
        key = row["object_key"]
        assert key not in object_keys
        object_keys.add(key)
        assert not key.startswith("/")
        assert "\\" not in key
        assert all(part not in {"", ".", ".."} for part in PurePosixPath(key).parts)
        path = REPOSITORY_ROOT / row["repository_path"]
        assert path.stat().st_size == row["bytes"]
        assert sha256_file(path) == row["sha256"]

    tracked = set(
        subprocess.run(
            ["git", "ls-files"],
            cwd=REPOSITORY_ROOT,
            check=True,
            capture_output=True,
            text=True,
        ).stdout.splitlines()
    )
    assert actual_paths <= tracked


def test_external_source_collections_are_metadata_only() -> None:
    external = read_json(BACKBLAZE_ROOT / "external_source_media.json")
    items = external["items"]
    assert isinstance(items, list)
    assert external["item_count"] == 73
    assert external["credentials_included"] is False
    assert external["scientific_claim_allowed"] is False
    assert {row["source_provider"] for row in items} == {
        "flickr",
        "gbif",
        "inaturalist",
    }
    assert all(row["source_uri"].startswith("https://") for row in items)
    assert all("X-Amz-Signature" not in row["source_uri"] for row in items)
    assert all(
        row["repository_status"] == "metadata_only_source_collection_excluded" for row in items
    )
