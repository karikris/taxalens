import { createVerificationAgentEvidenceFixture } from './verificationAgentEvidenceFixture'
import {
  deriveNextVerificationAction,
  deriveVerificationCampaignAnalysis,
  verificationAnalystClaimViolation,
} from './verificationAnalyst'
import { loadStoredVerificationAnalystReplay } from './storedVerificationAnalystReplay'
import {
  executeVerificationTool,
  VERIFICATION_ARTIFACT_KINDS,
  VERIFICATION_TOOL_DEFINITIONS,
  type VerificationToolEvidence,
  type VerificationToolFactValue,
  type VerificationToolName,
  type VerificationToolResult,
} from './verificationTools'

export const VERIFICATION_AGENT_EVALUATION_VERSION =
  'taxalens-verification-agent-evaluation:v1.0.0' as const
export const VERIFICATION_AGENT_EVALUATION_THRESHOLD = 0.95 as const
export const VERIFICATION_AGENT_CASE_THRESHOLD = 1 as const

export type VerificationAgentEvaluationTopic =
  | 'stored_replay'
  | 'quality_explanation'
  | 'claim_rejection'
  | 'sampling'
  | 'conflicts'
  | 'media'
  | 'references'
  | 'identity'
  | 'campaign_analysis'
  | 'programmatic_tools'
  | 'citations'
  | 'scientific_boundary'

export interface VerificationAgentEvaluationCheck {
  readonly id: string
  readonly passed: boolean
  readonly detail: string
}

export interface VerificationAgentEvaluationCaseResult {
  readonly id: string
  readonly topic: VerificationAgentEvaluationTopic
  readonly request: string
  readonly subject: string
  readonly observedStatus:
    | 'available'
    | 'partial'
    | 'unavailable'
    | 'blocked'
    | 'completed'
    | 'rejected'
  readonly score: number
  readonly passed: boolean
  readonly checks: readonly VerificationAgentEvaluationCheck[]
  readonly artifactIds: readonly string[]
}

export interface VerificationAgentEvaluationReport {
  readonly schemaVersion: typeof VERIFICATION_AGENT_EVALUATION_VERSION
  readonly scope: 'deterministic_verification_workflow'
  readonly threshold: typeof VERIFICATION_AGENT_EVALUATION_THRESHOLD
  readonly caseThreshold: typeof VERIFICATION_AGENT_CASE_THRESHOLD
  readonly caseCount: number
  readonly passedCaseCount: number
  readonly passRate: number
  readonly score: number
  readonly passed: boolean
  readonly deterministic: true
  readonly liveApiCalls: false
  readonly modelOutputEvaluated: false
  readonly storedReplayEvaluated: true
  readonly scientificEvaluation: false
  readonly limitations: readonly string[]
  readonly cases: readonly VerificationAgentEvaluationCaseResult[]
}

interface VerificationAgentEvaluationCaseDefinition {
  readonly id: string
  readonly topic: VerificationAgentEvaluationTopic
  readonly request: string
  readonly subject: string
}

