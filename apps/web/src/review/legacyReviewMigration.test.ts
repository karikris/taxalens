import { describe, expect, it, vi } from 'vitest'

import { InMemoryReviewRepository } from './repositories/inMemoryReviewRepository'
import {
  HUMAN_REVIEW_CAMPAIGN,
  HUMAN_REVIEW_ITEMS,
  HUMAN_REVIEW_PACKET,
} from './reviewPacket'
import { HUMAN_REVIEW_SESSION_STORAGE_KEY } from './repositories/legacyReviewSession'
import { migrateLegacyHumanReviewSession } from './repositories/legacyReviewMigration'

describe('legacy local review migration', () => {
  it('moves decisions, comments, timestamps, reviewer, and inspections once', async () => {
    const values = new Map<string, string>([
      [
        HUMAN_REVIEW_SESSION_STORAGE_KEY,
        JSON.stringify({
          packetId: HUMAN_REVIEW_PACKET.packetId,
          reviewerId: 'legacy-reviewer',
          decisions: {
            [HUMAN_REVIEW_ITEMS[0]!.itemId]: {
              itemId: HUMAN_REVIEW_ITEMS[0]!.itemId,
              outcome: 'cant_tell',
              comment: 'Legacy optional comment.',
              reviewedAt: '2026-07-16T15:30:00.000Z',
              reviewDurationMs: 1_250,
            },
          },
          inspections: {
            [HUMAN_REVIEW_ITEMS[0]!.itemId]: {
              itemId: HUMAN_REVIEW_ITEMS[0]!.itemId,
              imageOpened: true,
              imageVerified: true,
              imageOpenedAt: '2026-07-16T15:29:58.750Z',
              imageFailureReason: null,
            },
          },
        }),
      ],
    ])
    const storage = mapStorage(values)
    const repository = seededRepository()

    await expect(
      migrateLegacyHumanReviewSession(repository, storage),
    ).resolves.toMatchObject({
      status: 'migrated',
      reviewerId: 'legacy-reviewer',
      eventCount: 1,
      inspections: {
        [HUMAN_REVIEW_ITEMS[0]!.itemId]: {
          imageVerified: true,
        },
      },
    })
    await expect(
      repository.loadEvents(HUMAN_REVIEW_CAMPAIGN.campaignId),
    ).resolves.toEqual([
      expect.objectContaining({
        reviewerId: 'legacy-reviewer',
        outcome: 'cant_tell',
        comment: 'Legacy optional comment.',
        reviewedAt: '2026-07-16T15:30:00.000Z',
        durationMs: 1_250,
      }),
    ])
    expect(values.has(HUMAN_REVIEW_SESSION_STORAGE_KEY)).toBe(false)

    await expect(
      migrateLegacyHumanReviewSession(repository, storage),
    ).resolves.toMatchObject({ status: 'absent', eventCount: 0 })
    await expect(
      repository.loadEvents(HUMAN_REVIEW_CAMPAIGN.campaignId),
    ).resolves.toHaveLength(1)
  })

  it('retains the legacy source when repository append fails', async () => {
    const values = new Map<string, string>([
      [
        HUMAN_REVIEW_SESSION_STORAGE_KEY,
        JSON.stringify({
          packetId: HUMAN_REVIEW_PACKET.packetId,
          reviewerId: 'legacy-reviewer',
          decisions: {
            [HUMAN_REVIEW_ITEMS[0]!.itemId]: {
              itemId: HUMAN_REVIEW_ITEMS[0]!.itemId,
              outcome: 'yes',
              comment: null,
              reviewedAt: '2026-07-16T15:31:00.000Z',
              reviewDurationMs: null,
            },
          },
          inspections: {},
        }),
      ],
    ])
    const storage = mapStorage(values)
    const repository = seededRepository()
    vi.spyOn(repository, 'appendEvent').mockRejectedValue(
      new Error('IndexedDB transaction failed'),
    )

    await expect(
      migrateLegacyHumanReviewSession(repository, storage),
    ).rejects.toThrow(/transaction failed/u)
    expect(values.has(HUMAN_REVIEW_SESSION_STORAGE_KEY)).toBe(true)
  })
})

function seededRepository() {
  return new InMemoryReviewRepository([
    {
      campaign: HUMAN_REVIEW_CAMPAIGN,
      items: HUMAN_REVIEW_ITEMS,
    },
  ])
}

function mapStorage(values: Map<string, string>) {
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => {
      values.delete(key)
    },
  }
}
