import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'

import impactManifest from '../../../../demo/source/biominer_phase14/geographic_impact/geographic_impact_manifest.json'
import impactCellsUrl from '../../../../demo/source/biominer_phase14/geographic_impact/geographic_impact_cells.parquet?url'
import geographyManifest from '../../../../demo/source/biominer_phase14/flickr_geography/flickr_geography_verification_manifest.json'
import geographyUrl from '../../../../demo/source/biominer_phase14/flickr_geography/flickr_geography_verification.parquet?url'
import {
  createDuckDbRuntime,
  DUCKDB_ENGINE_VERSION,
  loadLocalParquetExtension,
} from '../data/duckdbRuntime'
import type { DiscoveryProvenanceResult } from './discoveryProvenance'
import { selectFinestSupportedPrecisionCell } from './recordPrecisionPolicy'

const GEOGRAPHY_FILE_NAME = 'record_flickr_geography.parquet'
const IMPACT_FILE_NAME = 'record_geographic_impact_cells.parquet'
const MAXIMUM_NEARBY_BASELINE_CELLS = 8

const geographyArtifact = geographyManifest.artifact
const impactArtifact = impactManifest.artifacts.find(
  ({ logical_name }) => logical_name === 'geographic_impact_cells',
)
if (
  impactArtifact === undefined ||
  impactArtifact.availability !== 'available' ||
  impactArtifact.sha256 === null ||
  impactArtifact.byte_size === null
) {
  throw new Error('Record Geographic Impact artifact is unavailable or incomplete')
}
const verifiedImpactArtifact = Object.freeze({
  sha256: impactArtifact.sha256,
  byteSize: impactArtifact.byte_size,
})

export interface RecordPrecisionCell {
  readonly spatialResolution: number
  readonly spatialCellId: string | null
  readonly supported: boolean
  readonly supportStatus: string
}

export interface RecordBaselineCellContext {
  readonly spatialCellId: string
  readonly latitude: number
  readonly longitude: number
  readonly baselineRangeInferenceEligibleCount: number
}

export interface RecordGeographicContext {
  readonly sourceId: string
  readonly sourcePhotoId: string
  readonly sourceRecordHash: string
  readonly candidateCoordinate: {
    readonly latitude: number
    readonly longitude: number
    readonly quality: string
    readonly accuracyLevel: number
  }
  readonly precisionCells: readonly RecordPrecisionCell[]
  readonly selectedCell: {
    readonly spatialResolution: number
    readonly spatialCellId: string
    readonly latitude: number
    readonly longitude: number
    readonly countryCode: string | null
    readonly country: string | null
    readonly admin1: string | null
  }
  readonly impact: {
    readonly baselineUnionCount: number
    readonly baselineRangeInferenceEligibleCount: number
    readonly flickrCandidateCount: number
    readonly reviewedPositiveCount: number
    readonly reviewedNegativeCount: number
    readonly uncertainCount: number
    readonly pendingCount: number
    readonly releaseReadyCount: number
    readonly candidateOnlyCell: boolean
    readonly reviewedAdditionalCell: boolean
    readonly releaseReadyAdditionalCell: boolean
    readonly nearestBaselineDistanceStatus: string
    readonly nearestBaselineDistanceKm: number | null
    readonly nearestBaselineCellId: string | null
    readonly dataDeficientState: string
  }
  readonly review: {
    readonly campaignId: string | null
    readonly itemId: string | null
    readonly queueState: string
    readonly state: string
    readonly reviewerAssignmentCount: number
    readonly effectiveReviewCount: number
    readonly decisiveReviewCount: number
    readonly humanReviewed: boolean
    readonly humanSupported: boolean
  }
  readonly nearbyBaselineCells: readonly RecordBaselineCellContext[]
  readonly sources: {
    readonly flickrGeographySha256: string
    readonly geographicImpactCellsSha256: string
    readonly baselineSnapshotId: string
    readonly flickrSnapshotId: string
  }
  readonly scientificClaimAllowed: false
}

