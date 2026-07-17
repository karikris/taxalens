import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'

import {
  createDuckDbRuntime,
  DUCKDB_ENGINE_VERSION,
  DUCKDB_WASM_PACKAGE_VERSION,
  loadLocalParquetExtension,
} from '../data/duckdbRuntime'
import type { TaxaLensProjectFacade } from '../data/projectFacade'
import {
  loadGeographicImpactQuerySources,
  registerGeographicImpactQuerySources,
  type GeographicImpactQuerySources,
  type GeographicSourceRegistrationResult,
} from './geographicImpactSources'

export const GEOGRAPHIC_IMPACT_JOIN_KEYS = Object.freeze([
  'project_id',
  'run_id',
  'accepted_taxon_key',
  'baseline_snapshot_id',
  'flickr_snapshot_id',
  'spatial_resolution',
  'spatial_cell_id',
] as const)

export interface GeographicImpactBrowserCell {
  readonly spatialResolution: number
  readonly spatialCellId: string
  readonly continent: string | null
  readonly countryCode: string | null
  readonly country: string | null
  readonly admin1: string | null
  readonly latitude: number
  readonly longitude: number
  readonly baselineUnionCount: number
  readonly baselineRangeInferenceEligibleCount: number
  readonly flickrCandidateCount: number
  readonly flickrVisuallyEligibleCount: number
  readonly reviewedPositiveCount: number
  readonly reviewedNegativeCount: number
  readonly uncertainCount: number
  readonly pendingCount: number
  readonly mediaFailureCount: number
  readonly skippedCount: number
  readonly releaseReadyCount: number
  readonly baselineOnlyCell: boolean
  readonly matchedCell: boolean
  readonly candidateOnlyCell: boolean
  readonly reviewedAdditionalCell: boolean
  readonly releaseReadyAdditionalCell: boolean
  readonly nearestBaselineDistanceKm: number | null
  readonly dataDeficientState: 'sufficient' | 'data_deficient' | 'unavailable'
}

export interface GeographicImpactBrowserResult {
  readonly backend: 'duckdb-wasm-parquet'
  readonly packageVersion: typeof DUCKDB_WASM_PACKAGE_VERSION
  readonly engineVersion: string
  readonly operation: 'full_outer_cell_comparison'
  readonly joinKeys: typeof GEOGRAPHIC_IMPACT_JOIN_KEYS
  readonly cells: readonly GeographicImpactBrowserCell[]
  readonly baselineOnlyCellCount: number
  readonly matchedCellCount: number
  readonly candidateOnlyCellCount: number
  readonly reviewedAdditionalCellCount: number
  readonly releaseReadyAdditionalCellCount: number
  readonly registration: GeographicSourceRegistrationResult
  readonly scientificClaimAllowed: false
}

/** Execute the independently aggregated source comparison in the browser. */
export async function queryGeographicImpact(
  project: TaxaLensProjectFacade,
  candidate: unknown,
): Promise<GeographicImpactBrowserResult> {
  const sources = loadGeographicImpactQuerySources(project, candidate)
  const { database } = await createDuckDbRuntime()
  let connection: AsyncDuckDBConnection | undefined
  let registration: GeographicSourceRegistrationResult | undefined
  try {
    const engineVersion = await database.getVersion()
    if (engineVersion !== DUCKDB_ENGINE_VERSION) {
      throw new Error(
        `DuckDB engine ${engineVersion} differs from the pinned ${DUCKDB_ENGINE_VERSION} runtime`,
      )
    }
    registration = await registerGeographicImpactQuerySources(database, sources)
    const parquetExtensionUrl = await loadLocalParquetExtension()
    connection = await database.connect()
    await connection.query(`SET autoinstall_known_extensions = false;
      SET autoload_known_extensions = false;
      LOAD ${sqlLiteral(parquetExtensionUrl)}`)
    await createGeographicViews(connection, sources)
    const table = await connection.query(buildGeographicImpactSql(sources))
    const cells = decodeAndReconcileCells(table)

    return Object.freeze({
      backend: 'duckdb-wasm-parquet',
      packageVersion: DUCKDB_WASM_PACKAGE_VERSION,
      engineVersion,
      operation: 'full_outer_cell_comparison',
      joinKeys: GEOGRAPHIC_IMPACT_JOIN_KEYS,
      cells,
      baselineOnlyCellCount: countCells(cells, 'baselineOnlyCell'),
      matchedCellCount: countCells(cells, 'matchedCell'),
      candidateOnlyCellCount: countCells(cells, 'candidateOnlyCell'),
      reviewedAdditionalCellCount: countCells(cells, 'reviewedAdditionalCell'),
      releaseReadyAdditionalCellCount: countCells(cells, 'releaseReadyAdditionalCell'),
      registration,
      scientificClaimAllowed: false,
    })
  } finally {
    await connection?.close()
    if (registration !== undefined) {
      await database.dropFiles(registration.artifacts.map(({ fileName }) => fileName))
    }
    await database.terminate()
  }
}

