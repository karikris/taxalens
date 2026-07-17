#!/usr/bin/env python3
"""Build the bounded Papilio demoleus Flickr verification audit.

The population identity and query/geography rows are committed TaxaLens
imports of BioMiner artifacts. Historical, Git-ignored BioMiner run outputs
are used only to assign machine-screening strata; their exact byte identities
are disclosed in the output. Current Flickr API metadata and image bytes are
required before a selected item can be marked rights- and checksum-verified.

This is an explicit data-generation command, not part of an ordinary build.
It requires ``FLICKR_API_KEY`` and the historical BioMiner run cache.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
import mimetypes
import os
import sys
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import polars as pl
from PIL import Image

SCHEMA_VERSION = "taxalens-flickr-audit-campaign-packet:v1.0.0"
CAMPAIGN_SCHEMA_VERSION = "taxalens-verification-campaign:v1.0.0"
SOURCE_SCHEMA_VERSION = "taxalens-flickr-verification-source:v1.1.0"
SELECTION_SCHEMA_VERSION = "taxalens-flickr-audit-selection:v1.0.0"
GEOGRAPHIC_AUDIT_SCHEMA_VERSION = "taxalens-flickr-geographic-audit-strata:v1.0.0"
SELECTION_SEED = "taxalens-papilio-demoleus-flickr-audit-v1"
TAXALENS_BASE_SHA = "873beb6b2b58b28d4b144e03bb75f1c05b5d321c"
BIOMINER_SHA = "94fa1f634ee3c63917c05d78181dd3cf9ceff940"
HISTORICAL_RUN = "papilio_demoleus_global_multilingual_20260609_071759"

TARGET = {
    "acceptedTaxonKey": "gbif:1938069",
    "scientificName": "Papilio demoleus",
    "commonName": "lime swallowtail",
    "rank": "species",
    "authority": "Linnaeus, 1758",
}

HIDDEN_FIELDS = [
    "target_score_band",
    "competitor_margin_band",
    "decision_state",
    "top_competitors",
    "flickr_comments",
    "query_term",
    "provider_supplied_identity",
    "query_trust_tier",
    "priority_signals",
]

# The population is partitioned into owner-group strata before selection. Rare
# but operationally important abstention and no-usable-geo strata are kept,
# while the remaining target/competitor/negative strata cover three regions.
TARGETS_BY_STRATUM = {
    "abstention--other_geo": 1,
    "competitor--other_geo": 11,
    "competitor--south_asia": 2,
    "competitor--southeast_asia": 3,
    "negative--no_usable_geo": 1,
    "negative--other_geo": 9,
    "negative--south_asia": 3,
    "negative--southeast_asia": 2,
    "target_candidate--other_geo": 10,
    "target_candidate--south_asia": 4,
    "target_candidate--southeast_asia": 3,
}

# Broadly reusable, unmodified-display licenses only. NC and ND records are not
# admitted to this public-product review campaign.
FLICKR_LICENSES = {
    "4": ("CC BY 2.0", "https://creativecommons.org/licenses/by/2.0/"),
    "5": ("CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0/"),
    "7": ("No known copyright restrictions", "https://www.flickr.com/commons/usage/"),
    "8": ("United States Government Work", "https://www.usa.gov/government-copyright"),
    "9": (
        "Public Domain Dedication (CC0)",
        "https://creativecommons.org/publicdomain/zero/1.0/",
    ),
    "10": ("Public Domain Mark", "https://creativecommons.org/publicdomain/mark/1.0/"),
    "11": ("CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/"),
    "12": ("CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0/"),
}

EXPECTED_INPUTS = {
    "committed_geography": (
        "demo/source/biominer_phase14/analytics/flickr_geography.parquet",
        "a3c47a6f213191634f76655d859cdd8555a9b11a4e33a9041209eb23ba7c2bbf",
    ),
    "committed_assignments": (
        "demo/source/biominer_phase14/analytics/flickr_geo_assignments.parquet",
        "e12f6ef9582bf707c952c3974c91e9a8f226ca7ce8034cab8ea8c293b70b6f74",
    ),
    "committed_query_hits": (
        "demo/source/biominer_phase14/analytics/flickr_query_hits.parquet",
        "95448f3145d903f7f042fe41d74561475ef050f8df21b318ebacb252484e4f0b",
    ),
    "historical_flickr_metadata": (
        f"data/live_runs/{HISTORICAL_RUN}/checkpoints/flickr_metadata_all_hits.jsonl",
        "fe42f248cab68f6c3f67351800718fb9888b54a44f3b4a651d0f8bfa428c015d",
    ),
    "historical_coarse_predictions": (
        f"data/live_runs/{HISTORICAL_RUN}/bioclip25_classification/bioclip25_predictions.parquet",
        "513d810d9b18699fb44d8ac23658e3f3df6f1c3164a5723ea1638fdd7fb2723b",
    ),
    "historical_species_triage": (
        f"data/live_runs/{HISTORICAL_RUN}/"
        "bioclip25_species_all_global_2000_candidates_7families_batched/"
        "image_triage_species_all.parquet",
        "bef18dd78be900bc5b2b1e8073054e1ebc9e8b710c87c269da9d26c2fc40b80f",
    ),
}

GEOGRAPHIC_AUDIT_INPUT = (
    "demo/source/biominer_phase14/geographic_impact/geographic_impact_cells.parquet",
    "a02927ffbb4dc09fca582c61e6ceab51af6d12f8998cf0f7762ebfe26a4ea1c9",
)


@dataclass(frozen=True)
class InputArtifact:
    artifact_id: str
    path: Path
    declared_path: str
    sha256: str
    byte_count: int
    git_tracked: bool


@dataclass(frozen=True)
class LiveMedia:
    photo_id: str
    owner_id: str
    owner_name: str
    title: str
    source_uri: str
    license_id: str
    license_name: str
    license_uri: str
    preview_uri: str
    size_label: str
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
        ensure_ascii=False,
        allow_nan=False,
        separators=(",", ":"),
        sort_keys=True,
    )


def fingerprint(value: Any) -> str:
    return sha256_bytes(canonical_json(value).encode("utf-8"))


def seeded_rank(*parts: object) -> str:
    value = "\0".join([SELECTION_SEED, *(str(part) for part in parts)])
    return sha256_bytes(value.encode("utf-8"))


def load_inputs(repo_root: Path, biominer_root: Path) -> dict[str, InputArtifact]:
    inputs: dict[str, InputArtifact] = {}
    for artifact_id, (declared_path, expected_sha) in EXPECTED_INPUTS.items():
        git_tracked = artifact_id.startswith("committed_")
        root = repo_root if git_tracked else biominer_root
        path = root / declared_path
        if not path.is_file():
            raise RuntimeError(f"Required input is unavailable: {path}")
        actual_sha = sha256_path(path)
        if actual_sha != expected_sha:
            raise RuntimeError(
                f"Input digest mismatch for {artifact_id}: expected {expected_sha}, "
                f"observed {actual_sha}"
            )
        inputs[artifact_id] = InputArtifact(
            artifact_id=artifact_id,
            path=path,
            declared_path=declared_path,
            sha256=actual_sha,
            byte_count=path.stat().st_size,
            git_tracked=git_tracked,
        )
    return inputs


def load_geographic_audit_context(
    repo_root: Path,
) -> tuple[InputArtifact, dict[tuple[int, str], dict[str, Any]]]:
    declared_path, expected_sha = GEOGRAPHIC_AUDIT_INPUT
    path = repo_root / declared_path
    if not path.is_file():
        raise RuntimeError(f"Required geographic audit input is unavailable: {path}")
    actual_sha = sha256_path(path)
    if actual_sha != expected_sha:
        raise RuntimeError(
            "Geographic audit input digest mismatch: "
            f"expected {expected_sha}, observed {actual_sha}"
        )
    artifact = InputArtifact(
        artifact_id="committed_geographic_impact_cells",
        path=path,
        declared_path=declared_path,
        sha256=actual_sha,
        byte_count=path.stat().st_size,
        git_tracked=True,
    )
    rows = (
        pl.read_parquet(path)
        .select(
            "spatial_resolution",
            "spatial_cell_id",
            "continent",
            "country_code",
            "baseline_union_count",
            "candidate_only_cell",
        )
        .to_dicts()
    )
    lookup: dict[tuple[int, str], dict[str, Any]] = {}
    for row in rows:
        key = (int(row["spatial_resolution"]), str(row["spatial_cell_id"]))
        if key in lookup:
            raise RuntimeError(f"Geographic impact cells repeat audit key {key}.")
        lookup[key] = row
    return artifact, lookup


def load_population(
    inputs: dict[str, InputArtifact],
    geographic_impact_cells: dict[tuple[int, str], dict[str, Any]],
) -> list[dict[str, Any]]:
    metadata = (
        pl.scan_ndjson(
            inputs["historical_flickr_metadata"].path,
            infer_schema_length=10_000,
        )
        .select(
            "flickr_photo_id",
            "owner_id",
            "owner_name",
            "license",
            "url_l",
            "url_m",
        )
        .filter(pl.col("license").is_in(sorted(FLICKR_LICENSES)))
        .sort(["flickr_photo_id", "owner_id", "url_l", "url_m"])
        .unique("flickr_photo_id", keep="first")
    )
    predictions = pl.scan_parquet(inputs["historical_coarse_predictions"].path).select(
        "flickr_photo_id",
        "vision_review_required",
    )
    triage = pl.scan_parquet(inputs["historical_species_triage"].path).select(
        "flickr_photo_id",
        "image_hash",
        "source_record_hash",
        "model_id",
        "model_version",
        "species_top1_scientific_name",
        "species_top1_score",
        "species_topk_json",
        "image_category",
        "life_stage",
        "is_target_positive",
        "is_negative_material",
        "occurrence_bin",
        "bin_reason",
    )
    geography = pl.scan_parquet(inputs["committed_geography"].path).select(
        "flickr_photo_id",
        "source_record_hash",
        "latitude",
        "longitude",
        "coordinate_quality",
        "geography_warning",
        "geography_config_fingerprint",
        "country_code",
        "coarse_cell_id",
        "regional_cell_id",
        "local_cell_id",
    )
    assignments = pl.scan_parquet(inputs["committed_assignments"].path).select(
        "flickr_photo_id",
        "geo_cluster_id",
        "outlier",
        "cluster_configuration_hash",
    )
    joined = (
        metadata.join(predictions, on="flickr_photo_id", how="inner")
        .join(triage, on="flickr_photo_id", how="inner")
        .join(
            geography,
            on="flickr_photo_id",
            how="inner",
            suffix="_geography",
        )
        .join(assignments, on="flickr_photo_id", how="inner")
        .collect()
    )
    if joined.height < 1:
        raise RuntimeError("The Flickr audit population is empty.")

    rows = joined.to_dicts()
    for row in rows:
        row["screening_class"] = screening_class(row)
        row["geography_stratum"] = geography_stratum(row)
        row["sampling_stratum_id"] = f"{row['screening_class']}--{row['geography_stratum']}"
        row["geographic_audit_dimensions"] = geographic_audit_dimensions(
            row,
            geographic_impact_cells,
        )
    return canonical_owner_population(rows)


def geographic_audit_dimensions(
    row: dict[str, Any],
    geographic_impact_cells: dict[tuple[int, str], dict[str, Any]],
) -> dict[str, str]:
    coordinate_quality = str(row["coordinate_quality"])
    warning = row["geography_warning"]
    no_usable_geo = coordinate_quality in {"flickr_world", "unknown_precision"} or warning == (
        "coordinate_at_null_island"
    )
    spatial_resolution: int | None = None
    spatial_cell_id: str | None = None
    if coordinate_quality == "flickr_street" and row["local_cell_id"] is not None:
        spatial_resolution = 7
        spatial_cell_id = str(row["local_cell_id"])
    elif coordinate_quality == "flickr_city" and row["regional_cell_id"] is not None:
        spatial_resolution = 5
        spatial_cell_id = str(row["regional_cell_id"])
    elif coordinate_quality == "flickr_region" and row["coarse_cell_id"] is not None:
        spatial_resolution = 3
        spatial_cell_id = str(row["coarse_cell_id"])

    impact = (
        geographic_impact_cells.get((spatial_resolution, spatial_cell_id))
        if spatial_resolution is not None and spatial_cell_id is not None
        else None
    )
    if spatial_resolution is not None and impact is None:
        raise RuntimeError(
            f"Flickr audit cell {spatial_cell_id} at resolution {spatial_resolution} "
            "is absent from committed geographic impact evidence."
        )
    if impact is None:
        coverage = "comparison_unavailable"
    elif bool(impact["candidate_only_cell"]):
        coverage = "candidate_only_cell"
    elif int(impact["baseline_union_count"]) > 0:
        coverage = "baseline_covered_cell"
    else:
        raise RuntimeError("Geographic audit impact cell has unresolved coverage semantics.")

    score = row["species_top1_score"]
    if score is None:
        score_band = "unavailable"
    elif float(score) < 0.6:
        score_band = "low"
    elif float(score) < 0.8:
        score_band = "middle"
    else:
        score_band = "high"
    coordinate_support = (
        "no_usable_geo"
        if no_usable_geo
        else "spatial_cell_supported"
        if impact is not None
        else "country_precision_only"
    )
    return {
        "continent": str(impact["continent"] or "unavailable") if impact else "unavailable",
        "country": str(impact["country_code"] or "unavailable") if impact else "unavailable",
        "coordinate_support": coordinate_support,
        "coverage": coverage,
        "raw_screening_score_band": score_band,
        "query_trust_tier": "unassigned",
    }


def screening_class(row: dict[str, Any]) -> str:
    if bool(row["vision_review_required"]):
        return "abstention"
    if bool(row["is_negative_material"]):
        return "negative"
    if bool(row["is_target_positive"]):
        return "target_candidate"
    return "competitor"


def geography_stratum(row: dict[str, Any]) -> str:
    quality = str(row["coordinate_quality"])
    warning = row["geography_warning"]
    if quality in {"flickr_world", "unknown_precision"} or warning == ("coordinate_at_null_island"):
        return "no_usable_geo"
    latitude = float(row["latitude"])
    longitude = float(row["longitude"])
    if 5 <= latitude <= 36 and 60 <= longitude <= 100:
        return "south_asia"
    if -12 <= latitude <= 25 and 95 < longitude <= 141:
        return "southeast_asia"
    return "other_geo"


def canonical_owner_population(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_owner: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        by_owner[str(row["owner_id"])].append(row)

    population: list[dict[str, Any]] = []
    for owner_id, owner_rows in sorted(by_owner.items()):
        # Predeclared rare-stratum priority makes the partition exhaustive and
        # mutually exclusive without allowing one photographer to inflate n.
        no_geo = [row for row in owner_rows if row["geography_stratum"] == "no_usable_geo"]
        abstentions = [row for row in owner_rows if row["screening_class"] == "abstention"]
        eligible = no_geo or abstentions or owner_rows
        selected = min(
            eligible,
            key=lambda row: (
                seeded_rank("owner-media", owner_id, row["flickr_photo_id"]),
                str(row["flickr_photo_id"]),
            ),
        )
        population.append(selected)

    seen_photo_ids = {str(row["flickr_photo_id"]) for row in population}
    if len(seen_photo_ids) != len(population):
        raise RuntimeError("Owner-canonical population repeats a Flickr photo.")
    return population


def select_owner_sample(
    population: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    by_stratum: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in population:
        by_stratum[str(row["sampling_stratum_id"])].append(row)

    selected: list[dict[str, Any]] = []
    receipts: list[dict[str, Any]] = []
    unknown = sorted(set(TARGETS_BY_STRATUM) - set(by_stratum))
    if unknown:
        raise RuntimeError(f"Configured audit strata are unavailable: {unknown}")

    for stratum_id in sorted(by_stratum):
        rows = by_stratum[stratum_id]
        requested = TARGETS_BY_STRATUM.get(stratum_id)
        if requested is None:
            # A complete owner partition may include strata outside the review
            # budget. Their zero take is explicit and they contribute no claim.
            receipts.append(
                {
                    "stratumId": stratum_id,
                    "populationOwnerGroupCount": len(rows),
                    "selectedOwnerGroupCount": 0,
                    "populationCanonicalRecordCount": len(rows),
                    "selectedCanonicalRecordCount": 0,
                    "inclusionProbability": 0,
                    "samplingWeight": None,
                    "selectedOwnerGroupIds": [],
                }
            )
            continue
        if requested > len(rows):
            raise RuntimeError(
                f"Stratum {stratum_id} has {len(rows)} owner groups, below requested {requested}."
            )
        ranked = sorted(
            rows,
            key=lambda row: (
                seeded_rank("owner-sample", stratum_id, row["owner_id"]),
                str(row["owner_id"]),
            ),
        )
        chosen = ranked[:requested]
        probability = requested / len(rows)
        for row in chosen:
            row["inclusion_probability"] = probability
        selected.extend(chosen)
        receipts.append(
            {
                "stratumId": stratum_id,
                "populationOwnerGroupCount": len(rows),
                "selectedOwnerGroupCount": requested,
                "populationCanonicalRecordCount": len(rows),
                "selectedCanonicalRecordCount": requested,
                "inclusionProbability": probability,
                "samplingWeight": 1 / probability,
                "selectedOwnerGroupIds": sorted(
                    f"flickr-owner:{row['owner_id']}" for row in chosen
                ),
            }
        )

    selected.sort(
        key=lambda row: (
            str(row["sampling_stratum_id"]),
            str(row["owner_id"]),
            str(row["flickr_photo_id"]),
        )
    )
    if not 40 <= len(selected) <= 60:
        raise RuntimeError(f"Audit selection must contain 40–60 owner groups, got {len(selected)}.")
    return selected, receipts


def load_query_hits(
    inputs: dict[str, InputArtifact],
) -> dict[str, list[dict[str, str]]]:
    rows = (
        pl.read_parquet(inputs["committed_query_hits"].path)
        .sort(["flickr_photo_id", "query_tier", "query_hash"])
        .to_dicts()
    )
    by_photo: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        by_photo[str(row["flickr_photo_id"])].append(row)
    return by_photo


def choose_query(
    photo_id: str,
    by_photo: dict[str, list[dict[str, str]]],
) -> dict[str, str]:
    rows = by_photo.get(photo_id, [])
    if not rows:
        raise RuntimeError(f"Selected photo {photo_id} has no committed query hit.")
    row = min(
        rows,
        key=lambda value: (
            seeded_rank(
                "query-hit",
                photo_id,
                value["query_hash"],
                value["query_tier"],
            ),
            value["query_hash"],
        ),
    )
    rank, confidence, search_field = str(row["query_tier"]).split(":")
    trust_tier = query_trust_tier(rank, confidence)
    return {
        "tier": f"{rank}:{trust_tier}:{search_field}",
        "rank": rank,
        "trustTier": trust_tier,
        "searchField": search_field,
        "term": str(row["search_term"]),
        "sourceQueryHash": str(row["query_hash"]),
        "sourceQueryTier": str(row["query_tier"]),
    }


def query_trust_tier(rank: str, confidence: str) -> str:
    if rank == "scientific_name" and confidence == "high":
        return "T1"
    if confidence == "high":
        return "T2"
    if confidence == "medium":
        return "T3"
    if confidence == "broad":
        return "T4"
    return "T5"


def build_geographic_audit_strata(
    population: list[dict[str, Any]],
    selected: list[dict[str, Any]],
    item_id_by_photo: dict[str, str],
    impact_artifact: InputArtifact,
) -> dict[str, Any]:
    dimension_names = (
        "continent",
        "country",
        "coordinate_support",
        "coverage",
        "raw_screening_score_band",
        "query_trust_tier",
    )
    dimensions: dict[str, list[dict[str, Any]]] = {}
    for dimension in dimension_names:
        population_counts = Counter(
            str(row["geographic_audit_dimensions"][dimension]) for row in population
        )
        selected_counts = Counter(
            str(row["geographic_audit_dimensions"][dimension]) for row in selected
        )
        dimensions[dimension] = [
            {
                "value": value,
                "populationOwnerGroupCount": population_counts[value],
                "selectedOwnerGroupCount": selected_counts[value],
                "zeroTake": selected_counts[value] == 0,
            }
            for value in sorted(population_counts)
        ]

    selected_owner_groups = [str(row["owner_id"]) for row in selected]
    requirements = {
        "multipleContinents": len(
            {
                row["geographic_audit_dimensions"]["continent"]
                for row in selected
                if row["geographic_audit_dimensions"]["continent"] != "unavailable"
            }
        )
        >= 2,
        "multipleCountries": len(
            {
                row["geographic_audit_dimensions"]["country"]
                for row in selected
                if row["geographic_audit_dimensions"]["country"] != "unavailable"
            }
        )
        >= 2,
        "noUsableGeo": any(
            row["geographic_audit_dimensions"]["coordinate_support"] == "no_usable_geo"
            for row in selected
        ),
        "baselineCoveredCells": any(
            row["geographic_audit_dimensions"]["coverage"] == "baseline_covered_cell"
            for row in selected
        ),
        "candidateOnlyCells": any(
            row["geographic_audit_dimensions"]["coverage"] == "candidate_only_cell"
            for row in selected
        ),
        "allObservedRawScoreBands": {
            row["geographic_audit_dimensions"]["raw_screening_score_band"] for row in population
        }.issubset(
            {row["geographic_audit_dimensions"]["raw_screening_score_band"] for row in selected}
        ),
        "multipleQueryTiers": len(
            {row["geographic_audit_dimensions"]["query_trust_tier"] for row in selected}
        )
        >= 2,
        "independentOwnerGroups": len(selected_owner_groups) == len(set(selected_owner_groups)),
    }
    if not all(requirements.values()):
        failed = sorted(name for name, met in requirements.items() if not met)
        raise RuntimeError(f"Geographic audit representation requirements failed: {failed}")

    bindings = []
    for row in selected:
        photo_id = str(row["flickr_photo_id"])
        item_id = item_id_by_photo.get(photo_id)
        if item_id is None:
            raise RuntimeError(f"Geographic audit selected photo {photo_id} has no review item.")
        bindings.append(
            {
                "itemId": item_id,
                "ownerPhotographerGroupId": f"flickr-owner:{row['owner_id']}",
                "primarySamplingStratumId": str(row["sampling_stratum_id"]),
                "inclusionProbability": float(row["inclusion_probability"]),
                "dimensions": row["geographic_audit_dimensions"],
            }
        )
    bindings.sort(key=lambda value: value["itemId"])
    return {
        "schemaVersion": GEOGRAPHIC_AUDIT_SCHEMA_VERSION,
        "impactArtifact": {
            "path": impact_artifact.declared_path,
            "sha256": impact_artifact.sha256,
            "byteCount": impact_artifact.byte_count,
        },
        "primarySamplingDesignUnchanged": True,
        "reportingDimensionsDoNotAlterInclusionProbability": True,
        "reviewerDisclosureAllowedBeforeDecision": False,
        "dimensionSemantics": {
            "raw_screening_score_band": (
                "Bands the historical raw top-1 model similarity at <0.6, 0.6–<0.8 and "
                ">=0.8; it is not a probability or human label."
            ),
            "coverage": (
                "Compares the precision-supported Flickr cell with the selected baseline "
                "snapshot; unavailable comparison is not biological absence."
            ),
            "zeroTake": (
                "A population dimension value received no selected owner group and authorizes "
                "no dimension-specific estimate."
            ),
        },
        "dimensions": dimensions,
        "representationRequirements": requirements,
        "ownerGroupIndependence": {
            "populationOwnerGroupCount": len(population),
            "selectedOwnerGroupCount": len(selected),
            "repeatedSelectedOwnerGroupCount": len(selected_owner_groups)
            - len(set(selected_owner_groups)),
        },
        "itemBindings": bindings,
    }


def flickr_api(api_key: str, method: str, **arguments: str) -> dict[str, Any]:
    query = urllib.parse.urlencode(
        {
            "method": method,
            "api_key": api_key,
            "format": "json",
            "nojsoncallback": "1",
            **arguments,
        }
    )
    request = urllib.request.Request(
        f"https://www.flickr.com/services/rest/?{query}",
        headers={"User-Agent": "TaxaLens-audit-builder/1.0"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.load(response)
    if payload.get("stat") != "ok":
        raise RuntimeError(
            f"Flickr {method} failed for {arguments.get('photo_id')}: "
            f"{payload.get('message', 'unknown error')}"
        )
    return payload


def fetch_live_media(api_key: str, photo_id: str) -> LiveMedia:
    info = flickr_api(api_key, "flickr.photos.getInfo", photo_id=photo_id)["photo"]
    license_id = str(info["license"])
    license_details = FLICKR_LICENSES.get(license_id)
    if license_details is None:
        raise RuntimeError(
            f"Selected photo {photo_id} is no longer broadly reusable "
            f"(Flickr license {license_id})."
        )
    sizes = flickr_api(api_key, "flickr.photos.getSizes", photo_id=photo_id)["sizes"]["size"]
    candidates = [
        size
        for size in sizes
        if str(size.get("media", "photo")) == "photo" and 500 <= int(size.get("width", 0)) <= 1024
    ]
    if not candidates:
        candidates = [size for size in sizes if str(size.get("media", "photo")) == "photo"]
    if not candidates:
        raise RuntimeError(f"Selected photo {photo_id} has no reviewable size.")
    chosen = max(
        candidates,
        key=lambda size: (
            int(size.get("width", 0)) * int(size.get("height", 0)),
            str(size.get("label", "")),
        ),
    )
    preview_uri = str(chosen["source"])
    request = urllib.request.Request(
        preview_uri,
        headers={"User-Agent": "TaxaLens-audit-builder/1.0"},
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        content = response.read(12 * 1024 * 1024 + 1)
        content_type = response.headers.get_content_type()
    if len(content) > 12 * 1024 * 1024:
        raise RuntimeError(f"Selected photo {photo_id} exceeds the media limit.")
    if not content:
        raise RuntimeError(f"Selected photo {photo_id} returned no media bytes.")
    with Image.open(io.BytesIO(content)) as image:
        image.verify()
    with Image.open(io.BytesIO(content)) as image:
        width, height = image.size
        image_format = str(image.format or "").lower()
    if not content_type.startswith("image/"):
        content_type = mimetypes.types_map.get(f".{image_format}", "")
    if not content_type.startswith("image/"):
        raise RuntimeError(f"Selected photo {photo_id} is not an image.")

    owner = info["owner"]
    owner_name = str(owner.get("realname") or owner.get("username") or owner.get("nsid"))
    source_urls = info.get("urls", {}).get("url", [])
    source_uri = next(
        (str(value["_content"]) for value in source_urls if value.get("type") == "photopage"),
        f"https://www.flickr.com/photos/{owner['nsid']}/{photo_id}/",
    )
    return LiveMedia(
        photo_id=photo_id,
        owner_id=str(owner["nsid"]),
        owner_name=owner_name,
        title=str(info.get("title", {}).get("_content") or f"Flickr photo {photo_id}"),
        source_uri=source_uri,
        license_id=license_id,
        license_name=license_details[0],
        license_uri=license_details[1],
        preview_uri=preview_uri,
        size_label=str(chosen.get("label") or "review preview"),
        media_type=content_type,
        sha256=sha256_bytes(content),
        byte_count=len(content),
        decoded_width=width,
        decoded_height=height,
    )


def fetch_selected_media(
    selected: list[dict[str, Any]], api_key: str, workers: int
) -> dict[str, LiveMedia]:
    photo_ids = [str(row["flickr_photo_id"]) for row in selected]
    with ThreadPoolExecutor(max_workers=workers) as pool:
        media = list(pool.map(lambda value: fetch_live_media(api_key, value), photo_ids))
    by_photo = {item.photo_id: item for item in media}
    if len(by_photo) != len(photo_ids):
        raise RuntimeError("Live media verification repeated a selected photo.")
    media_hashes = [item.sha256 for item in media]
    if len(set(media_hashes)) != len(media_hashes):
        raise RuntimeError("Selected live media contains an exact duplicate.")
    return by_photo


def route_for(row: dict[str, Any]) -> dict[str, Any]:
    category = str(row["image_category"])
    raw_stage = str(row["life_stage"])
    life_stage = {
        "larva": "larva",
        "caterpillar": "larva",
        "pupa": "pupa",
        "chrysalis": "pupa",
        "egg": "egg",
    }.get(raw_stage, "adult" if category == "adult_butterfly" else "unknown")
    visual_domain = {
        "adult_butterfly": "live_field",
        "life_stage_non_adult": "live_field",
        "artwork": "artwork",
        "museum_specimen": "pinned_specimen",
        "object_or_product": "unsuitable",
        "not_lepidoptera": "unsuitable",
    }.get(category, "ambiguous")
    route_payload = {
        "imageCategory": category,
        "rawLifeStage": raw_stage,
        "lifeStage": life_stage,
        "visualDomain": visual_domain,
        "modelId": row["model_id"],
        "modelVersion": row["model_version"],
    }
    return {
        "routeLabel": category,
        "lifeStage": life_stage,
        "visualDomain": visual_domain,
        "view": "unknown",
        "subjectAreaRatio": None,
        "fingerprint": f"sha256:{fingerprint(route_payload)}",
    }


def target_and_margin_bands(row: dict[str, Any]) -> tuple[str, str]:
    candidates = row["species_topk_json"] or []
    scores = {str(candidate["label"]): float(candidate["score"]) for candidate in candidates}
    target_score = scores.get("Papilio demoleus")
    competitor_scores = [score for label, score in scores.items() if label != "Papilio demoleus"]
    if target_score is None or not competitor_scores:
        return "unavailable", "unavailable"
    if target_score >= 0.8:
        score_band = "high"
    elif target_score >= 0.4:
        score_band = "middle"
    else:
        score_band = "low"
    margin = target_score - max(competitor_scores)
    if margin < -0.02:
        margin_band = "negative"
    elif margin <= 0.02:
        margin_band = "near_tie"
    elif margin <= 0.1:
        margin_band = "small_positive"
    else:
        margin_band = "clear_positive"
    return score_band, margin_band


def decision_state(screening: str) -> str:
    return {
        "target_candidate": "target",
        "abstention": "abstain",
        "competitor": "non_target",
        "negative": "non_target",
    }[screening]


def source_for(
    row: dict[str, Any],
    query: dict[str, str],
    media: LiveMedia,
    input_fingerprints: dict[str, str],
) -> dict[str, Any]:
    score_band, margin_band = target_and_margin_bands(row)
    no_geo = row["geography_stratum"] == "no_usable_geo"
    model_evidence = {
        "historicalImageSha256": str(row["image_hash"]).removeprefix("sha256:"),
        "historicalSourceRecordHash": row["source_record_hash"],
        "speciesTop1ScientificName": row["species_top1_scientific_name"],
        "speciesTop1Score": row["species_top1_score"],
        "imageCategory": row["image_category"],
        "lifeStage": row["life_stage"],
        "occurrenceBin": row["occurrence_bin"],
        "binReason": row["bin_reason"],
        "screeningClass": row["screening_class"],
        "inputs": input_fingerprints,
    }
    evidence_fingerprint = fingerprint(model_evidence)
    rights = {
        "creator": media.owner_name,
        "rightsHolder": media.owner_name,
        "licenseName": media.license_name,
        "licenseUri": media.license_uri,
        "policyStatus": "allowed",
        "attribution": f"{media.title} by {media.owner_name}, {media.license_name}",
        "sourceUri": media.source_uri,
    }
    route = route_for(row)
    source_payload = {
        "photoId": media.photo_id,
        "ownerId": media.owner_id,
        "currentMediaSha256": media.sha256,
        "query": query,
        "route": route,
        "modelEvidence": model_evidence,
        "rights": rights,
    }
    return {
        "schemaVersion": SOURCE_SCHEMA_VERSION,
        "flickrRecordId": f"flickr-record:{media.photo_id}",
        "flickrPhotoId": media.photo_id,
        "fullFrameMedia": {
            "mediaId": f"flickr-media:{media.photo_id}:{media.size_label}",
            "previewUri": media.preview_uri,
            "mediaType": media.media_type,
            "sha256": media.sha256,
            "byteCount": media.byte_count,
            "checksumVerified": True,
            "rights": rights,
        },
        "duplicateGroupId": f"sha256:{media.sha256}",
        "ownerGroupId": f"flickr-owner:{media.owner_id}",
        "observationGroupId": f"flickr-observation:{media.photo_id}",
        "geographicClusterId": None if no_geo else str(row["geo_cluster_id"]),
        "coordinate": {
            "latitude": None if no_geo else float(row["latitude"]),
            "longitude": None if no_geo else float(row["longitude"]),
            "outlier": None if no_geo else bool(row["outlier"]),
        },
        "query": {key: query[key] for key in ("tier", "rank", "trustTier", "searchField", "term")},
        "route": route,
        "targetScoreBand": score_band,
        "decisionState": decision_state(str(row["screening_class"])),
        "competitorMarginBand": margin_band,
        "samplingStratumId": str(row["sampling_stratum_id"]),
        "inclusionProbability": None,
        "datasetPartition": "final_test",
        "prioritySignals": {
            "lowMargin": margin_band in {"negative", "near_tie", "small_positive"},
            "visualInputDisagreement": bool(row["vision_review_required"]),
            "geographicAnomaly": None if no_geo else bool(row["outlier"]),
            "commentConflict": None,
            "smallSubject": None,
            "referenceShortfall": None,
            "unusualCompetitor": str(row["screening_class"]) == "competitor",
        },
        "postDecisionEvidence": {
            "strongestCompetitors": [],
            "references": [],
            "comments": [],
            "decisionReason": None,
            "evidenceFingerprint": f"sha256:{evidence_fingerprint}",
        },
        "sourceArtifactFingerprint": f"sha256:{fingerprint(source_payload)}",
        "biominerSha": BIOMINER_SHA,
    }


def build_packet(
    repo_root: Path,
    biominer_root: Path,
    api_key: str,
    workers: int,
) -> dict[str, Any]:
    inputs = load_inputs(repo_root, biominer_root)
    impact_artifact, geographic_impact_cells = load_geographic_audit_context(repo_root)
    population = load_population(inputs, geographic_impact_cells)
    query_hits = load_query_hits(inputs)
    for row in population:
        query = choose_query(str(row["flickr_photo_id"]), query_hits)
        row["geographic_audit_dimensions"]["query_trust_tier"] = query["trustTier"]
    selected, strata_receipts = select_owner_sample(population)
    media_by_photo = fetch_selected_media(selected, api_key, workers)
    generated_at = datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    input_fingerprints = {
        artifact_id: f"sha256:{artifact.sha256}" for artifact_id, artifact in sorted(inputs.items())
    }

    source_rows: list[dict[str, Any]] = []
    media_receipts: list[dict[str, Any]] = []
    for row in selected:
        photo_id = str(row["flickr_photo_id"])
        query = choose_query(photo_id, query_hits)
        media = media_by_photo[photo_id]
        source_rows.append(source_for(row, query, media, input_fingerprints))
        media_receipts.append(
            {
                "flickrPhotoId": photo_id,
                "licenseId": media.license_id,
                "licenseName": media.license_name,
                "licenseUri": media.license_uri,
                "sourceUri": media.source_uri,
                "previewUri": media.preview_uri,
                "previewSizeLabel": media.size_label,
                "sha256": media.sha256,
                "byteCount": media.byte_count,
                "decodedWidth": media.decoded_width,
                "decodedHeight": media.decoded_height,
                "verifiedAt": generated_at,
            }
        )

    selection_identity = {
        "schemaVersion": SELECTION_SCHEMA_VERSION,
        "selectionSeed": SELECTION_SEED,
        "biominerSha": BIOMINER_SHA,
        "taxalensBaseSha": TAXALENS_BASE_SHA,
        "inputArtifacts": input_fingerprints,
        "populationOwnerGroupCount": len(population),
        "strata": strata_receipts,
        "selected": [
            {
                "flickrRecordId": source["flickrRecordId"],
                "duplicateGroupId": source["duplicateGroupId"],
                "ownerGroupId": source["ownerGroupId"],
                "samplingStratumId": source["samplingStratumId"],
                "sourceArtifactFingerprint": source["sourceArtifactFingerprint"],
            }
            for source in source_rows
        ],
    }
    manifest_sha256 = fingerprint(selection_identity)
    campaign_id = f"flickr-audit-{manifest_sha256[:24]}"
    question_fingerprint = fingerprint(
        {
            "domain": "taxalens.flickr-target-question.v1",
            "target": TARGET,
            "blind": True,
        }
    )
    population_total = len(population)
    campaign_strata = [
        {
            "stratumId": receipt["stratumId"],
            "label": (
                "Flickr owner audit · "
                + receipt["stratumId"].replace("--", " · ").replace("_", " ")
            ),
            "populationCount": receipt["populationOwnerGroupCount"],
            "targetSampleCount": receipt["selectedOwnerGroupCount"],
            "populationWeight": (receipt["populationOwnerGroupCount"] / population_total),
            "selectionNotes": (
                "Seeded equal-probability owner-group sample; one media "
                "observation per photographer. Zero-take strata are outside "
                "this bounded campaign and authorize no estimate."
            ),
        }
        for receipt in strata_receipts
    ]
    campaign = {
        "schemaVersion": CAMPAIGN_SCHEMA_VERSION,
        "campaignId": campaign_id,
        "title": "Papilio demoleus blind Flickr audit",
        "description": (
            "A 49-owner, rights-verified blind audit of machine-screened "
            "Flickr search hypotheses. Human outcomes are not pre-populated."
        ),
        "kind": "flickr_target_verification",
        "status": "ready",
        "targetTaxon": TARGET,
        "sourceProviders": ["flickr"],
        "reviewRequirement": {
            "requiredIndependentReviewers": 2,
            "secondReviewPolicy": "on_conflict_or_uncertain",
            "adjudicationRequiredOnConflict": True,
            "decisiveOutcomes": ["yes", "no"],
            "mediaRequiredOutcomes": ["yes", "no", "cant_tell"],
            "nonScientificOutcomes": ["cant_view", "skipped"],
        },
        "samplingPlan": {
            "planId": f"{campaign_id}-owner-stratified-sample",
            "purpose": "quality_estimation",
            "design": "stratified_random",
            "representative": True,
            "blindReview": True,
            "selectionSeed": SELECTION_SEED,
            "targetSampleSize": len(source_rows),
            "inclusionProbabilityRequired": True,
            "independentUnit": "owner_group",
            "groupingKeys": [
                "duplicate_group",
                "observation_group",
                "owner_group",
                "geographic_cluster",
            ],
            "leakagePolicy": "final_test_only",
            "strata": campaign_strata,
            "qualityEstimationAllowed": True,
            "qualityEstimationBlockedReason": None,
        },
        "disclosurePolicy": {
            "mode": "blind",
            "revealAfterDecision": True,
            "hiddenBeforeDecision": HIDDEN_FIELDS,
        },
        "questionFingerprint": question_fingerprint,
        "manifestSha256": manifest_sha256,
        "taxalensSha": TAXALENS_BASE_SHA,
        "biominerSha": BIOMINER_SHA,
        "publicReplay": False,
        "scientificClaimAllowed": False,
    }

    items: list[dict[str, Any]] = []
    sampling_weights: dict[str, float] = {}
    item_id_by_photo: dict[str, str] = {}
    source_by_id = {source["flickrRecordId"]: source for source in source_rows}
    probability_by_stratum = {
        receipt["stratumId"]: receipt["inclusionProbability"] for receipt in strata_receipts
    }
    for record_id in sorted(source_by_id):
        source = source_by_id[record_id]
        probability = probability_by_stratum[source["samplingStratumId"]]
        if not isinstance(probability, float) or probability <= 0:
            raise RuntimeError("Selected source lost its inclusion probability.")
        source["inclusionProbability"] = probability
        item_id = "flickr-review-item:" + fingerprint(
            [
                campaign_id,
                source["flickrRecordId"],
                source["fullFrameMedia"]["sha256"],
            ]
        )
        item = {
            "itemId": item_id,
            "campaignId": campaign_id,
            "source": "flickr",
            "sourceObservationId": source["flickrPhotoId"],
            "sourceMediaId": source["fullFrameMedia"]["mediaId"],
            "imageSha256": source["fullFrameMedia"]["sha256"],
            "imageByteCount": source["fullFrameMedia"]["byteCount"],
            "mediaType": source["fullFrameMedia"]["mediaType"],
            "previewUri": source["fullFrameMedia"]["previewUri"],
            "targetTaxon": TARGET,
            "providerSuppliedIdentity": {
                "providerTaxonKey": None,
                "scientificName": None,
                "commonName": None,
                "rawLabel": None,
                "verificationStatus": None,
            },
            "expectedLifeStage": source["route"]["lifeStage"],
            "expectedVisualDomain": source["route"]["visualDomain"],
            "expectedView": source["route"]["view"],
            "duplicateGroupId": source["duplicateGroupId"],
            "observationGroupId": source["observationGroupId"],
            "ownerPhotographerGroupId": source["ownerGroupId"],
            "samplingStratumId": source["samplingStratumId"],
            "inclusionProbability": probability,
            "rights": source["fullFrameMedia"]["rights"],
            "flickrSource": source,
            "questionFingerprint": question_fingerprint,
        }
        items.append(item)
        item_id_by_photo[str(source["flickrPhotoId"])] = item_id
        sampling_weights[item_id] = 1 / probability

    geographic_audit_strata = build_geographic_audit_strata(
        population,
        selected,
        item_id_by_photo,
        impact_artifact,
    )

    git_tracked_input_count = sum(artifact.git_tracked for artifact in inputs.values()) + 1
    packet = {
        "schemaVersion": SCHEMA_VERSION,
        "campaign": campaign,
        "items": items,
        "selection": {
            "schemaVersion": SELECTION_SCHEMA_VERSION,
            "selectionSeed": SELECTION_SEED,
            "sourceRecordCount": len(population),
            "canonicalRecordCount": len(population),
            "omittedDuplicateRecordIds": [],
            "selectedRecordCount": len(items),
            "strata": strata_receipts,
            "samplingWeights": sampling_weights,
            "representative": True,
            "qualityEstimationAllowed": True,
            "scientificClaimAllowed": False,
            "estimand": (
                "The rights-eligible, successfully joined, owner-canonical "
                "Flickr hypotheses in the pinned BioMiner pilot population. "
                "It is not all Flickr, all butterflies, or an occurrence set."
            ),
            "ownerPartitionRule": (
                "Assign each owner first to no-usable-geo when present, then "
                "historical machine abstention when present, otherwise to the "
                "seed-ranked screening/geography record; select one record per "
                "owner and owner groups within declared strata."
            ),
            "zeroTakeStrataAuthorizeEstimate": False,
            "geographicAuditStrata": geographic_audit_strata,
        },
        "provenance": {
            "generatedAt": generated_at,
            "generator": "scripts/build_flickr_audit_campaign.py",
            "taxalensBaseSha": TAXALENS_BASE_SHA,
            "biominerRepository": "karikris/BioMiner",
            "biominerSha": BIOMINER_SHA,
            "inputArtifacts": [
                {
                    "artifactId": artifact.artifact_id,
                    "declaredPath": artifact.declared_path,
                    "sha256": artifact.sha256,
                    "byteCount": artifact.byte_count,
                    "gitTracked": artifact.git_tracked,
                    "role": (
                        "geographic_audit_reporting"
                        if artifact.artifact_id == "committed_geographic_impact_cells"
                        else "committed_population_contract"
                        if artifact.git_tracked
                        else "historical_screening_cache"
                    ),
                }
                for artifact in [*inputs.values(), impact_artifact]
            ],
            "gitTrackedInputCount": git_tracked_input_count,
            "historicalCacheInputCount": sum(
                not artifact.git_tracked for artifact in inputs.values()
            ),
            "historicalCacheDisclosure": (
                "The three historical screening inputs are local run outputs, "
                "not content at BioMiner HEAD. Their exact hashes are pinned; "
                "they assign review strata only and are not human truth."
            ),
            "flickrRightsRegistry": {
                "method": "flickr.photos.licenses.getInfo",
                "documentationUri": (
                    "https://www.flickr.com/services/api/flickr.photos.licenses.getInfo.html"
                ),
                "checkedAt": generated_at,
                "allowedLicenseIds": sorted(FLICKR_LICENSES),
                "excludedPolicies": [
                    "All Rights Reserved",
                    "NonCommercial",
                    "NoDerivatives",
                ],
            },
            "mediaVerification": media_receipts,
        },
        "semantics": {
            "flickrSearchResultsAreHypotheses": True,
            "screeningClassesAreHumanTruth": False,
            "modelScoresAreProbabilities": False,
            "humanReviewResultsPrepopulated": False,
            "oneSelectedRecordPerOwnerGroup": True,
            "noUsableGeoMeansNoLocalGeographicEvidence": True,
            "publicReplay": False,
            "scientificClaimAllowed": False,
        },
    }
    validate_packet(packet)
    return packet


def validate_packet(packet: dict[str, Any]) -> None:
    campaign = packet["campaign"]
    items = packet["items"]
    if not 40 <= len(items) <= 60:
        raise RuntimeError("Campaign item count is outside the 40–60 gate.")
    if campaign["samplingPlan"]["targetSampleSize"] != len(items):
        raise RuntimeError("Campaign target size does not match selected items.")
    if campaign["scientificClaimAllowed"] or campaign["publicReplay"]:
        raise RuntimeError("Flickr audit may not authorize a public scientific replay.")
    owners = [item["ownerPhotographerGroupId"] for item in items]
    observations = [item["observationGroupId"] for item in items]
    duplicates = [item["duplicateGroupId"] for item in items]
    if not (len(set(owners)) == len(set(observations)) == len(set(duplicates)) == len(items)):
        raise RuntimeError("Selected audit records are not independent by grouping key.")
    classes = {item["samplingStratumId"].split("--", maxsplit=1)[0] for item in items}
    if classes != {"target_candidate", "abstention", "competitor", "negative"}:
        raise RuntimeError(f"Required screening classes are incomplete: {classes}")
    geography = {item["samplingStratumId"].split("--", maxsplit=1)[1] for item in items}
    required_geography = {
        "south_asia",
        "southeast_asia",
        "other_geo",
        "no_usable_geo",
    }
    if not required_geography.issubset(geography):
        raise RuntimeError(f"Required geography strata are incomplete: {geography}")
    query_tiers = {item["flickrSource"]["query"]["trustTier"] for item in items}
    if len(query_tiers) < 2:
        raise RuntimeError("Audit selection does not cover multiple query trust tiers.")
    for item in items:
        source = item["flickrSource"]
        probability = item["inclusionProbability"]
        if not isinstance(probability, float) or not 0 < probability <= 1:
            raise RuntimeError("Selected item has an invalid inclusion probability.")
        if source["fullFrameMedia"]["rights"]["policyStatus"] != "allowed":
            raise RuntimeError("Selected item has unapproved media rights.")
        if source["fullFrameMedia"]["sha256"] != item["imageSha256"]:
            raise RuntimeError("Selected media identity changed during projection.")
        if not source["fullFrameMedia"]["checksumVerified"]:
            raise RuntimeError("Selected media is not checksum-verified.")
        if source["samplingStratumId"].endswith("no_usable_geo"):
            if source["coordinate"] != {
                "latitude": None,
                "longitude": None,
                "outlier": None,
            }:
                raise RuntimeError("No-usable-geo item exposes misleading coordinates.")
    numeric_values = [
        receipt["inclusionProbability"]
        for receipt in packet["selection"]["strata"]
        if receipt["selectedOwnerGroupCount"] > 0
    ]
    if any(not math.isfinite(value) for value in numeric_values):
        raise RuntimeError("Selection receipt contains non-finite probabilities.")
    validate_geographic_audit(packet)


def validate_geographic_audit(packet: dict[str, Any]) -> None:
    audit = packet["selection"]["geographicAuditStrata"]
    items = packet["items"]
    selection = packet["selection"]
    if audit["schemaVersion"] != GEOGRAPHIC_AUDIT_SCHEMA_VERSION:
        raise RuntimeError("Geographic audit strata schema changed.")
    if not audit["primarySamplingDesignUnchanged"]:
        raise RuntimeError("Geographic audit altered the primary sampling design.")
    if not audit["reportingDimensionsDoNotAlterInclusionProbability"]:
        raise RuntimeError("Geographic reporting dimensions altered inclusion probability.")
    if audit["reviewerDisclosureAllowedBeforeDecision"]:
        raise RuntimeError("Blind geographic audit dimensions became reviewer-visible.")
    if not all(audit["representationRequirements"].values()):
        raise RuntimeError("Geographic audit representation requirement is incomplete.")

    bindings = audit["itemBindings"]
    if len(bindings) != len(items):
        raise RuntimeError("Geographic audit binding count differs from campaign items.")
    item_by_id = {item["itemId"]: item for item in items}
    if len(item_by_id) != len(items) or {row["itemId"] for row in bindings} != set(item_by_id):
        raise RuntimeError("Geographic audit bindings do not cover each item exactly once.")
    for binding in bindings:
        item = item_by_id[binding["itemId"]]
        if binding["ownerPhotographerGroupId"] != item["ownerPhotographerGroupId"]:
            raise RuntimeError("Geographic audit owner binding changed.")
        if binding["primarySamplingStratumId"] != item["samplingStratumId"]:
            raise RuntimeError("Geographic audit primary stratum binding changed.")
        if binding["inclusionProbability"] != item["inclusionProbability"]:
            raise RuntimeError("Geographic audit inclusion probability changed.")

    dimensions = audit["dimensions"]
    expected_dimensions = {
        "continent",
        "country",
        "coordinate_support",
        "coverage",
        "raw_screening_score_band",
        "query_trust_tier",
    }
    if set(dimensions) != expected_dimensions:
        raise RuntimeError("Geographic audit reporting dimensions changed.")
    for dimension, receipts in dimensions.items():
        if (
            sum(row["populationOwnerGroupCount"] for row in receipts)
            != selection["sourceRecordCount"]
        ):
            raise RuntimeError(f"Geographic audit {dimension} population does not reconcile.")
        if sum(row["selectedOwnerGroupCount"] for row in receipts) != len(items):
            raise RuntimeError(f"Geographic audit {dimension} selection does not reconcile.")
        if any(row["zeroTake"] != (row["selectedOwnerGroupCount"] == 0) for row in receipts):
            raise RuntimeError(f"Geographic audit {dimension} zero-take state is invalid.")


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
        default=Path("demo/source/verification/papilio-demoleus-flickr-audit.campaign.json"),
    )
    parser.add_argument("--workers", type=int, default=8)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    api_key = os.environ.get("FLICKR_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("FLICKR_API_KEY is required.")
    repo_root = args.repo_root.resolve()
    biominer_root = args.biominer_root.resolve()
    output = args.output
    if not output.is_absolute():
        output = repo_root / output
    packet = build_packet(repo_root, biominer_root, api_key, args.workers)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(packet, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "output": str(output),
                "campaignId": packet["campaign"]["campaignId"],
                "selectedRecordCount": len(packet["items"]),
                "manifestSha256": packet["campaign"]["manifestSha256"],
            },
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
