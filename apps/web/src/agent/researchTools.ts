import Ajv2020, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js'

import type { ReplayEvidence } from '../data/evidenceFacade'
import { prepareResearchOutputs } from '../dashboard/researchOutputs'
import { buildCandidateComparison } from '../evidence/candidateComparisonModel'
import { buildEvidenceLedger } from '../evidence/evidenceLedgerModel'
import { createMissionDraft, generateEvidencePlan } from '../mission/missionPlan'

export const RESEARCH_TOOL_RESULT_VERSION = 'taxalens-research-tool-result:v1.0.0' as const
const MAX_ARTIFACT_CITATIONS = 32

export const RESEARCH_TOOL_NAMES = Object.freeze([
  'resolve_taxon',
  'inspect_query_coverage',
  'estimate_mission',
  'inspect_stage',
  'trace_lineage',
  'compare_candidates',
  'explain_decision',
  'inspect_reference_status',
  'export_evidence',
] as const)

export type ResearchToolName = (typeof RESEARCH_TOOL_NAMES)[number]
export type ResearchToolStatus = 'available' | 'partial' | 'unavailable' | 'blocked'
export type ResearchFactStatus = 'verified' | 'metadata' | 'unavailable' | 'blocked'
export type ResearchRecordStatus =
  | 'available'
  | 'metadata'
  | 'pending'
  | 'unavailable'
  | 'blocked'
export type ResearchFactValue = boolean | null | number | string

export interface ResearchToolFact {
  readonly id: string
  readonly label: string
  readonly value: ResearchFactValue
  readonly status: ResearchFactStatus
}

export interface ResearchToolRecord {
  readonly id: string
  readonly label: string
  readonly status: ResearchRecordStatus
  readonly detail: string
  readonly artifactIds: readonly string[]
}

export interface ResearchToolResult {
  readonly schemaVersion: typeof RESEARCH_TOOL_RESULT_VERSION
  readonly tool: ResearchToolName
  readonly status: ResearchToolStatus
  readonly bundleId: string
  readonly summary: string
  readonly facts: readonly ResearchToolFact[]
  readonly records: readonly ResearchToolRecord[]
  readonly artifactIds: readonly string[]
  readonly limitations: readonly string[]
  readonly scientificClaimAllowed: false
}

interface JsonObjectSchema {
  readonly type: 'object'
  readonly properties: Readonly<Record<string, unknown>>
  readonly required: readonly string[]
  readonly additionalProperties: false
}

export interface ResearchToolDefinition {
  readonly type: 'function'
  readonly name: ResearchToolName
  readonly description: string
  readonly strict: true
  readonly parameters: JsonObjectSchema
  readonly output_schema: JsonObjectSchema
  readonly allowed_callers: readonly ('direct' | 'programmatic')[]
}

export type ResearchToolErrorCode =
  | 'invalid_arguments'
  | 'invalid_result'
  | 'unknown_tool'
  | 'unverified_artifact'

export class ResearchToolError extends Error {
  readonly code: ResearchToolErrorCode

  constructor(code: ResearchToolErrorCode, message: string) {
    super(message)
    this.name = 'ResearchToolError'
    this.code = code
  }
}

const STRING_ARGUMENT = Object.freeze({
  type: 'string',
  description: 'A non-empty identifier of at most 160 characters.',
})
const TAXON_ARGUMENT = Object.freeze({
  type: 'string',
  description: 'An exact scientific name or accepted taxon key; at most 160 characters.',
})
const RECORD_ARGUMENT = Object.freeze({
  type: 'string',
  description: 'An exact committed evidence-record ID; at most 160 characters.',
})
const STATUS_VALUES = Object.freeze(['available', 'partial', 'unavailable', 'blocked'])
const FACT_STATUS_VALUES = Object.freeze(['verified', 'metadata', 'unavailable', 'blocked'])
const RECORD_STATUS_VALUES = Object.freeze([
  'available',
  'metadata',
  'pending',
  'unavailable',
  'blocked',
])

