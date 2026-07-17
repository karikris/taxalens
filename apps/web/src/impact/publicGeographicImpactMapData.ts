import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'

import type { CountryHierarchyNode } from '../../../../packages/contracts/src/geographic_impact_contract'
import impactManifest from '../../../../demo/source/biominer_phase14/geographic_impact/geographic_impact_manifest.json'
import impactCellsUrl from '../../../../demo/source/biominer_phase14/geographic_impact/geographic_impact_cells.parquet?url'
import {
  createDuckDbRuntime,
  DUCKDB_ENGINE_VERSION,
  loadLocalParquetExtension,
} from '../data/duckdbRuntime'
import type { GeographicImpactBrowserCell } from './geographicImpactAnalytics'

const MAP_ARTIFACT_FILE_NAME = 'taxalens_geographic_impact_cells.parquet'
const MAXIMUM_SCOPED_MAP_CELLS = 5_000

const impactArtifact = impactManifest.artifacts.find(
  ({ logical_name }) => logical_name === 'geographic_impact_cells',
)
if (
  impactArtifact === undefined ||
  impactArtifact.availability !== 'available' ||
  impactArtifact.media_type !== 'application/vnd.apache.parquet' ||
  impactArtifact.byte_size === null ||
  impactArtifact.sha256 === null ||
  impactArtifact.row_count === null
) {
  throw new Error('The public Geographic Impact map artifact is unavailable or incomplete')
}
const impactArtifactByteSize = impactArtifact.byte_size
const impactArtifactSha256 = impactArtifact.sha256

export const PUBLIC_GEOGRAPHIC_IMPACT_MAP_SOURCE = Object.freeze({
  schemaVersion: impactArtifact.schema_version,
  artifactPath: impactArtifact.path,
  artifactSha256: impactArtifact.sha256,
  artifactBytes: impactArtifact.byte_size,
  artifactRows: impactArtifact.row_count,
  sourceRepository: impactArtifact.source_repository,
  sourceCommit: impactArtifact.source_commit,
  manifestId: impactManifest.manifest_id,
  buildId: impactManifest.geographic_impact_build_id,
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
} as const)

