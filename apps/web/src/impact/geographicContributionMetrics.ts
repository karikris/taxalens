export const POTENTIAL_COVERAGE_GAP_LABEL = 'Potential coverage-gap cells' as const
export const HUMAN_SUPPORTED_ADDITIONAL_LABEL =
  'Human-supported additional cells' as const

export type PotentialCoverageGapState =
  | 'potential'
  | 'not_potential'
  | 'unavailable'

export interface PotentialCoverageGapInput {
  readonly baselineEvidenceStatus: 'available' | 'unavailable'
  readonly baselineRangeInferenceEligibleCount: number | null
  readonly flickrCandidateCount: number
  readonly materializedCandidateOnlyCell: boolean
}

export interface PotentialCoverageGapClassification {
  readonly state: PotentialCoverageGapState
  readonly contributes: boolean
  readonly label: typeof POTENTIAL_COVERAGE_GAP_LABEL
  readonly reason:
    | 'candidate_without_eligible_baseline_in_cell'
    | 'eligible_baseline_present'
    | 'no_flickr_candidate'
    | 'baseline_evidence_unavailable'
}

export type HumanSupportedAdditionalState =
  | 'human_supported'
  | 'not_human_supported'
  | 'unavailable'

export interface HumanSupportedAdditionalInput extends PotentialCoverageGapInput {
  readonly reviewedPositiveCount: number
  readonly reviewedNegativeCount: number
  readonly uncertainCount: number
  readonly pendingCount: number
  readonly mediaFailureCount: number
  readonly skippedCount: number
  readonly materializedReviewedAdditionalCell: boolean
}

export interface HumanSupportedAdditionalClassification {
  readonly state: HumanSupportedAdditionalState
  readonly contributes: boolean
  readonly label: typeof HUMAN_SUPPORTED_ADDITIONAL_LABEL
  readonly reason:
    | 'reviewed_target_positive_without_eligible_baseline'
    | 'eligible_baseline_present'
    | 'no_reviewed_target_positive'
    | 'baseline_evidence_unavailable'
}

/**
 * Classify potential contribution against one selected baseline snapshot.
 * This is an evidence comparison, never a biological absence or occurrence claim.
 */
export function classifyPotentialCoverageGapCell(
  input: PotentialCoverageGapInput,
): PotentialCoverageGapClassification {
  assertCount(input.flickrCandidateCount, 'flickrCandidateCount')
  if (input.baselineEvidenceStatus === 'unavailable') {
    if (input.baselineRangeInferenceEligibleCount !== null) {
      throw new Error('unavailable baseline evidence must not expose an eligible count')
    }
    if (input.materializedCandidateOnlyCell) {
      throw new Error('unavailable baseline evidence cannot materialize a candidate-only cell')
    }
    return classification('unavailable', false, 'baseline_evidence_unavailable')
  }
  if (input.baselineRangeInferenceEligibleCount === null) {
    throw new Error('available baseline evidence requires an eligible count')
  }
  assertCount(
    input.baselineRangeInferenceEligibleCount,
    'baselineRangeInferenceEligibleCount',
  )
  const expected =
    input.baselineRangeInferenceEligibleCount === 0 && input.flickrCandidateCount > 0
  if (expected !== input.materializedCandidateOnlyCell) {
    throw new Error('materialized candidate-only state differs from exact source counts')
  }
  if (expected) {
    return classification(
      'potential',
      true,
      'candidate_without_eligible_baseline_in_cell',
    )
  }
  return input.baselineRangeInferenceEligibleCount > 0
    ? classification('not_potential', false, 'eligible_baseline_present')
    : classification('not_potential', false, 'no_flickr_candidate')
}

export function isPotentialCoverageGapCell(cell: {
  readonly baselineRangeInferenceEligibleCount: number
  readonly flickrCandidateCount: number
  readonly candidateOnlyCell: boolean
}): boolean {
  return classifyPotentialCoverageGapCell({
    baselineEvidenceStatus: 'available',
    baselineRangeInferenceEligibleCount: cell.baselineRangeInferenceEligibleCount,
    flickrCandidateCount: cell.flickrCandidateCount,
    materializedCandidateOnlyCell: cell.candidateOnlyCell,
  }).contributes
}

