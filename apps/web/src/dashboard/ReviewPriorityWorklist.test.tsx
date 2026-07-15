import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'

import { loadEvidenceFacade, type ReplayEvidence } from '../data/evidenceFacade'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import { ReviewPriorityWorklist } from './ReviewPriorityWorklist'

let replay: ReplayEvidence

beforeAll(async () => {
  replay = (
    await loadEvidenceFacade(
      new AbortController().signal,
      createCommittedFixtureFetcher(),
    )
  ).replay
})

describe('ReviewPriorityWorklist', () => {
  it('shows the only awaiting-review record without a fabricated priority score', () => {
    render(<ReviewPriorityWorklist replay={replay} />)

    expect(screen.getByText('One committed work item · priority unavailable')).toBeInTheDocument()
    expect(screen.getByText('Position 1 of 1')).toBeInTheDocument()
    expect(screen.getByText('papilio-demoleus-pilot-awaiting-review')).toBeInTheDocument()
    expect(screen.getByText('Priority score').parentElement).toHaveTextContent(
      'Unavailable — no materialized review queue',
    )
    expect(screen.getByText('Blocked gates').parentElement).toHaveTextContent('5 of 5')
    expect(screen.getByText('Position basis').parentElement).toHaveTextContent(
      'not score-derived',
    )
  })

  it('renders all seven factor states and the complete table and provenance', () => {
    render(<ReviewPriorityWorklist replay={replay} />)

    const factors = screen.getByRole('list', { name: 'Priority factor audit' })
    expect(within(factors).getAllByRole('listitem')).toHaveLength(7)
    expect(within(factors).getByRole('heading', { name: 'Competitor margin' })).toBeInTheDocument()
    expect(within(factors).getByRole('heading', { name: 'Missing calibration' })).toBeInTheDocument()
    expect(within(factors).getByText('247 source · 490 human-review')).toBeInTheDocument()
    expect(within(factors).getByText('0 committed comments')).toBeInTheDocument()
    expect(within(factors).getAllByText('Priority effect: not scored')).toHaveLength(7)

    fireEvent.click(screen.getByText('Read the complete priority audit as a table'))
    expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(7)
    fireEvent.click(screen.getByText('Inspect review-work provenance'))
    const provenance = screen.getByText('selective-decision-metadata').closest('li')
    expect(provenance).toHaveTextContent('6906410a5715674987df35b92bfc7836779d5514e3a52b68cb61437b07581743')
    expect(screen.getByText('reference-shortfalls')).toBeInTheDocument()
  })
})
