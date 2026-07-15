import { beforeAll, describe, expect, it } from 'vitest'

import { loadEvidenceFacade, type ReplayEvidence } from '../data/evidenceFacade'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import { buildFullFrameComparison } from './fullFrameComparisonModel'

let replay: ReplayEvidence

beforeAll(async () => {
  replay = (
    await loadEvidenceFacade(
      new AbortController().signal,
      createCommittedFixtureFetcher(),
    )
  ).replay
})

describe('buildFullFrameComparison', () => {
  it('retains all four BioMiner modes and all required unavailable identities', () => {
    const model = buildFullFrameComparison(replay)

    expect(model.transformationCount).toBe(0)
    expect(model.modes.map(({ id }) => id)).toEqual([
      'raw-full-image',
      'focused-full-frame',
      'masked-full-frame',
      'multi-object-full-frame',
    ])
    expect(model.identities.map(({ id }) => id)).toEqual([
      'full-canvas-retained',
      'transformation-version',
      'transformation-fingerprint',
      'embedding-identity',
    ])
    expect(
      [...model.modes, ...model.identities].every(
        ({ status, reason }) => status === 'unavailable' && reason.length > 0,
      ),
    ).toBe(true)
    expect(model.scientificClaimAllowed).toBe(false)
  })
})
