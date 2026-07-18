import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { GeographicImpactLens } from './GeographicImpactLens'
import { TAXALENS_GEOGRAPHIC_SCOPE_INDEX } from './geographicScope'

const TEST_COUNTRY = TAXALENS_GEOGRAPHIC_SCOPE_INDEX.byLevel.country[0]!
const TEST_CONTINENT = TAXALENS_GEOGRAPHIC_SCOPE_INDEX.byId.get(TEST_COUNTRY.parent_scope_id!)!

describe('GeographicBreadcrumbs', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', `/#dashboard?geo=${encodeURIComponent(TEST_COUNTRY.scope_id)}`)
  })

  it('explains the complete hierarchy and makes only ancestors interactive', () => {
    render(<GeographicImpactLens webGlSupported={false} />)
    const navigation = screen.getByRole('navigation', { name: 'Geographic breadcrumb' })

    expect(within(navigation).getAllByRole('listitem')).toHaveLength(3)
    expect(within(navigation).getByRole('button', { name: 'Global' })).toBeInTheDocument()
    expect(within(navigation).getByRole('button', { name: TEST_CONTINENT.scope_name })).toBeInTheDocument()
    expect(within(navigation).queryByRole('button', { name: TEST_COUNTRY.scope_name })).not.toBeInTheDocument()
    expect(within(navigation).getByText(TEST_COUNTRY.scope_name)).toHaveAttribute('aria-current', 'page')
  })

  it('uses the shared semantic transition when an ancestor is selected', () => {
    render(<GeographicImpactLens webGlSupported={false} />)
    const navigation = screen.getByRole('navigation', { name: 'Geographic breadcrumb' })

    fireEvent.click(within(navigation).getByRole('button', { name: TEST_CONTINENT.scope_name }))
    expect(window.location.hash).toBe(`#dashboard?geo=${encodeURIComponent(TEST_CONTINENT.scope_id)}`)
    expect(within(navigation).getAllByRole('listitem')).toHaveLength(2)
    expect(within(navigation).getByText(TEST_CONTINENT.scope_name)).toHaveAttribute('aria-current', 'page')

    fireEvent.click(within(navigation).getByRole('button', { name: 'Global' }))
    expect(window.location.hash).toBe('#dashboard')
    expect(within(navigation).getByText('Global')).toHaveAttribute('aria-current', 'page')
  })
})
