import Ajv2020 from 'ajv/dist/2020.js'

import type {
  GeographicImpactBrowserResult,
  GeographicImpactRollup,
} from '../impact/geographicImpactAnalytics'
import {
  validateGeographicImpactQueryInput,
  type GeographicImpactQueryInput,
} from '../impact/geographicImpactQuery'
import {
  GEOGRAPHIC_TOOL_DEFINITIONS,
  GEOGRAPHIC_TOOL_RESULT_VERSION,
  GeographicToolError,
  type GeographicContributionState,
  type GeographicReviewObjective,
  type GeographicToolEvidence,
  type GeographicToolFact,
  type GeographicToolName,
  type GeographicToolResult,
} from './geographicTools'

export interface GeographicReviewCandidateEvidence {
  readonly campaignId: string
  readonly itemId: string
  readonly spatialCellId: string
  readonly reviewState: 'pending' | 'uncertain' | 'media_failure' | 'conflict'
  readonly candidateOnlyCell: boolean
  readonly referenceShortfall: boolean
}

export interface GeographicToolAnalyticalEvidence {
  readonly queryInput: GeographicImpactQueryInput
  readonly result: GeographicImpactBrowserResult
  readonly reviewCandidates: readonly GeographicReviewCandidateEvidence[]
}

const ajv = new Ajv2020({ allErrors: true, strict: true })
const argumentValidators = new Map(
  GEOGRAPHIC_TOOL_DEFINITIONS.map((definition) => [
    definition.name,
    ajv.compile(definition.parameters),
  ]),
)
const resultValidators = new Map(
  GEOGRAPHIC_TOOL_DEFINITIONS.map((definition) => [
    definition.name,
    ajv.compile(definition.output_schema),
  ]),
)

export function executeGeographicTool(
  name: GeographicToolName,
  candidateArguments: unknown,
  evidence: GeographicToolEvidence,
  analytical: GeographicToolAnalyticalEvidence,
): GeographicToolResult {
  const validateArguments = argumentValidators.get(name)
  if (validateArguments === undefined) {
    throw new GeographicToolError('unknown_tool', `Unknown geographic tool: ${name}`)
  }
  if (!validateArguments(candidateArguments)) {
    throw new GeographicToolError('invalid_arguments', `Geographic tool arguments are invalid for ${name}`)
  }
  const args = candidateArguments as Readonly<Record<string, unknown>>
  validateExecutionScope(args, evidence, analytical)
  const result = toolResult(name, args, evidence, analytical)
  const validateResult = resultValidators.get(name)!
  if (!validateResult(result)) {
    throw new GeographicToolError('invalid_result', `Geographic tool result is invalid for ${name}`)
  }
  return deepFreeze(result)
}

