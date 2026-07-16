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

import type { ReplayEvidence } from '../data/evidenceFacade'
import { canonicalExportJsonBytes } from '../evidence/evidenceExport'
import {
  RESEARCH_TOOL_DEFINITIONS,
  executeResearchTool,
  type ResearchToolResult,
} from './researchTools'
import {
  RESEARCH_ANALYST_MODEL,
  RESEARCH_ANALYST_OUTPUT_SCHEMA,
  RESEARCH_ANALYST_RUN_VERSION,
  type ResearchAnalystBudgetLimits,
  type ResearchAnalystInput,
  type ResearchAnalystOutput,
  type ResearchAnalystReasoningEffort,
  type ResearchAnalystRun,
  type ResearchAnalystToolReceipt,
} from './researchAnalystContract'

const DEFAULT_BUDGET: ResearchAnalystBudgetLimits = Object.freeze({
  maxToolCalls: 8,
  maxResponseTurns: 6,
})
const MAX_TOOL_CALLS = 12
const MAX_RESPONSE_TURNS = 10
const MAX_REQUEST_LENGTH = 8_000
const MAX_OUTPUT_TOKENS = 8_000
const MAX_ARTIFACT_CITATIONS = 32

const BASE_INSTRUCTIONS = `You are the TaxaLens research analyst. Produce a concise public plan and explanation from checksum-verified evidence only.

Policy:
- Use only the supplied read-only tools. Resolve the taxon before making any taxon-specific statement.
- Never guess a species, invent an artifact ID, or treat search candidates as occurrences.
- Candidate metadata is a hypothesis, not a classification. Raw similarities are not probabilities.
- Prototype reference, runtime, benchmark, policy, staged-inference, and release evidence is aggregate. Never use it as a per-record score, classification, abstention reason, accuracy value, prevalence estimate, or public-image authorization.
- GO_PROTOTYPE_ONLY authorizes only explicit prototype integration. It never authorizes scientific release, production-default changes, public reference images, or a scientific claim.
- Missing evidence is unavailable or unknown, never proof of absence.
- Do not claim precision, accuracy, calibration, savings, successful classification, or biological occurrence unless a returned tool result explicitly supports it.
- Live acquisition, downloads, inference, writes, publication, or scientific promotion are outside this run. Put them in approvalBoundary.items, mark affected plan steps blocked, and execute nothing.
- Every plan step, claim, unavailable-evidence item, and approval item must cite artifact IDs returned by tools in this run.
- Return only the strict structured output. The plan is a public action summary, not private reasoning. Do not reveal chain-of-thought or hidden reasoning.`

export interface ResearchAnalystTransportResponse {
  readonly id: string
  readonly model: string
  readonly status: ResponseStatus
  readonly output: readonly ResponseOutputItem[]
  readonly output_text: string
  readonly usage: ResponseUsage | null
}

export interface ResearchAnalystResponsesTransport {
  create(request: ResponseCreateParamsNonStreaming): Promise<ResearchAnalystTransportResponse>
}

export type ResearchAnalystErrorCode =
  | 'approval_boundary_invalid'
  | 'invalid_input'
  | 'invalid_model_output'
  | 'invalid_response'
  | 'invalid_tool_call'
  | 'model_refusal'
  | 'response_budget_exceeded'
  | 'tool_budget_exceeded'

export class ResearchAnalystError extends Error {
  readonly code: ResearchAnalystErrorCode

  constructor(code: ResearchAnalystErrorCode, message: string) {
    super(message)
    this.name = 'ResearchAnalystError'
    this.code = code
  }
}

const ajv = new Ajv2020({ allErrors: true, strict: true })
const validateAnalystOutput = ajv.compile(RESEARCH_ANALYST_OUTPUT_SCHEMA)
const decoder = new TextDecoder()

