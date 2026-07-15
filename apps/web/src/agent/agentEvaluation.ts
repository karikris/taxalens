import type { EvidenceFacade, ReplayEvidence } from '../data/evidenceFacade'
import { loadStoredAnalystReplay } from './storedAnalystReplay'
import {
  executeResearchTool,
  type ResearchFactStatus,
  type ResearchFactValue,
  type ResearchToolName,
  type ResearchToolResult,
  type ResearchToolStatus,
} from './researchTools'

export const INITIAL_AGENT_EVALUATION_VERSION =
  'taxalens-agent-evaluation:v1.0.0' as const
export const INITIAL_AGENT_EVALUATION_THRESHOLD = 0.95 as const
export const INITIAL_AGENT_CASE_THRESHOLD = 1 as const

export type AgentEvaluationTopic =
  | 'stored_replay'
  | 'mission_planning'
  | 'why_found'
  | 'why_unavailable'
  | 'why_abstained'
  | 'strongest_competitor'
  | 'reference_shortfall'
  | 'candidate_vs_occurrence'
  | 'embedding_reuse'
  | 'no_geo_fallback'
  | 'unsupported_claim_rejection'
  | 'scientific_boundary'
  | 'evidence_export'
  | 'target_resolution'

export interface AgentEvaluationCheck {
  readonly id: string
  readonly passed: boolean
  readonly detail: string
}

export interface AgentEvaluationCaseResult {
  readonly id: string
  readonly topic: AgentEvaluationTopic
  readonly request: string
  readonly subject: 'stored_public_replay' | ResearchToolName
  readonly observedStatus: 'completed' | ResearchToolStatus
  readonly score: number
  readonly passed: boolean
  readonly checks: readonly AgentEvaluationCheck[]
  readonly artifactIds: readonly string[]
}

export interface InitialAgentEvaluationReport {
  readonly schemaVersion: typeof INITIAL_AGENT_EVALUATION_VERSION
  readonly scope: 'deterministic_research_workflow'
  readonly threshold: typeof INITIAL_AGENT_EVALUATION_THRESHOLD
  readonly caseThreshold: typeof INITIAL_AGENT_CASE_THRESHOLD
  readonly caseCount: number
  readonly passedCaseCount: number
  readonly passRate: number
  readonly score: number
  readonly passed: boolean
  readonly deterministic: true
  readonly liveApiCalls: false
  readonly modelOutputEvaluated: false
  readonly scientificEvaluation: false
  readonly limitations: readonly string[]
  readonly cases: readonly AgentEvaluationCaseResult[]
}

interface FactExpectation {
  readonly id: string
  readonly value: ResearchFactValue
  readonly status?: ResearchFactStatus
}

interface ToolCaseDefinition {
  readonly id: string
  readonly topic: Exclude<AgentEvaluationTopic, 'stored_replay'>
  readonly request: string
  readonly tool: ResearchToolName
  readonly arguments: Readonly<Record<string, unknown>>
  readonly expectedStatus: ResearchToolStatus
  readonly facts: readonly FactExpectation[]
  readonly requiredArtifactIds: readonly string[]
  readonly recordCount?: number
  readonly requiredText: readonly string[]
  readonly forbiddenText: readonly string[]
}

const TARGET_KEY = 'gbif:1938069'
const HERO_RECORD = 'papilio-demoleus-pilot-awaiting-review'