export interface PublicGeographicImpactMapData {
  readonly cells: readonly GeographicImpactBrowserCell[]
  readonly spatialResolution: 3 | 5 | 7
  readonly scopeId: string
  readonly source: typeof PUBLIC_GEOGRAPHIC_IMPACT_MAP_SOURCE
  readonly scientificClaimAllowed: false
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

export async function loadPublicGeographicImpactMapData(
  scope: CountryHierarchyNode,
  signal: AbortSignal,
): Promise<PublicGeographicImpactMapData> {
  throwIfAborted(signal)
  const bytes = await fetchVerifiedImpactBytes()
  throwIfAborted(signal)
  const { database } = await createDuckDbRuntime()
  let connection: AsyncDuckDBConnection | undefined
  try {
    const engineVersion = await database.getVersion()
    if (engineVersion !== DUCKDB_ENGINE_VERSION) {
      throw new Error(
        `DuckDB engine ${engineVersion} differs from the pinned ${DUCKDB_ENGINE_VERSION} runtime`,
      )
    }
    throwIfAborted(signal)
    await database.registerFileBuffer(MAP_ARTIFACT_FILE_NAME, bytes)
    const parquetExtensionUrl = await loadLocalParquetExtension()
    throwIfAborted(signal)
    connection = await database.connect()
    await connection.query(`SET autoinstall_known_extensions = false;
      SET autoload_known_extensions = false;
      LOAD ${sqlLiteral(parquetExtensionUrl)}`)
    throwIfAborted(signal)
    const spatialResolution = geographicMapResolutionForScope(scope)
    const table = await connection.query(
      buildPublicGeographicImpactMapSql(scope, spatialResolution),
    )
    throwIfAborted(signal)
    if (table.numRows > MAXIMUM_SCOPED_MAP_CELLS) {
      throw new Error('Scoped Geographic Impact map query exceeded its feature bound')
    }
    return Object.freeze({
      cells: decodeMapCells(table),
      spatialResolution,
      scopeId: scope.scope_id,
      source: PUBLIC_GEOGRAPHIC_IMPACT_MAP_SOURCE,
      scientificClaimAllowed: false as const,
    })
  } finally {
    await connection?.close()
    await database.dropFiles()
    await database.terminate()
  }
}

export function buildPublicGeographicImpactMapSql(
  scope: CountryHierarchyNode,
  spatialResolution = geographicMapResolutionForScope(scope),
): string {
  return `SELECT
      spatial_resolution,
      spatial_cell_id,
      continent,
      country_code,
      country,
      admin1,
      centroid_latitude,
      centroid_longitude,
      baseline_union_count,
      baseline_range_inference_eligible_count,
      flickr_candidate_count,
      flickr_visually_eligible_count,
      reviewed_positive_count,
      reviewed_negative_count,
      uncertain_count,
      pending_count,
      media_failure_count,
      skipped_count,
      release_ready_count,
      baseline_only_cell,
      matched_cell,
      candidate_only_cell,
      reviewed_additional_cell,
      release_ready_additional_cell,
      nearest_baseline_distance_km,
      data_deficient_state
    FROM read_parquet(${sqlLiteral(MAP_ARTIFACT_FILE_NAME)})
    WHERE project_id = ${sqlLiteral(impactManifest.project_id)}
      AND run_id = ${sqlLiteral(impactManifest.run_id)}
      AND accepted_taxon_key = ${sqlLiteral(impactManifest.accepted_taxon_key)}
      AND baseline_snapshot_id = ${sqlLiteral(impactManifest.baseline_snapshot_id)}
      AND flickr_snapshot_id = ${sqlLiteral(impactManifest.flickr_snapshot_id)}
      AND spatial_resolution = ${spatialResolution}
      AND ${scopeSqlPredicate(scope)}
    ORDER BY spatial_cell_id
    LIMIT ${MAXIMUM_SCOPED_MAP_CELLS + 1}`
}

async function fetchVerifiedImpactBytes(): Promise<Uint8Array<ArrayBuffer>> {
  const url = new URL(impactCellsUrl, window.location.href)
  if (url.origin !== window.location.origin) {
    throw new Error('Geographic Impact map data must load from the application origin')
  }
  const response = await fetch(url, {
    cache: 'force-cache',
    credentials: 'same-origin',
  })
  if (!response.ok) {
    throw new Error(`Geographic Impact map artifact returned HTTP ${response.status}`)
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength !== impactArtifactByteSize) {
    throw new Error('Geographic Impact map artifact byte count differs from its manifest')
  }
  const digest = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
  if (digest !== impactArtifactSha256) {
    throw new Error('Geographic Impact map artifact checksum differs from its manifest')
  }
  return bytes
}

function scopeSqlPredicate(scope: CountryHierarchyNode): string {
  switch (scope.scope_level) {
    case 'global':
      return 'TRUE'
    case 'continent':
      if (scope.continent === null) throw new Error('Continent scope identity is incomplete')
      return `continent = ${sqlLiteral(scope.continent)}`
    case 'country':
      if (scope.country_code === null) throw new Error('Country scope identity is incomplete')
      return `country_code = ${sqlLiteral(scope.country_code)}`
    case 'admin1':
      if (scope.country_code === null || scope.admin1 === null) {
        throw new Error('Admin1 scope identity is incomplete')
      }
      return `country_code = ${sqlLiteral(scope.country_code)}
        AND admin1 = ${sqlLiteral(scope.admin1)}`
  }
}

function decodeMapCells(
  table: Awaited<ReturnType<AsyncDuckDBConnection['query']>>,
): readonly GeographicImpactBrowserCell[] {
  return Object.freeze(
    Array.from({ length: table.numRows }, (_, row) =>
      Object.freeze({
        spatialResolution: requiredCount(table, 'spatial_resolution', row),
        spatialCellId: requiredString(table, 'spatial_cell_id', row),
        continent: nullableString(table, 'continent', row),
        countryCode: nullableString(table, 'country_code', row),
        country: nullableString(table, 'country', row),
        admin1: nullableString(table, 'admin1', row),
        latitude: requiredFiniteNumber(table, 'centroid_latitude', row),
        longitude: requiredFiniteNumber(table, 'centroid_longitude', row),
        baselineUnionCount: requiredCount(table, 'baseline_union_count', row),
        baselineRangeInferenceEligibleCount: requiredCount(
          table,
          'baseline_range_inference_eligible_count',
          row,
        ),
        flickrCandidateCount: requiredCount(table, 'flickr_candidate_count', row),
        flickrVisuallyEligibleCount: requiredCount(
          table,
          'flickr_visually_eligible_count',
          row,
        ),
        reviewedPositiveCount: requiredCount(table, 'reviewed_positive_count', row),
        reviewedNegativeCount: requiredCount(table, 'reviewed_negative_count', row),
        uncertainCount: requiredCount(table, 'uncertain_count', row),
        pendingCount: requiredCount(table, 'pending_count', row),
        mediaFailureCount: requiredCount(table, 'media_failure_count', row),
        skippedCount: requiredCount(table, 'skipped_count', row),
        releaseReadyCount: requiredCount(table, 'release_ready_count', row),
        baselineOnlyCell: requiredBoolean(table, 'baseline_only_cell', row),
        matchedCell: requiredBoolean(table, 'matched_cell', row),
        candidateOnlyCell: requiredBoolean(table, 'candidate_only_cell', row),
        reviewedAdditionalCell: requiredBoolean(
          table,
          'reviewed_additional_cell',
          row,
        ),
        releaseReadyAdditionalCell: requiredBoolean(
          table,
          'release_ready_additional_cell',
          row,
        ),
        nearestBaselineDistanceKm: nullableFiniteNumber(
          table,
          'nearest_baseline_distance_km',
          row,
        ),
        dataDeficientState: requiredDataDeficientState(table, row),
      }),
    ),
  )
}

function requiredDataDeficientState(
  table: Awaited<ReturnType<AsyncDuckDBConnection['query']>>,
  row: number,
): GeographicImpactBrowserCell['dataDeficientState'] {
  const value = requiredString(table, 'data_deficient_state', row)
  if (!['sufficient', 'data_deficient', 'unavailable'].includes(value)) {
    throw new Error('Geographic Impact map returned an invalid data_deficient_state')
  }
  return value as GeographicImpactBrowserCell['dataDeficientState']
}

function requiredString(
  table: Awaited<ReturnType<AsyncDuckDBConnection['query']>>,
  column: string,
  row: number,
): string {
  const value = table.getChild(column)?.get(row)
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Geographic Impact map returned an invalid ${column}`)
  }
  return value
}

function nullableString(
  table: Awaited<ReturnType<AsyncDuckDBConnection['query']>>,
  column: string,
  row: number,
): string | null {
  const value = table.getChild(column)?.get(row)
  if (value === null) return null
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Geographic Impact map returned an invalid ${column}`)
  }
  return value
}

