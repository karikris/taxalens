import Ajv2020, { type ErrorObject } from 'ajv/dist/2020.js'
import type {
  FunctionTool,
  ResponseCreateParamsNonStreaming,
  ResponseFunctionToolCall,
  ResponseInput,
  ResponseInputItem,
  ResponseOutputItem,
  ResponseStatus,
  ResponseUsage,
} from 'openai/resources/responses/responses'

import { canonicalExportJsonBytes } from '../evidence/evidenceExport'
import {
  VERIFICATION_TOOL_DEFINITIONS,
  executeVerificationTool,
  type VerificationArtifactCitation,
  type VerificationToolEvidence,
  type VerificationToolName,
  type VerificationToolResult,
} from './verificationTools'
import {
  VERIFICATION_ANALYST_MODEL,
  VERIFICATION_ANALYST_OUTPUT_SCHEMA,
  VERIFICATION_ANALYST_RUN_VERSION,
  type VerificationActionBasis,
  type VerificationActionKind,
  type VerificationAnalystBudgetLimits,
  type VerificationAnalystInput,
  type VerificationAnalystOutput,
  type VerificationAnalystReasoningEffort,
  type VerificationAnalystRun,
  type VerificationAnalystToolReceipt,
} from './verificationAnalystContract'

const DEFAULT_BUDGET: VerificationAnalystBudgetLimits = Object.freeze({
  maxToolCalls: 6,
  maxResponseTurns: 7,
})
const MAX_TOOL_CALLS = 8
const MAX_RESPONSE_TURNS = 10
const MAX_REQUEST_LENGTH = 8_000
const MAX_OUTPUT_TOKENS = 8_000
const MAX_BATCH_SIZE = 50
const MAX_ARTIFACT_CITATIONS = 64

const REQUIRED_NEXT_ACTION_TOOLS = Object.freeze([
  'inspect_verification_campaign',
  'inspect_review_conflicts',
  'inspect_sampling_plan',
  'inspect_reference_readiness',
  'recommend_next_review_batch',
] as const satisfies readonly VerificationToolName[])

const BASE_INSTRUCTIONS = `You are the TaxaLens verification analyst. Explain the next best human verification action from checksum-verified campaign evidence only.

Policy:
- Use every supplied read-only tool exactly once before answering.
- The first tool call must inspect the exact verification campaign.
- Never guess a taxon, item ID, snapshot digest, artifact ID, reviewer decision, or missing metric.
- Preserve unresolved reviewer disagreement. Never turn a majority into adjudication or overwrite dissent.
- Distinguish an unbiased audit, targeted failure discovery, reference shortfall work, and independent adjudication.
- The deterministic TaxaLens policy selects the action and exact item IDs. Explain that selection; do not replace it.
- Describe the action as addressing recorded evidence or blockers. Do not promise that it will improve accuracy, guarantee release, prove taxonomic correctness, or cause a metric change.
- BioMiner prototype-role suitability is not independent human taxonomic verification.
- Missing evidence is unavailable or unknown, never proof of absence.
- Execute no review, write, download, inference, adjudication, publication, or other external action.
- Every recommendation, claim, and unavailable-evidence item must cite artifact IDs returned by tools in this run.
- Return only the strict structured output. Do not reveal chain-of-thought or hidden reasoning.`

export interface VerificationAnalystTransportResponse {
  readonly id: string
  readonly model: string
  readonly status: ResponseStatus
  readonly output: readonly ResponseOutputItem[]
  readonly output_text: string
  readonly usage: ResponseUsage | null
}

export interface VerificationAnalystResponsesTransport {
  create(
    request: ResponseCreateParamsNonStreaming,
  ): Promise<VerificationAnalystTransportResponse>
}

export type VerificationAnalystToolExecutor = (
  name: string,
  args: unknown,
  evidence: VerificationToolEvidence,
) => VerificationToolResult | Promise<VerificationToolResult>

