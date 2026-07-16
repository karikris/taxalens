import {
  HUMAN_REVIEW_PACKET,
  type HumanReviewPacket,
} from '../reviewPacket'
import { corruptReviewSession } from './reviewErrors'
import {
  VERIFICATION_EVENT_SCHEMA_VERSION,
  projectCurrentVerificationEvents,
  validateVerificationEvent,
  validateVerificationEventLedger,
  type VerificationEvent,
  type VerificationConfidence,
  type VerificationMediaQuality,
  type VerificationOutcome,
} from './verificationEvents'
import type {
  TaxonIdentity,
  VerificationLifeStage,
  VerificationView,
  VerificationVisualDomain,
} from './verificationContracts'

export type HumanReviewOutcome = VerificationOutcome

export interface HumanReviewDecisionInput {
  readonly itemId: string
  readonly outcome: HumanReviewOutcome
  readonly comment: string | null
  readonly reviewedAt: string
  readonly reviewDurationMs: number | null
  readonly alternativeTaxon?: TaxonIdentity | null
  readonly correctedLifeStage?: VerificationLifeStage | null
  readonly correctedVisualDomain?: VerificationVisualDomain | null
  readonly correctedView?: VerificationView | null
  readonly mediaQuality?: VerificationMediaQuality
  readonly duplicateConcern?: boolean
  readonly captiveOrCultivatedConcern?: boolean
  readonly exclusionReason?: string | null
  readonly confidence?: VerificationConfidence
  readonly conflictsWithDecisionId?: string | null
}

export interface HumanReviewDecision extends HumanReviewDecisionInput {
  readonly eventId: string
  readonly reviewerId: string
  readonly reviewRound: number
  readonly supersedesEventId: string | null
  readonly conflictsWithDecisionId: string | null
  readonly alternativeTaxon: TaxonIdentity | null
  readonly correctedLifeStage: VerificationLifeStage | null
  readonly correctedVisualDomain: VerificationVisualDomain | null
  readonly correctedView: VerificationView | null
  readonly mediaQuality: VerificationMediaQuality
  readonly duplicateConcern: boolean
  readonly captiveOrCultivatedConcern: boolean
  readonly exclusionReason: string | null
  readonly confidence: VerificationConfidence
}

export interface HumanReviewInspection {
  readonly itemId: string
  readonly imageOpened: boolean
  readonly imageVerified: boolean
  readonly imageOpenedAt: string | null
  readonly imageFailureReason: string | null
}

export interface HumanReviewSession {
  readonly packetId: HumanReviewPacket['packetId']
  readonly reviewerId: string
  readonly events: readonly VerificationEvent[]
  readonly inspections: Readonly<Record<string, HumanReviewInspection>>
}

export function emptyHumanReviewSession(): HumanReviewSession {
  return Object.freeze({
    packetId: HUMAN_REVIEW_PACKET.packetId,
    reviewerId: '',
    events: Object.freeze([]),
    inspections: Object.freeze({}),
  })
}

export function restoreHumanReviewEvents(value: {
  readonly reviewerId?: string
  readonly events?: readonly unknown[]
  readonly decisions?: Readonly<Record<string, HumanReviewDecisionInput>>
}): readonly VerificationEvent[] {
  if (value.events !== undefined) {
    if (!Array.isArray(value.events)) {
      throw corruptReviewSession('The stored review event ledger is invalid.')
    }
    const events = value.events.map((candidate) =>
      restoreVerificationEvent(candidate),
    )
    assertVerificationEventLedger(events)
    return Object.freeze(events)
  }
  if (
    typeof value.decisions !== 'object' ||
    value.decisions === null ||
    Array.isArray(value.decisions)
  ) {
    throw corruptReviewSession(
      'The stored local review session has no compatible event ledger.',
    )
  }

  let events: readonly VerificationEvent[] = Object.freeze([])
  for (const item of HUMAN_REVIEW_PACKET.items) {
    const candidate = value.decisions[item.itemId]
    if (
      typeof candidate === 'object' &&
      candidate !== null &&
      candidate.itemId === item.itemId &&
      isHumanReviewOutcome(candidate.outcome) &&
      (candidate.comment === null || typeof candidate.comment === 'string') &&
      typeof candidate.reviewedAt === 'string'
    ) {
      const event = createVerificationEvent(
        events,
        value.reviewerId ?? '',
        Object.freeze({
          itemId: candidate.itemId,
          outcome: candidate.outcome,
          comment: candidate.comment,
          reviewedAt: candidate.reviewedAt,
          reviewDurationMs: validDuration(candidate.reviewDurationMs)
            ? candidate.reviewDurationMs
            : null,
        }),
      )
      events = Object.freeze([...events, event])
    }
  }
  return events
}

