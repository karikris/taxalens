import { describe, expect, it } from 'vitest'

import {
  createGeographicBubbleScale,
  GEOGRAPHIC_BUBBLE_SCALE_CAPTION,
} from './geographicBubbleScale'

describe('geographic bubble scale', () => {
  it('uses one square-root absolute domain across baseline and Flickr counts', () => {
    const scale = createGeographicBubbleScale({
      baselineCounts: [0, 1, 25],
      flickrCounts: [4, 100],
    })

    expect(scale).toMatchObject({
      domainMinimum: 0,
      domainMaximum: 100,
      scaleMode: 'sqrt_absolute',
      minimumVisibleRadius: 3,
      maximumRadius: 28,
      legendValues: [1, 10, 100],
      zeroCountBehavior: 'hidden',
    })
    expect(scale.radiusForCount(0)).toBe(0)
    expect(scale.radiusForCount(1)).toBe(3)
    expect(scale.radiusForCount(25)).toBe(14)
    expect(scale.radiusForCount(100)).toBe(28)
    expect(GEOGRAPHIC_BUBBLE_SCALE_CAPTION).toBe(
      'Bubble radius uses a square-root count scale; exact counts appear in the tooltip.',
    )
  })

  it('keeps positive values visible and monotonic under an extreme shared domain', () => {
    const scale = createGeographicBubbleScale({
      baselineCounts: [1_000_000],
      flickrCounts: [1, 4, 100],
    })

    const radii = [1, 4, 100, 1_000_000].map(scale.radiusForCount)
    expect(radii[0]).toBe(3)
    expect(radii).toEqual([...radii].sort((left, right) => left - right))
    expect(radii[3]).toBe(28)
  })

  it('supports explicit log-absolute scaling without changing the count domain', () => {
    const scale = createGeographicBubbleScale(
      {
        baselineCounts: [0, 10_000],
        flickrCounts: [100],
      },
      { mode: 'log_absolute', minimumVisibleRadius: 2, maximumRadius: 30 },
    )

    expect(scale.scaleMode).toBe('log_absolute')
    expect(scale.domainMaximum).toBe(10_000)
    expect(scale.radiusForCount(100)).toBeCloseTo(
      (30 * Math.log1p(100)) / Math.log1p(10_000),
    )
    expect(scale.radiusForCount(10_000)).toBe(30)
  })

  it('exposes an empty domain when both evidence layers have no counts', () => {
    const scale = createGeographicBubbleScale({
      baselineCounts: [],
      flickrCounts: [0],
    })

    expect(scale.domainMaximum).toBe(0)
    expect(scale.legendValues).toEqual([])
    expect(scale.radiusForCount(0)).toBe(0)
  })

  it('rejects invalid inputs and out-of-domain values', () => {
    expect(() =>
      createGeographicBubbleScale({ baselineCounts: [-1], flickrCounts: [] }),
    ).toThrow('bubble counts must be non-negative safe integers')
    expect(() =>
      createGeographicBubbleScale(
        { baselineCounts: [1], flickrCounts: [] },
        { minimumVisibleRadius: 9, maximumRadius: 8 },
      ),
    ).toThrow('minimumVisibleRadius must not exceed maximumRadius')

    const scale = createGeographicBubbleScale({
      baselineCounts: [5],
      flickrCounts: [],
    })
    expect(() => scale.radiusForCount(6)).toThrow(
      'bubble count exceeds the shared scale domain',
    )
    expect(() => scale.radiusForCount(1.5)).toThrow(
      'bubble counts must be non-negative safe integers',
    )
  })
})
