import { describe, expect, it } from 'vitest'

import { HUMAN_REVIEW_PACKET } from './reviewPacket'
import {
  canRecordHumanReviewOutcome,
  emptyHumanReviewSession,
  loadHumanReviewSession,
  saveHumanReviewSession,
  withDecision,
  withImageInspection,
} from './reviewStore'

describe('human review local session', () => {
  it('round-trips only decisions belonging to the current packet', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    const item = HUMAN_REVIEW_PACKET.items[0]
    expect(item).toBeDefined()
    const session = withDecision(emptyHumanReviewSession(), {
      itemId: item!.itemId,
      outcome: 'cant_tell',
      comment: null,
      reviewedAt: '2026-07-16T12:00:00.000Z',
      reviewDurationMs: 1_250,
    })

    saveHumanReviewSession(session, storage)

    expect(loadHumanReviewSession(storage)).toEqual(session)
  })

  it('requires a verified opened image for scientific outcomes', () => {
    const item = HUMAN_REVIEW_PACKET.items[0]
    expect(item).toBeDefined()
    const empty = emptyHumanReviewSession()

    expect(canRecordHumanReviewOutcome(empty, item!.itemId, 'yes')).toBe(false)
    expect(canRecordHumanReviewOutcome(empty, item!.itemId, 'cant_view')).toBe(true)
    expect(canRecordHumanReviewOutcome(empty, item!.itemId, 'skipped')).toBe(true)

    const inspected = withImageInspection(empty, {
      itemId: item!.itemId,
      imageOpened: true,
      imageVerified: true,
      imageOpenedAt: '2026-07-16T12:00:00.000Z',
      imageFailureReason: null,
    })

    expect(canRecordHumanReviewOutcome(inspected, item!.itemId, 'yes')).toBe(true)
    expect(canRecordHumanReviewOutcome(inspected, item!.itemId, 'no')).toBe(true)
    expect(canRecordHumanReviewOutcome(inspected, item!.itemId, 'cant_tell')).toBe(
      true,
    )
  })
})