export type VerificationAnalystErrorCode =
  | 'invalid_input'
  | 'invalid_model_output'
  | 'invalid_response'
  | 'invalid_tool_call'
  | 'model_refusal'
  | 'response_budget_exceeded'
  | 'tool_budget_exceeded'

export class VerificationAnalystError extends Error {
  readonly code: VerificationAnalystErrorCode

  constructor(code: VerificationAnalystErrorCode, message: string) {
    super(message)
    this.name = 'VerificationAnalystError'
    this.code = code
  }
}

interface DeterministicRecommendation {
  readonly action: VerificationActionKind
  readonly basis: VerificationActionBasis
  readonly nextItemIds: readonly string[]
}

const ajv = new Ajv2020({ allErrors: true, strict: true })
const validateAnalystOutput = ajv.compile(VERIFICATION_ANALYST_OUTPUT_SCHEMA)
const decoder = new TextDecoder()

export async function runVerificationAnalyst(
  input: VerificationAnalystInput,
  evidence: VerificationToolEvidence,
  transport: VerificationAnalystResponsesTransport,
  executeTool: VerificationAnalystToolExecutor = executeVerificationTool,
): Promise<VerificationAnalystRun> {
  const validated = validateInput(input, evidence)
  const budget = validateBudget(input.budget)
  const reasoningEffort = input.reasoningEffort ?? 'medium'
  const conversation: ResponseInput = [
    {
      role: 'user',
      content: JSON.stringify({
        requestKind: input.requestKind,
        request: validated.request,
        campaignId: evidence.campaign.campaignId,
        campaignTitle: evidence.campaign.title,
        target: evidence.campaign.targetTaxon,
        snapshotSha256: validated.snapshotSha256,
        batchSize: validated.batchSize,
        toolBudget: budget,
      }),
    },
  ]
  const responseIds: string[] = []
  const toolReceipts: VerificationAnalystToolReceipt[] = []
  const toolResults: VerificationToolResult[] = []

  while (responseIds.length < budget.maxResponseTurns) {
    const response = await transport.create(
      buildVerificationResponsesRequest(
        conversation,
        evidence,
        budget,
        reasoningEffort,
      ),
    )
    validateResponseEnvelope(response, responseIds)
    responseIds.push(response.id)

    const calls = response.output.filter(
      (item): item is ResponseFunctionToolCall => item.type === 'function_call',
    )
    if (calls.length === 0) {
      const output = parseAndValidateOutput(
        response,
        input,
        evidence,
        toolReceipts,
        toolResults,
      )
      return deepFreeze({
        schemaVersion: VERIFICATION_ANALYST_RUN_VERSION,
        model: VERIFICATION_ANALYST_MODEL,
        reasoningEffort,
        responseStatus: 'completed' as const,
        output,
        budget: {
          maxToolCalls: budget.maxToolCalls,
          usedToolCalls: toolReceipts.length,
          maxResponseTurns: budget.maxResponseTurns,
          usedResponseTurns: responseIds.length,
          exhausted: false as const,
        },
        toolReceipts: [...toolReceipts],
        toolResults: [...toolResults],
        responseIds: [...responseIds],
      })
    }

    if (calls.length !== 1) {
      throw new VerificationAnalystError(
        'invalid_tool_call',
        'Exactly one direct verification function call is allowed per response turn',
      )
    }
    if (toolReceipts.length >= budget.maxToolCalls) {
      throw new VerificationAnalystError(
        'tool_budget_exceeded',
        `The verification analyst exceeded its ${budget.maxToolCalls}-call tool budget`,
      )
    }

    const call = calls[0]!
    if (
      call.caller !== undefined &&
      call.caller !== null &&
      call.caller.type !== 'direct'
    ) {
      throw new VerificationAnalystError(
        'invalid_tool_call',
        'Programmatic Tool Calling is not enabled for next-review-action analysis',
      )
    }
    if (toolReceipts.some(({ callId }) => callId === call.call_id)) {
      throw new VerificationAnalystError(
        'invalid_tool_call',
        `Duplicate call_id: ${call.call_id}`,
      )
    }
    if (
      toolReceipts.some(({ tool }) => tool === call.name) ||
      !isRequiredNextActionTool(call.name)
    ) {
      throw new VerificationAnalystError(
        'invalid_tool_call',
        `Unexpected or repeated next-action tool: ${call.name}`,
      )
    }
    if (
      toolReceipts.length === 0 &&
      call.name !== 'inspect_verification_campaign'
    ) {
      throw new VerificationAnalystError(
        'invalid_tool_call',
        'The first verification tool call must inspect the exact campaign',
      )
    }

    const args = parseToolArguments(call)
    validateToolCallBinding(
      call.name,
      args,
      evidence,
      validated.snapshotSha256,
      validated.batchSize,
    )
    let toolResult: VerificationToolResult
    try {
      toolResult = await executeTool(call.name, args, evidence)
    } catch (error) {
      throw new VerificationAnalystError(
        'invalid_tool_call',
        `${call.name} could not execute: ${errorMessage(error)}`,
      )
    }
    validateToolResult(call.name, toolResult, evidence)

    toolResults.push(toolResult)
    toolReceipts.push(
      deepFreeze({
        sequence: toolReceipts.length + 1,
        callId: call.call_id,
        tool: toolResult.tool,
        arguments: args,
        caller: 'direct' as const,
        resultStatus: toolResult.status,
        artifactIds: [...toolResult.artifactIds],
      }),
    )
    conversation.push(...continuationItems(response.output))
    conversation.push({
      type: 'function_call_output',
      call_id: call.call_id,
      caller: { type: 'direct' },
      output: decoder.decode(canonicalExportJsonBytes(toolResult)),
    })
  }

  throw new VerificationAnalystError(
    'response_budget_exceeded',
    `The verification analyst exceeded its ${budget.maxResponseTurns}-turn response budget`,
  )
}

