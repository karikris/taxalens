import {
  BASELINE_OCCURRENCE_UNION_SCHEMA_VERSION,
  COUNTRY_HIERARCHY_SCHEMA_VERSION,
  GEOGRAPHIC_IMPACT_CELL_SCHEMA_VERSION,
  GEOGRAPHIC_IMPACT_MANIFEST_SCHEMA_VERSION,
  GEOGRAPHIC_IMPACT_SUMMARY_SCHEMA_VERSION,
  type CountryHierarchyDocument,
  type CountryHierarchyNode,
  type EvidenceAvailability,
  type GeographicArtifactLogicalName,
  type GeographicImpactArtifactEntry,
  type GeographicImpactManifestDocument,
} from '../../../../packages/contracts/src/geographic_impact_contract'
import {
  loadCountryHierarchy,
  loadGeographicImpactInput,
  loadGeographicImpactSummary,
  type GeographicArtifactLoadResult,
} from '../data/geographicProjectFacade'
import type {
  JsonValue,
  TaxaLensProjectFacade,
  VerifiedProjectArtifact,
} from '../data/projectFacade'
import {
  validateGeographicImpactQueryInput,
  type GeographicImpactQueryInput,
} from './geographicImpactQuery'

const BASELINE_SPREAD_SCHEMA_VERSION = 'taxon-geographic-spread-v1.0.0'
const FLICKR_GEOGRAPHY_SCHEMA_VERSIONS = Object.freeze([
  'flickr-geography-v1.0.0',
  'taxalens-flickr-geography-verification:v1.0.0',
] as const)

export const GEOGRAPHIC_QUERY_FILE_NAMES = Object.freeze({
  baseline_occurrence_union: 'baseline_occurrence_union.parquet',
  baseline_geographic_spread: 'baseline_geographic_spread.parquet',
  flickr_geography: 'flickr_geography.parquet',
  geographic_impact_cells: 'geographic_impact_cells.parquet',
  geographic_impact_summary: 'geographic_impact_summary.parquet',
} as const)

export type GeographicQueryParquetLogicalName = keyof typeof GEOGRAPHIC_QUERY_FILE_NAMES
export type GeographicBaselineQuerySource = Extract<
  GeographicQueryParquetLogicalName,
  'baseline_occurrence_union' | 'baseline_geographic_spread'
>
export type GeographicMaturityLogicalName = Extract<
  GeographicArtifactLogicalName,
  'verification_consensus' | 'quality_snapshot' | 'release_decisions'
>

export interface GeographicQueryParquetSource {
  readonly logicalName: GeographicQueryParquetLogicalName
  readonly fileName: string
  readonly artifact: VerifiedProjectArtifact
  readonly manifestEntry: GeographicImpactArtifactEntry
}

export interface GeographicMaturitySource {
  readonly logicalName: GeographicMaturityLogicalName
  readonly availability: EvidenceAvailability
  readonly schemaVersion: string | null
  readonly recordCount: number | null
  readonly sourceRepository: string | null
  readonly sourceCommit: string | null
  readonly unavailableReason: string | null
}

export interface GeographicImpactQuerySources {
  readonly input: GeographicImpactQueryInput
  readonly baselineSource: GeographicBaselineQuerySource
  readonly manifest: GeographicImpactManifestDocument
  readonly hierarchy: CountryHierarchyDocument
  readonly selectedHierarchyNode: CountryHierarchyNode
  readonly parquetSources: readonly GeographicQueryParquetSource[]
  readonly maturitySources: readonly GeographicMaturitySource[]
}

export interface GeographicFileRegistrationTarget {
  registerFileBuffer(fileName: string, bytes: Uint8Array<ArrayBuffer>): Promise<void>
}

export interface RegisteredGeographicArtifact {
  readonly logicalName: GeographicQueryParquetLogicalName
  readonly fileName: string
  readonly artifactId: string
  readonly sha256: string
  readonly byteCount: number
  readonly recordCount: number
  readonly sourceRepository: string
  readonly sourceCommit: string
}

