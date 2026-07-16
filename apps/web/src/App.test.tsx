import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { App } from './App'
import {
  HUMAN_REVIEW_CAMPAIGN,
  HUMAN_REVIEW_ITEMS,
} from './review'
import { createCommittedFixtureFetcher, jsonResponse } from './test/fixtures'

describe('TaxaLens scaffold', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
    vi.stubGlobal('fetch', vi.fn(createCommittedFixtureFetcher()))
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

    expect(await screen.findByText('25 / 25 verified')).toBeInTheDocument()
    expect(screen.getByText('Inventory and payload verified')).toBeInTheDocument()

    window.location.hash = '#dashboard'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    expect(
      await screen.findByRole('heading', { name: 'Verified local data boundary' }),
    ).toBeInTheDocument()
    expect(screen.getByText('analytics on demand')).toBeInTheDocument()
  })

  it('opens the stored Agent Trace without simulating a live session', async () => {
    window.location.hash = '#agent'
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: 'GPT-5.6 Sol research analyst' }),
    ).toBeInTheDocument()
    expect(screen.getByText('gpt-5.6-sol')).toBeInTheDocument()
    expect(
      await screen.findByRole('heading', { name: 'Replayed analyst session' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Stored output · no live call')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'resolve_taxon' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Answer' })).toBeInTheDocument()
    expect(screen.getAllByText(/This target resolution is not an occurrence/u)).toHaveLength(2)
    expect(screen.queryByRole('heading', { name: 'No analyst session loaded' })).not.toBeInTheDocument()
    expect(screen.getByText(/chain-of-thought are neither collected/u)).toBeInTheDocument()
  })

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
      await screen.findByRole('heading', {
        name: 'Papilio demoleus Flickr candidate intake',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('tab', { name: 'Flickr Results' }),
    ).toHaveAttribute('aria-selected', 'true')
    expect(
      screen.getByText('Flickr candidate review media is unavailable'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Return to Evidence Lens' }),
    ).toHaveAttribute('href', '#evidence-lens')
  })

  it('renders an assertive local-load failure with an accessible retry action', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, 404)))

    render(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent('returned HTTP 404')
    expect(screen.getByRole('button', { name: 'Retry local load' })).toBeInTheDocument()
  })
})
