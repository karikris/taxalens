import { describe, expect, it } from 'vitest'

import { applyLocalGeographicReviewProjection } from './geographicReviewOverlay'
import type { GeographicReviewProjection } from './geographicReviewProjection'
import type {
  PublicGeographicImpactMapCell,
  PublicGeographicImpactMapData,
} from './publicGeographicImpactMapData'

describe('local geographic review overlay', () => {
  it('replaces committed campaign state while preserving non-campaign pending candidates', () => {
    const result = applyLocalGeographicReviewProjection(data(cell()), projection())

    expect(result.cells[0]).toMatchObject({
      flickrCandidateCount: 10,
      pendingCount: 8,
      reviewedPositiveCount: 1,
      mediaFailureCount: 1,
      reviewedAdditionalCell: true,
      releaseReadyCount: 0,
      releaseReadyAdditionalCell: false,
    })
    expect(result).toMatchObject({
      localReviewOverlayApplied: true,
      localReviewEventCount: 2,
      scientificClaimAllowed: false,
    })
  })

  it('does not promote a local positive review over retained release evidence', () => {
    const source = cell({
      baselineRangeInferenceEligibleCount: 3,
      candidateOnlyCell: false,
      releaseReadyCount: 0,
      releaseReadyAdditionalCell: false,
    })
    const result = applyLocalGeographicReviewProjection(data(source), projection())

    expect(result.cells[0]).toMatchObject({
      reviewedPositiveCount: 1,
      reviewedAdditionalCell: false,
      releaseReadyCount: 0,
      releaseReadyAdditionalCell: false,
    })
  })

  it('fails closed when committed state does not reconcile with the materialized cell', () => {
    const inconsistent = projection({
      committedReviewedPositiveCount: 1,
      committedPendingCount: 1,
    })
    expect(() =>
      applyLocalGeographicReviewProjection(data(cell()), inconsistent),
    ).toThrow('committed reviewed positive campaign count exceeds')
  })
})

function projection(
  overrides: Partial<GeographicReviewProjection['cells'][number]> = {},
): GeographicReviewProjection {
  return {
    items: [reviewItem('item-a'), reviewItem('item-b')],
    cells: [
      {
        spatialResolution: 3,
        spatialCellId: 'cell-a',
        campaignItemCount: 2,
        assignedCount: 2,
        decisivelyReviewedCount: 1,
        reviewedPositiveCount: 1,
        reviewedNegativeCount: 0,
        uncertainCount: 0,
        pendingCount: 0,
        mediaFailureCount: 1,
        skippedCount: 0,
        qualityValidReviewedCount: 0,
        populationQualityEligibleCount: 0,
        targetedFailureDiscoveryReviewedCount: 0,
        releaseReadyCount: 0,
        committedReviewedPositiveCount: 0,
        committedReviewedNegativeCount: 0,
        committedUncertainCount: 0,
        committedPendingCount: 2,
        committedMediaFailureCount: 0,
        committedSkippedCount: 0,
        scientificClaimAllowed: false,
        ...overrides,
      },
    ],
    scientificClaimAllowed: false,
  }
}

function reviewItem(
  itemId: string,
): GeographicReviewProjection['items'][number] {
  return {
    campaignId: 'campaign:test',
    itemId,
    state: 'reviewed_target_positive',
    consensusStatus: 'complete_agreement',
    consensusOutcome: 'yes',
    effectiveReviewCount: 1,
    decisiveReviewCount: 1,
    reviewerAssignmentCount: 1,
    assigned: true,
    decisivelyReviewed: true,
    humanSupported: true,
    qualitySnapshotId: null,
    qualityValidReviewed: false,
    populationQualityEligible: false,
    releaseReady: false,
    samplingPurpose: 'quality_estimation',
    samplingRepresentative: true,
    qualityEstimationAllowed: true,
    scientificClaimAllowed: false,
  }
}

function data(cellValue: PublicGeographicImpactMapCell): PublicGeographicImpactMapData {
  return {
    cells: [cellValue],
    spatialResolution: 3,
    scopeId: 'global',
    source: {} as PublicGeographicImpactMapData['source'],
    scientificClaimAllowed: false,
  }
}

function cell(
  overrides: Partial<PublicGeographicImpactMapCell> = {},
): PublicGeographicImpactMapCell {
  return {
    spatialResolution: 3,
    spatialCellId: 'cell-a',
    continent: 'Asia',
    countryCode: 'IN',
    country: 'India',
    admin1: null,
    latitude: 0,
    longitude: 0,
    baselineUnionCount: 0,
    baselineRangeInferenceEligibleCount: 0,
    baselineExcludedOccurrenceCount: 0,
    gbifOnlyCount: 0,
    inaturalistOriginThroughGbifCount: 0,
    directInaturalistDeltaStatus: 'unavailable',
    directInaturalistDeltaCount: null,
    duplicatesRemovedCount: 0,
    unresolvedProviderDuplicateGroupCount: 0,
    flickrCandidateCount: 10,
    flickrVisuallyEligibleCount: 10,
    reviewedPositiveCount: 0,
    reviewedNegativeCount: 0,
    uncertainCount: 0,
    pendingCount: 10,
    mediaFailureCount: 0,
    skippedCount: 0,
    releaseReadyCount: 0,
    baselineOnlyCell: false,
    matchedCell: false,
    candidateOnlyCell: true,
    reviewedAdditionalCell: false,
    releaseReadyAdditionalCell: false,
    nearestBaselineDistanceKm: 10,
    dataDeficientState: 'data_deficient',
    latestBaselineEventDate: null,
    latestFlickrCandidateDate: null,
    latestReviewedPositiveDate: null,
    latestReleaseReadyDate: null,
    ...overrides,
  }
}
