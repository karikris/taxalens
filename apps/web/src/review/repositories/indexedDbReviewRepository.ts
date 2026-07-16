import { canonicalExportJsonBytes } from '../../evidence/evidenceExport'
import {
  validateReviewRequirement,
  validateSamplingPlan,
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
import type { ReviewCampaignSeed } from './inMemoryReviewRepository'
import {
  reviewRepositoryReceiptBytes,
  type ReviewCurrentDecisions,
  type ReviewRepository,
} from './reviewRepository'

export const INDEXED_DB_REVIEW_DATABASE_NAME = 'taxalens-verification'
export const INDEXED_DB_REVIEW_DATABASE_VERSION = 1

const CAMPAIGNS_STORE = 'campaigns'
const ITEMS_STORE = 'items'
const EVENTS_STORE = 'events'
const PROJECTIONS_STORE = 'projections'
const SYNC_STATUS_STORE = 'syncStatus'
const CAMPAIGN_INDEX = 'campaignId'

export interface ReviewSyncStatus {
  readonly campaignId: string
  readonly state: 'local_only' | 'synced' | 'sync_error'
  readonly eventCount: number
  readonly pendingEventIds: readonly string[]
}

interface ItemRecord {
  readonly key: string
  readonly campaignId: string
  readonly itemId: string
  readonly item: VerificationItem
}

interface EventRecord {
  readonly eventId: string
  readonly campaignId: string
  readonly sequence: number
  readonly event: VerificationEvent
}

interface ProjectionRecord {
  readonly campaignId: string
  readonly eventCount: number
  readonly eventHeadId: string | null
  readonly currentDecisions: ReviewCurrentDecisions
}

export interface IndexedDbReviewRepositoryOptions {
  readonly databaseName?: string
  readonly indexedDb?: IDBFactory
  readonly seeds?: readonly ReviewCampaignSeed[]
}

export class IndexedDbReviewRepository<TConsensus = unknown>
  implements ReviewRepository<TConsensus>
{
  readonly #databaseName: string
  readonly #factory: IDBFactory | undefined
  readonly #seeds: readonly ReviewCampaignSeed[]
  #databasePromise: Promise<IDBDatabase> | null = null

  constructor(options: IndexedDbReviewRepositoryOptions = {}) {
    this.#databaseName =
      options.databaseName ?? INDEXED_DB_REVIEW_DATABASE_NAME
    this.#factory =
      options.indexedDb ??
      (typeof globalThis.indexedDB === 'undefined'
        ? undefined
        : globalThis.indexedDB)
    this.#seeds = cloneAndFreeze(options.seeds ?? [])
  }

  async loadCampaign(
    campaignId: string,
  ): Promise<VerificationCampaign | null> {
    const database = await this.#database()
    const transaction = database.transaction(CAMPAIGNS_STORE, 'readonly')
    const complete = transactionComplete(transaction)
    const campaign = await requestResult<VerificationCampaign | undefined>(
      transaction.objectStore(CAMPAIGNS_STORE).get(campaignId),
    )
    await complete
    return cloneAndFreeze(campaign ?? null)
  }

  async loadItems(campaignId: string): Promise<readonly VerificationItem[]> {
    const database = await this.#database()
    const transaction = database.transaction(ITEMS_STORE, 'readonly')
    const complete = transactionComplete(transaction)
    const records = await requestResult<ItemRecord[]>(
      transaction
        .objectStore(ITEMS_STORE)
        .index(CAMPAIGN_INDEX)
        .getAll(campaignId),
    )
    await complete
    return cloneAndFreeze(
      records
        .map(({ item }) => item)
        .sort((left, right) => left.itemId.localeCompare(right.itemId)),
    )
  }

  async loadEvents(campaignId: string): Promise<readonly VerificationEvent[]> {
    const database = await this.#database()
    const transaction = database.transaction(EVENTS_STORE, 'readonly')
    const complete = transactionComplete(transaction)
    const records = await requestResult<EventRecord[]>(
      transaction
        .objectStore(EVENTS_STORE)
        .index(CAMPAIGN_INDEX)
        .getAll(campaignId),
    )
    await complete
    return cloneAndFreeze(
      records
        .sort((left, right) => left.sequence - right.sequence)
        .map(({ event }) => event),
    )
  }

  async appendEvent(event: VerificationEvent): Promise<void> {
    await appendEventToDatabase(await this.#database(), event)
  }

  async loadCurrentDecisions(
    campaignId: string,
  ): Promise<ReviewCurrentDecisions> {
    const database = await this.#database()
    const transaction = database.transaction(
      [PROJECTIONS_STORE, EVENTS_STORE],
      'readonly',
    )
    const complete = transactionComplete(transaction)
    const [projection, eventRecords] = await Promise.all([
      requestResult<ProjectionRecord | undefined>(
        transaction.objectStore(PROJECTIONS_STORE).get(campaignId),
      ),
      requestResult<EventRecord[]>(
        transaction
          .objectStore(EVENTS_STORE)
          .index(CAMPAIGN_INDEX)
          .getAll(campaignId),
      ),
    ])
    await complete
    if (
      projection !== undefined &&
      projection.eventCount === eventRecords.length
    ) {
      return cloneAndFreeze(projection.currentDecisions)
    }
    const events = eventRecords
      .sort((left, right) => left.sequence - right.sequence)
      .map(({ event }) => event)
    return cloneAndFreeze(projectCurrentVerificationEvents(events))
  }

  async loadConsensus(_campaignId: string): Promise<readonly TConsensus[]> {
    return Object.freeze([])
  }

  async exportReceipt(
    campaignId: string,
  ): Promise<Uint8Array<ArrayBuffer>> {
    const campaign = await this.loadCampaign(campaignId)
    if (campaign === null) {
      throw new Error(`Review campaign is unavailable: ${campaignId}`)
    }
    const [items, events, consensus] = await Promise.all([
      this.loadItems(campaignId),
      this.loadEvents(campaignId),
      this.loadConsensus(campaignId),
    ])
    return reviewRepositoryReceiptBytes({
      campaign,
      items,
      events,
      consensus,
    })
  }

  async clearLocalCampaign(campaignId: string): Promise<void> {
    const database = await this.#database()
    const transaction = database.transaction(
      [
        CAMPAIGNS_STORE,
        ITEMS_STORE,
        EVENTS_STORE,
        PROJECTIONS_STORE,
        SYNC_STATUS_STORE,
      ],
      'readwrite',
    )
    const complete = transactionComplete(transaction)
    const itemStore = transaction.objectStore(ITEMS_STORE)
    const eventStore = transaction.objectStore(EVENTS_STORE)
    const [itemKeys, eventKeys] = await Promise.all([
      requestResult<IDBValidKey[]>(
        itemStore.index(CAMPAIGN_INDEX).getAllKeys(campaignId),
      ),
      requestResult<IDBValidKey[]>(
        eventStore.index(CAMPAIGN_INDEX).getAllKeys(campaignId),
      ),
    ])
    for (const key of itemKeys) {
      itemStore.delete(key)
    }
    for (const key of eventKeys) {
      eventStore.delete(key)
    }
    transaction.objectStore(CAMPAIGNS_STORE).delete(campaignId)
    transaction.objectStore(PROJECTIONS_STORE).delete(campaignId)
    transaction.objectStore(SYNC_STATUS_STORE).delete(campaignId)
    await complete
  }

  async loadSyncStatus(campaignId: string): Promise<ReviewSyncStatus | null> {
    const database = await this.#database()
    const transaction = database.transaction(SYNC_STATUS_STORE, 'readonly')
    const complete = transactionComplete(transaction)
    const status = await requestResult<ReviewSyncStatus | undefined>(
      transaction.objectStore(SYNC_STATUS_STORE).get(campaignId),
    )
    await complete
    return cloneAndFreeze(status ?? null)
  }

  async close(): Promise<void> {
    if (this.#databasePromise === null) {
      return
    }
    const database = await this.#databasePromise
    database.close()
    this.#databasePromise = null
  }

  #database(): Promise<IDBDatabase> {
    if (this.#factory === undefined) {
      return Promise.reject(
        new Error('IndexedDB is unavailable for verification persistence.'),
      )
    }
    this.#databasePromise ??= openReviewDatabase(
      this.#factory,
      this.#databaseName,
    ).then(async (database) => {
      try {
        for (const seed of this.#seeds) {
          await seedCampaign(database, seed)
          for (const event of seed.events ?? []) {
            await appendEventToDatabase(database, event)
          }
        }
        return database
      } catch (reason) {
        database.close()
        this.#databasePromise = null
        throw reason
      }
    })
    return this.#databasePromise
  }
}

