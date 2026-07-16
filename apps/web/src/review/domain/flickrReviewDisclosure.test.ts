import { describe, expect, it } from 'vitest'

import { buildFlickrAuditCampaign } from './flickrAuditCampaign'
import {
  FLICKR_BLIND_HIDDEN_FIELDS,
  projectBlindFlickrReviewContext,
  projectRevealedFlickrReviewContext,
  validateFlickrBlindDisclosurePolicy,
} from './flickrReviewDisclosure'
import {
  FLICKR_VERIFICATION_SOURCE_SCHEMA_VERSION,
  type FlickrVerificationSource,
} from './verificationContracts'
import {
  VERIFICATION_EVENT_SCHEMA_VERSION,
  type VerificationEvent,
} from './verificationEvents'

const biominerSha = 'b'.repeat(40)

function secretSource(): FlickrVerificationSource {
  return {
    schemaVersion: FLICKR_VERIFICATION_SOURCE_SCHEMA_VERSION,
    flickrRecordId: 'flickr-record:secret',
    flickrPhotoId: '55081300254',
    fullFrameMedia: {
      mediaId: 'flickr-media:secret',
      previewUri: 'https://live.staticflickr.invalid/media.jpg',
      mediaType: 'image/jpeg',
      sha256: '1'.repeat(64),
      byteCount: 42_000,
      checksumVerified: true,
      rights: {
        creator: 'Review photographer',
        rightsHolder: 'Review photographer',
        licenseName: 'CC BY 4.0',
        licenseUri: 'https://creativecommons.org/licenses/by/4.0/',
        policyStatus: 'allowed',
        attribution: 'Review photographer / CC BY 4.0',
        sourceUri:
          'https://flickr.invalid/SECRET_PROVIDER_LABEL/SECRET_QUERY_TERM',
      },
    },
    duplicateGroupId: 'duplicate:secret',
    ownerGroupId: 'owner:secret',
    observationGroupId: 'observation:secret',
    geographicClusterId: 'geo:secret',
    coordinate: {
      latitude: -33.86,
      longitude: 151.21,
      outlier: true,
    },
    query: {
      tier: 'scientific_name:SECRET_TRUST_TIER:text',
      rank: 'scientific_name',
      trustTier: 'SECRET_TRUST_TIER',
      searchField: 'text',
      term: 'SECRET_QUERY_TERM',
    },
    route: {
      routeLabel: 'adult_butterfly_field',
      lifeStage: 'adult',
      visualDomain: 'live_field',
      view: 'dorsal',
      subjectAreaRatio: 0.15,
      fingerprint: `sha256:${'2'.repeat(64)}`,
    },
    targetScoreBand: 'high',
    decisionState: 'target',
    competitorMarginBand: 'near_tie',
    samplingStratumId: 'blind-audit',
    inclusionProbability: null,
    datasetPartition: 'final_test',
    prioritySignals: {
      lowMargin: true,
      visualInputDisagreement: true,
      geographicAnomaly: true,
      commentConflict: true,
      smallSubject: false,
      referenceShortfall: false,
      unusualCompetitor: true,
    },
    postDecisionEvidence: {
      strongestCompetitors: [
        {
          acceptedTaxonKey: 'gbif:1938224',
          scientificName: 'SECRET_COMPETITOR',
          scoreBand: 'middle',
          evidenceFingerprint: `sha256:${'4'.repeat(64)}`,
        },
      ],
      references: [
        {
          referenceId: 'reference:secret',
          acceptedTaxonKey: 'gbif:1938069',
          scientificName: 'Papilio demoleus',
          role: 'target',
          provider: 'gbif',
          reviewState: 'provider_supported',
        },
      ],
      comments: [
        {
          commentId: 'comment:secret',
          text: 'SECRET_FLICKR_COMMENT',
        },
      ],
      decisionReason: 'SECRET_DECISION_REASON',
      evidenceFingerprint: `sha256:${'5'.repeat(64)}`,
    },
    sourceArtifactFingerprint: `sha256:${'3'.repeat(64)}`,
    biominerSha,
  }
}

