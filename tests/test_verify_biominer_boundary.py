import runpy
from pathlib import Path

BOUNDARY_SCRIPT = Path(__file__).parents[1] / "scripts" / "verify_biominer_boundary.py"


def test_phase13_signal_scan_prunes_git_metadata(tmp_path: Path) -> None:
    has_phase13_signal = runpy.run_path(str(BOUNDARY_SCRIPT))["has_phase13_signal"]
    repository = tmp_path / "repository"

    hidden_signal = repository / ".git" / "objects" / "phase13-cache"
    hidden_signal.mkdir(parents=True)
    (hidden_signal / "task13-result.json").write_text("{}", encoding="utf-8")

    assert has_phase13_signal(repository) is False

    committed_signal = repository / "evidence" / "phase13"
    committed_signal.mkdir(parents=True)
    (committed_signal / "summary.json").write_text("{}", encoding="utf-8")

    assert has_phase13_signal(repository) is True
