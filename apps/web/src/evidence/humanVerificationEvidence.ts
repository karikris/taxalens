import {
  projectCurrentVerificationEvents,
  validateVerificationEvent,
  validateVerificationEventLedger,
  type VerificationEvent,
  type VerificationOutcome,
} from '../review/domain'
import { IndexedDbReviewRepository } from '../review/repositories/indexedDbReviewRepository'
import type { ReviewRepository } from '../review/repositories/reviewRepository'
import {
  HUMAN_REVIEW_CAMPAIGN,
  HUMAN_REVIEW_ITEMS,
} from '../review/reviewPacket'

export type HumanVerificationConflictStatus = 'not_calculated'

export interface HumanVerificationItemEvidence {
  readonly itemId: string
  readonly verificationLabel: string
  readonly outcome: VerificationOutcome
  readonly currentEventId: string
  readonly eventIds: readonly string[]
  readonly reviewerCount: number
  readonly reviewedAt: string
}

export interface HumanVerificationEvidence {
  readonly state: 'empty' | 'recorded' | 'unavailable'
  readonly campaignId: string
  readonly campaignTitle: string
  readonly totalItemCount: number
  readonly recordedItemCount: number
  readonly totalEventCount: number
  readonly reviewerCount: number
  readonly conflictStatus: HumanVerificationConflictStatus
  readonly conflictReason: string
  readonly eventIds: readonly string[]
  readonly latestReviewedAt: string | null
  readonly items: readonly HumanVerificationItemEvidence[]
  readonly unavailableReason: string | null
  readonly scientificClaimAllowed: false
}

export async function loadLocalHumanVerificationEvidence(): Promise<HumanVerificationEvidence> {
  if (typeof globalThis.indexedDB === 'undefined') {
    return unavailableHumanVerificationEvidence(
      'IndexedDB is unavailable, so no durable local review ledger can be read.',
    )
  }
  const repository = new IndexedDbReviewRepository()
  try {
    return await loadHumanVerificationEvidence(repository)
  } catch (reason) {
    return unavailableHumanVerificationEvidence(
      reason instanceof Error
        ? reason.message
        : 'The local verification ledger could not be read.',
    )
  } finally {
    await repository.close()
  }
}

export async function loadHumanVerificationEvidence(
  repository: Pick<ReviewRepository, 'loadEvents'>,
): Promise<HumanVerificationEvidence> {
  return buildHumanVerificationEvidence(
    await repository.loadEvents(HUMAN_REVIEW_CAMPAIGN.campaignId),
  )
}

export function buildHumanVerificationEvidence(
  events: readonly VerificationEvent[],
): HumanVerificationEvidence {
  const failures = [
    ...validateVerificationEventLedger(events),
    ...events.flatMap((event) => {
      const item = HUMAN_REVIEW_ITEMS.find(
        ({ itemId }) => itemId === event.itemId,
      )
      return item === undefined
        ? [`review event item is unavailable: ${event.itemId}`]
        : validateVerificationEvent(event, HUMAN_REVIEW_CAMPAIGN, item)
    }),
  ]
  if (failures.length > 0) {
    throw new Error(
      `Local human verification evidence is invalid: ${failures.join('; ')}`,
    )
  }

  const currentEvents = projectCurrentVerificationEvents(events)
  const items = HUMAN_REVIEW_ITEMS.flatMap((item) => {
    const current = currentEvents[item.itemId]
    if (current === undefined) {
      return []
    }
    const itemEvents = events.filter(({ itemId }) => itemId === item.itemId)
    return [
      Object.freeze({
        itemId: item.itemId,
        verificationLabel: item.verificationLabel,
        outcome: current.outcome,
        currentEventId: current.eventId,
        eventIds: Object.freeze(itemEvents.map(({ eventId }) => eventId)),
        reviewerCount: distinctReviewerCount(itemEvents),
        reviewedAt: current.reviewedAt,
      }),
    ]
  })
  const eventIds = Object.freeze(events.map(({ eventId }) => eventId))
  const latestReviewedAt =
    events
      .map(({ reviewedAt }) => reviewedAt)
      .sort()
      .at(-1) ?? null

  return Object.freeze({
    state: events.length === 0 ? 'empty' : 'recorded',
    campaignId: HUMAN_REVIEW_CAMPAIGN.campaignId,
    campaignTitle: HUMAN_REVIEW_CAMPAIGN.title,
    totalItemCount: HUMAN_REVIEW_ITEMS.length,
    recordedItemCount: items.length,
    totalEventCount: events.length,
    reviewerCount: distinctReviewerCount(events),
    conflictStatus: 'not_calculated',
    conflictReason:
      'Independent-review assignments and consensus policy are not implemented yet.',
    eventIds,
    latestReviewedAt,
    items: Object.freeze(items),
    unavailableReason: null,
    scientificClaimAllowed: false,
  })
}

export function unavailableHumanVerificationEvidence(
  reason: string,
): HumanVerificationEvidence {
  return Object.freeze({
    state: 'unavailable',
    campaignId: HUMAN_REVIEW_CAMPAIGN.campaignId,
    campaignTitle: HUMAN_REVIEW_CAMPAIGN.title,
    totalItemCount: HUMAN_REVIEW_ITEMS.length,
    recordedItemCount: 0,
    totalEventCount: 0,
    reviewerCount: 0,
    conflictStatus: 'not_calculated',
    conflictReason:
      'Independent-review assignments and consensus policy are not implemented yet.',
    eventIds: Object.freeze([]),
    latestReviewedAt: null,
    items: Object.freeze([]),
    unavailableReason: reason,
    scientificClaimAllowed: false,
  })
}

function distinctReviewerCount(
  events: readonly VerificationEvent[],
): number {
  return new Set(
    events.map(({ reviewerId }) => reviewerId.trim() || 'anonymous'),
  ).size
}