const OUTPUT_SCHEMA: JsonObjectSchema = deepFreeze({
  type: 'object',
  additionalProperties: false,
  properties: {
    schemaVersion: { type: 'string', const: RESEARCH_TOOL_RESULT_VERSION },
    tool: { type: 'string', enum: RESEARCH_TOOL_NAMES },
    status: { type: 'string', enum: STATUS_VALUES },
    bundleId: { type: 'string' },
    summary: { type: 'string' },
    facts: {
      type: 'array',
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
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          label: { type: 'string' },
          status: { type: 'string', enum: RECORD_STATUS_VALUES },
          detail: { type: 'string' },
          artifactIds: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['id', 'label', 'status', 'detail', 'artifactIds'],
      },
    },
    artifactIds: {
      type: 'array',
      items: { type: 'string' },
    },
    limitations: {
      type: 'array',
      items: { type: 'string' },
    },
    scientificClaimAllowed: { type: 'boolean', const: false },
  },
  required: [
    'schemaVersion',
    'tool',
    'status',
    'bundleId',
    'summary',
    'facts',
    'records',
    'artifactIds',
    'limitations',
    'scientificClaimAllowed',
  ],
})

function parameters(
  properties: Readonly<Record<string, unknown>>,
  required: readonly string[],
): JsonObjectSchema {
  return deepFreeze({ type: 'object', properties, required, additionalProperties: false })
}

function definition(
  name: ResearchToolName,
  description: string,
  input: JsonObjectSchema,
  allowedCallers: readonly ('direct' | 'programmatic')[] = ['direct', 'programmatic'],
): ResearchToolDefinition {
  return deepFreeze({
    type: 'function',
    name,
    description,
    strict: true,
    parameters: input,
    output_schema: outputSchema(name),
    allowed_callers: allowedCallers,
  })
}

function outputSchema(name: ResearchToolName): JsonObjectSchema {
  return deepFreeze({
    ...OUTPUT_SCHEMA,
    properties: {
      ...OUTPUT_SCHEMA.properties,
      tool: { type: 'string', const: name },
    },
  })
}

export const RESEARCH_TOOL_DEFINITIONS: readonly ResearchToolDefinition[] = Object.freeze([
  definition(
    'resolve_taxon',
    'Resolve an exact scientific name or accepted taxon key against the checksum-verified replay.',
    parameters({ query: TAXON_ARGUMENT }, ['query']),
  ),
  definition(
    'inspect_query_coverage',
    'Inspect committed query definitions, request counts, candidate hits, and canonical-photo coverage.',
    parameters({ accepted_taxon_key: TAXON_ARGUMENT }, ['accepted_taxon_key']),
  ),
  definition(
    'estimate_mission',
    'Build a replay-only mission estimate without launching acquisition, inference, or external work.',
    parameters(
      {
        accepted_taxon_key: TAXON_ARGUMENT,
        candidate_limit: {
          type: 'integer',
          description: 'Whole-number candidate limit from 1 through 50.',
        },
      },
      ['accepted_taxon_key', 'candidate_limit'],
    ),
  ),
  definition(
    'inspect_stage',
    'Inspect one named pipeline stage and its committed availability boundary.',
    parameters({ stage_id: STRING_ARGUMENT }, ['stage_id']),
  ),
  definition(
    'trace_lineage',
    'Trace the ordered evidence lifecycle for a committed review record.',
    parameters({ record_id: RECORD_ARGUMENT }, ['record_id']),
  ),
  definition(
    'compare_candidates',
    'Compare the target and regional candidate hypotheses without inventing unavailable scores or ranks.',
    parameters({ record_id: RECORD_ARGUMENT }, ['record_id']),
  ),
  definition(
    'explain_decision',
    'Explain the committed selective-decision state and its unsatisfied evidence gates.',
    parameters({ record_id: RECORD_ARGUMENT }, ['record_id']),
  ),
  definition(
    'inspect_reference_status',
    'Inspect source-media readiness, human-review shortfalls, and unresolved reference groups.',
    parameters({ accepted_taxon_key: TAXON_ARGUMENT }, ['accepted_taxon_key']),
  ),
  definition(
    'export_evidence',
    'Prepare deterministic local research-output receipts without downloading, signing, or changing evidence.',
    parameters({ record_id: RECORD_ARGUMENT }, ['record_id']),
    ['direct'],
  ),
])

const ajv = new Ajv2020({ allErrors: true, strict: true })
const argumentValidators = new Map<ResearchToolName, ValidateFunction>(
  RESEARCH_TOOL_DEFINITIONS.map((tool) => [tool.name, ajv.compile(tool.parameters)]),
)
const validateResult = ajv.compile(OUTPUT_SCHEMA)

