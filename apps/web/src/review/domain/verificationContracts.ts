export const VERIFICATION_CAMPAIGN_SCHEMA_VERSION =
  'taxalens-verification-campaign:v1.0.0' as const

export const VERIFICATION_CAMPAIGN_KINDS = Object.freeze([
  'flickr_target_verification',
  'reference_identity_verification',
  'reference_route_verification',
  'adjudication',
  'quality_control',
] as const)

export type VerificationCampaignKind =
  (typeof VERIFICATION_CAMPAIGN_KINDS)[number]

export type VerificationCampaignStatus =
  | 'draft'
  | 'ready'
  | 'active'
  | 'paused'
  | 'complete'
  | 'archived'

export type SourceProvider =
  | 'flickr'
  | 'gbif'
  | 'inaturalist'
  | 'wikimedia_commons'
  | 'taxalens_fixture'

export const VERIFICATION_LIFE_STAGES = Object.freeze([
  'adult',
  'larva',
  'pupa',
  'egg',
  'unknown',
] as const)

export type VerificationLifeStage =
  (typeof VERIFICATION_LIFE_STAGES)[number]

export const VERIFICATION_VISUAL_DOMAINS = Object.freeze([
  'live_field',
  'pinned_specimen',
  'artwork',
  'logo',
  'tattoo',
  'partial_wing',
  'dead_or_damaged_specimen',
  'ambiguous',
  'unsuitable',
] as const)

export type VerificationVisualDomain =
  (typeof VERIFICATION_VISUAL_DOMAINS)[number]

export const VERIFICATION_VIEWS = Object.freeze([
  'dorsal',
  'ventral',
  'lateral',
  'frontal',
  'oblique',
  'unknown',
] as const)

export type VerificationView = (typeof VERIFICATION_VIEWS)[number]

export interface TaxonIdentity {
  readonly acceptedTaxonKey: string
  readonly scientificName: string
  readonly commonName: string | null
  readonly rank: 'species' | 'genus' | 'family' | 'other'
  readonly authority: string | null
}

export interface ReviewRequirement {
  readonly requiredIndependentReviewers: number
  readonly secondReviewPolicy:
    | 'never'
    | 'always'
    | 'on_conflict'
    | 'on_uncertain'
    | 'on_conflict_or_uncertain'
  readonly adjudicationRequiredOnConflict: boolean
  readonly decisiveOutcomes: readonly ['yes', 'no']
  readonly mediaRequiredOutcomes: readonly ['yes', 'no', 'cant_tell']
  readonly nonScientificOutcomes: readonly ['cant_view', 'skipped']
}

export interface SamplingStratum {
  readonly stratumId: string
  readonly label: string
  readonly populationCount: number | null
  readonly targetSampleCount: number | null
  readonly populationWeight: number | null
  readonly selectionNotes: string | null
}

export interface SamplingPlan {
  readonly planId: string
  readonly purpose:
    | 'credential_free_fixture'
    | 'quality_estimation'
    | 'failure_discovery'
    | 'reference_readiness'
    | 'adjudication'
    | 'reviewer_quality_control'
  readonly design:
    | 'fixed_fixture'
    | 'census'
    | 'simple_random'
    | 'stratified_random'
    | 'clustered_random'
    | 'targeted_priority'
    | 'control_items'
  readonly representative: boolean
  readonly blindReview: boolean
  readonly selectionSeed: string | null
  readonly targetSampleSize: number | null
  readonly inclusionProbabilityRequired: boolean
  readonly independentUnit:
    | 'media'
    | 'observation_group'
    | 'duplicate_group'
    | 'owner_group'
    | 'configured_cluster'
  readonly groupingKeys: readonly (
    | 'duplicate_group'
    | 'observation_group'
    | 'owner_group'
    | 'geographic_cluster'
  )[]
  readonly leakagePolicy:
    | 'not_applicable'
    | 'support_only'
    | 'model_selection_only'
    | 'calibration_only'
    | 'final_test_only'
    | 'leakage_safe_partitioned'
  readonly strata: readonly SamplingStratum[]
  readonly qualityEstimationAllowed: boolean
  readonly qualityEstimationBlockedReason: string | null
}

