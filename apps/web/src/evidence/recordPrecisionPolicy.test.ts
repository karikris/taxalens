import { describe, expect, it } from 'vitest'

import type { RecordPrecisionCell } from './recordGeographicContext'
import {
  blockedFinerRecordResolutions,
  resolveRecordPrecisionCell,
  selectFinestSupportedPrecisionCell,
} from './recordPrecisionPolicy'

const precisionCases = [
  { quality: 'flickr_world', supported: [], unsupportedStatus: 'unsupported_precision' },
  { quality: 'flickr_country', supported: [], unsupportedStatus: 'unsupported_precision' },
  { quality: 'flickr_region', supported: [3], unsupportedStatus: 'unsupported_precision' },
  { quality: 'flickr_city', supported: [3, 5], unsupportedStatus: 'unsupported_precision' },
  { quality: 'flickr_street', supported: [3, 5, 7], unsupportedStatus: 'unsupported_precision' },
  { quality: 'unknown_precision', supported: [], unsupportedStatus: 'unsupported_precision' },
  { quality: 'invalid', supported: [], unsupportedStatus: 'invalid_coordinate' },
  { quality: 'missing', supported: [], unsupportedStatus: 'unavailable_geography' },
] as const

describe('record coordinate precision policy', () => {
  it.each(precisionCases)(
    'selects only committed supported cells for $quality',
    ({ supported, unsupportedStatus }) => {
      const cells = precisionCells(supported, unsupportedStatus)
      const selected = selectFinestSupportedPrecisionCell(cells)

      expect(selected?.spatialResolution ?? null).toBe(supported.at(-1) ?? null)
      for (const resolution of [3, 5, 7]) {
        const decision = resolveRecordPrecisionCell(cells, resolution)
        expect(decision.status).toBe(supported.includes(resolution as never) ? 'available' : 'blocked')
      }
    },
  )

  it('blocks finer region and city cells while retaining supported coarser evidence', () => {
    const region = precisionCells([3], 'unsupported_precision')
    const city = precisionCells([3, 5], 'unsupported_precision')

    expect(resolveRecordPrecisionCell(region, 7)).toMatchObject({
      status: 'blocked',
      supportStatus: 'unsupported_precision',
    })
    expect(blockedFinerRecordResolutions(region, 3).map(({ spatialResolution }) => spatialResolution))
      .toEqual([5, 7])
    expect(blockedFinerRecordResolutions(city, 5).map(({ spatialResolution }) => spatialResolution))
      .toEqual([7])
  })

  it('blocks resolutions absent from the artifact instead of deriving a child cell', () => {
    expect(resolveRecordPrecisionCell(precisionCells([3], 'unsupported_precision'), 9)).toEqual({
      status: 'blocked',
      requestedResolution: 9,
      supportStatus: 'not_configured',
      reason: 'H3 resolution 9 is not declared by the record geography artifact.',
    })
  })
})

function precisionCells(
  supportedResolutions: readonly number[],
  unsupportedStatus: string,
): readonly RecordPrecisionCell[] {
  return [3, 5, 7].map((spatialResolution) => {
    const supported = supportedResolutions.includes(spatialResolution)
    return Object.freeze({
      spatialResolution,
      spatialCellId: supported ? `${spatialResolution}0abcdefabcdef` : null,
      supported,
      supportStatus: supported ? 'supported' : unsupportedStatus,
    })
  })
}
