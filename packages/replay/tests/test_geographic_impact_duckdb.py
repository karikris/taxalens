from __future__ import annotations

import hashlib

import pytest
from scripts.verify_geographic_impact import (
    GeographicImpactVerificationError,
    _verify_artifact_fingerprints,
    verify_geographic_impact,
)


def test_duckdb_independently_reconciles_the_full_outer_join() -> None:
    result = verify_geographic_impact()

    assert result == {
        "impact_cell_count": 20_237,
        "baseline_projection_count": 57_603,
        "flickr_projection_count": 34_374,
        "baseline_only_cell_count": 693,
        "matched_cell_count": 183,
        "candidate_only_cell_count": 6_764,
        "flickr_photo_count": 13_501,
        "supported_flickr_photo_count": 13_416,
        "mismatch_count": 0,
        "manifest_id": "geographic-impact-manifest:e3c532a1c6310d2a0906cacc",
    }


def test_fingerprint_verifier_rejects_stale_artifact_bytes(tmp_path) -> None:
    artifact = tmp_path / "artifact.json"
    artifact.write_bytes(b"stale\n")
    manifest = {
        "artifacts": [
            {
                "availability": "available",
                "path": artifact.as_posix(),
                "byte_size": artifact.stat().st_size,
                "sha256": hashlib.sha256(b"expected\n").hexdigest(),
            }
        ]
    }

    with pytest.raises(GeographicImpactVerificationError, match="SHA-256"):
        _verify_artifact_fingerprints(manifest)
