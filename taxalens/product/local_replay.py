"""Build, verify, and serve the credential-free TaxaLens judge replay."""

from __future__ import annotations

import hashlib
import http.client
import json
import re
import shutil
import subprocess
import threading
import time
import webbrowser
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path, PurePosixPath
from typing import Any, Protocol

from taxalens.product.truthful_demo_verifier import verify_truthful_demo

DEFAULT_LOCAL_REPLAY_PORT = 4173
DEFAULT_LOCAL_REPLAY_MANIFEST = Path("demo/fixture/papilio_pilot/judge_bundle.json")
_GIT_SHA = re.compile(r"[0-9a-f]{40}")


class LocalReplayError(RuntimeError):
    """A fail-closed local replay preparation or server error."""


@dataclass(frozen=True, slots=True)
class LocalReplayBuild:
    """Verified static replay identity and startup facts."""

    web_root: Path
    bundle_id: str
    current_taxalens_sha: str
    fixture_taxalens_sha: str
    biominer_sha: str
    artifact_count: int
    section_count: int
    unavailable_section_count: int
    total_section_record_count: int
    media_asset_count: int
    hero_record_id: str
    hero_state: str

    def startup_payload(self, *, url: str, open_requested: bool) -> dict[str, object]:
        """Return the public receipt printed before the server waits."""

        return {
            "status": "serving",
            "url": url,
            "open_requested": open_requested,
            "bundle_id": self.bundle_id,
            "taxalens_sha": self.current_taxalens_sha,
            "fixture_taxalens_sha": self.fixture_taxalens_sha,
            "biominer_sha": self.biominer_sha,
            "credentials_required": False,
            "expected_counts": {
                "artifacts": self.artifact_count,
                "sections": self.section_count,
                "unavailable_sections": self.unavailable_section_count,
                "section_records": self.total_section_record_count,
                "media_assets": self.media_asset_count,
            },
            "hero": {
                "record_id": self.hero_record_id,
                "state": self.hero_state,
            },
        }


class ReplayServer(Protocol):
    """Lifecycle used by the foreground CLI and deterministic tests."""

    @property
    def url(self) -> str: ...

    def start(self) -> None: ...

    def wait(self) -> None: ...

    def close(self) -> None: ...


class _QuietStaticHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format: str, *args: object) -> None:
        del args


class LocalReplayServer:
    """Loopback-only threaded static server with an explicit readiness gate."""

    def __init__(
        self,
        web_root: Path,
        port: int = DEFAULT_LOCAL_REPLAY_PORT,
        *,
        server_factory: Callable[..., ThreadingHTTPServer] = ThreadingHTTPServer,
    ) -> None:
        if not 0 <= port <= 65_535:
            raise LocalReplayError("local replay port must be from 0 through 65535")
        root = web_root.resolve()
        if not (root / "index.html").is_file():
            raise LocalReplayError(f"verified static replay is missing index.html: {root}")
        handler = partial(_QuietStaticHandler, directory=str(root))
        try:
            self._server = server_factory(("127.0.0.1", port), handler)
        except OSError as error:
            raise LocalReplayError(f"could not bind the local replay server: {error}") from error
        self._thread = threading.Thread(
            target=self._server.serve_forever,
            name="taxalens-local-replay",
            daemon=True,
        )
        self._started = False
        self._closed = False

    @property
    def url(self) -> str:
        host, port = self._server.server_address[:2]
        return f"http://{host}:{port}/"

    def start(self) -> None:
        if self._closed or self._started:
            raise LocalReplayError("local replay server cannot be started in its current state")
        self._thread.start()
        self._started = True
        self._wait_until_ready()

    def wait(self) -> None:
        if not self._started or self._closed:
            raise LocalReplayError("local replay server is not running")
        while self._thread.is_alive():
            self._thread.join(timeout=0.5)

    def close(self) -> None:
        if self._closed:
            return
        if self._started and self._thread.is_alive():
            self._server.shutdown()
        self._server.server_close()
        if self._started:
            self._thread.join(timeout=5)
        self._closed = True

    def _wait_until_ready(self, timeout: float = 5.0) -> None:
        host, port = self._server.server_address[:2]
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            connection = http.client.HTTPConnection(host, port, timeout=0.25)
            try:
                connection.request("HEAD", "/")
                response = connection.getresponse()
                response.read()
                if response.status == 200:
                    return
            except OSError:
                time.sleep(0.02)
            finally:
                connection.close()
        self.close()
        raise LocalReplayError("local replay server did not become ready within 5 seconds")


def prepare_local_replay(
    project_root: Path,
    manifest: Path = DEFAULT_LOCAL_REPLAY_MANIFEST,
    *,
    build_web: Callable[[Path], Path] | None = None,
) -> LocalReplayBuild:
    """Validate the fixture and production build before serving either."""

    root = project_root.resolve()
    manifest_path = _inside_root(root, manifest, "judge bundle manifest")
    verification = verify_truthful_demo(manifest_path)
    web_root = _inside_root(
        root,
        (build_web or _build_static_web)(root),
        "static replay build",
    )
    _verify_static_build_copy(manifest_path, web_root)
    current_sha = _current_taxalens_sha(root)
    return LocalReplayBuild(
        web_root=web_root,
        bundle_id=verification.bundle_id,
        current_taxalens_sha=current_sha,
        fixture_taxalens_sha=verification.taxalens_sha,
        biominer_sha=verification.biominer_sha,
        artifact_count=verification.artifact_count,
        section_count=verification.section_count,
        unavailable_section_count=verification.unavailable_section_count,
        total_section_record_count=verification.total_section_record_count,
        media_asset_count=verification.media_asset_count,
        hero_record_id=verification.hero_record_id,
        hero_state=verification.hero_state,
    )


