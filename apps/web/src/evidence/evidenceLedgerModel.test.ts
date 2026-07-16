import { beforeAll, describe, expect, it } from 'vitest'

import { loadEvidenceFacade, type ReplayEvidence } from '../data/evidenceFacade'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import { buildEvidenceLedger } from './evidenceLedgerModel'

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
    expect(ledger.events.at(9)?.recordedAt).toBe('2026-07-16T09:44:16Z')
    expect(ledger.events.find(({ id }) => id === 'decision')).toMatchObject({
      status: 'unavailable',
      scientificClaimAllowed: false,
    })
    expect(ledger.commentEnrichment).toBe('comment enrichment unavailable for this record')
    expect(ledger.commentCount).toBe(0)
    expect(ledger.commentPromotionAllowed).toBe(false)
  })
})
