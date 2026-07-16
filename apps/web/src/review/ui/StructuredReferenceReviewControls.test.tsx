import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  EMPTY_REFERENCE_REVIEW_ANNOTATION_DRAFT,
  referenceReviewEventFields,
  StructuredReferenceReviewControls,
  validateReferenceReviewAnnotationDraft,
} from './StructuredReferenceReviewControls'

describe('StructuredReferenceReviewControls', () => {
  it('captures every structured reference annotation control', () => {
    const onChange = vi.fn()
    render(
      <StructuredReferenceReviewControls
        draft={EMPTY_REFERENCE_REVIEW_ANNOTATION_DRAFT}
        onChange={onChange}
      />,
    )

    fireEvent.click(
      screen.getByText('Structured reference annotations'),
    )
    fireEvent.change(screen.getByLabelText('Corrected life stage'), {
      target: { value: 'larva' },
    })
    fireEvent.change(screen.getByLabelText('Corrected visual domain'), {
      target: { value: 'pinned_specimen' },
    })
    fireEvent.change(screen.getByLabelText('Corrected view'), {
      target: { value: 'ventral' },
    })
    fireEvent.change(screen.getByLabelText('Media quality'), {
      target: { value: 'low' },
    })
    fireEvent.click(screen.getByLabelText('Duplicate concern'))
    fireEvent.click(
      screen.getByLabelText('Captive or cultivated concern'),
    )
    fireEvent.change(
      screen.getByLabelText('Alternative accepted taxon key'),
      { target: { value: 'gbif:1234567' } },
    )
    fireEvent.change(screen.getByLabelText('Alternative scientific name'), {
      target: { value: 'Papilio polytes' },
    })
    fireEvent.change(screen.getByLabelText('Exclusion reason'), {
      target: { value: 'Wrong identity.' },
    })
    fireEvent.change(screen.getByLabelText('Confidence'), {
      target: { value: 'high' },
    })

    expect(onChange).toHaveBeenCalledTimes(10)
  })

  it('validates alternative species and strips annotations from non-scientific outcomes', () => {
    const incomplete = {
      ...EMPTY_REFERENCE_REVIEW_ANNOTATION_DRAFT,
      alternativeAcceptedTaxonKey: 'gbif:1234567',
    }
    expect(validateReferenceReviewAnnotationDraft(incomplete)).toEqual([
      'Alternative species requires both an accepted taxon key and scientific name.',
    ])

    const annotated = {
      ...incomplete,
      alternativeScientificName: 'Papilio polytes',
      correctedLifeStage: 'larva' as const,
      correctedVisualDomain: 'live_field' as const,
      correctedView: 'ventral' as const,
      mediaQuality: 'low' as const,
      duplicateConcern: true,
      captiveOrCultivatedConcern: true,
      exclusionReason: 'Wrong identity.',
      confidence: 'high' as const,
    }
    expect(referenceReviewEventFields(annotated, 'no')).toMatchObject({
      alternativeTaxon: {
        acceptedTaxonKey: 'gbif:1234567',
        scientificName: 'Papilio polytes',
      },
      correctedLifeStage: 'larva',
      correctedVisualDomain: 'live_field',
      correctedView: 'ventral',
      mediaQuality: 'low',
      duplicateConcern: true,
      captiveOrCultivatedConcern: true,
      exclusionReason: 'Wrong identity.',
      confidence: 'high',
    })
    expect(referenceReviewEventFields(annotated, 'cant_view')).toEqual({
      alternativeTaxon: null,
      correctedLifeStage: null,
      correctedVisualDomain: null,
      correctedView: null,
      mediaQuality: 'unknown',
      duplicateConcern: false,
      captiveOrCultivatedConcern: false,
      exclusionReason: null,
      confidence: 'unknown',
    })
  })
})
