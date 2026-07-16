import { describe, expect, it } from 'vitest'

import {
  buildFlickrAuditCampaign,
  FLICKR_VERIFICATION_SOURCE_SCHEMA_VERSION,
  VERIFICATION_EVENT_SCHEMA_VERSION,
  type FlickrVerificationSource,
  type TaxonIdentity,
  type VerificationCampaign,
  type VerificationEvent,
  type VerificationItem,
} from '../domain'
import {
  BIOMINER_REVIEWED_LABEL_SCHEMA_VERSION,
  BIOMINER_REVIEWED_LABEL_V2_FIELDS,
  mapFlickrVerificationEventsToReviewedLabels,
  type FlickrReviewedLabelExportConfig,
} from './flickrReviewedLabels'

const target: TaxonIdentity = {
  acceptedTaxonKey: 'gbif:1938069',
  scientificName: 'Papilio demoleus',
  commonName: 'lime swallowtail',
  rank: 'species',
  authority: 'Linnaeus, 1758',
}
const alternative: TaxonIdentity = {
  acceptedTaxonKey: 'gbif:1938224',
  scientificName: 'Papilio polytes',
  commonName: null,
  rank: 'species',
  authority: null,
}
const biominerSha = 'b'.repeat(40)
const taxonomy: FlickrReviewedLabelExportConfig = {
  taxonomyByAcceptedTaxonKey: {
    [target.acceptedTaxonKey]: {
      acceptedTaxonKey: target.acceptedTaxonKey,
      scientificName: target.scientificName,
      familyKey: 'gbif:9417',
      family: 'Papilionidae',
      genusKey: 'gbif:1938052',
      genus: 'Papilio',
    },
    [alternative.acceptedTaxonKey]: {
      acceptedTaxonKey: alternative.acceptedTaxonKey,
      scientificName: alternative.scientificName,
      familyKey: 'gbif:9417',
      family: 'Papilionidae',
      genusKey: 'gbif:1938052',
      genus: 'Papilio',
    },
  },
}

describe('Flickr reviewed-label v2 mapper', () => {
  it('maps human outcomes to exact conservative BioMiner v2 rows', async () => {
    const packet = await campaignPacket()
    const [yesItem, noItem, uncertainItem, mediaFailureItem] = packet.items
    const rows = mapFlickrVerificationEventsToReviewedLabels(
      packet.campaign,
      packet.items,
      [
        event(packet.campaign, yesItem!, {
          eventId: 'event-yes',
          outcome: 'yes',
          confidence: 'high',
          reviewedAt: '2026-07-16T12:00:00.000Z',
        }),
        event(packet.campaign, noItem!, {
          eventId: 'event-no',
          outcome: 'no',
          nonTargetCategory: 'alternative_species',
          alternativeTaxon: alternative,
          confidence: 'medium',
          reviewedAt: '2026-07-16T12:01:00.000Z',
        }),
        event(packet.campaign, uncertainItem!, {
          eventId: 'event-uncertain',
          outcome: 'cant_tell',
          confidence: 'low',
          reviewedAt: '2026-07-16T12:02:00.000Z',
        }),
        event(packet.campaign, mediaFailureItem!, {
          eventId: 'event-cant-view',
          outcome: 'cant_view',
          reviewedAt: '2026-07-16T12:03:00.000Z',
        }),
      ],
      taxonomy,
    )

    expect(rows).toHaveLength(3)
    expect(Object.keys(rows[0]!).sort()).toEqual(
      [...BIOMINER_REVIEWED_LABEL_V2_FIELDS].sort(),
    )
    expect(rows[0]).toMatchObject({
      schema_version: BIOMINER_REVIEWED_LABEL_SCHEMA_VERSION,
      source: 'flickr',
      target_present: true,
      accepted_taxon_key: target.acceptedTaxonKey,
      scientific_name: target.scientificName,
      label_certainty: 'high',
      life_stage: 'adult',
      visual_domain: 'live_field',
      view: 'dorsal',
      route: 'adult_field',
      source_query_tier: 'T1',
      source_query_term: target.scientificName,
      dataset_split: 'final_test',
      second_review_status: 'not_required',
      ambiguity_reason: '',
      unsuitable_for_species_identification: false,
    })
    expect(rows[1]).toMatchObject({
      target_present: false,
      accepted_taxon_key: alternative.acceptedTaxonKey,
      scientific_name: alternative.scientificName,
      review_confidence: 'medium',
      unsuitable_for_species_identification: false,
    })
    expect(rows[2]).toMatchObject({
      target_present: null,
      accepted_taxon_key: null,
      second_review_status: 'second_review_required',
      ambiguity_reason: 'human_reviewer_cant_tell',
      unsuitable_for_species_identification: true,
    })
    expect(
      rows.every(
        (row) =>
          row.detection_id.startsWith('flickr-media:') &&
          /^sha256:[a-f0-9]{64}$/.test(row.crop_hash),
      ),
    ).toBe(true)
  })

  it('refuses to invent lineage for a named alternative species', async () => {
    const packet = await campaignPacket()
    const noItem = packet.items[1]!

    expect(() =>
      mapFlickrVerificationEventsToReviewedLabels(
        packet.campaign,
        packet.items,
        [
          event(packet.campaign, noItem, {
            eventId: 'event-no',
            outcome: 'no',
            nonTargetCategory: 'alternative_species',
            alternativeTaxon: alternative,
            reviewedAt: '2026-07-16T12:01:00.000Z',
          }),
        ],
        {
          taxonomyByAcceptedTaxonKey: {
            [target.acceptedTaxonKey]:
              taxonomy.taxonomyByAcceptedTaxonKey[
                target.acceptedTaxonKey
              ]!,
          },
        },
      ),
    ).toThrow(
      'Reviewed-label alternative taxonomy lineage is unavailable or stale.',
    )
  })
})

