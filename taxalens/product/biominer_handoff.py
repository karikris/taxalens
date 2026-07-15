"""Safe consumer for BioMiner's committed content-addressed handoff contract."""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import tarfile
import tempfile
from collections.abc import Iterator, Mapping
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path, PurePosixPath
from typing import BinaryIO, cast
from urllib.parse import ParseResult, unquote, urlparse, urlunparse
from urllib.request import Request, urlopen

HANDOFF_INVENTORY_SCHEMA_VERSION = "storage-handoff-inventory-v1.0.0"
HANDOFF_IMPORT_RECEIPT_SCHEMA_VERSION = "taxalens-biominer-handoff-import-receipt:v1.0.0"
INTERNAL_INVENTORY_PATH = ".biominer-handoff/inventory.json"

_DIGEST_PATTERN = re.compile(r"(?:sha256:)?([0-9a-f]{64})\Z", re.IGNORECASE)
_INVENTORY_DIGEST_PATTERN = re.compile(r"sha256:([0-9a-f]{64})\Z")
_GIT_SHA_PATTERN = re.compile(r"[0-9a-f]{40}\Z")
_NAME_PATTERN = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]*\Z")
_CACHE_FILENAME = "biominer-handoff.sha256-{digest}.tar.gz"
_MAX_ARCHIVE_MEMBERS = 100_000
_MAX_INVENTORY_BYTES = 16 * 1024 * 1024
_CHUNK_SIZE = 1024 * 1024


class HandoffImportError(ValueError):
    """Raised when an archive, inventory, cache, or destination fails closed."""


@dataclass(frozen=True, slots=True)
class HandoffFile:
    """One payload declared by BioMiner's embedded inventory."""

    relative_path: str
    byte_count: int
    sha256: str


@dataclass(frozen=True, slots=True)
class HandoffInventory:
    """Validated BioMiner storage-handoff inventory."""

    name: str
    source_git_sha: str
    source_roots: tuple[str, ...]
    source_byte_count: int
    files: tuple[HandoffFile, ...]


@dataclass(frozen=True, slots=True)
class VerifiedHandoff:
    """Archive and inventory identity after full member verification."""

    archive_path: Path
    archive_sha256: str
    archive_byte_count: int
    inventory_sha256: str
    inventory: HandoffInventory


def import_biominer_handoff(
    *,
    expected_sha256: str,
    cache_dir: str | Path,
    destination: str | Path,
    receipt_path: str | Path,
    archive: str | Path | None = None,
    uri: str | None = None,
) -> dict[str, object]:
    """Import one explicit BioMiner handoff and return its persisted receipt."""

    if (archive is None) == (uri is None):
        raise HandoffImportError("provide exactly one of archive or uri")
    digest = normalize_sha256(expected_sha256)
    source_kind, source_locator = _source_identity(archive=archive, uri=uri)
    cache_path, cache_status, network_reads = _materialize_cache(
        expected_sha256=digest,
        cache_dir=Path(cache_dir),
        archive=archive,
        uri=uri,
    )
    verification = verify_biominer_handoff_archive(
        cache_path,
        expected_sha256=digest,
    )
    unresolved_destination = Path(destination)
    if unresolved_destination.is_symlink():
        raise HandoffImportError(f"destination must not be a symlink: {unresolved_destination}")
    destination_path = unresolved_destination.resolve()
    destination_status = _publish_verified_handoff(
        verification,
        destination_path,
    )
    receipt: dict[str, object] = {
        "schema_version": HANDOFF_IMPORT_RECEIPT_SCHEMA_VERSION,
        "status": "imported_and_locally_verified",
        "created_at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "source_kind": source_kind,
        "source_locator": source_locator,
        "expected_archive_sha256": f"sha256:{digest}",
        "archive_sha256": f"sha256:{verification.archive_sha256}",
        "archive_byte_count": verification.archive_byte_count,
        "cache_path": str(cache_path),
        "cache_status": cache_status,
        "network_read_streams": network_reads,
        "explicit_head_requests": 0,
        "explicit_list_requests": 0,
        "remote_prefix_discovery_performed": False,
        "inventory_schema_version": HANDOFF_INVENTORY_SCHEMA_VERSION,
        "inventory_sha256": f"sha256:{verification.inventory_sha256}",
        "handoff_name": verification.inventory.name,
        "biominer_source_git_sha": verification.inventory.source_git_sha,
        "source_roots": list(verification.inventory.source_roots),
        "file_count": len(verification.inventory.files),
        "source_byte_count": verification.inventory.source_byte_count,
        "destination": str(destination_path),
        "destination_status": destination_status,
        "verified_file_count": len(verification.inventory.files),
    }
    write_import_receipt(Path(receipt_path), receipt)
    return receipt


