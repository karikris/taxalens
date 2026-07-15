import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'

import type { AnalyticsArtifactProvenance, AnalyticsReplayInput } from '../data/evidenceFacade'
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
  readonly whatOccurred: string
  readonly why: string
  readonly userConsequence: string
  readonly keys: readonly string[]
  readonly cardinality: string
  readonly nullRows: number
  readonly sourceArtifactBytes: number
  readonly parquetRowGroups: number
  readonly cache: 'fresh DuckDB worker memory; no persistent cache'
  readonly artifacts: readonly AnalyticsArtifactInspection[]
  readonly planOperators: readonly string[]
  readonly explainPlan: string
  readonly elapsedMilliseconds: number
}

export interface AnalyticsArtifactInspection extends AnalyticsArtifactProvenance {
  readonly parquetRowGroups: number | null
}

export interface AnalyticsReplayResult {
  readonly backend: 'duckdb-wasm-parquet'
  readonly packageVersion: typeof DUCKDB_WASM_PACKAGE_VERSION
  readonly engineVersion: string
  readonly registeredArtifactCount: 4
  readonly registeredBytes: number
  readonly operationCount: 8
  readonly operations: readonly AnalyticsOperationResult[]
  readonly workAvoided: WorkAvoidedResult
  readonly matrixScoringExecuted: false
  readonly scientificClaimAllowed: false
}

export type WorkAvoidedMetricId =
  | 'requests-avoided'
  | 'duplicate-hits-collapsed'
  | 'downloads-avoided'
  | 'inference-avoided'
  | 'embeddings-reused'
  | 'completed-items-anti-joined'
  | 'remote-handoff-reads-avoided'

export interface WorkAvoidedMetric {
  readonly metricId: WorkAvoidedMetricId
  readonly label: string
  readonly status: 'measured' | 'not_instrumented'
  readonly value: number | null
  readonly unit: string
  readonly baselineRows: number | null
  readonly retainedRows: number | null
  readonly method: string
  readonly sourceArtifacts: readonly AnalyticsArtifactInspection[]
}

export interface WorkAvoidedResult {
  readonly measuredMetricCount: 2
  readonly notInstrumentedMetricCount: 5
  readonly metrics: readonly WorkAvoidedMetric[]
  readonly estimatesShown: false
}

interface OperationDefinition {
  readonly operationId: AnalyticsOperationId
  readonly label: string
  readonly inputRelation: string
  readonly outputRelation: string
  readonly inputCountSql: string
  readonly outputCountSql: string
  readonly nullCountSql: string
  readonly whatOccurred: string
  readonly why: string
  readonly userConsequence: string
  readonly keys: readonly string[]
  readonly cardinality: string
  readonly artifactIds: readonly string[]
  readonly statement: string
}

const QUERY_HITS_ARTIFACT = 'biominer-flickr-query-hits-parquet'
const GEOGRAPHY_ARTIFACT = 'biominer-flickr-geography-parquet'
const ASSIGNMENTS_ARTIFACT = 'biominer-flickr-geo-assignments-parquet'
const CLUSTERS_ARTIFACT = 'biominer-flickr-geo-clusters-parquet'
const CANDIDATES_ARTIFACT = 'candidate-sets'

