import { beforeEach, describe, expect, it, vi } from 'vitest'

const duckDb = vi.hoisted(() => {
  const query = vi.fn(async (_sql: string) => undefined)
  const close = vi.fn(async () => undefined)
  const connection = {
    query,
    close,
  }
  const database = {
    getVersion: vi.fn(async () => 'v1.4.3'),
    connect: vi.fn(async () => connection),
    copyFileToBuffer: vi.fn(async () => new Uint8Array([80, 65, 82, 49])),
    dropFile: vi.fn(async () => undefined),
    terminate: vi.fn(async () => undefined),
  }
  return {
    query,
    close,
    connection,
    database,
    createDuckDbRuntime: vi.fn(async () => ({ database })),
    loadLocalParquetExtension: vi.fn(
      async () => 'https://taxalens.invalid/assets/parquet.wasm',
    ),
  }
})

vi.mock('../../data/duckdbRuntime', () => ({
  DUCKDB_ENGINE_VERSION: 'v1.4.3',
  createDuckDbRuntime: duckDb.createDuckDbRuntime,
  loadLocalParquetExtension: duckDb.loadLocalParquetExtension,
}))

import {
  FLICKR_REVIEWED_LABELS_V2_FILE,
  FLICKR_REVIEWED_LABELS_V2_MEDIA_TYPE,
  writeFlickrReviewedLabelsV2Parquet,
  type BioMinerReviewedLabelV2ProvenanceRow,
} from './flickrReviewedLabels'

describe('Flickr reviewed-label v2 Parquet writer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('writes canonical rows through the pinned local DuckDB runtime', async () => {
    const second = reviewedLabelRow({
      flickr_photo_id: '200',
      detection_id: 'media:200',
      taxalens_effective_event_ids: ['event-2'],
    })
    const first = reviewedLabelRow({
      flickr_photo_id: '100',
      detection_id: 'media:100',
      taxalens_effective_event_ids: ['event-1'],
      review_notes: "Reviewer said 'yes'.",
    })

    const file = await writeFlickrReviewedLabelsV2Parquet([second, first])

    expect(file).toMatchObject({
      filename: FLICKR_REVIEWED_LABELS_V2_FILE,
      mediaType: FLICKR_REVIEWED_LABELS_V2_MEDIA_TYPE,
      bytes: new Uint8Array([80, 65, 82, 49]),
      rowCount: 2,
      decisionLedgerSha256: 'd'.repeat(64),
      samplingPlanSha256: '5'.repeat(64),
    })
    expect(file.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(duckDb.database.getVersion).toHaveBeenCalledOnce()
    expect(duckDb.loadLocalParquetExtension).toHaveBeenCalledOnce()
    expect(duckDb.database.connect).toHaveBeenCalledOnce()
    const queries = duckDb.query.mock.calls.map(([query]) => String(query))
    expect(queries[0]).toContain('autoload_known_extensions = false')
    expect(queries[0]).toContain(
      "LOAD 'https://taxalens.invalid/assets/parquet.wasm'",
    )
    expect(queries[1]).toContain(
      'CREATE TABLE flickr_reviewed_labels_v2',
    )
    expect(queries[1]).toContain(
      'taxalens_effective_event_ids VARCHAR[] NOT NULL',
    )
    expect(queries[2]).toContain("'100'")
    expect(queries[2]).toContain("'Reviewer said ''yes''.'")
    expect(queries[2]).toContain("['event-1']")
    expect(queries[3]).toContain("'200'")
    expect(queries.at(-1)).toContain(
      "TO 'flickr_reviewed_labels_v2.parquet'",
    )
    expect(duckDb.database.copyFileToBuffer).toHaveBeenCalledWith(
      FLICKR_REVIEWED_LABELS_V2_FILE,
    )
    expect(duckDb.close).toHaveBeenCalledOnce()
    expect(duckDb.database.dropFile).toHaveBeenCalledWith(
      FLICKR_REVIEWED_LABELS_V2_FILE,
    )
    expect(duckDb.database.terminate).toHaveBeenCalledOnce()
  })

  it('rejects empty or differently bound exports before starting DuckDB', async () => {
    await expect(writeFlickrReviewedLabelsV2Parquet([])).rejects.toThrow(
      'Reviewed-label export has no scientific decision rows.',
    )
    await expect(
      writeFlickrReviewedLabelsV2Parquet([
        reviewedLabelRow({ flickr_photo_id: '100' }),
        reviewedLabelRow({
          flickr_photo_id: '200',
          taxalens_decision_ledger_sha256: 'e'.repeat(64),
        }),
      ]),
    ).rejects.toThrow(
      'Reviewed-label rows do not share one valid decision ledger fingerprint.',
    )
    await expect(
      writeFlickrReviewedLabelsV2Parquet([
        reviewedLabelRow({ flickr_photo_id: '100' }),
        reviewedLabelRow({
          flickr_photo_id: '200',
          taxalens_sampling_plan_sha256: '6'.repeat(64),
        }),
      ]),
    ).rejects.toThrow(
      'Reviewed-label rows do not share one valid sampling plan fingerprint.',
    )
    expect(duckDb.createDuckDbRuntime).not.toHaveBeenCalled()
  })
})