def verify_biominer_handoff_archive(
    archive: str | Path,
    *,
    expected_sha256: str,
) -> VerifiedHandoff:
    """Verify the archive digest, embedded inventory, member set, sizes, and hashes."""

    unresolved_archive = Path(archive)
    if unresolved_archive.is_symlink():
        raise HandoffImportError(f"handoff archive must not be a symlink: {unresolved_archive}")
    archive_path = unresolved_archive.resolve()
    if not archive_path.is_file():
        raise HandoffImportError(f"handoff archive is not a regular file: {archive_path}")
    expected = normalize_sha256(expected_sha256)
    actual = _sha256_file(archive_path)
    if actual != expected:
        raise HandoffImportError("handoff archive SHA-256 does not match expected value")
    try:
        with tarfile.open(archive_path, mode="r:gz") as opened:
            members = opened.getmembers()
            if len(members) > _MAX_ARCHIVE_MEMBERS:
                raise HandoffImportError("handoff archive has too many members")
            by_name: dict[str, tarfile.TarInfo] = {}
            for member in members:
                name = _safe_member_name(member.name)
                if name in by_name:
                    raise HandoffImportError(f"duplicate handoff archive member: {name}")
                if not member.isreg() or member.issym() or member.islnk():
                    raise HandoffImportError(f"unsupported handoff archive member type: {name}")
                if member.size < 0:
                    raise HandoffImportError(f"invalid handoff archive member size: {name}")
                by_name[name] = member
            inventory_member = by_name.pop(INTERNAL_INVENTORY_PATH, None)
            if inventory_member is None:
                raise HandoffImportError(f"handoff archive is missing {INTERNAL_INVENTORY_PATH}")
            if inventory_member.size > _MAX_INVENTORY_BYTES:
                raise HandoffImportError("handoff inventory exceeds the size limit")
            inventory_stream = opened.extractfile(inventory_member)
            if inventory_stream is None:
                raise HandoffImportError("handoff inventory is unreadable")
            inventory_bytes = inventory_stream.read(_MAX_INVENTORY_BYTES + 1)
            if len(inventory_bytes) > _MAX_INVENTORY_BYTES:
                raise HandoffImportError("handoff inventory exceeds the size limit")
            inventory = _parse_inventory(inventory_bytes)
            expected_names = {item.relative_path for item in inventory.files}
            if set(by_name) != expected_names:
                missing = sorted(expected_names - set(by_name))
                unexpected = sorted(set(by_name) - expected_names)
                raise HandoffImportError(
                    "handoff inventory differs from archive members; "
                    f"missing={missing}, unexpected={unexpected}"
                )
            for item in inventory.files:
                member = by_name[item.relative_path]
                if member.size != item.byte_count:
                    raise HandoffImportError(
                        f"handoff member byte count mismatch: {item.relative_path}"
                    )
                stream = opened.extractfile(member)
                if stream is None or _sha256_stream(stream) != item.sha256:
                    raise HandoffImportError(
                        f"handoff member SHA-256 mismatch: {item.relative_path}"
                    )
    except tarfile.TarError as error:
        raise HandoffImportError(f"invalid handoff tar archive: {error}") from error
    return VerifiedHandoff(
        archive_path=archive_path,
        archive_sha256=actual,
        archive_byte_count=archive_path.stat().st_size,
        inventory_sha256=hashlib.sha256(inventory_bytes).hexdigest(),
        inventory=inventory,
    )