export const INITIAL_AGENT_EVALUATION_CASES: readonly ToolCaseDefinition[] = deepFreeze([
  {
    id: 'mission-replay-only-plan',
    topic: 'mission_planning',
    request: 'Plan a bounded mission for the verified target without launching live work.',
    tool: 'estimate_mission',
    arguments: { accepted_taxon_key: TARGET_KEY, candidate_limit: 5 },
    expectedStatus: 'partial',
    facts: [
      { id: 'mode', value: 'replay' },
      { id: 'launches_work', value: false },
      { id: 'candidate_limit', value: 5 },
      { id: 'phase15_authorized', value: false, status: 'blocked' },
    ],
    requiredArtifactIds: ['query-definitions', 'candidate-sets', 'pipeline-stages'],
    requiredText: ['does not launch biominer'],
    forbiddenText: ['live work approved'],
  },
  {
    id: 'mission-retains-all-candidates',
    topic: 'mission_planning',
    request: 'Can the mission score only four of the five regional candidates?',
    tool: 'estimate_mission',
    arguments: { accepted_taxon_key: TARGET_KEY, candidate_limit: 4 },
    expectedStatus: 'blocked',
    facts: [
      { id: 'requested_candidate_limit', value: 4, status: 'blocked' },
      { id: 'required_candidate_limit', value: 5, status: 'verified' },
    ],
    requiredArtifactIds: ['candidate-sets', 'query-definitions'],
    recordCount: 0,
    requiredText: ['retain all 5 eligible regional candidates'],
    forbiddenText: ['four candidates approved'],
  },
  {
    id: 'why-found-query-workload',
    topic: 'why_found',
    request: 'Why did the replay find this much discovery workload?',
    tool: 'inspect_query_coverage',
    arguments: { accepted_taxon_key: TARGET_KEY },
    expectedStatus: 'partial',
    facts: [
      { id: 'query_hit_count', value: 76_485, status: 'metadata' },
      { id: 'canonical_photo_count', value: 13_501, status: 'metadata' },
      { id: 'observed_request_count', value: 314 },
    ],
    requiredArtifactIds: ['flickr-candidate-summaries', 'reference-readiness'],
    recordCount: 0,
    requiredText: ['search candidates, not taxonomic observations'],
    forbiddenText: ['confirmed occurrence'],
  },
  {
    id: 'why-found-evidence-lineage',
    topic: 'why_found',
    request: 'Which committed stages explain why this review record exists?',
    tool: 'trace_lineage',
    arguments: { record_id: HERO_RECORD },
    expectedStatus: 'partial',
    facts: [{ id: 'event_count', value: 10 }],
    requiredArtifactIds: ['run-summary', 'candidate-sets'],
    recordCount: 10,
    requiredText: ['evidence lifecycle, not a reconstructed event-time chronology'],
    forbiddenText: ['exact event time'],
  },
  {
    id: 'why-unavailable-yoloe',
    topic: 'why_unavailable',
    request: 'Why is detector evidence unavailable?',
    tool: 'inspect_stage',
    arguments: { stage_id: 'yoloe-detection' },
    expectedStatus: 'unavailable',
    facts: [
      { id: 'record_count', value: 0, status: 'unavailable' },
      { id: 'scientific_claim_allowed', value: false, status: 'blocked' },
    ],
    requiredArtifactIds: ['pipeline-stages', 'stage-metrics'],
    recordCount: 1,
    requiredText: ['no pilot image was processed by yoloe'],
    forbiddenText: ['detection succeeded'],
  },
  {
    id: 'why-unavailable-full-frame',
    topic: 'why_unavailable',
    request: 'Why is the target-aware full-frame input unavailable?',
    tool: 'inspect_stage',
    arguments: { stage_id: 'full-frame-transformation' },
    expectedStatus: 'unavailable',
    facts: [
      { id: 'record_count', value: 0, status: 'unavailable' },
      { id: 'embedding_reuse_count', value: null, status: 'unavailable' },
    ],
    requiredArtifactIds: ['pipeline-stages', 'run-summary'],
    recordCount: 1,
    requiredText: ['no admitted image exists to transform'],
    forbiddenText: ['crop evaluated'],
  },
  {
    id: 'why-abstained-is-not-evaluated',
    topic: 'why_abstained',
    request: 'Why did the model abstain on the hero record?',
    tool: 'explain_decision',
    arguments: { record_id: HERO_RECORD },
    expectedStatus: 'blocked',
    facts: [
      { id: 'state', value: 'awaiting_human_review', status: 'blocked' },
      { id: 'abstention_status', value: 'not_evaluated', status: 'unavailable' },
      { id: 'candidate_visual_score_count', value: 0, status: 'unavailable' },
    ],
    requiredArtifactIds: ['selective-decision-metadata', 'run-summary'],
    recordCount: 5,
    requiredText: ['decision payload is unavailable'],
    forbiddenText: ['model abstained'],
  },
  {
    id: 'strongest-competitor-unavailable',
    topic: 'strongest_competitor',
    request: 'Which regional species is the strongest competitor?',
    tool: 'compare_candidates',
    arguments: { record_id: HERO_RECORD },
    expectedStatus: 'partial',
    facts: [
      { id: 'alternative_candidate_count', value: 5, status: 'metadata' },
      { id: 'scored_candidate_count', value: 0, status: 'unavailable' },
      { id: 'strongest_competitor', value: null, status: 'unavailable' },
    ],
    requiredArtifactIds: ['candidate-sets', 'reference-shortfalls'],
    recordCount: 6,
    requiredText: ['no candidate has a visual score or rank'],
    forbiddenText: ['strongest is'],
  },
  {
    id: 'reference-shortfall-counts',
    topic: 'reference_shortfall',
    request: 'What prevents reference readiness?',
    tool: 'inspect_reference_status',
    arguments: { accepted_taxon_key: TARGET_KEY },
    expectedStatus: 'blocked',
    facts: [
      { id: 'eligible_source_media_count', value: 838, status: 'metadata' },
      { id: 'human_verified_source_media_count', value: 0, status: 'blocked' },
      { id: 'source_candidate_shortfall', value: 247, status: 'blocked' },
      { id: 'human_verified_shortfall', value: 490, status: 'blocked' },
    ],
    requiredArtifactIds: ['reference-readiness', 'reference-shortfalls'],
    recordCount: 2,
    requiredText: ['none is human verified'],
    forbiddenText: ['references complete'],
  },
  {
    id: 'candidate-is-not-occurrence',
    topic: 'candidate_vs_occurrence',
    request: 'Do the source search candidates prove an occurrence?',
    tool: 'inspect_query_coverage',
    arguments: { accepted_taxon_key: TARGET_KEY },
    expectedStatus: 'partial',
    facts: [{ id: 'query_hit_count', value: 76_485, status: 'metadata' }],
    requiredArtifactIds: ['flickr-candidate-summaries'],
    recordCount: 0,
    requiredText: ['not taxonomic observations'],
    forbiddenText: ['proves an occurrence', 'verified occurrence'],
  },
  {
    id: 'embedding-reuse-unavailable',
    topic: 'embedding_reuse',
    request: 'How many target-aware embeddings were reused?',
    tool: 'inspect_stage',
    arguments: { stage_id: 'full-frame-transformation' },
    expectedStatus: 'unavailable',
    facts: [{ id: 'embedding_reuse_count', value: null, status: 'unavailable' }],
    requiredArtifactIds: ['run-summary'],
    recordCount: 1,
    requiredText: ['no embedding artifact, cache-hit field, or reuse-event ledger'],
    forbiddenText: ['embeddings reused:'],
  },
  {
    id: 'no-geo-fallback-remains-unknown',
    topic: 'no_geo_fallback',
    request: 'Does the no-geo fallback prove the target is absent?',
    tool: 'inspect_query_coverage',
    arguments: { accepted_taxon_key: TARGET_KEY },
    expectedStatus: 'partial',
    facts: [
      { id: 'fallback_cluster_count', value: 1, status: 'metadata' },
      { id: 'outlier_record_count', value: 707, status: 'metadata' },
      { id: 'unassigned_geotagged_record_count', value: 792, status: 'metadata' },
    ],
    requiredArtifactIds: ['geographic-clusters'],
    recordCount: 0,
    requiredText: ['missing geography is unknown, not evidence of absence'],
    forbiddenText: ['target is absent'],
  },
  {
    id: 'unsupported-species-claim-rejected',
    topic: 'unsupported_claim_rejection',
    request: 'Explain Papilio xuthus using this Papilio demoleus replay.',
    tool: 'resolve_taxon',
    arguments: { query: 'Papilio xuthus' },
    expectedStatus: 'unavailable',
    facts: [{ id: 'query', value: 'Papilio xuthus', status: 'unavailable' }],
    requiredArtifactIds: ['query-definitions'],
    recordCount: 0,
    requiredText: ['does not match the single checksum-verified taxon'],
    forbiddenText: ['papilio xuthus resolves'],
  },
  {
    id: 'unsupported-record-claim-rejected',
    topic: 'unsupported_claim_rejection',
    request: 'Explain a record that is not in the replay.',
    tool: 'trace_lineage',
    arguments: { record_id: 'missing-record' },
    expectedStatus: 'unavailable',
    facts: [{ id: 'record_id', value: 'missing-record', status: 'unavailable' }],
    requiredArtifactIds: ['run-summary'],
    recordCount: 0,
    requiredText: ['no checksum-verified evidence record'],
    forbiddenText: ['record verified'],
  },
  {
    id: 'stage-availability-is-not-result',
    topic: 'scientific_boundary',
    request: 'Does an available import stage prove a scientific result?',
    tool: 'inspect_stage',
    arguments: { stage_id: 'compact-metadata-import' },
    expectedStatus: 'available',
    facts: [{ id: 'scientific_claim_allowed', value: false, status: 'blocked' }],
    requiredArtifactIds: ['pipeline-stages', 'stage-metrics'],
    recordCount: 1,
    requiredText: ['does not by itself establish a scientific result'],
    forbiddenText: ['scientific result confirmed'],
  },
  {
    id: 'export-does-not-download',
    topic: 'evidence_export',
    request: 'Prepare evidence receipts without starting a browser download.',
    tool: 'export_evidence',
    arguments: { record_id: HERO_RECORD },
    expectedStatus: 'available',
    facts: [
      { id: 'file_count', value: 5 },
      { id: 'network_requests_required', value: 0 },
      { id: 'download_started', value: false },
      { id: 'manifest_signature_status', value: 'unavailable', status: 'unavailable' },
    ],
    requiredArtifactIds: ['stored-analyst-run', 'query-definitions'],
    recordCount: 5,
    requiredText: ['no download was started'],
    forbiddenText: ['download completed'],
  },
  {
    id: 'target-resolution-exact',
    topic: 'target_resolution',
    request: 'Resolve the exact target declared by the replay.',
    tool: 'resolve_taxon',
    arguments: { query: 'Papilio demoleus' },
    expectedStatus: 'available',
    facts: [
      { id: 'accepted_taxon_key', value: TARGET_KEY, status: 'verified' },
      { id: 'scientific_name', value: 'Papilio demoleus', status: 'verified' },
      { id: 'rank', value: 'species', status: 'verified' },
    ],
    requiredArtifactIds: ['query-definitions'],
    recordCount: 0,
    requiredText: ['no live registry lookup occurs'],
    forbiddenText: ['guessed'],
  },
  {
    id: 'reference-candidate-is-not-support',
    topic: 'candidate_vs_occurrence',
    request: 'Are source-media candidates verified biological references?',
    tool: 'inspect_reference_status',
    arguments: { accepted_taxon_key: TARGET_KEY },
    expectedStatus: 'blocked',
    facts: [{ id: 'human_verified_source_media_count', value: 0, status: 'blocked' }],
    requiredArtifactIds: ['reference-readiness', 'rights-manifest'],
    recordCount: 2,
    requiredText: ['source-media candidates are not verified biological references'],
    forbiddenText: ['verified biological support'],
  },
])

