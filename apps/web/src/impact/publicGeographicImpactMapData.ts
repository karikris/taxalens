import type {
  CountryHierarchyNode,
  GeographicImpactManifestDocument,
} from '../../../../packages/contracts/src/geographic_impact_contract'
import type { TaxaLensProjectFacade } from '../data/projectFacade'
import type {
  GeographicImpactBrowserCell,
  GeographicImpactBrowserResult,
} from './geographicImpactAnalytics'
import { loadGeographicImpactProjectContext } from './geographicImpactSources'

export interface PublicGeographicImpactMapSource {
  readonly schemaVersion: string
  readonly artifactPath: string
  readonly artifactSha256: string
  readonly artifactBytes: number
  readonly artifactRows: number
  readonly sourceRepository: string
  readonly sourceCommit: string
  readonly manifestId: string
  readonly buildId: string
  readonly registryVersion: string
  readonly countryHierarchyId: string
  readonly providerUnionPolicyVersion: string
  readonly releasePolicyVersion: string
  readonly spatialResolutions: readonly number[]
  readonly sourceCommits: GeographicImpactManifestDocument['source_commits']
  readonly artifacts: GeographicImpactManifestDocument['artifacts']
  readonly projectId: string
  readonly runId: string
  readonly acceptedTaxonKey: string
  readonly scientificName: string
  readonly baselineSnapshotId: string
  readonly flickrSnapshotId: string
  readonly directInaturalistDeltaStatus: 'available' | 'unavailable'
  readonly reviewedPositiveCount: number
  readonly reviewedNegativeCount: number
  readonly uncertainCount: number
  readonly releaseReadyCount: number
}

export type PublicGeographicImpactMapCell = GeographicImpactBrowserCell

export interface PublicGeographicImpactMapData {
  readonly cells: readonly PublicGeographicImpactMapCell[]
  readonly spatialResolution: number
  readonly scopeId: string
  readonly source: PublicGeographicImpactMapSource
  readonly scientificClaimAllowed: false
  readonly localReviewOverlayApplied?: true
  readonly localReviewEventCount?: number
}

export function geographicMapResolutionForScope(
  scope: Pick<CountryHierarchyNode, 'scope_level'>,
): 3 | 5 | 7 {
  switch (scope.scope_level) {
    case 'global':
      return 3
    case 'continent':
      return 5
    case 'country':
    case 'admin1':
      return 7
  }
}

/** Adapt the production full-outer query result to the map/table/export view model. */
export function buildPublicGeographicImpactMapData(
  project: TaxaLensProjectFacade,
  result: GeographicImpactBrowserResult,
): PublicGeographicImpactMapData {
  const context = loadGeographicImpactProjectContext(project)
  const input = result.input
  if (
    Object.entries(context.evidenceScope).some(
      ([key, value]) =>
        input.evidenceScope[key as keyof typeof input.evidenceScope] !== value,
    )
  ) {
    throw new Error('Geographic Impact query result differs from its verified project identity')
  }
  const descriptor = context.impactCellsArtifact.descriptor
  const rowCount = descriptor.record_count
  const schemaVersion = descriptor.schema_version
  if (rowCount === null || schemaVersion === null) {
    throw new Error('Geographic Impact cell artifact has incomplete verified metadata')
  }
  return Object.freeze({
    cells: result.cells,
    spatialResolution: input.spatialResolution,
    scopeId: input.geographicScope.id,
    source: Object.freeze({
      schemaVersion,
      artifactPath: descriptor.path,
      artifactSha256: descriptor.sha256,
      artifactBytes: descriptor.bytes,
      artifactRows: rowCount,
      sourceRepository: descriptor.source_repository,
      sourceCommit: descriptor.source_commit,
      manifestId: context.manifest.manifest_id,
      buildId: context.manifest.geographic_impact_build_id,
      registryVersion: context.manifest.registry_version,
      countryHierarchyId: context.manifest.country_hierarchy_id,
      providerUnionPolicyVersion: context.manifest.provider_union_policy_version,
      releasePolicyVersion: context.manifest.release_policy_version,
      spatialResolutions: context.manifest.spatial_resolutions,
      sourceCommits: context.manifest.source_commits,
      artifacts: context.manifest.artifacts,
      projectId: context.manifest.project_id,
      runId: context.manifest.run_id,
      acceptedTaxonKey: context.manifest.accepted_taxon_key,
      scientificName: context.manifest.scientific_name,
      baselineSnapshotId: context.manifest.baseline_snapshot_id,
      flickrSnapshotId: context.manifest.flickr_snapshot_id,
      directInaturalistDeltaStatus: context.manifest.direct_inaturalist_delta_status,
      reviewedPositiveCount: context.manifest.reviewed_positive_count,
      reviewedNegativeCount: context.manifest.reviewed_negative_count,
      uncertainCount: context.manifest.uncertain_count,
      releaseReadyCount: context.manifest.release_ready_count,
    }),
    scientificClaimAllowed: false as const,
  })
}

/** Return a defensive copy of the already checksum-verified source Parquet. */
export function verifiedGeographicImpactParquetBytes(
  project: TaxaLensProjectFacade,
): Uint8Array<ArrayBuffer> {
  return loadGeographicImpactProjectContext(project).impactCellsArtifact.bytes.slice()
}
