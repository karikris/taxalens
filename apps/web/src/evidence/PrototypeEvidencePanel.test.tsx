import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'

import { loadEvidenceFacade, type ReplayEvidence } from '../data/evidenceFacade'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import { PrototypeEvidencePanel } from './PrototypeEvidencePanel'

let replay: ReplayEvidence

beforeAll(async () => {
  replay = (
    await loadEvidenceFacade(
      new AbortController().signal,
      createCommittedFixtureFetcher(),
    )
  ).replay
})

describe('PrototypeEvidencePanel', () => {
  it('presents aggregate Phase 14/15 facts without promoting scientific evidence', () => {
    render(<PrototypeEvidencePanel prototype={replay.prototype} />)

    expect(
      screen.getByRole('heading', { name: 'Aggregate prototype evidence' }),
    ).toBeInTheDocument()
    expect(screen.getByText('81 provider-supported · 0 human-verified')).toBeInTheDocument()
    expect(screen.getByText('2 allowed · 79 research-only')).toBeInTheDocument()
    expect(screen.getByText('B0 10% → B13 100%')).toBeInTheDocument()
    expect(screen.getByText('0.02 staged diagnostic · 0.10 selected policy')).toBeInTheDocument()
    expect(screen.getByText('13,496 / 13,501')).toBeInTheDocument()
    expect(screen.getByText('634,312')).toBeInTheDocument()
    expect(screen.getByText('12,296 (91.1085%)')).toBeInTheDocument()
    expect(
      screen.getByText(/distributions are neither accuracy nor prevalence/u),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/public reference-image display.*remain unauthorized/iu),
    ).toBeInTheDocument()
  })
})
