import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'

import type { AnalyticsReplayInput } from '../data/evidenceFacade'
import {
  createDuckDbRuntime,
  DUCKDB_ENGINE_VERSION,
  DUCKDB_WASM_PACKAGE_VERSION,
  loadLocalParquetExtension,
} from '../data/duckdbRuntime'

export type AnalyticsOperationId =
  | 'physical-query-deduplication'
  | 'logical-association-fan-back'
  | 'source-id-hash-join'
  | 'duplicate-anti-join'
  | 'spatial-cluster-join'
  | 'candidate-set-union'
  | 'stage-aggregation'
  | 'evidence-assembly'

export interface AnalyticsOperationResult {
  readonly operationId: AnalyticsOperationId
  readonly label: string
  readonly inputRelation: string
  readonly outputRelation: string
  readonly inputRows: number
  readonly outputRows: number
  readonly planOperators: readonly string[]
  readonly explainPlan: string
  readonly elapsedMilliseconds: number
}

export interface AnalyticsReplayResult {
  readonly backend: 'duckdb-wasm-parquet'
  readonly packageVersion: typeof DUCKDB_WASM_PACKAGE_VERSION
  readonly engineVersion: string
  readonly registeredArtifactCount: 4
  readonly registeredBytes: number
  readonly operationCount: 8
  readonly operations: readonly AnalyticsOperationResult[]
  readonly matrixScoringExecuted: false
  readonly scientificClaimAllowed: false
}

interface OperationDefinition {
  readonly operationId: AnalyticsOperationId
  readonly label: string
  readonly inputRelation: string
  readonly outputRelation: string
  readonly inputCountSql: string
  readonly outputCountSql: string
  readonly statement: string
}

