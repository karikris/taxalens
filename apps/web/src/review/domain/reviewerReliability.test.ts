import { describe, expect, it } from 'vitest'

import {
  HUMAN_REVIEW_CAMPAIGN,
  HUMAN_REVIEW_ITEMS,
} from '../reviewPacket'
import {
  REVIEWER_CONTROL_SET_SCHEMA_VERSION,
  VERIFICATION_CONSENSUS_SCHEMA_VERSION,
  VERIFICATION_EVENT_SCHEMA_VERSION,
  calculateReviewerNominalAlpha,
  calculateReviewerPercentAgreement,
  evaluateReviewerControlPerformance,
  type ReviewerControlSet,
  type VerificationCampaign,
  type VerificationConsensus,
  type VerificationEvent,
} from '.'

describe('reviewer reliability', () => {
  it('calculates aggregate pairwise agreement without exposing reviewer IDs', () => {
    const consensus = [
      projection('item-agree', [
        event('item-agree', 'reviewer-a', 'yes'),
        event('item-agree', 'reviewer-b', 'yes'),
      ]),
      projection('item-disagree', [
        event('item-disagree', 'reviewer-a', 'yes'),
        event('item-disagree', 'reviewer-b', 'no'),
      ]),
      projection('item-non-scientific', [
        event('item-non-scientific', 'reviewer-a', 'cant_view'),
        event('item-non-scientific', 'reviewer-b', 'skipped'),
      ]),
    ]

    const agreement = calculateReviewerPercentAgreement(consensus)

    expect(agreement).toEqual({
      schemaVersion: 'taxalens-reviewer-reliability:v1.0.0',
      method: 'pairwise_percent_agreement',
      availability: 'available',
      blockers: [],
      itemCount: 3,
      overlappingItemCount: 2,
      anonymousReviewerCount: 2,
      scientificRatingCount: 4,
      pairCount: 2,
      agreementPairCount: 1,
      disagreementPairCount: 1,
      excludedNonScientificEventCount: 2,
      labelCounts: {
        yes: 3,
        no: 1,
        cant_tell: 0,
      },
      percentAgreement: 0.5,
    })
    expect(JSON.stringify(agreement)).not.toContain('reviewer-a')
    expect(JSON.stringify(agreement)).not.toContain('reviewer-b')
  })

  it('calculates nominal alpha and preserves undefined states', () => {
    const mixed = [
      projection('alpha-1', [
        event('alpha-1', 'reviewer-a', 'yes'),
        event('alpha-1', 'reviewer-b', 'yes'),
      ]),
      projection('alpha-2', [
        event('alpha-2', 'reviewer-a', 'yes'),
        event('alpha-2', 'reviewer-b', 'no'),
      ]),
    ]
    expect(calculateReviewerNominalAlpha(mixed)).toMatchObject({
      availability: 'available',
      overlappingItemCount: 2,
      coincidenceRatingCount: 4,
      observedDisagreement: 0.5,
      expectedDisagreement: 0.5,
      alpha: 0,
    })

    const perfect = [
      projection('perfect-1', [
        event('perfect-1', 'reviewer-a', 'yes'),
        event('perfect-1', 'reviewer-b', 'yes'),
      ]),
      projection('perfect-2', [
        event('perfect-2', 'reviewer-a', 'no'),
        event('perfect-2', 'reviewer-b', 'no'),
      ]),
    ]
    expect(calculateReviewerNominalAlpha(perfect)).toMatchObject({
      availability: 'available',
      alpha: 1,
      observedDisagreement: 0,
      expectedDisagreement: expect.closeTo(2 / 3, 12),
    })

    expect(calculateReviewerNominalAlpha(mixed.slice(0, 1))).toMatchObject({
      availability: 'unavailable',
      blockers: expect.arrayContaining(['reviewer_overlap_insufficient']),
      alpha: null,
    })
    const noVariation = [
      projection('same-1', [
        event('same-1', 'reviewer-a', 'yes'),
        event('same-1', 'reviewer-b', 'yes'),
      ]),
      projection('same-2', [
        event('same-2', 'reviewer-a', 'yes'),
        event('same-2', 'reviewer-b', 'yes'),
      ]),
    ]
    expect(calculateReviewerNominalAlpha(noVariation)).toMatchObject({
      availability: 'unavailable',
      blockers: expect.arrayContaining(['label_variation_absent']),
      observedDisagreement: null,
      expectedDisagreement: null,
      alpha: null,
    })
  })

  it('reports insufficient overlap instead of a misleading percentage', () => {
    const result = calculateReviewerPercentAgreement([
      projection('single', [event('single', 'reviewer-a', 'yes')]),
    ])

    expect(result).toMatchObject({
      availability: 'unavailable',
      blockers: ['reviewer_overlap_insufficient'],
      pairCount: 0,
      percentAgreement: null,
    })
  })

  it('evaluates pre-reviewed positive, negative, and media controls', () => {
    const campaign = controlCampaign()
    const controlSet = controls()
    const consensus = [
      projection('control-positive', [
        event('control-positive', 'reviewer-a', 'yes', campaign.campaignId),
        event('control-positive', 'reviewer-b', 'no', campaign.campaignId),
      ], campaign.campaignId),
      projection('control-negative', [
        event('control-negative', 'reviewer-a', 'no', campaign.campaignId),
        event('control-negative', 'reviewer-b', 'yes', campaign.campaignId),
      ], campaign.campaignId),
      projection('control-media', [
        event(
          'control-media',
          'reviewer-a',
          'cant_view',
          campaign.campaignId,
        ),
        event('control-media', 'reviewer-b', 'no', campaign.campaignId),
      ], campaign.campaignId),
    ]

    const performance = evaluateReviewerControlPerformance(
      campaign,
      consensus,
      controlSet,
    )

    expect(performance).toEqual({
      schemaVersion: 'taxalens-reviewer-reliability:v1.0.0',
      method: 'pre_reviewed_control_performance',
      availability: 'available',
      blockers: [],
      controlSetId: controlSet.controlSetId,
      groundTruthSha256: controlSet.groundTruthSha256,
      controlItemCount: 3,
      attemptedControlItemCount: 3,
      controlAttemptCount: 6,
      anonymousReviewerCount: 2,
      correctControlAttemptCount: 3,
      incorrectControlAttemptCount: 3,
      positiveControlAttemptCount: 2,
      negativeControlAttemptCount: 2,
      falsePositiveCount: 1,
      falseNegativeCount: 1,
      mediaFailureControlAttemptCount: 2,
      correctlyHandledMediaFailureCount: 1,
      unexpectedMediaFailureCount: 0,
      uncertainControlAttemptCount: 0,
      deferredControlAttemptCount: 0,
      controlAccuracy: 0.5,
      falsePositiveRate: 0.5,
      falseNegativeRate: 0.5,
      mediaFailureHandlingRate: 0.5,
      unexpectedMediaFailureRate: 0,
    })
    expect(JSON.stringify(performance)).not.toContain('reviewer-a')
    expect(JSON.stringify(performance)).not.toContain('reviewer-b')
  })

  it('withholds control performance for the wrong campaign or no attempts', () => {
    const controlSet = controls()
    const noAttempts = controlSet.controls.map(({ itemId }) =>
      projection(itemId, []),
    )

    expect(
      evaluateReviewerControlPerformance(
        HUMAN_REVIEW_CAMPAIGN,
        noAttempts,
        controlSet,
      ),
    ).toMatchObject({
      availability: 'unavailable',
      blockers: expect.arrayContaining([
        'campaign_not_reviewer_quality_control',
        'control_attempts_empty',
      ]),
      controlAccuracy: null,
    })
  })
})