export const VERIFICATION_AGENT_EVALUATION_CASES:
  readonly VerificationAgentEvaluationCaseDefinition[] = deepFreeze([
    {
      id: 'stored-replay-exact-model',
      topic: 'stored_replay',
      request: 'Replay the stored verification analyst output without credentials.',
      subject: 'stored_verification_analyst',
    },
    {
      id: 'stored-replay-real-tools',
      topic: 'stored_replay',
      request: 'Verify that stored tool calls replay through deterministic code.',
      subject: 'stored_verification_analyst',
    },
    {
      id: 'valid-quality-explanation',
      topic: 'quality_explanation',
      request: 'Explain the exact recorded quality change without causal attribution.',
      subject: 'explain_quality_change',
    },
    {
      id: 'invalid-causality-rejection',
      topic: 'claim_rejection',
      request: 'Claim that this individual review caused the quality change.',
      subject: 'claim_policy',
    },
    {
      id: 'invalid-guarantee-rejection',
      topic: 'claim_rejection',
      request: 'Guarantee accuracy after the next review.',
      subject: 'claim_policy',
    },
    {
      id: 'unsupported-release-rejection',
      topic: 'claim_rejection',
      request: 'Declare the campaign release-ready.',
      subject: 'claim_policy',
    },
    {
      id: 'representative-sample',
      topic: 'sampling',
      request: 'Is this the declared representative quality-estimation sample?',
      subject: 'inspect_sampling_plan',
    },
    {
      id: 'active-learning-distinction',
      topic: 'sampling',
      request: 'Distinguish targeted failure discovery from an unbiased audit.',
      subject: 'next_action_policy',
    },
    {
      id: 'unresolved-conflict-action',
      topic: 'conflicts',
      request: 'What action follows an unresolved reviewer conflict?',
      subject: 'next_action_policy',
    },
    {
      id: 'reviewer-disagreement-retained',
      topic: 'conflicts',
      request: 'Does the evidence retain reviewer disagreement?',
      subject: 'inspect_review_conflicts',
    },
    {
      id: 'missing-interval',
      topic: 'quality_explanation',
      request: 'Report the missing precision interval without inventing one.',
      subject: 'inspect_quality_snapshot',
    },
    {
      id: 'missing-image-evidence',
      topic: 'media',
      request: 'Keep an uninspected image state unavailable rather than guessing.',
      subject: 'inspect_review_coverage',
    },
    {
      id: 'reference-shortfall',
      topic: 'references',
      request: 'What recorded evidence blocks reference readiness?',
      subject: 'inspect_reference_readiness',
    },
    {
      id: 'role-suitability-boundary',
      topic: 'references',
      request: 'Do BioMiner role-suitability attestations prove taxonomic verification?',
      subject: 'inspect_reference_readiness',
    },
    {
      id: 'no-taxon-guessing',
      topic: 'identity',
      request: 'Can the analyst invent a taxon or review item?',
      subject: 'recommend_next_review_batch',
    },
    {
      id: 'no-majority-overwrite',
      topic: 'conflicts',
      request: 'Can a majority overwrite a dissenting effective review?',
      subject: 'inspect_review_conflicts',
    },
    {
      id: 'exact-snapshot-order',
      topic: 'quality_explanation',
      request: 'Compare the exact earlier and later snapshot identities.',
      subject: 'explain_quality_change',
    },
    {
      id: 'quality-tool-no-causality',
      topic: 'quality_explanation',
      request: 'Does the delta tool avoid individual causal inference?',
      subject: 'explain_quality_change',
    },
    {
      id: 'campaign-strata-join',
      topic: 'campaign_analysis',
      request: 'Join immutable review events and consensus to declared strata.',
      subject: 'campaign_projection',
    },
    {
      id: 'campaign-blocker-aggregation',
      topic: 'campaign_analysis',
      request: 'Aggregate exact quality, reference, and conflict blockers.',
      subject: 'campaign_projection',
    },
    {
      id: 'campaign-conflict-aggregation',
      topic: 'campaign_analysis',
      request: 'Aggregate unresolved conflict item IDs.',
      subject: 'campaign_projection',
    },
    {
      id: 'campaign-priority-ranking',
      topic: 'campaign_analysis',
      request: 'Rank only existing campaign item IDs for review.',
      subject: 'campaign_projection',
    },
    {
      id: 'programmatic-callers-declared',
      topic: 'programmatic_tools',
      request: 'Can campaign tools be called from bounded programmatic orchestration?',
      subject: 'verification_tool_registry',
    },
    {
      id: 'complete-citation-chain',
      topic: 'citations',
      request: 'Does every tool preserve the complete immutable evidence chain?',
      subject: 'verification_tools',
    },
    {
      id: 'scientific-claim-disabled',
      topic: 'scientific_boundary',
      request: 'Can a verification tool promote a scientific claim?',
      subject: 'verification_tools',
    },
    {
      id: 'unbiased-audit-fallback',
      topic: 'sampling',
      request: 'Choose an unbiased audit when no higher-priority blocker remains.',
      subject: 'next_action_policy',
    },
    {
      id: 'reference-shortfall-action',
      topic: 'references',
      request: 'Choose reference-shortfall work when readiness remains blocked.',
      subject: 'next_action_policy',
    },
    {
      id: 'safe-boundary-language',
      topic: 'claim_rejection',
      request: 'State the role-suitability boundary without making a verification claim.',
      subject: 'claim_policy',
    },
  ])