const OPERATIONS: readonly OperationDefinition[] = Object.freeze([
  {
    operationId: 'physical-query-deduplication',
    label: 'Physical-query hash deduplication',
    inputRelation: 'flickr_query_hits',
    outputRelation: 'physical_queries',
    inputCountSql: 'SELECT count(*) AS row_count FROM flickr_query_hits',
    outputCountSql: 'SELECT count(*) AS row_count FROM physical_queries',
    statement: `CREATE TEMP TABLE physical_queries AS
      SELECT
        source,
        query_hash,
        any_value(query_tier) AS query_tier,
        any_value(search_term) AS search_term,
        count(*) AS logical_association_count
      FROM flickr_query_hits
      GROUP BY source, query_hash`,
  },
  {
    operationId: 'logical-association-fan-back',
    label: 'Logical association fan-back',
    inputRelation: 'physical_queries',
    outputRelation: 'logical_association_fanback',
    inputCountSql: 'SELECT count(*) AS row_count FROM physical_queries',
    outputCountSql: 'SELECT count(*) AS row_count FROM logical_association_fanback',
    statement: `CREATE TEMP TABLE logical_association_fanback AS
      SELECT
        hits.source,
        hits.flickr_photo_id,
        hits.query_hash,
        physical.query_tier,
        physical.search_term
      FROM flickr_query_hits AS hits
      INNER JOIN physical_queries AS physical
        ON hits.source = physical.source
       AND hits.query_hash = physical.query_hash`,
  },
  {
    operationId: 'source-id-hash-join',
    label: 'Source-ID hash join',
    inputRelation: 'logical_association_fanback',
    outputRelation: 'source_id_join',
    inputCountSql: 'SELECT count(*) AS row_count FROM logical_association_fanback',
    outputCountSql: 'SELECT count(*) AS row_count FROM source_id_join',
    statement: `CREATE TEMP TABLE source_id_join AS
      SELECT
        fanback.source,
        fanback.flickr_photo_id,
        fanback.query_hash,
        fanback.query_tier,
        fanback.search_term,
        geography.source_record_hash,
        geography.latitude,
        geography.longitude,
        geography.coordinate_quality
      FROM logical_association_fanback AS fanback
      INNER JOIN flickr_geography AS geography
        ON fanback.source = geography.source
       AND fanback.flickr_photo_id = geography.flickr_photo_id`,
  },
  {
    operationId: 'duplicate-anti-join',
    label: 'Duplicate association anti-join',
    inputRelation: 'source_id_join',
    outputRelation: 'canonical_source_rows',
    inputCountSql: 'SELECT count(*) AS row_count FROM source_id_join',
    outputCountSql: 'SELECT count(*) AS row_count FROM canonical_source_rows',
    statement: `CREATE TEMP TABLE canonical_source_rows AS
      WITH ranked_associations AS (
        SELECT
          source,
          flickr_photo_id,
          query_hash,
          row_number() OVER (
            PARTITION BY source, flickr_photo_id
            ORDER BY query_hash
          ) AS duplicate_rank
        FROM source_id_join
      ), duplicate_associations AS (
        SELECT source, flickr_photo_id, query_hash
        FROM ranked_associations
        WHERE duplicate_rank > 1
      )
      SELECT joined.*
      FROM source_id_join AS joined
      ANTI JOIN duplicate_associations AS duplicate
        ON joined.source = duplicate.source
       AND joined.flickr_photo_id = duplicate.flickr_photo_id
       AND joined.query_hash = duplicate.query_hash`,
  },
  {
    operationId: 'spatial-cluster-join',
    label: 'Spatial cluster assignment join',
    inputRelation: 'canonical_source_rows',
    outputRelation: 'spatial_cluster_join',
    inputCountSql: 'SELECT count(*) AS row_count FROM canonical_source_rows',
    outputCountSql: 'SELECT count(*) AS row_count FROM spatial_cluster_join',
    statement: `CREATE TEMP TABLE spatial_cluster_join AS
      SELECT
        canonical.source,
        canonical.flickr_photo_id,
        canonical.source_record_hash,
        assignment.target_accepted_taxon_key,
        assignment.geo_cluster_id,
        assignment.distance_to_medoid_km,
        assignment.outlier,
        cluster.member_image_count,
        cluster.member_cell_count,
        cluster.candidate_distribution_only
      FROM canonical_source_rows AS canonical
      INNER JOIN flickr_geo_assignments AS assignment
        ON canonical.source = assignment.source
       AND canonical.flickr_photo_id = assignment.flickr_photo_id
       AND canonical.source_record_hash = assignment.source_record_hash
      INNER JOIN flickr_geo_clusters AS cluster
        ON assignment.target_accepted_taxon_key = cluster.target_accepted_taxon_key
       AND assignment.geo_cluster_id = cluster.geo_cluster_id`,
  },
  {
    operationId: 'candidate-set-union',
    label: 'Candidate-set union',
    inputRelation: 'verified_candidate_inputs',
    outputRelation: 'candidate_union',
    inputCountSql: 'SELECT count(*) AS row_count FROM verified_candidate_inputs',
    outputCountSql: 'SELECT count(*) AS row_count FROM candidate_union',
    statement: `CREATE TEMP TABLE candidate_union AS
      SELECT *
      FROM verified_candidate_inputs
      WHERE evidenceRole = 'target_under_study'
      UNION ALL
      SELECT *
      FROM verified_candidate_inputs
      WHERE evidenceRole = 'regional_competitor_hypothesis'`,
  },
  {
    operationId: 'stage-aggregation',
    label: 'Stage aggregation',
    inputRelation: 'six materialized replay stages',
    outputRelation: 'replay_stage_aggregation',
    inputCountSql: 'SELECT 6 AS row_count',
    outputCountSql: 'SELECT count(*) AS row_count FROM replay_stage_aggregation',
    statement: `CREATE TEMP TABLE replay_stage_aggregation AS
      SELECT 'physical-query-deduplication' AS stage_id, count(*) AS output_rows
        FROM physical_queries
      UNION ALL SELECT 'logical-association-fan-back', count(*)
        FROM logical_association_fanback
      UNION ALL SELECT 'source-id-hash-join', count(*)
        FROM source_id_join
      UNION ALL SELECT 'duplicate-anti-join', count(*)
        FROM canonical_source_rows
      UNION ALL SELECT 'spatial-cluster-join', count(*)
        FROM spatial_cluster_join
      UNION ALL SELECT 'candidate-set-union', count(*)
        FROM candidate_union`,
  },
  {
    operationId: 'evidence-assembly',
    label: 'Diagnostic evidence assembly',
    inputRelation: 'candidate_union + replay_stage_aggregation',
    outputRelation: 'diagnostic_evidence_assembly',
    inputCountSql: `SELECT
      (SELECT count(*) FROM candidate_union) +
      (SELECT count(*) FROM replay_stage_aggregation) AS row_count`,
    outputCountSql: 'SELECT count(*) AS row_count FROM diagnostic_evidence_assembly',
    statement: `CREATE TEMP TABLE diagnostic_evidence_assembly AS
      SELECT
        'papilio-demoleus-pilot-analytics-replay' AS assembly_id,
        (SELECT count(*) FROM candidate_union) AS candidate_hypothesis_count,
        (SELECT count(*) FROM spatial_cluster_join) AS joined_metadata_row_count,
        (SELECT count(*) FROM replay_stage_aggregation) AS aggregated_stage_count,
        false AS scientific_claim_allowed,
        'diagnostic_metadata_only' AS verification_status`,
  },
])

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

