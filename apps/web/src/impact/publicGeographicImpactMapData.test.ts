import { describe, expect, it } from 'vitest'

import {
  createSyntheticGeographicProject,
  syntheticGeographicQuery,
} from '../test/geographicImpactProjectFixture'
import type { GeographicImpactBrowserResult } from './geographicImpactAnalytics'
import {
  buildPublicGeographicImpactMapData,
  geographicMapResolutionForScope,
  verifiedGeographicImpactParquetBytes,
} from './publicGeographicImpactMapData'
import { TAXALENS_GEOGRAPHIC_SCOPE_INDEX } from './geographicScope'

describe('public Geographic Impact map data', () => {
  it('selects only committed hierarchical resolutions', () => {
    expect(geographicMapResolutionForScope(TAXALENS_GEOGRAPHIC_SCOPE_INDEX.root)).toBe(3)
    expect(geographicMapResolutionForScope(requiredScope('continent:asia'))).toBe(5)
    expect(geographicMapResolutionForScope(requiredScope('country:IN'))).toBe(7)
  })

  it('adapts source identity and bytes from the verified project rather than static imports', () => {
    const project = createSyntheticGeographicProject()
    const data = buildPublicGeographicImpactMapData(project, result())

    expect(data).toMatchObject({
      cells: [],
      spatialResolution: 5,
      scopeId: 'country:AU',
      scientificClaimAllowed: false,
      source: {
        artifactBytes: 3,
        artifactRows: 7,
        artifactSha256: 'd'.repeat(64),
        projectId: syntheticGeographicQuery.evidenceScope.projectId,
        runId: syntheticGeographicQuery.evidenceScope.runId,
        directInaturalistDeltaStatus: 'unavailable',
      },
    })
    const bytes = verifiedGeographicImpactParquetBytes(project)
    expect(bytes).toHaveLength(3)
    bytes[0] = 0
    expect(verifiedGeographicImpactParquetBytes(project)[0]).not.toBe(0)
  })

  it('fails closed when a query result has another project identity', () => {
    const mismatched = {
      ...result(),
      input: {
        ...syntheticGeographicQuery,
        evidenceScope: {
          ...syntheticGeographicQuery.evidenceScope,
          runId: 'run:other',
        },
      },
    } as GeographicImpactBrowserResult

    expect(() => buildPublicGeographicImpactMapData(createSyntheticGeographicProject(), mismatched))
      .toThrow('differs from its verified project identity')
  })
})

function result(): GeographicImpactBrowserResult {
  return {
    input: syntheticGeographicQuery,
    cells: Object.freeze([]),
  } as unknown as GeographicImpactBrowserResult
}

function requiredScope(scopeId: string) {
  const scope = TAXALENS_GEOGRAPHIC_SCOPE_INDEX.byId.get(scopeId)
  if (scope === undefined) throw new Error(`Missing test scope: ${scopeId}`)
  return scope
}
