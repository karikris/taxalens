import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ImageComparison } from './ImageComparison'

describe('ImageComparison', () => {
  it('provides labelled images, textual position, and keyboard slider semantics', () => {
    render(
      <ImageComparison
        title="Full-frame transformation comparison"
        before={{ src: '/before.png', alt: 'Unmodified licensed source frame' }}
        after={{ src: '/after.png', alt: 'Deterministically transformed full frame' }}
        caption="Transformation parameters are recorded with the artifact."
        initialPosition={50}
      />,
    )

    expect(screen.getByRole('img', { name: 'Unmodified licensed source frame' })).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: 'Deterministically transformed full frame' }),
    ).toBeInTheDocument()
    expect(screen.getByText('50% after image revealed')).toBeInTheDocument()

    const slider = screen.getByRole('slider', { name: 'Reveal after image' })
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(screen.getByText('51% after image revealed')).toBeInTheDocument()
  })
})
