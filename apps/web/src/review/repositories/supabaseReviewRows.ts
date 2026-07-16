import { canonicalExportJsonBytes } from '../../evidence/evidenceExport'
import {
  VERIFICATION_CAMPAIGN_SCHEMA_VERSION,
  isVerificationCampaignKind,
  validateReviewRequirement,
  validateSamplingPlan,
  validateVerificationItem,
  type ReviewRequirement,
  type SamplingPlan,
  type SourceProvider,
  type TaxonIdentity,
  type VerificationCampaign,
  type VerificationCampaignStatus,
  type VerificationItem,
} from '../domain/verificationContracts'
import {
  isVerificationAdjudicationEvent,
  validateVerificationEventExtension,
} from '../domain/verificationAdjudication'
import {
  validateVerificationConsensus,
  type VerificationConflictField,
  type VerificationConsensus,
} from '../domain/verificationConsensus'
import {
  validateVerificationEvent,
  validateVerificationEventLedger,
  type VerificationEvent,
} from '../domain/verificationEvents'

export const SUPABASE_VERIFICATION_ITEM_PAYLOAD_SCHEMA_VERSION =
  'taxalens-supabase-verification-item-payload:v1.0.0' as const

export interface SupabaseVerificationEventInsert {
  readonly event_id: string
  readonly campaign_id: string
  readonly item_id: string
  readonly actor_id: string
  readonly schema_version: string
  readonly event_type: 'review' | 'adjudication'
  readonly review_round: number
  readonly outcome: VerificationEvent['outcome']
  readonly event_payload: VerificationEvent
  readonly reviewed_at: string
  readonly image_sha256: string
  readonly question_sha256: string
  readonly campaign_manifest_sha256: string
  readonly taxalens_sha: string
  readonly biominer_sha: string | null
  readonly supersedes_event_id: string | null
  readonly conflicts_with_decision_id: string | null
  readonly source_conflict_event_ids: readonly string[]
  readonly source_conflict_fields: readonly VerificationConflictField[]
}

export function verificationCampaignFromSupabaseRow(
  value: unknown,
): VerificationCampaign {
  const row = recordValue(value, 'verification campaign row')
  const schemaVersion = stringField(row, 'schema_version')
  if (schemaVersion !== VERIFICATION_CAMPAIGN_SCHEMA_VERSION) {
    throw invalidRow('campaign schema version is unsupported')
  }
  const kind = stringField(row, 'kind')
  if (!isVerificationCampaignKind(kind)) {
    throw invalidRow('campaign kind is unsupported')
  }
  const status = stringField(row, 'status')
  if (!isCampaignStatus(status)) {
    throw invalidRow('campaign status is unsupported')
  }
  const sourceProviders = stringArrayField(row, 'source_providers')
  if (!sourceProviders.every(isSourceProvider)) {
    throw invalidRow('campaign source provider is unsupported')
  }
  const targetTaxon =
    row.target_taxon === null
      ? null
      : taxonIdentity(row.target_taxon, 'campaign target taxon')
  const reviewRequirement = cloneValue(
    recordValue(row.review_requirement, 'campaign review requirement'),
  ) as unknown as ReviewRequirement
  const samplingPlan = cloneValue(
    recordValue(row.sampling_plan, 'campaign sampling plan'),
  ) as unknown as SamplingPlan
  const disclosurePolicy = disclosurePolicyValue(row.disclosure_policy)
  const questionFingerprint = sha256Field(row, 'question_sha256')
  const manifestSha256 = sha256Field(row, 'manifest_sha256')
  const taxalensSha = sourceRevisionField(row, 'taxalens_sha', false)
  const biominerSha = sourceRevisionField(row, 'biominer_sha', true)
  const campaign: VerificationCampaign = {
    schemaVersion: VERIFICATION_CAMPAIGN_SCHEMA_VERSION,
    campaignId: nonEmptyStringField(row, 'campaign_id'),
    title: nonEmptyStringField(row, 'title'),
    description: stringField(row, 'description'),
    kind,
    status,
    targetTaxon,
    sourceProviders: Object.freeze(sourceProviders),
    reviewRequirement,
    samplingPlan,
    disclosurePolicy,
    questionFingerprint,
    manifestSha256,
    taxalensSha: taxalensSha!,
    biominerSha,
    publicReplay: booleanField(row, 'public_replay'),
    scientificClaimAllowed: booleanField(row, 'scientific_claim_allowed'),
  }
  const failures = [
    ...validateReviewRequirement(campaign.reviewRequirement),
    ...validateSamplingPlan(campaign.samplingPlan),
  ]
  if (failures.length > 0) {
    throw invalidRow(`campaign is invalid: ${failures.join('; ')}`)
  }
  return cloneAndFreeze(campaign)
}

