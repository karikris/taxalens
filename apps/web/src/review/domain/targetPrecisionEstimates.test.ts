import { describe, expect, it } from 'vitest'

import precisionReference from '../../../../../demo/source/verification/target-precision-reference.json'
import {
  HUMAN_REVIEW_CAMPAIGN,
  HUMAN_REVIEW_ITEMS,
} from '../reviewPacket'
import {
  TARGET_PRECISION_ESTIMATE_SCHEMA_VERSION,
  VERIFICATION_CONSENSUS_SCHEMA_VERSION,
  VERIFICATION_EVENT_SCHEMA_VERSION,
  bootstrapGroupedTargetPrecision,
  estimateSimpleRandomTargetPrecision,
  estimateWeightedTargetPrecision,
  wilsonInterval,
  type SamplingStratum,
  type VerificationCampaign,
  type VerificationConsensus,
  type VerificationEvent,
  type VerificationItem,
} from '.'

describe('target precision estimators', () => {
  it('matches independent Wilson references for zero and all errors', () => {
    for (const reference of precisionReference.wilson) {
      expect(
        wilsonInterval(reference.successCount, reference.sampleCount),
      ).toEqual({
        lower: expect.closeTo(reference.lower, 8),
        upper: expect.closeTo(reference.upper, 8),
      })
    }

    const allCorrect = simpleFixture(Array(10).fill('yes'))
    const correctEstimate = estimateSimpleRandomTargetPrecision(
      allCorrect.campaign,
      allCorrect.items,
      allCorrect.consensus,
    )
    expect(correctEstimate).toMatchObject({
      schemaVersion: TARGET_PRECISION_ESTIMATE_SCHEMA_VERSION,
      availability: 'available',
      estimate: 1,
      decisiveSampleCount: 10,
      correctCount: 10,
      errorCount: 0,
      interval: {
        lower: expect.closeTo(
          precisionReference.wilson[2]!.lower,
          8,
        ),
        upper: 1,
      },
    })

    const allErrors = simpleFixture(Array(10).fill('no'))
    expect(
      estimateSimpleRandomTargetPrecision(
        allErrors.campaign,
        allErrors.items,
        allErrors.consensus,
      ),
    ).toMatchObject({
      availability: 'available',
      estimate: 0,
      correctCount: 0,
      errorCount: 10,
      interval: {
        lower: 0,
        upper: expect.closeTo(
          precisionReference.wilson[0]!.upper,
          8,
        ),
      },
    })
  })

  it('rejects invalid simple-random plans and unequal probabilities', () => {
    const fixture = simpleFixture(['yes', 'no'])
    const unequalItems = fixture.items.map((item, index) => ({
      ...item,
      inclusionProbability: index === 0 ? 0.25 : 0.5,
    }))
    expect(
      estimateSimpleRandomTargetPrecision(
        fixture.campaign,
        unequalItems,
        fixture.consensus,
      ),
    ).toMatchObject({
      availability: 'unavailable',
      blockers: expect.arrayContaining([
        'inclusion_probability_unequal',
      ]),
      estimate: null,
      interval: null,
    })

    const targeted = {
      ...fixture.campaign,
      samplingPlan: {
        ...fixture.campaign.samplingPlan,
        purpose: 'failure_discovery' as const,
        design: 'targeted_priority' as const,
        representative: false,
        inclusionProbabilityRequired: false,
        qualityEstimationAllowed: false,
        qualityEstimationBlockedReason:
          'Targeted selection cannot estimate population quality.',
      },
    }
    expect(
      estimateSimpleRandomTargetPrecision(
        targeted,
        fixture.items,
        fixture.consensus,
      ),
    ).toMatchObject({
      availability: 'unavailable',
      blockers: expect.arrayContaining([
        'quality_estimation_not_allowed',
        'sampling_design_not_simple_random',
        'sampling_plan_not_representative',
        'sampling_purpose_not_quality_estimation',
      ]),
      interval: null,
    })
  })

  it('combines stratum shares and reports effective sample size', () => {
    const strata = [
      stratum('a', 80, 0.8),
      stratum('b', 20, 0.2),
    ]
    const campaign = qualityCampaign('stratified_random', strata)
    const items = [
      item(campaign, 'a-yes', 'a', 0.5),
      item(campaign, 'a-no', 'a', 0.5),
      item(campaign, 'b-yes-1', 'b', 0.25),
      item(campaign, 'b-yes-2', 'b', 0.25),
    ]
    const consensus = [
      resolved(campaign, items[0]!, 'yes'),
      resolved(campaign, items[1]!, 'no'),
      resolved(campaign, items[2]!, 'yes'),
      resolved(campaign, items[3]!, 'yes'),
    ]

    const estimate = estimateWeightedTargetPrecision(
      campaign,
      items,
      consensus,
    )

    expect(estimate).toMatchObject({
      availability: 'available',
      estimate: expect.closeTo(
        precisionReference.weighted.estimate,
        12,
      ),
      effectiveSampleSize: expect.closeTo(
        precisionReference.weighted.effectiveSampleSize,
        12,
      ),
      representedStrata: ['a', 'b'],
      missingStrata: [],
      decisiveSampleCount: 4,
    })
    expect(estimate.strata).toEqual([
      expect.objectContaining({
        stratumId: 'a',
        estimate: 0.5,
        populationWeight: 0.8,
        analysisWeight: expect.closeTo(0.8, 12),
      }),
      expect.objectContaining({
        stratumId: 'b',
        estimate: 1,
        populationWeight: 0.2,
        analysisWeight: expect.closeTo(0.2, 12),
      }),
    ])
  })

  it('uses unequal inverse-probability weights and blocks missing strata', () => {
    const oneStratum = [stratum('a', 100, 1)]
    const campaign = qualityCampaign('stratified_random', oneStratum)
    const items = [
      item(campaign, 'weighted-yes', 'a', 0.25),
      item(campaign, 'weighted-no', 'a', 0.5),
    ]
    const weighted = estimateWeightedTargetPrecision(
      campaign,
      items,
      [
        resolved(campaign, items[0]!, 'yes'),
        resolved(campaign, items[1]!, 'no'),
      ],
    )
    expect(weighted).toMatchObject({
      availability: 'available',
      estimate: expect.closeTo(2 / 3, 12),
      effectiveSampleSize: expect.closeTo(1.8, 12),
    })

    const twoStrata = qualityCampaign('stratified_random', [
      stratum('a', 50, 0.5),
      stratum('b', 50, 0.5),
    ])
    const missingItems = [
      item(twoStrata, 'represented', 'a', 0.5),
      item(twoStrata, 'missing', 'b', 0.5),
    ]
    const missing = estimateWeightedTargetPrecision(
      twoStrata,
      missingItems,
      [
        resolved(twoStrata, missingItems[0]!, 'yes'),
        pending(twoStrata, missingItems[1]!),
      ],
    )
    expect(missing).toMatchObject({
      availability: 'unavailable',
      blockers: expect.arrayContaining(['sampling_strata_missing']),
      representedStrata: ['a'],
      missingStrata: ['b'],
      estimate: null,
      effectiveSampleSize: null,
    })
  })

  it('bootstraps duplicate groups deterministically instead of iid media', () => {
    const campaign = {
      ...qualityCampaign('simple_random', [stratum('all', 4, 1)]),
      samplingPlan: {
        ...qualityCampaign('simple_random', [stratum('all', 4, 1)])
          .samplingPlan,
        groupingKeys: ['duplicate_group'] as const,
      },
    }
    const items = [
      item(campaign, 'yes-1', 'all', 0.5, 'duplicate-yes'),
      item(campaign, 'yes-2', 'all', 0.5, 'duplicate-yes'),
      item(campaign, 'no-1', 'all', 0.5, 'duplicate-no'),
      item(campaign, 'no-2', 'all', 0.5, 'duplicate-no'),
    ]
    const consensus = items.map((candidate, index) =>
      resolved(campaign, candidate, index < 2 ? 'yes' : 'no'),
    )

    const first = bootstrapGroupedTargetPrecision(
      campaign,
      items,
      consensus,
      { seed: 'grouped-bootstrap-test', replicates: 1_000 },
    )
    const second = bootstrapGroupedTargetPrecision(
      campaign,
      items,
      consensus,
      { seed: 'grouped-bootstrap-test', replicates: 1_000 },
    )

    expect(first).toEqual(second)
    expect(first).toMatchObject({
      availability: 'available',
      pointEstimate: 0.5,
      decisiveSampleCount: 4,
      resamplingGroupCount: 2,
      interval: {
        lower: 0,
        upper: 1,
      },
    })
    expect(first.groupingKeys).toContain(
      'grouping_key:duplicate_group',
    )
  })

  it('withholds bootstrap intervals for invalid plans and cross-stratum groups', () => {
    const baseCampaign = qualityCampaign('stratified_random', [
      stratum('a', 50, 0.5),
      stratum('b', 50, 0.5),
    ])
    const campaign = {
      ...baseCampaign,
      samplingPlan: {
        ...baseCampaign.samplingPlan,
        groupingKeys: ['duplicate_group'] as const,
      },
    }
    const items = [
      item(campaign, 'cross-a', 'a', 0.5, 'duplicate-cross'),
      item(campaign, 'cross-b', 'b', 0.5, 'duplicate-cross'),
    ]
    const consensus = items.map((candidate) =>
      resolved(campaign, candidate, 'yes'),
    )
    expect(
      bootstrapGroupedTargetPrecision(campaign, items, consensus, {
        seed: 'cross-stratum',
        replicates: 500,
      }),
    ).toMatchObject({
      availability: 'unavailable',
      blockers: expect.arrayContaining([
        'bootstrap_group_crosses_strata',
        'bootstrap_groups_insufficient',
      ]),
      interval: null,
    })

    const invalid = {
      ...campaign,
      samplingPlan: {
        ...campaign.samplingPlan,
        purpose: 'failure_discovery' as const,
        design: 'targeted_priority' as const,
        representative: false,
        qualityEstimationAllowed: false,
        qualityEstimationBlockedReason:
          'Targeted selection cannot estimate population quality.',
      },
    }
    expect(
      bootstrapGroupedTargetPrecision(invalid, items, consensus, {
        seed: 'invalid-plan',
        replicates: 500,
      }),
    ).toMatchObject({
      availability: 'unavailable',
      blockers: expect.arrayContaining([
        'sampling_design_not_bootstrap_eligible',
        'sampling_purpose_not_quality_estimation',
      ]),
      interval: null,
    })
  })
})

