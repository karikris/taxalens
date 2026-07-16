import type {
  TaxonIdentity,
  VerificationCampaign,
  VerificationItem,
  VerificationLifeStage,
  VerificationView,
  VerificationVisualDomain,
} from './verificationContracts'
import {
  VERIFICATION_LIFE_STAGES,
  VERIFICATION_VIEWS,
  VERIFICATION_VISUAL_DOMAINS,
} from './verificationContracts'

export const VERIFICATION_EVENT_SCHEMA_VERSION =
  'taxalens-verification-event:v1.3.0' as const

export const VERIFICATION_OUTCOMES = Object.freeze([
  'yes',
  'no',
  'cant_tell',
  'cant_view',
  'skipped',
] as const)

export type VerificationOutcome = (typeof VERIFICATION_OUTCOMES)[number]

export const FLICKR_NON_TARGET_CATEGORIES = Object.freeze([
  'alternative_species',
  'other_butterfly',
  'other_insect',
  'artifact',
  'specimen',
  'no_organism',
  'insufficient_visual_detail',
] as const)

export type FlickrNonTargetCategory =
  (typeof FLICKR_NON_TARGET_CATEGORIES)[number]

export type VerificationConfidence = 'high' | 'medium' | 'low' | 'unknown'
export type VerificationMediaQuality =
  | 'high'
  | 'medium'
  | 'low'
  | 'unusable'
  | 'unknown'

export interface VerificationEvent {
  readonly schemaVersion: typeof VERIFICATION_EVENT_SCHEMA_VERSION
  readonly eventId: string
  readonly campaignId: string
  readonly itemId: string
  readonly reviewerId: string
  readonly reviewRound: number
  readonly outcome: VerificationOutcome
  readonly comment: string | null
  readonly nonTargetCategory: FlickrNonTargetCategory | null
  readonly alternativeTaxon: TaxonIdentity | null
  readonly correctedLifeStage: VerificationLifeStage | null
  readonly correctedVisualDomain: VerificationVisualDomain | null
  readonly correctedView: VerificationView | null
  readonly mediaQuality: VerificationMediaQuality
  readonly duplicateConcern: boolean
  readonly captiveOrCultivatedConcern: boolean
  readonly exclusionReason: string | null
  readonly confidence: VerificationConfidence
  readonly reviewedAt: string
  readonly durationMs: number | null
  readonly imageSha256: string
  readonly questionSha256: string
  readonly campaignManifestSha256: string
  readonly taxalensSha: string
  readonly biominerSha: string | null
  readonly supersedesEventId: string | null
  readonly conflictsWithDecisionId: string | null
}

export function validateVerificationEvent(
  event: VerificationEvent,
  campaign: VerificationCampaign,
  item: VerificationItem,
): readonly string[] {
  const failures: string[] = []
  if (event.schemaVersion !== VERIFICATION_EVENT_SCHEMA_VERSION) {
    failures.push('event schema version is unsupported')
  }
  if (event.eventId.trim() === '') {
    failures.push('eventId must not be empty')
  }
  if (event.campaignId !== campaign.campaignId) {
    failures.push('event campaignId does not match the campaign')
  }
  if (event.itemId !== item.itemId || item.campaignId !== event.campaignId) {
    failures.push('event itemId does not match the campaign item')
  }
  if (!Number.isInteger(event.reviewRound) || event.reviewRound < 1) {
    failures.push('reviewRound must be a positive integer')
  }
  if (!VERIFICATION_OUTCOMES.some((outcome) => outcome === event.outcome)) {
    failures.push('event outcome is unsupported')
  }
  if (
    event.nonTargetCategory !== null &&
    !FLICKR_NON_TARGET_CATEGORIES.includes(event.nonTargetCategory)
  ) {
    failures.push('event non-target category is unsupported')
  }
  if (!isVerificationMediaQuality(event.mediaQuality)) {
    failures.push('event media quality is unsupported')
  }
  if (
    event.correctedLifeStage !== null &&
    !VERIFICATION_LIFE_STAGES.includes(event.correctedLifeStage)
  ) {
    failures.push('event corrected life stage is unsupported')
  }
  if (
    event.correctedVisualDomain !== null &&
    !VERIFICATION_VISUAL_DOMAINS.includes(event.correctedVisualDomain)
  ) {
    failures.push('event corrected visual domain is unsupported')
  }
  if (
    event.correctedView !== null &&
    !VERIFICATION_VIEWS.includes(event.correctedView)
  ) {
    failures.push('event corrected view is unsupported')
  }
  if (!isVerificationConfidence(event.confidence)) {
    failures.push('event confidence is unsupported')
  }
  if (
    event.alternativeTaxon !== null &&
    (event.alternativeTaxon.acceptedTaxonKey.trim() === '' ||
      event.alternativeTaxon.scientificName.trim() === '')
  ) {
    failures.push('event alternative taxon identity is incomplete')
  }
  if (
    typeof event.duplicateConcern !== 'boolean' ||
    typeof event.captiveOrCultivatedConcern !== 'boolean'
  ) {
    failures.push('event reference concerns must be Boolean')
  }
  if (event.outcome === 'yes' && event.alternativeTaxon !== null) {
    failures.push('an affirmative decision cannot name an alternative taxon')
  }
  if (event.outcome !== 'no' && event.nonTargetCategory !== null) {
    failures.push('only a No decision can carry a non-target category')
  }
  if (
    event.nonTargetCategory === 'alternative_species' &&
    event.alternativeTaxon === null
  ) {
    failures.push('alternative species requires a named alternative taxon')
  }
  if (
    event.nonTargetCategory !== null &&
    event.nonTargetCategory !== 'alternative_species' &&
    event.alternativeTaxon !== null
  ) {
    failures.push(
      'only the alternative-species category can name an alternative taxon',
    )
  }
  if (
    item.source === 'flickr' &&
    event.outcome === 'no' &&
    event.nonTargetCategory === null
  ) {
    failures.push('a Flickr No decision requires a non-target category')
  }
  if (
    (event.outcome === 'cant_view' || event.outcome === 'skipped') &&
    (event.nonTargetCategory !== null ||
      event.alternativeTaxon !== null ||
      event.correctedLifeStage !== null ||
      event.correctedVisualDomain !== null ||
      event.correctedView !== null ||
      event.mediaQuality !== 'unknown' ||
      event.duplicateConcern ||
      event.captiveOrCultivatedConcern ||
      event.confidence !== 'unknown')
  ) {
    failures.push(
      'non-scientific outcomes cannot carry visual scientific annotations',
    )
  }
  if (!isUtcInstant(event.reviewedAt)) {
    failures.push('reviewedAt must be a normalized UTC instant')
  }
  if (
    event.durationMs !== null &&
    (!Number.isInteger(event.durationMs) || event.durationMs < 0)
  ) {
    failures.push('durationMs must be null or a non-negative integer')
  }
  if (event.imageSha256 !== item.imageSha256) {
    failures.push('event image SHA-256 does not match the item')
  }
  if (event.questionSha256 !== item.questionFingerprint) {
    failures.push('event question SHA-256 does not match the item')
  }
  if (event.campaignManifestSha256 !== campaign.manifestSha256) {
    failures.push('event campaign manifest SHA-256 does not match the campaign')
  }
  if (event.taxalensSha !== campaign.taxalensSha) {
    failures.push('event TaxaLens SHA does not match the campaign')
  }
  if (event.biominerSha !== campaign.biominerSha) {
    failures.push('event BioMiner SHA does not match the campaign')
  }
  if (event.supersedesEventId === event.eventId) {
    failures.push('an event cannot supersede itself')
  }
  if (
    event.conflictsWithDecisionId !== null &&
    !/^reference-review-decision:[0-9a-f]{64}$/.test(
      event.conflictsWithDecisionId,
    )
  ) {
    failures.push(
      'conflictsWithDecisionId must be a BioMiner review decision ID',
    )
  }
  return Object.freeze(failures)
}

