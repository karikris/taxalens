import type {
  VerificationLifeStage,
  VerificationView,
  VerificationVisualDomain,
} from './verificationContracts'
import type {
  FlickrNonTargetCategory,
  VerificationEvent,
} from './verificationEvents'

export const VERIFICATION_CONSENSUS_SCHEMA_VERSION =
  'taxalens-verification-consensus:v1.0.0' as const

export const VERIFICATION_CONSENSUS_STATUSES = Object.freeze([
  'pending',
  'complete_agreement',
  'unresolved_disagreement',
  'uncertain_only',
  'media_failure',
  'deferred',
  'adjudicated',
] as const)

export type VerificationConsensusStatus =
  (typeof VERIFICATION_CONSENSUS_STATUSES)[number]

export const VERIFICATION_CONFLICT_FIELDS = Object.freeze([
  'outcome',
  'non_target_category',
  'alternative_taxon',
  'life_stage',
  'visual_domain',
  'view',
  'explicit_conflict_pointer',
] as const)

export type VerificationConflictField =
  (typeof VERIFICATION_CONFLICT_FIELDS)[number]

export interface VerificationDecisionSignature {
  readonly outcome: 'yes' | 'no'
  readonly nonTargetCategory: FlickrNonTargetCategory | null
  readonly alternativeAcceptedTaxonKey: string | null
  readonly lifeStage: VerificationLifeStage
  readonly visualDomain: VerificationVisualDomain
  readonly view: VerificationView
}

export type VerificationSupportEligibility =
  | 'not_applicable'
  | 'blocked'
  | 'prepared_for_biominer_resolution'

export type VerificationFinalTestEligibility =
  | 'not_applicable'
  | 'blocked'
  | 'eligible'

export interface VerificationConsensus {
  readonly schemaVersion: typeof VERIFICATION_CONSENSUS_SCHEMA_VERSION
  readonly campaignId: string
  readonly itemId: string
  readonly requiredReviewCount: number
  readonly effectiveReviewCount: number
  readonly decisiveReviewCount: number
  readonly effectiveReviewerIds: readonly string[]
  readonly latestEvents: readonly VerificationEvent[]
  readonly decisiveEvents: readonly VerificationEvent[]
  readonly status: VerificationConsensusStatus
  readonly consensusOutcome: 'yes' | 'no' | null
  readonly resolvedSignature: VerificationDecisionSignature | null
  readonly conflictingFields: readonly VerificationConflictField[]
  readonly conflictEventIds: readonly string[]
  readonly secondReviewRequired: boolean
  readonly adjudicationRequired: boolean
  readonly supportEligibility: VerificationSupportEligibility
  readonly supportEligibilityBlockers: readonly string[]
  readonly finalTestEligibility: VerificationFinalTestEligibility
  readonly finalTestEligibilityBlockers: readonly string[]
  readonly resolvedAt: string | null
}

export function validateVerificationConsensus(
  consensus: VerificationConsensus,
): readonly string[] {
  const failures: string[] = []
  if (consensus.schemaVersion !== VERIFICATION_CONSENSUS_SCHEMA_VERSION) {
    failures.push('consensus schema version is unsupported')
  }
  if (consensus.campaignId.trim() === '' || consensus.itemId.trim() === '') {
    failures.push('consensus campaign and item IDs must not be empty')
  }
  if (
    !Number.isInteger(consensus.requiredReviewCount) ||
    consensus.requiredReviewCount < 1
  ) {
    failures.push('consensus required review count must be a positive integer')
  }
  if (
    consensus.effectiveReviewCount !== consensus.latestEvents.length ||
    consensus.effectiveReviewCount !== consensus.effectiveReviewerIds.length
  ) {
    failures.push('consensus effective review counts do not match')
  }
  if (consensus.decisiveReviewCount !== consensus.decisiveEvents.length) {
    failures.push('consensus decisive review count does not match')
  }
  if (
    consensus.decisiveEvents.some(
      ({ outcome }) => outcome !== 'yes' && outcome !== 'no',
    )
  ) {
    failures.push('consensus decisive events contain a non-decisive outcome')
  }
  if (
    !sortedUnique(consensus.effectiveReviewerIds) ||
    !sortedUnique(consensus.conflictingFields) ||
    !sortedUnique(consensus.conflictEventIds) ||
    !sortedUnique(consensus.supportEligibilityBlockers) ||
    !sortedUnique(consensus.finalTestEligibilityBlockers)
  ) {
    failures.push('consensus identifiers and blocker fields must be sorted')
  }
  if (
    !VERIFICATION_CONSENSUS_STATUSES.includes(consensus.status) ||
    consensus.conflictingFields.some(
      (field) => !VERIFICATION_CONFLICT_FIELDS.includes(field),
    )
  ) {
    failures.push('consensus status or conflict field is unsupported')
  }
  const resolved =
    consensus.status === 'complete_agreement' ||
    consensus.status === 'adjudicated'
  if (
    resolved !==
    (consensus.consensusOutcome !== null &&
      consensus.resolvedSignature !== null)
  ) {
    failures.push('consensus resolved state is internally inconsistent')
  }
  if (
    consensus.status === 'unresolved_disagreement' &&
    (consensus.conflictingFields.length === 0 ||
      consensus.conflictEventIds.length === 0)
  ) {
    failures.push('unresolved consensus must identify its conflict')
  }
  if (
    consensus.status !== 'unresolved_disagreement' &&
    (consensus.conflictingFields.length > 0 ||
      consensus.conflictEventIds.length > 0)
  ) {
    failures.push('non-conflict consensus cannot carry conflict fields')
  }
  if (resolved && consensus.secondReviewRequired) {
    failures.push('resolved consensus cannot require a second review')
  }
  return Object.freeze(failures)
}

function sortedUnique(values: readonly string[]): boolean {
  return values.every(
    (value, index) =>
      value.trim() !== '' &&
      (index === 0 || values[index - 1]!.localeCompare(value) < 0),
  )
}
