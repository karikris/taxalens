import { describe, expect, it } from 'vitest'

import {
  HUMAN_REVIEW_CAMPAIGN,
  HUMAN_REVIEW_ITEMS,
} from './reviewPacket'
import {
  VERIFICATION_EVENT_SCHEMA_VERSION,
  projectCurrentVerificationEvents,
  validateVerificationEvent,
  type VerificationEvent,
} from './verificationEvents'

describe('append-only verification event contract', () => {
  it('binds a decision to reviewer, media, question, manifest, and source revisions', () => {
    const item = HUMAN_REVIEW_ITEMS[0]
    expect(item).toBeDefined()
    const event: VerificationEvent = {
      schemaVersion: VERIFICATION_EVENT_SCHEMA_VERSION,
      eventId: 'event-1',
      campaignId: HUMAN_REVIEW_CAMPAIGN.campaignId,
      itemId: item!.itemId,
      reviewerId: 'reviewer-a',
      reviewRound: 1,
      outcome: 'yes',
      comment: null,
      alternativeTaxon: null,
      correctedLifeStage: null,
      correctedVisualDomain: null,
      correctedView: null,
      mediaQuality: 'high',
      duplicateConcern: false,
      captiveOrCultivatedConcern: false,
      exclusionReason: null,
      confidence: 'high',
      reviewedAt: '2026-07-16T15:00:00.000Z',
      durationMs: 1_250,
      imageSha256: item!.imageSha256,
      questionSha256: item!.questionFingerprint,
      campaignManifestSha256: HUMAN_REVIEW_CAMPAIGN.manifestSha256,
      taxalensSha: HUMAN_REVIEW_CAMPAIGN.taxalensSha,
      biominerSha: HUMAN_REVIEW_CAMPAIGN.biominerSha,
      supersedesEventId: null,
    }

    expect(
      validateVerificationEvent(event, HUMAN_REVIEW_CAMPAIGN, item!),
    ).toEqual([])
  })

  it('rejects mutable identity drift and invalid review sequencing', () => {
    const item = HUMAN_REVIEW_ITEMS[0]
    expect(item).toBeDefined()
    const event: VerificationEvent = {
      schemaVersion: VERIFICATION_EVENT_SCHEMA_VERSION,
      eventId: 'event-2',
      campaignId: HUMAN_REVIEW_CAMPAIGN.campaignId,
      itemId: item!.itemId,
      reviewerId: '',
      reviewRound: 0,
      outcome: 'no',
      comment: 'Not the expected species.',
      alternativeTaxon: null,
      correctedLifeStage: null,
      correctedVisualDomain: null,
      correctedView: null,
      mediaQuality: 'medium',
      duplicateConcern: false,
      captiveOrCultivatedConcern: false,
      exclusionReason: null,
      confidence: 'medium',
      reviewedAt: '2026-07-16T15:00:00Z',
      durationMs: -1,
      imageSha256: '0'.repeat(64),
      questionSha256: item!.questionFingerprint,
      campaignManifestSha256: HUMAN_REVIEW_CAMPAIGN.manifestSha256,
      taxalensSha: HUMAN_REVIEW_CAMPAIGN.taxalensSha,
      biominerSha: HUMAN_REVIEW_CAMPAIGN.biominerSha,
      supersedesEventId: 'event-2',
    }

    expect(
      validateVerificationEvent(event, HUMAN_REVIEW_CAMPAIGN, item!),
    ).toEqual([
      'reviewRound must be a positive integer',
      'reviewedAt must be a normalized UTC instant',
      'durationMs must be null or a non-negative integer',
      'event image SHA-256 does not match the item',
      'an event cannot supersede itself',
    ])
  })

  it('projects the same current event regardless of ledger read order', () => {
    const item = HUMAN_REVIEW_ITEMS[0]
    expect(item).toBeDefined()
    const first = verificationEvent({
      eventId: 'event-projection-1',
      itemId: item!.itemId,
      reviewedAt: '2026-07-16T15:20:00.000Z',
      reviewRound: 1,
      supersedesEventId: null,
    })
    const second = verificationEvent({
      eventId: 'event-projection-2',
      itemId: item!.itemId,
      reviewedAt: '2026-07-16T15:21:00.000Z',
      reviewRound: 2,
      supersedesEventId: first.eventId,
    })

    expect(
      projectCurrentVerificationEvents([first, second])[item!.itemId]?.eventId,
    ).toBe(second.eventId)
    expect(
      projectCurrentVerificationEvents([second, first])[item!.itemId]?.eventId,
    ).toBe(second.eventId)
  })
})

function verificationEvent({
  eventId,
  itemId,
  reviewedAt,
  reviewRound,
  supersedesEventId,
}: {
  readonly eventId: string
  readonly itemId: string
  readonly reviewedAt: string
  readonly reviewRound: number
  readonly supersedesEventId: string | null
}): VerificationEvent {
  const item = HUMAN_REVIEW_ITEMS.find(
    (candidate) => candidate.itemId === itemId,
  )
  if (item === undefined) {
    throw new Error(`Unknown verification item: ${itemId}`)
  }
  return Object.freeze({
    schemaVersion: VERIFICATION_EVENT_SCHEMA_VERSION,
    eventId,
    campaignId: HUMAN_REVIEW_CAMPAIGN.campaignId,
    itemId,
    reviewerId: 'reviewer-a',
    reviewRound,
    outcome: reviewRound === 1 ? 'yes' : 'no',
    comment: null,
    alternativeTaxon: null,
    correctedLifeStage: null,
    correctedVisualDomain: null,
    correctedView: null,
    mediaQuality: 'unknown',
    duplicateConcern: false,
    captiveOrCultivatedConcern: false,
    exclusionReason: null,
    confidence: 'unknown',
    reviewedAt,
    durationMs: null,
    imageSha256: item.imageSha256,
    questionSha256: item.questionFingerprint,
    campaignManifestSha256: HUMAN_REVIEW_CAMPAIGN.manifestSha256,
    taxalensSha: HUMAN_REVIEW_CAMPAIGN.taxalensSha,
    biominerSha: HUMAN_REVIEW_CAMPAIGN.biominerSha,
    supersedesEventId,
  })
}
