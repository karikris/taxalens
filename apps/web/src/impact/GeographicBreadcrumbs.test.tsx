import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { GeographicImpactLens } from './GeographicImpactLens'

describe('GeographicBreadcrumbs', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/#dashboard?geo=country%3AIN')
  })

  it('explains the complete hierarchy and makes only ancestors interactive', () => {
    render(<GeographicImpactLens webGlSupported={false} />)
    const navigation = screen.getByRole('navigation', { name: 'Geographic breadcrumb' })

    expect(within(navigation).getAllByRole('listitem')).toHaveLength(3)
    expect(within(navigation).getByRole('button', { name: 'Global' })).toBeInTheDocument()
    expect(within(navigation).getByRole('button', { name: 'Asia' })).toBeInTheDocument()
    expect(within(navigation).queryByRole('button', { name: 'India' })).not.toBeInTheDocument()
    expect(within(navigation).getByText('India')).toHaveAttribute('aria-current', 'page')
  })

  it('uses the shared semantic transition when an ancestor is selected', () => {
    render(<GeographicImpactLens webGlSupported={false} />)
    const navigation = screen.getByRole('navigation', { name: 'Geographic breadcrumb' })

    fireEvent.click(within(navigation).getByRole('button', { name: 'Asia' }))
    expect(window.location.hash).toBe('#dashboard?geo=continent%3Aasia')
    expect(within(navigation).getAllByRole('listitem')).toHaveLength(2)
    expect(within(navigation).getByText('Asia')).toHaveAttribute('aria-current', 'page')

    fireEvent.click(within(navigation).getByRole('button', { name: 'Global' }))
    expect(window.location.hash).toBe('#dashboard')
    expect(within(navigation).getByText('Global')).toHaveAttribute('aria-current', 'page')
  })
})
