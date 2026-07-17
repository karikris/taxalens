import {
  BASELINE_OCCURRENCE_UNION_SCHEMA_VERSION,
  BASELINE_PROVIDER_UNION_POLICY_VERSION,
  COUNTRY_HIERARCHY_SCHEMA_VERSION,
  GEOGRAPHIC_IMPACT_CELL_SCHEMA_VERSION,
  GEOGRAPHIC_IMPACT_MANIFEST_SCHEMA_VERSION,
  GEOGRAPHIC_IMPACT_SUMMARY_SCHEMA_VERSION,
  type CountryHierarchyDocument,
  type GeographicImpactArtifactEntry,
  type GeographicImpactManifestDocument,
} from '../../../../packages/contracts/src/geographic_impact_contract'
import {
  JUDGE_BUNDLE_SCHEMA_VERSION,
  JUDGE_BUNDLE_SECTION_NAMES,
  type JudgeBundleArtifact,
  type JudgeBundleContract,
  type JudgeBundleSection,
  type JudgeBundleSectionName,
} from '../../../../packages/contracts/src/judge_bundle_contract'
import type { GeographicImpactQueryInput } from '../impact/geographicImpactQuery'
import {
  TaxaLensProjectFacade,
  type JudgeBundleMigrationResult,
  type JsonValue,
  type VerifiedProjectArtifact,
} from '../data/projectFacade'

export const syntheticGeographicQuery = Object.freeze({
  evidenceScope: Object.freeze({
    projectId: 'project:synthetic-geography',
    runId: 'run:synthetic-geography',
    targetAcceptedTaxonKey: 'gbif:synthetic-geography',
    baselineSnapshotId: 'baseline:synthetic-geography',
    flickrSnapshotId: 'flickr:synthetic-geography',
  }),
  spatialResolution: 5,
  geographicScope: Object.freeze({ level: 'country', id: 'country:AU' }),
  evidenceMode: 'comparison',
  metric: 'record_count',
} as const satisfies GeographicImpactQueryInput)

export interface SyntheticGeographicProjectOptions {
  readonly unionAvailable?: boolean
  readonly spatialResolutions?: readonly number[]
  readonly includeSelectedScope?: boolean
  readonly flickrManifestSha256?: string
}

