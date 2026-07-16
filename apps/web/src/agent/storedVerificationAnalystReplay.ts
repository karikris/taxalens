import Ajv2020, { type ErrorObject } from 'ajv/dist/2020.js'
import type {
  ResponseCreateParamsNonStreaming,
  ResponseOutputItem,
} from 'openai/resources/responses/responses'

import storedReplayJson from './fixtures/verificationAnalystStoredReplay.json'
import {
  runVerificationAnalyst,
  type VerificationAnalystResponsesTransport,
  type VerificationAnalystTransportResponse,
} from './verificationAnalyst'
import {
  VERIFICATION_ANALYST_MODEL,
  type VerificationAnalystInput,
  type VerificationAnalystRun,
} from './verificationAnalystContract'
import type { VerificationToolEvidence } from './verificationTools'

export const STORED_VERIFICATION_ANALYST_REPLAY_VERSION =
  'taxalens-stored-verification-analyst-replay:v1.0.0' as const

interface StoredVerificationAnalystReplay {
  readonly schemaVersion: typeof STORED_VERIFICATION_ANALYST_REPLAY_VERSION
  readonly request: VerificationAnalystInput
  readonly responses: readonly VerificationAnalystTransportResponse[]
  readonly storage: {
    readonly storedOutputOnly: true
    readonly liveRequestExecuted: false
    readonly credentialsRequired: false
    readonly syntheticEvaluationEvidence: true
    readonly scientificEvaluation: false
  }
}

export class StoredVerificationAnalystReplayError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StoredVerificationAnalystReplayError'
  }
}

const FUNCTION_CALL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    type: { type: 'string', const: 'function_call' },
    call_id: { type: 'string' },
    name: { type: 'string' },
    arguments: { type: 'string' },
    caller: {
      type: 'object',
      additionalProperties: false,
      properties: {
        type: { type: 'string', const: 'direct' },
      },
      required: ['type'],
    },
    status: { type: 'string', const: 'completed' },
  },
  required: [
    'type',
    'call_id',
    'name',
    'arguments',
    'caller',
    'status',
  ],
}

const STORED_REPLAY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    schemaVersion: {
      type: 'string',
      const: STORED_VERIFICATION_ANALYST_REPLAY_VERSION,
    },
    request: {
      type: 'object',
      additionalProperties: false,
      properties: {
        requestKind: { type: 'string', const: 'next_review_action' },
        request: { type: 'string' },
        snapshotSha256: {
          type: 'string',
          pattern: '^[a-f0-9]{64}$',
        },
        batchSize: { type: 'integer', minimum: 1, maximum: 50 },
        reasoningEffort: {
          type: 'string',
          enum: ['medium', 'high'],
        },
        budget: {
          type: 'object',
          additionalProperties: false,
          properties: {
            maxToolCalls: { type: 'integer', minimum: 5, maximum: 8 },
            maxResponseTurns: { type: 'integer', minimum: 2, maximum: 10 },
          },
          required: ['maxToolCalls', 'maxResponseTurns'],
        },
      },
      required: [
        'requestKind',
        'request',
        'snapshotSha256',
        'batchSize',
        'reasoningEffort',
        'budget',
      ],
    },
    responses: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          model: { type: 'string', const: VERIFICATION_ANALYST_MODEL },
          status: { type: 'string', const: 'completed' },
          output: {
            type: 'array',
            items: FUNCTION_CALL_SCHEMA,
          },
          output_text: { type: 'string' },
          usage: { type: 'null' },
        },
        required: [
          'id',
          'model',
          'status',
          'output',
          'output_text',
          'usage',
        ],
      },
    },
    storage: {
      type: 'object',
      additionalProperties: false,
      properties: {
        storedOutputOnly: { type: 'boolean', const: true },
        liveRequestExecuted: { type: 'boolean', const: false },
        credentialsRequired: { type: 'boolean', const: false },
        syntheticEvaluationEvidence: { type: 'boolean', const: true },
        scientificEvaluation: { type: 'boolean', const: false },
      },
      required: [
        'storedOutputOnly',
        'liveRequestExecuted',
        'credentialsRequired',
        'syntheticEvaluationEvidence',
        'scientificEvaluation',
      ],
    },
  },
  required: ['schemaVersion', 'request', 'responses', 'storage'],
}

