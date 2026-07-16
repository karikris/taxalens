import {
  REVIEWER_RELIABILITY_SCHEMA_VERSION,
  type ReviewerNominalKrippendorffAlpha,
  type ReviewerControlPerformance,
  type ReviewerPercentAgreement,
} from './reviewerReliability'
import {
  TARGET_PRECISION_ESTIMATE_SCHEMA_VERSION,
  type GroupedBootstrapTargetPrecisionInterval,
  type SimpleRandomTargetPrecisionEstimate,
  type WeightedTargetPrecisionEstimate,
} from './targetPrecisionEstimates'
import {
  VERIFICATION_CAMPAIGN_SCHEMA_VERSION,
  validateSamplingPlan,
  type TaxonIdentity,
  type VerificationCampaign,
} from './verificationContracts'
import {
  validateVerificationCoverage,
  type VerificationCoverage,
} from './verificationCoverage'
import {
  validateVerificationReleasePolicy,
  type VerificationReleasePolicy,
} from './verificationReleasePolicy'
import {
  evaluateVerificationReviewMilestone,
  validateVerificationReviewMilestonePlan,
  type VerificationMilestoneEvaluation,
  type VerificationReviewMilestonePlan,
} from './verificationReviewMilestones'

export const VERIFICATION_QUALITY_SNAPSHOT_SCHEMA_VERSION =
  'taxalens-verification-quality-snapshot:v1.1.0' as const

export type VerificationQualityGateStatus =
  | 'ready'
  | 'not_ready'
  | 'unavailable'

export type ReviewedLabelLeakageGateStatus =
  | 'passed'
  | 'failed'
  | 'unavailable'

export interface VerificationQualityGateEvidence<
  Status extends string,
> {
  readonly status: Status
  readonly fingerprintSha256: string
  readonly blockers: readonly string[]
}

export interface VerificationQualityStratum {
  readonly stratumId: string
  readonly label: string
  readonly decisiveSampleCount: number
  readonly populationWeight: number | null
  readonly estimate: number | null
}

export interface VerificationQualityDistributionEntry {
  readonly key: string
  readonly label: string
  readonly count: number
}

export interface VerificationQualityDistribution {
  readonly availability: 'available' | 'unavailable'
  readonly entries: readonly VerificationQualityDistributionEntry[]
  readonly unavailableReason: string | null
}

export interface VerificationReferenceBankQuality {
  readonly prototypeRoleAttestations: {
    readonly status: 'verified_complete' | 'incomplete' | 'unavailable'
    readonly providerSupportedRecordCount: number
    readonly attestedRecordCount: number
    readonly suitableRecordCount: number
    readonly independentHumanTaxonomicVerificationClaimed: boolean
  }
  readonly taxonomicIdentityReviews: {
    readonly reviewedRecordCount: number
    readonly independentlyVerifiedRecordCount: number
  }
  readonly prototypeSupportCount: number
  readonly verifiedSupportCount: number
  readonly excludedSupportCount: number
  readonly conflicts: {
    readonly availability: 'available' | 'unavailable'
    readonly conflictCount: number | null
    readonly unavailableReason: string | null
  }
  readonly providerDistribution: VerificationQualityDistribution
  readonly routeDistribution: VerificationQualityDistribution
  readonly readiness: {
    readonly status: VerificationQualityGateStatus
    readonly blockers: readonly string[]
  }
  readonly sourceSnapshotSha256: string
}

export interface VerificationReviewerControlQuality {
  readonly availability: 'available' | 'unavailable'
  readonly blockers: readonly string[]
  readonly controlSetId: string | null
  readonly groundTruthSha256: string | null
  readonly controlItemCount: number
  readonly attemptedControlItemCount: number
  readonly controlAttemptCount: number
  readonly controlAccuracy: number | null
  readonly falsePositiveRate: number | null
  readonly falseNegativeRate: number | null
  readonly mediaFailureHandlingRate: number | null
  readonly unexpectedMediaFailureRate: number | null
}

export interface VerificationQualitySnapshotInput {
  readonly capturedAt: string
  readonly campaign: VerificationCampaign
  readonly coverage: VerificationCoverage
  readonly precisionEstimate:
    | SimpleRandomTargetPrecisionEstimate
    | WeightedTargetPrecisionEstimate
  readonly precisionInterval:
    | GroupedBootstrapTargetPrecisionInterval
    | null
  readonly strata: readonly VerificationQualityStratum[]
  readonly reviewerAgreement: ReviewerPercentAgreement
  readonly reviewerNominalAlpha: ReviewerNominalKrippendorffAlpha
  readonly unresolvedConflictItems: number
  readonly adjudicatedItems: number
  readonly referenceReadiness: VerificationQualityGateEvidence<VerificationQualityGateStatus>
  readonly reviewedLabelLeakage: VerificationQualityGateEvidence<ReviewedLabelLeakageGateStatus>
  readonly referenceBank?: VerificationReferenceBankQuality | null
  readonly reviewerControlPerformance?: ReviewerControlPerformance | null
  readonly releasePolicy: VerificationReleasePolicy
  readonly milestonePlan: VerificationReviewMilestonePlan
  readonly evaluatedMilestones: readonly number[]
  readonly decisionLedgerSha256: string
  readonly reviewedLabelsSha256: string
}

