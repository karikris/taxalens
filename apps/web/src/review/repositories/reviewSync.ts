import type { VerificationConsensus } from '../domain/verificationConsensus'
import type {
  VerificationCampaign,
  VerificationItem,
} from '../domain/verificationContracts'
import type { VerificationEvent } from '../domain/verificationEvents'
import type {
  ReviewCurrentDecisions,
  ReviewRepository,
} from './reviewRepository'

export const REVIEW_SYNC_STATUS_SCHEMA_VERSION =
  'taxalens-review-sync-status:v1.0.0' as const

export type ReviewSyncState = 'local_only' | 'syncing' | 'synced' | 'sync_error'

export interface ReviewSyncStatus {
  readonly schemaVersion: typeof REVIEW_SYNC_STATUS_SCHEMA_VERSION
  readonly campaignId: string
  readonly state: ReviewSyncState
  readonly eventCount: number
  readonly pendingEventIds: readonly string[]
  readonly lastAttemptAt: string | null
  readonly lastSyncedAt: string | null
  readonly lastError: string | null
}

export interface ReviewEventQueue {
  loadPendingEvents(campaignId: string): Promise<readonly VerificationEvent[]>
  loadSyncStatus(campaignId: string): Promise<ReviewSyncStatus | null>
  markSyncAttempt(
    campaignId: string,
    eventIds: readonly string[],
    attemptedAt: string,
  ): Promise<void>
  markEventsSynced(
    campaignId: string,
    eventIds: readonly string[],
    syncedAt: string,
  ): Promise<void>
  markSyncFailure(
    campaignId: string,
    eventIds: readonly string[],
    attemptedAt: string,
    error: string,
  ): Promise<void>
}

export interface OfflineFirstReviewRepositoryOptions {
  readonly local: ReviewRepository & ReviewEventQueue
  readonly remote: Pick<ReviewRepository, 'appendEvent'>
  readonly isOnline?: () => boolean
  readonly now?: () => Date
}

export class OfflineFirstReviewRepository implements ReviewRepository {
  readonly #local: ReviewRepository & ReviewEventQueue
  readonly #remote: Pick<ReviewRepository, 'appendEvent'>
  readonly #isOnline: () => boolean
  readonly #now: () => Date
  readonly #syncByCampaign = new Map<string, Promise<ReviewSyncStatus | null>>()

  constructor({
    local,
    remote,
    isOnline = () =>
      typeof globalThis.navigator === 'undefined' ||
      globalThis.navigator.onLine,
    now = () => new Date(),
  }: OfflineFirstReviewRepositoryOptions) {
    this.#local = local
    this.#remote = remote
    this.#isOnline = isOnline
    this.#now = now
  }

  loadCampaign(campaignId: string): Promise<VerificationCampaign | null> {
    return this.#local.loadCampaign(campaignId)
  }

  loadItems(campaignId: string): Promise<readonly VerificationItem[]> {
    return this.#local.loadItems(campaignId)
  }

  loadEvents(campaignId: string): Promise<readonly VerificationEvent[]> {
    return this.#local.loadEvents(campaignId)
  }

  async appendEvent(event: VerificationEvent): Promise<void> {
    await this.#local.appendEvent(event)
    if (this.#isOnline()) {
      await this.syncCampaign(event.campaignId)
    }
  }

  loadCurrentDecisions(campaignId: string): Promise<ReviewCurrentDecisions> {
    return this.#local.loadCurrentDecisions(campaignId)
  }

  loadConsensus(campaignId: string): Promise<readonly VerificationConsensus[]> {
    return this.#local.loadConsensus(campaignId)
  }

  exportReceipt(campaignId: string): Promise<Uint8Array<ArrayBuffer>> {
    return this.#local.exportReceipt(campaignId)
  }

  clearLocalCampaign(campaignId: string): Promise<void> {
    return this.#local.clearLocalCampaign(campaignId)
  }

  loadSyncStatus(campaignId: string): Promise<ReviewSyncStatus | null> {
    return this.#local.loadSyncStatus(campaignId)
  }

  syncCampaign(campaignId: string): Promise<ReviewSyncStatus | null> {
    const existing = this.#syncByCampaign.get(campaignId)
    if (existing !== undefined) {
      return existing
    }
    const sync = this.#syncCampaign(campaignId).finally(() => {
      if (this.#syncByCampaign.get(campaignId) === sync) {
        this.#syncByCampaign.delete(campaignId)
      }
    })
    this.#syncByCampaign.set(campaignId, sync)
    return sync
  }

  async #syncCampaign(campaignId: string): Promise<ReviewSyncStatus | null> {
    while (this.#isOnline()) {
      const pending = await this.#local.loadPendingEvents(campaignId)
      if (pending.length === 0) {
        return this.#local.loadSyncStatus(campaignId)
      }
      const pendingEventIds = pending.map(({ eventId }) => eventId)
      const attemptedAt = normalizedInstant(this.#now())
      await this.#local.markSyncAttempt(
        campaignId,
        pendingEventIds,
        attemptedAt,
      )
      for (const [index, event] of pending.entries()) {
        try {
          await this.#remote.appendEvent(event)
          await this.#local.markEventsSynced(
            campaignId,
            [event.eventId],
            normalizedInstant(this.#now()),
          )
        } catch (reason) {
          await this.#local.markSyncFailure(
            campaignId,
            pending.slice(index).map(({ eventId }) => eventId),
            attemptedAt,
            errorMessage(reason),
          )
          return this.#local.loadSyncStatus(campaignId)
        }
      }
    }
    return this.#local.loadSyncStatus(campaignId)
  }
}

