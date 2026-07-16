import { describe, expect, it } from 'vitest'

import {
  HUMAN_REVIEW_CAMPAIGN,
} from '../reviewPacket'
import {
  REVIEWER_RELIABILITY_SCHEMA_VERSION,
  TARGET_PRECISION_ESTIMATE_SCHEMA_VERSION,
  VERIFICATION_COVERAGE_SCHEMA_VERSION,
  VERIFICATION_QUALITY_SNAPSHOT_SCHEMA_VERSION,
  VERIFICATION_RELEASE_POLICY_SCHEMA_VERSION,
  VERIFICATION_REVIEW_MILESTONE_SCHEMA_VERSION,
  createVerificationQualitySnapshot,
  validateVerificationQualitySnapshot,
  verifyVerificationQualitySnapshotFingerprint,
  type ReviewerNominalKrippendorffAlpha,
  type ReviewerPercentAgreement,
  type SimpleRandomTargetPrecisionEstimate,
  type VerificationCampaign,
  type VerificationQualitySnapshot,
  type VerificationQualitySnapshotInput,
} from '.'

describe('verification quality snapshots', () => {
  it('persists a release-ready milestone with complete quality evidence', async () => {
    const snapshot = await createVerificationQualitySnapshot(input())

    expect(snapshot).toMatchObject({
      schemaVersion: VERIFICATION_QUALITY_SNAPSHOT_SCHEMA_VERSION,
      campaign: {
        campaignId: 'quality-snapshot-campaign',
        samplingPlanId: 'quality-snapshot-plan',
        samplingPurpose: 'quality_estimation',
        samplingDesign: 'simple_random',
      },
      counts: {
        eligibleItems: 3,
        attemptedItems: 3,
        decisivelyReviewedItems: 3,
        decisiveQualitySampleItems: 3,
        correctQualitySampleItems: 3,
        errorQualitySampleItems: 0,
        unresolvedConflictItems: 0,
        adjudicatedItems: 0,
        anonymousReviewerCount: 2,
      },
      precision: {
        method: 'simple_random_wilson',
        availability: 'available',
        pointEstimate: 1,
        intervalMethod: 'simple_random_wilson',
        intervalAvailability: 'available',
        interval: { lower: 0.91, upper: 1 },
        effectiveSampleSize: 3,
        representedStrata: ['adult', 'larva'],
      },
      agreement: {
        pairwise: {
          percentAgreement: 0.9,
        },
        nominalAlpha: {
          alpha: 0.75,
        },
      },
      conflicts: {
        conflictedItems: 0,
        denominatorAttemptedItems: 3,
        conflictRate: 0,
      },
      milestone: {
        status: 'evaluation_due',
        currentMilestone: 3,
        releaseEvaluationAllowed: true,
      },
      release: {
        status: 'release_ready',
        evaluatedAtMilestone: 3,
        blockers: [],
        missingRequiredStrata: [],
      },
    })
    expect(Object.values(snapshot.fingerprints)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^[a-f0-9]{64}$/u),
      ]),
    )
    expect(snapshot.snapshotSha256).toMatch(/^[a-f0-9]{64}$/u)
    expect(validateVerificationQualitySnapshot(snapshot)).toEqual([])
    expect(
      await verifyVerificationQualitySnapshotFingerprint(snapshot),
    ).toBe(true)
    expect(JSON.stringify(snapshot)).not.toContain('reviewer-a')
    expect(JSON.stringify(snapshot)).not.toContain('reviewer-b')
  })

  it('fails every configured release threshold closed at a due milestone', async () => {
    const base = input()
    const snapshot = await createVerificationQualitySnapshot({
      ...base,
      precisionEstimate: {
        ...base.precisionEstimate,
        interval: { lower: 0.85, upper: 1 },
      } as SimpleRandomTargetPrecisionEstimate,
      reviewerAgreement: {
        ...base.reviewerAgreement,
        percentAgreement: 0.7,
        agreementPairCount: 7,
        disagreementPairCount: 3,
      },
      unresolvedConflictItems: 1,
      referenceReadiness: {
        status: 'not_ready',
        fingerprintSha256: 'c'.repeat(64),
        blockers: ['reference_support_incomplete'],
      },
      reviewedLabelLeakage: {
        status: 'failed',
        fingerprintSha256: 'd'.repeat(64),
        blockers: ['duplicate_group_crosses_split'],
      },
      releasePolicy: {
        ...base.releasePolicy,
        minimumDecisiveSample: 4,
        requiredStrata: ['adult', 'larva', 'pupa'],
      },
    })

    expect(snapshot.release).toEqual({
      status: 'blocked',
      evaluatedAtMilestone: 3,
      blockers: [
        'conflict_rate_above_policy',
        'minimum_decisive_sample_not_met',
        'precision_lower_bound_below_policy',
        'reference_readiness_not_met',
        'required_strata_missing',
        'reviewed_label_leakage_gate_not_met',
        'reviewer_agreement_below_policy',
      ],
      missingRequiredStrata: ['pupa'],
    })
  })

  it('does not evaluate quality between or twice at declared milestones', async () => {
    const between = await createVerificationQualitySnapshot(
      input(4, [3, 5]),
    )
    expect(between.release).toEqual({
      status: 'not_evaluated',
      evaluatedAtMilestone: null,
      blockers: ['review_milestone_not_due'],
      missingRequiredStrata: [],
    })

    const repeatedInput = input(3, [3, 5])
    const repeated = await createVerificationQualitySnapshot({
      ...repeatedInput,
      evaluatedMilestones: [3],
    })
    expect(repeated.release).toEqual({
      status: 'not_evaluated',
      evaluatedAtMilestone: null,
      blockers: ['review_milestone_already_evaluated'],
      missingRequiredStrata: [],
    })
  })

  it('fingerprints canonical persisted content and detects any change', async () => {
    const first = await createVerificationQualitySnapshot(input())
    const roundTripped = JSON.parse(
      JSON.stringify(first),
    ) as VerificationQualitySnapshot
    const second = await createVerificationQualitySnapshot({
      ...input(),
      campaign: {
        ...input().campaign,
        samplingPlan: {
          ...input().campaign.samplingPlan,
        },
      },
    })
    const changedLedger = await createVerificationQualitySnapshot({
      ...input(),
      decisionLedgerSha256: 'e'.repeat(64),
    })
    const tampered = {
      ...first,
      release: {
        ...first.release,
        status: 'blocked',
      },
    } as VerificationQualitySnapshot

    expect(roundTripped).toEqual(first)
    expect(validateVerificationQualitySnapshot(roundTripped)).toEqual([])
    expect(
      await verifyVerificationQualitySnapshotFingerprint(roundTripped),
    ).toBe(true)
    expect(second.snapshotSha256).toBe(first.snapshotSha256)
    expect(changedLedger.snapshotSha256).not.toBe(first.snapshotSha256)
    expect(
      await verifyVerificationQualitySnapshotFingerprint(tampered),
    ).toBe(false)
  })

  it('binds reference-bank quality to the snapshot fingerprint', async () => {
    const base = input()
    const first = await createVerificationQualitySnapshot({
      ...base,
      referenceBank: referenceBankQuality(),
    })
    const changed = await createVerificationQualitySnapshot({
      ...base,
      referenceBank: {
        ...referenceBankQuality(),
        excludedSupportCount: 13,
      },
    })

    expect(first.referenceBank).toMatchObject({
      prototypeRoleAttestations: {
        providerSupportedRecordCount: 81,
        attestedRecordCount: 81,
        suitableRecordCount: 81,
        independentHumanTaxonomicVerificationClaimed: false,
      },
      taxonomicIdentityReviews: {
        reviewedRecordCount: 0,
        independentlyVerifiedRecordCount: 0,
      },
      prototypeSupportCount: 81,
      verifiedSupportCount: 0,
      excludedSupportCount: 12,
      providerDistribution: {
        availability: 'unavailable',
        entries: [],
      },
      routeDistribution: {
        availability: 'available',
        entries: [
          { key: 'adult_field', label: 'Adult field', count: 80 },
          { key: 'larval', label: 'Larval', count: 1 },
          {
            key: 'pinned_specimen',
            label: 'Pinned specimen',
            count: 0,
          },
        ],
      },
      readiness: {
        status: 'not_ready',
      },
    })
    expect(first.snapshotSha256).not.toBe(changed.snapshotSha256)
    expect(
      await verifyVerificationQualitySnapshotFingerprint(first),
    ).toBe(true)
  })
})

