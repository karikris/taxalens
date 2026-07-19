import type {
  ResponseCreateParamsNonStreaming,
  ResponseFunctionToolCall,
  ResponseOutputItem,
  ResponseReasoningItem,
} from 'openai/resources/responses/responses'
import { describe, expect, it } from 'vitest'

import {
  buildVerificationResponsesRequest,
  deriveNextVerificationAction,
  deriveVerificationCampaignAnalysis,
  runVerificationAnalyst,
  VerificationAnalystError,
  type VerificationAnalystResponsesTransport,
  type VerificationAnalystTransportResponse,
} from './verificationAnalyst'
import {
  VERIFICATION_ANALYST_MODEL,
  VERIFICATION_ANALYST_OUTPUT_SCHEMA,
  VERIFICATION_ANALYST_OUTPUT_VERSION,
  type VerificationAnalystOutput,
} from './verificationAnalystContract'
import {
  VERIFICATION_ARTIFACT_CITATION_VERSION,
  VERIFICATION_TOOL_RESULT_VERSION,
  type VerificationArtifactCitation,
  type VerificationToolEvidence,
  type VerificationToolName,
  type VerificationToolResult,
} from './verificationTools'

const BEFORE_SNAPSHOT_SHA = '9'.repeat(64)
const SNAPSHOT_SHA = 'a'.repeat(64)
const TAXALENS_SHA = '1'.repeat(40)
const BIOMINER_SHA = '2'.repeat(40)
const CAMPAIGN_ID = 'verification-analyst-campaign-v1'
const CONFLICT_ITEM_ID = 'verification-item-conflict'
const PENDING_ITEM_ID = 'verification-item-pending'