export function buildVerificationResponsesRequest(
  input: ResponseInput,
  evidence: VerificationToolEvidence,
  budget: VerificationAnalystBudgetLimits,
  reasoningEffort: VerificationAnalystReasoningEffort,
): ResponseCreateParamsNonStreaming {
  return {
    model: VERIFICATION_ANALYST_MODEL,
    reasoning: {
      effort: reasoningEffort,
      mode: 'standard',
    },
    store: false,
    stream: false,
    include: ['reasoning.encrypted_content'],
    parallel_tool_calls: false,
    tool_choice: 'auto',
    max_output_tokens: MAX_OUTPUT_TOKENS,
    instructions: `${BASE_INSTRUCTIONS}\n\nExact campaign: ${evidence.campaign.campaignId}. Maximum tool calls: ${budget.maxToolCalls}. Maximum response turns: ${budget.maxResponseTurns}.`,
    input: [...input],
    tools: responseTools(),
    text: {
      verbosity: 'medium',
      format: {
        type: 'json_schema',
        name: 'taxalens_verification_analyst_output',
        description:
          'Artifact-cited explanation of the deterministic next human verification action.',
        strict: true,
        schema: mutableJsonObject(VERIFICATION_ANALYST_OUTPUT_SCHEMA),
      },
    },
  }
}