export function createSyntheticGeographicProject(
  options: SyntheticGeographicProjectOptions = {},
): TaxaLensProjectFacade {
  const unionAvailable = options.unionAvailable ?? true
  const definitions = [
    definition(
      'spread-random-id',
      'baseline_geographic_spread',
      'taxon-geographic-spread-v1.0.0',
      'application/vnd.apache.parquet',
      3,
      6,
      'a',
      'karikris/BioMiner',
    ),
    ...(unionAvailable
      ? [
          definition(
            'union-random-id',
            'baseline_provider_union',
            BASELINE_OCCURRENCE_UNION_SCHEMA_VERSION,
            'application/vnd.apache.parquet',
            4,
            9,
            'b',
          ),
        ]
      : []),
    definition(
      'flickr-random-id',
      'flickr_geography',
      'taxalens-flickr-geography-verification:v1.0.0',
      'application/vnd.apache.parquet',
      5,
      12,
      'c',
      'karikris/BioMiner',
    ),
    definition(
      'cells-random-id',
      'geographic_impact_cells',
      GEOGRAPHIC_IMPACT_CELL_SCHEMA_VERSION,
      'application/vnd.apache.parquet',
      6,
      7,
      'd',
    ),
    definition(
      'summary-random-id',
      'geographic_impact_summary',
      GEOGRAPHIC_IMPACT_SUMMARY_SCHEMA_VERSION,
      'application/vnd.apache.parquet',
      7,
      3,
      'e',
    ),
    definition(
      'hierarchy-random-id',
      'country_hierarchy',
      COUNTRY_HIERARCHY_SCHEMA_VERSION,
      'application/json',
      8,
      3,
      'f',
    ),
  ] as const
  const hierarchy = countryHierarchy(options.includeSelectedScope ?? true)
  const manifest = impactManifest(
    definitions,
    unionAvailable,
    options.spatialResolutions ?? [3, 5, 7],
    options.flickrManifestSha256,
  )
  const manifestDefinition = definition(
    'manifest-random-id',
    'geographic_impact_manifest',
    GEOGRAPHIC_IMPACT_MANIFEST_SCHEMA_VERSION,
    'application/json',
    9,
    1,
    '9',
  )
  const inventory = [...definitions.map(({ descriptor }) => descriptor), manifestDefinition.descriptor]
  const sections = unavailableSections()
  for (const { descriptor } of definitions) {
    if (!(JUDGE_BUNDLE_SECTION_NAMES as readonly string[]).includes(descriptor.role)) {
      throw new Error(`fixture artifact role is not a section: ${descriptor.role}`)
    }
    sections[descriptor.role as JudgeBundleSectionName] = availableSection(descriptor)
  }

  const bundle: JudgeBundleContract = {
    schema_version: JUDGE_BUNDLE_SCHEMA_VERSION,
    bundle_id: 'synthetic-geographic-query-project',
    title: 'Synthetic Geographic Query Project',
    created_at: '2026-07-17T12:00:00Z',
    target: {
      accepted_taxon_key: syntheticGeographicQuery.evidenceScope.targetAcceptedTaxonKey,
      scientific_name: 'Papilio syntheticus',
      rank: 'species',
    },
    source_revisions: { taxalens_sha: '1'.repeat(40), biominer_sha: '2'.repeat(40) },
    artifact_inventory: inventory,
    sections,
    rights: {
      status: 'license_checked',
      all_artifacts_covered: true,
      all_media_rights_verified: false,
      items: [],
    },
    attribution: { complete: true, entries: [] },
    openai_replay: {
      status: 'not_used',
      mode: 'not_used',
      credentials_required: false,
      live_requests_allowed: false,
      reason: 'not used',
      traces: [],
    },
    expected_ui_counts: {
      section_records: Object.fromEntries(
        JUDGE_BUNDLE_SECTION_NAMES.map((name) => [name, sections[name].artifact_ids.length]),
      ) as JudgeBundleContract['expected_ui_counts']['section_records'],
      screen_items: {
        research_mission: 0,
        evidence_observatory: 0,
        evidence_lens: 0,
        butterfly_dashboard: 0,
      },
      artifact_count: inventory.length,
      attribution_count: 0,
      openai_replay_trace_count: 0,
      unavailable_section_count: JUDGE_BUNDLE_SECTION_NAMES.filter(
        (name) => sections[name].status === 'unavailable',
      ).length,
    },
    checksums: {
      algorithm: 'sha256',
      canonicalization: 'json-sorted-keys-utf8-v1',
      inventory_sha256: '0'.repeat(64),
      payload_root_sha256: '0'.repeat(64),
    },
  }
  const receipt: JudgeBundleMigrationResult['receipt'] = {
    sourceSchemaVersion: JUDGE_BUNDLE_SCHEMA_VERSION,
    targetSchemaVersion: JUDGE_BUNDLE_SCHEMA_VERSION,
    applied: false,
    storedFilesRewritten: false,
    addedSections: [],
    preservedV1FingerprintSha256: null,
  }
  const artifacts = new Map<string, VerifiedProjectArtifact>()
  for (const item of definitions) {
    artifacts.set(
      item.descriptor.artifact_id,
      Object.freeze({
        descriptor: Object.freeze(item.descriptor),
        bytes: item.bytes,
        json:
          item.descriptor.role === 'country_hierarchy'
            ? (structuredClone(hierarchy) as unknown as JsonValue)
            : undefined,
      }),
    )
  }
  artifacts.set(
    manifestDefinition.descriptor.artifact_id,
    Object.freeze({
      descriptor: Object.freeze(manifestDefinition.descriptor),
      bytes: manifestDefinition.bytes,
      json: structuredClone(manifest) as unknown as JsonValue,
    }),
  )
  return new TaxaLensProjectFacade({ manifest: bundle, receipt }, artifacts)
}

interface ArtifactDefinition {
  readonly descriptor: JudgeBundleArtifact
  readonly bytes: Uint8Array<ArrayBuffer>
}

function definition(
  artifactId: string,
  role: JudgeBundleArtifact['role'],
  schemaVersion: string,
  mediaType: string,
  byteValue: number,
  recordCount: number,
  digestCharacter: string,
  sourceRepository = 'karikris/taxalens',
): ArtifactDefinition {
  const bytes = new Uint8Array([byteValue, byteValue + 1, byteValue + 2])
  return Object.freeze({
    descriptor: {
      artifact_id: artifactId,
      path: `random/${artifactId}.${mediaType === 'application/json' ? 'json' : 'parquet'}`,
      media_type: mediaType,
      role,
      sha256: digestCharacter.repeat(64),
      bytes: bytes.byteLength,
      record_count: recordCount,
      schema_version: schemaVersion,
      source_repository: sourceRepository,
      source_commit: digestCharacter.repeat(40),
      required: true,
    },
    bytes,
  })
}