describe('Configured model verification analyst next action', () => {
  it('builds a stateless direct-tool request with strict verification schemas', () => {
    const request = buildVerificationResponsesRequest(
      [{ role: 'user', content: 'What should a reviewer do next?' }],
      evidence(),
      { maxToolCalls: 6, maxResponseTurns: 7 },
      'medium',
    )

    expect(request).toMatchObject({
      model: 'configured-model',
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
          name: 'taxalens_verification_analyst_output',
          strict: true,
        },
      },
    })
    expect(request).not.toHaveProperty('previous_response_id')
    expect(request.instructions).toContain('deterministic TaxaLens policy')
    expect(request.instructions).toContain(`Exact campaign: ${CAMPAIGN_ID}`)
    expect(request.tools).toHaveLength(5)
    expect(
      request.tools?.every(
        (tool) =>
          tool.type === 'function' &&
          JSON.stringify(tool.allowed_callers) === JSON.stringify(['direct']),
      ),
    ).toBe(true)
    expect(
      request.tools?.some(
        (tool) => tool.type === 'programmatic_tool_calling',
      ),
    ).toBe(false)
    expect(request.text?.format).toMatchObject({
      schema: VERIFICATION_ANALYST_OUTPUT_SCHEMA,
    })
  })

  it('recommends independent adjudication and preserves opaque continuation', async () => {
    const packet = evidence()
    const results = toolResults()
    const transport = new ScriptedTransport([
      response('verification-response-1', [
        reasoning('verification-reasoning-1'),
        functionCall(
          'verification-call-1',
          'inspect_verification_campaign',
          { campaign_id: CAMPAIGN_ID },
        ),
      ]),
      response('verification-response-2', [
        functionCall('verification-call-2', 'inspect_review_conflicts', {
          campaign_id: CAMPAIGN_ID,
        }),
      ]),
      response('verification-response-3', [
        functionCall('verification-call-3', 'inspect_sampling_plan', {
          campaign_id: CAMPAIGN_ID,
        }),
      ]),
      response('verification-response-4', [
        functionCall('verification-call-4', 'inspect_reference_readiness', {
          campaign_id: CAMPAIGN_ID,
          snapshot_sha256: SNAPSHOT_SHA,
        }),
      ]),
      response('verification-response-5', [
        functionCall('verification-call-5', 'recommend_next_review_batch', {
          campaign_id: CAMPAIGN_ID,
          batch_size: 2,
        }),
      ]),
      response('verification-response-6', [], analystOutput()),
    ])

    const run = await runVerificationAnalyst(
      {
        requestKind: 'next_review_action',
        request:
          'Which review action would most improve the recorded scientific state, and why?',
        snapshotSha256: SNAPSHOT_SHA,
        batchSize: 2,
      },
      packet,
      transport,
      executor(results),
    )

    expect(run).toMatchObject({
      schemaVersion: 'taxalens-verification-analyst-run:v1.2.0',
      model: VERIFICATION_ANALYST_MODEL,
      reasoningEffort: 'medium',
      responseStatus: 'completed',
      budget: {
        maxToolCalls: 6,
        usedToolCalls: 5,
        maxResponseTurns: 7,
        usedResponseTurns: 6,
        exhausted: false,
      },
      responseIds: [
        'verification-response-1',
        'verification-response-2',
        'verification-response-3',
        'verification-response-4',
        'verification-response-5',
        'verification-response-6',
      ],
    })
    expect(run.toolReceipts.map(({ tool }) => tool)).toEqual([
      'inspect_verification_campaign',
      'inspect_review_conflicts',
      'inspect_sampling_plan',
      'inspect_reference_readiness',
      'recommend_next_review_batch',
    ])
    expect(run.output.recommendation).toMatchObject({
      action: 'adjudication',
      basis: 'unresolved_review_conflict',
      nextItemIds: [CONFLICT_ITEM_ID],
    })
    expect(run.output.externalActionsExecuted).toBe(false)
    expect(run.output.scientificClaimAllowed).toBe(false)
    expect(Object.isFrozen(run)).toBe(true)
    expect(inputItems(transport.requests[1]!).map(itemType)).toEqual([
      'message',
      'reasoning',
      'function_call',
      'function_call_output',
    ])
    expect(JSON.stringify(transport.requests[1])).toContain(
      'opaque-verification-reasoning-1',
    )
    expect(JSON.stringify(run)).not.toContain(
      'opaque-verification-reasoning-1',
    )
  })

  it('distinguishes all four bounded human-review workflows deterministically', () => {
    const base = toolResults()
    expect(deriveNextVerificationAction(base, 2)).toMatchObject({
      action: 'adjudication',
      basis: 'unresolved_review_conflict',
      nextItemIds: [CONFLICT_ITEM_ID],
    })
    expect(
      deriveNextVerificationAction(
        replaceResults(base, {
          inspect_review_conflicts: result('inspect_review_conflicts', {
            facts: [fact('unresolved_conflict_items', 0)],
            records: [],
          }),
          inspect_sampling_plan: result('inspect_sampling_plan', {
            facts: [fact('sampling_purpose', 'failure_discovery')],
          }),
        }),
        2,
      ),
    ).toMatchObject({
      action: 'failure_discovery',
      basis: 'targeted_failure_discovery',
      nextItemIds: [CONFLICT_ITEM_ID, PENDING_ITEM_ID],
    })
    expect(
      deriveNextVerificationAction(
        replaceResults(base, {
          inspect_review_conflicts: result('inspect_review_conflicts', {
            facts: [fact('unresolved_conflict_items', 0)],
            records: [],
          }),
          inspect_sampling_plan: result('inspect_sampling_plan', {
            facts: [fact('sampling_purpose', 'quality_estimation')],
          }),
        }),
        2,
      ),
    ).toMatchObject({
      action: 'reference_shortfall',
      basis: 'reference_readiness_blocker',
    })
    expect(
      deriveNextVerificationAction(
        replaceResults(base, {
          inspect_review_conflicts: result('inspect_review_conflicts', {
            facts: [fact('unresolved_conflict_items', 0)],
            records: [],
          }),
          inspect_reference_readiness: result(
            'inspect_reference_readiness',
            {
              facts: [fact('reference_readiness_status', 'ready')],
            },
          ),
        }),
        2,
      ),
    ).toMatchObject({
      action: 'unbiased_audit',
      basis: 'representative_sampling_plan',
      nextItemIds: [CONFLICT_ITEM_ID, PENDING_ITEM_ID],
    })
  })

  it('explains exact snapshot deltas without assigning causality to one review', async () => {
    const results = qualityToolResults()
    const transport = new ScriptedTransport([
      response('quality-response-1', [
        functionCall(
          'quality-call-1',
          'inspect_verification_campaign',
          { campaign_id: CAMPAIGN_ID },
        ),
      ]),
      response('quality-response-2', [
        functionCall('quality-call-2', 'inspect_sampling_plan', {
          campaign_id: CAMPAIGN_ID,
        }),
      ]),
      response('quality-response-3', [
        functionCall('quality-call-3', 'inspect_quality_snapshot', {
          campaign_id: CAMPAIGN_ID,
          snapshot_sha256: BEFORE_SNAPSHOT_SHA,
        }),
      ]),
      response('quality-response-4', [
        functionCall('quality-call-4', 'inspect_quality_snapshot', {
          campaign_id: CAMPAIGN_ID,
          snapshot_sha256: SNAPSHOT_SHA,
        }),
      ]),
      response('quality-response-5', [
        functionCall('quality-call-5', 'explain_quality_change', {
          campaign_id: CAMPAIGN_ID,
          before_snapshot_sha256: BEFORE_SNAPSHOT_SHA,
          after_snapshot_sha256: SNAPSHOT_SHA,
        }),
      ]),
      response('quality-response-6', [], qualityOutput()),
    ])

    const run = await runVerificationAnalyst(
      {
        requestKind: 'quality_change',
        request: 'Why did the recorded quality state change after review?',
        beforeSnapshotSha256: BEFORE_SNAPSHOT_SHA,
        snapshotSha256: SNAPSHOT_SHA,
      },
      evidence(),
      transport,
      executor(results),
    )

    expect(run.output.recommendation).toBeNull()
    expect(run.output.qualityChange).toMatchObject({
      beforeSnapshotSha256: BEFORE_SNAPSHOT_SHA,
      afterSnapshotSha256: SNAPSHOT_SHA,
      status: 'partial',
      changedFactIds: [
        'attempted_items_delta',
        'unresolved_conflicts_delta',
      ],
      causalEffectClaimed: false,
    })
    expect(run.toolReceipts.map(({ tool }) => tool)).toEqual([
      'inspect_verification_campaign',
      'inspect_sampling_plan',
      'inspect_quality_snapshot',
      'inspect_quality_snapshot',
      'explain_quality_change',
    ])
    expect(transport.requests[0]?.tools).toHaveLength(4)
    expect(transport.requests[0]?.instructions).toContain(
      'before and after snapshots',
    )

    const causal = qualityOutput()
    causal.qualityChange!.explanation =
      'This individual review caused the conflict rate to change.'
    await expect(runQualityScriptedFinal(causal)).rejects.toMatchObject({
      code: 'invalid_model_output',
    })
  })

  it('uses bounded Programmatic Tool Calling for deterministic campaign analysis', async () => {
    const results = campaignToolResults()
    const calls: readonly [
      VerificationToolName,
      Readonly<Record<string, unknown>>,
    ][] = [
      ['inspect_verification_campaign', { campaign_id: CAMPAIGN_ID }],
      ['inspect_review_coverage', { campaign_id: CAMPAIGN_ID }],
      ['inspect_review_conflicts', { campaign_id: CAMPAIGN_ID }],
      ['inspect_sampling_plan', { campaign_id: CAMPAIGN_ID }],
      [
        'inspect_quality_snapshot',
        { campaign_id: CAMPAIGN_ID, snapshot_sha256: SNAPSHOT_SHA },
      ],
      [
        'inspect_reference_readiness',
        { campaign_id: CAMPAIGN_ID, snapshot_sha256: SNAPSHOT_SHA },
      ],
      [
        'recommend_next_review_batch',
        { campaign_id: CAMPAIGN_ID, batch_size: 2 },
      ],
    ]
    const transport = new ScriptedTransport([
      response('campaign-response-1', [
        program(
          'campaign-program-item',
          'campaign-program-call',
          `throw new Error('TaxaLens must never execute this program locally')`,
          'opaque-program-fingerprint-v1',
        ),
        ...calls.map(([name, args], index) =>
          programFunctionCall(
            `campaign-function-call-${index}`,
            'campaign-program-call',
            name,
            args,
          ),
        ),
      ]),
      response('campaign-response-2', [
        programOutput(
          'campaign-program-output',
          'campaign-program-call',
          '{"completed":true}',
        ),
      ]),
      response('campaign-response-3', [], campaignOutput()),
    ])

    const run = await runVerificationAnalyst(
      {
        requestKind: 'campaign_analysis',
        request:
          'Join review state to strata, calculate blockers, rank priorities, and aggregate conflicts.',
        snapshotSha256: SNAPSHOT_SHA,
        batchSize: 2,
      },
      evidence(),
      transport,
      executor(results),
    )

    expect(run).toMatchObject({
      schemaVersion: 'taxalens-verification-analyst-run:v1.2.0',
      toolCallingMode: 'programmatic',
      programCallCount: 1,
      budget: {
        maxToolCalls: 8,
        usedToolCalls: 7,
        maxResponseTurns: 10,
        usedResponseTurns: 3,
        exhausted: false,
      },
    })
    expect(run.toolReceipts.every(({ caller }) => caller.type === 'programmatic'))
      .toBe(true)
    expect(run.output.campaignAnalysis).toEqual(
      expect.objectContaining({
        status: 'blocked',
        blockerIds: [
          `conflict:${CONFLICT_ITEM_ID}`,
          'quality:precision:missing_interval',
          'reference:readiness:independent_taxonomic_verification_missing',
        ],
        priorityItemIds: [CONFLICT_ITEM_ID, PENDING_ITEM_ID],
        conflictItemIds: [CONFLICT_ITEM_ID],
        strata: [
          {
            stratumId: 'adult',
            label: 'Adult',
            itemCount: 1,
            eventCount: 2,
            attemptedItems: 1,
            decisiveItems: 0,
            unresolvedConflictItems: 1,
            priorityItemIds: [CONFLICT_ITEM_ID],
          },
          {
            stratumId: 'larva',
            label: 'Larva',
            itemCount: 1,
            eventCount: 1,
            attemptedItems: 1,
            decisiveItems: 0,
            unresolvedConflictItems: 0,
            priorityItemIds: [PENDING_ITEM_ID],
          },
        ],
      }),
    )
    expect(run.output.recommendation).toBeNull()
    expect(run.output.qualityChange).toBeNull()
    expect(transport.requests[0]).toMatchObject({
      tool_choice: { type: 'programmatic_tool_calling' },
    })
    expect(transport.requests[0]?.tools).toHaveLength(8)
    expect(transport.requests[0]?.tools?.[0]).toEqual({
      type: 'programmatic_tool_calling',
    })
    expect(
      transport.requests[0]?.tools
        ?.filter((tool) => tool.type === 'function')
        .every(
          ({ allowed_callers }) =>
            JSON.stringify(allowed_callers) ===
            JSON.stringify(['programmatic']),
        ),
    ).toBe(true)
    expect(transport.requests[1]?.tool_choice).toBe('auto')
    expect(inputItems(transport.requests[1]!).map(itemType)).toEqual([
      'message',
      'program',
      'function_call',
      'function_call',
      'function_call',
      'function_call',
      'function_call',
      'function_call',
      'function_call',
      'function_call_output',
      'function_call_output',
      'function_call_output',
      'function_call_output',
      'function_call_output',
      'function_call_output',
      'function_call_output',
    ])
    expect(JSON.stringify(transport.requests[1])).toContain(
      'opaque-program-fingerprint-v1',
    )
    expect(JSON.stringify(run)).not.toContain(
      'opaque-program-fingerprint-v1',
    )
    expect(JSON.stringify(run)).not.toContain(
      'TaxaLens must never execute this program locally',
    )
  })

  it('rejects direct or unbound campaign calls and model-modified campaign calculations', async () => {
    const directTransport = new ScriptedTransport([
      response('campaign-direct-response', [
        program(
          'campaign-direct-program',
          'campaign-direct-program-call',
          'return null',
          'campaign-direct-fingerprint',
        ),
        functionCall(
          'campaign-direct-function',
          'inspect_verification_campaign',
          { campaign_id: CAMPAIGN_ID },
        ),
      ]),
    ])
    await expect(
      runVerificationAnalyst(
        {
          requestKind: 'campaign_analysis',
          request: 'Analyse the campaign.',
          snapshotSha256: SNAPSHOT_SHA,
          batchSize: 2,
        },
        evidence(),
        directTransport,
        executor(campaignToolResults()),
      ),
    ).rejects.toMatchObject({ code: 'invalid_tool_call' })

    const unboundTransport = new ScriptedTransport([
      response('campaign-unbound-response', [
        program(
          'campaign-known-program',
          'campaign-known-program-call',
          'return null',
          'campaign-known-fingerprint',
        ),
        programFunctionCall(
          'campaign-unbound-function',
          'another-program-call',
          'inspect_verification_campaign',
          { campaign_id: CAMPAIGN_ID },
        ),
      ]),
    ])
    await expect(
      runVerificationAnalyst(
        {
          requestKind: 'campaign_analysis',
          request: 'Analyse the campaign.',
          snapshotSha256: SNAPSHOT_SHA,
          batchSize: 2,
        },
        evidence(),
        unboundTransport,
        executor(campaignToolResults()),
      ),
    ).rejects.toMatchObject({ code: 'invalid_tool_call' })

    const changed = campaignOutput()
    changed.campaignAnalysis!.priorityItemIds.reverse()
    await expect(runCampaignScriptedFinal(changed)).rejects.toMatchObject({
      code: 'invalid_model_output',
    })
  })

  it('rejects model-selected actions, invented items, and guarantee claims', async () => {
    const wrongAction = analystOutput()
    wrongAction.recommendation!.action = 'unbiased_audit'
    wrongAction.recommendation!.basis = 'representative_sampling_plan'
    await expect(runScriptedFinal(wrongAction)).rejects.toMatchObject({
      code: 'invalid_model_output',
    })

    const inventedItem = analystOutput()
    inventedItem.recommendation!.nextItemIds = ['model-generated-item']
    await expect(runScriptedFinal(inventedItem)).rejects.toMatchObject({
      code: 'invalid_model_output',
    })

    const guarantee = analystOutput()
    guarantee.answer =
      'This adjudication guarantees accuracy and approves scientific release.'
    await expect(runScriptedFinal(guarantee)).rejects.toMatchObject({
      code: 'invalid_model_output',
    })
  })

  it('fails closed on missing tools, wrong bindings, and program callers', async () => {
    const earlyFinal = new ScriptedTransport([
      response('early-1', [
        functionCall('early-call-1', 'inspect_verification_campaign', {
          campaign_id: CAMPAIGN_ID,
        }),
      ]),
      response('early-2', [], analystOutput()),
    ])
    await expect(
      runVerificationAnalyst(
        analystInput(),
        evidence(),
        earlyFinal,
        executor(toolResults()),
      ),
    ).rejects.toMatchObject({ code: 'invalid_model_output' })

    const wrongSnapshot = new ScriptedTransport([
      response('wrong-snapshot-1', [
        functionCall(
          'wrong-snapshot-call',
          'inspect_verification_campaign',
          { campaign_id: CAMPAIGN_ID },
        ),
      ]),
      response('wrong-snapshot-2', [
        functionCall(
          'wrong-snapshot-call-2',
          'inspect_reference_readiness',
          {
            campaign_id: CAMPAIGN_ID,
            snapshot_sha256: 'b'.repeat(64),
          },
        ),
      ]),
    ])
    await expect(
      runVerificationAnalyst(
        analystInput(),
        evidence(),
        wrongSnapshot,
        executor(toolResults()),
      ),
    ).rejects.toMatchObject({ code: 'invalid_tool_call' })

    const programCall = functionCall(
      'program-call',
      'inspect_verification_campaign',
      { campaign_id: CAMPAIGN_ID },
    )
    programCall.caller = {
      type: 'program',
      caller_id: 'program-1',
    }
    const programTransport = new ScriptedTransport([
      response('program-response', [programCall]),
    ])
    await expect(
      runVerificationAnalyst(
        analystInput(),
        evidence(),
        programTransport,
        executor(toolResults()),
      ),
    ).rejects.toMatchObject({ code: 'invalid_tool_call' })

    await expect(
      runVerificationAnalyst(
        { ...analystInput(), snapshotSha256: 'c'.repeat(64) },
        evidence(),
        new ScriptedTransport([]),
        executor(toolResults()),
      ),
    ).rejects.toBeInstanceOf(VerificationAnalystError)
  })
})

