from __future__ import annotations

import hashlib
import json
from pathlib import Path

from packages.replay.src.geographic_impact_manifest import (
    BIOMINER_BASELINE_COMMIT,
    BIOMINER_FLICKR_COMMIT,
)
from scripts.build_geographic_impact import OUTPUT_MANIFEST, build_outputs
from taxalens.product.geographic_contracts import GeographicImpactManifestDocument


def _manifest() -> dict[str, object]:
    value = json.loads(OUTPUT_MANIFEST.read_text(encoding="utf-8"))
    assert isinstance(value, dict)
    return value


def test_committed_manifest_validates_and_fingerprints_its_payload() -> None:
    manifest = _manifest()

    document = GeographicImpactManifestDocument.from_mapping(manifest)
    fingerprint_payload = {
        key: value
        for key, value in manifest.items()
        if key not in {"manifest_id", "deterministic_fingerprint_sha256"}
    }
    canonical = (
        json.dumps(
            fingerprint_payload,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        )
        + "\n"
    ).encode()
    expected = hashlib.sha256(canonical).hexdigest()

    assert document.to_dict() == manifest
    assert manifest["deterministic_fingerprint_sha256"] == expected
    assert manifest["manifest_id"] == f"geographic-impact-manifest:{expected[:24]}"


def test_committed_manifest_records_exact_provider_and_join_totals() -> None:
    manifest = _manifest()

    assert manifest["baseline_union_count"] == 19_201
    assert manifest["direct_inaturalist_delta_status"] == "unavailable"
    assert manifest["direct_inaturalist_delta_count"] is None
    assert manifest["flickr_candidate_count"] == 13_501
    assert manifest["geographically_supported_flickr_candidate_count"] == 13_416
    assert manifest["geographically_unsupported_flickr_candidate_count"] == 85
    assert manifest["pending_count"] == 13_501
    assert manifest["reviewed_positive_count"] == 0
    assert manifest["release_ready_count"] == 0
    assert manifest["impact_cell_count"] == 20_237
    assert manifest["baseline_only_cell_count"] == 693
    assert manifest["matched_cell_count"] == 183
    assert manifest["candidate_only_cell_count"] == 6_764
    assert manifest["reviewed_additional_cell_count"] == 0
    assert manifest["release_ready_additional_cell_count"] == 0
    assert manifest["unassigned_cartographic_cell_count"] == 2_160


def test_manifest_artifact_inventory_matches_repository_bytes() -> None:
    manifest = _manifest()
    artifacts = manifest["artifacts"]
    assert isinstance(artifacts, list)
    available = [entry for entry in artifacts if entry["availability"] == "available"]

    assert len(artifacts) == 9
    assert len(available) == 8
    for artifact in available:
        path = Path(str(artifact["path"]))
        content = path.read_bytes()
        assert artifact["byte_size"] == len(content)
        assert artifact["sha256"] == hashlib.sha256(content).hexdigest()
    quality = next(entry for entry in artifacts if entry["logical_name"] == "quality_snapshot")
    assert quality["availability"] == "unavailable"
    assert "No retained human outcomes" in str(quality["unavailable_reason"])


def test_manifest_records_both_exact_biominer_source_revisions() -> None:
    source_commits = {
        (entry["repository"], entry["commit_sha"])
        for entry in _manifest()["source_commits"]  # type: ignore[union-attr]
    }

    assert ("karikris/BioMiner", BIOMINER_BASELINE_COMMIT) in source_commits
    assert ("karikris/BioMiner", BIOMINER_FLICKR_COMMIT) in source_commits


def test_geographic_impact_build_outputs_are_byte_deterministic() -> None:
    expected = build_outputs()

    assert set(expected) >= {OUTPUT_MANIFEST}
    assert expected[OUTPUT_MANIFEST] == OUTPUT_MANIFEST.read_bytes()
