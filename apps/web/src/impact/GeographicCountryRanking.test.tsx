import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  buildGeographicCountryRanking,
  GeographicCountryRanking,
} from './GeographicCountryRanking'
import type { PublicGeographicImpactMapCell } from './publicGeographicImpactMapData'

describe('GeographicCountryRanking', () => {
  it('ranks exact candidate-only cells with deterministic country ties', () => {
    const ranking = buildGeographicCountryRanking(
      [
        cell('au:a', 'AU', 'Australia', {
          flickrCandidateCount: 1,
          candidateOnlyCell: true,
        }),
        cell('au:b', 'AU', 'Australia', {
          flickrCandidateCount: 1,
          candidateOnlyCell: true,
        }),
        cell('in:a', 'IN', 'India', {
          flickrCandidateCount: 1,
          candidateOnlyCell: true,
        }),
        cell('nz:a', 'NZ', 'New Zealand'),
        cell('unknown', null, null),
      ],
      'candidate_only_cells',
    )

    expect(ranking.unassignedCellCount).toBe(1)
    expect(ranking.rows.map(({ countryCode, selectedMetricValue }) => [countryCode, selectedMetricValue]))
      .toEqual([['AU', 2], ['IN', 1], ['NZ', 0]])
  })

  it('uses only Flickr candidate cells for range-edge distance and exposes unavailable values', () => {
    const ranking = buildGeographicCountryRanking(
      [
        cell('au:baseline', 'AU', 'Australia', { nearestBaselineDistanceKm: 900 }),
        cell('au:candidate', 'AU', 'Australia', {
          flickrCandidateCount: 1,
          candidateOnlyCell: true,
          nearestBaselineDistanceKm: 12.25,
        }),
        cell('in:candidate', 'IN', 'India', {
          flickrCandidateCount: 2,
          candidateOnlyCell: true,
        }),
      ],
      'range_edge_distance',
    )

    expect(ranking.rows.map(({ countryCode, selectedMetricValue }) => [countryCode, selectedMetricValue]))
      .toEqual([['AU', 12.25], ['IN', null]])
  })

  it('offers an accessible metric control and country selection', () => {
    const onCountrySelect = vi.fn()
    const onMetricChange = vi.fn()
    render(
      <GeographicCountryRanking
        cells={[cell('au:a', 'AU', 'Australia', { pendingCount: 7 })]}
        metric="review_backlog"
        onCountrySelect={onCountrySelect}
        onMetricChange={onMetricChange}
      />,
    )

    expect(screen.getByRole('status', { name: /Australia: Review backlog/u }))
      .toHaveTextContent('7')
    fireEvent.click(screen.getByRole('button', { name: /Australia.*AU/u }))
    expect(onCountrySelect).toHaveBeenCalledWith('AU')
    fireEvent.change(screen.getByLabelText('Rank countries by'), {
      target: { value: 'reviewed_additional_cells' },
    })
    expect(onMetricChange).toHaveBeenCalledWith('reviewed_additional_cells')
  })
})

function cell(
  spatialCellId: string,
  countryCode: string | null,
  country: string | null,
  overrides: Partial<PublicGeographicImpactMapCell> = {},
): PublicGeographicImpactMapCell {
  return {
    spatialResolution: 3,
    spatialCellId,
    continent: countryCode === null ? null : 'Oceania',
    countryCode,
    country,
    admin1: null,
    latitude: -25,
    longitude: 134,
    baselineUnionCount: 0,
    baselineRangeInferenceEligibleCount: 0,
    baselineExcludedOccurrenceCount: 0,
    gbifOnlyCount: 0,
    inaturalistOriginThroughGbifCount: 0,
    directInaturalistDeltaStatus: 'unavailable',
    directInaturalistDeltaCount: null,
    duplicatesRemovedCount: 0,
    unresolvedProviderDuplicateGroupCount: 0,
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
    latestBaselineEventDate: null,
    latestFlickrCandidateDate: null,
    latestReviewedPositiveDate: null,
    latestReleaseReadyDate: null,
    ...overrides,
  }
}