export interface GeographicSourceRegistrationResult {
  readonly registeredFileCount: number
  readonly registeredBytes: number
  readonly artifacts: readonly RegisteredGeographicArtifact[]
}

/** Resolve a query only from bundle-verified bytes and manifest-bound JSON. */
export function loadGeographicImpactQuerySources(
  project: TaxaLensProjectFacade,
  candidate: unknown,
): GeographicImpactQuerySources {
  const input = validateGeographicImpactQueryInput(candidate)
  const impactInput = loadGeographicImpactInput(project, input.evidenceScope)
  const impactSummary = loadGeographicImpactSummary(project, input.evidenceScope)
  const hierarchyInput = loadCountryHierarchy(project, input.evidenceScope)
  requireUsableLoad(impactInput)
  requireUsableLoad(impactSummary)
  requireUsableLoad(hierarchyInput)

  const manifestArtifact = requireSharedManifest([
    impactInput,
    impactSummary,
    hierarchyInput,
  ])
  const manifest = readManifest(manifestArtifact)
  if (!manifest.spatial_resolutions.includes(input.spatialResolution)) {
    throw new Error('selected spatial resolution is not declared by the geographic manifest')
  }
  if (!manifest.summary_scope_levels.includes(input.geographicScope.level)) {
    throw new Error('selected geographic scope level is not declared by the geographic manifest')
  }

  const hierarchyArtifact = requireSingleArtifact(
    hierarchyInput,
    'country_hierarchy',
    (artifact) => artifact.descriptor.schema_version === COUNTRY_HIERARCHY_SCHEMA_VERSION,
  )
  const hierarchy = readHierarchy(hierarchyArtifact)
  if (hierarchy.country_hierarchy_id !== manifest.country_hierarchy_id) {
    throw new Error('country hierarchy identity differs from the geographic manifest')
  }
  const matchingNodes = hierarchy.nodes.filter(
    (node) =>
      node.scope_level === input.geographicScope.level &&
      node.scope_id === input.geographicScope.id,
  )
  if (matchingNodes.length !== 1) {
    throw new Error('selected geographic scope is missing or ambiguous in the country hierarchy')
  }

  const unionArtifact = optionalSingleArtifact(
    impactInput,
    'baseline_provider_union',
    (artifact) => artifact.descriptor.schema_version === BASELINE_OCCURRENCE_UNION_SCHEMA_VERSION,
  )
  const baselineSource: GeographicBaselineQuerySource =
    unionArtifact === undefined ? 'baseline_geographic_spread' : 'baseline_occurrence_union'
  const baselineArtifact =
    unionArtifact ??
    requireSingleArtifact(
      impactInput,
      'baseline_geographic_spread',
      (artifact) => artifact.descriptor.schema_version === BASELINE_SPREAD_SCHEMA_VERSION,
    )
  const flickrArtifact = requireSingleArtifact(
    impactInput,
    'flickr_geography',
    (artifact) =>
      FLICKR_GEOGRAPHY_SCHEMA_VERSIONS.includes(
        artifact.descriptor.schema_version as (typeof FLICKR_GEOGRAPHY_SCHEMA_VERSIONS)[number],
      ),
  )
  const cellsArtifact = requireSingleArtifact(
    impactInput,
    'geographic_impact_cells',
    (artifact) => artifact.descriptor.schema_version === GEOGRAPHIC_IMPACT_CELL_SCHEMA_VERSION,
  )
  const summaryArtifact = requireSingleArtifact(
    impactSummary,
    'geographic_impact_summary',
    (artifact) => artifact.descriptor.schema_version === GEOGRAPHIC_IMPACT_SUMMARY_SCHEMA_VERSION,
  )

  const sourcePairs = [
    [baselineSource, baselineArtifact],
    ['flickr_geography', flickrArtifact],
    ['geographic_impact_cells', cellsArtifact],
    ['geographic_impact_summary', summaryArtifact],
  ] as const satisfies readonly (readonly [
    GeographicQueryParquetLogicalName,
    VerifiedProjectArtifact,
  ])[]
  const parquetSources = sourcePairs.map(([logicalName, artifact]) =>
    bindParquetSource(manifest, logicalName, artifact),
  )
  bindManifestEntry(manifest, 'country_hierarchy', hierarchyArtifact)

  const maturitySources = (
    ['verification_consensus', 'quality_snapshot', 'release_decisions'] as const
  ).map((logicalName) => maturitySource(requireManifestEntry(manifest, logicalName)))

  return Object.freeze({
    input,
    baselineSource,
    manifest,
    hierarchy,
    selectedHierarchyNode: matchingNodes[0]!,
    parquetSources: Object.freeze(parquetSources),
    maturitySources: Object.freeze(maturitySources),
  })
}

