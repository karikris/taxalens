import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'

import { loadEvidenceFacade, type ReplayEvidence } from '../data/evidenceFacade'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import { EvidenceFunnel } from './EvidenceFunnel'

let replay: ReplayEvidence

beforeAll(async () => {
  replay = (
    await loadEvidenceFacade(
      new AbortController().signal,
      createCommittedFixtureFetcher(),
    )
  ).replay
})

describe('EvidenceFunnel', () => {
  it('renders a non-proportional seven-stage funnel with source-level provenance', () => {
    const { container } = render(<EvidenceFunnel replay={replay} />)

    expect(screen.getByText('Workflow counts, not confirmed occurrences')).toBeInTheDocument()
    const stages = screen.getByRole('list', { name: 'Evidence funnel stages' })
    expect(stages.querySelectorAll(':scope > li')).toHaveLength(7)
    expect(within(stages).getByRole('heading', { name: 'Query hits' })).toBeInTheDocument()
    expect(within(stages).getByText('76,485')).toBeInTheDocument()
    expect(within(stages).getByRole('heading', { name: 'Unique content' })).toBeInTheDocument()
    const uniqueContent = within(stages)
      .getByRole('heading', { name: 'Unique content' })
      .closest('article')
    expect(uniqueContent).toHaveTextContent('Unavailable')
    expect(uniqueContent).toHaveTextContent('duplicate relationship rows are not committed')
    expect(container).not.toHaveTextContent('%')

    fireEvent.click(screen.getByText('Inspect provenance for Query hits'))
    const queryHits = within(stages).getByRole('heading', { name: 'Query hits' }).closest('article')
    expect(within(queryHits!).getByText('stage-metrics', { exact: true })).toBeInTheDocument()
    expect(
      within(queryHits!).getByText('flickr-candidate-summaries', { exact: true }),
    ).toBeInTheDocument()
    expect(within(queryHits!).getAllByText(/Producer 75461d9c/u)).toHaveLength(2)
  })

  it('provides a complete textual reading with the queue limitation', () => {
    render(<EvidenceFunnel replay={replay} />)

    fireEvent.click(screen.getByText('Read complete textual alternative'))
    const alternative = screen.getByText(/These counts have unlike units/u).parentElement
    expect(alternative).toHaveTextContent('Query hits: 76,485 query associations')
    expect(alternative).toHaveTextContent('Unique content: unavailable content groups')
    expect(alternative).toHaveTextContent('not a materialized ranked queue or scientific result')
  })
})