export function deriveNextVerificationAction(
  toolResults: readonly VerificationToolResult[],
  batchSize: number,
): DeterministicRecommendation {
  const conflicts = requiredToolResult(
    toolResults,
    'inspect_review_conflicts',
  )
  const sampling = requiredToolResult(toolResults, 'inspect_sampling_plan')
  const references = requiredToolResult(
    toolResults,
    'inspect_reference_readiness',
  )
  const batch = requiredToolResult(
    toolResults,
    'recommend_next_review_batch',
  )
  const unresolvedConflicts = numericFact(
    conflicts,
    'unresolved_conflict_items',
  )
  const samplingPurpose = stringFact(sampling, 'sampling_purpose')
  const referenceStatus = stringFact(
    references,
    'reference_readiness_status',
  )

  if (unresolvedConflicts > 0 || samplingPurpose === 'adjudication') {
    return deepFreeze({
      action: 'adjudication',
      basis: 'unresolved_review_conflict',
      nextItemIds: conflicts.records
        .filter(({ status }) => status === 'blocked')
        .slice(0, batchSize)
        .map(({ id }) => id),
    })
  }
  if (
    samplingPurpose === 'failure_discovery' ||
    samplingPurpose === 'reviewer_quality_control'
  ) {
    return deepFreeze({
      action: 'failure_discovery',
      basis: 'targeted_failure_discovery',
      nextItemIds: batch.records.map(({ id }) => id),
    })
  }
  if (
    samplingPurpose === 'reference_readiness' ||
    referenceStatus === 'not_ready'
  ) {
    return deepFreeze({
      action: 'reference_shortfall',
      basis: 'reference_readiness_blocker',
      nextItemIds: batch.records.map(({ id }) => id),
    })
  }
  return deepFreeze({
    action: 'unbiased_audit',
    basis: 'representative_sampling_plan',
    nextItemIds: batch.records.map(({ id }) => id),
  })
}

function responseTools(): FunctionTool[] {
  return VERIFICATION_TOOL_DEFINITIONS.filter(({ name }) =>
    isRequiredNextActionTool(name),
  ).map((tool) => ({
    type: 'function',
    name: tool.name,
    description: tool.description,
    strict: tool.strict,
    parameters: mutableJsonObject(tool.parameters),
    output_schema: mutableJsonObject(tool.output_schema),
    allowed_callers: ['direct'],
  }))
}

function validateInput(
  input: VerificationAnalystInput,
  evidence: VerificationToolEvidence,
): {
  readonly request: string
  readonly snapshotSha256: string
  readonly batchSize: number
} {
  if (input.requestKind !== 'next_review_action') {
    throw new VerificationAnalystError(
      'invalid_input',
      'Unknown verification analyst request kind',
    )
  }
  if (
    input.reasoningEffort !== undefined &&
    input.reasoningEffort !== 'medium' &&
    input.reasoningEffort !== 'high'
  ) {
    throw new VerificationAnalystError(
      'invalid_input',
      'Reasoning effort must be medium or high',
    )
  }
  const request = input.request.trim()
  if (request.length === 0 || request.length > MAX_REQUEST_LENGTH) {
    throw new VerificationAnalystError(
      'invalid_input',
      `Natural-language request length must be between 1 and ${MAX_REQUEST_LENGTH}`,
    )
  }
  const snapshotSha256 = input.snapshotSha256.trim()
  if (!/^[a-f0-9]{64}$/u.test(snapshotSha256)) {
    throw new VerificationAnalystError(
      'invalid_input',
      'snapshotSha256 must be an exact lowercase SHA-256 digest',
    )
  }
  if (
    !evidence.qualitySnapshots.some(
      ({ snapshotSha256: digest }) => digest === snapshotSha256,
    )
  ) {
    throw new VerificationAnalystError(
      'invalid_input',
      'snapshotSha256 is not present in the immutable verification evidence',
    )
  }
  const batchSize = input.batchSize ?? 5
  if (
    !Number.isInteger(batchSize) ||
    batchSize < 1 ||
    batchSize > MAX_BATCH_SIZE
  ) {
    throw new VerificationAnalystError(
      'invalid_input',
      `batchSize must be an integer between 1 and ${MAX_BATCH_SIZE}`,
    )
  }
  return Object.freeze({ request, snapshotSha256, batchSize })
}

