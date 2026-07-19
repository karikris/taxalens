import { executeGeographicTool, type GeographicToolAnalyticalEvidence } from './geographicToolExecution'
import type { GeographicReviewObjective, GeographicToolEvidence, GeographicToolResult } from './geographicTools'

export const GEOGRAPHIC_ANALYST_MODEL = 'configured-model' as const
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

export interface GeographicReviewRecommendationWorkflowResult {
  readonly schemaVersion: typeof GEOGRAPHIC_CONTRIBUTION_WORKFLOW_VERSION
  readonly objective: GeographicReviewObjective
  readonly answer: string
  readonly nextItemIds: readonly string[]
  readonly samplingDisclosure: string
  readonly toolResults: readonly GeographicToolResult[]
  readonly artifactIds: readonly string[]
  readonly externalActionsExecuted: false
  readonly scientificClaimAllowed: false
}

export interface GeographicCountryContributionRank {
  readonly scopeId: string
  readonly scopeName: string
  readonly candidateOnlyCellCount: number
}

export interface GeographicScopeComparisonWorkflowResult {
  readonly schemaVersion: typeof GEOGRAPHIC_CONTRIBUTION_WORKFLOW_VERSION
  readonly question: 'Which countries have the largest human-reviewable contribution?'
  readonly ranking: readonly GeographicCountryContributionRank[]
  readonly answer: string
  readonly toolResults: readonly GeographicToolResult[]
  readonly artifactIds: readonly string[]
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

export function recommendGeographicReviews(
  evidence: GeographicToolEvidence,
  analytical: GeographicToolAnalyticalEvidence,
  objective: GeographicReviewObjective,
  batchSize: number,
): GeographicReviewRecommendationWorkflowResult {
  const rollup = analytical.result.selectedRollup
  const common = scopedArguments(evidence, analytical)
  const inspection = executeGeographicTool('inspect_geographic_impact', {
    ...common,
    scope_level: rollup.scopeLevel,
    scope_id: rollup.scopeId,
    evidence_mode: 'comparison',
    metric: 'review_backlog',
  }, evidence, analytical)
  const recommendation = executeGeographicTool('recommend_geographic_review_batch', {
    ...common,
    scope_level: rollup.scopeLevel,
    scope_id: rollup.scopeId,
    review_objective: objective,
    batch_size: batchSize,
  }, evidence, analytical)
  const nextItemIds = Object.freeze(recommendation.records.map(({ id }) => id))
  const disclosure = reviewDisclosure(objective)
  return Object.freeze({
    schemaVersion: GEOGRAPHIC_CONTRIBUTION_WORKFLOW_VERSION,
    objective,
    answer: recommendation.status === 'unavailable'
      ? `No committed candidate identities satisfy the ${objective.replaceAll('_', ' ')} objective in ${rollup.scopeName}.`
      : `Review ${formatCount(nextItemIds.length)} existing candidate item${nextItemIds.length === 1 ? '' : 's'} for ${objective.replaceAll('_', ' ')} in ${rollup.scopeName}. ${disclosure}`,
    nextItemIds,
    samplingDisclosure: disclosure,
    toolResults: Object.freeze([inspection, recommendation]),
    artifactIds: uniqueSorted([...inspection.artifactIds, ...recommendation.artifactIds]),
    externalActionsExecuted: false as const,
    scientificClaimAllowed: false as const,
  })
}

export function compareCountryGeographicScopes(
  evidence: GeographicToolEvidence,
  analytical: GeographicToolAnalyticalEvidence,
  countryScopeIds: readonly string[],
): GeographicScopeComparisonWorkflowResult {
  const ids = [...new Set(countryScopeIds)]
  if (ids.length < 2 || ids.length > 20) {
    throw new Error('Country comparison requires 2 through 20 unique scope IDs')
  }
  const countries = ids.map((scopeId) => {
    const rollup = [analytical.result.selectedRollup, ...analytical.result.childRollups]
      .find((candidate) => candidate.scopeId === scopeId)
    if (rollup?.scopeLevel !== 'country') throw new Error(`Country scope is unavailable: ${scopeId}`)
    return rollup
  })
  const anchor = countries[0]!
  const common = scopedArguments(evidence, analytical)
  const scores = new Map<string, number>()
  const results = countries.slice(1).map((country) => {
    const result = executeGeographicTool('compare_geographic_scopes', {
      ...common,
      left_scope_level: 'country',
      left_scope_id: anchor.scopeId,
      right_scope_level: 'country',
      right_scope_id: country.scopeId,
      metric: 'candidate_only_cells',
    }, evidence, analytical)
    scores.set(anchor.scopeId, factNumber(result, 'left_candidate_only_cells'))
    scores.set(country.scopeId, factNumber(result, 'right_candidate_only_cells'))
    return result
  })
  const ranking = Object.freeze(countries.map((country) => Object.freeze({
    scopeId: country.scopeId,
    scopeName: country.scopeName,
    candidateOnlyCellCount: scores.get(country.scopeId)!,
  })).sort((left, right) => right.candidateOnlyCellCount - left.candidateOnlyCellCount || left.scopeId.localeCompare(right.scopeId)))
  return Object.freeze({
    schemaVersion: GEOGRAPHIC_CONTRIBUTION_WORKFLOW_VERSION,
    question: 'Which countries have the largest human-reviewable contribution?' as const,
    ranking,
    answer: `${ranking[0]!.scopeName} ranks first among the ${formatCount(ranking.length)} selected countries with ${formatCount(ranking[0]!.candidateOnlyCellCount)} candidate-only spatial cells. This is human-reviewable potential coverage contribution, not reviewed evidence added.`,
    toolResults: Object.freeze(results),
    artifactIds: uniqueSorted(results.flatMap(({ artifactIds }) => artifactIds)),
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

function reviewDisclosure(objective: GeographicReviewObjective): string {
  switch (objective) {
    case 'unbiased_audit':
      return 'Use only the campaign’s retained inclusion probabilities and weights for population-quality estimation.'
    case 'geographic_coverage_gap':
      return 'This is a targeted coverage-gap batch and does not support unweighted population inference.'
    case 'failure_discovery':
      return 'This is a targeted failure-discovery batch and does not support unweighted population inference.'
    case 'reference_shortfall':
      return 'This batch addresses reference readiness, not geographic population quality.'
    case 'conflict_adjudication':
      return 'This batch resolves existing conflicts and does not expand the audit sample.'
  }
}