function reviewedLabelRow(
  overrides: Partial<BioMinerReviewedLabelV2ProvenanceRow> = {},
): BioMinerReviewedLabelV2ProvenanceRow {
  return {
    schema_version: 'reviewed-labels-v2',
    source: 'flickr',
    flickr_photo_id: '100',
    detection_id: 'media:100',
    crop_hash: `sha256:${'c'.repeat(64)}`,
    label_level: 'species',
    is_butterfly: true,
    accepted_taxon_key: 'gbif:1938069',
    scientific_name: 'Papilio demoleus',
    family_key: 'gbif:9417',
    family: 'Papilionidae',
    genus_key: 'gbif:1938052',
    genus: 'Papilio',
    label_source: 'taxalens_human_verification',
    reviewer_id: 'reviewer-a',
    reviewed_at: '2026-07-16T12:00:00.000Z',
    review_confidence: 'high',
    review_notes: '',
    target_present: true,
    label_certainty: 'high',
    life_stage: 'adult',
    visual_domain: 'live_field',
    view: 'dorsal',
    route: 'adult_field',
    geo_cluster_id: 'geo:sydney',
    source_query_tier: 'T1',
    source_query_term: 'Papilio demoleus',
    duplicate_group_id: 'duplicate:100',
    observer_owner_group_id: 'flickr-owner:owner-a',
    dataset_split: 'final_test',
    second_review_status: 'completed',
    ambiguity_reason: '',
    unsuitable_for_species_identification: false,
    taxalens_campaign_id: 'campaign:test',
    taxalens_campaign_manifest_sha256: 'm'.repeat(64),
    taxalens_question_sha256: 'q'.repeat(64),
    taxalens_taxalens_sha: 'a'.repeat(40),
    taxalens_biominer_sha: 'b'.repeat(40),
    taxalens_sampling_plan_id: 'sampling:test',
    taxalens_sampling_purpose: 'quality_estimation',
    taxalens_sampling_design: 'clustered_random',
    taxalens_sampling_plan_json: '{"purpose":"quality_estimation"}',
    taxalens_sampling_plan_sha256: '5'.repeat(64),
    taxalens_inclusion_probability: 0.5,
    taxalens_sampling_weight: 2,
    taxalens_decision_ledger_sha256: 'd'.repeat(64),
    taxalens_effective_event_ids: ['event-1'],
    taxalens_reviewer_group_ids: ['reviewer-a'],
    taxalens_blind_review: true,
    taxalens_quality_estimation_allowed: true,
    taxalens_scientific_claim_allowed: false,
    ...overrides,
  }
}