async function createGeographicViews(
  connection: AsyncDuckDBConnection,
  sources: GeographicImpactQuerySources,
): Promise<void> {
  const baselineFile = sources.parquetSources[0]?.fileName
  if (baselineFile === undefined) {
    throw new Error('geographic baseline registration is missing')
  }
  await connection.query(`CREATE TEMP VIEW baseline_geographic_source AS
    SELECT * FROM read_parquet(${sqlLiteral(baselineFile)})`)
  await connection.query(`CREATE TEMP VIEW flickr_geographic_source AS
    SELECT * FROM read_parquet('flickr_geography.parquet')`)
  await connection.query(`CREATE TEMP VIEW materialized_geographic_impact AS
    SELECT * FROM read_parquet('geographic_impact_cells.parquet')`)
  await connection.query(`CREATE TEMP VIEW materialized_geographic_summary AS
    SELECT * FROM read_parquet('geographic_impact_summary.parquet')`)
}

export function buildGeographicImpactSql(sources: GeographicImpactQuerySources): string {
  const { input } = sources
  const identity = input.evidenceScope
  const projectId = sqlLiteral(identity.projectId)
  const runId = sqlLiteral(identity.runId)
  const taxonKey = sqlLiteral(identity.targetAcceptedTaxonKey)
  const baselineSnapshot = sqlLiteral(identity.baselineSnapshotId)
  const flickrSnapshot = sqlLiteral(identity.flickrSnapshotId)
  const resolution = input.spatialResolution
  const baselineAggregation =
    sources.baselineSource === 'baseline_occurrence_union'
      ? `SELECT
          project_id,
          run_id,
          accepted_taxon_key,
          baseline_snapshot_id,
          ${flickrSnapshot}::VARCHAR AS flickr_snapshot_id,
          spatial_resolution,
          spatial_cell_id,
          count(DISTINCT canonical_observation_id) FILTER (
            WHERE canonical_flag
          )::UBIGINT AS baseline_union_count,
          count(DISTINCT canonical_observation_id) FILTER (
            WHERE canonical_flag AND range_inference_eligible
          )::UBIGINT AS baseline_eligible_count
        FROM baseline_geographic_source
        WHERE project_id = ${projectId}
          AND run_id = ${runId}
          AND accepted_taxon_key = ${taxonKey}
          AND baseline_snapshot_id = ${baselineSnapshot}
          AND spatial_resolution = ${resolution}
          AND spatial_cell_id IS NOT NULL
        GROUP BY ALL`
      : `SELECT
          ${projectId}::VARCHAR AS project_id,
          ${runId}::VARCHAR AS run_id,
          accepted_taxon_key,
          ${baselineSnapshot}::VARCHAR AS baseline_snapshot_id,
          ${flickrSnapshot}::VARCHAR AS flickr_snapshot_id,
          spatial_resolution,
          spatial_cell_id,
          sum(occurrence_count)::UBIGINT AS baseline_union_count,
          sum(range_inference_eligible_count)::UBIGINT AS baseline_eligible_count
        FROM baseline_geographic_source
        WHERE accepted_taxon_key = ${taxonKey}
          AND source_snapshot_version = ${baselineSnapshot}
          AND spatial_resolution = ${resolution}
          AND spatial_cell_id IS NOT NULL
        GROUP BY ALL`
  const scopePredicate = geographicScopePredicate(sources)
  const evidencePredicate = evidenceModePredicate(sources.input.evidenceMode)

  return `WITH baseline_cells AS (
      ${baselineAggregation}
    ), flickr_cells AS (
      SELECT
        project_id,
        run_id,
        target_accepted_taxon_key AS accepted_taxon_key,
        ${baselineSnapshot}::VARCHAR AS baseline_snapshot_id,
        flickr_snapshot_id,
        spatial_resolution,
        spatial_cell_id,
        count(DISTINCT flickr_photo_id)::UBIGINT AS flickr_candidate_count,
        count(DISTINCT flickr_photo_id) FILTER (
          WHERE machine_screening_state = 'target'
        )::UBIGINT AS flickr_visually_eligible_count,
        count(DISTINCT flickr_photo_id) FILTER (
          WHERE human_review_state = 'reviewed_target_positive'
        )::UBIGINT AS reviewed_positive_count,
        count(DISTINCT flickr_photo_id) FILTER (
          WHERE human_review_state = 'reviewed_non_target'
        )::UBIGINT AS reviewed_negative_count,
        count(DISTINCT flickr_photo_id) FILTER (
          WHERE human_review_state = 'uncertain'
        )::UBIGINT AS uncertain_count,
        count(DISTINCT flickr_photo_id) FILTER (
          WHERE human_review_state IN ('not_requested', 'pending')
        )::UBIGINT AS pending_count,
        count(DISTINCT flickr_photo_id) FILTER (
          WHERE human_review_state = 'media_failure'
        )::UBIGINT AS media_failure_count,
        count(DISTINCT flickr_photo_id) FILTER (
          WHERE human_review_state = 'deferred'
        )::UBIGINT AS skipped_count
      FROM flickr_geographic_source
      WHERE project_id = ${projectId}
        AND run_id = ${runId}
        AND target_accepted_taxon_key = ${taxonKey}
        AND flickr_snapshot_id = ${flickrSnapshot}
        AND spatial_resolution = ${resolution}
        AND cell_supported
        AND spatial_cell_id IS NOT NULL
      GROUP BY ALL
    ), source_full_outer AS (
      SELECT
        coalesce(baseline.project_id, flickr.project_id) AS project_id,
        coalesce(baseline.run_id, flickr.run_id) AS run_id,
        coalesce(baseline.accepted_taxon_key, flickr.accepted_taxon_key) AS accepted_taxon_key,
        coalesce(baseline.baseline_snapshot_id, flickr.baseline_snapshot_id) AS baseline_snapshot_id,
        coalesce(baseline.flickr_snapshot_id, flickr.flickr_snapshot_id) AS flickr_snapshot_id,
        coalesce(baseline.spatial_resolution, flickr.spatial_resolution) AS spatial_resolution,
        coalesce(baseline.spatial_cell_id, flickr.spatial_cell_id) AS spatial_cell_id,
        coalesce(baseline.baseline_union_count, 0)::UBIGINT AS baseline_union_count,
        coalesce(baseline.baseline_eligible_count, 0)::UBIGINT AS baseline_eligible_count,
        coalesce(flickr.flickr_candidate_count, 0)::UBIGINT AS flickr_candidate_count,
        coalesce(flickr.flickr_visually_eligible_count, 0)::UBIGINT AS flickr_visually_eligible_count,
        coalesce(flickr.reviewed_positive_count, 0)::UBIGINT AS reviewed_positive_count,
        coalesce(flickr.reviewed_negative_count, 0)::UBIGINT AS reviewed_negative_count,
        coalesce(flickr.uncertain_count, 0)::UBIGINT AS uncertain_count,
        coalesce(flickr.pending_count, 0)::UBIGINT AS pending_count,
        coalesce(flickr.media_failure_count, 0)::UBIGINT AS media_failure_count,
        coalesce(flickr.skipped_count, 0)::UBIGINT AS skipped_count,
        baseline.spatial_cell_id IS NOT NULL AS baseline_source_present,
        flickr.spatial_cell_id IS NOT NULL AS flickr_source_present
      FROM baseline_cells AS baseline
      FULL OUTER JOIN flickr_cells AS flickr
        ON baseline.project_id = flickr.project_id
       AND baseline.run_id = flickr.run_id
       AND baseline.accepted_taxon_key = flickr.accepted_taxon_key
       AND baseline.baseline_snapshot_id = flickr.baseline_snapshot_id
       AND baseline.flickr_snapshot_id = flickr.flickr_snapshot_id
       AND baseline.spatial_resolution = flickr.spatial_resolution
       AND baseline.spatial_cell_id = flickr.spatial_cell_id
    ), reconciled_cells AS (
      SELECT
        coalesce(source.project_id, impact.project_id) AS project_id,
        coalesce(source.run_id, impact.run_id) AS run_id,
        coalesce(source.accepted_taxon_key, impact.accepted_taxon_key) AS accepted_taxon_key,
        coalesce(source.baseline_snapshot_id, impact.baseline_snapshot_id) AS baseline_snapshot_id,
        coalesce(source.flickr_snapshot_id, impact.flickr_snapshot_id) AS flickr_snapshot_id,
        coalesce(source.spatial_resolution, impact.spatial_resolution) AS spatial_resolution,
        coalesce(source.spatial_cell_id, impact.spatial_cell_id) AS spatial_cell_id,
        coalesce(source.baseline_union_count, 0)::UBIGINT AS baseline_union_count,
        coalesce(source.baseline_eligible_count, 0)::UBIGINT AS baseline_eligible_count,
        coalesce(source.flickr_candidate_count, 0)::UBIGINT AS flickr_candidate_count,
        coalesce(source.flickr_visually_eligible_count, 0)::UBIGINT AS flickr_visually_eligible_count,
        coalesce(source.reviewed_positive_count, 0)::UBIGINT AS reviewed_positive_count,
        coalesce(source.reviewed_negative_count, 0)::UBIGINT AS reviewed_negative_count,
        coalesce(source.uncertain_count, 0)::UBIGINT AS uncertain_count,
        coalesce(source.pending_count, 0)::UBIGINT AS pending_count,
        coalesce(source.media_failure_count, 0)::UBIGINT AS media_failure_count,
        coalesce(source.skipped_count, 0)::UBIGINT AS skipped_count,
        coalesce(impact.release_ready_count, 0)::UBIGINT AS release_ready_count,
        impact.continent,
        impact.country_code,
        impact.country,
        impact.admin1,
        impact.centroid_latitude,
        impact.centroid_longitude,
        impact.nearest_baseline_distance_km,
        impact.data_deficient_state,
        impact.baseline_union_count AS materialized_baseline_union_count,
        impact.baseline_range_inference_eligible_count AS materialized_baseline_eligible_count,
        impact.flickr_candidate_count AS materialized_flickr_candidate_count,
        impact.flickr_visually_eligible_count AS materialized_flickr_visually_eligible_count,
        impact.reviewed_positive_count AS materialized_reviewed_positive_count,
        impact.reviewed_negative_count AS materialized_reviewed_negative_count,
        impact.uncertain_count AS materialized_uncertain_count,
        impact.pending_count AS materialized_pending_count,
        impact.media_failure_count AS materialized_media_failure_count,
        impact.skipped_count AS materialized_skipped_count,
        impact.baseline_only_cell AS materialized_baseline_only_cell,
        impact.matched_cell AS materialized_matched_cell,
        impact.candidate_only_cell AS materialized_candidate_only_cell,
        impact.reviewed_additional_cell AS materialized_reviewed_additional_cell,
        impact.release_ready_additional_cell AS materialized_release_ready_additional_cell,
        source.spatial_cell_id IS NOT NULL AS source_cell_present,
        impact.spatial_cell_id IS NOT NULL AS impact_cell_present,
        coalesce(source.baseline_eligible_count, 0) > 0
          AND coalesce(source.flickr_candidate_count, 0) = 0 AS baseline_only_cell,
        coalesce(source.baseline_eligible_count, 0) > 0
          AND coalesce(source.flickr_candidate_count, 0) > 0 AS matched_cell,
        coalesce(source.baseline_eligible_count, 0) = 0
          AND coalesce(source.flickr_candidate_count, 0) > 0 AS candidate_only_cell,
        coalesce(source.baseline_eligible_count, 0) = 0
          AND coalesce(source.reviewed_positive_count, 0) > 0 AS reviewed_additional_cell,
        coalesce(source.baseline_eligible_count, 0) = 0
          AND coalesce(impact.release_ready_count, 0) > 0 AS release_ready_additional_cell
      FROM source_full_outer AS source
      FULL OUTER JOIN materialized_geographic_impact AS impact
        ON source.project_id = impact.project_id
       AND source.run_id = impact.run_id
       AND source.accepted_taxon_key = impact.accepted_taxon_key
       AND source.baseline_snapshot_id = impact.baseline_snapshot_id
       AND source.flickr_snapshot_id = impact.flickr_snapshot_id
       AND source.spatial_resolution = impact.spatial_resolution
       AND source.spatial_cell_id = impact.spatial_cell_id
      WHERE impact.spatial_cell_id IS NULL OR (
        impact.project_id = ${projectId}
        AND impact.run_id = ${runId}
        AND impact.accepted_taxon_key = ${taxonKey}
        AND impact.baseline_snapshot_id = ${baselineSnapshot}
        AND impact.flickr_snapshot_id = ${flickrSnapshot}
        AND impact.spatial_resolution = ${resolution}
        AND (${scopePredicate})
      )
    )
    SELECT *
    FROM reconciled_cells
    WHERE (${evidencePredicate}) OR NOT source_cell_present OR NOT impact_cell_present
    ORDER BY spatial_cell_id`
}