export async function executeResearchTool(
  requestedName: string,
  args: unknown,
  replay: ReplayEvidence,
): Promise<ResearchToolResult> {
  const name = researchToolName(requestedName)
  const validateArguments = argumentValidators.get(name)
  if (validateArguments === undefined || !validateArguments(args)) {
    throw new ResearchToolError(
      'invalid_arguments',
      `${name} arguments are invalid: ${formatValidationErrors(validateArguments?.errors)}`,
    )
  }

  let result: ResearchToolResult
  switch (name) {
    case 'resolve_taxon':
      result = resolveTaxon(readString(args, 'query'), replay)
      break
    case 'inspect_query_coverage':
      result = inspectQueryCoverage(readString(args, 'accepted_taxon_key'), replay)
      break
    case 'estimate_mission':
      result = estimateMission(
        readString(args, 'accepted_taxon_key'),
        readInteger(args, 'candidate_limit'),
        replay,
      )
      break
    case 'inspect_stage':
      result = inspectStage(readString(args, 'stage_id'), replay)
      break
    case 'trace_lineage':
      result = traceLineage(readString(args, 'record_id'), replay)
      break
    case 'compare_candidates':
      result = compareCandidates(readString(args, 'record_id'), replay)
      break
    case 'explain_decision':
      result = explainDecision(readString(args, 'record_id'), replay)
      break
    case 'inspect_reference_status':
      result = inspectReferenceStatus(readString(args, 'accepted_taxon_key'), replay)
      break
    case 'export_evidence':
      result = await exportEvidence(readString(args, 'record_id'), replay)
      break
  }

  return verifyResult(result, replay)
}

function resolveTaxon(query: string, replay: ReplayEvidence): ResearchToolResult {
  const normalized = query.trim().toLocaleLowerCase('en-US')
  const matched =
    normalized === replay.target.scientificName.toLocaleLowerCase('en-US') ||
    normalized === replay.target.acceptedTaxonKey.toLocaleLowerCase('en-US')
  if (!matched) {
    return result({
      tool: 'resolve_taxon',
      status: 'unavailable',
      replay,
      summary: 'The query does not match the single checksum-verified taxon in this replay.',
      facts: [fact('query', 'Submitted query', query.trim(), 'unavailable')],
      artifactIds: ['query-definitions'],
      limitations: ['Only exact scientific-name and accepted-key resolution is supported.'],
    })
  }
  return result({
    tool: 'resolve_taxon',
    status: 'available',
    replay,
    summary: `${replay.target.scientificName} resolves to ${replay.target.acceptedTaxonKey}.`,
    facts: [
      fact('accepted_taxon_key', 'Accepted taxon key', replay.target.acceptedTaxonKey),
      fact('scientific_name', 'Scientific name', replay.target.scientificName),
      fact('rank', 'Taxonomic rank', replay.target.rank),
      fact('registry', 'Source registry', replay.mission.sourceRegistry.name),
    ],
    artifactIds: ['query-definitions'],
    limitations: ['Resolution is limited to the committed replay target; no live registry lookup occurs.'],
  })
}

