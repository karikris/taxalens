import type { GeographicImpactBrowserCell } from './geographicImpactAnalytics'
import {
  createGeographicBubbleScale,
  type GeographicBubbleScale,
} from './geographicBubbleScale'
import type { GeographicImpactMetric } from './geographicImpactQuery'

export const GEOGRAPHIC_IMPACT_MAX_MAP_FEATURES = 5_000

export interface GeographicImpactMapFeatureProperties {
  readonly spatialCellId: string
  readonly spatialResolution: number
  readonly baselineCount: number
  readonly baselineRadius: number
  readonly flickrCandidateCount: number
  readonly flickrRadius: number
  readonly reviewedPositiveCount: number
  readonly reviewedNegativeCount: number
  readonly uncertainCount: number
  readonly pendingCount: number
  readonly mediaFailureCount: number
  readonly skippedCount: number
  readonly releaseReadyCount: number
  readonly baselineOnlyCell: boolean
  readonly matchedCell: boolean
  readonly candidateOnlyCell: boolean
  readonly reviewedAdditionalCell: boolean
  readonly releaseReadyAdditionalCell: boolean
  readonly nearestBaselineDistanceKm: number | null
  readonly dataDeficientState: GeographicImpactBrowserCell['dataDeficientState']
}

export interface GeographicImpactMapFeature {
  readonly type: 'Feature'
  readonly id: string
  readonly geometry: {
    readonly type: 'Point'
    readonly coordinates: readonly [number, number]
  }
  readonly properties: GeographicImpactMapFeatureProperties
}

export interface GeographicImpactMapFeatureCollection {
  readonly type: 'FeatureCollection'
  readonly features: readonly GeographicImpactMapFeature[]
}

export interface BoundedGeographicImpactFeatures {
  readonly collection: GeographicImpactMapFeatureCollection
  readonly metric: GeographicImpactMetric
  readonly maximumFeatureCount: number
  readonly sourceCellCount: number
  readonly emittedFeatureCount: number
  readonly omittedFeatureCount: number
  readonly truncated: boolean
  readonly bubbleScale: GeographicBubbleScale
}

/** Project preaggregated centroids only; raw occurrence/photo rows never enter GeoJSON. */
export function buildBoundedGeographicImpactFeatures(
  cells: readonly GeographicImpactBrowserCell[],
  metric: GeographicImpactMetric,
  maximumFeatureCount = GEOGRAPHIC_IMPACT_MAX_MAP_FEATURES,
): BoundedGeographicImpactFeatures {
  if (!Number.isSafeInteger(maximumFeatureCount) || maximumFeatureCount < 1) {
    throw new Error('maximumFeatureCount must be a positive safe integer')
  }
  const selected = [...cells]
    .sort((left, right) => {
      const metricDifference = metricValue(right, metric) - metricValue(left, metric)
      if (metricDifference !== 0) return metricDifference
      const countDifference =
        Math.max(
          right.baselineRangeInferenceEligibleCount,
          right.flickrCandidateCount,
        ) -
        Math.max(left.baselineRangeInferenceEligibleCount, left.flickrCandidateCount)
      if (countDifference !== 0) return countDifference
      return left.spatialCellId.localeCompare(right.spatialCellId)
    })
    .slice(0, maximumFeatureCount)
  const bubbleScale = createGeographicBubbleScale({
    baselineCounts: cells.map(({ baselineRangeInferenceEligibleCount }) =>
      baselineRangeInferenceEligibleCount
    ),
    flickrCounts: cells.map(({ flickrCandidateCount }) => flickrCandidateCount),
  })
  const features = selected.map((cell) =>
    Object.freeze({
      type: 'Feature' as const,
      id: cell.spatialCellId,
      geometry: Object.freeze({
        type: 'Point' as const,
        coordinates: Object.freeze([cell.longitude, cell.latitude] as const),
      }),
      properties: Object.freeze({
        spatialCellId: cell.spatialCellId,
        spatialResolution: cell.spatialResolution,
        baselineCount: cell.baselineRangeInferenceEligibleCount,
        baselineRadius: bubbleScale.radiusForCount(
          cell.baselineRangeInferenceEligibleCount,
        ),
        flickrCandidateCount: cell.flickrCandidateCount,
        flickrRadius: bubbleScale.radiusForCount(cell.flickrCandidateCount),
        reviewedPositiveCount: cell.reviewedPositiveCount,
        reviewedNegativeCount: cell.reviewedNegativeCount,
        uncertainCount: cell.uncertainCount,
        pendingCount: cell.pendingCount,
        mediaFailureCount: cell.mediaFailureCount,
        skippedCount: cell.skippedCount,
        releaseReadyCount: cell.releaseReadyCount,
        baselineOnlyCell: cell.baselineOnlyCell,
        matchedCell: cell.matchedCell,
        candidateOnlyCell: cell.candidateOnlyCell,
        reviewedAdditionalCell: cell.reviewedAdditionalCell,
        releaseReadyAdditionalCell: cell.releaseReadyAdditionalCell,
        nearestBaselineDistanceKm: cell.nearestBaselineDistanceKm,
        dataDeficientState: cell.dataDeficientState,
      }),
    }),
  )
  const omittedFeatureCount = cells.length - features.length
  return Object.freeze({
    collection: Object.freeze({
      type: 'FeatureCollection' as const,
      features: Object.freeze(features),
    }),
    metric,
    maximumFeatureCount,
    sourceCellCount: cells.length,
    emittedFeatureCount: features.length,
    omittedFeatureCount,
    truncated: omittedFeatureCount > 0,
    bubbleScale,
  })
}

function metricValue(cell: GeographicImpactBrowserCell, metric: GeographicImpactMetric): number {
  switch (metric) {
    case 'record_count':
      return Math.max(
        cell.baselineRangeInferenceEligibleCount,
        cell.flickrCandidateCount,
      )
    case 'candidate_only_cells':
      return cell.candidateOnlyCell ? cell.flickrCandidateCount : 0
    case 'reviewed_additional_cells':
      return cell.reviewedAdditionalCell ? cell.reviewedPositiveCount : 0
    case 'release_ready_additional_cells':
      return cell.releaseReadyAdditionalCell ? cell.releaseReadyCount : 0
    case 'range_edge_distance':
      return cell.nearestBaselineDistanceKm ?? 0
    case 'review_backlog':
      return cell.pendingCount
  }
}
