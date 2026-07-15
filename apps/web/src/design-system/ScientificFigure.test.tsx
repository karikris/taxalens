import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ScientificFigure } from './ScientificFigure'

describe('ScientificFigure', () => {
  it('binds title, prose description, evidence tier, and caption to the figure', () => {
    render(
      <ScientificFigure
        title="Reviewed observations by region"
        description="Bars represent reviewed records only."
        caption="Source: versioned evaluation artifact."
        tier="reviewed"
      >
        <div role="img" aria-label="Two labelled bars" />
      </ScientificFigure>,
    )

    const figure = screen.getByRole('figure', { name: 'Reviewed observations by region' })
    expect(figure).toHaveTextContent('Bars represent reviewed records only.')
    expect(figure).toHaveTextContent('Human-reviewed evidence')
    expect(figure).toHaveTextContent('Source: versioned evaluation artifact.')
    expect(screen.getByRole('img', { name: 'Two labelled bars' })).toBeInTheDocument()
  })
})