async function campaignPacket() {
  return buildFlickrAuditCampaign(
    [
      source(1, 'owner-a'),
      source(2, 'owner-b'),
      source(3, 'owner-c'),
      source(4, 'owner-d'),
    ],
    {
      title: 'Flickr reviewed-label export',
      description: 'Synthetic export mapping campaign.',
      targetTaxon: target,
      selectionSeed: 'reviewed-label-export',
      ownerGroupTargetByStratum: { export: 4 },
      requiredIndependentReviewers: 1,
      taxalensSha: 'a'.repeat(40),
      biominerSha,
    },
  )
}

function source(index: number, owner: string): FlickrVerificationSource {
  return {
    schemaVersion: FLICKR_VERIFICATION_SOURCE_SCHEMA_VERSION,
    flickrRecordId: `flickr-record:${index}`,
    flickrPhotoId: String(30_000 + index),
    fullFrameMedia: {
      mediaId: `flickr-media:${index}`,
      previewUri: `https://example.invalid/${index}.jpg`,
      mediaType: 'image/jpeg',
      sha256: index.toString(16).padStart(64, '0'),
      byteCount: 30_000 + index,
      checksumVerified: true,
      rights: {
        creator: owner,
        rightsHolder: owner,
        licenseName: 'CC BY 4.0',
        licenseUri: 'https://creativecommons.org/licenses/by/4.0/',
        policyStatus: 'allowed',
        attribution: `${owner} / CC BY 4.0`,
        sourceUri: `https://www.flickr.com/photos/${owner}/${30_000 + index}`,
      },
    },
    duplicateGroupId: `duplicate:${index}`,
    ownerGroupId: `flickr-owner:${owner}`,
    observationGroupId: `observation:${index}`,
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
      fingerprint: `sha256:${'c'.repeat(64)}`,
    },
    targetScoreBand: 'high',
    decisionState: 'target',
    competitorMarginBand: 'clear_positive',
    samplingStratumId: 'export',
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
      evidenceFingerprint: `sha256:${'d'.repeat(64)}`,
    },
    sourceArtifactFingerprint: `sha256:${index
      .toString(16)
      .padStart(64, 'e')}`,
    biominerSha,
  }
}

function event(
  campaign: VerificationCampaign,
  item: VerificationItem,
  values: {
    readonly eventId: string
    readonly outcome: VerificationEvent['outcome']
    readonly reviewedAt: string
    readonly confidence?: VerificationEvent['confidence']
    readonly nonTargetCategory?: VerificationEvent['nonTargetCategory']
    readonly alternativeTaxon?: TaxonIdentity | null
  },
): VerificationEvent {
  return {
    schemaVersion: VERIFICATION_EVENT_SCHEMA_VERSION,
    eventId: values.eventId,
    campaignId: campaign.campaignId,
    itemId: item.itemId,
    reviewerId: 'reviewer-a',
    reviewRound: 1,
    outcome: values.outcome,
    comment: null,
    nonTargetCategory: values.nonTargetCategory ?? null,
    alternativeTaxon: values.alternativeTaxon ?? null,
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
    confidence: values.confidence ?? 'unknown',
    reviewedAt: values.reviewedAt,
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
