import type {
  TaxonIdentity,
  VerificationCampaign,
  VerificationItem,
  VerificationLifeStage,
  VerificationView,
  VerificationVisualDomain,
} from './verificationContracts'
import type {
  VerificationConflictField,
  VerificationConsensus,
  VerificationDecisionSignature,
} from './verificationConsensus'
import {
  VERIFICATION_EVENT_SCHEMA_VERSION,
  validateVerificationEvent,
  validateVerificationEventLedger,
  type FlickrNonTargetCategory,
  type VerificationConfidence,
  type VerificationEvent,
  type VerificationMediaQuality,
} from './verificationEvents'

export const VERIFICATION_ADJUDICATION_LINK_SCHEMA_VERSION =
  'taxalens-verification-adjudication-link:v1.0.0' as const

const CONFLICT_FIELDS = Object.freeze([
  'outcome',
  'non_target_category',
  'alternative_taxon',
  'life_stage',
  'visual_domain',
  'view',
  'explicit_conflict_pointer',
] as const satisfies readonly VerificationConflictField[])

export interface VerificationAdjudicationLink {
  readonly schemaVersion: typeof VERIFICATION_ADJUDICATION_LINK_SCHEMA_VERSION
  readonly sourceConflictEventIds: readonly string[]
  readonly sourceConflictFields: readonly VerificationConflictField[]
  readonly sourceReviewerIds: readonly string[]
}

export interface VerificationAdjudicationEvent extends VerificationEvent {
  readonly outcome: 'yes' | 'no'
  readonly adjudication: VerificationAdjudicationLink
}

export interface CreateVerificationAdjudicationInput {
  readonly adjudicatorId: string
  readonly outcome: 'yes' | 'no'
  readonly comment: string | null
  readonly reviewedAt: string
  readonly durationMs: number | null
  readonly nonTargetCategory?: FlickrNonTargetCategory | null
  readonly alternativeTaxon?: TaxonIdentity | null
  readonly correctedLifeStage?: VerificationLifeStage | null
  readonly correctedVisualDomain?: VerificationVisualDomain | null
  readonly correctedView?: VerificationView | null
  readonly mediaQuality?: VerificationMediaQuality
  readonly duplicateConcern?: boolean
  readonly captiveOrCultivatedConcern?: boolean
  readonly exclusionReason?: string | null
  readonly confidence?: VerificationConfidence
}