export async function runResearchAnalyst(
  input: ResearchAnalystInput,
  replay: ReplayEvidence,
  transport: ResearchAnalystResponsesTransport,
): Promise<ResearchAnalystRun> {
  const requestText = validateInput(input)
  const budget = validateBudget(input.budget)
  const reasoningEffort = input.reasoningEffort ?? 'medium'
  const conversation: ResponseInput = [
    {
      role: 'user',
      content: JSON.stringify({
        requestKind: input.requestKind,
        request: requestText,
        replayTarget: replay.target,
        toolBudget: budget,
      }),
    },
  ]
  const responseIds: string[] = []
  const toolReceipts: ResearchAnalystToolReceipt[] = []
  const toolResults: ResearchToolResult[] = []

  while (responseIds.length < budget.maxResponseTurns) {
    const response = await transport.create(
      buildResponsesRequest(conversation, replay, budget, reasoningEffort),
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
        replay,
        toolReceipts,
        toolResults,
      )
      return deepFreeze({
        schemaVersion: RESEARCH_ANALYST_RUN_VERSION,
        model: RESEARCH_ANALYST_MODEL,
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
      throw new ResearchAnalystError(
        'invalid_tool_call',
        'parallel_tool_calls is false; exactly one function call is allowed per response turn',
      )
    }
    if (toolReceipts.length >= budget.maxToolCalls) {
      throw new ResearchAnalystError(
        'tool_budget_exceeded',
        `The analyst exceeded its ${budget.maxToolCalls}-call tool budget`,
      )
    }

    const call = calls[0]!
    if (call.caller !== undefined && call.caller !== null && call.caller.type !== 'direct') {
      throw new ResearchAnalystError(
        'invalid_tool_call',
        'Programmatic Tool Calling is not enabled for this direct analyst run',
      )
    }
    if (toolReceipts.some(({ callId }) => callId === call.call_id)) {
      throw new ResearchAnalystError('invalid_tool_call', `Duplicate call_id: ${call.call_id}`)
    }
    const args = parseToolArguments(call)
    let toolResult: ResearchToolResult
    try {
      toolResult = await executeResearchTool(call.name, args, replay)
    } catch (error) {
      throw new ResearchAnalystError(
        'invalid_tool_call',
        `${call.name} could not execute: ${errorMessage(error)}`,
      )
    }

    if (toolReceipts.length === 0 && toolResult.tool !== 'resolve_taxon') {
      throw new ResearchAnalystError(
        'invalid_tool_call',
        'The first research tool call must resolve the replay taxon',
      )
    }
    if (
      toolResult.tool === 'resolve_taxon' &&
      toolReceipts.length === 0 &&
      toolResult.status !== 'available'
    ) {
      throw new ResearchAnalystError(
        'invalid_tool_call',
        'The analyst must resolve the checksum-verified replay target before continuing',
      )
    }

    toolResults.push(toolResult)
    toolReceipts.push(
      deepFreeze({
        sequence: toolReceipts.length + 1,
        callId: call.call_id,
        tool: toolResult.tool,
        arguments: args,
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

  throw new ResearchAnalystError(
    'response_budget_exceeded',
    `The analyst exceeded its ${budget.maxResponseTurns}-turn response budget`,
  )
}

export function buildResponsesRequest(
  input: ResponseInput,
  replay: ReplayEvidence,
  budget: ResearchAnalystBudgetLimits,
  reasoningEffort: ResearchAnalystReasoningEffort,
): ResponseCreateParamsNonStreaming {
  return {
    model: RESEARCH_ANALYST_MODEL,
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
    instructions: `${BASE_INSTRUCTIONS}\n\nVerified replay target: ${replay.target.scientificName} (${replay.target.acceptedTaxonKey}). Maximum tool calls: ${budget.maxToolCalls}. Maximum response turns: ${budget.maxResponseTurns}.`,
    input: [...input],
    tools: responseTools(),
    text: {
      verbosity: 'medium',
      format: {
        type: 'json_schema',
        name: 'taxalens_research_analyst_output',
        description: 'Evidence-cited public mission plan or evidence explanation.',
        strict: true,
        schema: mutableJsonObject(RESEARCH_ANALYST_OUTPUT_SCHEMA),
      },
    },
  }
}

function responseTools(): FunctionTool[] {
  return RESEARCH_TOOL_DEFINITIONS.map((tool) => ({
    type: 'function',
    name: tool.name,
    description: tool.description,
    strict: tool.strict,
    parameters: mutableJsonObject(tool.parameters),
    output_schema: mutableJsonObject(tool.output_schema),
    allowed_callers: [...tool.allowed_callers],
  }))
}

function validateInput(input: ResearchAnalystInput): string {
  if (
    input.requestKind !== 'mission_planning' &&
    input.requestKind !== 'evidence_explanation'
  ) {
    throw new ResearchAnalystError('invalid_input', 'Unknown analyst request kind')
  }
  if (
    input.reasoningEffort !== undefined &&
    input.reasoningEffort !== 'medium' &&
    input.reasoningEffort !== 'high'
  ) {
    throw new ResearchAnalystError('invalid_input', 'Reasoning effort must be medium or high')
  }
  const request = input.request.trim()
  if (request.length === 0 || request.length > MAX_REQUEST_LENGTH) {
    throw new ResearchAnalystError(
      'invalid_input',
      `Natural-language request length must be between 1 and ${MAX_REQUEST_LENGTH}`,
    )
  }
  return request
}

function validateBudget(
  input: Partial<ResearchAnalystBudgetLimits> | undefined,
): ResearchAnalystBudgetLimits {
  const maxToolCalls = input?.maxToolCalls ?? DEFAULT_BUDGET.maxToolCalls
  const maxResponseTurns = input?.maxResponseTurns ?? DEFAULT_BUDGET.maxResponseTurns
  if (!Number.isInteger(maxToolCalls) || maxToolCalls < 1 || maxToolCalls > MAX_TOOL_CALLS) {
    throw new ResearchAnalystError(
      'invalid_input',
      `maxToolCalls must be an integer between 1 and ${MAX_TOOL_CALLS}`,
    )
  }
  if (
    !Number.isInteger(maxResponseTurns) ||
    maxResponseTurns < 2 ||
    maxResponseTurns > MAX_RESPONSE_TURNS
  ) {
    throw new ResearchAnalystError(
      'invalid_input',
      `maxResponseTurns must be an integer between 2 and ${MAX_RESPONSE_TURNS}`,
    )
  }
  return Object.freeze({ maxToolCalls, maxResponseTurns })
}

function validateResponseEnvelope(
  response: ResearchAnalystTransportResponse,
  priorResponseIds: readonly string[],
): void {
  if (response.model !== RESEARCH_ANALYST_MODEL) {
    throw new ResearchAnalystError(
      'invalid_response',
      `Expected ${RESEARCH_ANALYST_MODEL}, received ${response.model}`,
    )
  }
  if (response.status !== 'completed') {
    throw new ResearchAnalystError(
      'invalid_response',
      `Responses API returned ${response.status}`,
    )
  }
  if (response.id.trim().length === 0 || priorResponseIds.includes(response.id)) {
    throw new ResearchAnalystError('invalid_response', 'Response IDs must be non-empty and unique')
  }
  const refusal = response.output
    .filter((item) => item.type === 'message')
    .flatMap(({ content }) => content)
    .find((content) => content.type === 'refusal')
  if (refusal?.type === 'refusal') {
    throw new ResearchAnalystError('model_refusal', refusal.refusal)
  }
}

function parseToolArguments(call: ResponseFunctionToolCall): Readonly<Record<string, unknown>> {
  let value: unknown
  try {
    value = JSON.parse(call.arguments) as unknown
  } catch {
    throw new ResearchAnalystError(
      'invalid_tool_call',
      `${call.name} arguments are not valid JSON`,
    )
  }
  if (!isRecord(value)) {
    throw new ResearchAnalystError(
      'invalid_tool_call',
      `${call.name} arguments must be an object`,
    )
  }
  return deepFreeze({ ...value })
}

function continuationItems(output: readonly ResponseOutputItem[]): ResponseInputItem[] {
  const items: ResponseInputItem[] = []
  for (const item of output) {
    switch (item.type) {
      case 'reasoning':
      case 'function_call':
      case 'message':
        items.push(item)
        break
      default:
        throw new ResearchAnalystError(
          'invalid_response',
          `Unexpected Responses output item for read-only analyst: ${item.type}`,
        )
    }
  }
  return items
}

function parseAndValidateOutput(
  response: ResearchAnalystTransportResponse,
  input: ResearchAnalystInput,
  replay: ReplayEvidence,
  receipts: readonly ResearchAnalystToolReceipt[],
  toolResults: readonly ResearchToolResult[],
): ResearchAnalystOutput {
  if (receipts.length === 0 || receipts[0]?.tool !== 'resolve_taxon') {
    throw new ResearchAnalystError(
      'invalid_model_output',
      'A final answer requires a successful taxon-resolution tool call',
    )
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(response.output_text) as unknown
  } catch {
    throw new ResearchAnalystError(
      'invalid_model_output',
      'The final Responses output is not valid JSON',
    )
  }
  if (!validateAnalystOutput(parsed)) {
    throw new ResearchAnalystError(
      'invalid_model_output',
      `The final structured output is invalid: ${formatValidationErrors(validateAnalystOutput.errors)}`,
    )
  }
  const output = parsed as ResearchAnalystOutput
  validateOutputBounds(output)
  if (output.requestKind !== input.requestKind) {
    throw new ResearchAnalystError('invalid_model_output', 'Request kind changed in model output')
  }
  if (
    output.target.acceptedTaxonKey !== replay.target.acceptedTaxonKey ||
    output.target.scientificName !== replay.target.scientificName
  ) {
    throw new ResearchAnalystError(
      'invalid_model_output',
      'Model output guessed or changed the checksum-verified replay target',
    )
  }
  if (!output.plan.every((step, index) => step.sequence === index + 1)) {
    throw new ResearchAnalystError(
      'invalid_model_output',
      'Public plan sequence must be contiguous from 1',
    )
  }
  if (output.evidenceBackedClaims.length + output.unavailableEvidence.length === 0) {
    throw new ResearchAnalystError(
      'invalid_model_output',
      'The answer must expose at least one evidence-backed claim or unavailable-evidence item',
    )
  }

  validateApprovalBoundary(output)
  validateCitations(output, replay, toolResults)
  return deepFreeze(output)
}

function validateOutputBounds(output: ResearchAnalystOutput): void {
  const invalid =
    output.plan.length < 1 ||
    output.plan.length > 16 ||
    output.evidenceBackedClaims.length > 24 ||
    output.unavailableEvidence.length > 24 ||
    output.approvalBoundary.items.length > 12 ||
    output.limitations.length > 16 ||
    !boundedText(output.target.acceptedTaxonKey, 120) ||
    !boundedText(output.target.scientificName, 180) ||
    !boundedText(output.answer, 8_000) ||
    !boundedArtifactIds(output.artifactIds) ||
    output.plan.some(
      (step) =>
        !Number.isInteger(step.sequence) ||
        step.sequence < 1 ||
        step.sequence > 16 ||
        !boundedText(step.action, 600) ||
        !boundedArtifactIds(step.artifactIds),
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
    output.approvalBoundary.items.some(
      (item) =>
        !boundedText(item.action, 600) ||
        !boundedText(item.reason, 1_200) ||
        !boundedArtifactIds(item.artifactIds),
    ) ||
    output.limitations.some((item) => !boundedText(item, 1_200))
  if (invalid) {
    throw new ResearchAnalystError(
      'invalid_model_output',
      'The final output exceeds the bounded analyst contract',
    )
  }
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

function validateApprovalBoundary(output: ResearchAnalystOutput): void {
  const boundary = output.approvalBoundary
  if (boundary.approvalRequired !== (boundary.items.length > 0)) {
    throw new ResearchAnalystError(
      'approval_boundary_invalid',
      'approvalRequired must exactly match the presence of approval items',
    )
  }
  const approvalSteps = output.plan.filter(({ approvalRequired }) => approvalRequired)
  if (
    approvalSteps.some(({ status }) => status !== 'blocked') ||
    (approvalSteps.length > 0 && !boundary.approvalRequired)
  ) {
    throw new ResearchAnalystError(
      'approval_boundary_invalid',
      'Approval-requiring plan steps must remain blocked and have a matching approval item',
    )
  }
}

function validateCitations(
  output: ResearchAnalystOutput,
  replay: ReplayEvidence,
  toolResults: readonly ResearchToolResult[],
): void {
  const toolArtifactIds = new Set(toolResults.flatMap(({ artifactIds }) => artifactIds))
  const inventoryIds = new Set(replay.artifactInventory.map(({ artifactId }) => artifactId))
  const nestedArtifactIds = uniqueSorted([
    ...output.plan.flatMap(({ artifactIds }) => artifactIds),
    ...output.evidenceBackedClaims.flatMap(({ artifactIds }) => artifactIds),
    ...output.unavailableEvidence.flatMap(({ artifactIds }) => artifactIds),
    ...output.approvalBoundary.items.flatMap(({ artifactIds }) => artifactIds),
  ])
  const outputArtifactIds = uniqueSorted(output.artifactIds)
  if (
    nestedArtifactIds.length !== outputArtifactIds.length ||
    nestedArtifactIds.some((artifactId, index) => artifactId !== outputArtifactIds[index])
  ) {
    throw new ResearchAnalystError(
      'invalid_model_output',
      'Top-level artifactIds must exactly cover all structured citations',
    )
  }
  const invalid = outputArtifactIds.filter(
    (artifactId) => !inventoryIds.has(artifactId) || !toolArtifactIds.has(artifactId),
  )
  if (invalid.length > 0) {
    throw new ResearchAnalystError(
      'invalid_model_output',
      `Model output cites artifacts not returned by tools in this run: ${invalid.join(', ')}`,
    )
  }
}

function mutableJsonObject(value: unknown): Record<string, unknown> {
  const converted = mutableJson(value)
  if (!isRecord(converted)) {
    throw new ResearchAnalystError('invalid_input', 'Expected a JSON Schema object')
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

function formatValidationErrors(errors: readonly ErrorObject[] | null | undefined): string {
  if (errors === undefined || errors === null || errors.length === 0) {
    return 'validation failed'
  }
  return errors
    .map((error) => `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`)
    .join('; ')
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
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
