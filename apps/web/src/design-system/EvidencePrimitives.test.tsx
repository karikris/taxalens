import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  EvidenceDesignation,
  EvidenceState,
  EvidenceTier,
  ScoreSemantics,
  UncertaintyNote,
} from './EvidencePrimitives'

describe('scientific evidence semantics', () => {
  it('exposes loading and failure with appropriate live-region semantics', () => {
    const { rerender } = render(
      <EvidenceState state="loading" title="Loading committed evidence">
        No remote service is contacted.
      </EvidenceState>,
    )

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Loading committed evidence')

    rerender(
      <EvidenceState state="failure" title="Evidence could not be verified">
        Display is stopped.
      </EvidenceState>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Display is stopped')
  })

  it('keeps candidate and release-ready occurrence-candidate designations distinct', () => {
    render(
      <div>
        <EvidenceDesignation kind="candidate" />
        <EvidenceDesignation
          kind="release-ready-occurrence-candidate"
          releaseGateEvidenceId="release-decision:fixture"
        />
        <ScoreSemantics kind="raw" />
        <ScoreSemantics kind="calibrated" calibrationEvidence="Calibration artifact v1" />
      </div>,
    )

    expect(screen.getByText('Candidate — not an occurrence')).toBeInTheDocument()
    expect(screen.getByText('Release-ready occurrence candidate')).toBeInTheDocument()
    expect(screen.getByText('Raw similarity — not a probability')).toBeInTheDocument()
    expect(screen.getByText('Calibrated probability')).toHaveAttribute(
      'title',
      'Calibration artifact v1',
    )
  })

  it('rejects a release-ready designation without gate evidence', () => {
    expect(() =>
      render(
        <EvidenceDesignation
          kind="release-ready-occurrence-candidate"
          releaseGateEvidenceId=" "
        />,
      ),
    ).toThrow('Release-ready designation requires occurrence-release gate evidence')
  })

  it('labels unavailable tiers and uncertainty without relying on color', () => {
    render(
      <div>
        <EvidenceTier tier="unavailable" />
        <UncertaintyNote>Sample support is below the approved threshold.</UncertaintyNote>
      </div>,
    )

    expect(screen.getByText('Evidence unavailable')).toHaveAttribute(
      'data-tier',
      'unavailable',
    )
    expect(screen.getByRole('complementary', { name: 'Uncertainty' })).toHaveTextContent(
      'Sample support is below the approved threshold.',
    )
  })
})