function inspectQueryCoverage(
  acceptedTaxonKey: string,
  replay: ReplayEvidence,
): ResearchToolResult {
  if (!sameTaxonKey(acceptedTaxonKey, replay)) {
    return unknownTaxonResult('inspect_query_coverage', acceptedTaxonKey, replay)
  }
  return result({
    tool: 'inspect_query_coverage',
    status: 'partial',
    replay,
    summary: 'Committed discovery workload counts are available; taxonomic occurrence support is not.',
    facts: [
      fact('query_definition_count', 'Committed query definitions', replay.mission.queryPolicy.queryCount),
      fact('queried_species_count', 'Registry-linked queried species', replay.mission.queryPolicy.queriedSpeciesCount),
      fact('physical_query_definition_count', 'Physical query definitions', replay.observatory.physicalQueryCount),
      fact(
        'observed_request_count',
        'Observed acquisition requests',
        replay.geographyReference.reference.workflowMeasurements.observedRequestCount,
      ),
      fact('query_hit_count', 'Flickr query-hit associations', replay.observatory.flickrQueryHitCount, 'metadata'),
      fact('canonical_photo_count', 'Canonical source-photo candidates', replay.observatory.canonicalPhotoCount, 'metadata'),
      fact('registry_identity_required', 'Registry identity required', replay.mission.queryPolicy.registryIdentityRequired),
      fact(
        'fallback_cluster_count',
        'Fallback geography clusters',
        replay.geographyReference.geography.fallbackClusterCount,
        'metadata',
      ),
      fact(
        'outlier_record_count',
        'Geographic outlier records',
        replay.geographyReference.geography.outlierRecordCount,
        'metadata',
      ),
      fact(
        'unassigned_geotagged_record_count',
        'Unassigned geotagged records',
        replay.geographyReference.geography.unassignedGeotaggedRecordCount,
        'metadata',
      ),
    ],
    artifactIds: [
      'query-definitions',
      'flickr-candidate-summaries',
      'biominer-flickr-query-hits-parquet',
      'geographic-clusters',
      'reference-readiness',
      'stage-metrics',
    ],
    limitations: [
      'Query hits and canonical photos are search candidates, not taxonomic observations.',
      'Fallback and unassigned geography are workload buckets; missing geography is unknown, not evidence of absence.',
      'The committed artifacts do not join every query definition to a physical request ledger.',
    ],
  })
}

function estimateMission(
  acceptedTaxonKey: string,
  candidateLimit: number,
  replay: ReplayEvidence,
): ResearchToolResult {
  if (!sameTaxonKey(acceptedTaxonKey, replay)) {
    return unknownTaxonResult('estimate_mission', acceptedTaxonKey, replay)
  }
  if (candidateLimit !== replay.mission.candidatePolicy.candidateCount) {
    return result({
      tool: 'estimate_mission',
      status: 'blocked',
      replay,
      summary: `The mission must retain all ${replay.mission.candidatePolicy.candidateCount} eligible regional candidates.`,
      facts: [
        fact('requested_candidate_limit', 'Requested candidate limit', candidateLimit, 'blocked'),
        fact(
          'required_candidate_limit',
          'Required candidate limit',
          replay.mission.candidatePolicy.candidateCount,
          'verified',
        ),
      ],
      artifactIds: ['candidate-sets', 'query-definitions'],
      limitations: ['Candidate truncation would violate the committed all-eligible-candidates policy.'],
    })
  }
  const draft = createMissionDraft(replay)
  const plan = generateEvidencePlan({ ...draft, candidateLimit }, replay)
  return result({
    tool: 'estimate_mission',
    status: 'partial',
    replay,
    summary: 'A deterministic replay-only mission plan is available; live work remains unapproved.',
    facts: [
      fact('mode', 'Execution mode', plan.execution.requestedMode),
      fact('launches_work', 'Launches external work', plan.execution.launchesWork),
      fact('region_count', 'Planning regions', plan.region.regionCount),
      fact('query_definition_count', 'Committed query definitions', plan.queryStrategy.committedDefinitionCount),
      fact('materialized_api_calls', 'Fixture materialized API calls', plan.approvedBudget.fixtureMaterializedApiCalls),
      fact('candidate_limit', 'Eligible regional candidates', plan.approvedBudget.candidateLimit),
      fact('human_approval_required', 'Human approval required', plan.approvalRequirement.required, 'blocked'),
      fact('phase15_authorized', 'Phase 15 authorized', replay.mission.stoppingConditions.phase15Authorized, 'blocked'),
    ],
    records: plan.expectedStages.map((stage) =>
      record(
        stage.stageId,
        stage.stageId.replaceAll('-', ' '),
        stage.status === 'unavailable'
          ? 'unavailable'
          : stage.status === 'pending'
            ? 'pending'
            : 'metadata',
        stage.reason ?? `${stage.recordCount} committed records; ${stage.verificationStatus}.`,
        ['pipeline-stages'],
      ),
    ),
    artifactIds: [
      'query-definitions',
      'candidate-sets',
      'pipeline-stages',
      'reference-readiness',
      'reference-shortfalls',
    ],
    limitations: [
      plan.approvalRequirement.reason,
      'This estimate does not launch BioMiner, download media, or run a model.',
    ],
  })
}