export interface VerificationQualityCampaignSnapshot {
  readonly campaignId: string
  readonly title: string
  readonly kind: VerificationCampaign['kind']
  readonly status: VerificationCampaign['status']
  readonly targetTaxon: TaxonIdentity | null
  readonly sourceProviders: readonly VerificationCampaign['sourceProviders'][number][]
  readonly samplingPlanId: string
  readonly samplingPurpose: VerificationCampaign['samplingPlan']['purpose']
  readonly samplingDesign: VerificationCampaign['samplingPlan']['design']
}

export interface VerificationQualityCounts {
  readonly eligibleItems: number
  readonly attemptedItems: number
  readonly decisivelyReviewedItems: number
  readonly decisiveQualitySampleItems: number
  readonly correctQualitySampleItems: number
  readonly errorQualitySampleItems: number
  readonly unresolvedConflictItems: number
  readonly adjudicatedItems: number
  readonly anonymousReviewerCount: number
}

export interface VerificationQualityPrecision {
  readonly method:
    | SimpleRandomTargetPrecisionEstimate['method']
    | WeightedTargetPrecisionEstimate['method']
  readonly availability: 'available' | 'unavailable'
  readonly estimateBlockers: readonly string[]
  readonly pointEstimate: number | null
  readonly intervalMethod:
    | SimpleRandomTargetPrecisionEstimate['method']
    | GroupedBootstrapTargetPrecisionInterval['method']
  readonly intervalAvailability: 'available' | 'unavailable'
  readonly intervalBlockers: readonly string[]
  readonly confidenceLevel: number | null
  readonly interval: {
    readonly lower: number
    readonly upper: number
  } | null
  readonly effectiveSampleSize: number | null
  readonly decisiveSampleCount: number
  readonly representedStrata: readonly string[]
  readonly strata: readonly VerificationQualityStratum[]
}

export interface VerificationQualityAgreement {
  readonly pairwise: {
    readonly availability: 'available' | 'unavailable'
    readonly blockers: readonly string[]
    readonly overlappingItemCount: number
    readonly anonymousReviewerCount: number
    readonly pairCount: number
    readonly percentAgreement: number | null
  }
  readonly nominalAlpha: {
    readonly availability: 'available' | 'unavailable'
    readonly blockers: readonly string[]
    readonly overlappingItemCount: number
    readonly alpha: number | null
  }
}

export interface VerificationQualityConflicts {
  readonly conflictedItems: number
  readonly unresolvedConflictItems: number
  readonly adjudicatedItems: number
  readonly denominatorAttemptedItems: number
  readonly conflictRate: number | null
}

export interface VerificationQualityFingerprints {
  readonly campaignManifestSha256: string
  readonly questionSha256: string
  readonly samplingPlanSha256: string
  readonly decisionLedgerSha256: string
  readonly reviewedLabelsSha256: string
  readonly referenceReadinessSha256: string
  readonly reviewedLabelLeakageSha256: string
  readonly releasePolicySha256: string
  readonly milestonePlanSha256: string
}

export type VerificationReleaseBlocker =
  | 'conflict_rate_above_policy'
  | 'conflict_rate_unavailable'
  | 'minimum_decisive_sample_not_met'
  | 'precision_estimate_unavailable'
  | 'precision_interval_unavailable'
  | 'precision_lower_bound_below_policy'
  | 'reference_readiness_not_met'
  | 'required_strata_missing'
  | 'review_milestone_already_evaluated'
  | 'review_milestone_not_due'
  | 'review_milestone_schedule_complete'
  | 'reviewed_label_leakage_gate_not_met'
  | 'reviewer_agreement_below_policy'
  | 'reviewer_agreement_unavailable'

export interface VerificationQualityRelease {
  readonly status: 'not_evaluated' | 'blocked' | 'release_ready'
  readonly evaluatedAtMilestone: number | null
  readonly blockers: readonly VerificationReleaseBlocker[]
  readonly missingRequiredStrata: readonly string[]
}

export interface VerificationQualitySnapshot {
  readonly schemaVersion:
    typeof VERIFICATION_QUALITY_SNAPSHOT_SCHEMA_VERSION
  readonly capturedAt: string
  readonly campaign: VerificationQualityCampaignSnapshot
  readonly counts: VerificationQualityCounts
  readonly coverage: VerificationCoverage
  readonly precision: VerificationQualityPrecision
  readonly agreement: VerificationQualityAgreement
  readonly conflicts: VerificationQualityConflicts
  readonly referenceReadiness: {
    readonly status: VerificationQualityGateStatus
    readonly blockers: readonly string[]
  }
  readonly reviewedLabelLeakage: {
    readonly status: ReviewedLabelLeakageGateStatus
    readonly blockers: readonly string[]
  }
  readonly referenceBank: VerificationReferenceBankQuality | null
  readonly reviewerControl: VerificationReviewerControlQuality | null
  readonly milestone: VerificationMilestoneEvaluation
  readonly fingerprints: VerificationQualityFingerprints
  readonly release: VerificationQualityRelease
  readonly snapshotSha256: string
}