export type RecordGeographicContextLoadState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'failure'; readonly message: string }
  | { readonly status: 'available'; readonly context: RecordGeographicContext }

export async function loadRecordGeographicContext(
  result: DiscoveryProvenanceResult,
  signal: AbortSignal,
): Promise<RecordGeographicContext> {
  throwIfAborted(signal)
  const [geographyBytes, impactBytes] = await Promise.all([
    verifiedSameOriginBytes(
      geographyUrl,
      geographyArtifact.sha256,
      geographyArtifact.byte_count,
      'Record Flickr geography artifact',
      signal,
    ),
    verifiedSameOriginBytes(
      impactCellsUrl,
      verifiedImpactArtifact.sha256,
      verifiedImpactArtifact.byteSize,
      'Record Geographic Impact cells artifact',
      signal,
    ),
  ])
  throwIfAborted(signal)
  const { database } = await createDuckDbRuntime()
  let connection: AsyncDuckDBConnection | undefined
  try {
    if ((await database.getVersion()) !== DUCKDB_ENGINE_VERSION) {
      throw new Error('Record geography DuckDB engine version differs')
    }
    await database.registerFileBuffer(GEOGRAPHY_FILE_NAME, geographyBytes)
    await database.registerFileBuffer(IMPACT_FILE_NAME, impactBytes)
    const parquetExtensionUrl = await loadLocalParquetExtension()
    connection = await database.connect()
    await connection.query(`SET autoinstall_known_extensions = false;
      SET autoload_known_extensions = false;
      LOAD ${sqlLiteral(parquetExtensionUrl)}`)
    throwIfAborted(signal)
    const cells = await connection.query(buildRecordGeographicContextSql(result))
    throwIfAborted(signal)
    if (cells.numRows === 0 || cells.numRows > impactManifest.spatial_resolutions.length) {
      throw new Error('Record geography returned an invalid precision-cell set')
    }
    const decoded = decodePrecisionCells(cells, result)
    const selected = selectFinestSupportedPrecisionCell(decoded)
    if (selected === null || selected.spatialCellId === null || selected.impact === null) {
      throw new Error('Record geography has no supported Geographic Impact cell')
    }
    const nearby = await connection.query(
      buildNearbyBaselineCellsSql(result, selected.spatialResolution, selected.impact.nearestBaselineCellId),
    )
    throwIfAborted(signal)
    const nearbyBaselineCells = decodeNearbyBaselineCells(nearby)
    if (
      selected.impact.nearestBaselineCellId !== null &&
      !nearbyBaselineCells.some(
        ({ spatialCellId }) => spatialCellId === selected.impact?.nearestBaselineCellId,
      )
    ) {
      throw new Error('Record nearest baseline cell is missing from bounded map context')
    }
    return Object.freeze({
      sourceId: result.sourceId,
      sourcePhotoId: result.sourcePhotoId,
      sourceRecordHash: result.sourceRecordHash,
      candidateCoordinate: Object.freeze({
        latitude: selected.candidateLatitude,
        longitude: selected.candidateLongitude,
        quality: selected.coordinateQuality,
        accuracyLevel: selected.coordinateAccuracy,
      }),
      precisionCells: Object.freeze(
        decoded.map(({ spatialResolution, spatialCellId, supported, supportStatus }) =>
          Object.freeze({ spatialResolution, spatialCellId, supported, supportStatus }),
        ),
      ),
      selectedCell: Object.freeze({
        spatialResolution: selected.spatialResolution,
        spatialCellId: selected.spatialCellId,
        latitude: selected.impact.latitude,
        longitude: selected.impact.longitude,
        countryCode: selected.impact.countryCode,
        country: selected.impact.country,
        admin1: selected.impact.admin1,
      }),
      impact: selected.impact,
      review: selected.review,
      nearbyBaselineCells,
      sources: Object.freeze({
        flickrGeographySha256: geographyArtifact.sha256,
        geographicImpactCellsSha256: verifiedImpactArtifact.sha256,
        baselineSnapshotId: impactManifest.baseline_snapshot_id,
        flickrSnapshotId: impactManifest.flickr_snapshot_id,
      }),
      scientificClaimAllowed: false,
    })
  } finally {
    await connection?.close()
    await database.dropFiles()
    await database.terminate()
  }
}

