import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'

import { loadStoredVerificationAnalystReplay } from './storedVerificationAnalystReplay'
import type { VerificationAnalystRun } from './verificationAnalystContract'
import { createVerificationAgentEvidenceFixture } from './verificationAgentEvidenceFixture'
import { VerificationRecommendationPanel } from './VerificationRecommendationPanel'

let run: VerificationAnalystRun

beforeAll(async () => {
  const { evidence } = await createVerificationAgentEvidenceFixture()
  run = await loadStoredVerificationAnalystReplay(evidence)
})

describe('VerificationRecommendationPanel', () => {
  it('shows the validated stored next action with its non-scientific boundary', () => {
    render(
      <VerificationRecommendationPanel state={{ kind: 'ready', run }} />,
    )

    expect(
      screen.getByRole('heading', { name: 'Configured model next review action' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Stored recommendation · no live call')).toBeInTheDocument()
    expect(screen.getByText('adjudication')).toBeInTheDocument()
    expect(screen.getByText('unresolved review conflict')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        name: 'Assign the conflicted item to an independent adjudicator and retain the complete dissenting event history.',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('commons-papilio-demoleus-open-wing'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Synthetic evaluation evidence · not current browser state',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText(/not a human outcome/u)).toBeInTheDocument()
  })

  it('fails visibly when the stored replay is unavailable', () => {
    render(
      <VerificationRecommendationPanel
        state={{ kind: 'error', message: 'Stored trace rejected.' }}
      />,
    )

    expect(
      screen.getByText('Verification recommendation unavailable'),
    ).toBeInTheDocument()
    expect(screen.getByText('Stored trace rejected.')).toBeInTheDocument()
  })
})
