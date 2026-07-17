import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  GeographicEvidenceMaturityFilter,
  filterGeographicImpactCells,
} from './GeographicEvidenceMaturityFilter'
import type { PublicGeographicImpactMapCell } from './publicGeographicImpactMapData'

describe('GeographicEvidenceMaturityFilter', () => {
  it('separates candidate, attempted human review and release-gated cells', () => {
    const cells = [
      cell('baseline', { baselineRangeInferenceEligibleCount: 2 }),
      cell('candidate', { flickrCandidateCount: 3, pendingCount: 3 }),
      cell('cant-view', {
        flickrCandidateCount: 1,
        pendingCount: 0,
        mediaFailureCount: 1,
      }),
      cell('release', {
        flickrCandidateCount: 1,
        pendingCount: 0,
        reviewedPositiveCount: 1,
        releaseReadyCount: 1,
      }),
    ]

    expect(filterGeographicImpactCells(cells, 'flickr_candidates')).toHaveLength(3)
    expect(
      filterGeographicImpactCells(cells, 'human_reviewed').map(
        ({ spatialCellId }) => spatialCellId,
      ),
    ).toEqual(['cant-view', 'release'])
    expect(
      filterGeographicImpactCells(cells, 'release_ready').map(
        ({ spatialCellId }) => spatialCellId,
      ),
    ).toEqual(['release'])
  })

  it('uses labelled native radios and announces an exact zero-result state', () => {
    const onChange = vi.fn()
    render(
      <GeographicEvidenceMaturityFilter
        mode="release_ready"
        onChange={onChange}
        sourceCellCount={42}
        visibleCellCount={0}
      />,
    )

    expect(screen.getByRole('radio', { name: 'Release-ready' })).toBeChecked()
    expect(screen.getByRole('status')).toHaveTextContent(
      '0 of 42 cells match Release-ready',
    )
    expect(screen.getByText(/Zero is retained as an exact evidence state/)).toBeVisible()
    fireEvent.click(screen.getByRole('radio', { name: 'Human reviewed' }))
    expect(onChange).toHaveBeenCalledWith('human_reviewed')
  })
})

function cell(
  spatialCellId: string,
  overrides: Partial<PublicGeographicImpactMapCell>,
): PublicGeographicImpactMapCell {
  return {
    spatialResolution: 3,
    spatialCellId,
    continent: null,
    countryCode: null,
    country: null,
    admin1: null,
    latitude: 0,
    longitude: 0,
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
    dataDeficientState: 'data_deficient',
    latestBaselineEventDate: null,
    latestFlickrCandidateDate: null,
    latestReviewedPositiveDate: null,
    latestReleaseReadyDate: null,
    ...overrides,
  }
}