function validateBudget(
  input: Partial<VerificationAnalystBudgetLimits> | undefined,
): VerificationAnalystBudgetLimits {
  const maxToolCalls = input?.maxToolCalls ?? DEFAULT_BUDGET.maxToolCalls
  const maxResponseTurns =
    input?.maxResponseTurns ?? DEFAULT_BUDGET.maxResponseTurns
  if (
    !Number.isInteger(maxToolCalls) ||
    maxToolCalls < REQUIRED_NEXT_ACTION_TOOLS.length ||
    maxToolCalls > MAX_TOOL_CALLS
  ) {
    throw new VerificationAnalystError(
      'invalid_input',
      `maxToolCalls must be an integer between ${REQUIRED_NEXT_ACTION_TOOLS.length} and ${MAX_TOOL_CALLS}`,
    )
  }
  if (
    !Number.isInteger(maxResponseTurns) ||
    maxResponseTurns < REQUIRED_NEXT_ACTION_TOOLS.length + 1 ||
    maxResponseTurns > MAX_RESPONSE_TURNS
  ) {
    throw new VerificationAnalystError(
      'invalid_input',
      `maxResponseTurns must be an integer between ${REQUIRED_NEXT_ACTION_TOOLS.length + 1} and ${MAX_RESPONSE_TURNS}`,
    )
  }
  return Object.freeze({ maxToolCalls, maxResponseTurns })
}

function validateResponseEnvelope(
  response: VerificationAnalystTransportResponse,
  priorResponseIds: readonly string[],
): void {
  if (response.model !== VERIFICATION_ANALYST_MODEL) {
    throw new VerificationAnalystError(
      'invalid_response',
      `Expected ${VERIFICATION_ANALYST_MODEL}, received ${response.model}`,
    )
  }
  if (response.status !== 'completed') {
    throw new VerificationAnalystError(
      'invalid_response',
      `Responses API returned ${response.status}`,
    )
  }
  if (response.id.trim().length === 0 || priorResponseIds.includes(response.id)) {
    throw new VerificationAnalystError(
      'invalid_response',
      'Response IDs must be non-empty and unique',
    )
  }
  const refusal = response.output
    .filter((item) => item.type === 'message')
    .flatMap(({ content }) => content)
    .find((content) => content.type === 'refusal')
  if (refusal?.type === 'refusal') {
    throw new VerificationAnalystError('model_refusal', refusal.refusal)
  }
}

function parseToolArguments(
  call: ResponseFunctionToolCall,
): Readonly<Record<string, unknown>> {
  let value: unknown
  try {
    value = JSON.parse(call.arguments) as unknown
  } catch {
    throw new VerificationAnalystError(
      'invalid_tool_call',
      `${call.name} arguments are not valid JSON`,
    )
  }
  if (!isRecord(value)) {
    throw new VerificationAnalystError(
      'invalid_tool_call',
      `${call.name} arguments must be an object`,
    )
  }
  return deepFreeze({ ...value })
}

function validateToolCallBinding(
  name: VerificationToolName,
  args: Readonly<Record<string, unknown>>,
  evidence: VerificationToolEvidence,
  snapshotSha256: string,
  batchSize: number,
): void {
  if (args.campaign_id !== evidence.campaign.campaignId) {
    throw new VerificationAnalystError(
      'invalid_tool_call',
      `${name} must use the exact committed campaign ID`,
    )
  }
  if (
    name === 'inspect_reference_readiness' &&
    args.snapshot_sha256 !== snapshotSha256
  ) {
    throw new VerificationAnalystError(
      'invalid_tool_call',
      'Reference readiness must inspect the exact requested quality snapshot',
    )
  }
  if (
    name === 'recommend_next_review_batch' &&
    args.batch_size !== batchSize
  ) {
    throw new VerificationAnalystError(
      'invalid_tool_call',
      'The next-review batch must use the exact requested batch size',
    )
  }
}

