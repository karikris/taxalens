import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  buildGeographicImpactAccessibleSummary,
  GeographicImpactAccessibleSummary,
} from './GeographicImpactAccessibleSummary'
import { TAXALENS_GEOGRAPHIC_SCOPE_INDEX } from './geographicScope'
import type { PublicGeographicImpactMapCell } from './publicGeographicImpactMapData'

describe('GeographicImpactAccessibleSummary', () => {
  it('derives exact layer and contribution totals from verified cells', () => {
    const summary = buildGeographicImpactAccessibleSummary(
      [
        cell('cell:a', {
          baselineRangeInferenceEligibleCount: 7,
          flickrCandidateCount: 4,
          pendingCount: 4,
          candidateOnlyCell: true,
        }),
        cell('cell:b', {
          baselineRangeInferenceEligibleCount: 3,
          flickrCandidateCount: 2,
          reviewedPositiveCount: 1,
          reviewedNegativeCount: 1,
          uncertainCount: 0,
          releaseReadyCount: 0,
          reviewedAdditionalCell: true,
        }),
      ],
      TAXALENS_GEOGRAPHIC_SCOPE_INDEX.root,
      'cell:a',
    )

    expect(summary).toMatchObject({
      scopeName: 'Global',
      spatialResolution: 3,
      cellCount: 2,
      baselineEligibleCount: 10,
      flickrCandidateCount: 6,
      pendingCount: 4,
      reviewedPositiveCount: 1,
      reviewedNegativeCount: 1,
      releaseReadyCount: 0,
      candidateOnlyCellCount: 1,
      reviewedAdditionalCellCount: 1,
      selectedCellId: 'cell:a',
    })
    expect(summary.announcement).toMatch(/0 release-ready/u)
    expect(summary.selectedCellSummary).toMatch(/not a biological absence claim/u)
  })

  it('renders non-color state descriptions and one atomic live summary', () => {
    const { rerender } = render(
      <GeographicImpactAccessibleSummary
        cells={[cell('cell:a', { flickrCandidateCount: 3, pendingCount: 3 })]}
        scope={TAXALENS_GEOGRAPHIC_SCOPE_INDEX.root}
        selectedCellId={null}
      />,
    )

    expect(screen.getByText('Pending amber rings').closest('div')).toHaveTextContent('3')
    expect(screen.getByText(/ring, fill, excluded mark, dash or dark external stroke/u))
      .toBeInTheDocument()
    const liveRegion = screen.getByRole('status')
    expect(liveRegion).toHaveAttribute('aria-atomic', 'true')
    expect(liveRegion).toHaveTextContent(/No spatial cell is selected/u)

    rerender(
      <GeographicImpactAccessibleSummary
        cells={[cell('cell:a', { flickrCandidateCount: 3, pendingCount: 3 })]}
        scope={TAXALENS_GEOGRAPHIC_SCOPE_INDEX.root}
        selectedCellId="cell:a"
      />,
    )
    expect(liveRegion).toHaveTextContent(/Selected cell cell:a/u)
  })
})

function cell(
  spatialCellId: string,
  overrides: Partial<PublicGeographicImpactMapCell> = {},
): PublicGeographicImpactMapCell {
  return {
    spatialResolution: 3,
    spatialCellId,
    continent: 'Asia',
    countryCode: 'IN',
    country: 'India',
    admin1: null,
    latitude: 20,
    longitude: 78,
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
