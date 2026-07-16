import { isVerificationAdjudicationEvent } from './verificationAdjudication'
import type { VerificationConsensus } from './verificationConsensus'
import type { VerificationCampaign } from './verificationContracts'
import type { VerificationEvent } from './verificationEvents'

export const REVIEWER_RELIABILITY_SCHEMA_VERSION =
  'taxalens-reviewer-reliability:v1.0.0' as const

export type ReliabilityAvailability = 'available' | 'unavailable'
export type ReliabilityLabel = 'yes' | 'no' | 'cant_tell'

export const REVIEWER_CONTROL_SET_SCHEMA_VERSION =
  'taxalens-reviewer-control-set:v1.0.0' as const

export type ReviewerControlTruth =
  | {
      readonly itemId: string
      readonly expectedMediaState: 'viewable'
      readonly expectedOutcome: 'yes' | 'no'
    }
  | {
      readonly itemId: string
      readonly expectedMediaState: 'unviewable'
      readonly expectedOutcome: null
    }

export interface ReviewerControlSet {
  readonly schemaVersion: typeof REVIEWER_CONTROL_SET_SCHEMA_VERSION
  readonly controlSetId: string
  readonly groundTruthSha256: string
  readonly controls: readonly ReviewerControlTruth[]
}

export interface ReviewerPercentAgreement {
  readonly schemaVersion: typeof REVIEWER_RELIABILITY_SCHEMA_VERSION
  readonly method: 'pairwise_percent_agreement'
  readonly availability: ReliabilityAvailability
  readonly blockers: readonly string[]
  readonly itemCount: number
  readonly overlappingItemCount: number
  readonly anonymousReviewerCount: number
  readonly scientificRatingCount: number
  readonly pairCount: number
  readonly agreementPairCount: number
  readonly disagreementPairCount: number
  readonly excludedNonScientificEventCount: number
  readonly labelCounts: Readonly<Record<ReliabilityLabel, number>>
  readonly percentAgreement: number | null
}

export interface ReviewerNominalKrippendorffAlpha {
  readonly schemaVersion: typeof REVIEWER_RELIABILITY_SCHEMA_VERSION
  readonly method: 'krippendorff_alpha_nominal'
  readonly availability: ReliabilityAvailability
  readonly blockers: readonly string[]
  readonly itemCount: number
  readonly overlappingItemCount: number
  readonly anonymousReviewerCount: number
  readonly scientificRatingCount: number
  readonly coincidenceRatingCount: number
  readonly excludedNonScientificEventCount: number
  readonly labelCounts: Readonly<Record<ReliabilityLabel, number>>
  readonly observedDisagreement: number | null
  readonly expectedDisagreement: number | null
  readonly alpha: number | null
}

export interface ReviewerControlPerformance {
  readonly schemaVersion: typeof REVIEWER_RELIABILITY_SCHEMA_VERSION
  readonly method: 'pre_reviewed_control_performance'
  readonly availability: ReliabilityAvailability
  readonly blockers: readonly string[]
  readonly controlSetId: string
  readonly groundTruthSha256: string
  readonly controlItemCount: number
  readonly attemptedControlItemCount: number
  readonly controlAttemptCount: number
  readonly anonymousReviewerCount: number
  readonly correctControlAttemptCount: number
  readonly incorrectControlAttemptCount: number
  readonly positiveControlAttemptCount: number
  readonly negativeControlAttemptCount: number
  readonly falsePositiveCount: number
  readonly falseNegativeCount: number
  readonly mediaFailureControlAttemptCount: number
  readonly correctlyHandledMediaFailureCount: number
  readonly unexpectedMediaFailureCount: number
  readonly uncertainControlAttemptCount: number
  readonly deferredControlAttemptCount: number
  readonly controlAccuracy: number | null
  readonly falsePositiveRate: number | null
  readonly falseNegativeRate: number | null
  readonly mediaFailureHandlingRate: number | null
  readonly unexpectedMediaFailureRate: number | null
}

