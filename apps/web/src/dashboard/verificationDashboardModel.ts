export interface VerificationCampaignCatalogEntry {
  readonly campaignId: string
  readonly title: string
  readonly kind:
    | 'flickr_target_verification'
    | 'reference_identity_verification'
    | 'quality_control'
  readonly status: 'active' | 'ready'
  readonly itemCount: number
  readonly sourceLabel: string
  readonly access: 'public_local' | 'private_review'
  readonly purpose: string
  readonly manifestSha256: string
}

export const VERIFICATION_CAMPAIGN_CATALOG = Object.freeze([
  Object.freeze({
    campaignId: 'papilio-demoleus-commons-review-v1',
    title: 'Commons local workflow fixture',
    kind: 'reference_identity_verification' as const,
    status: 'active' as const,
    itemCount: 3,
    sourceLabel: 'Wikimedia Commons',
    access: 'public_local' as const,
    purpose: 'Credential-free local review and export',
    manifestSha256:
      '37bc1dcc781409a5adbd5c4882c71ad7dcf8862b1e8da7040e8ea399c5c6dd81',
  }),
  Object.freeze({
    campaignId: 'flickr-audit-fa3dbbb5e5a678f38eb7e7cd',
    title: 'Flickr owner-group audit',
    kind: 'flickr_target_verification' as const,
    status: 'ready' as const,
    itemCount: 49,
    sourceLabel: 'Flickr',
    access: 'private_review' as const,
    purpose: 'Probability audit for future target-precision estimation',
    manifestSha256:
      'fa3dbbb5e5a678f38eb7e7cd210f2b6773670ca033303dcf8be55a0fd7360809',
  }),
  Object.freeze({
    campaignId: 'reference-audit-8adc6d35657a54fac32a536d',
    title: 'GBIF and iNaturalist reference audit',
    kind: 'reference_identity_verification' as const,
    status: 'ready' as const,
    itemCount: 24,
    sourceLabel: 'GBIF · iNaturalist',
    access: 'private_review' as const,
    purpose: 'Targeted identity and reference-route readiness',
    manifestSha256:
      '8adc6d35657a54fac32a536d6a487c36de343bd27cc2d3905048e4e4817ae6ab',
  }),
  Object.freeze({
    campaignId: 'reviewer-controls-60f6731c51ea2c5d01643899',
    title: 'Reviewer workflow controls',
    kind: 'quality_control' as const,
    status: 'ready' as const,
    itemCount: 6,
    sourceLabel: 'Commons · TaxaLens fixtures',
    access: 'private_review' as const,
    purpose: 'Positive, negative, ambiguity, duplicate, failure, adjudication',
    manifestSha256:
      '60f6731c51ea2c5d01643899144b8ba906fd24d38400537490638140087192db',
  }),
] satisfies readonly VerificationCampaignCatalogEntry[])

export const VERIFICATION_ASSIGNMENT_COUNT = VERIFICATION_CAMPAIGN_CATALOG.reduce(
  (total, campaign) => total + campaign.itemCount,
  0,
)

export const FLICKR_QUALITY_MILESTONES = Object.freeze([20, 40] as const)

export interface LocalVerificationDashboardState {
  readonly availability: 'loading' | 'available' | 'unavailable'
  readonly decisiveItemCount: number
  readonly attemptedItemCount: number
  readonly conflictItemCount: number
  readonly eventCount: number
  readonly reason: string | null
}

