import Ajv2020, {
  type ErrorObject,
  type ValidateFunction,
} from 'ajv/dist/2020.js'

import {
  calculateVerificationCoverage,
  projectVerificationConsensus,
  validateReviewRequirement,
  validateSamplingPlan,
  validateVerificationConsensus,
  validateVerificationEvent,
  validateVerificationEventExtension,
  validateVerificationEventLedger,
  validateVerificationItem,
  validateVerificationQualitySnapshot,
  verifyVerificationQualitySnapshotFingerprint,
  type HumanReviewInspection,
  type VerificationCampaign,
  type VerificationConsensus,
  type VerificationEvent,
  type VerificationItem,
  type VerificationQualitySnapshot,
} from '../review/domain'

export const VERIFICATION_TOOL_EVIDENCE_VERSION =
  'taxalens-verification-tool-evidence:v1.1.0' as const
export const VERIFICATION_TOOL_RESULT_VERSION =
  'taxalens-verification-tool-result:v1.1.0' as const
export const VERIFICATION_ARTIFACT_CITATION_VERSION =
  'taxalens-verification-artifact-citation:v1.0.0' as const

const MAX_BATCH_SIZE = 50
const MAX_ARTIFACT_CITATIONS = 64
const MAX_FACTS = 48
const MAX_RECORDS = 64

export const VERIFICATION_TOOL_NAMES = Object.freeze([
  'inspect_verification_campaign',
  'inspect_review_coverage',
  'inspect_quality_snapshot',
  'inspect_review_conflicts',
  'inspect_reference_readiness',
  'inspect_sampling_plan',
  'recommend_next_review_batch',
  'explain_quality_change',
] as const)

export type VerificationToolName =
  (typeof VERIFICATION_TOOL_NAMES)[number]
export type VerificationToolStatus =
  | 'available'
  | 'partial'
  | 'unavailable'
  | 'blocked'
export type VerificationToolFactStatus =
  | 'verified'
  | 'metadata'
  | 'unavailable'
  | 'blocked'
export type VerificationToolRecordStatus =
  | 'available'
  | 'metadata'
  | 'pending'
  | 'unavailable'
  | 'blocked'
export type VerificationToolFactValue = boolean | null | number | string

export const VERIFICATION_ARTIFACT_KINDS = Object.freeze([
  'campaign_manifest',
  'item_manifest',
  'event_ledger',
  'consensus',
  'quality_snapshot',
  'biominer_source',
] as const)

export type VerificationArtifactKind =
  (typeof VERIFICATION_ARTIFACT_KINDS)[number]

export interface VerificationArtifactCitation {
  readonly schemaVersion: typeof VERIFICATION_ARTIFACT_CITATION_VERSION
  readonly artifactKind: VerificationArtifactKind
  readonly artifactId: string
  readonly sha256: string
  readonly sourceRepository: string
  readonly sourceCommit: string
  readonly sourcePath: string
}

export interface VerificationToolFact {
  readonly id: string
  readonly label: string
  readonly value: VerificationToolFactValue
  readonly status: VerificationToolFactStatus
}

export interface VerificationToolRecord {
  readonly id: string
  readonly label: string
  readonly status: VerificationToolRecordStatus
  readonly detail: string
}

export interface VerificationToolResult {
  readonly schemaVersion: typeof VERIFICATION_TOOL_RESULT_VERSION
  readonly tool: VerificationToolName
  readonly status: VerificationToolStatus
  readonly campaignId: string
  readonly summary: string
  readonly facts: readonly VerificationToolFact[]
  readonly records: readonly VerificationToolRecord[]
  readonly artifactIds: readonly string[]
  readonly artifactCitations: readonly VerificationArtifactCitation[]
  readonly limitations: readonly string[]
  readonly scientificClaimAllowed: false
}

export interface VerificationToolEvidenceInput {
  readonly evidenceId: string
  readonly campaign: VerificationCampaign
  readonly items: readonly VerificationItem[]
  readonly events: readonly VerificationEvent[]
  readonly consensus: readonly VerificationConsensus[]
  readonly inspections: Readonly<Record<string, HumanReviewInspection>>
  readonly qualitySnapshots: readonly VerificationQualitySnapshot[]
  readonly artifactCitations: readonly VerificationArtifactCitation[]
}

export interface VerificationToolEvidence
  extends VerificationToolEvidenceInput {
  readonly schemaVersion: typeof VERIFICATION_TOOL_EVIDENCE_VERSION
}

interface JsonObjectSchema {
  readonly type: 'object'
  readonly properties: Readonly<Record<string, unknown>>
  readonly required: readonly string[]
  readonly additionalProperties: false
}

export interface VerificationToolDefinition {
  readonly type: 'function'
  readonly name: VerificationToolName
  readonly description: string
  readonly strict: true
  readonly parameters: JsonObjectSchema
  readonly output_schema: JsonObjectSchema
  readonly allowed_callers: readonly ('direct' | 'programmatic')[]
}

export type VerificationToolErrorCode =
  | 'invalid_arguments'
  | 'invalid_evidence'
  | 'invalid_result'
  | 'unknown_tool'

export class VerificationToolError extends Error {
  readonly code: VerificationToolErrorCode

  constructor(code: VerificationToolErrorCode, message: string) {
    super(message)
    this.name = 'VerificationToolError'
    this.code = code
  }
}

const EVIDENCE_MARKER = Symbol('validated-verification-tool-evidence')

type ValidatedVerificationToolEvidence = VerificationToolEvidence & {
  readonly [EVIDENCE_MARKER]: true
}

const STRING_ARGUMENT = Object.freeze({
  type: 'string',
  description: 'An exact non-empty committed identifier of at most 160 characters.',
})
const DIGEST_ARGUMENT = Object.freeze({
  type: 'string',
  description: 'An exact lowercase SHA-256 digest from the verification evidence packet.',
})
const BATCH_SIZE_ARGUMENT = Object.freeze({
  type: 'integer',
  description: 'A whole-number review batch size from 1 through 50.',
})
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

const OUTPUT_SCHEMA: JsonObjectSchema = deepFreeze({
  type: 'object',
  additionalProperties: false,
  properties: {
    schemaVersion: {
      type: 'string',
      const: VERIFICATION_TOOL_RESULT_VERSION,
    },
    tool: { type: 'string', enum: VERIFICATION_TOOL_NAMES },
    status: { type: 'string', enum: STATUS_VALUES },
    campaignId: { type: 'string' },
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
        },
        required: ['id', 'label', 'status', 'detail'],
      },
    },
    artifactIds: {
      type: 'array',
      items: { type: 'string' },
    },
    artifactCitations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          schemaVersion: {
            type: 'string',
            const: VERIFICATION_ARTIFACT_CITATION_VERSION,
          },
          artifactKind: {
            type: 'string',
            enum: VERIFICATION_ARTIFACT_KINDS,
          },
          artifactId: { type: 'string' },
          sha256: { type: 'string' },
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
    'campaignId',
    'summary',
    'facts',
    'records',
    'artifactIds',
    'artifactCitations',
    'limitations',
    'scientificClaimAllowed',
  ],
})

