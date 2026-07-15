export const DUCKDB_RUNTIME_MODE = 'lazy-browser-only' as const
export const DUCKDB_WASM_PACKAGE_VERSION = '1.32.0' as const

export type DuckDbWasmModule = typeof import('@duckdb/duckdb-wasm')

/**
 * Load the analytics engine only when a later evidence view needs SQL.
 * The static shell and JSON bootstrap never start a worker or contact a CDN.
 */
export async function loadDuckDbRuntime(): Promise<DuckDbWasmModule> {
  return import('@duckdb/duckdb-wasm')
}
