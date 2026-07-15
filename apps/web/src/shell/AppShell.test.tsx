import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { ReplayIdentity } from '../data/evidenceFacade'
import { AppShell } from './AppShell'

const replay: ReplayIdentity = Object.freeze({
  bundleId: 'papilio-demoleus-pilot-75461d9c-v1',
  target: Object.freeze({
    acceptedTaxonKey: 'gbif:1938069',
    scientificName: 'Papilio demoleus',
    rank: 'species',
  }),
  sourceRevisions: Object.freeze({
    taxalensSha: '188187d73ca8e0ef2c670bdf6cefcb20c8a59d9d',
    biominerSha: '75461d9c065af0cd96b41cd1f845c2e920f7ae34',
  }),
})

function renderShell(overrides?: {
  readonly globalError?: {
    readonly title: string
    readonly message: string
    readonly onRetry: () => void
  }
  readonly onReset?: () => void
}) {
  return render(
    <AppShell
      replay={replay}
      globalError={overrides?.globalError}
      onReset={overrides?.onReset ?? vi.fn()}
      renderView={(view) => <h2>{view} view</h2>}
    />,
  )
}

describe('AppShell', () => {
  it('shows target and source lineage with hash-synchronized primary navigation', () => {
    const onReset = vi.fn()
    renderShell({ onReset })

    expect(screen.getByText('Papilio demoleus')).toBeInTheDocument()
    expect(screen.getByText('papilio-demoleus-pilot-75461d9c-v1')).toBeInTheDocument()
    expect(screen.getByTitle(replay.sourceRevisions.taxalensSha)).toHaveTextContent(
      '188187d7…a59d9d',
    )
    expect(screen.getByTitle(replay.sourceRevisions.biominerSha)).toHaveTextContent(
      '75461d9c…f7ae34',
    )

    const mission = screen.getByRole('link', { name: 'Mission' })
    const evidenceLens = screen.getByRole('link', { name: 'Evidence Lens' })
    expect(mission).toHaveAttribute('aria-current', 'page')

    fireEvent.click(evidenceLens)
    expect(evidenceLens).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { name: 'evidence-lens view' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reset replay' }))
    expect(onReset).toHaveBeenCalledOnce()
    expect(mission).toHaveAttribute('aria-current', 'page')
  })

  it('provides a labelled five-step tour that can navigate to a view', () => {
    renderShell()

    fireEvent.click(screen.getByRole('button', { name: 'Guided tour' }))
    expect(screen.getByRole('dialog', { name: 'Mission' })).toBeInTheDocument()
    expect(screen.getByText('Guided tour · Step 1 of 5')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next: Observatory' }))
    expect(screen.getByRole('dialog', { name: 'Observatory' })).toBeInTheDocument()
    expect(screen.getByText('Guided tour · Step 2 of 5')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Visit Observatory' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Observatory' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('renders the global replay error and delegates retry', () => {
    const onRetry = vi.fn()
    renderShell({
      globalError: {
        title: 'Bundle verification stopped',
        message: 'Manifest checksum differs.',
        onRetry,
      },
    })

    expect(screen.getByRole('alert')).toHaveTextContent('Manifest checksum differs.')
    fireEvent.click(screen.getByRole('button', { name: 'Retry local load' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