function simpleFixture(outcomes: readonly string[]) {
  const campaign = qualityCampaign('simple_random', [
    stratum('all', outcomes.length, 1),
  ])
  const items = outcomes.map((_, index) =>
    item(campaign, `simple-${index}`, 'all', 0.5),
  )
  return {
    campaign,
    items,
    consensus: items.map((candidate, index) =>
      resolved(
        campaign,
        candidate,
        outcomes[index] === 'yes' ? 'yes' : 'no',
      ),
    ),
  }
}

function qualityCampaign(
  design: VerificationCampaign['samplingPlan']['design'],
  strata: readonly SamplingStratum[],
): VerificationCampaign {
  return {
    ...HUMAN_REVIEW_CAMPAIGN,
    campaignId: `quality-${design}`,
    kind: 'flickr_target_verification',
    sourceProviders: ['flickr'],
    samplingPlan: {
      planId: `quality-${design}-plan`,
      purpose: 'quality_estimation',
      design,
      representative: true,
      blindReview: true,
      selectionSeed: 'quality-estimator-seed',
      targetSampleSize: null,
      inclusionProbabilityRequired: true,
      independentUnit: 'media',
      groupingKeys: [],
      leakagePolicy: 'final_test_only',
      strata,
      qualityEstimationAllowed: true,
      qualityEstimationBlockedReason: null,
    },
    disclosurePolicy: {
      mode: 'blind',
      revealAfterDecision: true,
      hiddenBeforeDecision: ['model_scores'],
    },
  }
}

