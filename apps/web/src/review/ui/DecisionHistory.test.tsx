import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  VERIFICATION_EVENT_SCHEMA_VERSION,
  createVerificationAdjudicationEvent,
  projectVerificationConsensus,
  type VerificationCampaign,
  type VerificationEvent,
} from '../domain'
import {
  HUMAN_REVIEW_CAMPAIGN,
  HUMAN_REVIEW_ITEMS,
} from '../reviewPacket'
import { DecisionHistory } from './DecisionHistory'

const item = requiredItem()

describe('DecisionHistory', () => {
  it('keeps revisions, superseded dissent, and adjudication lineage visible', () => {
    const campaign: VerificationCampaign = {
      ...HUMAN_REVIEW_CAMPAIGN,
      reviewRequirement: {
        ...HUMAN_REVIEW_CAMPAIGN.reviewRequirement,
        requiredIndependentReviewers: 2,
        secondReviewPolicy: 'on_conflict',
        adjudicationRequiredOnConflict: true,
      },
    }
    const first = event(campaign, {
      eventId: 'event-a-initial',
      reviewerId: 'reviewer-a',
      reviewRound: 1,
      outcome: 'yes',
      comment: 'Initial inspection.',
      reviewedAt: '2026-07-16T15:00:00.000Z',
      supersedesEventId: null,
    })
    const revision = event(campaign, {
      eventId: 'event-a-revision',
      reviewerId: 'reviewer-a',
      reviewRound: 2,
      outcome: 'yes',
      comment: 'Confirmed after zooming in.',
      reviewedAt: '2026-07-16T15:01:00.000Z',
      supersedesEventId: first.eventId,
    })
    const dissent = event(campaign, {
      eventId: 'event-b-no',
      reviewerId: 'reviewer-b',
      reviewRound: 1,
      outcome: 'no',
      comment: 'The marks appear inconsistent.',
      reviewedAt: '2026-07-16T15:02:00.000Z',
      supersedesEventId: null,
    })
    const sourceEvents = [first, revision, dissent]
    const conflict = projectVerificationConsensus(
      campaign,
      [item],
      sourceEvents,
    )[0]!
    const adjudication = createVerificationAdjudicationEvent(
      campaign,
      item,
      conflict,
      sourceEvents,
      {
        adjudicatorId: 'adjudicator-c',
        outcome: 'yes',
        comment: 'Adjudicated from the verified diagnostic marks.',
        reviewedAt: '2026-07-16T15:03:00.000Z',
        durationMs: 2_000,
      },
    )

    render(
      <DecisionHistory
        events={[adjudication, dissent, revision, first]}
        items={[item]}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Immutable decision history' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/4 append-only events across 1 item/u),
    ).toBeInTheDocument()
    const historyEvents = screen.getAllByRole('listitem')
    expect(historyEvents).toHaveLength(4)

    expect(within(historyEvents[0]!).getByText('event-a-initial')).toBeVisible()
    expect(within(historyEvents[0]!).getByText('Superseded')).toBeVisible()
    expect(
      within(historyEvents[0]!).getByText('Initial inspection.'),
    ).toBeVisible()

    expect(within(historyEvents[1]!).getByText('event-a-revision')).toBeVisible()
    expect(
      within(historyEvents[1]!).getByText('Revision round 2'),
    ).toBeVisible()
    expect(
      within(historyEvents[1]!).getByText('event-a-initial'),
    ).toBeVisible()

    expect(within(historyEvents[2]!).getByText('event-b-no')).toBeVisible()
    expect(
      within(historyEvents[2]!).getByText(
        'The marks appear inconsistent.',
      ),
    ).toBeVisible()

    expect(within(historyEvents[3]!).getByText('Adjudication')).toBeVisible()
    expect(
      within(historyEvents[3]!).getByText('event-a-revision'),
    ).toBeVisible()
    expect(
      within(historyEvents[3]!).getByText('event-b-no'),
    ).toBeVisible()
    expect(
      within(historyEvents[3]!).getByText('reviewer-a, reviewer-b'),
    ).toBeVisible()
  })
})

function event(
  campaign: VerificationCampaign,
  values: {
    readonly eventId: string
    readonly reviewerId: string
    readonly reviewRound: number
    readonly outcome: 'yes' | 'no'
    readonly comment: string
    readonly reviewedAt: string
    readonly supersedesEventId: string | null
  },
): VerificationEvent {
  return {
    schemaVersion: VERIFICATION_EVENT_SCHEMA_VERSION,
    eventId: values.eventId,
    campaignId: campaign.campaignId,
    itemId: item.itemId,
    reviewerId: values.reviewerId,
    reviewRound: values.reviewRound,
    outcome: values.outcome,
    comment: values.comment,
    nonTargetCategory: null,
    alternativeTaxon: null,
    correctedLifeStage: null,
    correctedVisualDomain: null,
    correctedView: null,
    mediaQuality: 'high',
    duplicateConcern: false,
    captiveOrCultivatedConcern: false,
    exclusionReason: null,
    confidence: 'high',
    reviewedAt: values.reviewedAt,
    durationMs: 1_000,
    imageSha256: item.imageSha256,
    questionSha256: item.questionFingerprint,
    campaignManifestSha256: campaign.manifestSha256,
    taxalensSha: campaign.taxalensSha,
    biominerSha: campaign.biominerSha,
    supersedesEventId: values.supersedesEventId,
    conflictsWithDecisionId: null,
  }
}

function requiredItem() {
  const candidate = HUMAN_REVIEW_ITEMS[0]
  if (candidate === undefined) {
    throw new Error('Decision history tests require one review item.')
  }
  return candidate
}
