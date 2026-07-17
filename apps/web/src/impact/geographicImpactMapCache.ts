export interface GeographicImpactMapCacheOptions {
  readonly maxEntries?: number
  readonly maxCellRows?: number
}

export interface GeographicImpactMapCacheValue {
  readonly cells: readonly unknown[]
}

export interface GeographicImpactMapCacheStats {
  readonly entries: number
  readonly cellRows: number
  readonly evictions: number
  readonly maxEntries: number
  readonly maxCellRows: number
}

interface CacheEntry<Value extends GeographicImpactMapCacheValue> {
  readonly value: Value
  readonly cellRows: number
}

const DEFAULT_MAX_ENTRIES = 8
const DEFAULT_MAX_CELL_ROWS = 30_000

/** A bounded LRU for verified, decoded map scopes owned by one mounted lens. */
export class GeographicImpactMapCache<Value extends GeographicImpactMapCacheValue> {
  readonly #maxEntries: number
  readonly #maxCellRows: number
  readonly #entries = new Map<string, CacheEntry<Value>>()
  #cellRows = 0
  #evictions = 0

  constructor(options: GeographicImpactMapCacheOptions = {}) {
    this.#maxEntries = positiveInteger(options.maxEntries ?? DEFAULT_MAX_ENTRIES, 'maxEntries')
    this.#maxCellRows = positiveInteger(
      options.maxCellRows ?? DEFAULT_MAX_CELL_ROWS,
      'maxCellRows',
    )
  }

  get(key: string): Value | undefined {
    const entry = this.#entries.get(key)
    if (entry === undefined) return undefined
    this.#entries.delete(key)
    this.#entries.set(key, entry)
    return entry.value
  }

  set(key: string, value: Value): boolean {
    if (value.cells.length > this.#maxCellRows) return false
    const existing = this.#entries.get(key)
    if (existing !== undefined) {
      this.#entries.delete(key)
      this.#cellRows -= existing.cellRows
    }
    const entry = Object.freeze({ value, cellRows: value.cells.length })
    this.#entries.set(key, entry)
    this.#cellRows += entry.cellRows
    this.#evictToBounds()
    return this.#entries.has(key)
  }

  stats(): GeographicImpactMapCacheStats {
    return Object.freeze({
      entries: this.#entries.size,
      cellRows: this.#cellRows,
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

function positiveInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${field} must be a positive safe integer`)
  }
  return value
}
