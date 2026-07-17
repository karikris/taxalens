import { canonicalExportJsonBytes, sha256Hex } from '../evidence/evidenceExport'
import type { CountryHierarchyNode } from '../../../../packages/contracts/src/geographic_impact_contract'
import impactManifest from '../../../../demo/source/biominer_phase14/geographic_impact/geographic_impact_manifest.json'
import { buildSelectedGeographyDetails } from './SelectedGeographyDetails'
import type {
  PublicGeographicImpactMapCell,
  PublicGeographicImpactMapData,
} from './publicGeographicImpactMapData'

export const GEOGRAPHIC_IMPACT_EXPORT_SCHEMA_VERSION =
  'taxalens-geographic-impact-export:v1.0.0' as const

export type GeographicImpactExportRole =
  | 'cells_json'
  | 'cells_csv'
  | 'source_cells_parquet'
  | 'scope_summary_json'
  | 'scope_summary_csv'
  | 'methodology_json'

export interface GeographicImpactExportPayload {
  readonly role: GeographicImpactExportRole
  readonly filename: string
  readonly mediaType: string
  readonly bytes: Uint8Array<ArrayBuffer>
}

export interface GeographicImpactCellExport {
  readonly schemaVersion: typeof GEOGRAPHIC_IMPACT_EXPORT_SCHEMA_VERSION
  readonly prefix: string
  readonly payloads: readonly GeographicImpactExportPayload[]
  readonly selectedCellCount: number
  readonly sourceParquetScope: 'full_target_all_supported_resolutions'
  readonly scientificClaimAllowed: false
}

export interface GeographicImpactScopeSummaryExport {
  readonly schemaVersion: typeof GEOGRAPHIC_IMPACT_EXPORT_SCHEMA_VERSION
  readonly prefix: string
  readonly payloads: readonly GeographicImpactExportPayload[]
  readonly scientificClaimAllowed: false
}

export interface GeographicImpactMethodologyExport {
  readonly schemaVersion: typeof GEOGRAPHIC_IMPACT_EXPORT_SCHEMA_VERSION
  readonly prefix: string
  readonly payload: GeographicImpactExportPayload
  readonly scientificClaimAllowed: false
}

const CELL_COLUMNS = Object.freeze([
  'spatial_resolution',
  'spatial_cell_id',
  'continent',
  'country_code',
  'country',
  'admin1',
  'centroid_latitude',
  'centroid_longitude',
  'baseline_union_count',
  'baseline_range_inference_eligible_count',
  'baseline_excluded_occurrence_count',
  'gbif_only_count',
  'inaturalist_origin_through_gbif_count',
  'direct_inaturalist_delta_status',
  'direct_inaturalist_delta_count',
  'duplicates_removed_count',
  'unresolved_provider_duplicate_group_count',
  'flickr_candidate_count',
  'flickr_visually_eligible_count',
  'reviewed_positive_count',
  'reviewed_negative_count',
  'uncertain_count',
  'pending_count',
  'media_failure_count',
  'skipped_count',
  'release_ready_count',
  'baseline_only_cell',
  'matched_cell',
  'candidate_only_cell',
  'reviewed_additional_cell',
  'release_ready_additional_cell',
  'nearest_baseline_distance_km',
  'latest_baseline_event_date',
  'latest_flickr_candidate_date',
  'latest_reviewed_positive_date',
  'latest_release_ready_date',
  'data_deficient_state',
] as const)

type GeographicCellExportColumn = (typeof CELL_COLUMNS)[number]
type GeographicCellExportRow = Readonly<Record<GeographicCellExportColumn, boolean | number | string | null>>

