import { describe, expect, it } from 'vitest'

import {
  classifyHumanSupportedAdditionalCell,
  classifyPotentialCoverageGapCell,
  countHumanSupportedAdditionalCells,
  countPotentialCoverageGapCells,
  POTENTIAL_COVERAGE_GAP_LABEL,
} from './geographicContributionMetrics'

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
