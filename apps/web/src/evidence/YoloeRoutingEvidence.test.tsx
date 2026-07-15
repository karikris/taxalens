import { render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'

import { loadEvidenceFacade, type ReplayEvidence } from '../data/evidenceFacade'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import { YoloeRoutingEvidence } from './YoloeRoutingEvidence'

let replay: ReplayEvidence

beforeAll(async () => {
  replay = (
    await loadEvidenceFacade(
      new AbortController().signal,
      createCommittedFixtureFetcher(),
    )
  ).replay
})

describe('YoloeRoutingEvidence', () => {
  it('provides a complete textual alternative for the unavailable overlay and routing row', () => {
    render(<YoloeRoutingEvidence replay={replay} />)

    expect(
      screen.getByText('YOLOE routes evidence; it does not identify species.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('figure', {
        name: 'Original image, detection box, and segmentation mask',
      }),
    ).toHaveTextContent('Evidence unavailable')
    expect(
      screen.getByRole('img', {
        name: 'YOLOE image, detection box, and segmentation mask unavailable',
      }),
    ).toBeInTheDocument()

    const layers = screen.getByRole('list', { name: 'YOLOE visual layers' })
    expect(within(layers).getAllByRole('listitem')).toHaveLength(3)
    expect(within(layers).getByText('Original full image')).toBeInTheDocument()
    expect(within(layers).getByText('Detection box')).toBeInTheDocument()
    expect(within(layers).getByText('Segmentation mask')).toBeInTheDocument()

    const attributes = screen.getByRole('group', { name: 'YOLOE routing attributes' })
    expect(within(attributes).getAllByText('Unavailable')).toHaveLength(6)
    for (const label of [
      'Route',
      'Visual domain',
      'Life stage',
      'Subject area',
      'Multiple organisms',
      'Route reason',
    ]) {
      expect(within(attributes).getByText(label)).toBeInTheDocument()
    }
  })
})