export async function createVerificationQualitySnapshot(
  input: VerificationQualitySnapshotInput,
): Promise<VerificationQualitySnapshot> {
  const failures = validateSnapshotInput(input)
  if (failures.length > 0) {
    throw new Error(
      `Verification quality snapshot input is invalid: ${failures.join('; ')}`,
    )
  }
  const milestone = evaluateVerificationReviewMilestone(
    input.milestonePlan,
    input.precisionEstimate.decisiveSampleCount,
    input.evaluatedMilestones,
  )
  const strata = Object.freeze(
    input.strata.map((stratum) => Object.freeze({ ...stratum })),
  )
  const representedStrata = Object.freeze(
    strata
      .filter(({ decisiveSampleCount }) => decisiveSampleCount > 0)
      .map(({ stratumId }) => stratumId),
  )
  const precision = precisionSnapshot(
    input.precisionEstimate,
    input.precisionInterval,
    strata,
    representedStrata,
  )
  const conflictedItems =
    input.unresolvedConflictItems + input.adjudicatedItems
  const conflicts: VerificationQualityConflicts = Object.freeze({
    conflictedItems,
    unresolvedConflictItems: input.unresolvedConflictItems,
    adjudicatedItems: input.adjudicatedItems,
    denominatorAttemptedItems: input.coverage.attemptedItems,
    conflictRate:
      input.coverage.attemptedItems === 0
        ? null
        : conflictedItems / input.coverage.attemptedItems,
  })
  const release = releaseSnapshot(
    input.releasePolicy,
    milestone,
    precision,
    input.reviewerAgreement,
    conflicts,
    input.referenceReadiness,
    input.reviewedLabelLeakage,
  )
  const payload: Omit<VerificationQualitySnapshot, 'snapshotSha256'> =
    Object.freeze({
      schemaVersion: VERIFICATION_QUALITY_SNAPSHOT_SCHEMA_VERSION,
      capturedAt: input.capturedAt,
      campaign: campaignSnapshot(input.campaign),
      counts: Object.freeze({
        eligibleItems: input.coverage.eligibleItems,
        attemptedItems: input.coverage.attemptedItems,
        decisivelyReviewedItems:
          input.coverage.decisivelyReviewedItems,
        decisiveQualitySampleItems:
          input.precisionEstimate.decisiveSampleCount,
        correctQualitySampleItems:
          input.precisionEstimate.correctCount,
        errorQualitySampleItems: input.precisionEstimate.errorCount,
        unresolvedConflictItems: input.unresolvedConflictItems,
        adjudicatedItems: input.adjudicatedItems,
        anonymousReviewerCount:
          input.reviewerAgreement.anonymousReviewerCount,
      }),
      coverage: Object.freeze({ ...input.coverage }),
      precision,
      agreement: agreementSnapshot(
        input.reviewerAgreement,
        input.reviewerNominalAlpha,
      ),
      conflicts,
      referenceReadiness: Object.freeze({
        status: input.referenceReadiness.status,
        blockers: canonicalStrings(input.referenceReadiness.blockers),
      }),
      reviewedLabelLeakage: Object.freeze({
        status: input.reviewedLabelLeakage.status,
        blockers: canonicalStrings(input.reviewedLabelLeakage.blockers),
      }),
      referenceBank: referenceBankSnapshot(input.referenceBank ?? null),
      reviewerControl: reviewerControlSnapshot(
        input.reviewerControlPerformance ?? null,
      ),
      milestone,
      fingerprints: Object.freeze({
        campaignManifestSha256: input.campaign.manifestSha256,
        questionSha256: input.campaign.questionFingerprint,
        samplingPlanSha256: await sha256Canonical(
          canonicalSamplingPlan(input.campaign),
        ),
        decisionLedgerSha256: input.decisionLedgerSha256,
        reviewedLabelsSha256: input.reviewedLabelsSha256,
        referenceReadinessSha256:
          input.referenceReadiness.fingerprintSha256,
        reviewedLabelLeakageSha256:
          input.reviewedLabelLeakage.fingerprintSha256,
        releasePolicySha256: await sha256Canonical(input.releasePolicy),
        milestonePlanSha256: await sha256Canonical(input.milestonePlan),
      }),
      release,
    })
  const snapshot = Object.freeze({
    ...payload,
    snapshotSha256: await sha256Canonical(payload),
  })
  const snapshotFailures = validateVerificationQualitySnapshot(snapshot)
  if (snapshotFailures.length > 0) {
    throw new Error(
      `Verification quality snapshot is invalid: ${snapshotFailures.join('; ')}`,
    )
  }
  return snapshot
}

