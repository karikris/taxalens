import { describe, expect, it } from 'vitest'

import {
  HUMAN_REVIEW_CAMPAIGN,
  HUMAN_REVIEW_ITEMS,
} from './reviewPacket'
import {
  emptyHumanReviewSession,
  withDecision,
  withReviewerId,
} from './reviewStore'
import {
  InMemoryReviewRepository,
  REVIEW_REPOSITORY_RECEIPT_SCHEMA_VERSION,
} from './inMemoryReviewRepository'

describe('in-memory review repository', () => {
  it('loads a seeded campaign and projects appended events idempotently', async () => {
    const repository = new InMemoryReviewRepository([
      {
        campaign: HUMAN_REVIEW_CAMPAIGN,
        items: HUMAN_REVIEW_ITEMS,
      },
    ])
    const event = reviewEvent()

    await repository.appendEvent(event)
    await repository.appendEvent(event)

    await expect(
      repository.loadCampaign(HUMAN_REVIEW_CAMPAIGN.campaignId),
    ).resolves.toEqual(HUMAN_REVIEW_CAMPAIGN)
    await expect(
      repository.loadItems(HUMAN_REVIEW_CAMPAIGN.campaignId),
    ).resolves.toHaveLength(3)
    await expect(
      repository.loadEvents(HUMAN_REVIEW_CAMPAIGN.campaignId),
    ).resolves.toEqual([event])
    await expect(
      repository.loadCurrentDecisions(HUMAN_REVIEW_CAMPAIGN.campaignId),
    ).resolves.toMatchObject({
      [event.itemId]: { eventId: event.eventId, outcome: event.outcome },
    })
    await expect(
      repository.loadConsensus(HUMAN_REVIEW_CAMPAIGN.campaignId),
    ).resolves.toEqual([])
  })

  it('rejects conflicting event IDs and exports deterministic receipts', async () => {
    const repository = new InMemoryReviewRepository([
      {
        campaign: HUMAN_REVIEW_CAMPAIGN,
        items: HUMAN_REVIEW_ITEMS,
      },
    ])
    const event = reviewEvent()
    await repository.appendEvent(event)

    await expect(
      repository.appendEvent({ ...event, outcome: 'no' }),
    ).rejects.toThrow(/event ID conflicts/u)

    const first = await repository.exportReceipt(
      HUMAN_REVIEW_CAMPAIGN.campaignId,
    )
    const second = await repository.exportReceipt(
      HUMAN_REVIEW_CAMPAIGN.campaignId,
    )
    expect(first).toEqual(second)
    expect(JSON.parse(new TextDecoder().decode(first))).toMatchObject({
      schemaVersion: REVIEW_REPOSITORY_RECEIPT_SCHEMA_VERSION,
      events: [{ eventId: event.eventId }],
      currentDecisions: [{ eventId: event.eventId }],
      semantics: {
        appendOnlyEvents: true,
        supersededEventsRetained: true,
        currentStateIsProjection: true,
      },
    })
  })

  it('clears all local state for a campaign', async () => {
    const repository = new InMemoryReviewRepository([
      {
        campaign: HUMAN_REVIEW_CAMPAIGN,
        items: HUMAN_REVIEW_ITEMS,
        events: [reviewEvent()],
      },
    ])

    await repository.clearLocalCampaign(HUMAN_REVIEW_CAMPAIGN.campaignId)

    await expect(
      repository.loadCampaign(HUMAN_REVIEW_CAMPAIGN.campaignId),
    ).resolves.toBeNull()
    await expect(
      repository.loadItems(HUMAN_REVIEW_CAMPAIGN.campaignId),
    ).resolves.toEqual([])
    await expect(
      repository.loadEvents(HUMAN_REVIEW_CAMPAIGN.campaignId),
    ).resolves.toEqual([])
  })
})

function reviewEvent() {
  const item = HUMAN_REVIEW_ITEMS[0]
  if (item === undefined) {
    throw new Error('Commons campaign requires a first item')
  }
  const session = withDecision(
    withReviewerId(emptyHumanReviewSession(), 'reviewer-a'),
    {
      itemId: item.itemId,
      outcome: 'yes',
      comment: null,
      reviewedAt: '2026-07-16T15:12:00.000Z',
      reviewDurationMs: 500,
    },
  )
  return session.events[0]!
}
