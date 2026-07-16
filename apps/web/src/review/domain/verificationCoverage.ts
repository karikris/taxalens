import type { HumanReviewInspection } from './reviewSession'
import type {
  VerificationConsensus,
  VerificationConsensusStatus,
} from './verificationConsensus'
import type { VerificationItem } from './verificationContracts'

export const VERIFICATION_COVERAGE_SCHEMA_VERSION =
  'taxalens-verification-coverage:v1.0.0' as const

export interface VerificationCoverage {
  readonly schemaVersion: typeof VERIFICATION_COVERAGE_SCHEMA_VERSION
  readonly eligibleItems: number
  readonly attemptedItems: number
  readonly unattemptedItems: number
  readonly decisivelyReviewedItems: number
  readonly resolvedYesItems: number
  readonly resolvedNoItems: number
  readonly uncertainItems: number
  readonly mediaFailureItems: number
  readonly deferredItems: number
  readonly pendingItems: number
  readonly effectiveReviewCount: number
  readonly decisiveReviewCount: number
  readonly yesReviewCount: number
  readonly noReviewCount: number
  readonly cantTellReviewCount: number
  readonly cantViewReviewCount: number
  readonly skippedReviewCount: number
  readonly inspectedItems: number
  readonly viewableItems: number
  readonly reviewCoverage: number | null
  readonly inspectionCoverage: number | null
  readonly viewabilityRate: number | null
}

export function calculateVerificationCoverage(
  items: readonly VerificationItem[],
  consensus: readonly VerificationConsensus[],
  inspections: Readonly<Record<string, HumanReviewInspection>>,
): VerificationCoverage {
  const itemIds = items.map(({ itemId }) => itemId)
  const failures = validateCoverageInputs(itemIds, consensus, inspections)
  if (failures.length > 0) {
    throw new Error(
      `Verification coverage inputs are invalid: ${failures.join('; ')}`,
    )
  }
  const eligibleItems = itemIds.length
  const attemptedItems = consensus.filter(
    ({ effectiveReviewCount }) => effectiveReviewCount > 0,
  ).length
  const decisivelyReviewedItems = consensus.filter(({ status }) =>
    isResolvedStatus(status),
  ).length
  const resolvedYesItems = consensus.filter(
    ({ status, consensusOutcome }) =>
      isResolvedStatus(status) && consensusOutcome === 'yes',
  ).length
  const resolvedNoItems = consensus.filter(
    ({ status, consensusOutcome }) =>
      isResolvedStatus(status) && consensusOutcome === 'no',
  ).length
  const uncertainItems = consensus.filter(
    ({ status }) =>
      status === 'uncertain_only' ||
      status === 'unresolved_disagreement',
  ).length
  const mediaFailureItems = countStatus(consensus, 'media_failure')
  const deferredItems = countStatus(consensus, 'deferred')
  const pendingItems = countStatus(consensus, 'pending')
  const effectiveEvents = consensus.flatMap(({ latestEvents }) => latestEvents)
  const yesReviewCount = countOutcome(effectiveEvents, 'yes')
  const noReviewCount = countOutcome(effectiveEvents, 'no')
  const cantTellReviewCount = countOutcome(effectiveEvents, 'cant_tell')
  const cantViewReviewCount = countOutcome(effectiveEvents, 'cant_view')
  const skippedReviewCount = countOutcome(effectiveEvents, 'skipped')
  const inspected = itemIds
    .map((itemId) => inspections[itemId])
    .filter(
      (inspection): inspection is HumanReviewInspection =>
        inspection !== undefined &&
        (inspection.imageOpened ||
          inspection.imageVerified ||
          inspection.imageFailureReason !== null),
    )
  const inspectedItems = inspected.length
  const viewableItems = inspected.filter(
    ({ imageOpened, imageVerified }) => imageOpened && imageVerified,
  ).length
  const coverage: VerificationCoverage = Object.freeze({
    schemaVersion: VERIFICATION_COVERAGE_SCHEMA_VERSION,
    eligibleItems,
    attemptedItems,
    unattemptedItems: eligibleItems - attemptedItems,
    decisivelyReviewedItems,
    resolvedYesItems,
    resolvedNoItems,
    uncertainItems,
    mediaFailureItems,
    deferredItems,
    pendingItems,
    effectiveReviewCount: effectiveEvents.length,
    decisiveReviewCount: yesReviewCount + noReviewCount,
    yesReviewCount,
    noReviewCount,
    cantTellReviewCount,
    cantViewReviewCount,
    skippedReviewCount,
    inspectedItems,
    viewableItems,
    reviewCoverage: ratio(attemptedItems, eligibleItems),
    inspectionCoverage: ratio(inspectedItems, eligibleItems),
    viewabilityRate: ratio(viewableItems, inspectedItems),
  })
  const coverageFailures = validateVerificationCoverage(coverage)
  if (coverageFailures.length > 0) {
    throw new Error(
      `Verification coverage is invalid: ${coverageFailures.join('; ')}`,
    )
  }
  return coverage
}