def write_import_receipt(path: Path, receipt: Mapping[str, object]) -> None:
    """Write a canonical receipt atomically without following a destination symlink."""

    if path.is_symlink():
        raise HandoffImportError(f"receipt path must not be a symlink: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    content = _canonical_json(receipt)
    descriptor, temporary_name = tempfile.mkstemp(
        dir=path.parent,
        prefix=f".{path.name}.",
        suffix=".tmp",
    )
    temporary_path = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "wb") as output:
            output.write(content)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary_path, path)
        _fsync_directory(path.parent)
    finally:
        temporary_path.unlink(missing_ok=True)


def normalize_sha256(value: str) -> str:
    """Return a lowercase bare digest from bare or sha256-prefixed input."""

    match = _DIGEST_PATTERN.fullmatch(str(value).strip())
    if match is None:
        raise HandoffImportError("expected SHA-256 as 64 hexadecimal characters or sha256:<digest>")
    return match.group(1).lower()


def _source_identity(
    *,
    archive: str | Path | None,
    uri: str | None,
) -> tuple[str, str]:
    if archive is not None:
        return "local_archive", str(Path(archive).resolve())
    if uri is None:
        raise HandoffImportError("explicit URI is missing")
    parsed = _validate_explicit_uri(uri)
    return "explicit_uri", urlunparse(parsed._replace(query="", fragment=""))


def _materialize_cache(
    *,
    expected_sha256: str,
    cache_dir: Path,
    archive: str | Path | None,
    uri: str | None,
) -> tuple[Path, str, int]:
    if cache_dir.is_symlink():
        raise HandoffImportError(f"cache directory must not be a symlink: {cache_dir}")
    cache_root = cache_dir.resolve()
    cache_root.mkdir(parents=True, exist_ok=True)
    cache_path = cache_root / _CACHE_FILENAME.format(digest=expected_sha256)
    if cache_path.exists():
        if (
            cache_path.is_symlink()
            or not cache_path.is_file()
            or _sha256_file(cache_path) != expected_sha256
        ):
            raise HandoffImportError(f"cached handoff differs from expected SHA-256: {cache_path}")
        return cache_path, "verified_existing", 0

    descriptor, temporary_name = tempfile.mkstemp(
        dir=cache_root,
        prefix=f".{cache_path.name}.",
        suffix=".tmp",
    )
    temporary_path = Path(temporary_name)
    network_reads = 0
    try:
        with os.fdopen(descriptor, "wb") as output:
            if archive is not None:
                unresolved_source = Path(archive)
                if unresolved_source.is_symlink():
                    raise HandoffImportError(
                        f"local handoff archive must not be a symlink: {unresolved_source}"
                    )
                source_path = unresolved_source.resolve()
                if not source_path.is_file():
                    raise HandoffImportError(
                        f"local handoff archive is not a regular file: {source_path}"
                    )
                with source_path.open("rb") as source:
                    actual = _copy_and_hash(source, output)
                status = "copied_and_verified"
            else:
                if uri is None:
                    raise HandoffImportError("explicit URI is missing")
                with _open_explicit_uri(uri) as source:
                    actual = _copy_and_hash(source, output)
                parsed = _validate_explicit_uri(uri)
                network_reads = int(parsed.scheme == "https")
                status = "downloaded_and_verified"
            output.flush()
            os.fsync(output.fileno())
        if actual != expected_sha256:
            raise HandoffImportError("handoff archive SHA-256 does not match expected value")
        try:
            os.link(temporary_path, cache_path)
        except FileExistsError:
            if (
                cache_path.is_symlink()
                or not cache_path.is_file()
                or _sha256_file(cache_path) != expected_sha256
            ):
                raise HandoffImportError(
                    f"concurrent cached handoff differs from expected SHA-256: {cache_path}"
                ) from None
            status = "verified_existing"
        else:
            cache_path.chmod(0o444)
            _fsync_directory(cache_root)
        return cache_path, status, network_reads
    finally:
        temporary_path.unlink(missing_ok=True)


