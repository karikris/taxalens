"""Fail-closed verifier for the bundled Natural Earth boundary publication."""

from __future__ import annotations

import hashlib
import json
import math
import re
from collections.abc import Mapping
from pathlib import Path, PurePosixPath
from typing import Any

from taxalens.product.geographic_contracts import CountryHierarchyDocument

from packages.replay.src.geographic_boundaries import (
    ATTRIBUTION_SCHEMA_VERSION,
    ATTRIBUTION_TEXT,
    BOUNDARY_SCHEMA_VERSION,
    CONTINENTS,
    DEFAULT_ATTRIBUTION,
    DEFAULT_COUNTRIES,
    DEFAULT_HIERARCHY,
    DEFAULT_ISO_MAPPING,
    DEFAULT_MANIFEST,
    DEFAULT_OUTPUT_ROOT,
    DEFAULT_SOURCE,
    ISO_MAPPING_SCHEMA_VERSION,
    MANIFEST_SCHEMA_VERSION,
    SOURCE_BYTE_COUNT,
    SOURCE_FEATURE_COUNT,
    SOURCE_SHA256,
    build_geographic_boundaries,
)

_ISO_ALPHA2 = re.compile(r"^[A-Z]{2}$")
_EXPECTED_FILES = {
    "source_geojson": DEFAULT_SOURCE.name,
    "country_boundaries": DEFAULT_COUNTRIES.name,
    "iso_country_mapping": DEFAULT_ISO_MAPPING.name,
    "country_hierarchy": DEFAULT_HIERARCHY.name,
    "attribution": DEFAULT_ATTRIBUTION.name,
}


class GeographicBoundaryVerificationError(ValueError):
    """Raised when the offline boundary publication fails verification."""


def verify_geographic_boundaries(
    root: str | Path = DEFAULT_OUTPUT_ROOT,
) -> dict[str, Any]:
    """Verify every byte, geometry, identity, hierarchy and rights invariant."""

    publication_root = Path(root)
    manifest = _load_json_object(publication_root / DEFAULT_MANIFEST.name, "manifest")
    if manifest.get("schema_version") != MANIFEST_SCHEMA_VERSION:
        raise GeographicBoundaryVerificationError("boundary manifest schema differs")

    artifact_bytes = _verify_artifact_inventory(publication_root, manifest)
    source_bytes = artifact_bytes["source_geojson"]
    expected = build_geographic_boundaries(source_bytes)
    boundaries = _loads_object(artifact_bytes["country_boundaries"], "country boundaries")
    hierarchy = _loads_object(artifact_bytes["country_hierarchy"], "country hierarchy")
    mapping = _loads_object(artifact_bytes["iso_country_mapping"], "ISO country mapping")
    attribution = _loads_object(artifact_bytes["attribution"], "boundary attribution")

    boundary_state = _verify_boundary_geojson(boundaries)
    hierarchy_state = _verify_hierarchy(hierarchy, boundary_state)
    _verify_iso_mapping(mapping, boundary_state, hierarchy_state)
    _verify_attribution(attribution)
    _verify_runtime_policy(manifest)

    for logical_name, content in expected.items():
        destination = (
            publication_root / DEFAULT_MANIFEST.name
            if logical_name == "manifest"
            else publication_root / _EXPECTED_FILES[logical_name]
        )
        if destination.read_bytes() != content:
            raise GeographicBoundaryVerificationError(
                f"deterministic boundary artifact differs: {logical_name}"
            )

    counts = _mapping(manifest.get("counts"), "manifest counts")
    expected_counts = {
        "boundary_feature_count": len(boundary_state["feature_ids"]),
        "selectable_country_count": len(boundary_state["countries"]),
        "boundary_only_feature_count": len(boundary_state["boundary_only_ids"]),
        "continent_count": len(hierarchy_state["continents"]),
        "hierarchy_node_count": hierarchy_state["node_count"],
        "admin1_count": hierarchy_state["admin1_count"],
    }
    if counts != expected_counts:
        raise GeographicBoundaryVerificationError("boundary manifest counts do not reconcile")

    runtime_logical_names = {
        "country_boundaries",
        "iso_country_mapping",
        "country_hierarchy",
        "attribution",
    }
    return {
        "manifest_id": manifest["manifest_id"],
        "source_sha256": hashlib.sha256(source_bytes).hexdigest(),
        "source_byte_count": len(source_bytes),
        **expected_counts,
        "runtime_byte_count": sum(
            len(content)
            for logical_name, content in artifact_bytes.items()
            if logical_name in runtime_logical_names
        ),
        "geometry_validation": "rfc7946_structure_closed_rings_domains_and_bbox",
        "rights_status": "public_domain_verified",
        "external_runtime_requests_allowed": False,
    }


