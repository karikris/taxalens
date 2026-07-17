import { describe, expect, it } from 'vitest'

import {
  calculateGeographicCoverageUplift,
  calculateGeographicCoverageUpliftFromCells,
  classifyCandidateRangeEdgeState,
  classifyHumanSupportedAdditionalCell,
  classifyPotentialCoverageGapCell,
  classifyReleaseReadyAdditionalCell,
  countHumanSupportedAdditionalCells,
  countCandidateRangeEdgeStates,
  countPotentialCoverageGapCells,
  countReleaseReadyAdditionalCells,
  POTENTIAL_COVERAGE_GAP_LABEL,
} from './geographicContributionMetrics'

describe('candidate range-edge maturity', () => {
  const candidate = {
    baselineEvidenceStatus: 'available' as const,
    candidateOnlyCell: true,
    reviewedAdditionalCell: false,
    releaseReadyAdditionalCell: false,
    nearestBaselineDistanceKm: 42.5,
    dataDeficientState: 'sufficient' as const,
  }

  it('separates potential, human-supported and release-ready proximity', () => {
    expect(classifyCandidateRangeEdgeState(candidate)).toBe('potential')
    expect(
      classifyCandidateRangeEdgeState({
        ...candidate,
        reviewedAdditionalCell: true,
      }),
    ).toBe('human_supported')
    expect(
      classifyCandidateRangeEdgeState({
        ...candidate,
        reviewedAdditionalCell: true,
        releaseReadyAdditionalCell: true,
      }),
    ).toBe('release_ready')
  })

  it('uses deficiency only when a candidate comparison is unavailable', () => {
    expect(
      classifyCandidateRangeEdgeState({
        ...candidate,
        nearestBaselineDistanceKm: null,
        dataDeficientState: 'data_deficient',
      }),
    ).toBe('data_deficient')
    expect(
      classifyCandidateRangeEdgeState({
        ...candidate,
        nearestBaselineDistanceKm: null,
        dataDeficientState: 'sufficient',
      }),
    ).toBe('unavailable')
    expect(
      classifyCandidateRangeEdgeState({
        ...candidate,
        candidateOnlyCell: false,
        nearestBaselineDistanceKm: null,
      }),
    ).toBe('unavailable')
  })

  it('fails closed on contradictory maturity and unavailable baseline state', () => {
    expect(() =>
      classifyCandidateRangeEdgeState({
        ...candidate,
        reviewedAdditionalCell: false,
        releaseReadyAdditionalCell: true,
      }),
    ).toThrow(/must be human-supported/u)
    expect(() =>
      classifyCandidateRangeEdgeState({
        ...candidate,
        baselineEvidenceStatus: 'unavailable',
      }),
    ).toThrow(/cannot expose a range-edge comparison/u)
  })

  it('counts maturity-qualified cells rather than candidate records', () => {
    expect(
      countCandidateRangeEdgeStates([
        {
          ...candidate,
          nearestBaselineDistanceKm: 10,
        },
        {
          ...candidate,
          nearestBaselineDistanceKm: 100,
          reviewedAdditionalCell: true,
        },
        {
          ...candidate,
          nearestBaselineDistanceKm: null,
          dataDeficientState: 'data_deficient',
        },
      ]),
    ).toEqual({
      potential: 1,
      human_supported: 1,
      release_ready: 0,
      data_deficient: 1,
      unavailable: 0,
    })
  })
})

