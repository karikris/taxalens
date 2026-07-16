import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import {
  EMPTY_FLICKR_NON_TARGET_OUTCOME_DRAFT,
  type FlickrNonTargetOutcomeDraft,
} from '../domain'
import { FlickrNonTargetOutcomeControls } from './FlickrNonTargetOutcomeControls'

function Harness() {
  const [draft, setDraft] = useState<FlickrNonTargetOutcomeDraft>(
    EMPTY_FLICKR_NON_TARGET_OUTCOME_DRAFT,
  )
  return <FlickrNonTargetOutcomeControls draft={draft} onChange={setDraft} />
}

describe('Flickr non-target outcome controls', () => {
  it('offers all seven requested No outcomes and named alternative fields', () => {
    render(<Harness />)

    expect(
      screen.getByRole('radiogroup', {
        name: 'Flickr non-target outcome',
      }),
    ).toBeInTheDocument()
    for (const label of [
      'Alternative species',
      'Other butterfly',
      'Other insect',
      'Artifact',
      'Specimen',
      'No organism',
      'Insufficient visual detail',
    ]) {
      expect(screen.getByRole('radio', { name: label })).toBeInTheDocument()
    }

    fireEvent.click(
      screen.getByRole('radio', { name: 'Alternative species' }),
    )
    expect(
      screen.getByRole('textbox', { name: 'Accepted taxon key' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('textbox', { name: 'Scientific name' }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: 'Artifact' }))
    expect(
      screen.queryByRole('textbox', { name: 'Accepted taxon key' }),
    ).not.toBeInTheDocument()
  })
})
