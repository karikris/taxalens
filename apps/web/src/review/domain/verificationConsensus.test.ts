import { describe, expect, it } from 'vitest'

import {
  HUMAN_REVIEW_CAMPAIGN,
  HUMAN_REVIEW_ITEMS,
} from '../reviewPacket'
import {
  buildFlickrAuditCampaign,
  FLICKR_VERIFICATION_SOURCE_SCHEMA_VERSION,
  VERIFICATION_EVENT_SCHEMA_VERSION,
  projectVerificationConsensus,
  type FlickrVerificationSource,
  type VerificationCampaign,
  type VerificationEvent,
  type VerificationItem,
} from '.'

const [item] = HUMAN_REVIEW_ITEMS
if (item === undefined) {
  throw new Error('Consensus tests require one verification item.')
}

describe('verification consensus projection', () => {
  it('resolves complete agreement independently of event read order', () => {
    const campaign = campaignWithIndependentReviews(2)
    const events = [
      event(campaign, item, {
        eventId: 'event-reviewer-b',
        reviewerId: 'reviewer-b',
        outcome: 'yes',
        reviewedAt: '2026-07-16T15:01:00.000Z',
      }),
      event(campaign, item, {
        eventId: 'event-reviewer-a',
        reviewerId: 'reviewer-a',
        outcome: 'yes',
        reviewedAt: '2026-07-16T15:00:00.000Z',
      }),
    ]

    const first = projectVerificationConsensus(campaign, [item], events)
    const second = projectVerificationConsensus(
      campaign,
      [item],
      [...events].reverse(),
    )

    expect(first).toEqual(second)
    expect(first[0]).toMatchObject({
      status: 'complete_agreement',
      consensusOutcome: 'yes',
      requiredReviewCount: 2,
      effectiveReviewCount: 2,
      decisiveReviewCount: 2,
      effectiveReviewerIds: ['reviewer-a', 'reviewer-b'],
      conflictingFields: [],
      secondReviewRequired: false,
      adjudicationRequired: false,
    })
  })

  it('does not majority-overwrite a dissenting reviewer', () => {
    const campaign = campaignWithIndependentReviews(2)
    const consensus = projectVerificationConsensus(
      campaign,
      [item],
      [
        event(campaign, item, {
          eventId: 'event-a-yes',
          reviewerId: 'reviewer-a',
          outcome: 'yes',
          reviewedAt: '2026-07-16T15:00:00.000Z',
        }),
        event(campaign, item, {
          eventId: 'event-b-no',
          reviewerId: 'reviewer-b',
          outcome: 'no',
          reviewedAt: '2026-07-16T15:01:00.000Z',
        }),
        event(campaign, item, {
          eventId: 'event-c-yes',
          reviewerId: 'reviewer-c',
          outcome: 'yes',
          reviewedAt: '2026-07-16T15:02:00.000Z',
        }),
      ],
    )[0]!

    expect(consensus).toMatchObject({
      status: 'unresolved_disagreement',
      consensusOutcome: null,
      resolvedSignature: null,
      decisiveReviewCount: 3,
      conflictingFields: ['outcome'],
      conflictEventIds: [
        'event-a-yes',
        'event-b-no',
        'event-c-yes',
      ],
      secondReviewRequired: true,
      adjudicationRequired: true,
    })
  })

  it('requires a later distinct reviewer to resolve prior uncertainty', () => {
    const campaign = {
      ...campaignWithIndependentReviews(1),
      reviewRequirement: {
        ...campaignWithIndependentReviews(1).reviewRequirement,
        secondReviewPolicy: 'on_uncertain' as const,
      },
    }
    const uncertain = event(campaign, item, {
      eventId: 'event-a-uncertain',
      reviewerId: 'reviewer-a',
      outcome: 'cant_tell',
      reviewedAt: '2026-07-16T15:00:00.000Z',
    })
    const sameReviewer = event(campaign, item, {
      eventId: 'event-a-correction',
      reviewerId: 'reviewer-a',
      reviewRound: 2,
      outcome: 'yes',
      reviewedAt: '2026-07-16T15:01:00.000Z',
      supersedesEventId: uncertain.eventId,
    })

    expect(
      projectVerificationConsensus(campaign, [item], [
        uncertain,
        sameReviewer,
      ])[0],
    ).toMatchObject({
      status: 'pending',
      decisiveReviewCount: 1,
      effectiveReviewerIds: ['reviewer-a'],
      secondReviewRequired: true,
    })

    const distinctReviewer = event(campaign, item, {
      eventId: 'event-b-resolution',
      reviewerId: 'reviewer-b',
      outcome: 'yes',
      reviewedAt: '2026-07-16T15:02:00.000Z',
    })
    expect(
      projectVerificationConsensus(campaign, [item], [
        uncertain,
        sameReviewer,
        distinctReviewer,
      ])[0],
    ).toMatchObject({
      status: 'complete_agreement',
      consensusOutcome: 'yes',
      decisiveReviewCount: 2,
      effectiveReviewerIds: ['reviewer-a', 'reviewer-b'],
      secondReviewRequired: false,
    })
  })

  it('distinguishes pending, uncertainty, media failure, deferral, and adjudication', () => {
    const uncertainCampaign = {
      ...HUMAN_REVIEW_CAMPAIGN,
      reviewRequirement: {
        ...HUMAN_REVIEW_CAMPAIGN.reviewRequirement,
        secondReviewPolicy: 'on_uncertain' as const,
      },
    }
    expect(
      projectVerificationConsensus(HUMAN_REVIEW_CAMPAIGN, [item], [])[0]
        ?.status,
    ).toBe('pending')
    expect(
      projectVerificationConsensus(uncertainCampaign, [item], [
        event(uncertainCampaign, item, {
          eventId: 'event-uncertain',
          outcome: 'cant_tell',
          reviewedAt: '2026-07-16T15:00:00.000Z',
        }),
      ])[0],
    ).toMatchObject({
      status: 'uncertain_only',
      consensusOutcome: null,
      secondReviewRequired: true,
    })
    expect(
      projectVerificationConsensus(HUMAN_REVIEW_CAMPAIGN, [item], [
        event(HUMAN_REVIEW_CAMPAIGN, item, {
          eventId: 'event-cant-view',
          outcome: 'cant_view',
          reviewedAt: '2026-07-16T15:01:00.000Z',
        }),
      ])[0],
    ).toMatchObject({
      status: 'media_failure',
      decisiveReviewCount: 0,
      secondReviewRequired: false,
    })
    expect(
      projectVerificationConsensus(HUMAN_REVIEW_CAMPAIGN, [item], [
        event(HUMAN_REVIEW_CAMPAIGN, item, {
          eventId: 'event-skip',
          outcome: 'skipped',
          reviewedAt: '2026-07-16T15:02:00.000Z',
        }),
      ])[0]?.status,
    ).toBe('deferred')
    const adjudicationCampaign = {
      ...HUMAN_REVIEW_CAMPAIGN,
      kind: 'adjudication' as const,
    }
    expect(
      projectVerificationConsensus(adjudicationCampaign, [item], [
        event(adjudicationCampaign, item, {
          eventId: 'event-adjudicated',
          outcome: 'yes',
          reviewedAt: '2026-07-16T15:03:00.000Z',
        }),
      ])[0],
    ).toMatchObject({
      status: 'adjudicated',
      consensusOutcome: 'yes',
    })
  })

  it('prepares reference agreement for BioMiner and gates final-test labels', async () => {
    const referenceCampaign: VerificationCampaign = {
      ...HUMAN_REVIEW_CAMPAIGN,
      kind: 'reference_identity_verification',
      sourceProviders: ['gbif'],
      biominerSha: 'b'.repeat(40),
    }
    const referenceItem: VerificationItem = {
      ...item,
      source: 'gbif',
      sourceObservationId: 'gbif-observation:100',
      sourceMediaId: 'gbif-media:100',
      sourceProvenance: {
        provider: 'gbif',
        providerLabel: 'GBIF',
        originalProvider: 'Synthetic museum',
        referenceObservationId: 'reference-observation:100',
        sourceObservationId: 'gbif-observation:100',
        providerMediaId: 'gbif-provider-media:100',
        occurrenceLicense: 'CC0',
        mediaLicense: {
          name: item.rights.licenseName,
          uri: item.rights.licenseUri,
          policyStatus: item.rights.policyStatus,
        },
        observerId: 'observer-a',
        observedAt: '2026-07-01T00:00:00.000Z',
        fallbackLevel: 0,
        geography: {
          locality: 'Sydney',
          country: 'Australia',
          countryCode: 'AU',
          latitude: -33.86,
          longitude: 151.21,
          coordinateUncertaintyMeters: 100,
          coordinatesObscured: false,
          geographicClusterId: 'geo:sydney',
        },
        providerVerificationStatus: 'research_grade',
      },
    }
    expect(
      projectVerificationConsensus(referenceCampaign, [referenceItem], [
        event(referenceCampaign, referenceItem, {
          eventId: 'event-reference',
          outcome: 'yes',
          reviewedAt: '2026-07-16T15:04:00.000Z',
        }),
      ])[0],
    ).toMatchObject({
      status: 'complete_agreement',
      supportEligibility: 'prepared_for_biominer_resolution',
      supportEligibilityBlockers: [],
      finalTestEligibility: 'not_applicable',
    })

    const audit = await buildFlickrAuditCampaign(
      [flickrSource()],
      {
        title: 'Consensus audit',
        description: 'Synthetic final-test eligibility campaign.',
        targetTaxon: HUMAN_REVIEW_CAMPAIGN.targetTaxon!,
        selectionSeed: 'consensus-final-test',
        ownerGroupTargetByStratum: { consensus: 1 },
        requiredIndependentReviewers: 1,
        taxalensSha: 'a'.repeat(40),
        biominerSha: 'b'.repeat(40),
      },
    )
    const auditItem = audit.items[0]!
    expect(
      projectVerificationConsensus(audit.campaign, audit.items, [
        event(audit.campaign, auditItem, {
          eventId: 'event-final-test',
          outcome: 'yes',
          reviewedAt: '2026-07-16T15:05:00.000Z',
        }),
      ])[0],
    ).toMatchObject({
      status: 'complete_agreement',
      finalTestEligibility: 'eligible',
      finalTestEligibilityBlockers: [],
      supportEligibility: 'not_applicable',
    })
  })
})