function parameters(
  properties: Readonly<Record<string, unknown>>,
): JsonObjectSchema {
  return deepFreeze({
    type: 'object',
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  })
}

function definition(
  name: VerificationToolName,
  description: string,
  input: JsonObjectSchema,
): VerificationToolDefinition {
  return deepFreeze({
    type: 'function',
    name,
    description,
    strict: true,
    parameters: input,
    output_schema: outputSchema(name),
    allowed_callers: ['direct', 'programmatic'],
  })
}

function outputSchema(name: VerificationToolName): JsonObjectSchema {
  return deepFreeze({
    ...OUTPUT_SCHEMA,
    properties: {
      ...OUTPUT_SCHEMA.properties,
      tool: { type: 'string', const: name },
    },
  })
}

export const VERIFICATION_TOOL_DEFINITIONS:
  readonly VerificationToolDefinition[] = Object.freeze([
    definition(
      'inspect_verification_campaign',
      'Inspect the exact committed verification campaign, review requirement, and evidence counts.',
      parameters({ campaign_id: STRING_ARGUMENT }),
    ),
    definition(
      'inspect_review_coverage',
      'Calculate deterministic review, decision, inspection, and viewability coverage.',
      parameters({ campaign_id: STRING_ARGUMENT }),
    ),
    definition(
      'inspect_quality_snapshot',
      'Inspect one immutable verification quality snapshot without inferring unavailable metrics.',
      parameters({
        campaign_id: STRING_ARGUMENT,
        snapshot_sha256: DIGEST_ARGUMENT,
      }),
    ),
    definition(
      'inspect_review_conflicts',
      'Inspect unresolved disagreements and adjudicated items from the consensus projection.',
      parameters({ campaign_id: STRING_ARGUMENT }),
    ),
    definition(
      'inspect_reference_readiness',
      'Inspect reference readiness and reference-bank evidence from one immutable quality snapshot.',
      parameters({
        campaign_id: STRING_ARGUMENT,
        snapshot_sha256: DIGEST_ARGUMENT,
      }),
    ),
    definition(
      'inspect_sampling_plan',
      'Inspect the declared sampling purpose, design, strata, representativeness, and leakage boundary.',
      parameters({ campaign_id: STRING_ARGUMENT }),
    ),
    definition(
      'recommend_next_review_batch',
      'Rank a bounded batch of existing campaign item IDs for human review without creating taxa or evidence.',
      parameters({
        campaign_id: STRING_ARGUMENT,
        batch_size: BATCH_SIZE_ARGUMENT,
      }),
    ),
    definition(
      'explain_quality_change',
      'Describe deterministic metric and gate changes between two immutable quality snapshots.',
      parameters({
        campaign_id: STRING_ARGUMENT,
        before_snapshot_sha256: DIGEST_ARGUMENT,
        after_snapshot_sha256: DIGEST_ARGUMENT,
      }),
    ),
  ])

const ajv = new Ajv2020({ allErrors: true, strict: true })
const argumentValidators = new Map<
  VerificationToolName,
  ValidateFunction
>(
  VERIFICATION_TOOL_DEFINITIONS.map((tool) => [
    tool.name,
    ajv.compile(tool.parameters),
  ]),
)
const validateResult = ajv.compile(OUTPUT_SCHEMA)

export async function createVerificationToolEvidence(
  input: VerificationToolEvidenceInput,
): Promise<VerificationToolEvidence> {
  const evidenceId = boundedIdentifier(input.evidenceId, 'evidenceId')
  const failures = validateEvidence(input)
  if (failures.length > 0) {
    throw new VerificationToolError(
      'invalid_evidence',
      `Verification tool evidence is invalid: ${failures.join('; ')}`,
    )
  }
  for (const snapshot of input.qualitySnapshots) {
    if (!(await verifyVerificationQualitySnapshotFingerprint(snapshot))) {
      throw new VerificationToolError(
        'invalid_evidence',
        `Quality snapshot fingerprint is invalid: ${snapshot.snapshotSha256}`,
      )
    }
  }

  const evidence = deepFreeze({
    schemaVersion: VERIFICATION_TOOL_EVIDENCE_VERSION,
    evidenceId,
    campaign: input.campaign,
    items: [...input.items],
    events: [...input.events],
    consensus: [...input.consensus],
    inspections: { ...input.inspections },
    qualitySnapshots: [...input.qualitySnapshots],
    artifactCitations: canonicalArtifactCitations(input.artifactCitations),
    [EVIDENCE_MARKER]: true as const,
  }) satisfies ValidatedVerificationToolEvidence
  return evidence
}

export function executeVerificationTool(
  requestedName: string,
  args: unknown,
  evidence: VerificationToolEvidence,
): VerificationToolResult {
  assertValidatedEvidence(evidence)
  const name = verificationToolName(requestedName)
  const validateArguments = argumentValidators.get(name)
  if (validateArguments === undefined || !validateArguments(args)) {
    throw new VerificationToolError(
      'invalid_arguments',
      `${name} arguments are invalid: ${formatValidationErrors(validateArguments?.errors)}`,
    )
  }
  const campaignId = readIdentifier(args, 'campaign_id')
  if (campaignId !== evidence.campaign.campaignId) {
    throw new VerificationToolError(
      'invalid_arguments',
      `${name} requires the exact committed campaign ID`,
    )
  }

  let resultValue: VerificationToolResult
  switch (name) {
    case 'inspect_verification_campaign':
      resultValue = inspectVerificationCampaign(evidence)
      break
    case 'inspect_review_coverage':
      resultValue = inspectReviewCoverage(evidence)
      break
    case 'inspect_quality_snapshot':
      resultValue = inspectQualitySnapshot(
        readDigest(args, 'snapshot_sha256'),
        evidence,
      )
      break
    case 'inspect_review_conflicts':
      resultValue = inspectReviewConflicts(evidence)
      break
    case 'inspect_reference_readiness':
      resultValue = inspectReferenceReadiness(
        readDigest(args, 'snapshot_sha256'),
        evidence,
      )
      break
    case 'inspect_sampling_plan':
      resultValue = inspectSamplingPlan(evidence)
      break
    case 'recommend_next_review_batch':
      resultValue = recommendNextReviewBatch(
        readBatchSize(args, 'batch_size'),
        evidence,
      )
      break
    case 'explain_quality_change':
      resultValue = explainQualityChange(
        readDigest(args, 'before_snapshot_sha256'),
        readDigest(args, 'after_snapshot_sha256'),
        evidence,
      )
      break
  }
  return verifyToolResult(resultValue, evidence)
}

