#!/usr/bin/env python3
"""Enforce native Python lint while reporting source-locked compatibility findings."""

from __future__ import annotations

import argparse
import fnmatch
import json
import re
import subprocess
import sys
import tomllib
from collections import Counter, defaultdict
from pathlib import Path, PurePosixPath
from typing import Any

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BOUNDARY = Path("packages/replay/compatibility_boundary.json")
DEFAULT_PYPROJECT = Path("pyproject.toml")
BOUNDARY_SCHEMA_VERSION = "taxalens-replay-compatibility-boundary:v1.0.0"
UPSTREAM_REPOSITORY = "karikris/BioMiner"
SOURCE_LOCKED_ROOT = "packages/replay/src"
EXPECTED_TOP_LEVEL_FIELDS = {
    "schema_version",
    "upstream_repository",
    "policy",
    "native_roots",
    "source_locked_files",
}
EXPECTED_POLICY = {
    "unlisted_replay_source_is_native": True,
    "unlisted_tracked_python_is_native": True,
    "replay_tests_are_native": True,
    "native_lint_must_pass": True,
    "source_locked_lint_is_reported_separately": True,
    "blanket_repository_exclusion_allowed": False,
}
EXPECTED_ENTRY_FIELDS = {"path", "mode", "source_path", "source_commit"}
ALLOWED_MODES = {"copied", "complete_source_adaptation"}
REQUIRED_RUFF_RULE_FAMILIES = {"E", "F", "I", "UP"}
HEX_SHA = re.compile(r"^[0-9a-f]{40}$")
LOCKED_HEADER_MARKERS = (
    "Adapted from karikris/BioMiner",
    "Copied from karikris/BioMiner",
    "Copied without semantic changes from",
)


class NativeLintConfigurationError(ValueError):
    """Raised when the compatibility or lint boundary is unsafe."""


def load_boundary(path: Path) -> dict[str, Any]:
    """Load a compatibility boundary as a JSON object."""

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise NativeLintConfigurationError(f"boundary manifest is missing: {path}") from exc
    except json.JSONDecodeError as exc:
        raise NativeLintConfigurationError(
            f"boundary manifest is not valid JSON: {path}: {exc}"
        ) from exc
    if not isinstance(payload, dict):
        raise NativeLintConfigurationError("boundary manifest must be a JSON object")
    return payload


def _safe_relative_path(value: object, *, field: str) -> str:
    if not isinstance(value, str) or not value:
        raise NativeLintConfigurationError(f"{field} must be a non-empty string")
    if "\\" in value:
        raise NativeLintConfigurationError(f"{field} must use POSIX separators: {value}")
    path = PurePosixPath(value)
    if path.is_absolute() or any(part in {"", ".", ".."} for part in path.parts):
        raise NativeLintConfigurationError(f"{field} must be normalized and relative: {value}")
    if path.as_posix() != value:
        raise NativeLintConfigurationError(f"{field} must be normalized: {value}")
    return value


def _has_locked_header_marker(path: Path) -> bool:
    header = "\n".join(path.read_text(encoding="utf-8").splitlines()[:24])
    return any(marker in header for marker in LOCKED_HEADER_MARKERS)