const OPERATIONS: readonly OperationDefinition[] = Object.freeze([
  {
    operationId: 'physical-query-deduplication',
    label: 'Physical-query hash deduplication',
    inputRelation: 'flickr_query_hits',
    outputRelation: 'physical_queries',
    inputCountSql: 'SELECT count(*) AS row_count FROM flickr_query_hits',
    outputCountSql: 'SELECT count(*) AS row_count FROM physical_queries',
    nullCountSql:
      'SELECT count(*) FILTER (WHERE source IS NULL OR query_hash IS NULL) AS row_count FROM physical_queries',
    whatOccurred: 'Repeated logical query associations were reduced to distinct physical queries.',
    why: 'One source query hash should be executed once even when several logical plans reuse it.',
    userConsequence: 'The replay separates reusable retrieval work from the associations it serves.',
    keys: ['source', 'query_hash'],
    cardinality: 'Many logical query associations to one row per source and query hash.',
    artifactIds: [QUERY_HITS_ARTIFACT],
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
    nullCountSql: `SELECT count(*) FILTER (
      WHERE source IS NULL OR flickr_photo_id IS NULL OR query_hash IS NULL
    ) AS row_count FROM logical_association_fanback`,
    whatOccurred: 'Distinct physical queries were linked back to every recorded photo association.',
    why: 'Deduplicating retrieval must not discard the logical evidence relationships it produced.',
    userConsequence: 'Each observed photo retains the query context needed for later inspection.',
    keys: ['source', 'query_hash'],
    cardinality: 'One physical query to many logical photo associations.',
    artifactIds: [QUERY_HITS_ARTIFACT],
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
    nullCountSql: `SELECT count(*) FILTER (
      WHERE source IS NULL OR flickr_photo_id IS NULL OR source_record_hash IS NULL
    ) AS row_count FROM source_id_join`,
    whatOccurred: 'Query associations were joined to canonical geography records by source identity.',
    why: 'Coordinates must remain bound to the exact source photo rather than a display label.',
    userConsequence: 'Geographic evidence can be traced to a stable source-record hash.',
    keys: ['source', 'flickr_photo_id'],
    cardinality: 'Many query associations to one canonical source record per association.',
    artifactIds: [QUERY_HITS_ARTIFACT, GEOGRAPHY_ARTIFACT],
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
    nullCountSql: `SELECT count(*) FILTER (
      WHERE source IS NULL OR flickr_photo_id IS NULL OR query_hash IS NULL
    ) AS row_count FROM canonical_source_rows`,
    whatOccurred: 'Repeated source-photo associations were excluded with an anti-join.',
    why: 'A source photo can appear through several query paths but should remain one canonical record.',
    userConsequence: 'Downstream cluster counts are not inflated by repeated query associations.',
    keys: ['source', 'flickr_photo_id', 'query_hash'],
    cardinality: 'Many associations to one retained row per source photo.',
    artifactIds: [QUERY_HITS_ARTIFACT, GEOGRAPHY_ARTIFACT],
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
    nullCountSql: `SELECT count(*) FILTER (
      WHERE source IS NULL OR flickr_photo_id IS NULL OR source_record_hash IS NULL
        OR target_accepted_taxon_key IS NULL OR geo_cluster_id IS NULL
    ) AS row_count FROM spatial_cluster_join`,
    whatOccurred: 'Canonical photos were joined to their spatial assignments and cluster summaries.',
    why: 'Assignment rows and cluster definitions must agree on the target and cluster identity.',
    userConsequence: 'The replay exposes location structure as diagnostic metadata, not a species claim.',
    keys: [
      'source',
      'flickr_photo_id',
      'source_record_hash',
      'target_accepted_taxon_key',
      'geo_cluster_id',
    ],
    cardinality: 'One canonical photo to one assignment and one matching cluster definition.',
    artifactIds: [
      QUERY_HITS_ARTIFACT,
      GEOGRAPHY_ARTIFACT,
      ASSIGNMENTS_ARTIFACT,
      CLUSTERS_ARTIFACT,
    ],
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
    nullCountSql: `SELECT count(*) FILTER (
      WHERE acceptedTaxonKey IS NULL OR scientificName IS NULL OR evidenceRole IS NULL
    ) AS row_count FROM candidate_union`,
    whatOccurred: 'The target under study and regional competitor hypotheses were combined.',
    why: 'Both evidence roles must enter later diagnostics without being mistaken for verified labels.',
    userConsequence: 'The interface preserves competing hypotheses and keeps scientific claims disabled.',
    keys: ['acceptedTaxonKey', 'evidenceRole'],
    cardinality: 'One target hypothesis plus five regional competitor hypotheses.',
    artifactIds: [CANDIDATES_ARTIFACT],
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
    nullCountSql: `SELECT count(*) FILTER (
      WHERE stage_id IS NULL OR output_rows IS NULL
    ) AS row_count FROM replay_stage_aggregation`,
    whatOccurred: 'The output counts from six materialized replay stages were assembled.',
    why: 'A compact stage ledger makes row-count changes inspectable across the analytical path.',
    userConsequence: 'Reviewers can see where records expand, contract, or remain stable.',
    keys: ['stage_id'],
    cardinality: 'Six materialized relations to six stage-total rows.',
    artifactIds: [
      QUERY_HITS_ARTIFACT,
      GEOGRAPHY_ARTIFACT,
      ASSIGNMENTS_ARTIFACT,
      CLUSTERS_ARTIFACT,
      CANDIDATES_ARTIFACT,
    ],
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
    nullCountSql: `SELECT count(*) FILTER (
      WHERE assembly_id IS NULL OR verification_status IS NULL
    ) AS row_count FROM diagnostic_evidence_assembly`,
    whatOccurred: 'Candidate and stage diagnostics were assembled into one replay receipt row.',
    why: 'The replay needs a bounded outcome that records analytical coverage and claim status.',
    userConsequence: 'The result can be inspected without presenting an automated identification.',
    keys: ['assembly_id'],
    cardinality: 'Six candidates and six stage totals to one diagnostic receipt.',
    artifactIds: [
      QUERY_HITS_ARTIFACT,
      GEOGRAPHY_ARTIFACT,
      ASSIGNMENTS_ARTIFACT,
      CLUSTERS_ARTIFACT,
      CANDIDATES_ARTIFACT,
    ],
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

function buildWorkAvoidedResult(
  duplicateQueryHits: number,
  queryHitRows: number,
  canonicalPhotoRows: number,
  queryHitsArtifact: AnalyticsArtifactInspection,
): WorkAvoidedResult {
  const measured = (
    metricId: 'requests-avoided' | 'duplicate-hits-collapsed',
    label: string,
    method: string,
  ): WorkAvoidedMetric =>
    Object.freeze({
      metricId,
      label,
      status: 'measured',
      value: duplicateQueryHits,
      unit: metricId === 'requests-avoided' ? 'request-equivalent query hits' : 'query hits',
      baselineRows: queryHitRows,
      retainedRows: canonicalPhotoRows,
      method,
      sourceArtifacts: Object.freeze([queryHitsArtifact]),
    })
  const unavailable = (
    metricId: Exclude<WorkAvoidedMetricId, 'requests-avoided' | 'duplicate-hits-collapsed'>,
    label: string,
    method: string,
  ): WorkAvoidedMetric =>
    Object.freeze({
      metricId,
      label,
      status: 'not_instrumented',
      value: null,
      unit: 'not measured',
      baselineRows: null,
      retainedRows: null,
      method,
      sourceArtifacts: Object.freeze([]),
    })

  return Object.freeze({
    measuredMetricCount: 2,
    notInstrumentedMetricCount: 5,
    metrics: Object.freeze([
      measured(
        'requests-avoided',
        'Requests avoided',
        'DuckDB reproduced BioMiner discovery_metrics.api_requests_avoided_by_deduplication as SUM(query_hit_count - 1) per canonical source photo.',
      ),
      measured(
        'duplicate-hits-collapsed',
        'Duplicate hits collapsed',
        'DuckDB subtracted distinct source photos from verified query-hit associations.',
      ),
      unavailable(
        'downloads-avoided',
        'Downloads avoided',
        'The fixture records zero downloads executed but has no avoided-download ledger; zero executed is not work avoided.',
      ),
      unavailable(
        'inference-avoided',
        'Inference avoided',
        'The fixture records zero YOLOE and BioCLIP processing but has no skipped-inference counter.',
      ),
      unavailable(
        'embeddings-reused',
        'Embeddings reused',
        'No embedding artifact or cache-reuse receipt is present in the submitted fixture.',
      ),
      unavailable(
        'completed-items-anti-joined',
        'Completed items anti-joined',
        'The replay anti-joins duplicate associations, not a completed-work ledger; completed-item reuse is not instrumented.',
      ),
      unavailable(
        'remote-handoff-reads-avoided',
        'Remote handoff reads avoided through local cache',
        'No storage receive receipt demonstrating a verified local-cache reuse is present in the submitted fixture.',
      ),
    ]),
    estimatesShown: false,
  })
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
    const artifactInspections = new Map<string, AnalyticsArtifactInspection>()
    for (const artifact of input.artifacts) {
      const fileName = fileNames[artifact.artifactId]
      if (fileName === undefined) {
        throw new Error(`No registered filename exists for ${artifact.artifactId}`)
      }
      const parquetRowGroups = scalarCount(
        await connection.query(
          `SELECT count(DISTINCT row_group_id) AS row_count FROM parquet_metadata(${sqlLiteral(fileName)})`,
        ),
      )
      artifactInspections.set(
        artifact.artifactId,
        Object.freeze({
          artifactId: artifact.artifactId,
          mediaType: artifact.mediaType,
          path: artifact.path,
          sizeBytes: artifact.sizeBytes,
          sha256: artifact.sha256,
          recordCount: artifact.recordCount,
          producerSha: artifact.producerSha,
          parquetRowGroups,
        }),
      )
    }
    artifactInspections.set(
      input.candidateArtifact.artifactId,
      Object.freeze({ ...input.candidateArtifact, parquetRowGroups: null }),
    )
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
      const nullRows = scalarCount(await connection.query(operation.nullCountSql))
      const artifacts = operation.artifactIds.map((artifactId) => {
        const artifact = artifactInspections.get(artifactId)
        if (artifact === undefined) {
          throw new Error(`No verified inspection metadata exists for ${artifactId}`)
        }
        return artifact
      })
      operations.push(
        Object.freeze({
          operationId: operation.operationId,
          label: operation.label,
          inputRelation: operation.inputRelation,
          outputRelation: operation.outputRelation,
          inputRows,
          outputRows,
          whatOccurred: operation.whatOccurred,
          why: operation.why,
          userConsequence: operation.userConsequence,
          keys: Object.freeze(operation.keys),
          cardinality: operation.cardinality,
          nullRows,
          sourceArtifactBytes: artifacts.reduce(
            (total, artifact) => total + artifact.sizeBytes,
            0,
          ),
          parquetRowGroups: artifacts.reduce(
            (total, artifact) => total + (artifact.parquetRowGroups ?? 0),
            0,
          ),
          cache: 'fresh DuckDB worker memory; no persistent cache',
          artifacts: Object.freeze(artifacts),
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
    const duplicateQueryHits = scalarCount(
      await connection.query(`SELECT CAST(COALESCE(sum(query_hit_count - 1), 0) AS BIGINT) AS row_count
        FROM (
          SELECT count(*) AS query_hit_count
          FROM flickr_query_hits
          GROUP BY source, flickr_photo_id
        ) AS per_photo`),
    )
    if (duplicateQueryHits !== sourceIdJoin.inputRows - duplicateAntiJoin.outputRows) {
      throw new Error('Work-avoided deduplication counts disagree across verified replay operations')
    }
    const queryHitsArtifact = artifactInspections.get(QUERY_HITS_ARTIFACT)
    if (queryHitsArtifact === undefined) {
      throw new Error('Query-hit artifact provenance is unavailable for work-avoided metrics')
    }

    return Object.freeze({
      backend: 'duckdb-wasm-parquet',
      packageVersion: DUCKDB_WASM_PACKAGE_VERSION,
      engineVersion,
      registeredArtifactCount: 4,
      registeredBytes: input.artifacts.reduce((total, artifact) => total + artifact.bytes.byteLength, 0),
      operationCount: 8,
      operations: Object.freeze(operations),
      workAvoided: buildWorkAvoidedResult(
        duplicateQueryHits,
        sourceIdJoin.inputRows,
        duplicateAntiJoin.outputRows,
        queryHitsArtifact,
      ),
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