def serve_local_replay(
    build: LocalReplayBuild,
    *,
    port: int = DEFAULT_LOCAL_REPLAY_PORT,
    open_browser: bool = False,
    browser_opener: Callable[[str], bool] = webbrowser.open,
    server_factory: Callable[[Path, int], ReplayServer] = LocalReplayServer,
) -> int:
    """Serve a verified build until interruption and optionally open a browser."""

    server = server_factory(build.web_root, port)
    try:
        server.start()
        print(
            json.dumps(
                build.startup_payload(url=server.url, open_requested=open_browser),
                indent=2,
                sort_keys=True,
            ),
            flush=True,
        )
        if open_browser:
            try:
                opened = browser_opener(server.url)
            except (OSError, webbrowser.Error):
                opened = False
            if not opened:
                print(
                    "Browser launch was unavailable; open the printed loopback URL manually.",
                    flush=True,
                )
        server.wait()
    except KeyboardInterrupt:
        print("TaxaLens local replay stopped.", flush=True)
    finally:
        server.close()
    return 0


def _build_static_web(root: Path) -> Path:
    npm = shutil.which("npm")
    if npm is None:
        raise LocalReplayError("npm is required to build the static judge replay")
    app_root = root / "apps" / "web"
    if not (app_root / "package.json").is_file() or not (
        app_root / "package-lock.json"
    ).is_file():
        raise LocalReplayError("the committed web package and lockfile are required")
    if not (app_root / "node_modules" / ".bin" / "vite").is_file():
        _run_web_command(
            [npm, "ci", "--no-audit", "--no-fund"],
            app_root,
            "install locked web dependencies",
        )
    _run_web_command(
        [npm, "run", "verify:build"],
        app_root,
        "build and verify the static replay",
    )
    return root / "dist" / "web"


def _run_web_command(command: list[str], cwd: Path, purpose: str) -> None:
    try:
        result = subprocess.run(command, cwd=cwd, check=False)
    except OSError as error:
        raise LocalReplayError(f"could not {purpose}: {error}") from error
    if result.returncode:
        raise LocalReplayError(f"could not {purpose}; command exited {result.returncode}")


def _verify_static_build_copy(source_manifest: Path, web_root: Path) -> None:
    root = web_root.resolve()
    index = root / "index.html"
    built_manifest = root / "judge_bundle.json"
    if not index.is_file() or index.is_symlink():
        raise LocalReplayError("static replay index.html is missing or unsafe")
    if not built_manifest.is_file() or built_manifest.is_symlink():
        raise LocalReplayError("static replay judge_bundle.json is missing or unsafe")
    source_bytes = source_manifest.read_bytes()
    if built_manifest.read_bytes() != source_bytes:
        raise LocalReplayError("static replay manifest differs from the verified source bundle")
    try:
        payload = json.loads(source_bytes)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise LocalReplayError("verified source bundle is not valid UTF-8 JSON") from error
    inventory = payload.get("artifact_inventory") if isinstance(payload, Mapping) else None
    if not isinstance(inventory, list):
        raise LocalReplayError("verified source bundle has no artifact inventory")
    for index_value, value in enumerate(inventory):
        if not isinstance(value, Mapping):
            raise LocalReplayError(f"artifact inventory item {index_value} is not an object")
        relative = _safe_inventory_path(value.get("path"), index_value)
        destination = root.joinpath(*relative.parts)
        if (
            not destination.resolve().is_relative_to(root)
            or not destination.is_file()
            or destination.is_symlink()
        ):
            raise LocalReplayError(f"static replay artifact is missing or unsafe: {relative}")
        content = destination.read_bytes()
        if len(content) != value.get("bytes") or hashlib.sha256(content).hexdigest() != value.get(
            "sha256"
        ):
            raise LocalReplayError(f"static replay artifact checksum differs: {relative}")


def _safe_inventory_path(value: Any, index: int) -> PurePosixPath:
    if not isinstance(value, str) or not value:
        raise LocalReplayError(f"artifact inventory item {index} has no path")
    relative = PurePosixPath(value)
    if relative.is_absolute() or ".." in relative.parts or "." in relative.parts:
        raise LocalReplayError(f"artifact inventory item {index} has an unsafe path")
    return relative


def _inside_root(root: Path, value: Path, label: str) -> Path:
    candidate = value if value.is_absolute() else root / value
    resolved = candidate.resolve()
    if not resolved.is_relative_to(root):
        raise LocalReplayError(f"{label} escapes the TaxaLens repository root")
    return resolved


def _current_taxalens_sha(root: Path) -> str:
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=root,
            check=False,
            capture_output=True,
            text=True,
        )
    except OSError as error:
        raise LocalReplayError(f"could not read the TaxaLens SHA: {error}") from error
    value = result.stdout.strip()
    if result.returncode or _GIT_SHA.fullmatch(value) is None:
        raise LocalReplayError("the local TaxaLens SHA is unavailable")
    return value


__all__ = [
    "DEFAULT_LOCAL_REPLAY_MANIFEST",
    "DEFAULT_LOCAL_REPLAY_PORT",
    "LocalReplayBuild",
    "LocalReplayError",
    "LocalReplayServer",
    "prepare_local_replay",
    "serve_local_replay",
]
