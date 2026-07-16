import { canonicalExportJsonBytes } from '../../evidence/evidenceExport'
import {
  validateVerificationItem,
  type VerificationCampaign,
  type VerificationItem,
} from '../domain/verificationContracts'
import {
  projectCurrentVerificationEvents,
  validateVerificationEvent,
  validateVerificationEventLedger,
  type VerificationEvent,
} from '../domain/verificationEvents'
import type {
  ReviewCurrentDecisions,
  ReviewRepository,
} from './reviewRepository'
import {
  reviewRepositoryReceiptBytes,
} from './reviewRepository'

export interface ReviewCampaignSeed {
  readonly campaign: VerificationCampaign
  readonly items: readonly VerificationItem[]
  readonly events?: readonly VerificationEvent[]
}

export class InMemoryReviewRepository<TConsensus = unknown>
  implements ReviewRepository<TConsensus>
{
  readonly #campaigns = new Map<string, VerificationCampaign>()
  readonly #items = new Map<string, readonly VerificationItem[]>()
  readonly #events = new Map<string, readonly VerificationEvent[]>()

  constructor(seeds: readonly ReviewCampaignSeed[] = []) {
    for (const seed of seeds) {
      this.#seed(seed)
    }
  }

  async loadCampaign(
    campaignId: string,
  ): Promise<VerificationCampaign | null> {
    return cloneAndFreeze(this.#campaigns.get(campaignId) ?? null)
  }

  async loadItems(campaignId: string): Promise<readonly VerificationItem[]> {
    return cloneAndFreeze(this.#items.get(campaignId) ?? [])
  }

  async loadEvents(campaignId: string): Promise<readonly VerificationEvent[]> {
    return cloneAndFreeze(this.#events.get(campaignId) ?? [])
  }

  async appendEvent(event: VerificationEvent): Promise<void> {
    const campaign = this.#campaigns.get(event.campaignId)
    if (campaign === undefined) {
      throw new Error(`Review campaign is unavailable: ${event.campaignId}`)
    }
    const item = this.#items
      .get(event.campaignId)
      ?.find(({ itemId }) => itemId === event.itemId)
    if (item === undefined) {
      throw new Error(`Review item is unavailable: ${event.itemId}`)
    }
    const events = this.#events.get(event.campaignId) ?? []
    const existing = events.find(({ eventId }) => eventId === event.eventId)
    if (existing !== undefined) {
      if (canonicalValue(existing) === canonicalValue(event)) {
        return
      }
      throw new Error(`Review event ID conflicts: ${event.eventId}`)
    }
    const failures = [
      ...validateVerificationEvent(event, campaign, item),
      ...validateVerificationEventLedger([...events, event]),
    ]
    if (failures.length > 0) {
      throw new Error(`Review event is invalid: ${failures.join('; ')}`)
    }
    this.#events.set(
      event.campaignId,
      cloneAndFreeze([...events, event]),
    )
  }

  async loadCurrentDecisions(
    campaignId: string,
  ): Promise<ReviewCurrentDecisions> {
    const events = this.#events.get(campaignId) ?? []
    return cloneAndFreeze(projectCurrentVerificationEvents(events))
  }

  async loadConsensus(_campaignId: string): Promise<readonly TConsensus[]> {
    return Object.freeze([])
  }

  async exportReceipt(
    campaignId: string,
  ): Promise<Uint8Array<ArrayBuffer>> {
    const campaign = this.#campaigns.get(campaignId)
    if (campaign === undefined) {
      throw new Error(`Review campaign is unavailable: ${campaignId}`)
    }
    const items = this.#items.get(campaignId) ?? []
    const events = this.#events.get(campaignId) ?? []
    return reviewRepositoryReceiptBytes({
      campaign,
      items,
      events,
      consensus: [],
    })
  }

  async clearLocalCampaign(campaignId: string): Promise<void> {
    this.#events.delete(campaignId)
    this.#items.delete(campaignId)
    this.#campaigns.delete(campaignId)
  }

  #seed(seed: ReviewCampaignSeed): void {
    const { campaign } = seed
    if (this.#campaigns.has(campaign.campaignId)) {
      throw new Error(`Review campaign is repeated: ${campaign.campaignId}`)
    }
    const itemFailures = seed.items.flatMap((item) =>
      validateVerificationItem(item, campaign),
    )
    const eventFailures = (seed.events ?? []).flatMap((event) => {
      const item = seed.items.find(({ itemId }) => itemId === event.itemId)
      return item === undefined
        ? [`Review event item is unavailable: ${event.itemId}`]
        : validateVerificationEvent(event, campaign, item)
    })
    const ledgerFailures = validateVerificationEventLedger(seed.events ?? [])
    const failures = [...itemFailures, ...eventFailures, ...ledgerFailures]
    if (failures.length > 0) {
      throw new Error(`Review campaign seed is invalid: ${failures.join('; ')}`)
    }
    this.#campaigns.set(campaign.campaignId, cloneAndFreeze(campaign))
    this.#items.set(campaign.campaignId, cloneAndFreeze(seed.items))
    this.#events.set(
      campaign.campaignId,
      cloneAndFreeze(seed.events ?? []),
    )
  }
}

function canonicalValue(value: unknown): string {
  return new TextDecoder().decode(canonicalExportJsonBytes(value))
}

function cloneAndFreeze<T>(value: T): T {
  return deepFreeze(JSON.parse(JSON.stringify(value)) as T)
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
