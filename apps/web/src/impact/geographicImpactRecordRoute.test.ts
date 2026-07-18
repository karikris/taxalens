import { describe, expect, it } from 'vitest'

import {
  geographicImpactCellRowId,
  geographicImpactRecordHash,
  geographicImpactRecordRouteStateFromHash,
} from './geographicImpactRecordRoute'
import { TAXALENS_GEOGRAPHIC_SCOPE_INDEX } from './geographicScope'

const TEST_COUNTRY_SCOPE = TAXALENS_GEOGRAPHIC_SCOPE_INDEX.byLevel.country[0]!

describe('record Geographic Impact deep links', () => {
  it('round-trips an exact country-resolution cell and table focus', () => {
    const hash = geographicImpactRecordHash({
      scopeId: TEST_COUNTRY_SCOPE.scope_id,
      spatialCellId: '87088660cffffff',
      spatialResolution: 7,
      focus: 'table',
    })

    expect(hash).toBe(`#dashboard?geo=${encodeURIComponent(TEST_COUNTRY_SCOPE.scope_id)}&geo-cell=87088660cffffff&geo-resolution=7&geo-focus=table`)
    expect(geographicImpactRecordRouteStateFromHash(hash)).toEqual({
      target: {
        scopeId: TEST_COUNTRY_SCOPE.scope_id,
        spatialCellId: '87088660cffffff',
        spatialResolution: 7,
        focus: 'table',
      },
      error: null,
    })
  })

  it('fails closed for an invalid cell or a resolution that differs from scope', () => {
    expect(
      geographicImpactRecordRouteStateFromHash(
        `#dashboard?geo=${encodeURIComponent(TEST_COUNTRY_SCOPE.scope_id)}&geo-cell=not-a-cell&geo-resolution=7&geo-focus=lens`,
      ),
    ).toMatchObject({ target: null, error: 'Record geographic link cell is invalid.' })
    expect(
      geographicImpactRecordRouteStateFromHash(
        `#dashboard?geo=${encodeURIComponent(TEST_COUNTRY_SCOPE.scope_id)}&geo-cell=87088660cffffff&geo-resolution=3&geo-focus=lens`,
      ),
    ).toMatchObject({
      target: null,
      error: 'Record geographic link resolution is unsupported for the selected scope.',
    })
  })

  it('creates stable DOM row identities for production and synthetic cells', () => {
    expect(geographicImpactCellRowId('87088660cffffff')).toBe(
      'geographic-impact-cell-87088660cffffff',
    )
    expect(geographicImpactCellRowId('cell:00')).toBe('geographic-impact-cell-cell%3A00')
  })
})
