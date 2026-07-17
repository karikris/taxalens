import { describe, expect, it } from 'vitest'

import type { GeographicImpactBrowserResult, GeographicImpactRollup } from '../impact/geographicImpactAnalytics'
import { executeGeographicTool, type GeographicToolAnalyticalEvidence } from './geographicToolExecution'
import { createGeographicToolEvidence, GEOGRAPHIC_ARTIFACT_CITATION_VERSION, GEOGRAPHIC_ARTIFACT_KINDS } from './geographicTools'

describe('deterministic geographic tools', () => {
  const evidence = createGeographicToolEvidence({
    evidenceId: 'evidence:a',
    evidenceScope: { projectId: 'project:a', runId: 'run:a', acceptedTaxonKey: 'gbif:1', baselineSnapshotId: 'baseline:a', flickrSnapshotId: 'flickr:a' },
    artifactCitations: GEOGRAPHIC_ARTIFACT_KINDS.map((artifactKind, index) => ({
      schemaVersion: GEOGRAPHIC_ARTIFACT_CITATION_VERSION,
      artifactKind,
      artifactId: `artifact:${artifactKind}`,
      availability: artifactKind === 'quality_snapshot' ? 'unavailable' as const : 'available' as const,
      snapshotId: artifactKind === 'baseline_provider_union' ? 'baseline:a' : artifactKind === 'flickr_geography' ? 'flickr:a' : null,
      sha256: artifactKind === 'quality_snapshot' ? null : String(index + 1).repeat(64),
      sourceRepository: artifactKind === 'quality_snapshot' ? null : 'karikris/taxalens',
      sourceCommit: artifactKind === 'quality_snapshot' ? null : String(index + 1).repeat(40),
      sourcePath: artifactKind === 'quality_snapshot' ? null : `demo/${artifactKind}`,
      unavailableReason: artifactKind === 'quality_snapshot' ? 'No retained quality snapshot.' : null,
    })),
  })
  const analytical = analyticalEvidence()
  const common = { project_id: 'project:a', run_id: 'run:a', accepted_taxon_key: 'gbif:1', baseline_snapshot_id: 'baseline:a', flickr_snapshot_id: 'flickr:a', spatial_resolution: 7 }

  it('executes all six tools from deterministic cells, rollups and candidate identities', () => {
    const calls = [
      ['inspect_geographic_impact', { ...common, scope_level: 'global', scope_id: 'global', evidence_mode: 'comparison', metric: 'record_count' }],
      ['compare_geographic_scopes', { ...common, left_scope_level: 'global', left_scope_id: 'global', right_scope_level: 'country', right_scope_id: 'country:SE', metric: 'candidate_only_cells' }],
      ['list_candidate_gap_cells', { ...common, scope_level: 'global', scope_id: 'global', contribution_state: 'potential', limit: 10 }],
      ['explain_coverage_contribution', { ...common, scope_level: 'global', scope_id: 'global', spatial_cell_id: 'cell:a' }],
      ['recommend_geographic_review_batch', { ...common, scope_level: 'global', scope_id: 'global', review_objective: 'geographic_coverage_gap', batch_size: 10 }],
      ['inspect_baseline_provider_union', { ...common, scope_level: 'global', scope_id: 'global' }],
    ] as const
    const results = calls.map(([name, args]) => executeGeographicTool(name, args, evidence, analytical))

    expect(results.every(({ scientificClaimAllowed }) => !scientificClaimAllowed)).toBe(true)
    expect(results.every(({ artifactCitations }) => artifactCitations.length === GEOGRAPHIC_ARTIFACT_KINDS.length)).toBe(true)
    expect(results[2]?.records[0]?.id).toBe('cell:a')
    expect(results[4]?.records[0]?.id).toBe('item:a')
    expect(results[5]?.facts.find(({ id }) => id === 'direct_inaturalist_delta_count')).toMatchObject({ value: null, status: 'unavailable' })
  })

  it('fails closed on cross-snapshot scope and never creates review identities', () => {
    expect(() => executeGeographicTool('inspect_geographic_impact', { ...common, flickr_snapshot_id: 'flickr:other', scope_level: 'global', scope_id: 'global', evidence_mode: 'comparison', metric: 'record_count' }, evidence, analytical)).toThrow('differ from the immutable evidence scope')
    const result = executeGeographicTool('recommend_geographic_review_batch', { ...common, scope_level: 'global', scope_id: 'global', review_objective: 'conflict_adjudication', batch_size: 10 }, evidence, analytical)
    expect(result).toMatchObject({ status: 'unavailable', records: [] })
  })
})

