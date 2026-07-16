import { describe, expect, it } from 'vitest'

import {
  HUMAN_REVIEW_CAMPAIGN,
  HUMAN_REVIEW_ITEMS,
} from '../reviewPacket'
import {
  VERIFICATION_EVENT_SCHEMA_VERSION,
  type VerificationEvent,
} from '../domain/verificationEvents'
import {
  mapReferenceReviewEventsToBioMinerRows,
  REFERENCE_REVIEW_DECISION_IMPORT_SCHEMA_VERSION,
} from './referenceDecisionImport'

const [fixtureItem] = HUMAN_REVIEW_ITEMS
if (fixtureItem === undefined) {
  throw new Error('Reference decision export tests require one fixture item.')
}

const campaign = Object.freeze({
  ...HUMAN_REVIEW_CAMPAIGN,
  campaignId: 'biominer-reference-export-test',
  manifestSha256: 'a'.repeat(64),
  questionFingerprint: 'b'.repeat(64),
  biominerSha: 'c'.repeat(40),
  publicReplay: false,
})

const item = Object.freeze({
  ...fixtureItem,
  itemId: `reference-review-request:${'d'.repeat(64)}`,
  campaignId: campaign.campaignId,
  source: 'gbif' as const,
  sourceMediaId: `reference-media:${'e'.repeat(64)}`,
  imageSha256: 'f'.repeat(64),
  questionFingerprint: campaign.questionFingerprint,
  expectedLifeStage: 'adult' as const,
  expectedVisualDomain: 'live_field' as const,
  expectedView: 'dorsal' as const,
})

function event(
  overrides: Partial<VerificationEvent> = {},
): VerificationEvent {
  return Object.freeze({
    schemaVersion: VERIFICATION_EVENT_SCHEMA_VERSION,
    eventId: 'event-1',
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
    ...overrides,
  })
}

describe('browser BioMiner reference decision mapper', () => {
  it('maps immutable scientific rounds and omits media failures', () => {
    const first = event()
    const second = event({
      eventId: 'event-2',
      reviewRound: 2,
      outcome: 'no',
      comment: 'Wing pattern contradicts the target.',
      correctedLifeStage: 'larva',
      correctedVisualDomain: 'unsuitable',
      correctedView: 'ventral',
      exclusionReason: 'Incorrect target identity.',
      confidence: 'high',
      reviewedAt: '2026-07-16T17:01:00.000Z',
      supersedesEventId: first.eventId,
      conflictsWithDecisionId: `reference-review-decision:${'1'.repeat(64)}`,
    })
    const rows = mapReferenceReviewEventsToBioMinerRows(
      campaign,
      [item],
      [
        first,
        second,
        event({
          eventId: 'event-media-failure',
          reviewerId: 'reviewer-b',
          outcome: 'cant_view',
          confidence: 'unknown',
          reviewedAt: '2026-07-16T17:02:00.000Z',
        }),
      ],
    )

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      import_schema_version:
        REFERENCE_REVIEW_DECISION_IMPORT_SCHEMA_VERSION,
      review_request_id: item.itemId,
      reference_media_id: item.sourceMediaId,
      review_round: 1,
      verified_by: 'reviewer-a',
      target_identity_verified: true,
      verification_status: 'verified',
      life_stage: 'adult',
      visual_domain: 'live_field',
      view: 'dorsal',
      review_confidence: 'medium',
      review_notes: null,
      exclusion_reason: null,
      conflicts_with_decision_id: null,
    })
    expect(rows[1]).toMatchObject({
      review_round: 2,
      target_identity_verified: false,
      verification_status: 'excluded',
      life_stage: 'larva',
      visual_domain: 'unsuitable',
      view: 'ventral',
      exclusion_reason: 'Incorrect target identity.',
      conflicts_with_decision_id: `reference-review-decision:${'1'.repeat(64)}`,
    })
  })

  it('rejects campaigns without BioMiner source binding', () => {
    expect(() =>
      mapReferenceReviewEventsToBioMinerRows(
        { ...campaign, biominerSha: null },
        [item],
        [event()],
      ),
    ).toThrow('Campaign is not bound to a BioMiner reference review queue.')
  })
})
