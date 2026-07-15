import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'

import type {
  AnalyticsArtifactProvenance,
  DiscoveryProvenanceInput,
} from '../data/evidenceFacade'
import {
  createDuckDbRuntime,
  DUCKDB_ENGINE_VERSION,
  DUCKDB_WASM_PACKAGE_VERSION,
  loadLocalParquetExtension,
} from '../data/duckdbRuntime'

const QUERY_HITS_ARTIFACT = 'biominer-flickr-query-hits-parquet'
const GEOGRAPHY_ARTIFACT = 'biominer-flickr-geography-parquet'
const ASSIGNMENTS_ARTIFACT = 'biominer-flickr-geo-assignments-parquet'
const CLUSTERS_ARTIFACT = 'biominer-flickr-geo-clusters-parquet'

export interface QueryTierParts {
  readonly rank: string
  readonly trustTier: string
  readonly searchField: string
}

export interface DiscoveryQueryAssociation extends QueryTierParts {
  readonly queryHash: string
  readonly queryTier: string
  readonly keyword: string
}

export interface DiscoveryProvenanceResult {
  readonly backend: 'duckdb-wasm-parquet'
  readonly packageVersion: typeof DUCKDB_WASM_PACKAGE_VERSION
  readonly engineVersion: string
  readonly source: string
  readonly sourcePhotoId: string
  readonly sourceId: string
  readonly sourceRecordHash: string
  readonly coordinateQuality: string
  readonly coordinate: {
    readonly latitude: number
    readonly longitude: number
    readonly accuracyLevel: number
    readonly source: string
    readonly warning: string | null
    readonly uncertaintyMeters: null
  }
  readonly cluster: {
    readonly id: string
    readonly targetAcceptedTaxonKey: string
    readonly distanceToMedoidKm: number
    readonly assignmentMethod: string
    readonly fallbackScope: string | null
    readonly outlier: boolean
    readonly memberImageCount: number
    readonly memberCellCount: number
    readonly centroidLatitude: number
    readonly centroidLongitude: number
    readonly radiusP95Km: number
    readonly candidateDistributionOnly: true
  }
  readonly associationCount: number
  readonly associations: readonly DiscoveryQueryAssociation[]
  readonly artifacts: readonly AnalyticsArtifactProvenance[]
  readonly selectionMethod: 'most-query-associations-then-source-id'
  readonly scientificClaimAllowed: false
}

export function parseQueryTier(queryTier: string): QueryTierParts {
  const parts = queryTier.split(':')
  const [rank, trustTier, searchField] = parts
  if (
    parts.length !== 3 ||
    rank === undefined ||
    trustTier === undefined ||
    searchField === undefined ||
    rank.length === 0 ||
    trustTier.length === 0 ||
    searchField.length === 0
  ) {
    throw new Error(`Discovery query tier has an unsupported shape: ${queryTier}`)
  }
  return Object.freeze({ rank, trustTier, searchField })
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
    throw new Error(`DuckDB discovery provenance returned an invalid ${column}`)
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
  if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 1) {
    throw new Error(`DuckDB discovery provenance returned an invalid ${column}`)
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
    throw new Error(`DuckDB discovery provenance returned an invalid ${column}`)
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
    throw new Error(`DuckDB discovery provenance returned an invalid ${column}`)
  }
  return value
}

function optionalString(
  table: Awaited<ReturnType<AsyncDuckDBConnection['query']>>,
  column: string,
  row: number,
): string | null {
  const value = table.getChild(column)?.get(row)
  if (value === null) {
    return null
  }
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`DuckDB discovery provenance returned an invalid ${column}`)
  }
  return value
}