/** Register deterministic in-memory files; no repository or remote path is read. */
export async function registerGeographicImpactQuerySources(
  target: GeographicFileRegistrationTarget,
  sources: GeographicImpactQuerySources,
): Promise<GeographicSourceRegistrationResult> {
  const registered = new Set<string>()
  const artifacts: RegisteredGeographicArtifact[] = []
  for (const source of sources.parquetSources) {
    if (registered.has(source.fileName)) {
      throw new Error(`geographic query file name registered twice: ${source.fileName}`)
    }
    if (
      source.artifact.descriptor.media_type !== 'application/vnd.apache.parquet' ||
      source.artifact.bytes.byteLength === 0
    ) {
      throw new Error(`${source.logicalName} is not a non-empty verified Parquet artifact`)
    }
    await target.registerFileBuffer(source.fileName, source.artifact.bytes)
    registered.add(source.fileName)
    artifacts.push(
      Object.freeze({
        logicalName: source.logicalName,
        fileName: source.fileName,
        artifactId: source.artifact.descriptor.artifact_id,
        sha256: source.artifact.descriptor.sha256,
        byteCount: source.artifact.bytes.byteLength,
        recordCount: requiredCount(source.artifact.descriptor.record_count, 'record_count'),
        sourceRepository: source.artifact.descriptor.source_repository,
        sourceCommit: source.artifact.descriptor.source_commit,
      }),
    )
  }
  return Object.freeze({
    registeredFileCount: artifacts.length,
    registeredBytes: artifacts.reduce((total, artifact) => total + artifact.byteCount, 0),
    artifacts: Object.freeze(artifacts),
  })
}

function requireUsableLoad(result: GeographicArtifactLoadResult): void {
  if (result.status === 'unavailable') {
    throw new Error(`${result.loader} is unavailable: ${result.reason ?? 'no verified artifact'}`)
  }
}

function requireSharedManifest(
  results: readonly GeographicArtifactLoadResult[],
): VerifiedProjectArtifact {
  const artifacts = results.map((result) => result.manifestArtifact)
  const first = artifacts[0]
  if (first === undefined || first === null) {
    throw new Error('geographic loaders do not share one verified impact manifest')
  }
  const artifactId = first.descriptor.artifact_id
  if (artifacts.some((artifact) => artifact?.descriptor.artifact_id !== artifactId)) {
    throw new Error('geographic loaders do not share one verified impact manifest')
  }
  return first
}

function requireSingleArtifact(
  result: GeographicArtifactLoadResult,
  role: VerifiedProjectArtifact['descriptor']['role'],
  predicate: (artifact: VerifiedProjectArtifact) => boolean,
): VerifiedProjectArtifact {
  const artifact = optionalSingleArtifact(result, role, predicate)
  if (artifact === undefined) {
    throw new Error(`${role} requires exactly one compatible artifact`)
  }
  return artifact
}

function optionalSingleArtifact(
  result: GeographicArtifactLoadResult,
  role: VerifiedProjectArtifact['descriptor']['role'],
  predicate: (artifact: VerifiedProjectArtifact) => boolean,
): VerifiedProjectArtifact | undefined {
  const matches = result.artifacts.filter(
    (artifact) => artifact.descriptor.role === role && predicate(artifact),
  )
  if (matches.length > 1) {
    throw new Error(`${role} contains more than one compatible artifact`)
  }
  return matches[0]
}