export function validateVerificationQualitySnapshot(
  snapshot: VerificationQualitySnapshot,
): readonly string[] {
  const failures: string[] = []
  if (
    snapshot.schemaVersion !==
    VERIFICATION_QUALITY_SNAPSHOT_SCHEMA_VERSION
  ) {
    failures.push('quality snapshot schema version is unsupported')
  }
  if (!validIsoInstant(snapshot.capturedAt)) {
    failures.push('quality snapshot capture time must be canonical UTC')
  }
  if (
    Object.values(snapshot.fingerprints).some(
      (fingerprint) => !validSha256(fingerprint),
    ) ||
    !validSha256(snapshot.snapshotSha256)
  ) {
    failures.push('quality snapshot fingerprints must be SHA-256 digests')
  }
  if (
    !['ready', 'not_ready', 'unavailable'].includes(
      snapshot.referenceReadiness.status,
    ) ||
    !['passed', 'failed', 'unavailable'].includes(
      snapshot.reviewedLabelLeakage.status,
    )
  ) {
    failures.push('quality snapshot gate status is unsupported')
  }
  if (
    snapshot.referenceBank !== null &&
    validateReferenceBankQuality(snapshot.referenceBank).length > 0
  ) {
    failures.push('quality snapshot reference-bank state is invalid')
  }
  if (
    snapshot.reviewerControl !== null &&
    validateReviewerControlQuality(snapshot.reviewerControl).length > 0
  ) {
    failures.push('quality snapshot reviewer-control state is invalid')
  }
  const coverageFailures = validateVerificationCoverage(snapshot.coverage)
  if (coverageFailures.length > 0) {
    failures.push(...coverageFailures.map((failure) => `coverage ${failure}`))
  }
  if (
    snapshot.counts.eligibleItems !== snapshot.coverage.eligibleItems ||
    snapshot.counts.attemptedItems !== snapshot.coverage.attemptedItems ||
    snapshot.counts.decisivelyReviewedItems !==
      snapshot.coverage.decisivelyReviewedItems ||
    snapshot.counts.decisiveQualitySampleItems !==
      snapshot.precision.decisiveSampleCount ||
    snapshot.counts.unresolvedConflictItems !==
      snapshot.conflicts.unresolvedConflictItems ||
    snapshot.counts.adjudicatedItems !==
      snapshot.conflicts.adjudicatedItems ||
    snapshot.counts.anonymousReviewerCount !==
      snapshot.agreement.pairwise.anonymousReviewerCount
  ) {
    failures.push('quality snapshot counts do not match their evidence')
  }
  if (
    snapshot.conflicts.conflictedItems !==
      snapshot.conflicts.unresolvedConflictItems +
        snapshot.conflicts.adjudicatedItems ||
    snapshot.conflicts.denominatorAttemptedItems !==
      snapshot.coverage.attemptedItems ||
    !validRatioWithDenominator(
      snapshot.conflicts.conflictRate,
      snapshot.conflicts.denominatorAttemptedItems,
    )
  ) {
    failures.push('quality snapshot conflict state is inconsistent')
  }
  if (
    !sortedUnique(snapshot.precision.representedStrata) ||
    !sortedUnique(snapshot.release.missingRequiredStrata) ||
    !sortedUnique(snapshot.release.blockers)
  ) {
    failures.push('quality snapshot release fields must be sorted and unique')
  }
  if (
    snapshot.release.status === 'release_ready' &&
    (snapshot.release.blockers.length > 0 ||
      snapshot.release.evaluatedAtMilestone === null)
  ) {
    failures.push('release-ready snapshot cannot retain blockers')
  }
  if (
    snapshot.release.status === 'blocked' &&
    (snapshot.release.blockers.length === 0 ||
      snapshot.release.evaluatedAtMilestone === null)
  ) {
    failures.push('blocked release snapshot must identify evaluated blockers')
  }
  if (
    snapshot.release.status === 'not_evaluated' &&
    (snapshot.release.blockers.length !== 1 ||
      snapshot.release.evaluatedAtMilestone !== null)
  ) {
    failures.push('non-evaluated snapshot must identify its milestone state')
  }
  return Object.freeze(failures)
}

export async function verifyVerificationQualitySnapshotFingerprint(
  snapshot: VerificationQualitySnapshot,
): Promise<boolean> {
  const { snapshotSha256, ...payload } = snapshot
  return snapshotSha256 === (await sha256Canonical(payload))
}

function validateSnapshotInput(
  input: VerificationQualitySnapshotInput,
): readonly string[] {
  const failures: string[] = []
  if (
    input.campaign.schemaVersion !==
      VERIFICATION_CAMPAIGN_SCHEMA_VERSION ||
    input.campaign.campaignId.trim() === ''
  ) {
    failures.push('campaign identity is invalid')
  }
  if (
    !validSha256(input.campaign.manifestSha256) ||
    !validSha256(input.campaign.questionFingerprint)
  ) {
    failures.push('campaign fingerprints must be SHA-256 digests')
  }
  failures.push(...validateSamplingPlan(input.campaign.samplingPlan))
  failures.push(...validateVerificationCoverage(input.coverage))
  failures.push(...validateVerificationReleasePolicy(input.releasePolicy))
  failures.push(
    ...validateVerificationReviewMilestonePlan(input.milestonePlan),
  )
  if (!validIsoInstant(input.capturedAt)) {
    failures.push('capture time must be a canonical UTC instant')
  }
  if (
    !validSha256(input.decisionLedgerSha256) ||
    !validSha256(input.reviewedLabelsSha256) ||
    !validSha256(input.referenceReadiness.fingerprintSha256) ||
    !validSha256(input.reviewedLabelLeakage.fingerprintSha256)
  ) {
    failures.push('input evidence fingerprints must be SHA-256 digests')
  }
  if (
    !['ready', 'not_ready', 'unavailable'].includes(
      input.referenceReadiness.status,
    ) ||
    !['passed', 'failed', 'unavailable'].includes(
      input.reviewedLabelLeakage.status,
    )
  ) {
    failures.push('quality gate status is unsupported')
  }
  failures.push(...validateGateEvidence(input.referenceReadiness))
  failures.push(...validateGateEvidence(input.reviewedLabelLeakage))
  if (input.referenceBank !== undefined && input.referenceBank !== null) {
    failures.push(...validateReferenceBankQuality(input.referenceBank))
  }
  if (
    input.reviewerControlPerformance !== undefined &&
    input.reviewerControlPerformance !== null
  ) {
    failures.push(
      ...validateReviewerControlPerformance(
        input.reviewerControlPerformance,
      ),
    )
  }
  failures.push(...validatePrecisionInput(input))
  failures.push(...validateAgreementInput(input))
  if (
    !Number.isInteger(input.unresolvedConflictItems) ||
    input.unresolvedConflictItems < 0 ||
    !Number.isInteger(input.adjudicatedItems) ||
    input.adjudicatedItems < 0 ||
    input.unresolvedConflictItems + input.adjudicatedItems >
      input.coverage.attemptedItems
  ) {
    failures.push('conflict counts must fit within attempted items')
  }
  return Object.freeze([...new Set(failures)])
}