function inspectVerificationCampaign(
  evidence: VerificationToolEvidence,
): VerificationToolResult {
  const { campaign, items, events, consensus, qualitySnapshots } = evidence
  const target = campaign.targetTaxon
  return result({
    tool: 'inspect_verification_campaign',
    status: 'available',
    campaignId: campaign.campaignId,
    summary: `${campaign.title} contains ${items.length} committed items and ${events.length} append-only review events.`,
    facts: [
      fact('campaign_kind', 'Campaign kind', campaign.kind, 'metadata'),
      fact('campaign_status', 'Campaign status', campaign.status, 'metadata'),
      fact('item_count', 'Item count', items.length),
      fact('event_count', 'Event count', events.length),
      fact('consensus_count', 'Consensus item count', consensus.length),
      fact(
        'quality_snapshot_count',
        'Quality snapshot count',
        qualitySnapshots.length,
      ),
      fact(
        'required_independent_reviewers',
        'Required independent reviewers',
        campaign.reviewRequirement.requiredIndependentReviewers,
      ),
      fact('public_replay', 'Public replay', campaign.publicReplay, 'metadata'),
      fact(
        'target_accepted_taxon_key',
        'Committed target taxon key',
        target?.acceptedTaxonKey ?? null,
        target === null ? 'unavailable' : 'verified',
      ),
      fact(
        'target_scientific_name',
        'Committed target scientific name',
        target?.scientificName ?? null,
        target === null ? 'unavailable' : 'verified',
      ),
    ],
    records: campaign.sourceProviders.map((provider) =>
      record(
        `source:${provider}`,
        provider,
        'metadata',
        'Declared campaign source provider.',
      ),
    ),
    limitations: [
      'Campaign metadata does not itself establish population quality or taxonomic correctness.',
    ],
  }, evidence)
}

function inspectReviewCoverage(
  evidence: VerificationToolEvidence,
): VerificationToolResult {
  const coverage = calculateVerificationCoverage(
    evidence.items,
    evidence.consensus,
    evidence.inspections,
  )
  const status: VerificationToolStatus =
    coverage.eligibleItems === 0 ? 'unavailable' : 'available'
  return result({
    tool: 'inspect_review_coverage',
    status,
    campaignId: evidence.campaign.campaignId,
    summary:
      coverage.eligibleItems === 0
        ? 'The committed campaign has no eligible review items.'
        : `${coverage.attemptedItems} of ${coverage.eligibleItems} items have an effective review attempt; ${coverage.decisivelyReviewedItems} are resolved decisively.`,
    facts: [
      fact('eligible_items', 'Eligible items', coverage.eligibleItems),
      fact('attempted_items', 'Attempted items', coverage.attemptedItems),
      fact('unattempted_items', 'Unattempted items', coverage.unattemptedItems),
      fact(
        'decisively_reviewed_items',
        'Decisively reviewed items',
        coverage.decisivelyReviewedItems,
      ),
      fact('resolved_yes_items', 'Resolved Yes items', coverage.resolvedYesItems),
      fact('resolved_no_items', 'Resolved No items', coverage.resolvedNoItems),
      fact('uncertain_items', 'Uncertain items', coverage.uncertainItems),
      fact('media_failure_items', 'Media failure items', coverage.mediaFailureItems),
      fact('deferred_items', 'Deferred items', coverage.deferredItems),
      fact('pending_items', 'Pending items', coverage.pendingItems),
      fact(
        'effective_review_count',
        'Effective review count',
        coverage.effectiveReviewCount,
      ),
      fact('review_coverage', 'Review coverage', coverage.reviewCoverage),
      fact(
        'inspection_coverage',
        'Inspection coverage',
        coverage.inspectionCoverage,
      ),
      fact('viewability_rate', 'Viewability rate', coverage.viewabilityRate),
    ],
    records: consensusStateRecords(evidence.consensus),
    limitations: [
      'Coverage is descriptive; only a representative probability sample can support population-quality estimation.',
    ],
  }, evidence)
}

function inspectQualitySnapshot(
  snapshotSha256: string,
  evidence: VerificationToolEvidence,
): VerificationToolResult {
  const snapshot = findSnapshot(snapshotSha256, evidence)
  if (snapshot === undefined) {
    return unavailableSnapshotResult(
      'inspect_quality_snapshot',
      snapshotSha256,
      evidence,
    )
  }
  const status: VerificationToolStatus =
    snapshot.precision.availability === 'unavailable' ||
    snapshot.precision.intervalAvailability === 'unavailable'
      ? 'partial'
      : snapshot.release.status === 'blocked'
        ? 'blocked'
        : 'available'
  return result({
    tool: 'inspect_quality_snapshot',
    status,
    campaignId: evidence.campaign.campaignId,
    summary: `Snapshot ${snapshot.snapshotSha256} records ${snapshot.counts.decisiveQualitySampleItems} decisive quality-sample items and release state ${snapshot.release.status}.`,
    facts: [
      fact('captured_at', 'Captured at', snapshot.capturedAt, 'metadata'),
      fact(
        'decisive_quality_sample_items',
        'Decisive quality sample items',
        snapshot.counts.decisiveQualitySampleItems,
      ),
      fact(
        'precision_availability',
        'Precision availability',
        snapshot.precision.availability,
        snapshot.precision.availability === 'available'
          ? 'verified'
          : 'unavailable',
      ),
      fact(
        'precision_point_estimate',
        'Precision point estimate',
        snapshot.precision.pointEstimate,
        snapshot.precision.pointEstimate === null
          ? 'unavailable'
          : 'verified',
      ),
      fact(
        'precision_interval_lower',
        'Precision interval lower bound',
        snapshot.precision.interval?.lower ?? null,
        snapshot.precision.interval === null ? 'unavailable' : 'verified',
      ),
      fact(
        'precision_interval_upper',
        'Precision interval upper bound',
        snapshot.precision.interval?.upper ?? null,
        snapshot.precision.interval === null ? 'unavailable' : 'verified',
      ),
      fact(
        'pairwise_agreement',
        'Pairwise reviewer agreement',
        snapshot.agreement.pairwise.percentAgreement,
        snapshot.agreement.pairwise.percentAgreement === null
          ? 'unavailable'
          : 'verified',
      ),
      fact(
        'nominal_alpha',
        'Nominal Krippendorff alpha',
        snapshot.agreement.nominalAlpha.alpha,
        snapshot.agreement.nominalAlpha.alpha === null
          ? 'unavailable'
          : 'verified',
      ),
      fact(
        'unresolved_conflict_items',
        'Unresolved conflict items',
        snapshot.conflicts.unresolvedConflictItems,
      ),
      fact(
        'reference_readiness',
        'Reference readiness',
        snapshot.referenceReadiness.status,
        gateFactStatus(snapshot.referenceReadiness.status),
      ),
      fact(
        'release_status',
        'Release status',
        snapshot.release.status,
        snapshot.release.status === 'release_ready'
          ? 'verified'
          : snapshot.release.status === 'blocked'
            ? 'blocked'
            : 'metadata',
      ),
    ],
    records: [
      ...snapshot.precision.estimateBlockers.map((blocker) =>
        record(
          `precision:${blocker}`,
          blocker,
          'blocked',
          'Precision estimate blocker.',
        ),
      ),
      ...snapshot.release.blockers.map((blocker) =>
        record(
          `release:${blocker}`,
          blocker,
          'blocked',
          'Release-policy blocker.',
        ),
      ),
    ],
    limitations: [
      'A quality snapshot is immutable evidence at one milestone, not a guarantee about future data.',
    ],
  }, evidence)
}

