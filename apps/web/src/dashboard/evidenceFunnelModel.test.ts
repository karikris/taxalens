import { beforeAll, describe, expect, it } from 'vitest'

import { loadEvidenceFacade, type ReplayEvidence } from '../data/evidenceFacade'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import { buildEvidenceFunnel } from './evidenceFunnelModel'

let replay: ReplayEvidence

beforeAll(async () => {
  replay = (
    await loadEvidenceFacade(
      new AbortController().signal,
      createCommittedFixtureFetcher(),
    )
  ).replay
})

describe('buildEvidenceFunnel', () => {
  it('projects all seven stages with exact values and explicit unavailable unique content', () => {
    const funnel = buildEvidenceFunnel(replay)

    expect(funnel.stages.map(({ label }) => label)).toEqual([
      'Query hits',
      'Canonical photos',
      'Unique content',
      'Route counts',
      'Candidate states',
      'Decision states',
      'Review queue state',
    ])
    expect(funnel.stages.map(({ value }) => value)).toEqual([76_485, 13_501, null, 0, 6, 0, 1])
    expect(funnel.stages.map(({ status }) => status)).toEqual([
      'verified',
      'verified',
      'unavailable',
      'unavailable',
      'partial',
      'unavailable',
      'review',
    ])
    expect(funnel.stages[2]).toEqual(
      expect.objectContaining({
        value: null,
        measurementBasis: 'duplicate_summaries.data.duplicate_relationship_rows_available=false',
      }),
    )
    expect(funnel.stages[4]?.detail).toContain('One target plus 5 regional competitor hypotheses')
    expect(funnel.stages[6]?.detail).toContain('no materialized or ranked review-queue artifact')
  })

  it('binds every value to verified artifacts without computing conversion rates', () => {
    const funnel = buildEvidenceFunnel(replay)

    expect(funnel.comparisonPolicy).toBe('unlike_units_no_stage_conversion_rates')
    expect(funnel.reviewQueueMaterialized).toBe(false)
    expect(funnel.scientificClaimAllowed).toBe(false)
    for (const stage of funnel.stages) {
      expect(stage.artifacts.length).toBeGreaterThan(0)
      expect(stage.artifacts.every(({ verified }) => verified)).toBe(true)
      expect(stage.scientificClaimAllowed).toBe(false)
      if (stage.transitionToNext !== null) {
        expect(stage.transitionToNext).not.toMatch(/%/u)
      }
    }
    expect(Object.isFrozen(funnel)).toBe(true)
    expect(Object.isFrozen(funnel.stages)).toBe(true)
    expect(Object.isFrozen(funnel.stages[0]?.artifacts)).toBe(true)
  })
})
