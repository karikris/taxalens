from __future__ import annotations

from copy import deepcopy
from json import loads
from pathlib import Path

from taxalens.product import (
    BaselineOccurrenceUnionRow,
    CountryHierarchyDocument,
    GeographicImpactCellRow,
    GeographicImpactManifestDocument,
    GeographicImpactSummaryRow,
    validate_geographic_contract,
)

FIXTURE_PATH = Path("packages/contracts/fixtures/geographic_contract_cases.json")

ROW_FACTORIES = {
    "baseline_occurrence_union": BaselineOccurrenceUnionRow.from_mapping,
    "geographic_impact_cell": GeographicImpactCellRow.from_mapping,
    "geographic_impact_summary": GeographicImpactSummaryRow.from_mapping,
    "country_hierarchy": CountryHierarchyDocument.from_mapping,
    "geographic_impact_manifest": GeographicImpactManifestDocument.from_mapping,
}


def test_shared_positive_fixtures_validate_and_round_trip_in_python() -> None:
    fixtures = _fixtures()

    for contract, document in fixtures["positive"].items():
        validation = validate_geographic_contract(contract, document)
        typed = ROW_FACTORIES[contract](document)

        assert validation.valid, (contract, validation.failures)
        assert typed.to_dict() == document


def test_shared_negative_fixtures_fail_closed_in_python() -> None:
    fixtures = _fixtures()

    for case in fixtures["negative"]:
        contract = case["contract"]
        document = deepcopy(fixtures["positive"][contract])
        _mutate(document, case)

        validation = validate_geographic_contract(contract, document)

        assert validation.valid is False, case["fixture_id"]
        assert case["expected_keyword"] in {
            failure.keyword for failure in validation.failures
        }, (case["fixture_id"], validation.failures)


def _fixtures() -> dict[str, object]:
    value = loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    assert value["schema_version"] == "taxalens-geographic-contract-fixtures:v1.0.0"
    assert set(value["positive"]) == set(ROW_FACTORIES)
    return value


def _mutate(document: dict[str, object], case: dict[str, object]) -> None:
    parts = str(case["path"]).split(".")
    target: object = document
    for part in parts[:-1]:
        target = target[int(part)] if isinstance(target, list) else target[part]  # type: ignore[index]
    leaf = parts[-1]
    if case["operation"] == "remove":
        assert isinstance(target, dict)
        del target[leaf]
        return
    if case["operation"] == "replace":
        if isinstance(target, list):
            target[int(leaf)] = case.get("value")
        else:
            assert isinstance(target, dict)
            target[leaf] = case.get("value")
        return
    raise AssertionError(f"unsupported fixture mutation: {case['operation']}")
