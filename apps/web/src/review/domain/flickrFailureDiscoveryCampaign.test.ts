import { describe, expect, it } from 'vitest'

import {
  FLICKR_FAILURE_SIGNAL_PRIORITY,
  buildFlickrFailureDiscoveryCampaign,
  type FlickrFailureDiscoveryCampaignConfig,
} from './flickrFailureDiscoveryCampaign'
import {
  FLICKR_VERIFICATION_SOURCE_SCHEMA_VERSION,
  type FlickrVerificationPrioritySignals,
  type FlickrVerificationSource,
} from './verificationContracts'

const config: FlickrFailureDiscoveryCampaignConfig = {
  title: 'Papilio demoleus Flickr failure discovery',
  description:
    'A targeted blind queue for model-selection failure discovery only.',
  targetTaxon: {
    acceptedTaxonKey: 'gbif:1938069',
    scientificName: 'Papilio demoleus',
    commonName: 'lime swallowtail',
    rank: 'species',
    authority: 'Linnaeus, 1758',
  },
  targetItemCount: 4,
  rankingSeed: 'flickr-failure-discovery-v1',
  requiredIndependentReviewers: 2,
  taxalensSha: 'a'.repeat(40),
  biominerSha: 'b'.repeat(40),
}

const noSignals: FlickrVerificationPrioritySignals = {
  lowMargin: false,
  visualInputDisagreement: false,
  geographicAnomaly: false,
  commentConflict: false,
  smallSubject: false,
  referenceShortfall: false,
  unusualCompetitor: false,
}

function source(
  index: number,
  owner: string,
  signals: Partial<FlickrVerificationPrioritySignals>,
  duplicate = `duplicate:${index}`,
): FlickrVerificationSource {
  return {
    schemaVersion: FLICKR_VERIFICATION_SOURCE_SCHEMA_VERSION,
    flickrRecordId: `flickr-record:${index}`,
    flickrPhotoId: String(20_000 + index),
    fullFrameMedia: {
      mediaId: `flickr-media:${index}`,
      previewUri: `https://example.invalid/${index}.jpg`,
      mediaType: 'image/jpeg',
      sha256: index.toString(16).padStart(64, '0'),
      byteCount: 20_000 + index,
      checksumVerified: true,
      rights: {
        creator: `Photographer ${owner}`,
        rightsHolder: `Photographer ${owner}`,
        licenseName: 'CC BY 4.0',
        licenseUri: 'https://creativecommons.org/licenses/by/4.0/',
        policyStatus: 'allowed',
        attribution: `Photographer ${owner} / CC BY 4.0`,
        sourceUri: `https://www.flickr.com/photos/${owner}/${20_000 + index}`,
      },
    },
    duplicateGroupId: duplicate,
    ownerGroupId: `flickr-owner:${owner}`,
    observationGroupId: `flickr-observation:${index}`,
    geographicClusterId: `geo:${owner}`,
    coordinate: {
      latitude: -33 + index / 100,
      longitude: 151 + index / 100,
      outlier: signals.geographicAnomaly ?? false,
    },
    query: {
      tier: 'scientific_name:high:text',
      rank: 'scientific_name',
      trustTier: 'high',
      searchField: 'text',
      term: 'Papilio demoleus',
    },
    route: {
      routeLabel: 'adult_butterfly_field',
      lifeStage: 'adult',
      visualDomain: 'live_field',
      view: 'dorsal',
      subjectAreaRatio: signals.smallSubject ? 0.03 : 0.3,
      fingerprint: `sha256:${'c'.repeat(64)}`,
    },
    targetScoreBand: signals.lowMargin ? 'middle' : 'high',
    decisionState: 'abstain',
    competitorMarginBand: signals.lowMargin ? 'near_tie' : 'clear_positive',
    samplingStratumId: signals.lowMargin ? 'margin-near' : 'other-risk',
    inclusionProbability: null,
    datasetPartition: 'model_selection',
    prioritySignals: {
      ...noSignals,
      ...signals,
    },
    sourceArtifactFingerprint: `sha256:${index
      .toString(16)
      .padStart(64, 'f')}`,
    biominerSha: config.biominerSha,
  }
}