function toolResult(
  name: GeographicToolName,
  args: Readonly<Record<string, unknown>>,
  evidence: GeographicToolEvidence,
  analytical: GeographicToolAnalyticalEvidence,
): GeographicToolResult {
  const base = {
    schemaVersion: GEOGRAPHIC_TOOL_RESULT_VERSION,
    tool: name,
    evidenceScope: evidence.evidenceScope,
    artifactIds: evidence.artifactCitations.map(({ artifactId }) => artifactId),
    artifactCitations: evidence.artifactCitations,
    limitations: [
      'Flickr evidence remains candidate evidence until review and every occurrence-release gate pass.',
      'Missing baseline evidence is unknown, not proof of biological absence.',
    ],
    scientificClaimAllowed: false as const,
  }
  switch (name) {
    case 'inspect_geographic_impact': {
      const rollup = exactRollup(analytical, String(args.scope_id), String(args.scope_level))
      return { ...base, status: 'available', summary: `Deterministic geographic evidence for ${rollup.scopeName}.`, facts: rollupFacts(rollup), records: [] }
    }
    case 'compare_geographic_scopes': {
      const left = exactRollup(analytical, String(args.left_scope_id), String(args.left_scope_level))
      const right = exactRollup(analytical, String(args.right_scope_id), String(args.right_scope_level))
      return {
        ...base,
        status: 'available',
        summary: `Deterministic comparison of ${left.scopeName} and ${right.scopeName}.`,
        facts: [
          fact('left_candidate_only_cells', 'Left candidate-only cells', left.candidateOnlyCellCount),
          fact('right_candidate_only_cells', 'Right candidate-only cells', right.candidateOnlyCellCount),
          fact('left_reviewed_additional_cells', 'Left human-supported additional cells', left.reviewedAdditionalCellCount),
          fact('right_reviewed_additional_cells', 'Right human-supported additional cells', right.reviewedAdditionalCellCount),
          fact('left_release_ready_cells', 'Left release-ready additional cells', left.releaseReadyAdditionalCellCount),
          fact('right_release_ready_cells', 'Right release-ready additional cells', right.releaseReadyAdditionalCellCount),
        ],
        records: [],
      }
    }
    case 'list_candidate_gap_cells': {
      selectedScope(args, analytical)
      const state = String(args.contribution_state) as GeographicContributionState
      const limit = Number(args.limit)
      const cells = analytical.result.cells
        .filter((cell) => contributionMatches(cell, state))
        .sort((left, right) => contributionCount(right, state) - contributionCount(left, state) || left.spatialCellId.localeCompare(right.spatialCellId))
        .slice(0, limit)
      return { ...base, status: cells.length === 0 ? 'unavailable' : 'available', summary: `${cells.length} bounded ${state.replaceAll('_', ' ')} cell result(s).`, facts: [fact('matching_cell_count', 'Returned matching cells', cells.length)], records: cells.map((cell) => ({ id: cell.spatialCellId, label: cell.country ?? cell.continent ?? cell.spatialCellId, status: state === 'potential' ? 'pending' : 'available', detail: `${cell.flickrCandidateCount} Flickr candidates; ${cell.reviewedPositiveCount} reviewed target-positive; ${cell.releaseReadyCount} release-ready.`, artifactIds: base.artifactIds })) }
    }
    case 'explain_coverage_contribution': {
      selectedScope(args, analytical)
      const cell = analytical.result.cells.find(({ spatialCellId }) => spatialCellId === args.spatial_cell_id)
      if (cell === undefined) return { ...base, status: 'unavailable', summary: 'The exact spatial cell is unavailable in the selected evidence scope.', facts: [], records: [] }
      return { ...base, status: 'available', summary: 'Deterministic cell evidence; no occurrence or biological-absence claim is made.', facts: [
        fact('baseline_union_count', 'Baseline occurrence evidence', cell.baselineUnionCount),
        fact('flickr_candidate_count', 'Flickr candidate evidence', cell.flickrCandidateCount),
        fact('reviewed_positive_count', 'Reviewed target-positive examples', cell.reviewedPositiveCount),
        fact('release_ready_count', 'Release-ready occurrence candidates', cell.releaseReadyCount),
        fact('nearest_baseline_distance_km', 'Nearest baseline distance (km)', cell.nearestBaselineDistanceKm),
        fact('data_deficient_state', 'Baseline data-deficiency state', cell.dataDeficientState),
      ], records: [] }
    }
    case 'recommend_geographic_review_batch': {
      selectedScope(args, analytical)
      const objective = String(args.review_objective) as GeographicReviewObjective
      const candidates = analytical.reviewCandidates
        .filter((item) => reviewObjectiveMatches(item, objective))
        .sort((left, right) => left.spatialCellId.localeCompare(right.spatialCellId) || left.itemId.localeCompare(right.itemId))
        .slice(0, Number(args.batch_size))
      return { ...base, status: candidates.length === 0 ? 'unavailable' : 'available', summary: candidates.length === 0 ? 'No committed candidate identities satisfy this review objective.' : `${candidates.length} existing candidate item(s) ranked deterministically for ${objective.replaceAll('_', ' ')}.`, facts: [fact('batch_size', 'Recommended batch size', candidates.length)], records: candidates.map((item) => ({ id: item.itemId, label: item.campaignId, status: 'pending', detail: `${item.reviewState}; cell ${item.spatialCellId}.`, artifactIds: base.artifactIds })) }
    }
    case 'inspect_baseline_provider_union': {
      const rollup = exactRollup(analytical, String(args.scope_id), String(args.scope_level))
      return { ...base, status: rollup.baselineEvidenceStatus === 'available' ? 'available' : 'unavailable', summary: `Deduplicated baseline provider composition for ${rollup.scopeName}.`, facts: [
        fact('baseline_union_count', 'Baseline union', rollup.baselineUnionCount),
        fact('gbif_only_count', 'GBIF-only', rollup.gbifOnlyCount),
        fact('inaturalist_origin_through_gbif_count', 'iNaturalist-origin through GBIF', rollup.inaturalistOriginThroughGbifCount),
        fact('direct_inaturalist_delta_count', 'Direct iNaturalist delta', rollup.directInaturalistDeltaCount, rollup.directInaturalistDeltaStatus === 'available' ? 'verified' : 'unavailable'),
        fact('duplicates_removed_count', 'Cross-provider duplicates removed', rollup.duplicatesRemovedCount),
        fact('unresolved_provider_duplicates', 'Unresolved provider duplicate groups', rollup.unresolvedProviderDuplicateGroupCount),
      ], records: [] }
    }
  }
}