def _verify_artifact_inventory(
    publication_root: Path, manifest: Mapping[str, Any]
) -> dict[str, bytes]:
    raw_artifacts = manifest.get("artifacts")
    if not isinstance(raw_artifacts, list):
        raise GeographicBoundaryVerificationError("manifest artifacts must be an array")
    artifacts: dict[str, bytes] = {}
    for index, raw_artifact in enumerate(raw_artifacts):
        artifact = _mapping(raw_artifact, f"manifest artifact {index}")
        logical_name = artifact.get("logical_name")
        if logical_name not in _EXPECTED_FILES or not isinstance(logical_name, str):
            raise GeographicBoundaryVerificationError("manifest has an unknown boundary artifact")
        if logical_name in artifacts:
            raise GeographicBoundaryVerificationError("manifest has a duplicate boundary artifact")
        declared_path = artifact.get("path")
        if not isinstance(declared_path, str):
            raise GeographicBoundaryVerificationError("boundary artifact path is missing")
        parsed = PurePosixPath(declared_path)
        if parsed.is_absolute() or any(part in {"", ".", ".."} for part in parsed.parts):
            raise GeographicBoundaryVerificationError("boundary artifact path is unsafe")
        if parsed.as_posix() != f"demo/source/geography/{_EXPECTED_FILES[logical_name]}":
            raise GeographicBoundaryVerificationError("boundary artifact path differs")
        path = publication_root / _EXPECTED_FILES[logical_name]
        if not path.is_file():
            raise GeographicBoundaryVerificationError(
                f"boundary artifact is missing: {logical_name}"
            )
        content = path.read_bytes()
        if artifact.get("byte_count") != len(content):
            raise GeographicBoundaryVerificationError("boundary artifact byte count differs")
        if artifact.get("sha256") != hashlib.sha256(content).hexdigest():
            raise GeographicBoundaryVerificationError("boundary artifact checksum differs")
        artifacts[logical_name] = content
    if set(artifacts) != set(_EXPECTED_FILES):
        raise GeographicBoundaryVerificationError("boundary artifact inventory is incomplete")
    if len(artifacts["source_geojson"]) != SOURCE_BYTE_COUNT:
        raise GeographicBoundaryVerificationError("source boundary byte count differs")
    if hashlib.sha256(artifacts["source_geojson"]).hexdigest() != SOURCE_SHA256:
        raise GeographicBoundaryVerificationError("source boundary checksum differs")
    return artifacts


def _verify_boundary_geojson(boundaries: Mapping[str, Any]) -> dict[str, Any]:
    if boundaries.get("type") != "FeatureCollection":
        raise GeographicBoundaryVerificationError("country boundaries are not GeoJSON")
    if boundaries.get("taxalens_schema_version") != BOUNDARY_SCHEMA_VERSION:
        raise GeographicBoundaryVerificationError("country boundary schema differs")
    raw_features = boundaries.get("features")
    if not isinstance(raw_features, list) or len(raw_features) != SOURCE_FEATURE_COUNT:
        raise GeographicBoundaryVerificationError("country boundary feature count differs")

    feature_ids: set[str] = set()
    boundary_only_ids: set[str] = set()
    countries: dict[str, dict[str, Any]] = {}
    for index, raw_feature in enumerate(raw_features):
        feature = _mapping(raw_feature, f"boundary feature {index}")
        if feature.get("type") != "Feature":
            raise GeographicBoundaryVerificationError("boundary member is not a Feature")
        feature_id = feature.get("id")
        if not isinstance(feature_id, str) or not feature_id.startswith("ne:"):
            raise GeographicBoundaryVerificationError("boundary feature ID is invalid")
        if feature_id in feature_ids:
            raise GeographicBoundaryVerificationError("boundary feature ID is duplicated")
        feature_ids.add(feature_id)
        properties = _mapping(feature.get("properties"), f"feature {feature_id} properties")
        if properties.get("feature_id") != feature_id:
            raise GeographicBoundaryVerificationError("boundary property feature ID differs")
        continent = properties.get("continent")
        if continent not in CONTINENTS:
            raise GeographicBoundaryVerificationError("boundary continent is unsupported")
        bounds = _bounds(feature.get("bbox"), f"feature {feature_id} bbox")
        geometry = _mapping(feature.get("geometry"), f"feature {feature_id} geometry")
        _verify_geometry(geometry, bounds, feature_id)

        country_code = properties.get("country_code")
        selectable = properties.get("selectable_country")
        if country_code is None:
            if selectable is not False:
                raise GeographicBoundaryVerificationError(
                    "boundary-only feature is incorrectly selectable"
                )
            boundary_only_ids.add(feature_id)
            continue
        if not isinstance(country_code, str) or not _ISO_ALPHA2.fullmatch(country_code):
            raise GeographicBoundaryVerificationError("selectable country code is invalid")
        if selectable is not True:
            raise GeographicBoundaryVerificationError("ISO country is not selectable")
        if country_code in countries:
            raise GeographicBoundaryVerificationError("country code is duplicated")
        countries[country_code] = properties

    if not boundary_only_ids:
        raise GeographicBoundaryVerificationError("boundary-only policy is not exercised")
    return {
        "feature_ids": feature_ids,
        "boundary_only_ids": boundary_only_ids,
        "countries": countries,
    }


