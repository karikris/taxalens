import type {
  VerificationToolName,
  VerificationToolResult,
} from './verificationTools'

export const VERIFICATION_ANALYST_MODEL = 'gpt-5.6-sol' as const
export const VERIFICATION_ANALYST_OUTPUT_VERSION =
  'taxalens-verification-analyst-output:v1.1.0' as const
export const VERIFICATION_ANALYST_RUN_VERSION =
  'taxalens-verification-analyst-run:v1.1.0' as const

export type VerificationAnalystRequestKind =
  | 'next_review_action'
  | 'quality_change'
export type VerificationAnalystReasoningEffort = 'medium' | 'high'
export type VerificationActionKind =
  | 'unbiased_audit'
  | 'failure_discovery'
  | 'reference_shortfall'
  | 'adjudication'
export type VerificationActionBasis =
  | 'representative_sampling_plan'
  | 'targeted_failure_discovery'
  | 'reference_readiness_blocker'
  | 'unresolved_review_conflict'

export interface VerificationAnalystInput {
  readonly requestKind: VerificationAnalystRequestKind
  readonly request: string
  readonly snapshotSha256: string
  readonly beforeSnapshotSha256?: string
  readonly batchSize?: number
  readonly reasoningEffort?: VerificationAnalystReasoningEffort
  readonly budget?: Partial<VerificationAnalystBudgetLimits>
}

export interface VerificationAnalystBudgetLimits {
  readonly maxToolCalls: number
  readonly maxResponseTurns: number
}

export interface VerificationAnalystClaim {
  readonly id: string
  readonly claim: string
  readonly artifactIds: readonly string[]
}

export interface VerificationAnalystUnavailableEvidence {
  readonly topic: string
  readonly reason: string
  readonly artifactIds: readonly string[]
}

export interface VerificationActionRecommendation {
  readonly action: VerificationActionKind
  readonly basis: VerificationActionBasis
  readonly nextItemIds: readonly string[]
  readonly why: string
  readonly artifactIds: readonly string[]
}

export interface VerificationQualityChangeExplanation {
  readonly beforeSnapshotSha256: string
  readonly afterSnapshotSha256: string
  readonly status: VerificationToolResult['status']
  readonly changedFactIds: readonly string[]
  readonly explanation: string
  readonly artifactIds: readonly string[]
  readonly causalEffectClaimed: false
}

export interface VerificationAnalystOutput {
  readonly schemaVersion: typeof VERIFICATION_ANALYST_OUTPUT_VERSION
  readonly requestKind: VerificationAnalystRequestKind
  readonly campaign: {
    readonly campaignId: string
    readonly title: string
    readonly target: {
      readonly acceptedTaxonKey: string
      readonly scientificName: string
    } | null
  }
  readonly recommendation: VerificationActionRecommendation | null
  readonly qualityChange: VerificationQualityChangeExplanation | null
  readonly evidenceBackedClaims: readonly VerificationAnalystClaim[]
  readonly unavailableEvidence: readonly VerificationAnalystUnavailableEvidence[]
  readonly answer: string
  readonly limitations: readonly string[]
  readonly artifactIds: readonly string[]
  readonly externalActionsExecuted: false
  readonly unsupportedClaimsRejected: true
  readonly scientificClaimAllowed: false
}

export interface VerificationAnalystToolReceipt {
  readonly sequence: number
  readonly callId: string
  readonly tool: VerificationToolName
  readonly arguments: Readonly<Record<string, unknown>>
  readonly caller: 'direct'
  readonly resultStatus: VerificationToolResult['status']
  readonly artifactIds: readonly string[]
}

export interface VerificationAnalystRun {
  readonly schemaVersion: typeof VERIFICATION_ANALYST_RUN_VERSION
  readonly model: typeof VERIFICATION_ANALYST_MODEL
  readonly reasoningEffort: VerificationAnalystReasoningEffort
  readonly responseStatus: 'completed'
  readonly output: VerificationAnalystOutput
  readonly budget: {
    readonly maxToolCalls: number
    readonly usedToolCalls: number
    readonly maxResponseTurns: number
    readonly usedResponseTurns: number
    readonly exhausted: false
  }
  readonly toolReceipts: readonly VerificationAnalystToolReceipt[]
  readonly toolResults: readonly VerificationToolResult[]
  readonly responseIds: readonly string[]
}