function inspectReviewConflicts(
  evidence: VerificationToolEvidence,
): VerificationToolResult {
  const unresolved = evidence.consensus.filter(
    ({ status }) => status === 'unresolved_disagreement',
  )
  const adjudicated = evidence.consensus.filter(
    ({ status }) => status === 'adjudicated',
  )
  const attempted = evidence.consensus.filter(
    ({ effectiveReviewCount }) => effectiveReviewCount > 0,
  ).length
  const conflicted = unresolved.length + adjudicated.length
  return result({
    tool: 'inspect_review_conflicts',
    status: unresolved.length > 0 ? 'blocked' : 'available',
    campaignId: evidence.campaign.campaignId,
    summary:
      unresolved.length > 0
        ? `${unresolved.length} review conflicts remain unresolved and require independent resolution.`
        : `No unresolved review conflict is present; ${adjudicated.length} conflicted items have been adjudicated.`,
    facts: [
      fact('unresolved_conflict_items', 'Unresolved conflicts', unresolved.length),
      fact('adjudicated_items', 'Adjudicated items', adjudicated.length),
      fact('conflicted_items', 'All conflicted items', conflicted),
      fact('attempted_items', 'Attempted items', attempted),
      fact(
        'conflict_rate',
        'Conflict rate among attempted items',
        attempted === 0 ? null : conflicted / attempted,
        attempted === 0 ? 'unavailable' : 'verified',
      ),
    ],
    records: [...unresolved, ...adjudicated].map((item) =>
      record(
        item.itemId,
        item.itemId,
        item.status === 'unresolved_disagreement' ? 'blocked' : 'available',
        item.status === 'unresolved_disagreement'
          ? `Unresolved fields: ${item.conflictingFields.join(', ')}; event IDs: ${item.conflictEventIds.join(', ')}.`
          : `Resolved by adjudication at ${item.resolvedAt ?? 'an unavailable time'}.`,
      ),
    ),
    limitations: [
      'Reviewer disagreement is retained as evidence; a majority does not overwrite a dissenting effective judgment.',
    ],
  }, evidence)
}

function inspectReferenceReadiness(
  snapshotSha256: string,
  evidence: VerificationToolEvidence,
): VerificationToolResult {
  const snapshot = findSnapshot(snapshotSha256, evidence)
  if (snapshot === undefined) {
    return unavailableSnapshotResult(
      'inspect_reference_readiness',
      snapshotSha256,
      evidence,
    )
  }
  const bank = snapshot.referenceBank
  const status: VerificationToolStatus =
    snapshot.referenceReadiness.status === 'ready'
      ? bank === null
        ? 'partial'
        : 'available'
      : snapshot.referenceReadiness.status === 'not_ready'
        ? 'blocked'
        : 'unavailable'
  return result({
    tool: 'inspect_reference_readiness',
    status,
    campaignId: evidence.campaign.campaignId,
    summary:
      bank === null
        ? `Reference readiness is ${snapshot.referenceReadiness.status}, but no reference-bank quality projection is attached.`
        : `Reference readiness is ${snapshot.referenceReadiness.status}; the snapshot records ${bank.verifiedSupportCount} independently verified support records and ${bank.prototypeSupportCount} prototype support records.`,
    facts: [
      fact(
        'reference_readiness_status',
        'Reference readiness status',
        snapshot.referenceReadiness.status,
        gateFactStatus(snapshot.referenceReadiness.status),
      ),
      fact(
        'prototype_support_count',
        'Prototype support count',
        bank?.prototypeSupportCount ?? null,
        bank === null ? 'unavailable' : 'verified',
      ),
      fact(
        'verified_support_count',
        'Independently verified support count',
        bank?.verifiedSupportCount ?? null,
        bank === null ? 'unavailable' : 'verified',
      ),
      fact(
        'excluded_support_count',
        'Excluded support count',
        bank?.excludedSupportCount ?? null,
        bank === null ? 'unavailable' : 'verified',
      ),
      fact(
        'attested_role_suitable_count',
        'Attested prototype-role suitable count',
        bank?.prototypeRoleAttestations.suitableRecordCount ?? null,
        bank === null ? 'unavailable' : 'verified',
      ),
      fact(
        'independent_human_taxonomic_verification_claimed',
        'Independent human taxonomic verification claimed',
        bank?.prototypeRoleAttestations
          .independentHumanTaxonomicVerificationClaimed ?? null,
        bank === null ? 'unavailable' : 'verified',
      ),
    ],
    records: [
      ...snapshot.referenceReadiness.blockers.map((blocker) =>
        record(
          `readiness:${blocker}`,
          blocker,
          'blocked',
          'Reference-readiness blocker.',
        ),
      ),
      ...(bank?.readiness.blockers ?? []).map((blocker) =>
        record(
          `reference-bank:${blocker}`,
          blocker,
          'blocked',
          'Reference-bank blocker.',
        ),
      ),
    ],
    limitations: [
      'Prototype-role suitability attestations are not independent human taxonomic verification unless the evidence explicitly says so.',
    ],
  }, evidence)
}