function controlCampaign(): VerificationCampaign {
  return {
    ...HUMAN_REVIEW_CAMPAIGN,
    campaignId: 'reviewer-controls',
    kind: 'quality_control',
    samplingPlan: {
      planId: 'reviewer-control-plan',
      purpose: 'reviewer_quality_control',
      design: 'control_items',
      representative: false,
      blindReview: true,
      selectionSeed: 'reviewer-control-seed',
      targetSampleSize: 3,
      inclusionProbabilityRequired: false,
      independentUnit: 'media',
      groupingKeys: [],
      leakagePolicy: 'not_applicable',
      strata: [],
      qualityEstimationAllowed: false,
      qualityEstimationBlockedReason:
        'Control items assess reviewer performance, not population precision.',
    },
  }
}

function controls(): ReviewerControlSet {
  return {
    schemaVersion: REVIEWER_CONTROL_SET_SCHEMA_VERSION,
    controlSetId: 'synthetic-reviewer-controls',
    groundTruthSha256: 'a'.repeat(64),
    controls: [
      {
        itemId: 'control-positive',
        expectedMediaState: 'viewable',
        expectedOutcome: 'yes',
      },
      {
        itemId: 'control-negative',
        expectedMediaState: 'viewable',
        expectedOutcome: 'no',
      },
      {
        itemId: 'control-media',
        expectedMediaState: 'unviewable',
        expectedOutcome: null,
      },
    ],
  }
}

