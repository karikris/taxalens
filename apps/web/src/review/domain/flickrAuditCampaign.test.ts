import { describe, expect, it } from 'vitest'

import {
  buildFlickrAuditCampaign,
  type FlickrAuditCampaignConfig,
} from './flickrAuditCampaign'
import {
  FLICKR_VERIFICATION_SOURCE_SCHEMA_VERSION,
  type FlickrVerificationSource,
} from './verificationContracts'

const config: FlickrAuditCampaignConfig = {
  title: 'Papilio demoleus blind Flickr audit',
  description: 'A probability-sampled final-test review campaign.',
  targetTaxon: {
    acceptedTaxonKey: 'gbif:1938069',
    scientificName: 'Papilio demoleus',
    commonName: 'lime swallowtail',
    rank: 'species',
    authority: 'Linnaeus, 1758',
  },
  selectionSeed: 'flickr-audit-seed-v1',
  ownerGroupTargetByStratum: {
    'margin-clear': 2,
    'margin-near': 2,
  },
  requiredIndependentReviewers: 2,
  taxalensSha: 'a'.repeat(40),
  biominerSha: 'b'.repeat(40),
}

function source(
  index: number,
  stratum: 'margin-clear' | 'margin-near',
  owner: string,
  duplicate = `duplicate:${index}`,
): FlickrVerificationSource {
  return {
    schemaVersion: FLICKR_VERIFICATION_SOURCE_SCHEMA_VERSION,
    flickrRecordId: `flickr-record:${index}`,
    flickrPhotoId: String(10_000 + index),
    fullFrameMedia: {
      mediaId: `flickr-media:${index}`,
      previewUri: `https://example.invalid/${index}.jpg`,
      mediaType: 'image/jpeg',
      sha256: index.toString(16).padStart(64, '0'),
      byteCount: 10_000 + index,
      checksumVerified: true,
      rights: {
        creator: `Photographer ${owner}`,
        rightsHolder: `Photographer ${owner}`,
        licenseName: 'CC BY 4.0',
        licenseUri: 'https://creativecommons.org/licenses/by/4.0/',
        policyStatus: 'allowed',
        attribution: `Photographer ${owner} / CC BY 4.0`,
        sourceUri: `https://www.flickr.com/photos/${owner}/${10_000 + index}`,
      },
    },
    duplicateGroupId: duplicate,
    ownerGroupId: `flickr-owner:${owner}`,
    observationGroupId: `flickr-observation:${index}`,
    geographicClusterId: `geo:${stratum}`,
    coordinate: {
      latitude: -33 + index / 100,
      longitude: 151 + index / 100,
      outlier: false,
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
      subjectAreaRatio: 0.3,
      fingerprint: `sha256:${'c'.repeat(64)}`,
    },
    targetScoreBand: stratum === 'margin-near' ? 'middle' : 'high',
    decisionState: 'abstain',
    competitorMarginBand:
      stratum === 'margin-near' ? 'near_tie' : 'clear_positive',
    samplingStratumId: stratum,
    inclusionProbability: null,
    datasetPartition: 'final_test',
    prioritySignals: {
      lowMargin: stratum === 'margin-near',
      visualInputDisagreement: false,
      geographicAnomaly: false,
      commentConflict: false,
      smallSubject: false,
      referenceShortfall: false,
      unusualCompetitor: false,
    },
    sourceArtifactFingerprint: `sha256:${index
      .toString(16)
      .padStart(64, 'f')}`,
    biominerSha: config.biominerSha,
  }
}

function population(): readonly FlickrVerificationSource[] {
  return [
    source(1, 'margin-clear', 'a'),
    source(2, 'margin-clear', 'a'),
    source(3, 'margin-clear', 'b'),
    source(4, 'margin-clear', 'c'),
    source(5, 'margin-near', 'd'),
    source(6, 'margin-near', 'd'),
    source(7, 'margin-near', 'e'),
    source(8, 'margin-near', 'f'),
    source(9, 'margin-near', 'f', 'duplicate:8'),
  ]
}

describe('Flickr audit campaign builder', () => {
  it('builds the same blind owner-cluster sample for the same seed', async () => {
    const first = await buildFlickrAuditCampaign(population(), config)
    const second = await buildFlickrAuditCampaign(
      [...population()].reverse(),
      config,
    )

    expect(first).toEqual(second)
    expect(first.campaign.samplingPlan).toMatchObject({
      purpose: 'quality_estimation',
      design: 'clustered_random',
      representative: true,
      blindReview: true,
      inclusionProbabilityRequired: true,
      independentUnit: 'owner_group',
      leakagePolicy: 'final_test_only',
      qualityEstimationAllowed: true,
    })
    expect(first.campaign.disclosurePolicy).toMatchObject({
      mode: 'blind',
      revealAfterDecision: true,
    })
    expect(first.selection.sourceRecordCount).toBe(9)
    expect(first.selection.canonicalRecordCount).toBe(8)
    expect(first.selection.omittedDuplicateRecordIds).toEqual([
      'flickr-record:9',
    ])
    expect(first.selection.strata).toHaveLength(2)
    for (const stratum of first.selection.strata) {
      expect(stratum.populationOwnerGroupCount).toBe(3)
      expect(stratum.selectedOwnerGroupCount).toBe(2)
      expect(stratum.inclusionProbability).toBeCloseTo(2 / 3)
      expect(stratum.samplingWeight).toBeCloseTo(1.5)
    }
    expect(
      new Set(first.items.map(({ duplicateGroupId }) => duplicateGroupId)).size,
    ).toBe(first.items.length)
    expect(
      first.items.every(
        (item) =>
          item.inclusionProbability === 2 / 3 &&
          first.selection.samplingWeights[item.itemId] === 1.5,
      ),
    ).toBe(true)
  })

  it('selects complete owner groups without duplicate inflation', async () => {
    const packet = await buildFlickrAuditCampaign(population(), config)
    const sourceByOwner = new Map<string, Set<string>>()
    for (const sourceRow of population().filter(
      ({ flickrRecordId }) => flickrRecordId !== 'flickr-record:9',
    )) {
      const records =
        sourceByOwner.get(sourceRow.ownerGroupId) ?? new Set<string>()
      records.add(sourceRow.duplicateGroupId)
      sourceByOwner.set(sourceRow.ownerGroupId, records)
    }
    const selectedByOwner = new Map<string, Set<string>>()
    for (const item of packet.items) {
      const records =
        selectedByOwner.get(item.ownerPhotographerGroupId) ?? new Set<string>()
      records.add(item.duplicateGroupId)
      selectedByOwner.set(item.ownerPhotographerGroupId, records)
    }
    for (const [owner, selectedGroups] of selectedByOwner) {
      expect(selectedGroups).toEqual(sourceByOwner.get(owner))
    }
  })

  it('rejects split leakage and owner groups spanning strata', async () => {
    const leaked = population().map((row, index) =>
      index === 0 ? { ...row, datasetPartition: 'model_selection' as const } : row,
    )
    await expect(buildFlickrAuditCampaign(leaked, config)).rejects.toThrow(
      'Flickr audit sources must use the final_test partition.',
    )

    const crossStratum = population().map((row, index) =>
      index === 4
        ? {
            ...row,
            ownerGroupId: 'flickr-owner:a',
          }
        : row,
    )
    await expect(
      buildFlickrAuditCampaign(crossStratum, config),
    ).rejects.toThrow('An owner group spans multiple audit strata.')
  })
})
