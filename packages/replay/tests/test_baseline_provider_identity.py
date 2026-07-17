from __future__ import annotations

from datetime import date

import pytest
from packages.replay.src.baseline_provider_identity import (
    INATURALIST_GBIF_DATASET_KEY,
    BaselineProviderIdentityError,
    ProviderIdentityRecord,
    canonical_observation_id,
    classify_provider_source,
    identity_basis,
    identity_contradictions,
    normalize_stable_source_reference,
    provider_relationship_id,
    unresolved_duplicate_group_id,
)

SHA_A = "a" * 64
SHA_B = "b" * 64


def test_provider_origin_uses_only_exact_committed_dataset_mapping() -> None:
    assert (
        classify_provider_source(
            delivery_provider="gbif",
            source_dataset_key=INATURALIST_GBIF_DATASET_KEY,
        )
        == "inaturalist"
    )
    assert (
        classify_provider_source(
            delivery_provider="gbif",
            source_dataset_key="dataset-named-inaturalist-but-unrecognized",
        )
        == "gbif"
    )
    assert (
        classify_provider_source(
            delivery_provider="inaturalist",
            source_dataset_key=None,
        )
        == "inaturalist"
    )


def test_verified_inaturalist_identity_bridges_gbif_and_direct_delivery() -> None:
    via_gbif = _record(
        record_id="gbif:1",
        provider_source="inaturalist",
        delivery_provider="gbif",
        source_record_sha256=SHA_A,
        gbif_occurrence_key="1",
        inaturalist_observation_id="0005001",
    )
    direct = _record(
        record_id="inaturalist:5001",
        provider_source="inaturalist",
        delivery_provider="inaturalist",
        source_record_sha256=SHA_B,
        gbif_occurrence_key=None,
        inaturalist_observation_id="5001",
        provider_observation_id="5001",
    )

    assert identity_basis(via_gbif).normalized_values == ("5001",)
    assert canonical_observation_id(identity_basis(via_gbif)) == canonical_observation_id(
        identity_basis(direct)
    )
    assert provider_relationship_id(via_gbif) != provider_relationship_id(direct)


def test_resized_media_representation_does_not_change_observation_identity() -> None:
    original = _record(
        gbif_occurrence_key=None,
        source_record_sha256=SHA_A,
        stable_source_reference="https://example.org/observations/42#original-media",
    )
    resized = _record(
        record_id="gbif:resized",
        gbif_occurrence_key=None,
        source_record_sha256=SHA_B,
        stable_source_reference="https://example.org/observations/42#resized-media",
    )

    assert canonical_observation_id(identity_basis(original)) == canonical_observation_id(
        identity_basis(resized)
    )
    assert provider_relationship_id(original) != provider_relationship_id(resized)


def test_coincident_independent_provider_observations_remain_separate() -> None:
    shared = {
        "accepted_taxon_key": "gbif:1938069",
        "observer_id": "observer-1",
        "event_date": date(2026, 7, 1),
        "latitude": -33.8,
        "longitude": 151.2,
        "country_code": "AU",
    }
    first = _record(provider_observation_id="100", **shared)
    second = _record(
        record_id="gbif:2",
        source_record_sha256=SHA_B,
        gbif_occurrence_key="2",
        provider_observation_id="101",
        **shared,
    )

    assert canonical_observation_id(identity_basis(first)) != canonical_observation_id(
        identity_basis(second)
    )
    assert "provider_observation_id" in identity_contradictions(first, second)


def test_ambiguous_weak_match_retains_both_singletons_in_unresolved_group() -> None:
    shared = {
        "gbif_occurrence_key": None,
        "provider_observation_id": None,
        "accepted_taxon_key": "gbif:1938069",
        "event_date": date(2026, 7, 1),
        "latitude": -33.8,
        "longitude": 151.2,
        "country_code": "AU",
    }
    first = _record(source_record_sha256=SHA_A, **shared)
    second = _record(
        record_id="gbif:weak-2",
        source_record_sha256=SHA_B,
        **shared,
    )
    first_id = canonical_observation_id(identity_basis(first))
    second_id = canonical_observation_id(identity_basis(second))

    assert identity_basis(first).method == identity_basis(second).method == "singleton"
    assert first_id != second_id
    group = unresolved_duplicate_group_id(
        [first_id, second_id], reason_code="coincident_identity_incomplete"
    )
    assert group.startswith("unresolved-provider-group:v1:sha256:")


def test_missing_source_fingerprint_fails_closed() -> None:
    with pytest.raises(BaselineProviderIdentityError, match="source_record_sha256"):
        _record(source_record_sha256="")


