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
    expect(screen.getAllByText('not evaluated')).toHaveLength(2)
    expect(screen.getByText('not retained')).toBeVisible()
    expect(screen.getAllByText('unavailable')).toHaveLength(2)
    expect(screen.getByText('Population-quality estimate unavailable until a retained snapshot is attached.'))
      .toBeVisible()
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
            precisionAvailability: 'available',
            pointEstimate: 0.95,
            intervalAvailability: 'available',
            confidenceLevel: 0.95,
            interval: { lower: 0.9, upper: 0.99 },
            effectiveSampleSize: 6,
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
    expect(screen.getByText('Population-quality claims are blocked.', { exact: false }))
      .toBeVisible()
    expect(screen.getByText(/Targeted samples do not support population inference/)).toBeVisible()
    expect(screen.getByText(/7 decisive outcomes remain reviewed examples only/)).toBeVisible()
    expect(screen.getAllByText('blocked')).toHaveLength(2)
    expect(screen.getByText('6')).toBeVisible()
    expect(screen.getByText('20')).toBeVisible()
    expect(screen.getByText('not due')).toBeVisible()
    expect(screen.getByText('precision unavailable')).toBeVisible()
    expect(screen.getByText('a'.repeat(64))).toBeVisible()
    expect(screen.queryByText(/95%/)).not.toBeInTheDocument()
    expect(screen.queryByText(/90%/)).not.toBeInTheDocument()
  })

  it('shows a retained interval only for an eligible representative sampling design', () => {
    render(
      <GeographicMapQualitySnapshot
        projection={projection({
          campaignId: 'campaign:audit-ready',
          campaignTitle: 'Representative audit snapshot',
          samplingPurpose: 'quality_estimation',
          samplingDesign: 'stratified_random',
          samplingRepresentative: true,
          qualityEstimationAllowed: true,
          qualityEstimationBlockedReason: null,
          currentDecisivelyReviewedCount: 60,
          snapshot: {
            availability: 'available',
            snapshotId: 'b'.repeat(64),
            capturedAt: '2026-07-17T19:10:00.000Z',
            snapshotDecisiveSampleCount: 60,
            precisionAvailability: 'available',
            pointEstimate: 0.95,
            intervalAvailability: 'available',
            confidenceLevel: 0.95,
            interval: { lower: 0.91, upper: 0.98 },
            effectiveSampleSize: 54.4,
            milestoneStatus: 'evaluation_due',
            currentMilestone: 60,
            nextMilestone: 100,
            releaseStatus: 'release_ready',
            releaseEvaluatedAtMilestone: 60,
            releaseBlockers: [],
          },
          scientificClaimAllowed: false,
        })}
      />,
    )

    expect(screen.getByText(/Snapshot quality estimate 95%/)).toBeVisible()
    expect(screen.getByText(/95% confidence interval 91%–98%/)).toBeVisible()
    expect(screen.getByText('100')).toBeVisible()
    expect(screen.getByText('evaluation due')).toBeVisible()
    expect(screen.getByText('Campaign quality release blockers: none retained.')).toBeVisible()
    expect(screen.getByText(/does not make an individual candidate release-ready/)).toBeVisible()
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