function geographicScopePredicate(sources: GeographicImpactQuerySources): string {
  const node = sources.selectedHierarchyNode
  switch (sources.input.geographicScope.level) {
    case 'global':
      return 'TRUE'
    case 'continent':
      return `impact.continent = ${sqlLiteral(requiredScopeValue(node.continent, 'continent'))}`
    case 'country':
      return `impact.country_code = ${sqlLiteral(requiredScopeValue(node.country_code, 'country code'))}`
    case 'admin1':
      return `impact.country_code = ${sqlLiteral(requiredScopeValue(node.country_code, 'country code'))}
        AND impact.admin1 = ${sqlLiteral(requiredScopeValue(node.admin1, 'admin1'))}`
  }
}

function evidenceModePredicate(mode: GeographicImpactQuerySources['input']['evidenceMode']): string {
  switch (mode) {
    case 'comparison':
      return 'TRUE'
    case 'baseline':
      return 'baseline_eligible_count > 0'
    case 'flickr_candidates':
      return 'flickr_candidate_count > 0'
    case 'human_reviewed':
      return '(reviewed_positive_count + reviewed_negative_count + uncertain_count) > 0'
    case 'release_ready':
      return 'release_ready_count > 0'
  }
}

function decodeAndReconcileCells(
  table: Awaited<ReturnType<AsyncDuckDBConnection['query']>>,
): readonly GeographicImpactBrowserCell[] {
  const cells = Array.from({ length: table.numRows }, (_, index) => {
    if (!requiredBoolean(table, 'source_cell_present', index)) {
      throw new Error('materialized geographic impact contains a cell absent from source evidence')
    }
    if (!requiredBoolean(table, 'impact_cell_present', index)) {
      throw new Error('source geographic evidence contains a cell absent from materialized impact')
    }
    const baselineUnionCount = requiredCount(table, 'baseline_union_count', index)
    const baselineEligibleCount = requiredCount(table, 'baseline_eligible_count', index)
    const flickrCandidateCount = requiredCount(table, 'flickr_candidate_count', index)
    const flickrVisuallyEligibleCount = requiredCount(
      table,
      'flickr_visually_eligible_count',
      index,
    )
    const reviewedPositiveCount = requiredCount(table, 'reviewed_positive_count', index)
    const reviewedNegativeCount = requiredCount(table, 'reviewed_negative_count', index)
    const uncertainCount = requiredCount(table, 'uncertain_count', index)
    const pendingCount = requiredCount(table, 'pending_count', index)
    const mediaFailureCount = requiredCount(table, 'media_failure_count', index)
    const skippedCount = requiredCount(table, 'skipped_count', index)
    const releaseReadyCount = requiredCount(table, 'release_ready_count', index)
    const baselineOnlyCell = requiredBoolean(table, 'baseline_only_cell', index)
    const matchedCell = requiredBoolean(table, 'matched_cell', index)
    const candidateOnlyCell = requiredBoolean(table, 'candidate_only_cell', index)
    const reviewedAdditionalCell = requiredBoolean(table, 'reviewed_additional_cell', index)
    const releaseReadyAdditionalCell = requiredBoolean(
      table,
      'release_ready_additional_cell',
      index,
    )
    const reconciliations: readonly (readonly [string, number | boolean])[] = [
      ['materialized_baseline_union_count', baselineUnionCount],
      ['materialized_baseline_eligible_count', baselineEligibleCount],
      ['materialized_flickr_candidate_count', flickrCandidateCount],
      ['materialized_flickr_visually_eligible_count', flickrVisuallyEligibleCount],
      ['materialized_reviewed_positive_count', reviewedPositiveCount],
      ['materialized_reviewed_negative_count', reviewedNegativeCount],
      ['materialized_uncertain_count', uncertainCount],
      ['materialized_pending_count', pendingCount],
      ['materialized_media_failure_count', mediaFailureCount],
      ['materialized_skipped_count', skippedCount],
      ['materialized_baseline_only_cell', baselineOnlyCell],
      ['materialized_matched_cell', matchedCell],
      ['materialized_candidate_only_cell', candidateOnlyCell],
      ['materialized_reviewed_additional_cell', reviewedAdditionalCell],
      ['materialized_release_ready_additional_cell', releaseReadyAdditionalCell],
    ]
    for (const [column, expected] of reconciliations) {
      const actual =
        typeof expected === 'boolean'
          ? requiredBoolean(table, column, index)
          : requiredCount(table, column, index)
      if (actual !== expected) {
        throw new Error(`browser source join differs from ${column}`)
      }
    }
    const dataDeficientState = requiredString(table, 'data_deficient_state', index)
    if (!['sufficient', 'data_deficient', 'unavailable'].includes(dataDeficientState)) {
      throw new Error('DuckDB geographic impact returned an invalid data deficiency state')
    }
    return Object.freeze({
      spatialResolution: requiredCount(table, 'spatial_resolution', index),
      spatialCellId: requiredString(table, 'spatial_cell_id', index),
      continent: nullableString(table, 'continent', index),
      countryCode: nullableString(table, 'country_code', index),
      country: nullableString(table, 'country', index),
      admin1: nullableString(table, 'admin1', index),
      latitude: requiredFiniteNumber(table, 'centroid_latitude', index),
      longitude: requiredFiniteNumber(table, 'centroid_longitude', index),
      baselineUnionCount,
      baselineRangeInferenceEligibleCount: baselineEligibleCount,
      flickrCandidateCount,
      flickrVisuallyEligibleCount,
      reviewedPositiveCount,
      reviewedNegativeCount,
      uncertainCount,
      pendingCount,
      mediaFailureCount,
      skippedCount,
      releaseReadyCount,
      baselineOnlyCell,
      matchedCell,
      candidateOnlyCell,
      reviewedAdditionalCell,
      releaseReadyAdditionalCell,
      nearestBaselineDistanceKm: nullableFiniteNumber(
        table,
        'nearest_baseline_distance_km',
        index,
      ),
      dataDeficientState: dataDeficientState as GeographicImpactBrowserCell['dataDeficientState'],
    })
  })
  return Object.freeze(cells)
}

function countCells(
  cells: readonly GeographicImpactBrowserCell[],
  field: keyof Pick<
    GeographicImpactBrowserCell,
    | 'baselineOnlyCell'
    | 'matchedCell'
    | 'candidateOnlyCell'
    | 'reviewedAdditionalCell'
    | 'releaseReadyAdditionalCell'
  >,
): number {
  return cells.filter((cell) => cell[field]).length
}

function requiredScopeValue(value: string | null, label: string): string {
  if (value === null || value.length === 0) {
    throw new Error(`selected hierarchy node has no ${label}`)
  }
  return value
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
    throw new Error(`DuckDB geographic impact returned an invalid ${column}`)
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
    throw new Error(`DuckDB geographic impact returned an invalid ${column}`)
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
    throw new Error(`DuckDB geographic impact returned an invalid ${column}`)
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
    throw new Error(`DuckDB geographic impact returned an invalid ${column}`)
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
    throw new Error(`DuckDB geographic impact returned an invalid ${column}`)
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
    throw new Error(`DuckDB geographic impact returned an invalid ${column}`)
  }
  return value
}
