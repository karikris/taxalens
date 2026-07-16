import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'

import { loadEvidenceFacade, type EvidenceFacade } from '../data/evidenceFacade'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import { EvidenceExport } from './EvidenceExport'

let facade: EvidenceFacade

beforeAll(async () => {
  facade = await loadEvidenceFacade(
    new AbortController().signal,
    createCommittedFixtureFetcher(),
  )
})

describe('EvidenceExport', () => {
  it('prepares six downloadable audit files locally and labels the unsigned boundary', async () => {
    render(<EvidenceExport facade={facade} replay={facade.replay} />)

    expect(screen.getByText('Unsigned manifest')).toBeInTheDocument()
    expect(screen.getByText(/No signing key is committed/u)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Prepare local audit bundle' }))

    expect(await screen.findByText('Six audit files prepared locally')).toBeInTheDocument()
    const files = screen.getByRole('list', { name: 'Prepared evidence export files' })
    expect(within(files).getAllByRole('listitem')).toHaveLength(6)
    for (const label of [
      'JSON evidence',
      'CSV summary',
      'Source Parquet',
      'Prototype receipt',
      'Checksum manifest',
      'Provenance report',
    ]) {
      expect(within(files).getByRole('button', { name: `Download ${label}` })).toBeInTheDocument()
    }
    expect(screen.getByText(/verified BioMiner Flickr query-hit source/u)).toBeInTheDocument()
  })
})
