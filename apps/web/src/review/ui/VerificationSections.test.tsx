import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { VerificationSections } from './VerificationSections'

describe('VerificationSections', () => {
  it('exposes all product sections and defaults to the active reference workflow', () => {
    render(
      <VerificationSections
        referenceImages={<p>Reference campaign workspace</p>}
      />,
    )

    const flickr = screen.getByRole('tab', { name: 'Flickr Results' })
    const reference = screen.getByRole('tab', { name: 'Reference Images' })
    const conflicts = screen.getByRole('tab', { name: 'Conflicts' })
    const quality = screen.getByRole('tab', { name: 'Quality' })
    expect([flickr, reference, conflicts, quality]).toHaveLength(4)
    expect(reference).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Reference campaign workspace')).toBeVisible()
  })

  it('supports keyboard navigation and keeps unavailable sections honest', () => {
    render(
      <VerificationSections
        referenceImages={<p>Reference campaign workspace</p>}
      />,
    )

    const reference = screen.getByRole('tab', { name: 'Reference Images' })
    reference.focus()
    fireEvent.keyDown(reference, { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: 'Conflicts' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(
      screen.getByText('No unresolved conflicts'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Quality' }))
    expect(
      screen.getByText('Quality estimates are not available'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Flickr Results' }))
    expect(
      screen.getByText('No Flickr verification campaign is attached yet'),
    ).toBeInTheDocument()
  })

  it('opens routed Flickr candidate context in the Flickr section', () => {
    render(
      <VerificationSections
        defaultSection="flickr-results"
        flickrResults={<p>Routed Flickr candidate</p>}
        referenceImages={<p>Reference campaign workspace</p>}
      />,
    )

    expect(
      screen.getByRole('tab', { name: 'Flickr Results' }),
    ).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Routed Flickr candidate')).toBeVisible()
  })
})