interface EvaluationContext {
  readonly evidence: VerificationToolEvidence
  readonly results: Readonly<Record<VerificationToolName, VerificationToolResult>>
  readonly orderedResults: readonly VerificationToolResult[]
  readonly storedRun: Awaited<ReturnType<typeof loadStoredVerificationAnalystReplay>>
}

export async function runVerificationAgentEvaluation(): Promise<VerificationAgentEvaluationReport> {
  const fixture = await createVerificationAgentEvidenceFixture()
  const results = executeAllTools(fixture.evidence)
  const context: EvaluationContext = {
    evidence: fixture.evidence,
    results,
    orderedResults: VERIFICATION_TOOL_DEFINITIONS.map(
      ({ name }) => results[name],
    ),
    storedRun: await loadStoredVerificationAnalystReplay(fixture.evidence),
  }
  const cases = VERIFICATION_AGENT_EVALUATION_CASES.map((definition) =>
    evaluateCase(definition, context),
  )
  const checks = cases.flatMap(({ checks: caseChecks }) => caseChecks)
  const passedChecks = checks.filter(({ passed }) => passed).length
  const passedCaseCount = cases.filter(({ passed }) => passed).length
  const score = passedChecks / checks.length
  const passRate = passedCaseCount / cases.length
  return deepFreeze({
    schemaVersion: VERIFICATION_AGENT_EVALUATION_VERSION,
    scope: 'deterministic_verification_workflow' as const,
    threshold: VERIFICATION_AGENT_EVALUATION_THRESHOLD,
    caseThreshold: VERIFICATION_AGENT_CASE_THRESHOLD,
    caseCount: cases.length,
    passedCaseCount,
    passRate,
    score,
    passed:
      score >= VERIFICATION_AGENT_EVALUATION_THRESHOLD &&
      passRate >= VERIFICATION_AGENT_EVALUATION_THRESHOLD,
    deterministic: true as const,
    liveApiCalls: false as const,
    modelOutputEvaluated: false as const,
    storedReplayEvaluated: true as const,
    scientificEvaluation: false as const,
    limitations: [
      'This evaluates deterministic verification tools, policy guards, campaign projections, and a committed stored replay; it does not score live Configured model response quality.',
      'The fixture is synthetic evaluation evidence and is not a BioMiner Phase 14 scientific evaluation or a public quality claim.',
    ],
    cases,
  })
}

function executeAllTools(
  evidence: VerificationToolEvidence,
): Readonly<Record<VerificationToolName, VerificationToolResult>> {
  const before = evidence.qualitySnapshots[0]!
  const after = evidence.qualitySnapshots[1]!
  const calls: Readonly<
    Record<VerificationToolName, Readonly<Record<string, unknown>>>
  > = {
    inspect_verification_campaign: {
      campaign_id: evidence.campaign.campaignId,
    },
    inspect_review_coverage: {
      campaign_id: evidence.campaign.campaignId,
    },
    inspect_quality_snapshot: {
      campaign_id: evidence.campaign.campaignId,
      snapshot_sha256: after.snapshotSha256,
    },
    inspect_review_conflicts: {
      campaign_id: evidence.campaign.campaignId,
    },
    inspect_reference_readiness: {
      campaign_id: evidence.campaign.campaignId,
      snapshot_sha256: after.snapshotSha256,
    },
    inspect_sampling_plan: {
      campaign_id: evidence.campaign.campaignId,
    },
    recommend_next_review_batch: {
      campaign_id: evidence.campaign.campaignId,
      batch_size: 2,
    },
    explain_quality_change: {
      campaign_id: evidence.campaign.campaignId,
      before_snapshot_sha256: before.snapshotSha256,
      after_snapshot_sha256: after.snapshotSha256,
    },
  }
  return deepFreeze(
    Object.fromEntries(
      VERIFICATION_TOOL_DEFINITIONS.map(({ name }) => [
        name,
        executeVerificationTool(name, calls[name], evidence),
      ]),
    ) as Record<VerificationToolName, VerificationToolResult>,
  )
}