async function openReviewDatabase(
  factory: IDBFactory,
  databaseName: string,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(
      databaseName,
      INDEXED_DB_REVIEW_DATABASE_VERSION,
    )
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(CAMPAIGNS_STORE)) {
        database.createObjectStore(CAMPAIGNS_STORE, {
          keyPath: 'campaignId',
        })
      }
      if (!database.objectStoreNames.contains(ITEMS_STORE)) {
        const items = database.createObjectStore(ITEMS_STORE, {
          keyPath: 'key',
        })
        items.createIndex(CAMPAIGN_INDEX, 'campaignId')
      }
      if (!database.objectStoreNames.contains(EVENTS_STORE)) {
        const events = database.createObjectStore(EVENTS_STORE, {
          keyPath: 'eventId',
        })
        events.createIndex(CAMPAIGN_INDEX, 'campaignId')
      }
      if (!database.objectStoreNames.contains(PROJECTIONS_STORE)) {
        database.createObjectStore(PROJECTIONS_STORE, {
          keyPath: 'campaignId',
        })
      }
      if (!database.objectStoreNames.contains(SYNC_STATUS_STORE)) {
        database.createObjectStore(SYNC_STATUS_STORE, {
          keyPath: 'campaignId',
        })
      }
    }
    request.onerror = () =>
      reject(request.error ?? new Error('IndexedDB open failed.'))
    request.onblocked = () =>
      reject(new Error('IndexedDB open was blocked by another browser context.'))
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close()
      resolve(request.result)
    }
  })
}