export function calculateReviewerPercentAgreement(
  consensus: readonly VerificationConsensus[],
): ReviewerPercentAgreement {
  const prepared = prepareReliabilityRatings(consensus)
  const blockers = [...prepared.blockers]
  let pairCount = 0
  let agreementPairCount = 0
  let overlappingItemCount = 0
  for (const ratings of prepared.ratingsByItem.values()) {
    if (ratings.length < 2) {
      continue
    }
    overlappingItemCount += 1
    for (let left = 0; left < ratings.length - 1; left += 1) {
      for (let right = left + 1; right < ratings.length; right += 1) {
        pairCount += 1
        if (ratings[left] === ratings[right]) {
          agreementPairCount += 1
        }
      }
    }
  }
  if (pairCount === 0) {
    blockers.push('reviewer_overlap_insufficient')
  }
  const canonicalBlockers = [...new Set(blockers)].sort()
  return Object.freeze({
    schemaVersion: REVIEWER_RELIABILITY_SCHEMA_VERSION,
    method: 'pairwise_percent_agreement',
    availability:
      canonicalBlockers.length === 0 ? 'available' : 'unavailable',
    blockers: Object.freeze(canonicalBlockers),
    itemCount: consensus.length,
    overlappingItemCount,
    anonymousReviewerCount: prepared.reviewerKeys.size,
    scientificRatingCount: prepared.scientificRatingCount,
    pairCount,
    agreementPairCount,
    disagreementPairCount: pairCount - agreementPairCount,
    excludedNonScientificEventCount:
      prepared.excludedNonScientificEventCount,
    labelCounts: Object.freeze({ ...prepared.labelCounts }),
    percentAgreement:
      canonicalBlockers.length === 0
        ? agreementPairCount / pairCount
        : null,
  })
}

export function calculateReviewerNominalAlpha(
  consensus: readonly VerificationConsensus[],
): ReviewerNominalKrippendorffAlpha {
  const prepared = prepareReliabilityRatings(consensus)
  const blockers = [...prepared.blockers]
  const overlapRatings = [...prepared.ratingsByItem.values()].filter(
    (ratings) => ratings.length >= 2,
  )
  if (overlapRatings.length < 2) {
    blockers.push('reviewer_overlap_insufficient')
  }
  const marginals: Record<ReliabilityLabel, number> = {
    yes: 0,
    no: 0,
    cant_tell: 0,
  }
  let observedDisagreementNumerator = 0
  let coincidenceRatingCount = 0
  for (const ratings of overlapRatings) {
    const counts = countLabels(ratings)
    const ratingCount = ratings.length
    coincidenceRatingCount += ratingCount
    for (const label of reliabilityLabels()) {
      marginals[label] += counts[label]
    }
    const orderedDisagreements =
      ratingCount * ratingCount -
      reliabilityLabels().reduce(
        (total, label) => total + counts[label] * counts[label],
        0,
      )
    observedDisagreementNumerator +=
      orderedDisagreements / (ratingCount - 1)
  }
  const observedDisagreement =
    coincidenceRatingCount === 0
      ? null
      : observedDisagreementNumerator / coincidenceRatingCount
  const expectedDisagreement =
    coincidenceRatingCount < 2
      ? null
      : (coincidenceRatingCount * coincidenceRatingCount -
          reliabilityLabels().reduce(
            (total, label) =>
              total + marginals[label] * marginals[label],
            0,
          )) /
        (coincidenceRatingCount * (coincidenceRatingCount - 1))
  if (
    expectedDisagreement === null ||
    expectedDisagreement <= Number.EPSILON
  ) {
    blockers.push('label_variation_absent')
  }
  const canonicalBlockers = [...new Set(blockers)].sort()
  return Object.freeze({
    schemaVersion: REVIEWER_RELIABILITY_SCHEMA_VERSION,
    method: 'krippendorff_alpha_nominal',
    availability:
      canonicalBlockers.length === 0 ? 'available' : 'unavailable',
    blockers: Object.freeze(canonicalBlockers),
    itemCount: consensus.length,
    overlappingItemCount: overlapRatings.length,
    anonymousReviewerCount: prepared.reviewerKeys.size,
    scientificRatingCount: prepared.scientificRatingCount,
    coincidenceRatingCount,
    excludedNonScientificEventCount:
      prepared.excludedNonScientificEventCount,
    labelCounts: Object.freeze({ ...prepared.labelCounts }),
    observedDisagreement:
      canonicalBlockers.length === 0 ? observedDisagreement : null,
    expectedDisagreement:
      canonicalBlockers.length === 0 ? expectedDisagreement : null,
    alpha:
      canonicalBlockers.length === 0 &&
      observedDisagreement !== null &&
      expectedDisagreement !== null
        ? 1 - observedDisagreement / expectedDisagreement
        : null,
  })
}