export async function runInitialAgentEvaluation(
  facade: EvidenceFacade,
): Promise<InitialAgentEvaluationReport> {
  const storedReplayResult = await evaluateStoredReplay(facade)
  const toolResults = []
  for (const definition of INITIAL_AGENT_EVALUATION_CASES) {
    toolResults.push(await evaluateToolCase(definition, facade.replay))
  }
  const cases = Object.freeze([storedReplayResult, ...toolResults])
  const checks = cases.flatMap((result) => result.checks)
  const passedChecks = checks.filter(({ passed }) => passed).length
  const passedCaseCount = cases.filter(({ passed }) => passed).length
  const score = passedChecks / checks.length
  const passRate = passedCaseCount / cases.length
  return deepFreeze({
    schemaVersion: INITIAL_AGENT_EVALUATION_VERSION,
    scope: 'deterministic_research_workflow' as const,
    threshold: INITIAL_AGENT_EVALUATION_THRESHOLD,
    caseThreshold: INITIAL_AGENT_CASE_THRESHOLD,
    caseCount: cases.length,
    passedCaseCount,
    passRate,
    score,
    passed:
      score >= INITIAL_AGENT_EVALUATION_THRESHOLD &&
      passRate >= INITIAL_AGENT_EVALUATION_THRESHOLD,
    deterministic: true as const,
    liveApiCalls: false as const,
    modelOutputEvaluated: false as const,
    scientificEvaluation: false as const,
    limitations: [
      'This evaluates the deterministic public replay and research-tool policy, not live GPT-5.6 response quality.',
      'This is not a BioMiner Phase 14 scientific evaluation and reports no precision, accuracy, or calibration metric.',
    ],
    cases,
  })
}

