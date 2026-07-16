import { describe, expect, it } from 'vitest'

import {
  FLICKR_VERIFICATION_SOURCE_SCHEMA_VERSION,
  type FlickrVerificationSource,
} from './verificationContracts'
import { validateFlickrVerificationSource } from './flickrCampaignSource'

function source(): FlickrVerificationSource {
  return {
    schemaVersion: FLICKR_VERIFICATION_SOURCE_SCHEMA_VERSION,
    flickrRecordId: 'flickr-record:papilio:1001',
    flickrPhotoId: '1001',
    fullFrameMedia: {
      mediaId: 'flickr-media:1001',
      previewUri: 'https://example.invalid/1001.jpg',
      mediaType: 'image/jpeg',
      sha256: '1'.repeat(64),
      byteCount: 12_345,
      checksumVerified: true,
      rights: {
        creator: 'Example photographer',
        rightsHolder: 'Example photographer',
        licenseName: 'CC BY 4.0',
        licenseUri: 'https://creativecommons.org/licenses/by/4.0/',
        policyStatus: 'allowed',
        attribution: 'Example photographer / CC BY 4.0',
        sourceUri: 'https://www.flickr.com/photos/example/1001',
      },
    },
    duplicateGroupId: 'duplicate:1001',
    ownerGroupId: 'flickr-owner:example',
    observationGroupId: 'flickr-observation:1001',
    geographicClusterId: 'geo-cluster:sydney',
    coordinate: {
      latitude: -33.87,
      longitude: 151.21,
      outlier: false,
    },
    query: {
      tier: 'scientific_name:T1:text',
      rank: 'scientific_name',
      trustTier: 'T1',
      searchField: 'text',
      term: 'Papilio demoleus',
    },
    route: {
      routeLabel: 'adult_butterfly_field',
      lifeStage: 'adult',
      visualDomain: 'live_field',
      view: 'dorsal',
      subjectAreaRatio: 0.35,
      fingerprint: `sha256:${'2'.repeat(64)}`,
    },
    targetScoreBand: 'middle',
    decisionState: 'abstain',
    competitorMarginBand: 'near_tie',
    samplingStratumId: 'margin-near-tie',
    inclusionProbability: null,
    datasetPartition: 'final_test',
    prioritySignals: {
      lowMargin: true,
      visualInputDisagreement: false,
      geographicAnomaly: false,
      commentConflict: null,
      smallSubject: false,
      referenceShortfall: true,
      unusualCompetitor: false,
    },
    postDecisionEvidence: {
      strongestCompetitors: [],
      references: [],
      comments: [],
      decisionReason: null,
      evidenceFingerprint: `sha256:${'5'.repeat(64)}`,
    },
    sourceArtifactFingerprint: `sha256:${'3'.repeat(64)}`,
    biominerSha: '4'.repeat(40),
  }
}

describe('Flickr verification campaign source contract', () => {
  it('preserves every required source, grouping, route, sampling, and leakage field', () => {
    expect(validateFlickrVerificationSource(source())).toEqual([])
  })

  it('rejects unreviewable media, mismatched query tiers, partial geography, and invalid sampling', () => {
    const candidate = source()
    expect(
      validateFlickrVerificationSource({
        ...candidate,
        fullFrameMedia: {
          ...candidate.fullFrameMedia,
          checksumVerified: false as true,
          rights: {
            ...candidate.fullFrameMedia.rights,
            policyStatus: 'pending',
          },
        },
        coordinate: {
          latitude: -33.87,
          longitude: null,
          outlier: true,
        },
        query: {
          ...candidate.query,
          tier: 'common_name:medium:tags',
        },
        inclusionProbability: 0,
      }),
    ).toEqual([
      'full-frame media must be checksum-verified',
      'full-frame media rights are not reviewable',
      'query tier parts do not match the raw tier',
      'source inclusion probability must be null or greater than zero and at most one',
      'Flickr coordinates must be populated together',
      'geographic outlier state requires coordinates',
    ])
  })

  it('rejects malformed post-decision evidence', () => {
    const candidate = source()
    expect(
      validateFlickrVerificationSource({
        ...candidate,
        postDecisionEvidence: {
          strongestCompetitors: [
            {
              acceptedTaxonKey: '',
              scientificName: '',
              scoreBand: 'high',
              evidenceFingerprint: 'not-a-digest',
            },
          ],
          references: [],
          comments: [{ commentId: '', text: '' }],
          decisionReason: '',
          evidenceFingerprint: 'not-a-digest',
        },
      }),
    ).toEqual([
      'post-decision competitor evidence is invalid',
      'post-decision Flickr comment evidence is invalid',
      'post-decision decision reason must be null or non-empty',
      'post-decision evidence fingerprint must be a prefixed SHA-256 digest',
    ])
  })
})
