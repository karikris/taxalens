import {
  GEOGRAPHIC_EVIDENCE_MODES,
  GEOGRAPHIC_IMPACT_METRICS,
  GEOGRAPHIC_SCOPE_LEVELS,
  type GeographicEvidenceMode,
  type GeographicImpactMetric,
} from '../impact/geographicImpactQuery'

export const GEOGRAPHIC_TOOL_RESULT_VERSION =
  'taxalens-geographic-tool-result:v1.0.0' as const
export const GEOGRAPHIC_ARTIFACT_CITATION_VERSION =
  'taxalens-geographic-artifact-citation:v1.0.0' as const

export const GEOGRAPHIC_TOOL_NAMES = Object.freeze([
  'inspect_geographic_impact',
  'compare_geographic_scopes',
  'list_candidate_gap_cells',
  'explain_coverage_contribution',
  'recommend_geographic_review_batch',
  'inspect_baseline_provider_union',
] as const)

export const GEOGRAPHIC_ARTIFACT_KINDS = Object.freeze([
  'baseline_provider_union',
  'flickr_geography',
  'geographic_impact_cells',
  'geographic_impact_summary',
  'country_hierarchy',
  'quality_snapshot',
  'verification_campaign',
  'biominer_source',
] as const)

export const GEOGRAPHIC_CONTRIBUTION_STATES = Object.freeze([
  'potential',
  'human_supported',
  'release_ready',
] as const)

export const GEOGRAPHIC_REVIEW_OBJECTIVES = Object.freeze([
  'unbiased_audit',
  'geographic_coverage_gap',
  'failure_discovery',
  'reference_shortfall',
  'conflict_adjudication',
] as const)

export type GeographicToolName = (typeof GEOGRAPHIC_TOOL_NAMES)[number]
export type GeographicArtifactKind = (typeof GEOGRAPHIC_ARTIFACT_KINDS)[number]
export type GeographicContributionState =
  (typeof GEOGRAPHIC_CONTRIBUTION_STATES)[number]
export type GeographicReviewObjective =
  (typeof GEOGRAPHIC_REVIEW_OBJECTIVES)[number]
export type GeographicToolStatus =
  | 'available'
  | 'partial'
  | 'unavailable'
  | 'blocked'
export type GeographicToolFactStatus =
  | 'verified'
  | 'metadata'
  | 'unavailable'
  | 'blocked'
export type GeographicToolRecordStatus =
  | 'available'
  | 'metadata'
  | 'pending'
  | 'unavailable'
  | 'blocked'
export type GeographicToolFactValue = boolean | null | number | string

export interface GeographicToolEvidenceScope {
  readonly projectId: string
  readonly runId: string
  readonly acceptedTaxonKey: string
  readonly baselineSnapshotId: string
  readonly flickrSnapshotId: string
}

export interface GeographicArtifactCitation {
  readonly schemaVersion: typeof GEOGRAPHIC_ARTIFACT_CITATION_VERSION
  readonly artifactKind: GeographicArtifactKind
  readonly artifactId: string
  readonly sha256: string
  readonly sourceRepository: string
  readonly sourceCommit: string
  readonly sourcePath: string
}

export interface GeographicToolFact {
  readonly id: string
  readonly label: string
  readonly value: GeographicToolFactValue
  readonly status: GeographicToolFactStatus
}

export interface GeographicToolRecord {
  readonly id: string
  readonly label: string
  readonly status: GeographicToolRecordStatus
  readonly detail: string
  readonly artifactIds: readonly string[]
}

export interface GeographicToolResult {
  readonly schemaVersion: typeof GEOGRAPHIC_TOOL_RESULT_VERSION
  readonly tool: GeographicToolName
  readonly status: GeographicToolStatus
  readonly evidenceScope: GeographicToolEvidenceScope
  readonly summary: string
  readonly facts: readonly GeographicToolFact[]
  readonly records: readonly GeographicToolRecord[]
  readonly artifactIds: readonly string[]
  readonly artifactCitations: readonly GeographicArtifactCitation[]
  readonly limitations: readonly string[]
  readonly scientificClaimAllowed: false
}

interface JsonObjectSchema {
  readonly type: 'object'
  readonly properties: Readonly<Record<string, unknown>>
  readonly required: readonly string[]
  readonly additionalProperties: false
}

