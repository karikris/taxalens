import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { BlindFlickrReviewContext } from '../domain'
import {
  BlindFlickrReviewBoundary,
  FlickrBlindReviewContextPanel,
} from './FlickrBlindReviewContext'

const context: BlindFlickrReviewContext = {
  mode: 'blind',
  decisionRecorded: false,
  targetQuestion: 'Does this image show Papilio demoleus?',
  campaignPurpose: 'quality_estimation',
  reviewMedia: {
    previewUri: 'https://example.invalid/media.jpg',
    imageSha256: '1'.repeat(64),
    imageByteCount: 42_000,
    mediaType: 'image/jpeg',
  },
  routeExpectation: {
    lifeStage: 'adult',
    visualDomain: 'live_field',
    view: 'dorsal',
  },
  attribution: {
    creator: 'Review photographer',
    text: 'Review photographer / CC BY 4.0',
    licenseName: 'CC BY 4.0',
    licenseUri: 'https://creativecommons.org/licenses/by/4.0/',
  },
  sourcePageAvailable: false,
  hiddenBeforeDecision: [
    'target_score_band',
    'competitor_margin_band',
    'decision_state',
    'top_competitors',
    'flickr_comments',
    'query_term',
    'provider_supplied_identity',
    'query_trust_tier',
    'priority_signals',
  ],
}

describe('Flickr blind review context', () => {
  it('announces the blind decision boundary accessibly', () => {
    render(<FlickrBlindReviewContextPanel context={context} />)

    expect(
      screen.getByRole('heading', {
        name: 'Does this image show Papilio demoleus?',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'remains concealed until after an append-only decision',
    )
    const withheld = screen.getByRole('list', {
      name: 'Context withheld during blind Flickr review',
    })
    expect(within(withheld).getByText('BioCLIP result')).toBeInTheDocument()
    expect(
      within(withheld).getByText('Flickr comments and descriptions'),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /Flickr source/u }),
    ).not.toBeInTheDocument()
  })

  it('can explain the same boundary while media is unavailable', () => {
    render(<BlindFlickrReviewBoundary />)

    expect(
      screen.getByText(/source page is also unavailable before decision/u),
    ).toBeInTheDocument()
  })
})
