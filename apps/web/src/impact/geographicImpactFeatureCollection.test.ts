import { describe, expect, it } from 'vitest'

import type { GeographicImpactBrowserCell } from './geographicImpactAnalytics'
import { buildBoundedGeographicImpactFeatures } from './geographicImpactFeatureCollection'

describe('bounded Geographic Impact map features', () => {
  it('emits only the highest-ranked preaggregated centroids and reports truncation', () => {
    const result = buildBoundedGeographicImpactFeatures(
      [
        cell('cell:small', { baselineRangeInferenceEligibleCount: 2 }),
        cell('cell:candidate', {
          flickrCandidateCount: 8,
          pendingCount: 8,
          candidateOnlyCell: true,
        }),
        cell('cell:baseline', { baselineRangeInferenceEligibleCount: 12 }),
      ],
      'record_count',
      2,
    )

    expect(result).toMatchObject({
      metric: 'record_count',
      maximumFeatureCount: 2,
      sourceCellCount: 3,
      emittedFeatureCount: 2,
      omittedFeatureCount: 1,
      truncated: true,
    })
    expect(result.collection.features.map(({ id }) => id)).toEqual([
      'cell:baseline',
      'cell:candidate',
    ])
    expect(result.collection.features[1]).toMatchObject({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [134, -25] },
      properties: {
        spatialCellId: 'cell:candidate',
        baselineCount: 0,
        flickrCandidateCount: 8,
        pendingCount: 8,
        candidateOnlyCell: true,
      },
    })
    expect(Object.isFrozen(result.collection.features)).toBe(true)
  })

  it('uses the selected closed metric and rejects an unbounded limit', () => {
    const cells = [
      cell('cell:records', { baselineRangeInferenceEligibleCount: 50 }),
      cell('cell:review', {
        reviewedPositiveCount: 2,
        reviewedAdditionalCell: true,
      }),
    ]

    expect(
      buildBoundedGeographicImpactFeatures(cells, 'reviewed_additional_cells', 1).collection
        .features[0]?.id,
    ).toBe('cell:review')
    expect(() => buildBoundedGeographicImpactFeatures(cells, 'record_count', 0)).toThrow(
      'maximumFeatureCount must be a positive safe integer',
    )
  })
})

function cell(
  spatialCellId: string,
  overrides: Partial<GeographicImpactBrowserCell> = {},
): GeographicImpactBrowserCell {
  return {
    spatialResolution: 5,
    spatialCellId,
    continent: 'Oceania',
    countryCode: 'AU',
    country: 'Australia',
    admin1: null,
    latitude: -25,
    longitude: 134,
    baselineUnionCount: 0,
    baselineRangeInferenceEligibleCount: 0,
    flickrCandidateCount: 0,
    flickrVisuallyEligibleCount: 0,
    reviewedPositiveCount: 0,
    reviewedNegativeCount: 0,
    uncertainCount: 0,
    pendingCount: 0,
    mediaFailureCount: 0,
    skippedCount: 0,
    releaseReadyCount: 0,
    baselineOnlyCell: false,
    matchedCell: false,
    candidateOnlyCell: false,
    reviewedAdditionalCell: false,
    releaseReadyAdditionalCell: false,
    nearestBaselineDistanceKm: null,
    dataDeficientState: 'sufficient',
    ...overrides,
  }
}
