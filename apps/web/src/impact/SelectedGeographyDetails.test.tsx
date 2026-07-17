import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TAXALENS_GEOGRAPHIC_SCOPE_INDEX } from './geographicScope'
import {
  buildSelectedGeographyDetails,
  SelectedGeographyDetails,
} from './SelectedGeographyDetails'
import type { PublicGeographicImpactMapCell } from './publicGeographicImpactMapData'

describe('SelectedGeographyDetails', () => {
  it('aggregates exact scope evidence without treating unavailable direct data as zero', () => {
    const cells = [
      cell('cell:a', {
        baselineUnionCount: 10,
        baselineRangeInferenceEligibleCount: 7,
        baselineExcludedOccurrenceCount: 3,
        gbifOnlyCount: 6,
        inaturalistOriginThroughGbifCount: 4,
        flickrCandidateCount: 5,
        pendingCount: 5,
        nearestBaselineDistanceKm: 12.5,
        latestBaselineEventDate: '2020-01-01',
        latestFlickrCandidateDate: '2024-01-02',
        dataDeficientState: 'data_deficient',
        candidateOnlyCell: false,
      }),
      cell('cell:b', {
        baselineUnionCount: 4,
        baselineRangeInferenceEligibleCount: 4,
        gbifOnlyCount: 4,
        flickrCandidateCount: 2,
        pendingCount: 2,
        latestBaselineEventDate: '2021-01-01',
        latestFlickrCandidateDate: '2023-01-01',
      }),
      cell('cell:c', {
        flickrCandidateCount: 1,
        pendingCount: 1,
        candidateOnlyCell: true,
      }),
    ]

    const details = buildSelectedGeographyDetails(
      cells,
      TAXALENS_GEOGRAPHIC_SCOPE_INDEX.root,
      null,
    )

    expect(details).toMatchObject({
      title: 'Global',
      context: 'scope',
      cellCount: 3,
      baselineUnionCount: 14,
      baselineEligibleCount: 11,
      baselineExcludedCount: 3,
      gbifOnlyCount: 10,
      inaturalistOriginThroughGbifCount: 4,
      directInaturalistDeltaStatus: 'unavailable',
      directInaturalistDeltaCount: null,
      flickrCandidateCount: 8,
      pendingCount: 8,
      candidateOnlyCellCount: 1,
      nearestBaselineDistanceKm: 12.5,
      latestBaselineEventDate: '2021-01-01',
      latestFlickrCandidateDate: '2024-01-02',
      dataDeficientCellCount: 1,
      coverageUplift: {
        status: 'available',
        baselineOccupiedCellCount: 2,
        potential: { additionalCellCount: 1, percent: 50 },
        humanSupported: { additionalCellCount: 0, percent: 0 },
        releaseReady: { additionalCellCount: 0, percent: 0 },
      },
    })
    expect(details.temporalContribution).toMatch(/1,096 days later/u)
  })

  it('renders one selected cell with provider, contribution and deficiency disclosures', () => {
    const selected = cell('cell:selected', {
      baselineUnionCount: 0,
      flickrCandidateCount: 3,
      pendingCount: 3,
      candidateOnlyCell: true,
      nearestBaselineDistanceKm: 88.125,
      latestBaselineEventDate: null,
      latestFlickrCandidateDate: '2024-06-01',
      dataDeficientState: 'data_deficient',
    })

    render(
      <SelectedGeographyDetails
        cells={[selected]}
        scope={TAXALENS_GEOGRAPHIC_SCOPE_INDEX.root}
        selectedCellId="cell:selected"
      />,
    )

    expect(screen.getByRole('heading', { name: 'cell:selected' })).toBeInTheDocument()
    expect(screen.getByText('Direct iNaturalist delta').closest('div'))
      .toHaveTextContent('Unavailable')
    expect(screen.getByText('Candidate-only spatial cells').closest('div'))
      .toHaveTextContent('1')
    expect(screen.getByText('Nearest baseline distance').closest('div'))
      .toHaveTextContent('88.13 km')
    expect(screen.getByText(/temporal contribution is data-deficient/u))
      .toBeInTheDocument()
    expect(screen.getByText('Candidate uplift').closest('div'))
      .toHaveTextContent('1 cells · unavailable (zero baseline denominator)')
    expect(screen.getByText(/unknown, not proof of biological absence/u))
      .toBeInTheDocument()
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