export function buildRecordGeographicContextSql(result: DiscoveryProvenanceResult): string {
  return `SELECT
      geography.spatial_resolution,
      geography.spatial_cell_id,
      geography.cell_supported,
      geography.cell_support_status,
      geography.latitude AS candidate_latitude,
      geography.longitude AS candidate_longitude,
      geography.coordinate_quality,
      geography.coordinate_accuracy,
      geography.source_record_hash,
      geography.verification_campaign_id,
      geography.verification_item_id,
      geography.verification_queue_state,
      geography.human_review_state,
      geography.reviewer_assignment_count,
      geography.effective_review_count,
      geography.decisive_review_count,
      geography.human_reviewed,
      geography.human_supported,
      impact.centroid_latitude,
      impact.centroid_longitude,
      impact.country_code,
      impact.country,
      impact.admin1,
      impact.baseline_union_count,
      impact.baseline_range_inference_eligible_count,
      impact.flickr_candidate_count,
      impact.reviewed_positive_count,
      impact.reviewed_negative_count,
      impact.uncertain_count,
      impact.pending_count,
      impact.release_ready_count,
      impact.candidate_only_cell,
      impact.reviewed_additional_cell,
      impact.release_ready_additional_cell,
      impact.nearest_baseline_distance_status,
      impact.nearest_baseline_distance_km,
      impact.nearest_baseline_cell_id,
      impact.data_deficient_state
    FROM read_parquet(${sqlLiteral(GEOGRAPHY_FILE_NAME)}) AS geography
    LEFT JOIN read_parquet(${sqlLiteral(IMPACT_FILE_NAME)}) AS impact
      ON geography.project_id = impact.project_id
     AND geography.run_id = impact.run_id
     AND geography.target_accepted_taxon_key = impact.accepted_taxon_key
     AND geography.flickr_snapshot_id = impact.flickr_snapshot_id
     AND impact.baseline_snapshot_id = ${sqlLiteral(impactManifest.baseline_snapshot_id)}
     AND geography.spatial_resolution = impact.spatial_resolution
     AND geography.spatial_cell_id = impact.spatial_cell_id
    WHERE geography.project_id = ${sqlLiteral(impactManifest.project_id)}
      AND geography.run_id = ${sqlLiteral(impactManifest.run_id)}
      AND geography.target_accepted_taxon_key = ${sqlLiteral(impactManifest.accepted_taxon_key)}
      AND geography.flickr_snapshot_id = ${sqlLiteral(impactManifest.flickr_snapshot_id)}
      AND geography.source = ${sqlLiteral(result.source)}
      AND geography.flickr_photo_id = ${sqlLiteral(result.sourcePhotoId)}
      AND geography.source_record_hash = ${sqlLiteral(result.sourceRecordHash)}
    ORDER BY geography.spatial_resolution DESC`
}

export function buildNearbyBaselineCellsSql(
  result: DiscoveryProvenanceResult,
  spatialResolution: number,
  nearestBaselineCellId: string | null,
): string {
  const nearestOrder =
    nearestBaselineCellId === null
      ? '1'
      : `CASE WHEN spatial_cell_id = ${sqlLiteral(nearestBaselineCellId)} THEN 0 ELSE 1 END`
  return `SELECT
      spatial_cell_id,
      centroid_latitude,
      centroid_longitude,
      baseline_range_inference_eligible_count
    FROM read_parquet(${sqlLiteral(IMPACT_FILE_NAME)})
    WHERE project_id = ${sqlLiteral(impactManifest.project_id)}
      AND run_id = ${sqlLiteral(impactManifest.run_id)}
      AND accepted_taxon_key = ${sqlLiteral(impactManifest.accepted_taxon_key)}
      AND baseline_snapshot_id = ${sqlLiteral(impactManifest.baseline_snapshot_id)}
      AND flickr_snapshot_id = ${sqlLiteral(impactManifest.flickr_snapshot_id)}
      AND spatial_resolution = ${spatialResolution}
      AND baseline_range_inference_eligible_count > 0
    ORDER BY ${nearestOrder},
      2 * 6371.0088 * asin(sqrt(
        pow(sin(radians(centroid_latitude - ${result.coordinate.latitude}) / 2), 2) +
        cos(radians(${result.coordinate.latitude})) * cos(radians(centroid_latitude)) *
        pow(sin(radians(centroid_longitude - ${result.coordinate.longitude}) / 2), 2)
      )), spatial_cell_id
    LIMIT ${MAXIMUM_NEARBY_BASELINE_CELLS}`
}