function impactManifest(
  definitions: readonly ArtifactDefinition[],
  unionAvailable: boolean,
  spatialResolutions: readonly number[],
  flickrManifestSha256?: string,
): GeographicImpactManifestDocument {
  const byRole = new Map(definitions.map((item) => [item.descriptor.role, item.descriptor]))
  const available = (
    logicalName: GeographicImpactArtifactEntry['logical_name'],
    role: JudgeBundleArtifact['role'],
  ): GeographicImpactArtifactEntry => {
    const descriptor = byRole.get(role)
    if (descriptor === undefined) throw new Error(`missing fixture descriptor ${role}`)
    return {
      logical_name: logicalName,
      availability: 'available',
      path: descriptor.path,
      media_type: descriptor.media_type,
      schema_version: descriptor.schema_version,
      sha256:
        logicalName === 'flickr_geography' && flickrManifestSha256 !== undefined
          ? flickrManifestSha256
          : descriptor.sha256,
      byte_size: descriptor.bytes,
      row_count: descriptor.record_count,
      snapshot_id:
        logicalName === 'baseline_occurrence_union' || logicalName === 'baseline_geographic_spread'
          ? syntheticGeographicQuery.evidenceScope.baselineSnapshotId
          : logicalName === 'flickr_geography'
            ? syntheticGeographicQuery.evidenceScope.flickrSnapshotId
            : null,
      source_repository: descriptor.source_repository as 'karikris/taxalens' | 'karikris/BioMiner',
      source_commit: descriptor.source_commit,
      rights_id: 'rights:fixture',
      unavailable_reason: null,
    }
  }
  const unavailable = (
    logicalName: GeographicImpactArtifactEntry['logical_name'],
    reason: string,
  ): GeographicImpactArtifactEntry => ({
    logical_name: logicalName,
    availability: 'unavailable',
    path: null,
    media_type: null,
    schema_version: null,
    sha256: null,
    byte_size: null,
    row_count: null,
    snapshot_id: null,
    source_repository: null,
    source_commit: null,
    rights_id: null,
    unavailable_reason: reason,
  })
  const unionEntry = unionAvailable
    ? available('baseline_occurrence_union', 'baseline_provider_union')
    : unavailable('baseline_occurrence_union', 'canonical provider union was not supplied')

  return {
    schema_version: GEOGRAPHIC_IMPACT_MANIFEST_SCHEMA_VERSION,
    manifest_id: 'geographic-impact-manifest:synthetic',
    geographic_impact_build_id: 'geographic-impact:synthetic',
    created_at: '2026-07-17T12:00:00Z',
    project_id: syntheticGeographicQuery.evidenceScope.projectId,
    run_id: syntheticGeographicQuery.evidenceScope.runId,
    registry_version: 'registry:synthetic',
    accepted_taxon_key: syntheticGeographicQuery.evidenceScope.targetAcceptedTaxonKey,
    scientific_name: 'Papilio syntheticus',
    baseline_snapshot_id: syntheticGeographicQuery.evidenceScope.baselineSnapshotId,
    flickr_snapshot_id: syntheticGeographicQuery.evidenceScope.flickrSnapshotId,
    provider_union_policy_version: BASELINE_PROVIDER_UNION_POLICY_VERSION,
    verification_projection_version: 'verification-projection:synthetic',
    release_policy_version: 'release-policy:synthetic',
    country_hierarchy_id: 'country-hierarchy:synthetic',
    spatial_resolutions: [...spatialResolutions],
    summary_scope_levels: ['global', 'continent', 'country', 'admin1'],
    source_commits: [
      { repository: 'karikris/taxalens', commit_sha: '1'.repeat(40) },
      { repository: 'karikris/BioMiner', commit_sha: '2'.repeat(40) },
    ],
    artifacts: [
      available('baseline_geographic_spread', 'baseline_geographic_spread'),
      unionEntry,
      available('flickr_geography', 'flickr_geography'),
      {
        logical_name: 'verification_consensus',
        availability: 'available',
        path: 'verification/consensus.json',
        media_type: 'application/json',
        schema_version: 'verification-consensus:synthetic',
        sha256: '7'.repeat(64),
        byte_size: 2,
        row_count: 0,
        snapshot_id: null,
        source_repository: 'karikris/taxalens',
        source_commit: '7'.repeat(40),
        rights_id: 'rights:fixture',
        unavailable_reason: null,
      },
      unavailable('quality_snapshot', 'no retained human outcomes'),
      {
        logical_name: 'release_decisions',
        availability: 'available',
        path: 'verification/release-decisions.json',
        media_type: 'application/json',
        schema_version: 'release-decisions:synthetic',
        sha256: '8'.repeat(64),
        byte_size: 2,
        row_count: 0,
        snapshot_id: null,
        source_repository: 'karikris/taxalens',
        source_commit: '8'.repeat(40),
        rights_id: 'rights:fixture',
        unavailable_reason: null,
      },
      available('geographic_impact_cells', 'geographic_impact_cells'),
      available('geographic_impact_summary', 'geographic_impact_summary'),
      available('country_hierarchy', 'country_hierarchy'),
    ],
    impact_cell_count: 7,
    summary_row_count: 3,
    hierarchy_node_count: 3,
    baseline_evidence_status: 'available',
    baseline_union_count: unionAvailable ? 9 : null,
    direct_inaturalist_delta_status: 'unavailable',
    direct_inaturalist_delta_count: null,
    flickr_candidate_count: 12,
    geographically_supported_flickr_candidate_count: 12,
    geographically_unsupported_flickr_candidate_count: 0,
    reviewed_positive_count: 0,
    reviewed_negative_count: 0,
    uncertain_count: 0,
    pending_count: 12,
    media_failure_count: 0,
    skipped_count: 0,
    release_ready_count: 0,
    baseline_only_cell_count: 1,
    matched_cell_count: 2,
    candidate_only_cell_count: 4,
    reviewed_additional_cell_count: 0,
    release_ready_additional_cell_count: 0,
    unassigned_cartographic_cell_count: 0,
    deterministic_fingerprint_sha256: '0'.repeat(64),
    generated_by: 'synthetic-fixture',
  }
}

