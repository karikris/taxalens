import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { VerificationCoverage } from '../domain'
import { QualityPanel } from './QualityPanel'

describe('QualityPanel coverage', () => {
  it('shows explicit coverage denominators and withholds precision', () => {
    render(<QualityPanel coverage={coverage()} />)

    expect(
      screen.getByText(/not an accuracy or precision estimate/u),
    ).toBeInTheDocument()
    const reviewCoverage = screen
      .getByText('Review coverage')
      .closest('article')
    const inspectionCoverage = screen
      .getByText('Inspection coverage')
      .closest('article')
    const viewability = screen
      .getByText('Viewability rate')
      .closest('article')
    expect(reviewCoverage).not.toBeNull()
    expect(inspectionCoverage).not.toBeNull()
    expect(viewability).not.toBeNull()
    expect(within(reviewCoverage!).getByText('100%')).toBeVisible()
    expect(within(reviewCoverage!).getByText('3 / 3')).toBeVisible()
    expect(within(inspectionCoverage!).getByText('100%')).toBeVisible()
    expect(within(inspectionCoverage!).getByText('3 / 3')).toBeVisible()
    expect(within(viewability!).getByText('66.7%')).toBeVisible()
    expect(within(viewability!).getByText('2 / 3')).toBeVisible()
    expect(screen.getByText('Quality estimates are not available')).toBeVisible()
  })
})

function coverage(): VerificationCoverage {
  return {
    schemaVersion: 'taxalens-verification-coverage:v1.0.0',
    eligibleItems: 3,
    attemptedItems: 3,
    unattemptedItems: 0,
    decisivelyReviewedItems: 1,
    resolvedYesItems: 1,
    resolvedNoItems: 0,
    uncertainItems: 1,
    mediaFailureItems: 1,
    deferredItems: 0,
    pendingItems: 0,
    effectiveReviewCount: 3,
    decisiveReviewCount: 1,
    yesReviewCount: 1,
    noReviewCount: 0,
    cantTellReviewCount: 1,
    cantViewReviewCount: 1,
    skippedReviewCount: 0,
    inspectedItems: 3,
    viewableItems: 2,
    reviewCoverage: 1,
    inspectionCoverage: 1,
    viewabilityRate: 2 / 3,
  }
}