export function validateVerificationCoverage(
  coverage: VerificationCoverage,
): readonly string[] {
  const failures: string[] = []
  if (coverage.schemaVersion !== VERIFICATION_COVERAGE_SCHEMA_VERSION) {
    failures.push('coverage schema version is unsupported')
  }
  const counts = [
    coverage.eligibleItems,
    coverage.attemptedItems,
    coverage.unattemptedItems,
    coverage.decisivelyReviewedItems,
    coverage.resolvedYesItems,
    coverage.resolvedNoItems,
    coverage.uncertainItems,
    coverage.mediaFailureItems,
    coverage.deferredItems,
    coverage.pendingItems,
    coverage.effectiveReviewCount,
    coverage.decisiveReviewCount,
    coverage.yesReviewCount,
    coverage.noReviewCount,
    coverage.cantTellReviewCount,
    coverage.cantViewReviewCount,
    coverage.skippedReviewCount,
    coverage.inspectedItems,
    coverage.viewableItems,
  ]
  if (counts.some((count) => !Number.isInteger(count) || count < 0)) {
    failures.push('coverage counts must be non-negative integers')
  }
  if (
    coverage.attemptedItems + coverage.unattemptedItems !==
    coverage.eligibleItems
  ) {
    failures.push('attempted and unattempted items must partition eligibility')
  }
  if (
    coverage.resolvedYesItems + coverage.resolvedNoItems !==
    coverage.decisivelyReviewedItems
  ) {
    failures.push('resolved Yes and No items must partition decisive items')
  }
  if (
    coverage.decisivelyReviewedItems +
      coverage.uncertainItems +
      coverage.mediaFailureItems +
      coverage.deferredItems +
      coverage.pendingItems !==
    coverage.eligibleItems
  ) {
    failures.push('item states must partition eligible items')
  }
  if (
    coverage.yesReviewCount + coverage.noReviewCount !==
    coverage.decisiveReviewCount
  ) {
    failures.push('Yes and No reviews must equal decisive review count')
  }
  if (
    coverage.decisiveReviewCount +
      coverage.cantTellReviewCount +
      coverage.cantViewReviewCount +
      coverage.skippedReviewCount !==
    coverage.effectiveReviewCount
  ) {
    failures.push('outcome counts must partition effective reviews')
  }
  if (coverage.viewableItems > coverage.inspectedItems) {
    failures.push('viewable items cannot exceed inspected items')
  }
  for (const [label, value] of [
    ['review coverage', coverage.reviewCoverage],
    ['inspection coverage', coverage.inspectionCoverage],
    ['viewability rate', coverage.viewabilityRate],
  ] as const) {
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > 1)) {
      failures.push(`${label} must be null or a proportion`)
    }
  }
  if (
    (coverage.eligibleItems === 0) !==
    (coverage.reviewCoverage === null)
  ) {
    failures.push('review coverage denominator state is inconsistent')
  }
  if (
    (coverage.eligibleItems === 0) !==
    (coverage.inspectionCoverage === null)
  ) {
    failures.push('inspection coverage denominator state is inconsistent')
  }
  if (
    (coverage.inspectedItems === 0) !==
    (coverage.viewabilityRate === null)
  ) {
    failures.push('viewability denominator state is inconsistent')
  }
  return Object.freeze(failures)
}

function validateCoverageInputs(
  itemIds: readonly string[],
  consensus: readonly VerificationConsensus[],
  inspections: Readonly<Record<string, HumanReviewInspection>>,
): readonly string[] {
  const failures: string[] = []
  const uniqueItemIds = new Set(itemIds)
  if (uniqueItemIds.size !== itemIds.length) {
    failures.push('eligible item IDs are repeated')
  }
  const consensusItemIds = consensus.map(({ itemId }) => itemId)
  if (
    consensusItemIds.length !== itemIds.length ||
    [...consensusItemIds].sort().some(
      (itemId, index) => itemId !== [...itemIds].sort()[index],
    )
  ) {
    failures.push('consensus does not cover exactly the eligible items')
  }
  if (
    Object.keys(inspections).some(
      (itemId) => !uniqueItemIds.has(itemId),
    )
  ) {
    failures.push('inspection names an ineligible item')
  }
  return Object.freeze(failures)
}

function isResolvedStatus(status: VerificationConsensusStatus): boolean {
  return status === 'complete_agreement' || status === 'adjudicated'
}

function countStatus(
  consensus: readonly VerificationConsensus[],
  status: VerificationConsensusStatus,
): number {
  return consensus.filter((projection) => projection.status === status).length
}

function countOutcome(
  events: readonly { readonly outcome: string }[],
  outcome: string,
): number {
  return events.filter((event) => event.outcome === outcome).length
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator
}
