from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest
from scripts.import_biominer_prototype_artifacts import (
    BIOMINER_COMMIT,
    DEFAULT_BIOMINER_ROOT,
    DEFAULT_MANIFEST,
    EXPECTED_SOURCE_PATHS,
    import_biominer_prototype_artifacts,
)


def _changed_manifest(tmp_path: Path, mutation: object) -> Path:
    payload = json.loads(DEFAULT_MANIFEST.read_text(encoding="utf-8"))
    assert callable(mutation)
    mutation(payload)
    path = tmp_path / "import_manifest.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def test_committed_prototype_import_matches_exact_git_objects() -> None:
    imported = import_biominer_prototype_artifacts(check=True)
    manifest = json.loads(DEFAULT_MANIFEST.read_text(encoding="utf-8"))

    assert len(imported) == 21
    assert tuple(sorted(row["source_path"] for row in manifest["artifacts"])) == (
        EXPECTED_SOURCE_PATHS
    )
    for destination, artifact in zip(imported, manifest["artifacts"], strict=True):
        committed = subprocess.run(
            ["git", "show", f"{BIOMINER_COMMIT}:{artifact['source_path']}"],
            cwd=DEFAULT_BIOMINER_ROOT,
            check=True,
            capture_output=True,
        ).stdout
        assert destination.read_bytes() == committed
        assert json.loads(committed)["schema_version"] == artifact["schema_version"]


def test_import_refuses_a_biominer_checkout_at_another_commit(tmp_path: Path) -> None:
    manifest = _changed_manifest(
        tmp_path,
        lambda payload: payload.update({"origin_commit": "0" * 40}),
    )

    with pytest.raises(ValueError, match="origin commit differs"):
        import_biominer_prototype_artifacts(manifest_path=manifest, check=True)


def test_import_refuses_source_discovery_outside_the_fixed_allowlist(
    tmp_path: Path,
) -> None:
    manifest = _changed_manifest(
        tmp_path,
        lambda payload: payload["artifacts"][0].update(
            {"source_path": "reports/phase15/unexpected.json"}
        ),
    )

    with pytest.raises(ValueError, match="source allowlist differs"):
        import_biominer_prototype_artifacts(manifest_path=manifest, check=True)


def test_import_refuses_a_digest_that_does_not_match_the_committed_blob(
    tmp_path: Path,
) -> None:
    manifest = _changed_manifest(
        tmp_path,
        lambda payload: payload["artifacts"][0].update({"sha256": "0" * 64}),
    )

    with pytest.raises(ValueError, match="checksum differs"):
        import_biominer_prototype_artifacts(manifest_path=manifest, check=True)


def test_import_policy_cannot_authorize_media_or_scientific_claims(
    tmp_path: Path,
) -> None:
    manifest = _changed_manifest(
        tmp_path,
        lambda payload: payload["import_policy"].update(
            {
                "reference_media_imported": True,
                "scientific_claim_allowed": True,
            }
        ),
    )

    with pytest.raises(ValueError, match="import policy differs"):
        import_biominer_prototype_artifacts(manifest_path=manifest, check=True)
