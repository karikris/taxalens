#!/usr/bin/env python3
"""Recompute the bounded verification impact summary from raw session events."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any

RAW_SCHEMA_VERSION = "taxalens-verification-impact-study-raw:v1.0.0"
SUMMARY_SCHEMA_VERSION = "taxalens-verification-impact-study-summary:v1.0.0"
SESSION_SCHEMA_VERSION = "taxalens-verification-impact-session:v1.0.0"
SUMMARY_SESSION_SCHEMA_VERSION = "taxalens-verification-impact-summary:v1.0.0"
WORKFLOWS = ("manual_baseline", "taxalens_assisted")
ACTION_KINDS = (
    "page_opened",
    "duplicate_inspected",
    "field_completed",
    "decision_recorded",
    "other",
)
OUTCOMES = ("yes", "no", "cant_tell", "cant_view", "skipped")


def canonical_json(value: Any) -> str:
    return json.dumps(
        value,
        allow_nan=False,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )


def sha256_path(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_time(value: object, field: str) -> datetime:
    if not isinstance(value, str):
        raise RuntimeError(f"{field} must be a timestamp string.")
    normalized = value.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError as error:
        raise RuntimeError(f"{field} is not ISO-compatible.") from error
    if parsed.tzinfo is None:
        raise RuntimeError(f"{field} must include a timezone.")
    return parsed


def milliseconds_between(start: object, end: object, field: str) -> int:
    delta = parse_time(end, f"{field} end") - parse_time(start, f"{field} start")
    milliseconds = int(delta.total_seconds() * 1000)
    if milliseconds < 0:
        raise RuntimeError(f"{field} duration cannot be negative.")
    return milliseconds


def summarize_session(session: dict[str, Any]) -> dict[str, Any]:
    if session.get("schemaVersion") != SESSION_SCHEMA_VERSION:
        raise RuntimeError("Impact session schema is unsupported.")
    workflow = session.get("workflow")
    if workflow not in WORKFLOWS:
        raise RuntimeError("Impact workflow is unsupported.")
    events = session.get("events")
    if not isinstance(events, list) or not events:
        raise RuntimeError("Impact session events are unavailable.")
    previous_time = parse_time(session["startedAt"], "session startedAt")
    active_started: datetime | None = None
    active_milliseconds = 0
    action_counts: Counter[str] = Counter()
    unique_values: dict[str, set[str]] = {
        "page_opened": set(),
        "duplicate_inspected": set(),
        "field_completed": set(),
        "decision_recorded": set(),
    }
    unique_field = {
        "page_opened": "pageId",
        "duplicate_inspected": "duplicateGroupId",
        "field_completed": "fieldId",
        "decision_recorded": "itemId",
    }
    outcome_counts: Counter[str] = Counter()
    completion_count = 0
    for index, event in enumerate(events, start=1):
        if not isinstance(event, dict) or event.get("sequence") != index:
            raise RuntimeError("Impact event sequences must be contiguous.")
        event_time = parse_time(event.get("recordedAt"), "event recordedAt")
        if event_time < previous_time:
            raise RuntimeError("Impact events must be chronological.")
        previous_time = event_time
        event_type = event.get("eventType")
        if event_type == "activity":
            state = event.get("state")
            if state == "active":
                if active_started is not None:
                    raise RuntimeError("Impact active intervals may not overlap.")
                active_started = event_time
            elif state == "paused":
                if active_started is None:
                    raise RuntimeError("Impact pause lacks an active interval.")
                active_milliseconds += int((event_time - active_started).total_seconds() * 1000)
                active_started = None
            else:
                raise RuntimeError("Impact activity state is unsupported.")
        elif event_type == "action":
            action_kind = event.get("actionKind")
            if action_kind not in ACTION_KINDS:
                raise RuntimeError("Impact action kind is unsupported.")
            if active_started is None:
                raise RuntimeError("Impact actions require active time.")
            action_counts[action_kind] += 1
            if action_kind in unique_field:
                value = event.get(unique_field[action_kind])
                if not isinstance(value, str) or not value:
                    raise RuntimeError(
                        f"Impact {action_kind} requires {unique_field[action_kind]}."
                    )
                unique_values[action_kind].add(value)
            if action_kind == "decision_recorded":
                outcome = event.get("outcome")
                if outcome not in OUTCOMES:
                    raise RuntimeError("Impact decision outcome is unsupported.")
                outcome_counts[outcome] += 1
        elif event_type == "completion":
            completion_count += 1
            if index != len(events):
                raise RuntimeError("Impact completion must be final.")
        else:
            raise RuntimeError("Impact event type is unsupported.")
    completed_at = session.get("completedAt")
    if completion_count != 1 or not isinstance(completed_at, str):
        raise RuntimeError("Impact session must contain one completion.")
    if events[-1].get("recordedAt") != completed_at:
        raise RuntimeError("Impact completion timestamp does not match the session.")
    if active_started is not None:
        raise RuntimeError("Completed impact session retains active time.")
    elapsed_milliseconds = milliseconds_between(
        session["startedAt"],
        completed_at,
        "session",
    )
    actions = sum(action_counts.values())
    return {
        "schemaVersion": SUMMARY_SESSION_SCHEMA_VERSION,
        "protocolVersion": session["protocolVersion"],
        "workflow": workflow,
        "studyId": session["studyId"],
        "sessionId": session["sessionId"],
        "taskSetId": session["taskSetId"],
        "completed": True,
        "activeMilliseconds": active_milliseconds,
        "activeMinutes": active_milliseconds / 60_000,
        "elapsedMilliseconds": elapsed_milliseconds,
        "elapsedMinutes": elapsed_milliseconds / 60_000,
        "actions": actions,
        "pagesOpened": action_counts["page_opened"],
        "uniquePagesOpened": len(unique_values["page_opened"]),
        "duplicatesInspected": action_counts["duplicate_inspected"],
        "uniqueDuplicatesInspected": len(unique_values["duplicate_inspected"]),
        "fieldsCompleted": action_counts["field_completed"],
        "uniqueFieldsCompleted": len(unique_values["field_completed"]),
        "decisions": action_counts["decision_recorded"],
        "uniqueItemsDecided": len(unique_values["decision_recorded"]),
        "outcomeCounts": {outcome: outcome_counts[outcome] for outcome in OUTCOMES},
    }


def delta(assisted: int, manual: int) -> dict[str, int | float | None]:
    return {
        "manual": manual,
        "assisted": assisted,
        "absoluteChange": assisted - manual,
        "relativeChange": (None if manual == 0 else (assisted - manual) / manual),
    }


def build_summary(raw: dict[str, Any], raw_path: Path) -> dict[str, Any]:
    if raw.get("schemaVersion") != RAW_SCHEMA_VERSION:
        raise RuntimeError("Raw impact study schema is unsupported.")
    sessions = raw.get("sessions")
    if not isinstance(sessions, list) or len(sessions) != 2:
        raise RuntimeError("Scripted impact pilot requires exactly two sessions.")
    if any(
        not isinstance(entry, dict) or entry.get("scriptedRun") is not True for entry in sessions
    ):
        raise RuntimeError("Impact pilot contains an undisclosed non-scripted session.")
    summaries = [summarize_session(entry["rawSession"]) for entry in sessions]
    by_workflow = {summary["workflow"]: summary for summary in summaries}
    if set(by_workflow) != set(WORKFLOWS):
        raise RuntimeError("Impact pilot requires manual and assisted sessions.")
    manual = by_workflow["manual_baseline"]
    assisted = by_workflow["taxalens_assisted"]
    if (
        manual["studyId"] != assisted["studyId"]
        or manual["taskSetId"] != assisted["taskSetId"]
        or manual["decisions"] != assisted["decisions"]
    ):
        raise RuntimeError("Impact sessions are not matched to one task set.")
    raw_claims = raw.get("claims")
    if (
        not isinstance(raw_claims, dict)
        or raw_claims.get("humanParticipants") != 0
        or raw_claims.get("humanProductivityMeasured") is not False
        or raw_claims.get("humanTimeSavingsAllowed") is not False
    ):
        raise RuntimeError("Raw impact claim boundary is unsafe.")
    measures = {
        "activeMilliseconds": delta(
            assisted["activeMilliseconds"],
            manual["activeMilliseconds"],
        ),
        "actions": delta(assisted["actions"], manual["actions"]),
        "pagesOpened": delta(
            assisted["pagesOpened"],
            manual["pagesOpened"],
        ),
        "duplicatesInspected": delta(
            assisted["duplicatesInspected"],
            manual["duplicatesInspected"],
        ),
        "fieldsCompleted": delta(
            assisted["fieldsCompleted"],
            manual["fieldsCompleted"],
        ),
        "decisions": delta(
            assisted["decisions"],
            manual["decisions"],
        ),
    }
    return {
        "schemaVersion": SUMMARY_SCHEMA_VERSION,
        "studyId": raw["studyId"],
        "measurementRunId": raw["measurementRunId"],
        "sourceRawArtifact": {
            "path": str(raw_path.as_posix()),
            "sha256": sha256_path(raw_path),
            "schemaVersion": raw["schemaVersion"],
        },
        "measurementKind": raw["measurementKind"],
        "taskSet": raw["taskSet"],
        "environment": raw["environment"],
        "sample": {
            "sessionCount": 2,
            "matchedPairCount": 1,
            "humanParticipantCount": 0,
            "scriptedPairCount": 1,
        },
        "sessionSummaries": [by_workflow[workflow] for workflow in WORKFLOWS],
        "comparison": measures,
        "measuredResult": {
            "metric": "scripted_action_count",
            "manual": manual["actions"],
            "assisted": assisted["actions"],
            "absoluteChange": measures["actions"]["absoluteChange"],
            "relativeChange": measures["actions"]["relativeChange"],
            "scope": "one frozen three-item scripted Chromium protocol",
        },
        "qualityImpact": {
            "availability": "unavailable",
            "reason": "The scripted timing run collected no human quality outcome.",
        },
        "timeSavings": {
            "availability": "unavailable",
            "reason": (
                "A scripted browser pair with zero human participants cannot "
                "support a human time-savings claim."
            ),
        },
        "claimBoundaries": {
            "humanProductivityMeasured": False,
            "humanTimeSavingsAllowed": False,
            "populationSavingsAllowed": False,
            "scientificQualityMeasured": False,
            "extrapolationAllowed": False,
        },
        "limitations": raw["limitations"],
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--raw",
        type=Path,
        default=Path("demo/source/impact/verification-impact-study.raw.json"),
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("demo/source/impact/verification-impact-summary.json"),
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    raw_path = args.raw.resolve()
    raw = json.loads(raw_path.read_text(encoding="utf-8"))
    summary = build_summary(raw, args.raw)
    output = args.output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "output": str(output),
                "rawSha256": summary["sourceRawArtifact"]["sha256"],
                "manualActions": summary["measuredResult"]["manual"],
                "assistedActions": summary["measuredResult"]["assisted"],
                "humanParticipants": summary["sample"]["humanParticipantCount"],
            },
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
