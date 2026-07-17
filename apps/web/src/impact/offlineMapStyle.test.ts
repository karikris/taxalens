import { describe, expect, it } from 'vitest'

import {
  TAXALENS_BOUNDARY_ONLY_LAYER,
  TAXALENS_COUNTRY_BOUNDARIES,
  TAXALENS_COUNTRY_LINE_LAYER,
  TAXALENS_OFFLINE_MAP_STYLE,
  TAXALENS_SELECTABLE_COUNTRY_LAYER,
} from './offlineMapStyle'

describe('TaxaLens offline map contract', () => {
  it('contains no remote style, source, glyph, sprite, font or tile location', () => {
    expect(TAXALENS_OFFLINE_MAP_STYLE.sources).toEqual({})
    expect(TAXALENS_OFFLINE_MAP_STYLE).not.toHaveProperty('glyphs')
    expect(TAXALENS_OFFLINE_MAP_STYLE).not.toHaveProperty('sprite')
    expect(remoteStrings(TAXALENS_OFFLINE_MAP_STYLE)).toEqual([])
  })

  it('uses the committed normalized country boundaries without inventing labels', () => {
    expect(TAXALENS_COUNTRY_BOUNDARIES.type).toBe('FeatureCollection')
    expect(TAXALENS_COUNTRY_BOUNDARIES.features).toHaveLength(177)
    expect(
      TAXALENS_COUNTRY_BOUNDARIES.features.filter(
        ({ properties }) => properties.selectable_country,
      ),
    ).toHaveLength(175)
    expect(remoteStrings(TAXALENS_COUNTRY_BOUNDARIES)).toEqual([])
  })

  it('distinguishes selectable and boundary-only geography without a font endpoint', () => {
    expect(TAXALENS_SELECTABLE_COUNTRY_LAYER.type).toBe('fill')
    expect(TAXALENS_BOUNDARY_ONLY_LAYER.type).toBe('fill')
    expect(TAXALENS_COUNTRY_LINE_LAYER.type).toBe('line')
    expect(TAXALENS_SELECTABLE_COUNTRY_LAYER.filter).not.toEqual(
      TAXALENS_BOUNDARY_ONLY_LAYER.filter,
    )
    expect(remoteStrings([
      TAXALENS_SELECTABLE_COUNTRY_LAYER,
      TAXALENS_BOUNDARY_ONLY_LAYER,
      TAXALENS_COUNTRY_LINE_LAYER,
    ])).toEqual([])
  })
})

function remoteStrings(value: unknown): readonly string[] {
  if (typeof value === 'string') {
    return /^(?:https?:)?\/\//u.test(value) ? [value] : []
  }
  if (Array.isArray(value)) return value.flatMap((item) => remoteStrings(item))
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).flatMap((item) => remoteStrings(item))
  }
  return []
}
