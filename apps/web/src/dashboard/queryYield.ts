import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'

import type { AnalyticsArtifactProvenance, ParquetArtifactInput } from '../data/evidenceFacade'
import {
  createDuckDbRuntime,
  DUCKDB_ENGINE_VERSION,
  DUCKDB_WASM_PACKAGE_VERSION,
  loadLocalParquetExtension,
} from '../data/duckdbRuntime'

const QUERY_HITS_ARTIFACT = 'biominer-flickr-query-hits-parquet'

export type TaxonomicRank =
  | 'kingdom'
  | 'phylum'
  | 'class'
  | 'order'
  | 'family'
  | 'genus'
  | 'species'

export interface QueryYieldInput {
  readonly artifact: ParquetArtifactInput
  readonly expectedQueryHitCount: number
  readonly expectedUniqueImageCount: number
  readonly globalAdultRouteCount: 0
  readonly globalEvidenceRecordCount: 0
}

export interface QueryYieldRankRow {
  readonly rank: TaxonomicRank
  readonly label: string
  readonly status: 'measured' | 'unavailable'
  readonly sourceTier: string | null
  readonly hitCount: number | null
  readonly uniqueImageCount: number | null
  readonly representedSearchTermCount: number | null
  readonly representedQueryHashCount: number | null
  readonly logicalQueryCount: null
  readonly physicalRequestCount: null
  readonly marginalApiCost: null
}

export interface QueryYieldContextBucket {
  readonly hitCount: number
  readonly uniqueImageCount: number
  readonly representedSearchTermCount: number
  readonly representedQueryHashCount: number
  readonly termClassCount: number
}

export interface QueryYieldResult {
  readonly backend: 'duckdb-wasm-parquet'
  readonly packageVersion: typeof DUCKDB_WASM_PACKAGE_VERSION
  readonly engineVersion: string
  readonly ranks: readonly QueryYieldRankRow[]
  readonly context: QueryYieldContextBucket
  readonly queryHitCount: number
  readonly uniqueImageCount: number
  readonly globalAdultRouteCount: 0
  readonly globalEvidenceRecordCount: 0
  readonly logicalQueriesAvailable: false
  readonly physicalRequestsAvailable: false
  readonly marginalApiCostAvailable: false
  readonly artifact: AnalyticsArtifactProvenance
  readonly scientificClaimAllowed: false
}

const RANKS: readonly { readonly rank: TaxonomicRank; readonly label: string }[] = [
  { rank: 'kingdom', label: 'Kingdom' },
  { rank: 'phylum', label: 'Phylum' },
  { rank: 'class', label: 'Class' },
  { rank: 'order', label: 'Order' },
  { rank: 'family', label: 'Family tier' },
  { rank: 'genus', label: 'Genus tier' },
  { rank: 'species', label: 'Species-scientific tier' },
]

interface MeasuredBucket {
  readonly bucket: 'family' | 'genus' | 'species' | 'unassigned_context'
  readonly hitCount: number
  readonly uniqueImageCount: number
  readonly representedSearchTermCount: number
  readonly representedQueryHashCount: number
  readonly termClassCount: number
}

