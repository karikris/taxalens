import type {
  VerificationCampaign,
  VerificationItem,
  VerificationLifeStage,
  VerificationView,
  VerificationVisualDomain,
} from './verificationContracts'
import {
  validateVerificationItem,
} from './verificationContracts'
import {
  validateVerificationEvent,
  validateVerificationEventLedger,
  type FlickrNonTargetCategory,
  type VerificationEvent,
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

export function projectVerificationConsensus(
  campaign: VerificationCampaign,
  items: readonly VerificationItem[],
  events: readonly VerificationEvent[],
): readonly VerificationConsensus[] {
  const itemById = new Map<string, VerificationItem>()
  for (const item of items) {
    const failures = validateVerificationItem(item, campaign)
    if (failures.length > 0 || itemById.has(item.itemId)) {
      throw new Error(
        `Consensus item is invalid: ${[
          ...failures,
          ...(itemById.has(item.itemId) ? ['item ID is repeated'] : []),
        ].join('; ')}`,
      )
    }
    itemById.set(item.itemId, item)
  }
  const ledgerFailures = validateVerificationEventLedger(events)
  if (ledgerFailures.length > 0) {
    throw new Error(
      `Consensus event ledger is invalid: ${ledgerFailures.join('; ')}`,
    )
  }
  for (const event of events) {
    const item = itemById.get(event.itemId)
    if (item === undefined) {
      throw new Error(`Consensus event names an unknown item: ${event.itemId}`)
    }
    const failures = validateVerificationEvent(event, campaign, item)
    if (failures.length > 0) {
      throw new Error(`Consensus event is invalid: ${failures.join('; ')}`)
    }
  }
  const consensus = [...items]
    .sort((left, right) => left.itemId.localeCompare(right.itemId))
    .map((item) =>
      projectItemConsensus(
        campaign,
        item,
        events.filter(({ itemId }) => itemId === item.itemId),
      ),
    )
  return Object.freeze(consensus)
}

function projectItemConsensus(
  campaign: VerificationCampaign,
  item: VerificationItem,
  events: readonly VerificationEvent[],
): VerificationConsensus {
  const latestEvents = effectiveLatestEvents(events)
  const decisiveEvents = latestEvents.filter(
    ({ outcome }) => outcome === 'yes' || outcome === 'no',
  )
  const signatures = decisiveEvents.map((event) =>
    decisionSignature(event, item),
  )
  const conflictingFields = conflictFields(latestEvents, signatures)
  const conflictEventIds =
    conflictingFields.length === 0
      ? []
      : [
          ...new Set(
            latestEvents
              .filter(
                (event) =>
                  event.outcome === 'yes' ||
                  event.outcome === 'no' ||
                  event.conflictsWithDecisionId !== null,
              )
              .map(({ eventId }) => eventId),
          ),
        ].sort()
  const requiredReviewCount = effectiveRequiredReviewCount(campaign)
  const unresolvedUncertainty = hasUnresolvedUncertainty(
    events,
    decisiveEvents,
  )
  const resolution = resolutionState({
    campaign,
    latestEvents,
    decisiveEvents,
    signatures,
    conflictingFields,
    requiredReviewCount,
    unresolvedUncertainty,
  })
  const support = supportEligibility(item, decisiveEvents, resolution)
  const finalTest = finalTestEligibility(
    campaign,
    item,
    decisiveEvents,
    resolution,
  )
  const consensus: VerificationConsensus = Object.freeze({
    schemaVersion: VERIFICATION_CONSENSUS_SCHEMA_VERSION,
    campaignId: campaign.campaignId,
    itemId: item.itemId,
    requiredReviewCount,
    effectiveReviewCount: latestEvents.length,
    decisiveReviewCount: decisiveEvents.length,
    effectiveReviewerIds: Object.freeze(
      latestEvents.map(({ reviewerId }) => reviewerKey(reviewerId)).sort(),
    ),
    latestEvents: Object.freeze(latestEvents),
    decisiveEvents: Object.freeze(decisiveEvents),
    status: resolution.status,
    consensusOutcome: resolution.outcome,
    resolvedSignature: resolution.signature,
    conflictingFields: Object.freeze(conflictingFields),
    conflictEventIds: Object.freeze(conflictEventIds),
    secondReviewRequired: resolution.secondReviewRequired,
    adjudicationRequired:
      resolution.status === 'unresolved_disagreement' &&
      campaign.reviewRequirement.adjudicationRequiredOnConflict,
    supportEligibility: support.status,
    supportEligibilityBlockers: Object.freeze(support.blockers),
    finalTestEligibility: finalTest.status,
    finalTestEligibilityBlockers: Object.freeze(finalTest.blockers),
    resolvedAt:
      latestEvents.length === 0
        ? null
        : [...latestEvents]
            .sort(compareEvents)
            .at(-1)!.reviewedAt,
  })
  const failures = validateVerificationConsensus(consensus)
  if (failures.length > 0) {
    throw new Error(`Consensus projection is invalid: ${failures.join('; ')}`)
  }
  return consensus
}

function effectiveLatestEvents(
  events: readonly VerificationEvent[],
): readonly VerificationEvent[] {
  const superseded = new Set(
    events
      .map(({ supersedesEventId }) => supersedesEventId)
      .filter((eventId): eventId is string => eventId !== null),
  )
  const byReviewer = new Map<string, VerificationEvent>()
  for (const event of [...events]
    .filter(({ eventId }) => !superseded.has(eventId))
    .sort(compareEvents)) {
    byReviewer.set(reviewerKey(event.reviewerId), event)
  }
  return [...byReviewer.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, event]) => event)
}