def validate_boundary(repository_root: Path, payload: dict[str, Any]) -> list[str]:
    """Return every compatibility-boundary validation failure."""

    failures: list[str] = []
    actual_fields = set(payload)
    if actual_fields != EXPECTED_TOP_LEVEL_FIELDS:
        missing = sorted(EXPECTED_TOP_LEVEL_FIELDS - actual_fields)
        extra = sorted(actual_fields - EXPECTED_TOP_LEVEL_FIELDS)
        failures.append(f"boundary fields differ; missing={missing}, extra={extra}")

    if payload.get("schema_version") != BOUNDARY_SCHEMA_VERSION:
        failures.append(f"unsupported boundary schema: {payload.get('schema_version')!r}")
    if payload.get("upstream_repository") != UPSTREAM_REPOSITORY:
        failures.append(f"unexpected upstream repository: {payload.get('upstream_repository')!r}")
    if payload.get("policy") != EXPECTED_POLICY:
        failures.append("boundary policy must match the fail-closed native lint policy")

    native_roots = payload.get("native_roots")
    if not isinstance(native_roots, list) or not native_roots:
        failures.append("native_roots must be a non-empty list")
    else:
        normalized_roots: list[str] = []
        for index, value in enumerate(native_roots):
            try:
                normalized = _safe_relative_path(value, field=f"native_roots[{index}]")
            except NativeLintConfigurationError as exc:
                failures.append(str(exc))
                continue
            normalized_roots.append(normalized)
            if not (repository_root / normalized).exists():
                failures.append(f"native root does not exist: {normalized}")
        if len(normalized_roots) != len(set(normalized_roots)):
            failures.append("native_roots contains duplicate paths")

    entries = payload.get("source_locked_files")
    if not isinstance(entries, list) or not entries:
        failures.append("source_locked_files must be a non-empty list")
        entries = []

    locked_paths: list[str] = []
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict):
            failures.append(f"source_locked_files[{index}] must be an object")
            continue
        if set(entry) != EXPECTED_ENTRY_FIELDS:
            failures.append(
                f"source_locked_files[{index}] fields must be {sorted(EXPECTED_ENTRY_FIELDS)}"
            )
            continue
        try:
            locked_path = _safe_relative_path(
                entry.get("path"),
                field=f"source_locked_files[{index}].path",
            )
            source_path = _safe_relative_path(
                entry.get("source_path"),
                field=f"source_locked_files[{index}].source_path",
            )
        except NativeLintConfigurationError as exc:
            failures.append(str(exc))
            continue
        locked_paths.append(locked_path)
        if not locked_path.startswith(f"{SOURCE_LOCKED_ROOT}/"):
            failures.append(f"locked file is outside {SOURCE_LOCKED_ROOT}: {locked_path}")
        if not locked_path.endswith(".py"):
            failures.append(f"locked file is not Python: {locked_path}")
        if entry.get("mode") not in ALLOWED_MODES:
            failures.append(f"unsupported locked mode for {locked_path}: {entry.get('mode')!r}")
        source_commit = entry.get("source_commit")
        if not isinstance(source_commit, str) or not HEX_SHA.fullmatch(source_commit):
            failures.append(f"invalid source commit for {locked_path}: {source_commit!r}")

        file_path = repository_root / locked_path
        if not file_path.is_file() or file_path.is_symlink():
            failures.append(f"locked file must be a regular non-symlink file: {locked_path}")
            continue
        header = "\n".join(file_path.read_text(encoding="utf-8").splitlines()[:24])
        if source_path not in header:
            failures.append(f"locked source path is absent from header: {locked_path}")
        if isinstance(source_commit, str) and source_commit not in header:
            failures.append(f"locked source commit is absent from header: {locked_path}")
        if not _has_locked_header_marker(file_path):
            failures.append(f"locked provenance marker is absent from header: {locked_path}")

    if len(locked_paths) != len(set(locked_paths)):
        failures.append("source_locked_files contains duplicate paths")

    locked_set = set(locked_paths)
    replay_source = repository_root / SOURCE_LOCKED_ROOT
    for file_path in sorted(replay_source.glob("*.py")):
        relative = file_path.relative_to(repository_root).as_posix()
        if _has_locked_header_marker(file_path) and relative not in locked_set:
            failures.append(
                f"source-locked header marker is not declared in the boundary: {relative}"
            )

    return failures


def discover_python_paths(repository_root: Path) -> list[str]:
    """Return tracked and newly added, non-ignored Python paths."""

    result = subprocess.run(
        [
            "git",
            "ls-files",
            "--cached",
            "--others",
            "--exclude-standard",
            "--",
            "*.py",
        ],
        cwd=repository_root,
        check=True,
        capture_output=True,
        text=True,
    )
    paths = sorted({line for line in result.stdout.splitlines() if line})
    if not paths:
        raise NativeLintConfigurationError("Git did not report any Python files")
    return paths


def classify_python_paths(
    python_paths: list[str],
    payload: dict[str, Any],
) -> tuple[list[str], list[str]]:
    """Partition Python paths into native and source-locked sets."""

    entries = payload.get("source_locked_files")
    if not isinstance(entries, list):
        raise NativeLintConfigurationError("source_locked_files is not a list")
    locked = sorted(
        entry["path"]
        for entry in entries
        if isinstance(entry, dict) and isinstance(entry.get("path"), str)
    )
    tracked = set(python_paths)
    missing = sorted(set(locked) - tracked)
    if missing:
        raise NativeLintConfigurationError(
            f"locked Python paths are not tracked or newly added: {missing}"
        )
    native = sorted(tracked - set(locked))
    if not native:
        raise NativeLintConfigurationError("native Python path set is empty")
    return native, locked