@contextmanager
def _open_explicit_uri(uri: str) -> Iterator[BinaryIO]:
    parsed = _validate_explicit_uri(uri)
    if parsed.scheme == "file":
        unresolved_path = Path(unquote(parsed.path))
        if unresolved_path.is_symlink():
            raise HandoffImportError(f"file URI must not identify a symlink: {unresolved_path}")
        path = unresolved_path.resolve()
        if not path.is_file():
            raise HandoffImportError(f"file URI is not a regular file: {path}")
        with path.open("rb") as stream:
            yield stream
        return
    request = Request(uri, headers={"User-Agent": "TaxaLens-Handoff-Importer/1"})
    with urlopen(request, timeout=60) as response:  # noqa: S310 - explicit HTTPS only
        final_uri = cast(str, getattr(response, "geturl", lambda: uri)())
        final_parsed = _validate_explicit_uri(final_uri)
        if final_parsed.scheme != "https":
            raise HandoffImportError("handoff URI redirected away from HTTPS")
        yield cast(BinaryIO, response)


def _validate_explicit_uri(uri: str) -> ParseResult:
    parsed = urlparse(str(uri))
    if parsed.scheme not in {"file", "https"}:
        raise HandoffImportError("handoff URI must use file:// or https://")
    if parsed.username is not None or parsed.password is not None:
        raise HandoffImportError("handoff URI must not contain user credentials")
    if parsed.fragment:
        raise HandoffImportError("handoff URI must not contain a fragment")
    if parsed.scheme == "file":
        if parsed.netloc not in {"", "localhost"} or not parsed.path:
            raise HandoffImportError("file URI must identify one local archive")
    elif not parsed.netloc or not parsed.path or parsed.path.endswith("/"):
        raise HandoffImportError("HTTPS URI must identify one explicit archive object")
    return parsed


