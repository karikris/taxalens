from packages.replay.src.biominer_reference_routes import REFERENCE_ROUTES


def test_reference_routes_match_the_complete_committed_closed_vocabulary() -> None:
    assert REFERENCE_ROUTES == frozenset(
        {"adult_field", "larval", "pupal", "egg", "pinned_specimen"}
    )


def test_reference_routes_are_immutable() -> None:
    assert isinstance(REFERENCE_ROUTES, frozenset)
