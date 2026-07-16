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
