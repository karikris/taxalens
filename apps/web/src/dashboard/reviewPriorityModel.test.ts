import { beforeAll, describe, expect, it } from 'vitest'

import { loadEvidenceFacade, type ReplayEvidence } from '../data/evidenceFacade'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import { buildReviewPriorityModel } from './reviewPriorityModel'

let replay: ReplayEvidence

beforeAll(async () => {
  replay = (
    await loadEvidenceFacade(
      new AbortController().signal,
      createCommittedFixtureFetcher(),
    )
  ).replay
})

describe('review priority model', () => {
  it('keeps the single work item unranked without a materialized queue', () => {
    const model = buildReviewPriorityModel(replay)

    expect(model.item.positionLabel).toBe('1 of 1')
    expect(model.item.positionBasis).toContain('not score-derived')
    expect(model.item.priorityScore).toBeNull()
    expect(model.item.blockedGateCount).toBe(5)
    expect(model.queueMaterialized).toBe(false)
    expect(model.comparativeRankingAvailable).toBe(false)
    expect(model.scientificClaimAllowed).toBe(false)
  })

  it('audits every requested factor without promoting absent evidence into a score', () => {
    const model = buildReviewPriorityModel(replay)

    expect(model.factors.map(({ id }) => id)).toEqual([
      'competitor-margin',
      'missing-calibration',
      'reference-shortfall',
      'visual-disagreement',
      'small-subject',
      'comment-conflict',
      'geographic-anomaly',
    ])
    expect(model.factors.every(({ priorityEffect }) => priorityEffect === 'not-scored')).toBe(true)
    expect(model.factors.find(({ id }) => id === 'missing-calibration')?.status).toBe(
      'attention',
    )
    expect(model.factors.find(({ id }) => id === 'reference-shortfall')?.value).toBe(
      '247 source · 490 human-review',
    )
    expect(model.factors.find(({ id }) => id === 'comment-conflict')?.status).toBe(
      'verified-zero',
    )
    expect(model.provenance.map(({ artifactId }) => artifactId)).toEqual([
      'selective-decision-metadata',
      'run-summary',
      'reference-shortfalls',
    ])
  })
})
