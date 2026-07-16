import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'

import { loadEvidenceFacade, type ReplayEvidence } from '../data/evidenceFacade'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import { ResearchOutputsPanel } from './ResearchOutputsPanel'

let replay: ReplayEvidence

beforeAll(async () => {
  replay = (
    await loadEvidenceFacade(
      new AbortController().signal,
      createCommittedFixtureFetcher(),
    )
  ).replay
})

describe('ResearchOutputsPanel', () => {
  it('previews all six truthful output boundaries before generation', () => {
    render(<ResearchOutputsPanel replay={replay} />)

    expect(screen.getByText('Deterministic local export · unsigned manifest')).toBeInTheDocument()
    const files = screen.getByRole('list', { name: 'Research output files' })
    expect(within(files).getAllByRole('listitem')).toHaveLength(6)
    for (const label of [
      'Review queue',
      'Evidence summary',
      'Prototype boundary',
      'Manifest',
      'Provenance',
      'Evaluation report',
    ]) {
      expect(within(files).getByRole('heading', { name: label })).toBeInTheDocument()
    }
    expect(files.querySelectorAll('li[data-output-state="planned"]')).toHaveLength(6)
    expect(screen.getByRole('heading', { name: 'Portable does not mean promoted' }).parentElement?.parentElement)
      .toHaveTextContent('unranked worklist snapshot')
  })

  it('prepares six hashed downloads locally', async () => {
    render(<ResearchOutputsPanel replay={replay} />)

    fireEvent.click(screen.getByRole('button', { name: 'Prepare six research outputs' }))
    expect(await screen.findByText('Six research outputs prepared locally')).toBeInTheDocument()
    const files = screen.getByRole('list', { name: 'Research output files' })
    expect(files.querySelectorAll('li[data-output-state="ready"]')).toHaveLength(6)
    for (const label of [
      'Review queue',
      'Evidence summary',
      'Prototype boundary',
      'Manifest',
      'Provenance',
      'Evaluation report',
    ]) {
      expect(within(files).getByRole('button', { name: `Download ${label}` })).toBeInTheDocument()
    }
    expect(files.querySelectorAll('.research-outputs__receipt > small')).toHaveLength(6)
    expect(files).toHaveTextContent('taxalens-papilio-demoleus-awaiting-human-review.review-queue.json')
    expect(files).toHaveTextContent('taxalens-papilio-demoleus-awaiting-human-review.prototype-boundary.json')
    expect(files).toHaveTextContent('taxalens-papilio-demoleus-awaiting-human-review.evaluation-report.json')
  })
})
