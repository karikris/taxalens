import type { GeographicReviewProjection } from './geographicReviewProjection'
import type {
  PublicGeographicImpactMapData,
} from './publicGeographicImpactMapData'

export function applyLocalGeographicReviewProjection(
  data: PublicGeographicImpactMapData,
  projection: GeographicReviewProjection,
): PublicGeographicImpactMapData {
  const reviewByCell = new Map(
    projection.cells
      .filter(({ spatialResolution }) => spatialResolution === data.spatialResolution)
      .map((cell) => [cell.spatialCellId, cell]),
  )
  const localReviewEventCount = projection.items.reduce(
    (total, item) => total + item.effectiveReviewCount,
    0,
  )
  const cells = data.cells.map((cell) => {
    const review = reviewByCell.get(cell.spatialCellId)
    if (review === undefined) return cell
    const reviewedPositiveCount = replaceCommittedCount(
      cell.reviewedPositiveCount,
      review.committedReviewedPositiveCount,
      review.reviewedPositiveCount,
      'reviewed positive',
    )
    const reviewedNegativeCount = replaceCommittedCount(
      cell.reviewedNegativeCount,
      review.committedReviewedNegativeCount,
      review.reviewedNegativeCount,
      'reviewed negative',
    )
    const uncertainCount = replaceCommittedCount(
      cell.uncertainCount,
      review.committedUncertainCount,
      review.uncertainCount,
      'uncertain',
    )
    const pendingCount = replaceCommittedCount(
      cell.pendingCount,
      review.committedPendingCount,
      review.pendingCount,
      'pending',
    )
    const mediaFailureCount = replaceCommittedCount(
      cell.mediaFailureCount,
      review.committedMediaFailureCount,
      review.mediaFailureCount,
      'media failure',
    )
    const skippedCount = replaceCommittedCount(
      cell.skippedCount,
      review.committedSkippedCount,
      review.skippedCount,
      'skipped',
    )
    if (
      reviewedPositiveCount +
        reviewedNegativeCount +
        uncertainCount +
        pendingCount +
        mediaFailureCount +
        skippedCount >
      cell.flickrCandidateCount
    ) {
      throw new Error('local geographic review projection exceeds Flickr candidate count')
    }
    return Object.freeze({
      ...cell,
      reviewedPositiveCount,
      reviewedNegativeCount,
      uncertainCount,
      pendingCount,
      mediaFailureCount,
      skippedCount,
      reviewedAdditionalCell:
        cell.candidateOnlyCell && reviewedPositiveCount > 0,
      // A local ledger never changes retained occurrence-release evidence.
      releaseReadyCount: cell.releaseReadyCount,
      releaseReadyAdditionalCell: cell.releaseReadyAdditionalCell,
    })
  })
  return Object.freeze({
    ...data,
    cells: Object.freeze(cells),
    localReviewOverlayApplied: true as const,
    localReviewEventCount,
  })
}

function replaceCommittedCount(
  materializedCount: number,
  committedCampaignCount: number,
  localCampaignCount: number,
  label: string,
): number {
  if (materializedCount < committedCampaignCount) {
    throw new Error(`committed ${label} campaign count exceeds the materialized cell`)
  }
  return materializedCount - committedCampaignCount + localCampaignCount
}