export function verificationItemFromSupabaseRow(
  value: unknown,
  campaign: VerificationCampaign,
): VerificationItem {
  const row = recordValue(value, 'verification item row')
  const sourcePayload = recordValue(
    row.source_payload,
    'verification item source payload',
  )
  if (
    sourcePayload.schemaVersion !==
    SUPABASE_VERIFICATION_ITEM_PAYLOAD_SCHEMA_VERSION
  ) {
    throw invalidRow('item payload schema version is unsupported')
  }
  const item = cloneValue(
    recordValue(sourcePayload.item, 'verification item payload'),
  ) as unknown as VerificationItem
  const source = stringField(row, 'source_provider')
  const scalarFailures = [
    mismatch(item.campaignId, stringField(row, 'campaign_id'), 'campaign ID'),
    mismatch(item.itemId, stringField(row, 'item_id'), 'item ID'),
    mismatch(item.source, source, 'source provider'),
    mismatch(
      item.sourceObservationId,
      stringField(row, 'source_observation_id'),
      'source observation ID',
    ),
    mismatch(
      item.sourceMediaId,
      stringField(row, 'source_media_id'),
      'source media ID',
    ),
    mismatch(
      item.imageSha256,
      sha256Field(row, 'image_sha256'),
      'image SHA-256',
    ),
    mismatch(
      item.questionFingerprint,
      sha256Field(row, 'question_sha256'),
      'question SHA-256',
    ),
    mismatch(
      item.duplicateGroupId,
      stringField(row, 'duplicate_group_id'),
      'duplicate group ID',
    ),
    mismatch(
      item.observationGroupId,
      stringField(row, 'observation_group_id'),
      'observation group ID',
    ),
    mismatch(
      item.ownerPhotographerGroupId,
      stringField(row, 'owner_photographer_group_id'),
      'owner/photographer group ID',
    ),
    mismatch(
      item.samplingStratumId,
      stringField(row, 'sampling_stratum_id'),
      'sampling stratum ID',
    ),
    mismatch(
      item.inclusionProbability,
      nullableNumberField(row, 'inclusion_probability'),
      'inclusion probability',
    ),
    mismatch(
      canonicalValue(item.rights),
      canonicalValue(row.rights_payload),
      'rights payload',
    ),
  ].filter((failure): failure is string => failure !== null)
  if (!isSourceProvider(source)) {
    scalarFailures.push('source provider is unsupported')
  }
  const failures = [
    ...scalarFailures,
    ...validateVerificationItem(item, campaign),
  ]
  if (failures.length > 0) {
    throw invalidRow(`item is invalid: ${failures.join('; ')}`)
  }
  return cloneAndFreeze(item)
}

export function verificationEventFromSupabaseRow(
  value: unknown,
  campaign: VerificationCampaign,
  item: VerificationItem,
  priorEvents: readonly VerificationEvent[],
): VerificationEvent {
  const row = recordValue(value, 'verification event row')
  const event = cloneValue(
    recordValue(row.event_payload, 'verification event payload'),
  ) as unknown as VerificationEvent
  const eventType = stringField(row, 'event_type')
  const adjudication = isVerificationAdjudicationEvent(event)
  const sourceConflictEventIds = stringArrayField(
    row,
    'source_conflict_event_ids',
  )
  const sourceConflictFields = stringArrayField(row, 'source_conflict_fields')
  const scalarFailures = [
    mismatch(event.eventId, stringField(row, 'event_id'), 'event ID'),
    mismatch(event.campaignId, stringField(row, 'campaign_id'), 'campaign ID'),
    mismatch(event.itemId, stringField(row, 'item_id'), 'item ID'),
    mismatch(event.reviewerId, stringField(row, 'actor_id'), 'actor ID'),
    mismatch(
      event.schemaVersion,
      stringField(row, 'schema_version'),
      'event schema version',
    ),
    mismatch(
      event.reviewRound,
      integerField(row, 'review_round'),
      'review round',
    ),
    mismatch(event.outcome, stringField(row, 'outcome'), 'outcome'),
    mismatch(
      event.reviewedAt,
      utcInstantField(row, 'reviewed_at'),
      'review timestamp',
    ),
    mismatch(
      event.imageSha256,
      sha256Field(row, 'image_sha256'),
      'image SHA-256',
    ),
    mismatch(
      event.questionSha256,
      sha256Field(row, 'question_sha256'),
      'question SHA-256',
    ),
    mismatch(
      event.campaignManifestSha256,
      sha256Field(row, 'campaign_manifest_sha256'),
      'campaign manifest SHA-256',
    ),
    mismatch(
      event.taxalensSha,
      sourceRevisionField(row, 'taxalens_sha', false),
      'TaxaLens revision',
    ),
    mismatch(
      event.biominerSha,
      sourceRevisionField(row, 'biominer_sha', true),
      'BioMiner revision',
    ),
    mismatch(
      event.supersedesEventId,
      nullableStringField(row, 'supersedes_event_id'),
      'superseded event ID',
    ),
    mismatch(
      event.conflictsWithDecisionId,
      nullableStringField(row, 'conflicts_with_decision_id'),
      'conflicting decision ID',
    ),
    mismatch(eventType, adjudication ? 'adjudication' : 'review', 'event type'),
    mismatch(
      sourceConflictEventIds,
      adjudication ? event.adjudication.sourceConflictEventIds : [],
      'source conflict event IDs',
    ),
    mismatch(
      sourceConflictFields,
      adjudication ? event.adjudication.sourceConflictFields : [],
      'source conflict fields',
    ),
  ].filter((failure): failure is string => failure !== null)
  const failures = [
    ...scalarFailures,
    ...validateVerificationEvent(event, campaign, item),
    ...validateVerificationEventExtension(event, campaign, item, priorEvents),
    ...validateVerificationEventLedger([...priorEvents, event]),
  ]
  if (failures.length > 0) {
    throw invalidRow(`event is invalid: ${failures.join('; ')}`)
  }
  return cloneAndFreeze(event)
}

