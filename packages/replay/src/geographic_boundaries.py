"""Build self-contained Natural Earth country boundaries and navigation metadata."""

from __future__ import annotations

import hashlib
import json
import math
import re
from collections.abc import Iterable, Mapping, Sequence
from pathlib import Path
from typing import Any

from taxalens.product.geographic_contracts import CountryHierarchyDocument

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_OUTPUT_ROOT = REPOSITORY_ROOT / "demo/source/geography"
DEFAULT_SOURCE = DEFAULT_OUTPUT_ROOT / "natural_earth_110m_admin_0_countries.source.geojson"
DEFAULT_COUNTRIES = DEFAULT_OUTPUT_ROOT / "natural_earth_110m_countries.geojson"
DEFAULT_ISO_MAPPING = DEFAULT_OUTPUT_ROOT / "natural_earth_110m_iso_country_mapping.json"
DEFAULT_HIERARCHY = DEFAULT_OUTPUT_ROOT / "country_hierarchy.json"
DEFAULT_ATTRIBUTION = DEFAULT_OUTPUT_ROOT / "natural_earth_attribution.json"
DEFAULT_MANIFEST = DEFAULT_OUTPUT_ROOT / "geographic_boundaries_manifest.json"

SOURCE_REPOSITORY = "nvkelso/natural-earth-vector"
SOURCE_COMMIT = "f1890d9f152c896d250a77557a5751a93d494776"
SOURCE_RELEASE = "v5.1.2"
SOURCE_PATH = "geojson/ne_110m_admin_0_countries.geojson"
SOURCE_SHA256 = "6866c877d39cba9c357620878839b336d569f8c662d3cfab4cb1dbe2d39c977f"
SOURCE_BYTE_COUNT = 838_726
SOURCE_FEATURE_COUNT = 177
DATASET_ID = "natural-earth:admin-0-countries-110m"
DATASET_VERSION = f"{SOURCE_RELEASE}+{SOURCE_COMMIT[:8]}"
COUNTRY_HIERARCHY_ID = "country-hierarchy:natural-earth-v5.1.2-110m"
CREATED_AT = "2026-07-17T11:04:00Z"

SOURCE_URL = f"https://github.com/nvkelso/natural-earth-vector/blob/{SOURCE_COMMIT}/{SOURCE_PATH}"
TERMS_URL = "https://www.naturalearthdata.com/about/terms-of-use/"
ATTRIBUTION_TEXT = (
    "Made with Natural Earth. Free vector and raster map data @ naturalearthdata.com."
)

SOURCE_SCHEMA_VERSION = "natural-earth-geojson:v5.1.2"
BOUNDARY_SCHEMA_VERSION = "taxalens-offline-country-boundaries:v1.0.0"
ISO_MAPPING_SCHEMA_VERSION = "taxalens-offline-country-mapping:v1.0.0"
ATTRIBUTION_SCHEMA_VERSION = "taxalens-boundary-attribution:v1.0.0"
MANIFEST_SCHEMA_VERSION = "taxalens-geographic-boundaries-manifest:v1.0.0"

CONTINENTS = (
    "Africa",
    "Antarctica",
    "Asia",
    "Europe",
    "North America",
    "Oceania",
    "South America",
)
SOURCE_CONTINENT_OVERRIDE = {
    "Seven seas (open ocean)": {
        "required_region_un": "Africa",
        "normalized_continent": "Africa",
        "reason": (
            "TaxaLens exposes seven continent scopes; for French Southern and Antarctic "
            "Lands the source CONTINENT is Seven seas (open ocean), so its own REGION_UN "
            "value supplies the selectable hierarchy parent."
        ),
    }
}

_ISO_ALPHA2 = re.compile(r"^[A-Z]{2}$")


class GeographicBoundaryError(ValueError):
    """Raised when source or derived boundary evidence fails closed."""


