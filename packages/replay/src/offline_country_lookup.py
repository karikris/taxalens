"""Deterministic point-to-country lookup over the bundled offline boundaries."""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_COUNTRY_BOUNDARIES = (
    REPOSITORY_ROOT / "demo/source/geography/natural_earth_110m_countries.geojson"
)
EXPECTED_SCHEMA_VERSION = "taxalens-offline-country-boundaries:v1.0.0"


class OfflineCountryLookupError(ValueError):
    """Raised when an offline scope assignment cannot be trusted."""


@dataclass(frozen=True, slots=True)
class CountryScope:
    """One cartographic country scope, not a biological occurrence assertion."""

    country_code: str
    country: str
    continent: str


@dataclass(frozen=True, slots=True)
class _BoundaryFeature:
    feature_id: str
    scope: CountryScope
    bbox: tuple[float, float, float, float]
    polygons: tuple[tuple[tuple[tuple[float, float], ...], ...], ...]


class OfflineCountryLookup:
    """Assign representative points only when one selectable polygon contains them."""

    def __init__(self, features: tuple[_BoundaryFeature, ...]) -> None:
        if not features:
            raise OfflineCountryLookupError("country boundary lookup is empty")
        self._features = features

    @classmethod
    def from_path(cls, path: str | Path = DEFAULT_COUNTRY_BOUNDARIES) -> OfflineCountryLookup:
        try:
            payload = json.loads(Path(path).read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
            raise OfflineCountryLookupError("country boundaries are unreadable") from error
        if not isinstance(payload, dict):
            raise OfflineCountryLookupError("country boundaries must be an object")
        if payload.get("taxalens_schema_version") != EXPECTED_SCHEMA_VERSION:
            raise OfflineCountryLookupError("country boundary schema differs")
        raw_features = payload.get("features")
        if not isinstance(raw_features, list):
            raise OfflineCountryLookupError("country boundary features must be an array")
        features = tuple(
            feature
            for index, raw in enumerate(raw_features)
            if (feature := _parse_feature(raw, index)) is not None
        )
        return cls(features)

    def assign(self, *, latitude: float, longitude: float) -> CountryScope | None:
        """Return one unambiguous selectable country containing the point."""

        _coordinate(latitude, -90, 90, "latitude")
        _coordinate(longitude, -180, 180, "longitude")
        matches = {
            feature.scope
            for feature in self._features
            if _bbox_contains(feature.bbox, longitude, latitude)
            and _multipolygon_contains(feature.polygons, longitude, latitude)
        }
        return next(iter(matches)) if len(matches) == 1 else None


def _parse_feature(raw: object, index: int) -> _BoundaryFeature | None:
    if not isinstance(raw, dict):
        raise OfflineCountryLookupError(f"country feature {index} must be an object")
    properties = raw.get("properties")
    if not isinstance(properties, dict):
        raise OfflineCountryLookupError(f"country feature {index} properties differ")
    if properties.get("selectable_country") is not True:
        return None
    scope = CountryScope(
        country_code=_required_text(properties.get("country_code"), "country_code"),
        country=_required_text(properties.get("name"), "country"),
        continent=_required_text(properties.get("continent"), "continent"),
    )
    bbox = _bbox(raw.get("bbox"), index)
    geometry = raw.get("geometry")
    if not isinstance(geometry, dict):
        raise OfflineCountryLookupError(f"country feature {index} geometry differs")
    geometry_type = geometry.get("type")
    coordinates = geometry.get("coordinates")
    if geometry_type == "Polygon":
        polygons = (_polygon(coordinates, index),)
    elif geometry_type == "MultiPolygon":
        if not isinstance(coordinates, list) or not coordinates:
            raise OfflineCountryLookupError(f"country feature {index} multipolygon differs")
        polygons = tuple(_polygon(value, index) for value in coordinates)
    else:
        raise OfflineCountryLookupError(f"country feature {index} type differs")
    return _BoundaryFeature(
        feature_id=_required_text(raw.get("id"), "feature id"),
        scope=scope,
        bbox=bbox,
        polygons=polygons,
    )


def _polygon(value: object, feature_index: int) -> tuple[tuple[tuple[float, float], ...], ...]:
    if not isinstance(value, list) or not value:
        raise OfflineCountryLookupError(f"country feature {feature_index} polygon differs")
    rings = []
    for raw_ring in value:
        if not isinstance(raw_ring, list) or len(raw_ring) < 4:
            raise OfflineCountryLookupError(f"country feature {feature_index} ring differs")
        ring = tuple(_position(position, feature_index) for position in raw_ring)
        if ring[0] != ring[-1]:
            raise OfflineCountryLookupError(f"country feature {feature_index} ring is open")
        rings.append(ring)
    return tuple(rings)


def _position(value: object, feature_index: int) -> tuple[float, float]:
    if not isinstance(value, list) or len(value) < 2:
        raise OfflineCountryLookupError(f"country feature {feature_index} position differs")
    longitude = float(value[0])
    latitude = float(value[1])
    _coordinate(latitude, -90, 90, "boundary latitude")
    _coordinate(longitude, -180, 180, "boundary longitude")
    return longitude, latitude


def _bbox(value: object, feature_index: int) -> tuple[float, float, float, float]:
    if not isinstance(value, list) or len(value) != 4:
        raise OfflineCountryLookupError(f"country feature {feature_index} bbox differs")
    bounds = tuple(float(item) for item in value)
    if not all(math.isfinite(item) for item in bounds):
        raise OfflineCountryLookupError(f"country feature {feature_index} bbox is non-finite")
    if bounds[0] > bounds[2] or bounds[1] > bounds[3]:
        raise OfflineCountryLookupError(f"country feature {feature_index} bbox is inverted")
    return bounds  # type: ignore[return-value]


def _bbox_contains(
    bbox: tuple[float, float, float, float], longitude: float, latitude: float
) -> bool:
    return bbox[0] <= longitude <= bbox[2] and bbox[1] <= latitude <= bbox[3]


def _multipolygon_contains(
    polygons: tuple[tuple[tuple[tuple[float, float], ...], ...], ...],
    longitude: float,
    latitude: float,
) -> bool:
    return any(_polygon_contains(polygon, longitude, latitude) for polygon in polygons)


def _polygon_contains(
    polygon: tuple[tuple[tuple[float, float], ...], ...],
    longitude: float,
    latitude: float,
) -> bool:
    outer = _ring_location(polygon[0], longitude, latitude)
    if outer == 0:
        return False
    if outer == 2:
        return True
    return not any(_ring_location(ring, longitude, latitude) != 0 for ring in polygon[1:])


def _ring_location(ring: tuple[tuple[float, float], ...], longitude: float, latitude: float) -> int:
    """Return 0 outside, 1 inside, or 2 on the boundary using ray casting."""

    inside = False
    for start, end in zip(ring[:-1], ring[1:], strict=True):
        if _point_on_segment(longitude, latitude, start, end):
            return 2
        x1, y1 = start
        x2, y2 = end
        if (y1 > latitude) != (y2 > latitude):
            intersection = (x2 - x1) * (latitude - y1) / (y2 - y1) + x1
            if longitude < intersection:
                inside = not inside
    return 1 if inside else 0


def _point_on_segment(
    longitude: float,
    latitude: float,
    start: tuple[float, float],
    end: tuple[float, float],
) -> bool:
    x1, y1 = start
    x2, y2 = end
    cross = (longitude - x1) * (y2 - y1) - (latitude - y1) * (x2 - x1)
    tolerance = 1e-12 * max(1.0, abs(x2 - x1), abs(y2 - y1))
    if abs(cross) > tolerance:
        return False
    return (
        min(x1, x2) - tolerance <= longitude <= max(x1, x2) + tolerance
        and min(y1, y2) - tolerance <= latitude <= max(y1, y2) + tolerance
    )


def _coordinate(value: float, minimum: float, maximum: float, label: str) -> None:
    if not isinstance(value, int | float) or not math.isfinite(value):
        raise OfflineCountryLookupError(f"{label} must be finite")
    if not minimum <= value <= maximum:
        raise OfflineCountryLookupError(f"{label} is outside its domain")


def _required_text(value: object, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise OfflineCountryLookupError(f"{label} must be non-empty")
    return value


__all__ = [
    "CountryScope",
    "DEFAULT_COUNTRY_BOUNDARIES",
    "EXPECTED_SCHEMA_VERSION",
    "OfflineCountryLookup",
    "OfflineCountryLookupError",
]