function validateToolResult(
  name: VerificationToolName,
  result: VerificationToolResult,
  evidence: VerificationToolEvidence,
): void {
  if (
    result.tool !== name ||
    result.campaignId !== evidence.campaign.campaignId ||
    result.scientificClaimAllowed !== false
  ) {
    throw new VerificationAnalystError(
      'invalid_tool_call',
      `${name} returned a result outside the verification evidence boundary`,
    )
  }
  const resultIds = result.artifactCitations.map(({ artifactId }) => artifactId)
  if (
    !sameOrderedValues(result.artifactIds, resultIds) ||
    result.artifactCitations.some(
      (citation) => !evidenceHasCitation(evidence, citation),
    )
  ) {
    throw new VerificationAnalystError(
      'invalid_tool_call',
      `${name} returned an invalid verification artifact citation chain`,
    )
  }
}

function continuationItems(
  output: readonly ResponseOutputItem[],
): ResponseInputItem[] {
  const items: ResponseInputItem[] = []
  for (const item of output) {
    switch (item.type) {
      case 'reasoning':
      case 'function_call':
      case 'message':
        items.push(item)
        break
      default:
        throw new VerificationAnalystError(
          'invalid_response',
          `Unexpected Responses output item for next-action analysis: ${item.type}`,
        )
    }
  }
  return items
}

function parseAndValidateOutput(
  response: VerificationAnalystTransportResponse,
  input: VerificationAnalystInput,
  evidence: VerificationToolEvidence,
  receipts: readonly VerificationAnalystToolReceipt[],
  toolResults: readonly VerificationToolResult[],
): VerificationAnalystOutput {
  const calledTools = receipts.map(({ tool }) => tool)
  if (!sameSet(calledTools, REQUIRED_NEXT_ACTION_TOOLS)) {
    throw new VerificationAnalystError(
      'invalid_model_output',
      'A final answer requires every next-action verification tool exactly once',
    )
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(response.output_text) as unknown
  } catch {
    throw new VerificationAnalystError(
      'invalid_model_output',
      'The final Responses output is not valid JSON',
    )
  }
  if (!validateAnalystOutput(parsed)) {
    throw new VerificationAnalystError(
      'invalid_model_output',
      `The final structured output is invalid: ${formatValidationErrors(validateAnalystOutput.errors)}`,
    )
  }
  const output = parsed as VerificationAnalystOutput
  validateOutputBounds(output)
  if (output.requestKind !== input.requestKind) {
    throw new VerificationAnalystError(
      'invalid_model_output',
      'Request kind changed in model output',
    )
  }
  if (
    output.campaign.campaignId !== evidence.campaign.campaignId ||
    output.campaign.title !== evidence.campaign.title ||
    !sameTarget(output.campaign.target, evidence.campaign.targetTaxon)
  ) {
    throw new VerificationAnalystError(
      'invalid_model_output',
      'Model output guessed or changed the immutable campaign target',
    )
  }
  const deterministic = deriveNextVerificationAction(
    toolResults,
    input.batchSize ?? 5,
  )
  if (
    output.recommendation.action !== deterministic.action ||
    output.recommendation.basis !== deterministic.basis ||
    !sameOrderedValues(
      output.recommendation.nextItemIds,
      deterministic.nextItemIds,
    )
  ) {
    throw new VerificationAnalystError(
      'invalid_model_output',
      'Model output replaced the deterministic next-action recommendation',
    )
  }
  const itemIds = new Set(evidence.items.map(({ itemId }) => itemId))
  if (
    output.recommendation.nextItemIds.some((itemId) => !itemIds.has(itemId))
  ) {
    throw new VerificationAnalystError(
      'invalid_model_output',
      'Model output invented an item identity outside the campaign manifest',
    )
  }
  if (
    output.evidenceBackedClaims.length +
      output.unavailableEvidence.length ===
    0
  ) {
    throw new VerificationAnalystError(
      'invalid_model_output',
      'The answer must expose at least one evidence-backed claim or unavailable-evidence item',
    )
  }
  rejectUnsupportedClaims(output)
  validateCitations(output, toolResults)
  return deepFreeze(output)
}