const ARTIFACT_IDS = {
  type: 'array',
  items: { type: 'string' },
}

export const VERIFICATION_ANALYST_OUTPUT_SCHEMA: Readonly<Record<string, unknown>> =
  deepFreeze({
    type: 'object',
    additionalProperties: false,
    properties: {
      schemaVersion: {
        type: 'string',
        const: VERIFICATION_ANALYST_OUTPUT_VERSION,
      },
      requestKind: {
        type: 'string',
        enum: ['next_review_action', 'quality_change'],
      },
      campaign: {
        type: 'object',
        additionalProperties: false,
        properties: {
          campaignId: { type: 'string' },
          title: { type: 'string' },
          target: {
            anyOf: [
              {
                type: 'object',
                additionalProperties: false,
                properties: {
                  acceptedTaxonKey: { type: 'string' },
                  scientificName: { type: 'string' },
                },
                required: ['acceptedTaxonKey', 'scientificName'],
              },
              { type: 'null' },
            ],
          },
        },
        required: ['campaignId', 'title', 'target'],
      },
      recommendation: {
        anyOf: [
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              action: {
                type: 'string',
                enum: [
                  'unbiased_audit',
                  'failure_discovery',
                  'reference_shortfall',
                  'adjudication',
                ],
              },
              basis: {
                type: 'string',
                enum: [
                  'representative_sampling_plan',
                  'targeted_failure_discovery',
                  'reference_readiness_blocker',
                  'unresolved_review_conflict',
                ],
              },
              nextItemIds: {
                type: 'array',
                items: { type: 'string' },
              },
              why: { type: 'string' },
              artifactIds: ARTIFACT_IDS,
            },
            required: ['action', 'basis', 'nextItemIds', 'why', 'artifactIds'],
          },
          { type: 'null' },
        ],
      },
      qualityChange: {
        anyOf: [
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              beforeSnapshotSha256: { type: 'string' },
              afterSnapshotSha256: { type: 'string' },
              status: {
                type: 'string',
                enum: ['available', 'partial', 'unavailable', 'blocked'],
              },
              changedFactIds: {
                type: 'array',
                items: { type: 'string' },
              },
              explanation: { type: 'string' },
              artifactIds: ARTIFACT_IDS,
              causalEffectClaimed: { type: 'boolean', const: false },
            },
            required: [
              'beforeSnapshotSha256',
              'afterSnapshotSha256',
              'status',
              'changedFactIds',
              'explanation',
              'artifactIds',
              'causalEffectClaimed',
            ],
          },
          { type: 'null' },
        ],
      },
      evidenceBackedClaims: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string' },
            claim: { type: 'string' },
            artifactIds: ARTIFACT_IDS,
          },
          required: ['id', 'claim', 'artifactIds'],
        },
      },
      unavailableEvidence: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            topic: { type: 'string' },
            reason: { type: 'string' },
            artifactIds: ARTIFACT_IDS,
          },
          required: ['topic', 'reason', 'artifactIds'],
        },
      },
      answer: { type: 'string' },
      limitations: {
        type: 'array',
        items: { type: 'string' },
      },
      artifactIds: ARTIFACT_IDS,
      externalActionsExecuted: { type: 'boolean', const: false },
      unsupportedClaimsRejected: { type: 'boolean', const: true },
      scientificClaimAllowed: { type: 'boolean', const: false },
    },
    required: [
      'schemaVersion',
      'requestKind',
      'campaign',
      'recommendation',
      'qualityChange',
      'evidenceBackedClaims',
      'unavailableEvidence',
      'answer',
      'limitations',
      'artifactIds',
      'externalActionsExecuted',
      'unsupportedClaimsRejected',
      'scientificClaimAllowed',
    ],
  })

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) {
    return value
  }
  for (const child of Object.values(value)) {
    deepFreeze(child)
  }
  return Object.freeze(value)
}
