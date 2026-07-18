import { describe, expect, it } from 'vitest'

import {
  BASELINE_OCCURRENCE_UNION_SCHEMA_VERSION,
  COUNTRY_HIERARCHY_SCHEMA_VERSION,
  GEOGRAPHIC_IMPACT_CELL_SCHEMA_VERSION,
  GEOGRAPHIC_IMPACT_MANIFEST_SCHEMA_VERSION,
  GEOGRAPHIC_IMPACT_SUMMARY_SCHEMA_VERSION,
} from '../../../../packages/contracts/src/geographic_impact_contract'
import {
  JUDGE_BUNDLE_SCHEMA_VERSION,
  JUDGE_BUNDLE_SECTION_NAMES,
  type JudgeBundleArtifact,
  type JudgeBundleContract,
  type JudgeBundleSection,
} from '../../../../packages/contracts/src/judge_bundle_contract'
import { committedV1JudgeBundle } from '../test/fixtures'
import { migrateJudgeBundleToCurrent, type JsonValue } from './evidenceFacade'
import {
  loadCountryHierarchy,
  loadGeographicImpactInput,
  loadGeographicImpactSummary,
  loadGeographicRecordContext,
  type GeographicEvidenceScopeIdentity,
} from './geographicProjectFacade'
import {
  TaxaLensProjectFacade,
  type JudgeBundleMigrationResult,
  type VerifiedProjectArtifact,
} from './projectFacade'

const geographicDescriptors = Object.freeze([
  descriptor('opaque-spread-73ae', 'baseline_geographic_spread', 'taxon-geographic-spread-v1.0.0'),
  descriptor('opaque-union-11f4', 'baseline_provider_union', BASELINE_OCCURRENCE_UNION_SCHEMA_VERSION),
  descriptor('opaque-flickr-c925', 'flickr_geography', 'flickr-geography-v1.0.0'),
  descriptor('opaque-cells-98b1', 'geographic_impact_cells', GEOGRAPHIC_IMPACT_CELL_SCHEMA_VERSION),
  descriptor('opaque-summary-64d0', 'geographic_impact_summary', GEOGRAPHIC_IMPACT_SUMMARY_SCHEMA_VERSION),
  descriptor('opaque-hierarchy-d231', 'country_hierarchy', COUNTRY_HIERARCHY_SCHEMA_VERSION, 'application/json'),
] as const)

const impactManifestDescriptor = descriptor(
  'opaque-impact-manifest-a1e8',
  'geographic_impact_manifest',
  GEOGRAPHIC_IMPACT_MANIFEST_SCHEMA_VERSION,
  'application/json',
)

const geographicScope: GeographicEvidenceScopeIdentity = Object.freeze({
  projectId: 'project:synthetic',
  runId: 'run:synthetic',
  targetAcceptedTaxonKey: 'gbif:synthetic',
  baselineSnapshotId: 'baseline:synthetic',
  flickrSnapshotId: 'flickr:synthetic',
})

