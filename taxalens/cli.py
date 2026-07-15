"""Credential-free command line entry points for the local TaxaLens checkout."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from collections.abc import Sequence
from pathlib import Path

from taxalens import __version__

_SHA_PATTERN = re.compile(r'(?m)^pinned_biominer_sha:\s*["\']([0-9a-f]{40})["\']\s*$')


def _project_root() -> Path:
    seeds = (Path.cwd(), Path(__file__).resolve().parents[1])
    checked: set[Path] = set()
    for seed in seeds:
        for candidate in (seed, *seed.parents):
            resolved = candidate.resolve()
            if resolved in checked:
                continue
            checked.add(resolved)
            if (resolved / "pyproject.toml").is_file() and (
                resolved / "provenance" / "biominer_migration_manifest.yaml"
            ).is_file():
                return resolved
    raise RuntimeError(
        "TaxaLens repository root not found; run from a TaxaLens checkout "
        "or set the working directory"
    )


def _git_sha(root: Path) -> str | None:
    result = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=root,
        check=False,
        capture_output=True,
        text=True,
    )
    value = result.stdout.strip()
    return value if result.returncode == 0 and re.fullmatch(r"[0-9a-f]{40}", value) else None


def _biominer_sha(root: Path) -> str | None:
    manifest = root / "provenance" / "biominer_migration_manifest.yaml"
    match = _SHA_PATTERN.search(manifest.read_text(encoding="utf-8"))
    return match.group(1) if match else None


def _run_script(root: Path, relative_path: str, *arguments: str) -> int:
    script = root / relative_path
    if not script.is_file():
        print(f"Required TaxaLens script is unavailable: {script}", file=sys.stderr)
        return 2
    result = subprocess.run(
        [sys.executable, "-B", str(script), *arguments],
        cwd=root,
        check=False,
    )
    return result.returncode


def _doctor(_args: argparse.Namespace) -> int:
    try:
        root = _project_root()
    except RuntimeError as error:
        print(json.dumps({"status": "unavailable", "reason": str(error)}, sort_keys=True))
        return 2
    required = (
        "AGENTS.md",
        "demo/manifests/demo_manifest.example.json",
        "provenance/biominer_migration_manifest.yaml",
        "scripts/verify_demo.py",
        "scripts/verify_provenance.py",
    )
    missing = [relative for relative in required if not (root / relative).is_file()]
    payload = {
        "status": "ok" if not missing else "unavailable",
        "taxalens_version": __version__,
        "python": ".".join(str(value) for value in sys.version_info[:3]),
        "python_supported": sys.version_info >= (3, 11),
        "repository_root": str(root),
        "taxalens_sha": _git_sha(root),
        "biominer_sha": _biominer_sha(root),
        "credentials_required": False,
        "gpu_required": False,
        "model_download_required": False,
        "missing": missing,
    }
    print(json.dumps(payload, indent=2, sort_keys=True))
    return 0 if payload["status"] == "ok" and payload["python_supported"] else 2


def _demo_verify(args: argparse.Namespace) -> int:
    root = _project_root()
    return _run_script(root, "scripts/verify_demo.py", args.manifest)


def _demo_build(args: argparse.Namespace) -> int:
    root = _project_root()
    verification = _run_script(root, "scripts/verify_demo.py", args.manifest)
    if verification:
        return verification
    payload = {
        "status": "verified_existing_fixture",
        "manifest": args.manifest,
        "scientific_claim_allowed": False,
        "note": (
            "The current artifact is a contract-smoke fixture; the truthful "
            "Papilio judge bundle is not built yet."
        ),
    }
    print(json.dumps(payload, indent=2, sort_keys=True))
    return 0


def _demo_replay(args: argparse.Namespace) -> int:
    payload = {
        "status": "unavailable",
        "open_requested": bool(args.open),
        "reason": (
            "The judge web application is not implemented yet; complete Task 9.1 "
            "before claiming local replay."
        ),
    }
    print(json.dumps(payload, indent=2, sort_keys=True))
    return 2


def _provenance_verify(args: argparse.Namespace) -> int:
    root = _project_root()
    return _run_script(
        root,
        "scripts/verify_provenance.py",
        "--manifest",
        args.manifest,
        "--upstream",
        args.upstream,
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="taxalens",
        description="TaxaLens deterministic evidence replay tooling.",
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    commands = parser.add_subparsers(dest="command", required=True)

    doctor = commands.add_parser(
        "doctor",
        help="Inspect the credential-free local replay environment",
    )
    doctor.set_defaults(handler=_doctor)

    demo = commands.add_parser("demo", help="Verify, build, or replay committed demo evidence")
    demo_commands = demo.add_subparsers(dest="demo_command", required=True)

    verify = demo_commands.add_parser("verify", help="Verify a committed demo manifest")
    verify.add_argument("manifest", nargs="?", default="demo/manifests/demo_manifest.example.json")
    verify.set_defaults(handler=_demo_verify)

    build = demo_commands.add_parser("build", help="Validate the currently committed demo fixture")
    build.add_argument("manifest", nargs="?", default="demo/manifests/demo_manifest.example.json")
    build.set_defaults(handler=_demo_build)

    replay = demo_commands.add_parser("replay", help="Start the local judge replay when available")
    replay.add_argument("--open", action="store_true", help="Open the replay in a browser")
    replay.set_defaults(handler=_demo_replay)

    provenance = commands.add_parser("provenance", help="Inspect TaxaLens provenance")
    provenance_commands = provenance.add_subparsers(dest="provenance_command", required=True)
    provenance_verify = provenance_commands.add_parser("verify", help="Verify migration provenance")
    provenance_verify.add_argument(
        "--manifest",
        default="provenance/biominer_migration_manifest.yaml",
    )
    provenance_verify.add_argument("--upstream", default="UPSTREAM_BIOMINER.md")
    provenance_verify.set_defaults(handler=_provenance_verify)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return int(args.handler(args))


def entrypoint() -> None:
    raise SystemExit(main())


__all__ = ["build_parser", "entrypoint", "main"]
