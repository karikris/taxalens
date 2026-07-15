# DuckDB-Wasm Parquet extension

`parquet.duckdb_extension.wasm` is the signed DuckDB core
Parquet extension mirrored from:

`https://extensions.duckdb.org/v1.4.3/wasm_mvp/parquet.duckdb_extension.wasm`

- Uncompressed bytes: `2867304`
- SHA-256: `0785c6c95d003eff4faa7b3b4b660f02c9c92f6d68d135ddf330d42e3a650600`
- Runtime: DuckDB-Wasm package `1.32.0`, DuckDB engine `v1.4.3`, `wasm_mvp`
- License: DuckDB core and its Parquet extension are distributed under the MIT License.

Run `scripts/import_duckdb_wasm_extension.py --check` from the repository root
to verify the committed mirror. The Observatory loads this signed file from the
same origin so judge replay never contacts the public extension repository.