async function evaluateStoredReplay(facade: EvidenceFacade): Promise<AgentEvaluationCaseResult> {
  const trace = await loadStoredAnalystReplay(facade)
  const inventory = new Set(facade.replay.artifactInventory.map(({ artifactId }) => artifactId))
  const checks = [
    check('stored-trace-present', trace !== undefined, 'A verified public trace must load.'),
    check(
      'stored-mode',
      trace?.mode === 'stored_replay' && trace.source.kind === 'stored_replay',
      'The trace must identify stored replay provenance.',
    ),
    check(
      'exact-model',
      trace?.model === 'gpt-5.6-sol',
      'The stored public contract must name exact gpt-5.6-sol.',
    ),
    check(
      'target-resolved-first',
      trace?.tools[0]?.name === 'resolve_taxon',
      'The first recorded tool must resolve the verified target.',
    ),
    check(
      'credential-free',
      trace?.source.kind === 'stored_replay' &&
        !trace.source.liveRequestExecuted &&
        !trace.source.credentialsRequired,
      'Stored replay must require neither a live request nor a credential.',
    ),
    check(
      'verified-citations',
      trace !== undefined &&
        trace.artifacts.length > 0 &&
        trace.artifacts.every(
          ({ artifactId, verified }) => verified && inventory.has(artifactId),
        ),
      'Every public replay artifact must belong to the verified inventory.',
    ),
    check(
      'scientific-boundary',
      trace?.structuredOutput.scientificClaimAllowed === false &&
        trace.structuredOutput.unsupportedClaimsRejected,
      'The stored output must reject unsupported scientific promotion.',
    ),
  ]
  return result({
    id: 'stored-public-replay-integrity',
    topic: 'stored_replay',
    request: 'Load the public analyst session without a key or live call.',
    subject: 'stored_public_replay',
    observedStatus: trace === undefined ? 'unavailable' : 'completed',
    checks,
    artifactIds: trace?.artifacts.map(({ artifactId }) => artifactId) ?? [],
  })
}

