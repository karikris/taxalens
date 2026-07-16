import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { RevealedFlickrReviewContext } from '../domain'
import { FlickrPostDecisionEvidencePanel } from './FlickrPostDecisionEvidence'

const context: RevealedFlickrReviewContext = {
  mode: 'revealed',
  decisionRecorded: true,
  humanDecision: {
    eventId: 'local-review-event:flickr:1',
    outcome: 'yes',
    reviewedAt: '2026-07-16T12:00:00.000Z',
  },
  targetQuestion: 'Does this image show Papilio demoleus?',
  modelResult: {
    targetScoreBand: 'high',
    decisionState: 'target',
    competitorMarginBand: 'near_tie',
    valuesAreProbabilities: false,
  },
  strongestCompetitors: [
    {
      acceptedTaxonKey: 'gbif:1938224',
      scientificName: 'Papilio polytes',
      scoreBand: 'middle',
      evidenceFingerprint: `sha256:${'4'.repeat(64)}`,
    },
  ],
  references: [
    {
      referenceId: 'reference:1',
      acceptedTaxonKey: 'gbif:1938069',
      scientificName: 'Papilio demoleus',
      role: 'target',
      provider: 'gbif',
      reviewState: 'provider_supported',
    },
  ],
  geography: {
    geographicClusterId: 'geo:sydney',
    latitude: -33.86,
    longitude: 151.21,
    outlier: true,
  },
  comments: [{ commentId: 'comment:1', text: 'Possible lime butterfly.' }],
  decisionReason: 'Target score exceeded the raw-margin policy.',
  sourceContext: {
    sourceUri: 'https://www.flickr.com/photos/example/1',
    queryTerm: 'Papilio demoleus',
    queryTier: 'scientific_name:high:text',
    queryTrustTier: 'high',
    providerSuppliedIdentity: {
      providerTaxonKey: null,
      scientificName: null,
      commonName: null,
      rawLabel: null,
      verificationStatus: null,
    },
  },
  releasedAfterDecision: [
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
  scientificClaimAllowed: false,
}

describe('Flickr post-decision evidence', () => {
  it('keeps evidence out of the DOM until the reviewer chooses reveal', () => {
    render(<FlickrPostDecisionEvidencePanel context={context} />)

    const reveal = screen.getByRole('button', {
      name: 'Reveal model and source evidence',
    })
    expect(reveal).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Papilio polytes')).not.toBeInTheDocument()
    expect(
      screen.queryByText('Possible lime butterfly.'),
    ).not.toBeInTheDocument()

    fireEvent.click(reveal)

    expect(
      screen.getByRole('button', {
        name: 'Hide model and source evidence',
      }),
    ).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/Papilio polytes/u)).toBeInTheDocument()
    expect(screen.getByText('Possible lime butterfly.')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Open source after decision' }),
    ).toHaveAttribute(
      'href',
      'https://www.flickr.com/photos/example/1',
    )
    expect(screen.getByText(/not probabilities/u)).toBeInTheDocument()
  })
})
