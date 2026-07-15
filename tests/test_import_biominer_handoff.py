from __future__ import annotations

import hashlib
import io
import json
import tarfile
from pathlib import Path

import pytest
import taxalens.product.biominer_handoff as handoff_module
from scripts.import_biominer_handoff import main
from taxalens.product import (
    HANDOFF_IMPORT_RECEIPT_SCHEMA_VERSION,
    HANDOFF_INVENTORY_SCHEMA_VERSION,
    HandoffImportError,
    import_biominer_handoff,
    verify_biominer_handoff_archive,
)

BIOMINER_SHA = "75461d9c065af0cd96b41cd1f845c2e920f7ae34"


def _canonical_json(value: object) -> bytes:
    return (
        json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n"
    ).encode()


def _write_member(
    opened: tarfile.TarFile,
    name: str,
    content: bytes,
    *,
    member_type: bytes | None = None,
) -> None:
    info = tarfile.TarInfo(name)
    info.size = len(content)
    info.mtime = 0
    info.mode = 0o644
    if member_type is not None:
        info.type = member_type
        info.size = 0
        info.linkname = "runs/pilot/one.json"
        opened.addfile(info)
        return
    opened.addfile(info, io.BytesIO(content))


def _build_handoff(
    root: Path,
    *,
    files: dict[str, bytes] | None = None,
    inventory_files: dict[str, bytes] | None = None,
    extra_member: tuple[str, bytes, bytes | None] | None = None,
    inventory_overrides: dict[str, object] | None = None,
) -> tuple[Path, str]:
    actual_files = files or {
        "config/pilot.json": b'{"phase":14}\n',
        "runs/pilot/one.json": b'{"candidate":true}\n',
    }
    declared_files = inventory_files or actual_files
    rows = [
        {
            "relative_path": name,
            "byte_count": len(content),
            "sha256": f"sha256:{hashlib.sha256(content).hexdigest()}",
        }
        for name, content in sorted(declared_files.items())
    ]
    inventory: dict[str, object] = {
        "schema_version": HANDOFF_INVENTORY_SCHEMA_VERSION,
        "name": "papilio-phase14",
        "source_git_sha": BIOMINER_SHA,
        "source_roots": ["config/pilot.json", "runs/pilot"],
        "file_count": len(rows),
        "source_byte_count": sum(len(content) for content in declared_files.values()),
        "files": rows,
    }
    if inventory_overrides:
        inventory.update(inventory_overrides)
    root.mkdir(parents=True, exist_ok=True)
    archive = root / "handoff.tar.gz"
    with tarfile.open(archive, mode="w:gz") as opened:
        for name, content in sorted(actual_files.items()):
            _write_member(opened, name, content)
        if extra_member is not None:
            _write_member(opened, *extra_member[:2], member_type=extra_member[2])
        _write_member(
            opened,
            ".biominer-handoff/inventory.json",
            _canonical_json(inventory),
        )
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    return archive, digest


def _import(
    root: Path,
    archive: Path,
    digest: str,
    *,
    uri: str | None = None,
) -> dict[str, object]:
    return import_biominer_handoff(
        archive=None if uri else archive,
        uri=uri,
        expected_sha256=digest,
        cache_dir=root / "cache",
        destination=root / "imported",
        receipt_path=root / "receipt.json",
    )


def test_local_import_verifies_inventory_extracts_atomically_and_writes_receipt(
    tmp_path: Path,
) -> None:
    archive, digest = _build_handoff(tmp_path / "source")

    receipt = _import(tmp_path, archive, digest)

    assert receipt["schema_version"] == HANDOFF_IMPORT_RECEIPT_SCHEMA_VERSION
    assert receipt["status"] == "imported_and_locally_verified"
    assert receipt["source_kind"] == "local_archive"
    assert receipt["archive_sha256"] == f"sha256:{digest}"
    assert receipt["biominer_source_git_sha"] == BIOMINER_SHA
    assert receipt["source_roots"] == ["config/pilot.json", "runs/pilot"]
    assert receipt["file_count"] == 2
    assert receipt["destination_status"] == "atomically_published"
    assert receipt["explicit_list_requests"] == 0
    assert receipt["remote_prefix_discovery_performed"] is False
    assert (tmp_path / "imported/config/pilot.json").read_bytes() == b'{"phase":14}\n'
    assert (tmp_path / "imported/runs/pilot/one.json").read_bytes() == (b'{"candidate":true}\n')
    assert not list(tmp_path.glob(".imported.staging-*"))
    assert json.loads((tmp_path / "receipt.json").read_text(encoding="utf-8")) == receipt


def test_verified_cache_and_destination_are_reused_without_source_access(
    tmp_path: Path,
) -> None:
    archive, digest = _build_handoff(tmp_path / "source")
    first = _import(tmp_path, archive, digest)
    archive.unlink()

    second = import_biominer_handoff(
        archive=archive,
        expected_sha256=f"sha256:{digest}",
        cache_dir=tmp_path / "cache",
        destination=tmp_path / "imported",
        receipt_path=tmp_path / "receipt-second.json",
    )

    assert first["cache_status"] == "copied_and_verified"
    assert second["cache_status"] == "verified_existing"
    assert second["destination_status"] == "verified_existing"
    assert second["network_read_streams"] == 0


