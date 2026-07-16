import type {
  ResponseCreateParamsNonStreaming,
  ResponseFunctionToolCall,
  ResponseOutputItem,
  ResponseReasoningItem,
} from 'openai/resources/responses/responses'
import { beforeAll, describe, expect, it } from 'vitest'

import { loadEvidenceFacade, type ReplayEvidence } from '../data/evidenceFacade'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import {
  buildResponsesRequest,
  ResearchAnalystError,
  runResearchAnalyst,
  type ResearchAnalystResponsesTransport,
  type ResearchAnalystTransportResponse,
} from './researchAnalyst'
import {
  RESEARCH_ANALYST_MODEL,
  RESEARCH_ANALYST_OUTPUT_SCHEMA,
  RESEARCH_ANALYST_OUTPUT_VERSION,
  type ResearchAnalystOutput,
} from './researchAnalystContract'
import { createServerOpenAITransport } from './serverOpenAITransport'

let replay: ReplayEvidence

beforeAll(async () => {
  replay = (
    await loadEvidenceFacade(
      new AbortController().signal,
      createCommittedFixtureFetcher(),
    )
  ).replay
})

describe('GPT-5.6 research analyst', () => {
  it('builds the exact stateless Responses request with strict tools and output', () => {
    const request = buildResponsesRequest(
      [{ role: 'user', content: 'Plan the verified replay.' }],
      replay,
      { maxToolCalls: 6, maxResponseTurns: 5 },
      'medium',
    )

    expect(request).toMatchObject({
      model: 'gpt-5.6-sol',
      store: false,
      stream: false,
      include: ['reasoning.encrypted_content'],
      parallel_tool_calls: false,
      tool_choice: 'auto',
      max_output_tokens: 8_000,
      reasoning: { effort: 'medium', mode: 'standard' },
      text: {
        verbosity: 'medium',
        format: {
          type: 'json_schema',
          name: 'taxalens_research_analyst_output',
          strict: true,
        },
      },
    })
    expect(request).not.toHaveProperty('previous_response_id')
    expect(request.instructions).toContain('Never guess a species')
    expect(request.instructions).toContain('Maximum tool calls: 6')
    expect(request.instructions).toContain('not private reasoning')
    expect(request.tools).toHaveLength(12)
    expect(request.tools?.every((tool) => tool.type === 'function')).toBe(true)
    expect(request.tools?.some((tool) => tool.type === 'programmatic_tool_calling')).toBe(false)

    const functions = request.tools?.filter((tool) => tool.type === 'function') ?? []
    expect(functions.every(({ strict }) => strict === true)).toBe(true)
    expect(functions.find(({ name }) => name === 'export_evidence')?.allowed_callers).toEqual([
      'direct',
    ])
    expect(
      functions
        .filter(({ name }) => name !== 'export_evidence')
        .every(({ allowed_callers }) =>
          JSON.stringify(allowed_callers) === JSON.stringify(['direct', 'programmatic']),
        ),
    ).toBe(true)
    expect(request.text?.format).toMatchObject({ schema: RESEARCH_ANALYST_OUTPUT_SCHEMA })
    const schemas = [
      request.text?.format !== undefined && 'schema' in request.text.format
        ? request.text.format.schema
        : undefined,
      ...functions.flatMap(({ output_schema, parameters }) => [parameters, output_schema]),
    ]
    expect(
      schemas.flatMap((schema) => unsupportedStrictSchemaKeywords(schema)),
    ).toEqual([])
    expect(schemas.flatMap((schema) => strictObjectSchemaErrors(schema))).toEqual([])
  })

  it('plans a mission through direct tools and preserves encrypted continuation items', async () => {
    const transport = new ScriptedTransport([
      response('resp-1', [
        reasoning('reasoning-1'),
        functionCall('call-1', 'resolve_taxon', { query: 'Papilio demoleus' }),
      ]),
      response('resp-2', [
        reasoning('reasoning-2'),
        functionCall('call-2', 'estimate_mission', {
          accepted_taxon_key: 'gbif:1938069',
          candidate_limit: 5,
        }),
      ]),
      response('resp-3', [], missionOutput()),
    ])

    const run = await runResearchAnalyst(
      {
        requestKind: 'mission_planning',
        request: 'Plan a replay-only mission for the verified target.',
      },
      replay,
      transport,
    )

    expect(run).toMatchObject({
      schemaVersion: 'taxalens-research-analyst-run:v1.0.0',
      model: RESEARCH_ANALYST_MODEL,
      reasoningEffort: 'medium',
      responseStatus: 'completed',
      budget: {
        maxToolCalls: 8,
        usedToolCalls: 2,
        maxResponseTurns: 6,
        usedResponseTurns: 3,
        exhausted: false,
      },
      responseIds: ['resp-1', 'resp-2', 'resp-3'],
    })
    expect(run.toolReceipts.map(({ tool }) => tool)).toEqual([
      'resolve_taxon',
      'estimate_mission',
    ])
    expect(run.toolResults.map(({ tool }) => tool)).toEqual([
      'resolve_taxon',
      'estimate_mission',
    ])
    expect(run.output.requestKind).toBe('mission_planning')
    expect(run.output.target).toEqual({
      acceptedTaxonKey: 'gbif:1938069',
      scientificName: 'Papilio demoleus',
      resolutionStatus: 'verified_replay_target',
    })
    expect(run.output.scientificClaimAllowed).toBe(false)
    expect(Object.isFrozen(run)).toBe(true)

    expect(inputItems(transport.requests[0]!)).toHaveLength(1)
    expect(inputItems(transport.requests[1]!).map(itemType)).toEqual([
      'message',
      'reasoning',
      'function_call',
      'function_call_output',
    ])
    expect(inputItems(transport.requests[2]!).map(itemType)).toEqual([
      'message',
      'reasoning',
      'function_call',
      'function_call_output',
      'reasoning',
      'function_call',
      'function_call_output',
    ])
    expect(
      inputItems(transport.requests[1]!).find((item) => itemType(item) === 'reasoning'),
    ).toMatchObject({ encrypted_content: 'opaque-reasoning-1' })
    expect(JSON.stringify(run)).not.toContain('opaque-reasoning')
  })

  it('explains unavailable evidence at high reasoning without unsupported claims', async () => {
    const transport = new ScriptedTransport([
      response('resp-explain-1', [
        functionCall('call-explain-1', 'resolve_taxon', { query: 'gbif:1938069' }),
      ]),
      response('resp-explain-2', [
        functionCall('call-explain-2', 'inspect_reference_status', {
          accepted_taxon_key: 'gbif:1938069',
        }),
      ]),
      response('resp-explain-3', [], explanationOutput()),
    ])

    const run = await runResearchAnalyst(
      {
        requestKind: 'evidence_explanation',
        request: 'Why is the reference evidence unavailable?',
        reasoningEffort: 'high',
        budget: { maxToolCalls: 3, maxResponseTurns: 4 },
      },
      replay,
      transport,
    )

    expect(run.reasoningEffort).toBe('high')
    expect(run.output.evidenceBackedClaims[0]).toMatchObject({
      claimType: 'candidate_metadata',
      artifactIds: ['reference-readiness'],
    })
    expect(run.output.unavailableEvidence[0]).toMatchObject({
      topic: 'Human-verified source media',
      artifactIds: ['reference-shortfalls'],
    })
    expect(run.output.unsupportedClaimsRejected).toBe(true)
    expect(run.output.approvalBoundary).toMatchObject({
      liveWorkApproved: false,
      externalActionsExecuted: false,
      approvalRequired: false,
      items: [],
    })
  })

  it('keeps requested downloads and inference behind a blocked approval boundary', async () => {
    const transport = new ScriptedTransport([
      response('resp-approval-1', [
        functionCall('call-approval-1', 'resolve_taxon', { query: 'Papilio demoleus' }),
      ]),
      response('resp-approval-2', [], approvalOutput()),
    ])

    const run = await runResearchAnalyst(
      {
        requestKind: 'mission_planning',
        request: 'Download images and run BioCLIP now.',
      },
      replay,
      transport,
    )

    expect(run.toolReceipts).toHaveLength(1)
    expect(run.output.plan[0]).toMatchObject({ status: 'blocked', approvalRequired: true })
    expect(run.output.approvalBoundary).toMatchObject({
      liveWorkApproved: false,
      externalActionsExecuted: false,
      approvalRequired: true,
    })
    expect(run.output.approvalBoundary.items).toHaveLength(1)
  })

  it('rejects species guessing before any other evidence tool can run', async () => {
    const transport = new ScriptedTransport([
      response('resp-wrong-taxon', [
        functionCall('call-wrong-taxon', 'resolve_taxon', { query: 'Papilio xuthus' }),
      ]),
    ])

    await expect(
      runResearchAnalyst(
        {
          requestKind: 'evidence_explanation',
          request: 'Tell me about Papilio xuthus.',
        },
        replay,
        transport,
      ),
    ).rejects.toMatchObject({ code: 'invalid_tool_call' })
  })

  it('rejects unreturned citations, changed targets, and unsupported output flags', async () => {
    const invalidCitation = missionOutput({ artifactIds: ['rights-manifest'] })
    invalidCitation.plan[0]!.artifactIds = ['rights-manifest']
    const guessedTarget = missionOutput()
    guessedTarget.target.scientificName = 'Papilio xuthus'
    const unsupported = { ...missionOutput(), unsupportedClaimsRejected: false }

    await expect(runWithFinal(invalidCitation, 'invalid-citation', replay)).rejects.toMatchObject({
      code: 'invalid_model_output',
    })
    await expect(runWithFinal(guessedTarget, 'guessed-target', replay)).rejects.toMatchObject({
      code: 'invalid_model_output',
    })
    await expect(runWithFinal(unsupported, 'unsupported', replay)).rejects.toMatchObject({
      code: 'invalid_model_output',
    })
  })

  it('enforces tool, response, and parallel-call budgets before execution', async () => {
    const toolBudgetTransport = new ScriptedTransport([
      response('resp-budget-1', [
        functionCall('call-budget-1', 'resolve_taxon', { query: 'Papilio demoleus' }),
      ]),
      response('resp-budget-2', [
        functionCall('call-budget-2', 'inspect_stage', { stage_id: 'human-review' }),
      ]),
    ])
    await expect(
      runResearchAnalyst(
        {
          requestKind: 'evidence_explanation',
          request: 'Inspect the review stage.',
          budget: { maxToolCalls: 1, maxResponseTurns: 3 },
        },
        replay,
        toolBudgetTransport,
      ),
    ).rejects.toMatchObject({ code: 'tool_budget_exceeded' })

    const responseBudgetTransport = new ScriptedTransport([
      response('resp-turn-1', [
        functionCall('call-turn-1', 'resolve_taxon', { query: 'Papilio demoleus' }),
      ]),
      response('resp-turn-2', [
        functionCall('call-turn-2', 'inspect_stage', { stage_id: 'human-review' }),
      ]),
    ])
    await expect(
      runResearchAnalyst(
        {
          requestKind: 'evidence_explanation',
          request: 'Inspect the review stage.',
          budget: { maxToolCalls: 2, maxResponseTurns: 2 },
        },
        replay,
        responseBudgetTransport,
      ),
    ).rejects.toMatchObject({ code: 'response_budget_exceeded' })

    const parallelTransport = new ScriptedTransport([
      response('resp-parallel', [
        functionCall('call-parallel-1', 'resolve_taxon', { query: 'Papilio demoleus' }),
        functionCall('call-parallel-2', 'inspect_stage', { stage_id: 'human-review' }),
      ]),
    ])
    await expect(
      runResearchAnalyst(
        { requestKind: 'evidence_explanation', request: 'Inspect the target.' },
        replay,
        parallelTransport,
      ),
    ).rejects.toMatchObject({ code: 'invalid_tool_call' })
  })

  it('rejects malformed inputs and keeps the official client server-only', async () => {
    const unusedTransport = new ScriptedTransport([])
    await expect(
      runResearchAnalyst(
        { requestKind: 'mission_planning', request: '   ' },
        replay,
        unusedTransport,
      ),
    ).rejects.toBeInstanceOf(ResearchAnalystError)
    await expect(
      runResearchAnalyst(
        {
          requestKind: 'mission_planning',
          request: 'Plan.',
          budget: { maxToolCalls: 13 },
        },
        replay,
        unusedTransport,
      ),
    ).rejects.toMatchObject({ code: 'invalid_input' })
    expect(() => createServerOpenAITransport({ apiKey: 'browser-key-must-not-work' })).toThrow(
      'server-only',
    )
    expect(unusedTransport.requests).toHaveLength(0)
  })
})

