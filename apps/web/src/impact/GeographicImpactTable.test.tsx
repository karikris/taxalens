import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  GeographicImpactTable,
  sortGeographicImpactCells,
} from './GeographicImpactTable'
import type { PublicGeographicImpactMapCell } from './publicGeographicImpactMapData'

describe('GeographicImpactTable', () => {
  it('sorts exact values with deterministic cell identity ties', () => {
    const cells = [
      cell('cell:b', { flickrCandidateCount: 4 }),
      cell('cell:a', { flickrCandidateCount: 4 }),
      cell('cell:c', { flickrCandidateCount: 9 }),
    ]
    expect(
      sortGeographicImpactCells(cells, {
        key: 'flickrCandidates',
        direction: 'descending',
      }).map(({ spatialCellId }) => spatialCellId),
    ).toEqual(['cell:c', 'cell:a', 'cell:b'])
  })

  it('paginates ordinary table rows and synchronizes controlled selection', () => {
    const onCellSelect = vi.fn()
    const cells = Array.from({ length: 27 }, (_, index) =>
      cell(`cell:${String(index).padStart(2, '0')}`, { flickrCandidateCount: index }),
    )
    const { rerender } = render(
      <GeographicImpactTable
        cells={cells}
        selectedCellId={null}
        onCellSelect={onCellSelect}
        pageSize={10}
      />,
    )

    expect(screen.getByRole('status', { name: '' })).toHaveTextContent('Page 1 of 3')
    expect(screen.getAllByRole('row')).toHaveLength(11)
    fireEvent.click(screen.getByRole('button', { name: 'Select cell:26' }))
    expect(onCellSelect).toHaveBeenCalledWith('cell:26')

    rerender(
      <GeographicImpactTable
        cells={cells}
        selectedCellId="cell:00"
        onCellSelect={onCellSelect}
        pageSize={10}
      />,
    )
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent('Page 3 of 3')
    const selectedButton = screen.getByRole('button', { name: 'Selected cell:00' })
    expect(selectedButton).toHaveAttribute('aria-pressed', 'true')
  })

  it('uses aria-sort and preserves unavailable and zero values', () => {
    render(
      <GeographicImpactTable
        cells={[cell('cell:a', { reviewedPositiveCount: 0, nearestBaselineDistanceKm: null })]}
        selectedCellId={null}
        onCellSelect={() => undefined}
      />,
    )
    const candidateHeader = screen.getByRole('columnheader', { name: /Flickr candidates/u })
    expect(candidateHeader).toHaveAttribute('aria-sort', 'descending')
    fireEvent.click(within(candidateHeader).getByRole('button'))
    expect(candidateHeader).toHaveAttribute('aria-sort', 'ascending')
    expect(screen.getByRole('rowheader', { name: 'cell:a' }).closest('tr'))
      .toHaveTextContent(/0.*Unavailable.*Sufficient baseline/u)
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
