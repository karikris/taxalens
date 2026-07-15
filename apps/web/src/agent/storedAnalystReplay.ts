import Ajv2020, { type ErrorObject } from 'ajv/dist/2020.js'

import type { EvidenceFacade } from '../data/evidenceFacade'
import {
  RESEARCH_ANALYST_MODEL,
  RESEARCH_ANALYST_OUTPUT_SCHEMA,
  RESEARCH_ANALYST_RUN_VERSION,
  type ResearchAnalystRequestKind,
  type ResearchAnalystRun,
} from './researchAnalystContract'
import { buildPublicAgentTrace, type PublicAgentTrace } from './agentTraceModel'
import { RESEARCH_TOOL_DEFINITIONS, executeResearchTool } from './researchTools'

export const STORED_ANALYST_REQUEST_VERSION =
  'taxalens-stored-analyst-request:v1.0.0' as const

interface StoredAnalystRequest {
  readonly schemaVersion: typeof STORED_ANALYST_REQUEST_VERSION
  readonly requestKind: ResearchAnalystRequestKind
  readonly request: string
  readonly reasoningEffort: 'medium' | 'high'
  readonly budget: {
    readonly maxToolCalls: number
    readonly maxResponseTurns: number
  }
  readonly target: {
    readonly acceptedTaxonKey: string
    readonly scientificName: string
  }
  readonly storage: {
    readonly storedOutputOnly: true
    readonly liveRequestExecuted: false
    readonly credentialsRequired: false
  }
}

export class StoredAnalystReplayError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StoredAnalystReplayError'
  }
}

const ARTIFACT_IDS_SCHEMA = {
  type: 'array',
  items: { type: 'string' },
}

const STORED_REQUEST_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    schemaVersion: { type: 'string', const: STORED_ANALYST_REQUEST_VERSION },
    requestKind: {
      type: 'string',
      enum: ['mission_planning', 'evidence_explanation'],
    },
    request: { type: 'string' },
    reasoningEffort: { type: 'string', enum: ['medium', 'high'] },
    budget: {
      type: 'object',
      additionalProperties: false,
      properties: {
        maxToolCalls: { type: 'integer' },
        maxResponseTurns: { type: 'integer' },
      },
      required: ['maxToolCalls', 'maxResponseTurns'],
    },
    target: {
      type: 'object',
      additionalProperties: false,
      properties: {
        acceptedTaxonKey: { type: 'string' },
        scientificName: { type: 'string' },
      },
      required: ['acceptedTaxonKey', 'scientificName'],
    },
    storage: {
      type: 'object',
      additionalProperties: false,
      properties: {
        storedOutputOnly: { type: 'boolean', const: true },
        liveRequestExecuted: { type: 'boolean', const: false },
        credentialsRequired: { type: 'boolean', const: false },
      },
      required: ['storedOutputOnly', 'liveRequestExecuted', 'credentialsRequired'],
    },
  },
  required: [
    'schemaVersion',
    'requestKind',
    'request',
    'reasoningEffort',
    'budget',
    'target',
    'storage',
  ],
}

const TOOL_RECEIPT_SCHEMAS = RESEARCH_TOOL_DEFINITIONS.map((tool) => ({
  type: 'object',
  additionalProperties: false,
  properties: {
    sequence: { type: 'integer' },
    callId: { type: 'string' },
    tool: { type: 'string', const: tool.name },
    arguments: tool.parameters,
    resultStatus: {
      type: 'string',
      enum: ['available', 'partial', 'unavailable', 'blocked'],
    },
    artifactIds: ARTIFACT_IDS_SCHEMA,
  },
  required: [
    'sequence',
    'callId',
    'tool',
    'arguments',
    'resultStatus',
    'artifactIds',
  ],
}))

const STORED_RUN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    schemaVersion: { type: 'string', const: RESEARCH_ANALYST_RUN_VERSION },
    model: { type: 'string', const: RESEARCH_ANALYST_MODEL },
    reasoningEffort: { type: 'string', enum: ['medium', 'high'] },
    responseStatus: { type: 'string', const: 'completed' },
    output: RESEARCH_ANALYST_OUTPUT_SCHEMA,
    budget: {
      type: 'object',
      additionalProperties: false,
      properties: {
        maxToolCalls: { type: 'integer' },
        usedToolCalls: { type: 'integer' },
        maxResponseTurns: { type: 'integer' },
        usedResponseTurns: { type: 'integer' },
        exhausted: { type: 'boolean', const: false },
      },
      required: [
        'maxToolCalls',
        'usedToolCalls',
        'maxResponseTurns',
        'usedResponseTurns',
        'exhausted',
      ],
    },
    toolReceipts: { type: 'array', items: { oneOf: TOOL_RECEIPT_SCHEMAS } },
    toolResults: {
      type: 'array',
      items: {
        oneOf: RESEARCH_TOOL_DEFINITIONS.map((tool) => tool.output_schema),
      },
    },
    responseIds: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'schemaVersion',
    'model',
    'reasoningEffort',
    'responseStatus',
    'output',
    'budget',
    'toolReceipts',
    'toolResults',
    'responseIds',
  ],
}