def _verify_geometry(
    geometry: Mapping[str, Any],
    bounds: tuple[float, float, float, float],
    feature_id: str,
) -> None:
    geometry_type = geometry.get("type")
    coordinates = geometry.get("coordinates")
    if geometry_type == "Polygon":
        polygons = [coordinates]
    elif geometry_type == "MultiPolygon":
        polygons = coordinates
    else:
        raise GeographicBoundaryVerificationError("boundary geometry type is unsupported")
    if not isinstance(polygons, list) or not polygons:
        raise GeographicBoundaryVerificationError("boundary geometry has no polygons")
    for polygon in polygons:
        if not isinstance(polygon, list) or not polygon:
            raise GeographicBoundaryVerificationError("boundary polygon has no rings")
        for ring in polygon:
            if not isinstance(ring, list) or len(ring) < 4:
                raise GeographicBoundaryVerificationError("boundary ring is too short")
            if ring[0] != ring[-1]:
                raise GeographicBoundaryVerificationError("boundary ring is not closed")
            for position in ring:
                if not isinstance(position, list) or len(position) < 2:
                    raise GeographicBoundaryVerificationError("boundary position is invalid")
                longitude = _coordinate(position[0], -180, 180, "longitude")
                latitude = _coordinate(position[1], -90, 90, "latitude")
                tolerance = 1e-6
                if not bounds[0] - tolerance <= longitude <= bounds[2] + tolerance:
                    raise GeographicBoundaryVerificationError(
                        f"boundary longitude is outside feature bbox: {feature_id}"
                    )
                if not bounds[1] - tolerance <= latitude <= bounds[3] + tolerance:
                    raise GeographicBoundaryVerificationError(
                        f"boundary latitude is outside feature bbox: {feature_id}"
                    )


def _verify_hierarchy(
    hierarchy: Mapping[str, Any], boundary_state: Mapping[str, Any]
) -> dict[str, Any]:
    try:
        document = CountryHierarchyDocument.from_mapping(hierarchy)
    except ValueError as error:
        raise GeographicBoundaryVerificationError(
            f"country hierarchy contract failed: {error}"
        ) from error
    continents = {
        node.continent: node for node in document.nodes if node.scope_level == "continent"
    }
    if set(continents) != set(CONTINENTS):
        raise GeographicBoundaryVerificationError("country hierarchy continents differ")
    global_nodes = [node for node in document.nodes if node.scope_level == "global"]
    if len(global_nodes) != 1:
        raise GeographicBoundaryVerificationError("country hierarchy global root differs")

    boundary_countries = boundary_state["countries"]
    assert isinstance(boundary_countries, dict)
    country_nodes: dict[str, Any] = {}
    admin1_count = 0
    for node in document.nodes:
        if node.scope_level == "admin1":
            admin1_count += 1
        if node.scope_level != "country":
            continue
        country_code = node.country_code
        if country_code is None or country_code in country_nodes:
            raise GeographicBoundaryVerificationError("hierarchy country identity is duplicated")
        properties = boundary_countries.get(country_code)
        if not isinstance(properties, dict):
            raise GeographicBoundaryVerificationError("hierarchy country lacks geometry")
        expected_parent = "continent:" + str(properties["continent"]).lower().replace(" ", "-")
        if node.parent_scope_id != expected_parent:
            raise GeographicBoundaryVerificationError("hierarchy country parent differs")
        if node.continent != properties["continent"]:
            raise GeographicBoundaryVerificationError("hierarchy country continent differs")
        if node.geometry_feature_id != properties["feature_id"]:
            raise GeographicBoundaryVerificationError("hierarchy geometry feature differs")
        country_nodes[country_code] = node
    if set(country_nodes) != set(boundary_countries):
        raise GeographicBoundaryVerificationError("hierarchy country inventory differs")
    return {
        "continents": continents,
        "countries": country_nodes,
        "node_count": len(document.nodes),
        "admin1_count": admin1_count,
    }


