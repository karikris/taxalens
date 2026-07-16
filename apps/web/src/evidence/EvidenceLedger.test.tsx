import { render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'

import { loadEvidenceFacade, type ReplayEvidence } from '../data/evidenceFacade'
import {
  emptyHumanReviewSession,
  withDecision,
  withReviewerId,
} from '../review/domain'
import { HUMAN_REVIEW_ITEMS } from '../review/reviewPacket'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import { EvidenceLedger } from './EvidenceLedger'
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

describe('EvidenceLedger', () => {
  it('renders a complete ordered lifecycle and the truthful comment boundary', () => {
    render(<EvidenceLedger replay={replay} />)

    expect(screen.getByText('comment enrichment unavailable for this record')).toBeInTheDocument()
    const timeline = screen.getByRole('list', { name: 'Evidence lifecycle ledger' })
    expect(within(timeline).getAllByRole('listitem')).toHaveLength(10)
    expect(within(timeline).getAllByText('Unavailable — no per-event timestamp committed')).toHaveLength(9)
    expect(within(timeline).getAllByRole('time')).toHaveLength(1)
    expect(within(timeline).getByRole('heading', { name: 'Discovery' })).toBeInTheDocument()
    expect(within(timeline).getByRole('heading', { name: 'Review state' })).toBeInTheDocument()
    expect(within(timeline).getByRole('heading', { name: 'Export' })).toBeInTheDocument()
  })

  it('renders the local append-only review event IDs in lineage', () => {
    let session = withReviewerId(emptyHumanReviewSession(), 'reviewer-a')
    session = withDecision(session, {
      itemId: HUMAN_REVIEW_ITEMS[0]!.itemId,
      outcome: 'yes',
      comment: null,
      reviewedAt: '2026-07-16T12:00:00.000Z',
      reviewDurationMs: 1_200,
    })
    render(
      <EvidenceLedger
        humanVerification={buildHumanVerificationEvidence(session.events)}
        replay={replay}
      />,
    )

    const timeline = screen.getByRole('list', { name: 'Evidence lifecycle ledger' })
    expect(within(timeline).getAllByRole('listitem')).toHaveLength(11)
    const localReview = within(timeline)
      .getByRole('heading', { name: 'Local human verification' })
      .closest('article')
    expect(localReview).toHaveTextContent(session.events[0]!.eventId)
    expect(localReview).toHaveTextContent('None — local browser evidence')
  })
})