export interface GeographicToolDefinition {
  readonly type: 'function'
  readonly name: GeographicToolName
  readonly description: string
  readonly strict: true
  readonly read_only: true
  readonly parameters: JsonObjectSchema
  readonly output_schema: JsonObjectSchema
  readonly allowed_callers: readonly ('direct' | 'programmatic')[]
}

const STRING_ARGUMENT = Object.freeze({
  type: 'string',
  minLength: 1,
  maxLength: 160,
  description: 'An exact non-empty committed identifier.',
})
const RESOLUTION_ARGUMENT = Object.freeze({
  type: 'integer',
  minimum: 0,
  maximum: 15,
  description: 'An exact H3 spatial resolution from 0 through 15.',
})
const SCOPE_LEVEL_ARGUMENT = Object.freeze({
  type: 'string',
  enum: GEOGRAPHIC_SCOPE_LEVELS,
})
const METRIC_ARGUMENT = Object.freeze({
  type: 'string',
  enum: GEOGRAPHIC_IMPACT_METRICS,
})
const EVIDENCE_MODE_ARGUMENT = Object.freeze({
  type: 'string',
  enum: GEOGRAPHIC_EVIDENCE_MODES,
})
const LIMIT_ARGUMENT = Object.freeze({
  type: 'integer',
  minimum: 1,
  maximum: 100,
})

const COMMON_ARGUMENTS = Object.freeze({
  project_id: STRING_ARGUMENT,
  run_id: STRING_ARGUMENT,
  accepted_taxon_key: STRING_ARGUMENT,
  baseline_snapshot_id: STRING_ARGUMENT,
  flickr_snapshot_id: STRING_ARGUMENT,
  spatial_resolution: RESOLUTION_ARGUMENT,
})

const COMMON_REQUIRED = Object.freeze(Object.keys(COMMON_ARGUMENTS))
const STATUS_VALUES = Object.freeze([
  'available',
  'partial',
  'unavailable',
  'blocked',
])
const FACT_STATUS_VALUES = Object.freeze([
  'verified',
  'metadata',
  'unavailable',
  'blocked',
])
const RECORD_STATUS_VALUES = Object.freeze([
  'available',
  'metadata',
  'pending',
  'unavailable',
  'blocked',
])

function parameters(
  properties: Readonly<Record<string, unknown>>,
): JsonObjectSchema {
  return deepFreeze({
    type: 'object',
    properties: { ...COMMON_ARGUMENTS, ...properties },
    required: [...COMMON_REQUIRED, ...Object.keys(properties)],
    additionalProperties: false,
  })
}

const OUTPUT_SCHEMA: JsonObjectSchema = deepFreeze({
  type: 'object',
  additionalProperties: false,
  properties: {
    schemaVersion: { type: 'string', const: GEOGRAPHIC_TOOL_RESULT_VERSION },
    tool: { type: 'string', enum: GEOGRAPHIC_TOOL_NAMES },
    status: { type: 'string', enum: STATUS_VALUES },
    evidenceScope: {
      type: 'object',
      additionalProperties: false,
      properties: {
        projectId: { type: 'string' },
        runId: { type: 'string' },
        acceptedTaxonKey: { type: 'string' },
        baselineSnapshotId: { type: 'string' },
        flickrSnapshotId: { type: 'string' },
      },
      required: [
        'projectId',
        'runId',
        'acceptedTaxonKey',
        'baselineSnapshotId',
        'flickrSnapshotId',
      ],
    },
    summary: { type: 'string' },
    facts: {
      type: 'array',
      maxItems: 64,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          label: { type: 'string' },
          value: {
            anyOf: [
              { type: 'boolean' },
              { type: 'null' },
              { type: 'number' },
              { type: 'string' },
            ],
          },
          status: { type: 'string', enum: FACT_STATUS_VALUES },
        },
        required: ['id', 'label', 'value', 'status'],
      },
    },
    records: {
      type: 'array',
      maxItems: 100,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          label: { type: 'string' },
          status: { type: 'string', enum: RECORD_STATUS_VALUES },
          detail: { type: 'string' },
          artifactIds: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'label', 'status', 'detail', 'artifactIds'],
      },
    },
    artifactIds: { type: 'array', items: { type: 'string' } },
    artifactCitations: {
      type: 'array',
      maxItems: 64,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          schemaVersion: {
            type: 'string',
            const: GEOGRAPHIC_ARTIFACT_CITATION_VERSION,
          },
          artifactKind: { type: 'string', enum: GEOGRAPHIC_ARTIFACT_KINDS },
          artifactId: { type: 'string' },
          sha256: { type: 'string', pattern: '^[0-9a-f]{64}$' },
          sourceRepository: { type: 'string' },
          sourceCommit: { type: 'string' },
          sourcePath: { type: 'string' },
        },
        required: [
          'schemaVersion',
          'artifactKind',
          'artifactId',
          'sha256',
          'sourceRepository',
          'sourceCommit',
          'sourcePath',
        ],
      },
    },
    limitations: { type: 'array', items: { type: 'string' } },
    scientificClaimAllowed: { type: 'boolean', const: false },
  },
  required: [
    'schemaVersion',
    'tool',
    'status',
    'evidenceScope',
    'summary',
    'facts',
    'records',
    'artifactIds',
    'artifactCitations',
    'limitations',
    'scientificClaimAllowed',
  ],
})

