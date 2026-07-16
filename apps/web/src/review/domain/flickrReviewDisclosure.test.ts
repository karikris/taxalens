import { describe, expect, it } from 'vitest'

import { buildFlickrAuditCampaign } from './flickrAuditCampaign'
import {
  FLICKR_BLIND_HIDDEN_FIELDS,
  projectBlindFlickrReviewContext,
  validateFlickrBlindDisclosurePolicy,
} from './flickrReviewDisclosure'
import {
  FLICKR_VERIFICATION_SOURCE_SCHEMA_VERSION,
  type FlickrVerificationSource,
} from './verificationContracts'

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
})
