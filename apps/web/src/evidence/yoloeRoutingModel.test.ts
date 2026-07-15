import { beforeAll, describe, expect, it } from 'vitest'

import { loadEvidenceFacade, type ReplayEvidence } from '../data/evidenceFacade'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import { buildYoloeRoutingEvidence } from './yoloeRoutingModel'

let replay: ReplayEvidence

beforeAll(async () => {
  replay = (
    await loadEvidenceFacade(
      new AbortController().signal,
      createCommittedFixtureFetcher(),
    )
  ).replay
})

describe('buildYoloeRoutingEvidence', () => {
  it('projects every required visual and routing field as explicitly unavailable', () => {
    const model = buildYoloeRoutingEvidence(replay)

    expect(model.processedImageCount).toBe(0)
    expect(model.visualLayers.map(({ id }) => id)).toEqual([
      'original-full-image',
      'detection-box',
      'segmentation-mask',
    ])
    expect(model.routeFields.map(({ id }) => id)).toEqual([
      'route',
      'visual-domain',
      'life-stage',
      'subject-area',
      'multiple-organisms',
      'route-reason',
    ])
    expect(
      [...model.visualLayers, ...model.routeFields].every(
        ({ status, reason }) => status === 'unavailable' && reason.length > 0,
      ),
    ).toBe(true)
    expect(model.scientificClaimAllowed).toBe(false)
  })
})
