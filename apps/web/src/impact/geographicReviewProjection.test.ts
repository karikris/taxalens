import { describe, expect, it } from 'vitest'

import {
  HUMAN_REVIEW_CAMPAIGN,
  HUMAN_REVIEW_ITEMS,
} from '../review/reviewPacket'
import {
  VERIFICATION_EVENT_SCHEMA_VERSION,
  type VerificationCampaign,
  type VerificationEvent,
  type VerificationItem,
} from '../review/domain'
import { qualitySnapshotFixture } from '../review/ui/qualitySnapshotTestSupport'
import {
  projectGeographicHumanReviewState,
  type GeographicReviewCampaignLedger,
} from './geographicReviewProjection'

const item = HUMAN_REVIEW_ITEMS[0]!

describe('geographic human-review projection', () => {
  it('projects exact consensus and assignment state into supported cells', () => {
    const projection = projectGeographicHumanReviewState({
      campaigns: [ledger(HUMAN_REVIEW_CAMPAIGN, [event('yes')])],
      bindings: [binding(HUMAN_REVIEW_CAMPAIGN, item, 2)],
      releaseDecisions: [],
    })

    expect(projection.items[0]).toMatchObject({
      state: 'reviewed_target_positive',
      assigned: true,
      decisivelyReviewed: true,
      humanSupported: true,
      qualityValidReviewed: false,
      populationQualityEligible: false,
      releaseReady: false,
      scientificClaimAllowed: false,
    })
    expect(projection.cells[0]).toMatchObject({
      campaignItemCount: 1,
      assignedCount: 1,
      decisivelyReviewedCount: 1,
      reviewedPositiveCount: 1,
      pendingCount: 0,
      releaseReadyCount: 0,
    })
  })

  it.each([
    ['cant_tell', 'uncertain', 'uncertainCount'],
    ['cant_view', 'media_failure', 'mediaFailureCount'],
    ['skipped', 'skipped', 'skippedCount'],
  ] as const)('keeps %s outside human-supported contribution', (outcome, state, countKey) => {
    const projection = projectGeographicHumanReviewState({
      campaigns: [ledger(HUMAN_REVIEW_CAMPAIGN, [event(outcome)])],
      bindings: [binding(HUMAN_REVIEW_CAMPAIGN, item, 1)],
      releaseDecisions: [],
    })

    expect(projection.items[0]).toMatchObject({
      state,
      decisivelyReviewed: false,
      humanSupported: false,
      qualityValidReviewed: false,
      populationQualityEligible: false,
      releaseReady: false,
    })
    expect(projection.cells[0]![countKey]).toBe(1)
    expect(projection.cells[0]).toMatchObject({
      decisivelyReviewedCount: 0,
      reviewedPositiveCount: 0,
      releaseReadyCount: 0,
    })
  })

  it('marks failure-discovery review as non-representative for population quality', () => {
    const campaign: VerificationCampaign = {
      ...HUMAN_REVIEW_CAMPAIGN,
      campaignId: 'failure-discovery-map-test',
      samplingPlan: {
        ...HUMAN_REVIEW_CAMPAIGN.samplingPlan,
        planId: 'failure-discovery-map-test-plan',
        purpose: 'failure_discovery',
        design: 'targeted_priority',
        representative: false,
        inclusionProbabilityRequired: false,
        qualityEstimationAllowed: false,
        qualityEstimationBlockedReason:
          'Targeted failure discovery is not representative.',
      },
    }
    const targetItem: VerificationItem = {
      ...item,
      campaignId: campaign.campaignId,
      inclusionProbability: null,
    }
    const quality = qualityForCampaign(campaign)
    const projection = projectGeographicHumanReviewState({
      campaigns: [
        {
          campaign,
          items: [targetItem],
          events: [event('yes', campaign, targetItem)],
          qualitySnapshots: [quality],
        },
      ],
      bindings: [binding(campaign, targetItem, 1)],
      releaseDecisions: [],
    })

    expect(projection.items[0]).toMatchObject({
      qualityValidReviewed: true,
      samplingPurpose: 'failure_discovery',
      samplingRepresentative: false,
      qualityEstimationAllowed: false,
      populationQualityEligible: false,
    })
    expect(projection.cells[0]).toMatchObject({
      qualityValidReviewedCount: 1,
      populationQualityEligibleCount: 0,
      targetedFailureDiscoveryReviewedCount: 1,
    })
  })

  it('fails closed when release-ready evidence lacks an exact quality snapshot', () => {
    expect(() =>
      projectGeographicHumanReviewState({
        campaigns: [ledger(HUMAN_REVIEW_CAMPAIGN, [event('yes')])],
        bindings: [binding(HUMAN_REVIEW_CAMPAIGN, item, 1)],
        releaseDecisions: [
          {
            campaignId: HUMAN_REVIEW_CAMPAIGN.campaignId,
            itemId: item.itemId,
            releaseDecisionId: 'release:test',
            qualitySnapshotId: 'a'.repeat(64),
            decisionStatus: 'release_ready',
            decisivePositiveConsensus: true,
            coordinatesValid: true,
            duplicateGatePassed: true,
            qualityGatePassed: true,
            provenanceComplete: true,
            eventDate: '2026-07-17',
          },
        ],
      }),
    ).toThrow('lacks the exact ready quality snapshot')
  })

  it('projects release-ready only through positive consensus and the exact ready snapshot', () => {
    const quality = qualityForCampaign(HUMAN_REVIEW_CAMPAIGN)
    const projection = projectGeographicHumanReviewState({
      campaigns: [
        {
          ...ledger(HUMAN_REVIEW_CAMPAIGN, [event('yes')]),
          qualitySnapshots: [quality],
        },
      ],
      bindings: [binding(HUMAN_REVIEW_CAMPAIGN, item, 1)],
      releaseDecisions: [
        {
          campaignId: HUMAN_REVIEW_CAMPAIGN.campaignId,
          itemId: item.itemId,
          releaseDecisionId: 'release:test',
          qualitySnapshotId: quality.snapshotSha256,
          decisionStatus: 'release_ready',
          decisivePositiveConsensus: true,
          coordinatesValid: true,
          duplicateGatePassed: true,
          qualityGatePassed: true,
          provenanceComplete: true,
          eventDate: '2026-07-17',
        },
      ],
    })

    expect(projection.items[0]).toMatchObject({
      humanSupported: true,
      qualityValidReviewed: true,
      releaseReady: true,
    })
    expect(projection.cells[0]?.releaseReadyCount).toBe(1)
  })
})