describe('potential geographic coverage contribution', () => {
  it('classifies only candidate cells without eligible selected-baseline evidence', () => {
    expect(
      classifyPotentialCoverageGapCell({
        baselineEvidenceStatus: 'available',
        baselineRangeInferenceEligibleCount: 0,
        flickrCandidateCount: 3,
        materializedCandidateOnlyCell: true,
      }),
    ).toEqual({
      state: 'potential',
      contributes: true,
      label: POTENTIAL_COVERAGE_GAP_LABEL,
      reason: 'candidate_without_eligible_baseline_in_cell',
    })
    expect(
      classifyPotentialCoverageGapCell({
        baselineEvidenceStatus: 'available',
        baselineRangeInferenceEligibleCount: 2,
        flickrCandidateCount: 3,
        materializedCandidateOnlyCell: false,
      }).reason,
    ).toBe('eligible_baseline_present')
    expect(
      classifyPotentialCoverageGapCell({
        baselineEvidenceStatus: 'available',
        baselineRangeInferenceEligibleCount: 0,
        flickrCandidateCount: 0,
        materializedCandidateOnlyCell: false,
      }).reason,
    ).toBe('no_flickr_candidate')
  })

  it('keeps unavailable baseline evidence unknown rather than treating it as zero', () => {
    expect(
      classifyPotentialCoverageGapCell({
        baselineEvidenceStatus: 'unavailable',
        baselineRangeInferenceEligibleCount: null,
        flickrCandidateCount: 4,
        materializedCandidateOnlyCell: false,
      }),
    ).toMatchObject({
      state: 'unavailable',
      contributes: false,
      reason: 'baseline_evidence_unavailable',
    })
  })

  it('fails closed when materialized flags or counts contradict source semantics', () => {
    expect(() =>
      classifyPotentialCoverageGapCell({
        baselineEvidenceStatus: 'available',
        baselineRangeInferenceEligibleCount: 0,
        flickrCandidateCount: 1,
        materializedCandidateOnlyCell: false,
      }),
    ).toThrow(/differs from exact source counts/u)
    expect(() =>
      classifyPotentialCoverageGapCell({
        baselineEvidenceStatus: 'unavailable',
        baselineRangeInferenceEligibleCount: 0,
        flickrCandidateCount: 1,
        materializedCandidateOnlyCell: false,
      }),
    ).toThrow(/must not expose an eligible count/u)
  })

  it('counts reconciled potential cells without using candidate record totals', () => {
    expect(
      countPotentialCoverageGapCells([
        {
          baselineRangeInferenceEligibleCount: 0,
          flickrCandidateCount: 50,
          candidateOnlyCell: true,
        },
        {
          baselineRangeInferenceEligibleCount: 0,
          flickrCandidateCount: 1,
          candidateOnlyCell: true,
        },
        {
          baselineRangeInferenceEligibleCount: 2,
          flickrCandidateCount: 8,
          candidateOnlyCell: false,
        },
      ]),
    ).toBe(2)
  })
})

describe('human-supported geographic contribution', () => {
  const base = {
    baselineEvidenceStatus: 'available' as const,
    baselineRangeInferenceEligibleCount: 0,
    flickrCandidateCount: 3,
    materializedCandidateOnlyCell: true,
    reviewedPositiveCount: 0,
    reviewedNegativeCount: 0,
    uncertainCount: 0,
    pendingCount: 0,
    mediaFailureCount: 0,
    skippedCount: 0,
    materializedReviewedAdditionalCell: false,
  }

  it('requires target-positive human review in a candidate-only cell', () => {
    expect(
      classifyHumanSupportedAdditionalCell({
        ...base,
        reviewedPositiveCount: 1,
        materializedReviewedAdditionalCell: true,
      }),
    ).toMatchObject({
      state: 'human_supported',
      contributes: true,
      label: 'Human-supported additional cells',
      reason: 'reviewed_target_positive_without_eligible_baseline',
    })
    expect(
      classifyHumanSupportedAdditionalCell({
        ...base,
        baselineRangeInferenceEligibleCount: 2,
        materializedCandidateOnlyCell: false,
        reviewedPositiveCount: 1,
      }),
    ).toMatchObject({
      state: 'not_human_supported',
      reason: 'eligible_baseline_present',
    })
  })

  it('does not count non-target, uncertain, pending, media-failure or skipped outcomes', () => {
    for (const nonContributing of [
      { reviewedNegativeCount: 1 },
      { uncertainCount: 1 },
      { pendingCount: 1 },
      { mediaFailureCount: 1 },
      { skippedCount: 1 },
    ]) {
      expect(
        classifyHumanSupportedAdditionalCell({ ...base, ...nonContributing }),
      ).toMatchObject({
        state: 'not_human_supported',
        contributes: false,
        reason: 'no_reviewed_target_positive',
      })
    }
  })

  it('reconciles materialized human-supported flags and counts cells, not reviews', () => {
    expect(() =>
      classifyHumanSupportedAdditionalCell({
        ...base,
        reviewedPositiveCount: 1,
      }),
    ).toThrow(/reviewed-additional state differs/u)
    expect(
      countHumanSupportedAdditionalCells([
        {
          baselineRangeInferenceEligibleCount: 0,
          flickrCandidateCount: 3,
          candidateOnlyCell: true,
          reviewedPositiveCount: 2,
          reviewedNegativeCount: 0,
          uncertainCount: 0,
          pendingCount: 1,
          mediaFailureCount: 0,
          skippedCount: 0,
          reviewedAdditionalCell: true,
        },
        {
          baselineRangeInferenceEligibleCount: 0,
          flickrCandidateCount: 2,
          candidateOnlyCell: true,
          reviewedPositiveCount: 0,
          reviewedNegativeCount: 0,
          uncertainCount: 0,
          pendingCount: 0,
          mediaFailureCount: 1,
          skippedCount: 1,
          reviewedAdditionalCell: false,
        },
      ]),
    ).toBe(1)
  })
})

