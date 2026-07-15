import hashlib

from scripts.import_duckdb_wasm_extension import (
    DEFAULT_DESTINATION,
    EXTENSION_BYTES,
    EXTENSION_SHA256,
    import_duckdb_wasm_extension,
)


def test_committed_duckdb_parquet_extension_matches_the_pinned_signed_binary() -> None:
    path = import_duckdb_wasm_extension(check=True)

    assert path == DEFAULT_DESTINATION
    assert path.stat().st_size == EXTENSION_BYTES
    assert hashlib.sha256(path.read_bytes()).hexdigest() == EXTENSION_SHA256