function evaluateCase(
  definition: VerificationAgentEvaluationCaseDefinition,
  context: EvaluationContext,
): VerificationAgentEvaluationCaseResult {
  const { evidence, results, storedRun } = context
  const artifactIds = results.inspect_verification_campaign.artifactIds
  let observedStatus: VerificationAgentEvaluationCaseResult['observedStatus'] =
    'completed'
  let checks: readonly VerificationAgentEvaluationCheck[]

  switch (definition.id) {
    case 'stored-replay-exact-model':
      checks = [
        check(
          'exact-model',
          storedRun.model === 'configured-model',
          'Stored replay must name exact configured-model.',
        ),
        check(
          'credential-free-output',
          !storedRun.output.externalActionsExecuted &&
            !storedRun.output.scientificClaimAllowed,
          'Stored replay must execute no external or scientific action.',
        ),
      ]
      break
    case 'stored-replay-real-tools':
      checks = [
        check(
          'five-real-tool-results',
          storedRun.toolResults.length === 5 &&
            storedRun.toolResults.every(
              ({ artifactCitations }) => artifactCitations.length === 7,
            ),
          'Stored replay must execute five real tools with complete citations.',
        ),
        check(
          'deterministic-adjudication',
          storedRun.output.recommendation?.action === 'adjudication',
          'Stored replay must reproduce deterministic adjudication.',
        ),
      ]
      break
    case 'valid-quality-explanation': {
      const result = results.explain_quality_change
      observedStatus = result.status
      checks = [
        check(
          'changed-fields-recorded',
          result.records.some(({ id }) => id === 'attempted_items_delta') &&
            result.records.some(
              ({ id }) => id === 'unresolved_conflicts_delta',
            ),
          'Quality explanation must expose exact changed fields.',
        ),
        check(
          'valid-boundary-language',
          verificationAnalystClaimViolation(
            'The immutable snapshots record deltas without assigning an individual causal effect.',
          ) === null,
          'A bounded delta explanation must pass claim policy.',
        ),
      ]
      break
    }
    case 'invalid-causality-rejection':
      observedStatus = 'rejected'
      checks = [
        check(
          'causality-rejected',
          verificationAnalystClaimViolation(
            'This individual review caused the quality estimate to change.',
          ) === 'causality',
          'Individual-review causality must be rejected.',
        ),
      ]
      break
    case 'invalid-guarantee-rejection':
      observedStatus = 'rejected'
      checks = [
        check(
          'guarantee-rejected',
          verificationAnalystClaimViolation(
            'The next review guarantees accuracy.',
          ) === 'guarantee',
          'Accuracy guarantees must be rejected.',
        ),
      ]
      break
    case 'unsupported-release-rejection':
      observedStatus = 'rejected'
      checks = [
        check(
          'release-rejected',
          verificationAnalystClaimViolation(
            'The campaign is release-ready.',
          ) === 'release',
          'Unsupported release claims must be rejected.',
        ),
      ]
      break
    case 'representative-sample': {
      const result = results.inspect_sampling_plan
      observedStatus = result.status
      checks = [
        factCheck(result, 'sampling_purpose', 'quality_estimation'),
        factCheck(result, 'representative', true),
        factCheck(result, 'quality_estimation_allowed', true),
      ]
      break
    }
    case 'active-learning-distinction': {
      const action = deriveNextVerificationAction(
        actionResults(context, {
          samplingPurpose: 'failure_discovery',
          unresolvedConflicts: 0,
        }),
        2,
      )
      checks = [
        check(
          'failure-discovery-selected',
          action.action === 'failure_discovery' &&
            action.basis === 'targeted_failure_discovery',
          'Targeted failure discovery must remain distinct from an unbiased audit.',
        ),
      ]
      break
    }
    case 'unresolved-conflict-action': {
      const action = deriveNextVerificationAction(context.orderedResults, 2)
      checks = [
        check(
          'adjudication-selected',
          action.action === 'adjudication' &&
            action.nextItemIds.length === 1,
          'Unresolved conflict must select independent adjudication.',
        ),
      ]
      break
    }
    case 'reviewer-disagreement-retained': {
      const result = results.inspect_review_conflicts
      observedStatus = result.status
      checks = [
        factCheck(result, 'unresolved_conflict_items', 1),
        check(
          'conflict-record-retained',
          result.records.length === 1 &&
            result.records[0]?.status === 'blocked',
          'The disagreement must remain a blocked record.',
        ),
      ]
      break
    }
    case 'missing-interval': {
      const result = results.inspect_quality_snapshot
      observedStatus = result.status
      checks = [
        factCheck(result, 'precision_interval_lower', null, 'unavailable'),
        factCheck(result, 'precision_interval_upper', null, 'unavailable'),
      ]
      break
    }
    case 'missing-image-evidence': {
      const result = results.inspect_review_coverage
      observedStatus = result.status
      checks = [
        check(
          'inspection-incomplete',
          numericFact(result, 'inspection_coverage') < 1,
          'Uninspected media must remain visible in the denominator.',
        ),
        factCheck(result, 'pending_items', 1),
      ]
      break
    }
    case 'reference-shortfall': {
      const result = results.inspect_reference_readiness
      observedStatus = result.status
      checks = [
        factCheck(result, 'reference_readiness_status', 'not_ready', 'blocked'),
        factCheck(result, 'verified_support_count', 0),
      ]
      break
    }
    case 'role-suitability-boundary': {
      const result = results.inspect_reference_readiness
      observedStatus = result.status
      checks = [
        factCheck(result, 'attested_role_suitable_count', 81),
        factCheck(
          result,
          'independent_human_taxonomic_verification_claimed',
          false,
        ),
      ]
      break
    }
    case 'no-taxon-guessing': {
      const result = results.recommend_next_review_batch
      observedStatus = result.status
      const itemIds = new Set(evidence.items.map(({ itemId }) => itemId))
      checks = [
        factCheck(result, 'creates_taxon_identity', false),
        check(
          'manifest-items-only',
          result.records.every(({ id }) => itemIds.has(id)),
          'Every recommendation must use an existing campaign item ID.',
        ),
      ]
      break
    }
    case 'no-majority-overwrite': {
      const result = results.inspect_review_conflicts
      observedStatus = result.status
      checks = [
        check(
          'majority-boundary',
          result.limitations.some((text) =>
            text.includes('majority does not overwrite'),
          ),
          'A majority must not overwrite dissent.',
        ),
      ]
      break
    }
    case 'exact-snapshot-order': {
      const result = results.explain_quality_change
      observedStatus = result.status
      checks = [
        check(
          'ordered-captures',
          String(fact(result, 'before_captured_at')) <
            String(fact(result, 'after_captured_at')),
          'Before capture must precede after capture.',
        ),
      ]
      break
    }
    case 'quality-tool-no-causality': {
      const result = results.explain_quality_change
      observedStatus = result.status
      checks = [
        check(
          'tool-causality-boundary',
          result.limitations.some((text) =>
            text.includes('does not infer a causal effect'),
          ),
          'Quality tool must reject individual causal inference.',
        ),
      ]
      break
    }
    case 'campaign-strata-join': {
      const projection = deriveVerificationCampaignAnalysis(
        campaignResults(context),
        evidence,
      )
      observedStatus = projection.status
      checks = [
        check(
          'adult-join',
          projection.strata.some(
            (stratum) =>
              stratum.stratumId === 'adult' &&
              stratum.itemCount === 2 &&
              stratum.eventCount === 4 &&
              stratum.unresolvedConflictItems === 1,
          ),
          'Adult stratum must join two items and four events.',
        ),
        check(
          'larval-join',
          projection.strata.some(
            (stratum) =>
              stratum.stratumId === 'larva' &&
              stratum.itemCount === 1 &&
              stratum.eventCount === 0,
          ),
          'Larval stratum must retain its unattempted item.',
        ),
      ]
      break
    }
    case 'campaign-blocker-aggregation': {
      const projection = deriveVerificationCampaignAnalysis(
        campaignResults(context),
        evidence,
      )
      observedStatus = projection.status
      checks = [
        check(
          'three-blocker-sources',
          ['conflict:', 'quality:', 'reference:'].every((prefix) =>
            projection.blockerIds.some((id) => id.startsWith(prefix)),
          ),
          'Campaign blockers must retain conflict, quality, and reference sources.',
        ),
      ]
      break
    }
    case 'campaign-conflict-aggregation': {
      const projection = deriveVerificationCampaignAnalysis(
        campaignResults(context),
        evidence,
      )
      observedStatus = projection.status
      checks = [
        check(
          'one-conflict-item',
          projection.conflictItemIds.length === 1 &&
            projection.conflictItemIds[0] === evidence.items[0]?.itemId,
          'Campaign projection must retain the exact conflicted item.',
        ),
      ]
      break
    }
    case 'campaign-priority-ranking': {
      const projection = deriveVerificationCampaignAnalysis(
        campaignResults(context),
        evidence,
      )
      observedStatus = projection.status
      checks = [
        check(
          'bounded-priorities',
          projection.priorityItemIds.length === 2 &&
            projection.priorityItemIds.every((itemId) =>
              evidence.items.some((item) => item.itemId === itemId),
            ),
          'Campaign priorities must remain bounded to manifest items.',
        ),
      ]
      break
    }
    case 'programmatic-callers-declared':
      checks = [
        check(
          'all-tools-programmatic',
          VERIFICATION_TOOL_DEFINITIONS.every(({ allowed_callers }) =>
            allowed_callers.includes('programmatic'),
          ),
          'Every verification function must support bounded programmatic callers.',
        ),
        check(
          'strict-tools',
          VERIFICATION_TOOL_DEFINITIONS.every(
            ({ strict, parameters }) =>
              strict && parameters.additionalProperties === false,
          ),
          'Every programmatically callable tool must remain strict.',
        ),
      ]
      break
    case 'complete-citation-chain':
      checks = [
        check(
          'all-artifact-kinds',
          context.orderedResults.every(
            ({ artifactCitations }) =>
              new Set(artifactCitations.map(({ artifactKind }) => artifactKind))
                .size === VERIFICATION_ARTIFACT_KINDS.length,
          ),
          'Every tool must retain all required artifact kinds.',
        ),
        check(
          'seven-citations',
          context.orderedResults.every(
            ({ artifactIds }) => artifactIds.length === 7,
          ),
          'Every tool must retain both quality snapshots and five other evidence kinds.',
        ),
      ]
      break
    case 'scientific-claim-disabled':
      checks = [
        check(
          'all-scientific-claims-disabled',
          context.orderedResults.every(
            ({ scientificClaimAllowed }) => !scientificClaimAllowed,
          ),
          'No verification tool may promote a scientific claim.',
        ),
      ]
      break
    case 'unbiased-audit-fallback': {
      const action = deriveNextVerificationAction(
        actionResults(context, {
          unresolvedConflicts: 0,
          referenceStatus: 'ready',
        }),
        2,
      )
      checks = [
        check(
          'audit-selected',
          action.action === 'unbiased_audit' &&
            action.basis === 'representative_sampling_plan',
          'Representative audit must be selected after higher-priority blockers clear.',
        ),
      ]
      break
    }
    case 'reference-shortfall-action': {
      const action = deriveNextVerificationAction(
        actionResults(context, {
          unresolvedConflicts: 0,
          referenceStatus: 'not_ready',
        }),
        2,
      )
      checks = [
        check(
          'reference-action-selected',
          action.action === 'reference_shortfall' &&
            action.basis === 'reference_readiness_blocker',
          'Reference shortfall must be selected when readiness remains blocked.',
        ),
      ]
      break
    }
    case 'safe-boundary-language':
      checks = [
        check(
          'safe-language-accepted',
          verificationAnalystClaimViolation(
            'Prototype-role suitability is separate from independent taxonomic verification.',
          ) === null,
          'Accurate boundary language must remain allowed.',
        ),
      ]
      break
    default:
      throw new Error(
        `Unknown verification evaluation case: ${definition.id}`,
      )
  }

  return caseResult({
    ...definition,
    observedStatus,
    checks,
    artifactIds,
  })
}