function inspectStage(stageId: string, replay: ReplayEvidence): ResearchToolResult {
  const stage = replay.mission.pipelineStages.find(({ stageId: candidate }) => candidate === stageId.trim())
  if (stage === undefined) {
    return result({
      tool: 'inspect_stage',
      status: 'unavailable',
      replay,
      summary: `No committed pipeline stage has the ID ${stageId.trim()}.`,
      facts: [fact('stage_id', 'Requested stage ID', stageId.trim(), 'unavailable')],
      artifactIds: ['pipeline-stages'],
      limitations: ['Stage IDs must match the committed pipeline-stage artifact exactly.'],
    })
  }
  const status: ResearchToolStatus =
    stage.status === 'unavailable'
      ? 'unavailable'
      : stage.status === 'pending'
        ? 'blocked'
        : 'available'
  const recordStatus: ResearchRecordStatus =
    stage.status === 'unavailable'
      ? 'unavailable'
      : stage.status === 'pending'
        ? 'pending'
        : 'metadata'
  const embeddingReuseUnavailable = stage.stageId === 'full-frame-transformation'
  return result({
    tool: 'inspect_stage',
    status,
    replay,
    summary: `${stage.stageId} is ${stage.status} with ${stage.recordCount} committed records.`,
    facts: [
      fact('record_count', 'Committed record count', stage.recordCount, recordStatus === 'metadata' ? 'metadata' : recordStatus === 'pending' ? 'blocked' : 'unavailable'),
      fact('verification_status', 'Verification status', stage.verificationStatus, recordStatus === 'metadata' ? 'verified' : recordStatus === 'pending' ? 'blocked' : 'unavailable'),
      fact('scientific_claim_allowed', 'Scientific claim allowed', stage.scientificClaimAllowed, stage.scientificClaimAllowed ? 'verified' : 'blocked'),
      ...(embeddingReuseUnavailable
        ? [fact('embedding_reuse_count', 'Reused embeddings', null, 'unavailable')]
        : []),
    ],
    records: [
      record(
        stage.stageId,
        stage.stageId.replaceAll('-', ' '),
        recordStatus,
        stage.reason ?? 'The stage count and verification status are committed.',
        ['pipeline-stages'],
      ),
    ],
    artifactIds: [
      'pipeline-stages',
      'stage-metrics',
      ...(embeddingReuseUnavailable ? ['run-summary'] : []),
    ],
    limitations: [
      'Stage availability does not by itself establish a scientific result.',
      ...(embeddingReuseUnavailable
        ? ['No embedding artifact, cache-hit field, or reuse-event ledger is committed.']
        : []),
    ],
  })
}

function traceLineage(recordId: string, replay: ReplayEvidence): ResearchToolResult {
  if (!sameRecord(recordId, replay)) {
    return unknownRecordResult('trace_lineage', recordId, replay)
  }
  const ledger = buildEvidenceLedger(replay)
  return result({
    tool: 'trace_lineage',
    status: 'partial',
    replay,
    summary: `${ledger.events.length} ordered evidence-lifecycle events are available for ${ledger.recordId}.`,
    facts: [
      fact('chronology', 'Chronology basis', ledger.chronology),
      fact('comment_count', 'Committed comments', ledger.commentCount),
      fact('event_count', 'Lifecycle event count', ledger.events.length),
    ],
    records: ledger.events.map((event) =>
      record(
        `${event.sequence}-${event.id}`,
        event.label,
        event.status,
        `${event.detail} Verification: ${event.verification}.`,
        event.artifactIds,
      ),
    ),
    artifactIds: uniqueSorted(ledger.events.flatMap(({ artifactIds }) => artifactIds)),
    limitations: [
      'The sequence is an evidence lifecycle, not a reconstructed event-time chronology.',
      ledger.commentEnrichment,
    ],
  })
}

