#!/usr/bin/env python3
"""Build the credential-free repository mirror for Supabase and Backblaze B2."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import mimetypes
from pathlib import Path, PurePosixPath
from typing import Any

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_ROOT = REPOSITORY_ROOT / "demo/repository_storage"
SUPABASE_ROOT = OUTPUT_ROOT / "supabase"
BACKBLAZE_ROOT = OUTPUT_ROOT / "backblaze_b2"

STORAGE_MANIFEST_SCHEMA = "taxalens-repository-storage-manifest:v1.0.0"
SUPABASE_TABLE_SCHEMA = "taxalens-repository-supabase-table:v1.0.0"
B2_OBJECT_MANIFEST_SCHEMA = "taxalens-repository-b2-object-manifest:v1.0.0"
EXTERNAL_MEDIA_SCHEMA = "taxalens-repository-external-media:v1.0.0"
ITEM_PAYLOAD_SCHEMA = "taxalens-supabase-verification-item-payload:v1.0.0"

CAMPAIGN_SOURCES = (
    "demo/source/verification/papilio-demoleus-commons.campaign.json",
    "demo/source/verification/papilio-demoleus-flickr-audit.campaign.json",
    "demo/source/verification/papilio-demoleus-reference-audit.campaign.json",
    "demo/source/verification/papilio-demoleus-reviewer-controls.campaign.json",
)

SUPABASE_TABLES = (
    "verification_campaigns",
    "verification_items",
    "verification_assignments",
    "verification_events",
    "verification_consensus",
    "verification_quality_snapshots",
)

EMPTY_TABLE_REASONS = {
    "verification_assignments": "No real Supabase Auth reviewer assignments are retained.",
    "verification_events": "No retained human review or adjudication events exist.",
    "verification_consensus": (
        "Consensus remains a deterministic projection because no retained events exist."
    ),
    "verification_quality_snapshots": (
        "No artifact-backed quality snapshot can be created before valid human outcomes exist."
    ),
}

B2_SOURCE_ROOTS = (
    "demo/fixture/papilio_pilot",
    "demo/source",
)


def canonical_json_bytes(value: object) -> bytes:
    return (
        json.dumps(
            value,
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
            separators=(",", ": "),
        )
        + "\n"
    ).encode("utf-8")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_json(repository_path: str) -> dict[str, Any]:
    value = json.loads((REPOSITORY_ROOT / repository_path).read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"Repository JSON must be an object: {repository_path}")
    return value


def campaign_domain_records() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    campaigns: list[dict[str, Any]] = []
    items: list[dict[str, Any]] = []
    for source_path in CAMPAIGN_SOURCES:
        packet = read_json(source_path)
        campaign = copy.deepcopy(required_mapping(packet, "campaign", source_path))
        manifest_sha256 = packet.get("manifestSha256") or campaign.get("manifestSha256")
        require_sha256(manifest_sha256, f"{source_path} manifest SHA-256")
        campaign["manifestSha256"] = manifest_sha256
        campaigns.append(campaign)

        packet_items = packet.get("items")
        if not isinstance(packet_items, list):
            raise ValueError(f"Campaign items must be an array: {source_path}")
        for raw_item in packet_items:
            if not isinstance(raw_item, dict):
                raise ValueError(f"Campaign item must be an object: {source_path}")
            item = copy.deepcopy(raw_item)
            # Supabase stores the taxon being asked about on each queue item.
            # Reference packets also carry the depicted/provider taxon, including
            # competitor controls, so normalize the queue target to the campaign.
            # The original identity remains in providerSuppliedIdentity and in the
            # unchanged source packet covered by the B2 object manifest.
            if campaign.get("targetTaxon") is not None:
                item["targetTaxon"] = copy.deepcopy(campaign["targetTaxon"])
            preview_asset = item.pop("previewAsset", None)
            item.pop("verificationLabel", None)
            if preview_asset is not None:
                if (
                    not isinstance(preview_asset, str)
                    or PurePosixPath(preview_asset).name != preview_asset
                ):
                    raise ValueError(f"Unsafe public preview asset: {preview_asset!r}")
                item["previewUri"] = (
                    "demo/fixture/papilio_pilot/verification/media/" + preview_asset
                )
            if not isinstance(item.get("previewUri"), str):
                raise ValueError(f"Campaign item has no preview URI: {source_path}")
            items.append(item)

    campaigns.sort(key=lambda value: str(value["campaignId"]))
    items.sort(key=lambda value: (str(value["campaignId"]), str(value["itemId"])))
    return campaigns, items


def campaign_row(campaign: dict[str, Any]) -> dict[str, Any]:
    return {
        "campaign_id": campaign["campaignId"],
        "schema_version": campaign["schemaVersion"],
        "title": campaign["title"],
        "description": campaign["description"],
        "kind": campaign["kind"],
        "status": campaign["status"],
        "target_taxon": campaign["targetTaxon"],
        "source_providers": campaign["sourceProviders"],
        "review_requirement": campaign["reviewRequirement"],
        "sampling_plan": campaign["samplingPlan"],
        "disclosure_policy": campaign["disclosurePolicy"],
        "question_sha256": campaign["questionFingerprint"],
        "manifest_sha256": campaign["manifestSha256"],
        "taxalens_sha": campaign["taxalensSha"],
        "biominer_sha": campaign["biominerSha"],
        "public_replay": campaign["publicReplay"],
        "scientific_claim_allowed": campaign["scientificClaimAllowed"],
    }


def item_row(item: dict[str, Any]) -> dict[str, Any]:
    private_media = item.get("privateMedia")
    media_object_key = private_media.get("objectKey") if isinstance(private_media, dict) else None
    return {
        "campaign_id": item["campaignId"],
        "item_id": item["itemId"],
        "schema_version": ITEM_PAYLOAD_SCHEMA,
        "source_provider": item["source"],
        "source_observation_id": item["sourceObservationId"],
        "source_media_id": item["sourceMediaId"],
        "media_object_key": media_object_key,
        "image_sha256": item["imageSha256"],
        "question_sha256": item["questionFingerprint"],
        "source_payload": {
            "schemaVersion": ITEM_PAYLOAD_SCHEMA,
            "item": item,
        },
        "duplicate_group_id": item["duplicateGroupId"],
        "observation_group_id": item["observationGroupId"],
        "owner_photographer_group_id": item["ownerPhotographerGroupId"],
        "sampling_stratum_id": item["samplingStratumId"],
        "inclusion_probability": item["inclusionProbability"],
        "rights_payload": item["rights"],
    }


def table_document(table: str, rows: list[dict[str, Any]]) -> dict[str, Any]:
    document: dict[str, Any] = {
        "schema_version": SUPABASE_TABLE_SCHEMA,
        "storage_mode": "repository_mirror",
        "table": table,
        "row_count": len(rows),
        "rows": rows,
        "scientific_claim_allowed": False,
    }
    if table == "verification_campaigns":
        document["omitted_database_owned_columns"] = [
            "created_by",
            "created_at",
            "updated_at",
        ]
        document["omission_reason"] = (
            "Supabase Auth identity and server timestamps do not exist in the "
            "credential-free repository mirror."
        )
    elif table == "verification_items":
        document["omitted_database_owned_columns"] = ["created_at"]
        document["omission_reason"] = (
            "The server insertion timestamp does not exist in the credential-free mirror."
        )
    else:
        document["empty_reason"] = EMPTY_TABLE_REASONS[table]
    return document


def external_media_document(items: list[dict[str, Any]]) -> dict[str, Any]:
    external = []
    for item in items:
        source = item["source"]
        if source not in {"flickr", "gbif", "inaturalist"}:
            continue
        preview_uri = item["previewUri"]
        if not preview_uri.startswith("https://"):
            raise ValueError(f"External source media URI must use HTTPS: {preview_uri}")
        if any(marker in preview_uri for marker in ("X-Amz-Signature", "X-Amz-Credential")):
            raise ValueError("Signed source-media URLs must not enter repository storage")
        rights = required_mapping(item, "rights", str(item["itemId"]))
        external.append(
            {
                "item_id": item["itemId"],
                "campaign_id": item["campaignId"],
                "source_provider": source,
                "source_media_id": item["sourceMediaId"],
                "source_uri": preview_uri,
                "sha256": item["imageSha256"],
                "bytes": item["imageByteCount"],
                "media_type": item["mediaType"],
                "rights_policy_status": rights["policyStatus"],
                "license_name": rights["licenseName"],
                "license_uri": rights["licenseUri"],
                "attribution": rights["attribution"],
                "repository_status": "metadata_only_source_collection_excluded",
                "reason": (
                    "Repository policy excludes Flickr, GBIF, and iNaturalist "
                    "source-image collections; the checksum-bound candidate metadata remains."
                ),
                "scientific_claim_allowed": False,
            }
        )
    external.sort(key=lambda value: (value["campaign_id"], value["item_id"]))
    return {
        "schema_version": EXTERNAL_MEDIA_SCHEMA,
        "storage_mode": "metadata_only",
        "item_count": len(external),
        "declared_byte_count": sum(int(item["bytes"]) for item in external),
        "items": external,
        "credentials_included": False,
        "scientific_claim_allowed": False,
    }


def b2_object_document() -> dict[str, Any]:
    objects: list[dict[str, Any]] = []
    for source_root in B2_SOURCE_ROOTS:
        root = REPOSITORY_ROOT / source_root
        if not root.is_dir():
            raise ValueError(f"B2 repository source root is missing: {source_root}")
        for path in sorted(candidate for candidate in root.rglob("*") if candidate.is_file()):
            repository_path = path.relative_to(REPOSITORY_ROOT).as_posix()
            object_key = f"taxalens/{repository_path}"
            require_safe_object_key(object_key)
            media_type = content_type(path)
            objects.append(
                {
                    "object_key": object_key,
                    "repository_path": repository_path,
                    "bytes": path.stat().st_size,
                    "sha256": sha256_file(path),
                    "media_type": media_type,
                    "immutable": True,
                    "git_tracked_required": True,
                }
            )
    objects.sort(key=lambda value: value["object_key"])
    keys = [str(value["object_key"]) for value in objects]
    if len(keys) != len(set(keys)):
        raise ValueError("B2 repository object keys must be unique")
    return {
        "schema_version": B2_OBJECT_MANIFEST_SCHEMA,
        "storage_mode": "repository_mirror",
        "provider_contract": "backblaze_b2_s3_compatible",
        "bucket_alias": "taxalens-repository-fixture",
        "object_count": len(objects),
        "total_bytes": sum(int(value["bytes"]) for value in objects),
        "objects": objects,
        "credentials_included": False,
        "signed_urls_included": False,
        "scientific_claim_allowed": False,
    }


def build_outputs() -> dict[Path, bytes]:
    campaigns, items = campaign_domain_records()
    table_rows: dict[str, list[dict[str, Any]]] = {
        "verification_campaigns": [campaign_row(value) for value in campaigns],
        "verification_items": [item_row(value) for value in items],
        "verification_assignments": [],
        "verification_events": [],
        "verification_consensus": [],
        "verification_quality_snapshots": [],
    }
    outputs: dict[Path, bytes] = {}
    for table in SUPABASE_TABLES:
        outputs[SUPABASE_ROOT / f"{table}.json"] = canonical_json_bytes(
            table_document(table, table_rows[table])
        )

    external_path = BACKBLAZE_ROOT / "external_source_media.json"
    b2_manifest_path = BACKBLAZE_ROOT / "object_manifest.json"
    outputs[external_path] = canonical_json_bytes(external_media_document(items))
    outputs[b2_manifest_path] = canonical_json_bytes(b2_object_document())

    file_receipts = []
    for path, value in sorted(outputs.items(), key=lambda item: item[0].as_posix()):
        file_receipts.append(
            {
                "path": path.relative_to(REPOSITORY_ROOT).as_posix(),
                "bytes": len(value),
                "sha256": sha256_bytes(value),
            }
        )
    manifest = {
        "schema_version": STORAGE_MANIFEST_SCHEMA,
        "storage_mode": "credential_free_repository_mirror",
        "supabase": {
            "table_count": len(SUPABASE_TABLES),
            "campaign_count": len(campaigns),
            "item_count": len(items),
            "assignment_count": 0,
            "event_count": 0,
            "consensus_row_count": 0,
            "quality_snapshot_count": 0,
        },
        "backblaze_b2": {
            "object_manifest_path": b2_manifest_path.relative_to(REPOSITORY_ROOT).as_posix(),
            "external_source_media_path": external_path.relative_to(REPOSITORY_ROOT).as_posix(),
        },
        "files": file_receipts,
        "credentials_included": False,
        "retained_human_outcomes": 0,
        "scientific_claim_allowed": False,
    }
    outputs[OUTPUT_ROOT / "manifest.json"] = canonical_json_bytes(manifest)
    return outputs


def write_outputs(outputs: dict[Path, bytes]) -> None:
    for path, value in outputs.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(value)


def check_outputs(outputs: dict[Path, bytes]) -> list[str]:
    failures: list[str] = []
    expected_paths = set(outputs)
    for path, expected in outputs.items():
        if not path.is_file():
            relative_path = path.relative_to(REPOSITORY_ROOT)
            failures.append(f"Repository storage file is missing: {relative_path}")
            continue
        actual = path.read_bytes()
        if actual != expected:
            relative_path = path.relative_to(REPOSITORY_ROOT)
            failures.append(f"Repository storage file is stale: {relative_path}")
    generated_roots = (SUPABASE_ROOT, BACKBLAZE_ROOT)
    for root in generated_roots:
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if path.is_file() and path not in expected_paths:
                failures.append(
                    f"Unexpected repository storage file: {path.relative_to(REPOSITORY_ROOT)}"
                )
    return failures


def content_type(path: Path) -> str:
    if path.suffix == ".parquet":
        return "application/vnd.apache.parquet"
    guessed, _ = mimetypes.guess_type(path.name)
    return guessed or "application/octet-stream"


def required_mapping(value: dict[str, Any], field: str, label: str) -> dict[str, Any]:
    candidate = value.get(field)
    if not isinstance(candidate, dict):
        raise ValueError(f"{label} requires an object field: {field}")
    return candidate


def require_sha256(value: object, label: str) -> None:
    if (
        not isinstance(value, str)
        or len(value) != 64
        or any(character not in "0123456789abcdef" for character in value)
    ):
        raise ValueError(f"{label} must be a lowercase SHA-256 digest")


def require_safe_object_key(value: str) -> None:
    path = PurePosixPath(value)
    if (
        not value
        or value.startswith("/")
        or "\\" in value
        or "\x00" in value
        or any(part in {"", ".", ".."} for part in path.parts)
    ):
        raise ValueError(f"Unsafe B2 object key: {value}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Fail when committed repository-storage files differ from the deterministic build.",
    )
    args = parser.parse_args()
    outputs = build_outputs()
    if args.check:
        failures = check_outputs(outputs)
        if failures:
            raise SystemExit("\n".join(failures))
        manifest = json.loads(outputs[OUTPUT_ROOT / "manifest.json"])
        print(
            "Repository storage mirror verified: "
            f"tables={manifest['supabase']['table_count']}, "
            f"campaigns={manifest['supabase']['campaign_count']}, "
            f"items={manifest['supabase']['item_count']}."
        )
        return
    write_outputs(outputs)
    print(f"Repository storage mirror written: {OUTPUT_ROOT.relative_to(REPOSITORY_ROOT)}")


if __name__ == "__main__":
    main()
