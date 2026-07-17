import { describe, expect, it, vi } from 'vitest'

import {
  createGeographicEvidenceImage,
  registerGeographicEvidenceImages,
  TAXALENS_EXCLUDED_EVIDENCE_IMAGE_ID,
  TAXALENS_UNCERTAIN_EVIDENCE_IMAGE_ID,
  type GeographicEvidenceImage,
} from './geographicEvidenceIcons'

describe('local geographic evidence images', () => {
  it('creates transparent-background dashed and excluded amber shapes', () => {
    const uncertain = createGeographicEvidenceImage('uncertain')
    const excluded = createGeographicEvidenceImage('excluded')

    expect(uncertain).toMatchObject({ width: 64, height: 64 })
    expect(excluded).toMatchObject({ width: 64, height: 64 })
    expect(alphaCount(uncertain.data)).toBeGreaterThan(100)
    expect(alphaCount(excluded.data)).toBeGreaterThan(alphaCount(uncertain.data))
    expect(alphaAt(uncertain.data, 32, 32)).toBe(0)
    expect(alphaAt(excluded.data, 32, 32)).toBe(255)
    expect(alphaAt(uncertain.data, 32, 4)).not.toBe(
      alphaAt(uncertain.data, 24, 5),
    )
  })

  it('registers each generated image once at two device pixels per map pixel', () => {
    const known = new Set<string>()
    const addImage = vi.fn(
      (
        id: string,
        _image: GeographicEvidenceImage,
        _options: { readonly pixelRatio: number },
      ) => {
        known.add(id)
      },
    )
    const target = {
      hasImage: (id: string) => known.has(id),
      addImage,
    }

    registerGeographicEvidenceImages(target)
    registerGeographicEvidenceImages(target)

    expect(addImage).toHaveBeenCalledTimes(2)
    expect(addImage.mock.calls.map(([id]) => id)).toEqual([
      TAXALENS_UNCERTAIN_EVIDENCE_IMAGE_ID,
      TAXALENS_EXCLUDED_EVIDENCE_IMAGE_ID,
    ])
    expect(addImage.mock.calls.every(([, , options]) => options.pixelRatio === 2))
      .toBe(true)
  })
})

function alphaCount(data: Uint8Array): number {
  return Array.from({ length: data.length / 4 }, (_, index) => data[index * 4 + 3])
    .filter((alpha) => alpha !== 0).length
}

function alphaAt(data: Uint8Array, x: number, y: number): number | undefined {
  return data[(y * 64 + x) * 4 + 3]
}