function compareCandidates(recordId: string, replay: ReplayEvidence): ResearchToolResult {
  if (!sameRecord(recordId, replay)) {
    return unknownRecordResult('compare_candidates', recordId, replay)
  }
  const comparison = buildCandidateComparison(replay)
  const alternatives = [
    ...comparison.displayedAlternatives,
    ...comparison.undisplayedAlternatives,
  ]
  return result({
    tool: 'compare_candidates',
    status: 'partial',
    replay,
    summary: `${comparison.alternativeCandidateCount} regional alternatives are committed, but no candidate has a visual score or rank.`,
    facts: [
      fact('total_candidate_count', 'Target plus alternatives', comparison.totalCandidateCount, 'metadata'),
      fact('alternative_candidate_count', 'Regional alternatives', comparison.alternativeCandidateCount, 'metadata'),
      fact('scored_candidate_count', 'Scored candidates', comparison.scoredCandidateCount, 'unavailable'),
      fact('strongest_competitor', 'Strongest competitor', null, 'unavailable'),
      fact('human_verified_source_media_count', 'Human-verified source media', comparison.referenceCoverage.humanVerifiedSourceMediaCount, 'blocked'),
    ],
    records: [
      record(
        comparison.target.acceptedTaxonKey,
        comparison.target.scientificName,
        'metadata',
        'Target under study; score and rank are unavailable.',
        ['query-definitions', 'run-summary'],
      ),
      ...alternatives.map((candidate) =>
        record(
          candidate.recordId,
          candidate.scientificName,
          'unavailable',
          `Planning position ${candidate.planPosition}; ${candidate.reason}; score and rank unavailable.`,
          ['candidate-sets', 'run-summary'],
        ),
      ),
    ],
    artifactIds: ['query-definitions', 'candidate-sets', 'run-summary', 'reference-readiness', 'reference-shortfalls'],
    limitations: [comparison.rankingReason, comparison.rankingStatement],
  })
}

function explainDecision(recordId: string, replay: ReplayEvidence): ResearchToolResult {
  if (!sameRecord(recordId, replay)) {
    return unknownRecordResult('explain_decision', recordId, replay)
  }
  const decision = replay.selectiveDecision
  return result({
    tool: 'explain_decision',
    status: 'blocked',
    replay,
    summary: `${decision.displayLabel}; the decision payload is unavailable and all ${decision.gates.length} evidence gates are unsatisfied.`,
    facts: [
      fact('state', 'Review state', decision.state, 'blocked'),
      fact('decision_status', 'Decision status', decision.decisionStatus, 'unavailable'),
      fact('abstention_status', 'Abstention status', 'not_evaluated', 'unavailable'),
      fact('candidate_visual_score_count', 'Candidate visual scores', decision.candidateVisualScoreCount, 'unavailable'),
      fact('unsatisfied_gate_count', 'Unsatisfied gates', decision.gates.length, 'blocked'),
      fact('allowed_transition', 'Allowed transition', decision.allowedTransition, 'blocked'),
    ],
    records: decision.gates.map((gate) =>
      record(
        gate.name,
        gate.name.replaceAll('_', ' '),
        'blocked',
        'The committed selective-decision metadata marks this gate unsatisfied.',
        ['selective-decision-metadata'],
      ),
    ),
    artifactIds: ['selective-decision-metadata', 'run-summary'],
    limitations: [
      decision.unavailableReason,
      'This is a deterministic explanation of public evidence fields, not hidden model reasoning.',
    ],
  })
}

function inspectReferenceStatus(
  acceptedTaxonKey: string,
  replay: ReplayEvidence,
): ResearchToolResult {
  if (!sameTaxonKey(acceptedTaxonKey, replay)) {
    return unknownTaxonResult('inspect_reference_status', acceptedTaxonKey, replay)
  }
  const reference = replay.geographyReference.reference
  return result({
    tool: 'inspect_reference_status',
    status: 'blocked',
    replay,
    summary: `${reference.eligibleSourceMediaCount} source-media candidates exist, but none is human verified.`,
    facts: [
      fact('eligible_source_media_count', 'Eligible source-media candidates', reference.eligibleSourceMediaCount, 'metadata'),
      fact('human_verified_source_media_count', 'Human-verified source media', reference.humanVerifiedSourceMediaCount, 'blocked'),
      fact('source_candidate_shortfall', 'Source-candidate shortfall', reference.sourceCandidateShortfall, 'blocked'),
      fact('human_verified_shortfall', 'Human-review shortfall', reference.humanVerifiedShortfall, 'blocked'),
      fact('groups_awaiting_human_review', 'Groups awaiting human review', reference.groupsAwaitingHumanReview, 'blocked'),
      fact('unresolved_group_count', 'Unresolved groups', reference.unresolvedGroupCount, 'blocked'),
      fact('included_image_count', 'Images included in the replay', replay.discovery.media.includedImageCount, 'verified'),
    ],
    records: replay.mission.referenceRequirements.unresolvedGroups.map((group) =>
      record(
        group.name,
        group.name.replaceAll('_', ' '),
        'blocked',
        `Reference-group status: ${group.status}.`,
        ['reference-shortfalls'],
      ),
    ),
    artifactIds: ['reference-readiness', 'reference-shortfalls', 'rights-manifest', 'attribution-manifest'],
    limitations: [
      'Source-media candidates are not verified biological references.',
      replay.discovery.media.reason,
    ],
  })
}