function validatePrecisionInput(
  input: VerificationQualitySnapshotInput,
): readonly string[] {
  const failures: string[] = []
  const estimate = input.precisionEstimate
  if (
    estimate.schemaVersion !==
      TARGET_PRECISION_ESTIMATE_SCHEMA_VERSION ||
    estimate.samplingPlanId !== input.campaign.samplingPlan.planId ||
    estimate.sampledItemCount !== input.coverage.eligibleItems
  ) {
    failures.push('precision estimate is not bound to the campaign')
  }
  if (
    !nonNegativeInteger(estimate.decisiveSampleCount) ||
    !nonNegativeInteger(estimate.correctCount) ||
    !nonNegativeInteger(estimate.errorCount) ||
    estimate.correctCount + estimate.errorCount !==
      estimate.decisiveSampleCount ||
    estimate.decisiveSampleCount >
      input.coverage.decisivelyReviewedItems
  ) {
    failures.push('precision estimate counts are inconsistent')
  }
  if (
    (estimate.availability === 'available') !==
    (estimate.estimate !== null) ||
    (estimate.estimate !== null && !isProportion(estimate.estimate))
  ) {
    failures.push('precision estimate availability is inconsistent')
  }
  if (
    input.campaign.samplingPlan.purpose !== 'quality_estimation' ||
    !input.campaign.samplingPlan.qualityEstimationAllowed ||
    !input.campaign.samplingPlan.representative ||
    !input.campaign.samplingPlan.blindReview ||
    input.campaign.disclosurePolicy.mode !== 'blind'
  ) {
    failures.push('campaign is not a blind representative quality audit')
  }
  if (
    estimate.method === 'simple_random_wilson' &&
    input.campaign.samplingPlan.design !== 'simple_random'
  ) {
    failures.push('simple-random estimate does not match sampling design')
  }
  if (
    estimate.method === 'stratified_hajek' &&
    input.campaign.samplingPlan.design !== 'stratified_random' &&
    input.campaign.samplingPlan.design !== 'clustered_random'
  ) {
    failures.push('weighted estimate does not match sampling design')
  }
  if (
    estimate.method === 'simple_random_wilson' &&
    input.precisionInterval !== null
  ) {
    failures.push('simple-random Wilson estimate cannot add a second interval')
  }
  if (
    estimate.method === 'simple_random_wilson' &&
    ((estimate.availability === 'available') !==
      (estimate.interval !== null) ||
      !validInterval(estimate.interval))
  ) {
    failures.push('simple-random interval is inconsistent')
  }
  if (input.precisionInterval !== null) {
    const interval = input.precisionInterval
    if (
      interval.schemaVersion !==
        TARGET_PRECISION_ESTIMATE_SCHEMA_VERSION ||
      interval.method !== 'grouped_percentile_bootstrap' ||
      interval.samplingPlanId !== input.campaign.samplingPlan.planId ||
      interval.decisiveSampleCount !== estimate.decisiveSampleCount ||
      (interval.availability === 'available') !==
        (interval.interval !== null) ||
      !validInterval(interval.interval)
    ) {
      failures.push('grouped precision interval is inconsistent')
    }
    if (
      interval.pointEstimate !== null &&
      estimate.estimate !== null &&
      Math.abs(interval.pointEstimate - estimate.estimate) > 1e-12
    ) {
      failures.push('precision point estimate and interval center disagree')
    }
  }
  if (
    input.strata.length === 0 ||
    !sortedUnique(input.strata.map(({ stratumId }) => stratumId)) ||
    input.strata.some(
      ({ stratumId, decisiveSampleCount, populationWeight, estimate }) =>
        stratumId.trim() === '' ||
        !nonNegativeInteger(decisiveSampleCount) ||
        (populationWeight !== null && !isProportion(populationWeight)) ||
        (estimate !== null && !isProportion(estimate)),
    ) ||
    input.strata.reduce(
      (total, { decisiveSampleCount }) =>
        total + decisiveSampleCount,
      0,
    ) !== estimate.decisiveSampleCount
  ) {
    failures.push('quality strata are invalid or do not partition the sample')
  }
  const declaredStrata = new Set(
    input.campaign.samplingPlan.strata.map(({ stratumId }) => stratumId),
  )
  if (
    input.strata.some(({ stratumId }) => !declaredStrata.has(stratumId))
  ) {
    failures.push('quality stratum is not declared by the sampling plan')
  }
  return Object.freeze(failures)
}

function validateAgreementInput(
  input: VerificationQualitySnapshotInput,
): readonly string[] {
  const failures: string[] = []
  const pairwise = input.reviewerAgreement
  const alpha = input.reviewerNominalAlpha
  if (
    pairwise.schemaVersion !== REVIEWER_RELIABILITY_SCHEMA_VERSION ||
    pairwise.method !== 'pairwise_percent_agreement' ||
    pairwise.itemCount !== input.coverage.eligibleItems ||
    (pairwise.availability === 'available') !==
      (pairwise.percentAgreement !== null) ||
    (pairwise.percentAgreement !== null &&
      !isProportion(pairwise.percentAgreement))
  ) {
    failures.push('pairwise reviewer agreement is inconsistent')
  }
  if (
    alpha.schemaVersion !== REVIEWER_RELIABILITY_SCHEMA_VERSION ||
    alpha.method !== 'krippendorff_alpha_nominal' ||
    alpha.itemCount !== input.coverage.eligibleItems ||
    (alpha.availability === 'available') !== (alpha.alpha !== null) ||
    (alpha.alpha !== null &&
      (!Number.isFinite(alpha.alpha) ||
        alpha.alpha < -1 ||
        alpha.alpha > 1))
  ) {
    failures.push('nominal reviewer agreement is inconsistent')
  }
  return Object.freeze(failures)
}