class ScriptedTransport implements ResearchAnalystResponsesTransport {
  readonly requests: ResponseCreateParamsNonStreaming[] = []
  readonly #responses: readonly ResearchAnalystTransportResponse[]

  constructor(responses: readonly ResearchAnalystTransportResponse[]) {
    this.#responses = responses
  }

  async create(request: ResponseCreateParamsNonStreaming): Promise<ResearchAnalystTransportResponse> {
    this.requests.push(request)
    const response = this.#responses[this.requests.length - 1]
    if (response === undefined) {
      throw new Error('No scripted response remains')
    }
    return response
  }
}

function response(
  id: string,
  output: readonly ResponseOutputItem[],
  outputValue?: unknown,
): ResearchAnalystTransportResponse {
  return {
    id,
    model: RESEARCH_ANALYST_MODEL,
    status: 'completed',
    output,
    output_text: outputValue === undefined ? '' : JSON.stringify(outputValue),
    usage: null,
  }
}

function reasoning(id: string): ResponseReasoningItem {
  return {
    id,
    type: 'reasoning',
    status: 'completed',
    summary: [],
    encrypted_content: `opaque-${id}`,
  }
}

function functionCall(
  callId: string,
  name: string,
  args: Readonly<Record<string, unknown>>,
): ResponseFunctionToolCall {
  return {
    type: 'function_call',
    call_id: callId,
    name,
    arguments: JSON.stringify(args),
    caller: { type: 'direct' },
    status: 'completed',
  }
}

