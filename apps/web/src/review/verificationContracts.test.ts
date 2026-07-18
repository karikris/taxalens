import { describe, expect, it } from 'vitest'

import {
  VERIFICATION_CAMPAIGN_SCHEMA_VERSION,
  isVerificationCampaignKind,
  validateReviewRequirement,
  validateSamplingPlan,
  validateVerificationItem,
  type ReviewRequirement,
  type SamplingPlan,
  type TaxonIdentity,
  type VerificationCampaign,
  type VerificationItem,
} from './domain/verificationContracts'

describe('verification campaign contracts', () => {
  it('recognizes the five closed campaign kinds', () => {
    expect(isVerificationCampaignKind('flickr_target_verification')).toBe(true)
    expect(isVerificationCampaignKind('reference_identity_verification')).toBe(
      true,
    )
    expect(isVerificationCampaignKind('reference_route_verification')).toBe(
      true,
    )
    expect(isVerificationCampaignKind('adjudication')).toBe(true)
    expect(isVerificationCampaignKind('quality_control')).toBe(true)
    expect(isVerificationCampaignKind('generic_review')).toBe(false)
  })

  it('rejects conflict requirements without independent reviewer overlap', () => {
    const requirement: ReviewRequirement = {
      requiredIndependentReviewers: 1,
      secondReviewPolicy: 'on_conflict',
      adjudicationRequiredOnConflict: true,
      decisiveOutcomes: ['yes', 'no'],
      mediaRequiredOutcomes: ['yes', 'no', 'cant_tell'],
      nonScientificOutcomes: ['cant_view', 'skipped'],
    }

    expect(validateReviewRequirement(requirement)).toContain(
      'conflict adjudication requires at least two independent reviewers',
    )
  })

  it('blocks quality estimates for a targeted failure-discovery design', () => {
    const plan: SamplingPlan = {
      planId: 'failure-discovery-v1',
      purpose: 'failure_discovery',
      design: 'targeted_priority',
      representative: false,
      blindReview: false,
      selectionSeed: null,
      targetSampleSize: 50,
      inclusionProbabilityRequired: false,
      independentUnit: 'observation_group',
      groupingKeys: ['duplicate_group', 'observation_group', 'owner_group'],
      leakagePolicy: 'model_selection_only',
      strata: [],
      qualityEstimationAllowed: false,
      qualityEstimationBlockedReason:
        'Targeted priority queues are not unweighted population samples.',
    }

    expect(validateSamplingPlan(plan)).toEqual([])
    expect(
      validateSamplingPlan({
        ...plan,
        qualityEstimationAllowed: true,
        qualityEstimationBlockedReason: null,
      }),
    ).toContain(
      'quality estimation requires a representative probability sampling design',
    )
  })

  it('binds an item to campaign, media, sampling, rights, and question provenance', () => {
    const targetTaxon: TaxonIdentity = {
      acceptedTaxonKey: 'gbif:1938069',
      scientificName: 'Papilio demoleus',
      commonName: 'lime swallowtail',
      rank: 'species',
      authority: 'Linnaeus, 1758',
    }
    const campaign: VerificationCampaign = {
      schemaVersion: VERIFICATION_CAMPAIGN_SCHEMA_VERSION,
      campaignId: 'commons-review-v1',
      title: 'Credential-free verification fixture',
      description: 'A fixed local review fixture.',
      kind: 'reference_identity_verification',
      status: 'active',
      targetTaxon,
      sourceProviders: ['wikimedia_commons'],
      reviewRequirement: {
        requiredIndependentReviewers: 1,
        secondReviewPolicy: 'never',
        adjudicationRequiredOnConflict: false,
        decisiveOutcomes: ['yes', 'no'],
        mediaRequiredOutcomes: ['yes', 'no', 'cant_tell'],
        nonScientificOutcomes: ['cant_view', 'skipped'],
      },
      samplingPlan: {
        planId: 'fixed-commons-fixture-v1',
        purpose: 'credential_free_fixture',
        design: 'fixed_fixture',
        representative: false,
        blindReview: false,
        selectionSeed: null,
        targetSampleSize: 3,
        inclusionProbabilityRequired: false,
        independentUnit: 'media',
        groupingKeys: ['duplicate_group', 'observation_group', 'owner_group'],
        leakagePolicy: 'support_only',
        strata: [
          {
            stratumId: 'fixture',
            label: 'Credential-free fixture',
            populationCount: null,
            targetSampleCount: 3,
            populationWeight: null,
            selectionNotes: 'Curated fixture; not a probability sample.',
          },
        ],
        qualityEstimationAllowed: false,
        qualityEstimationBlockedReason:
          'A fixed fixture cannot estimate population quality.',
      },
      disclosurePolicy: {
        mode: 'unblinded',
        revealAfterDecision: false,
        hiddenBeforeDecision: [],
      },
      questionFingerprint: 'question-v1',
      manifestSha256:
        '1bf4b4284cc98dba7699a0a56bab74509f61f1d3ebf9ae69e3a725611fcc5d27',
      taxalensSha: '85dd7f9',
      biominerSha: null,
      publicReplay: true,
      scientificClaimAllowed: false,
    }
    const item: VerificationItem = {
      itemId: 'commons-papilio-demoleus-open-wing',
      campaignId: campaign.campaignId,
      source: 'wikimedia_commons',
      sourceObservationId: 'commons-file:open-wing',
      sourceMediaId: 'commons-file:open-wing',
      imageSha256:
        '47248e36944cf91256c906e8454adcad99121da049260745d57f4cbffae65a78',
      imageByteCount: 180_698,
      mediaType: 'image/jpeg',
      previewUri: 'https://example.invalid/open-wing.jpg',
      targetTaxon,
      providerSuppliedIdentity: {
        providerTaxonKey: null,
        scientificName: 'Papilio demoleus',
        commonName: 'lime swallowtail',
        rawLabel: 'Common Lime Butterfly Papilio demoleus',
        verificationStatus: null,
      },
      expectedLifeStage: 'adult',
      expectedVisualDomain: 'live_field',
      expectedView: 'dorsal',
      duplicateGroupId: 'sha256:47248e36',
      observationGroupId: 'commons-file:open-wing',
      ownerPhotographerGroupId: 'commons-creator:jeevan-jose',
      samplingStratumId: 'fixture',
      inclusionProbability: null,
      rights: {
        creator: 'Jeevan Jose',
        rightsHolder: 'Jeevan Jose',
        licenseName: 'CC BY-SA 4.0',
        licenseUri: 'https://creativecommons.org/licenses/by-sa/4.0/',
        policyStatus: 'allowed',
        attribution: 'Common Lime Butterfly Papilio demoleus by Jeevan Jose',
        sourceUri: 'https://commons.wikimedia.org/wiki/File:Open_wing.jpg',
      },
      questionFingerprint: campaign.questionFingerprint,
    }

    expect(validateVerificationItem(item, campaign)).toEqual([])
    expect(
      validateVerificationItem(
        {
          ...item,
          source: 'flickr',
          inclusionProbability: 0,
          questionFingerprint: 'changed-question',
        },
        campaign,
      ),
    ).toEqual([
      'item source is not declared by the campaign',
      'item question fingerprint does not match the campaign',
      'inclusionProbability must be null or greater than zero and at most one',
    ])
  })

  it('validates BioMiner provider, licence, observer, and geography provenance', () => {
    const targetTaxon: TaxonIdentity = {
      acceptedTaxonKey: 'gbif:1938069',
      scientificName: 'Papilio demoleus',
      commonName: null,
      rank: 'other',
      authority: null,
    }
    const campaign: VerificationCampaign = {
      schemaVersion: VERIFICATION_CAMPAIGN_SCHEMA_VERSION,
      campaignId: 'biominer-reference-fixture',
      title: 'BioMiner reference fixture',
      description: 'A provider-provenance contract fixture.',
      kind: 'reference_identity_verification',
      status: 'ready',
      targetTaxon,
      sourceProviders: ['gbif'],
      reviewRequirement: {
        requiredIndependentReviewers: 1,
        secondReviewPolicy: 'on_conflict_or_uncertain',
        adjudicationRequiredOnConflict: false,
        decisiveOutcomes: ['yes', 'no'],
        mediaRequiredOutcomes: ['yes', 'no', 'cant_tell'],
        nonScientificOutcomes: ['cant_view', 'skipped'],
      },
      samplingPlan: {
        planId: 'biominer-priority-fixture',
        purpose: 'reference_readiness',
        design: 'targeted_priority',
        representative: false,
        blindReview: false,
        selectionSeed: null,
        targetSampleSize: 1,
        inclusionProbabilityRequired: false,
        independentUnit: 'duplicate_group',
        groupingKeys: ['duplicate_group', 'observation_group', 'owner_group'],
        leakagePolicy: 'support_only',
        strata: [
          {
            stratumId: 'provider-gbif',
            label: 'GBIF reference queue',
            populationCount: null,
            targetSampleCount: 1,
            populationWeight: null,
            selectionNotes: 'Priority fixture; not a probability sample.',
          },
        ],
        qualityEstimationAllowed: false,
        qualityEstimationBlockedReason:
          'A priority fixture cannot estimate population quality.',
      },
      disclosurePolicy: {
        mode: 'unblinded',
        revealAfterDecision: false,
        hiddenBeforeDecision: [],
      },
      questionFingerprint: 'reference-question-v1',
      manifestSha256:
        '1bf4b4284cc98dba7699a0a56bab74509f61f1d3ebf9ae69e3a725611fcc5d27',
      taxalensSha: '1fec3b9',
      biominerSha: '94fa1f6',
      publicReplay: false,
      scientificClaimAllowed: false,
    }
    const item: VerificationItem = {
      itemId: 'reference-review-request:fixture',
      campaignId: campaign.campaignId,
      source: 'gbif',
      sourceObservationId: '300000001',
      sourceMediaId: 'reference-media:fixture',
      imageSha256:
        '47248e36944cf91256c906e8454adcad99121da049260745d57f4cbffae65a78',
      imageByteCount: 12_345,
      mediaType: 'image/jpeg',
      previewUri: 's3://biominer-references/fixture.jpg',
      targetTaxon,
      providerSuppliedIdentity: {
        providerTaxonKey: '1938069',
        scientificName: 'Papilio demoleus',
        commonName: null,
        rawLabel: 'Papilio demoleus',
        verificationStatus: 'accepted',
      },
      expectedLifeStage: 'adult',
      expectedVisualDomain: 'live_field',
      expectedView: 'dorsal',
      duplicateGroupId: 'reference-duplicate-group:fixture',
      observationGroupId: 'reference-observation:fixture',
      ownerPhotographerGroupId: 'biominer-owner:fixture',
      samplingStratumId: 'provider-gbif',
      inclusionProbability: null,
      rights: {
        creator: 'Example observer',
        rightsHolder: 'Example observer',
        licenseName: 'CC-BY-4.0',
        licenseUri: 'https://creativecommons.org/licenses/by/4.0/',
        policyStatus: 'allowed',
        attribution: 'Example observer / CC BY 4.0',
        sourceUri: 'https://example.test/occurrence/300000001',
      },
      sourceProvenance: {
        provider: 'gbif',
        providerLabel: 'GBIF',
        originalProvider: 'Atlas of Living Australia',
        referenceObservationId: 'reference-observation:fixture',
        sourceObservationId: '300000001',
        providerMediaId: 'provider-photo-1',
        occurrenceLicense: 'CC0-1.0',
        mediaLicense: {
          name: 'CC-BY-4.0',
          uri: 'https://creativecommons.org/licenses/by/4.0/',
          policyStatus: 'allowed',
        },
        observerId: 'observer-1',
        observedAt: '2025-01-02T03:04:00.000Z',
        fallbackLevel: 0,
        geography: {
          locality: 'Sydney',
          country: 'Australia',
          countryCode: 'AU',
          latitude: -33.87,
          longitude: 151.21,
          coordinateUncertaintyMeters: 10,
          coordinatesObscured: false,
          geographicClusterId: 'geo-cluster-1',
        },
        providerVerificationStatus: 'accepted',
      },
      questionFingerprint: campaign.questionFingerprint,
    }

    expect(validateVerificationItem(item, campaign)).toEqual([])
    expect(
      validateVerificationItem(
        {
          ...item,
          sourceProvenance: {
            ...item.sourceProvenance!,
            provider: 'inaturalist',
            sourceObservationId: 'changed-observation',
            providerMediaId: '',
            mediaLicense: {
              ...item.sourceProvenance!.mediaLicense,
              name: 'CC0-1.0',
            },
            geography: {
              ...item.sourceProvenance!.geography,
              longitude: null,
            },
          },
        },
        campaign,
      ),
    ).toEqual([
      'source provenance provider does not match the item source',
      'source provenance observation does not match the item source observation',
      'source provenance requires a provider media ID',
      'source provenance media licence does not match item rights',
      'source provenance coordinates must be populated together',
    ])
  })
})