function validateGateEvidence(
  evidence: VerificationQualityGateEvidence<string>,
): readonly string[] {
  if (
    evidence.blockers.some((blocker) => blocker.trim() === '') ||
    !sortedUnique(evidence.blockers)
  ) {
    return Object.freeze([
      'quality gate blockers must be non-empty, sorted, and unique',
    ])
  }
  return Object.freeze([])
}

function validateReferenceBankQuality(
  quality: VerificationReferenceBankQuality,
): readonly string[] {
  const failures: string[] = []
  const role = quality.prototypeRoleAttestations
  const identity = quality.taxonomicIdentityReviews
  const counts = [
    role.providerSupportedRecordCount,
    role.attestedRecordCount,
    role.suitableRecordCount,
    identity.reviewedRecordCount,
    identity.independentlyVerifiedRecordCount,
    quality.prototypeSupportCount,
    quality.verifiedSupportCount,
    quality.excludedSupportCount,
  ]
  if (
    counts.some((count) => !nonNegativeInteger(count)) ||
    role.attestedRecordCount > role.providerSupportedRecordCount ||
    role.suitableRecordCount > role.attestedRecordCount ||
    identity.independentlyVerifiedRecordCount >
      identity.reviewedRecordCount ||
    quality.verifiedSupportCount > identity.independentlyVerifiedRecordCount
  ) {
    failures.push('reference-bank counts are inconsistent')
  }
  if (
    !['verified_complete', 'incomplete', 'unavailable'].includes(
      role.status,
    ) ||
    !['ready', 'not_ready', 'unavailable'].includes(
      quality.readiness.status,
    ) ||
    !validSha256(quality.sourceSnapshotSha256)
  ) {
    failures.push('reference-bank status or fingerprint is invalid')
  }
  if (
    !sortedUnique(quality.readiness.blockers) ||
    quality.readiness.blockers.some((blocker) => blocker.trim() === '')
  ) {
    failures.push('reference-bank readiness blockers are invalid')
  }
  failures.push(
    ...validateQualityDistribution(
      quality.providerDistribution,
      'provider',
    ),
    ...validateQualityDistribution(
      quality.routeDistribution,
      'route',
    ),
  )
  if (
    (quality.conflicts.availability === 'available') !==
      (quality.conflicts.conflictCount !== null) ||
    (quality.conflicts.conflictCount !== null &&
      !nonNegativeInteger(quality.conflicts.conflictCount)) ||
    (quality.conflicts.availability === 'unavailable') !==
      (quality.conflicts.unavailableReason !== null)
  ) {
    failures.push('reference-bank conflict evidence is inconsistent')
  }
  return Object.freeze(failures)
}

function validateQualityDistribution(
  distribution: VerificationQualityDistribution,
  label: string,
): readonly string[] {
  if (
    (distribution.availability === 'available') !==
      (distribution.unavailableReason === null) ||
    (distribution.availability === 'unavailable' &&
      distribution.entries.length > 0) ||
    !sortedUnique(distribution.entries.map(({ key }) => key)) ||
    distribution.entries.some(
      ({ key, label: entryLabel, count }) =>
        key.trim() === '' ||
        entryLabel.trim() === '' ||
        !nonNegativeInteger(count),
    )
  ) {
    return Object.freeze([
      `reference-bank ${label} distribution is inconsistent`,
    ])
  }
  return Object.freeze([])
}

function validateReviewerControlPerformance(
  control: ReviewerControlPerformance,
): readonly string[] {
  if (
    control.schemaVersion !== REVIEWER_RELIABILITY_SCHEMA_VERSION ||
    control.method !== 'pre_reviewed_control_performance' ||
    (control.availability === 'available') !==
      (control.controlAccuracy !== null)
  ) {
    return Object.freeze(['reviewer control performance is inconsistent'])
  }
  return Object.freeze([])
}

function validateReviewerControlQuality(
  control: VerificationReviewerControlQuality,
): readonly string[] {
  if (
    (control.availability === 'available') !==
      (control.controlAccuracy !== null) ||
    control.controlItemCount < control.attemptedControlItemCount ||
    ![
      control.controlItemCount,
      control.attemptedControlItemCount,
      control.controlAttemptCount,
    ].every(nonNegativeInteger) ||
    !sortedUnique(control.blockers) ||
    [
      control.controlAccuracy,
      control.falsePositiveRate,
      control.falseNegativeRate,
      control.mediaFailureHandlingRate,
      control.unexpectedMediaFailureRate,
    ].some((rate) => rate !== null && !isProportion(rate))
  ) {
    return Object.freeze(['reviewer control snapshot is inconsistent'])
  }
  return Object.freeze([])
}