def test_gbif_occurrence_key_is_namespaced_provider_identity() -> None:
    record = _record()
    basis = identity_basis(record)

    assert basis.method == "provider_identity"
    assert basis.namespace == "gbif"
    assert basis.normalized_values == ("1",)
    assert canonical_observation_id(basis).startswith("baseline-observation:v1:sha256:")


def test_bare_occurrence_id_is_not_treated_as_global_identity() -> None:
    record = _record(
        gbif_occurrence_key=None,
        provider_observation_id=None,
        occurrence_id="shared",
        occurrence_namespace=None,
        source_dataset_key=None,
    )
    assert identity_basis(record).method == "singleton"

    scoped = _record(
        gbif_occurrence_key=None,
        provider_observation_id=None,
        occurrence_id="shared",
        occurrence_namespace="institution:collection",
        source_dataset_key=None,
    )
    assert identity_basis(scoped).method == "scoped_occurrence_id"
    assert identity_basis(scoped).namespace == "institution:collection"


def test_stable_reference_normalization_preserves_unrecognized_query_parameters() -> None:
    assert (
        normalize_stable_source_reference("HTTPS://EXAMPLE.ORG:443/observations/1?view=full#media")
        == "https://example.org/observations/1?view=full"
    )
    with pytest.raises(BaselineProviderIdentityError, match="HTTP"):
        normalize_stable_source_reference("ftp://example.org/observations/1")


def test_strict_composite_requires_every_configured_identity_field() -> None:
    complete = _record(
        gbif_occurrence_key=None,
        provider_observation_id=None,
        source_dataset_key="dataset-1",
        observer_id="observer-1",
        accepted_taxon_key="gbif:1",
        event_date=date(2026, 7, 1),
        latitude=-33.8,
        longitude=151.2,
        country_code="AU",
    )
    assert identity_basis(complete).method == "strict_composite"

    incomplete = _record(
        gbif_occurrence_key=None,
        provider_observation_id=None,
        source_dataset_key="dataset-1",
        observer_id=None,
        accepted_taxon_key="gbif:1",
        event_date=date(2026, 7, 1),
        latitude=-33.8,
        longitude=151.2,
        country_code="AU",
    )
    assert identity_basis(incomplete).method == "singleton"


def test_authoritative_contradictions_block_automatic_linkage() -> None:
    left = _record(
        provider_observation_id="source-1",
        accepted_taxon_key="gbif:1",
        observer_id="observer-a",
        event_date=date(2026, 7, 1),
        latitude=1.0,
        longitude=2.0,
        country_code="AU",
    )
    right = _record(
        record_id="gbif:2",
        source_record_sha256=SHA_B,
        gbif_occurrence_key="2",
        provider_observation_id="source-2",
        accepted_taxon_key="gbif:2",
        observer_id="observer-b",
        event_date=date(2026, 7, 2),
        latitude=1.1,
        longitude=2.1,
        country_code="NZ",
    )

    assert identity_contradictions(left, right) == (
        "accepted_taxon_key",
        "country_code",
        "event_date",
        "latitude",
        "longitude",
        "observer_id",
        "provider_observation_id",
    )


def test_unresolved_group_is_stable_without_merging_members() -> None:
    first = canonical_observation_id(identity_basis(_record()))
    second = canonical_observation_id(
        identity_basis(
            _record(record_id="gbif:2", source_record_sha256=SHA_B, gbif_occurrence_key="2")
        )
    )
    forward = unresolved_duplicate_group_id(
        [first, second], reason_code="ambiguous_strict_composite"
    )
    reverse = unresolved_duplicate_group_id(
        [second, first], reason_code="ambiguous_strict_composite"
    )
    assert forward == reverse
    assert forward.startswith("unresolved-provider-group:v1:sha256:")


def _record(**overrides: object) -> ProviderIdentityRecord:
    values: dict[str, object] = {
        "record_id": "gbif:1",
        "provider_source": "gbif",
        "delivery_provider": "gbif",
        "source_record_sha256": SHA_A,
        "provider_observation_id": None,
        "gbif_occurrence_key": "1",
        "inaturalist_observation_id": None,
        "occurrence_id": None,
        "occurrence_namespace": None,
        "stable_source_reference": None,
        "source_dataset_key": None,
        "observer_id": None,
        "accepted_taxon_key": None,
        "event_date": None,
        "latitude": None,
        "longitude": None,
        "coordinate_uncertainty_m": None,
        "country_code": None,
        "admin1": None,
    }
    values.update(overrides)
    return ProviderIdentityRecord(**values)  # type: ignore[arg-type]
