from __future__ import annotations

import hashlib
import json
import shutil
import socket
from pathlib import Path
from typing import Any

import pytest
from packages.replay.src.geographic_boundaries import (
    DEFAULT_OUTPUT_ROOT,
    SOURCE_BYTE_COUNT,
    SOURCE_FEATURE_COUNT,
    SOURCE_SHA256,
    canonical_json_bytes,
)
from packages.replay.src.geographic_boundary_verifier import (
    GeographicBoundaryVerificationError,
    verify_geographic_boundaries,
)


def test_committed_boundary_publication_is_exact_self_contained_and_connected() -> None:
    report = verify_geographic_boundaries()

    assert report == {
        "manifest_id": "geographic-boundaries:natural-earth-v5.1.2-110m",
        "source_sha256": SOURCE_SHA256,
        "source_byte_count": SOURCE_BYTE_COUNT,
        "boundary_feature_count": SOURCE_FEATURE_COUNT,
        "selectable_country_count": 175,
        "boundary_only_feature_count": 2,
        "continent_count": 7,
        "hierarchy_node_count": 183,
        "admin1_count": 0,
        "runtime_byte_count": 508277,
        "geometry_validation": "rfc7946_structure_closed_rings_domains_and_bbox",
        "rights_status": "public_domain_verified",
        "external_runtime_requests_allowed": False,
    }


def test_verifier_performs_no_network_access(monkeypatch: pytest.MonkeyPatch) -> None:
    def fail_network(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("network access is forbidden")

    monkeypatch.setattr(socket, "socket", fail_network)
    assert verify_geographic_boundaries()["external_runtime_requests_allowed"] is False


@pytest.mark.parametrize(
    ("relative_path", "mutate", "message"),
    [
        (
            "natural_earth_110m_countries.geojson",
            lambda value: value["features"][0].__setitem__("id", "ne:changed"),
            "byte count|checksum",
        ),
        (
            "country_hierarchy.json",
            lambda value: value["nodes"][1].__setitem__("parent_scope_id", "missing"),
            "byte count|checksum",
        ),
        (
            "natural_earth_110m_iso_country_mapping.json",
            lambda value: value["countries"][1].__setitem__(
                "country_code", value["countries"][0]["country_code"]
            ),
            "byte count|checksum",
        ),
        (
            "natural_earth_attribution.json",
            lambda value: value.__setitem__("attribution_required", True),
            "byte count|checksum",
        ),
    ],
)
def test_changed_publication_artifacts_fail_closed(
    tmp_path: Path,
    relative_path: str,
    mutate: Any,
    message: str,
) -> None:
    root = _copy_publication(tmp_path)
    path = root / relative_path
    value = json.loads(path.read_text(encoding="utf-8"))
    mutate(value)
    path.write_bytes(canonical_json_bytes(value))

    with pytest.raises(GeographicBoundaryVerificationError, match=message):
        verify_geographic_boundaries(root)


def test_changed_source_bytes_fail_closed(tmp_path: Path) -> None:
    root = _copy_publication(tmp_path)
    path = root / "natural_earth_110m_admin_0_countries.source.geojson"
    path.write_bytes(path.read_bytes() + b" ")

    with pytest.raises(GeographicBoundaryVerificationError, match="byte count"):
        verify_geographic_boundaries(root)


def test_open_ring_is_rejected_even_with_reconciled_manifest_checksum(tmp_path: Path) -> None:
    root = _copy_publication(tmp_path)
    boundary_path = root / "natural_earth_110m_countries.geojson"
    boundaries = json.loads(boundary_path.read_text(encoding="utf-8"))
    feature = boundaries["features"][0]
    coordinates = feature["geometry"]["coordinates"]
    ring = coordinates[0] if feature["geometry"]["type"] == "Polygon" else coordinates[0][0]
    ring[-1] = [ring[-1][0] + 0.001, ring[-1][1]]
    boundary_bytes = (
        json.dumps(
            boundaries,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode()
        + b"\n"
    )
    boundary_path.write_bytes(boundary_bytes)
    _update_manifest_artifact(root, "country_boundaries", boundary_bytes)

    with pytest.raises(
        GeographicBoundaryVerificationError,
        match="boundary ring is not closed",
    ):
        verify_geographic_boundaries(root)


def test_manifest_cannot_enable_external_runtime_access(tmp_path: Path) -> None:
    root = _copy_publication(tmp_path)
    path = root / "geographic_boundaries_manifest.json"
    manifest = json.loads(path.read_text(encoding="utf-8"))
    manifest["runtime_policy"]["external_requests_allowed"] = True
    path.write_bytes(canonical_json_bytes(manifest))

    with pytest.raises(
        GeographicBoundaryVerificationError,
        match="runtime policy permits external access",
    ):
        verify_geographic_boundaries(root)


def test_source_identity_is_content_addressed() -> None:
    source = DEFAULT_OUTPUT_ROOT / "natural_earth_110m_admin_0_countries.source.geojson"
    content = source.read_bytes()
    assert len(content) == SOURCE_BYTE_COUNT
    assert hashlib.sha256(content).hexdigest() == SOURCE_SHA256


def _copy_publication(tmp_path: Path) -> Path:
    root = tmp_path / "geography"
    shutil.copytree(DEFAULT_OUTPUT_ROOT, root)
    return root


def _update_manifest_artifact(root: Path, logical_name: str, content: bytes) -> None:
    path = root / "geographic_boundaries_manifest.json"
    manifest = json.loads(path.read_text(encoding="utf-8"))
    artifact = next(
        artifact for artifact in manifest["artifacts"] if artifact["logical_name"] == logical_name
    )
    artifact["byte_count"] = len(content)
    artifact["sha256"] = hashlib.sha256(content).hexdigest()
    path.write_bytes(canonical_json_bytes(manifest))