def canonical_json_bytes(value: object) -> bytes:
    """Return repository-standard deterministic JSON bytes."""

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


def canonical_geojson_bytes(value: object) -> bytes:
    """Return compact deterministic GeoJSON bytes for the browser boundary asset."""

    return (
        json.dumps(
            value,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        )
        + "\n"
    ).encode("utf-8")


def sha256_bytes(value: bytes) -> str:
    """Return one lowercase SHA-256 digest."""

    return hashlib.sha256(value).hexdigest()


def build_geographic_boundaries(source_bytes: bytes) -> dict[str, bytes]:
    """Validate exact source bytes and materialize all deterministic outputs."""

    source = _load_source(source_bytes)
    normalized, countries, boundary_only = _normalize_features(source)
    hierarchy = _build_hierarchy(normalized, countries)
    CountryHierarchyDocument.from_mapping(hierarchy)
    iso_mapping = _build_iso_mapping(countries, boundary_only)
    attribution = _build_attribution()

    payloads = {
        "source_geojson": source_bytes,
        "country_boundaries": canonical_geojson_bytes(normalized),
        "iso_country_mapping": canonical_json_bytes(iso_mapping),
        "country_hierarchy": canonical_json_bytes(hierarchy),
        "attribution": canonical_json_bytes(attribution),
    }
    manifest = _build_manifest(payloads, normalized, hierarchy, iso_mapping)
    payloads["manifest"] = canonical_json_bytes(manifest)
    return payloads


def write_geographic_boundaries(
    source_path: str | Path,
    *,
    output_root: str | Path = DEFAULT_OUTPUT_ROOT,
    check: bool = False,
) -> dict[str, Any]:
    """Write or verify the complete local boundary publication."""

    source_bytes = Path(source_path).read_bytes()
    payloads = build_geographic_boundaries(source_bytes)
    root = Path(output_root)
    destinations = _destinations(root)

    if check:
        failures = []
        for logical_name, expected in payloads.items():
            destination = destinations[logical_name]
            if not destination.is_file():
                failures.append(f"missing {destination}")
            elif destination.read_bytes() != expected:
                failures.append(f"changed {destination}")
        if failures:
            raise GeographicBoundaryError("; ".join(failures))
    else:
        root.mkdir(parents=True, exist_ok=True)
        for logical_name, content in payloads.items():
            destinations[logical_name].write_bytes(content)

    return json.loads(payloads["manifest"])


def _destinations(root: Path) -> dict[str, Path]:
    return {
        "source_geojson": root / DEFAULT_SOURCE.name,
        "country_boundaries": root / DEFAULT_COUNTRIES.name,
        "iso_country_mapping": root / DEFAULT_ISO_MAPPING.name,
        "country_hierarchy": root / DEFAULT_HIERARCHY.name,
        "attribution": root / DEFAULT_ATTRIBUTION.name,
        "manifest": root / DEFAULT_MANIFEST.name,
    }


def _load_source(source_bytes: bytes) -> dict[str, Any]:
    if len(source_bytes) != SOURCE_BYTE_COUNT:
        raise GeographicBoundaryError("Natural Earth source byte count differs")
    if sha256_bytes(source_bytes) != SOURCE_SHA256:
        raise GeographicBoundaryError("Natural Earth source checksum differs")
    try:
        value = json.loads(source_bytes)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise GeographicBoundaryError(
            f"Natural Earth source is not strict JSON: {error}"
        ) from error
    if not isinstance(value, dict) or value.get("type") != "FeatureCollection":
        raise GeographicBoundaryError("Natural Earth source is not a FeatureCollection")
    features = value.get("features")
    if not isinstance(features, list) or len(features) != SOURCE_FEATURE_COUNT:
        raise GeographicBoundaryError("Natural Earth source feature count differs")
    return value


