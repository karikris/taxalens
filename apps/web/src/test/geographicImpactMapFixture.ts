import type { GeographicImpactManifestDocument } from '../../../../packages/contracts/src/geographic_impact_contract'
import impactManifestValue from '../../../../demo/source/biominer_phase14/geographic_impact/geographic_impact_manifest.json'
import type { PublicGeographicImpactMapSource } from '../impact/publicGeographicImpactMapData'

const impactManifest = impactManifestValue as unknown as GeographicImpactManifestDocument

export const TEST_GEOGRAPHIC_IMPACT_EVIDENCE_SCOPE = Object.freeze({
  projectId: impactManifest.project_id,
  runId: impactManifest.run_id,
  targetAcceptedTaxonKey: impactManifest.accepted_taxon_key,
  baselineSnapshotId: impactManifest.baseline_snapshot_id,
  flickrSnapshotId: impactManifest.flickr_snapshot_id,
})

export const TEST_GEOGRAPHIC_IMPACT_MAP_SOURCE: PublicGeographicImpactMapSource = Object.freeze({
  schemaVersion: 'taxalens-geographic-impact-cell:v1.0.0',
  artifactPath: 'demo/source/geographic_impact_cells.parquet',
  artifactSha256: 'a02927ffbb4dc09fca582c61e6ceab51af6d12f8998cf0f7762ebfe26a4ea1c9',
  artifactBytes: 639_681,
  artifactRows: 20_237,
  sourceRepository: 'karikris/TaxaLens',
  sourceCommit: 'cdee00c9e16e349d722733cd951709abce8d0fee',
  manifestId: impactManifest.manifest_id,
  buildId: impactManifest.geographic_impact_build_id,
  registryVersion: impactManifest.registry_version,
  countryHierarchyId: impactManifest.country_hierarchy_id,
  providerUnionPolicyVersion: impactManifest.provider_union_policy_version,
  releasePolicyVersion: impactManifest.release_policy_version,
  spatialResolutions: impactManifest.spatial_resolutions,
  sourceCommits: impactManifest.source_commits,
  artifacts: impactManifest.artifacts,
  projectId: impactManifest.project_id,
  runId: impactManifest.run_id,
  acceptedTaxonKey: impactManifest.accepted_taxon_key,
  scientificName: impactManifest.scientific_name,
  baselineSnapshotId: impactManifest.baseline_snapshot_id,
  flickrSnapshotId: impactManifest.flickr_snapshot_id,
  directInaturalistDeltaStatus: impactManifest.direct_inaturalist_delta_status,
  reviewedPositiveCount: impactManifest.reviewed_positive_count,
  reviewedNegativeCount: impactManifest.reviewed_negative_count,
  uncertainCount: impactManifest.uncertain_count,
  releaseReadyCount: impactManifest.release_ready_count,
})
