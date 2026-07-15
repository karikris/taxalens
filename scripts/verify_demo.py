#!/usr/bin/env python3
"""Validate replay demo manifests and fixture integrity."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from taxalens.product.truthful_demo_verifier import (
    DEFAULT_TRUTHFUL_DEMO_MANIFEST,
    TruthfulDemoVerificationError,
    verify_truthful_demo,
)

REQUIRED_FIELDS = {
    "demo_id",
    "title",
    "target_species",
    "source_biominer_commit",
    "taxalens_commit",
    "created_at",
    "artifacts",
    "expected_counts",
    "hero_record_id",
    "rights_summary",
    "openai_replay_mode",
    "checksum_algorithm",
    "phase12_contract_version",
    "phase13_excluded",
}


def sha256sum(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def read_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def validate_artifacts(repo_root: Path, manifest: dict[str, object], failures: list[str]) -> None:
    artifacts = manifest.get("artifacts", [])
    if not isinstance(artifacts, list):
        failures.append("`artifacts` must be a list.")
        return

    for artifact in artifacts:
        if not isinstance(artifact, dict):
            failures.append("Each artifact entry must be an object with name/path/sha256.")
            continue

        name = artifact.get("name")
        path = artifact.get("path")
        expected_sha = artifact.get("sha256")

        if not name or not path:
            failures.append("Each artifact entry must have name and path.")
            continue

        file_path = (repo_root / str(path)).resolve()
        if not file_path.exists():
            failures.append(f"Referenced artifact missing: {path}")
            continue

        if not expected_sha:
            failures.append(f"Artifact {name} is missing expected sha256 field.")
            continue
        if manifest.get("checksum_algorithm") != "sha256":
            continue
        actual_sha = sha256sum(file_path)
        if actual_sha != expected_sha:
            failures.append(
                f"Checksum mismatch for {path}: expected {expected_sha}, got {actual_sha}."
            )


def validate_expected_counts(
    manifest: dict[str, object], repo_root: Path, failures: list[str]
) -> None:
    expected = manifest.get("expected_counts", {})
    if not isinstance(expected, dict):
        failures.append("`expected_counts` must be an object.")
        return

    run_records = expected.get("run_records")
    stage_metrics = expected.get("stage_metrics")
    evidence_records = expected.get("evidence_records")

    for key, expected_count in [
        ("run_records", run_records),
        ("stage_metrics", stage_metrics),
        ("evidence_records", evidence_records),
    ]:
        if expected_count is None:
            continue
        if not isinstance(expected_count, int):
            failures.append(f"Expected count '{key}' must be integer.")

    artifact_lookup = {}
    for item in manifest.get("artifacts", []):
        if isinstance(item, dict):
            artifact_lookup[item.get("name")] = item.get("path")

    run_summary_path = artifact_lookup.get("run_summary")
    if isinstance(run_records, int) and run_summary_path:
        run_obj = read_json(repo_root / str(run_summary_path))
        records_in = run_obj.get("records_in")
        if records_in != run_records:
            failures.append(
                f"run_summary records_in mismatch: expected {run_records}, found {records_in}."
            )

    stage_metrics_path = artifact_lookup.get("stage_metrics")
    if isinstance(stage_metrics, int) and stage_metrics_path:
        stages = read_json(repo_root / str(stage_metrics_path))
        if isinstance(stages, list) and len(stages) != stage_metrics:
            failures.append(
                f"stage_metrics length mismatch: expected {stage_metrics}, found {len(stages)}."
            )

    evidence_path = artifact_lookup.get("evidence_records")
    if isinstance(evidence_records, int) and evidence_path:
        records = read_json(repo_root / str(evidence_path))
        if isinstance(records, list) and len(records) != evidence_records:
            failures.append(
                "evidence_records length mismatch: "
                f"expected {evidence_records}, found {len(records)}."
            )


def validate_rights(manifest: dict[str, object], failures: list[str]) -> None:
    rights = manifest.get("rights_summary")
    if not isinstance(rights, dict):
        failures.append("`rights_summary` must be an object.")
        return
    status = rights.get("status")
    if status not in {"fixture-only", "license-checked", "rights-verified"}:
        failures.append(f"Unexpected rights status: {status}")


def validate_hero_record(repo_root: Path, manifest: dict[str, object], failures: list[str]) -> None:
    hero_record_id = manifest.get("hero_record_id")
    if not hero_record_id:
        failures.append("`hero_record_id` is required.")
        return

    artifacts = manifest.get("artifacts", [])
    evidence_path = None
    for item in artifacts:
        if isinstance(item, dict) and item.get("name") == "evidence_records":
            evidence_path = item.get("path")

    if not evidence_path:
        failures.append("Could not locate evidence_records artifact in manifest.")
        return

    records = read_json(repo_root / str(evidence_path))
    if not isinstance(records, list):
        failures.append("evidence_records artifact must be a list.")
        return

    ids = [entry.get("evidence_record_id") for entry in records if isinstance(entry, dict)]
    if hero_record_id not in ids:
        failures.append(f"Hero record {hero_record_id} not found in evidence_records artifact.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "manifest",
        default=str(DEFAULT_TRUTHFUL_DEMO_MANIFEST),
        nargs="?",
        help="Path to a truthful judge bundle or legacy smoke manifest",
    )
    parser.add_argument("--require-phase13-excluded", action="store_true", default=True)
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    manifest_path = repo_root / args.manifest
    failures: list[str] = []

    if not manifest_path.exists():
        raise SystemExit(f"Manifest missing: {manifest_path}")

    manifest = read_json(manifest_path)
    if not isinstance(manifest, dict):
        raise SystemExit("Manifest file is not a JSON object.")

    if manifest_path.name == "judge_bundle.json" or "artifact_inventory" in manifest:
        try:
            result = verify_truthful_demo(manifest_path)
        except TruthfulDemoVerificationError as error:
            raise SystemExit(f"Truthful demo verification failed: {error}") from error
        print(
            "Truthful demo verification passed: "
            f"bundle={result.bundle_id}, artifacts={result.artifact_count}, "
            f"records={result.total_section_record_count}, media={result.media_asset_count}, "
            f"hero={result.hero_state}."
        )
        return

    missing = REQUIRED_FIELDS - set(manifest)
    if missing:
        failures.append(f"Manifest missing required fields: {', '.join(sorted(missing))}")

    if manifest.get("checksum_algorithm") != "sha256":
        failures.append("Only sha256 checksum validation is currently supported.")

    validate_rights(manifest, failures)
    validate_artifacts(repo_root, manifest, failures)
    validate_expected_counts(manifest, repo_root, failures)
    validate_hero_record(repo_root, manifest, failures)

    if args.require_phase13_excluded and manifest.get("phase13_excluded") is not True:
        failures.append("Manifest must explicitly set phase13_excluded=true.")

    if failures:
        print("Demo verification failed:")
        for item in failures:
            print(f"  - {item}")
        raise SystemExit(1)

    print("Demo manifest validation passed.")


if __name__ == "__main__":
    main()
