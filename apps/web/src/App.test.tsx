import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { App } from './App'
import {
  HUMAN_REVIEW_CAMPAIGN,
  HUMAN_REVIEW_ITEMS,
} from './review/reviewPacket'
import { createCommittedFixtureFetcher, jsonResponse } from './test/fixtures'

describe('TaxaLens scaffold', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
    vi.stubGlobal('fetch', vi.fn(createCommittedFixtureFetcher()))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders semantic landmarks and the truthful review state', async () => {
    render(<App />)

    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Skip to current view' })).toHaveAttribute(
      'href',
      '#main-content',
    )
    expect(
      await screen.findByRole('heading', { name: 'Papilio demoleus' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Awaiting human review')
    expect(screen.getByText(/It is not a classification of an image/u)).toBeInTheDocument()
    expect(screen.getByText(/no live backend/u)).toBeInTheDocument()
  })

  it('shows complete checksum verification and the on-demand analytics boundary', async () => {
    window.location.hash = '#observatory'
    render(<App />)

    expect(await screen.findByText('39 / 39 verified')).toBeInTheDocument()
    expect(screen.getByText('Inventory and payload verified')).toBeInTheDocument()

    window.location.hash = '#dashboard'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    expect(
      await screen.findByRole('heading', { name: 'Verified local data boundary' }),
    ).toBeInTheDocument()
    expect(screen.getByText('analytics on demand')).toBeInTheDocument()
  })

  it(
    'opens the stored Agent Trace without simulating a live session',
    async () => {
      window.location.hash = '#agent'
      render(<App />)

      expect(
        await screen.findByRole(
          'heading',
          { name: 'Configured model Sol research analyst' },
          { timeout: 5_000 },
        ),
      ).toBeInTheDocument()
      expect(screen.getByText('configured-model')).toBeInTheDocument()
      expect(
        await screen.findByRole('heading', { name: 'Replayed analyst session' }),
      ).toBeInTheDocument()
      expect(screen.getAllByText('Stored output · no live call')).toHaveLength(2)
      expect(
        screen.getByRole('heading', { name: 'Configured model geographic analyst' }),
      ).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'resolve_taxon' })).toBeInTheDocument()
      expect(
        screen.getByRole('heading', { name: 'Answer', level: 2 }),
      ).toBeInTheDocument()
      expect(screen.getAllByText(/This target resolution is not an occurrence/u)).toHaveLength(2)
      expect(
        screen.queryByRole('heading', { name: 'No analyst session loaded' }),
      ).not.toBeInTheDocument()
      expect(screen.getByText(/chain-of-thought are neither collected/u)).toBeInTheDocument()
    },
    10_000,
  )

  it('opens Verification from the legacy Human Review deep link', async () => {
    window.location.hash = '#human-review'
    render(<App />)

    expect(
      await screen.findByRole('heading', {
        name: 'Review the label, one image at a time',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Verification' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(
      screen.getByRole('tab', { name: 'Flickr Results' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('tab', { name: 'Reference Images' }),
    ).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Conflicts' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Quality' })).toBeInTheDocument()
    expect(window.location.hash).toBe('#verification')
  })

  it('selects a validated campaign item and preserves return context', async () => {
    const item = HUMAN_REVIEW_ITEMS[1]!
    const query = new URLSearchParams({
      campaign: HUMAN_REVIEW_CAMPAIGN.campaignId,
      item: item.itemId,
      return: 'evidence-lens',
    })
    window.history.replaceState(
      null,
      '',
      `/#verification?${query.toString()}`,
    )
    render(<App />)

    expect(
      await screen.findByRole('heading', {
        name: item.verificationLabel,
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('Image 2 of 3')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Return to Evidence Lens' }),
    ).toHaveAttribute('href', '#evidence-lens')
  })

  it('opens a routed Flickr candidate and preserves its Evidence Lens return', async () => {
    const query = new URLSearchParams({
      campaign: 'papilio-demoleus-flickr-candidate-intake-v1',
      item: 'flickr:55081300254',
      return: 'evidence-lens',
    })
    window.history.replaceState(
      null,
      '',
      `/#verification?${query.toString()}`,
    )
    render(<App />)

    expect(
      await screen.findByText('Exact Flickr result cannot be viewed yet'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('tab', { name: 'Flickr Results' }),
    ).toHaveAttribute('aria-selected', 'false')
    expect(
      screen.getByRole('tab', { name: 'Reference Images' }),
    ).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByRole('tab', { name: 'Flickr Results' }))
    expect(
      screen.getByRole('heading', {
        name: 'Papilio demoleus Flickr candidate intake',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Flickr candidate review media is unavailable'),
    ).toBeInTheDocument()
    expect(screen.getByText('Withheld before decision')).toBeInTheDocument()
    expect(
      screen.getByRole('list', {
        name: 'Context withheld during blind Flickr review',
      }),
    ).toHaveTextContent('BioCLIP result')
    expect(
      screen.getByRole('link', { name: 'Return to Evidence Lens' }),
    ).toHaveAttribute('href', '#evidence-lens')
  })

  it('returns a saved review event to Evidence Lens lineage', async () => {
    vi.stubGlobal('indexedDB', new IDBFactory())
    const item = HUMAN_REVIEW_ITEMS[0]!
    const query = new URLSearchParams({
      campaign: HUMAN_REVIEW_CAMPAIGN.campaignId,
      item: item.itemId,
      return: 'evidence-lens',
    })
    window.history.replaceState(
      null,
      '',
      `/#verification?${query.toString()}`,
    )
    render(<App />)

    const cantView = await screen.findByRole('button', {
      name: 'Can’t view',
    })
    await waitFor(() => expect(cantView).toBeEnabled())
    fireEvent.click(cantView)
    expect(
      await screen.findByText('Review event saved locally'),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('link', { name: 'Return to Evidence Lens' }),
    )
    window.history.pushState(null, '', '#evidence-lens')
    window.dispatchEvent(new HashChangeEvent('hashchange'))

    expect(
      await screen.findByRole('heading', {
        name: 'Local human verification evidence',
      }),
    ).toBeInTheDocument()
    expect(
      await screen.findByText(/1 recorded reviewer label/u),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('list', {
        name: 'Current human verification outcomes',
      }),
    ).toHaveTextContent('Can’t view')
    expect(
      screen.getByRole('list', { name: 'Evidence lifecycle ledger' }),
    ).toHaveTextContent('local-review-event')
  })

  it('renders an assertive local-load failure with an accessible retry action', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, 404)))

    render(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent('returned HTTP 404')
    expect(screen.getByRole('button', { name: 'Retry local load' })).toBeInTheDocument()
  })
})
