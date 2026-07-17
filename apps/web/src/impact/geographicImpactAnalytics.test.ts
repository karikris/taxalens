import { beforeEach, describe, expect, it, vi } from 'vitest'

const duckDb = vi.hoisted(() => {
  const rows: Record<string, unknown>[] = []
  const table = {
    get numRows() {
      return rows.length
    },
    getChild(column: string) {
      return { get: (index: number) => rows[index]?.[column] }
    },
  }
  const rollupRows: Record<string, unknown>[] = []
  const rollupTable = {
    get numRows() {
      return rollupRows.length
    },
    getChild(column: string) {
      return { get: (index: number) => rollupRows[index]?.[column] }
    },
  }
  const query = vi.fn(async (sql: string) =>
    sql.startsWith('WITH baseline_cells') ? table : undefined,
  )
  const send = vi.fn(async (sql: string) => ({
    readAll: vi.fn(async () => [sql.startsWith('WITH baseline_cells') ? table : rollupTable]),
  }))
  const cancelSent = vi.fn(async () => true)
  const connection = {
    query,
    send,
    cancelSent,
    close: vi.fn(async () => undefined),
  }
  const database = {
    getVersion: vi.fn(async () => 'v1.4.3'),
    registerFileBuffer: vi.fn(async () => undefined),
    connect: vi.fn(async () => connection),
    dropFiles: vi.fn(async () => undefined),
    terminate: vi.fn(async () => undefined),
  }
  return {
    rows,
    rollupRows,
    query,
    send,
    cancelSent,
    connection,
    database,
    createDuckDbRuntime: vi.fn(async () => ({ database, worker: {} })),
    loadLocalParquetExtension: vi.fn(
      async () => 'https://taxalens.invalid/assets/parquet.wasm',
    ),
  }
})

vi.mock('apache-arrow', () => ({
  Table: function MockArrowTable(batches: readonly unknown[]) {
    return batches[0]
  },
}))

vi.mock('../data/duckdbRuntime', () => ({
  DUCKDB_ENGINE_VERSION: 'v1.4.3',
  DUCKDB_WASM_PACKAGE_VERSION: '1.32.0',
  createDuckDbRuntime: duckDb.createDuckDbRuntime,
  loadLocalParquetExtension: duckDb.loadLocalParquetExtension,
}))

import {
  createSyntheticGeographicProject,
  syntheticGeographicQuery,
} from '../test/geographicImpactProjectFixture'
import {
  buildGeographicImpactSql,
  buildGeographicRollupSql,
  queryGeographicImpact,
} from './geographicImpactAnalytics'
import { loadGeographicImpactQuerySources } from './geographicImpactSources'

