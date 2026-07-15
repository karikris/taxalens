import { beforeAll, describe, expect, it } from 'vitest'

import { loadEvidenceFacade, type ReplayEvidence } from '../data/evidenceFacade'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import { buildCandidateComparison } from './candidateComparisonModel'

let replay: ReplayEvidence

beforeAll(async () => {
  replay = (
    await loadEvidenceFacade(
      new AbortController().signal,
      createCommittedFixtureFetcher(),
    )
  ).replay
})

describe('buildCandidateComparison', () => {
  it('separates verified plan order from unavailable score order', () => {
    const model = buildCandidateComparison(replay)

    expect(model.target.scientificName).toBe('Papilio demoleus')
    expect(model.totalCandidateCount).toBe(6)
    expect(model.alternativeCandidateCount).toBe(5)
    expect(model.scoredCandidateCount).toBe(0)
    expect(model.displayedAlternatives).toHaveLength(4)
    expect(model.displayedAlternatives[0]).toMatchObject({
      scientificName: 'Papilio memnon',
      planPosition: 1,
      scoreStatus: 'unavailable',
      rankStatus: 'unavailable',
    })
    expect(model.undisplayedAlternatives).toHaveLength(1)
    expect(model.outcomes).toHaveLength(3)
    expect(model.outcomes.every(({ status }) => status === 'unavailable')).toBe(true)
    expect(model.targetRank.status).toBe('unavailable')
    expect(model.referenceCoverage).toEqual({
      eligibleSourceMediaCount: 838,
      humanVerifiedSourceMediaCount: 0,
      sourceCandidateShortfall: 247,
      humanVerifiedShortfall: 490,
      status: 'insufficient_for_scoring',
    })
    expect(model.rankingStatement).toBe(
      'All eligible candidates scored; four strongest alternatives displayed.',
    )
    expect(model.rankingStatementStatus).toBe('unavailable')
  })
})
