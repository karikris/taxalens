import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it, vi } from 'vitest'

import {
  IndexedDbReviewRepository,
  OfflineFirstReviewRepository,
  REVIEW_SYNC_STATUS_SCHEMA_VERSION,
  bindReviewReconnectSync,
} from './repositories'
import { HUMAN_REVIEW_CAMPAIGN, HUMAN_REVIEW_ITEMS } from './reviewPacket'
import {
  emptyHumanReviewSession,
  withDecision,
  withReviewerId,
} from './domain/reviewSession'

describe('offline review synchronization', () => {
  it('commits locally while offline and drains the IndexedDB queue after reconnect', async () => {
    const factory = new IDBFactory()
    const databaseName = 'taxalens-review-sync-reconnect'
    const local = repository(factory, databaseName)
    const appendEvent = vi.fn().mockResolvedValue(undefined)
    let online = false
    const times = [
      new Date('2026-07-16T19:55:00.000Z'),
      new Date('2026-07-16T19:55:01.000Z'),
    ]
    const synced = new OfflineFirstReviewRepository({
      local,
      remote: { appendEvent },
      isOnline: () => online,
      now: () => times.shift() ?? new Date('2026-07-16T19:55:02.000Z'),
    })
    const event = reviewEvent()

    await synced.appendEvent(event)

    expect(appendEvent).not.toHaveBeenCalled()
    await expect(local.loadPendingEvents(event.campaignId)).resolves.toEqual([
      event,
    ])
    await expect(synced.loadSyncStatus(event.campaignId)).resolves.toEqual({
      schemaVersion: REVIEW_SYNC_STATUS_SCHEMA_VERSION,
      campaignId: event.campaignId,
      state: 'local_only',
      eventCount: 1,
      pendingEventIds: [event.eventId],
      lastAttemptAt: null,
      lastSyncedAt: null,
      lastError: null,
    })

    let onlineListener: (() => void) | undefined
    const eventTarget = {
      addEventListener: vi.fn((_type: 'online', listener: () => void) => {
        onlineListener = listener
      }),
      removeEventListener: vi.fn(),
    }
    const unbind = bindReviewReconnectSync({
      campaignId: event.campaignId,
      eventTarget,
      repository: synced,
    })
    online = true
    onlineListener?.()

    await vi.waitFor(() => {
      expect(appendEvent).toHaveBeenCalledWith(event)
    })
    await expect(synced.loadSyncStatus(event.campaignId)).resolves.toEqual({
      schemaVersion: REVIEW_SYNC_STATUS_SCHEMA_VERSION,
      campaignId: event.campaignId,
      state: 'synced',
      eventCount: 1,
      pendingEventIds: [],
      lastAttemptAt: '2026-07-16T19:55:00.000Z',
      lastSyncedAt: '2026-07-16T19:55:01.000Z',
      lastError: null,
    })

    unbind()
    expect(eventTarget.removeEventListener).toHaveBeenCalledWith(
      'online',
      expect.any(Function),
    )
    await local.close()
    await deleteDatabase(factory, databaseName)
  })

  it('retains pending evidence and records sync failure without rejecting the local append', async () => {
    const factory = new IDBFactory()
    const databaseName = 'taxalens-review-sync-error'
    const local = repository(factory, databaseName)
    const appendEvent = vi
      .fn()
      .mockRejectedValue(new Error('Network connection unavailable'))
    const synced = new OfflineFirstReviewRepository({
      local,
      remote: { appendEvent },
      isOnline: () => true,
      now: () => new Date('2026-07-16T19:56:00.000Z'),
    })
    const event = reviewEvent()

    await expect(synced.appendEvent(event)).resolves.toBeUndefined()

    await expect(local.loadEvents(event.campaignId)).resolves.toEqual([event])
    await expect(local.loadPendingEvents(event.campaignId)).resolves.toEqual([
      event,
    ])
    await expect(synced.loadSyncStatus(event.campaignId)).resolves.toEqual({
      schemaVersion: REVIEW_SYNC_STATUS_SCHEMA_VERSION,
      campaignId: event.campaignId,
      state: 'sync_error',
      eventCount: 1,
      pendingEventIds: [event.eventId],
      lastAttemptAt: '2026-07-16T19:56:00.000Z',
      lastSyncedAt: null,
      lastError: 'Network connection unavailable',
    })

    await local.close()
    await deleteDatabase(factory, databaseName)
  })

  it('drains an event appended while an existing campaign sync is active', async () => {
    const factory = new IDBFactory()
    const databaseName = 'taxalens-review-sync-concurrent-append'
    const local = repository(factory, databaseName)
    let releaseFirst: (() => void) | undefined
    const appendEvent = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            releaseFirst = resolve
          }),
      )
      .mockResolvedValue(undefined)
    const times = [
      '2026-07-16T19:57:00.000Z',
      '2026-07-16T19:57:01.000Z',
      '2026-07-16T19:57:02.000Z',
      '2026-07-16T19:57:03.000Z',
    ]
    const synced = new OfflineFirstReviewRepository({
      local,
      remote: { appendEvent },
      isOnline: () => true,
      now: () => new Date(times.shift() ?? '2026-07-16T19:57:04.000Z'),
    })
    const firstEvent = reviewEvent()
    const secondEvent = reviewEvent(1, '2026-07-16T19:54:01.000Z')

    const firstWrite = synced.appendEvent(firstEvent)
    await vi.waitFor(() => {
      expect(appendEvent).toHaveBeenCalledTimes(1)
    })
    const secondWrite = synced.appendEvent(secondEvent)
    releaseFirst?.()
    await Promise.all([firstWrite, secondWrite])

    expect(appendEvent.mock.calls.map(([event]) => event)).toEqual([
      firstEvent,
      secondEvent,
    ])
    await expect(
      synced.loadSyncStatus(firstEvent.campaignId),
    ).resolves.toMatchObject({
      state: 'synced',
      eventCount: 2,
      pendingEventIds: [],
    })

    await local.close()
    await deleteDatabase(factory, databaseName)
  })
})

function repository(factory: IDBFactory, databaseName: string) {
  return new IndexedDbReviewRepository({
    indexedDb: factory,
    databaseName,
    seeds: [
      {
        campaign: HUMAN_REVIEW_CAMPAIGN,
        items: HUMAN_REVIEW_ITEMS,
      },
    ],
  })
}

function reviewEvent(itemIndex = 0, reviewedAt = '2026-07-16T19:54:00.000Z') {
  const item = HUMAN_REVIEW_ITEMS[itemIndex]
  if (item === undefined) {
    throw new Error('The Commons campaign requires a first item.')
  }
  const session = withDecision(
    withReviewerId(emptyHumanReviewSession(), 'reviewer-a'),
    {
      itemId: item.itemId,
      outcome: 'yes',
      comment: null,
      reviewedAt,
      reviewDurationMs: 500,
    },
  )
  return session.events[0]!
}

async function deleteDatabase(
  factory: IDBFactory,
  databaseName: string,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = factory.deleteDatabase(databaseName)
    request.onsuccess = () => resolve()
    request.onerror = () =>
      reject(request.error ?? new Error('IndexedDB cleanup failed.'))
    request.onblocked = () =>
      reject(new Error('IndexedDB cleanup was blocked.'))
  })
}