def _normalize_features(
    source: Mapping[str, Any],
) -> tuple[dict[str, Any], list[dict[str, Any]], list[dict[str, Any]]]:
    normalized_features: list[dict[str, Any]] = []
    selectable_countries: list[dict[str, Any]] = []
    boundary_only: list[dict[str, Any]] = []
    seen_feature_ids: set[str] = set()
    seen_country_codes: set[str] = set()

    raw_features = source["features"]
    assert isinstance(raw_features, list)
    for index, raw_feature in enumerate(raw_features):
        if not isinstance(raw_feature, dict) or raw_feature.get("type") != "Feature":
            raise GeographicBoundaryError(f"Natural Earth feature {index} is invalid")
        properties = _mapping(raw_feature.get("properties"), f"feature {index} properties")
        geometry = _mapping(raw_feature.get("geometry"), f"feature {index} geometry")
        geometry_type = geometry.get("type")
        if geometry_type not in {"Polygon", "MultiPolygon"}:
            raise GeographicBoundaryError(f"feature {index} geometry type is unsupported")
        _validate_coordinates(geometry.get("coordinates"), f"feature {index}")

        ne_id = _required_int(properties.get("NE_ID"), f"feature {index} NE_ID")
        feature_id = f"ne:{ne_id}"
        if feature_id in seen_feature_ids:
            raise GeographicBoundaryError(f"duplicate feature ID {feature_id}")
        seen_feature_ids.add(feature_id)

        source_continent = _required_string(
            properties.get("CONTINENT"), f"feature {index} CONTINENT"
        )
        continent, override_applied = _normalize_continent(source_continent, properties)
        country_code = _country_code(properties.get("ISO_A2_EH"))
        if country_code is not None:
            if country_code in seen_country_codes:
                raise GeographicBoundaryError(f"duplicate ISO alpha-2 code {country_code}")
            seen_country_codes.add(country_code)

        name = _required_string(
            properties.get("NAME_EN") or properties.get("ADMIN"),
            f"feature {index} name",
        )
        admin = _required_string(properties.get("ADMIN"), f"feature {index} ADMIN")
        bbox = _bounds(raw_feature.get("bbox"), f"feature {index} bbox")
        label_longitude = _finite_coordinate(
            properties.get("LABEL_X"), -180, 180, f"feature {index} LABEL_X"
        )
        label_latitude = _finite_coordinate(
            properties.get("LABEL_Y"), -90, 90, f"feature {index} LABEL_Y"
        )
        normalized_properties = {
            "feature_id": feature_id,
            "natural_earth_id": str(ne_id),
            "name": name,
            "name_long": properties.get("NAME_LONG") or name,
            "admin_name": admin,
            "sovereign_name": properties.get("SOVEREIGNT"),
            "boundary_type": properties.get("TYPE"),
            "country_code": country_code,
            "iso_a3": _optional_code(properties.get("ISO_A3_EH"), 3),
            "selectable_country": country_code is not None,
            "continent": continent,
            "source_continent": source_continent,
            "source_region_un": properties.get("REGION_UN"),
            "source_subregion": properties.get("SUBREGION"),
            "continent_override_applied": override_applied,
            "label_longitude": label_longitude,
            "label_latitude": label_latitude,
            "boundary_note": properties.get("NOTE_ADM0") or properties.get("NOTE_BRK"),
            "source_feature_class": properties.get("featurecla"),
        }
        normalized_feature = {
            "type": "Feature",
            "id": feature_id,
            "bbox": list(bbox),
            "properties": normalized_properties,
            "geometry": geometry,
        }
        normalized_features.append(normalized_feature)

        summary = {
            **normalized_properties,
            "bounds": list(bbox),
            "geometry_feature_id": feature_id,
        }
        if country_code is None:
            boundary_only.append(summary)
        else:
            selectable_countries.append(summary)

    normalized_features.sort(key=lambda item: str(item["id"]))
    selectable_countries.sort(key=lambda item: str(item["country_code"]))
    boundary_only.sort(key=lambda item: str(item["feature_id"]))
    normalized = {
        "type": "FeatureCollection",
        "bbox": [-180.0, -90.0, 180.0, 83.64513],
        "taxalens_schema_version": BOUNDARY_SCHEMA_VERSION,
        "dataset_id": DATASET_ID,
        "dataset_version": DATASET_VERSION,
        "source": {
            "repository": SOURCE_REPOSITORY,
            "commit": SOURCE_COMMIT,
            "release": SOURCE_RELEASE,
            "path": SOURCE_PATH,
            "sha256": SOURCE_SHA256,
        },
        "intended_use": "low_resolution_display_navigation_only",
        "scientific_claim_allowed": False,
        "features": normalized_features,
    }
    return normalized, selectable_countries, boundary_only