def _parse_inventory(content: bytes) -> HandoffInventory:
    try:
        payload = json.loads(
            content,
            object_pairs_hook=_reject_duplicate_keys,
            parse_constant=_reject_non_json_constant,
        )
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise HandoffImportError(f"handoff inventory is not strict UTF-8 JSON: {error}") from error
    if not isinstance(payload, dict):
        raise HandoffImportError("handoff inventory must be a JSON object")
    if payload.get("schema_version") != HANDOFF_INVENTORY_SCHEMA_VERSION:
        raise HandoffImportError("unsupported BioMiner handoff inventory schema")
    name = payload.get("name")
    if not isinstance(name, str) or _NAME_PATTERN.fullmatch(name) is None:
        raise HandoffImportError("handoff inventory name has invalid syntax")
    source_git_sha = payload.get("source_git_sha")
    if not isinstance(source_git_sha, str) or _GIT_SHA_PATTERN.fullmatch(source_git_sha) is None:
        raise HandoffImportError("handoff inventory source_git_sha is invalid")
    raw_roots = payload.get("source_roots")
    if not isinstance(raw_roots, list) or not all(isinstance(item, str) for item in raw_roots):
        raise HandoffImportError("handoff inventory source_roots must be strings")
    source_roots = tuple(_safe_member_name(item) for item in raw_roots)
    if not source_roots or source_roots != tuple(sorted(set(source_roots))):
        raise HandoffImportError(
            "handoff inventory source_roots must be non-empty, unique, and sorted"
        )
    raw_files = payload.get("files")
    if not isinstance(raw_files, list) or not raw_files:
        raise HandoffImportError("handoff inventory files must be a non-empty array")
    files: list[HandoffFile] = []
    for index, raw_file in enumerate(raw_files):
        if not isinstance(raw_file, dict):
            raise HandoffImportError(f"handoff inventory files[{index}] must be an object")
        relative_path = _safe_member_name(raw_file.get("relative_path"))
        byte_count = raw_file.get("byte_count")
        if isinstance(byte_count, bool) or not isinstance(byte_count, int) or byte_count < 0:
            raise HandoffImportError(f"handoff inventory files[{index}].byte_count is invalid")
        raw_digest = raw_file.get("sha256")
        if not isinstance(raw_digest, str):
            raise HandoffImportError(f"handoff inventory files[{index}].sha256 is invalid")
        match = _INVENTORY_DIGEST_PATTERN.fullmatch(raw_digest)
        if match is None:
            raise HandoffImportError("BioMiner inventory member SHA-256 must use sha256:<digest>")
        if not any(
            relative_path == root or relative_path.startswith(f"{root}/") for root in source_roots
        ):
            raise HandoffImportError(
                f"handoff inventory file is outside declared source_roots: {relative_path}"
            )
        files.append(
            HandoffFile(
                relative_path=relative_path,
                byte_count=byte_count,
                sha256=match.group(1),
            )
        )
    paths = tuple(item.relative_path for item in files)
    if paths != tuple(sorted(set(paths))):
        raise HandoffImportError("handoff inventory file paths must be unique and sorted")
    file_count = payload.get("file_count")
    if isinstance(file_count, bool) or file_count != len(files):
        raise HandoffImportError("handoff inventory file_count is inconsistent")
    source_byte_count = payload.get("source_byte_count")
    expected_bytes = sum(item.byte_count for item in files)
    if isinstance(source_byte_count, bool) or source_byte_count != expected_bytes:
        raise HandoffImportError("handoff inventory source_byte_count is inconsistent")
    return HandoffInventory(
        name=name,
        source_git_sha=source_git_sha,
        source_roots=source_roots,
        source_byte_count=expected_bytes,
        files=tuple(files),
    )


def _publish_verified_handoff(
    verification: VerifiedHandoff,
    destination: Path,
) -> str:
    if destination.is_symlink():
        raise HandoffImportError(f"destination must not be a symlink: {destination}")
    if destination.exists():
        _verify_existing_destination(destination, verification.inventory.files)
        return "verified_existing"
    destination.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(
        tempfile.mkdtemp(
            dir=destination.parent,
            prefix=f".{destination.name}.staging-",
        )
    )
    try:
        with tarfile.open(verification.archive_path, mode="r:gz") as opened:
            by_name: dict[str, tarfile.TarInfo] = {}
            for member in opened.getmembers():
                name = _safe_member_name(member.name)
                if name in by_name:
                    raise HandoffImportError(
                        f"duplicate handoff archive member during extraction: {name}"
                    )
                if not member.isreg() or member.issym() or member.islnk():
                    raise HandoffImportError(
                        f"unsupported handoff member during extraction: {name}"
                    )
                by_name[name] = member
            expected_members = {
                INTERNAL_INVENTORY_PATH,
                *(item.relative_path for item in verification.inventory.files),
            }
            if set(by_name) != expected_members:
                raise HandoffImportError("handoff archive member set changed before extraction")
            for item in verification.inventory.files:
                target = staging.joinpath(*PurePosixPath(item.relative_path).parts)
                target.parent.mkdir(parents=True, exist_ok=True)
                stream = opened.extractfile(by_name[item.relative_path])
                if stream is None:
                    raise HandoffImportError(
                        f"handoff member became unreadable: {item.relative_path}"
                    )
                digest = hashlib.sha256()
                written = 0
                with target.open("xb") as output:
                    while chunk := stream.read(_CHUNK_SIZE):
                        written += len(chunk)
                        digest.update(chunk)
                        output.write(chunk)
                    output.flush()
                    os.fsync(output.fileno())
                if written != item.byte_count or digest.hexdigest() != item.sha256:
                    raise HandoffImportError(
                        f"extracted handoff member failed verification: {item.relative_path}"
                    )
        try:
            os.replace(staging, destination)
        except OSError:
            if not destination.exists():
                raise
            _verify_existing_destination(destination, verification.inventory.files)
            return "verified_existing"
        _fsync_directory(destination.parent)
        return "atomically_published"
    finally:
        if staging.exists():
            shutil.rmtree(staging)


