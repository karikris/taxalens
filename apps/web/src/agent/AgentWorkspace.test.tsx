import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'

import { loadEvidenceFacade, type ReplayEvidence } from '../data/evidenceFacade'
import { createAnalystRunFixture } from '../test/agentFixtures'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import { AgentWorkspace } from './AgentWorkspace'
import { buildPublicAgentTrace } from './agentTraceModel'

let replay: ReplayEvidence

beforeAll(async () => {
  replay = (
    await loadEvidenceFacade(
      new AbortController().signal,
      createCommittedFixtureFetcher(),
    )
  ).replay
})

describe('AgentWorkspace', () => {
  it('shows the exact model contract and a truthful no-session state', () => {
    render(<AgentWorkspace replay={replay} />)

    expect(screen.getByRole('heading', { name: 'Configured model Sol research analyst' })).toBeInTheDocument()
    expect(screen.getByText('configured-model')).toBeInTheDocument()
    expect(screen.getByText('9 read-only')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'No analyst session loaded' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('No live call or stored output')
    expect(screen.getAllByText('Unavailable')).toHaveLength(7)
    expect(screen.getByLabelText('Agent trace privacy boundary')).toHaveTextContent(
      'Private reasoning and chain-of-thought are neither collected',
    )
    expect(screen.queryByRole('heading', { name: 'Answer' })).not.toBeInTheDocument()
  })

  it('renders the full public trace without private reasoning or invented token counts', () => {
    const run = createAnalystRunFixture(replay)
    const trace = buildPublicAgentTrace(
      {
        mode: 'live',
        requestKind: 'evidence_explanation',
        request: 'What target does this replay resolve?',
        run,
      },
      replay,
    )
    render(<AgentWorkspace replay={replay} trace={trace} />)

    expect(screen.getByRole('heading', { name: 'Request' })).toBeInTheDocument()
    expect(screen.getByText('What target does this replay resolve?')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Plan' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Tools' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'resolve_taxon' })).toBeInTheDocument()
    expect(screen.getByText('Validated parameters')).toBeInTheDocument()
    expect(screen.getByText('Structured tool result')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Artifacts' })).toBeInTheDocument()
    expect(screen.getByText(replay.artifactInventory.find(({ artifactId }) => artifactId === 'query-definitions')!.path)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Structured output' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Answer' })).toBeInTheDocument()
    expect(screen.getByText(run.output.answer)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Budgets' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Tool calls: 1 of 4' })).toHaveAttribute(
      'value',
      '1',
    )
    expect(screen.getByRole('progressbar', { name: 'Response turns: 2 of 3' })).toHaveAttribute(
      'value',
      '2',
    )
    expect(screen.getByText(/No token count is displayed/u)).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent('opaque-reasoning')
    expect(document.body).not.toHaveTextContent('chain of thought:')
  })
})