def _pattern_matches(pattern: str, path: str) -> bool:
    pure_path = PurePosixPath(path)
    return (
        fnmatch.fnmatchcase(path, pattern)
        or pure_path.match(pattern)
        or fnmatch.fnmatchcase(pure_path.name, pattern)
        or path == pattern.rstrip("/")
        or path.startswith(f"{pattern.rstrip('/')}/")
    )


def validate_ruff_config(
    pyproject_path: Path,
    native_paths: list[str],
) -> list[str]:
    """Reject Ruff settings that can conceal findings in native files."""

    failures: list[str] = []
    try:
        payload = tomllib.loads(pyproject_path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return [f"Ruff configuration is missing: {pyproject_path}"]
    except tomllib.TOMLDecodeError as exc:
        return [f"Ruff configuration is invalid TOML: {exc}"]

    ruff = payload.get("tool", {}).get("ruff", {})
    if not isinstance(ruff, dict):
        return ["[tool.ruff] must be a TOML table"]
    lint = ruff.get("lint", {})
    if not isinstance(lint, dict):
        return ["[tool.ruff.lint] must be a TOML table"]

    selected = lint.get("select")
    if not isinstance(selected, list) or not REQUIRED_RUFF_RULE_FAMILIES.issubset(selected):
        failures.append(
            "Ruff select must include the E, F, I, and UP rule families for native files"
        )

    for key in ("ignore", "extend-ignore"):
        ignored = lint.get(key, [])
        if ignored:
            failures.append(f"Ruff {key} may not suppress native findings: {ignored!r}")

    exclusion_patterns: list[str] = []
    for key in ("exclude", "extend-exclude"):
        configured = ruff.get(key, [])
        if isinstance(configured, str):
            configured = [configured]
        if isinstance(configured, list):
            exclusion_patterns.extend(item for item in configured if isinstance(item, str))
    for pattern in exclusion_patterns:
        matches = [path for path in native_paths if _pattern_matches(pattern, path)]
        if matches:
            failures.append(f"Ruff exclusion {pattern!r} matches native Python path {matches[0]!r}")

    per_file_ignores = lint.get("per-file-ignores", {})
    if isinstance(per_file_ignores, dict):
        for pattern, ignored in per_file_ignores.items():
            if not ignored or not isinstance(pattern, str):
                continue
            matches = [path for path in native_paths if _pattern_matches(pattern, path)]
            if matches:
                failures.append(
                    f"Ruff per-file ignore {pattern!r} hides native path {matches[0]!r}"
                )
    elif per_file_ignores:
        failures.append("Ruff per-file-ignores must be a TOML table")

    return failures


def run_ruff_check(
    ruff_binary: str,
    paths: list[str],
    repository_root: Path,
) -> tuple[int, list[dict[str, Any]], str]:
    """Run Ruff check and return its status, parsed diagnostics, and stderr."""

    result = subprocess.run(
        [ruff_binary, "check", "--no-cache", "--output-format=json", *paths],
        cwd=repository_root,
        capture_output=True,
        text=True,
    )
    if result.returncode not in {0, 1}:
        raise NativeLintConfigurationError(
            f"Ruff check failed to execute (exit {result.returncode}): {result.stderr.strip()}"
        )
    try:
        diagnostics = json.loads(result.stdout or "[]")
    except json.JSONDecodeError as exc:
        raise NativeLintConfigurationError("Ruff did not return JSON diagnostics") from exc
    if not isinstance(diagnostics, list) or not all(
        isinstance(diagnostic, dict) for diagnostic in diagnostics
    ):
        raise NativeLintConfigurationError("Ruff diagnostics must be a JSON array of objects")
    return result.returncode, diagnostics, result.stderr


def run_ruff_format_check(
    ruff_binary: str,
    paths: list[str],
    repository_root: Path,
) -> tuple[int, str]:
    """Run Ruff format in check mode over native paths."""

    result = subprocess.run(
        [ruff_binary, "format", "--check", "--no-cache", *paths],
        cwd=repository_root,
        capture_output=True,
        text=True,
    )
    if result.returncode not in {0, 1}:
        raise NativeLintConfigurationError(
            f"Ruff format failed to execute (exit {result.returncode}): {result.stderr.strip()}"
        )
    return result.returncode, "\n".join(
        part.strip() for part in (result.stdout, result.stderr) if part.strip()
    )


def summarize_diagnostics(
    diagnostics: list[dict[str, Any]],
    repository_root: Path,
) -> list[str]:
    """Summarize Ruff diagnostics deterministically by rule and file."""

    by_rule: Counter[str] = Counter()
    by_file: defaultdict[str, Counter[str]] = defaultdict(Counter)
    for diagnostic in diagnostics:
        code = diagnostic.get("code")
        filename = diagnostic.get("filename")
        if not isinstance(code, str) or not code:
            code = "unknown"
        if not isinstance(filename, str) or not filename:
            filename = "<unknown>"
        file_path = Path(filename)
        if file_path.is_absolute():
            try:
                filename = file_path.relative_to(repository_root).as_posix()
            except ValueError:
                filename = file_path.as_posix()
        else:
            filename = PurePosixPath(filename).as_posix()
        by_rule[code] += 1
        by_file[filename][code] += 1

    lines = ["rules: " + ", ".join(f"{rule}={count}" for rule, count in sorted(by_rule.items()))]
    for filename, rule_counts in sorted(by_file.items()):
        details = ", ".join(f"{rule}={count}" for rule, count in sorted(rule_counts.items()))
        lines.append(f"files: {filename}: {details}")
    return lines


def _print_native_diagnostics(
    diagnostics: list[dict[str, Any]],
    repository_root: Path,
) -> None:
    for diagnostic in diagnostics:
        filename = diagnostic.get("filename", "<unknown>")
        file_path = Path(filename) if isinstance(filename, str) else Path("<unknown>")
        if file_path.is_absolute():
            try:
                filename = file_path.relative_to(repository_root).as_posix()
            except ValueError:
                filename = file_path.as_posix()
        location = diagnostic.get("location", {})
        row = location.get("row", "?") if isinstance(location, dict) else "?"
        column = location.get("column", "?") if isinstance(location, dict) else "?"
        code = diagnostic.get("code", "unknown")
        message = diagnostic.get("message", "")
        print(f"  {filename}:{row}:{column}: {code} {message}", file=sys.stderr)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--boundary", type=Path, default=DEFAULT_BOUNDARY)
    parser.add_argument("--pyproject", type=Path, default=DEFAULT_PYPROJECT)
    parser.add_argument("--ruff-binary", default="ruff")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    repository_root = REPOSITORY_ROOT
    boundary_path = (
        args.boundary if args.boundary.is_absolute() else repository_root / args.boundary
    )
    pyproject_path = (
        args.pyproject if args.pyproject.is_absolute() else repository_root / args.pyproject
    )

    try:
        payload = load_boundary(boundary_path)
        boundary_failures = validate_boundary(repository_root, payload)
        python_paths = discover_python_paths(repository_root)
        native_paths, locked_paths = classify_python_paths(python_paths, payload)
        config_failures = validate_ruff_config(pyproject_path, native_paths)
        failures = [*boundary_failures, *config_failures]
        if failures:
            raise NativeLintConfigurationError("\n".join(f"  - {item}" for item in failures))

        native_status, native_diagnostics, _ = run_ruff_check(
            args.ruff_binary,
            native_paths,
            repository_root,
        )
        format_status, format_report = run_ruff_format_check(
            args.ruff_binary,
            native_paths,
            repository_root,
        )
        _, locked_diagnostics, _ = run_ruff_check(
            args.ruff_binary,
            locked_paths,
            repository_root,
        )
    except (NativeLintConfigurationError, OSError, subprocess.SubprocessError) as exc:
        print(f"Native lint gate configuration failed:\n{exc}", file=sys.stderr)
        return 2

    native_failed = native_status != 0 or bool(native_diagnostics)
    if native_failed:
        print(
            f"Native Ruff check failed: {len(native_diagnostics)} finding(s) "
            f"across {len(native_paths)} files.",
            file=sys.stderr,
        )
        _print_native_diagnostics(native_diagnostics, repository_root)
    else:
        print(f"Native Ruff check passed: {len(native_paths)} files clean.")

    if format_status:
        print("Native Ruff format check failed:", file=sys.stderr)
        print(format_report, file=sys.stderr)
    else:
        print(f"Native Ruff format check passed: {len(native_paths)} files clean.")

    print(
        "Source-locked compatibility Ruff report: "
        f"{len(locked_diagnostics)} finding(s) across {len(locked_paths)} files "
        "(reported, not suppressed)."
    )
    if locked_diagnostics:
        for line in summarize_diagnostics(locked_diagnostics, repository_root):
            print(f"  {line}")

    return 1 if native_failed or format_status else 0


if __name__ == "__main__":
    raise SystemExit(main())
