import { render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'

import { loadEvidenceFacade, type ReplayEvidence } from '../data/evidenceFacade'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import { ReviewedEvaluationState } from './ReviewedEvaluationState'

let replay: ReplayEvidence

beforeAll(async () => {
  replay = (
    await loadEvidenceFacade(
      new AbortController().signal,
      createCommittedFixtureFetcher(),
    )
  ).replay
})

describe('ReviewedEvaluationState', () => {
  it('shows the Phase 13 absence and exact Phase 14 review block', () => {
    render(<ReviewedEvaluationState replay={replay} />)

    expect(screen.getByText('Evaluation unavailable · reference review blocked')).toBeInTheDocument()
    const phase13 = screen.getByRole('heading', { name: 'Reviewed result boundary' }).closest('article')
    expect(phase13).toHaveTextContent('No Phase 13 result artifact is supplied to this fixture.')
    expect(phase13).toHaveTextContent('Result artifacts0')
    expect(phase13).toHaveTextContent('Valid metrics0')
    const phase14 = screen.getByRole('heading', { name: 'Reference-review gate' }).closest('article')
    expect(phase14).toHaveTextContent('Human-verified media0')
    expect(phase14).toHaveTextContent('Review shortfall490')
    expect(phase14).toHaveTextContent('Groups awaiting review1')
    expect(phase14).toHaveTextContent('Unresolved groups2')
  })

  it('renders every withheld metric with its denominator and a no-fabrication guardrail', () => {
    render(<ReviewedEvaluationState replay={replay} />)

    const table = screen.getByRole('table', { name: /Reviewed metric availability/u })
    expect(table.querySelectorAll('tbody tr')).toHaveLength(7)
    expect(table.querySelectorAll('tr[data-metric-state="unavailable"]')).toHaveLength(7)
    expect(within(table).getAllByText('Unavailable')).toHaveLength(7)
    expect(within(table).getByText('Precision').parentElement).toHaveTextContent('TP / (TP + FP)')
    expect(within(table).getByText('Accuracy').parentElement).toHaveTextContent('(TP + TN) / N')
    expect(screen.getByRole('heading', { name: 'No fake precision or accuracy' }).parentElement?.parentElement)
      .toHaveTextContent('No precision, recall, PR-AUC, accuracy, calibration, or coverage value')
  })

  it('exposes the absence boundary and verified blocking artifacts as provenance', () => {
    render(<ReviewedEvaluationState replay={replay} />)

    expect(screen.getByText('Inspect evaluation-state provenance')).toBeInTheDocument()
    expect(screen.getByText('reference-readiness')).toBeInTheDocument()
    expect(screen.getByText('reference-shortfalls')).toBeInTheDocument()
    expect(screen.getByText('selective-decision-metadata')).toBeInTheDocument()
  })
})
