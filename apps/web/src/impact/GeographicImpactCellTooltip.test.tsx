import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { GeographicImpactCellTooltip } from './GeographicImpactCellTooltip'
import type { GeographicImpactMapFeature } from './geographicImpactFeatureCollection'

describe('GeographicImpactCellTooltip', () => {
  it('shows exact counts and preserves candidate versus release semantics', () => {
    render(<GeographicImpactCellTooltip feature={feature()} />)

    expect(
      screen.getByRole('heading', { name: 'h3:cell:example' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Exact cell counts')).toBeInTheDocument()
    expect(termValue('Baseline union')).toBe('12')
    expect(termValue('Range-inference eligible baseline')).toBe('9')
    expect(termValue('Excluded baseline occurrences')).toBe('3')
    expect(termValue('Flickr candidate evidence')).toBe('7')
    expect(termValue('Visually eligible Flickr candidates')).toBe('6')
    expect(termValue('Unreviewed')).toBe('4')
    expect(termValue('Human-reviewed target positive')).toBe('2')
    expect(termValue('Human-reviewed non-target')).toBe('1')
    expect(termValue('Uncertain')).toBe('0')
    expect(termValue('Release-ready occurrence candidate')).toBe('0')
    expect(screen.getByText(/Baseline and Flickr evidence share this cell/u))
      .toBeInTheDocument()
    expect(screen.getByText(/Flickr evidence remains a hypothesis/u)).toBeInTheDocument()
    expect(screen.getByText(/not release-ready unless/u)).toBeInTheDocument()
  })
})

function termValue(term: string): string | null {
  return screen.getByText(term).closest('div')?.querySelector('dd')?.textContent ?? null
}

function feature(): GeographicImpactMapFeature {
  return {
    type: 'Feature',
    id: 'h3:cell:example',
    geometry: { type: 'Point', coordinates: [134, -25] },
    properties: {
      spatialCellId: 'h3:cell:example',
      spatialResolution: 3,
      baselineUnionCount: 12,
      baselineCount: 9,
      baselineRadius: 28,
      flickrCandidateCount: 7,
      flickrVisuallyEligibleCount: 6,
      flickrRadius: 24,
      reviewedPositiveCount: 2,
      reviewedPositiveRadius: 10,
      reviewedNegativeCount: 1,
      reviewedNegativeRadius: 7,
      uncertainCount: 0,
      uncertainRadius: 0,
      pendingCount: 4,
      pendingRadius: 16,
      mediaFailureCount: 0,
      skippedCount: 0,
      releaseReadyCount: 0,
      releaseReadyRadius: 0,
      baselineOnlyCell: false,
      matchedCell: true,
      candidateOnlyCell: false,
      reviewedAdditionalCell: false,
      releaseReadyAdditionalCell: false,
      nearestBaselineDistanceKm: 0,
      dataDeficientState: 'sufficient',
    },
  }
}