async function seedCampaign(
  database: IDBDatabase,
  seed: ReviewCampaignSeed,
): Promise<void> {
  const failures = [
    ...validateReviewRequirement(seed.campaign.reviewRequirement),
    ...validateSamplingPlan(seed.campaign.samplingPlan),
    ...seed.items.flatMap((item) =>
      validateVerificationItem(item, seed.campaign),
    ),
  ]
  if (failures.length > 0) {
    throw new Error(`IndexedDB campaign seed is invalid: ${failures.join('; ')}`)
  }
  const transaction = database.transaction(
    [CAMPAIGNS_STORE, ITEMS_STORE],
    'readwrite',
  )
  const complete = transactionComplete(transaction)
  try {
    const campaignStore = transaction.objectStore(CAMPAIGNS_STORE)
    const itemStore = transaction.objectStore(ITEMS_STORE)
    const existingCampaign = await requestResult<
      VerificationCampaign | undefined
    >(campaignStore.get(seed.campaign.campaignId))
    const existingItemRecords = await requestResult<ItemRecord[]>(
      itemStore
        .index(CAMPAIGN_INDEX)
        .getAll(seed.campaign.campaignId),
    )
    if (
      existingCampaign !== undefined &&
      canonicalValue(existingCampaign) !== canonicalValue(seed.campaign)
    ) {
      throw new Error(
        `IndexedDB campaign conflicts with seed: ${seed.campaign.campaignId}`,
      )
    }
    const existingItems = existingItemRecords
      .map(({ item }) => item)
      .sort((left, right) => left.itemId.localeCompare(right.itemId))
    const seedItems = [...seed.items].sort((left, right) =>
      left.itemId.localeCompare(right.itemId),
    )
    if (
      existingItems.length > 0 &&
      canonicalValue(existingItems) !== canonicalValue(seedItems)
    ) {
      throw new Error(
        `IndexedDB campaign items conflict with seed: ${seed.campaign.campaignId}`,
      )
    }
    if (existingCampaign === undefined) {
      campaignStore.add(cloneValue(seed.campaign))
    }
    if (existingItems.length === 0) {
      for (const item of seed.items) {
        itemStore.add({
          key: itemKey(seed.campaign.campaignId, item.itemId),
          campaignId: seed.campaign.campaignId,
          itemId: item.itemId,
          item: cloneValue(item),
        } satisfies ItemRecord)
      }
    }
    await complete
  } catch (reason) {
    abortTransaction(transaction)
    await complete.catch(() => undefined)
    throw reason
  }
}