function input(
  sampleCount = 3,
  milestones: readonly number[] = [3, 5],
): VerificationQualitySnapshotInput {
  const campaign = campaignFixture(sampleCount)
  const correctCount = sampleCount
  return {
    capturedAt: '2026-07-16T19:00:00.000Z',
    campaign,
    coverage: {
      schemaVersion: VERIFICATION_COVERAGE_SCHEMA_VERSION,
      eligibleItems: sampleCount,
      attemptedItems: sampleCount,
      unattemptedItems: 0,
      decisivelyReviewedItems: sampleCount,
      resolvedYesItems: correctCount,
      resolvedNoItems: 0,
      uncertainItems: 0,
      mediaFailureItems: 0,
      deferredItems: 0,
      pendingItems: 0,
      effectiveReviewCount: sampleCount * 2,
      decisiveReviewCount: sampleCount * 2,
      yesReviewCount: sampleCount * 2,
      noReviewCount: 0,
      cantTellReviewCount: 0,
      cantViewReviewCount: 0,
      skippedReviewCount: 0,
      inspectedItems: sampleCount,
      viewableItems: sampleCount,
      reviewCoverage: 1,
      inspectionCoverage: 1,
      viewabilityRate: 1,
    },
    precisionEstimate: precisionEstimate(campaign, sampleCount),
    precisionInterval: null,
    strata: [
      {
        stratumId: 'adult',
        label: 'Adult',
        decisiveSampleCount: sampleCount - 1,
        populationWeight: 0.7,
        estimate: 1,
      },
      {
        stratumId: 'larva',
        label: 'Larva',
        decisiveSampleCount: 1,
        populationWeight: 0.3,
        estimate: 1,
      },
    ],
    reviewerAgreement: reviewerAgreement(sampleCount),
    reviewerNominalAlpha: reviewerAlpha(sampleCount),
    unresolvedConflictItems: 0,
    adjudicatedItems: 0,
    referenceReadiness: {
      status: 'ready',
      fingerprintSha256: 'c'.repeat(64),
      blockers: [],
    },
    reviewedLabelLeakage: {
      status: 'passed',
      fingerprintSha256: 'd'.repeat(64),
      blockers: [],
    },
    releasePolicy: {
      schemaVersion: VERIFICATION_RELEASE_POLICY_SCHEMA_VERSION,
      policyId: 'quality-snapshot-release-v1',
      minimumDecisiveSample: 3,
      requiredStrata: ['adult', 'larva'],
      minimumReviewerAgreement: 0.8,
      maximumConflictRate: 0.1,
      requireReferenceReadiness: true,
      minimumPrecisionLowerBound: 0.9,
      requireReviewedLabelLeakageGate: true,
    },
    milestonePlan: {
      schemaVersion: VERIFICATION_REVIEW_MILESTONE_SCHEMA_VERSION,
      milestonePlanId: 'quality-snapshot-milestones-v1',
      milestones,
    },
    evaluatedMilestones: [],
    decisionLedgerSha256: 'a'.repeat(64),
    reviewedLabelsSha256: 'b'.repeat(64),
  }
}

