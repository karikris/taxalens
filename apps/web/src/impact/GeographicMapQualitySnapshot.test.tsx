import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { GeographicMapQualitySnapshot } from './GeographicMapQualitySnapshot'
import type { GeographicReviewProjection } from './geographicReviewProjection'

describe('GeographicMapQualitySnapshot', () => {
  it('renders an explicit no-retained-snapshot state without a zero estimate', () => {
    render(
      <GeographicMapQualitySnapshot
        projection={projection({
          campaignId: 'campaign:audit',
          campaignTitle: 'Representative Flickr audit',
          samplingPurpose: 'quality_estimation',
          samplingDesign: 'stratified_random',
          samplingRepresentative: true,
          qualityEstimationAllowed: true,
          qualityEstimationBlockedReason: null,
          currentDecisivelyReviewedCount: 0,
          snapshot: {
            availability: 'unavailable',
            reason: 'No retained quality snapshot is attached to this campaign ledger.',
          },
          scientificClaimAllowed: false,
        })}
      />,
    )

    expect(screen.getByText('Representative Flickr audit')).toBeVisible()
    expect(screen.getByText('No retained quality snapshot is attached to this campaign ledger.'))
      .toBeVisible()
    expect(screen.getByText('not evaluated')).toBeVisible()
    expect(screen.queryByText(/0%/)).not.toBeInTheDocument()
  })

  it('exposes retained snapshot identity and separate interval and release states', () => {
    render(
      <GeographicMapQualitySnapshot
        projection={projection({
          campaignId: 'campaign:targeted',
          campaignTitle: 'Targeted failure discovery',
          samplingPurpose: 'failure_discovery',
          samplingDesign: 'targeted_priority',
          samplingRepresentative: false,
          qualityEstimationAllowed: false,
          qualityEstimationBlockedReason: 'Targeted samples do not support population inference.',
          currentDecisivelyReviewedCount: 7,
          snapshot: {
            availability: 'available',
            snapshotId: 'a'.repeat(64),
            capturedAt: '2026-07-17T19:00:00.000Z',
            snapshotDecisiveSampleCount: 6,
            precisionAvailability: 'unavailable',
            pointEstimate: null,
            intervalAvailability: 'unavailable',
            confidenceLevel: null,
            interval: null,
            effectiveSampleSize: null,
            milestoneStatus: 'not_due',
            currentMilestone: null,
            nextMilestone: 20,
            releaseStatus: 'blocked',
            releaseEvaluatedAtMilestone: null,
            releaseBlockers: ['precision_unavailable'],
          },
          scientificClaimAllowed: false,
        })}
      />,
    )

    expect(screen.getByText(/non-representative design/)).toBeVisible()
    expect(screen.getByText('unavailable')).toBeVisible()
    expect(screen.getByText('blocked')).toBeVisible()
    expect(screen.getByText('a'.repeat(64))).toBeVisible()
  })
})

function projection(
  quality: GeographicReviewProjection['quality'][number],
): GeographicReviewProjection {
  return {
    items: [],
    cells: [],
    quality: [quality],
    scientificClaimAllowed: false,
  }
}