function inspectSamplingPlan(
  evidence: VerificationToolEvidence,
): VerificationToolResult {
  const plan = evidence.campaign.samplingPlan
  return result({
    tool: 'inspect_sampling_plan',
    status: plan.qualityEstimationAllowed ? 'available' : 'blocked',
    campaignId: evidence.campaign.campaignId,
    summary: `${plan.planId} is a ${plan.design} plan for ${plan.purpose}; quality estimation is ${plan.qualityEstimationAllowed ? 'allowed' : 'blocked'}.`,
    facts: [
      fact('sampling_purpose', 'Sampling purpose', plan.purpose, 'metadata'),
      fact('sampling_design', 'Sampling design', plan.design, 'metadata'),
      fact('representative', 'Representative sample', plan.representative),
      fact('blind_review', 'Blind review', plan.blindReview, 'metadata'),
      fact(
        'target_sample_size',
        'Target sample size',
        plan.targetSampleSize,
        plan.targetSampleSize === null ? 'unavailable' : 'verified',
      ),
      fact(
        'inclusion_probability_required',
        'Inclusion probability required',
        plan.inclusionProbabilityRequired,
      ),
      fact(
        'independent_unit',
        'Independent sampling unit',
        plan.independentUnit,
        'metadata',
      ),
      fact(
        'quality_estimation_allowed',
        'Quality estimation allowed',
        plan.qualityEstimationAllowed,
        plan.qualityEstimationAllowed ? 'verified' : 'blocked',
      ),
      fact('leakage_policy', 'Leakage policy', plan.leakagePolicy, 'metadata'),
    ],
    records: plan.strata.map((stratum) =>
      record(
        stratum.stratumId,
        stratum.label,
        'metadata',
        `Population=${stratum.populationCount ?? 'unknown'}; target=${stratum.targetSampleCount ?? 'unknown'}; weight=${stratum.populationWeight ?? 'unknown'}.`,
      ),
    ),
    limitations: plan.qualityEstimationAllowed
      ? [
          'Representativeness still depends on executing the declared sampling design without substitution or leakage.',
        ]
      : [
          plan.qualityEstimationBlockedReason ??
            'The sampling plan does not authorize population-quality estimation.',
        ],
  }, evidence)
}

function recommendNextReviewBatch(
  batchSize: number,
  evidence: VerificationToolEvidence,
): VerificationToolResult {
  const consensusByItem = new Map(
    evidence.consensus.map((item) => [item.itemId, item]),
  )
  const candidates = evidence.items
    .map((item, manifestIndex) => {
      const consensus = consensusByItem.get(item.itemId)
      if (consensus === undefined) {
        throw new VerificationToolError(
          'invalid_evidence',
          `Consensus is unavailable for item: ${item.itemId}`,
        )
      }
      return reviewCandidate(
        item,
        consensus,
        manifestIndex,
        evidence.campaign.samplingPlan.purpose,
      )
    })
    .filter((candidate): candidate is ReviewCandidate => candidate !== null)
    .sort(compareReviewCandidates)
  const selected = candidates.slice(0, batchSize)
  return result({
    tool: 'recommend_next_review_batch',
    status: selected.length === 0 ? 'unavailable' : 'available',
    campaignId: evidence.campaign.campaignId,
    summary:
      selected.length === 0
        ? 'No unresolved committed item is eligible for another review action.'
        : `${selected.length} existing item IDs are recommended from ${candidates.length} unresolved candidates.`,
    facts: [
      fact('requested_batch_size', 'Requested batch size', batchSize),
      fact('eligible_candidate_count', 'Eligible candidates', candidates.length),
      fact('recommended_item_count', 'Recommended items', selected.length),
      fact(
        'sampling_purpose',
        'Sampling purpose',
        evidence.campaign.samplingPlan.purpose,
        'metadata',
      ),
      fact(
        'preserves_manifest_identity',
        'Uses only committed item identities',
        true,
      ),
      fact('creates_taxon_identity', 'Creates a taxon identity', false),
    ],
    records: selected.map((candidate) =>
      record(
        candidate.itemId,
        candidate.itemId,
        candidate.status,
        `Priority ${candidate.priority}: ${candidate.reason}.`,
      ),
    ),
    limitations: [
      'The ranking selects only existing campaign items and cannot repair missing media, sampling bias, or upstream evidence.',
    ],
  }, evidence)
}

function explainQualityChange(
  beforeSha256: string,
  afterSha256: string,
  evidence: VerificationToolEvidence,
): VerificationToolResult {
  const before = findSnapshot(beforeSha256, evidence)
  const after = findSnapshot(afterSha256, evidence)
  if (before === undefined || after === undefined) {
    const missing = [
      ...(before === undefined ? [beforeSha256] : []),
      ...(after === undefined ? [afterSha256] : []),
    ]
    return result({
      tool: 'explain_quality_change',
      status: 'unavailable',
      campaignId: evidence.campaign.campaignId,
      summary: `Quality change cannot be calculated because snapshots are unavailable: ${missing.join(', ')}.`,
      facts: [
        fact('before_snapshot_available', 'Before snapshot available', before !== undefined),
        fact('after_snapshot_available', 'After snapshot available', after !== undefined),
      ],
      records: missing.map((digest) =>
        record(
          digest,
          digest,
          'unavailable',
          'No immutable quality snapshot with this digest exists in the evidence packet.',
        ),
      ),
      limitations: [
        'Quality changes require two exact immutable snapshot digests.',
      ],
    }, evidence)
  }
  const changes = qualityChanges(before, after)
  const partial = changes.some(({ value }) => value === null)
  return result({
    tool: 'explain_quality_change',
    status: partial ? 'partial' : 'available',
    campaignId: evidence.campaign.campaignId,
    summary: `${changes.filter(({ changed }) => changed).length} tracked quality fields changed between ${before.capturedAt} and ${after.capturedAt}.`,
    facts: [
      fact('before_captured_at', 'Before captured at', before.capturedAt, 'metadata'),
      fact('after_captured_at', 'After captured at', after.capturedAt, 'metadata'),
      ...changes.map(({ id, label, value }) =>
        fact(id, label, value, value === null ? 'unavailable' : 'verified'),
      ),
    ],
    records: changes
      .filter(({ changed }) => changed)
      .map(({ id, label, beforeValue, afterValue }) =>
        record(
          id,
          label,
          'available',
          `Changed from ${displayValue(beforeValue)} to ${displayValue(afterValue)}.`,
        ),
      ),
    limitations: [
      'This tool describes recorded deltas and gate transitions; it does not infer a causal effect for an individual review.',
    ],
  }, evidence)
}

