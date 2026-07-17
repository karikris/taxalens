import type { GeographicImpactBrowserResult } from './geographicImpactAnalytics'
import type { GeographicImpactQueryInput } from './geographicImpactQuery'

export interface GeographicImpactQueryCacheOptions {
  readonly maxEntries?: number
  readonly maxCellRows?: number
}

export interface GeographicImpactQueryCacheStats {
  readonly entries: number
  readonly cellRows: number
  readonly hits: number
  readonly misses: number
  readonly evictions: number
  readonly maxEntries: number
  readonly maxCellRows: number
}

interface CacheEntry {
  readonly result: GeographicImpactBrowserResult
  readonly cellRows: number
}

const DEFAULT_MAX_ENTRIES = 6
const DEFAULT_MAX_CELL_ROWS = 60_000

/** A bounded per-controller LRU cache; no result is persisted or shared globally. */
export class GeographicImpactQueryCache {
  readonly #maxEntries: number
  readonly #maxCellRows: number
  readonly #entries = new Map<string, CacheEntry>()
  #cellRows = 0
  #hits = 0
  #misses = 0
  #evictions = 0

  constructor(options: GeographicImpactQueryCacheOptions = {}) {
    this.#maxEntries = positiveInteger(options.maxEntries ?? DEFAULT_MAX_ENTRIES, 'maxEntries')
    this.#maxCellRows = positiveInteger(
      options.maxCellRows ?? DEFAULT_MAX_CELL_ROWS,
      'maxCellRows',
    )
  }

  get(key: string): GeographicImpactBrowserResult | undefined {
    const entry = this.#entries.get(key)
    if (entry === undefined) {
      this.#misses += 1
      return undefined
    }
    this.#entries.delete(key)
    this.#entries.set(key, entry)
    this.#hits += 1
    return cacheHitResult(entry.result)
  }

  set(key: string, result: GeographicImpactBrowserResult): boolean {
    if (result.cells.length > this.#maxCellRows) return false
    const existing = this.#entries.get(key)
    if (existing !== undefined) {
      this.#entries.delete(key)
      this.#cellRows -= existing.cellRows
    }
    const entry = Object.freeze({ result, cellRows: result.cells.length })
    this.#entries.set(key, entry)
    this.#cellRows += entry.cellRows
    this.#evictToBounds()
    return this.#entries.has(key)
  }

  clear(): void {
    this.#entries.clear()
    this.#cellRows = 0
  }

  stats(): GeographicImpactQueryCacheStats {
    return Object.freeze({
      entries: this.#entries.size,
      cellRows: this.#cellRows,
      hits: this.#hits,
      misses: this.#misses,
      evictions: this.#evictions,
      maxEntries: this.#maxEntries,
      maxCellRows: this.#maxCellRows,
    })
  }

  #evictToBounds(): void {
    while (this.#entries.size > this.#maxEntries || this.#cellRows > this.#maxCellRows) {
      const oldestKey = this.#entries.keys().next().value as string | undefined
      if (oldestKey === undefined) return
      const oldest = this.#entries.get(oldestKey)
      this.#entries.delete(oldestKey)
      if (oldest !== undefined) this.#cellRows -= oldest.cellRows
      this.#evictions += 1
    }
  }
}

export function geographicImpactQueryCacheKey(
  bundleId: string,
  input: GeographicImpactQueryInput,
): string {
  if (bundleId.length === 0 || bundleId.trim() !== bundleId) {
    throw new Error('Geographic Impact cache requires a canonical bundle ID.')
  }
  const evidence = input.evidenceScope
  return JSON.stringify([
    bundleId,
    evidence.projectId,
    evidence.runId,
    evidence.targetAcceptedTaxonKey,
    evidence.baselineSnapshotId,
    evidence.flickrSnapshotId,
    input.geographicScope.level,
    input.geographicScope.id,
    input.spatialResolution,
    input.evidenceMode,
    input.metric,
  ])
}

function cacheHitResult(result: GeographicImpactBrowserResult): GeographicImpactBrowserResult {
  return Object.freeze({
    ...result,
    engineering: Object.freeze({
      ...result.engineering,
      cacheState: 'scoped_memory_cache_hit',
    }),
  })
}

function positiveInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${field} must be a positive safe integer`)
  }
  return value
}
