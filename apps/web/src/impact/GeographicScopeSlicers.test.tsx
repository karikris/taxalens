import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { GeographicImpactLens } from './GeographicImpactLens'
import { TAXALENS_GEOGRAPHIC_SCOPE_INDEX } from './geographicScope'

const TEST_COUNTRY = TAXALENS_GEOGRAPHIC_SCOPE_INDEX.byLevel.country[0]!
const TEST_CONTINENT = TAXALENS_GEOGRAPHIC_SCOPE_INDEX.byId.get(TEST_COUNTRY.parent_scope_id!)!
const OTHER_CONTINENT = TAXALENS_GEOGRAPHIC_SCOPE_INDEX.byLevel.continent.find(
  ({ scope_id }) => scope_id !== TEST_CONTINENT.scope_id,
)!
const OTHER_COUNTRY = TAXALENS_GEOGRAPHIC_SCOPE_INDEX.byLevel.country.find(
  ({ parent_scope_id }) => parent_scope_id === OTHER_CONTINENT.scope_id,
)!

describe('GeographicScopeSlicers', () => {
  beforeEach(() => window.history.replaceState(null, '', '/#dashboard'))

  it('starts at Global and blocks an unscoped country choice', () => {
    render(<GeographicImpactLens webGlSupported={false} />)

    expect(screen.getByRole('combobox', { name: 'Continent' })).toHaveValue('global')
    expect(screen.getByRole('combobox', { name: 'Country' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Reset to Global' })).toBeDisabled()
  })

  it('limits countries to the selected continent and clears finer scope', () => {
    render(<GeographicImpactLens webGlSupported={false} />)
    const continent = screen.getByRole('combobox', { name: 'Continent' })
    const country = screen.getByRole('combobox', { name: 'Country' })

    fireEvent.change(continent, { target: { value: TEST_CONTINENT.scope_id } })
    expect(window.location.hash).toBe(`#dashboard?geo=${encodeURIComponent(TEST_CONTINENT.scope_id)}`)
    expect(country).toBeEnabled()
    expect(country).toHaveValue(TEST_CONTINENT.scope_id)
    expect(within(country).getByRole('option', { name: TEST_COUNTRY.scope_name })).toBeInTheDocument()
    expect(within(country).queryByRole('option', { name: OTHER_COUNTRY.scope_name })).not.toBeInTheDocument()

    fireEvent.change(country, { target: { value: TEST_COUNTRY.scope_id } })
    expect(window.location.hash).toBe(`#dashboard?geo=${encodeURIComponent(TEST_COUNTRY.scope_id)}`)
    expect(screen.getByText(TEST_COUNTRY.scope_name, { selector: 'strong' })).toBeInTheDocument()

    fireEvent.change(continent, { target: { value: OTHER_CONTINENT.scope_id } })
    expect(country).toHaveValue(OTHER_CONTINENT.scope_id)
    expect(within(country).queryByRole('option', { name: TEST_COUNTRY.scope_name })).not.toBeInTheDocument()
  })

  it('derives both controls from a country deep link and resets once', () => {
    window.history.replaceState(null, '', `/#dashboard?geo=${encodeURIComponent(TEST_COUNTRY.scope_id)}`)
    render(<GeographicImpactLens webGlSupported={false} />)

    expect(screen.getByRole('combobox', { name: 'Continent' }))
      .toHaveValue(TEST_CONTINENT.scope_id)
    expect(screen.getByRole('combobox', { name: 'Country' })).toHaveValue(TEST_COUNTRY.scope_id)

    fireEvent.click(screen.getByRole('button', { name: 'Reset to Global' }))
    expect(window.location.hash).toBe('#dashboard')
    expect(screen.getByRole('combobox', { name: 'Country' })).toBeDisabled()
  })
})