function campaignWithIndependentReviews(
  requiredIndependentReviewers: number,
): VerificationCampaign {
  return {
    ...HUMAN_REVIEW_CAMPAIGN,
    reviewRequirement: {
      ...HUMAN_REVIEW_CAMPAIGN.reviewRequirement,
      requiredIndependentReviewers,
      secondReviewPolicy: 'on_conflict_or_uncertain',
      adjudicationRequiredOnConflict:
        requiredIndependentReviewers > 1,
    },
  }
}

function event(
  campaign: VerificationCampaign,
  targetItem: VerificationItem,
  values: {
    readonly eventId: string
    readonly outcome: VerificationEvent['outcome']
    readonly reviewedAt: string
    readonly reviewerId?: string
    readonly reviewRound?: number
    readonly supersedesEventId?: string | null
  },
): VerificationEvent {
  return {
    schemaVersion: VERIFICATION_EVENT_SCHEMA_VERSION,
    eventId: values.eventId,
    campaignId: campaign.campaignId,
    itemId: targetItem.itemId,
    reviewerId: values.reviewerId ?? 'reviewer-a',
    reviewRound: values.reviewRound ?? 1,
    outcome: values.outcome,
    comment: null,
    nonTargetCategory: null,
    alternativeTaxon: null,
    correctedLifeStage: null,
    correctedVisualDomain: null,
    correctedView: null,
    mediaQuality:
      values.outcome === 'cant_view' || values.outcome === 'skipped'
        ? 'unknown'
        : 'high',
    duplicateConcern: false,
    captiveOrCultivatedConcern: false,
    exclusionReason: null,
    confidence:
      values.outcome === 'cant_view' || values.outcome === 'skipped'
        ? 'unknown'
        : 'high',
    reviewedAt: values.reviewedAt,
    durationMs: 1_000,
    imageSha256: targetItem.imageSha256,
    questionSha256: targetItem.questionFingerprint,
    campaignManifestSha256: campaign.manifestSha256,
    taxalensSha: campaign.taxalensSha,
    biominerSha: campaign.biominerSha,
    supersedesEventId: values.supersedesEventId ?? null,
    conflictsWithDecisionId: null,
  }
}

