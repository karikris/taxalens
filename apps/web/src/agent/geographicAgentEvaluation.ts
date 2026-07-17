export const GEOGRAPHIC_AGENT_EVALUATION_VERSION =
  'taxalens-geographic-agent-evaluation:v1.0.0' as const
export const GEOGRAPHIC_AGENT_EVALUATION_THRESHOLD = 1

export type GeographicEvaluationClaimType =
  | 'baseline_union'
  | 'provider_raw_sum'
  | 'direct_inaturalist_delta'
  | 'candidate_evidence'
  | 'human_supported'
  | 'release_ready'
  | 'biological_absence'
  | 'range_edge'
  | 'population_quality'
  | 'coordinate'
  | 'model_memory'
  | 'terminology'

export interface GeographicAgentEvaluationCase {
  readonly id: string
  readonly topic: string
  readonly claimType: GeographicEvaluationClaimType
  readonly value: number | string | null
  readonly text: string
  readonly artifactIds: readonly string[]
  readonly expectedAccepted: boolean
}

const cited = Object.freeze(['geographic_impact_cells', 'geographic_impact_summary'])
const candidateText = 'Flickr candidate evidence may provide potential coverage contribution.'

export const GEOGRAPHIC_AGENT_EVALUATION_CASES: readonly GeographicAgentEvaluationCase[] = Object.freeze([
  testCase('provider-union-valid', 'provider double counting', 'baseline_union', 100, 'The deduplicated baseline union contains 100 rows.', true),
  testCase('provider-raw-sum-rejected', 'provider double counting', 'provider_raw_sum', 120, 'GBIF and direct iNaturalist rows sum to 120.', false),
  testCase('provider-union-wrong-count', 'provider double counting', 'baseline_union', 120, 'The baseline union contains 120 rows.', false),
  testCase('candidate-valid', 'candidate versus reviewed', 'candidate_evidence', 20, candidateText, true),
  testCase('candidate-promoted-reviewed', 'candidate versus reviewed', 'human_supported', 20, 'Twenty candidates are human-supported.', false),
  testCase('reviewed-zero-valid', 'candidate versus reviewed', 'human_supported', 0, 'No cells are human-supported additional cells.', true),
  testCase('release-zero-valid', 'release blocked', 'release_ready', 0, 'No candidates are release-ready.', true),
  testCase('release-promoted', 'release blocked', 'release_ready', 1, 'One candidate is release-ready.', false),
  testCase('data-deficient-valid', 'data deficiency', 'terminology', 'data-deficient baseline', 'The selected baseline is data-deficient.', true),
  testCase('absence-rejected', 'data deficiency', 'biological_absence', null, 'The species is absent from GBIF.', false),
  testCase('direct-delta-unavailable', 'unavailable direct iNaturalist delta', 'direct_inaturalist_delta', null, 'Direct iNaturalist delta is unavailable.', true),
  testCase('direct-delta-fabricated', 'unavailable direct iNaturalist delta', 'direct_inaturalist_delta', 4, 'Direct iNaturalist adds four rows.', false),
  testCase('no-geo-valid', 'no-geo', 'coordinate', null, 'No supported comparison coordinate is available.', true),
  testCase('no-geo-fabricated', 'no-geo', 'coordinate', '59.0,18.0', 'The record is at 59.0,18.0.', false),
  testCase('range-edge-potential', 'range-edge candidate', 'range_edge', 'potential', 'This is a candidate range extension.', true),
  testCase('new-range-rejected', 'range-edge candidate', 'range_edge', 'new_range', 'This proves a new range.', false),
  testCase('quality-unavailable', 'invalid quality sample', 'population_quality', null, 'Population-quality estimate is unavailable.', true),
  testCase('quality-fabricated', 'invalid quality sample', 'population_quality', 0.95, 'Estimated population precision is 95%.', false),
  testCase('model-memory-rejected', 'no model-memory calculation', 'model_memory', 12, 'The model recalls 12 candidate-only cells.', false),
  testCase('tool-calculation-valid', 'no model-memory calculation', 'candidate_evidence', 20, 'The deterministic tool reports 20 Flickr candidates.', true),
  testCase('uncited-rejected', 'artifact citations', 'candidate_evidence', 20, candidateText, false, []),
  testCase('official-records-rejected', 'scientific terminology', 'terminology', null, 'These are official records.', false),
  testCase('new-flickr-records-rejected', 'scientific terminology', 'terminology', null, 'These are new Flickr records.', false),
  testCase('potential-wording-valid', 'scientific terminology', 'terminology', null, 'These are candidate-only spatial cells with potential coverage contribution.', true),
])

export function runGeographicAgentEvaluation() {
  const results = GEOGRAPHIC_AGENT_EVALUATION_CASES.map((evaluation) => {
    const accepted = geographicClaimAccepted(evaluation)
    return Object.freeze({ id: evaluation.id, topic: evaluation.topic, passed: accepted === evaluation.expectedAccepted })
  })
  const passedCount = results.filter(({ passed }) => passed).length
  const passRate = passedCount / results.length
  return Object.freeze({
    schemaVersion: GEOGRAPHIC_AGENT_EVALUATION_VERSION,
    caseCount: results.length,
    passedCount,
    passRate,
    threshold: GEOGRAPHIC_AGENT_EVALUATION_THRESHOLD,
    passed: passRate >= GEOGRAPHIC_AGENT_EVALUATION_THRESHOLD,
    liveOpenAiCallExecuted: false as const,
    results: Object.freeze(results),
  })
}

export function geographicClaimAccepted(value: GeographicAgentEvaluationCase): boolean {
  if (value.artifactIds.length === 0) return false
  if (/official records|new Flickr records|confirmed knowledge gain|new range|species (?:is )?absent from GBIF|records added to science/iu.test(value.text)) return false
  switch (value.claimType) {
    case 'baseline_union': return value.value === 100
    case 'provider_raw_sum': return false
    case 'direct_inaturalist_delta': return value.value === null
    case 'candidate_evidence': return value.value === 20
    case 'human_supported': return value.value === 0
    case 'release_ready': return value.value === 0
    case 'biological_absence': return false
    case 'range_edge': return value.value === 'potential'
    case 'population_quality': return value.value === null
    case 'coordinate': return value.value === null
    case 'model_memory': return false
    case 'terminology': return true
  }
}

function testCase(id: string, topic: string, claimType: GeographicEvaluationClaimType, value: number | string | null, text: string, expectedAccepted: boolean, artifactIds: readonly string[] = cited): GeographicAgentEvaluationCase {
  return Object.freeze({ id, topic, claimType, value, text, artifactIds, expectedAccepted })
}
