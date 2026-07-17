import { describe, expect, it } from 'vitest'

import {
  classifyPotentialCoverageGapCell,
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