export interface VerificationDashboardView {
  readonly campaigns: readonly VerificationCampaignCatalogEntry[]
  readonly coverage: {
    readonly decisiveItemCount: number
    readonly assignmentCount: number
    readonly percent: number
    readonly localAvailability: LocalVerificationDashboardState['availability']
    readonly attemptedItemCount: number
    readonly eventCount: number
  }
  readonly referenceReadiness: {
    readonly status: 'blocked'
    readonly independentlyVerifiedRecordCount: 0
    readonly providerRoleSuitableRecordCount: 81
    readonly blocker: 'independent_taxonomic_verification_missing'
  }
  readonly conflicts: {
    readonly localCount: number
    readonly localAvailability: LocalVerificationDashboardState['availability']
    readonly crossCampaignAvailability: 'unavailable'
  }
  readonly qualityInterval: {
    readonly availability: 'unavailable'
    readonly decisiveFlickrAuditCount: 0
    readonly nextMilestone: 20
    readonly reason: string
  }
  readonly nextReviewMilestone:
    | {
        readonly kind: 'local_workflow'
        readonly target: 3
        readonly current: number
        readonly remaining: number
        readonly label: string
      }
    | {
        readonly kind: 'flickr_quality'
        readonly target: 20
        readonly current: 0
        readonly remaining: 20
        readonly label: string
      }
  readonly localReason: string | null
}

export function createVerificationDashboardView(
  local: LocalVerificationDashboardState,
): VerificationDashboardView {
  assertLocalState(local)
  const decisive =
    local.availability === 'available' ? local.decisiveItemCount : 0
  const localMilestoneComplete = decisive >= 3
  return Object.freeze({
    campaigns: VERIFICATION_CAMPAIGN_CATALOG,
    coverage: Object.freeze({
      decisiveItemCount: decisive,
      assignmentCount: VERIFICATION_ASSIGNMENT_COUNT,
      percent:
        VERIFICATION_ASSIGNMENT_COUNT === 0
          ? 0
          : decisive / VERIFICATION_ASSIGNMENT_COUNT,
      localAvailability: local.availability,
      attemptedItemCount:
        local.availability === 'available' ? local.attemptedItemCount : 0,
      eventCount: local.availability === 'available' ? local.eventCount : 0,
    }),
    referenceReadiness: Object.freeze({
      status: 'blocked',
      independentlyVerifiedRecordCount: 0,
      providerRoleSuitableRecordCount: 81,
      blocker: 'independent_taxonomic_verification_missing',
    }),
    conflicts: Object.freeze({
      localCount:
        local.availability === 'available' ? local.conflictItemCount : 0,
      localAvailability: local.availability,
      crossCampaignAvailability: 'unavailable',
    }),
    qualityInterval: Object.freeze({
      availability: 'unavailable',
      decisiveFlickrAuditCount: 0,
      nextMilestone: FLICKR_QUALITY_MILESTONES[0],
      reason:
        'No decisive, inclusion-weighted Flickr audit outcomes are committed.',
    }),
    nextReviewMilestone: localMilestoneComplete
      ? Object.freeze({
          kind: 'flickr_quality',
          target: FLICKR_QUALITY_MILESTONES[0],
          current: 0,
          remaining: FLICKR_QUALITY_MILESTONES[0],
          label: 'Reach the first private Flickr quality checkpoint',
        })
      : Object.freeze({
          kind: 'local_workflow',
          target: 3,
          current: decisive,
          remaining: 3 - decisive,
          label: 'Complete the credential-free local workflow',
        }),
    localReason: local.reason,
  })
}

function assertLocalState(local: LocalVerificationDashboardState): void {
  for (const [field, value] of Object.entries({
    decisiveItemCount: local.decisiveItemCount,
    attemptedItemCount: local.attemptedItemCount,
    conflictItemCount: local.conflictItemCount,
    eventCount: local.eventCount,
  })) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`${field} must be a non-negative integer`)
    }
  }
  if (
    local.decisiveItemCount > local.attemptedItemCount ||
    local.attemptedItemCount > 3 ||
    local.conflictItemCount > local.attemptedItemCount
  ) {
    throw new Error('local verification counts are inconsistent')
  }
  if (
    local.availability === 'unavailable' &&
    (local.reason === null || local.reason.trim() === '')
  ) {
    throw new Error('unavailable local verification requires a reason')
  }
}
