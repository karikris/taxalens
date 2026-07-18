import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { sha256Hex } from '../evidence/evidenceExport'
import {
  prepareGeographicImpactCellExport,
  prepareGeographicImpactExportBundle,
  prepareGeographicImpactMethodology,
  prepareGeographicImpactScopeSummary,
} from './geographicImpactExport'
import { TAXALENS_GEOGRAPHIC_SCOPE_INDEX } from './geographicScope'
import {
  type PublicGeographicImpactMapCell,
  type PublicGeographicImpactMapData,
} from './publicGeographicImpactMapData'
import { TEST_GEOGRAPHIC_IMPACT_MAP_SOURCE } from '../test/geographicImpactMapFixture'

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

  it('exports an exact hierarchy-bound scope summary without coercing unavailable values', () => {
    const summary = prepareGeographicImpactScopeSummary(
      data(),
      requiredScope('country:IN'),
    )

    expect(summary.payloads.map(({ role }) => role)).toEqual([
      'scope_summary_json',
      'scope_summary_csv',
    ])
    const json = JSON.parse(new TextDecoder().decode(summary.payloads[0]?.bytes))
    expect(json.scope).toEqual({
      level: 'country',
      id: 'country:IN',
      name: 'India',
      parentId: 'continent:asia',
      continent: 'Asia',
      countryCode: 'IN',
      country: 'India',
      admin1: null,
    })
    expect(json.summary).toMatchObject({
      cellCount: 2,
      flickrCandidateCount: 2,
      candidateOnlyCellCount: 1,
      reviewedAdditionalCellCount: 0,
      releaseReadyAdditionalCellCount: 0,
      directInaturalistDeltaStatus: 'unavailable',
      directInaturalistDeltaCount: null,
      coverageUplift: {
        status: 'available',
        baselineOccupiedCellCount: 1,
      },
    })
    const csv = new TextDecoder().decode(summary.payloads[1]?.bytes)
    expect(csv).toContain('scope_id,country:IN\r\n')
    expect(csv).toContain('direct_inaturalist_delta_status,unavailable\r\n')
    expect(csv).toContain('direct_inaturalist_delta_count,\r\n')
    expect(csv).toContain('candidate_only_cell_count,1\r\n')
    expect(csv).toContain('scientific_claim_allowed,false\r\n')
  })

  it('rejects a summary whose hierarchy identity differs from the selected data', () => {
    expect(() =>
      prepareGeographicImpactScopeSummary(
        data(),
        TAXALENS_GEOGRAPHIC_SCOPE_INDEX.root,
      ),
    ).toThrow(/scope differs/u)
  })

  it('exports artifact-bound methodology, provenance and claim boundaries', () => {
    const prepared = prepareGeographicImpactMethodology(
      data(),
      requiredScope('country:IN'),
    )
    const text = new TextDecoder().decode(prepared.payload.bytes)
    const methodology = JSON.parse(text)

    expect(prepared.payload.role).toBe('methodology_json')
    expect(methodology.exportTimestamp).toBeNull()
    expect(methodology.identities).toMatchObject({
      geographicImpactManifestId: 'geographic-impact-manifest:e3c532a1c6310d2a0906cacc',
      baselineSnapshotId: 'gbif-occurrence-search-20260715',
      flickrSnapshotId: 'flickr:2026-07-15',
    })
    expect(methodology.identities.sourceCommits).toEqual(
      expect.arrayContaining([
        {
          repository: 'karikris/BioMiner',
          commit_sha: '247b42f3206d48bb79e2dbf97c5a92e4f207ae71',
        },
        {
          repository: 'karikris/BioMiner',
          commit_sha: '75461d9c065af0cd96b41cd1f845c2e920f7ae34',
        },
      ]),
    )
    expect(
      methodology.sourceArtifacts.find(
        ({ logicalName }: { logicalName: string }) => logicalName === 'quality_snapshot',
      ),
    ).toMatchObject({ availability: 'unavailable', sha256: null })
    expect(methodology.methods.nearestBaselineDistance).toMatchObject({
      method: 'haversine_cell_centroid',
      sameResolutionRequired: true,
      biologicalRangeBoundary: false,
    })
    expect(methodology.limitations).toContain(
      'The direct iNaturalist delta is unavailable and is not fabricated.',
    )
    for (const prohibited of [
      'official records',
      'new Flickr records',
      'confirmed knowledge gain',
      'new range',
      'species absent from GBIF',
      'records added to science',
    ]) {
      expect(text).not.toContain(prohibited)
    }
  })

  it('hashes every payload and binds a deterministic unsigned manifest', async () => {
    const first = await prepareGeographicImpactExportBundle(
      data(),
      requiredScope('country:IN'),
      sourceParquet,
    )
    const second = await prepareGeographicImpactExportBundle(
      data(),
      requiredScope('country:IN'),
      sourceParquet,
    )

    expect(first.files).toHaveLength(7)
    expect(first.files.map(({ role }) => role)).toEqual([
      'cells_json',
      'cells_csv',
      'source_cells_parquet',
      'scope_summary_json',
      'scope_summary_csv',
      'methodology_json',
      'manifest_json',
    ])
    expect(first.bundleSha256).toBe(first.files.at(-1)?.sha256)
    expect(first.bundleSha256).toBe(second.bundleSha256)
    expect(first.manifestSignatureStatus).toBe('unavailable')
    for (const file of first.files) {
      expect(file.sha256).toBe(await sha256Hex(file.bytes))
    }
    const manifest = JSON.parse(
      new TextDecoder().decode(first.files.at(-1)?.bytes),
    )
    expect(manifest.files).toHaveLength(6)
    expect(manifest.files).toEqual(
      first.files.slice(0, -1).map(({ bytes, filename, mediaType, role, sha256 }) => ({
        role,
        filename,
        mediaType,
        byteCount: bytes.byteLength,
        sha256,
      })),
    )
    expect(manifest.sourceParquet).toMatchObject({
      scope: 'full_target_all_supported_resolutions',
      selectedScopeSerialization: false,
      sourceArtifactSha256:
        'a02927ffbb4dc09fca582c61e6ceab51af6d12f8998cf0f7762ebfe26a4ea1c9',
    })
    expect(manifest.signature).toMatchObject({ status: 'unavailable', value: null })
    expect(manifest.verification.manifestSelfDigestIncluded).toBe(false)
  })
})

function data(): PublicGeographicImpactMapData {
  return {
    cells: [
      cell('cell-b', {
        baselineUnionCount: 1,
        baselineRangeInferenceEligibleCount: 1,
        matchedCell: true,
        nearestBaselineDistanceKm: null,
      }),
      cell('cell-a', { candidateOnlyCell: true }),
    ],
    spatialResolution: 7,
    scopeId: 'country:IN',
    source: TEST_GEOGRAPHIC_IMPACT_MAP_SOURCE,
    scientificClaimAllowed: false,
  }
}

function requiredScope(scopeId: string) {
  const scope = TAXALENS_GEOGRAPHIC_SCOPE_INDEX.byId.get(scopeId)
  if (scope === undefined) throw new Error(`Missing test scope: ${scopeId}`)
  return scope
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
