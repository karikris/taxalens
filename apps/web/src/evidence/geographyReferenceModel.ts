import type { ReplayEvidence } from '../data/evidenceFacade'
import type { DiscoveryProvenanceResult } from './discoveryProvenance'

export interface GeographyReferenceModel {
  readonly inspectionStatus: 'idle' | 'running' | 'error' | 'ready'
  readonly coordinate:
    | { readonly status: 'unavailable'; readonly reason: string }
    | {
        readonly status: 'metadata'
        readonly latitude: number
        readonly longitude: number
        readonly quality: string
        readonly accuracyLevel: number
        readonly source: string
        readonly warning: string | null
        readonly mapXPercent: number
        readonly mapYPercent: number
      }
  readonly uncertainty: {
    readonly status: 'unavailable'
    readonly reason: string
  }
  readonly cluster:
    | { readonly status: 'unavailable'; readonly reason: string }
    | {
        readonly status: 'metadata'
        readonly id: string
        readonly assignmentMethod: string
        readonly distanceToMedoidKm: number
        readonly memberImageCount: number
        readonly memberCellCount: number
        readonly radiusP95Km: number
        readonly outlier: boolean
      }
  readonly fallback: {
    readonly selectedRecordStatus: 'pending' | 'not_used' | 'used'
    readonly selectedScope: string | null
    readonly summaryFallbackClusterCount: number
  }
  readonly targetEvidence: {
    readonly scientificName: string
    readonly acceptedTaxonKey: string
    readonly status: 'unavailable' | 'metadata'
    readonly reason: string
  }
  readonly competitorEvidence: {
    readonly candidateCount: number
    readonly status: 'unavailable'
    readonly reason: string
  }
  readonly shortfalls: ReplayEvidence['geographyReference']['reference']
  readonly verification: {
    readonly geography: string
    readonly readiness: string
    readonly shortfalls: string
    readonly scientificClaimAllowed: false
  }
  readonly rights: ReplayEvidence['geographyReference']['sourceRights']
  readonly sourceId: string | null
}

export function buildGeographyReferenceModel(
  replay: ReplayEvidence,
  result: DiscoveryProvenanceResult | null,
  inspectionStatus: GeographyReferenceModel['inspectionStatus'],
): GeographyReferenceModel {
  if (
    replay.geographyReference.geography.payloadRowsAvailable ||
    replay.geographyReference.reference.humanVerifiedSourceMediaCount !== 0 ||
    replay.geographyReference.sourceRights.includedImageCount !== 0 ||
    replay.geographyReference.sourceRights.licensedImageCount !== 0 ||
    replay.scientificClaimAllowed
  ) {
    throw new Error('Geography/reference context exceeds the verified metadata-only boundary')
  }
  if ((inspectionStatus === 'ready') !== (result !== null)) {
    throw new Error('Ready geography inspection requires one verified result')
  }
  if (
    result !== null &&
    (!result.cluster.candidateDistributionOnly ||
      result.cluster.targetAcceptedTaxonKey !== replay.target.acceptedTaxonKey ||
      result.scientificClaimAllowed)
  ) {
    throw new Error('Geography result cannot support the selected target candidate context')
  }

  const inspectionReason =
    inspectionStatus === 'running'
      ? 'Local geography join is running.'
      : inspectionStatus === 'error'
        ? 'Local geography inspection failed; no coordinate is displayed.'
        : 'Run the verified discovery inspection above to load one candidate coordinate.'
  const coordinate =
    result === null
      ? Object.freeze({ status: 'unavailable' as const, reason: inspectionReason })
      : Object.freeze({
          status: 'metadata' as const,
          latitude: result.coordinate.latitude,
          longitude: result.coordinate.longitude,
          quality: result.coordinateQuality,
          accuracyLevel: result.coordinate.accuracyLevel,
          source: result.coordinate.source,
          warning: result.coordinate.warning,
          mapXPercent: ((result.coordinate.longitude + 180) / 360) * 100,
          mapYPercent: ((90 - result.coordinate.latitude) / 180) * 100,
        })
  const cluster =
    result === null
      ? Object.freeze({ status: 'unavailable' as const, reason: inspectionReason })
      : Object.freeze({
          status: 'metadata' as const,
          id: result.cluster.id,
          assignmentMethod: result.cluster.assignmentMethod,
          distanceToMedoidKm: result.cluster.distanceToMedoidKm,
          memberImageCount: result.cluster.memberImageCount,
          memberCellCount: result.cluster.memberCellCount,
          radiusP95Km: result.cluster.radiusP95Km,
          outlier: result.cluster.outlier,
        })

  return Object.freeze({
    inspectionStatus,
    coordinate,
    uncertainty: Object.freeze({
      status: 'unavailable',
      reason:
        'Metric coordinate uncertainty is not present. Flickr accuracy level is source metadata, not metres.',
    }),
    cluster,
    fallback: Object.freeze({
      selectedRecordStatus:
        result === null ? 'pending' : result.cluster.fallbackScope === null ? 'not_used' : 'used',
      selectedScope: result?.cluster.fallbackScope ?? null,
      summaryFallbackClusterCount:
        replay.geographyReference.geography.fallbackClusterCount,
    }),
    targetEvidence: Object.freeze({
      scientificName: replay.target.scientificName,
      acceptedTaxonKey: replay.target.acceptedTaxonKey,
      status: result === null ? 'unavailable' : 'metadata',
      reason:
        result === null
          ? inspectionReason
          : `${result.cluster.memberImageCount.toLocaleString('en-US')} source candidates share the assigned cluster; they are not verified occurrences or reference images.`,
    }),
    competitorEvidence: Object.freeze({
      candidateCount: replay.mission.candidatePolicy.candidateCount,
      status: 'unavailable',
      reason:
        'Competitor planning hypotheses have no imported coordinate, human-verified reference image, or visual score.',
    }),
    shortfalls: replay.geographyReference.reference,
    verification: Object.freeze({
      geography: replay.geographyReference.geography.verificationStatus,
      readiness: replay.geographyReference.reference.readinessVerificationStatus,
      shortfalls: replay.geographyReference.reference.shortfallVerificationStatus,
      scientificClaimAllowed: false,
    }),
    rights: replay.geographyReference.sourceRights,
    sourceId: result?.sourceId ?? null,
  })
}