export function evaluateReviewerControlPerformance(
  campaign: VerificationCampaign,
  consensus: readonly VerificationConsensus[],
  controlSet: ReviewerControlSet,
): ReviewerControlPerformance {
  const blockers: string[] = []
  if (
    campaign.samplingPlan.purpose !== 'reviewer_quality_control' ||
    campaign.samplingPlan.design !== 'control_items'
  ) {
    blockers.push('campaign_not_reviewer_quality_control')
  }
  if (
    controlSet.schemaVersion !== REVIEWER_CONTROL_SET_SCHEMA_VERSION ||
    controlSet.controlSetId.trim() === '' ||
    !/^[a-f0-9]{64}$/.test(controlSet.groundTruthSha256)
  ) {
    blockers.push('control_set_invalid')
  }
  const controlsById = new Map<string, ReviewerControlTruth>()
  for (const control of controlSet.controls) {
    if (
      control.itemId.trim() === '' ||
      controlsById.has(control.itemId) ||
      (control.expectedMediaState === 'viewable' &&
        control.expectedOutcome !== 'yes' &&
        control.expectedOutcome !== 'no') ||
      (control.expectedMediaState === 'unviewable' &&
        control.expectedOutcome !== null)
    ) {
      blockers.push('control_set_invalid')
    }
    controlsById.set(control.itemId, control)
  }
  if (controlsById.size === 0) {
    blockers.push('control_set_empty')
  }
  const consensusById = new Map<string, VerificationConsensus>()
  for (const projection of consensus) {
    if (
      projection.campaignId !== campaign.campaignId ||
      consensusById.has(projection.itemId)
    ) {
      blockers.push('control_consensus_invalid')
    }
    consensusById.set(projection.itemId, projection)
  }
  if (
    [...controlsById.keys()].some(
      (itemId) => !consensusById.has(itemId),
    )
  ) {
    blockers.push('control_consensus_missing')
  }
  const attemptedItems = new Set<string>()
  const reviewers = new Set<string>()
  let controlAttemptCount = 0
  let correctControlAttemptCount = 0
  let positiveControlAttemptCount = 0
  let negativeControlAttemptCount = 0
  let falsePositiveCount = 0
  let falseNegativeCount = 0
  let mediaFailureControlAttemptCount = 0
  let correctlyHandledMediaFailureCount = 0
  let unexpectedMediaFailureCount = 0
  let uncertainControlAttemptCount = 0
  let deferredControlAttemptCount = 0
  for (const [itemId, control] of controlsById) {
    const projection = consensusById.get(itemId)
    if (projection === undefined) {
      continue
    }
    const events = projection.latestEvents.filter(
      (event) => !isVerificationAdjudicationEvent(event),
    )
    if (events.length > 0) {
      attemptedItems.add(itemId)
    }
    for (const event of events) {
      controlAttemptCount += 1
      reviewers.add(reviewerKey(event))
      if (event.outcome === 'cant_tell') {
        uncertainControlAttemptCount += 1
      }
      if (event.outcome === 'skipped') {
        deferredControlAttemptCount += 1
      }
      if (control.expectedMediaState === 'unviewable') {
        mediaFailureControlAttemptCount += 1
        if (event.outcome === 'cant_view') {
          correctlyHandledMediaFailureCount += 1
          correctControlAttemptCount += 1
        }
        continue
      }
      if (event.outcome === 'cant_view') {
        unexpectedMediaFailureCount += 1
      }
      if (control.expectedOutcome === 'yes') {
        positiveControlAttemptCount += 1
        if (event.outcome === 'no') {
          falseNegativeCount += 1
        }
      } else {
        negativeControlAttemptCount += 1
        if (event.outcome === 'yes') {
          falsePositiveCount += 1
        }
      }
      if (event.outcome === control.expectedOutcome) {
        correctControlAttemptCount += 1
      }
    }
  }
  if (controlAttemptCount === 0) {
    blockers.push('control_attempts_empty')
  }
  const canonicalBlockers = [...new Set(blockers)].sort()
  const available = canonicalBlockers.length === 0
  const viewableControlAttemptCount =
    positiveControlAttemptCount + negativeControlAttemptCount
  return Object.freeze({
    schemaVersion: REVIEWER_RELIABILITY_SCHEMA_VERSION,
    method: 'pre_reviewed_control_performance',
    availability: available ? 'available' : 'unavailable',
    blockers: Object.freeze(canonicalBlockers),
    controlSetId: controlSet.controlSetId,
    groundTruthSha256: controlSet.groundTruthSha256,
    controlItemCount: controlsById.size,
    attemptedControlItemCount: attemptedItems.size,
    controlAttemptCount,
    anonymousReviewerCount: reviewers.size,
    correctControlAttemptCount,
    incorrectControlAttemptCount:
      controlAttemptCount - correctControlAttemptCount,
    positiveControlAttemptCount,
    negativeControlAttemptCount,
    falsePositiveCount,
    falseNegativeCount,
    mediaFailureControlAttemptCount,
    correctlyHandledMediaFailureCount,
    unexpectedMediaFailureCount,
    uncertainControlAttemptCount,
    deferredControlAttemptCount,
    controlAccuracy: available
      ? correctControlAttemptCount / controlAttemptCount
      : null,
    falsePositiveRate: available
      ? ratio(falsePositiveCount, negativeControlAttemptCount)
      : null,
    falseNegativeRate: available
      ? ratio(falseNegativeCount, positiveControlAttemptCount)
      : null,
    mediaFailureHandlingRate: available
      ? ratio(
          correctlyHandledMediaFailureCount,
          mediaFailureControlAttemptCount,
        )
      : null,
    unexpectedMediaFailureRate: available
      ? ratio(unexpectedMediaFailureCount, viewableControlAttemptCount)
      : null,
  })
}

