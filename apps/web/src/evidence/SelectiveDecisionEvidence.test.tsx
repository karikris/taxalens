import { render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'

import { loadEvidenceFacade, type ReplayEvidence } from '../data/evidenceFacade'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import { SelectiveDecisionEvidence } from './SelectiveDecisionEvidence'

let replay: ReplayEvidence

beforeAll(async () => {
  replay = (
    await loadEvidenceFacade(
      new AbortController().signal,
      createCommittedFixtureFetcher(),
    )
  ).replay
})

describe('SelectiveDecisionEvidence', () => {
  it('renders raw and calibrated fields without creating zero-valued charts', () => {
    render(<SelectiveDecisionEvidence replay={replay} />)

    expect(screen.getByText('Raw similarity — not a probability')).toBeInTheDocument()
    expect(screen.getByText('Calibrated output unavailable')).toBeInTheDocument()
    expect(
      screen.getByText('Awaiting human review is not model abstention'),
    ).toBeInTheDocument()

    const raw = screen.getByRole('list', { name: 'Raw evidence fields' })
    const decision = screen.getByRole('list', { name: 'Decision evidence fields' })
    expect(within(raw).getAllByRole('listitem')).toHaveLength(7)
    expect(within(decision).getAllByRole('listitem')).toHaveLength(7)
    expect(within(raw).getByText('Text similarity')).toBeInTheDocument()
    expect(within(raw).getByText('Visual-input fusion')).toBeInTheDocument()
    expect(within(decision).getByText('Calibrated target probability')).toBeInTheDocument()
    expect(within(decision).getByText('Policy fingerprint')).toBeInTheDocument()
    expect(screen.getAllByText('Unavailable')).toHaveLength(16)
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })
})
