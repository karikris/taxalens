import {
  projectCurrentVerificationEvents,
  projectVerificationConsensus,
  validateVerificationEvent,
  validateVerificationEventLedger,
  type VerificationConsensusStatus,
  type VerificationEvent,
  type VerificationOutcome,
} from '../review/domain'
import { IndexedDbReviewRepository } from '../review/repositories/indexedDbReviewRepository'
import type { ReviewRepository } from '../review/repositories/reviewRepository'
import {
  HUMAN_REVIEW_CAMPAIGN,
  HUMAN_REVIEW_ITEMS,
} from '../review/reviewPacket'

export type HumanVerificationConflictStatus = 'none' | 'unresolved'

export interface HumanVerificationItemEvidence {
  readonly itemId: string
  readonly verificationLabel: string
  readonly outcome: VerificationOutcome
  readonly consensusStatus: VerificationConsensusStatus
  readonly consensusOutcome: 'yes' | 'no' | null
  readonly decisiveReviewCount: number
  readonly effectiveReviewCount: number
  readonly secondReviewRequired: boolean
  readonly adjudicationRequired: boolean
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
  readonly decisiveConsensusCount: number
  readonly unresolvedConsensusCount: number
  readonly conflictStatus: HumanVerificationConflictStatus
  readonly conflictReason: string
  readonly qualityContribution: {
    readonly status: 'workflow_only'
    readonly eligibleWeightedAuditOutcomeCount: 0
    readonly reason: string
  }
  readonly referenceReviewState: {
    readonly status: 'blocked'
    readonly independentlyReviewedItemCount: 0
    readonly campaignItemCount: 24
    readonly providerRoleSuitableRecordCount: 81
    readonly reason: string
  }
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
  const consensus = projectVerificationConsensus(
    HUMAN_REVIEW_CAMPAIGN,
    HUMAN_REVIEW_ITEMS,
    events,
  )
  const items = HUMAN_REVIEW_ITEMS.flatMap((item) => {
    const current = currentEvents[item.itemId]
    if (current === undefined) {
      return []
    }
    const currentConsensus = consensus.find(
      ({ itemId }) => itemId === item.itemId,
    )
    if (currentConsensus === undefined) {
      throw new Error(
        `Local human verification consensus is unavailable: ${item.itemId}`,
      )
    }
    const itemEvents = events.filter(({ itemId }) => itemId === item.itemId)
    return [
      Object.freeze({
        itemId: item.itemId,
        verificationLabel: item.verificationLabel,
        outcome: current.outcome,
        consensusStatus: currentConsensus.status,
        consensusOutcome: currentConsensus.consensusOutcome,
        decisiveReviewCount: currentConsensus.decisiveReviewCount,
        effectiveReviewCount: currentConsensus.effectiveReviewCount,
        secondReviewRequired: currentConsensus.secondReviewRequired,
        adjudicationRequired: currentConsensus.adjudicationRequired,
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
  const decisiveConsensusCount = consensus.filter(({ status }) =>
    ['complete_agreement', 'adjudicated'].includes(status),
  ).length
  const unresolvedConsensusCount = consensus.filter(
    ({ status }) => status === 'unresolved_disagreement',
  ).length

  return Object.freeze({
    state: events.length === 0 ? 'empty' : 'recorded',
    campaignId: HUMAN_REVIEW_CAMPAIGN.campaignId,
    campaignTitle: HUMAN_REVIEW_CAMPAIGN.title,
    totalItemCount: HUMAN_REVIEW_ITEMS.length,
    recordedItemCount: items.length,
    totalEventCount: events.length,
    reviewerCount: distinctReviewerCount(events),
    decisiveConsensusCount,
    unresolvedConsensusCount,
    conflictStatus:
      unresolvedConsensusCount === 0 ? 'none' : 'unresolved',
    conflictReason:
      'Consensus follows this campaign’s review policy. Reviewer labels are recorded, but reviewer independence is not identity-verified.',
    qualityContribution: qualityContribution(),
    referenceReviewState: referenceReviewState(),
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
    decisiveConsensusCount: 0,
    unresolvedConsensusCount: 0,
    conflictStatus: 'none',
    conflictReason:
      'Consensus cannot be projected while the local event ledger is unavailable.',
    qualityContribution: qualityContribution(),
    referenceReviewState: referenceReviewState(),
    eventIds: Object.freeze([]),
    latestReviewedAt: null,
    items: Object.freeze([]),
    unavailableReason: reason,
    scientificClaimAllowed: false,
  })
}

function qualityContribution(): HumanVerificationEvidence['qualityContribution'] {
  return Object.freeze({
    status: 'workflow_only',
    eligibleWeightedAuditOutcomeCount: 0,
    reason:
      'Commons fixture outcomes exercise the review workflow but are excluded from the weighted Flickr target-precision audit.',
  })
}

function referenceReviewState(): HumanVerificationEvidence['referenceReviewState'] {
  return Object.freeze({
    status: 'blocked',
    independentlyReviewedItemCount: 0,
    campaignItemCount: 24,
    providerRoleSuitableRecordCount: 81,
    reason:
      'The reference packet is ready, but no independent taxonomic outcomes are committed. BioMiner role suitability is supporting context only.',
  })
}

function distinctReviewerCount(
  events: readonly VerificationEvent[],
): number {
  return new Set(
    events.map(({ reviewerId }) => reviewerId.trim() || 'anonymous'),
  ).size
}
