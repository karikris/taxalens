import { beforeAll, describe, expect, it } from 'vitest'

import { loadEvidenceFacade, type ReplayEvidence } from '../data/evidenceFacade'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import { buildPipelineStages } from './pipelineModel'

let replay: ReplayEvidence

beforeAll(async () => {
  replay = (
    await loadEvidenceFacade(
      new AbortController().signal,
      createCommittedFixtureFetcher(),
    )
  ).replay
})

describe('buildPipelineStages', () => {
  it('projects all thirteen ordered stages and exact fixture counts', () => {
    const stages = buildPipelineStages(replay)

    expect(stages.map(({ label }) => label)).toEqual([
      'Trusted Registry',
      'Query Compilation',
      'Flickr Metadata',
      'Deduplication',
      'Geography',
      'Regional Candidates',
      'Reference Readiness',
      'YOLOE Routing',
      'Full-Frame BioCLIP',
      'Target and Competitor Scoring',
      'Calibration and Abstention',
      'Comments',
      'Final Evidence',
    ])
    expect(stages.map(({ count }) => count)).toEqual([
      22, 22, 76_485, 13_501, 76, 5, 838, 0, 0, 0, 0, 0, 0,
    ])
    expect(stages.map(({ status }) => status)).toEqual([
      'verified',
      'verified',
      'verified',
      'partial',
      'partial',
      'partial',
      'partial',
      'unavailable',
      'unavailable',
      'unavailable',
      'unavailable',
      'unavailable',
      'review',
    ])
    expect(stages.map(({ sequence }) => sequence)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
    ])
    expect(Object.isFrozen(stages)).toBe(true)
    expect(Object.isFrozen(stages[0])).toBe(true)
  })
})