describe('release-ready geographic contribution', () => {
  const gateEvidence = {
    releaseDecisionId: 'release:1',
    qualitySnapshotId: 'quality:1',
    decisionStatus: 'release_ready' as const,
    decisivePositiveConsensus: true,
    coordinatesValid: true,
    duplicateGatePassed: true,
    qualityGatePassed: true,
    provenanceComplete: true,
    eventDate: '2026-07-17',
  }
  const input = {
    baselineEvidenceStatus: 'available' as const,
    baselineRangeInferenceEligibleCount: 0,
    flickrCandidateCount: 2,
    materializedCandidateOnlyCell: true,
    reviewedPositiveCount: 1,
    reviewedNegativeCount: 0,
    uncertainCount: 0,
    pendingCount: 1,
    mediaFailureCount: 0,
    skippedCount: 0,
    materializedReviewedAdditionalCell: true,
    releaseReadyCount: 1,
    materializedReleaseReadyAdditionalCell: true,
    releaseGateEvidence: [gateEvidence],
  }

  it('requires positive consensus and every occurrence-release gate', () => {
    expect(classifyReleaseReadyAdditionalCell(input)).toMatchObject({
      state: 'release_ready_additional',
      contributes: true,
      label: 'Release-ready additional cells',
      reason: 'release_gates_passed_without_eligible_baseline',
    })
    for (const gate of [
      'decisivePositiveConsensus',
      'coordinatesValid',
      'duplicateGatePassed',
      'qualityGatePassed',
      'provenanceComplete',
    ] as const) {
      expect(() =>
        classifyReleaseReadyAdditionalCell({
          ...input,
          releaseGateEvidence: [{ ...gateEvidence, [gate]: false }],
        }),
      ).toThrow(/failed the .* gate/u)
    }
  })

  it('requires decision, quality and event identities and reconciles exact counts', () => {
    expect(() =>
      classifyReleaseReadyAdditionalCell({ ...input, releaseGateEvidence: [] }),
    ).toThrow(/lacks complete occurrence-release gate evidence/u)
    expect(() =>
      classifyReleaseReadyAdditionalCell({
        ...input,
        releaseGateEvidence: [{ ...gateEvidence, qualitySnapshotId: null }],
      }),
    ).toThrow(/quality snapshot ID/u)
    expect(() =>
      classifyReleaseReadyAdditionalCell({
        ...input,
        releaseGateEvidence: [{ ...gateEvidence, eventDate: null }],
      }),
    ).toThrow(/event date/u)
  })

  it('does not call a gated candidate additional when baseline evidence occupies the cell', () => {
    expect(
      classifyReleaseReadyAdditionalCell({
        ...input,
        baselineRangeInferenceEligibleCount: 2,
        materializedCandidateOnlyCell: false,
        materializedReviewedAdditionalCell: false,
        materializedReleaseReadyAdditionalCell: false,
      }),
    ).toMatchObject({
      state: 'not_release_ready_additional',
      contributes: false,
      reason: 'not_human_supported_additional',
    })
  })

  it('accepts the committed zero-release state and fails closed without a non-zero projection', () => {
    const zeroCell = {
      spatialCellId: 'cell:zero',
      baselineRangeInferenceEligibleCount: 0,
      flickrCandidateCount: 2,
      candidateOnlyCell: true,
      reviewedPositiveCount: 0,
      reviewedNegativeCount: 0,
      uncertainCount: 0,
      pendingCount: 2,
      mediaFailureCount: 0,
      skippedCount: 0,
      reviewedAdditionalCell: false,
      releaseReadyCount: 0,
      releaseReadyAdditionalCell: false,
    }
    expect(countReleaseReadyAdditionalCells([zeroCell])).toBe(0)
    expect(() =>
      countReleaseReadyAdditionalCells([
        {
          ...zeroCell,
          reviewedPositiveCount: 1,
          reviewedAdditionalCell: true,
          releaseReadyCount: 1,
          releaseReadyAdditionalCell: true,
        },
      ]),
    ).toThrow(/lacks a gate-evidence projection/u)
  })
})