describe('blind Flickr review disclosure', () => {
  it('projects only decision-safe context before a human outcome exists', async () => {
    const packet = await buildFlickrAuditCampaign([secretSource()], {
      title: 'Blind Flickr audit',
      description: 'Leakage test campaign.',
      targetTaxon: {
        acceptedTaxonKey: 'gbif:1938069',
        scientificName: 'Papilio demoleus',
        commonName: 'lime swallowtail',
        rank: 'species',
        authority: 'Linnaeus, 1758',
      },
      selectionSeed: 'blind-test',
      ownerGroupTargetByStratum: { 'blind-audit': 1 },
      requiredIndependentReviewers: 1,
      taxalensSha: 'a'.repeat(40),
      biominerSha,
    })
    const context = projectBlindFlickrReviewContext(
      packet.campaign,
      packet.items[0]!,
    )
    const serialized = JSON.stringify(context)

    expect(context.targetQuestion).toBe(
      'Does this image show Papilio demoleus?',
    )
    expect(context.hiddenBeforeDecision).toEqual(
      FLICKR_BLIND_HIDDEN_FIELDS,
    )
    expect(context.sourcePageAvailable).toBe(false)
    for (const forbidden of [
      'SECRET_PROVIDER_LABEL',
      'SECRET_QUERY_TERM',
      'SECRET_TRUST_TIER',
      'SECRET_COMPETITOR',
      'SECRET_FLICKR_COMMENT',
      'SECRET_DECISION_REASON',
      'near_tie',
      '"decisionState":"target"',
      '"targetScoreBand":"high"',
    ]) {
      expect(serialized).not.toContain(forbidden)
    }
  })

  it('rejects campaigns that omit any confirmation-bias control', async () => {
    const packet = await buildFlickrAuditCampaign([secretSource()], {
      title: 'Blind Flickr audit',
      description: 'Leakage test campaign.',
      targetTaxon: {
        acceptedTaxonKey: 'gbif:1938069',
        scientificName: 'Papilio demoleus',
        commonName: null,
        rank: 'species',
        authority: null,
      },
      selectionSeed: 'blind-test',
      ownerGroupTargetByStratum: { 'blind-audit': 1 },
      requiredIndependentReviewers: 1,
      taxalensSha: 'a'.repeat(40),
      biominerSha,
    })
    const incomplete = {
      ...packet.campaign,
      disclosurePolicy: {
        ...packet.campaign.disclosurePolicy,
        hiddenBeforeDecision: ['target_score_band'],
      },
    }

    expect(validateFlickrBlindDisclosurePolicy(incomplete)).toContain(
      'blind Flickr disclosure policy is missing: competitor_margin_band, decision_state, top_competitors, flickr_comments, query_term, provider_supplied_identity, query_trust_tier, priority_signals',
    )
  })

  it('releases post-decision evidence only when bound to a valid event', async () => {
    const packet = await buildFlickrAuditCampaign([secretSource()], {
      title: 'Blind Flickr audit',
      description: 'Post-decision reveal test campaign.',
      targetTaxon: {
        acceptedTaxonKey: 'gbif:1938069',
        scientificName: 'Papilio demoleus',
        commonName: 'lime swallowtail',
        rank: 'species',
        authority: 'Linnaeus, 1758',
      },
      selectionSeed: 'blind-test',
      ownerGroupTargetByStratum: { 'blind-audit': 1 },
      requiredIndependentReviewers: 1,
      taxalensSha: 'a'.repeat(40),
      biominerSha,
    })
    const item = packet.items[0]!
    const event = decisionEvent(packet.campaign, item)
    const revealed = projectRevealedFlickrReviewContext(
      packet.campaign,
      item,
      event,
    )

    expect(revealed.humanDecision.eventId).toBe(event.eventId)
    expect(revealed.modelResult).toEqual({
      targetScoreBand: 'high',
      decisionState: 'target',
      competitorMarginBand: 'near_tie',
      valuesAreProbabilities: false,
    })
    expect(revealed.strongestCompetitors[0]?.scientificName).toBe(
      'SECRET_COMPETITOR',
    )
    expect(revealed.comments[0]?.text).toBe('SECRET_FLICKR_COMMENT')
    expect(revealed.decisionReason).toBe('SECRET_DECISION_REASON')
    expect(revealed.sourceContext.queryTerm).toBe('SECRET_QUERY_TERM')
    expect(revealed.geography).toMatchObject({
      geographicClusterId: 'geo:secret',
      outlier: true,
    })

    await expect(() =>
      projectRevealedFlickrReviewContext(packet.campaign, item, {
        ...event,
        itemId: 'wrong-item',
      }),
    ).toThrow('event itemId does not match the campaign item')
    expect(() =>
      projectRevealedFlickrReviewContext(packet.campaign, item, {
        ...event,
        outcome: 'no',
      }),
    ).toThrow('a Flickr No decision requires a non-target category')
    expect(
      projectRevealedFlickrReviewContext(packet.campaign, item, {
        ...event,
        outcome: 'no',
        nonTargetCategory: 'other_butterfly',
      }).humanDecision.outcome,
    ).toBe('no')
  })
})

function decisionEvent(
  campaign: Awaited<ReturnType<typeof buildFlickrAuditCampaign>>['campaign'],
  item: Awaited<ReturnType<typeof buildFlickrAuditCampaign>>['items'][number],
): VerificationEvent {
  return {
    schemaVersion: VERIFICATION_EVENT_SCHEMA_VERSION,
    eventId: 'local-review-event:flickr:reviewer:1:2026-07-16',
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
    mediaQuality: 'high',
    duplicateConcern: false,
    captiveOrCultivatedConcern: false,
    exclusionReason: null,
    confidence: 'high',
    reviewedAt: '2026-07-16T12:00:00.000Z',
    durationMs: 1_000,
    imageSha256: item.imageSha256,
    questionSha256: item.questionFingerprint,
    campaignManifestSha256: campaign.manifestSha256,
    taxalensSha: campaign.taxalensSha,
    biominerSha: campaign.biominerSha,
    supersedesEventId: null,
    conflictsWithDecisionId: null,
  }
}
