import { describe, expect, it, vi } from 'vitest'

import {
  createSyntheticGeographicProject,
  syntheticGeographicQuery,
} from '../test/geographicImpactProjectFixture'
import {
  loadGeographicImpactQuerySources,
  registerGeographicImpactQuerySources,
} from './geographicImpactSources'

describe('geographic impact query sources', () => {
  it('binds semantic roles to manifest-verified sources without pilot artifact IDs', () => {
    const sources = loadGeographicImpactQuerySources(
      createSyntheticGeographicProject(),
      syntheticGeographicQuery,
    )

    expect(sources.baselineSource).toBe('baseline_occurrence_union')
    expect(sources.parquetSources.map(({ logicalName, fileName }) => [logicalName, fileName])).toEqual([
      ['baseline_occurrence_union', 'baseline_occurrence_union.parquet'],
      ['flickr_geography', 'flickr_geography.parquet'],
      ['geographic_impact_cells', 'geographic_impact_cells.parquet'],
      ['geographic_impact_summary', 'geographic_impact_summary.parquet'],
    ])
    expect(sources.parquetSources.map(({ artifact }) => artifact.descriptor.artifact_id)).toEqual([
      'union-random-id',
      'flickr-random-id',
      'cells-random-id',
      'summary-random-id',
    ])
    expect(sources.selectedHierarchyNode).toMatchObject({
      scope_level: 'country',
      scope_id: 'country:AU',
      country_code: 'AU',
    })
    expect(sources.maturitySources).toEqual([
      expect.objectContaining({
        logicalName: 'verification_consensus',
        availability: 'available',
        recordCount: 0,
      }),
      expect.objectContaining({
        logicalName: 'quality_snapshot',
        availability: 'unavailable',
        recordCount: null,
        unavailableReason: 'no retained human outcomes',
      }),
      expect.objectContaining({
        logicalName: 'release_decisions',
        availability: 'available',
        recordCount: 0,
      }),
    ])
  })

  it('registers four non-empty verified buffers under deterministic local names', async () => {
    const sources = loadGeographicImpactQuerySources(
      createSyntheticGeographicProject(),
      syntheticGeographicQuery,
    )
    const registerFileBuffer = vi.fn(
      async (_fileName: string, _bytes: Uint8Array<ArrayBuffer>) => undefined,
    )

    const result = await registerGeographicImpactQuerySources(
      { registerFileBuffer },
      sources,
    )

    expect(registerFileBuffer).toHaveBeenCalledTimes(4)
    expect(registerFileBuffer.mock.calls.map(([name]) => name)).toEqual([
      'baseline_occurrence_union.parquet',
      'flickr_geography.parquet',
      'geographic_impact_cells.parquet',
      'geographic_impact_summary.parquet',
    ])
    for (const [index, [, registeredBytes]] of registerFileBuffer.mock.calls.entries()) {
      expect(registeredBytes).not.toBe(sources.parquetSources[index]?.artifact.bytes)
      expect(registeredBytes).toEqual(sources.parquetSources[index]?.artifact.bytes)
    }
    expect(result).toMatchObject({ registeredFileCount: 4, registeredBytes: 12 })
    expect(result.artifacts.map(({ recordCount }) => recordCount)).toEqual([9, 12, 7, 3])
    expect(Object.isFrozen(result.artifacts)).toBe(true)
  })

  it('uses the compatible spread fallback without inventing a provider union', () => {
    const sources = loadGeographicImpactQuerySources(
      createSyntheticGeographicProject({ unionAvailable: false }),
      syntheticGeographicQuery,
    )

    expect(sources.baselineSource).toBe('baseline_geographic_spread')
    expect(sources.parquetSources[0]).toMatchObject({
      logicalName: 'baseline_geographic_spread',
      fileName: 'baseline_geographic_spread.parquet',
    })
  })

  it('fails closed on undeclared resolution, missing scope or manifest drift', () => {
    expect(() =>
      loadGeographicImpactQuerySources(
        createSyntheticGeographicProject({ spatialResolutions: [3, 7] }),
        syntheticGeographicQuery,
      ),
    ).toThrow('selected spatial resolution is not declared')
    expect(() =>
      loadGeographicImpactQuerySources(
        createSyntheticGeographicProject({ includeSelectedScope: false }),
        syntheticGeographicQuery,
      ),
    ).toThrow('selected geographic scope is missing or ambiguous')
    expect(() =>
      loadGeographicImpactQuerySources(
        createSyntheticGeographicProject({ flickrManifestSha256: '0'.repeat(64) }),
        syntheticGeographicQuery,
      ),
    ).toThrow('flickr_geography differs from its geographic manifest entry')
  })
})