export function restoreHumanReviewInspections(
  value: unknown,
): Readonly<Record<string, HumanReviewInspection>> {
  const inspections: Record<string, HumanReviewInspection> = {}
  for (const item of HUMAN_REVIEW_PACKET.items) {
    const inspection =
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
        ? (value as Readonly<Record<string, unknown>>)[item.itemId]
        : undefined
    if (
      typeof inspection === 'object' &&
      inspection !== null &&
      !Array.isArray(inspection)
    ) {
      const candidate = inspection as Partial<HumanReviewInspection>
      if (
        candidate.itemId === item.itemId &&
        typeof candidate.imageOpened === 'boolean' &&
        typeof candidate.imageVerified === 'boolean' &&
        (candidate.imageOpenedAt === null ||
          typeof candidate.imageOpenedAt === 'string') &&
        (candidate.imageFailureReason === null ||
          typeof candidate.imageFailureReason === 'string')
      ) {
        inspections[item.itemId] = Object.freeze({
          itemId: candidate.itemId,
          imageOpened: candidate.imageOpened,
          imageVerified: candidate.imageVerified,
          imageOpenedAt: candidate.imageOpenedAt,
          imageFailureReason: candidate.imageFailureReason,
        })
      }
    }
  }
  return Object.freeze(inspections)
}

export function withReviewerId(
  session: HumanReviewSession,
  reviewerId: string,
): HumanReviewSession {
  return Object.freeze({
    ...session,
    reviewerId,
  })
}

export function withDecision(
  session: HumanReviewSession,
  decision: HumanReviewDecisionInput,
): HumanReviewSession {
  const reviewerIdAtEventCreation = session.reviewerId.trim()
  const event = createVerificationEvent(
    session.events,
    reviewerIdAtEventCreation,
    decision,
  )
  return Object.freeze({
    ...session,
    events: Object.freeze([...session.events, event]),
  })
}

export function currentHumanReviewDecisions(
  session: HumanReviewSession,
): Readonly<Record<string, HumanReviewDecision>> {
  const decisions: Record<string, HumanReviewDecision> = {}
  for (const event of Object.values(
    projectCurrentVerificationEvents(session.events),
  )) {
    decisions[event.itemId] = Object.freeze({
      eventId: event.eventId,
      itemId: event.itemId,
      reviewerId: event.reviewerId,
      outcome: event.outcome,
      comment: event.comment,
      reviewedAt: event.reviewedAt,
      reviewDurationMs: event.durationMs,
      alternativeTaxon: event.alternativeTaxon,
      correctedLifeStage: event.correctedLifeStage,
      correctedVisualDomain: event.correctedVisualDomain,
      correctedView: event.correctedView,
      mediaQuality: event.mediaQuality,
      duplicateConcern: event.duplicateConcern,
      captiveOrCultivatedConcern: event.captiveOrCultivatedConcern,
      exclusionReason: event.exclusionReason,
      confidence: event.confidence,
      reviewRound: event.reviewRound,
      supersedesEventId: event.supersedesEventId,
      conflictsWithDecisionId: event.conflictsWithDecisionId,
    })
  }
  return Object.freeze(decisions)
}

export function withImageInspection(
  session: HumanReviewSession,
  inspection: HumanReviewInspection,
): HumanReviewSession {
  return Object.freeze({
    ...session,
    inspections: Object.freeze({
      ...session.inspections,
      [inspection.itemId]: Object.freeze(inspection),
    }),
  })
}

