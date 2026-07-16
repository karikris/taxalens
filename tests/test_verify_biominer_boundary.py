import runpy
import subprocess
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


def test_pinned_revision_remains_valid_after_head_advances(tmp_path: Path) -> None:
    inspect_pinned_revision = runpy.run_path(str(BOUNDARY_SCRIPT))[
        "inspect_pinned_revision"
    ]
    repository = tmp_path / "repository"
    repository.mkdir()
    _git(repository, "init", "-q")
    _git(repository, "config", "user.name", "TaxaLens Test")
    _git(repository, "config", "user.email", "taxalens@example.test")

    evidence = repository / "evidence.json"
    evidence.write_text('{"version":1}\n', encoding="utf-8")
    _git(repository, "add", "evidence.json")
    _git(repository, "commit", "-q", "-m", "evidence pin")
    pinned = _git(repository, "rev-parse", "HEAD")

    evidence.write_text('{"version":2}\n', encoding="utf-8")
    _git(repository, "commit", "-q", "-am", "advance main")
    head = _git(repository, "rev-parse", "HEAD")

    assert head != pinned
    assert inspect_pinned_revision(repository, pinned, head) == {
        "available": True,
        "resolved_sha": pinned,
        "head_matches": False,
    }


def test_missing_pinned_revision_fails_closed(tmp_path: Path) -> None:
    inspect_pinned_revision = runpy.run_path(str(BOUNDARY_SCRIPT))[
        "inspect_pinned_revision"
    ]
    repository = tmp_path / "repository"
    repository.mkdir()
    _git(repository, "init", "-q")
    _git(repository, "config", "user.name", "TaxaLens Test")
    _git(repository, "config", "user.email", "taxalens@example.test")
    (repository / "README.md").write_text("# test\n", encoding="utf-8")
    _git(repository, "add", "README.md")
    _git(repository, "commit", "-q", "-m", "initial")
    head = _git(repository, "rev-parse", "HEAD")

    assert inspect_pinned_revision(repository, "0" * 40, head) == {
        "available": False,
        "resolved_sha": None,
        "head_matches": False,
    }


def _git(repository: Path, *args: str) -> str:
    return subprocess.run(
        ["git", *args],
        cwd=repository,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