function validateOutputBounds(output: VerificationAnalystOutput): void {
  const invalid =
    output.recommendation.nextItemIds.length > MAX_BATCH_SIZE ||
    output.evidenceBackedClaims.length > 24 ||
    output.unavailableEvidence.length > 24 ||
    output.limitations.length > 16 ||
    !boundedText(output.campaign.campaignId, 160) ||
    !boundedText(output.campaign.title, 300) ||
    !boundedText(output.recommendation.why, 2_000) ||
    !boundedText(output.answer, 8_000) ||
    !boundedArtifactIds(output.recommendation.artifactIds) ||
    !boundedArtifactIds(output.artifactIds) ||
    new Set(output.recommendation.nextItemIds).size !==
      output.recommendation.nextItemIds.length ||
    output.recommendation.nextItemIds.some(
      (itemId) => !boundedText(itemId, 160),
    ) ||
    output.evidenceBackedClaims.some(
      (claim) =>
        !boundedText(claim.id, 120) ||
        !boundedText(claim.claim, 1_200) ||
        !boundedArtifactIds(claim.artifactIds),
    ) ||
    output.unavailableEvidence.some(
      (item) =>
        !boundedText(item.topic, 240) ||
        !boundedText(item.reason, 1_200) ||
        !boundedArtifactIds(item.artifactIds),
    ) ||
    output.limitations.some((item) => !boundedText(item, 1_200))
  if (invalid) {
    throw new VerificationAnalystError(
      'invalid_model_output',
      'The final output exceeds the bounded verification analyst contract',
    )
  }
}

function rejectUnsupportedClaims(output: VerificationAnalystOutput): void {
  const text = [
    output.recommendation.why,
    output.answer,
    ...output.evidenceBackedClaims.map(({ claim }) => claim),
    ...output.unavailableEvidence.map(({ reason }) => reason),
  ].join(' ')
  const forbidden: readonly RegExp[] = [
    /\bguarantee(?:d|s)?\b/iu,
    /\bprove(?:d|s)?\b.{0,80}\b(?:accuracy|correctness|quality)\b/iu,
    /\b(?:accuracy|precision|quality)\b.{0,80}\bwill improve\b/iu,
    /\b(?:release[- ]ready|approved for (?:scientific )?release)\b/iu,
    /\bindependent(?:ly)? human taxonomic(?:ally)? verified\b/iu,
  ]
  if (forbidden.some((pattern) => pattern.test(text))) {
    throw new VerificationAnalystError(
      'invalid_model_output',
      'The answer contains an unsupported guarantee, release, or verification claim',
    )
  }
}

function validateCitations(
  output: VerificationAnalystOutput,
  toolResults: readonly VerificationToolResult[],
): void {
  const returnedIds = uniqueSorted(
    toolResults.flatMap(({ artifactIds }) => artifactIds),
  )
  const outputIds = uniqueSorted(output.artifactIds)
  if (!sameOrderedValues(outputIds, returnedIds)) {
    throw new VerificationAnalystError(
      'invalid_model_output',
      'Top-level artifactIds must exactly cover the evidence returned by required tools',
    )
  }
  if (
    !sameOrderedValues(
      uniqueSorted(output.recommendation.artifactIds),
      returnedIds,
    )
  ) {
    throw new VerificationAnalystError(
      'invalid_model_output',
      'The deterministic recommendation must cite the complete returned evidence chain',
    )
  }
  const nested = [
    ...output.evidenceBackedClaims.flatMap(({ artifactIds }) => artifactIds),
    ...output.unavailableEvidence.flatMap(({ artifactIds }) => artifactIds),
  ]
  const invalid = nested.filter((artifactId) => !returnedIds.includes(artifactId))
  if (invalid.length > 0) {
    throw new VerificationAnalystError(
      'invalid_model_output',
      `Model output cites artifacts not returned by tools in this run: ${uniqueSorted(invalid).join(', ')}`,
    )
  }
}