export async function prepareGeographicImpactCellExport(
  data: PublicGeographicImpactMapData,
  sourceParquetBytes: Uint8Array<ArrayBuffer>,
): Promise<GeographicImpactCellExport> {
  await assertVerifiedSourceParquet(data, sourceParquetBytes)
  const rows = data.cells
    .map(cellExportRow)
    .sort((left, right) =>
      left.spatial_resolution !== right.spatial_resolution
        ? Number(left.spatial_resolution) - Number(right.spatial_resolution)
        : String(left.spatial_cell_id).localeCompare(String(right.spatial_cell_id), 'en'),
    )
  if (rows.some(({ spatial_resolution }) => spatial_resolution !== data.spatialResolution)) {
    throw new Error('Geographic Impact export cells differ from the selected resolution')
  }
  const prefix = exportPrefix(data)
  const jsonBytes = canonicalExportJsonBytes({
    schemaVersion: GEOGRAPHIC_IMPACT_EXPORT_SCHEMA_VERSION,
    exportRole: 'selected_scope_cells',
    source: data.source,
    scopeId: data.scopeId,
    spatialResolution: data.spatialResolution,
    selectedCellCount: rows.length,
    cells: rows,
    semantics: {
      baseline: 'deduplicated baseline occurrence evidence',
      flickr: 'Flickr candidate evidence',
      candidateOnly: 'potential coverage-gap cell, not proof of biological absence',
      scientificClaimAllowed: false,
    },
  })
  const csvBytes = new TextEncoder().encode(cellRowsCsv(rows))
  const payloads: GeographicImpactExportPayload[] = [
    {
      role: 'cells_json',
      filename: `${prefix}.cells.json`,
      mediaType: 'application/json',
      bytes: jsonBytes,
    },
    {
      role: 'cells_csv',
      filename: `${prefix}.cells.csv`,
      mediaType: 'text/csv;charset=utf-8',
      bytes: csvBytes,
    },
    {
      role: 'source_cells_parquet',
      filename: `${prefix}.source-cells.parquet`,
      mediaType: 'application/vnd.apache.parquet',
      bytes: sourceParquetBytes.slice(),
    },
  ]
  return Object.freeze({
    schemaVersion: GEOGRAPHIC_IMPACT_EXPORT_SCHEMA_VERSION,
    prefix,
    payloads: Object.freeze(payloads.map((payload) => Object.freeze(payload))),
    selectedCellCount: rows.length,
    sourceParquetScope: 'full_target_all_supported_resolutions' as const,
    scientificClaimAllowed: false as const,
  })
}

export function prepareGeographicImpactScopeSummary(
  data: PublicGeographicImpactMapData,
  scope: CountryHierarchyNode,
): GeographicImpactScopeSummaryExport {
  if (scope.scope_id !== data.scopeId) {
    throw new Error('Geographic Impact summary scope differs from the selected map scope')
  }
  const scopeSummary = prepareScopeSummaryValue(data, scope)
  const prefix = exportPrefix(data)
  const summary = Object.freeze({
    schemaVersion: GEOGRAPHIC_IMPACT_EXPORT_SCHEMA_VERSION,
    exportRole: 'selected_scope_summary',
    source: data.source,
    ...scopeSummary,
    limitations: {
      missingBaselineIsBiologicalAbsence: false,
      flickrCandidatesAreOccurrences: false,
      scientificClaimAllowed: false,
    },
  })
  const payloads: GeographicImpactExportPayload[] = [
    {
      role: 'scope_summary_json',
      filename: `${prefix}.scope-summary.json`,
      mediaType: 'application/json',
      bytes: canonicalExportJsonBytes(summary),
    },
    {
      role: 'scope_summary_csv',
      filename: `${prefix}.scope-summary.csv`,
      mediaType: 'text/csv;charset=utf-8',
      bytes: new TextEncoder().encode(scopeSummaryCsv(summary)),
    },
  ]
  return Object.freeze({
    schemaVersion: GEOGRAPHIC_IMPACT_EXPORT_SCHEMA_VERSION,
    prefix,
    payloads: Object.freeze(payloads.map((payload) => Object.freeze(payload))),
    scientificClaimAllowed: false as const,
  })
}

