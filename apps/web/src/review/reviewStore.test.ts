import { describe, expect, it } from 'vitest'

import { HUMAN_REVIEW_PACKET } from './reviewPacket'
import {
  emptyHumanReviewSession,
  loadHumanReviewSession,
  saveHumanReviewSession,
  withDecision,
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
    })

    saveHumanReviewSession(session, storage)

    expect(loadHumanReviewSession(storage)).toEqual(session)
  })
})