function qualityForCampaign(campaign: VerificationCampaign) {
  const fixture = qualitySnapshotFixture()
  return {
    ...fixture,
    campaign: {
      ...fixture.campaign,
      campaignId: campaign.campaignId,
      title: campaign.title,
      kind: campaign.kind,
      status: campaign.status,
      targetTaxon: campaign.targetTaxon,
      sourceProviders: campaign.sourceProviders,
      samplingPlanId: campaign.samplingPlan.planId,
      samplingPurpose: campaign.samplingPlan.purpose,
      samplingDesign: campaign.samplingPlan.design,
    },
  }
}

function ledger(
  campaign: VerificationCampaign,
  events: readonly VerificationEvent[],
): GeographicReviewCampaignLedger {
  return {
    campaign,
    items: [item],
    events,
    qualitySnapshots: [],
  }
}

function binding(
  campaign: VerificationCampaign,
  targetItem: VerificationItem,
  reviewerAssignmentCount: number,
) {
  return {
    campaignId: campaign.campaignId,
    itemId: targetItem.itemId,
    spatialResolution: 3,
    spatialCellId: '836b58fffffffff',
    cellSupported: true,
    reviewerAssignmentCount,
  }
}

function event(
  outcome: VerificationEvent['outcome'],
  campaign: VerificationCampaign = HUMAN_REVIEW_CAMPAIGN,
  targetItem: VerificationItem = item,
): VerificationEvent {
  return {
    schemaVersion: VERIFICATION_EVENT_SCHEMA_VERSION,
    eventId: `event-${outcome}`,
    campaignId: campaign.campaignId,
    itemId: targetItem.itemId,
    reviewerId: 'reviewer-a',
    reviewRound: 1,
    outcome,
    comment: null,
    nonTargetCategory: outcome === 'no' ? 'other_insect' : null,
    alternativeTaxon: null,
    correctedLifeStage: null,
    correctedVisualDomain: null,
    correctedView: null,
    mediaQuality:
      outcome === 'cant_view' || outcome === 'skipped' ? 'unknown' : 'high',
    duplicateConcern: false,
    captiveOrCultivatedConcern: false,
    exclusionReason: null,
    confidence:
      outcome === 'cant_view' || outcome === 'skipped' ? 'unknown' : 'high',
    reviewedAt: '2026-07-17T17:00:00.000Z',
    durationMs: 1_000,
    imageSha256: targetItem.imageSha256,
    questionSha256: targetItem.questionFingerprint,
    campaignManifestSha256: campaign.manifestSha256,
    taxalensSha: campaign.taxalensSha,
    biominerSha: campaign.biominerSha,
    supersedesEventId: null,
    conflictsWithDecisionId: null,
  }
}
