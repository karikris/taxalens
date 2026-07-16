import { describe, expect, it } from 'vitest'

import {
  HUMAN_REVIEW_CAMPAIGN,
  HUMAN_REVIEW_ITEMS,
} from '../reviewPacket'
import {
  VERIFICATION_EVENT_SCHEMA_VERSION,
  calculateVerificationCoverage,
  projectVerificationConsensus,
  validateVerificationCoverage,
  type HumanReviewInspection,
  type VerificationEvent,
  type VerificationItem,
} from '.'

describe('verification coverage', () => {
  it('classifies the committed three-image campaign without implying quality', () => {
    const [yesItem, uncertainItem, mediaFailureItem] = requiredItems()
    const events = [
      event(yesItem, 'event-yes', 'yes', '15:00'),
      event(uncertainItem, 'event-uncertain', 'cant_tell', '15:01'),
      event(mediaFailureItem, 'event-cant-view', 'cant_view', '15:02'),
    ]
    const consensus = projectVerificationConsensus(
      HUMAN_REVIEW_CAMPAIGN,
      HUMAN_REVIEW_ITEMS,
      events,
    )
    const inspections = Object.freeze({
      [yesItem.itemId]: inspection(yesItem, true, null),
      [uncertainItem.itemId]: inspection(uncertainItem, true, null),
      [mediaFailureItem.itemId]: inspection(
        mediaFailureItem,
        false,
        'The verified image could not be displayed.',
      ),
    })

    const coverage = calculateVerificationCoverage(
      HUMAN_REVIEW_ITEMS,
      consensus,
      inspections,
    )

    expect(coverage).toEqual({
      schemaVersion: 'taxalens-verification-coverage:v1.0.0',
      eligibleItems: 3,
      attemptedItems: 3,
      unattemptedItems: 0,
      decisivelyReviewedItems: 1,
      resolvedYesItems: 1,
      resolvedNoItems: 0,
      uncertainItems: 1,
      mediaFailureItems: 1,
      deferredItems: 0,
      pendingItems: 0,
      effectiveReviewCount: 3,
      decisiveReviewCount: 1,
      yesReviewCount: 1,
      noReviewCount: 0,
      cantTellReviewCount: 1,
      cantViewReviewCount: 1,
      skippedReviewCount: 0,
      inspectedItems: 3,
      viewableItems: 2,
      reviewCoverage: 1,
      inspectionCoverage: 1,
      viewabilityRate: 2 / 3,
    })
    expect(validateVerificationCoverage(coverage)).toEqual([])
  })

  it('keeps deferred, pending, attempted, and uninspected states separate', () => {
    const [deferredItem, pendingItem, noItem] = requiredItems()
    const events = [
      event(deferredItem, 'event-skip', 'skipped', '15:03'),
      event(noItem, 'event-no', 'no', '15:04'),
    ]
    const coverage = calculateVerificationCoverage(
      HUMAN_REVIEW_ITEMS,
      projectVerificationConsensus(
        HUMAN_REVIEW_CAMPAIGN,
        HUMAN_REVIEW_ITEMS,
        events,
      ),
      {},
    )

    expect(coverage).toMatchObject({
      eligibleItems: 3,
      attemptedItems: 2,
      unattemptedItems: 1,
      decisivelyReviewedItems: 1,
      resolvedYesItems: 0,
      resolvedNoItems: 1,
      uncertainItems: 0,
      mediaFailureItems: 0,
      deferredItems: 1,
      pendingItems: 1,
      decisiveReviewCount: 1,
      noReviewCount: 1,
      skippedReviewCount: 1,
      inspectedItems: 0,
      viewableItems: 0,
      reviewCoverage: 2 / 3,
      inspectionCoverage: 0,
      viewabilityRate: null,
    })
    expect(pendingItem.itemId).not.toBe('')
  })

  it('returns unavailable ratios only when their denominators are absent', () => {
    const coverage = calculateVerificationCoverage([], [], {})

    expect(coverage).toMatchObject({
      eligibleItems: 0,
      attemptedItems: 0,
      inspectedItems: 0,
      reviewCoverage: null,
      inspectionCoverage: null,
      viewabilityRate: null,
    })
  })

  it('rejects incomplete consensus and inspections outside the campaign', () => {
    const consensus = projectVerificationConsensus(
      HUMAN_REVIEW_CAMPAIGN,
      HUMAN_REVIEW_ITEMS,
      [],
    )

    expect(() =>
      calculateVerificationCoverage(
        HUMAN_REVIEW_ITEMS,
        consensus.slice(0, 2),
        {},
      ),
    ).toThrow(/consensus does not cover exactly/u)
    expect(() =>
      calculateVerificationCoverage(HUMAN_REVIEW_ITEMS, consensus, {
        'outside-item': {
          itemId: 'outside-item',
          imageOpened: true,
          imageVerified: true,
          imageOpenedAt: '2026-07-16T15:00:00.000Z',
          imageFailureReason: null,
        },
      }),
    ).toThrow(/inspection names an ineligible item/u)
  })
})

function requiredItems(): readonly [
  VerificationItem,
  VerificationItem,
  VerificationItem,
] {
  const [first, second, third] = HUMAN_REVIEW_ITEMS
  if (first === undefined || second === undefined || third === undefined) {
    throw new Error('Coverage tests require the three-image campaign.')
  }
  return [first, second, third]
}

function event(
  item: VerificationItem,
  eventId: string,
  outcome: VerificationEvent['outcome'],
  time: string,
): VerificationEvent {
  const nonScientific = outcome === 'cant_view' || outcome === 'skipped'
  return {
    schemaVersion: VERIFICATION_EVENT_SCHEMA_VERSION,
    eventId,
    campaignId: HUMAN_REVIEW_CAMPAIGN.campaignId,
    itemId: item.itemId,
    reviewerId: `reviewer-${eventId}`,
    reviewRound: 1,
    outcome,
    comment: null,
    nonTargetCategory: null,
    alternativeTaxon: null,
    correctedLifeStage: null,
    correctedVisualDomain: null,
    correctedView: null,
    mediaQuality: nonScientific ? 'unknown' : 'high',
    duplicateConcern: false,
    captiveOrCultivatedConcern: false,
    exclusionReason: null,
    confidence: nonScientific ? 'unknown' : 'high',
    reviewedAt: `2026-07-16T${time}:00.000Z`,
    durationMs: 1_000,
    imageSha256: item.imageSha256,
    questionSha256: item.questionFingerprint,
    campaignManifestSha256: HUMAN_REVIEW_CAMPAIGN.manifestSha256,
    taxalensSha: HUMAN_REVIEW_CAMPAIGN.taxalensSha,
    biominerSha: HUMAN_REVIEW_CAMPAIGN.biominerSha,
    supersedesEventId: null,
    conflictsWithDecisionId: null,
  }
}

function inspection(
  item: VerificationItem,
  viewable: boolean,
  failure: string | null,
): HumanReviewInspection {
  return {
    itemId: item.itemId,
    imageOpened: viewable,
    imageVerified: viewable,
    imageOpenedAt: '2026-07-16T15:00:00.000Z',
    imageFailureReason: failure,
  }
}
