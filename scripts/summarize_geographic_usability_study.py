#!/usr/bin/env python3
"""Validate and summarize genuine Geographic Impact usability sessions."""

from __future__ import annotations

import argparse
import hashlib
import json
import statistics
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any

import jsonschema

ROOT = Path(__file__).resolve().parents[1]
SUMMARY_SCHEMA_VERSION = "taxalens-geographic-usability-study-summary:v1.0.0"
TASK_IDS = (
    "identify_country_gap",
    "find_candidate_record",
    "inspect_provenance",
    "begin_verification",
    "interpret_evidence_state",
)


def canonical_json_bytes(value: object) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        allow_nan=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_path(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_timestamp(value: str, field: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError(f"{field} is not an ISO timestamp.") from error
    if parsed.tzinfo is None:
        raise ValueError(f"{field} lacks a timezone.")
    return parsed


def validate_study(raw: dict[str, Any], schema: dict[str, Any]) -> None:
    validator = jsonschema.Draft202012Validator(
        schema,
        format_checker=jsonschema.FormatChecker(),
    )
    errors = sorted(validator.iter_errors(raw), key=lambda error: list(error.absolute_path))
    if errors:
        raise ValueError(f"Geographic usability JSON Schema failed: {errors[0].message}")
    sessions = raw["sessions"]
    claims = raw["claims"]
    if claims["humanParticipantCount"] != len(sessions):
        raise ValueError("Human participant claim does not match retained sessions.")
    if claims["humanUsabilityMeasured"] != bool(sessions):
        raise ValueError("Human usability claim does not match retained sessions.")
    if raw["status"] == "pending_human_data" and sessions:
        raise ValueError("Pending study packet contains a retained session.")

    session_ids = [session["sessionId"] for session in sessions]
    participant_hashes = [session["participant"]["participantIdHash"] for session in sessions]
    if len(session_ids) != len(set(session_ids)):
        raise ValueError("Geographic usability sessions repeat an ID.")
    if len(participant_hashes) != len(set(participant_hashes)):
        raise ValueError("Geographic usability sessions repeat a participant hash.")
    for session in sessions:
        validate_session(session)


def validate_session(session: dict[str, Any]) -> None:
    started_at = parse_timestamp(session["startedAt"], "session startedAt")
    completed_at = (
        parse_timestamp(session["completedAt"], "session completedAt")
        if session["completedAt"] is not None
        else None
    )
    if session["status"] == "completed" and completed_at is None:
        raise ValueError("Completed geographic usability session has no completion time.")
    if session["status"] == "withdrawn" and not session["withdrawnDataRetentionAllowed"]:
        raise ValueError("Withdrawn session without retention consent must not be retained.")
    tasks = session["tasks"]
    if tuple(task["taskId"] for task in tasks) != TASK_IDS:
        raise ValueError("Geographic usability task order changed.")
    if [task["sequence"] for task in tasks] != list(range(1, 6)):
        raise ValueError("Geographic usability task sequence is not contiguous.")
    previous = started_at
    for task in tasks:
        task_started = parse_timestamp(task["startedAt"], "task startedAt")
        task_ended = parse_timestamp(task["endedAt"], "task endedAt")
        if task_started < previous or task_ended < task_started:
            raise ValueError("Geographic usability task timestamps are not chronological.")
        if completed_at is not None and task_ended > completed_at:
            raise ValueError("Geographic usability task ended after the session.")
        previous = task_ended
    if session["status"] == "completed" and any(task["status"] != "completed" for task in tasks):
        raise ValueError("Completed session contains an incomplete task.")


def numeric_summary(values: list[int]) -> dict[str, int | float | None]:
    if not values:
        return {"count": 0, "minimum": None, "median": None, "maximum": None}
    return {
        "count": len(values),
        "minimum": min(values),
        "median": statistics.median(values),
        "maximum": max(values),
    }


def build_summary(
    raw: dict[str, Any],
    schema: dict[str, Any],
    *,
    raw_sha256: str,
    schema_sha256: str,
) -> dict[str, Any]:
    validate_study(raw, schema)
    sessions = raw["sessions"]
    eligible = [session for session in sessions if session["status"] == "completed"]
    incomplete_count = sum(session["status"] == "incomplete" for session in sessions)
    withdrawn_count = sum(session["status"] == "withdrawn" for session in sessions)
    task_metrics = {}
    error_counts: Counter[str] = Counter()
    interpretation_answer_count = 0
    correct_interpretation_count = 0
    for task_id in TASK_IDS:
        observations = [
            next(task for task in session["tasks"] if task["taskId"] == task_id)
            for session in eligible
        ]
        for observation in observations:
            error_counts.update(observation["errors"])
            for answer in observation["interpretationAnswers"]:
                interpretation_answer_count += 1
                correct_interpretation_count += int(answer["correct"])
        confidences = [
            observation["confidence"]
            for observation in observations
            if observation["confidence"] is not None
        ]
        task_metrics[task_id] = {
            "eligibleSessionCount": len(observations),
            "activeMilliseconds": numeric_summary(
                [observation["activeMilliseconds"] for observation in observations]
            ),
            "actionCount": numeric_summary(
                [observation["actionCount"] for observation in observations]
            ),
            "moderatorHelpCount": sum(
                observation["moderatorHelpCount"] for observation in observations
            ),
            "confidence": numeric_summary(confidences),
        }

    status = "available_descriptive" if eligible else "pending_human_data"
    payload = {
        "schemaVersion": SUMMARY_SCHEMA_VERSION,
        "studyId": raw["studyId"],
        "status": status,
        "humanStudyComplete": raw["status"] == "complete" and bool(eligible),
        "claims": {
            "humanUsabilityMeasured": bool(eligible),
            "humanTimeSavingsAllowed": False,
            "causalProductImpactAllowed": False,
            "studyObservationsAreReviewEvidence": False,
        },
        "sample": {
            "retainedSessionCount": len(sessions),
            "analysisEligibleSessionCount": len(eligible),
            "incompleteSessionCount": incomplete_count,
            "withdrawnRetainedSessionCount": withdrawn_count,
        },
        "taskMetrics": task_metrics,
        "interpretation": {
            "answerCount": interpretation_answer_count,
            "correctAnswerCount": correct_interpretation_count,
            "accuracy": (
                correct_interpretation_count / interpretation_answer_count
                if interpretation_answer_count
                else None
            ),
        },
        "errors": {
            "total": sum(error_counts.values()),
            "byCategory": dict(sorted(error_counts.items())),
        },
        "sources": {
            "rawStudySha256": raw_sha256,
            "schemaSha256": schema_sha256,
            "targetTaxaLensSha": raw["targetBuild"]["taxalensSha"],
            "impactArtifactSha256": raw["targetBuild"]["impactArtifactSha256"],
        },
        "humanWorkRemaining": (
            []
            if eligible
            else [
                "Recruit and consent genuine participants.",
                "Run the fixed five-task protocol against the recorded build.",
                "Review and approve the raw packet before publication.",
            ]
        ),
    }
    return {**payload, "summarySha256": sha256_bytes(canonical_json_bytes(payload))}


def read_object(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"Expected JSON object: {path}")
    return value


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--raw",
        type=Path,
        default=ROOT / "demo/source/impact/geographic-impact-usability-study.raw.json",
    )
    parser.add_argument(
        "--schema",
        type=Path,
        default=ROOT / "packages/contracts/schema/geographic_usability_study.schema.json",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT / "demo/source/impact/geographic-impact-usability-study.summary.json",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    summary = build_summary(
        read_object(args.raw),
        read_object(args.schema),
        raw_sha256=sha256_path(args.raw),
        schema_sha256=sha256_path(args.schema),
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "output": str(args.output),
                "status": summary["status"],
                "eligibleSessions": summary["sample"]["analysisEligibleSessionCount"],
            },
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