describe('browser geographic impact full outer join', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    duckDb.rows.splice(
      0,
      duckDb.rows.length,
      impactRow({
        spatial_cell_id: 'cell:baseline',
        baseline_union_count: 2n,
        baseline_eligible_count: 2n,
        materialized_baseline_union_count: 2n,
        materialized_baseline_eligible_count: 2n,
        baseline_only_cell: true,
        materialized_baseline_only_cell: true,
      }),
      impactRow({
        spatial_cell_id: 'cell:matched',
        baseline_union_count: 3n,
        baseline_eligible_count: 3n,
        materialized_baseline_union_count: 3n,
        materialized_baseline_eligible_count: 3n,
        flickr_candidate_count: 4n,
        materialized_flickr_candidate_count: 4n,
        pending_count: 4n,
        materialized_pending_count: 4n,
        matched_cell: true,
        materialized_matched_cell: true,
      }),
      impactRow({
        spatial_cell_id: 'cell:candidate',
        flickr_candidate_count: 5n,
        flickr_visually_eligible_count: 4n,
        reviewed_positive_count: 1n,
        pending_count: 4n,
        materialized_flickr_candidate_count: 5n,
        materialized_flickr_visually_eligible_count: 4n,
        materialized_reviewed_positive_count: 1n,
        materialized_pending_count: 4n,
        candidate_only_cell: true,
        reviewed_additional_cell: true,
        materialized_candidate_only_cell: true,
        materialized_reviewed_additional_cell: true,
        nearest_baseline_distance_km: 18.25,
      }),
    )
    duckDb.rollupRows.splice(
      0,
      duckDb.rollupRows.length,
      rollupRow({
        scope_level: 'country',
        scope_id: 'country:AU',
        scope_name: 'Australia',
        parent_scope_id: 'continent:Oceania',
      }),
    )
  })

  it('executes a seven-key full outer join and returns reconciled contribution states', async () => {
    const result = await queryGeographicImpact(
      createSyntheticGeographicProject(),
      syntheticGeographicQuery,
      new AbortController().signal,
    )

    expect(result).toMatchObject({
      backend: 'duckdb-wasm-parquet',
      engineVersion: 'v1.4.3',
      operation: 'full_outer_cell_comparison',
      baselineOnlyCellCount: 1,
      matchedCellCount: 1,
      candidateOnlyCellCount: 1,
      reviewedAdditionalCellCount: 1,
      releaseReadyAdditionalCellCount: 0,
      scientificClaimAllowed: false,
    })
    expect(result.selectedRollup).toMatchObject({
      scopeLevel: 'country',
      scopeId: 'country:AU',
      cellCount: 3,
      baselineUnionCount: 5,
      flickrCandidateCount: 9,
      candidateOnlyCellCount: 1,
      reviewedAdditionalCellCount: 1,
    })
    expect(result.childRollups).toEqual([])
    expect(result.engineering).toMatchObject({
      operationType: 'full_outer_spatial_cell_join',
      inputRows: 31,
      joinInputRows: 21,
      reconciliationInputRows: 7,
      rollupInputRows: 3,
      outputRows: 3,
      rollupOutputRows: 1,
      registeredBytes: 12,
      physicalBytesScanned: null,
      physicalBytesScannedStatus: 'unavailable_from_duckdb_wasm',
      registeredBytesUpperBound: 12,
      filteredPartitions: 0,
      partitioningState: 'unpartitioned_parquet_files',
      matchedCellCount: 1,
      baselineOnlyCellCount: 1,
      candidateOnlyCellCount: 1,
      unclassifiedCellCount: 0,
      reviewedAdditionalCellCount: 1,
      releaseReadyAdditionalCellCount: 0,
      sourceOnlyCellCount: 0,
      materializedOnlyCellCount: 0,
      cacheState: 'fresh_duckdb_worker_memory_no_persistent_cache',
    })
    expect(result.engineering.elapsedMilliseconds).toBeGreaterThanOrEqual(0)
    expect(result.engineering.inputRelations).toEqual([
      { logicalName: 'baseline_occurrence_union', inputRows: 9 },
      { logicalName: 'flickr_geography', inputRows: 12 },
      { logicalName: 'geographic_impact_cells', inputRows: 7 },
      { logicalName: 'geographic_impact_summary', inputRows: 3 },
    ])
    expect(result.engineering.filtersApplied).toContain('scope_id=country:AU')
    expect(result.engineering.sourceArtifacts).toHaveLength(4)
    expect(result.joinKeys).toEqual([
      'project_id',
      'run_id',
      'accepted_taxon_key',
      'baseline_snapshot_id',
      'flickr_snapshot_id',
      'spatial_resolution',
      'spatial_cell_id',
    ])
    expect(result.cells[2]).toMatchObject({
      spatialCellId: 'cell:candidate',
      baselineRangeInferenceEligibleCount: 0,
      flickrCandidateCount: 5,
      reviewedPositiveCount: 1,
      pendingCount: 4,
      candidateOnlyCell: true,
      reviewedAdditionalCell: true,
      releaseReadyAdditionalCell: false,
      nearestBaselineDistanceKm: 18.25,
    })
    expect(duckDb.database.registerFileBuffer).toHaveBeenCalledTimes(4)
    expect(duckDb.database.dropFiles).toHaveBeenCalledWith([
      'baseline_occurrence_union.parquet',
      'flickr_geography.parquet',
      'geographic_impact_cells.parquet',
      'geographic_impact_summary.parquet',
    ])
    expect(duckDb.connection.close).toHaveBeenCalledOnce()
    expect(duckDb.database.terminate).toHaveBeenCalledOnce()

    const sql = duckDb.send.mock.calls.map(([statement]) => statement).find((statement) =>
      statement.startsWith('WITH baseline_cells'),
    )
    expect(sql).toContain('FULL OUTER JOIN flickr_cells')
    expect(sql).toContain('baseline.project_id = flickr.project_id')
    expect(sql).toContain('baseline.run_id = flickr.run_id')
    expect(sql).toContain('baseline.accepted_taxon_key = flickr.accepted_taxon_key')
    expect(sql).toContain('baseline.baseline_snapshot_id = flickr.baseline_snapshot_id')
    expect(sql).toContain('baseline.flickr_snapshot_id = flickr.flickr_snapshot_id')
    expect(sql).toContain('baseline.spatial_resolution = flickr.spatial_resolution')
    expect(sql).toContain('baseline.spatial_cell_id = flickr.spatial_cell_id')
    expect(sql).toContain("impact.country_code = 'AU'")
    expect(sql).not.toContain('SELECT *')
    const rollupSql = duckDb.send.mock.calls
      .map(([statement]) => statement)
      .find((statement) => statement.startsWith('WITH selected_rollup'))
    expect(rollupSql).toContain("scope_level = 'country'")
    expect(rollupSql).toContain("scope_level = 'admin1'")
    expect(rollupSql).toContain("parent_scope_id = 'country:AU'")
    expect(rollupSql).not.toContain('SELECT *')
    const projectedViews = duckDb.query.mock.calls
      .map(([statement]) => statement)
      .filter((statement) => statement.includes('read_parquet'))
    expect(projectedViews).toHaveLength(4)
    expect(projectedViews.every((statement) => !statement.includes('SELECT *'))).toBe(true)
    expect(projectedViews[0]).toContain('canonical_observation_id')
    expect(projectedViews[1]).toContain('human_review_state')
  })

  it('fails closed when the source join differs from materialized impact', async () => {
    duckDb.rows[2] = {
      ...duckDb.rows[2],
      materialized_flickr_candidate_count: 4n,
    }

    await expect(
      queryGeographicImpact(
        createSyntheticGeographicProject(),
        syntheticGeographicQuery,
        new AbortController().signal,
      ),
    ).rejects.toThrow(
      'browser source join differs from materialized_flickr_candidate_count',
    )
    expect(duckDb.connection.close).toHaveBeenCalledOnce()
    expect(duckDb.database.terminate).toHaveBeenCalledOnce()
  })

  it('cancels a pending SELECT and terminates aborted worker state', async () => {
    let rejectPending: ((reason: Error) => void) | undefined
    duckDb.send.mockImplementationOnce(
      async () =>
        await new Promise<never>((_resolve, reject) => {
          rejectPending = reject
        }),
    )
    duckDb.cancelSent.mockImplementationOnce(async () => {
      rejectPending?.(new Error('pending query cancelled'))
      return true
    })
    const controller = new AbortController()
    const pending = queryGeographicImpact(
      createSyntheticGeographicProject(),
      syntheticGeographicQuery,
      controller.signal,
    )
    await vi.waitFor(() => expect(duckDb.send).toHaveBeenCalledOnce())

    controller.abort()

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(duckDb.cancelSent).toHaveBeenCalledOnce()
    expect(duckDb.connection.close).not.toHaveBeenCalled()
    expect(duckDb.database.dropFiles).not.toHaveBeenCalled()
    expect(duckDb.database.terminate).toHaveBeenCalledOnce()
  })

  it('emits the spread fallback aggregation without weakening identity filters', () => {
    const sources = loadGeographicImpactQuerySources(
      createSyntheticGeographicProject({ unionAvailable: false }),
      syntheticGeographicQuery,
    )
    const sql = buildGeographicImpactSql(sources)

    expect(sql).toContain('sum(range_inference_eligible_count)::UBIGINT')
    expect(sql).toContain("source_snapshot_version = 'baseline:synthetic-geography'")
    expect(sql).toContain("'project:synthetic-geography'::VARCHAR AS project_id")
    expect(sql).toContain('FULL OUTER JOIN flickr_cells')
  })

  it.each([
    ['global', 'global', "scope_level = 'continent'"],
    ['continent', 'continent:Oceania', "scope_level = 'country'"],
    ['country', 'country:AU', "scope_level = 'admin1'"],
    ['admin1', 'admin1:AU-NSW', 'WHERE FALSE'],
  ] as const)('queries the immediate %s hierarchy rollup', (level, id, childClause) => {
    const query = {
      ...syntheticGeographicQuery,
      geographicScope: { level, id },
    }
    const sources = loadGeographicImpactQuerySources(
      createSyntheticGeographicProject(),
      query,
    )

    const sql = buildGeographicRollupSql(sources)

    expect(sql).toContain(`scope_level = '${level}'`)
    expect(sql).toContain(`scope_id = '${id}'`)
    expect(sql).toContain(childClause)
  })
})

function impactRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    source_cell_present: true,
    impact_cell_present: true,
    spatial_resolution: 5n,
    spatial_cell_id: 'cell:default',
    continent: 'Oceania',
    country_code: 'AU',
    country: 'Australia',
    admin1: null,
    centroid_latitude: -25,
    centroid_longitude: 134,
    baseline_union_count: 0n,
    baseline_eligible_count: 0n,
    flickr_candidate_count: 0n,
    flickr_visually_eligible_count: 0n,
    reviewed_positive_count: 0n,
    reviewed_negative_count: 0n,
    uncertain_count: 0n,
    pending_count: 0n,
    media_failure_count: 0n,
    skipped_count: 0n,
    release_ready_count: 0n,
    baseline_only_cell: false,
    matched_cell: false,
    candidate_only_cell: false,
    reviewed_additional_cell: false,
    release_ready_additional_cell: false,
    materialized_baseline_union_count: 0n,
    materialized_baseline_eligible_count: 0n,
    materialized_flickr_candidate_count: 0n,
    materialized_flickr_visually_eligible_count: 0n,
    materialized_reviewed_positive_count: 0n,
    materialized_reviewed_negative_count: 0n,
    materialized_uncertain_count: 0n,
    materialized_pending_count: 0n,
    materialized_media_failure_count: 0n,
    materialized_skipped_count: 0n,
    materialized_baseline_only_cell: false,
    materialized_matched_cell: false,
    materialized_candidate_only_cell: false,
    materialized_reviewed_additional_cell: false,
    materialized_release_ready_additional_cell: false,
    nearest_baseline_distance_km: null,
    data_deficient_state: 'sufficient',
    ...overrides,
  }
}

function rollupRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    scope_level: 'country',
    scope_id: 'country:AU',
    scope_name: 'Australia',
    parent_scope_id: 'continent:Oceania',
    continent: 'Oceania',
    country_code: 'AU',
    country: 'Australia',
    admin1: null,
    baseline_evidence_status: 'available',
    baseline_union_count: 5n,
    baseline_range_inference_eligible_count: 5n,
    gbif_only_count: 5n,
    inaturalist_origin_through_gbif_count: 0n,
    direct_inaturalist_delta_status: 'unavailable',
    direct_inaturalist_delta_count: null,
    duplicates_removed_count: 0n,
    unresolved_provider_duplicate_group_count: 0n,
    cell_count: 3n,
    baseline_occupied_cell_count: 2n,
    flickr_candidate_count: 9n,
    flickr_visually_eligible_count: 4n,
    reviewed_positive_count: 1n,
    reviewed_negative_count: 0n,
    uncertain_count: 0n,
    pending_count: 8n,
    media_failure_count: 0n,
    skipped_count: 0n,
    release_ready_count: 0n,
    flickr_occupied_cell_count: 2n,
    baseline_only_cell_count: 1n,
    matched_cell_count: 1n,
    candidate_only_cell_count: 1n,
    reviewed_additional_cell_count: 1n,
    release_ready_additional_cell_count: 0n,
    maximum_nearest_baseline_distance_km: 18.25,
    data_deficient_state: 'sufficient',
    ...overrides,
  }
}