const ajv = new Ajv2020({ allErrors: true, strict: true })
const validateStoredReplay =
  ajv.compile<StoredVerificationAnalystReplay>(STORED_REPLAY_SCHEMA)

export async function loadStoredVerificationAnalystReplay(
  evidence: VerificationToolEvidence,
  storedValue: unknown = storedReplayJson,
): Promise<VerificationAnalystRun> {
  const cloned = structuredClone(storedValue) as unknown
  if (!validateStoredReplay(cloned)) {
    throw new StoredVerificationAnalystReplayError(
      `Stored verification analyst replay is invalid: ${formatValidationErrors(validateStoredReplay.errors)}`,
    )
  }
  validateStoredBindings(cloned, evidence)
  const transport = new StoredTransport(cloned.responses)
  let run: VerificationAnalystRun
  try {
    run = await runVerificationAnalyst(
      cloned.request,
      evidence,
      transport,
    )
  } catch (error) {
    throw new StoredVerificationAnalystReplayError(
      `Stored verification analyst replay failed: ${errorMessage(error)}`,
    )
  }
  if (
    transport.usedResponseCount !== cloned.responses.length ||
    run.output.requestKind !== cloned.request.requestKind ||
    run.output.recommendation?.action !== 'adjudication' ||
    run.output.externalActionsExecuted ||
    run.output.scientificClaimAllowed
  ) {
    throw new StoredVerificationAnalystReplayError(
      'Stored verification analyst request and replayed run do not agree',
    )
  }
  return run
}

function validateStoredBindings(
  stored: StoredVerificationAnalystReplay,
  evidence: VerificationToolEvidence,
): void {
  const responseIds = stored.responses.map(({ id }) => id)
  const invalid =
    stored.request.request.trim().length === 0 ||
    stored.request.request.length > 8_000 ||
    !evidence.qualitySnapshots.some(
      ({ snapshotSha256 }) =>
        snapshotSha256 === stored.request.snapshotSha256,
    ) ||
    stored.responses.length < 2 ||
    stored.responses.length > 10 ||
    new Set(responseIds).size !== responseIds.length ||
    responseIds.some(
      (responseId) =>
        !/^stored-verification-turn-[0-9]{2}$/u.test(responseId),
    ) ||
    stored.responses
      .slice(0, -1)
      .some(
        ({ output, output_text: outputText }) =>
          output.length !== 1 || outputText !== '',
      ) ||
    stored.responses.at(-1)?.output.length !== 0 ||
    stored.responses.at(-1)?.output_text.trim().length === 0
  if (invalid) {
    throw new StoredVerificationAnalystReplayError(
      'Stored verification analyst replay bindings are invalid',
    )
  }
}

class StoredTransport implements VerificationAnalystResponsesTransport {
  readonly #responses: readonly VerificationAnalystTransportResponse[]
  #usedResponseCount = 0

  constructor(responses: readonly VerificationAnalystTransportResponse[]) {
    this.#responses = responses.map((response) => deepFreeze({
      ...response,
      output: response.output.map((item) => ({ ...item })) as ResponseOutputItem[],
    }))
  }

  get usedResponseCount(): number {
    return this.#usedResponseCount
  }

  async create(
    _request: ResponseCreateParamsNonStreaming,
  ): Promise<VerificationAnalystTransportResponse> {
    const response = this.#responses[this.#usedResponseCount]
    if (response === undefined) {
      throw new StoredVerificationAnalystReplayError(
        'Stored verification analyst responses are exhausted',
      )
    }
    this.#usedResponseCount += 1
    return response
  }
}

function formatValidationErrors(
  errors: readonly ErrorObject[] | null | undefined,
): string {
  if (errors === undefined || errors === null || errors.length === 0) {
    return 'validation failed'
  }
  return errors
    .slice(0, 4)
    .map((error) => `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`)
    .join('; ')
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
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
