export const GEOGRAPHIC_BUBBLE_SCALE_MODES = [
  'sqrt_absolute',
  'log_absolute',
] as const

export type GeographicBubbleScaleMode = (typeof GEOGRAPHIC_BUBBLE_SCALE_MODES)[number]

export const GEOGRAPHIC_BUBBLE_SCALE_CAPTION =
  'Bubble radius uses a square-root count scale; exact counts appear in the tooltip.' as const

export interface GeographicBubbleScaleInput {
  readonly baselineCounts: readonly number[]
  readonly flickrCounts: readonly number[]
}

export interface GeographicBubbleScaleOptions {
  readonly mode?: GeographicBubbleScaleMode
  readonly minimumVisibleRadius?: number
  readonly maximumRadius?: number
}

export interface GeographicBubbleScale {
  readonly domainMinimum: 0
  readonly domainMaximum: number
  readonly scaleMode: GeographicBubbleScaleMode
  readonly minimumVisibleRadius: number
  readonly maximumRadius: number
  readonly legendValues: readonly number[]
  readonly zeroCountBehavior: 'hidden'
  readonly radiusForCount: (count: number) => number
}

const DEFAULT_MINIMUM_VISIBLE_RADIUS = 3
const DEFAULT_MAXIMUM_RADIUS = 28

/**
 * Build one absolute count scale shared by baseline and Flickr evidence.
 *
 * Zero is intentionally discontinuous from positive values: it is hidden while every
 * positive count receives the documented visibility floor.
 */
export function createGeographicBubbleScale(
  input: GeographicBubbleScaleInput,
  options: GeographicBubbleScaleOptions = {},
): GeographicBubbleScale {
  const scaleMode = options.mode ?? 'sqrt_absolute'
  if (!GEOGRAPHIC_BUBBLE_SCALE_MODES.includes(scaleMode)) {
    throw new Error('unsupported geographic bubble scale mode')
  }
  const minimumVisibleRadius =
    options.minimumVisibleRadius ?? DEFAULT_MINIMUM_VISIBLE_RADIUS
  const maximumRadius = options.maximumRadius ?? DEFAULT_MAXIMUM_RADIUS
  requirePositiveFinite(minimumVisibleRadius, 'minimumVisibleRadius')
  requirePositiveFinite(maximumRadius, 'maximumRadius')
  if (minimumVisibleRadius > maximumRadius) {
    throw new Error('minimumVisibleRadius must not exceed maximumRadius')
  }

  const counts = [...input.baselineCounts, ...input.flickrCounts]
  counts.forEach(requireCount)
  const domainMaximum = counts.reduce((maximum, count) => Math.max(maximum, count), 0)

  const radiusForCount = (count: number): number => {
    requireCount(count)
    if (count > domainMaximum) {
      throw new Error('bubble count exceeds the shared scale domain')
    }
    if (count === 0 || domainMaximum === 0) return 0
    const transformedRatio =
      scaleMode === 'sqrt_absolute'
        ? Math.sqrt(count / domainMaximum)
        : Math.log1p(count) / Math.log1p(domainMaximum)
    return Math.max(minimumVisibleRadius, maximumRadius * transformedRatio)
  }

  return Object.freeze({
    domainMinimum: 0 as const,
    domainMaximum,
    scaleMode,
    minimumVisibleRadius,
    maximumRadius,
    legendValues: Object.freeze(buildLegendValues(domainMaximum)),
    zeroCountBehavior: 'hidden' as const,
    radiusForCount,
  })
}

function buildLegendValues(domainMaximum: number): number[] {
  if (domainMaximum === 0) return []
  const geometricMiddle = Math.max(1, Math.round(Math.sqrt(domainMaximum)))
  return [...new Set([1, geometricMiddle, domainMaximum])]
    .filter((value) => value <= domainMaximum)
    .sort((left, right) => left - right)
}

function requireCount(count: number): void {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error('bubble counts must be non-negative safe integers')
  }
}

function requirePositiveFinite(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${field} must be a positive finite number`)
  }
}