function campaignFixture(sampleCount: number): VerificationCampaign {
  return {
    ...HUMAN_REVIEW_CAMPAIGN,
    campaignId: 'quality-snapshot-campaign',
    title: 'Quality snapshot campaign',
    kind: 'flickr_target_verification',
    status: 'active',
    sourceProviders: ['flickr'],
    samplingPlan: {
      planId: 'quality-snapshot-plan',
      purpose: 'quality_estimation',
      design: 'simple_random',
      representative: true,
      blindReview: true,
      selectionSeed: 'quality-snapshot-seed',
      targetSampleSize: sampleCount,
      inclusionProbabilityRequired: true,
      independentUnit: 'media',
      groupingKeys: [],
      leakagePolicy: 'final_test_only',
      strata: [
        {
          stratumId: 'adult',
          label: 'Adult',
          populationCount: 70,
          targetSampleCount: sampleCount - 1,
          populationWeight: 0.7,
          selectionNotes: null,
        },
        {
          stratumId: 'larva',
          label: 'Larva',
          populationCount: 30,
          targetSampleCount: 1,
          populationWeight: 0.3,
          selectionNotes: null,
        },
      ],
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

function precisionEstimate(
  campaign: VerificationCampaign,
  sampleCount: number,
): SimpleRandomTargetPrecisionEstimate {
  return {
    schemaVersion: TARGET_PRECISION_ESTIMATE_SCHEMA_VERSION,
    method: 'simple_random_wilson',
    availability: 'available',
    blockers: [],
    samplingPlanId: campaign.samplingPlan.planId,
    confidenceLevel: 0.95,
    sampledItemCount: sampleCount,
    decisiveSampleCount: sampleCount,
    correctCount: sampleCount,
    errorCount: 0,
    estimate: 1,
    interval: {
      lower: 0.91,
      upper: 1,
    },
  }
}

function reviewerAgreement(sampleCount: number): ReviewerPercentAgreement {
  return {
    schemaVersion: REVIEWER_RELIABILITY_SCHEMA_VERSION,
    method: 'pairwise_percent_agreement',
    availability: 'available',
    blockers: [],
    itemCount: sampleCount,
    overlappingItemCount: sampleCount,
    anonymousReviewerCount: 2,
    scientificRatingCount: sampleCount * 2,
    pairCount: 10,
    agreementPairCount: 9,
    disagreementPairCount: 1,
    excludedNonScientificEventCount: 0,
    labelCounts: {
      yes: sampleCount * 2,
      no: 0,
      cant_tell: 0,
    },
    percentAgreement: 0.9,
  }
}

function reviewerAlpha(
  sampleCount: number,
): ReviewerNominalKrippendorffAlpha {
  return {
    schemaVersion: REVIEWER_RELIABILITY_SCHEMA_VERSION,
    method: 'krippendorff_alpha_nominal',
    availability: 'available',
    blockers: [],
    itemCount: sampleCount,
    overlappingItemCount: sampleCount,
    anonymousReviewerCount: 2,
    scientificRatingCount: sampleCount * 2,
    coincidenceRatingCount: sampleCount * 2,
    excludedNonScientificEventCount: 0,
    labelCounts: {
      yes: sampleCount * 2 - 1,
      no: 1,
      cant_tell: 0,
    },
    observedDisagreement: 0.1,
    expectedDisagreement: 0.4,
    alpha: 0.75,
  }
}

function referenceBankQuality() {
  return {
    prototypeRoleAttestations: {
      status: 'verified_complete' as const,
      providerSupportedRecordCount: 81,
      attestedRecordCount: 81,
      suitableRecordCount: 81,
      independentHumanTaxonomicVerificationClaimed: false,
    },
    taxonomicIdentityReviews: {
      reviewedRecordCount: 0,
      independentlyVerifiedRecordCount: 0,
    },
    prototypeSupportCount: 81,
    verifiedSupportCount: 0,
    excludedSupportCount: 12,
    conflicts: {
      availability: 'unavailable' as const,
      conflictCount: null,
      unavailableReason:
        'No independently reviewed reference decision ledger is attached.',
    },
    providerDistribution: {
      availability: 'unavailable' as const,
      entries: [],
      unavailableReason:
        'The aggregate prototype evidence does not publish provider counts.',
    },
    routeDistribution: {
      availability: 'available' as const,
      entries: [
        { key: 'adult_field', label: 'Adult field', count: 80 },
        { key: 'larval', label: 'Larval', count: 1 },
        {
          key: 'pinned_specimen',
          label: 'Pinned specimen',
          count: 0,
        },
      ],
      unavailableReason: null,
    },
    readiness: {
      status: 'not_ready' as const,
      blockers: [
        'independent_taxonomic_verification_missing',
        'reference_support_shortfall',
      ],
    },
    sourceSnapshotSha256: 'f'.repeat(64),
  }
}
