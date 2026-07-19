import type { ResearchToolName, ResearchToolResult } from './researchTools'

export const RESEARCH_ANALYST_MODEL = 'configured-model' as const
export const RESEARCH_ANALYST_OUTPUT_VERSION =
  'taxalens-research-analyst-output:v1.0.0' as const
export const RESEARCH_ANALYST_RUN_VERSION = 'taxalens-research-analyst-run:v1.0.0' as const

export type ResearchAnalystRequestKind = 'mission_planning' | 'evidence_explanation'
export type ResearchAnalystReasoningEffort = 'medium' | 'high'
export type ResearchAnalystClaimType =
  | 'verified_workflow_fact'
  | 'candidate_metadata'
  | 'availability_boundary'
  | 'provenance_fact'

export interface ResearchAnalystInput {
  readonly requestKind: ResearchAnalystRequestKind
  readonly request: string
  readonly reasoningEffort?: ResearchAnalystReasoningEffort
  readonly budget?: Partial<ResearchAnalystBudgetLimits>
}

export interface ResearchAnalystBudgetLimits {
  readonly maxToolCalls: number
  readonly maxResponseTurns: number
}

export interface ResearchAnalystPlanStep {
  readonly sequence: number
  readonly action: string
  readonly tool: ResearchToolName | null
  readonly status: 'complete' | 'planned' | 'unavailable' | 'blocked'
  readonly approvalRequired: boolean
  readonly artifactIds: readonly string[]
}

export interface ResearchAnalystClaim {
  readonly id: string
  readonly claim: string
  readonly claimType: ResearchAnalystClaimType
  readonly artifactIds: readonly string[]
}

export interface ResearchAnalystUnavailableEvidence {
  readonly topic: string
  readonly reason: string
  readonly artifactIds: readonly string[]
}

export interface ResearchAnalystApprovalItem {
  readonly action: string
  readonly reason: string
  readonly artifactIds: readonly string[]
}

export interface ResearchAnalystOutput {
  readonly schemaVersion: typeof RESEARCH_ANALYST_OUTPUT_VERSION
  readonly requestKind: ResearchAnalystRequestKind
  readonly target: {
    readonly acceptedTaxonKey: string
    readonly scientificName: string
    readonly resolutionStatus: 'verified_replay_target'
  }
  readonly plan: readonly ResearchAnalystPlanStep[]
  readonly evidenceBackedClaims: readonly ResearchAnalystClaim[]
  readonly unavailableEvidence: readonly ResearchAnalystUnavailableEvidence[]
  readonly approvalBoundary: {
    readonly liveWorkApproved: false
    readonly externalActionsExecuted: false
    readonly approvalRequired: boolean
    readonly items: readonly ResearchAnalystApprovalItem[]
  }
  readonly answer: string
  readonly limitations: readonly string[]
  readonly artifactIds: readonly string[]
  readonly unsupportedClaimsRejected: true
  readonly scientificClaimAllowed: false
}

export interface ResearchAnalystToolReceipt {
  readonly sequence: number
  readonly callId: string
  readonly tool: ResearchToolName
  readonly arguments: Readonly<Record<string, unknown>>
  readonly resultStatus: 'available' | 'partial' | 'unavailable' | 'blocked'
  readonly artifactIds: readonly string[]
}

export interface ResearchAnalystRun {
  readonly schemaVersion: typeof RESEARCH_ANALYST_RUN_VERSION
  readonly model: typeof RESEARCH_ANALYST_MODEL
  readonly reasoningEffort: ResearchAnalystReasoningEffort
  readonly responseStatus: 'completed'
  readonly output: ResearchAnalystOutput
  readonly budget: {
    readonly maxToolCalls: number
    readonly usedToolCalls: number
    readonly maxResponseTurns: number
    readonly usedResponseTurns: number
    readonly exhausted: false
  }
  readonly toolReceipts: readonly ResearchAnalystToolReceipt[]
  readonly toolResults: readonly ResearchToolResult[]
  readonly responseIds: readonly string[]
}

const TOOL_NAMES: readonly ResearchToolName[] = Object.freeze([
  'resolve_taxon',
  'inspect_query_coverage',
  'estimate_mission',
  'inspect_stage',
  'trace_lineage',
  'compare_candidates',
  'explain_decision',
  'inspect_reference_status',
  'export_evidence',
])

const ARTIFACT_IDS = {
  type: 'array',
  items: { type: 'string' },
}

export const RESEARCH_ANALYST_OUTPUT_SCHEMA: Readonly<Record<string, unknown>> = deepFreeze({
  type: 'object',
  additionalProperties: false,
  properties: {
    schemaVersion: { type: 'string', const: RESEARCH_ANALYST_OUTPUT_VERSION },
    requestKind: {
      type: 'string',
      enum: ['mission_planning', 'evidence_explanation'],
    },
    target: {
      type: 'object',
      additionalProperties: false,
      properties: {
        acceptedTaxonKey: { type: 'string' },
        scientificName: { type: 'string' },
        resolutionStatus: { type: 'string', const: 'verified_replay_target' },
      },
      required: ['acceptedTaxonKey', 'scientificName', 'resolutionStatus'],
    },
    plan: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          sequence: { type: 'integer' },
          action: { type: 'string' },
          tool: {
            anyOf: [
              { type: 'string', enum: TOOL_NAMES },
              { type: 'null' },
            ],
          },
          status: {
            type: 'string',
            enum: ['complete', 'planned', 'unavailable', 'blocked'],
          },
          approvalRequired: { type: 'boolean' },
          artifactIds: ARTIFACT_IDS,
        },
        required: [
          'sequence',
          'action',
          'tool',
          'status',
          'approvalRequired',
          'artifactIds',
        ],
      },
    },
    evidenceBackedClaims: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          claim: { type: 'string' },
          claimType: {
            type: 'string',
            enum: [
              'verified_workflow_fact',
              'candidate_metadata',
              'availability_boundary',
              'provenance_fact',
            ],
          },
          artifactIds: ARTIFACT_IDS,
        },
        required: ['id', 'claim', 'claimType', 'artifactIds'],
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
    approvalBoundary: {
      type: 'object',
      additionalProperties: false,
      properties: {
        liveWorkApproved: { type: 'boolean', const: false },
        externalActionsExecuted: { type: 'boolean', const: false },
        approvalRequired: { type: 'boolean' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              action: { type: 'string' },
              reason: { type: 'string' },
              artifactIds: ARTIFACT_IDS,
            },
            required: ['action', 'reason', 'artifactIds'],
          },
        },
      },
      required: [
        'liveWorkApproved',
        'externalActionsExecuted',
        'approvalRequired',
        'items',
      ],
    },
    answer: { type: 'string' },
    limitations: {
      type: 'array',
      items: { type: 'string' },
    },
    artifactIds: ARTIFACT_IDS,
    unsupportedClaimsRejected: { type: 'boolean', const: true },
    scientificClaimAllowed: { type: 'boolean', const: false },
  },
  required: [
    'schemaVersion',
    'requestKind',
    'target',
    'plan',
    'evidenceBackedClaims',
    'unavailableEvidence',
    'approvalBoundary',
    'answer',
    'limitations',
    'artifactIds',
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