interface DecodedPrecisionCell extends RecordPrecisionCell {
  readonly candidateLatitude: number
  readonly candidateLongitude: number
  readonly coordinateQuality: string
  readonly coordinateAccuracy: number
  readonly review: RecordGeographicContext['review']
  readonly impact: RecordGeographicContext['impact'] & {
    readonly latitude: number
    readonly longitude: number
    readonly countryCode: string | null
    readonly country: string | null
    readonly admin1: string | null
  } | null
}

function decodePrecisionCells(
  table: Awaited<ReturnType<AsyncDuckDBConnection['query']>>,
  result: DiscoveryProvenanceResult,
): readonly DecodedPrecisionCell[] {
  const cells = Array.from({ length: table.numRows }, (_, row): DecodedPrecisionCell => {
    const sourceRecordHash = requiredString(table, 'source_record_hash', row)
    const candidateLatitude = requiredFiniteNumber(table, 'candidate_latitude', row)
    const candidateLongitude = requiredFiniteNumber(table, 'candidate_longitude', row)
    const coordinateQuality = requiredString(table, 'coordinate_quality', row)
    const coordinateAccuracy = requiredFiniteNumber(table, 'coordinate_accuracy', row)
    if (
      sourceRecordHash !== result.sourceRecordHash ||
      candidateLatitude !== result.coordinate.latitude ||
      candidateLongitude !== result.coordinate.longitude ||
      coordinateQuality !== result.coordinateQuality ||
      coordinateAccuracy !== result.coordinate.accuracyLevel
    ) {
      throw new Error('Record geography identity differs from discovery provenance')
    }
    const supported = requiredBoolean(table, 'cell_supported', row)
    const spatialCellId = nullableString(table, 'spatial_cell_id', row)
    if (supported !== (spatialCellId !== null)) {
      throw new Error('Record precision support differs from its cell identity')
    }
    const hasImpact = table.getChild('centroid_latitude')?.get(row) !== null
    if (supported !== hasImpact) {
      throw new Error('Record supported cell is missing its Geographic Impact row')
    }
    return Object.freeze({
      spatialResolution: requiredCount(table, 'spatial_resolution', row),
      spatialCellId,
      supported,
      supportStatus: requiredString(table, 'cell_support_status', row),
      candidateLatitude,
      candidateLongitude,
      coordinateQuality,
      coordinateAccuracy,
      review: Object.freeze({
        campaignId: nullableString(table, 'verification_campaign_id', row),
        itemId: nullableString(table, 'verification_item_id', row),
        queueState: requiredString(table, 'verification_queue_state', row),
        state: requiredString(table, 'human_review_state', row),
        reviewerAssignmentCount: requiredCount(table, 'reviewer_assignment_count', row),
        effectiveReviewCount: requiredCount(table, 'effective_review_count', row),
        decisiveReviewCount: requiredCount(table, 'decisive_review_count', row),
        humanReviewed: requiredBoolean(table, 'human_reviewed', row),
        humanSupported: requiredBoolean(table, 'human_supported', row),
      }),
      impact: hasImpact
        ? Object.freeze({
            latitude: requiredFiniteNumber(table, 'centroid_latitude', row),
            longitude: requiredFiniteNumber(table, 'centroid_longitude', row),
            countryCode: nullableString(table, 'country_code', row),
            country: nullableString(table, 'country', row),
            admin1: nullableString(table, 'admin1', row),
            baselineUnionCount: requiredCount(table, 'baseline_union_count', row),
            baselineRangeInferenceEligibleCount: requiredCount(
              table,
              'baseline_range_inference_eligible_count',
              row,
            ),
            flickrCandidateCount: requiredCount(table, 'flickr_candidate_count', row),
            reviewedPositiveCount: requiredCount(table, 'reviewed_positive_count', row),
            reviewedNegativeCount: requiredCount(table, 'reviewed_negative_count', row),
            uncertainCount: requiredCount(table, 'uncertain_count', row),
            pendingCount: requiredCount(table, 'pending_count', row),
            releaseReadyCount: requiredCount(table, 'release_ready_count', row),
            candidateOnlyCell: requiredBoolean(table, 'candidate_only_cell', row),
            reviewedAdditionalCell: requiredBoolean(table, 'reviewed_additional_cell', row),
            releaseReadyAdditionalCell: requiredBoolean(
              table,
              'release_ready_additional_cell',
              row,
            ),
            nearestBaselineDistanceStatus: requiredString(
              table,
              'nearest_baseline_distance_status',
              row,
            ),
            nearestBaselineDistanceKm: nullableFiniteNumber(
              table,
              'nearest_baseline_distance_km',
              row,
            ),
            nearestBaselineCellId: nullableString(table, 'nearest_baseline_cell_id', row),
            dataDeficientState: requiredString(table, 'data_deficient_state', row),
          })
        : null,
    })
  })
  const resolutions = new Set(cells.map(({ spatialResolution }) => spatialResolution))
  if (resolutions.size !== cells.length) {
    throw new Error('Record geography contains a duplicate spatial resolution')
  }
  return Object.freeze(cells)
}

