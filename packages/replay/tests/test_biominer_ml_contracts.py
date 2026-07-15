from packages.replay.src.biominer_calibration_contract import (
    CALIBRATED_PROBABILITY_KIND,
)
from packages.replay.src.biominer_training_task_contract import TARGET_TASKS


def test_calibrated_probability_kind_matches_committed_contract() -> None:
    assert CALIBRATED_PROBABILITY_KIND == "calibrated_probability"


def test_target_tasks_match_complete_committed_closed_vocabulary() -> None:
    assert TARGET_TASKS == frozenset(
        {
            "binary_target_verifier",
            "regional_multiclass",
            "visual_domain",
            "larval_target_verifier",
        }
    )
    assert isinstance(TARGET_TASKS, frozenset)