function missionOutput(
  overrides: Partial<MutableResearchAnalystOutput> = {},
): MutableResearchAnalystOutput {
  return {
    schemaVersion: RESEARCH_ANALYST_OUTPUT_VERSION,
    requestKind: 'mission_planning',
    target: {
      acceptedTaxonKey: 'gbif:1938069',
      scientificName: 'Papilio demoleus',
      resolutionStatus: 'verified_replay_target',
    },
    plan: [
      {
        sequence: 1,
        action: 'Resolve the replay target and retain all five regional candidates.',
        tool: 'resolve_taxon',
        status: 'complete',
        approvalRequired: false,
        artifactIds: ['query-definitions'],
      },
      {
        sequence: 2,
        action: 'Use the replay-only mission estimate without launching work.',
        tool: 'estimate_mission',
        status: 'complete',
        approvalRequired: false,
        artifactIds: ['candidate-sets'],
      },
    ],
    evidenceBackedClaims: [
      {
        id: 'candidate-policy',
        claim: 'The replay mission retains five regional candidate hypotheses.',
        claimType: 'verified_workflow_fact',
        artifactIds: ['candidate-sets'],
      },
    ],
    unavailableEvidence: [
      {
        topic: 'Live execution',
        reason: 'The deterministic plan launches no external work.',
        artifactIds: ['query-definitions'],
      },
    ],
    approvalBoundary: {
      liveWorkApproved: false,
      externalActionsExecuted: false,
      approvalRequired: false,
      items: [],
    },
    answer: 'A replay-only plan is available. Live acquisition and scientific promotion remain outside this run.',
    limitations: ['Candidate hypotheses are not occurrence or classification evidence.'],
    artifactIds: ['candidate-sets', 'query-definitions'],
    unsupportedClaimsRejected: true,
    scientificClaimAllowed: false,
    ...overrides,
  }
}

