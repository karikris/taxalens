import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { GeographicImpactBrowserCell } from './geographicImpactAnalytics'
import { buildBoundedGeographicImpactFeatures } from './geographicImpactFeatureCollection'
import {
  GeographicImpactLegend,
  summarizeGeographicImpactLegend,
} from './GeographicImpactLegend'

describe('GeographicImpactLegend', () => {
  it('pairs every visual state with text and exact scope counts', () => {
    const features = buildBoundedGeographicImpactFeatures(
      [
        cell({
          baselineRangeInferenceEligibleCount: 9,
          flickrCandidateCount: 7,
          pendingCount: 2,
          reviewedPositiveCount: 2,
          reviewedNegativeCount: 1,
          uncertainCount: 1,
          releaseReadyCount: 1,
        }),
      ],
      'record_count',
    )

    render(<GeographicImpactLegend features={features} />)

    expect(
      screen.getByRole('heading', { name: 'Evidence and bubble scale' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Baseline occurrence evidence')).toBeInTheDocument()
    expect(screen.getByText('Unreviewed Flickr candidate')).toBeInTheDocument()
    expect(screen.getByText('Human-reviewed target positive')).toBeInTheDocument()
    expect(screen.getByText('Human-reviewed non-target')).toBeInTheDocument()
    expect(screen.getByText('Uncertain Flickr candidate')).toBeInTheDocument()
    expect(screen.getByText('Release-ready occurrence candidate')).toBeInTheDocument()
    expect(screen.getByText(/Blue filled bubble · range-inference eligible · 9/u))
      .toBeInTheDocument()
    expect(screen.getByText(/Hollow amber ring · 2/u)).toBeInTheDocument()
    expect(screen.getByText(/Solid amber fill with dark external stroke · 1/u))
      .toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Bubble size examples' })).toBeInTheDocument()
    expect(screen.getByText(/Bubble radius uses a square-root count scale/u))
      .toBeInTheDocument()
    expect(screen.getByText(/Skip and Can’t view total 0/u)).toBeInTheDocument()
  })

  it('summarizes exact counts without promoting release-ready subsets twice', () => {
    const features = buildBoundedGeographicImpactFeatures(
      [
        cell({
          baselineRangeInferenceEligibleCount: 3,
          flickrCandidateCount: 5,
          reviewedPositiveCount: 2,
          releaseReadyCount: 1,
          skippedCount: 1,
        }),
        cell({
          baselineRangeInferenceEligibleCount: 4,
          flickrCandidateCount: 6,
          pendingCount: 4,
          mediaFailureCount: 2,
        }),
      ],
      'record_count',
    )

    expect(summarizeGeographicImpactLegend(features)).toEqual({
      baseline: 7,
      flickrCandidate: 11,
      pending: 4,
      reviewedPositive: 2,
      reviewedNegative: 0,
      uncertain: 0,
      releaseReady: 1,
      skippedOrCannotView: 3,
    })
  })
})

function cell(
  overrides: Partial<GeographicImpactBrowserCell>,
): GeographicImpactBrowserCell {
  return {
    spatialResolution: 3,
    spatialCellId: `cell:${JSON.stringify(overrides)}`,
    continent: 'Oceania',
    countryCode: 'AU',
    country: 'Australia',
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
    latestBaselineEventDate: null,
    latestFlickrCandidateDate: null,
    latestReviewedPositiveDate: null,
    latestReleaseReadyDate: null,
    dataDeficientState: 'sufficient',
    ...overrides,
  }
}