class ScriptedTransport implements VerificationAnalystResponsesTransport {
  readonly requests: ResponseCreateParamsNonStreaming[] = []
  readonly #responses: readonly VerificationAnalystTransportResponse[]

  constructor(responses: readonly VerificationAnalystTransportResponse[]) {
    this.#responses = responses
  }

  async create(
    request: ResponseCreateParamsNonStreaming,
  ): Promise<VerificationAnalystTransportResponse> {
    this.requests.push(request)
    const responseValue = this.#responses[this.requests.length - 1]
    if (responseValue === undefined) {
      throw new Error('No scripted verification response remains')
    }
    return responseValue
  }
}

function response(
  id: string,
  output: readonly ResponseOutputItem[],
  outputValue?: unknown,
): VerificationAnalystTransportResponse {
  return {
    id,
    model: VERIFICATION_ANALYST_MODEL,
    status: 'completed',
    output,
    output_text:
      outputValue === undefined ? '' : JSON.stringify(outputValue),
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

function program(
  id: string,
  callId: string,
  code: string,
  fingerprint: string,
): Extract<ResponseOutputItem, { type: 'program' }> {
  return {
    id,
    call_id: callId,
    code,
    fingerprint,
    type: 'program',
  }
}

function programOutput(
  id: string,
  callId: string,
  result: string,
): Extract<ResponseOutputItem, { type: 'program_output' }> {
  return {
    id,
    call_id: callId,
    result,
    status: 'completed',
    type: 'program_output',
  }
}

function programFunctionCall(
  callId: string,
  programCallId: string,
  name: string,
  args: Readonly<Record<string, unknown>>,
): ResponseFunctionToolCall {
  return {
    ...functionCall(callId, name, args),
    caller: {
      type: 'program',
      caller_id: programCallId,
    },
  }
}

function analystInput() {
  return {
    requestKind: 'next_review_action' as const,
    request: 'What is the next bounded human review action?',
    snapshotSha256: SNAPSHOT_SHA,
    batchSize: 2,
  }
}

function analystOutput(): Mutable<VerificationAnalystOutput> {
  const artifactIds = citations().map(({ artifactId }) => artifactId)
  return {
    schemaVersion: VERIFICATION_ANALYST_OUTPUT_VERSION,
    requestKind: 'next_review_action',
    campaign: {
      campaignId: CAMPAIGN_ID,
      title: 'Verification analyst campaign',
      target: {
        acceptedTaxonKey: 'gbif:1938069',
        scientificName: 'Papilio demoleus',
      },
    },
    recommendation: {
      action: 'adjudication',
      basis: 'unresolved_review_conflict',
      nextItemIds: [CONFLICT_ITEM_ID],
      why:
        'One recorded reviewer disagreement remains unresolved, so independent adjudication addresses the current decision blocker before another sampled review.',
      artifactIds: [...artifactIds],
    },
    qualityChange: null,
    campaignAnalysis: null,
    evidenceBackedClaims: [
      {
        id: 'unresolved-conflict',
        claim:
          'The event-ledger consensus retains one unresolved reviewer disagreement.',
        artifactIds: [...artifactIds],
      },
    ],
    unavailableEvidence: [],
    answer:
      'Assign the conflicted item to an independent adjudicator and retain both source reviews.',
    limitations: [
      'This recommendation addresses a recorded blocker and does not predict a quality or release outcome.',
    ],
    artifactIds: [...artifactIds],
    externalActionsExecuted: false,
    unsupportedClaimsRejected: true,
    scientificClaimAllowed: false,
  }
}

function qualityOutput(): Mutable<VerificationAnalystOutput> {
  const artifactIds = citations().map(({ artifactId }) => artifactId)
  return {
    schemaVersion: VERIFICATION_ANALYST_OUTPUT_VERSION,
    requestKind: 'quality_change',
    campaign: {
      campaignId: CAMPAIGN_ID,
      title: 'Verification analyst campaign',
      target: {
        acceptedTaxonKey: 'gbif:1938069',
        scientificName: 'Papilio demoleus',
      },
    },
    recommendation: null,
    qualityChange: {
      beforeSnapshotSha256: BEFORE_SNAPSHOT_SHA,
      afterSnapshotSha256: SNAPSHOT_SHA,
      status: 'partial',
      changedFactIds: [
        'attempted_items_delta',
        'unresolved_conflicts_delta',
      ],
      explanation:
        'Between the immutable snapshots, attempted items increased from one to two and unresolved conflicts increased from zero to one; the evidence records deltas without assigning an individual causal effect.',
      artifactIds: [...artifactIds],
      causalEffectClaimed: false,
    },
    campaignAnalysis: null,
    evidenceBackedClaims: [
      {
        id: 'recorded-quality-deltas',
        claim:
          'The exact snapshots record one additional attempted item and one additional unresolved conflict.',
        artifactIds: [...artifactIds],
      },
    ],
    unavailableEvidence: [
      {
        topic: 'Individual-review causality',
        reason:
          'The immutable before-and-after snapshots do not identify a causal effect for one review.',
        artifactIds: [...artifactIds],
      },
    ],
    answer:
      'The recorded state changed in coverage and conflict counts; this is a snapshot comparison, not a causal attribution.',
    limitations: [
      'A before-and-after delta does not prove why an individual metric moved.',
    ],
    artifactIds: [...artifactIds],
    externalActionsExecuted: false,
    unsupportedClaimsRejected: true,
    scientificClaimAllowed: false,
  }
}

function campaignOutput(): Mutable<VerificationAnalystOutput> {
  const artifactIds = citations().map(({ artifactId }) => artifactId)
  const deterministic = deriveVerificationCampaignAnalysis(
    campaignToolResults(),
    evidence(),
  )
  return {
    schemaVersion: VERIFICATION_ANALYST_OUTPUT_VERSION,
    requestKind: 'campaign_analysis',
    campaign: {
      campaignId: CAMPAIGN_ID,
      title: 'Verification analyst campaign',
      target: {
        acceptedTaxonKey: 'gbif:1938069',
        scientificName: 'Papilio demoleus',
      },
    },
    recommendation: null,
    qualityChange: null,
    campaignAnalysis: {
      status: deterministic.status,
      strata: deterministic.strata.map((stratum) => ({
        ...stratum,
        priorityItemIds: [...stratum.priorityItemIds],
      })),
      blockerIds: [...deterministic.blockerIds],
      priorityItemIds: [...deterministic.priorityItemIds],
      conflictItemIds: [...deterministic.conflictItemIds],
      summary:
        'The deterministic join retains one unresolved adult conflict, one pending larval priority, and the recorded quality and reference blockers.',
      artifactIds: [...artifactIds],
    },
    evidenceBackedClaims: [
      {
        id: 'bounded-campaign-analysis',
        claim:
          'The exact campaign evidence contains two attempted strata, one unresolved conflict, and two ranked existing item IDs.',
        artifactIds: [...artifactIds],
      },
    ],
    unavailableEvidence: [],
    answer:
      'Resolve the retained conflict and reference and interval blockers before any separate scientific-promotion assessment.',
    limitations: [
      'The analysis is descriptive and does not make a scientific release claim.',
    ],
    artifactIds: [...artifactIds],
    externalActionsExecuted: false,
    unsupportedClaimsRejected: true,
    scientificClaimAllowed: false,
  }
}

function evidence(): VerificationToolEvidence {
  return {
    schemaVersion: 'taxalens-verification-tool-evidence:v1.1.0',
    evidenceId: 'verification-analyst-test-evidence',
    campaign: {
      campaignId: CAMPAIGN_ID,
      title: 'Verification analyst campaign',
      targetTaxon: {
        acceptedTaxonKey: 'gbif:1938069',
        scientificName: 'Papilio demoleus',
      },
      samplingPlan: {
        purpose: 'quality_estimation',
        strata: [
          { stratumId: 'adult', label: 'Adult' },
          { stratumId: 'larva', label: 'Larva' },
        ],
      },
    },
    items: [
      { itemId: CONFLICT_ITEM_ID, samplingStratumId: 'adult' },
      { itemId: PENDING_ITEM_ID, samplingStratumId: 'larva' },
    ],
    events: [
      { itemId: CONFLICT_ITEM_ID },
      { itemId: CONFLICT_ITEM_ID },
      { itemId: PENDING_ITEM_ID },
    ],
    consensus: [
      {
        itemId: CONFLICT_ITEM_ID,
        effectiveReviewCount: 2,
        status: 'unresolved_disagreement',
        consensusOutcome: null,
      },
      {
        itemId: PENDING_ITEM_ID,
        effectiveReviewCount: 1,
        status: 'pending',
        consensusOutcome: null,
      },
    ],
    inspections: {},
    qualitySnapshots: [
      {
        snapshotSha256: BEFORE_SNAPSHOT_SHA,
        capturedAt: '2026-07-16T19:00:00.000Z',
      },
      {
        snapshotSha256: SNAPSHOT_SHA,
        capturedAt: '2026-07-16T19:30:00.000Z',
      },
    ],
    artifactCitations: citations(),
  } as unknown as VerificationToolEvidence
}

function citations(): readonly VerificationArtifactCitation[] {
  const values: readonly [
    VerificationArtifactCitation['artifactKind'],
    string,
    string,
  ][] = [
    ['campaign_manifest', 'campaign-manifest', '1'.repeat(64)],
    ['item_manifest', 'item-manifest', '2'.repeat(64)],
    ['event_ledger', 'event-ledger', '3'.repeat(64)],
    ['consensus', 'consensus', '4'.repeat(64)],
    ['quality_snapshot', 'quality-snapshot', SNAPSHOT_SHA],
    ['biominer_source', 'biominer-source', '5'.repeat(64)],
  ]
  return values.map(([artifactKind, artifactId, sha256]) => ({
    schemaVersion: VERIFICATION_ARTIFACT_CITATION_VERSION,
    artifactKind,
    artifactId,
    sha256,
    sourceRepository:
      artifactKind === 'biominer_source'
        ? 'karikris/BioMiner'
        : 'karikris/taxalens',
    sourceCommit:
      artifactKind === 'biominer_source' ? BIOMINER_SHA : TAXALENS_SHA,
    sourcePath: `fixtures/${artifactId}.json`,
  }))
}

function toolResults(): readonly VerificationToolResult[] {
  return [
    result('inspect_verification_campaign'),
    result('inspect_review_conflicts', {
      status: 'blocked',
      facts: [fact('unresolved_conflict_items', 1)],
      records: [
        {
          id: CONFLICT_ITEM_ID,
          label: CONFLICT_ITEM_ID,
          status: 'blocked',
          detail: 'Unresolved fields: outcome.',
        },
      ],
    }),
    result('inspect_sampling_plan', {
      facts: [fact('sampling_purpose', 'quality_estimation')],
    }),
    result('inspect_reference_readiness', {
      status: 'blocked',
      facts: [fact('reference_readiness_status', 'not_ready')],
    }),
    result('recommend_next_review_batch', {
      records: [
        {
          id: CONFLICT_ITEM_ID,
          label: CONFLICT_ITEM_ID,
          status: 'blocked',
          detail: 'Resolve disagreement.',
        },
        {
          id: PENDING_ITEM_ID,
          label: PENDING_ITEM_ID,
          status: 'pending',
          detail: 'Complete the next review.',
        },
      ],
    }),
  ]
}

function qualityToolResults(): readonly VerificationToolResult[] {
  return [
    result('inspect_verification_campaign'),
    result('inspect_sampling_plan', {
      facts: [fact('sampling_purpose', 'quality_estimation')],
    }),
    result('inspect_quality_snapshot', {
      status: 'partial',
      summary: `Before snapshot ${BEFORE_SNAPSHOT_SHA}.`,
      facts: [fact('attempted_items', 1)],
    }),
    result('inspect_quality_snapshot', {
      status: 'partial',
      summary: `After snapshot ${SNAPSHOT_SHA}.`,
      facts: [fact('attempted_items', 2)],
    }),
    result('explain_quality_change', {
      status: 'partial',
      facts: [
        fact('attempted_items_delta', 1),
        fact('unresolved_conflicts_delta', 1),
      ],
      records: [
        {
          id: 'attempted_items_delta',
          label: 'Attempted items delta',
          status: 'available',
          detail: 'Changed from 1 to 2.',
        },
        {
          id: 'unresolved_conflicts_delta',
          label: 'Unresolved conflicts delta',
          status: 'available',
          detail: 'Changed from 0 to 1.',
        },
      ],
      limitations: [
        'The recorded deltas do not infer a causal effect for an individual review.',
      ],
    }),
  ]
}

function campaignToolResults(): readonly VerificationToolResult[] {
  return [
    result('inspect_verification_campaign', {
      facts: [
        fact('item_count', 2),
        fact('event_count', 3),
      ],
    }),
    result('inspect_review_coverage', {
      facts: [
        fact('attempted_items', 2),
        fact('decisively_reviewed_items', 0),
      ],
    }),
    result('inspect_review_conflicts', {
      status: 'blocked',
      facts: [fact('unresolved_conflict_items', 1)],
      records: [
        {
          id: CONFLICT_ITEM_ID,
          label: CONFLICT_ITEM_ID,
          status: 'blocked',
          detail: 'Unresolved fields: outcome.',
        },
      ],
    }),
    result('inspect_sampling_plan', {
      facts: [fact('sampling_purpose', 'quality_estimation')],
      records: [
        {
          id: 'adult',
          label: 'Adult',
          status: 'metadata',
          detail: 'Population=1; target=1; weight=0.5.',
        },
        {
          id: 'larva',
          label: 'Larva',
          status: 'metadata',
          detail: 'Population=1; target=1; weight=0.5.',
        },
      ],
    }),
    result('inspect_quality_snapshot', {
      status: 'partial',
      facts: [fact('precision_interval_lower', null)],
      records: [
        {
          id: 'precision:missing_interval',
          label: 'missing_interval',
          status: 'blocked',
          detail: 'Precision interval blocker.',
        },
      ],
    }),
    result('inspect_reference_readiness', {
      status: 'blocked',
      facts: [fact('reference_readiness_status', 'not_ready')],
      records: [
        {
          id: 'readiness:independent_taxonomic_verification_missing',
          label: 'independent_taxonomic_verification_missing',
          status: 'blocked',
          detail: 'Reference-readiness blocker.',
        },
      ],
    }),
    result('recommend_next_review_batch', {
      records: [
        {
          id: CONFLICT_ITEM_ID,
          label: CONFLICT_ITEM_ID,
          status: 'blocked',
          detail: 'Resolve disagreement.',
        },
        {
          id: PENDING_ITEM_ID,
          label: PENDING_ITEM_ID,
          status: 'pending',
          detail: 'Complete the next review.',
        },
      ],
    }),
  ]
}

function result(
  tool: VerificationToolName,
  overrides: Partial<VerificationToolResult> = {},
): VerificationToolResult {
  const artifactCitations = citations()
  return {
    schemaVersion: VERIFICATION_TOOL_RESULT_VERSION,
    tool,
    status: 'available',
    campaignId: CAMPAIGN_ID,
    summary: `${tool} test result.`,
    facts: [],
    records: [],
    artifactIds: artifactCitations.map(({ artifactId }) => artifactId),
    artifactCitations,
    limitations: [],
    scientificClaimAllowed: false,
    ...overrides,
  }
}

function fact(
  id: string,
  value: boolean | null | number | string,
): VerificationToolResult['facts'][number] {
  return {
    id,
    label: id,
    value,
    status: 'verified',
  }
}

function executor(
  results: readonly VerificationToolResult[],
) {
  const remaining = new Map<VerificationToolName, VerificationToolResult[]>()
  for (const resultValue of results) {
    const queue = remaining.get(resultValue.tool) ?? []
    queue.push(resultValue)
    remaining.set(resultValue.tool, queue)
  }
  return async (name: string): Promise<VerificationToolResult> => {
    const queue = remaining.get(name as VerificationToolName)
    const resultValue = queue?.shift()
    if (resultValue === undefined) {
      throw new Error(`No test result for ${name}`)
    }
    return resultValue
  }
}

function replaceResults(
  results: readonly VerificationToolResult[],
  replacements: Partial<
    Readonly<Record<VerificationToolName, VerificationToolResult>>
  >,
): readonly VerificationToolResult[] {
  return results.map((resultValue) => replacements[resultValue.tool] ?? resultValue)
}

async function runScriptedFinal(
  output: unknown,
): Promise<unknown> {
  const calls: readonly [
    VerificationToolName,
    Readonly<Record<string, unknown>>,
  ][] = [
    ['inspect_verification_campaign', { campaign_id: CAMPAIGN_ID }],
    ['inspect_review_conflicts', { campaign_id: CAMPAIGN_ID }],
    ['inspect_sampling_plan', { campaign_id: CAMPAIGN_ID }],
    [
      'inspect_reference_readiness',
      {
        campaign_id: CAMPAIGN_ID,
        snapshot_sha256: SNAPSHOT_SHA,
      },
    ],
    [
      'recommend_next_review_batch',
      { campaign_id: CAMPAIGN_ID, batch_size: 2 },
    ],
  ]
  const transport = new ScriptedTransport([
    ...calls.map(([name, args], index) =>
      response(`validation-response-${index}`, [
        functionCall(`validation-call-${index}`, name, args),
      ]),
    ),
    response('validation-final', [], output),
  ])
  return runVerificationAnalyst(
    analystInput(),
    evidence(),
    transport,
    executor(toolResults()),
  )
}

async function runQualityScriptedFinal(
  output: unknown,
): Promise<unknown> {
  const calls: readonly [
    VerificationToolName,
    Readonly<Record<string, unknown>>,
  ][] = [
    ['inspect_verification_campaign', { campaign_id: CAMPAIGN_ID }],
    ['inspect_sampling_plan', { campaign_id: CAMPAIGN_ID }],
    [
      'inspect_quality_snapshot',
      {
        campaign_id: CAMPAIGN_ID,
        snapshot_sha256: BEFORE_SNAPSHOT_SHA,
      },
    ],
    [
      'inspect_quality_snapshot',
      {
        campaign_id: CAMPAIGN_ID,
        snapshot_sha256: SNAPSHOT_SHA,
      },
    ],
    [
      'explain_quality_change',
      {
        campaign_id: CAMPAIGN_ID,
        before_snapshot_sha256: BEFORE_SNAPSHOT_SHA,
        after_snapshot_sha256: SNAPSHOT_SHA,
      },
    ],
  ]
  const transport = new ScriptedTransport([
    ...calls.map(([name, args], index) =>
      response(`quality-validation-response-${index}`, [
        functionCall(`quality-validation-call-${index}`, name, args),
      ]),
    ),
    response('quality-validation-final', [], output),
  ])
  return runVerificationAnalyst(
    {
      requestKind: 'quality_change',
      request: 'Explain the recorded quality change.',
      beforeSnapshotSha256: BEFORE_SNAPSHOT_SHA,
      snapshotSha256: SNAPSHOT_SHA,
    },
    evidence(),
    transport,
    executor(qualityToolResults()),
  )
}

async function runCampaignScriptedFinal(
  output: unknown,
): Promise<unknown> {
  const calls: readonly [
    VerificationToolName,
    Readonly<Record<string, unknown>>,
  ][] = [
    ['inspect_verification_campaign', { campaign_id: CAMPAIGN_ID }],
    ['inspect_review_coverage', { campaign_id: CAMPAIGN_ID }],
    ['inspect_review_conflicts', { campaign_id: CAMPAIGN_ID }],
    ['inspect_sampling_plan', { campaign_id: CAMPAIGN_ID }],
    [
      'inspect_quality_snapshot',
      { campaign_id: CAMPAIGN_ID, snapshot_sha256: SNAPSHOT_SHA },
    ],
    [
      'inspect_reference_readiness',
      { campaign_id: CAMPAIGN_ID, snapshot_sha256: SNAPSHOT_SHA },
    ],
    [
      'recommend_next_review_batch',
      { campaign_id: CAMPAIGN_ID, batch_size: 2 },
    ],
  ]
  const transport = new ScriptedTransport([
    response('campaign-validation-response', [
      program(
        'campaign-validation-program',
        'campaign-validation-program-call',
        'return verification_tools',
        'campaign-validation-fingerprint',
      ),
      ...calls.map(([name, args], index) =>
        programFunctionCall(
          `campaign-validation-function-${index}`,
          'campaign-validation-program-call',
          name,
          args,
        ),
      ),
    ]),
    response('campaign-validation-final', [], output),
  ])
  return runVerificationAnalyst(
    {
      requestKind: 'campaign_analysis',
      request: 'Analyse the deterministic campaign state.',
      snapshotSha256: SNAPSHOT_SHA,
      batchSize: 2,
    },
    evidence(),
    transport,
    executor(campaignToolResults()),
  )
}

function inputItems(
  request: ResponseCreateParamsNonStreaming,
): readonly unknown[] {
  return Array.isArray(request.input) ? request.input : []
}

function itemType(item: unknown): string {
  return typeof item === 'object' && item !== null && 'type' in item
    ? String(item.type)
    : 'message'
}

type Mutable<Value> =
  Value extends readonly (infer Item)[]
    ? Mutable<Item>[]
    : Value extends object
      ? { -readonly [Key in keyof Value]: Mutable<Value[Key]> }
      : Value