def _build_hierarchy(
    normalized: Mapping[str, Any], countries: Sequence[Mapping[str, Any]]
) -> dict[str, Any]:
    raw_features = normalized["features"]
    assert isinstance(raw_features, list)
    bounds_by_continent: dict[str, list[tuple[float, float, float, float]]] = {
        continent: [] for continent in CONTINENTS
    }
    labels_by_continent: dict[str, list[tuple[float, float]]] = {
        continent: [] for continent in CONTINENTS
    }
    for feature in raw_features:
        properties = feature["properties"]
        continent = properties["continent"]
        bounds_by_continent[continent].append(tuple(feature["bbox"]))
        labels_by_continent[continent].append(
            (properties["label_longitude"], properties["label_latitude"])
        )

    nodes: list[dict[str, Any]] = [
        {
            "scope_level": "global",
            "scope_id": "global",
            "scope_name": "Global",
            "parent_scope_id": None,
            "continent": None,
            "country_code": None,
            "country": None,
            "admin1_code": None,
            "admin1": None,
            "geometry_feature_id": None,
            "centroid_latitude": 0.0,
            "centroid_longitude": 0.0,
            "bounds": [-180.0, -90.0, 180.0, 90.0],
            "sort_key": "00-global",
        }
    ]
    for continent_index, continent in enumerate(CONTINENTS, start=1):
        continent_bounds = _union_bounds(bounds_by_continent[continent], continent)
        centroid_longitude, centroid_latitude = _mean_label_point(
            labels_by_continent[continent], continent
        )
        nodes.append(
            {
                "scope_level": "continent",
                "scope_id": _continent_scope_id(continent),
                "scope_name": continent,
                "parent_scope_id": "global",
                "continent": continent,
                "country_code": None,
                "country": None,
                "admin1_code": None,
                "admin1": None,
                "geometry_feature_id": None,
                "centroid_latitude": centroid_latitude,
                "centroid_longitude": centroid_longitude,
                "bounds": list(continent_bounds),
                "sort_key": f"10-{continent_index:02d}-{continent}",
            }
        )

    for country in countries:
        continent = str(country["continent"])
        country_code = str(country["country_code"])
        country_name = str(country["name"])
        nodes.append(
            {
                "scope_level": "country",
                "scope_id": f"country:{country_code}",
                "scope_name": country_name,
                "parent_scope_id": _continent_scope_id(continent),
                "continent": continent,
                "country_code": country_code,
                "country": country_name,
                "admin1_code": None,
                "admin1": None,
                "geometry_feature_id": country["geometry_feature_id"],
                "centroid_latitude": country["label_latitude"],
                "centroid_longitude": country["label_longitude"],
                "bounds": country["bounds"],
                "sort_key": f"20-{continent}-{country_name}-{country_code}",
            }
        )

    return {
        "schema_version": "taxalens-country-hierarchy:v1.0.0",
        "country_hierarchy_id": COUNTRY_HIERARCHY_ID,
        "boundary_dataset_id": DATASET_ID,
        "boundary_dataset_version": DATASET_VERSION,
        "created_at": CREATED_AT,
        "root_scope_id": "global",
        "nodes": nodes,
    }


