import { render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'

import { loadEvidenceFacade, type ReplayEvidence } from '../data/evidenceFacade'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import { GeographyReferenceContext } from './GeographyReferenceContext'

let replay: ReplayEvidence

beforeAll(async () => {
  replay = (
    await loadEvidenceFacade(
      new AbortController().signal,
      createCommittedFixtureFetcher(),
    )
  ).replay
})

describe('GeographyReferenceContext', () => {
  it('shows verified summary and rights boundaries before the coordinate query runs', () => {
    render(<GeographyReferenceContext inspectionStatus="idle" replay={replay} result={null} />)

    expect(screen.getByText('Search candidate — not occurrence')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Candidate coordinate unavailable' })).toBeInTheDocument()
    expect(screen.getByText('Candidate coordinate').parentElement).toHaveTextContent(
      'Unavailable until local inspection',
    )
    const shortfalls = screen.getByRole('heading', { name: 'Reference shortfalls' }).closest('section')
    expect(shortfalls).not.toBeNull()
    expect(within(shortfalls!).getByText('Human-verified images').parentElement).toHaveTextContent('0')
    expect(within(shortfalls!).getByText('Source-candidate shortfall').parentElement).toHaveTextContent('247')
    expect(screen.getByText('Metadata licence').parentElement).toHaveTextContent('MIT · Kris Kari')
    expect(screen.getByText('Image source and licence').parentElement).toHaveTextContent(
      '0 included and 0 licensed images',
    )
  })
})
