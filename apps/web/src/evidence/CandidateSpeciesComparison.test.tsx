import { render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'

import { loadEvidenceFacade, type ReplayEvidence } from '../data/evidenceFacade'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import { CandidateSpeciesComparison } from './CandidateSpeciesComparison'

let replay: ReplayEvidence

beforeAll(async () => {
  replay = (
    await loadEvidenceFacade(
      new AbortController().signal,
      createCommittedFixtureFetcher(),
    )
  ).replay
})

describe('CandidateSpeciesComparison', () => {
  it('shows plan-backed candidates without presenting them as a scored ranking', () => {
    render(<CandidateSpeciesComparison replay={replay} />)

    expect(
      screen.getByText('All eligible candidates scored; four strongest alternatives displayed.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Unavailable assertion')).toBeInTheDocument()
    expect(screen.getByText('Papilio demoleus')).toBeInTheDocument()
    expect(screen.getByText('Total candidate count').parentElement).toHaveTextContent('6')
    expect(screen.getByText('Target rank').parentElement).toHaveTextContent('Unavailable')

    const displayed = screen.getByRole('list', { name: 'Displayed candidate alternatives' })
    expect(within(displayed).getAllByRole('listitem')).toHaveLength(4)
    expect(within(displayed).getByText('Papilio memnon')).toBeInTheDocument()
    expect(within(displayed).getAllByText('Score unavailable')).toHaveLength(4)
    expect(within(displayed).getAllByText(/not score rank/u)).toHaveLength(4)

    const outcomes = screen.getByLabelText('Best candidate outcomes')
    expect(within(outcomes).getByText('Best regional competitor')).toBeInTheDocument()
    expect(within(outcomes).getByText('Best non-regional competitor')).toBeInTheDocument()
    expect(within(outcomes).getByText('Best domain negative')).toBeInTheDocument()
    expect(within(outcomes).getAllByText(/Unavailable\./u)).toHaveLength(3)

    expect(screen.getByText('Eligible source media candidates').parentElement).toHaveTextContent(
      '838',
    )
    expect(screen.getByText('Human-verified source media').parentElement).toHaveTextContent('0')
  })
})