async function exportEvidence(recordId: string, replay: ReplayEvidence): Promise<ResearchToolResult> {
  if (!sameRecord(recordId, replay)) {
    return unknownRecordResult('export_evidence', recordId, replay)
  }
  const bundle = await prepareResearchOutputs(replay)
  return result({
    tool: 'export_evidence',
    status: 'available',
    replay,
    summary: `${bundle.files.length} deterministic local research outputs are prepared as receipts; no download was started.`,
    facts: [
      fact('file_count', 'Prepared file receipts', bundle.files.length),
      fact('manifest_signature_status', 'Manifest signature', bundle.manifestSignatureStatus, 'unavailable'),
      fact('network_requests_required', 'Network requests required', 0),
      fact('download_started', 'Browser download started', false),
    ],
    records: bundle.files.map((file) =>
      record(
        file.filename,
        file.role.replaceAll('_', ' '),
        'available',
        `${file.mediaType}; ${file.bytes.byteLength} bytes; SHA-256 ${file.sha256}.`,
        replay.artifactInventory.map(({ artifactId }) => artifactId),
      ),
    ),
    artifactIds: replay.artifactInventory.map(({ artifactId }) => artifactId),
    limitations: [
      'The tool returns file receipts, not file bytes, and has no browser-download side effect.',
      'The manifest is unsigned because no signing key is committed.',
    ],
  })
}

interface ResultInput {
  readonly tool: ResearchToolName
  readonly status: ResearchToolStatus
  readonly replay: ReplayEvidence
  readonly summary: string
  readonly facts?: readonly ResearchToolFact[]
  readonly records?: readonly ResearchToolRecord[]
  readonly artifactIds: readonly string[]
  readonly limitations?: readonly string[]
}

function result(input: ResultInput): ResearchToolResult {
  return deepFreeze({
    schemaVersion: RESEARCH_TOOL_RESULT_VERSION,
    tool: input.tool,
    status: input.status,
    bundleId: input.replay.bundleId,
    summary: input.summary,
    facts: [...(input.facts ?? [])],
    records: [...(input.records ?? [])],
    artifactIds: uniqueSorted(input.artifactIds),
    limitations: [...(input.limitations ?? [])],
    scientificClaimAllowed: false as const,
  })
}

function fact(
  id: string,
  label: string,
  value: ResearchFactValue,
  status: ResearchFactStatus = 'verified',
): ResearchToolFact {
  return Object.freeze({ id, label, value, status })
}

function record(
  id: string,
  label: string,
  status: ResearchRecordStatus,
  detail: string,
  artifactIds: readonly string[],
): ResearchToolRecord {
  return Object.freeze({ id, label, status, detail, artifactIds: uniqueSorted(artifactIds) })
}

function unknownTaxonResult(
  tool: ResearchToolName,
  acceptedTaxonKey: string,
  replay: ReplayEvidence,
): ResearchToolResult {
  return result({
    tool,
    status: 'unavailable',
    replay,
    summary: `No checksum-verified replay is available for accepted taxon key ${acceptedTaxonKey.trim()}.`,
    facts: [fact('accepted_taxon_key', 'Requested accepted taxon key', acceptedTaxonKey.trim(), 'unavailable')],
    artifactIds: ['query-definitions'],
    limitations: [`Only ${replay.target.acceptedTaxonKey} is available in this replay.`],
  })
}

function unknownRecordResult(
  tool: ResearchToolName,
  recordId: string,
  replay: ReplayEvidence,
): ResearchToolResult {
  return result({
    tool,
    status: 'unavailable',
    replay,
    summary: `No checksum-verified evidence record has the ID ${recordId.trim()}.`,
    facts: [fact('record_id', 'Requested record ID', recordId.trim(), 'unavailable')],
    artifactIds: ['run-summary'],
    limitations: [`Only ${replay.heroRecordId} has a committed decision-mechanics record.`],
  })
}