interface PreparedReliabilityRatings {
  readonly ratingsByItem: ReadonlyMap<string, readonly ReliabilityLabel[]>
  readonly reviewerKeys: ReadonlySet<string>
  readonly scientificRatingCount: number
  readonly excludedNonScientificEventCount: number
  readonly labelCounts: Readonly<Record<ReliabilityLabel, number>>
  readonly blockers: readonly string[]
}

function prepareReliabilityRatings(
  consensus: readonly VerificationConsensus[],
): PreparedReliabilityRatings {
  const blockers: string[] = []
  const seenItems = new Set<string>()
  const reviewerKeys = new Set<string>()
  const ratingsByItem = new Map<string, readonly ReliabilityLabel[]>()
  const labelCounts: Record<ReliabilityLabel, number> = {
    yes: 0,
    no: 0,
    cant_tell: 0,
  }
  let scientificRatingCount = 0
  let excludedNonScientificEventCount = 0
  for (const projection of consensus) {
    if (
      projection.itemId.trim() === '' ||
      seenItems.has(projection.itemId)
    ) {
      blockers.push('consensus_items_invalid')
    }
    seenItems.add(projection.itemId)
    const ratings: ReliabilityLabel[] = []
    for (const event of projection.latestEvents) {
      if (isVerificationAdjudicationEvent(event)) {
        continue
      }
      if (!isReliabilityLabel(event.outcome)) {
        excludedNonScientificEventCount += 1
        continue
      }
      ratings.push(event.outcome)
      labelCounts[event.outcome] += 1
      scientificRatingCount += 1
      reviewerKeys.add(reviewerKey(event))
    }
    ratingsByItem.set(projection.itemId, Object.freeze(ratings))
  }
  return Object.freeze({
    ratingsByItem,
    reviewerKeys,
    scientificRatingCount,
    excludedNonScientificEventCount,
    labelCounts: Object.freeze(labelCounts),
    blockers: Object.freeze([...new Set(blockers)].sort()),
  })
}

function isReliabilityLabel(
  outcome: VerificationEvent['outcome'],
): outcome is ReliabilityLabel {
  return outcome === 'yes' || outcome === 'no' || outcome === 'cant_tell'
}

function countLabels(
  ratings: readonly ReliabilityLabel[],
): Record<ReliabilityLabel, number> {
  const counts: Record<ReliabilityLabel, number> = {
    yes: 0,
    no: 0,
    cant_tell: 0,
  }
  for (const rating of ratings) {
    counts[rating] += 1
  }
  return counts
}

function reliabilityLabels(): readonly ReliabilityLabel[] {
  return ['yes', 'no', 'cant_tell']
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator
}

function reviewerKey(event: VerificationEvent): string {
  return event.reviewerId.trim() || 'anonymous'
}