function candidateValues(input: AnalyticsReplayInput): string {
  return input.candidates
    .map(
      (candidate) =>
        `(${sqlLiteral(candidate.acceptedTaxonKey)}, ${sqlLiteral(candidate.scientificName)}, ` +
        `${sqlLiteral(candidate.evidenceRole)}, false)`,
    )
    .join(',\n')
}

function scalarCount(table: Awaited<ReturnType<AsyncDuckDBConnection['query']>>): number {
  const value = table.getChild('row_count')?.get(0)
  const count = typeof value === 'bigint' ? Number(value) : value
  if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) {
    throw new Error('DuckDB replay returned an invalid row count')
  }
  return count
}

function explainText(table: Awaited<ReturnType<AsyncDuckDBConnection['query']>>): string {
  const values = table.getChild('explain_value')
  if (values === null) {
    throw new Error('DuckDB EXPLAIN returned no explain_value column')
  }
  return Array.from({ length: table.numRows }, (_, index) => String(values.get(index))).join('\n')
}

function planOperators(plan: string): readonly string[] {
  return Object.freeze(
    ['PARQUET_SCAN', 'HASH_GROUP_BY', 'HASH_JOIN', 'ANTI', 'UNION'].filter((operator) =>
      plan.includes(operator),
    ),
  )
}

export async function executeAnalyticsReplay(
  input: AnalyticsReplayInput,
): Promise<AnalyticsReplayResult> {
  if (input.artifacts.length !== 4) {
    throw new Error('Analytics replay requires exactly four verified Parquet artifacts')
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
    const fileNames: Readonly<Record<string, string>> = {
      'biominer-flickr-query-hits-parquet': 'flickr_query_hits.parquet',
      'biominer-flickr-geography-parquet': 'flickr_geography.parquet',
      'biominer-flickr-geo-assignments-parquet': 'flickr_geo_assignments.parquet',
      'biominer-flickr-geo-clusters-parquet': 'flickr_geo_clusters.parquet',
    }
    for (const artifact of input.artifacts) {
      const fileName = fileNames[artifact.artifactId]
      if (fileName === undefined || artifact.mediaType !== 'application/vnd.apache.parquet') {
        throw new Error(`Unexpected analytics artifact: ${artifact.artifactId}`)
      }
      await database.registerFileBuffer(fileName, artifact.bytes)
      registeredFiles.push(fileName)
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
    await connection.query(`CREATE TEMP TABLE verified_candidate_inputs (
      acceptedTaxonKey VARCHAR NOT NULL,
      scientificName VARCHAR NOT NULL,
      evidenceRole VARCHAR NOT NULL,
      scientificClaimAllowed BOOLEAN NOT NULL
    )`)
    await connection.query(`INSERT INTO verified_candidate_inputs VALUES
      ${candidateValues(input)}`)

    const operations: AnalyticsOperationResult[] = []
    for (const operation of OPERATIONS) {
      const inputRows = scalarCount(await connection.query(operation.inputCountSql))
      const plan = explainText(await connection.query(`EXPLAIN ${operation.statement}`))
      const started = performance.now()
      await connection.query(operation.statement)
      const elapsedMilliseconds = performance.now() - started
      const outputRows = scalarCount(await connection.query(operation.outputCountSql))
      operations.push(
        Object.freeze({
          operationId: operation.operationId,
          label: operation.label,
          inputRelation: operation.inputRelation,
          outputRelation: operation.outputRelation,
          inputRows,
          outputRows,
          planOperators: planOperators(plan),
          explainPlan: plan,
          elapsedMilliseconds,
        }),
      )
    }

    const sourceIdJoin = operations.find(
      ({ operationId }) => operationId === 'source-id-hash-join',
    )
    const duplicateAntiJoin = operations.find(
      ({ operationId }) => operationId === 'duplicate-anti-join',
    )
    if (
      !sourceIdJoin?.planOperators.includes('HASH_JOIN') ||
      !duplicateAntiJoin?.planOperators.includes('ANTI')
    ) {
      throw new Error('DuckDB query plans do not confirm the declared equality and anti joins')
    }

    return Object.freeze({
      backend: 'duckdb-wasm-parquet',
      packageVersion: DUCKDB_WASM_PACKAGE_VERSION,
      engineVersion,
      registeredArtifactCount: 4,
      registeredBytes: input.artifacts.reduce((total, artifact) => total + artifact.bytes.byteLength, 0),
      operationCount: 8,
      operations: Object.freeze(operations),
      matrixScoringExecuted: false,
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