function decisionSignature(
  event: VerificationEvent,
  item: VerificationItem,
): VerificationDecisionSignature {
  if (event.outcome !== 'yes' && event.outcome !== 'no') {
    throw new Error('Consensus signature requires a decisive event.')
  }
  return Object.freeze({
    outcome: event.outcome,
    nonTargetCategory: event.nonTargetCategory,
    alternativeAcceptedTaxonKey:
      event.alternativeTaxon?.acceptedTaxonKey ?? null,
    lifeStage:
      event.correctedLifeStage ?? item.expectedLifeStage ?? 'unknown',
    visualDomain:
      event.correctedVisualDomain ??
      item.expectedVisualDomain ??
      'ambiguous',
    view: event.correctedView ?? item.expectedView ?? 'unknown',
  })
}

function conflictFields(
  latestEvents: readonly VerificationEvent[],
  signatures: readonly VerificationDecisionSignature[],
): readonly VerificationConflictField[] {
  const fields: VerificationConflictField[] = []
  for (const [field, key] of [
    ['outcome', 'outcome'],
    ['non_target_category', 'nonTargetCategory'],
    ['alternative_taxon', 'alternativeAcceptedTaxonKey'],
    ['life_stage', 'lifeStage'],
    ['visual_domain', 'visualDomain'],
    ['view', 'view'],
  ] as const) {
    if (
      new Set(signatures.map((signature) => signature[key] ?? null)).size > 1
    ) {
      fields.push(field)
    }
  }
  if (
    latestEvents.some(({ conflictsWithDecisionId }) =>
      conflictsWithDecisionId !== null,
    )
  ) {
    fields.push('explicit_conflict_pointer')
  }
  return Object.freeze(fields.sort())
}

function hasUnresolvedUncertainty(
  history: readonly VerificationEvent[],
  decisiveEvents: readonly VerificationEvent[],
): boolean {
  return history
    .filter(({ outcome }) => outcome === 'cant_tell')
    .some(
      (uncertain) =>
        !decisiveEvents.some(
          (decisive) =>
            reviewerKey(decisive.reviewerId) !==
              reviewerKey(uncertain.reviewerId) &&
            decisive.reviewedAt > uncertain.reviewedAt,
        ),
    )
}

function resolutionState({
  campaign,
  latestEvents,
  decisiveEvents,
  signatures,
  conflictingFields,
  requiredReviewCount,
  unresolvedUncertainty,
}: {
  readonly campaign: VerificationCampaign
  readonly latestEvents: readonly VerificationEvent[]
  readonly decisiveEvents: readonly VerificationEvent[]
  readonly signatures: readonly VerificationDecisionSignature[]
  readonly conflictingFields: readonly VerificationConflictField[]
  readonly requiredReviewCount: number
  readonly unresolvedUncertainty: boolean
}): {
  readonly status: VerificationConsensusStatus
  readonly outcome: 'yes' | 'no' | null
  readonly signature: VerificationDecisionSignature | null
  readonly secondReviewRequired: boolean
} {
  if (latestEvents.length === 0) {
    return unresolved('pending', false)
  }
  if (conflictingFields.length > 0) {
    return unresolved('unresolved_disagreement', true)
  }
  if (decisiveEvents.length === 0) {
    if (latestEvents.some(({ outcome }) => outcome === 'cant_tell')) {
      return unresolved(
        'uncertain_only',
        campaign.reviewRequirement.secondReviewPolicy !== 'never',
      )
    }
    if (latestEvents.some(({ outcome }) => outcome === 'cant_view')) {
      return unresolved('media_failure', false)
    }
    return unresolved('deferred', false)
  }
  if (
    unresolvedUncertainty ||
    decisiveEvents.length < requiredReviewCount
  ) {
    return unresolved('pending', true)
  }
  const signature = signatures[0]!
  return {
    status:
      campaign.kind === 'adjudication'
        ? 'adjudicated'
        : 'complete_agreement',
    outcome: signature.outcome,
    signature,
    secondReviewRequired: false,
  }
}

