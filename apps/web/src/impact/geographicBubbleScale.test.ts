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

  it('preserves the square-root count relationship above the visibility floor', () => {
    const scale = createGeographicBubbleScale(
      {
        baselineCounts: [100, 10_000],
        flickrCounts: [2_500],
      },
      { minimumVisibleRadius: 1, maximumRadius: 100 },
    )

    const smallRadius = scale.radiusForCount(100)
    const mediumRadius = scale.radiusForCount(2_500)
    const maximumRadius = scale.radiusForCount(10_000)
    expect(smallRadius).toBe(10)
    expect(mediumRadius).toBe(50)
    expect(maximumRadius).toBe(100)
    expect((mediumRadius / maximumRadius) ** 2).toBeCloseTo(2_500 / 10_000)
    expect((smallRadius / maximumRadius) ** 2).toBeCloseTo(100 / 10_000)
  })

  it('uses one domain regardless of which evidence layer contains the maximum', () => {
    const baselineMaximum = createGeographicBubbleScale({
      baselineCounts: [64],
      flickrCounts: [4],
    })
    const flickrMaximum = createGeographicBubbleScale({
      baselineCounts: [4],
      flickrCounts: [64],
    })

    expect(baselineMaximum.domainMaximum).toBe(64)
    expect(flickrMaximum.domainMaximum).toBe(64)
    expect(baselineMaximum.legendValues).toEqual([1, 8, 64])
    expect(flickrMaximum.legendValues).toEqual([1, 8, 64])
    expect(baselineMaximum.radiusForCount(4)).toBe(
      flickrMaximum.radiusForCount(4),
    )
  })

  it('documents and applies the visibility floor only to positive counts', () => {
    const scale = createGeographicBubbleScale(
      { baselineCounts: [0, 1_000_000], flickrCounts: [1] },
      { minimumVisibleRadius: 4, maximumRadius: 32 },
    )

    expect(scale.radiusForCount(0)).toBe(0)
    expect(scale.radiusForCount(1)).toBe(4)
    expect(scale.zeroCountBehavior).toBe('hidden')
    expect(GEOGRAPHIC_BUBBLE_SCALE_CAPTION).toContain(
      'exact counts appear in the tooltip',
    )
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
    expect(() =>
      createGeographicBubbleScale(
        { baselineCounts: [1], flickrCounts: [] },
        { maximumRadius: Number.POSITIVE_INFINITY },
      ),
    ).toThrow('maximumRadius must be a positive finite number')
  })
})
