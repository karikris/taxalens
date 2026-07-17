import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { GeographicImpactLens } from './GeographicImpactLens'

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

    fireEvent.change(continent, { target: { value: 'continent:asia' } })
    expect(window.location.hash).toBe('#dashboard?geo=continent%3Aasia')
    expect(country).toBeEnabled()
    expect(country).toHaveValue('continent:asia')
    expect(screen.getByRole('option', { name: 'India' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Australia' })).not.toBeInTheDocument()

    fireEvent.change(country, { target: { value: 'country:IN' } })
    expect(window.location.hash).toBe('#dashboard?geo=country%3AIN')
    expect(screen.getByText('India', { selector: 'strong' })).toBeInTheDocument()

    fireEvent.change(continent, { target: { value: 'continent:oceania' } })
    expect(country).toHaveValue('continent:oceania')
    expect(screen.queryByRole('option', { name: 'India' })).not.toBeInTheDocument()
  })

  it('derives both controls from a country deep link and resets once', () => {
    window.history.replaceState(null, '', '/#dashboard?geo=country%3AIN')
    render(<GeographicImpactLens webGlSupported={false} />)

    expect(screen.getByRole('combobox', { name: 'Continent' }))
      .toHaveValue('continent:asia')
    expect(screen.getByRole('combobox', { name: 'Country' })).toHaveValue('country:IN')

    fireEvent.click(screen.getByRole('button', { name: 'Reset to Global' }))
    expect(window.location.hash).toBe('#dashboard')
    expect(screen.getByRole('combobox', { name: 'Country' })).toBeDisabled()
  })
})