def _build_iso_mapping(
    countries: Sequence[Mapping[str, Any]], boundary_only: Sequence[Mapping[str, Any]]
) -> dict[str, Any]:
    return {
        "schema_version": ISO_MAPPING_SCHEMA_VERSION,
        "dataset_id": DATASET_ID,
        "dataset_version": DATASET_VERSION,
        "country_hierarchy_id": COUNTRY_HIERARCHY_ID,
        "country_count": len(countries),
        "boundary_only_feature_count": len(boundary_only),
        "countries": [
            {
                "country_code": country["country_code"],
                "country": country["name"],
                "continent": country["continent"],
                "scope_id": f"country:{country['country_code']}",
                "parent_scope_id": _continent_scope_id(str(country["continent"])),
                "geometry_feature_id": country["geometry_feature_id"],
                "natural_earth_id": country["natural_earth_id"],
                "iso_a3": country["iso_a3"],
            }
            for country in countries
        ],
        "boundary_only_features": [
            {
                "feature_id": item["feature_id"],
                "natural_earth_id": item["natural_earth_id"],
                "name": item["name"],
                "continent": item["continent"],
                "source_iso_a3": item["iso_a3"],
                "selectable_country": False,
                "reason": "source_has_no_resolved_iso_alpha2_identity",
            }
            for item in boundary_only
        ],
        "normalization_overrides": [
            {
                "source_continent": source_continent,
                **override,
            }
            for source_continent, override in SOURCE_CONTINENT_OVERRIDE.items()
        ],
        "scientific_claim_allowed": False,
    }


def _build_attribution() -> dict[str, Any]:
    return {
        "schema_version": ATTRIBUTION_SCHEMA_VERSION,
        "rights_id": "natural-earth-public-domain-boundaries",
        "dataset_id": DATASET_ID,
        "dataset_version": DATASET_VERSION,
        "source_repository": SOURCE_REPOSITORY,
        "source_commit": SOURCE_COMMIT,
        "source_release": SOURCE_RELEASE,
        "source_path": SOURCE_PATH,
        "source_url": SOURCE_URL,
        "terms_url": TERMS_URL,
        "license_name": "Public Domain",
        "license_uri": TERMS_URL,
        "redistribution_allowed": True,
        "modification_allowed": True,
        "commercial_use_allowed": True,
        "attribution_required": False,
        "display_text": ATTRIBUTION_TEXT,
        "use_scope": "offline low-resolution map display and navigation",
        "scientific_claim_allowed": False,
    }