function requiredCount(
  table: Awaited<ReturnType<AsyncDuckDBConnection['query']>>,
  column: string,
  row: number,
): number {
  const value = table.getChild(column)?.get(row)
  const count = typeof value === 'bigint' ? Number(value) : value
  if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) {
    throw new Error(`Geographic Impact map returned an invalid ${column}`)
  }
  return count
}

function requiredFiniteNumber(
  table: Awaited<ReturnType<AsyncDuckDBConnection['query']>>,
  column: string,
  row: number,
): number {
  const value = table.getChild(column)?.get(row)
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Geographic Impact map returned an invalid ${column}`)
  }
  return value
}

function nullableFiniteNumber(
  table: Awaited<ReturnType<AsyncDuckDBConnection['query']>>,
  column: string,
  row: number,
): number | null {
  const value = table.getChild(column)?.get(row)
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`Geographic Impact map returned an invalid ${column}`)
  }
  return value
}

function requiredBoolean(
  table: Awaited<ReturnType<AsyncDuckDBConnection['query']>>,
  column: string,
  row: number,
): boolean {
  const value = table.getChild(column)?.get(row)
  if (typeof value !== 'boolean') {
    throw new Error(`Geographic Impact map returned an invalid ${column}`)
  }
  return value
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException('Geographic Impact map query aborted', 'AbortError')
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}
