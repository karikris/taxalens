import { beforeAll, describe, expect, it } from 'vitest'

import { loadEvidenceFacade, type ReplayEvidence } from '../data/evidenceFacade'
import {
  emptyHumanReviewSession,
  withDecision,
  withReviewerId,
} from '../review/domain'
import { HUMAN_REVIEW_ITEMS } from '../review/reviewPacket'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import { buildEvidenceLedger } from './evidenceLedgerModel'
import { buildHumanVerificationEvidence } from './humanVerificationEvidence'

let replay: ReplayEvidence

beforeAll(async () => {
  replay = (
    await loadEvidenceFacade(
      new AbortController().signal,
      createCommittedFixtureFetcher(),
    )
  ).replay
})

describe('buildEvidenceLedger', () => {
  it('orders all ten evidence states without inventing event timestamps or comments', () => {
    const ledger = buildEvidenceLedger(replay)

    expect(ledger.events.map(({ label }) => label)).toEqual([
      'Discovery',
      'Deduplication',
      'Geography',
      'Reference status',
      'Route',
      'Visual inputs',
      'Candidates',
      'Decision',
      'Review state',
      'Export',
    ])
    expect(ledger.events.slice(0, 9).every(({ recordedAt }) => recordedAt === null)).toBe(true)
    expect(ledger.events.at(9)?.recordedAt).toBe('2026-07-16T11:57:54Z')
    expect(ledger.events.find(({ id }) => id === 'decision')).toMatchObject({
      status: 'unavailable',
      scientificClaimAllowed: false,
    })
    expect(ledger.commentEnrichment).toBe('comment enrichment unavailable for this record')
    expect(ledger.commentCount).toBe(0)
    expect(ledger.commentPromotionAllowed).toBe(false)
  })

  it('appends retained local review events without promoting the Flickr record', () => {
    let session = withReviewerId(emptyHumanReviewSession(), 'reviewer-a')
    session = withDecision(session, {
      itemId: HUMAN_REVIEW_ITEMS[0]!.itemId,
      outcome: 'yes',
      comment: null,
      reviewedAt: '2026-07-16T12:00:00.000Z',
      reviewDurationMs: 1_200,
    })
    const humanVerification = buildHumanVerificationEvidence(session.events)
    const ledger = buildEvidenceLedger(replay, humanVerification)

    expect(ledger.events).toHaveLength(11)
    expect(ledger.events.at(9)).toMatchObject({
      id: 'local-human-verification',
      status: 'available',
      recordedAt: '2026-07-16T12:00:00.000Z',
      sourceEventIds: [session.events[0]!.eventId],
      scientificClaimAllowed: false,
    })
    expect(ledger.events.at(9)?.detail).toContain(
      'the Flickr candidate remains unverified',
    )
    expect(ledger.events.at(10)?.id).toBe('export')
  })
})