def _verify_iso_mapping(
    mapping: Mapping[str, Any],
    boundary_state: Mapping[str, Any],
    hierarchy_state: Mapping[str, Any],
) -> None:
    if mapping.get("schema_version") != ISO_MAPPING_SCHEMA_VERSION:
        raise GeographicBoundaryVerificationError("ISO mapping schema differs")
    raw_countries = mapping.get("countries")
    raw_boundary_only = mapping.get("boundary_only_features")
    if not isinstance(raw_countries, list) or not isinstance(raw_boundary_only, list):
        raise GeographicBoundaryVerificationError("ISO mapping arrays are invalid")
    country_codes = []
    for raw_country in raw_countries:
        country = _mapping(raw_country, "ISO mapping country")
        code = country.get("country_code")
        if not isinstance(code, str):
            raise GeographicBoundaryVerificationError("ISO mapping country code is invalid")
        country_codes.append(code)
        boundary_country = boundary_state["countries"].get(code)
        hierarchy_country = hierarchy_state["countries"].get(code)
        if boundary_country is None or hierarchy_country is None:
            raise GeographicBoundaryVerificationError("ISO mapping country is unbound")
        if country.get("geometry_feature_id") != boundary_country["feature_id"]:
            raise GeographicBoundaryVerificationError("ISO mapping geometry feature differs")
        if country.get("scope_id") != hierarchy_country.scope_id:
            raise GeographicBoundaryVerificationError("ISO mapping scope differs")
    if len(country_codes) != len(set(country_codes)):
        raise GeographicBoundaryVerificationError("ISO mapping country code is duplicated")
    if set(country_codes) != set(boundary_state["countries"]):
        raise GeographicBoundaryVerificationError("ISO mapping country inventory differs")
    boundary_only_ids = {
        _mapping(item, "boundary-only mapping item").get("feature_id") for item in raw_boundary_only
    }
    if boundary_only_ids != boundary_state["boundary_only_ids"]:
        raise GeographicBoundaryVerificationError("boundary-only mapping inventory differs")
    if mapping.get("country_count") != len(country_codes):
        raise GeographicBoundaryVerificationError("ISO mapping country count differs")
    if mapping.get("boundary_only_feature_count") != len(boundary_only_ids):
        raise GeographicBoundaryVerificationError("boundary-only mapping count differs")


def _verify_attribution(attribution: Mapping[str, Any]) -> None:
    if attribution.get("schema_version") != ATTRIBUTION_SCHEMA_VERSION:
        raise GeographicBoundaryVerificationError("boundary attribution schema differs")
    expected = {
        "license_name": "Public Domain",
        "redistribution_allowed": True,
        "modification_allowed": True,
        "commercial_use_allowed": True,
        "attribution_required": False,
        "display_text": ATTRIBUTION_TEXT,
        "scientific_claim_allowed": False,
    }
    for key, value in expected.items():
        if attribution.get(key) != value:
            raise GeographicBoundaryVerificationError(f"boundary attribution {key} differs")


def _verify_runtime_policy(manifest: Mapping[str, Any]) -> None:
    policy = _mapping(manifest.get("runtime_policy"), "runtime policy")
    expected_false = {
        "external_requests_allowed",
        "external_tiles_allowed",
        "external_fonts_allowed",
        "external_sprites_allowed",
        "analytics_or_telemetry_allowed",
    }
    if set(policy) != expected_false or any(policy.get(key) is not False for key in expected_false):
        raise GeographicBoundaryVerificationError("boundary runtime policy permits external access")


def _load_json_object(path: Path, label: str) -> dict[str, Any]:
    if not path.is_file():
        raise GeographicBoundaryVerificationError(f"{label} is missing")
    return _loads_object(path.read_bytes(), label)


def _loads_object(content: bytes, label: str) -> dict[str, Any]:
    try:
        value = json.loads(content)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise GeographicBoundaryVerificationError(f"{label} is not strict JSON") from error
    if not isinstance(value, dict):
        raise GeographicBoundaryVerificationError(f"{label} must be an object")
    return value


def _mapping(value: object, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise GeographicBoundaryVerificationError(f"{label} must be an object")
    return value


def _bounds(value: object, label: str) -> tuple[float, float, float, float]:
    if not isinstance(value, list) or len(value) != 4:
        raise GeographicBoundaryVerificationError(f"{label} must contain four values")
    west = _coordinate(value[0], -180, 180, f"{label} west")
    south = _coordinate(value[1], -90, 90, f"{label} south")
    east = _coordinate(value[2], -180, 180, f"{label} east")
    north = _coordinate(value[3], -90, 90, f"{label} north")
    if west > east or south > north:
        raise GeographicBoundaryVerificationError(f"{label} ordering is invalid")
    return west, south, east, north


def _coordinate(value: object, minimum: float, maximum: float, label: str) -> float:
    if isinstance(value, bool) or not isinstance(value, int | float):
        raise GeographicBoundaryVerificationError(f"{label} is not numeric")
    number = float(value)
    if not math.isfinite(number) or not minimum <= number <= maximum:
        raise GeographicBoundaryVerificationError(f"{label} is outside its domain")
    return number


__all__ = [
    "GeographicBoundaryVerificationError",
    "verify_geographic_boundaries",
]