function flickrSource(): FlickrVerificationSource {
  const target = HUMAN_REVIEW_CAMPAIGN.targetTaxon!
  return {
    schemaVersion: FLICKR_VERIFICATION_SOURCE_SCHEMA_VERSION,
    flickrRecordId: 'flickr-record:consensus',
    flickrPhotoId: '40001',
    fullFrameMedia: {
      mediaId: 'flickr-media:consensus',
      previewUri: 'https://example.invalid/consensus.jpg',
      mediaType: 'image/jpeg',
      sha256: '1'.repeat(64),
      byteCount: 40_001,
      checksumVerified: true,
      rights: {
        creator: 'owner-a',
        rightsHolder: 'owner-a',
        licenseName: 'CC BY 4.0',
        licenseUri: 'https://creativecommons.org/licenses/by/4.0/',
        policyStatus: 'allowed',
        attribution: 'owner-a / CC BY 4.0',
        sourceUri: 'https://www.flickr.com/photos/owner-a/40001',
      },
    },
    duplicateGroupId: 'duplicate:consensus',
    ownerGroupId: 'flickr-owner:owner-a',
    observationGroupId: 'observation:consensus',
    geographicClusterId: 'geo:sydney',
    coordinate: {
      latitude: -33.86,
      longitude: 151.21,
      outlier: false,
    },
    query: {
      tier: 'scientific_name:T1:text',
      rank: 'scientific_name',
      trustTier: 'T1',
      searchField: 'text',
      term: target.scientificName,
    },
    route: {
      routeLabel: 'adult_field',
      lifeStage: 'adult',
      visualDomain: 'live_field',
      view: 'dorsal',
      subjectAreaRatio: 0.3,
      fingerprint: `sha256:${'2'.repeat(64)}`,
    },
    targetScoreBand: 'high',
    decisionState: 'target',
    competitorMarginBand: 'clear_positive',
    samplingStratumId: 'consensus',
    inclusionProbability: null,
    datasetPartition: 'final_test',
    prioritySignals: {
      lowMargin: false,
      visualInputDisagreement: false,
      geographicAnomaly: false,
      commentConflict: false,
      smallSubject: false,
      referenceShortfall: false,
      unusualCompetitor: false,
    },
    postDecisionEvidence: {
      strongestCompetitors: [],
      references: [],
      comments: [],
      decisionReason: null,
      evidenceFingerprint: `sha256:${'3'.repeat(64)}`,
    },
    sourceArtifactFingerprint: `sha256:${'4'.repeat(64)}`,
    biominerSha: 'b'.repeat(40),
  }
}