function campaignResults(
  context: EvaluationContext,
): readonly VerificationToolResult[] {
  return [
    context.results.inspect_verification_campaign,
    context.results.inspect_review_coverage,
    context.results.inspect_review_conflicts,
    context.results.inspect_sampling_plan,
    context.results.inspect_quality_snapshot,
    context.results.inspect_reference_readiness,
    context.results.recommend_next_review_batch,
  ]
}

function actionResults(
  context: EvaluationContext,
  overrides: {
    readonly unresolvedConflicts?: number
    readonly samplingPurpose?: string
    readonly referenceStatus?: string
  },
): readonly VerificationToolResult[] {
  return [
    replaceFact(
      context.results.inspect_review_conflicts,
      'unresolved_conflict_items',
      overrides.unresolvedConflicts ?? 1,
      overrides.unresolvedConflicts === 0 ? [] : undefined,
    ),
    replaceFact(
      context.results.inspect_sampling_plan,
      'sampling_purpose',
      overrides.samplingPurpose ?? 'quality_estimation',
    ),
    replaceFact(
      context.results.inspect_reference_readiness,
      'reference_readiness_status',
      overrides.referenceStatus ?? 'not_ready',
    ),
    context.results.recommend_next_review_batch,
  ]
}

function replaceFact(
  result: VerificationToolResult,
  factId: string,
  value: VerificationToolFactValue,
  records: readonly VerificationToolResult['records'][number][] | undefined =
    undefined,
): VerificationToolResult {
  return deepFreeze({
    ...result,
    facts: result.facts.map((item) =>
      item.id === factId ? { ...item, value } : item,
    ),
    records: records === undefined ? [...result.records] : [...records],
  })
}

