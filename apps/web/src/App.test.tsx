import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { App } from './App'
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

  it('shows complete checksum verification and the deterministic JSON fallback', async () => {
    window.location.hash = '#observatory'
    render(<App />)

    expect(await screen.findByText('17 / 17 verified')).toBeInTheDocument()
    expect(screen.getByText('Inventory and payload verified')).toBeInTheDocument()

    window.location.hash = '#dashboard'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    expect(await screen.findByRole('heading', { name: 'Verified JSON fallback' })).toBeInTheDocument()
    expect(screen.getByText('parquet unavailable')).toBeInTheDocument()
  })

  it('renders an assertive local-load failure with an accessible retry action', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, 404)))

    render(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent('returned HTTP 404')
    expect(screen.getByRole('button', { name: 'Retry local load' })).toBeInTheDocument()
  })
})