export function countPotentialCoverageGapCells(
  cells: readonly {
    readonly baselineRangeInferenceEligibleCount: number
    readonly flickrCandidateCount: number
    readonly candidateOnlyCell: boolean
  }[],
): number {
  return cells.filter(isPotentialCoverageGapCell).length
}

/** Pending, negative, uncertain, media-failure and skipped outcomes never contribute. */
export function classifyHumanSupportedAdditionalCell(
  input: HumanSupportedAdditionalInput,
): HumanSupportedAdditionalClassification {
  assertReviewCounts(input)
  const potential = classifyPotentialCoverageGapCell(input)
  if (potential.state === 'unavailable') {
    if (input.materializedReviewedAdditionalCell) {
      throw new Error('unavailable baseline evidence cannot materialize reviewed contribution')
    }
    return humanClassification(
      'unavailable',
      false,
      'baseline_evidence_unavailable',
    )
  }
  const expected = potential.contributes && input.reviewedPositiveCount > 0
  if (expected !== input.materializedReviewedAdditionalCell) {
    throw new Error('materialized reviewed-additional state differs from exact source counts')
  }
  if (expected) {
    return humanClassification(
      'human_supported',
      true,
      'reviewed_target_positive_without_eligible_baseline',
    )
  }
  return potential.reason === 'eligible_baseline_present'
    ? humanClassification('not_human_supported', false, 'eligible_baseline_present')
    : humanClassification('not_human_supported', false, 'no_reviewed_target_positive')
}

export function isHumanSupportedAdditionalCell(cell: {
  readonly baselineRangeInferenceEligibleCount: number
  readonly flickrCandidateCount: number
  readonly candidateOnlyCell: boolean
  readonly reviewedPositiveCount: number
  readonly reviewedNegativeCount: number
  readonly uncertainCount: number
  readonly pendingCount: number
  readonly mediaFailureCount: number
  readonly skippedCount: number
  readonly reviewedAdditionalCell: boolean
}): boolean {
  return classifyHumanSupportedAdditionalCell({
    baselineEvidenceStatus: 'available',
    baselineRangeInferenceEligibleCount: cell.baselineRangeInferenceEligibleCount,
    flickrCandidateCount: cell.flickrCandidateCount,
    materializedCandidateOnlyCell: cell.candidateOnlyCell,
    reviewedPositiveCount: cell.reviewedPositiveCount,
    reviewedNegativeCount: cell.reviewedNegativeCount,
    uncertainCount: cell.uncertainCount,
    pendingCount: cell.pendingCount,
    mediaFailureCount: cell.mediaFailureCount,
    skippedCount: cell.skippedCount,
    materializedReviewedAdditionalCell: cell.reviewedAdditionalCell,
  }).contributes
}

export function countHumanSupportedAdditionalCells(
  cells: readonly Parameters<typeof isHumanSupportedAdditionalCell>[0][],
): number {
  return cells.filter(isHumanSupportedAdditionalCell).length
}

function classification(
  state: PotentialCoverageGapState,
  contributes: boolean,
  reason: PotentialCoverageGapClassification['reason'],
): PotentialCoverageGapClassification {
  return Object.freeze({
    state,
    contributes,
    label: POTENTIAL_COVERAGE_GAP_LABEL,
    reason,
  })
}

function humanClassification(
  state: HumanSupportedAdditionalState,
  contributes: boolean,
  reason: HumanSupportedAdditionalClassification['reason'],
): HumanSupportedAdditionalClassification {
  return Object.freeze({
    state,
    contributes,
    label: HUMAN_SUPPORTED_ADDITIONAL_LABEL,
    reason,
  })
}

function assertReviewCounts(input: HumanSupportedAdditionalInput): void {
  for (const field of [
    'reviewedPositiveCount',
    'reviewedNegativeCount',
    'uncertainCount',
    'pendingCount',
    'mediaFailureCount',
    'skippedCount',
  ] as const) {
    assertCount(input[field], field)
  }
}

function assertCount(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative safe integer`)
  }
}
