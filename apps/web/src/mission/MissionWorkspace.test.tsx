import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'

import { loadEvidenceFacade, type ReplayEvidence } from '../data/evidenceFacade'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import { MissionWorkspace } from './MissionWorkspace'

let replay: ReplayEvidence

beforeAll(async () => {
  const facade = await loadEvidenceFacade(
    new AbortController().signal,
    createCommittedFixtureFetcher(),
  )
  replay = facade.replay
})

function renderMission() {
  return render(<MissionWorkspace evidence={replay.mission} target={replay.target} />)
}

describe('MissionWorkspace', () => {
  it('renders accessible mission inputs and the verified replay policy baseline', () => {
    renderMission()

    expect(screen.getByRole('heading', { name: 'Papilio demoleus' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Target species' })).toHaveValue(
      'Papilio demoleus',
    )
    expect(screen.getByRole('textbox', { name: 'Maximum API calls' })).toHaveValue('314')
    expect(screen.getByRole('textbox', { name: 'Candidate limit' })).toHaveValue('5')
    expect(screen.getByRole('radio', { name: 'Replay committed evidence' })).toBeChecked()
    expect(
      screen.getByRole('radio', { name: 'Live work unavailable in the submitted build' }),
    ).toBeDisabled()
    expect(screen.getByRole('textbox', { name: 'Optional device' })).toBeEnabled()

    const hierarchy = screen.getByRole('heading', { name: 'Query hierarchy' }).parentElement
    expect(hierarchy).not.toBeNull()
    expect(within(hierarchy as HTMLElement).getByText('22 committed definitions')).toBeInTheDocument()

    const candidatePolicy = screen.getByRole('heading', {
      name: 'Regional comparison hypotheses',
    }).parentElement
    expect(candidatePolicy).not.toBeNull()
    expect(within(candidatePolicy as HTMLElement).getAllByRole('listitem')).toHaveLength(5)
    expect(within(candidatePolicy as HTMLElement).getByText('Papilio memnon')).toBeInTheDocument()

    const prerequisites = screen.getByRole('heading', {
      name: 'Live scientific work is not ready',
    }).parentElement
    expect(prerequisites).not.toBeNull()
    expect(within(prerequisites as HTMLElement).getAllByRole('listitem')).toHaveLength(5)
    expect(screen.getByText(/Human-review shortfall/u).parentElement).toHaveTextContent('490')
  })

  it('marks unsupported target edits and restores the replay-bound baseline', () => {
    renderMission()

    const target = screen.getByRole('textbox', { name: 'Target species' })
    const device = screen.getByRole('textbox', { name: 'Optional device' })
    fireEvent.change(target, { target: { value: 'Papilio polytes' } })
    fireEvent.change(device, { target: { value: 'external GPU computer' } })

    expect(screen.getByText('No matching verified fixture').closest('[role="status"]')).toHaveTextContent(
      'No matching verified fixture',
    )
    expect(device).toHaveValue('external GPU computer')

    fireEvent.click(screen.getByRole('button', { name: 'Restore replay baseline' }))
    expect(target).toHaveValue('Papilio demoleus')
    expect(device).toHaveValue('')
    expect(screen.queryByText('No matching verified fixture')).not.toBeInTheDocument()
  })
})