export interface ReviewReconnectEventTarget {
  addEventListener(type: 'online', listener: () => void): void
  removeEventListener(type: 'online', listener: () => void): void
}

export function bindReviewReconnectSync({
  campaignId,
  eventTarget,
  onError = () => undefined,
  repository,
}: {
  readonly campaignId: string
  readonly eventTarget: ReviewReconnectEventTarget
  readonly onError?: (reason: unknown) => void
  readonly repository: Pick<OfflineFirstReviewRepository, 'syncCampaign'>
}): () => void {
  const handleOnline = () => {
    void repository.syncCampaign(campaignId).catch(onError)
  }
  eventTarget.addEventListener('online', handleOnline)
  return () => eventTarget.removeEventListener('online', handleOnline)
}

export function reviewSyncStatusFromStoredValue(
  value: unknown,
): ReviewSyncStatus {
  const record = recordValue(value)
  const schemaVersion =
    record.schemaVersion === undefined
      ? REVIEW_SYNC_STATUS_SCHEMA_VERSION
      : record.schemaVersion
  if (schemaVersion !== REVIEW_SYNC_STATUS_SCHEMA_VERSION) {
    throw new Error('Review sync status schema version is unsupported.')
  }
  const campaignId = requiredString(record.campaignId, 'campaignId')
  const state = record.state
  if (!isReviewSyncState(state)) {
    throw new Error('Review sync status state is unsupported.')
  }
  const eventCount = record.eventCount
  if (!Number.isInteger(eventCount) || (eventCount as number) < 0) {
    throw new Error('Review sync status eventCount is invalid.')
  }
  const pendingEventIds = stringArray(record.pendingEventIds, 'pendingEventIds')
  if (
    new Set(pendingEventIds).size !== pendingEventIds.length ||
    pendingEventIds.length > (eventCount as number)
  ) {
    throw new Error('Review sync pending event IDs are invalid.')
  }
  const lastAttemptAt = optionalInstant(record.lastAttemptAt)
  const lastSyncedAt = optionalInstant(record.lastSyncedAt)
  const lastError = optionalString(record.lastError)
  if (
    (state === 'synced' && pendingEventIds.length !== 0) ||
    (state !== 'synced' && pendingEventIds.length === 0)
  ) {
    throw new Error('Review sync state does not match its pending events.')
  }
  if (state === 'sync_error' && (lastError === null || lastError === '')) {
    throw new Error('Review sync error state requires an error message.')
  }
  if (state !== 'sync_error' && lastError !== null) {
    throw new Error('Review sync non-error state cannot retain an error.')
  }
  return deepFreeze({
    schemaVersion: REVIEW_SYNC_STATUS_SCHEMA_VERSION,
    campaignId,
    state,
    eventCount: eventCount as number,
    pendingEventIds,
    lastAttemptAt,
    lastSyncedAt,
    lastError,
  })
}

export function createLocalReviewSyncStatus({
  campaignId,
  eventCount,
  pendingEventIds,
  previous,
}: {
  readonly campaignId: string
  readonly eventCount: number
  readonly pendingEventIds: readonly string[]
  readonly previous: ReviewSyncStatus | null
}): ReviewSyncStatus {
  return deepFreeze({
    schemaVersion: REVIEW_SYNC_STATUS_SCHEMA_VERSION,
    campaignId,
    state: 'local_only',
    eventCount,
    pendingEventIds: [...pendingEventIds],
    lastAttemptAt: previous?.lastAttemptAt ?? null,
    lastSyncedAt: previous?.lastSyncedAt ?? null,
    lastError: null,
  })
}

function normalizedInstant(value: Date): string {
  const milliseconds = value.getTime()
  if (!Number.isFinite(milliseconds)) {
    throw new Error('Review sync clock returned an invalid date.')
  }
  return new Date(milliseconds).toISOString()
}

function optionalInstant(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null
  }
  const instant = requiredString(value, 'timestamp')
  const milliseconds = Date.parse(instant)
  if (
    !Number.isFinite(milliseconds) ||
    new Date(milliseconds).toISOString() !== instant
  ) {
    throw new Error('Review sync status timestamp is invalid.')
  }
  return instant
}

function optionalString(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null
  }
  return requiredString(value, 'string')
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Review sync status ${label} is invalid.`)
  }
  return value
}

function stringArray(value: unknown, label: string): readonly string[] {
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === 'string' && item.trim() !== '')
  ) {
    throw new Error(`Review sync status ${label} is invalid.`)
  }
  return Object.freeze([...value])
}

function recordValue(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Review sync status must be an object.')
  }
  return value as Record<string, unknown>
}

function isReviewSyncState(value: unknown): value is ReviewSyncState {
  return (
    value === 'local_only' ||
    value === 'syncing' ||
    value === 'synced' ||
    value === 'sync_error'
  )
}

function errorMessage(reason: unknown): string {
  const message =
    reason instanceof Error ? reason.message : 'Unknown review sync failure.'
  return (message.trim() || 'Unknown review sync failure.').slice(0, 512)
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