export function createVerificationAdjudicationEvent(
  campaign: VerificationCampaign,
  item: VerificationItem,
  conflict: VerificationConsensus,
  existingEvents: readonly VerificationEvent[],
  input: CreateVerificationAdjudicationInput,
): VerificationAdjudicationEvent {
  if (
    conflict.campaignId !== campaign.campaignId ||
    conflict.itemId !== item.itemId ||
    conflict.status !== 'unresolved_disagreement' ||
    conflict.conflictEventIds.length === 0 ||
    conflict.conflictingFields.length === 0
  ) {
    throw new Error(
      'Adjudication requires the current unresolved conflict for this item.',
    )
  }
  const adjudicatorId = input.adjudicatorId.trim()
  if (adjudicatorId === '') {
    throw new Error('Adjudication requires a named adjudicator.')
  }
  const sourceReviewerIds = conflict.latestEvents
    .filter(({ eventId }) => conflict.conflictEventIds.includes(eventId))
    .map(({ reviewerId }) => reviewerKey(reviewerId))
    .sort()
  if (sourceReviewerIds.includes(reviewerKey(adjudicatorId))) {
    throw new Error(
      'The adjudicator must be independent from the conflicting reviewers.',
    )
  }
  const conflictEventIds = [...conflict.conflictEventIds].sort()
  const conflictFields = [...conflict.conflictingFields].sort()
  if (
    !sameValues(conflictEventIds, conflict.conflictEventIds) ||
    !sameValues(conflictFields, conflict.conflictingFields)
  ) {
    throw new Error('The conflict lineage is not in canonical order.')
  }
  const linkedEvents = linkedSourceEvents(
    existingEvents,
    conflictEventIds,
    campaign.campaignId,
    item.itemId,
  )
  const linkedFields = conflictFieldsForEvents(linkedEvents, item)
  if (!sameValues(linkedFields, conflictFields)) {
    throw new Error(
      'The conflict lineage is stale or does not match its declared fields.',
    )
  }
  const priorForAdjudicator = existingEvents
    .filter(
      (event) =>
        event.campaignId === campaign.campaignId &&
        event.itemId === item.itemId &&
        reviewerKey(event.reviewerId) === reviewerKey(adjudicatorId),
    )
    .sort(compareEvents)
  const reviewRound =
    priorForAdjudicator.reduce(
      (maximum, event) => Math.max(maximum, event.reviewRound),
      0,
    ) + 1
  const priorAdjudication = priorForAdjudicator
    .filter(isVerificationAdjudicationEvent)
    .at(-1)
  const event: VerificationAdjudicationEvent = Object.freeze({
    schemaVersion: VERIFICATION_EVENT_SCHEMA_VERSION,
    eventId: [
      'local-adjudication-event',
      encodeURIComponent(item.itemId),
      encodeURIComponent(adjudicatorId),
      String(reviewRound),
      encodeURIComponent(input.reviewedAt),
    ].join(':'),
    campaignId: campaign.campaignId,
    itemId: item.itemId,
    reviewerId: adjudicatorId,
    reviewRound,
    outcome: input.outcome,
    comment: input.comment,
    nonTargetCategory: input.nonTargetCategory ?? null,
    alternativeTaxon: input.alternativeTaxon ?? null,
    correctedLifeStage: input.correctedLifeStage ?? null,
    correctedVisualDomain: input.correctedVisualDomain ?? null,
    correctedView: input.correctedView ?? null,
    mediaQuality: input.mediaQuality ?? 'unknown',
    duplicateConcern: input.duplicateConcern ?? false,
    captiveOrCultivatedConcern:
      input.captiveOrCultivatedConcern ?? false,
    exclusionReason: input.exclusionReason ?? null,
    confidence: input.confidence ?? 'unknown',
    reviewedAt: input.reviewedAt,
    durationMs: input.durationMs,
    imageSha256: item.imageSha256,
    questionSha256: item.questionFingerprint,
    campaignManifestSha256: campaign.manifestSha256,
    taxalensSha: campaign.taxalensSha,
    biominerSha: campaign.biominerSha,
    supersedesEventId: priorAdjudication?.eventId ?? null,
    conflictsWithDecisionId: null,
    adjudication: Object.freeze({
      schemaVersion: VERIFICATION_ADJUDICATION_LINK_SCHEMA_VERSION,
      sourceConflictEventIds: Object.freeze(conflictEventIds),
      sourceConflictFields: Object.freeze(conflictFields),
      sourceReviewerIds: Object.freeze(sourceReviewerIds),
    }),
  })
  const failures = [
    ...validateVerificationEvent(event, campaign, item),
    ...validateVerificationAdjudicationEvent(
      event,
      campaign,
      item,
      existingEvents,
    ),
    ...validateVerificationEventLedger([...existingEvents, event]),
  ]
  if (failures.length > 0) {
    throw new Error(`Invalid adjudication event: ${failures.join('; ')}`)
  }
  return event
}

export function validateVerificationAdjudicationEvent(
  event: VerificationAdjudicationEvent,
  campaign: VerificationCampaign,
  item: VerificationItem,
  priorEvents: readonly VerificationEvent[],
): readonly string[] {
  const failures: string[] = []
  const link = event.adjudication
  if (
    link.schemaVersion !== VERIFICATION_ADJUDICATION_LINK_SCHEMA_VERSION
  ) {
    failures.push('adjudication link schema version is unsupported')
  }
  if (
    link.sourceConflictEventIds.length === 0 ||
    !sortedUnique(link.sourceConflictEventIds)
  ) {
    failures.push(
      'adjudication source conflict event IDs must be non-empty and sorted',
    )
  }
  if (
    link.sourceConflictFields.length === 0 ||
    !sortedUnique(link.sourceConflictFields) ||
    link.sourceConflictFields.some(
      (field) => !CONFLICT_FIELDS.includes(field),
    )
  ) {
    failures.push(
      'adjudication source conflict fields must be supported and sorted',
    )
  }
  if (
    link.sourceReviewerIds.length === 0 ||
    !sortedUnique(link.sourceReviewerIds)
  ) {
    failures.push(
      'adjudication source reviewer IDs must be non-empty and sorted',
    )
  }
  if (link.sourceReviewerIds.includes(reviewerKey(event.reviewerId))) {
    failures.push(
      'adjudicator must be independent from source conflict reviewers',
    )
  }
  let linkedEvents: readonly VerificationEvent[] = []
  try {
    linkedEvents = linkedSourceEvents(
      priorEvents,
      link.sourceConflictEventIds,
      campaign.campaignId,
      item.itemId,
    )
  } catch (reason) {
    failures.push(errorMessage(reason))
  }
  if (linkedEvents.length > 0) {
    const linkedReviewerIds = linkedEvents
      .map(({ reviewerId }) => reviewerKey(reviewerId))
      .filter((reviewerId, index, all) => all.indexOf(reviewerId) === index)
      .sort()
    if (!sameValues(linkedReviewerIds, link.sourceReviewerIds)) {
      failures.push(
        'adjudication source reviewers do not match the linked events',
      )
    }
    const linkedFields = conflictFieldsForEvents(linkedEvents, item)
    if (!sameValues(linkedFields, link.sourceConflictFields)) {
      failures.push(
        'adjudication conflict fields do not match the linked events',
      )
    }
    if (
      linkedEvents.some(
        ({ reviewedAt }) => reviewedAt.localeCompare(event.reviewedAt) > 0,
      )
    ) {
      failures.push('adjudication cannot precede a linked source event')
    }
  }
  return Object.freeze(failures)
}