export function verificationConsensusFromSupabaseRow(
  value: unknown,
): VerificationConsensus {
  const row = recordValue(value, 'verification consensus row')
  const consensus = cloneValue(
    recordValue(row.consensus_payload, 'verification consensus payload'),
  ) as unknown as VerificationConsensus
  const scalarFailures = [
    mismatch(
      consensus.campaignId,
      stringField(row, 'campaign_id'),
      'campaign ID',
    ),
    mismatch(consensus.itemId, stringField(row, 'item_id'), 'item ID'),
    mismatch(
      consensus.schemaVersion,
      stringField(row, 'schema_version'),
      'consensus schema version',
    ),
    mismatch(consensus.status, stringField(row, 'status'), 'consensus status'),
    mismatch(
      consensus.consensusOutcome,
      nullableStringField(row, 'consensus_outcome'),
      'consensus outcome',
    ),
    mismatch(
      consensus.latestEvents.map(({ eventId }) => eventId),
      stringArrayField(row, 'source_event_ids'),
      'consensus source event IDs',
    ),
    mismatch(
      consensus.resolvedAt,
      nullableUtcInstantField(row, 'resolved_at'),
      'consensus resolution timestamp',
    ),
  ].filter((failure): failure is string => failure !== null)
  const revision = integerField(row, 'revision')
  if (revision < 1) {
    scalarFailures.push('consensus revision must be positive')
  }
  const failures = [
    ...scalarFailures,
    ...validateVerificationConsensus(consensus),
  ]
  if (failures.length > 0) {
    throw invalidRow(`consensus is invalid: ${failures.join('; ')}`)
  }
  return cloneAndFreeze(consensus)
}

export function verificationEventToSupabaseInsert(
  event: VerificationEvent,
): SupabaseVerificationEventInsert {
  if (!UUID_PATTERN.test(event.reviewerId)) {
    throw invalidRow('event reviewer ID must be a UUID for Supabase Auth')
  }
  const adjudication = isVerificationAdjudicationEvent(event)
  return cloneAndFreeze({
    event_id: event.eventId,
    campaign_id: event.campaignId,
    item_id: event.itemId,
    actor_id: event.reviewerId,
    schema_version: event.schemaVersion,
    event_type: adjudication ? 'adjudication' : 'review',
    review_round: event.reviewRound,
    outcome: event.outcome,
    event_payload: cloneValue(event),
    reviewed_at: event.reviewedAt,
    image_sha256: event.imageSha256,
    question_sha256: event.questionSha256,
    campaign_manifest_sha256: event.campaignManifestSha256,
    taxalens_sha: event.taxalensSha,
    biominer_sha: event.biominerSha,
    supersedes_event_id: event.supersedesEventId,
    conflicts_with_decision_id: event.conflictsWithDecisionId,
    source_conflict_event_ids: adjudication
      ? event.adjudication.sourceConflictEventIds
      : [],
    source_conflict_fields: adjudication
      ? event.adjudication.sourceConflictFields
      : [],
  })
}

function disclosurePolicyValue(
  value: unknown,
): VerificationCampaign['disclosurePolicy'] {
  const policy = recordValue(value, 'campaign disclosure policy')
  const mode = stringField(policy, 'mode')
  if (mode !== 'blind' && mode !== 'unblinded') {
    throw invalidRow('campaign disclosure mode is unsupported')
  }
  return Object.freeze({
    mode,
    revealAfterDecision: booleanField(policy, 'revealAfterDecision'),
    hiddenBeforeDecision: Object.freeze(
      stringArrayField(policy, 'hiddenBeforeDecision'),
    ),
  })
}