function requiredToolResult(
  results: readonly VerificationToolResult[],
  name: VerificationToolName,
): VerificationToolResult {
  const matches = results.filter(({ tool }) => tool === name)
  if (matches.length !== 1) {
    throw new VerificationAnalystError(
      'invalid_model_output',
      `Deterministic action policy requires exactly one ${name} result`,
    )
  }
  return matches[0]!
}

function numericFact(result: VerificationToolResult, id: string): number {
  const value = result.facts.find((fact) => fact.id === id)?.value
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new VerificationAnalystError(
      'invalid_model_output',
      `${result.tool} is missing numeric fact ${id}`,
    )
  }
  return value
}

function stringFact(result: VerificationToolResult, id: string): string {
  const value = result.facts.find((fact) => fact.id === id)?.value
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new VerificationAnalystError(
      'invalid_model_output',
      `${result.tool} is missing string fact ${id}`,
    )
  }
  return value
}

function evidenceHasCitation(
  evidence: VerificationToolEvidence,
  citation: VerificationArtifactCitation,
): boolean {
  return evidence.artifactCitations.some(
    (candidate) =>
      candidate.schemaVersion === citation.schemaVersion &&
      candidate.artifactKind === citation.artifactKind &&
      candidate.artifactId === citation.artifactId &&
      candidate.sha256 === citation.sha256 &&
      candidate.sourceRepository === citation.sourceRepository &&
      candidate.sourceCommit === citation.sourceCommit &&
      candidate.sourcePath === citation.sourcePath,
  )
}

function sameTarget(
  output: VerificationAnalystOutput['campaign']['target'],
  target: VerificationToolEvidence['campaign']['targetTaxon'],
): boolean {
  if (output === null || target === null) {
    return output === null && target === null
  }
  return (
    output.acceptedTaxonKey === target.acceptedTaxonKey &&
    output.scientificName === target.scientificName
  )
}

function isRequiredNextActionTool(
  value: string,
): value is (typeof REQUIRED_NEXT_ACTION_TOOLS)[number] {
  return (REQUIRED_NEXT_ACTION_TOOLS as readonly string[]).includes(value)
}

function mutableJsonObject(value: unknown): Record<string, unknown> {
  const converted = mutableJson(value)
  if (!isRecord(converted)) {
    throw new VerificationAnalystError(
      'invalid_input',
      'Expected a JSON Schema object',
    )
  }
  return { ...converted }
}

function mutableJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => mutableJson(item))
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, mutableJson(child)]),
    )
  }
  return value
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function formatValidationErrors(
  errors: readonly ErrorObject[] | null | undefined,
): string {
  if (errors === undefined || errors === null || errors.length === 0) {
    return 'validation failed'
  }
  return errors
    .map((error) => `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`)
    .join('; ')
}

function boundedArtifactIds(values: readonly string[]): boolean {
  return (
    values.length > 0 &&
    values.length <= MAX_ARTIFACT_CITATIONS &&
    new Set(values).size === values.length &&
    values.every((value) => boundedText(value, 160))
  )
}

function boundedText(value: string, maximum: number): boolean {
  return value.trim().length > 0 && value.length <= maximum
}

function sameSet<T>(left: readonly T[], right: readonly T[]): boolean {
  return (
    left.length === right.length &&
    new Set(left).size === left.length &&
    left.every((value) => right.includes(value))
  )
}

function sameOrderedValues<T>(
  left: readonly T[],
  right: readonly T[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  )
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return Object.freeze([
    ...new Set(values),
  ].sort((left, right) => left.localeCompare(right)))
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
