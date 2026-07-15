import { render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'

import { loadEvidenceFacade, type ReplayEvidence } from '../data/evidenceFacade'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import { ObservatoryWorkspace } from './ObservatoryWorkspace'

let replay: ReplayEvidence

beforeAll(async () => {
  replay = (
    await loadEvidenceFacade(
      new AbortController().signal,
      createCommittedFixtureFetcher(),
    )
  ).replay
})

describe('ObservatoryWorkspace', () => {
  it('renders the verified fixture as an accessible textual pipeline', () => {
    render(<ObservatoryWorkspace replay={replay} replayLaunch={null} />)

    expect(screen.getByRole('heading', { name: 'Evidence pipeline' })).toBeInTheDocument()
    const pipeline = screen.getByRole('list', { name: 'Evidence pipeline stages' })
    expect(within(pipeline).getAllByRole('listitem')).toHaveLength(13)
    expect(within(pipeline).getByText('76,485')).toBeInTheDocument()
    expect(within(pipeline).getByText('13,501')).toBeInTheDocument()
    expect(within(pipeline).getByText(/butterflies-v2-20260712/u)).toBeInTheDocument()
    expect(within(pipeline).getAllByText('Unavailable')).toHaveLength(5)
    expect(screen.getByText(/Zero means the verified fixture records no output/u)).toBeInTheDocument()
  })
})
