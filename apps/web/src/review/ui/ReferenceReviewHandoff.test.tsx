import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  HUMAN_REVIEW_CAMPAIGN,
  HUMAN_REVIEW_ITEMS,
} from '../reviewPacket'
import {
  VERIFICATION_EVENT_SCHEMA_VERSION,
  type VerificationEvent,
} from '../domain/verificationEvents'
import { ReferenceReviewHandoff } from './ReferenceReviewHandoff'

const [fixtureItem] = HUMAN_REVIEW_ITEMS
if (fixtureItem === undefined) {
  throw new Error('Reference handoff tests require one fixture item.')
}

describe('ReferenceReviewHandoff', () => {
  it('labels the public replay boundary and disables the Commons handoff', () => {
    render(
      <ReferenceReviewHandoff
        campaign={HUMAN_REVIEW_CAMPAIGN}
        events={[]}
        items={HUMAN_REVIEW_ITEMS}
      />,
    )

    expect(
      screen.getByText(
        'Prepared for BioMiner import; not imported in the public replay.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'This credential-free Commons campaign is separate from a BioMiner review queue.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Export BioMiner handoff' }),
    ).toBeDisabled()
  })

  it('prepares and downloads a bound local handoff after an explicit click', async () => {
    const campaign = {
      ...HUMAN_REVIEW_CAMPAIGN,
      campaignId: 'biominer-reference-handoff-test',
      manifestSha256: 'a'.repeat(64),
      questionFingerprint: 'b'.repeat(64),
      biominerSha: 'c'.repeat(40),
      publicReplay: false,
    }
    const item = {
      ...fixtureItem,
      itemId: `reference-review-request:${'d'.repeat(64)}`,
      campaignId: campaign.campaignId,
      source: 'gbif' as const,
      sourceMediaId: `reference-media:${'e'.repeat(64)}`,
      imageSha256: 'f'.repeat(64),
      questionFingerprint: campaign.questionFingerprint,
    }
    const event: VerificationEvent = {
      schemaVersion: VERIFICATION_EVENT_SCHEMA_VERSION,
      eventId: 'event-download',
      campaignId: campaign.campaignId,
      itemId: item.itemId,
      reviewerId: 'reviewer-a',
      reviewRound: 1,
      outcome: 'yes',
      comment: null,
      nonTargetCategory: null,
      alternativeTaxon: null,
      correctedLifeStage: null,
      correctedVisualDomain: null,
      correctedView: null,
      mediaQuality: 'unknown',
      duplicateConcern: false,
      captiveOrCultivatedConcern: false,
      exclusionReason: null,
      confidence: 'medium',
      reviewedAt: '2026-07-16T17:00:00.000Z',
      durationMs: 1_000,
      imageSha256: item.imageSha256,
      questionSha256: item.questionFingerprint,
      campaignManifestSha256: campaign.manifestSha256,
      taxalensSha: campaign.taxalensSha,
      biominerSha: campaign.biominerSha,
      supersedesEventId: null,
      conflictsWithDecisionId: null,
    }
    const file = {
      filename: 'reference_review_decision_import.parquet' as const,
      mediaType: 'application/vnd.apache.parquet' as const,
      bytes: new Uint8Array([80, 65, 82, 49]),
      sha256: '1'.repeat(64),
      rowCount: 1,
    }
    const prepare = vi.fn().mockResolvedValue(file)
    const download = vi.fn()
    render(
      <ReferenceReviewHandoff
        campaign={campaign}
        download={download}
        events={[event]}
        items={[item]}
        prepare={prepare}
      />,
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'Export BioMiner handoff' }),
    )

    await waitFor(() => expect(download).toHaveBeenCalledWith(file))
    expect(prepare).toHaveBeenCalledWith(campaign, [item], [event])
    expect(
      screen.getByText(/Downloaded 1 decision row/u),
    ).toBeInTheDocument()
    expect(screen.getByText('1'.repeat(64))).toBeInTheDocument()
  })
})
