import { render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'

import { loadEvidenceFacade, type ReplayEvidence } from '../data/evidenceFacade'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import { FullFrameInputComparison } from './FullFrameInputComparison'

let replay: ReplayEvidence

beforeAll(async () => {
  replay = (
    await loadEvidenceFacade(
      new AbortController().signal,
      createCommittedFixtureFetcher(),
    )
  ).replay
})

describe('FullFrameInputComparison', () => {
  it('exposes four keyboard-ready modes and a complete unavailable identity contract', () => {
    render(<FullFrameInputComparison replay={replay} />)

    const tablist = screen.getByRole('tablist', { name: 'Full-frame visual-input mode' })
    expect(within(tablist).getAllByRole('tab')).toHaveLength(4)
    expect(within(tablist).getByRole('tab', { name: 'Focused full frame' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    const panel = screen.getByRole('tabpanel', { name: 'Focused full frame' })
    expect(within(panel).getByRole('img', { name: 'Raw full image unavailable' })).toBeInTheDocument()
    expect(
      within(panel).getByRole('img', { name: 'Focused attention view unavailable' }),
    ).toBeInTheDocument()
    expect(within(panel).getByText('Crossfade unavailable')).toBeInTheDocument()

    const identities = screen.getByRole('group', { name: 'Full-frame identities' })
    expect(within(identities).getAllByText('Unavailable')).toHaveLength(4)
    for (const label of [
      'Full canvas retained',
      'Transformation version',
      'Transformation fingerprint',
      'Embedding identity',
    ]) {
      expect(within(identities).getByText(label)).toBeInTheDocument()
    }
    expect(document.querySelectorAll('.full-frame-comparison img')).toHaveLength(0)
  })
})