async function appendEventToDatabase(
  database: IDBDatabase,
  event: VerificationEvent,
): Promise<void> {
  const transaction = database.transaction(
    [
      CAMPAIGNS_STORE,
      ITEMS_STORE,
      EVENTS_STORE,
      PROJECTIONS_STORE,
      SYNC_STATUS_STORE,
    ],
    'readwrite',
  )
  const complete = transactionComplete(transaction)
  try {
    const campaign = await requestResult<VerificationCampaign | undefined>(
      transaction.objectStore(CAMPAIGNS_STORE).get(event.campaignId),
    )
    if (campaign === undefined) {
      throw new Error(`Review campaign is unavailable: ${event.campaignId}`)
    }
    const itemRecord = await requestResult<ItemRecord | undefined>(
      transaction
        .objectStore(ITEMS_STORE)
        .get(itemKey(event.campaignId, event.itemId)),
    )
    if (itemRecord === undefined) {
      throw new Error(`Review item is unavailable: ${event.itemId}`)
    }
    const eventStore = transaction.objectStore(EVENTS_STORE)
    const existing = await requestResult<EventRecord | undefined>(
      eventStore.get(event.eventId),
    )
    if (existing !== undefined) {
      if (canonicalValue(existing.event) !== canonicalValue(event)) {
        throw new Error(`Review event ID conflicts: ${event.eventId}`)
      }
      await complete
      return
    }
    const eventRecords = await requestResult<EventRecord[]>(
      eventStore.index(CAMPAIGN_INDEX).getAll(event.campaignId),
    )
    const events = eventRecords
      .sort((left, right) => left.sequence - right.sequence)
      .map(({ event: storedEvent }) => storedEvent)
    const failures = [
      ...validateVerificationEvent(event, campaign, itemRecord.item),
      ...validateVerificationEventLedger([...events, event]),
    ]
    if (failures.length > 0) {
      throw new Error(`Review event is invalid: ${failures.join('; ')}`)
    }
    const nextEvents = [...events, event]
    eventStore.add({
      eventId: event.eventId,
      campaignId: event.campaignId,
      sequence: events.length + 1,
      event: cloneValue(event),
    } satisfies EventRecord)
    transaction.objectStore(PROJECTIONS_STORE).put({
      campaignId: event.campaignId,
      eventCount: nextEvents.length,
      eventHeadId: event.eventId,
      currentDecisions: projectCurrentVerificationEvents(nextEvents),
    } satisfies ProjectionRecord)
    const syncStore = transaction.objectStore(SYNC_STATUS_STORE)
    const existingSync = await requestResult<ReviewSyncStatus | undefined>(
      syncStore.get(event.campaignId),
    )
    syncStore.put({
      campaignId: event.campaignId,
      state: 'local_only',
      eventCount: nextEvents.length,
      pendingEventIds: Object.freeze([
        ...(existingSync?.pendingEventIds ?? []),
        event.eventId,
      ]),
    } satisfies ReviewSyncStatus)
    await complete
  } catch (reason) {
    abortTransaction(transaction)
    await complete.catch(() => undefined)
    throw reason
  }
}

function requestResult<T>(request: IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as T)
    request.onerror = () =>
      reject(request.error ?? new Error('IndexedDB request failed.'))
  })
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction aborted.'))
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed.'))
  })
}

function abortTransaction(transaction: IDBTransaction): void {
  try {
    transaction.abort()
  } catch {
    // A completed or already-aborted transaction needs no further action.
  }
}

function itemKey(campaignId: string, itemId: string): string {
  return `${campaignId}\u0000${itemId}`
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
