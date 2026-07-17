import { describe, expect, it, vi } from 'vitest'

import { TAXALENS_GEOGRAPHIC_SCOPE_INDEX } from './geographicScope'
import { moveMapToGeographicScope } from './geographicMapCamera'

describe('geographic map camera', () => {
  it('uses a non-singular jump for the full Global scope', () => {
    const camera = fakeCamera()

    expect(moveMapToGeographicScope(camera, scope('global'))).toBe('global_jump')
    expect(camera.jumpTo).toHaveBeenCalledWith({
      bearing: 0,
      center: [0, 0],
      pitch: 0,
      zoom: 0,
    })
    expect(camera.fitBounds).not.toHaveBeenCalled()
  })

  it('fits ordinary committed bounds with a non-essential transition', () => {
    const camera = fakeCamera()

    expect(moveMapToGeographicScope(camera, scope('country:IN'))).toBe('bounded_fit')
    expect(camera.fitBounds).toHaveBeenCalledWith(
      [
        [68.176645, 7.965535],
        [97.402561, 35.49401],
      ],
      expect.objectContaining({ essential: false, maxZoom: 7, padding: 36 }),
    )
  })

  it('centers full-span non-global geometry without fitting exact 360-degree bounds', () => {
    const camera = fakeCamera()

    expect(moveMapToGeographicScope(camera, scope('continent:oceania')))
      .toBe('full_span_center')
    expect(camera.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({ essential: false, zoom: 1.25 }),
    )
    expect(camera.fitBounds).not.toHaveBeenCalled()
  })
})

function scope(scopeId: string) {
  const node = TAXALENS_GEOGRAPHIC_SCOPE_INDEX.byId.get(scopeId)
  if (node === undefined) throw new Error(`Test scope is missing: ${scopeId}`)
  return node
}

function fakeCamera() {
  return {
    fitBounds: vi.fn(),
    flyTo: vi.fn(),
    jumpTo: vi.fn(),
  }
}
