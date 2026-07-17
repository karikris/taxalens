import { describe, expect, it } from 'vitest'

import { syntheticGeographicQuery } from '../test/geographicImpactProjectFixture'
import type { GeographicImpactBrowserResult } from './geographicImpactAnalytics'
import {
  GeographicImpactQueryCache,
  geographicImpactQueryCacheKey,
} from './geographicImpactQueryCache'

describe('GeographicImpactQueryCache', () => {
  it('keys every evidence and analytical identity', () => {
    const base = geographicImpactQueryCacheKey('bundle:a', syntheticGeographicQuery)
    const variants = [
      ['bundle:b', syntheticGeographicQuery],
      ['bundle:a', changeEvidence('projectId', 'project:other')],
      ['bundle:a', changeEvidence('runId', 'run:other')],
      ['bundle:a', changeEvidence('targetAcceptedTaxonKey', 'gbif:other')],
      ['bundle:a', changeEvidence('baselineSnapshotId', 'baseline:other')],
      ['bundle:a', changeEvidence('flickrSnapshotId', 'flickr:other')],
      ['bundle:a', { ...syntheticGeographicQuery, spatialResolution: 7 }],
      [
        'bundle:a',
        { ...syntheticGeographicQuery, geographicScope: { level: 'global', id: 'global' } },
      ],
      ['bundle:a', { ...syntheticGeographicQuery, evidenceMode: 'baseline' }],
      ['bundle:a', { ...syntheticGeographicQuery, metric: 'review_backlog' }],
    ] as const

    expect(
      new Set(variants.map(([bundle, input]) => geographicImpactQueryCacheKey(bundle, input))).size,
    ).toBe(variants.length)
    for (const [bundle, input] of variants) {
      expect(geographicImpactQueryCacheKey(bundle, input)).not.toBe(base)
    }
  })

  it('evicts least-recently-used entries by count and total cell rows', () => {
    const cache = new GeographicImpactQueryCache({ maxEntries: 2, maxCellRows: 3 })
    cache.set('a', cachedResult(1))
    cache.set('b', cachedResult(1))
    expect(cache.get('a')).toBeDefined()
    cache.set('c', cachedResult(1))

    expect(cache.get('b')).toBeUndefined()
    expect(cache.get('a')?.engineering.cacheState).toBe('scoped_memory_cache_hit')
    expect(cache.get('c')).toBeDefined()
    cache.set('d', cachedResult(2))
    expect(cache.stats()).toMatchObject({ entries: 2, cellRows: 3, evictions: 2 })
  })

  it('does not retain a single result that exceeds its row budget', () => {
    const cache = new GeographicImpactQueryCache({ maxEntries: 2, maxCellRows: 1 })

    expect(cache.set('too-large', cachedResult(2))).toBe(false)
    expect(cache.stats()).toMatchObject({ entries: 0, cellRows: 0 })
  })
})

function changeEvidence(
  field: keyof typeof syntheticGeographicQuery.evidenceScope,
  value: string,
) {
  return {
    ...syntheticGeographicQuery,
    evidenceScope: { ...syntheticGeographicQuery.evidenceScope, [field]: value },
  }
}

function cachedResult(cellRows: number): GeographicImpactBrowserResult {
  return {
    cells: Object.freeze(Array.from({ length: cellRows }, () => Object.freeze({}))),
    engineering: Object.freeze({
      cacheState: 'fresh_duckdb_worker_memory_no_persistent_cache',
    }),
  } as unknown as GeographicImpactBrowserResult
}