function precisionSnapshot(
  estimate:
    | SimpleRandomTargetPrecisionEstimate
    | WeightedTargetPrecisionEstimate,
  groupedInterval: GroupedBootstrapTargetPrecisionInterval | null,
  strata: readonly VerificationQualityStratum[],
  representedStrata: readonly string[],
): VerificationQualityPrecision {
  if (estimate.method === 'simple_random_wilson') {
    return Object.freeze({
      method: estimate.method,
      availability: estimate.availability,
      estimateBlockers: canonicalStrings(estimate.blockers),
      pointEstimate: estimate.estimate,
      intervalMethod: estimate.method,
      intervalAvailability:
        estimate.interval === null ? 'unavailable' : 'available',
      intervalBlockers:
        estimate.interval === null
          ? canonicalStrings(estimate.blockers)
          : Object.freeze([]),
      confidenceLevel: estimate.confidenceLevel,
      interval:
        estimate.interval === null
          ? null
          : Object.freeze({ ...estimate.interval }),
      effectiveSampleSize:
        estimate.availability === 'available'
          ? estimate.decisiveSampleCount
          : null,
      decisiveSampleCount: estimate.decisiveSampleCount,
      representedStrata,
      strata,
    })
  }
  return Object.freeze({
    method: estimate.method,
    availability: estimate.availability,
    estimateBlockers: canonicalStrings(estimate.blockers),
    pointEstimate: estimate.estimate,
    intervalMethod: 'grouped_percentile_bootstrap',
    intervalAvailability:
      groupedInterval?.interval === null ||
      groupedInterval === null
        ? 'unavailable'
        : 'available',
    intervalBlockers:
      groupedInterval === null
        ? Object.freeze(['grouped_interval_not_supplied'])
        : canonicalStrings(groupedInterval.blockers),
    confidenceLevel: groupedInterval?.confidenceLevel ?? null,
    interval:
      groupedInterval?.interval === null ||
      groupedInterval === null
        ? null
        : Object.freeze({ ...groupedInterval.interval }),
    effectiveSampleSize: estimate.effectiveSampleSize,
    decisiveSampleCount: estimate.decisiveSampleCount,
    representedStrata,
    strata,
  })
}

function referenceBankSnapshot(
  referenceBank: VerificationReferenceBankQuality | null,
): VerificationReferenceBankQuality | null {
  if (referenceBank === null) {
    return null
  }
  return Object.freeze({
    prototypeRoleAttestations: Object.freeze({
      ...referenceBank.prototypeRoleAttestations,
    }),
    taxonomicIdentityReviews: Object.freeze({
      ...referenceBank.taxonomicIdentityReviews,
    }),
    prototypeSupportCount: referenceBank.prototypeSupportCount,
    verifiedSupportCount: referenceBank.verifiedSupportCount,
    excludedSupportCount: referenceBank.excludedSupportCount,
    conflicts: Object.freeze({ ...referenceBank.conflicts }),
    providerDistribution: freezeDistribution(
      referenceBank.providerDistribution,
    ),
    routeDistribution: freezeDistribution(
      referenceBank.routeDistribution,
    ),
    readiness: Object.freeze({
      status: referenceBank.readiness.status,
      blockers: canonicalStrings(referenceBank.readiness.blockers),
    }),
    sourceSnapshotSha256: referenceBank.sourceSnapshotSha256,
  })
}

function reviewerControlSnapshot(
  control: ReviewerControlPerformance | null,
): VerificationReviewerControlQuality | null {
  if (control === null) {
    return null
  }
  return Object.freeze({
    availability: control.availability,
    blockers: canonicalStrings(control.blockers),
    controlSetId:
      control.controlSetId.trim() === '' ? null : control.controlSetId,
    groundTruthSha256:
      validSha256(control.groundTruthSha256)
        ? control.groundTruthSha256
        : null,
    controlItemCount: control.controlItemCount,
    attemptedControlItemCount: control.attemptedControlItemCount,
    controlAttemptCount: control.controlAttemptCount,
    controlAccuracy: control.controlAccuracy,
    falsePositiveRate: control.falsePositiveRate,
    falseNegativeRate: control.falseNegativeRate,
    mediaFailureHandlingRate: control.mediaFailureHandlingRate,
    unexpectedMediaFailureRate: control.unexpectedMediaFailureRate,
  })
}

function freezeDistribution(
  distribution: VerificationQualityDistribution,
): VerificationQualityDistribution {
  return Object.freeze({
    availability: distribution.availability,
    entries: Object.freeze(
      distribution.entries.map((entry) => Object.freeze({ ...entry })),
    ),
    unavailableReason: distribution.unavailableReason,
  })
}

function agreementSnapshot(
  pairwise: ReviewerPercentAgreement,
  alpha: ReviewerNominalKrippendorffAlpha,
): VerificationQualityAgreement {
  return Object.freeze({
    pairwise: Object.freeze({
      availability: pairwise.availability,
      blockers: canonicalStrings(pairwise.blockers),
      overlappingItemCount: pairwise.overlappingItemCount,
      anonymousReviewerCount: pairwise.anonymousReviewerCount,
      pairCount: pairwise.pairCount,
      percentAgreement: pairwise.percentAgreement,
    }),
    nominalAlpha: Object.freeze({
      availability: alpha.availability,
      blockers: canonicalStrings(alpha.blockers),
      overlappingItemCount: alpha.overlappingItemCount,
      alpha: alpha.alpha,
    }),
  })
}