function countryHierarchy(includeSelectedScope: boolean): CountryHierarchyDocument {
  return {
    schema_version: COUNTRY_HIERARCHY_SCHEMA_VERSION,
    country_hierarchy_id: 'country-hierarchy:synthetic',
    boundary_dataset_id: 'boundary:synthetic',
    boundary_dataset_version: '1',
    created_at: '2026-07-17T12:00:00Z',
    root_scope_id: 'global',
    nodes: [
      {
        scope_level: 'global',
        scope_id: 'global',
        scope_name: 'Global',
        parent_scope_id: null,
        continent: null,
        country_code: null,
        country: null,
        admin1_code: null,
        admin1: null,
        geometry_feature_id: null,
        centroid_latitude: 0,
        centroid_longitude: 0,
        bounds: [-180, -90, 180, 90],
        sort_key: '000',
      },
      {
        scope_level: 'continent',
        scope_id: 'continent:Oceania',
        scope_name: 'Oceania',
        parent_scope_id: 'global',
        continent: 'Oceania',
        country_code: null,
        country: null,
        admin1_code: null,
        admin1: null,
        geometry_feature_id: null,
        centroid_latitude: -22,
        centroid_longitude: 140,
        bounds: [110, -50, 180, 0],
        sort_key: '100',
      },
      ...(includeSelectedScope
        ? [
            {
              scope_level: 'country' as const,
              scope_id: 'country:AU',
              scope_name: 'Australia',
              parent_scope_id: 'continent:Oceania',
              continent: 'Oceania' as const,
              country_code: 'AU',
              country: 'Australia',
              admin1_code: null,
              admin1: null,
              geometry_feature_id: 'AU',
              centroid_latitude: -25,
              centroid_longitude: 134,
              bounds: [112, -44, 154, -10] as const,
              sort_key: '200-AU',
            },
          ]
        : []),
    ],
  }
}

function availableSection(descriptor: JudgeBundleArtifact): JudgeBundleSection {
  return {
    status: 'available',
    artifact_ids: [descriptor.artifact_id],
    reason: null,
    candidate_semantics:
      descriptor.role === 'flickr_geography' || descriptor.role.startsWith('geographic_impact')
        ? 'hypothesis_not_occurrence'
        : 'not_applicable',
    verification_status: 'machine_verified_contract',
    human_review_required: true,
    scientific_claim_allowed: false,
  }
}

function unavailableSections(): JudgeBundleContract['sections'] {
  const unavailable: JudgeBundleSection = {
    status: 'unavailable',
    artifact_ids: [],
    reason: 'not supplied by the synthetic project',
    candidate_semantics: 'not_applicable',
    verification_status: 'unavailable',
    human_review_required: true,
    scientific_claim_allowed: false,
  }
  return Object.fromEntries(
    JUDGE_BUNDLE_SECTION_NAMES.map((name) => [name, structuredClone(unavailable)]),
  ) as JudgeBundleContract['sections']
}
