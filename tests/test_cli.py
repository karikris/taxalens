from __future__ import annotations

import json
from pathlib import Path

import taxalens.cli as cli
from taxalens.cli import main
from taxalens.product.local_replay import LocalReplayBuild, LocalReplayError


def test_doctor_reports_credential_free_environment(capsys) -> None:
    assert main(["doctor"]) == 0
    payload = json.loads(capsys.readouterr().out)
    assert payload["status"] == "ok"
    assert payload["credentials_required"] is False
    assert payload["gpu_required"] is False
    assert payload["model_download_required"] is False
    assert len(payload["taxalens_sha"]) == 40
    assert len(payload["biominer_sha"]) == 40


def test_demo_verify_runs_existing_verifier() -> None:
    assert main(["demo", "verify"]) == 0


def test_demo_build_labels_truthful_fixture(capsys) -> None:
    assert main(["demo", "build"]) == 0
    output = capsys.readouterr().out
    payload = json.loads(output[output.index("{") :])
    assert payload["status"] == "verified_truthful_fixture"
    assert payload["manifest"] == "demo/fixture/papilio_pilot/judge_bundle.json"
    assert payload["hero_state"] == "awaiting_human_review"
    assert payload["scientific_claim_allowed"] is False


def test_demo_replay_prepares_and_serves_verified_build(monkeypatch, tmp_path: Path) -> None:
    build = LocalReplayBuild(
        web_root=tmp_path,
        bundle_id="bundle",
        current_taxalens_sha="a" * 40,
        fixture_taxalens_sha="b" * 40,
        biominer_sha="c" * 40,
        artifact_count=25,
        section_count=20,
        unavailable_section_count=6,
        total_section_record_count=29,
        media_asset_count=0,
        hero_record_id="hero",
        hero_state="awaiting_human_review",
    )
    observed: dict[str, object] = {}
    monkeypatch.setattr(cli, "prepare_local_replay", lambda root: build)

    def serve(
        value: LocalReplayBuild,
        *,
        port: int,
        open_browser: bool,
    ) -> int:
        observed.update(build=value, port=port, open_browser=open_browser)
        return 0

    monkeypatch.setattr(cli, "serve_local_replay", serve)

    assert main(["demo", "replay", "--open", "--port", "0"]) == 0
    assert observed == {"build": build, "port": 0, "open_browser": True}


def test_demo_replay_fails_closed_without_credentials(monkeypatch, capsys) -> None:
    def unavailable(_root: Path) -> LocalReplayBuild:
        raise LocalReplayError("static replay checksum differs")

    monkeypatch.setattr(cli, "prepare_local_replay", unavailable)

    assert main(["demo", "replay", "--open"]) == 2
    payload = json.loads(capsys.readouterr().err)
    assert payload == {
        "credentials_required": False,
        "open_requested": True,
        "reason": "static replay checksum differs",
        "status": "unavailable",
    }


def test_provenance_verify_runs_existing_verifier() -> None:
    assert main(["provenance", "verify"]) == 0
