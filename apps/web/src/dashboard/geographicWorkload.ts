import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'

import type {
  AnalyticsArtifactProvenance,
  GeographyReferenceEvidenceBoundary,
  ParquetArtifactInput,
} from '../data/evidenceFacade'
import {
  createDuckDbRuntime,
  DUCKDB_ENGINE_VERSION,
  DUCKDB_WASM_PACKAGE_VERSION,
  loadLocalParquetExtension,
} from '../data/duckdbRuntime'

const ASSIGNMENTS_ARTIFACT = 'biominer-flickr-geo-assignments-parquet'
const CLUSTERS_ARTIFACT = 'biominer-flickr-geo-clusters-parquet'

export interface GeographicWorkloadInput {
  readonly artifacts: readonly ParquetArtifactInput[]
  readonly boundary: GeographyReferenceEvidenceBoundary
  readonly targetAcceptedTaxonKey: string
}

export interface GeographicWorkloadCluster {
  readonly id: string
  readonly latitude: number
  readonly longitude: number
  readonly memberImageCount: number
  readonly memberCellCount: number
  readonly outlierRecordCount: number
  readonly radiusP95Km: number
  readonly candidateDistributionOnly: true
}

export interface GeographicWorkloadResult {
  readonly backend: 'duckdb-wasm-parquet'
  readonly packageVersion: typeof DUCKDB_WASM_PACKAGE_VERSION
  readonly engineVersion: string
  readonly clusters: readonly GeographicWorkloadCluster[]
  readonly locatedClusterCount: number
  readonly noGeoRecordCount: number
  readonly unassignedGeotaggedRecordCount: number
  readonly outlierRecordCount: number
  readonly assignmentRecordCount: number
  readonly reviewDensity: null
  readonly reviewDensityReason: 'No materialized review queue or geographic review assignments are committed.'
  readonly referenceShortfalls: {
    readonly sourceCandidate: number
    readonly humanVerified: number
  }
  readonly artifacts: readonly AnalyticsArtifactProvenance[]
  readonly candidateDistributionOnly: true
  readonly scientificClaimAllowed: false
}