export interface VerificationCampaign {
  readonly schemaVersion: typeof VERIFICATION_CAMPAIGN_SCHEMA_VERSION
  readonly campaignId: string
  readonly title: string
  readonly description: string
  readonly kind: VerificationCampaignKind
  readonly status: VerificationCampaignStatus
  readonly targetTaxon: TaxonIdentity | null
  readonly sourceProviders: readonly SourceProvider[]
  readonly reviewRequirement: ReviewRequirement
  readonly samplingPlan: SamplingPlan
  readonly disclosurePolicy: {
    readonly mode: 'blind' | 'unblinded'
    readonly revealAfterDecision: boolean
    readonly hiddenBeforeDecision: readonly string[]
  }
  readonly questionFingerprint: string
  readonly manifestSha256: string
  readonly taxalensSha: string
  readonly biominerSha: string | null
  readonly publicReplay: boolean
  readonly scientificClaimAllowed: boolean
}

export interface ProviderSuppliedIdentity {
  readonly providerTaxonKey: string | null
  readonly scientificName: string | null
  readonly commonName: string | null
  readonly rawLabel: string | null
  readonly verificationStatus: string | null
}

export interface VerificationItemRights {
  readonly creator: string | null
  readonly rightsHolder: string | null
  readonly licenseName: string
  readonly licenseUri: string
  readonly policyStatus: 'allowed' | 'restricted' | 'pending' | 'unknown'
  readonly attribution: string
  readonly sourceUri: string
}

export interface ReferenceSourceProvenance {
  readonly provider: 'gbif' | 'inaturalist'
  readonly providerLabel: 'GBIF' | 'iNaturalist'
  readonly originalProvider: string | null
  readonly referenceObservationId: string
  readonly sourceObservationId: string
  readonly providerMediaId: string
  readonly occurrenceLicense: string | null
  readonly mediaLicense: {
    readonly name: string
    readonly uri: string
    readonly policyStatus: VerificationItemRights['policyStatus']
  }
  readonly observerId: string | null
  readonly observedAt: string | null
  readonly fallbackLevel: number
  readonly geography: {
    readonly locality: string | null
    readonly country: string | null
    readonly countryCode: string | null
    readonly latitude: number | null
    readonly longitude: number | null
    readonly coordinateUncertaintyMeters: number | null
    readonly coordinatesObscured: boolean
    readonly geographicClusterId: string | null
  }
  readonly providerVerificationStatus: string | null
}

export const FLICKR_VERIFICATION_SOURCE_SCHEMA_VERSION =
  'taxalens-flickr-verification-source:v1.1.0' as const

export type FlickrScoreBand =
  | 'not_scored'
  | 'low'
  | 'middle'
  | 'high'
  | 'unavailable'

export type FlickrCompetitorMarginBand =
  | 'negative'
  | 'near_tie'
  | 'small_positive'
  | 'clear_positive'
  | 'unavailable'

export type FlickrDecisionState =
  | 'target'
  | 'non_target'
  | 'abstain'
  | 'awaiting_human_review'
  | 'unavailable'

export type VerificationDatasetPartition =
  | 'support'
  | 'model_selection'
  | 'calibration'
  | 'final_test'

export interface FlickrVerificationPrioritySignals {
  readonly lowMargin: boolean | null
  readonly visualInputDisagreement: boolean | null
  readonly geographicAnomaly: boolean | null
  readonly commentConflict: boolean | null
  readonly smallSubject: boolean | null
  readonly referenceShortfall: boolean | null
  readonly unusualCompetitor: boolean | null
}

export type FlickrReferenceReviewState =
  | 'human_verified'
  | 'provider_supported'
  | 'candidate'
  | 'excluded'

export interface FlickrPostDecisionEvidence {
  readonly strongestCompetitors: readonly {
    readonly acceptedTaxonKey: string
    readonly scientificName: string
    readonly scoreBand: FlickrScoreBand
    readonly evidenceFingerprint: string
  }[]
  readonly references: readonly {
    readonly referenceId: string
    readonly acceptedTaxonKey: string
    readonly scientificName: string
    readonly role: 'target' | 'competitor'
    readonly provider: 'gbif' | 'inaturalist'
    readonly reviewState: FlickrReferenceReviewState
  }[]
  readonly comments: readonly {
    readonly commentId: string
    readonly text: string
  }[]
  readonly decisionReason: string | null
  readonly evidenceFingerprint: string
}

