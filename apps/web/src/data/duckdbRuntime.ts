import duckdbEhWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url'
import duckdbEhWasm from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url'
import parquetExtensionUrl from './vendor/parquet.duckdb_extension.wasm?url'

export const DUCKDB_RUNTIME_MODE = 'lazy-browser-only' as const
export const DUCKDB_WASM_PACKAGE_VERSION = '1.32.0' as const
export const DUCKDB_ENGINE_VERSION = 'v1.4.3' as const
export const PARQUET_EXTENSION_SHA256 =
  '0785c6c95d003eff4faa7b3b4b660f02c9c92f6d68d135ddf330d42e3a650600' as const
export const PARQUET_EXTENSION_BYTES = 2_867_304 as const

export type DuckDbWasmModule = typeof import('@duckdb/duckdb-wasm')

/**
 * Load the analytics engine only when a later evidence view needs SQL.
 * The static shell and JSON bootstrap never start a worker or contact a CDN.
 */
export async function loadDuckDbRuntime(): Promise<DuckDbWasmModule> {
  if (typeof WebAssembly === 'undefined') {
    throw new Error('WebAssembly is unavailable; DuckDB-Wasm inspection cannot start.')
  }
  return import('@duckdb/duckdb-wasm')
}

export async function createDuckDbRuntime() {
  const duckdb = await loadDuckDbRuntime()
  const bundle: import('@duckdb/duckdb-wasm').DuckDBBundle = {
    mainModule: duckdbEhWasm,
    mainWorker: duckdbEhWorker,
    pthreadWorker: null,
  }
  const worker = new Worker(duckdbEhWorker)
  const database = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker)
  try {
    await database.instantiate(bundle.mainModule, bundle.pthreadWorker)
  } catch (error) {
    worker.terminate()
    throw error
  }
  return { database, worker }
}

function hex(bytes: Uint8Array<ArrayBuffer>): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function loadLocalParquetExtension(): Promise<string> {
  const url = new URL(parquetExtensionUrl, window.location.href)
  if (url.origin !== window.location.origin) {
    throw new Error('DuckDB Parquet extension must be loaded from the application origin')
  }
  const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin' })
  if (!response.ok) {
    throw new Error(`Local DuckDB Parquet extension returned HTTP ${response.status}`)
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength !== PARQUET_EXTENSION_BYTES) {
    throw new Error('Local DuckDB Parquet extension byte count differs')
  }
  const digest = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
  if (digest !== PARQUET_EXTENSION_SHA256) {
    throw new Error('Local DuckDB Parquet extension checksum differs')
  }
  return url.href
}
