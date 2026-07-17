import { describe, expect, it } from 'vitest'

import {
  buildPublicGeographicImpactMapSql,
  geographicMapResolutionForScope,
  PUBLIC_GEOGRAPHIC_IMPACT_MAP_SOURCE,
} from './publicGeographicImpactMapData'
import { TAXALENS_GEOGRAPHIC_SCOPE_INDEX } from './geographicScope'

describe('public Geographic Impact map data', () => {
  it('selects only committed hierarchical resolutions', () => {
    const global = TAXALENS_GEOGRAPHIC_SCOPE_INDEX.root
    const asia = requiredScope('continent:asia')
    const india = requiredScope('country:IN')

    expect(geographicMapResolutionForScope(global)).toBe(3)
    expect(geographicMapResolutionForScope(asia)).toBe(5)
    expect(geographicMapResolutionForScope(india)).toBe(7)
  })

  it('scopes every map query by evidence identity and exact geography', () => {
    const sql = buildPublicGeographicImpactMapSql(requiredScope('country:IN'))

    expect(sql).toContain("project_id = 'taxalens-papilio-demoleus-judge-replay'")
    expect(sql).toContain("run_id = 'papilio-demoleus-pilot-20260715'")
    expect(sql).toContain("accepted_taxon_key = 'gbif:1938069'")
    expect(sql).toContain("baseline_snapshot_id = 'gbif-occurrence-search-20260715'")
    expect(sql).toContain("flickr_snapshot_id = 'flickr:2026-07-15'")
    expect(sql).toContain('spatial_resolution = 7')
    expect(sql).toContain("country_code = 'IN'")
    expect(sql).toContain('baseline_range_inference_eligible_count')
    expect(sql).toContain('gbif_only_count')
    expect(sql).toContain('inaturalist_origin_through_gbif_count')
    expect(sql).toContain('CAST(latest_baseline_event_date AS VARCHAR)')
    expect(sql).toContain('LIMIT 5001')
    expect(sql).not.toContain('SELECT *')
  })

  it('takes public artifact expectations from the committed manifest', () => {
    expect(PUBLIC_GEOGRAPHIC_IMPACT_MAP_SOURCE).toMatchObject({
      artifactBytes: 559_441,
      artifactRows: 20_237,
      artifactSha256: '97b2422657d79bc8e682c4e51358c0316f6c942a31fea9ed608ef2c4ba420d94',
      directInaturalistDeltaStatus: 'unavailable',
      reviewedPositiveCount: 0,
      releaseReadyCount: 0,
    })
  })
})

function requiredScope(scopeId: string) {
  const scope = TAXALENS_GEOGRAPHIC_SCOPE_INDEX.byId.get(scopeId)
  if (scope === undefined) throw new Error(`Missing test scope: ${scopeId}`)
  return scope
}