def test_explicit_https_uri_reads_exactly_one_object_and_never_lists(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    archive, digest = _build_handoff(tmp_path / "source")
    archive_bytes = archive.read_bytes()
    calls: list[tuple[object, int]] = []

    def fake_urlopen(request: object, timeout: int):
        calls.append((request, timeout))
        return io.BytesIO(archive_bytes)

    monkeypatch.setattr(handoff_module, "urlopen", fake_urlopen)

    receipt = _import(
        tmp_path,
        archive,
        digest,
        uri="https://artifacts.example.test/handoffs/papilio.tar.gz?token=redacted",
    )

    assert len(calls) == 1
    assert receipt["source_kind"] == "explicit_uri"
    assert receipt["source_locator"] == ("https://artifacts.example.test/handoffs/papilio.tar.gz")
    assert receipt["network_read_streams"] == 1
    assert receipt["explicit_head_requests"] == 0
    assert receipt["explicit_list_requests"] == 0


def test_file_uri_is_supported_without_network_reads(tmp_path: Path) -> None:
    archive, digest = _build_handoff(tmp_path / "source")

    receipt = _import(tmp_path, archive, digest, uri=archive.resolve().as_uri())

    assert receipt["source_kind"] == "explicit_uri"
    assert receipt["network_read_streams"] == 0
    assert receipt["cache_status"] == "downloaded_and_verified"


def test_wrong_archive_digest_fails_before_cache_or_destination_publication(
    tmp_path: Path,
) -> None:
    archive, _ = _build_handoff(tmp_path / "source")

    with pytest.raises(HandoffImportError, match="SHA-256"):
        _import(tmp_path, archive, "0" * 64)

    assert not (tmp_path / "imported").exists()
    assert not list((tmp_path / "cache").glob("*.tar.gz"))


@pytest.mark.parametrize(
    ("files", "inventory_files", "extra_member", "message"),
    [
        (
            {"config/pilot.json": b"tampered\n", "runs/pilot/one.json": b"one\n"},
            {"config/pilot.json": b"declared\n", "runs/pilot/one.json": b"one\n"},
            None,
            "byte count mismatch|SHA-256 mismatch",
        ),
        (
            None,
            None,
            ("runs/pilot/extra.json", b"extra\n", None),
            "inventory differs from archive members",
        ),
    ],
)
def test_embedded_inventory_and_every_member_are_verified(
    tmp_path: Path,
    files: dict[str, bytes] | None,
    inventory_files: dict[str, bytes] | None,
    extra_member: tuple[str, bytes, bytes | None] | None,
    message: str,
) -> None:
    archive, digest = _build_handoff(
        tmp_path / "source",
        files=files,
        inventory_files=inventory_files,
        extra_member=extra_member,
    )

    with pytest.raises(HandoffImportError, match=message):
        verify_biominer_handoff_archive(archive, expected_sha256=digest)


@pytest.mark.parametrize(
    ("member_name", "member_type", "message"),
    [
        ("../escape.json", None, "unsafe handoff archive path"),
        ("runs/pilot/link.json", tarfile.SYMTYPE, "unsupported handoff archive member"),
    ],
)
def test_unsafe_paths_and_links_are_rejected(
    tmp_path: Path,
    member_name: str,
    member_type: bytes | None,
    message: str,
) -> None:
    archive, digest = _build_handoff(
        tmp_path / "source",
        extra_member=(member_name, b"", member_type),
    )

    with pytest.raises(HandoffImportError, match=message):
        verify_biominer_handoff_archive(archive, expected_sha256=digest)


def test_tampered_existing_destination_and_cache_fail_closed(tmp_path: Path) -> None:
    archive, digest = _build_handoff(tmp_path / "source")
    _import(tmp_path, archive, digest)
    (tmp_path / "imported/config/pilot.json").write_text("different\n", encoding="utf-8")
    with pytest.raises(HandoffImportError, match="existing destination file differs"):
        _import(tmp_path, archive, digest)

    other_root = tmp_path / "bad-cache"
    cache = other_root / "cache"
    cache.mkdir(parents=True)
    (cache / f"biominer-handoff.sha256-{digest}.tar.gz").write_bytes(b"different")
    with pytest.raises(HandoffImportError, match="cached handoff differs"):
        _import(other_root, archive, digest)


@pytest.mark.parametrize(
    "uri",
    [
        "s3://bucket/prefix/archive.tar.gz",
        "http://example.test/archive.tar.gz",
        "https://example.test/a-prefix/",
        "https://user:secret@example.test/archive.tar.gz",
    ],
)
def test_uri_must_be_one_explicit_credential_free_object(
    tmp_path: Path,
    uri: str,
) -> None:
    with pytest.raises(HandoffImportError):
        import_biominer_handoff(
            uri=uri,
            expected_sha256="0" * 64,
            cache_dir=tmp_path / "cache",
            destination=tmp_path / "destination",
            receipt_path=tmp_path / "receipt.json",
        )


def test_cli_imports_local_archive_and_prints_the_same_receipt(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    archive, digest = _build_handoff(tmp_path / "source")
    receipt_path = tmp_path / "receipt.json"

    exit_code = main(
        [
            "--archive",
            str(archive),
            "--sha256",
            digest,
            "--cache-dir",
            str(tmp_path / "cache"),
            "--destination",
            str(tmp_path / "imported"),
            "--receipt",
            str(receipt_path),
        ]
    )

    printed = json.loads(capsys.readouterr().out)
    persisted = json.loads(receipt_path.read_text(encoding="utf-8"))
    assert exit_code == 0
    assert printed == persisted
    assert printed["biominer_source_git_sha"] == BIOMINER_SHA