function verifyResult(resultValue: ResearchToolResult, replay: ReplayEvidence): ResearchToolResult {
  if (!validateResult(resultValue)) {
    throw new ResearchToolError(
      'invalid_result',
      `${resultValue.tool} returned an invalid result: ${formatValidationErrors(validateResult.errors)}`,
    )
  }
  validateResultBounds(resultValue)
  const inventoryIds = new Set(replay.artifactInventory.map(({ artifactId }) => artifactId))
  const citedIds = [
    ...resultValue.artifactIds,
    ...resultValue.records.flatMap(({ artifactIds }) => artifactIds),
  ]
  const invalid = uniqueSorted(citedIds.filter((artifactId) => !inventoryIds.has(artifactId)))
  if (invalid.length > 0) {
    throw new ResearchToolError(
      'unverified_artifact',
      `${resultValue.tool} cited unverified artifacts: ${invalid.join(', ')}`,
    )
  }
  return resultValue
}

function validateResultBounds(resultValue: ResearchToolResult): void {
  const invalid =
    !boundedText(resultValue.bundleId, 160) ||
    !boundedText(resultValue.summary, 1_200) ||
    resultValue.facts.length > 48 ||
    resultValue.records.length > 64 ||
    resultValue.limitations.length > 16 ||
    !boundedArtifactIds(resultValue.artifactIds) ||
    resultValue.facts.some(
      (item) =>
        !boundedText(item.id, 120) ||
        !boundedText(item.label, 160) ||
        (typeof item.value === 'string' && item.value.length > 1_200),
    ) ||
    resultValue.records.some(
      (item) =>
        !boundedText(item.id, 180) ||
        !boundedText(item.label, 180) ||
        !boundedText(item.detail, 2_000) ||
        !boundedArtifactIds(item.artifactIds),
    ) ||
    resultValue.limitations.some((item) => !boundedText(item, 1_200))
  if (invalid) {
    throw new ResearchToolError(
      'invalid_result',
      `${resultValue.tool} returned data outside the bounded research-tool contract`,
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

function researchToolName(value: string): ResearchToolName {
  switch (value) {
    case 'resolve_taxon':
    case 'inspect_query_coverage':
    case 'estimate_mission':
    case 'inspect_stage':
    case 'trace_lineage':
    case 'compare_candidates':
    case 'explain_decision':
    case 'inspect_reference_status':
    case 'export_evidence':
      return value
  }
  throw new ResearchToolError('unknown_tool', `Unknown research tool: ${value}`)
}

function readString(value: unknown, key: string): string {
  if (!isRecord(value) || typeof value[key] !== 'string') {
    throw new ResearchToolError('invalid_arguments', `${key} must be a string`)
  }
  const candidate = value[key]
  if (!boundedText(candidate, 160)) {
    throw new ResearchToolError(
      'invalid_arguments',
      `${key} must contain between 1 and 160 characters`,
    )
  }
  return candidate
}

function readInteger(value: unknown, key: string): number {
  if (!isRecord(value)) {
    throw new ResearchToolError('invalid_arguments', `${key} must be an integer`)
  }
  const candidate = value[key]
  if (typeof candidate !== 'number' || !Number.isInteger(candidate)) {
    throw new ResearchToolError('invalid_arguments', `${key} must be an integer`)
  }
  if (candidate < 1 || candidate > 50) {
    throw new ResearchToolError('invalid_arguments', `${key} must be between 1 and 50`)
  }
  return candidate
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sameTaxonKey(value: string, replay: ReplayEvidence): boolean {
  return value.trim().toLocaleLowerCase('en-US') === replay.target.acceptedTaxonKey.toLocaleLowerCase('en-US')
}

function sameRecord(value: string, replay: ReplayEvidence): boolean {
  return value.trim() === replay.heroRecordId
}

function formatValidationErrors(errors: readonly ErrorObject[] | null | undefined): string {
  if (errors === undefined || errors === null || errors.length === 0) {
    return 'validation failed'
  }
  return errors
    .map((error) => `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`)
    .join('; ')
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