export async function executeQueryYield(input: QueryYieldInput): Promise<QueryYieldResult> {
  if (
    input.artifact.artifactId !== QUERY_HITS_ARTIFACT ||
    input.artifact.mediaType !== 'application/vnd.apache.parquet'
  ) {
    throw new Error('Discovery yield requires the verified Flickr query-hit Parquet')
  }
  const fileName = 'flickr_query_hits.parquet'
  const { database } = await createDuckDbRuntime()
  let connection: AsyncDuckDBConnection | undefined
  let registered = false
  try {
    const engineVersion = await database.getVersion()
    if (engineVersion !== DUCKDB_ENGINE_VERSION) {
      throw new Error(
        `DuckDB engine ${engineVersion} differs from the pinned ${DUCKDB_ENGINE_VERSION} runtime`,
      )
    }
    await database.registerFileBuffer(fileName, input.artifact.bytes)
    registered = true
    const parquetExtensionUrl = await loadLocalParquetExtension()
    connection = await database.connect()
    await connection.query(`SET autoinstall_known_extensions = false;
      SET autoload_known_extensions = false;
      LOAD ${sqlLiteral(parquetExtensionUrl)}`)
    await connection.query(`CREATE VIEW flickr_query_hits AS
      SELECT * FROM read_parquet('flickr_query_hits.parquet')`)

    const summary = await connection.query(`SELECT
        count(*) AS query_hit_count,
        count(DISTINCT (source, flickr_photo_id)) AS unique_image_count
      FROM flickr_query_hits`)
    const rows = await connection.query(`WITH classified AS (
        SELECT
          source,
          flickr_photo_id,
          query_hash,
          search_term,
          split_part(query_tier, ':', 1) AS term_class
        FROM flickr_query_hits
      ), bucketed AS (
        SELECT
          *,
          CASE term_class
            WHEN 'family' THEN 'family'
            WHEN 'genus' THEN 'genus'
            WHEN 'scientific_name' THEN 'species'
            ELSE 'unassigned_context'
          END AS rank_bucket
        FROM classified
      )
      SELECT
        rank_bucket,
        count(*) AS hit_count,
        count(DISTINCT (source, flickr_photo_id)) AS unique_image_count,
        count(DISTINCT search_term) AS represented_search_term_count,
        count(DISTINCT query_hash) AS represented_query_hash_count,
        count(DISTINCT term_class) AS term_class_count
      FROM bucketed
      GROUP BY rank_bucket
      ORDER BY rank_bucket`)

    if (summary.numRows !== 1 || rows.numRows !== 4) {
      throw new Error('Discovery-yield aggregation returned an unexpected boundary')
    }
    const queryHitCount = requiredCount(summary, 'query_hit_count', 0)
    const uniqueImageCount = requiredCount(summary, 'unique_image_count', 0)
    if (
      queryHitCount !== input.expectedQueryHitCount ||
      uniqueImageCount !== input.expectedUniqueImageCount
    ) {
      throw new Error('Query-hit Parquet totals differ from the verified discovery summary')
    }

    const buckets = new Map<MeasuredBucket['bucket'], MeasuredBucket>()
    for (let index = 0; index < rows.numRows; index += 1) {
      const bucket = requiredBucket(rows, index)
      if (buckets.has(bucket)) {
        throw new Error(`Discovery-yield bucket is duplicated: ${bucket}`)
      }
      const measured = Object.freeze({
        bucket,
        hitCount: requiredCount(rows, 'hit_count', index),
        uniqueImageCount: requiredCount(rows, 'unique_image_count', index),
        representedSearchTermCount: requiredCount(
          rows,
          'represented_search_term_count',
          index,
        ),
        representedQueryHashCount: requiredCount(
          rows,
          'represented_query_hash_count',
          index,
        ),
        termClassCount: requiredCount(rows, 'term_class_count', index),
      })
      if (
        measured.hitCount < 1 ||
        measured.uniqueImageCount < 1 ||
        measured.uniqueImageCount > uniqueImageCount ||
        measured.representedSearchTermCount < 1 ||
        measured.representedQueryHashCount < 1 ||
        measured.termClassCount < 1
      ) {
        throw new Error(`Discovery-yield bucket is invalid: ${bucket}`)
      }
      buckets.set(bucket, measured)
    }
    if (
      [...buckets.values()].reduce((total, bucket) => total + bucket.hitCount, 0) !==
      queryHitCount
    ) {
      throw new Error('Discovery-yield buckets do not partition every query-hit association')
    }
    const context = buckets.get('unassigned_context')
    if (context === undefined || context.termClassCount < 1) {
      throw new Error('Discovery-yield context bucket is missing')
    }

    return Object.freeze({
      backend: 'duckdb-wasm-parquet',
      packageVersion: DUCKDB_WASM_PACKAGE_VERSION,
      engineVersion,
      ranks: buildRankRows(buckets),
      context: Object.freeze({
        hitCount: context.hitCount,
        uniqueImageCount: context.uniqueImageCount,
        representedSearchTermCount: context.representedSearchTermCount,
        representedQueryHashCount: context.representedQueryHashCount,
        termClassCount: context.termClassCount,
      }),
      queryHitCount,
      uniqueImageCount,
      globalAdultRouteCount: input.globalAdultRouteCount,
      globalEvidenceRecordCount: input.globalEvidenceRecordCount,
      logicalQueriesAvailable: false,
      physicalRequestsAvailable: false,
      marginalApiCostAvailable: false,
      artifact: provenanceOnly(input.artifact),
      scientificClaimAllowed: false,
    })
  } finally {
    await connection?.close()
    if (registered) {
      await database.dropFiles([fileName])
    }
    await database.terminate()
  }
}

function buildRankRows(
  buckets: ReadonlyMap<MeasuredBucket['bucket'], MeasuredBucket>,
): readonly QueryYieldRankRow[] {
  return Object.freeze(
    RANKS.map(({ label, rank }) => {
      const measured = rank === 'family' || rank === 'genus' || rank === 'species'
        ? buckets.get(rank)
        : undefined
      return Object.freeze({
        rank,
        label,
        status: measured === undefined ? ('unavailable' as const) : ('measured' as const),
        sourceTier:
          measured === undefined
            ? null
            : rank === 'species'
              ? 'scientific_name:*:*'
              : `${rank}:*:*`,
        hitCount: measured?.hitCount ?? null,
        uniqueImageCount: measured?.uniqueImageCount ?? null,
        representedSearchTermCount: measured?.representedSearchTermCount ?? null,
        representedQueryHashCount: measured?.representedQueryHashCount ?? null,
        logicalQueryCount: null,
        physicalRequestCount: null,
        marginalApiCost: null,
      })
    }),
  )
}

function provenanceOnly(artifact: ParquetArtifactInput): AnalyticsArtifactProvenance {
  return Object.freeze({
    artifactId: artifact.artifactId,
    mediaType: artifact.mediaType,
    path: artifact.path,
    schemaVersion: artifact.schemaVersion ?? null,
    sizeBytes: artifact.sizeBytes,
    sha256: artifact.sha256,
    recordCount: artifact.recordCount,
    producerSha: artifact.producerSha,
  })
}

function requiredBucket(
  table: Awaited<ReturnType<AsyncDuckDBConnection['query']>>,
  row: number,
): MeasuredBucket['bucket'] {
  const value = table.getChild('rank_bucket')?.get(row)
  if (!['family', 'genus', 'species', 'unassigned_context'].includes(String(value))) {
    throw new Error('DuckDB discovery yield returned an invalid rank bucket')
  }
  return value as MeasuredBucket['bucket']
}

function requiredCount(
  table: Awaited<ReturnType<AsyncDuckDBConnection['query']>>,
  column: string,
  row: number,
): number {
  const value = table.getChild(column)?.get(row)
  const numeric = typeof value === 'bigint' ? Number(value) : value
  if (typeof numeric !== 'number' || !Number.isSafeInteger(numeric) || numeric < 0) {
    throw new Error(`DuckDB discovery yield returned an invalid ${column}`)
  }
  return numeric
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}
