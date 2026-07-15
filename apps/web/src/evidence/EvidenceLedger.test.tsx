import { render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'

import { loadEvidenceFacade, type ReplayEvidence } from '../data/evidenceFacade'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import { EvidenceLedger } from './EvidenceLedger'

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
})