function decodeNearbyBaselineCells(
  table: Awaited<ReturnType<AsyncDuckDBConnection['query']>>,
): readonly RecordBaselineCellContext[] {
  if (table.numRows > MAXIMUM_NEARBY_BASELINE_CELLS) {
    throw new Error('Record baseline-cell context exceeded its bound')
  }
  return Object.freeze(
    Array.from({ length: table.numRows }, (_, row) =>
      Object.freeze({
        spatialCellId: requiredString(table, 'spatial_cell_id', row),
        latitude: requiredFiniteNumber(table, 'centroid_latitude', row),
        longitude: requiredFiniteNumber(table, 'centroid_longitude', row),
        baselineRangeInferenceEligibleCount: requiredCount(
          table,
          'baseline_range_inference_eligible_count',
          row,
        ),
      }),
    ),
  )
}

async function verifiedSameOriginBytes(
  assetUrl: string,
  expectedSha256: string,
  expectedByteCount: number,
  label: string,
  signal: AbortSignal,
): Promise<Uint8Array<ArrayBuffer>> {
  const url = new URL(assetUrl, window.location.href)
  if (url.origin !== window.location.origin) throw new Error(`${label} must load locally`)
  const response = await fetch(url, {
    cache: 'force-cache',
    credentials: 'same-origin',
    signal,
  })
  if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength !== expectedByteCount) {
    throw new Error(`${label} byte count differs from its manifest`)
  }
  const digest = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
  if (digest !== expectedSha256) throw new Error(`${label} checksum differs from its manifest`)
  return bytes
}

function requiredString(
  table: Awaited<ReturnType<AsyncDuckDBConnection['query']>>,
  column: string,
  row: number,
): string {
  const value = table.getChild(column)?.get(row)
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Record geography returned an invalid ${column}`)
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
    throw new Error(`Record geography returned an invalid ${column}`)
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
    throw new Error(`Record geography returned an invalid ${column}`)
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
    throw new Error(`Record geography returned an invalid ${column}`)
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
    throw new Error(`Record geography returned an invalid ${column}`)
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
    throw new Error(`Record geography returned an invalid ${column}`)
  }
  return value
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException('Record geography query aborted', 'AbortError')
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}