export interface FlickrVerificationSource {
  readonly schemaVersion: typeof FLICKR_VERIFICATION_SOURCE_SCHEMA_VERSION
  readonly flickrRecordId: string
  readonly flickrPhotoId: string
  readonly fullFrameMedia: {
    readonly mediaId: string
    readonly previewUri: string
    readonly mediaType: `image/${string}`
    readonly sha256: string
    readonly byteCount: number
    readonly checksumVerified: true
    readonly rights: VerificationItemRights
  }
  readonly duplicateGroupId: string
  readonly ownerGroupId: string
  readonly observationGroupId: string
  readonly geographicClusterId: string | null
  readonly coordinate: {
    readonly latitude: number | null
    readonly longitude: number | null
    readonly outlier: boolean | null
  }
  readonly query: {
    readonly tier: string
    readonly rank: string
    readonly trustTier: string
    readonly searchField: string
    readonly term: string
  }
  readonly route: {
    readonly routeLabel: string
    readonly lifeStage: VerificationLifeStage
    readonly visualDomain: VerificationVisualDomain
    readonly view: VerificationView
    readonly subjectAreaRatio: number | null
    readonly fingerprint: string
  }
  readonly targetScoreBand: FlickrScoreBand
  readonly decisionState: FlickrDecisionState
  readonly competitorMarginBand: FlickrCompetitorMarginBand
  readonly samplingStratumId: string
  readonly inclusionProbability: number | null
  readonly datasetPartition: VerificationDatasetPartition
  readonly prioritySignals: FlickrVerificationPrioritySignals
  readonly postDecisionEvidence: FlickrPostDecisionEvidence
  readonly sourceArtifactFingerprint: string
  readonly biominerSha: string
}

export interface VerificationItem {
  readonly itemId: string
  readonly campaignId: string
  readonly source: SourceProvider
  readonly sourceObservationId: string
  readonly sourceMediaId: string
  readonly imageSha256: string
  readonly imageByteCount: number
  readonly mediaType: `image/${string}`
  readonly previewUri: string
  readonly targetTaxon: TaxonIdentity
  readonly providerSuppliedIdentity: ProviderSuppliedIdentity
  readonly expectedLifeStage: VerificationLifeStage | null
  readonly expectedVisualDomain: VerificationVisualDomain | null
  readonly expectedView: VerificationView | null
  readonly duplicateGroupId: string
  readonly observationGroupId: string
  readonly ownerPhotographerGroupId: string
  readonly samplingStratumId: string
  readonly inclusionProbability: number | null
  readonly rights: VerificationItemRights
  readonly sourceProvenance?: ReferenceSourceProvenance
  readonly flickrSource?: FlickrVerificationSource
  readonly questionFingerprint: string
}

export function isVerificationCampaignKind(
  value: unknown,
): value is VerificationCampaignKind {
  return VERIFICATION_CAMPAIGN_KINDS.some((kind) => kind === value)
}

export function validateReviewRequirement(
  requirement: ReviewRequirement,
): readonly string[] {
  const failures: string[] = []
  if (!Number.isInteger(requirement.requiredIndependentReviewers)) {
    failures.push('requiredIndependentReviewers must be an integer')
  } else if (requirement.requiredIndependentReviewers < 1) {
    failures.push('requiredIndependentReviewers must be at least one')
  }
  if (
    requirement.adjudicationRequiredOnConflict &&
    requirement.requiredIndependentReviewers < 2
  ) {
    failures.push(
      'conflict adjudication requires at least two independent reviewers',
    )
  }
  return Object.freeze(failures)
}

export function validateSamplingPlan(
  plan: SamplingPlan,
): readonly string[] {
  const failures: string[] = []
  if (
    plan.qualityEstimationAllowed &&
    (!plan.representative ||
      plan.design === 'fixed_fixture' ||
      plan.design === 'targeted_priority')
  ) {
    failures.push(
      'quality estimation requires a representative probability sampling design',
    )
  }
  if (
    plan.inclusionProbabilityRequired &&
    !['simple_random', 'stratified_random', 'clustered_random'].includes(
      plan.design,
    )
  ) {
    failures.push(
      'inclusion probabilities require a declared probability sampling design',
    )
  }
  if (
    !plan.qualityEstimationAllowed &&
    plan.qualityEstimationBlockedReason === null
  ) {
    failures.push(
      'blocked quality estimation requires an explicit blocked reason',
    )
  }
  if (
    plan.targetSampleSize !== null &&
    (!Number.isInteger(plan.targetSampleSize) || plan.targetSampleSize < 1)
  ) {
    failures.push('targetSampleSize must be null or a positive integer')
  }
  return Object.freeze(failures)
}