export function prepareGeographicImpactMethodology(
  data: PublicGeographicImpactMapData,
  scope: CountryHierarchyNode,
): GeographicImpactMethodologyExport {
  if (scope.scope_id !== data.scopeId) {
    throw new Error('Geographic Impact methodology scope differs from the selected map scope')
  }
  const prefix = exportPrefix(data)
  const bytes = canonicalExportJsonBytes({
    schemaVersion: 'taxalens-geographic-impact-methodology:v1.0.0',
    exportSchemaVersion: GEOGRAPHIC_IMPACT_EXPORT_SCHEMA_VERSION,
    exportTimestamp: null,
    exportTimestampReason:
      'No export time is added so repeated preparation from identical evidence remains byte-deterministic.',
    researchQuestion:
      'Where does baseline occurrence evidence exist, where is Flickr candidate evidence present, and what potential, human-supported or release-ready contribution could it add?',
    selectedScope: {
      level: scope.scope_level,
      id: scope.scope_id,
      name: scope.scope_name,
      parentId: scope.parent_scope_id,
      spatialResolution: data.spatialResolution,
    },
    identities: {
      geographicImpactManifestId: impactManifest.manifest_id,
      geographicImpactBuildId: impactManifest.geographic_impact_build_id,
      projectId: impactManifest.project_id,
      runId: impactManifest.run_id,
      registryVersion: impactManifest.registry_version,
      acceptedTaxonKey: impactManifest.accepted_taxon_key,
      scientificName: impactManifest.scientific_name,
      baselineSnapshotId: impactManifest.baseline_snapshot_id,
      flickrSnapshotId: impactManifest.flickr_snapshot_id,
      countryHierarchyId: impactManifest.country_hierarchy_id,
      sourceCommits: impactManifest.source_commits,
    },
    methods: {
      cellComparison: {
        operation: 'full_outer_join',
        keys: ['accepted_taxon_key', 'spatial_resolution', 'spatial_cell_id'],
        grid: 'hierarchical_global_grid',
        supportedResolutions: impactManifest.spatial_resolutions,
      },
      baselineProviderUnion: {
        policyVersion: impactManifest.provider_union_policy_version,
        defaultCount: 'range-inference-eligible canonical observations',
        crossProviderDoubleCountingAllowed: false,
        unresolvedDuplicateGroupsPreserved: true,
        directInaturalistDeltaStatus: impactManifest.direct_inaturalist_delta_status,
      },
      candidateOnlyCell:
        'baseline range-inference-eligible count equals zero and Flickr candidate count is greater than zero',
      reviewedAdditionalCell:
        'candidate-only cell with at least one human-reviewed target-positive Flickr result',
      releaseReadyAdditionalCell:
        'candidate-only cell with positive consensus, valid coordinates, duplicate gate, quality gate, complete provenance and an occurrence-release decision',
      nearestBaselineDistance: {
        method: 'haversine_cell_centroid',
        unit: 'kilometres',
        sameResolutionRequired: true,
        biologicalRangeBoundary: false,
      },
      temporalContribution: {
        method: 'signed UTC day interval between exact full dates',
        selectedScopeFlickrObservationDateAvailable: data.cells.some(
          ({ latestFlickrCandidateDate }) => latestFlickrCandidateDate !== null,
        ),
        laterDateEstablishesNovelty: false,
      },
      dataDeficiency: {
        missingBaselineMeansBiologicalAbsence: false,
        reasonsAreAdditive: true,
        unsupportedThresholdsInvented: false,
      },
    },
    sourceArtifacts: impactManifest.artifacts.map((artifact) => ({
      logicalName: artifact.logical_name,
      availability: artifact.availability,
      unavailableReason: artifact.unavailable_reason,
      path: artifact.path,
      mediaType: artifact.media_type,
      schemaVersion: artifact.schema_version,
      rowCount: artifact.row_count,
      byteCount: artifact.byte_size,
      sha256: artifact.sha256,
      snapshotId: artifact.snapshot_id,
      sourceRepository: artifact.source_repository,
      sourceCommit: artifact.source_commit,
      rightsId: artifact.rights_id,
    })),
    claims: {
      allowed: [
        'baseline occurrence evidence under the selected committed snapshot',
        'Flickr candidate evidence',
        'potential coverage contribution for candidate-only cells',
        'human-supported additional cells only when target-positive review evidence exists',
        'release-ready occurrence candidates only when every configured occurrence-release gate passes',
      ],
      blocked: [
        'treating provider-labelled candidates as authority-endorsed records',
        'presenting Flickr candidates as newly established occurrences',
        'claiming established knowledge gain from candidates alone',
        'claiming a biological range expansion from cell-centroid distance',
        'interpreting a missing selected-baseline row as biological absence',
        'claiming candidates have entered a scientific collection or data provider',
        'making an occurrence-level verification claim before every configured release gate passes',
      ],
    },
    limitations: [
      'Flickr results remain hypotheses until review and occurrence-release gates pass.',
      'A provider taxon label remains candidate evidence until independently reviewed.',
      'Missing baseline evidence is unknown, not proof of biological absence.',
      'The direct iNaturalist delta is unavailable and is not fabricated.',
      'The public campaigns contain zero retained human outcomes.',
      'SHA-256 verifies captured bytes and identity, not scientific truth, quality or source independence.',
      'The source Parquet contains the full target across supported resolutions; selected-scope JSON and CSV contain the visible scoped projection.',
    ],
    deterministicPreparation: {
      environment: 'browser',
      externalNetworkRequestsRequired: 0,
      canonicalJson: 'recursive sorted object keys, preserved array order, UTF-8, trailing newline',
      digestAlgorithm: 'SHA-256',
      signingStatus: 'unavailable',
      signingReason: 'No signing key is committed inside the credential-free replay boundary.',
    },
    scientificClaimAllowed: false,
  })
  return Object.freeze({
    schemaVersion: GEOGRAPHIC_IMPACT_EXPORT_SCHEMA_VERSION,
    prefix,
    payload: Object.freeze({
      role: 'methodology_json' as const,
      filename: `${prefix}.methodology.json`,
      mediaType: 'application/json',
      bytes,
    }),
    scientificClaimAllowed: false as const,
  })
}

