export const POTENTIAL_COVERAGE_GAP_LABEL = 'Potential coverage-gap cells' as const
export const HUMAN_SUPPORTED_ADDITIONAL_LABEL =
  'Human-supported additional cells' as const
export const RELEASE_READY_ADDITIONAL_LABEL =
  'Release-ready additional cells' as const

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

export interface OccurrenceReleaseGateEvidence {
  readonly releaseDecisionId: string | null
  readonly qualitySnapshotId: string | null
  readonly decisionStatus: 'blocked' | 'release_ready'
  readonly decisivePositiveConsensus: boolean
  readonly coordinatesValid: boolean
  readonly duplicateGatePassed: boolean
  readonly qualityGatePassed: boolean
  readonly provenanceComplete: boolean
  readonly eventDate: string | null
}

export type ReleaseReadyAdditionalState =
  | 'release_ready_additional'
  | 'not_release_ready_additional'
  | 'unavailable'

export interface ReleaseReadyAdditionalInput extends HumanSupportedAdditionalInput {
  readonly releaseReadyCount: number
  readonly materializedReleaseReadyAdditionalCell: boolean
  readonly releaseGateEvidence: readonly OccurrenceReleaseGateEvidence[]
}

export interface ReleaseReadyAdditionalClassification {
  readonly state: ReleaseReadyAdditionalState
  readonly contributes: boolean
  readonly label: typeof RELEASE_READY_ADDITIONAL_LABEL
  readonly reason:
    | 'release_gates_passed_without_eligible_baseline'
    | 'no_release_ready_decision'
    | 'not_human_supported_additional'
    | 'baseline_evidence_unavailable'
}

export type GeographicCoverageUpliftStatus =
  | 'available'
  | 'zero_denominator'
  | 'unavailable'

export interface GeographicCoverageUpliftTier {
  readonly additionalCellCount: number
  readonly percent: number | null
}

export interface GeographicCoverageUplift {
  readonly status: GeographicCoverageUpliftStatus
  readonly baselineOccupiedCellCount: number | null
  readonly potential: GeographicCoverageUpliftTier
  readonly humanSupported: GeographicCoverageUpliftTier
  readonly releaseReady: GeographicCoverageUpliftTier
  readonly scientificClaimAllowed: false
}

export type CandidateRangeEdgeState =
  | 'potential'
  | 'human_supported'
  | 'release_ready'
  | 'data_deficient'
  | 'unavailable'

export interface CandidateRangeEdgeInput {
  readonly baselineEvidenceStatus: 'available' | 'unavailable'
  readonly candidateOnlyCell: boolean
  readonly reviewedAdditionalCell: boolean
  readonly releaseReadyAdditionalCell: boolean
  readonly nearestBaselineDistanceKm: number | null
  readonly dataDeficientState: 'sufficient' | 'data_deficient' | 'unavailable'
}

export type CandidateRangeEdgeStateCounts = Readonly<Record<CandidateRangeEdgeState, number>>

/**
 * Qualify cell-centroid proximity by evidence maturity.
 * This is not a distance to a proven biological range boundary.
 */
export function classifyCandidateRangeEdgeState(
  input: CandidateRangeEdgeInput,
): CandidateRangeEdgeState {
  if (input.releaseReadyAdditionalCell && !input.reviewedAdditionalCell) {
    throw new Error('release-ready range-edge evidence must be human-supported')
  }
  if (input.reviewedAdditionalCell && !input.candidateOnlyCell) {
    throw new Error('human-supported range-edge evidence must be candidate-only')
  }
  if (
    input.nearestBaselineDistanceKm !== null &&
    (!Number.isFinite(input.nearestBaselineDistanceKm) ||
      input.nearestBaselineDistanceKm < 0)
  ) {
    throw new Error('nearest baseline distance must be finite and non-negative')
  }
  if (input.baselineEvidenceStatus === 'unavailable') {
    if (input.candidateOnlyCell || input.nearestBaselineDistanceKm !== null) {
      throw new Error('unavailable baseline evidence cannot expose a range-edge comparison')
    }
    return 'unavailable'
  }
  if (!input.candidateOnlyCell) return 'unavailable'
  if (input.nearestBaselineDistanceKm === null) {
    return input.dataDeficientState === 'data_deficient'
      ? 'data_deficient'
      : 'unavailable'
  }
  if (input.releaseReadyAdditionalCell) return 'release_ready'
  if (input.reviewedAdditionalCell) return 'human_supported'
  return 'potential'
}