export function validateVerificationItem(
  item: VerificationItem,
  campaign: VerificationCampaign,
): readonly string[] {
  const failures: string[] = []
  if (item.campaignId !== campaign.campaignId) {
    failures.push('item campaignId does not match the campaign')
  }
  if (!campaign.sourceProviders.includes(item.source)) {
    failures.push('item source is not declared by the campaign')
  }
  if (
    campaign.targetTaxon !== null &&
    item.targetTaxon.acceptedTaxonKey !== campaign.targetTaxon.acceptedTaxonKey
  ) {
    failures.push('item target taxon does not match the campaign')
  }
  if (item.questionFingerprint !== campaign.questionFingerprint) {
    failures.push('item question fingerprint does not match the campaign')
  }
  if (!/^[a-f0-9]{64}$/.test(item.imageSha256)) {
    failures.push('imageSha256 must be a lowercase SHA-256 digest')
  }
  if (!Number.isInteger(item.imageByteCount) || item.imageByteCount < 1) {
    failures.push('imageByteCount must be a positive integer')
  }
  if (
    item.inclusionProbability !== null &&
    (!Number.isFinite(item.inclusionProbability) ||
      item.inclusionProbability <= 0 ||
      item.inclusionProbability > 1)
  ) {
    failures.push(
      'inclusionProbability must be null or greater than zero and at most one',
    )
  }
  if (
    campaign.samplingPlan.inclusionProbabilityRequired &&
    item.inclusionProbability === null
  ) {
    failures.push('campaign sampling design requires an inclusion probability')
  }
  if (
    !campaign.samplingPlan.strata.some(
      (stratum) => stratum.stratumId === item.samplingStratumId,
    )
  ) {
    failures.push('item sampling stratum is not declared by the campaign')
  }
  if (item.rights.policyStatus === 'allowed' && item.rights.attribution === '') {
    failures.push('allowed media requires attribution')
  }
  if (item.sourceProvenance !== undefined) {
    const provenance = item.sourceProvenance
    if (provenance.provider !== item.source) {
      failures.push('source provenance provider does not match the item source')
    }
    if (provenance.sourceObservationId !== item.sourceObservationId) {
      failures.push(
        'source provenance observation does not match the item source observation',
      )
    }
    if (provenance.providerMediaId.trim() === '') {
      failures.push('source provenance requires a provider media ID')
    }
    if (
      !Number.isInteger(provenance.fallbackLevel) ||
      provenance.fallbackLevel < 0
    ) {
      failures.push('source provenance fallback level must be non-negative')
    }
    if (
      provenance.observedAt !== null &&
      !Number.isFinite(Date.parse(provenance.observedAt))
    ) {
      failures.push('source provenance observed date is invalid')
    }
    if (
      provenance.mediaLicense.name !== item.rights.licenseName ||
      provenance.mediaLicense.uri !== item.rights.licenseUri ||
      provenance.mediaLicense.policyStatus !== item.rights.policyStatus
    ) {
      failures.push('source provenance media licence does not match item rights')
    }
    const { latitude, longitude } = provenance.geography
    if ((latitude === null) !== (longitude === null)) {
      failures.push('source provenance coordinates must be populated together')
    } else if (
      latitude !== null &&
      longitude !== null &&
      (latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180)
    ) {
      failures.push('source provenance coordinates are outside valid bounds')
    }
  }
  if (item.flickrSource !== undefined) {
    const source = item.flickrSource
    if (
      item.source !== 'flickr' ||
      source.flickrPhotoId !== item.sourceObservationId ||
      source.fullFrameMedia.mediaId !== item.sourceMediaId ||
      source.fullFrameMedia.sha256 !== item.imageSha256 ||
      source.fullFrameMedia.byteCount !== item.imageByteCount ||
      source.fullFrameMedia.mediaType !== item.mediaType ||
      source.fullFrameMedia.previewUri !== item.previewUri ||
      source.duplicateGroupId !== item.duplicateGroupId ||
      source.ownerGroupId !== item.ownerPhotographerGroupId ||
      source.observationGroupId !== item.observationGroupId ||
      source.samplingStratumId !== item.samplingStratumId ||
      source.inclusionProbability !== item.inclusionProbability
    ) {
      failures.push('Flickr source does not match the verification item')
    }
  }
  return Object.freeze(failures)
}