export function canRecordHumanReviewOutcome(
  session: HumanReviewSession,
  itemId: string,
  outcome: HumanReviewOutcome,
): boolean {
  if (!isScientificHumanReviewOutcome(outcome)) {
    return true
  }
  const inspection = session.inspections[itemId]
  return inspection?.imageOpened === true && inspection.imageVerified === true
}

export function isScientificHumanReviewOutcome(
  outcome: HumanReviewOutcome,
): boolean {
  return outcome === 'yes' || outcome === 'no' || outcome === 'cant_tell'
}

function restoreVerificationEvent(value: unknown): VerificationEvent {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw corruptReviewSession('The stored review event is invalid.')
  }
  const candidate = value as Partial<VerificationEvent>
  const legacySchemaVersions = new Set([
    'taxalens-verification-event:v1.0.0',
    'taxalens-verification-event:v1.1.0',
  ])
  if (
    (candidate.schemaVersion !== VERIFICATION_EVENT_SCHEMA_VERSION &&
      !legacySchemaVersions.has(String(candidate.schemaVersion))) ||
    typeof candidate.eventId !== 'string' ||
    typeof candidate.campaignId !== 'string' ||
    typeof candidate.itemId !== 'string' ||
    typeof candidate.reviewerId !== 'string' ||
    typeof candidate.reviewRound !== 'number' ||
    !isHumanReviewOutcome(candidate.outcome) ||
    (candidate.comment !== null && typeof candidate.comment !== 'string') ||
    (candidate.alternativeTaxon !== null &&
      typeof candidate.alternativeTaxon !== 'object') ||
    (candidate.correctedLifeStage !== null &&
      typeof candidate.correctedLifeStage !== 'string') ||
    (candidate.correctedVisualDomain !== null &&
      typeof candidate.correctedVisualDomain !== 'string') ||
    (candidate.correctedView !== null &&
      typeof candidate.correctedView !== 'string') ||
    (candidate.mediaQuality !== undefined &&
      !isVerificationMediaQuality(candidate.mediaQuality)) ||
    (candidate.duplicateConcern !== undefined &&
      typeof candidate.duplicateConcern !== 'boolean') ||
    (candidate.captiveOrCultivatedConcern !== undefined &&
      typeof candidate.captiveOrCultivatedConcern !== 'boolean') ||
    (candidate.exclusionReason !== null &&
      typeof candidate.exclusionReason !== 'string') ||
    !isVerificationConfidence(candidate.confidence) ||
    typeof candidate.reviewedAt !== 'string' ||
    (candidate.durationMs !== null &&
      typeof candidate.durationMs !== 'number') ||
    typeof candidate.imageSha256 !== 'string' ||
    typeof candidate.questionSha256 !== 'string' ||
    typeof candidate.campaignManifestSha256 !== 'string' ||
    typeof candidate.taxalensSha !== 'string' ||
    (candidate.biominerSha !== null &&
      typeof candidate.biominerSha !== 'string') ||
    (candidate.supersedesEventId !== null &&
      typeof candidate.supersedesEventId !== 'string') ||
    (candidate.conflictsWithDecisionId !== undefined &&
      candidate.conflictsWithDecisionId !== null &&
      typeof candidate.conflictsWithDecisionId !== 'string')
  ) {
    throw corruptReviewSession('The stored review event fields are invalid.')
  }
  const event: VerificationEvent = Object.freeze({
    ...(candidate as Omit<
      VerificationEvent,
      | 'schemaVersion'
      | 'mediaQuality'
      | 'duplicateConcern'
      | 'captiveOrCultivatedConcern'
      | 'conflictsWithDecisionId'
    >),
    schemaVersion: VERIFICATION_EVENT_SCHEMA_VERSION,
    mediaQuality: candidate.mediaQuality ?? 'unknown',
    duplicateConcern: candidate.duplicateConcern ?? false,
    captiveOrCultivatedConcern:
      candidate.captiveOrCultivatedConcern ?? false,
    conflictsWithDecisionId: candidate.conflictsWithDecisionId ?? null,
  })
  const item = HUMAN_REVIEW_PACKET.items.find(
    ({ itemId }) => itemId === event.itemId,
  )
  if (
    item === undefined ||
    validateVerificationEvent(
      event,
      HUMAN_REVIEW_PACKET.campaign,
      item,
    ).length > 0
  ) {
    throw corruptReviewSession(
      'The stored review event does not match the current campaign.',
    )
  }
  return event
}