export async function executeGeographicWorkload(
  input: GeographicWorkloadInput,
): Promise<GeographicWorkloadResult> {
  if (input.artifacts.length !== 2) {
    throw new Error('Geographic workload requires exactly two verified Parquet artifacts')
  }
  const fileNames: Readonly<Record<string, string>> = {
    [ASSIGNMENTS_ARTIFACT]: 'flickr_geo_assignments.parquet',
    [CLUSTERS_ARTIFACT]: 'flickr_geo_clusters.parquet',
  }
  const { database } = await createDuckDbRuntime()
  let connection: AsyncDuckDBConnection | undefined
  const registeredFiles: string[] = []
  try {
    const engineVersion = await database.getVersion()
    if (engineVersion !== DUCKDB_ENGINE_VERSION) {
      throw new Error(
        `DuckDB engine ${engineVersion} differs from the pinned ${DUCKDB_ENGINE_VERSION} runtime`,
      )
    }
    for (const artifact of input.artifacts) {
      const fileName = fileNames[artifact.artifactId]
      if (
        fileName === undefined ||
        artifact.mediaType !== 'application/vnd.apache.parquet' ||
        registeredFiles.includes(fileName)
      ) {
        throw new Error(`Unexpected geographic workload artifact: ${artifact.artifactId}`)
      }
      await database.registerFileBuffer(fileName, artifact.bytes)
      registeredFiles.push(fileName)
    }
    if (registeredFiles.length !== 2) {
      throw new Error('Geographic workload artifact set is incomplete')
    }

    const parquetExtensionUrl = await loadLocalParquetExtension()
    connection = await database.connect()
    await connection.query(`SET autoinstall_known_extensions = false;
      SET autoload_known_extensions = false;
      LOAD ${sqlLiteral(parquetExtensionUrl)}`)
    await connection.query(`CREATE VIEW flickr_geo_assignments AS
      SELECT * FROM read_parquet('flickr_geo_assignments.parquet')`)
    await connection.query(`CREATE VIEW flickr_geo_clusters AS
      SELECT * FROM read_parquet('flickr_geo_clusters.parquet')`)

    const summary = await connection.query(`SELECT
        count(*) AS assignment_record_count,
        count(*) FILTER (WHERE outlier) AS outlier_record_count,
        count(*) FILTER (WHERE geo_cluster_id = 'unassigned_geo') AS unassigned_record_count,
        count(*) FILTER (
          WHERE geo_cluster_id = 'no_geo' OR fallback_scope = 'no_geo'
        ) AS no_geo_record_count,
        count(DISTINCT geo_cluster_id) FILTER (
          WHERE starts_with(geo_cluster_id, 'geo:')
        ) AS located_cluster_count
      FROM flickr_geo_assignments`)
    if (summary.numRows !== 1) {
      throw new Error('Geographic workload summary did not return one row')
    }

    const clusterRows = await connection.query(`WITH assignment_stats AS (
        SELECT
          geo_cluster_id,
          count(*) FILTER (WHERE outlier) AS outlier_record_count
        FROM flickr_geo_assignments
        GROUP BY geo_cluster_id
      )
      SELECT
        cluster.geo_cluster_id,
        cluster.target_accepted_taxon_key,
        cluster.member_image_count,
        cluster.member_cell_count,
        cluster.centroid.latitude AS latitude,
        cluster.centroid.longitude AS longitude,
        cluster.radius_quantiles_km.p95 AS radius_p95_km,
        cluster.candidate_distribution_only,
        coalesce(stats.outlier_record_count, 0) AS outlier_record_count
      FROM flickr_geo_clusters AS cluster
      LEFT JOIN assignment_stats AS stats USING (geo_cluster_id)
      WHERE starts_with(cluster.geo_cluster_id, 'geo:')
      ORDER BY cluster.member_image_count DESC, cluster.geo_cluster_id`)

    const locatedClusterCount = requiredCount(summary, 'located_cluster_count', 0)
    const assignmentRecordCount = requiredCount(summary, 'assignment_record_count', 0)
    const noGeoRecordCount = requiredCount(summary, 'no_geo_record_count', 0)
    const unassignedGeotaggedRecordCount = requiredCount(
      summary,
      'unassigned_record_count',
      0,
    )
    const outlierRecordCount = requiredCount(summary, 'outlier_record_count', 0)
    const boundary = input.boundary.geography
    if (
      locatedClusterCount !== boundary.locatedClusterCount ||
      clusterRows.numRows !== locatedClusterCount ||
      unassignedGeotaggedRecordCount !== boundary.unassignedGeotaggedRecordCount ||
      outlierRecordCount !== boundary.outlierRecordCount ||
      assignmentRecordCount !== 13_501
    ) {
      throw new Error('Parquet workload counts differ from the verified geographic summary')
    }

    const clusters = Object.freeze(
      Array.from({ length: clusterRows.numRows }, (_, index) => {
        const targetAcceptedTaxonKey = requiredString(
          clusterRows,
          'target_accepted_taxon_key',
          index,
        )
        const candidateDistributionOnly = requiredBoolean(
          clusterRows,
          'candidate_distribution_only',
          index,
        )
        const latitude = requiredFiniteNumber(clusterRows, 'latitude', index)
        const longitude = requiredFiniteNumber(clusterRows, 'longitude', index)
        const memberImageCount = requiredCount(clusterRows, 'member_image_count', index)
        if (
          targetAcceptedTaxonKey !== input.targetAcceptedTaxonKey ||
          !candidateDistributionOnly ||
          latitude < -90 ||
          latitude > 90 ||
          longitude < -180 ||
          longitude > 180 ||
          memberImageCount < 1
        ) {
          throw new Error('Cluster row exceeds the candidate-workload boundary')
        }
        return Object.freeze({
          id: requiredString(clusterRows, 'geo_cluster_id', index),
          latitude,
          longitude,
          memberImageCount,
          memberCellCount: requiredCount(clusterRows, 'member_cell_count', index),
          outlierRecordCount: requiredCount(clusterRows, 'outlier_record_count', index),
          radiusP95Km: requiredFiniteNumber(clusterRows, 'radius_p95_km', index),
          candidateDistributionOnly: true as const,
        })
      }),
    )
    if (clusters.some(({ radiusP95Km }) => radiusP95Km < 0)) {
      throw new Error('Cluster dispersion radius cannot be negative')
    }

    return Object.freeze({
      backend: 'duckdb-wasm-parquet',
      packageVersion: DUCKDB_WASM_PACKAGE_VERSION,
      engineVersion,
      clusters,
      locatedClusterCount,
      noGeoRecordCount,
      unassignedGeotaggedRecordCount,
      outlierRecordCount,
      assignmentRecordCount,
      reviewDensity: null,
      reviewDensityReason:
        'No materialized review queue or geographic review assignments are committed.',
      referenceShortfalls: Object.freeze({
        sourceCandidate: input.boundary.reference.sourceCandidateShortfall,
        humanVerified: input.boundary.reference.humanVerifiedShortfall,
      }),
      artifacts: provenanceOnly(input.artifacts),
      candidateDistributionOnly: true,
      scientificClaimAllowed: false,
    })
  } finally {
    await connection?.close()
    if (registeredFiles.length > 0) {
      await database.dropFiles(registeredFiles)
    }
    await database.terminate()
  }
}

function provenanceOnly(
  artifacts: readonly ParquetArtifactInput[],
): readonly AnalyticsArtifactProvenance[] {
  return Object.freeze(
    artifacts.map((artifact) =>
      Object.freeze({
        artifactId: artifact.artifactId,
        mediaType: artifact.mediaType,
        path: artifact.path,
        sizeBytes: artifact.sizeBytes,
        sha256: artifact.sha256,
        recordCount: artifact.recordCount,
        producerSha: artifact.producerSha,
      }),
    ),
  )
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

function requiredString(
  table: Awaited<ReturnType<AsyncDuckDBConnection['query']>>,
  column: string,
  row: number,
): string {
  const value = table.getChild(column)?.get(row)
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`DuckDB geographic workload returned an invalid ${column}`)
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
    throw new Error(`DuckDB geographic workload returned an invalid ${column}`)
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
    throw new Error(`DuckDB geographic workload returned an invalid ${column}`)
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
    throw new Error(`DuckDB geographic workload returned an invalid ${column}`)
  }
  return value
}
