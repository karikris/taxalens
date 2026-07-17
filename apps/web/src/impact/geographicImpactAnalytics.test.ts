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
  const query = vi.fn(async (sql: string) =>
    sql.startsWith('WITH baseline_cells') ? table : undefined,
  )
  const connection = { query, close: vi.fn(async () => undefined) }
  const database = {
    getVersion: vi.fn(async () => 'v1.4.3'),
    registerFileBuffer: vi.fn(async () => undefined),
    connect: vi.fn(async () => connection),
    dropFiles: vi.fn(async () => undefined),
    terminate: vi.fn(async () => undefined),
  }
  return {
    rows,
    query,
    connection,
    database,
    createDuckDbRuntime: vi.fn(async () => ({ database, worker: {} })),
    loadLocalParquetExtension: vi.fn(
      async () => 'https://taxalens.invalid/assets/parquet.wasm',
    ),
  }
})

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
  })

  it('executes a seven-key full outer join and returns reconciled contribution states', async () => {
    const result = await queryGeographicImpact(
      createSyntheticGeographicProject(),
      syntheticGeographicQuery,
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

    const sql = duckDb.query.mock.calls.map(([statement]) => statement).find((statement) =>
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
  })

  it('fails closed when the source join differs from materialized impact', async () => {
    duckDb.rows[2] = {
      ...duckDb.rows[2],
      materialized_flickr_candidate_count: 4n,
    }

    await expect(
      queryGeographicImpact(createSyntheticGeographicProject(), syntheticGeographicQuery),
    ).rejects.toThrow(
      'browser source join differs from materialized_flickr_candidate_count',
    )
    expect(duckDb.connection.close).toHaveBeenCalledOnce()
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