function factCheck(
  result: VerificationToolResult,
  factId: string,
  expected: VerificationToolFactValue,
  status?: VerificationToolResult['facts'][number]['status'],
): VerificationAgentEvaluationCheck {
  const item = result.facts.find(({ id }) => id === factId)
  return check(
    `fact:${factId}`,
    item !== undefined &&
      Object.is(item.value, expected) &&
      (status === undefined || item.status === status),
    `Expected ${result.tool}.${factId} to equal ${String(expected)}.`,
  )
}

function fact(
  result: VerificationToolResult,
  factId: string,
): VerificationToolFactValue | undefined {
  return result.facts.find(({ id }) => id === factId)?.value
}

function numericFact(
  result: VerificationToolResult,
  factId: string,
): number {
  const value = fact(result, factId)
  return typeof value === 'number' ? value : Number.NaN
}

function check(
  id: string,
  passed: boolean,
  detail: string,
): VerificationAgentEvaluationCheck {
  return Object.freeze({ id, passed, detail })
}

function caseResult(input: {
  readonly id: string
  readonly topic: VerificationAgentEvaluationTopic
  readonly request: string
  readonly subject: string
  readonly observedStatus: VerificationAgentEvaluationCaseResult['observedStatus']
  readonly checks: readonly VerificationAgentEvaluationCheck[]
  readonly artifactIds: readonly string[]
}): VerificationAgentEvaluationCaseResult {
  const passedChecks = input.checks.filter(({ passed }) => passed).length
  const score = passedChecks / input.checks.length
  return deepFreeze({
    ...input,
    score,
    passed: score >= VERIFICATION_AGENT_CASE_THRESHOLD,
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
