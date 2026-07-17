import { executeGeographicTool, type GeographicToolAnalyticalEvidence } from './geographicToolExecution'
import type { GeographicToolEvidence, GeographicToolResult } from './geographicTools'

export const GEOGRAPHIC_ANALYST_MODEL = 'gpt-5.6-sol' as const
export const GEOGRAPHIC_CONTRIBUTION_WORKFLOW_VERSION =
  'taxalens-geographic-contribution-workflow:v1.0.0' as const

export interface GeographicContributionWorkflowResult {
  readonly schemaVersion: typeof GEOGRAPHIC_CONTRIBUTION_WORKFLOW_VERSION
  readonly question: 'What evidence could Flickr add to this country?'
  readonly scopeId: string
  readonly answer: string
  readonly toolResults: readonly GeographicToolResult[]
  readonly artifactIds: readonly string[]
  readonly limitations: readonly string[]
  readonly externalActionsExecuted: false
  readonly unsupportedClaimsRejected: true
  readonly scientificClaimAllowed: false
}

export function explainCountryGeographicContribution(
  evidence: GeographicToolEvidence,
  analytical: GeographicToolAnalyticalEvidence,
  gapCellLimit = 20,
): GeographicContributionWorkflowResult {
  const rollup = analytical.result.selectedRollup
  if (
    analytical.queryInput.geographicScope.level !== 'country' ||
    rollup.scopeLevel !== 'country' ||
    analytical.queryInput.geographicScope.id !== rollup.scopeId
  ) {
    throw new Error('Geographic contribution workflow requires one exact selected country')
  }
  const common = scopedArguments(evidence, analytical)
  const inspection = executeGeographicTool(
    'inspect_geographic_impact',
    {
      ...common,
      scope_level: 'country',
      scope_id: rollup.scopeId,
      evidence_mode: 'comparison',
      metric: 'candidate_only_cells',
    },
    evidence,
    analytical,
  )
  const gaps = executeGeographicTool(
    'list_candidate_gap_cells',
    {
      ...common,
      scope_level: 'country',
      scope_id: rollup.scopeId,
      contribution_state: 'potential',
      limit: gapCellLimit,
    },
    evidence,
    analytical,
  )
  const baseline = factNumber(inspection, 'baseline_union_count')
  const candidates = factNumber(inspection, 'flickr_candidate_count')
  const candidateOnly = factNumber(inspection, 'candidate_only_cells')
  const reviewed = factNumber(inspection, 'reviewed_additional_cells')
  const releaseReady = factNumber(inspection, 'release_ready_additional_cells')
  const artifactIds = uniqueSorted([...inspection.artifactIds, ...gaps.artifactIds])

  return Object.freeze({
    schemaVersion: GEOGRAPHIC_CONTRIBUTION_WORKFLOW_VERSION,
    question: 'What evidence could Flickr add to this country?' as const,
    scopeId: rollup.scopeId,
    answer:
      `${rollup.scopeName} has ${formatCount(baseline)} baseline occurrence-evidence rows and ` +
      `${formatCount(candidates)} Flickr candidate-evidence rows in the selected snapshot. ` +
      `${formatCount(candidateOnly)} spatial cells are potential coverage-gap cells; the bounded tool returned ` +
      `${formatCount(gaps.records.length)} candidate-only cell example${gaps.records.length === 1 ? '' : 's'}. ` +
      `${formatCount(reviewed)} cells are human-supported additional cells and ${formatCount(releaseReady)} are release-ready additional cells. ` +
      'Candidate-only cells describe potential coverage contribution, not biological absence or new occurrences.',
    toolResults: Object.freeze([inspection, gaps]),
    artifactIds,
    limitations: Object.freeze([
      ...inspection.limitations,
      'Only the selected committed baseline and Flickr snapshots are represented.',
      'Provider taxon labels and unreviewed Flickr candidates remain hypotheses.',
    ]),
    externalActionsExecuted: false as const,
    unsupportedClaimsRejected: true as const,
    scientificClaimAllowed: false as const,
  })
}

function scopedArguments(
  evidence: GeographicToolEvidence,
  analytical: GeographicToolAnalyticalEvidence,
) {
  return {
    project_id: evidence.evidenceScope.projectId,
    run_id: evidence.evidenceScope.runId,
    accepted_taxon_key: evidence.evidenceScope.acceptedTaxonKey,
    baseline_snapshot_id: evidence.evidenceScope.baselineSnapshotId,
    flickr_snapshot_id: evidence.evidenceScope.flickrSnapshotId,
    spatial_resolution: analytical.queryInput.spatialResolution,
  }
}

function factNumber(result: GeographicToolResult, id: string): number {
  const value = result.facts.find((fact) => fact.id === id)?.value
  if (typeof value !== 'number') throw new Error(`Geographic contribution fact is unavailable: ${id}`)
  return value
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort((left, right) => left.localeCompare(right)))
}

function formatCount(value: number): string {
  return value.toLocaleString('en-US')
}