function population(): readonly FlickrVerificationSource[] {
  return [
    source(1, 'a', { lowMargin: true }, 'duplicate:1'),
    source(2, 'a', { unusualCompetitor: true }),
    source(3, 'b', { visualInputDisagreement: true }),
    source(4, 'c', { geographicAnomaly: true }),
    source(5, 'd', { commentConflict: true }),
    source(6, 'e', {}),
    source(
      7,
      'a',
      { lowMargin: true, visualInputDisagreement: true },
      'duplicate:1',
    ),
    source(8, 'f', { smallSubject: true }),
  ]
}

describe('Flickr failure-discovery campaign builder', () => {
  it('builds a deterministic signal-priority queue without statistical weights', async () => {
    const first = await buildFlickrFailureDiscoveryCampaign(
      population(),
      config,
    )
    const second = await buildFlickrFailureDiscoveryCampaign(
      [...population()].reverse(),
      config,
    )

    expect(first).toEqual(second)
    expect(first.campaign.samplingPlan).toMatchObject({
      purpose: 'failure_discovery',
      design: 'targeted_priority',
      representative: false,
      blindReview: true,
      inclusionProbabilityRequired: false,
      independentUnit: 'duplicate_group',
      leakagePolicy: 'model_selection_only',
      qualityEstimationAllowed: false,
    })
    expect(
      first.campaign.samplingPlan.qualityEstimationBlockedReason,
    ).toContain('unsuitable for unweighted quality estimation')
    expect(first.selection).toMatchObject({
      sourceRecordCount: 8,
      canonicalRecordCount: 7,
      eligibleRecordCount: 6,
      omittedDuplicateRecordIds: ['flickr-record:1'],
      omittedNoSignalRecordIds: ['flickr-record:6'],
      selectedRecordCount: 4,
      representative: false,
      inclusionProbabilitiesAvailable: false,
      samplingWeightsAvailable: false,
      unweightedQualityEstimationAllowed: false,
      scientificClaimAllowed: false,
    })
    expect(first.selection.priorityOrder).toEqual(
      FLICKR_FAILURE_SIGNAL_PRIORITY,
    )
    expect(
      first.selection.priorities.map(({ flickrRecordId, priorityScore }) => [
        flickrRecordId,
        priorityScore,
      ]),
    ).toEqual([
      ['flickr-record:7', 96],
      ['flickr-record:3', 32],
      ['flickr-record:4', 16],
      ['flickr-record:5', 8],
    ])
    expect(
      first.items.every(({ inclusionProbability }) =>
        inclusionProbability === null,
      ),
    ).toBe(true)
  })

  it('collapses duplicates while preserving owner and observation identities', async () => {
    const packet = await buildFlickrFailureDiscoveryCampaign(
      population(),
      config,
    )

    expect(
      new Set(packet.items.map(({ duplicateGroupId }) => duplicateGroupId)).size,
    ).toBe(packet.items.length)
    const selected = packet.items.find(
      ({ flickrSource }) =>
        flickrSource?.flickrRecordId === 'flickr-record:7',
    )
    expect(selected).toMatchObject({
      duplicateGroupId: 'duplicate:1',
      ownerPhotographerGroupId: 'flickr-owner:a',
      observationGroupId: 'flickr-observation:7',
    })
  })

  it('rejects final-test leakage and duplicate groups spanning owners', async () => {
    const leaked = population().map((row, index) =>
      index === 0 ? { ...row, datasetPartition: 'final_test' as const } : row,
    )
    await expect(
      buildFlickrFailureDiscoveryCampaign(leaked, config),
    ).rejects.toThrow(
      'Flickr failure-discovery sources must use the model_selection partition.',
    )

    const crossOwnerDuplicate = population().map((row, index) =>
      index === 6
        ? {
            ...row,
            ownerGroupId: 'flickr-owner:other',
          }
        : row,
    )
    await expect(
      buildFlickrFailureDiscoveryCampaign(crossOwnerDuplicate, config),
    ).rejects.toThrow('A duplicate group spans multiple owner groups.')
  })
})