def _build_manifest(
    payloads: Mapping[str, bytes],
    normalized: Mapping[str, Any],
    hierarchy: Mapping[str, Any],
    iso_mapping: Mapping[str, Any],
) -> dict[str, Any]:
    raw_features = normalized["features"]
    raw_nodes = hierarchy["nodes"]
    countries = iso_mapping["countries"]
    boundary_only = iso_mapping["boundary_only_features"]
    assert isinstance(raw_features, list)
    assert isinstance(raw_nodes, list)
    assert isinstance(countries, list)
    assert isinstance(boundary_only, list)
    destinations = _destinations(Path("demo/source/geography"))
    metadata = {
        "source_geojson": (SOURCE_SCHEMA_VERSION, SOURCE_FEATURE_COUNT),
        "country_boundaries": (BOUNDARY_SCHEMA_VERSION, len(raw_features)),
        "iso_country_mapping": (ISO_MAPPING_SCHEMA_VERSION, len(countries)),
        "country_hierarchy": ("taxalens-country-hierarchy:v1.0.0", len(raw_nodes)),
        "attribution": (ATTRIBUTION_SCHEMA_VERSION, 1),
    }
    artifacts = []
    for logical_name in (
        "source_geojson",
        "country_boundaries",
        "iso_country_mapping",
        "country_hierarchy",
        "attribution",
    ):
        content = payloads[logical_name]
        schema_version, record_count = metadata[logical_name]
        artifacts.append(
            {
                "logical_name": logical_name,
                "path": destinations[logical_name].as_posix(),
                "media_type": "application/geo+json"
                if logical_name in {"source_geojson", "country_boundaries"}
                else "application/json",
                "schema_version": schema_version,
                "sha256": sha256_bytes(content),
                "byte_count": len(content),
                "record_count": record_count,
            }
        )
    return {
        "schema_version": MANIFEST_SCHEMA_VERSION,
        "manifest_id": "geographic-boundaries:natural-earth-v5.1.2-110m",
        "created_at": CREATED_AT,
        "dataset_id": DATASET_ID,
        "dataset_version": DATASET_VERSION,
        "country_hierarchy_id": COUNTRY_HIERARCHY_ID,
        "source": {
            "repository": SOURCE_REPOSITORY,
            "commit": SOURCE_COMMIT,
            "release": SOURCE_RELEASE,
            "path": SOURCE_PATH,
            "url": SOURCE_URL,
            "sha256": SOURCE_SHA256,
            "byte_count": SOURCE_BYTE_COUNT,
            "feature_count": SOURCE_FEATURE_COUNT,
        },
        "rights": {
            "rights_id": "natural-earth-public-domain-boundaries",
            "license_name": "Public Domain",
            "license_uri": TERMS_URL,
            "redistribution_allowed": True,
            "attribution_required": False,
            "voluntary_attribution": ATTRIBUTION_TEXT,
        },
        "counts": {
            "boundary_feature_count": len(raw_features),
            "selectable_country_count": len(countries),
            "boundary_only_feature_count": len(boundary_only),
            "continent_count": len(CONTINENTS),
            "hierarchy_node_count": len(raw_nodes),
            "admin1_count": 0,
        },
        "normalization_policy": {
            "geometry_changed": False,
            "coordinate_precision_changed": False,
            "source_features_dropped": False,
            "invalid_iso_alpha2_invented": False,
            "record_country_inference_performed": False,
            "continent_override_count": sum(
                feature["properties"]["continent_override_applied"] for feature in raw_features
            ),
            "continent_overrides": [
                {"source_continent": key, **value}
                for key, value in SOURCE_CONTINENT_OVERRIDE.items()
            ],
            "boundary_only_policy": "visible_not_selectable",
            "centroid_policy": (
                "Natural Earth label point for countries; mean label point for continents"
            ),
            "bounds_policy": (
                "Natural Earth feature bbox; union of child feature bboxes for continents"
            ),
        },
        "artifacts": artifacts,
        "runtime_policy": {
            "external_requests_allowed": False,
            "external_tiles_allowed": False,
            "external_fonts_allowed": False,
            "external_sprites_allowed": False,
            "analytics_or_telemetry_allowed": False,
        },
        "intended_use": "low_resolution_display_navigation_only",
        "scientific_claim_allowed": False,
        "manifest_path": (Path("demo/source/geography") / DEFAULT_MANIFEST.name).as_posix(),
    }


def _normalize_continent(source_continent: str, properties: Mapping[str, Any]) -> tuple[str, bool]:
    if source_continent in CONTINENTS:
        return source_continent, False
    override = SOURCE_CONTINENT_OVERRIDE.get(source_continent)
    if override is None:
        raise GeographicBoundaryError(f"unsupported source continent {source_continent!r}")
    if properties.get("REGION_UN") != override["required_region_un"]:
        raise GeographicBoundaryError("source continent override precondition differs")
    return str(override["normalized_continent"]), True


def _country_code(value: object) -> str | None:
    if isinstance(value, str) and _ISO_ALPHA2.fullmatch(value):
        return value
    return None


def _optional_code(value: object, length: int) -> str | None:
    if isinstance(value, str) and len(value) == length and value.isalpha():
        return value.upper()
    return None


