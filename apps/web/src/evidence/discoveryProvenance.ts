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
  if (input.artifacts.length !== 2) {
    throw new Error('Discovery provenance requires exactly two verified Parquet artifacts')
  }
  const expectedArtifacts: Readonly<Record<string, string>> = {
    [QUERY_HITS_ARTIFACT]: 'flickr_query_hits.parquet',
    [GEOGRAPHY_ARTIFACT]: 'flickr_geography.parquet',
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
        geography.coordinate_quality
      FROM association_counts AS counts
      INNER JOIN flickr_geography AS geography
        ON counts.source = geography.source
       AND counts.flickr_photo_id = geography.flickr_photo_id
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
