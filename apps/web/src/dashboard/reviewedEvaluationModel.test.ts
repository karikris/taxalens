import { beforeAll, describe, expect, it } from 'vitest'

import { loadEvidenceFacade, type ReplayEvidence } from '../data/evidenceFacade'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import { buildReviewedEvaluationModel } from './reviewedEvaluationModel'

let replay: ReplayEvidence

beforeAll(async () => {
  replay = (
    await loadEvidenceFacade(
      new AbortController().signal,
      createCommittedFixtureFetcher(),
    )
  ).replay
})

describe('buildReviewedEvaluationModel', () => {
  it('keeps Phase 13 unavailable when no reviewed result artifact is committed', () => {
    const model = buildReviewedEvaluationModel(replay)

    expect(model.committedReviewedMetricCount).toBe(0)
    expect(model.phase13).toEqual({
      status: 'unavailable',
      resultArtifactCount: 0,
      reviewedMetricCount: 0,
      reason: 'No Phase 13 result artifact is supplied to this fixture.',
      sourceSection: 'evaluation_summaries',
    })
    expect(model.metrics[0]).toMatchObject({
      phase: 'Phase 13',
      label: 'Committed reviewed result set',
      status: 'unavailable',
    })
  })

  it('reports the exact Phase 14 review block and withholds every scientific rate', () => {
    const model = buildReviewedEvaluationModel(replay)

    expect(model.phase14).toEqual({
      status: 'blocked',
      humanVerifiedSourceMediaCount: 0,
      humanVerifiedShortfall: 490,
      groupsAwaitingHumanReview: 1,
      unresolvedGroupCount: 2,
      candidateVisualScoreCount: 0,
      calibratedDecisionCount: 0,
      reviewState: 'awaiting_human_review',
    })
    expect(model.metrics).toHaveLength(7)
    expect(model.metrics.every(({ status, value }) => status === 'unavailable' && value === 'Unavailable')).toBe(true)
    expect(model.metrics.find(({ id }) => id === 'precision')?.denominator).toContain('TP / (TP + FP)')
    expect(model.metrics.find(({ id }) => id === 'accuracy')?.denominator).toContain('(TP + TN) / N')
    expect(model.scientificClaimAllowed).toBe(false)
  })

  it('binds the blocked state to verified readiness, shortfall, and decision artifacts', () => {
    expect(buildReviewedEvaluationModel(replay).provenance.map(({ artifactId }) => artifactId)).toEqual([
      'reference-readiness',
      'reference-shortfalls',
      'selective-decision-metadata',
    ])
  })
})
