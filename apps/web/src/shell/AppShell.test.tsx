import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
      renderView={(route) => <h2>{route.view} view</h2>}
    />,
  )
}

describe('AppShell', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
  })

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
    expect(
      screen.getByRole('link', { name: 'Verification' }),
    ).toHaveAttribute('href', '#verification')
    expect(mission).toHaveAttribute('aria-current', 'page')

    fireEvent.click(evidenceLens)
    expect(evidenceLens).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { name: 'evidence-lens view' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reset replay' }))
    expect(onReset).toHaveBeenCalledOnce()
    expect(mission).toHaveAttribute('aria-current', 'page')
  })

  it('canonicalizes the legacy Human Review hash to Verification', async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 0))
    window.history.replaceState(null, '', '/#human-review')
    renderShell()

    const verification = screen.getByRole('link', { name: 'Verification' })
    await waitFor(() =>
      expect(verification).toHaveAttribute('aria-current', 'page'),
    )
    expect(window.location.hash).toBe('#verification')
    expect(
      screen.getByRole('heading', { name: 'verification view' }),
    ).toBeInTheDocument()
  })

  it('provides a labelled six-step tour that can navigate to a view', () => {
    renderShell()

    fireEvent.click(screen.getByRole('button', { name: 'Start 90-second judge tour' }))
    expect(screen.getByRole('dialog', { name: 'Research Mission' })).toBeInTheDocument()
    expect(screen.getByText('90-second judge tour · Step 1 of 6')).toBeInTheDocument()
    expect(screen.getByText('Suggested time: 10 seconds · Total route: 90 seconds')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next: Observatory' }))
    expect(screen.getByRole('dialog', { name: 'Observatory' })).toBeInTheDocument()
    expect(screen.getByText('90-second judge tour · Step 2 of 6')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Visit Observatory' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resume 90-second judge tour' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Observatory' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('supports previous, reset, skip, replay, and completion transitions', () => {
    const onReset = vi.fn()
    renderShell({ onReset })

    fireEvent.click(screen.getByRole('button', { name: 'Start 90-second judge tour' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next: Observatory' }))
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
    expect(screen.getByRole('dialog', { name: 'Research Mission' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next: Observatory' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reset tour' }))
    expect(screen.getByRole('dialog', { name: 'Research Mission' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Skip tour' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Replay 90-second judge tour' }))
    expect(screen.getByRole('dialog', { name: 'Research Mission' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next: Observatory' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next: Evidence Lens' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next: Verification' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next: Flickr Workload Map' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next: Export' }))
    expect(screen.getByRole('dialog', { name: 'Export' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Finish tour' }))
    expect(screen.getByRole('button', { name: 'Replay 90-second judge tour' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reset replay' }))
    expect(onReset).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Start 90-second judge tour' })).toBeInTheDocument()
  })

  it('routes the Export step to its focusable dashboard target', async () => {
    render(
      <AppShell
        replay={replay}
        globalError={undefined}
        onReset={vi.fn()}
        renderView={(route) =>
          route.view === 'dashboard' ? (
            <section id="research-outputs" tabIndex={-1}>Export research outputs</section>
          ) : (
            <h2>{route.view} view</h2>
          )
        }
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Start 90-second judge tour' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next: Observatory' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next: Evidence Lens' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next: Verification' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next: Flickr Workload Map' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next: Export' }))
    fireEvent.click(screen.getByRole('button', { name: 'Visit Export' }))

    const exportTarget = screen.getByText('Export research outputs')
    await waitFor(() => expect(exportTarget).toHaveFocus())
    expect(screen.getByRole('button', { name: 'Replay 90-second judge tour' })).toBeInTheDocument()
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