describe('geographic project facade', () => {
  it('loads geographic artifacts by verified section role and schema, not artifact id', () => {
    const project = geographicProject()

    const input = loadGeographicImpactInput(project, geographicScope)
    const summary = loadGeographicImpactSummary(project, geographicScope)
    const hierarchy = loadCountryHierarchy(project, geographicScope)
    const record = loadGeographicRecordContext(project, geographicScope)

    expect(input.status).toBe('available')
    expect(input.artifacts.map(({ descriptor: artifact }) => artifact.role)).toEqual([
      'baseline_geographic_spread',
      'baseline_provider_union',
      'flickr_geography',
      'geographic_impact_cells',
    ])
    expect(summary.artifacts.map(({ descriptor: artifact }) => artifact.role)).toEqual([
      'geographic_impact_summary',
    ])
    expect(hierarchy.artifacts.map(({ descriptor: artifact }) => artifact.role)).toEqual([
      'country_hierarchy',
    ])
    expect(record.artifacts.map(({ descriptor: artifact }) => artifact.role)).toEqual([
      'baseline_provider_union',
      'flickr_geography',
      'geographic_impact_cells',
      'country_hierarchy',
    ])
    for (const result of [input, summary, hierarchy, record]) {
      expect(result.manifestArtifact?.descriptor.role).toBe('geographic_impact_manifest')
      expect(result.reason).toBeNull()
      expect(result.unavailableSections).toEqual([])
      expect(result.scope).toEqual(geographicScope)
      expect(Object.isFrozen(result.scope)).toBe(true)
    }
  })

  it('reports v1-migrated geography as unavailable without inventing empty evidence', async () => {
    const migration = await migrateJudgeBundleToCurrent(
      committedV1JudgeBundle() as JsonValue,
    )
    const project = new TaxaLensProjectFacade(migration, new Map())
    const migratedScope = {
      ...geographicScope,
      targetAcceptedTaxonKey: migration.manifest.target.accepted_taxon_key,
    }

    const input = loadGeographicImpactInput(project, migratedScope)
    const summary = loadGeographicImpactSummary(project, migratedScope)
    const hierarchy = loadCountryHierarchy(project, migratedScope)
    const record = loadGeographicRecordContext(project, migratedScope)

    for (const result of [input, summary, hierarchy, record]) {
      expect(result.status).toBe('unavailable')
      expect(result.artifacts).toEqual([])
      expect(result.manifestArtifact).toBeNull()
      expect(result.reason).toMatch(/migration did not invent geographic evidence/)
    }
  })

  it('fails closed when a declared section has an unsupported schema', () => {
    const project = geographicProject({ role: 'geographic_impact_summary', schema: 'unknown:v9' })

    expect(loadGeographicImpactSummary(project, geographicScope)).toMatchObject({
      status: 'unavailable',
      artifacts: [],
      manifestArtifact: null,
      reason: 'geographic_impact_summary contains an unsupported schema version; geographic_impact_summary has no supported artifact',
    })
  })

  it('fails every geographic read closed for every scope identity mismatch', () => {
    const project = geographicProject()
    const loaders = [
      loadGeographicImpactInput,
      loadGeographicImpactSummary,
      loadCountryHierarchy,
      loadGeographicRecordContext,
    ] as const
    const mismatches: readonly (readonly [keyof GeographicEvidenceScopeIdentity, string])[] = [
      ['projectId', 'project:other'],
      ['runId', 'run:other'],
      ['targetAcceptedTaxonKey', 'gbif:other'],
      ['baselineSnapshotId', 'baseline:other'],
      ['flickrSnapshotId', 'flickr:other'],
    ]

    for (const [field, value] of mismatches) {
      const scope = { ...geographicScope, [field]: value }
      for (const load of loaders) {
        expect(load(project, scope)).toMatchObject({
          status: 'unavailable',
          artifacts: [],
          manifestArtifact: null,
          reason: `geographic scope mismatch: ${field}`,
        })
      }
    }
  })

  it('fails closed when any required scope identity is blank', () => {
    const result = loadGeographicImpactInput(geographicProject(), {
      ...geographicScope,
      baselineSnapshotId: '',
    })

    expect(result).toMatchObject({
      status: 'unavailable',
      artifacts: [],
      manifestArtifact: null,
      reason: 'geographic scope has invalid fields: baselineSnapshotId; geographic scope mismatch: baselineSnapshotId',
    })
  })
})

function geographicProject(
  replacement?: { readonly role: JudgeBundleArtifact['role']; readonly schema: string },
): TaxaLensProjectFacade {
  const descriptors = geographicDescriptors.map((artifact) =>
    artifact.role === replacement?.role ? { ...artifact, schema_version: replacement.schema } : artifact,
  )
  const inventory = [...descriptors, impactManifestDescriptor]
  const sections = unavailableSections()
  for (const artifact of descriptors) {
    sections[artifact.role] = {
      status: 'available',
      artifact_ids: [artifact.artifact_id],
      reason: null,
      candidate_semantics:
        artifact.role === 'flickr_geography' || artifact.role.startsWith('geographic_impact')
          ? 'hypothesis_not_occurrence'
          : 'not_applicable',
      verification_status: 'machine_verified_contract',
      human_review_required: true,
      scientific_claim_allowed: false,
    }
  }
  const manifest: JudgeBundleContract = {
    schema_version: JUDGE_BUNDLE_SCHEMA_VERSION,
    bundle_id: 'synthetic-geographic-project',
    title: 'Synthetic Geographic Project',
    created_at: '2026-07-17T09:42:00Z',
    target: {
      accepted_taxon_key: 'gbif:synthetic',
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
  return new TaxaLensProjectFacade(
    { manifest, receipt },
    new Map(
      inventory.map((artifact) => [
        artifact.artifact_id,
        Object.freeze({
          descriptor: Object.freeze(artifact),
          bytes: new Uint8Array(new ArrayBuffer(0)),
          json:
            artifact.role === 'geographic_impact_manifest'
              ? {
                  project_id: geographicScope.projectId,
                  run_id: geographicScope.runId,
                  accepted_taxon_key: geographicScope.targetAcceptedTaxonKey,
                  baseline_snapshot_id: geographicScope.baselineSnapshotId,
                  flickr_snapshot_id: geographicScope.flickrSnapshotId,
                }
              : artifact.media_type === 'application/json'
                ? {}
                : undefined,
        }) satisfies VerifiedProjectArtifact,
      ]),
    ),
  )
}

function descriptor<Role extends JudgeBundleArtifact['role']>(
  artifactId: string,
  role: Role,
  schemaVersion: string,
  mediaType = 'application/vnd.apache.parquet',
): JudgeBundleArtifact & { readonly role: Role } {
  return {
    artifact_id: artifactId,
    path: `artifacts/${artifactId}.${mediaType === 'application/json' ? 'json' : 'parquet'}`,
    media_type: mediaType,
    role: role,
    sha256: 'a'.repeat(64),
    bytes: 0,
    record_count: 1,
    schema_version: schemaVersion,
    source_repository: 'example/geographic-project',
    source_commit: '1'.repeat(40),
    required: true,
  } as JudgeBundleArtifact & { readonly role: Role }
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