function projection(
  itemId: string,
  events: readonly VerificationEvent[],
  campaignId = HUMAN_REVIEW_CAMPAIGN.campaignId,
): VerificationConsensus {
  const decisiveEvents = events.filter(
    ({ outcome }) => outcome === 'yes' || outcome === 'no',
  )
  return {
    schemaVersion: VERIFICATION_CONSENSUS_SCHEMA_VERSION,
    campaignId,
    itemId,
    requiredReviewCount: 1,
    effectiveReviewCount: events.length,
    decisiveReviewCount: decisiveEvents.length,
    effectiveReviewerIds: events.map(({ reviewerId }) => reviewerId).sort(),
    latestEvents: events,
    decisiveEvents,
    status: events.length === 0 ? 'pending' : 'unresolved_disagreement',
    consensusOutcome: null,
    resolvedSignature: null,
    conflictingFields:
      decisiveEvents.length > 1 ? ['outcome'] : [],
    conflictEventIds:
      decisiveEvents.length > 1
        ? decisiveEvents.map(({ eventId }) => eventId).sort()
        : [],
    secondReviewRequired: events.length > 0,
    adjudicationRequired: false,
    supportEligibility: 'not_applicable',
    supportEligibilityBlockers: [],
    finalTestEligibility: 'not_applicable',
    finalTestEligibilityBlockers: [],
    resolvedAt: events.at(-1)?.reviewedAt ?? null,
  }
}

function event(
  itemId: string,
  reviewerId: string,
  outcome: VerificationEvent['outcome'],
  campaignId = HUMAN_REVIEW_CAMPAIGN.campaignId,
): VerificationEvent {
  const base = HUMAN_REVIEW_ITEMS[0]
  if (base === undefined) {
    throw new Error('Reliability tests require one base review item.')
  }
  const nonScientific = outcome === 'cant_view' || outcome === 'skipped'
  return {
    schemaVersion: VERIFICATION_EVENT_SCHEMA_VERSION,
    eventId: `event-${itemId}-${reviewerId}`,
    campaignId,
    itemId,
    reviewerId,
    reviewRound: 1,
    outcome,
    comment: null,
    nonTargetCategory: null,
    alternativeTaxon: null,
    correctedLifeStage: null,
    correctedVisualDomain: null,
    correctedView: null,
    mediaQuality: nonScientific ? 'unknown' : 'high',
    duplicateConcern: false,
    captiveOrCultivatedConcern: false,
    exclusionReason: null,
    confidence: nonScientific ? 'unknown' : 'high',
    reviewedAt: '2026-07-16T15:00:00.000Z',
    durationMs: 1_000,
    imageSha256: base.imageSha256,
    questionSha256: base.questionFingerprint,
    campaignManifestSha256: HUMAN_REVIEW_CAMPAIGN.manifestSha256,
    taxalensSha: HUMAN_REVIEW_CAMPAIGN.taxalensSha,
    biominerSha: HUMAN_REVIEW_CAMPAIGN.biominerSha,
    supersedesEventId: null,
    conflictsWithDecisionId: null,
  }
}