function stratum(
  stratumId: string,
  populationCount: number,
  populationWeight: number,
): SamplingStratum {
  return {
    stratumId,
    label: `Stratum ${stratumId}`,
    populationCount,
    targetSampleCount: null,
    populationWeight,
    selectionNotes: null,
  }
}

function item(
  campaign: VerificationCampaign,
  itemId: string,
  stratumId: string,
  inclusionProbability: number,
  duplicateGroupId = `duplicate-${itemId}`,
): VerificationItem {
  const base = HUMAN_REVIEW_ITEMS[0]
  if (base === undefined) {
    throw new Error('Precision tests require one base item.')
  }
  return {
    ...base,
    itemId,
    campaignId: campaign.campaignId,
    source: 'flickr',
    sourceObservationId: `observation-${itemId}`,
    sourceMediaId: `media-${itemId}`,
    duplicateGroupId,
    observationGroupId: `observation-${itemId}`,
    ownerPhotographerGroupId: `owner-${itemId}`,
    samplingStratumId: stratumId,
    inclusionProbability,
    questionFingerprint: campaign.questionFingerprint,
  }
}

function resolved(
  campaign: VerificationCampaign,
  targetItem: VerificationItem,
  outcome: 'yes' | 'no',
): VerificationConsensus {
  const reviewEvent = event(campaign, targetItem, outcome)
  return {
    schemaVersion: VERIFICATION_CONSENSUS_SCHEMA_VERSION,
    campaignId: campaign.campaignId,
    itemId: targetItem.itemId,
    requiredReviewCount: 1,
    effectiveReviewCount: 1,
    decisiveReviewCount: 1,
    effectiveReviewerIds: ['reviewer-a'],
    latestEvents: [reviewEvent],
    decisiveEvents: [reviewEvent],
    status: 'complete_agreement',
    consensusOutcome: outcome,
    resolvedSignature: {
      outcome,
      nonTargetCategory: null,
      alternativeAcceptedTaxonKey: null,
      lifeStage: targetItem.expectedLifeStage ?? 'unknown',
      visualDomain: targetItem.expectedVisualDomain ?? 'ambiguous',
      view: targetItem.expectedView ?? 'unknown',
    },
    conflictingFields: [],
    conflictEventIds: [],
    secondReviewRequired: false,
    adjudicationRequired: false,
    supportEligibility: 'not_applicable',
    supportEligibilityBlockers: [],
    finalTestEligibility: 'eligible',
    finalTestEligibilityBlockers: [],
    resolvedAt: reviewEvent.reviewedAt,
  }
}