export function cellRowsCsv(rows: readonly GeographicCellExportRow[]): string {
  const lines = [
    CELL_COLUMNS.join(','),
    ...rows.map((row) => CELL_COLUMNS.map((column) => csvCell(row[column])).join(',')),
  ]
  return `${lines.join('\r\n')}\r\n`
}

function scopeSummaryCsv(
  value: ReturnType<typeof prepareScopeSummaryValue>,
): string {
  const { scope, spatialResolution, summary } = value
  const rows: readonly (readonly [string, boolean | number | string | null])[] = [
    ['scope_level', scope.level],
    ['scope_id', scope.id],
    ['scope_name', scope.name],
    ['parent_scope_id', scope.parentId],
    ['continent', scope.continent],
    ['country_code', scope.countryCode],
    ['country', scope.country],
    ['admin1', scope.admin1],
    ['spatial_resolution', spatialResolution],
    ['cell_count', summary.cellCount],
    ['baseline_union_count', summary.baselineUnionCount],
    ['baseline_range_inference_eligible_count', summary.baselineEligibleCount],
    ['baseline_excluded_occurrence_count', summary.baselineExcludedCount],
    ['gbif_only_count', summary.gbifOnlyCount],
    ['inaturalist_origin_through_gbif_count', summary.inaturalistOriginThroughGbifCount],
    ['direct_inaturalist_delta_status', summary.directInaturalistDeltaStatus],
    ['direct_inaturalist_delta_count', summary.directInaturalistDeltaCount],
    ['duplicates_removed_count', summary.duplicatesRemovedCount],
    ['unresolved_provider_duplicate_group_count', summary.unresolvedProviderDuplicateGroupCount],
    ['flickr_candidate_count', summary.flickrCandidateCount],
    ['reviewed_positive_count', summary.reviewedPositiveCount],
    ['reviewed_negative_count', summary.reviewedNegativeCount],
    ['uncertain_count', summary.uncertainCount],
    ['pending_count', summary.pendingCount],
    ['release_ready_count', summary.releaseReadyCount],
    ['candidate_only_cell_count', summary.candidateOnlyCellCount],
    ['reviewed_additional_cell_count', summary.reviewedAdditionalCellCount],
    ['release_ready_additional_cell_count', summary.releaseReadyAdditionalCellCount],
    ['nearest_baseline_distance_km', summary.nearestBaselineDistanceKm],
    ['latest_baseline_event_date', summary.latestBaselineEventDate],
    ['latest_flickr_candidate_date', summary.latestFlickrCandidateDate],
    ['data_deficient_cell_count', summary.dataDeficientCellCount],
    ['unavailable_cell_count', summary.unavailableCellCount],
    ['range_edge_potential_cell_count', summary.rangeEdgeStateCounts.potential],
    ['range_edge_human_supported_cell_count', summary.rangeEdgeStateCounts.human_supported],
    ['range_edge_release_ready_cell_count', summary.rangeEdgeStateCounts.release_ready],
    ['range_edge_data_deficient_cell_count', summary.rangeEdgeStateCounts.data_deficient],
    ['range_edge_unavailable_cell_count', summary.rangeEdgeStateCounts.unavailable],
    ['coverage_uplift_status', summary.coverageUplift.status],
    ['baseline_occupied_cell_denominator', summary.coverageUplift.baselineOccupiedCellCount],
    ['candidate_uplift_additional_cells', summary.coverageUplift.potential.additionalCellCount],
    ['candidate_uplift_percent', summary.coverageUplift.potential.percent],
    ['human_supported_uplift_additional_cells', summary.coverageUplift.humanSupported.additionalCellCount],
    ['human_supported_uplift_percent', summary.coverageUplift.humanSupported.percent],
    ['release_ready_uplift_additional_cells', summary.coverageUplift.releaseReady.additionalCellCount],
    ['release_ready_uplift_percent', summary.coverageUplift.releaseReady.percent],
    ['temporal_contribution_description', summary.temporalContribution],
    ['scientific_claim_allowed', false],
  ]
  return `metric,value\r\n${rows.map(([metric, cell]) => `${metric},${csvCell(cell)}`).join('\r\n')}\r\n`
}