function taxonIdentity(value: unknown, label: string): TaxonIdentity {
  const taxon = recordValue(value, label)
  const rank = stringField(taxon, 'rank')
  if (!['species', 'genus', 'family', 'other'].includes(rank)) {
    throw invalidRow(`${label} rank is unsupported`)
  }
  return Object.freeze({
    acceptedTaxonKey: nonEmptyStringField(taxon, 'acceptedTaxonKey'),
    scientificName: nonEmptyStringField(taxon, 'scientificName'),
    commonName: nullableStringField(taxon, 'commonName'),
    rank: rank as TaxonIdentity['rank'],
    authority: nullableStringField(taxon, 'authority'),
  })
}

function recordValue(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw invalidRow(`${label} must be an object`)
  }
  return value as Record<string, unknown>
}

function stringField(row: Record<string, unknown>, field: string): string {
  const value = row[field]
  if (typeof value !== 'string') {
    throw invalidRow(`${field} must be a string`)
  }
  return value
}

function nonEmptyStringField(
  row: Record<string, unknown>,
  field: string,
): string {
  const value = stringField(row, field)
  if (value.trim() === '') {
    throw invalidRow(`${field} must not be empty`)
  }
  return value
}

function nullableStringField(
  row: Record<string, unknown>,
  field: string,
): string | null {
  return row[field] === null ? null : stringField(row, field)
}

function stringArrayField(
  row: Record<string, unknown>,
  field: string,
): string[] {
  const value = row[field]
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === 'string')
  ) {
    throw invalidRow(`${field} must be a string array`)
  }
  return [...value]
}

function booleanField(row: Record<string, unknown>, field: string): boolean {
  const value = row[field]
  if (typeof value !== 'boolean') {
    throw invalidRow(`${field} must be Boolean`)
  }
  return value
}

function integerField(row: Record<string, unknown>, field: string): number {
  const value = row[field]
  if (!Number.isInteger(value)) {
    throw invalidRow(`${field} must be an integer`)
  }
  return value as number
}

function nullableNumberField(
  row: Record<string, unknown>,
  field: string,
): number | null {
  const value = row[field]
  if (value === null) {
    return null
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw invalidRow(`${field} must be null or a finite number`)
  }
  return value
}

function sha256Field(row: Record<string, unknown>, field: string): string {
  const value = stringField(row, field)
  if (!SHA256_PATTERN.test(value)) {
    throw invalidRow(`${field} must be a lowercase SHA-256 digest`)
  }
  return value
}

function sourceRevisionField(
  row: Record<string, unknown>,
  field: string,
  nullable: boolean,
): string | null {
  const value = nullableStringField(row, field)
  if (value === null) {
    if (nullable) return null
    throw invalidRow(`${field} must not be null`)
  }
  if (!SOURCE_REVISION_PATTERN.test(value)) {
    throw invalidRow(`${field} must be a 40- or 64-character revision`)
  }
  return value
}

function utcInstantField(row: Record<string, unknown>, field: string): string {
  const value = stringField(row, field)
  const milliseconds = Date.parse(value)
  if (!Number.isFinite(milliseconds)) {
    throw invalidRow(`${field} must be a timestamp`)
  }
  return new Date(milliseconds).toISOString()
}

function nullableUtcInstantField(
  row: Record<string, unknown>,
  field: string,
): string | null {
  return row[field] === null ? null : utcInstantField(row, field)
}

function mismatch(left: unknown, right: unknown, label: string): string | null {
  return canonicalValue(left) === canonicalValue(right)
    ? null
    : `${label} does not match its indexed column`
}

function isCampaignStatus(value: string): value is VerificationCampaignStatus {
  return [
    'draft',
    'ready',
    'active',
    'paused',
    'complete',
    'archived',
  ].includes(value)
}

function isSourceProvider(value: string): value is SourceProvider {
  return [
    'flickr',
    'gbif',
    'inaturalist',
    'wikimedia_commons',
    'taxalens_fixture',
  ].includes(value)
}

function canonicalValue(value: unknown): string {
  return new TextDecoder().decode(canonicalExportJsonBytes(value))
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function cloneAndFreeze<T>(value: T): T {
  return deepFreeze(cloneValue(value))
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) {
    return value
  }
  for (const nested of Object.values(value)) {
    deepFreeze(nested)
  }
  return Object.freeze(value)
}

function invalidRow(message: string): Error {
  return new Error(`Supabase verification row is invalid: ${message}`)
}

const SHA256_PATTERN = /^[0-9a-f]{64}$/
const SOURCE_REVISION_PATTERN = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
