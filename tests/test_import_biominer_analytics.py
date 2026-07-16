from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest
from scripts.import_biominer_analytics import (
    DEFAULT_BIOMINER_ROOT,
    DEFAULT_MANIFEST,
    import_biominer_analytics,
)


def test_committed_analytics_import_matches_pinned_biominer_bytes() -> None:
    imported = import_biominer_analytics(check=True)
    manifest = json.loads(DEFAULT_MANIFEST.read_text(encoding="utf-8"))

    assert len(imported) == 4
    for path, artifact in zip(imported, manifest["artifacts"], strict=True):
        assert path.stat().st_size == artifact["byte_count"]
        assert hashlib.sha256(path.read_bytes()).hexdigest() == artifact["sha256"]
        assert path.read_bytes()[:4] == b"PAR1"


def test_import_refuses_an_unavailable_pinned_biominer_commit(tmp_path: Path) -> None:
    manifest = json.loads(DEFAULT_MANIFEST.read_text(encoding="utf-8"))
    manifest["origin_commit"] = "0" * 40
    changed = tmp_path / "analytics_import_manifest.json"
    changed.write_text(json.dumps(manifest), encoding="utf-8")

    with pytest.raises(ValueError, match="expected pinned commit"):
        import_biominer_analytics(
            biominer_root=DEFAULT_BIOMINER_ROOT,
            manifest_path=changed,
            check=True,
        )


def test_import_refuses_a_record_count_outside_the_biominer_manifest(tmp_path: Path) -> None:
    manifest = json.loads(DEFAULT_MANIFEST.read_text(encoding="utf-8"))
    manifest["artifacts"][0]["record_count"] = 1
    changed = tmp_path / "analytics_import_manifest.json"
    changed.write_text(json.dumps(manifest), encoding="utf-8")

    with pytest.raises(ValueError, match="record count differs"):
        import_biominer_analytics(
            biominer_root=DEFAULT_BIOMINER_ROOT,
            manifest_path=changed,
            check=True,
        )
