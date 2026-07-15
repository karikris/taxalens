import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'

import { loadEvidenceFacade, type ReplayEvidence } from '../data/evidenceFacade'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import { WorkflowEfficiencyReport } from './WorkflowEfficiencyReport'

let replay: ReplayEvidence

beforeAll(async () => {
  replay = (
    await loadEvidenceFacade(
      new AbortController().signal,
      createCommittedFixtureFetcher(),
    )
  ).replay
})

describe('WorkflowEfficiencyReport', () => {
  it('withholds counterfactual savings and shows exact observed context', () => {
    render(<WorkflowEfficiencyReport replay={replay} />)

    expect(
      screen.getByText('One measured state ledger · five savings claims withheld'),
    ).toBeInTheDocument()
    const metrics = screen.getByRole('list', { name: 'Workflow efficiency measurements' })
    expect(within(metrics).getAllByRole('listitem')).toHaveLength(6)
    expect(metrics.querySelectorAll('li[data-efficiency-status="unavailable"]')).toHaveLength(5)
    const api = within(metrics).getByRole('heading', { name: 'API calls avoided' }).closest('article')
    expect(api).toHaveTextContent('Unavailable')
    expect(api).toHaveTextContent('Observed requests314')
    expect(api).toHaveTextContent('Retries0')
    const restart = within(metrics)
      .getByRole('heading', { name: 'Restart efficiency' })
      .closest('article')
    expect(restart).toHaveTextContent('Complete checkpoints22 of 22')
    expect(restart).toHaveTextContent('Checkpoint pages314')
  })

  it('renders measured evidence state and complete table provenance', () => {
    render(<WorkflowEfficiencyReport replay={replay} />)

    const metrics = screen.getByRole('list', { name: 'Workflow efficiency measurements' })
    const completeness = within(metrics)
      .getByRole('heading', { name: 'Evidence completeness' })
      .closest('article')
    expect(completeness).toHaveTextContent('24 of 24 artifacts verified')
    expect(completeness).toHaveTextContent('Available sections5')
    expect(completeness).toHaveTextContent('Partial sections9')
    expect(completeness).toHaveTextContent('Unavailable sections6')
    expect(screen.getByText('Integrity is not scientific completeness').parentElement?.parentElement)
      .toHaveTextContent('5 are available, 9 partial, and 6 unavailable')

    fireEvent.click(screen.getByText('Read the complete efficiency ledger as a table'))
    expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(6)
    fireEvent.click(screen.getByText('Inspect workflow-efficiency provenance'))
    expect(screen.getByText('reference-readiness')).toBeInTheDocument()
    expect(screen.getByText('duplicate-summaries')).toBeInTheDocument()
    expect(screen.getByText('run-summary')).toBeInTheDocument()
  })
})
