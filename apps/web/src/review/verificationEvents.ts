import type {
  TaxonIdentity,
  VerificationCampaign,
  VerificationItem,
  VerificationLifeStage,
  VerificationView,
  VerificationVisualDomain,
} from './verificationContracts'

export const VERIFICATION_EVENT_SCHEMA_VERSION =
  'taxalens-verification-event:v1.0.0' as const

export const VERIFICATION_OUTCOMES = Object.freeze([
  'yes',
  'no',
  'cant_tell',
  'cant_view',
  'skipped',
] as const)

export type VerificationOutcome = (typeof VERIFICATION_OUTCOMES)[number]

export type VerificationConfidence = 'high' | 'medium' | 'low' | 'unknown'

export interface VerificationEvent {
  readonly schemaVersion: typeof VERIFICATION_EVENT_SCHEMA_VERSION
  readonly eventId: string
  readonly campaignId: string
  readonly itemId: string
  readonly reviewerId: string
  readonly reviewRound: number
  readonly outcome: VerificationOutcome
  readonly comment: string | null
  readonly alternativeTaxon: TaxonIdentity | null
  readonly correctedLifeStage: VerificationLifeStage | null
  readonly correctedVisualDomain: VerificationVisualDomain | null
  readonly correctedView: VerificationView | null
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
