import type { ReplayArtifactEvidence, ReplayEvidence } from '../data/evidenceFacade'
import {
  RESEARCH_ANALYST_MODEL,
  type ResearchAnalystRequestKind,
  type ResearchAnalystRun,
} from './researchAnalystContract'
import type { ResearchToolResult } from './researchTools'

export const PUBLIC_AGENT_TRACE_VERSION = 'taxalens-public-agent-trace:v1.0.0' as const

export type PublicAgentTraceMode = 'live' | 'stored_replay'

export interface PublicAgentTraceTool {
  readonly sequence: number
  readonly callId: string
  readonly name: string
  readonly arguments: Readonly<Record<string, unknown>>
  readonly result: ResearchToolResult
  readonly artifactIds: readonly string[]
}

export interface PublicAgentTrace {
  readonly schemaVersion: typeof PUBLIC_AGENT_TRACE_VERSION
  readonly mode: PublicAgentTraceMode
  readonly model: typeof RESEARCH_ANALYST_MODEL
  readonly reasoningEffort: 'medium' | 'high'
  readonly responseStatus: 'completed'
  readonly request: {
    readonly kind: ResearchAnalystRequestKind
    readonly text: string
  }
  readonly plan: ResearchAnalystRun['output']['plan']
  readonly tools: readonly PublicAgentTraceTool[]
  readonly artifacts: readonly ReplayArtifactEvidence[]
  readonly structuredOutput: ResearchAnalystRun['output']
  readonly answer: string
  readonly budgets: ResearchAnalystRun['budget']
  readonly responseIds: readonly string[]
  readonly privacy: {
    readonly rawResponseItemsCollected: false
    readonly privateReasoningCollected: false
    readonly chainOfThoughtAvailable: false
    readonly statement: string
  }
}

export class PublicAgentTraceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PublicAgentTraceError'
  }
}

export function buildPublicAgentTrace(
  input: {
    readonly mode: PublicAgentTraceMode
    readonly requestKind: ResearchAnalystRequestKind
    readonly request: string
    readonly run: ResearchAnalystRun
  },
  replay: ReplayEvidence,
): PublicAgentTrace {
  const request = input.request.trim()
  if (request.length === 0 || request.length > 8_000) {
    throw new PublicAgentTraceError('Public trace request must contain 1 to 8,000 characters')
  }
  if (
    input.run.model !== RESEARCH_ANALYST_MODEL ||
    input.run.responseStatus !== 'completed' ||
    input.run.output.requestKind !== input.requestKind ||
    input.run.output.target.acceptedTaxonKey !== replay.target.acceptedTaxonKey ||
    input.run.output.target.scientificName !== replay.target.scientificName
  ) {
    throw new PublicAgentTraceError('Analyst run does not match the verified replay context')
  }
  if (
    input.run.toolReceipts.length !== input.run.toolResults.length ||
    input.run.budget.usedToolCalls !== input.run.toolReceipts.length ||
    input.run.budget.usedResponseTurns !== input.run.responseIds.length ||
    input.run.budget.exhausted
  ) {
    throw new PublicAgentTraceError('Analyst run budget and trace counts do not agree')
  }

  const inventory = new Map(
    replay.artifactInventory.map((artifact) => [artifact.artifactId, artifact] as const),
  )
  const tools = input.run.toolReceipts.map((receipt, index) => {
    const result = input.run.toolResults[index]
    if (
      result === undefined ||
      receipt.sequence !== index + 1 ||
      receipt.tool !== result.tool ||
      receipt.resultStatus !== result.status ||
      !sameSet(receipt.artifactIds, result.artifactIds)
    ) {
      throw new PublicAgentTraceError(`Tool receipt ${receipt.sequence} does not match its result`)
    }
    const resultArtifactIds = uniqueSorted([
      ...result.artifactIds,
      ...result.records.flatMap(({ artifactIds }) => artifactIds),
    ])
    assertVerifiedArtifactIds(resultArtifactIds, inventory, `tool ${result.tool}`)
    return {
      sequence: receipt.sequence,
      callId: receipt.callId,
      name: receipt.tool,
      arguments: { ...receipt.arguments },
      result,
      artifactIds: resultArtifactIds,
    }
  })

  const outputArtifactIds = uniqueSorted([
    ...input.run.output.artifactIds,
    ...input.run.output.plan.flatMap(({ artifactIds }) => artifactIds),
    ...input.run.output.evidenceBackedClaims.flatMap(({ artifactIds }) => artifactIds),
    ...input.run.output.unavailableEvidence.flatMap(({ artifactIds }) => artifactIds),
    ...input.run.output.approvalBoundary.items.flatMap(({ artifactIds }) => artifactIds),
  ])
  assertVerifiedArtifactIds(
    outputArtifactIds,
    inventory,
    'final structured output',
  )
  const artifactIds = uniqueSorted([
    ...tools.flatMap(({ artifactIds }) => artifactIds),
    ...outputArtifactIds,
  ])
  const artifacts = artifactIds.map((artifactId) => {
    const artifact = inventory.get(artifactId)
    if (artifact === undefined) {
      throw new PublicAgentTraceError(`Public trace references unknown artifact ${artifactId}`)
    }
    return artifact
  })

  return deepFreeze({
    schemaVersion: PUBLIC_AGENT_TRACE_VERSION,
    mode: input.mode,
    model: RESEARCH_ANALYST_MODEL,
    reasoningEffort: input.run.reasoningEffort,
    responseStatus: 'completed' as const,
    request: {
      kind: input.requestKind,
      text: request,
    },
    plan: input.run.output.plan,
    tools,
    artifacts,
    structuredOutput: input.run.output,
    answer: input.run.output.answer,
    budgets: input.run.budget,
    responseIds: [...input.run.responseIds],
    privacy: {
      rawResponseItemsCollected: false as const,
      privateReasoningCollected: false as const,
      chainOfThoughtAvailable: false as const,
      statement:
        'Only the public request, public plan, validated tool exchange, structured output, answer, and measured budgets are retained.',
    },
  })
}

function assertVerifiedArtifactIds(
  artifactIds: readonly string[],
  inventory: ReadonlyMap<string, ReplayArtifactEvidence>,
  label: string,
): void {
  if (
    artifactIds.length === 0 ||
    artifactIds.some((artifactId) => inventory.get(artifactId)?.verified !== true)
  ) {
    throw new PublicAgentTraceError(`${label} lacks complete verified artifact citations`)
  }
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  const leftSorted = uniqueSorted(left)
  const rightSorted = uniqueSorted(right)
  return (
    leftSorted.length === rightSorted.length &&
    leftSorted.every((value, index) => value === rightSorted[index])
  )
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort((left, right) => left.localeCompare(right)))
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