interface ReviewCandidate {
  readonly itemId: string
  readonly priority: number
  readonly manifestIndex: number
  readonly status: VerificationToolRecordStatus
  readonly reason: string
}

function reviewCandidate(
  item: VerificationItem,
  consensus: VerificationConsensus,
  manifestIndex: number,
  purpose: VerificationCampaign['samplingPlan']['purpose'],
): ReviewCandidate | null {
  if (
    consensus.status === 'complete_agreement' ||
    consensus.status === 'adjudicated'
  ) {
    return null
  }
  if (consensus.status === 'unresolved_disagreement') {
    return {
      itemId: item.itemId,
      priority: purpose === 'adjudication' ? 0 : 10,
      manifestIndex,
      status: 'blocked',
      reason: `resolve disagreement in ${consensus.conflictingFields.join(', ')}`,
    }
  }
  if (consensus.secondReviewRequired) {
    return {
      itemId: item.itemId,
      priority: 20,
      manifestIndex,
      status: 'pending',
      reason: 'obtain the required independent second review',
    }
  }
  if (consensus.status === 'pending') {
    return {
      itemId: item.itemId,
      priority: 30,
      manifestIndex,
      status: 'pending',
      reason: 'complete the next review required by the campaign manifest',
    }
  }
  if (consensus.status === 'uncertain_only') {
    return {
      itemId: item.itemId,
      priority: 40,
      manifestIndex,
      status: 'pending',
      reason: 'resolve an uncertain-only review state with independent evidence',
    }
  }
  if (consensus.status === 'media_failure') {
    return {
      itemId: item.itemId,
      priority: 80,
      manifestIndex,
      status: 'blocked',
      reason: 'retry only after the media access problem is addressed',
    }
  }
  return {
    itemId: item.itemId,
    priority: 90,
    manifestIndex,
    status: 'pending',
    reason: 'revisit a deferred review item',
  }
}

function compareReviewCandidates(
  left: ReviewCandidate,
  right: ReviewCandidate,
): number {
  return (
    left.priority - right.priority ||
    left.manifestIndex - right.manifestIndex ||
    left.itemId.localeCompare(right.itemId)
  )
}

interface QualityChange {
  readonly id: string
  readonly label: string
  readonly value: VerificationToolFactValue
  readonly beforeValue: VerificationToolFactValue
  readonly afterValue: VerificationToolFactValue
  readonly changed: boolean
}

function qualityChanges(
  before: VerificationQualitySnapshot,
  after: VerificationQualitySnapshot,
): readonly QualityChange[] {
  return [
    numericChange(
      'attempted_items_delta',
      'Attempted items delta',
      before.counts.attemptedItems,
      after.counts.attemptedItems,
    ),
    numericChange(
      'decisive_sample_delta',
      'Decisive quality sample delta',
      before.counts.decisiveQualitySampleItems,
      after.counts.decisiveQualitySampleItems,
    ),
    numericChange(
      'precision_point_delta',
      'Precision point-estimate delta',
      before.precision.pointEstimate,
      after.precision.pointEstimate,
    ),
    numericChange(
      'precision_lower_delta',
      'Precision lower-bound delta',
      before.precision.interval?.lower ?? null,
      after.precision.interval?.lower ?? null,
    ),
    numericChange(
      'pairwise_agreement_delta',
      'Pairwise agreement delta',
      before.agreement.pairwise.percentAgreement,
      after.agreement.pairwise.percentAgreement,
    ),
    numericChange(
      'unresolved_conflicts_delta',
      'Unresolved conflict delta',
      before.conflicts.unresolvedConflictItems,
      after.conflicts.unresolvedConflictItems,
    ),
    categoricalChange(
      'reference_readiness_change',
      'Reference readiness change',
      before.referenceReadiness.status,
      after.referenceReadiness.status,
    ),
    categoricalChange(
      'release_status_change',
      'Release status change',
      before.release.status,
      after.release.status,
    ),
  ]
}

function numericChange(
  id: string,
  label: string,
  beforeValue: number | null,
  afterValue: number | null,
): QualityChange {
  return {
    id,
    label,
    value:
      beforeValue === null || afterValue === null
        ? null
        : afterValue - beforeValue,
    beforeValue,
    afterValue,
    changed: beforeValue !== afterValue,
  }
}

function categoricalChange(
  id: string,
  label: string,
  beforeValue: string,
  afterValue: string,
): QualityChange {
  return {
    id,
    label,
    value: beforeValue === afterValue ? 'unchanged' : `${beforeValue} -> ${afterValue}`,
    beforeValue,
    afterValue,
    changed: beforeValue !== afterValue,
  }
}

