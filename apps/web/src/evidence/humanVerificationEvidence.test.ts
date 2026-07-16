import { describe, expect, it } from 'vitest'

import {
  emptyHumanReviewSession,
  withDecision,
  withReviewerId,
} from '../review/domain'
import { HUMAN_REVIEW_ITEMS } from '../review/reviewPacket'
import { buildHumanVerificationEvidence } from './humanVerificationEvidence'

describe('human verification evidence', () => {
  it('projects current outcomes while retaining reviewer and event lineage', () => {
    const firstItem = HUMAN_REVIEW_ITEMS[0]!
    const secondItem = HUMAN_REVIEW_ITEMS[1]!
    let session = withReviewerId(emptyHumanReviewSession(), 'reviewer-a')
    session = withDecision(session, {
      itemId: firstItem.itemId,
      outcome: 'yes',
      comment: null,
      reviewedAt: '2026-07-16T12:00:00.000Z',
      reviewDurationMs: 1_200,
    })
    session = withReviewerId(session, 'reviewer-b')
    session = withDecision(session, {
      itemId: firstItem.itemId,
      outcome: 'no',
      comment: 'Corrected after a second local inspection.',
      reviewedAt: '2026-07-16T12:01:00.000Z',
      reviewDurationMs: 1_500,
    })
    session = withDecision(session, {
      itemId: secondItem.itemId,
      outcome: 'cant_view',
      comment: null,
      reviewedAt: '2026-07-16T12:02:00.000Z',
      reviewDurationMs: null,
    })

    const evidence = buildHumanVerificationEvidence(session.events)

    expect(evidence).toMatchObject({
      state: 'recorded',
      recordedItemCount: 2,
      totalItemCount: 3,
      totalEventCount: 3,
      reviewerCount: 2,
      conflictStatus: 'not_calculated',
      latestReviewedAt: '2026-07-16T12:02:00.000Z',
      scientificClaimAllowed: false,
    })
    expect(evidence.items[0]).toMatchObject({
      itemId: firstItem.itemId,
      outcome: 'no',
      reviewerCount: 2,
      currentEventId: session.events[1]!.eventId,
      eventIds: [
        session.events[0]!.eventId,
        session.events[1]!.eventId,
      ],
    })
    expect(evidence.items[1]).toMatchObject({
      itemId: secondItem.itemId,
      outcome: 'cant_view',
      reviewerCount: 1,
    })
    expect(evidence.eventIds).toEqual(
      session.events.map(({ eventId }) => eventId),
    )
  })

  it('reports an empty projection without claiming zero conflicts', () => {
    const evidence = buildHumanVerificationEvidence([])

    expect(evidence.state).toBe('empty')
    expect(evidence.recordedItemCount).toBe(0)
    expect(evidence.reviewerCount).toBe(0)
    expect(evidence.conflictStatus).toBe('not_calculated')
    expect(evidence.conflictReason).toContain('not implemented yet')
  })
})