export function validateVerificationEventExtension(
  event: VerificationEvent,
  campaign: VerificationCampaign,
  item: VerificationItem,
  priorEvents: readonly VerificationEvent[],
): readonly string[] {
  if (!('adjudication' in event)) {
    return Object.freeze([])
  }
  if (!isVerificationAdjudicationEvent(event)) {
    return Object.freeze([
      'adjudication event has an unsupported link shape',
    ])
  }
  return validateVerificationAdjudicationEvent(
    event,
    campaign,
    item,
    priorEvents,
  )
}

export function isVerificationAdjudicationEvent(
  event: VerificationEvent,
): event is VerificationAdjudicationEvent {
  const candidate = event as VerificationEvent & {
    readonly adjudication?: Partial<VerificationAdjudicationLink>
  }
  return (
    (event.outcome === 'yes' || event.outcome === 'no') &&
    candidate.adjudication?.schemaVersion ===
      VERIFICATION_ADJUDICATION_LINK_SCHEMA_VERSION &&
    Array.isArray(candidate.adjudication.sourceConflictEventIds) &&
    Array.isArray(candidate.adjudication.sourceConflictFields) &&
    Array.isArray(candidate.adjudication.sourceReviewerIds)
  )
}

function linkedSourceEvents(
  events: readonly VerificationEvent[],
  eventIds: readonly string[],
  campaignId: string,
  itemId: string,
): readonly VerificationEvent[] {
  const byId = new Map(events.map((event) => [event.eventId, event]))
  const linked = eventIds.map((eventId) => {
    const event = byId.get(eventId)
    if (
      event === undefined ||
      event.campaignId !== campaignId ||
      event.itemId !== itemId ||
      isVerificationAdjudicationEvent(event)
    ) {
      throw new Error(
        `adjudication source conflict event is unavailable: ${eventId}`,
      )
    }
    return event
  })
  return Object.freeze(linked)
}

function conflictFieldsForEvents(
  events: readonly VerificationEvent[],
  item: VerificationItem,
): readonly VerificationConflictField[] {
  const signatures = events
    .filter(
      (event) => event.outcome === 'yes' || event.outcome === 'no',
    )
    .map((event) => decisionSignature(event, item))
  const fields: VerificationConflictField[] = []
  for (const [field, key] of [
    ['outcome', 'outcome'],
    ['non_target_category', 'nonTargetCategory'],
    ['alternative_taxon', 'alternativeAcceptedTaxonKey'],
    ['life_stage', 'lifeStage'],
    ['visual_domain', 'visualDomain'],
    ['view', 'view'],
  ] as const) {
    if (
      new Set(signatures.map((signature) => signature[key] ?? null)).size > 1
    ) {
      fields.push(field)
    }
  }
  if (
    events.some(
      ({ conflictsWithDecisionId }) => conflictsWithDecisionId !== null,
    )
  ) {
    fields.push('explicit_conflict_pointer')
  }
  return Object.freeze(fields.sort())
}

function decisionSignature(
  event: VerificationEvent,
  item: VerificationItem,
): VerificationDecisionSignature {
  if (event.outcome !== 'yes' && event.outcome !== 'no') {
    throw new Error('Adjudication conflict requires decisive source events.')
  }
  return Object.freeze({
    outcome: event.outcome,
    nonTargetCategory: event.nonTargetCategory,
    alternativeAcceptedTaxonKey:
      event.alternativeTaxon?.acceptedTaxonKey ?? null,
    lifeStage:
      event.correctedLifeStage ?? item.expectedLifeStage ?? 'unknown',
    visualDomain:
      event.correctedVisualDomain ??
      item.expectedVisualDomain ??
      'ambiguous',
    view: event.correctedView ?? item.expectedView ?? 'unknown',
  })
}

function reviewerKey(reviewerId: string): string {
  return reviewerId.trim() || 'anonymous'
}

function compareEvents(
  left: VerificationEvent,
  right: VerificationEvent,
): number {
  return (
    left.reviewedAt.localeCompare(right.reviewedAt) ||
    left.reviewRound - right.reviewRound ||
    left.eventId.localeCompare(right.eventId)
  )
}

function sortedUnique(values: readonly string[]): boolean {
  return values.every(
    (value, index) =>
      value.trim() !== '' &&
      (index === 0 || values[index - 1]!.localeCompare(value) < 0),
  )
}

function sameValues(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  )
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}