function analyticalEvidence(): GeographicToolAnalyticalEvidence {
  const selected = rollup('global', 'Global')
  const child = rollup('country:SE', 'Sweden')
  const result = {
    selectedRollup: selected,
    childRollups: [child],
    cells: [{ spatialResolution: 7, spatialCellId: 'cell:a', continent: 'Europe', countryCode: 'SE', country: 'Sweden', admin1: null, latitude: 59, longitude: 18, baselineUnionCount: 0, baselineRangeInferenceEligibleCount: 0, flickrCandidateCount: 4, flickrVisuallyEligibleCount: 4, reviewedPositiveCount: 0, reviewedNegativeCount: 0, uncertainCount: 0, pendingCount: 4, mediaFailureCount: 0, skippedCount: 0, releaseReadyCount: 0, baselineOnlyCell: false, matchedCell: false, candidateOnlyCell: true, reviewedAdditionalCell: false, releaseReadyAdditionalCell: false, nearestBaselineDistanceKm: 100, dataDeficientState: 'data_deficient' }],
  } as unknown as GeographicImpactBrowserResult
  return {
    queryInput: { evidenceScope: { projectId: 'project:a', runId: 'run:a', targetAcceptedTaxonKey: 'gbif:1', baselineSnapshotId: 'baseline:a', flickrSnapshotId: 'flickr:a' }, spatialResolution: 7, geographicScope: { level: 'global', id: 'global' }, evidenceMode: 'comparison', metric: 'record_count' },
    result,
    reviewCandidates: [{ campaignId: 'campaign:a', itemId: 'item:a', spatialCellId: 'cell:a', reviewState: 'pending', candidateOnlyCell: true, referenceShortfall: false }],
  }
}

function rollup(scopeId: string, scopeName: string): GeographicImpactRollup {
  return { scopeLevel: scopeId === 'global' ? 'global' : 'country', scopeId, scopeName, parentScopeId: scopeId === 'global' ? null : 'continent:europe', continent: scopeId === 'global' ? null : 'Europe', countryCode: scopeId === 'global' ? null : 'SE', country: scopeId === 'global' ? null : 'Sweden', admin1: null, baselineEvidenceStatus: 'available', baselineUnionCount: 10, baselineRangeInferenceEligibleCount: 9, gbifOnlyCount: 8, inaturalistOriginThroughGbifCount: 2, directInaturalistDeltaStatus: 'unavailable', directInaturalistDeltaCount: null, duplicatesRemovedCount: 1, unresolvedProviderDuplicateGroupCount: 1, cellCount: 2, baselineOccupiedCellCount: 1, flickrCandidateCount: 4, flickrVisuallyEligibleCount: 4, reviewedPositiveCount: 0, reviewedNegativeCount: 0, uncertainCount: 0, pendingCount: 4, mediaFailureCount: 0, skippedCount: 0, releaseReadyCount: 0, flickrOccupiedCellCount: 1, baselineOnlyCellCount: 1, matchedCellCount: 0, candidateOnlyCellCount: 1, reviewedAdditionalCellCount: 0, releaseReadyAdditionalCellCount: 0, maximumNearestBaselineDistanceKm: 100, dataDeficientState: 'data_deficient' }
}