function prepareScopeSummaryValue(
  data: PublicGeographicImpactMapData,
  scope: CountryHierarchyNode,
) {
  return {
    scope: {
      level: scope.scope_level,
      id: scope.scope_id,
      name: scope.scope_name,
      parentId: scope.parent_scope_id,
      continent: scope.continent,
      countryCode: scope.country_code,
      country: scope.country,
      admin1: scope.admin1,
    },
    spatialResolution: data.spatialResolution,
    summary: buildSelectedGeographyDetails(data.cells, scope, null),
  }
}

function cellExportRow(cell: PublicGeographicImpactMapCell): GeographicCellExportRow {
  return Object.freeze({
    spatial_resolution: cell.spatialResolution,
    spatial_cell_id: cell.spatialCellId,
    continent: cell.continent,
    country_code: cell.countryCode,
    country: cell.country,
    admin1: cell.admin1,
    centroid_latitude: cell.latitude,
    centroid_longitude: cell.longitude,
    baseline_union_count: cell.baselineUnionCount,
    baseline_range_inference_eligible_count: cell.baselineRangeInferenceEligibleCount,
    baseline_excluded_occurrence_count: cell.baselineExcludedOccurrenceCount,
    gbif_only_count: cell.gbifOnlyCount,
    inaturalist_origin_through_gbif_count: cell.inaturalistOriginThroughGbifCount,
    direct_inaturalist_delta_status: cell.directInaturalistDeltaStatus,
    direct_inaturalist_delta_count: cell.directInaturalistDeltaCount,
    duplicates_removed_count: cell.duplicatesRemovedCount,
    unresolved_provider_duplicate_group_count: cell.unresolvedProviderDuplicateGroupCount,
    flickr_candidate_count: cell.flickrCandidateCount,
    flickr_visually_eligible_count: cell.flickrVisuallyEligibleCount,
    reviewed_positive_count: cell.reviewedPositiveCount,
    reviewed_negative_count: cell.reviewedNegativeCount,
    uncertain_count: cell.uncertainCount,
    pending_count: cell.pendingCount,
    media_failure_count: cell.mediaFailureCount,
    skipped_count: cell.skippedCount,
    release_ready_count: cell.releaseReadyCount,
    baseline_only_cell: cell.baselineOnlyCell,
    matched_cell: cell.matchedCell,
    candidate_only_cell: cell.candidateOnlyCell,
    reviewed_additional_cell: cell.reviewedAdditionalCell,
    release_ready_additional_cell: cell.releaseReadyAdditionalCell,
    nearest_baseline_distance_km: cell.nearestBaselineDistanceKm,
    latest_baseline_event_date: cell.latestBaselineEventDate,
    latest_flickr_candidate_date: cell.latestFlickrCandidateDate,
    latest_reviewed_positive_date: cell.latestReviewedPositiveDate,
    latest_release_ready_date: cell.latestReleaseReadyDate,
    data_deficient_state: cell.dataDeficientState,
  })
}

async function assertVerifiedSourceParquet(
  data: PublicGeographicImpactMapData,
  bytes: Uint8Array<ArrayBuffer>,
): Promise<void> {
  const last = bytes.byteLength - 4
  const magic =
    bytes.byteLength >= 8 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x41 &&
    bytes[2] === 0x52 &&
    bytes[3] === 0x31 &&
    bytes[last] === 0x50 &&
    bytes[last + 1] === 0x41 &&
    bytes[last + 2] === 0x52 &&
    bytes[last + 3] === 0x31
  if (
    !magic ||
    bytes.byteLength !== data.source.artifactBytes ||
    (await sha256Hex(bytes)) !== data.source.artifactSha256
  ) {
    throw new Error('Geographic Impact export requires the exact verified cells Parquet')
  }
}

function csvCell(value: boolean | number | string | null): string {
  if (value === null) return ''
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error('Geographic Impact CSV contains a non-finite number')
  }
  const text = String(value)
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function exportPrefix(data: PublicGeographicImpactMapData): string {
  const taxon = data.source.scientificName
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '')
  const scope = data.scopeId
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '')
  if (taxon.length === 0 || scope.length === 0) {
    throw new Error('Geographic Impact export identity cannot form a filename')
  }
  return `taxalens-${taxon}-${scope}-r${data.spatialResolution}`
}
