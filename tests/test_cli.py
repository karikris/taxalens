from __future__ import annotations

import json

from taxalens.cli import main


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


def test_demo_replay_is_explicitly_unavailable(capsys) -> None:
    assert main(["demo", "replay", "--open"]) == 2
    payload = json.loads(capsys.readouterr().out)
    assert payload == {
        "open_requested": True,
        "reason": (
            "The judge web application is not implemented yet; complete Task 9.1 "
            "before claiming local replay."
        ),
        "status": "unavailable",
    }


def test_provenance_verify_runs_existing_verifier() -> None:
    assert main(["provenance", "verify"]) == 0