export function countCandidateRangeEdgeStates(
  cells: readonly Omit<CandidateRangeEdgeInput, 'baselineEvidenceStatus'>[],
): CandidateRangeEdgeStateCounts {
  const counts: Record<CandidateRangeEdgeState, number> = {
    potential: 0,
    human_supported: 0,
    release_ready: 0,
    data_deficient: 0,
    unavailable: 0,
  }
  for (const cell of cells) {
    counts[
      classifyCandidateRangeEdgeState({
        ...cell,
        baselineEvidenceStatus: 'available',
      })
    ] += 1
  }
  return Object.freeze(counts)
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

export function classifyReleaseReadyAdditionalCell(
  input: ReleaseReadyAdditionalInput,
): ReleaseReadyAdditionalClassification {
  assertCount(input.releaseReadyCount, 'releaseReadyCount')
  const humanSupported = classifyHumanSupportedAdditionalCell(input)
  if (input.releaseReadyCount > input.reviewedPositiveCount) {
    throw new Error('release-ready count exceeds reviewed target-positive count')
  }
  const readyDecisionIds = input.releaseGateEvidence
    .filter(validateOccurrenceReleaseGateEvidence)
    .map(({ releaseDecisionId }) => releaseDecisionId as string)
  if (new Set(readyDecisionIds).size !== readyDecisionIds.length) {
    throw new Error('release-ready decision identity is duplicated within a cell')
  }
  if (input.releaseReadyCount !== readyDecisionIds.length) {
    throw new Error('release-ready count lacks complete occurrence-release gate evidence')
  }
  if (humanSupported.state === 'unavailable') {
    if (input.materializedReleaseReadyAdditionalCell) {
      throw new Error('unavailable baseline cannot materialize release-ready contribution')
    }
    return releaseClassification(
      'unavailable',
      false,
      'baseline_evidence_unavailable',
    )
  }
  const expected = humanSupported.contributes && input.releaseReadyCount > 0
  if (expected !== input.materializedReleaseReadyAdditionalCell) {
    throw new Error('materialized release-ready additional state differs from gated evidence')
  }
  if (expected) {
    return releaseClassification(
      'release_ready_additional',
      true,
      'release_gates_passed_without_eligible_baseline',
    )
  }
  return input.releaseReadyCount === 0
    ? releaseClassification(
        'not_release_ready_additional',
        false,
        'no_release_ready_decision',
      )
    : releaseClassification(
        'not_release_ready_additional',
        false,
        'not_human_supported_additional',
      )
}

export function validateOccurrenceReleaseGateEvidence(
  evidence: OccurrenceReleaseGateEvidence,
): boolean {
  if (evidence.decisionStatus === 'blocked') return false
  for (const [name, passed] of [
    ['decisive positive consensus', evidence.decisivePositiveConsensus],
    ['coordinates', evidence.coordinatesValid],
    ['duplicate', evidence.duplicateGatePassed],
    ['quality', evidence.qualityGatePassed],
    ['provenance', evidence.provenanceComplete],
  ] as const) {
    if (!passed) throw new Error(`release-ready decision failed the ${name} gate`)
  }
  assertIdentity(evidence.releaseDecisionId, 'release decision ID')
  assertIdentity(evidence.qualitySnapshotId, 'quality snapshot ID')
  if (
    evidence.eventDate === null ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(evidence.eventDate) ||
    Number.isNaN(Date.parse(`${evidence.eventDate}T00:00:00Z`))
  ) {
    throw new Error('release-ready decision event date is unavailable or invalid')
  }
  return true
}

export type ReleaseGateEvidenceByCell = ReadonlyMap<
  string,
  readonly OccurrenceReleaseGateEvidence[]
>

export function countReleaseReadyAdditionalCells(
  cells: readonly {
    readonly spatialCellId: string
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
    readonly releaseReadyCount: number
    readonly releaseReadyAdditionalCell: boolean
  }[],
  releaseEvidenceByCell?: ReleaseGateEvidenceByCell,
): number {
  return cells.filter((cell) => {
    const releaseGateEvidence = releaseEvidenceByCell?.get(cell.spatialCellId) ?? []
    if (cell.releaseReadyCount > 0 && !releaseEvidenceByCell?.has(cell.spatialCellId)) {
      throw new Error(
        `release-ready cell ${cell.spatialCellId} lacks a gate-evidence projection`,
      )
    }
    return classifyReleaseReadyAdditionalCell({
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
      releaseReadyCount: cell.releaseReadyCount,
      materializedReleaseReadyAdditionalCell: cell.releaseReadyAdditionalCell,
      releaseGateEvidence,
    }).contributes
  }).length
}

export function calculateGeographicCoverageUplift(input: {
  readonly baselineEvidenceStatus: 'available' | 'unavailable'
  readonly baselineOccupiedCellCount: number | null
  readonly candidateAdditionalCellCount: number
  readonly humanSupportedAdditionalCellCount: number
  readonly releaseReadyAdditionalCellCount: number
}): GeographicCoverageUplift {
  for (const [field, count] of [
    ['candidateAdditionalCellCount', input.candidateAdditionalCellCount],
    ['humanSupportedAdditionalCellCount', input.humanSupportedAdditionalCellCount],
    ['releaseReadyAdditionalCellCount', input.releaseReadyAdditionalCellCount],
  ] as const) {
    assertCount(count, field)
  }
  if (
    input.humanSupportedAdditionalCellCount > input.candidateAdditionalCellCount ||
    input.releaseReadyAdditionalCellCount > input.humanSupportedAdditionalCellCount
  ) {
    throw new Error('geographic contribution maturity counts are not nested')
  }
  if (input.baselineEvidenceStatus === 'unavailable') {
    if (input.baselineOccupiedCellCount !== null) {
      throw new Error('unavailable baseline evidence must not expose an occupied-cell count')
    }
    return upliftResult('unavailable', null, input)
  }
  if (input.baselineOccupiedCellCount === null) {
    throw new Error('available baseline evidence requires an occupied-cell count')
  }
  assertCount(input.baselineOccupiedCellCount, 'baselineOccupiedCellCount')
  if (input.baselineOccupiedCellCount === 0) {
    return upliftResult('zero_denominator', 0, input)
  }
  return upliftResult('available', input.baselineOccupiedCellCount, input)
}

export function calculateGeographicCoverageUpliftFromCells(
  cells: Parameters<typeof countReleaseReadyAdditionalCells>[0],
  releaseEvidenceByCell?: ReleaseGateEvidenceByCell,
): GeographicCoverageUplift {
  return calculateGeographicCoverageUplift({
    baselineEvidenceStatus: 'available',
    baselineOccupiedCellCount: cells.filter(
      ({ baselineRangeInferenceEligibleCount }) =>
        baselineRangeInferenceEligibleCount > 0,
    ).length,
    candidateAdditionalCellCount: countPotentialCoverageGapCells(cells),
    humanSupportedAdditionalCellCount: countHumanSupportedAdditionalCells(cells),
    releaseReadyAdditionalCellCount: countReleaseReadyAdditionalCells(
      cells,
      releaseEvidenceByCell,
    ),
  })
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

function releaseClassification(
  state: ReleaseReadyAdditionalState,
  contributes: boolean,
  reason: ReleaseReadyAdditionalClassification['reason'],
): ReleaseReadyAdditionalClassification {
  return Object.freeze({
    state,
    contributes,
    label: RELEASE_READY_ADDITIONAL_LABEL,
    reason,
  })
}

function upliftResult(
  status: GeographicCoverageUpliftStatus,
  baselineOccupiedCellCount: number | null,
  input: Pick<
    Parameters<typeof calculateGeographicCoverageUplift>[0],
    | 'candidateAdditionalCellCount'
    | 'humanSupportedAdditionalCellCount'
    | 'releaseReadyAdditionalCellCount'
  >,
): GeographicCoverageUplift {
  const percent = (additionalCellCount: number) =>
    status === 'available' && baselineOccupiedCellCount !== null
      ? (additionalCellCount / baselineOccupiedCellCount) * 100
      : null
  return Object.freeze({
    status,
    baselineOccupiedCellCount,
    potential: Object.freeze({
      additionalCellCount: input.candidateAdditionalCellCount,
      percent: percent(input.candidateAdditionalCellCount),
    }),
    humanSupported: Object.freeze({
      additionalCellCount: input.humanSupportedAdditionalCellCount,
      percent: percent(input.humanSupportedAdditionalCellCount),
    }),
    releaseReady: Object.freeze({
      additionalCellCount: input.releaseReadyAdditionalCellCount,
      percent: percent(input.releaseReadyAdditionalCellCount),
    }),
    scientificClaimAllowed: false,
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

function assertIdentity(value: string | null, field: string): asserts value is string {
  if (value === null || value.length === 0 || value.trim() !== value) {
    throw new Error(`${field} must be a non-empty canonical string`)
  }
}