function bindParquetSource(
  manifest: GeographicImpactManifestDocument,
  logicalName: GeographicQueryParquetLogicalName,
  artifact: VerifiedProjectArtifact,
): GeographicQueryParquetSource {
  if (artifact.descriptor.media_type !== 'application/vnd.apache.parquet') {
    throw new Error(`${logicalName} must be Parquet`)
  }
  return Object.freeze({
    logicalName,
    fileName: GEOGRAPHIC_QUERY_FILE_NAMES[logicalName],
    artifact,
    manifestEntry: bindManifestEntry(manifest, logicalName, artifact),
  })
}

function bindManifestEntry(
  manifest: GeographicImpactManifestDocument,
  logicalName: GeographicArtifactLogicalName,
  artifact: VerifiedProjectArtifact,
): GeographicImpactArtifactEntry {
  const entry = requireManifestEntry(manifest, logicalName)
  const descriptor = artifact.descriptor
  if (
    entry.availability !== 'available' ||
    entry.sha256 !== descriptor.sha256 ||
    entry.byte_size !== descriptor.bytes ||
    entry.row_count !== descriptor.record_count ||
    entry.schema_version !== descriptor.schema_version ||
    entry.media_type !== descriptor.media_type ||
    entry.source_commit !== descriptor.source_commit ||
    entry.source_repository?.toLowerCase() !== descriptor.source_repository.toLowerCase()
  ) {
    throw new Error(`${logicalName} differs from its geographic manifest entry`)
  }
  return entry
}

function requireManifestEntry(
  manifest: GeographicImpactManifestDocument,
  logicalName: GeographicArtifactLogicalName,
): GeographicImpactArtifactEntry {
  const matches = manifest.artifacts.filter((entry) => entry.logical_name === logicalName)
  if (matches.length !== 1) {
    throw new Error(`geographic manifest must contain one ${logicalName} entry`)
  }
  return matches[0]!
}

function maturitySource(entry: GeographicImpactArtifactEntry): GeographicMaturitySource {
  return Object.freeze({
    logicalName: entry.logical_name as GeographicMaturityLogicalName,
    availability: entry.availability,
    schemaVersion: entry.schema_version,
    recordCount: entry.row_count,
    sourceRepository: entry.source_repository,
    sourceCommit: entry.source_commit,
    unavailableReason: entry.unavailable_reason,
  })
}

function readManifest(artifact: VerifiedProjectArtifact): GeographicImpactManifestDocument {
  const value = requireJsonObject(artifact.json, 'geographic impact manifest')
  if (
    value.schema_version !== GEOGRAPHIC_IMPACT_MANIFEST_SCHEMA_VERSION ||
    !Array.isArray(value.spatial_resolutions) ||
    !Array.isArray(value.summary_scope_levels) ||
    !Array.isArray(value.artifacts)
  ) {
    throw new Error('geographic impact manifest has an invalid query contract')
  }
  return freezeJson(value) as unknown as GeographicImpactManifestDocument
}

function readHierarchy(artifact: VerifiedProjectArtifact): CountryHierarchyDocument {
  const value = requireJsonObject(artifact.json, 'country hierarchy')
  if (
    value.schema_version !== COUNTRY_HIERARCHY_SCHEMA_VERSION ||
    typeof value.country_hierarchy_id !== 'string' ||
    !Array.isArray(value.nodes)
  ) {
    throw new Error('country hierarchy has an invalid query contract')
  }
  return freezeJson(value) as unknown as CountryHierarchyDocument
}

function requireJsonObject(value: JsonValue | undefined, label: string): Record<string, JsonValue> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} is not verified JSON`)
  }
  return value
}

function freezeJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => freezeJson(item))) as JsonValue
  }
  if (typeof value === 'object' && value !== null) {
    return Object.freeze(
      Object.fromEntries(Object.entries(value).map(([key, item]) => [key, freezeJson(item)])),
    ) as JsonValue
  }
  return value
}

function requiredCount(value: number | null, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${field} must be an available non-negative integer`)
  }
  return value as number
}