describe('geographic occupied-cell coverage uplift', () => {
  it('reports candidate, human-supported and release-ready uplift separately', () => {
    expect(
      calculateGeographicCoverageUplift({
        baselineEvidenceStatus: 'available',
        baselineOccupiedCellCount: 10,
        candidateAdditionalCellCount: 5,
        humanSupportedAdditionalCellCount: 2,
        releaseReadyAdditionalCellCount: 1,
      }),
    ).toEqual({
      status: 'available',
      baselineOccupiedCellCount: 10,
      potential: { additionalCellCount: 5, percent: 50 },
      humanSupported: { additionalCellCount: 2, percent: 20 },
      releaseReady: { additionalCellCount: 1, percent: 10 },
      scientificClaimAllowed: false,
    })
  })

  it('keeps zero numerator as zero percent when a positive denominator exists', () => {
    const uplift = calculateGeographicCoverageUplift({
      baselineEvidenceStatus: 'available',
      baselineOccupiedCellCount: 4,
      candidateAdditionalCellCount: 0,
      humanSupportedAdditionalCellCount: 0,
      releaseReadyAdditionalCellCount: 0,
    })
    expect(uplift.potential.percent).toBe(0)
    expect(uplift.humanSupported.percent).toBe(0)
    expect(uplift.releaseReady.percent).toBe(0)
  })

  it('does not calculate a percentage for zero or unavailable baseline denominators', () => {
    expect(
      calculateGeographicCoverageUplift({
        baselineEvidenceStatus: 'available',
        baselineOccupiedCellCount: 0,
        candidateAdditionalCellCount: 2,
        humanSupportedAdditionalCellCount: 0,
        releaseReadyAdditionalCellCount: 0,
      }),
    ).toMatchObject({
      status: 'zero_denominator',
      potential: { additionalCellCount: 2, percent: null },
    })
    expect(
      calculateGeographicCoverageUplift({
        baselineEvidenceStatus: 'unavailable',
        baselineOccupiedCellCount: null,
        candidateAdditionalCellCount: 0,
        humanSupportedAdditionalCellCount: 0,
        releaseReadyAdditionalCellCount: 0,
      }),
    ).toMatchObject({
      status: 'unavailable',
      baselineOccupiedCellCount: null,
      potential: { percent: null },
    })
  })

  it('derives an exact denominator and reconciled maturity tiers from cells', () => {
    const uplift = calculateGeographicCoverageUpliftFromCells([
      contributionCell('baseline:a', { baselineRangeInferenceEligibleCount: 2 }),
      contributionCell('baseline:b', { baselineRangeInferenceEligibleCount: 1 }),
      contributionCell('candidate:a', {
        flickrCandidateCount: 4,
        candidateOnlyCell: true,
      }),
    ])
    expect(uplift).toMatchObject({
      status: 'available',
      baselineOccupiedCellCount: 2,
      potential: { additionalCellCount: 1, percent: 50 },
      humanSupported: { additionalCellCount: 0, percent: 0 },
      releaseReady: { additionalCellCount: 0, percent: 0 },
    })
  })
})

function contributionCell(
  spatialCellId: string,
  overrides: Partial<Parameters<typeof calculateGeographicCoverageUpliftFromCells>[0][number]> = {},
): Parameters<typeof calculateGeographicCoverageUpliftFromCells>[0][number] {
  return {
    spatialCellId,
    baselineRangeInferenceEligibleCount: 0,
    flickrCandidateCount: 0,
    candidateOnlyCell: false,
    reviewedPositiveCount: 0,
    reviewedNegativeCount: 0,
    uncertainCount: 0,
    pendingCount: 0,
    mediaFailureCount: 0,
    skippedCount: 0,
    reviewedAdditionalCell: false,
    releaseReadyCount: 0,
    releaseReadyAdditionalCell: false,
    ...overrides,
  }
}