def _verify_existing_destination(
    destination: Path,
    files: tuple[HandoffFile, ...],
) -> None:
    if not destination.is_dir() or destination.is_symlink():
        raise HandoffImportError(f"existing destination is not a regular directory: {destination}")
    actual_paths: set[str] = set()
    for candidate in destination.rglob("*"):
        if candidate.is_symlink():
            raise HandoffImportError(f"existing destination contains a symlink: {candidate}")
        if candidate.is_dir():
            continue
        if not candidate.is_file():
            raise HandoffImportError(
                f"existing destination contains a non-regular file: {candidate}"
            )
        actual_paths.add(candidate.relative_to(destination).as_posix())
    expected_paths = {item.relative_path for item in files}
    if actual_paths != expected_paths:
        raise HandoffImportError("existing destination file set differs from handoff")
    for item in files:
        path = destination.joinpath(*PurePosixPath(item.relative_path).parts)
        if path.stat().st_size != item.byte_count or _sha256_file(path) != item.sha256:
            raise HandoffImportError(
                f"existing destination file differs from handoff: {item.relative_path}"
            )


def _safe_member_name(value: object) -> str:
    if not isinstance(value, str):
        raise HandoffImportError("archive member path must be a string")
    name = value
    if not name or "\x00" in name or "\\" in name:
        raise HandoffImportError(f"unsafe handoff archive path: {name!r}")
    path = PurePosixPath(name)
    if path.is_absolute() or not path.parts or any(part in {"", ".", ".."} for part in path.parts):
        raise HandoffImportError(f"unsafe handoff archive path: {name!r}")
    if path.as_posix() != name:
        raise HandoffImportError(f"non-normalized handoff archive path: {name!r}")
    return name


def _copy_and_hash(source: BinaryIO, destination: BinaryIO) -> str:
    digest = hashlib.sha256()
    while chunk := source.read(_CHUNK_SIZE):
        digest.update(chunk)
        destination.write(chunk)
    return digest.hexdigest()


def _sha256_stream(stream: BinaryIO) -> str:
    digest = hashlib.sha256()
    while chunk := stream.read(_CHUNK_SIZE):
        digest.update(chunk)
    return digest.hexdigest()


def _sha256_file(path: Path) -> str:
    with path.open("rb") as stream:
        return _sha256_stream(stream)


def _canonical_json(payload: Mapping[str, object]) -> bytes:
    return (
        json.dumps(
            payload,
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
            allow_nan=False,
        )
        + "\n"
    ).encode("utf-8")


def _reject_duplicate_keys(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise HandoffImportError(f"duplicate handoff inventory key: {key}")
        result[key] = value
    return result


def _reject_non_json_constant(value: str) -> None:
    raise HandoffImportError(f"non-JSON numeric constant in handoff inventory: {value}")


def _fsync_directory(path: Path) -> None:
    try:
        descriptor = os.open(path, os.O_RDONLY)
    except OSError:
        return
    try:
        os.fsync(descriptor)
    except OSError:
        pass
    finally:
        os.close(descriptor)


__all__ = [
    "HANDOFF_IMPORT_RECEIPT_SCHEMA_VERSION",
    "HANDOFF_INVENTORY_SCHEMA_VERSION",
    "HandoffFile",
    "HandoffImportError",
    "HandoffInventory",
    "VerifiedHandoff",
    "import_biominer_handoff",
    "normalize_sha256",
    "verify_biominer_handoff_archive",
    "write_import_receipt",
]
