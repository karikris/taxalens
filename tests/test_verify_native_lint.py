import copy
import json
import runpy
import subprocess
import sys
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).parents[1]
SCRIPT_PATH = REPOSITORY_ROOT / "scripts" / "verify_native_lint.py"
BOUNDARY_PATH = REPOSITORY_ROOT / "packages/replay/compatibility_boundary.json"


def _script_namespace() -> dict[str, object]:
    return runpy.run_path(str(SCRIPT_PATH))


def test_boundary_classifies_every_python_path_and_only_fourteen_locked() -> None:
    namespace = _script_namespace()
    payload = namespace["load_boundary"](BOUNDARY_PATH)

    assert namespace["validate_boundary"](REPOSITORY_ROOT, payload) == []
    python_paths = namespace["discover_python_paths"](REPOSITORY_ROOT)
    native, locked = namespace["classify_python_paths"](python_paths, payload)

    assert len(locked) == 14
    assert set(native).isdisjoint(locked)
    assert set(native) | set(locked) == set(python_paths)
    assert "scripts/verify_native_lint.py" in native
    assert "tests/test_verify_native_lint.py" in native


def test_boundary_rejects_unlisted_source_locked_header() -> None:
    namespace = _script_namespace()
    payload = json.loads(BOUNDARY_PATH.read_text(encoding="utf-8"))
    mutated = copy.deepcopy(payload)
    removed = mutated["source_locked_files"].pop()

    failures = namespace["validate_boundary"](REPOSITORY_ROOT, mutated)

    assert any(removed["path"] in failure for failure in failures)
    assert any("not declared in the boundary" in failure for failure in failures)


def test_boundary_rejects_duplicate_locked_path() -> None:
    namespace = _script_namespace()
    payload = json.loads(BOUNDARY_PATH.read_text(encoding="utf-8"))
    mutated = copy.deepcopy(payload)
    mutated["source_locked_files"].append(copy.deepcopy(mutated["source_locked_files"][0]))

    failures = namespace["validate_boundary"](REPOSITORY_ROOT, mutated)

    assert "source_locked_files contains duplicate paths" in failures


def test_ruff_config_rejects_native_per_file_ignore(tmp_path: Path) -> None:
    namespace = _script_namespace()
    pyproject = tmp_path / "pyproject.toml"
    pyproject.write_text(
        """
[tool.ruff]
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "I", "UP"]

[tool.ruff.lint.per-file-ignores]
"scripts/**" = ["E501"]
""".lstrip(),
        encoding="utf-8",
    )

    failures = namespace["validate_ruff_config"](
        pyproject,
        ["scripts/verify_native_lint.py"],
    )

    assert failures == [
        "Ruff per-file ignore 'scripts/**' hides native path 'scripts/verify_native_lint.py'"
    ]


def test_locked_diagnostic_summary_groups_rules_and_files() -> None:
    namespace = _script_namespace()
    diagnostics = [
        {
            "code": "E501",
            "filename": str(REPOSITORY_ROOT / "packages/replay/src/locked.py"),
        },
        {
            "code": "F401",
            "filename": str(REPOSITORY_ROOT / "packages/replay/src/locked.py"),
        },
        {
            "code": "E501",
            "filename": str(REPOSITORY_ROOT / "packages/replay/src/other.py"),
        },
    ]

    assert namespace["summarize_diagnostics"](diagnostics, REPOSITORY_ROOT) == [
        "rules: E501=2, F401=1",
        "files: packages/replay/src/locked.py: E501=1, F401=1",
        "files: packages/replay/src/other.py: E501=1",
    ]


def test_native_lint_script_passes_and_reports_locked_findings() -> None:
    result = subprocess.run(
        [sys.executable, str(SCRIPT_PATH)],
        cwd=REPOSITORY_ROOT,
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr
    assert "Native Ruff check passed:" in result.stdout
    assert "Native Ruff format check passed:" in result.stdout
    assert "Source-locked compatibility Ruff report:" in result.stdout


def test_native_lint_workflow_uses_locked_environment_and_gate() -> None:
    workflow = (REPOSITORY_ROOT / ".github/workflows/native-python-lint.yml").read_text(
        encoding="utf-8"
    )

    assert "uv sync --locked --group dev" in workflow
    assert "uv run --locked --group dev python scripts/verify_native_lint.py" in workflow
    assert "11f9893b081a58869d3b5fccaea48c9e9e46f990" in workflow