const ajv = new Ajv2020({ allErrors: true, strict: true })
const validateStoredRequest = ajv.compile<StoredAnalystRequest>(STORED_REQUEST_SCHEMA)
const validateStoredRun = ajv.compile<ResearchAnalystRun>(STORED_RUN_SCHEMA)

export async function loadStoredAnalystReplay(
  facade: EvidenceFacade,
): Promise<PublicAgentTrace | undefined> {
  const traces = facade.loadStoredOpenAIReplay()
  if (traces.length === 0) {
    return undefined
  }
  if (traces.length !== 1) {
    throw new StoredAnalystReplayError(
      'The current public workspace requires exactly one stored analyst trace',
    )
  }
  const trace = traces[0]
  if (trace === undefined || trace.model !== RESEARCH_ANALYST_MODEL) {
    throw new StoredAnalystReplayError('Stored analyst trace uses an unexpected model')
  }
  const requestValue: unknown = trace.requestArtifact.value
  const runValue: unknown = trace.responseArtifact.value
  if (!validateStoredRequest(requestValue)) {
    throw new StoredAnalystReplayError(
      `Stored analyst request is invalid: ${formatValidationErrors(validateStoredRequest.errors)}`,
    )
  }
  if (!validateStoredRun(runValue)) {
    throw new StoredAnalystReplayError(
      `Stored analyst run is invalid: ${formatValidationErrors(validateStoredRun.errors)}`,
    )
  }
  assertStoredContract(requestValue, runValue, facade)
  for (const [index, receipt] of runValue.toolReceipts.entries()) {
    const storedResult = runValue.toolResults[index]
    const replayedResult = await executeResearchTool(
      receipt.tool,
      receipt.arguments,
      facade.replay,
    )
    if (storedResult === undefined || canonicalJson(storedResult) !== canonicalJson(replayedResult)) {
      throw new StoredAnalystReplayError(
        `Stored tool result ${receipt.sequence} differs from deterministic replay`,
      )
    }
  }
  return buildPublicAgentTrace(
    {
      mode: 'stored_replay',
      requestKind: requestValue.requestKind,
      request: requestValue.request,
      run: runValue,
      storedReplay: {
        traceId: trace.traceId,
        requestArtifactId: trace.requestArtifact.artifactId,
        responseArtifactId: trace.responseArtifact.artifactId,
      },
    },
    facade.replay,
  )
}

function assertStoredContract(
  request: StoredAnalystRequest,
  run: ResearchAnalystRun,
  facade: EvidenceFacade,
): void {
  const replay = facade.replay
  const invalid =
    request.request.trim().length === 0 ||
    request.request.length > 8_000 ||
    request.target.acceptedTaxonKey !== replay.target.acceptedTaxonKey ||
    request.target.scientificName !== replay.target.scientificName ||
    request.reasoningEffort !== run.reasoningEffort ||
    request.requestKind !== run.output.requestKind ||
    request.budget.maxToolCalls !== run.budget.maxToolCalls ||
    request.budget.maxResponseTurns !== run.budget.maxResponseTurns ||
    run.budget.maxToolCalls < 1 ||
    run.budget.maxToolCalls > 12 ||
    run.budget.maxResponseTurns < 2 ||
    run.budget.maxResponseTurns > 10 ||
    run.toolReceipts.length < 1 ||
    run.toolReceipts.length > 12 ||
    run.responseIds.length < 1 ||
    run.responseIds.length > 10 ||
    run.responseIds.some(
      (responseId) => !/^stored-replay-turn-[0-9]{2}$/u.test(responseId),
    ) ||
    run.output.plan.length < 1 ||
    run.output.plan.length > 16 ||
    run.output.evidenceBackedClaims.length + run.output.unavailableEvidence.length < 1 ||
    run.output.evidenceBackedClaims.length > 24 ||
    run.output.unavailableEvidence.length > 24 ||
    run.output.approvalBoundary.items.length > 12 ||
    run.output.limitations.length > 16 ||
    run.output.answer.trim().length === 0 ||
    run.output.answer.length > 8_000 ||
    run.output.plan.some((step, index) => step.sequence !== index + 1) ||
    run.output.approvalBoundary.approvalRequired !==
      (run.output.approvalBoundary.items.length > 0)
  if (invalid) {
    throw new StoredAnalystReplayError('Stored analyst request and run contracts do not agree')
  }
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new StoredAnalystReplayError('Stored replay contains a non-finite number')
    }
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`
  }
  if (typeof value === 'object') {
    const record = value as Readonly<Record<string, unknown>>
    return `{${Object.keys(record)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(',')}}`
  }
  throw new StoredAnalystReplayError('Stored replay is not JSON-compatible')
}

function formatValidationErrors(errors: readonly ErrorObject[] | null | undefined): string {
  if (errors === undefined || errors === null || errors.length === 0) {
    return 'validation failed'
  }
  return errors
    .slice(0, 3)
    .map((error) => `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`)
    .join('; ')
}