function unresolved(
  status: Exclude<
    VerificationConsensusStatus,
    'complete_agreement' | 'adjudicated'
  >,
  secondReviewRequired: boolean,
) {
  return {
    status,
    outcome: null,
    signature: null,
    secondReviewRequired,
  } as const
}

function supportEligibility(
  item: VerificationItem,
  decisiveEvents: readonly VerificationEvent[],
  resolution: {
    readonly status: VerificationConsensusStatus
    readonly outcome: 'yes' | 'no' | null
    readonly signature: VerificationDecisionSignature | null
  },
): {
  readonly status: VerificationSupportEligibility
  readonly blockers: readonly string[]
} {
  if (item.source !== 'gbif' && item.source !== 'inaturalist') {
    return { status: 'not_applicable', blockers: [] }
  }
  const blockers: string[] = []
  if (
    resolution.status !== 'complete_agreement' &&
    resolution.status !== 'adjudicated'
  ) {
    blockers.push('review_not_completed')
  } else if (resolution.outcome !== 'yes') {
    blockers.push('not_verified')
  }
  if (
    resolution.signature !== null &&
    resolution.signature.visualDomain !== 'live_field' &&
    resolution.signature.visualDomain !== 'pinned_specimen'
  ) {
    blockers.push('visual_domain_not_support_eligible')
  }
  if (item.sourceProvenance === undefined) {
    blockers.push('source_provenance_missing')
  }
  if (item.rights.policyStatus !== 'allowed') {
    blockers.push('licence_not_allowed')
  }
  if (item.rights.attribution.trim() === '') {
    blockers.push('attribution_missing')
  }
  if (decisiveEvents.some(({ duplicateConcern }) => duplicateConcern)) {
    blockers.push('duplicate_concern')
  }
  if (
    decisiveEvents.some(
      ({ captiveOrCultivatedConcern }) => captiveOrCultivatedConcern,
    )
  ) {
    blockers.push('captive_or_cultivated_concern')
  }
  const canonicalBlockers = [...new Set(blockers)].sort()
  return {
    status:
      canonicalBlockers.length === 0
        ? 'prepared_for_biominer_resolution'
        : 'blocked',
    blockers: canonicalBlockers,
  }
}

function finalTestEligibility(
  campaign: VerificationCampaign,
  item: VerificationItem,
  decisiveEvents: readonly VerificationEvent[],
  resolution: {
    readonly status: VerificationConsensusStatus
    readonly outcome: 'yes' | 'no' | null
  },
): {
  readonly status: VerificationFinalTestEligibility
  readonly blockers: readonly string[]
} {
  if (
    item.flickrSource === undefined ||
    item.flickrSource.datasetPartition !== 'final_test'
  ) {
    return { status: 'not_applicable', blockers: [] }
  }
  const blockers: string[] = []
  if (
    resolution.status !== 'complete_agreement' &&
    resolution.status !== 'adjudicated'
  ) {
    blockers.push('review_not_completed')
  }
  if (campaign.samplingPlan.purpose !== 'quality_estimation') {
    blockers.push('not_probability_audit')
  }
  if (item.inclusionProbability === null) {
    blockers.push('inclusion_probability_missing')
  }
  if (
    !campaign.samplingPlan.blindReview ||
    campaign.disclosurePolicy.mode !== 'blind'
  ) {
    blockers.push('review_not_blind')
  }
  if (decisiveEvents.some(({ duplicateConcern }) => duplicateConcern)) {
    blockers.push('duplicate_concern')
  }
  if (
    decisiveEvents.some(
      ({ captiveOrCultivatedConcern }) => captiveOrCultivatedConcern,
    )
  ) {
    blockers.push('captive_or_cultivated_concern')
  }
  const canonicalBlockers = [...new Set(blockers)].sort()
  return {
    status: canonicalBlockers.length === 0 ? 'eligible' : 'blocked',
    blockers: canonicalBlockers,
  }
}

function effectiveRequiredReviewCount(
  campaign: VerificationCampaign,
): number {
  return campaign.reviewRequirement.secondReviewPolicy === 'always'
    ? Math.max(
        2,
        campaign.reviewRequirement.requiredIndependentReviewers,
      )
    : campaign.reviewRequirement.requiredIndependentReviewers
}

function reviewerKey(reviewerId: string): string {
  return reviewerId.trim() || 'anonymous'
}

function compareEvents(
  left: VerificationEvent,
  right: VerificationEvent,
): number {
  return (
    left.reviewedAt.localeCompare(right.reviewedAt) ||
    left.reviewRound - right.reviewRound ||
    left.reviewerId.localeCompare(right.reviewerId) ||
    left.eventId.localeCompare(right.eventId)
  )
}

function sortedUnique(values: readonly string[]): boolean {
  return values.every(
    (value, index) =>
      value.trim() !== '' &&
      (index === 0 || values[index - 1]!.localeCompare(value) < 0),
  )
}
