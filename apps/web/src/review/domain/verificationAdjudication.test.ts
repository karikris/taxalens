import { describe, expect, it } from 'vitest'

import {
  HUMAN_REVIEW_CAMPAIGN,
  HUMAN_REVIEW_ITEMS,
} from '../reviewPacket'
import {
  VERIFICATION_EVENT_SCHEMA_VERSION,
  createVerificationAdjudicationEvent,
  projectVerificationConsensus,
  validateVerificationAdjudicationEvent,
  type VerificationCampaign,
  type VerificationEvent,
  type VerificationItem,
} from '.'

const item = HUMAN_REVIEW_ITEMS[0]
if (item === undefined) {
  throw new Error('Adjudication tests require one verification item.')
}

describe('verification adjudication', () => {
  it('appends an independent event linked to the exact conflict', () => {
    const campaign = adjudicationCampaign()
    const sourceEvents = conflictingEvents(campaign, item)
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
        comment: 'The diagnostic marks support the displayed label.',
        reviewedAt: '2026-07-16T15:02:00.000Z',
        durationMs: 2_000,
      },
    )

    expect(sourceEvents).toHaveLength(2)
    expect(adjudication).toMatchObject({
      reviewerId: 'adjudicator-c',
      outcome: 'yes',
      supersedesEventId: null,
      adjudication: {
        sourceConflictEventIds: ['event-a-yes', 'event-b-no'],
        sourceConflictFields: ['outcome'],
        sourceReviewerIds: ['reviewer-a', 'reviewer-b'],
      },
    })
    expect(
      validateVerificationAdjudicationEvent(
        adjudication,
        campaign,
        item,
        sourceEvents,
      ),
    ).toEqual([])

    const resolved = projectVerificationConsensus(
      campaign,
      [item],
      [...sourceEvents, adjudication],
    )[0]!
    expect(resolved).toMatchObject({
      status: 'adjudicated',
      consensusOutcome: 'yes',
      effectiveReviewCount: 3,
      decisiveReviewCount: 3,
      effectiveReviewerIds: [
        'adjudicator-c',
        'reviewer-a',
        'reviewer-b',
      ],
      conflictingFields: [],
      conflictEventIds: [],
      secondReviewRequired: false,
      adjudicationRequired: false,
      resolvedAt: adjudication.reviewedAt,
    })
    expect(resolved.latestEvents).toContain(sourceEvents[0])
    expect(resolved.latestEvents).toContain(sourceEvents[1])
  })

  it('rejects a source reviewer as the adjudicator', () => {
    const campaign = adjudicationCampaign()
    const sourceEvents = conflictingEvents(campaign, item)
    const conflict = projectVerificationConsensus(
      campaign,
      [item],
      sourceEvents,
    )[0]!

    expect(() =>
      createVerificationAdjudicationEvent(
        campaign,
        item,
        conflict,
        sourceEvents,
        {
          adjudicatorId: 'reviewer-a',
          outcome: 'yes',
          comment: null,
          reviewedAt: '2026-07-16T15:02:00.000Z',
          durationMs: null,
        },
      ),
    ).toThrow(/independent from the conflicting reviewers/u)
  })

  it('rejects stale or missing conflict lineage', () => {
    const campaign = adjudicationCampaign()
    const sourceEvents = conflictingEvents(campaign, item)
    const conflict = projectVerificationConsensus(
      campaign,
      [item],
      sourceEvents,
    )[0]!

    expect(() =>
      createVerificationAdjudicationEvent(
        campaign,
        item,
        conflict,
        sourceEvents.slice(0, 1),
        {
          adjudicatorId: 'adjudicator-c',
          outcome: 'no',
          comment: null,
          reviewedAt: '2026-07-16T15:02:00.000Z',
          durationMs: null,
        },
      ),
    ).toThrow(/source conflict event is unavailable/u)
  })
})

function adjudicationCampaign(): VerificationCampaign {
  return {
    ...HUMAN_REVIEW_CAMPAIGN,
    reviewRequirement: {
      ...HUMAN_REVIEW_CAMPAIGN.reviewRequirement,
      requiredIndependentReviewers: 2,
      secondReviewPolicy: 'on_conflict',
      adjudicationRequiredOnConflict: true,
    },
  }
}

function conflictingEvents(
  campaign: VerificationCampaign,
  targetItem: VerificationItem,
): readonly VerificationEvent[] {
  return Object.freeze([
    event(campaign, targetItem, {
      eventId: 'event-a-yes',
      reviewerId: 'reviewer-a',
      outcome: 'yes',
      reviewedAt: '2026-07-16T15:00:00.000Z',
    }),
    event(campaign, targetItem, {
      eventId: 'event-b-no',
      reviewerId: 'reviewer-b',
      outcome: 'no',
      reviewedAt: '2026-07-16T15:01:00.000Z',
    }),
  ])
}

function event(
  campaign: VerificationCampaign,
  targetItem: VerificationItem,
  values: {
    readonly eventId: string
    readonly reviewerId: string
    readonly outcome: 'yes' | 'no'
    readonly reviewedAt: string
  },
): VerificationEvent {
  return Object.freeze({
    schemaVersion: VERIFICATION_EVENT_SCHEMA_VERSION,
    eventId: values.eventId,
    campaignId: campaign.campaignId,
    itemId: targetItem.itemId,
    reviewerId: values.reviewerId,
    reviewRound: 1,
    outcome: values.outcome,
    comment: null,
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
    imageSha256: targetItem.imageSha256,
    questionSha256: targetItem.questionFingerprint,
    campaignManifestSha256: campaign.manifestSha256,
    taxalensSha: campaign.taxalensSha,
    biominerSha: campaign.biominerSha,
    supersedesEventId: null,
    conflictsWithDecisionId: null,
  })
}
