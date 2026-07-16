"""Fail-closed TaxaLens release gate for normalized BioMiner prototype evidence."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

PROTOTYPE_RELEASE_GATE_SCHEMA_VERSION = "taxalens-prototype-release-gate:v1.0.0"
PROTOTYPE_EVIDENCE_SCHEMA_VERSION = "taxalens-biominer-prototype-evidence:v1.1.0"
PINNED_BIOMINER_SHA = "74a7d648a562efa744e6502ef504a23b63b4e02f"
EXPLICIT_PROTOTYPE_MODE = "explicit_prototype"
GO_PROTOTYPE_ONLY = "GO_PROTOTYPE_ONLY"
NO_GO = "NO_GO"

_LIMITATIONS = (
    "No reference label is independently human taxonomically verified.",
    "Provider-supported retrieval consistency is not classification accuracy.",
    "The selected policy is uncalibrated and emits no probabilities.",
    "Prototype inference distributions are not accuracy or prevalence estimates.",
    "Public reference-image display is not authorized.",
    "Scientific release and production-default changes are not authorized.",
)


def evaluate_prototype_release_gate(
    prototype: object,
    *,
    requested_mode: str = EXPLICIT_PROTOTYPE_MODE,
) -> dict[str, object]:
    """Return a deterministic GO/NO_GO receipt without broadening authorization."""

    phase15 = _contract_data(prototype, "phase15_release")
    reference = _contract_data(prototype, "reference_bank")
    semantics = _contract_data(prototype, "evidence_semantics")
    policy = _contract_data(prototype, "selected_policy")

    gate_summary = _mapping(_path(phase15, "gate_summary"))
    authorization = _mapping(_path(phase15, "authorization"))
    release_decision = _mapping(_path(phase15, "release_decision"))
    reference_counts = _mapping(_path(reference, "counts"))
    margin_policy = _mapping(_path(policy, "margin_policy"))
    calibration = _mapping(_path(policy, "calibration"))

    gates = (
        _gate(
            "adapter_schema_supported",
            _path(prototype, "schema_version") == PROTOTYPE_EVIDENCE_SCHEMA_VERSION,
            "The normalized prototype schema is the supported TaxaLens contract.",
            "The normalized prototype schema is missing or unsupported.",
            "schema_version",
        ),
        _gate(
            "origin_is_pinned_biominer",
            _path(prototype, "origin_repository") == "karikris/BioMiner"
            and _path(prototype, "origin_commit") == PINNED_BIOMINER_SHA,
            "The evidence originates from the pinned committed BioMiner revision.",
            "The BioMiner repository or commit does not match the pinned handoff.",
            "origin_repository",
            "origin_commit",
        ),
        _gate(
            "explicit_prototype_mode_requested",
            requested_mode == EXPLICIT_PROTOTYPE_MODE,
            "The caller explicitly requested the bounded prototype mode.",
            "Only explicit_prototype may be authorized by this gate.",
            "requested_mode",
        ),
        _gate(
            "prototype_status_explicit",
            _path(prototype, "status") == "prototype_only_available_with_limitations"
            and _path(prototype, "contract_count") == 10,
            "The handoff is explicitly prototype-only and exposes all ten contracts.",
            "Prototype status or normalized contract coverage is incomplete.",
            "status",
            "contract_count",
        ),
        _gate(
            "adapter_authorization_bounded",
            _path(prototype, "prototype_integration_authorized") is True
            and _path(prototype, "scientific_claim_allowed") is False,
            "The adapter authorizes prototype integration while blocking scientific claims.",
            "Adapter-level prototype authorization is missing or scientifically unsafe.",
            "prototype_integration_authorized",
            "scientific_claim_allowed",
        ),
        _gate(
            "upstream_decision_go",
            _path(phase15, "decision") == "GO",
            "The committed upstream decision is GO for the prototype boundary.",
            "The upstream GO decision is missing or differs.",
            "contracts.phase15_release.data.decision",
        ),
        _gate(
            "upstream_gate_set_complete",
            _path(gate_summary, "required") == 14
            and _path(gate_summary, "passed") == 14
            and _path(gate_summary, "failed") == 0,
            "All 14 committed upstream prototype entry gates passed.",
            "The upstream gate summary is incomplete or contains failures.",
            "contracts.phase15_release.data.gate_summary",
        ),
        _gate(
            "upstream_scope_explicit_prototype_only",
            _path(authorization, "prototype_integration") is True
            and _path(authorization, "explicit_prototype_mode_only") is True,
            "Upstream authorization is limited to explicit prototype integration.",
            "Upstream authorization is missing or is not explicitly prototype-only.",
            "contracts.phase15_release.data.authorization.prototype_integration",
            "contracts.phase15_release.data.authorization.explicit_prototype_mode_only",
        ),
        _gate(
            "release_acceptance_prototype_only",
            _path(phase15, "acceptance_status") == "accepted_prototype_only_with_limitations",
            "Release acceptance is explicitly prototype-only with limitations.",
            "Release acceptance is missing or exceeds the prototype boundary.",
            "contracts.phase15_release.data.acceptance_status",
        ),
        _gate(
            "final_release_decision_bounded",
            _path(release_decision, "prototype") == "accepted_with_limitations"
            and _path(release_decision, "scientific_release") == "not_authorized"
            and _path(release_decision, "production_default") == "unchanged"
            and _path(release_decision, "public_reference_images") == "not_authorized",
            "The final decision accepts only the limited prototype release.",
            "The final release decision is missing or broadens authorization.",
            "contracts.phase15_release.data.release_decision",
        ),
        _gate(
            "scientific_release_blocked",
            _path(prototype, "scientific_release_authorized") is False
            and _path(phase15, "scientific_release_authorized") is False
            and _path(authorization, "scientific_release") is False,
            "Scientific release remains blocked at every normalized layer.",
            "Scientific release is missing a fail-closed prohibition.",
            "scientific_release_authorized",
            "contracts.phase15_release.data.scientific_release_authorized",
            "contracts.phase15_release.data.authorization.scientific_release",
        ),
        _gate(
            "production_default_unchanged",
            _path(prototype, "production_default_change_authorized") is False
            and _path(phase15, "production_default_change_authorized") is False
            and _path(authorization, "production_default_change") is False,
            "Production-default changes remain blocked at every normalized layer.",
            "Production-default changes are missing a fail-closed prohibition.",
            "production_default_change_authorized",
            "contracts.phase15_release.data.production_default_change_authorized",
            "contracts.phase15_release.data.authorization.production_default_change",
        ),
        _gate(
            "public_reference_images_blocked",
            _path(prototype, "public_reference_image_display_authorized") is False
            and _path(phase15, "public_reference_image_display_authorized") is False
            and _path(authorization, "public_reference_image_display") is False
            and _path(reference, "public_reference_image_display_allowed") is False,
            "Public reference-image display remains blocked at every normalized layer.",
            "Public reference-image display is missing a fail-closed prohibition.",
            "public_reference_image_display_authorized",
            "contracts.phase15_release.data.public_reference_image_display_authorized",
            "contracts.phase15_release.data.authorization.public_reference_image_display",
            "contracts.reference_bank.data.public_reference_image_display_allowed",
        ),
        _gate(
            "scientific_semantics_blocked",
            _path(reference_counts, "provider_supported") == 81
            and _path(reference_counts, "human_verified") == 0
            and _path(semantics, "classification_accuracy_reported") is False
            and _path(semantics, "classification_accuracy") is None
            and _path(semantics, "calibration_error") is None
            and _path(semantics, "raw_scores_are_probabilities") is False
            and _path(margin_policy, "scores_are_probabilities") is False
            and _path(calibration, "probabilities_emitted") is False,
            "Human-review, probability, accuracy, and calibration boundaries are preserved.",
            "Scientific semantics are missing, contradictory, or promoted beyond evidence.",
            "contracts.reference_bank.data.counts",
            "contracts.evidence_semantics.data",
            "contracts.selected_policy.data.margin_policy",
            "contracts.selected_policy.data.calibration",
        ),
    )
    passed = sum(gate["status"] == "passed" for gate in gates)
    decision = GO_PROTOTYPE_ONLY if passed == len(gates) else NO_GO
    origin_commit = _path(prototype, "origin_commit")
    return {
        "schema_version": PROTOTYPE_RELEASE_GATE_SCHEMA_VERSION,
        "decision": decision,
        "requested_mode": requested_mode,
        "fail_closed": True,
        "origin_repository": _path(prototype, "origin_repository"),
        "origin_commit": origin_commit if isinstance(origin_commit, str) else None,
        "required_gate_count": len(gates),
        "passed_gate_count": passed,
        "failed_gate_count": len(gates) - passed,
        "gate_results": list(gates),
        "authorization": {
            "requested_mode_authorized": decision == GO_PROTOTYPE_ONLY,
            "prototype_integration": decision == GO_PROTOTYPE_ONLY,
            "explicit_prototype_mode_only": True,
            "production_default_change": False,
            "scientific_release": False,
            "public_reference_image_display": False,
            "scientific_claim": False,
        },
        "limitations": list(_LIMITATIONS),
        "scientific_claim_allowed": False,
    }


def _contract_data(prototype: object, name: str) -> Mapping[str, Any]:
    return _mapping(_path(prototype, "contracts", name, "data"))


def _mapping(value: object) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _path(value: object, *keys: str) -> object:
    current = value
    for key in keys:
        if not isinstance(current, Mapping) or key not in current:
            return None
        current = current[key]
    return current


def _gate(
    gate_id: str,
    passed: bool,
    passed_reason: str,
    failed_reason: str,
    *evidence_paths: str,
) -> dict[str, object]:
    return {
        "gate_id": gate_id,
        "status": "passed" if passed else "failed",
        "reason": passed_reason if passed else failed_reason,
        "evidence_paths": list(evidence_paths),
    }


__all__ = [
    "EXPLICIT_PROTOTYPE_MODE",
    "GO_PROTOTYPE_ONLY",
    "NO_GO",
    "PINNED_BIOMINER_SHA",
    "PROTOTYPE_RELEASE_GATE_SCHEMA_VERSION",
    "evaluate_prototype_release_gate",
]