function provenanceOnly(
  artifacts: DiscoveryProvenanceInput['artifacts'],
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

export async function executeDiscoveryProvenance(
  input: DiscoveryProvenanceInput,
): Promise<DiscoveryProvenanceResult> {
  if (input.artifacts.length !== 4) {
    throw new Error('Discovery context requires exactly four verified Parquet artifacts')
  }
  const expectedArtifacts: Readonly<Record<string, string>> = {
    [QUERY_HITS_ARTIFACT]: 'flickr_query_hits.parquet',
    [GEOGRAPHY_ARTIFACT]: 'flickr_geography.parquet',
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
      const fileName = expectedArtifacts[artifact.artifactId]
      if (fileName === undefined || artifact.mediaType !== 'application/vnd.apache.parquet') {
        throw new Error(`Unexpected discovery artifact: ${artifact.artifactId}`)
      }
      if (registeredFiles.includes(fileName)) {
        throw new Error(`Discovery artifact is duplicated: ${artifact.artifactId}`)
      }
      await database.registerFileBuffer(fileName, artifact.bytes)
      registeredFiles.push(fileName)
    }
    if (registeredFiles.length !== Object.keys(expectedArtifacts).length) {
      throw new Error('Discovery provenance artifact set is incomplete')
    }

    const parquetExtensionUrl = await loadLocalParquetExtension()
    connection = await database.connect()
    await connection.query(`SET autoinstall_known_extensions = false;
      SET autoload_known_extensions = false;
      LOAD ${sqlLiteral(parquetExtensionUrl)}`)
    await connection.query(`CREATE VIEW flickr_query_hits AS
      SELECT * FROM read_parquet('flickr_query_hits.parquet')`)
    await connection.query(`CREATE VIEW flickr_geography AS
      SELECT * FROM read_parquet('flickr_geography.parquet')`)
    await connection.query(`CREATE VIEW flickr_geo_assignments AS
      SELECT * FROM read_parquet('flickr_geo_assignments.parquet')`)
    await connection.query(`CREATE VIEW flickr_geo_clusters AS
      SELECT * FROM read_parquet('flickr_geo_clusters.parquet')`)

    const representative = await connection.query(`WITH association_counts AS (
        SELECT source, flickr_photo_id, count(*) AS association_count
        FROM flickr_query_hits
        GROUP BY source, flickr_photo_id
      )
      SELECT
        counts.source,
        counts.flickr_photo_id,
        counts.association_count,
        geography.source_record_hash,
        geography.coordinate_quality,
        geography.latitude,
        geography.longitude,
        geography.coordinate_accuracy,
        geography.coordinate_source,
        geography.geography_warning,
        assignment.target_accepted_taxon_key,
        assignment.geo_cluster_id,
        assignment.distance_to_medoid_km,
        assignment.assignment_method,
        assignment.fallback_scope,
        assignment.outlier,
        cluster.member_image_count,
        cluster.member_cell_count,
        cluster.centroid.latitude AS cluster_centroid_latitude,
        cluster.centroid.longitude AS cluster_centroid_longitude,
        cluster.radius_quantiles_km.p95 AS cluster_radius_p95_km,
        cluster.candidate_distribution_only
      FROM association_counts AS counts
      INNER JOIN flickr_geography AS geography
        ON counts.source = geography.source
       AND counts.flickr_photo_id = geography.flickr_photo_id
      INNER JOIN flickr_geo_assignments AS assignment
        ON counts.source = assignment.source
       AND counts.flickr_photo_id = assignment.flickr_photo_id
      INNER JOIN flickr_geo_clusters AS cluster
        ON assignment.geo_cluster_id = cluster.geo_cluster_id
      ORDER BY counts.association_count DESC, counts.source, counts.flickr_photo_id
      LIMIT 1`)
    if (representative.numRows !== 1) {
      throw new Error('Verified discovery artifacts contain no inspectable source record')
    }

    const source = requiredString(representative, 'source', 0)
    const sourcePhotoId = requiredString(representative, 'flickr_photo_id', 0)
    const associationCount = requiredCount(representative, 'association_count', 0)
    const sourceRecordHash = requiredString(representative, 'source_record_hash', 0)
    const coordinateQuality = requiredString(representative, 'coordinate_quality', 0)
    const candidateDistributionOnly = requiredBoolean(
      representative,
      'candidate_distribution_only',
      0,
    )
    if (!candidateDistributionOnly) {
      throw new Error('Discovery geography cannot be promoted beyond candidate distribution')
    }
    const associationRows = await connection.query(`SELECT query_hash, query_tier, search_term
      FROM flickr_query_hits
      WHERE source = ${sqlLiteral(source)}
        AND flickr_photo_id = ${sqlLiteral(sourcePhotoId)}
      ORDER BY query_tier, search_term, query_hash`)
    if (associationRows.numRows !== associationCount) {
      throw new Error('Discovery association count changed between verified queries')
    }
    const associations = Object.freeze(
      Array.from({ length: associationRows.numRows }, (_, index) => {
        const queryTier = requiredString(associationRows, 'query_tier', index)
        return Object.freeze({
          queryHash: requiredString(associationRows, 'query_hash', index),
          queryTier,
          keyword: requiredString(associationRows, 'search_term', index),
          ...parseQueryTier(queryTier),
        })
      }),
    )

    return Object.freeze({
      backend: 'duckdb-wasm-parquet',
      packageVersion: DUCKDB_WASM_PACKAGE_VERSION,
      engineVersion,
      source,
      sourcePhotoId,
      sourceId: `${source}:${sourcePhotoId}`,
      sourceRecordHash,
      coordinateQuality,
      coordinate: Object.freeze({
        latitude: requiredFiniteNumber(representative, 'latitude', 0),
        longitude: requiredFiniteNumber(representative, 'longitude', 0),
        accuracyLevel: requiredFiniteNumber(representative, 'coordinate_accuracy', 0),
        source: requiredString(representative, 'coordinate_source', 0),
        warning: optionalString(representative, 'geography_warning', 0),
        uncertaintyMeters: null,
      }),
      cluster: Object.freeze({
        id: requiredString(representative, 'geo_cluster_id', 0),
        targetAcceptedTaxonKey: requiredString(
          representative,
          'target_accepted_taxon_key',
          0,
        ),
        distanceToMedoidKm: requiredFiniteNumber(
          representative,
          'distance_to_medoid_km',
          0,
        ),
        assignmentMethod: requiredString(representative, 'assignment_method', 0),
        fallbackScope: optionalString(representative, 'fallback_scope', 0),
        outlier: requiredBoolean(representative, 'outlier', 0),
        memberImageCount: requiredCount(representative, 'member_image_count', 0),
        memberCellCount: requiredCount(representative, 'member_cell_count', 0),
        centroidLatitude: requiredFiniteNumber(
          representative,
          'cluster_centroid_latitude',
          0,
        ),
        centroidLongitude: requiredFiniteNumber(
          representative,
          'cluster_centroid_longitude',
          0,
        ),
        radiusP95Km: requiredFiniteNumber(representative, 'cluster_radius_p95_km', 0),
        candidateDistributionOnly: true,
      }),
      associationCount,
      associations,
      artifacts: provenanceOnly(input.artifacts),
      selectionMethod: 'most-query-associations-then-source-id',
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