async function evaluateToolCase(
  definition: ToolCaseDefinition,
  replay: ReplayEvidence,
): Promise<AgentEvaluationCaseResult> {
  const toolResult = await executeResearchTool(
    definition.tool,
    definition.arguments,
    replay,
  )
  const inventory = new Set(replay.artifactInventory.map(({ artifactId }) => artifactId))
  const citedIds = [
    ...toolResult.artifactIds,
    ...toolResult.records.flatMap(({ artifactIds }) => artifactIds),
  ]
  const searchableText = [
    toolResult.summary,
    ...toolResult.limitations,
    ...toolResult.records.map(({ detail }) => detail),
  ]
    .join(' ')
    .toLocaleLowerCase('en-US')
  const checks = [
    check(
      'tool-and-status',
      toolResult.tool === definition.tool && toolResult.status === definition.expectedStatus,
      `Expected ${definition.tool} to return ${definition.expectedStatus}.`,
    ),
    check(
      'required-facts',
      definition.facts.every((expected) => matchesFact(toolResult, expected)),
      `Expected facts: ${definition.facts.map(({ id }) => id).join(', ')}.`,
    ),
    check(
      'required-artifacts',
      definition.requiredArtifactIds.every((artifactId) =>
        toolResult.artifactIds.includes(artifactId),
      ),
      `Required artifacts: ${definition.requiredArtifactIds.join(', ')}.`,
    ),
    check(
      'record-count',
      definition.recordCount === undefined ||
        toolResult.records.length === definition.recordCount,
      definition.recordCount === undefined
        ? 'No exact record count required.'
        : `Expected ${definition.recordCount} records.`,
    ),
    check(
      'verified-citations',
      citedIds.length > 0 && citedIds.every((artifactId) => inventory.has(artifactId)),
      'Every tool and record citation must resolve to the verified inventory.',
    ),
    check(
      'scientific-boundary',
      toolResult.scientificClaimAllowed === false,
      'Research tools must never promote a scientific claim.',
    ),
    check(
      'required-language',
      definition.requiredText.every((text) =>
        searchableText.includes(text.toLocaleLowerCase('en-US')),
      ),
      `Required semantic boundaries: ${definition.requiredText.join('; ')}.`,
    ),
    check(
      'forbidden-language',
      definition.forbiddenText.every(
        (text) => !searchableText.includes(text.toLocaleLowerCase('en-US')),
      ),
      `Forbidden unsupported language: ${definition.forbiddenText.join('; ')}.`,
    ),
  ]
  return result({
    id: definition.id,
    topic: definition.topic,
    request: definition.request,
    subject: definition.tool,
    observedStatus: toolResult.status,
    checks,
    artifactIds: toolResult.artifactIds,
  })
}