function explanationOutput(): MutableResearchAnalystOutput {
  return {
    schemaVersion: RESEARCH_ANALYST_OUTPUT_VERSION,
    requestKind: 'evidence_explanation',
    target: {
      acceptedTaxonKey: 'gbif:1938069',
      scientificName: 'Papilio demoleus',
      resolutionStatus: 'verified_replay_target',
    },
    plan: [
      {
        sequence: 1,
        action: 'Resolve the target and inspect committed reference readiness.',
        tool: 'inspect_reference_status',
        status: 'complete',
        approvalRequired: false,
        artifactIds: ['reference-readiness'],
      },
    ],
    evidenceBackedClaims: [
      {
        id: 'source-candidates',
        claim: 'The replay contains 838 eligible source-media candidates.',
        claimType: 'candidate_metadata',
        artifactIds: ['reference-readiness'],
      },
    ],
    unavailableEvidence: [
      {
        topic: 'Human-verified source media',
        reason: 'The committed count is zero with a 490-item shortfall.',
        artifactIds: ['reference-shortfalls'],
      },
    ],
    approvalBoundary: {
      liveWorkApproved: false,
      externalActionsExecuted: false,
      approvalRequired: false,
      items: [],
    },
    answer: 'Reference evidence is blocked because candidate media has not completed human verification.',
    limitations: ['Source-media candidates are not verified biological references.'],
    artifactIds: ['reference-readiness', 'reference-shortfalls'],
    unsupportedClaimsRejected: true,
    scientificClaimAllowed: false,
  }
}

