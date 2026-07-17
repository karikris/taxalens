export const POTENTIAL_COVERAGE_GAP_LABEL = 'Potential coverage-gap cells' as const

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

function assertCount(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative safe integer`)
  }
}
