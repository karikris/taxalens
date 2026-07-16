from __future__ import annotations

import copy
import json
from collections.abc import Callable

import pytest
from packages.replay.src.biominer_prototype_evidence_adapter import (
    adapt_prototype_evidence,
)
from packages.replay.src.biominer_prototype_release_gate import (
    EXPLICIT_PROTOTYPE_MODE,
    GO_PROTOTYPE_ONLY,
    NO_GO,
    PINNED_BIOMINER_SHA,
    PROTOTYPE_RELEASE_GATE_SCHEMA_VERSION,
    evaluate_prototype_release_gate,
)


def test_complete_explicit_prototype_handoff_is_the_only_go_outcome() -> None:
    result = evaluate_prototype_release_gate(adapt_prototype_evidence())

    assert result["schema_version"] == PROTOTYPE_RELEASE_GATE_SCHEMA_VERSION
    assert result["decision"] == GO_PROTOTYPE_ONLY
    assert result["requested_mode"] == EXPLICIT_PROTOTYPE_MODE
    assert result["origin_commit"] == PINNED_BIOMINER_SHA
    assert result["required_gate_count"] == 14
    assert result["passed_gate_count"] == 14
    assert result["failed_gate_count"] == 0
    assert [gate["gate_id"] for gate in result["gate_results"]] == [
        "adapter_schema_supported",
        "origin_is_pinned_biominer",
        "explicit_prototype_mode_requested",
        "prototype_status_explicit",
        "adapter_authorization_bounded",
        "upstream_decision_go",
        "upstream_gate_set_complete",
        "upstream_scope_explicit_prototype_only",
        "release_acceptance_prototype_only",
        "final_release_decision_bounded",
        "scientific_release_blocked",
        "production_default_unchanged",
        "public_reference_images_blocked",
        "scientific_semantics_blocked",
    ]
    assert all(gate["status"] == "passed" for gate in result["gate_results"])
    assert result["authorization"] == {
        "requested_mode_authorized": True,
        "prototype_integration": True,
        "explicit_prototype_mode_only": True,
        "production_default_change": False,
        "scientific_release": False,
        "public_reference_image_display": False,
        "scientific_claim": False,
    }
    assert result["scientific_claim_allowed"] is False


@pytest.mark.parametrize(
    ("gate_id", "mutate"),
    [
        (
            "adapter_schema_supported",
            lambda value: _set(value, ("schema_version",), "unsupported"),
        ),
        (
            "origin_is_pinned_biominer",
            lambda value: _set(value, ("origin_commit",), "0" * 40),
        ),
        (
            "prototype_status_explicit",
            lambda value: _set(value, ("status",), "production_ready"),
        ),
        (
            "adapter_authorization_bounded",
            lambda value: _set(value, ("scientific_claim_allowed",), True),
        ),
        (
            "upstream_decision_go",
            lambda value: _set(
                value,
                ("contracts", "phase15_release", "data", "decision"),
                "NO_GO",
            ),
        ),
        (
            "upstream_gate_set_complete",
            lambda value: _set(
                value,
                ("contracts", "phase15_release", "data", "gate_summary", "passed"),
                13,
            ),
        ),
        (
            "upstream_scope_explicit_prototype_only",
            lambda value: _set(
                value,
                (
                    "contracts",
                    "phase15_release",
                    "data",
                    "authorization",
                    "explicit_prototype_mode_only",
                ),
                False,
            ),
        ),
        (
            "release_acceptance_prototype_only",
            lambda value: _set(
                value,
                ("contracts", "phase15_release", "data", "acceptance_status"),
                "accepted",
            ),
        ),
        (
            "final_release_decision_bounded",
            lambda value: _set(
                value,
                (
                    "contracts",
                    "phase15_release",
                    "data",
                    "release_decision",
                    "prototype",
                ),
                "production",
            ),
        ),
        (
            "scientific_release_blocked",
            lambda value: _set(value, ("scientific_release_authorized",), True),
        ),
        (
            "production_default_unchanged",
            lambda value: _set(value, ("production_default_change_authorized",), True),
        ),
        (
            "public_reference_images_blocked",
            lambda value: _set(
                value,
                ("public_reference_image_display_authorized",),
                True,
            ),
        ),
        (
            "scientific_semantics_blocked",
            lambda value: _set(
                value,
                ("contracts", "reference_bank", "data", "counts", "human_verified"),
                1,
            ),
        ),
    ],
)
def test_missing_or_contradictory_evidence_fails_closed(
    gate_id: str,
    mutate: Callable[[dict[str, object]], None],
) -> None:
    prototype = copy.deepcopy(adapt_prototype_evidence())
    mutate(prototype)

    result = evaluate_prototype_release_gate(prototype)

    assert result["decision"] == NO_GO
    assert result["failed_gate_count"] >= 1
    assert next(
        gate["status"] for gate in result["gate_results"] if gate["gate_id"] == gate_id
    ) == "failed"
    _assert_no_broadened_authorization(result)


@pytest.mark.parametrize(
    "requested_mode",
    ["production_default", "scientific_release", "public_reference_image_display", ""],
)
def test_non_prototype_requested_modes_are_no_go(requested_mode: str) -> None:
    result = evaluate_prototype_release_gate(
        adapt_prototype_evidence(),
        requested_mode=requested_mode,
    )

    assert result["decision"] == NO_GO
    assert next(
        gate["status"]
        for gate in result["gate_results"]
        if gate["gate_id"] == "explicit_prototype_mode_requested"
    ) == "failed"
    _assert_no_broadened_authorization(result)


def test_malformed_input_returns_a_diagnostic_no_go_receipt() -> None:
    result = evaluate_prototype_release_gate(None)

    assert result["decision"] == NO_GO
    assert result["passed_gate_count"] == 1
    assert result["failed_gate_count"] == 13
    assert result["origin_commit"] is None
    _assert_no_broadened_authorization(result)


def test_receipt_is_deterministic_and_json_serializable() -> None:
    first = evaluate_prototype_release_gate(adapt_prototype_evidence())
    second = evaluate_prototype_release_gate(adapt_prototype_evidence())

    assert first == second
    assert json.loads(json.dumps(first, sort_keys=True)) == first


def _set(value: dict[str, object], path: tuple[str, ...], replacement: object) -> None:
    current = value
    for key in path[:-1]:
        child = current[key]
        assert isinstance(child, dict)
        current = child
    current[path[-1]] = replacement


def _assert_no_broadened_authorization(result: dict[str, object]) -> None:
    authorization = result["authorization"]
    assert isinstance(authorization, dict)
    assert authorization["requested_mode_authorized"] is False
    assert authorization["prototype_integration"] is False
    assert authorization["production_default_change"] is False
    assert authorization["scientific_release"] is False
    assert authorization["public_reference_image_display"] is False
    assert authorization["scientific_claim"] is False
    assert result["scientific_claim_allowed"] is False