function validateExecutionScope(args: Readonly<Record<string, unknown>>, evidence: GeographicToolEvidence, analytical: GeographicToolAnalyticalEvidence): void {
  const query = validateGeographicImpactQueryInput(analytical.queryInput)
  const expected = evidence.evidenceScope
  const pairs = [['project_id', expected.projectId], ['run_id', expected.runId], ['accepted_taxon_key', expected.acceptedTaxonKey], ['baseline_snapshot_id', expected.baselineSnapshotId], ['flickr_snapshot_id', expected.flickrSnapshotId], ['spatial_resolution', query.spatialResolution]] as const
  if (pairs.some(([field, value]) => args[field] !== value)) throw new GeographicToolError('invalid_arguments', 'Geographic tool arguments differ from the immutable evidence scope')
  if (query.evidenceScope.projectId !== expected.projectId || query.evidenceScope.runId !== expected.runId || query.evidenceScope.targetAcceptedTaxonKey !== expected.acceptedTaxonKey || query.evidenceScope.baselineSnapshotId !== expected.baselineSnapshotId || query.evidenceScope.flickrSnapshotId !== expected.flickrSnapshotId) throw new GeographicToolError('invalid_evidence', 'Geographic analytical query differs from the citation evidence scope')
}

function exactRollup(analytical: GeographicToolAnalyticalEvidence, scopeId: string, scopeLevel: string): GeographicImpactRollup {
  const rollup = [analytical.result.selectedRollup, ...analytical.result.childRollups].find(({ scopeId: id }) => id === scopeId)
  if (rollup === undefined) throw new GeographicToolError('invalid_arguments', `Geographic scope is unavailable: ${scopeId}`)
  if (rollup.scopeLevel !== scopeLevel) throw new GeographicToolError('invalid_arguments', `Geographic scope level differs for: ${scopeId}`)
  return rollup
}

function selectedScope(args: Readonly<Record<string, unknown>>, analytical: GeographicToolAnalyticalEvidence): void {
  const selected = analytical.result.selectedRollup
  if (args.scope_id !== selected.scopeId || args.scope_level !== selected.scopeLevel) {
    throw new GeographicToolError('invalid_arguments', 'Geographic cell operation must use the selected analytical scope')
  }
}

function rollupFacts(value: GeographicImpactRollup): GeographicToolFact[] { return [fact('baseline_union_count', 'Baseline occurrence evidence', value.baselineUnionCount), fact('flickr_candidate_count', 'Flickr candidate evidence', value.flickrCandidateCount), fact('candidate_only_cells', 'Candidate-only spatial cells', value.candidateOnlyCellCount), fact('reviewed_additional_cells', 'Human-supported additional cells', value.reviewedAdditionalCellCount), fact('release_ready_additional_cells', 'Release-ready additional cells', value.releaseReadyAdditionalCellCount), fact('data_deficient_state', 'Baseline data-deficiency state', value.dataDeficientState)] }
function fact(id: string, label: string, value: boolean | null | number | string, status: GeographicToolFact['status'] = value === null ? 'unavailable' : 'verified'): GeographicToolFact { return { id, label, value, status } }
function contributionMatches(cell: GeographicImpactBrowserResult['cells'][number], state: GeographicContributionState): boolean { return state === 'potential' ? cell.candidateOnlyCell : state === 'human_supported' ? cell.reviewedAdditionalCell : cell.releaseReadyAdditionalCell }
function contributionCount(cell: GeographicImpactBrowserResult['cells'][number], state: GeographicContributionState): number { return state === 'potential' ? cell.flickrCandidateCount : state === 'human_supported' ? cell.reviewedPositiveCount : cell.releaseReadyCount }
function reviewObjectiveMatches(item: GeographicReviewCandidateEvidence, objective: GeographicReviewObjective): boolean { switch (objective) { case 'unbiased_audit': return item.reviewState === 'pending'; case 'geographic_coverage_gap': return item.reviewState === 'pending' && item.candidateOnlyCell; case 'failure_discovery': return item.reviewState === 'media_failure' || item.reviewState === 'uncertain'; case 'reference_shortfall': return item.referenceShortfall; case 'conflict_adjudication': return item.reviewState === 'conflict' } }
function deepFreeze<Value>(value: Value): Value { if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child) } return value }