function createVerificationEvent(
  events: readonly VerificationEvent[],
  reviewerId: string,
  decision: HumanReviewDecisionInput,
): VerificationEvent {
  const item = HUMAN_REVIEW_PACKET.items.find(
    ({ itemId }) => itemId === decision.itemId,
  )
  if (item === undefined) {
    throw new Error(
      `Review item is outside the current campaign: ${decision.itemId}`,
    )
  }
  const currentEvent = projectCurrentVerificationEvents(events)[decision.itemId]
  const reviewRound =
    events
      .filter(
        (event) =>
          event.itemId === decision.itemId &&
          event.reviewerId === reviewerId,
      )
      .reduce((maximum, event) => Math.max(maximum, event.reviewRound), 0) + 1
  const event: VerificationEvent = Object.freeze({
    schemaVersion: VERIFICATION_EVENT_SCHEMA_VERSION,
    eventId: localVerificationEventId(
      decision.itemId,
      reviewerId,
      reviewRound,
      decision.reviewedAt,
    ),
    campaignId: HUMAN_REVIEW_PACKET.campaign.campaignId,
    itemId: decision.itemId,
    reviewerId,
    reviewRound,
    outcome: decision.outcome,
    comment: decision.comment,
    alternativeTaxon: decision.alternativeTaxon ?? null,
    correctedLifeStage: decision.correctedLifeStage ?? null,
    correctedVisualDomain: decision.correctedVisualDomain ?? null,
    correctedView: decision.correctedView ?? null,
    mediaQuality: decision.mediaQuality ?? 'unknown',
    duplicateConcern: decision.duplicateConcern ?? false,
    captiveOrCultivatedConcern:
      decision.captiveOrCultivatedConcern ?? false,
    exclusionReason: decision.exclusionReason ?? null,
    confidence: decision.confidence ?? 'unknown',
    reviewedAt: decision.reviewedAt,
    durationMs: decision.reviewDurationMs,
    imageSha256: item.imageSha256,
    questionSha256: item.questionFingerprint,
    campaignManifestSha256: HUMAN_REVIEW_PACKET.campaign.manifestSha256,
    taxalensSha: HUMAN_REVIEW_PACKET.campaign.taxalensSha,
    biominerSha: HUMAN_REVIEW_PACKET.campaign.biominerSha,
    supersedesEventId: currentEvent?.eventId ?? null,
    conflictsWithDecisionId: decision.conflictsWithDecisionId ?? null,
  })
  const failures = validateVerificationEvent(
    event,
    HUMAN_REVIEW_PACKET.campaign,
    item,
  )
  if (failures.length > 0) {
    throw new Error(`Invalid review event: ${failures.join('; ')}`)
  }
  assertVerificationEventLedger([...events, event])
  return event
}

function assertVerificationEventLedger(
  events: readonly VerificationEvent[],
): void {
  const failures = validateVerificationEventLedger(events)
  if (failures.length > 0) {
    throw corruptReviewSession(
      `The stored review event ledger is invalid: ${failures.join('; ')}`,
    )
  }
}

function localVerificationEventId(
  itemId: string,
  reviewerId: string,
  reviewRound: number,
  reviewedAt: string,
): string {
  return [
    'local-review-event',
    encodeURIComponent(itemId),
    encodeURIComponent(reviewerId.trim() || 'anonymous'),
    String(reviewRound),
    encodeURIComponent(reviewedAt),
  ].join(':')
}

function isHumanReviewOutcome(value: unknown): value is HumanReviewOutcome {
  return (
    value === 'yes' ||
    value === 'no' ||
    value === 'cant_tell' ||
    value === 'cant_view' ||
    value === 'skipped'
  )
}

function isVerificationConfidence(
  value: unknown,
): value is VerificationEvent['confidence'] {
  return (
    value === 'high' ||
    value === 'medium' ||
    value === 'low' ||
    value === 'unknown'
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

function validDuration(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}