function approvalOutput(): MutableResearchAnalystOutput {
  const output = missionOutput()
  output.plan = [
    {
      sequence: 1,
      action: 'Download media and run visual inference.',
      tool: null,
      status: 'blocked',
      approvalRequired: true,
      artifactIds: ['query-definitions'],
    },
  ]
  output.evidenceBackedClaims = []
  output.unavailableEvidence = [
    {
      topic: 'Live visual work',
      reason: 'No live action is authorized in the read-only analyst run.',
      artifactIds: ['query-definitions'],
    },
  ]
  output.approvalBoundary = {
    liveWorkApproved: false,
    externalActionsExecuted: false,
    approvalRequired: true,
    items: [
      {
        action: 'Approve licensed media download and bounded BioCLIP execution.',
        reason: 'External downloads and inference require a separate human-approved workflow.',
        artifactIds: ['query-definitions'],
      },
    ],
  }
  output.answer = 'No download or inference was executed. A separate human approval is required.'
  output.artifactIds = ['query-definitions']
  return output
}

async function runWithFinal(
  output: unknown,
  prefix: string,
  replayEvidence: ReplayEvidence,
): Promise<unknown> {
  const transport = new ScriptedTransport([
    response(`${prefix}-1`, [
      functionCall(`${prefix}-call`, 'resolve_taxon', { query: 'Papilio demoleus' }),
    ]),
    response(`${prefix}-2`, [], output),
  ])
  return runResearchAnalyst(
    { requestKind: 'mission_planning', request: 'Plan the verified replay.' },
    replayEvidence,
    transport,
  )
}

function inputItems(request: ResponseCreateParamsNonStreaming): readonly unknown[] {
  return Array.isArray(request.input) ? request.input : []
}

function itemType(item: unknown): string {
  return typeof item === 'object' && item !== null && 'type' in item
    ? String(item.type)
    : 'message'
}

function unsupportedStrictSchemaKeywords(value: unknown): string[] {
  const unsupported = new Set([
    'format',
    'maxItems',
    'maxLength',
    'maximum',
    'minItems',
    'minLength',
    'minimum',
    'pattern',
    'uniqueItems',
  ])
  if (Array.isArray(value)) {
    return value.flatMap((item) => unsupportedStrictSchemaKeywords(item))
  }
  if (typeof value !== 'object' || value === null) {
    return []
  }
  return Object.entries(value).flatMap(([key, child]) => [
    ...(unsupported.has(key) ? [key] : []),
    ...unsupportedStrictSchemaKeywords(child),
  ])
}

function strictObjectSchemaErrors(value: unknown, path = '$'): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => strictObjectSchemaErrors(item, `${path}[${index}]`))
  }
  if (typeof value !== 'object' || value === null) {
    return []
  }
  const record = value as Readonly<Record<string, unknown>>
  const ownErrors: string[] = []
  if (record.type === 'object') {
    const properties =
      typeof record.properties === 'object' && record.properties !== null
        ? Object.keys(record.properties)
        : []
    const required = Array.isArray(record.required) ? record.required : []
    if (record.additionalProperties !== false) {
      ownErrors.push(`${path}: additionalProperties`)
    }
    if (JSON.stringify(required) !== JSON.stringify(properties)) {
      ownErrors.push(`${path}: required`)
    }
  }
  return [
    ...ownErrors,
    ...Object.entries(record).flatMap(([key, child]) =>
      strictObjectSchemaErrors(child, `${path}.${key}`),
    ),
  ]
}

type MutableResearchAnalystOutput = {
  -readonly [Key in keyof ResearchAnalystOutput]: Mutable<ResearchAnalystOutput[Key]>
}

type Mutable<Value> =
  Value extends readonly (infer Item)[]
    ? Mutable<Item>[]
    : Value extends object
      ? { -readonly [Key in keyof Value]: Mutable<Value[Key]> }
      : Value