function campaignSnapshot(
  campaign: VerificationCampaign,
): VerificationQualityCampaignSnapshot {
  return Object.freeze({
    campaignId: campaign.campaignId,
    title: campaign.title,
    kind: campaign.kind,
    status: campaign.status,
    targetTaxon:
      campaign.targetTaxon === null
        ? null
        : Object.freeze({ ...campaign.targetTaxon }),
    sourceProviders: Object.freeze([...campaign.sourceProviders].sort()),
    samplingPlanId: campaign.samplingPlan.planId,
    samplingPurpose: campaign.samplingPlan.purpose,
    samplingDesign: campaign.samplingPlan.design,
  })
}

function releaseSnapshot(
  policy: VerificationReleasePolicy,
  milestone: VerificationMilestoneEvaluation,
  precision: VerificationQualityPrecision,
  agreement: ReviewerPercentAgreement,
  conflicts: VerificationQualityConflicts,
  referenceReadiness: VerificationQualityGateEvidence<VerificationQualityGateStatus>,
  reviewedLabelLeakage: VerificationQualityGateEvidence<ReviewedLabelLeakageGateStatus>,
): VerificationQualityRelease {
  if (!milestone.releaseEvaluationAllowed) {
    const blocker: VerificationReleaseBlocker =
      milestone.status === 'already_evaluated'
        ? 'review_milestone_already_evaluated'
        : milestone.status === 'schedule_complete'
          ? 'review_milestone_schedule_complete'
          : 'review_milestone_not_due'
    return Object.freeze({
      status: 'not_evaluated',
      evaluatedAtMilestone: null,
      blockers: Object.freeze([blocker]),
      missingRequiredStrata: Object.freeze([]),
    })
  }
  const blockers: VerificationReleaseBlocker[] = []
  const missingRequiredStrata = policy.requiredStrata.filter(
    (stratumId) => !precision.representedStrata.includes(stratumId),
  )
  if (precision.decisiveSampleCount < policy.minimumDecisiveSample) {
    blockers.push('minimum_decisive_sample_not_met')
  }
  if (missingRequiredStrata.length > 0) {
    blockers.push('required_strata_missing')
  }
  if (
    precision.availability !== 'available' ||
    precision.pointEstimate === null
  ) {
    blockers.push('precision_estimate_unavailable')
  }
  if (
    precision.intervalAvailability !== 'available' ||
    precision.interval === null
  ) {
    blockers.push('precision_interval_unavailable')
  } else if (
    precision.interval.lower < policy.minimumPrecisionLowerBound
  ) {
    blockers.push('precision_lower_bound_below_policy')
  }
  if (
    agreement.availability !== 'available' ||
    agreement.percentAgreement === null
  ) {
    blockers.push('reviewer_agreement_unavailable')
  } else if (
    agreement.percentAgreement < policy.minimumReviewerAgreement
  ) {
    blockers.push('reviewer_agreement_below_policy')
  }
  if (conflicts.conflictRate === null) {
    blockers.push('conflict_rate_unavailable')
  } else if (conflicts.conflictRate > policy.maximumConflictRate) {
    blockers.push('conflict_rate_above_policy')
  }
  if (
    policy.requireReferenceReadiness &&
    referenceReadiness.status !== 'ready'
  ) {
    blockers.push('reference_readiness_not_met')
  }
  if (
    policy.requireReviewedLabelLeakageGate &&
    reviewedLabelLeakage.status !== 'passed'
  ) {
    blockers.push('reviewed_label_leakage_gate_not_met')
  }
  const canonicalBlockers = canonicalStrings(blockers)
  return Object.freeze({
    status:
      canonicalBlockers.length === 0 ? 'release_ready' : 'blocked',
    evaluatedAtMilestone: milestone.currentMilestone,
    blockers: canonicalBlockers,
    missingRequiredStrata: Object.freeze(missingRequiredStrata),
  })
}

function canonicalSamplingPlan(
  campaign: VerificationCampaign,
): VerificationCampaign['samplingPlan'] {
  return Object.freeze({
    ...campaign.samplingPlan,
    groupingKeys: Object.freeze(
      [...campaign.samplingPlan.groupingKeys].sort(),
    ),
    strata: Object.freeze(
      [...campaign.samplingPlan.strata]
        .sort((left, right) =>
          left.stratumId.localeCompare(right.stratumId),
        )
        .map((stratum) => Object.freeze({ ...stratum })),
    ),
  })
}

async function sha256Canonical(value: unknown): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonicalJson(value)),
  )
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

function canonicalJson(value: unknown): string {
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'string'
  ) {
    return JSON.stringify(value)
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Quality snapshot contains a non-finite number.')
    }
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(',')}}`
  }
  throw new Error('Quality snapshot contains an unsupported value.')
}

function canonicalStrings<T extends string>(
  values: readonly T[],
): readonly T[] {
  return Object.freeze([...new Set(values)].sort())
}

function sortedUnique(values: readonly (number | string)[]): boolean {
  return values.every(
    (value, index) => index === 0 || values[index - 1]! < value,
  )
}

function validSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/u.test(value)
}

function validIsoInstant(value: string): boolean {
  const parsed = new Date(value)
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString() === value
  )
}

function nonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0
}

function isProportion(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1
}

function validInterval(
  interval: { readonly lower: number; readonly upper: number } | null,
): boolean {
  return (
    interval === null ||
    (isProportion(interval.lower) &&
      isProportion(interval.upper) &&
      interval.lower <= interval.upper)
  )
}

function validRatioWithDenominator(
  value: number | null,
  denominator: number,
): boolean {
  return denominator === 0
    ? value === null
    : value !== null && isProportion(value)
}
