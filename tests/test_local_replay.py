from __future__ import annotations

import json
import shutil
from pathlib import Path
from urllib.request import urlopen

import pytest
import taxalens.product.local_replay as local_replay
from taxalens.product.local_replay import (
    LocalReplayBuild,
    LocalReplayError,
    LocalReplayServer,
    prepare_local_replay,
    serve_local_replay,
)

SOURCE_FIXTURE = Path("demo/fixture/papilio_pilot")


def _build(web_root: Path) -> LocalReplayBuild:
    return LocalReplayBuild(
        web_root=web_root,
        bundle_id="papilio-demoleus-pilot-75461d9c-v1",
        current_taxalens_sha="a" * 40,
        fixture_taxalens_sha="b" * 40,
        biominer_sha="c" * 40,
        artifact_count=24,
        section_count=20,
        unavailable_section_count=6,
        total_section_record_count=29,
        media_asset_count=0,
        hero_record_id="papilio-demoleus-pilot-awaiting-review",
        hero_state="awaiting_human_review",
    )


def _copy_static_fixture(root: Path) -> Path:
    destination = root / "dist" / "web"
    shutil.copytree(root / SOURCE_FIXTURE, destination)
    (destination / "index.html").write_text("<!doctype html><title>TaxaLens</title>")
    return destination


def test_prepare_local_replay_verifies_source_build_and_provenance(
    monkeypatch,
    tmp_path: Path,
) -> None:
    shutil.copytree(SOURCE_FIXTURE, tmp_path / SOURCE_FIXTURE)
    monkeypatch.setattr(local_replay, "_current_taxalens_sha", lambda _root: "a" * 40)

    prepared = prepare_local_replay(tmp_path, build_web=_copy_static_fixture)

    assert prepared.web_root == (tmp_path / "dist" / "web").resolve()
    assert prepared.bundle_id == "papilio-demoleus-pilot-75461d9c-v1"
    assert prepared.current_taxalens_sha == "a" * 40
    assert prepared.fixture_taxalens_sha == "77cd51e7a61945ffef9f0603b9ecd960460abaa9"
    assert prepared.biominer_sha == "75461d9c065af0cd96b41cd1f845c2e920f7ae34"
    assert prepared.artifact_count == 24
    assert prepared.section_count == 20
    assert prepared.unavailable_section_count == 6
    assert prepared.total_section_record_count == 29
    assert prepared.media_asset_count == 0


def test_prepare_local_replay_rejects_tampered_static_artifact(
    monkeypatch,
    tmp_path: Path,
) -> None:
    shutil.copytree(SOURCE_FIXTURE, tmp_path / SOURCE_FIXTURE)
    monkeypatch.setattr(local_replay, "_current_taxalens_sha", lambda _root: "a" * 40)

    def tampered_build(root: Path) -> Path:
        destination = _copy_static_fixture(root)
        (destination / "data" / "run_summary.json").write_text("{}")
        return destination

    with pytest.raises(LocalReplayError, match="artifact checksum differs"):
        prepare_local_replay(tmp_path, build_web=tampered_build)


def test_loopback_server_waits_until_static_index_is_available(tmp_path: Path) -> None:
    (tmp_path / "index.html").write_text("TaxaLens replay")
    server = LocalReplayServer(tmp_path, port=0)
    server.start()
    try:
        assert server.url.startswith("http://127.0.0.1:")
        with urlopen(server.url, timeout=2) as response:  # noqa: S310 - fixed loopback URL.
            assert response.status == 200
            assert response.read() == b"TaxaLens replay"
    finally:
        server.close()


def test_serve_local_replay_prints_receipt_opens_browser_and_closes(
    capsys,
    tmp_path: Path,
) -> None:
    events: list[str] = []

    class FakeServer:
        url = "http://127.0.0.1:51234/"

        def start(self) -> None:
            events.append("start")

        def wait(self) -> None:
            events.append("wait")

        def close(self) -> None:
            events.append("close")

    def server_factory(root: Path, port: int) -> FakeServer:
        assert root == tmp_path
        assert port == 0
        return FakeServer()

    def browser_opener(url: str) -> bool:
        events.append(f"open:{url}")
        return True

    assert (
        serve_local_replay(
            _build(tmp_path),
            port=0,
            open_browser=True,
            browser_opener=browser_opener,
            server_factory=server_factory,
        )
        == 0
    )

    payload = json.loads(capsys.readouterr().out)
    assert payload["status"] == "serving"
    assert payload["url"] == "http://127.0.0.1:51234/"
    assert payload["bundle_id"] == "papilio-demoleus-pilot-75461d9c-v1"
    assert payload["taxalens_sha"] == "a" * 40
    assert payload["fixture_taxalens_sha"] == "b" * 40
    assert payload["biominer_sha"] == "c" * 40
    assert payload["credentials_required"] is False
    assert payload["expected_counts"] == {
        "artifacts": 24,
        "media_assets": 0,
        "section_records": 29,
        "sections": 20,
        "unavailable_sections": 6,
    }
    assert events == ["start", "open:http://127.0.0.1:51234/", "wait", "close"]
