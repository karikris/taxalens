import { isVerificationAdjudicationEvent } from './verificationAdjudication'
import type { VerificationConsensus } from './verificationConsensus'
import type { VerificationEvent } from './verificationEvents'

export const REVIEWER_RELIABILITY_SCHEMA_VERSION =
  'taxalens-reviewer-reliability:v1.0.0' as const

export type ReliabilityAvailability = 'available' | 'unavailable'
export type ReliabilityLabel = 'yes' | 'no' | 'cant_tell'

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

function reviewerKey(event: VerificationEvent): string {
  return event.reviewerId.trim() || 'anonymous'
}