function pending(
  campaign: VerificationCampaign,
  targetItem: VerificationItem,
): VerificationConsensus {
  return {
    schemaVersion: VERIFICATION_CONSENSUS_SCHEMA_VERSION,
    campaignId: campaign.campaignId,
    itemId: targetItem.itemId,
    requiredReviewCount: 1,
    effectiveReviewCount: 0,
    decisiveReviewCount: 0,
    effectiveReviewerIds: [],
    latestEvents: [],
    decisiveEvents: [],
    status: 'pending',
    consensusOutcome: null,
    resolvedSignature: null,
    conflictingFields: [],
    conflictEventIds: [],
    secondReviewRequired: false,
    adjudicationRequired: false,
    supportEligibility: 'not_applicable',
    supportEligibilityBlockers: [],
    finalTestEligibility: 'blocked',
    finalTestEligibilityBlockers: ['review_not_completed'],
    resolvedAt: null,
  }
}

function event(
  campaign: VerificationCampaign,
  targetItem: VerificationItem,
  outcome: 'yes' | 'no',
): VerificationEvent {
  return {
    schemaVersion: VERIFICATION_EVENT_SCHEMA_VERSION,
    eventId: `event-${targetItem.itemId}`,
    campaignId: campaign.campaignId,
    itemId: targetItem.itemId,
    reviewerId: 'reviewer-a',
    reviewRound: 1,
    outcome,
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
    reviewedAt: '2026-07-16T15:00:00.000Z',
    durationMs: 1_000,
    imageSha256: targetItem.imageSha256,
    questionSha256: targetItem.questionFingerprint,
    campaignManifestSha256: campaign.manifestSha256,
    taxalensSha: campaign.taxalensSha,
    biominerSha: campaign.biominerSha,
    supersedesEventId: null,
    conflictsWithDecisionId: null,
  }
}
