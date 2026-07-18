import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { GeographicAnalystReplayPanel } from './GeographicAnalystReplayPanel'
import { loadStoredGeographicAnalystReplay } from './storedGeographicAnalystReplay'

describe('GeographicAnalystReplayPanel', () => {
  it('shows the validated replay with no credential or live request', async () => {
    const replay = await loadStoredGeographicAnalystReplay()
    render(<GeographicAnalystReplayPanel state={{ kind: 'ready', replay }} />)

    expect(screen.getByText('GPT-5.6 geographic analyst')).toBeVisible()
    expect(screen.getByText('Stored output · no live call')).toBeVisible()
    expect(screen.getByText('Not required')).toBeVisible()
    expect(screen.getByText(/13,416 geographically supported Flickr candidate-evidence rows/)).toBeVisible()
    expect(screen.getByText(/Zero cells are human-supported additional cells/)).toBeVisible()
  })
})
