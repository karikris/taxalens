import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  VERIFICATION_EVENT_SCHEMA_VERSION,
  projectVerificationConsensus,
  type VerificationCampaign,
  type VerificationEvent,
} from '../domain'
import {
  HUMAN_REVIEW_CAMPAIGN,
  HUMAN_REVIEW_ITEMS,
} from '../reviewPacket'
import { ConflictQueue } from './ConflictQueue'

const item = requiredItem()

describe('ConflictQueue', () => {
  it('shows image, provenance, reviewer events, and an adjudication action', () => {
    const consensus = conflictConsensus()
    const onOpenItem = vi.fn()

    render(
      <ConflictQueue
        consensus={consensus}
        items={[item]}
        onOpenItem={onOpenItem}
      />,
    )

    expect(
      screen.getByRole('img', {
        name: `Conflict review candidate for ${item.targetTaxon.scientificName}`,
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('Outcome')).toBeInTheDocument()
    expect(screen.getByText('reviewer-a')).toBeInTheDocument()
    expect(screen.getByText('reviewer-b')).toBeInTheDocument()
    expect(screen.getByText(item.rights.attribution)).toBeInTheDocument()
    const open = screen.getByRole('button', {
      name: 'Open item for adjudication',
    })
    fireEvent.click(open)
    expect(onOpenItem).toHaveBeenCalledWith(item.itemId)
  })

  it('gates Yes and No on verified media, then records the simple form', () => {
    const consensus = conflictConsensus()
    const onAdjudicate = vi.fn().mockReturnValue([])
    const { rerender } = render(
      <ConflictQueue
        consensus={consensus}
        defaultAdjudicatorId="adjudicator-c"
        items={[item]}
        onAdjudicate={onAdjudicate}
      />,
    )

    expect(
      screen.getByRole('button', { name: 'Adjudicate Yes' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Adjudicate No' }),
    ).toBeDisabled()
    expect(
      screen.getByText(/checksum-verified image has been displayed/u),
    ).toBeInTheDocument()

    rerender(
      <ConflictQueue
        adjudicationReadyItemIds={new Set([item.itemId])}
        consensus={consensus}
        defaultAdjudicatorId="adjudicator-c"
        items={[item]}
        onAdjudicate={onAdjudicate}
      />,
    )
    fireEvent.change(
      screen.getByLabelText('Optional adjudication comment'),
      {
        target: { value: 'Wing pattern supports the label.' },
      },
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Adjudicate Yes' }),
    )

    expect(onAdjudicate).toHaveBeenCalledWith(
      consensus[0],
      'yes',
      'adjudicator-c',
      'Wing pattern supports the label.',
    )
  })
})

function conflictConsensus() {
  const campaign: VerificationCampaign = {
    ...HUMAN_REVIEW_CAMPAIGN,
    reviewRequirement: {
      ...HUMAN_REVIEW_CAMPAIGN.reviewRequirement,
      requiredIndependentReviewers: 2,
      secondReviewPolicy: 'on_conflict',
      adjudicationRequiredOnConflict: true,
    },
  }
  return projectVerificationConsensus(campaign, [item], [
    event(campaign, 'event-a', 'reviewer-a', 'yes', '15:00'),
    event(campaign, 'event-b', 'reviewer-b', 'no', '15:01'),
  ])
}

function event(
  campaign: VerificationCampaign,
  eventId: string,
  reviewerId: string,
  outcome: 'yes' | 'no',
  time: string,
): VerificationEvent {
  return {
    schemaVersion: VERIFICATION_EVENT_SCHEMA_VERSION,
    eventId,
    campaignId: campaign.campaignId,
    itemId: item.itemId,
    reviewerId,
    reviewRound: 1,
    outcome,
    comment: outcome === 'no' ? 'The visible marks disagree.' : null,
    nonTargetCategory: null,
    alternativeTaxon: null,
    correctedLifeStage: null,
    correctedVisualDomain: null,
    correctedView: null,
    mediaQuality: 'high',
    duplicateConcern: false,
    captiveOrCultivatedConcern: false,
    exclusionReason: outcome === 'no' ? 'Wrong identity.' : null,
    confidence: 'high',
    reviewedAt: `2026-07-16T${time}:00.000Z`,
    durationMs: 1_000,
    imageSha256: item.imageSha256,
    questionSha256: item.questionFingerprint,
    campaignManifestSha256: campaign.manifestSha256,
    taxalensSha: campaign.taxalensSha,
    biominerSha: campaign.biominerSha,
    supersedesEventId: null,
    conflictsWithDecisionId: null,
  }
}

function requiredItem() {
  const candidate = HUMAN_REVIEW_ITEMS[0]
  if (candidate === undefined) {
    throw new Error('Conflict queue tests require one review item.')
  }
  return candidate
}