function consensusStateRecords(
  consensus: readonly VerificationConsensus[],
): readonly VerificationToolRecord[] {
  const counts = new Map<string, number>()
  for (const item of consensus) {
    counts.set(item.status, (counts.get(item.status) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([status, count]) =>
      record(
        `consensus:${status}`,
        status,
        status === 'unresolved_disagreement' ? 'blocked' : 'metadata',
        `${count} item${count === 1 ? '' : 's'} in this consensus state.`,
      ),
    )
}

function unavailableSnapshotResult(
  tool: 'inspect_quality_snapshot' | 'inspect_reference_readiness',
  snapshotSha256: string,
  evidence: VerificationToolEvidence,
): VerificationToolResult {
  return result({
    tool,
    status: 'unavailable',
    campaignId: evidence.campaign.campaignId,
    summary: `No immutable quality snapshot with digest ${snapshotSha256} exists in the evidence packet.`,
    facts: [
      fact('snapshot_available', 'Snapshot available', false, 'unavailable'),
    ],
    records: [
      record(
        snapshotSha256,
        snapshotSha256,
        'unavailable',
        'The exact requested snapshot digest was not found.',
      ),
    ],
    limitations: ['Snapshot identifiers must match committed evidence exactly.'],
  }, evidence)
}

function findSnapshot(
  snapshotSha256: string,
  evidence: VerificationToolEvidence,
): VerificationQualitySnapshot | undefined {
  return evidence.qualitySnapshots.find(
    (snapshot) => snapshot.snapshotSha256 === snapshotSha256,
  )
}

interface ResultInput {
  readonly tool: VerificationToolName
  readonly status: VerificationToolStatus
  readonly campaignId: string
  readonly summary: string
  readonly facts: readonly VerificationToolFact[]
  readonly records: readonly VerificationToolRecord[]
  readonly limitations: readonly string[]
}

function result(
  input: ResultInput,
  evidence: VerificationToolEvidence,
): VerificationToolResult {
  const artifactCitations = canonicalArtifactCitations(
    evidence.artifactCitations,
  )
  return deepFreeze({
    schemaVersion: VERIFICATION_TOOL_RESULT_VERSION,
    tool: input.tool,
    status: input.status,
    campaignId: input.campaignId,
    summary: input.summary,
    facts: [...input.facts],
    records: [...input.records],
    artifactIds: artifactCitations.map(({ artifactId }) => artifactId),
    artifactCitations,
    limitations: [...input.limitations],
    scientificClaimAllowed: false as const,
  })
}

function fact(
  id: string,
  label: string,
  value: VerificationToolFactValue,
  status: VerificationToolFactStatus = 'verified',
): VerificationToolFact {
  return Object.freeze({ id, label, value, status })
}

function record(
  id: string,
  label: string,
  status: VerificationToolRecordStatus,
  detail: string,
): VerificationToolRecord {
  return Object.freeze({ id, label, status, detail })
}

function verifyToolResult(
  resultValue: VerificationToolResult,
  evidence: VerificationToolEvidence,
): VerificationToolResult {
  if (!validateResult(resultValue)) {
    throw new VerificationToolError(
      'invalid_result',
      `${resultValue.tool} returned an invalid result: ${formatValidationErrors(validateResult.errors)}`,
    )
  }
  if (resultValue.campaignId !== evidence.campaign.campaignId) {
    throw new VerificationToolError(
      'invalid_result',
      `${resultValue.tool} returned another campaign identity`,
    )
  }
  if (
    resultValue.artifactCitations.length > MAX_ARTIFACT_CITATIONS ||
    resultValue.facts.length > MAX_FACTS ||
    resultValue.records.length > MAX_RECORDS ||
    !boundedText(resultValue.summary, 1_000) ||
    resultValue.limitations.some((value) => !boundedText(value, 1_000)) ||
    resultValue.facts.some(
      ({ id, label, value }) =>
        !boundedText(id, 160) ||
        !boundedText(label, 240) ||
        (typeof value === 'string' && !boundedText(value, 1_000)),
    ) ||
    resultValue.records.some(
      ({ id, label, detail }) =>
        !boundedText(id, 200) ||
        !boundedText(label, 240) ||
        !boundedText(detail, 2_000),
    )
  ) {
    throw new VerificationToolError(
      'invalid_result',
      `${resultValue.tool} exceeded the bounded result contract`,
    )
  }
  const expectedCitations = canonicalArtifactCitations(
    evidence.artifactCitations,
  )
  if (
    canonicalJson(resultValue.artifactCitations) !==
      canonicalJson(expectedCitations) ||
    canonicalJson(resultValue.artifactIds) !==
      canonicalJson(expectedCitations.map(({ artifactId }) => artifactId)) ||
    !VERIFICATION_ARTIFACT_KINDS.every((kind) =>
      resultValue.artifactCitations.some(
        ({ artifactKind }) => artifactKind === kind,
      ),
    )
  ) {
    throw new VerificationToolError(
      'invalid_result',
      `${resultValue.tool} did not preserve the complete verification artifact chain`,
    )
  }
  return resultValue
}

function validateEvidence(
  input: VerificationToolEvidenceInput,
): readonly string[] {
  const failures: string[] = []
  const {
    campaign,
    items,
    events,
    consensus,
    inspections,
    qualitySnapshots,
    artifactCitations,
  } = input
  if (campaign.campaignId.trim() === '') {
    failures.push('campaign ID must not be empty')
  }
  if (!/^[a-f0-9]{64}$/u.test(campaign.manifestSha256)) {
    failures.push('campaign manifest must have a lowercase SHA-256 digest')
  }
  failures.push(
    ...validateReviewRequirement(campaign.reviewRequirement),
    ...validateSamplingPlan(campaign.samplingPlan),
  )
  const itemIds = new Set<string>()
  for (const item of items) {
    if (itemIds.has(item.itemId)) {
      failures.push(`item ID is repeated: ${item.itemId}`)
    }
    itemIds.add(item.itemId)
    failures.push(...validateVerificationItem(item, campaign))
  }
  failures.push(...validateVerificationEventLedger(events))
  for (const event of events) {
    const item = items.find(({ itemId }) => itemId === event.itemId)
    if (item === undefined) {
      failures.push(`event names an unknown item: ${event.itemId}`)
      continue
    }
    failures.push(
      ...validateVerificationEvent(event, campaign, item),
      ...validateVerificationEventExtension(
        event,
        campaign,
        item,
        events.filter((candidate) => candidate !== event),
      ),
    )
  }
  const projectedConsensus = projectVerificationConsensus(
    campaign,
    items,
    events,
  )
  if (canonicalJson(projectedConsensus) !== canonicalJson(consensus)) {
    failures.push('consensus does not match the append-only event ledger')
  }
  for (const item of consensus) {
    failures.push(...validateVerificationConsensus(item))
  }
  for (const [itemId, inspection] of Object.entries(inspections)) {
    if (
      itemId !== inspection.itemId ||
      !itemIds.has(itemId) ||
      typeof inspection.imageOpened !== 'boolean' ||
      typeof inspection.imageVerified !== 'boolean'
    ) {
      failures.push(`inspection is invalid for item: ${itemId}`)
    }
  }
  const snapshotIds = new Set<string>()
  for (const snapshot of qualitySnapshots) {
    if (snapshotIds.has(snapshot.snapshotSha256)) {
      failures.push(
        `quality snapshot digest is repeated: ${snapshot.snapshotSha256}`,
      )
    }
    snapshotIds.add(snapshot.snapshotSha256)
    if (snapshot.campaign.campaignId !== campaign.campaignId) {
      failures.push(
        `quality snapshot belongs to another campaign: ${snapshot.snapshotSha256}`,
      )
    }
    if (
      snapshot.fingerprints.campaignManifestSha256 !== campaign.manifestSha256
    ) {
      failures.push(
        `quality snapshot campaign fingerprint is stale: ${snapshot.snapshotSha256}`,
      )
    }
    failures.push(...validateVerificationQualitySnapshot(snapshot))
  }
  const artifactIds = new Set<string>()
  for (const citation of artifactCitations) {
    if (artifactIds.has(citation.artifactId)) {
      failures.push(`artifact citation ID is repeated: ${citation.artifactId}`)
    }
    artifactIds.add(citation.artifactId)
    failures.push(...validateArtifactCitation(citation))
  }
  for (const kind of VERIFICATION_ARTIFACT_KINDS) {
    if (
      !artifactCitations.some(({ artifactKind }) => artifactKind === kind)
    ) {
      failures.push(`artifact citation kind is missing: ${kind}`)
    }
  }
  if (
    !artifactCitations.some(
      ({ artifactKind, sha256 }) =>
        artifactKind === 'campaign_manifest' &&
        sha256 === campaign.manifestSha256,
    )
  ) {
    failures.push('campaign manifest citation does not match the campaign')
  }
  for (const snapshot of qualitySnapshots) {
    if (
      !artifactCitations.some(
        ({ artifactKind, sha256 }) =>
          artifactKind === 'quality_snapshot' &&
          sha256 === snapshot.snapshotSha256,
      )
    ) {
      failures.push(
        `quality snapshot citation is missing: ${snapshot.snapshotSha256}`,
      )
    }
  }
  if (
    campaign.biominerSha !== null &&
    !artifactCitations.some(
      ({ artifactKind, sourceCommit }) =>
        artifactKind === 'biominer_source' &&
        sourceCommit === campaign.biominerSha,
    )
  ) {
    failures.push('BioMiner source citation does not match the campaign')
  }
  return Object.freeze(failures)
}

function validateArtifactCitation(
  citation: VerificationArtifactCitation,
): readonly string[] {
  const failures: string[] = []
  if (
    citation.schemaVersion !== VERIFICATION_ARTIFACT_CITATION_VERSION ||
    !VERIFICATION_ARTIFACT_KINDS.includes(citation.artifactKind)
  ) {
    failures.push(`artifact citation contract is invalid: ${citation.artifactId}`)
  }
  if (
    citation.artifactId.trim() === '' ||
    citation.artifactId.length > 200
  ) {
    failures.push('artifact citation ID is invalid')
  }
  if (!/^[a-f0-9]{64}$/u.test(citation.sha256)) {
    failures.push(`artifact citation digest is invalid: ${citation.artifactId}`)
  }
  if (!/^[a-f0-9]{40}$/u.test(citation.sourceCommit)) {
    failures.push(`artifact source commit is invalid: ${citation.artifactId}`)
  }
  if (
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(
      citation.sourceRepository,
    )
  ) {
    failures.push(
      `artifact source repository is invalid: ${citation.artifactId}`,
    )
  }
  if (
    citation.sourcePath.trim() === '' ||
    citation.sourcePath.startsWith('/') ||
    citation.sourcePath.includes('\\') ||
    citation.sourcePath.split('/').some((part) => part === '..')
  ) {
    failures.push(`artifact source path is invalid: ${citation.artifactId}`)
  }
  return Object.freeze(failures)
}

function canonicalArtifactCitations(
  citations: readonly VerificationArtifactCitation[],
): readonly VerificationArtifactCitation[] {
  return citations
    .map((citation) => Object.freeze({ ...citation }))
    .sort(
      (left, right) =>
        left.artifactKind.localeCompare(right.artifactKind) ||
        left.artifactId.localeCompare(right.artifactId),
    )
}

function assertValidatedEvidence(
  evidence: VerificationToolEvidence,
): asserts evidence is ValidatedVerificationToolEvidence {
  if (
    evidence.schemaVersion !== VERIFICATION_TOOL_EVIDENCE_VERSION ||
    (evidence as Partial<ValidatedVerificationToolEvidence>)[
      EVIDENCE_MARKER
    ] !== true
  ) {
    throw new VerificationToolError(
      'invalid_evidence',
      'Verification tools require evidence created by createVerificationToolEvidence',
    )
  }
}

function verificationToolName(value: string): VerificationToolName {
  const name = VERIFICATION_TOOL_NAMES.find((candidate) => candidate === value)
  if (name === undefined) {
    throw new VerificationToolError(
      'unknown_tool',
      `Unknown verification tool: ${value}`,
    )
  }
  return name
}

function readIdentifier(
  value: unknown,
  key: string,
): string {
  if (!isRecord(value)) {
    throw new VerificationToolError(
      'invalid_arguments',
      `${key} requires an argument object`,
    )
  }
  return boundedIdentifier(value[key], key)
}

function boundedIdentifier(value: unknown, key: string): string {
  if (typeof value !== 'string') {
    throw new VerificationToolError(
      'invalid_arguments',
      `${key} must be a string`,
    )
  }
  const normalized = value.trim()
  if (normalized.length === 0 || normalized.length > 160) {
    throw new VerificationToolError(
      'invalid_arguments',
      `${key} must contain 1 through 160 characters`,
    )
  }
  return normalized
}

function readDigest(value: unknown, key: string): string {
  const digest = readIdentifier(value, key)
  if (!/^[a-f0-9]{64}$/u.test(digest)) {
    throw new VerificationToolError(
      'invalid_arguments',
      `${key} must be a lowercase SHA-256 digest`,
    )
  }
  return digest
}

function readBatchSize(value: unknown, key: string): number {
  if (!isRecord(value)) {
    throw new VerificationToolError(
      'invalid_arguments',
      `${key} requires an argument object`,
    )
  }
  const batchSize = value[key]
  if (
    typeof batchSize !== 'number' ||
    !Number.isInteger(batchSize) ||
    batchSize < 1 ||
    batchSize > MAX_BATCH_SIZE
  ) {
    throw new VerificationToolError(
      'invalid_arguments',
      `${key} must be an integer from 1 through ${MAX_BATCH_SIZE}`,
    )
  }
  return batchSize
}

function gateFactStatus(
  value: 'ready' | 'not_ready' | 'unavailable',
): VerificationToolFactStatus {
  return value === 'ready'
    ? 'verified'
    : value === 'not_ready'
      ? 'blocked'
      : 'unavailable'
}

function displayValue(value: VerificationToolFactValue): string {
  return value === null ? 'unavailable' : String(value)
}

function boundedText(value: string, maximum: number): boolean {
  const length = [...value].length
  return length > 0 && length <= maximum
}

function formatValidationErrors(
  errors: readonly ErrorObject[] | null | undefined,
): string {
  if (errors === undefined || errors === null || errors.length === 0) {
    return 'unknown schema error'
  }
  return errors
    .map(
      ({ instancePath, message }) =>
        `${instancePath === '' ? '$' : instancePath} ${message ?? 'is invalid'}`,
    )
    .join('; ')
}

function canonicalJson(value: unknown): string {
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'string'
  ) {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`
  }
  if (typeof value === 'object') {
    return `{${Object.entries(value)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
      .join(',')}}`
  }
  throw new VerificationToolError(
    'invalid_evidence',
    'Verification evidence contains an unsupported value',
  )
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) {
    return value
  }
  for (const nested of Reflect.ownKeys(value)) {
    deepFreeze((value as Record<PropertyKey, unknown>)[nested])
  }
  return Object.freeze(value)
}