def _continent_scope_id(continent: str) -> str:
    return "continent:" + continent.lower().replace(" ", "-")


def _mapping(value: object, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise GeographicBoundaryError(f"{label} must be an object")
    return value


def _required_string(value: object, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise GeographicBoundaryError(f"{label} must be a non-empty string")
    return value


def _required_int(value: object, label: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise GeographicBoundaryError(f"{label} must be an integer")
    return value


def _finite_coordinate(value: object, minimum: float, maximum: float, label: str) -> float:
    if isinstance(value, bool) or not isinstance(value, int | float):
        raise GeographicBoundaryError(f"{label} must be numeric")
    number = float(value)
    if not math.isfinite(number) or not minimum <= number <= maximum:
        raise GeographicBoundaryError(f"{label} is outside its geographic domain")
    return number


def _bounds(value: object, label: str) -> tuple[float, float, float, float]:
    if not isinstance(value, list) or len(value) != 4:
        raise GeographicBoundaryError(f"{label} must have four values")
    west = _finite_coordinate(value[0], -180, 180, f"{label}[0]")
    south = _finite_coordinate(value[1], -90, 90, f"{label}[1]")
    east = _finite_coordinate(value[2], -180, 180, f"{label}[2]")
    north = _finite_coordinate(value[3], -90, 90, f"{label}[3]")
    if west > east or south > north:
        raise GeographicBoundaryError(f"{label} ordering is invalid")
    return west, south, east, north


def _validate_coordinates(value: object, label: str) -> None:
    point_count = 0
    for point in _coordinate_points(value, label):
        if len(point) < 2:
            raise GeographicBoundaryError(f"{label} coordinate has fewer than two values")
        _finite_coordinate(point[0], -180, 180, f"{label} longitude")
        _finite_coordinate(point[1], -90, 90, f"{label} latitude")
        point_count += 1
    if point_count == 0:
        raise GeographicBoundaryError(f"{label} contains no coordinates")


def _coordinate_points(value: object, label: str) -> Iterable[Sequence[object]]:
    if not isinstance(value, list) or not value:
        raise GeographicBoundaryError(f"{label} coordinates must be a non-empty array")
    first = value[0]
    if isinstance(first, int | float) and not isinstance(first, bool):
        yield value
        return
    for child in value:
        yield from _coordinate_points(child, label)


def _union_bounds(
    values: Sequence[tuple[float, float, float, float]], label: str
) -> tuple[float, float, float, float]:
    if not values:
        raise GeographicBoundaryError(f"continent {label} has no source features")
    return (
        min(value[0] for value in values),
        min(value[1] for value in values),
        max(value[2] for value in values),
        max(value[3] for value in values),
    )


def _mean_label_point(values: Sequence[tuple[float, float]], label: str) -> tuple[float, float]:
    if not values:
        raise GeographicBoundaryError(f"continent {label} has no label points")
    longitude = sum(value[0] for value in values) / len(values)
    latitude = sum(value[1] for value in values) / len(values)
    return round(longitude, 6), round(latitude, 6)


__all__ = [
    "ATTRIBUTION_TEXT",
    "CONTINENTS",
    "COUNTRY_HIERARCHY_ID",
    "DATASET_ID",
    "DEFAULT_ATTRIBUTION",
    "DEFAULT_COUNTRIES",
    "DEFAULT_HIERARCHY",
    "DEFAULT_ISO_MAPPING",
    "DEFAULT_MANIFEST",
    "DEFAULT_OUTPUT_ROOT",
    "DEFAULT_SOURCE",
    "GeographicBoundaryError",
    "SOURCE_BYTE_COUNT",
    "SOURCE_COMMIT",
    "SOURCE_FEATURE_COUNT",
    "SOURCE_RELEASE",
    "SOURCE_SHA256",
    "build_geographic_boundaries",
    "canonical_geojson_bytes",
    "canonical_json_bytes",
    "write_geographic_boundaries",
]
