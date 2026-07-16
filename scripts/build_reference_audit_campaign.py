#!/usr/bin/env python3
"""Build the bounded GBIF/iNaturalist reference verification audit.

The command reads the exact BioMiner reference-candidate artifacts named and
hashed by the committed Phase 15 acquisition manifest. It then creates a
targeted 24-item review pilot covering target adults, competitors, target
immature stages, specimen/unsuitable media, and one high-fallback competitor
as a likely-conflict review priority. Displayed bytes are downloaded, decoded,
and hashed.

No human decision is inferred from BioMiner's provider-role suitability
attestation. This explicit generation command is not part of an ordinary build.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import mimetypes
import re
import sys
import urllib.request
from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import polars as pl
from PIL import Image

SCHEMA_VERSION = "taxalens-reference-audit-campaign-packet:v1.0.0"
CAMPAIGN_SCHEMA_VERSION = "taxalens-verification-campaign:v1.0.0"
SELECTION_SCHEMA_VERSION = "taxalens-reference-audit-selection:v1.0.0"
SELECTION_SEED = "taxalens-papilio-demoleus-reference-audit-v1"
TAXALENS_BASE_SHA = "f50a501617025f8fed2878be4ed632ab9b7584bc"
BIOMINER_SHA = "94fa1f634ee3c63917c05d78181dd3cf9ceff940"

TARGET_KEY = "gbif:1938069"
MISSION_TARGET = {
    "acceptedTaxonKey": TARGET_KEY,
    "scientificName": "Papilio demoleus",
    "commonName": "lime swallowtail",
    "rank": "species",
    "authority": "Linnaeus, 1758",
}

INPUTS = {
    "reference_observations": {
        "path": (
            "runs/papilio_demoleus_pilot_reference_candidates_20260715/"
            "reference_observations.parquet"
        ),
        "sha256": "193d9d7451eebf75eaaf772fa761ad53cfeca9f04d84dae8c2caffe9fa64882f",
        "byteCount": 10_797_270,
    },
    "reference_media_candidates": {
        "path": (
            "runs/papilio_demoleus_pilot_reference_candidates_20260715/"
            "reference_media_candidates.parquet"
        ),
        "sha256": "d9a4cd37eb8558f822807f753b2d027d37f33bcd9c32274b21516468d1827135",
        "byteCount": 13_083_129,
    },
}

COMMITTED_CONTEXT = {
    "acquisitionManifest": {
        "path": (
            "demo/source/biominer_phase15/artifacts/manifests/"
            "pilot_prototype_acquisition_manifest.json"
        ),
        "sha256": "25657c73fe0c3b41340b416510daf623d664c3362f271070fe9843de45829f1e",
    },
    "providerRoleSuitabilityAttestation": {
        "path": (
            "demo/source/biominer_phase15/artifacts/manifests/"
            "pilot_provider_support_goal_verification.json"
        ),
        "sha256": "fc96f8ecce5353629d601235aa43221df3e844ebdfa85e1efa49fe10dd52059c",
    },
}

STRATUM_TARGETS = {
    "likely_conflict_fallback_competitor": 1,
    "target_larva": 1,
    "target_pupa": 1,
    "target_egg": 1,
    "specimen_or_pinned": 1,
    "unsuitable_basis": 1,
    "target_adult_gbif": 5,
    "target_adult_inaturalist": 5,
    "competitor_adult_gbif": 4,
    "competitor_adult_inaturalist": 4,
}


@dataclass(frozen=True)
class LiveReferenceMedia:
    reference_media_id: str
    preview_uri: str
    media_type: str
    sha256: str
    byte_count: int
    decoded_width: int
    decoded_height: int


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_path(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def canonical_json(value: Any) -> str:
    return json.dumps(
        value,
        allow_nan=False,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )


def fingerprint(value: Any) -> str:
    return sha256_bytes(canonical_json(value).encode("utf-8"))


def seeded_rank(*parts: object) -> str:
    payload = "\0".join([SELECTION_SEED, *(str(part) for part in parts)])
    return sha256_bytes(payload.encode("utf-8"))


def validate_inputs(
    repo_root: Path, biominer_root: Path
) -> tuple[dict[str, Path], list[dict[str, Any]]]:
    paths: dict[str, Path] = {}
    receipts: list[dict[str, Any]] = []
    for artifact_id, declared in INPUTS.items():
        path = biominer_root / declared["path"]
        validate_file(path, str(declared["sha256"]), int(declared["byteCount"]))
        paths[artifact_id] = path
        receipts.append(
            {
                "artifactId": artifact_id,
                "declaredPath": str(declared["path"]),
                "sha256": str(declared["sha256"]),
                "byteCount": int(declared["byteCount"]),
                "gitTracked": False,
                "identityCommittedBy": (COMMITTED_CONTEXT["acquisitionManifest"]["path"]),
                "role": "phase15_manifest_pinned_candidate_frame",
            }
        )
    for artifact_id, declared in COMMITTED_CONTEXT.items():
        path = repo_root / declared["path"]
        validate_file(path, str(declared["sha256"]), None)
        receipts.append(
            {
                "artifactId": artifact_id,
                "declaredPath": str(declared["path"]),
                "sha256": str(declared["sha256"]),
                "byteCount": path.stat().st_size,
                "gitTracked": True,
                "identityCommittedBy": None,
                "role": (
                    "selection_contract"
                    if artifact_id == "acquisitionManifest"
                    else "context_only_role_suitability_attestation"
                ),
            }
        )
    return paths, receipts


def validate_file(path: Path, expected_sha: str, expected_bytes: int | None) -> None:
    if not path.is_file():
        raise RuntimeError(f"Required reference audit input is unavailable: {path}")
    if expected_bytes is not None and path.stat().st_size != expected_bytes:
        raise RuntimeError(f"Input byte count changed: {path}")
    actual_sha = sha256_path(path)
    if actual_sha != expected_sha:
        raise RuntimeError(
            f"Input digest mismatch for {path}: expected {expected_sha}, got {actual_sha}"
        )


def load_candidate_frame(paths: dict[str, Path]) -> list[dict[str, Any]]:
    observations = pl.scan_parquet(paths["reference_observations"])
    media = pl.scan_parquet(paths["reference_media_candidates"])
    joined = (
        observations.join(
            media,
            on=["reference_observation_id", "source"],
            how="inner",
        )
        .filter(
            pl.col("media_identifier").str.starts_with("https://")
            & pl.col("licence_uri").is_not_null()
            & ~pl.col("licence_uri").str.contains("-nd")
        )
        .collect()
    )
    rows = joined.to_dicts()
    if not rows:
        raise RuntimeError("Reference audit candidate frame is empty.")
    for row in rows:
        row["provider"] = provider(row)
        row["rights_policy_status"] = rights_policy_status(row)
    return canonical_media_per_observation(rows)


def canonical_media_per_observation(
    rows: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        grouped.setdefault(str(row["reference_observation_id"]), []).append(row)
    selected: list[dict[str, Any]] = []
    for observation_id, candidates in sorted(grouped.items()):
        selected.append(
            min(
                candidates,
                key=lambda row: (
                    seeded_rank(
                        "observation-media",
                        observation_id,
                        row["reference_media_id"],
                    ),
                    str(row["reference_media_id"]),
                ),
            )
        )
    return selected


def provider(row: dict[str, Any]) -> str:
    return (
        "inaturalist" if str(row["original_provider"]).strip().lower() == "inaturalist" else "gbif"
    )


def rights_policy_status(row: dict[str, Any]) -> str:
    uri = str(row["licence_uri"]).lower()
    if any(token in uri for token in ("/by-nc/", "/by-nc-sa/")):
        return "restricted"
    if any(token in uri for token in ("/by/", "/by-sa/", "/zero/")):
        return "allowed"
    raise RuntimeError(f"Unsupported reference media licence: {row['licence_uri']}")


def role_predicates() -> list[tuple[str, Callable[[dict[str, Any]], bool]]]:
    def is_target(row: dict[str, Any]) -> bool:
        return row["accepted_taxon_key"] == TARGET_KEY

    def is_adult(row: dict[str, Any]) -> bool:
        return row["life_stage"] == "adult"

    def is_live_suitable(row: dict[str, Any]) -> bool:
        return bool(row["basis_of_record_suitable"]) and not bool(row["preserved_specimen"])

    return [
        (
            "likely_conflict_fallback_competitor",
            lambda row: (
                not is_target(row)
                and is_adult(row)
                and is_live_suitable(row)
                and int(row["fallback_level"]) >= 2
            ),
        ),
        (
            "target_larva",
            lambda row: is_target(row) and row["life_stage"] == "larva" and is_live_suitable(row),
        ),
        (
            "target_pupa",
            lambda row: is_target(row) and row["life_stage"] == "pupa" and is_live_suitable(row),
        ),
        (
            "target_egg",
            lambda row: is_target(row) and row["life_stage"] == "egg" and is_live_suitable(row),
        ),
        (
            "specimen_or_pinned",
            lambda row: bool(row["preserved_specimen"]),
        ),
        (
            "unsuitable_basis",
            lambda row: not bool(row["basis_of_record_suitable"]),
        ),
        (
            "target_adult_gbif",
            lambda row: (
                is_target(row)
                and is_adult(row)
                and is_live_suitable(row)
                and row["provider"] == "gbif"
            ),
        ),
        (
            "target_adult_inaturalist",
            lambda row: (
                is_target(row)
                and is_adult(row)
                and is_live_suitable(row)
                and row["provider"] == "inaturalist"
            ),
        ),
        (
            "competitor_adult_gbif",
            lambda row: (
                not is_target(row)
                and is_adult(row)
                and is_live_suitable(row)
                and row["provider"] == "gbif"
            ),
        ),
        (
            "competitor_adult_inaturalist",
            lambda row: (
                not is_target(row)
                and is_adult(row)
                and is_live_suitable(row)
                and row["provider"] == "inaturalist"
            ),
        ),
    ]


def select_candidates(
    population: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    selected: list[dict[str, Any]] = []
    selected_observations: set[str] = set()
    receipts: list[dict[str, Any]] = []
    for stratum_id, predicate in role_predicates():
        candidates = [row for row in population if predicate(row)]
        target = STRATUM_TARGETS[stratum_id]
        ranked = sorted(
            candidates,
            key=lambda row: (
                seeded_rank(
                    "stratum",
                    stratum_id,
                    row["reference_observation_id"],
                    row["reference_media_id"],
                ),
                str(row["reference_observation_id"]),
            ),
        )
        chosen: list[dict[str, Any]] = []
        for row in ranked:
            observation_id = str(row["reference_observation_id"])
            if observation_id in selected_observations:
                continue
            row["sampling_stratum_id"] = stratum_id
            selected_observations.add(observation_id)
            chosen.append(row)
            if len(chosen) == target:
                break
        if len(chosen) != target:
            raise RuntimeError(
                f"Reference stratum {stratum_id} selected {len(chosen)} of {target}."
            )
        selected.extend(chosen)
        receipts.append(
            {
                "stratumId": stratum_id,
                "eligibleObservationCount": len(
                    {str(row["reference_observation_id"]) for row in candidates}
                ),
                "selectedObservationCount": len(chosen),
                "selectionMethod": "seeded_targeted_priority",
                "inclusionProbability": None,
                "representative": False,
            }
        )
    if len(selected) != 24:
        raise RuntimeError(f"Reference audit must select 24 items, got {len(selected)}.")
    return selected, receipts


def fetch_media(row: dict[str, Any]) -> LiveReferenceMedia:
    uri = str(row["media_identifier"])
    request = urllib.request.Request(
        uri,
        headers={"User-Agent": "TaxaLens-reference-audit-builder/1.0"},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        content = response.read(15 * 1024 * 1024 + 1)
        content_type = response.headers.get_content_type()
        final_uri = response.geturl()
    if not content or len(content) > 15 * 1024 * 1024:
        raise RuntimeError(
            f"Reference media is empty or exceeds 15 MiB: {row['reference_media_id']}"
        )
    with Image.open(io.BytesIO(content)) as image:
        image.verify()
    with Image.open(io.BytesIO(content)) as image:
        width, height = image.size
        image_format = str(image.format or "").lower()
    if not content_type.startswith("image/"):
        content_type = mimetypes.types_map.get(f".{image_format}", "")
    if not content_type.startswith("image/"):
        raise RuntimeError(
            f"Reference media did not decode as an image: {row['reference_media_id']}"
        )
    return LiveReferenceMedia(
        reference_media_id=str(row["reference_media_id"]),
        preview_uri=str(final_uri),
        media_type=content_type,
        sha256=sha256_bytes(content),
        byte_count=len(content),
        decoded_width=width,
        decoded_height=height,
    )


def normalize_license(row: dict[str, Any]) -> tuple[str, str]:
    uri = str(row["licence_uri"]).replace("http://", "https://", 1)
    lower = uri.lower()
    match = re.search(r"/([0-9]+(?:\.[0-9]+)?)/?$", lower)
    if match is None:
        raise RuntimeError(f"Reference media licence version is unsupported: {uri}")
    version = match.group(1)
    if "/publicdomain/zero/" in lower:
        return f"CC0 {version}", uri
    if "/by-nc-sa/" in lower:
        return f"CC BY-NC-SA {version}", uri
    if "/by-nc/" in lower:
        return f"CC BY-NC {version}", uri
    if "/by-sa/" in lower:
        return f"CC BY-SA {version}", uri
    if "/by/" in lower:
        return f"CC BY {version}", uri
    raise RuntimeError(f"Reference media licence is unsupported: {uri}")


def iso_or_none(value: object) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        normalized = value if value.tzinfo else value.replace(tzinfo=UTC)
        return normalized.astimezone(UTC).isoformat().replace("+00:00", "Z")
    return str(value)


def taxon_identity(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "acceptedTaxonKey": str(row["accepted_taxon_key"]),
        "scientificName": str(row["reconciled_scientific_name"]),
        "commonName": None,
        "rank": "species",
        "authority": None,
    }


def visual_domain(row: dict[str, Any]) -> str:
    if row["sampling_stratum_id"] == "unsuitable_basis":
        return "unsuitable"
    if bool(row["preserved_specimen"]):
        return "pinned_specimen"
    if not bool(row["basis_of_record_suitable"]):
        return "unsuitable"
    return "live_field"


def build_packet(
    repo_root: Path,
    biominer_root: Path,
) -> dict[str, Any]:
    paths, input_receipts = validate_inputs(repo_root, biominer_root)
    population = load_candidate_frame(paths)
    selected, selection_strata = select_candidates(population)
    generated_at = datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    selected_with_media = [(row, fetch_media(row)) for row in selected]
    media_hashes = [media.sha256 for _, media in selected_with_media]
    if len(set(media_hashes)) != len(media_hashes):
        raise RuntimeError("Reference audit selected duplicate current media bytes.")

    question_fingerprint = fingerprint(
        {
            "domain": "taxalens.reference-identity-and-route-question.v1",
            "prompt": (
                "Does this image support its provider-supplied taxon identity, "
                "life stage, and visual-domain role?"
            ),
            "providerContextVisible": True,
        }
    )
    selection_identity = {
        "schemaVersion": SELECTION_SCHEMA_VERSION,
        "selectionSeed": SELECTION_SEED,
        "biominerSha": BIOMINER_SHA,
        "inputArtifacts": [
            {
                "artifactId": receipt["artifactId"],
                "sha256": receipt["sha256"],
            }
            for receipt in input_receipts
        ],
        "selected": [
            {
                "referenceObservationId": row["reference_observation_id"],
                "referenceMediaId": row["reference_media_id"],
                "samplingStratumId": row["sampling_stratum_id"],
                "currentMediaSha256": media.sha256,
            }
            for row, media in selected_with_media
        ],
    }
    manifest_sha256 = fingerprint(selection_identity)
    campaign_id = f"reference-audit-{manifest_sha256[:24]}"
    campaign = {
        "schemaVersion": CAMPAIGN_SCHEMA_VERSION,
        "campaignId": campaign_id,
        "title": "Papilio demoleus reference identity audit",
        "description": (
            "A targeted 24-image GBIF and iNaturalist pilot for independent "
            "taxonomic identity and reference-role review."
        ),
        "kind": "reference_identity_verification",
        "status": "ready",
        "targetTaxon": MISSION_TARGET,
        "sourceProviders": ["gbif", "inaturalist"],
        "reviewRequirement": {
            "requiredIndependentReviewers": 2,
            "secondReviewPolicy": "always",
            "adjudicationRequiredOnConflict": True,
            "decisiveOutcomes": ["yes", "no"],
            "mediaRequiredOutcomes": ["yes", "no", "cant_tell"],
            "nonScientificOutcomes": ["cant_view", "skipped"],
        },
        "samplingPlan": {
            "planId": f"{campaign_id}-targeted-reference-pilot",
            "purpose": "reference_readiness",
            "design": "targeted_priority",
            "representative": False,
            "blindReview": False,
            "selectionSeed": SELECTION_SEED,
            "targetSampleSize": len(selected_with_media),
            "inclusionProbabilityRequired": False,
            "independentUnit": "observation_group",
            "groupingKeys": [
                "duplicate_group",
                "observation_group",
                "owner_group",
                "geographic_cluster",
            ],
            "leakagePolicy": "support_only",
            "strata": [
                {
                    "stratumId": receipt["stratumId"],
                    "label": ("Reference audit · " + receipt["stratumId"].replace("_", " ")),
                    "populationCount": receipt["eligibleObservationCount"],
                    "targetSampleCount": receipt["selectedObservationCount"],
                    "populationWeight": None,
                    "selectionNotes": (
                        "Seeded targeted-priority pilot; intentionally "
                        "non-representative and not valid for population accuracy."
                    ),
                }
                for receipt in selection_strata
            ],
            "qualityEstimationAllowed": False,
            "qualityEstimationBlockedReason": (
                "Targeted reference-readiness pilots cannot estimate population accuracy."
            ),
        },
        "disclosurePolicy": {
            "mode": "unblinded",
            "revealAfterDecision": False,
            "hiddenBeforeDecision": [],
        },
        "questionFingerprint": question_fingerprint,
        "manifestSha256": manifest_sha256,
        "taxalensSha": TAXALENS_BASE_SHA,
        "biominerSha": BIOMINER_SHA,
        "publicReplay": False,
        "scientificClaimAllowed": False,
    }

    items: list[dict[str, Any]] = []
    media_receipts: list[dict[str, Any]] = []
    for row, media in selected_with_media:
        item_provider = str(row["provider"])
        provider_label = "iNaturalist" if item_provider == "inaturalist" else "GBIF"
        license_name, license_uri = normalize_license(row)
        creator = str(row["creator"] or row["rights_holder"] or row["observer_id"])
        attribution = str(row["attribution"] or f"{creator} / {license_name} / {provider_label}")
        rights = {
            "creator": creator or None,
            "rightsHolder": str(row["rights_holder"] or creator) or None,
            "licenseName": license_name,
            "licenseUri": license_uri,
            "policyStatus": str(row["rights_policy_status"]),
            "attribution": attribution,
            "sourceUri": str(row["source_record_url"]),
        }
        target = taxon_identity(row)
        item_id = "reference-review-item:" + fingerprint(
            [
                campaign_id,
                row["reference_observation_id"],
                row["reference_media_id"],
                media.sha256,
            ]
        )
        provider_status_parts = [
            str(row["taxon_reconciliation_status"]),
            str(row["identification_quality"] or "quality_unavailable"),
        ]
        item = {
            "itemId": item_id,
            "campaignId": campaign_id,
            "source": item_provider,
            "sourceObservationId": str(row["source_observation_id"]),
            "sourceMediaId": str(row["provider_media_id"]),
            "imageSha256": media.sha256,
            "imageByteCount": media.byte_count,
            "mediaType": media.media_type,
            "previewUri": media.preview_uri,
            "targetTaxon": target,
            "providerSuppliedIdentity": {
                "providerTaxonKey": str(row["source_taxon_id"]),
                "scientificName": str(row["supplied_scientific_name"]),
                "commonName": None,
                "rawLabel": str(row["supplied_scientific_name"]),
                "verificationStatus": ":".join(provider_status_parts),
            },
            "expectedLifeStage": str(row["life_stage"]),
            "expectedVisualDomain": visual_domain(row),
            "expectedView": "unknown",
            "duplicateGroupId": f"sha256:{media.sha256}",
            "observationGroupId": str(row["reference_observation_id"]),
            "ownerPhotographerGroupId": (
                f"{item_provider}-observer:{row['observer_id']}"
                if row["observer_id"]
                else f"{item_provider}-observation:{row['source_observation_id']}"
            ),
            "samplingStratumId": str(row["sampling_stratum_id"]),
            "inclusionProbability": None,
            "rights": rights,
            "sourceProvenance": {
                "provider": item_provider,
                "providerLabel": provider_label,
                "originalProvider": str(row["original_provider"] or "") or None,
                "referenceObservationId": str(row["reference_observation_id"]),
                "sourceObservationId": str(row["source_observation_id"]),
                "providerMediaId": str(row["provider_media_id"]),
                "occurrenceLicense": str(row["occurrence_licence"] or "") or None,
                "mediaLicense": {
                    "name": license_name,
                    "uri": license_uri,
                    "policyStatus": str(row["rights_policy_status"]),
                },
                "observerId": str(row["observer_id"] or "") or None,
                "observedAt": iso_or_none(row["observed_at"]),
                "fallbackLevel": int(row["fallback_level"]),
                "geography": {
                    "locality": str(row["locality"] or "") or None,
                    "country": str(row["country"] or "") or None,
                    "countryCode": str(row["country_code"] or "") or None,
                    "latitude": (float(row["latitude"]) if row["latitude"] is not None else None),
                    "longitude": (
                        float(row["longitude"]) if row["longitude"] is not None else None
                    ),
                    "coordinateUncertaintyMeters": (
                        float(row["coordinate_uncertainty"])
                        if row["coordinate_uncertainty"] is not None
                        else None
                    ),
                    "coordinatesObscured": bool(row["coordinates_obscured"]),
                    "geographicClusterId": (str(row["geo_cluster_id"] or "") or None),
                },
                "providerVerificationStatus": ":".join(provider_status_parts),
            },
            "questionFingerprint": question_fingerprint,
        }
        items.append(item)
        media_receipts.append(
            {
                "referenceObservationId": str(row["reference_observation_id"]),
                "referenceMediaId": str(row["reference_media_id"]),
                "providerMediaId": str(row["provider_media_id"]),
                "sourceSnapshotVersion": str(row["source_snapshot_version"]),
                "sourceChecksum": str(row["source_checksum"] or "") or None,
                "sourceChecksumAlgorithm": (str(row["source_checksum_algorithm"] or "") or None),
                "previewUri": media.preview_uri,
                "sha256": media.sha256,
                "byteCount": media.byte_count,
                "decodedWidth": media.decoded_width,
                "decodedHeight": media.decoded_height,
                "licenseName": license_name,
                "licenseUri": license_uri,
                "policyStatus": str(row["rights_policy_status"]),
                "verifiedAt": generated_at,
            }
        )

    packet = {
        "schemaVersion": SCHEMA_VERSION,
        "campaign": campaign,
        "items": sorted(items, key=lambda item: item["itemId"]),
        "selection": {
            "schemaVersion": SELECTION_SCHEMA_VERSION,
            "selectionSeed": SELECTION_SEED,
            "design": "seeded_targeted_priority",
            "representative": False,
            "qualityEstimationAllowed": False,
            "scientificClaimAllowed": False,
            "candidateObservationCount": len(population),
            "selectedObservationCount": len(items),
            "strata": selection_strata,
            "selectionLimitations": [
                "The pilot intentionally over-samples rare life-stage and route cases.",
                "No inclusion probability or population accuracy estimate is authorized.",
                "Provider identities remain candidate evidence until human review.",
            ],
        },
        "provenance": {
            "generatedAt": generated_at,
            "generator": "scripts/build_reference_audit_campaign.py",
            "taxalensBaseSha": TAXALENS_BASE_SHA,
            "biominerRepository": "karikris/BioMiner",
            "biominerSha": BIOMINER_SHA,
            "inputArtifacts": input_receipts,
            "mediaVerification": media_receipts,
            "providerRoleSuitabilityBoundary": {
                "artifact": (COMMITTED_CONTEXT["providerRoleSuitabilityAttestation"]["path"]),
                "verifiedRecordCount": 81,
                "appliesToThisSelectedSet": False,
                "reason": (
                    "The committed attestation is aggregate and does not expose "
                    "the 81 frozen row identities. It is context, not a label "
                    "for these newly selected candidate rows."
                ),
                "independentTaxonomicVerificationClaimed": False,
            },
        },
        "semantics": {
            "providerTaxonLabelsAreCandidateEvidence": True,
            "providerRoleSuitabilityIsTaxonomicVerification": False,
            "humanReviewResultsPrepopulated": False,
            "likelyConflictIsAReviewPriorityNotAResult": True,
            "publicReplay": False,
            "scientificClaimAllowed": False,
        },
    }
    validate_packet(packet)
    return packet


def validate_packet(packet: dict[str, Any]) -> None:
    items = packet["items"]
    if not 20 <= len(items) <= 30:
        raise RuntimeError("Reference audit item count is outside 20–30.")
    observations = [item["observationGroupId"] for item in items]
    duplicates = [item["duplicateGroupId"] for item in items]
    if len(set(observations)) != len(items) or len(set(duplicates)) != len(items):
        raise RuntimeError("Reference audit repeats an observation or media digest.")
    counts = Counter(item["samplingStratumId"] for item in items)
    if counts != Counter(STRATUM_TARGETS):
        raise RuntimeError(f"Reference audit strata changed: {counts}")
    if {item["source"] for item in items} != {"gbif", "inaturalist"}:
        raise RuntimeError("Reference audit does not contain both providers.")
    if packet["campaign"]["samplingPlan"]["qualityEstimationAllowed"]:
        raise RuntimeError("Targeted reference audit may not estimate population quality.")
    if packet["campaign"]["scientificClaimAllowed"]:
        raise RuntimeError("Unreviewed reference audit may not authorize a claim.")
    for item in items:
        if item["imageByteCount"] < 1 or len(item["imageSha256"]) != 64:
            raise RuntimeError("Reference audit media identity is incomplete.")
        if item["rights"]["policyStatus"] not in {"allowed", "restricted"}:
            raise RuntimeError("Reference audit rights state is unsupported.")
        if item["providerSuppliedIdentity"]["verificationStatus"].endswith("human_verified"):
            raise RuntimeError("Reference provider label was promoted to human truth.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
    )
    parser.add_argument(
        "--biominer-root",
        type=Path,
        default=Path(__file__).resolve().parents[2] / "BioMiner",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("demo/source/verification/papilio-demoleus-reference-audit.campaign.json"),
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = args.repo_root.resolve()
    output = args.output
    if not output.is_absolute():
        output = repo_root / output
    packet = build_packet(repo_root, args.biominer_root.resolve())
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(packet, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "campaignId": packet["campaign"]["campaignId"],
                "manifestSha256": packet["campaign"]["manifestSha256"],
                "output": str(output),
                "selectedObservationCount": len(packet["items"]),
            },
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
