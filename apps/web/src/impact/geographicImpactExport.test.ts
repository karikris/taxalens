import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { prepareGeographicImpactCellExport } from './geographicImpactExport'
import {
  PUBLIC_GEOGRAPHIC_IMPACT_MAP_SOURCE,
  type PublicGeographicImpactMapCell,
  type PublicGeographicImpactMapData,
} from './publicGeographicImpactMapData'

const sourceParquet = Uint8Array.from(
  readFileSync(
    resolve(
      process.cwd(),
      '../../demo/source/biominer_phase14/geographic_impact/geographic_impact_cells.parquet',
    ),
  ),
)

describe('Geographic Impact cell export', () => {
  it('prepares deterministic selected-scope JSON and CSV plus verified source Parquet', async () => {
    const first = await prepareGeographicImpactCellExport(data(), sourceParquet)
    const second = await prepareGeographicImpactCellExport(data(), sourceParquet)

    expect(first.prefix).toBe('taxalens-papilio-demoleus-country-in-r7')
    expect(first.selectedCellCount).toBe(2)
    expect(first.sourceParquetScope).toBe('full_target_all_supported_resolutions')
    expect(first.scientificClaimAllowed).toBe(false)
    expect(first.payloads.map(({ filename, role }) => ({ filename, role }))).toEqual([
      {
        role: 'cells_json',
        filename: 'taxalens-papilio-demoleus-country-in-r7.cells.json',
      },
      {
        role: 'cells_csv',
        filename: 'taxalens-papilio-demoleus-country-in-r7.cells.csv',
      },
      {
        role: 'source_cells_parquet',
        filename: 'taxalens-papilio-demoleus-country-in-r7.source-cells.parquet',
      },
    ])
    expect(first.payloads.map(({ bytes }) => bytes)).toEqual(
      second.payloads.map(({ bytes }) => bytes),
    )

    const json = JSON.parse(new TextDecoder().decode(first.payloads[0]?.bytes))
    expect(json.scopeId).toBe('country:IN')
    expect(json.selectedCellCount).toBe(2)
    expect(json.cells.map(({ spatial_cell_id }: { spatial_cell_id: string }) => spatial_cell_id))
      .toEqual(['cell-a', 'cell-b'])
    expect(json.semantics.candidateOnly).toMatch(/not proof of biological absence/u)

    const csv = new TextDecoder().decode(first.payloads[1]?.bytes)
    expect(csv).toMatch(/^spatial_resolution,spatial_cell_id,/u)
    expect(csv).toContain('\r\n7,cell-a,')
    expect(csv.endsWith('\r\n')).toBe(true)
    expect(first.payloads[2]?.bytes).toEqual(sourceParquet)
  })

  it('rejects altered or non-Parquet source bytes', async () => {
    const altered = sourceParquet.slice()
    altered[100] = (altered[100] ?? 0) ^ 0xff

    await expect(prepareGeographicImpactCellExport(data(), altered)).rejects.toThrow(
      /exact verified cells Parquet/u,
    )
    await expect(
      prepareGeographicImpactCellExport(data(), new Uint8Array([1, 2, 3, 4])),
    ).rejects.toThrow(/exact verified cells Parquet/u)
  })
})

function data(): PublicGeographicImpactMapData {
  return {
    cells: [cell('cell-b'), cell('cell-a', { candidateOnlyCell: true })],
    spatialResolution: 7,
    scopeId: 'country:IN',
    source: PUBLIC_GEOGRAPHIC_IMPACT_MAP_SOURCE,
    scientificClaimAllowed: false,
  }
}

function cell(
  spatialCellId: string,
  overrides: Partial<PublicGeographicImpactMapCell> = {},
): PublicGeographicImpactMapCell {
  return {
    spatialResolution: 7,
    spatialCellId,
    continent: 'Asia',
    countryCode: 'IN',
    country: 'India',
    admin1: null,
    latitude: 20,
    longitude: 78,
    baselineUnionCount: 0,
    baselineRangeInferenceEligibleCount: 0,
    baselineExcludedOccurrenceCount: 0,
    gbifOnlyCount: 0,
    inaturalistOriginThroughGbifCount: 0,
    directInaturalistDeltaStatus: 'unavailable',
    directInaturalistDeltaCount: null,
    duplicatesRemovedCount: 0,
    unresolvedProviderDuplicateGroupCount: 0,
    flickrCandidateCount: 1,
    flickrVisuallyEligibleCount: 1,
    reviewedPositiveCount: 0,
    reviewedNegativeCount: 0,
    uncertainCount: 0,
    pendingCount: 1,
    mediaFailureCount: 0,
    skippedCount: 0,
    releaseReadyCount: 0,
    baselineOnlyCell: false,
    matchedCell: false,
    candidateOnlyCell: false,
    reviewedAdditionalCell: false,
    releaseReadyAdditionalCell: false,
    nearestBaselineDistanceKm: 42.5,
    dataDeficientState: 'data_deficient',
    latestBaselineEventDate: '2024-01-01',
    latestFlickrCandidateDate: null,
    latestReviewedPositiveDate: null,
    latestReleaseReadyDate: null,
    ...overrides,
  }
}