function definition(
  name: GeographicToolName,
  description: string,
  input: JsonObjectSchema,
): GeographicToolDefinition {
  return deepFreeze({
    type: 'function',
    name,
    description,
    strict: true,
    read_only: true,
    parameters: input,
    output_schema: deepFreeze({
      ...OUTPUT_SCHEMA,
      properties: {
        ...OUTPUT_SCHEMA.properties,
        tool: { type: 'string', const: name },
      },
    }),
    allowed_callers: ['direct', 'programmatic'],
  })
}

export const GEOGRAPHIC_TOOL_DEFINITIONS: readonly GeographicToolDefinition[] =
  Object.freeze([
    definition(
      'inspect_geographic_impact',
      'Inspect deterministic baseline and Flickr evidence counts in one exact geographic scope.',
      parameters({
        scope_level: SCOPE_LEVEL_ARGUMENT,
        scope_id: STRING_ARGUMENT,
        evidence_mode: EVIDENCE_MODE_ARGUMENT,
        metric: METRIC_ARGUMENT,
      }),
    ),
    definition(
      'compare_geographic_scopes',
      'Compare deterministic geographic contribution metrics between two exact scopes.',
      parameters({
        left_scope_level: SCOPE_LEVEL_ARGUMENT,
        left_scope_id: STRING_ARGUMENT,
        right_scope_level: SCOPE_LEVEL_ARGUMENT,
        right_scope_id: STRING_ARGUMENT,
        metric: METRIC_ARGUMENT,
      }),
    ),
    definition(
      'list_candidate_gap_cells',
      'List a bounded deterministic set of candidate-only, human-supported, or release-ready additional cells.',
      parameters({
        scope_level: SCOPE_LEVEL_ARGUMENT,
        scope_id: STRING_ARGUMENT,
        contribution_state: {
          type: 'string',
          enum: GEOGRAPHIC_CONTRIBUTION_STATES,
        },
        limit: LIMIT_ARGUMENT,
      }),
    ),
    definition(
      'explain_coverage_contribution',
      'Return deterministic evidence facts for one exact spatial cell without making an occurrence claim.',
      parameters({
        scope_level: SCOPE_LEVEL_ARGUMENT,
        scope_id: STRING_ARGUMENT,
        spatial_cell_id: STRING_ARGUMENT,
      }),
    ),
    definition(
      'recommend_geographic_review_batch',
      'Rank a bounded set of existing candidate items for an explicit review objective without writing review state.',
      parameters({
        scope_level: SCOPE_LEVEL_ARGUMENT,
        scope_id: STRING_ARGUMENT,
        review_objective: {
          type: 'string',
          enum: GEOGRAPHIC_REVIEW_OBJECTIVES,
        },
        batch_size: { type: 'integer', minimum: 1, maximum: 50 },
      }),
    ),
    definition(
      'inspect_baseline_provider_union',
      'Inspect deterministic baseline-union provider composition and unresolved duplicate state.',
      parameters({
        scope_level: SCOPE_LEVEL_ARGUMENT,
        scope_id: STRING_ARGUMENT,
      }),
    ),
  ])

export function isGeographicEvidenceMode(value: string): value is GeographicEvidenceMode {
  return (GEOGRAPHIC_EVIDENCE_MODES as readonly string[]).includes(value)
}

export function isGeographicImpactMetric(value: string): value is GeographicImpactMetric {
  return (GEOGRAPHIC_IMPACT_METRICS as readonly string[]).includes(value)
}

function deepFreeze<Value>(value: Value): Value {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child)
    }
  }
  return value
}