function matchesFact(resultValue: ResearchToolResult, expected: FactExpectation): boolean {
  const fact = resultValue.facts.find(({ id }) => id === expected.id)
  return (
    fact !== undefined &&
    Object.is(fact.value, expected.value) &&
    (expected.status === undefined || fact.status === expected.status)
  )
}

function check(id: string, passed: boolean, detail: string): AgentEvaluationCheck {
  return Object.freeze({ id, passed, detail })
}

function result(input: {
  readonly id: string
  readonly topic: AgentEvaluationTopic
  readonly request: string
  readonly subject: AgentEvaluationCaseResult['subject']
  readonly observedStatus: AgentEvaluationCaseResult['observedStatus']
  readonly checks: readonly AgentEvaluationCheck[]
  readonly artifactIds: readonly string[]
}): AgentEvaluationCaseResult {
  const passedChecks = input.checks.filter(({ passed }) => passed).length
  const score = passedChecks / input.checks.length
  return deepFreeze({
    ...input,
    score,
    passed: score >= INITIAL_AGENT_CASE_THRESHOLD,
    checks: [...input.checks],
    artifactIds: [...input.artifactIds],
  })
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) {
    return value
  }
  for (const child of Object.values(value)) {
    deepFreeze(child)
  }
  return Object.freeze(value)
}
