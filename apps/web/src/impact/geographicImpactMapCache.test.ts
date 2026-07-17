import { describe, expect, it } from 'vitest'

import { GeographicImpactMapCache } from './geographicImpactMapCache'

describe('GeographicImpactMapCache', () => {
  it('returns verified scope values and refreshes their LRU position', () => {
    const cache = new GeographicImpactMapCache<{ readonly cells: readonly number[] }>({
      maxEntries: 2,
      maxCellRows: 4,
    })
    const global = Object.freeze({ cells: Object.freeze([1]) })
    const asia = Object.freeze({ cells: Object.freeze([2]) })
    const india = Object.freeze({ cells: Object.freeze([3]) })

    expect(cache.set('global', global)).toBe(true)
    expect(cache.set('asia', asia)).toBe(true)
    expect(cache.get('global')).toBe(global)
    expect(cache.set('india', india)).toBe(true)

    expect(cache.get('asia')).toBeUndefined()
    expect(cache.get('global')).toBe(global)
    expect(cache.get('india')).toBe(india)
    expect(cache.stats()).toMatchObject({ entries: 2, cellRows: 2, evictions: 1 })
  })

  it('bounds retained decoded rows and rejects an individually oversized scope', () => {
    const cache = new GeographicImpactMapCache<{ readonly cells: readonly number[] }>({
      maxEntries: 4,
      maxCellRows: 3,
    })

    expect(cache.set('first', { cells: [1, 2] })).toBe(true)
    expect(cache.set('second', { cells: [3, 4] })).toBe(true)
    expect(cache.get('first')).toBeUndefined()
    expect(cache.set('oversized', { cells: [1, 2, 3, 4] })).toBe(false)
    expect(cache.stats()).toMatchObject({ entries: 1, cellRows: 2, evictions: 1 })
  })

  it('requires positive finite cache bounds', () => {
    expect(() => new GeographicImpactMapCache({ maxEntries: 0 })).toThrow(
      /maxEntries must be a positive safe integer/u,
    )
    expect(() => new GeographicImpactMapCache({ maxCellRows: Number.NaN })).toThrow(
      /maxCellRows must be a positive safe integer/u,
    )
  })
})
