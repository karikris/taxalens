import { describe, expect, it } from 'vitest'

import {
  isVerificationCampaignKind,
  validateReviewRequirement,
  validateSamplingPlan,
  type ReviewRequirement,
  type SamplingPlan,
} from './verificationContracts'

describe('verification campaign contracts', () => {
  it('recognizes the five closed campaign kinds', () => {
    expect(isVerificationCampaignKind('flickr_target_verification')).toBe(true)
    expect(isVerificationCampaignKind('reference_identity_verification')).toBe(
      true,
    )
    expect(isVerificationCampaignKind('reference_route_verification')).toBe(
      true,
    )
    expect(isVerificationCampaignKind('adjudication')).toBe(true)
    expect(isVerificationCampaignKind('quality_control')).toBe(true)
    expect(isVerificationCampaignKind('generic_review')).toBe(false)
  })

  it('rejects conflict requirements without independent reviewer overlap', () => {
    const requirement: ReviewRequirement = {
      requiredIndependentReviewers: 1,
      secondReviewPolicy: 'on_conflict',
      adjudicationRequiredOnConflict: true,
      decisiveOutcomes: ['yes', 'no'],
      mediaRequiredOutcomes: ['yes', 'no', 'cant_tell'],
      nonScientificOutcomes: ['cant_view', 'skipped'],
    }

    expect(validateReviewRequirement(requirement)).toContain(
      'conflict adjudication requires at least two independent reviewers',
    )
  })

  it('blocks quality estimates for a targeted failure-discovery design', () => {
    const plan: SamplingPlan = {
      planId: 'failure-discovery-v1',
      purpose: 'failure_discovery',
      design: 'targeted_priority',
      representative: false,
      blindReview: false,
      selectionSeed: null,
      targetSampleSize: 50,
      inclusionProbabilityRequired: false,
      independentUnit: 'observation_group',
      groupingKeys: ['duplicate_group', 'observation_group', 'owner_group'],
      leakagePolicy: 'model_selection_only',
      strata: [],
      qualityEstimationAllowed: false,
      qualityEstimationBlockedReason:
        'Targeted priority queues are not unweighted population samples.',
    }

    expect(validateSamplingPlan(plan)).toEqual([])
    expect(
      validateSamplingPlan({
        ...plan,
        qualityEstimationAllowed: true,
        qualityEstimationBlockedReason: null,
      }),
    ).toContain(
      'quality estimation requires a representative probability sampling design',
    )
  })
})
