import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  GeographicReviewProgress,
  buildGeographicReviewProgress,
} from './GeographicReviewProgress'
import type { GeographicReviewProjection } from './geographicReviewProjection'

describe('GeographicReviewProgress', () => {
  it('keeps exact zero-state categories visible', () => {
    render(
      <GeographicReviewProgress
        projection={projection([])}
        spatialResolution={3}
      />,
    )

    expect(
      screen.getByText('No verification campaign items have supported cells at this resolution.'),
    ).toBeVisible()
    for (const label of [
      'Assigned',
      'Decisively reviewed',
      'Uncertain',
      'Media failure',
      'Pending',
      'Skipped',
      'Quality-valid reviewed',
      'Population-quality eligible',
      'Release-ready',
    ]) {
      expect(screen.getByLabelText(`${label}: 0`)).toBeVisible()
    }
  })

  it('reports overlapping workflow and quality counts without double-counting resolutions', () => {
    const input = projection([
      cell(3, {
        campaignItemCount: 4,
        assignedCount: 3,
        decisivelyReviewedCount: 2,
        reviewedPositiveCount: 1,
        reviewedNegativeCount: 1,
        uncertainCount: 1,
        pendingCount: 0,
        mediaFailureCount: 0,
        skippedCount: 1,
        qualityValidReviewedCount: 2,
        populationQualityEligibleCount: 1,
        targetedFailureDiscoveryReviewedCount: 1,
        releaseReadyCount: 0,
      }),
      cell(5, {
        campaignItemCount: 4,
        assignedCount: 3,
        decisivelyReviewedCount: 2,
        reviewedPositiveCount: 1,
        reviewedNegativeCount: 1,
        uncertainCount: 1,
        pendingCount: 0,
        mediaFailureCount: 0,
        skippedCount: 1,
        qualityValidReviewedCount: 2,
        populationQualityEligibleCount: 1,
        targetedFailureDiscoveryReviewedCount: 1,
        releaseReadyCount: 0,
      }),
    ])

    expect(buildGeographicReviewProgress(input, 3)).toMatchObject({
      campaignItemCount: 4,
      assignedCount: 3,
      decisivelyReviewedCount: 2,
      qualityValidReviewedCount: 2,
      populationQualityEligibleCount: 1,
      targetedFailureDiscoveryReviewedCount: 1,
    })
    render(<GeographicReviewProgress projection={input} spatialResolution={3} />)
    expect(screen.getByLabelText('Assigned: 3')).toBeVisible()
    expect(screen.getByLabelText('Decisively reviewed: 2')).toBeVisible()
    expect(
      screen.getByText(/1 reviewed item came from targeted failure discovery/),
    ).toBeVisible()
    expect(screen.getByText(/cannot support unweighted population inference/)).toBeVisible()
  })
})

function projection(
  cells: GeographicReviewProjection['cells'],
): GeographicReviewProjection {
  return {
    items: [],
    cells,
    scientificClaimAllowed: false,
  }
}

function cell(
  spatialResolution: number,
  counts: Omit<
    GeographicReviewProjection['cells'][number],
    'spatialResolution' | 'spatialCellId' | 'scientificClaimAllowed'
  >,
): GeographicReviewProjection['cells'][number] {
  return {
    spatialResolution,
    spatialCellId: `cell-${spatialResolution}`,
    ...counts,
    scientificClaimAllowed: false,
  }
}