export function projectCurrentVerificationEvents(
  events: readonly VerificationEvent[],
): Readonly<Record<string, VerificationEvent>> {
  const supersededEventIds = new Set(
    events
      .map(({ supersedesEventId }) => supersedesEventId)
      .filter((eventId): eventId is string => eventId !== null),
  )
  const current: Record<string, VerificationEvent> = {}
  for (const event of [...events]
    .filter(({ eventId }) => !supersededEventIds.has(eventId))
    .sort(compareVerificationEvents)) {
    current[event.itemId] = event
  }
  return Object.freeze(current)
}

export function validateVerificationEventLedger(
  events: readonly VerificationEvent[],
): readonly string[] {
  const failures: string[] = []
  const byId = new Map<string, VerificationEvent>()
  const superseded = new Set<string>()
  const reviewerRounds = new Map<string, number>()
  for (const event of events) {
    if (byId.has(event.eventId)) {
      failures.push(`event ID is repeated: ${event.eventId}`)
      continue
    }
    const reviewerKey = [
      event.campaignId,
      event.itemId,
      event.reviewerId,
    ].join('\u0000')
    const expectedRound = (reviewerRounds.get(reviewerKey) ?? 0) + 1
    if (event.reviewRound !== expectedRound) {
      failures.push(
        `reviewer round is not contiguous for event: ${event.eventId}`,
      )
    }
    if (event.supersedesEventId !== null) {
      const prior = byId.get(event.supersedesEventId)
      if (
        prior === undefined ||
        prior.itemId !== event.itemId ||
        prior.campaignId !== event.campaignId ||
        superseded.has(prior.eventId)
      ) {
        failures.push(`supersession link is invalid for event: ${event.eventId}`)
      } else {
        superseded.add(prior.eventId)
      }
    }
    byId.set(event.eventId, event)
    reviewerRounds.set(reviewerKey, event.reviewRound)
  }
  return Object.freeze(failures)
}

function compareVerificationEvents(
  left: VerificationEvent,
  right: VerificationEvent,
): number {
  return (
    left.reviewedAt.localeCompare(right.reviewedAt) ||
    left.reviewRound - right.reviewRound ||
    left.eventId.localeCompare(right.eventId)
  )
}

function isUtcInstant(value: string): boolean {
  const milliseconds = Date.parse(value)
  return (
    Number.isFinite(milliseconds) &&
    new Date(milliseconds).toISOString() === value
  )
}

function isVerificationMediaQuality(
  value: unknown,
): value is VerificationMediaQuality {
  return (
    value === 'high' ||
    value === 'medium' ||
    value === 'low' ||
    value === 'unusable' ||
    value === 'unknown'
  )
}

function isVerificationConfidence(
  value: unknown,
): value is VerificationConfidence {
  return (
    value === 'high' ||
    value === 'medium' ||
    value === 'low' ||
    value === 'unknown'
  )
}
