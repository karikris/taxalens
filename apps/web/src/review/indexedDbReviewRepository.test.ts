import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'

import {
  IndexedDbReviewRepository,
  REVIEW_SYNC_STATUS_SCHEMA_VERSION,
  type ReviewSyncStatus,
} from './indexedDbReviewRepository'
import {
  HUMAN_REVIEW_CAMPAIGN,
  HUMAN_REVIEW_ITEMS,
} from './reviewPacket'
import {
  emptyHumanReviewSession,
  withDecision,
  withReviewerId,
} from './reviewStore'
import { REVIEW_REPOSITORY_RECEIPT_SCHEMA_VERSION } from './reviewRepository'

describe('IndexedDB review repository', () => {
  it('fails clearly when browser IndexedDB is unavailable', async () => {
    const repositoryUnderTest = new IndexedDbReviewRepository({
      databaseName: 'taxalens-indexeddb-unavailable',
    })

    await expect(
      repositoryUnderTest.loadCampaign(HUMAN_REVIEW_CAMPAIGN.campaignId),
    ).rejects.toThrow(/IndexedDB is unavailable/u)
  })

  it('persists campaign, append-only events, projections, and sync state offline', async () => {
    const factory = new IDBFactory()
    const databaseName = 'taxalens-indexeddb-repository-offline'
    const [firstEvent, secondEvent] = reviewEvents()
    const firstRepository = repository(factory, databaseName)

    await firstRepository.appendEvent(firstEvent)
    await firstRepository.appendEvent(secondEvent)
    await firstRepository.appendEvent(secondEvent)

    await expect(
      firstRepository.loadCurrentDecisions(HUMAN_REVIEW_CAMPAIGN.campaignId),
    ).resolves.toMatchObject({
      [secondEvent.itemId]: {
        eventId: secondEvent.eventId,
        outcome: 'no',
      },
    })
    await expect(
      firstRepository.loadSyncStatus(HUMAN_REVIEW_CAMPAIGN.campaignId),
    ).resolves.toEqual({
      schemaVersion: REVIEW_SYNC_STATUS_SCHEMA_VERSION,
      campaignId: HUMAN_REVIEW_CAMPAIGN.campaignId,
      state: 'local_only',
      eventCount: 2,
      pendingEventIds: [firstEvent.eventId, secondEvent.eventId],
      lastAttemptAt: null,
      lastSyncedAt: null,
      lastError: null,
    } satisfies ReviewSyncStatus)
    await firstRepository.close()

    const reopenedRepository = repository(factory, databaseName)
    await expect(
      reopenedRepository.loadEvents(HUMAN_REVIEW_CAMPAIGN.campaignId),
    ).resolves.toEqual([firstEvent, secondEvent])
    await expect(
      reopenedRepository.loadItems(HUMAN_REVIEW_CAMPAIGN.campaignId),
    ).resolves.toHaveLength(3)
    await expect(
      reopenedRepository.loadConsensus(HUMAN_REVIEW_CAMPAIGN.campaignId),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemId: secondEvent.itemId,
          status: 'complete_agreement',
          consensusOutcome: 'no',
          decisiveReviewCount: 1,
        }),
      ]),
    )
    const firstReceipt = await reopenedRepository.exportReceipt(
      HUMAN_REVIEW_CAMPAIGN.campaignId,
    )
    const secondReceipt = await reopenedRepository.exportReceipt(
      HUMAN_REVIEW_CAMPAIGN.campaignId,
    )
    expect(firstReceipt).toEqual(secondReceipt)
    expect(JSON.parse(new TextDecoder().decode(firstReceipt))).toMatchObject({
      schemaVersion: REVIEW_REPOSITORY_RECEIPT_SCHEMA_VERSION,
      events: [
        { eventId: firstEvent.eventId },
        {
          eventId: secondEvent.eventId,
          supersedesEventId: firstEvent.eventId,
        },
      ],
      currentDecisions: [{ eventId: secondEvent.eventId }],
      consensus: expect.arrayContaining([
        expect.objectContaining({
          itemId: secondEvent.itemId,
          status: 'complete_agreement',
          consensusOutcome: 'no',
        }),
      ]),
    })
    await reopenedRepository.close()
    await deleteDatabase(factory, databaseName)
  })

  it('rejects conflicting event reuse without changing persisted history', async () => {
    const factory = new IDBFactory()
    const databaseName = 'taxalens-indexeddb-repository-conflict'
    const [event] = reviewEvents()
    const repositoryUnderTest = repository(factory, databaseName)
    await repositoryUnderTest.appendEvent(event)

    await expect(
      repositoryUnderTest.appendEvent({ ...event, outcome: 'no' }),
    ).rejects.toThrow(/event ID conflicts/u)
    await expect(
      repositoryUnderTest.loadEvents(HUMAN_REVIEW_CAMPAIGN.campaignId),
    ).resolves.toEqual([event])

    await repositoryUnderTest.close()
    await deleteDatabase(factory, databaseName)
  })

  it('clears campaign, item, event, projection, and sync stores together', async () => {
    const factory = new IDBFactory()
    const databaseName = 'taxalens-indexeddb-repository-clear'
    const [event] = reviewEvents()
    const repositoryUnderTest = repository(factory, databaseName)
    await repositoryUnderTest.appendEvent(event)

    await repositoryUnderTest.clearLocalCampaign(
      HUMAN_REVIEW_CAMPAIGN.campaignId,
    )

    await expect(
      repositoryUnderTest.loadCampaign(HUMAN_REVIEW_CAMPAIGN.campaignId),
    ).resolves.toBeNull()
    await expect(
      repositoryUnderTest.loadEvents(HUMAN_REVIEW_CAMPAIGN.campaignId),
    ).resolves.toEqual([])
    await expect(
      repositoryUnderTest.loadSyncStatus(HUMAN_REVIEW_CAMPAIGN.campaignId),
    ).resolves.toBeNull()

    await repositoryUnderTest.close()
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

function reviewEvents() {
  const item = HUMAN_REVIEW_ITEMS[0]
  if (item === undefined) {
    throw new Error('Commons campaign requires a first item')
  }
  let session = withReviewerId(emptyHumanReviewSession(), 'reviewer-a')
  session = withDecision(session, {
    itemId: item.itemId,
    outcome: 'yes',
    comment: null,
    reviewedAt: '2026-07-16T15:20:00.000Z',
    reviewDurationMs: 500,
  })
  session = withDecision(session, {
    itemId: item.itemId,
    outcome: 'no',
    comment: 'Replacement.',
    reviewedAt: '2026-07-16T15:21:00.000Z',
    reviewDurationMs: 750,
  })
  return [session.events[0]!, session.events[1]!] as const
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
