import {
  projectVerificationConsensus,
  validateVerificationQualitySnapshot,
  type VerificationCampaign,
  type VerificationEvent,
  type VerificationItem,
  type VerificationQualitySnapshot,
} from '../review/domain'
import {
  validateOccurrenceReleaseGateEvidence,
  type OccurrenceReleaseGateEvidence,
} from './geographicContributionMetrics'

export type GeographicHumanReviewState =
  | 'pending'
  | 'reviewed_target_positive'
  | 'reviewed_non_target'
  | 'uncertain'
  | 'media_failure'
  | 'skipped'

export interface GeographicReviewCampaignLedger {
  readonly campaign: VerificationCampaign
  readonly items: readonly VerificationItem[]
  readonly events: readonly VerificationEvent[]
  readonly qualitySnapshots: readonly VerificationQualitySnapshot[]
}

export interface GeographicReviewSpatialBinding {
  readonly campaignId: string
  readonly itemId: string
  readonly spatialResolution: number
  readonly spatialCellId: string
  readonly cellSupported: boolean
  readonly reviewerAssignmentCount: number
}

export interface GeographicOccurrenceReleaseDecision
  extends OccurrenceReleaseGateEvidence {
  readonly campaignId: string
  readonly itemId: string
}

export interface GeographicReviewItemProjection {
  readonly campaignId: string
  readonly itemId: string
  readonly state: GeographicHumanReviewState
  readonly consensusStatus: ReturnType<typeof projectVerificationConsensus>[number]['status']
  readonly consensusOutcome: 'yes' | 'no' | null
  readonly effectiveReviewCount: number
  readonly decisiveReviewCount: number
  readonly reviewerAssignmentCount: number
  readonly assigned: boolean
  readonly decisivelyReviewed: boolean
  readonly humanSupported: boolean
  readonly qualitySnapshotId: string | null
  readonly qualityValidReviewed: boolean
  readonly populationQualityEligible: boolean
  readonly releaseReady: boolean
  readonly samplingPurpose: VerificationCampaign['samplingPlan']['purpose']
  readonly samplingRepresentative: boolean
  readonly qualityEstimationAllowed: boolean
  readonly scientificClaimAllowed: false
}

export interface GeographicReviewCellProjection {
  readonly spatialResolution: number
  readonly spatialCellId: string
  readonly campaignItemCount: number
  readonly assignedCount: number
  readonly decisivelyReviewedCount: number
  readonly reviewedPositiveCount: number
  readonly reviewedNegativeCount: number
  readonly uncertainCount: number
  readonly pendingCount: number
  readonly mediaFailureCount: number
  readonly skippedCount: number
  readonly qualityValidReviewedCount: number
  readonly populationQualityEligibleCount: number
  readonly targetedFailureDiscoveryReviewedCount: number
  readonly releaseReadyCount: number
  readonly scientificClaimAllowed: false
}

export interface GeographicReviewProjection {
  readonly items: readonly GeographicReviewItemProjection[]
  readonly cells: readonly GeographicReviewCellProjection[]
  readonly scientificClaimAllowed: false
}

/**
 * Project immutable campaign ledgers into compatible spatial cells.
 *
 * This overlay describes local review maturity. It does not mutate a committed
 * impact artifact and cannot manufacture an occurrence-release decision.
 */
export function projectGeographicHumanReviewState(input: {
  readonly campaigns: readonly GeographicReviewCampaignLedger[]
  readonly bindings: readonly GeographicReviewSpatialBinding[]
  readonly releaseDecisions: readonly GeographicOccurrenceReleaseDecision[]
}): GeographicReviewProjection {
  const campaignIds = new Set<string>()
  const itemKeys = new Set<string>()
  const itemByKey = new Map<string, GeographicReviewItemProjection>()

  for (const ledger of input.campaigns) {
    const campaignId = ledger.campaign.campaignId
    if (campaignIds.has(campaignId)) {
      throw new Error(`geographic review campaign is repeated: ${campaignId}`)
    }
    campaignIds.add(campaignId)
    const latestQuality = latestQualitySnapshot(ledger)
    const consensus = projectVerificationConsensus(
      ledger.campaign,
      ledger.items,
      ledger.events,
    )
    for (const itemConsensus of consensus) {
      const key = reviewItemKey(campaignId, itemConsensus.itemId)
      if (itemKeys.has(key)) {
        throw new Error(`geographic review item is repeated: ${key}`)
      }
      itemKeys.add(key)
      const itemBindings = input.bindings.filter(
        (binding) =>
          binding.campaignId === campaignId &&
          binding.itemId === itemConsensus.itemId,
      )
      const reviewerAssignmentCount = consistentAssignmentCount(itemBindings)
      const state = geographicState(itemConsensus)
      const decisivelyReviewed =
        state === 'reviewed_target_positive' || state === 'reviewed_non_target'
      const qualityValidReviewed = decisivelyReviewed && latestQuality !== null
      const populationQualityEligible =
        qualityValidReviewed &&
        ledger.campaign.samplingPlan.representative &&
        ledger.campaign.samplingPlan.qualityEstimationAllowed
      const releaseDecision = releaseDecisionForItem(
        input.releaseDecisions,
        campaignId,
        itemConsensus.itemId,
      )
      const releaseReady = releaseReadyForItem({
        consensusOutcome: itemConsensus.consensusOutcome,
        latestQuality,
        releaseDecision,
      })
      itemByKey.set(
        key,
        Object.freeze({
          campaignId,
          itemId: itemConsensus.itemId,
          state,
          consensusStatus: itemConsensus.status,
          consensusOutcome: itemConsensus.consensusOutcome,
          effectiveReviewCount: itemConsensus.effectiveReviewCount,
          decisiveReviewCount: itemConsensus.decisiveReviewCount,
          reviewerAssignmentCount,
          assigned: reviewerAssignmentCount > 0,
          decisivelyReviewed,
          humanSupported: state === 'reviewed_target_positive',
          qualitySnapshotId: latestQuality?.snapshotSha256 ?? null,
          qualityValidReviewed,
          populationQualityEligible,
          releaseReady,
          samplingPurpose: ledger.campaign.samplingPlan.purpose,
          samplingRepresentative: ledger.campaign.samplingPlan.representative,
          qualityEstimationAllowed:
            ledger.campaign.samplingPlan.qualityEstimationAllowed,
          scientificClaimAllowed: false as const,
        }),
      )
    }
  }

  validateBindings(input.bindings, itemByKey)
  validateReleaseDecisionScope(input.releaseDecisions, itemByKey)
  return Object.freeze({
    items: Object.freeze(
      [...itemByKey.values()].sort(
        (left, right) =>
          left.campaignId.localeCompare(right.campaignId) ||
          left.itemId.localeCompare(right.itemId),
      ),
    ),
    cells: projectCells(input.bindings, itemByKey),
    scientificClaimAllowed: false as const,
  })
}

function latestQualitySnapshot(
  ledger: GeographicReviewCampaignLedger,
): VerificationQualitySnapshot | null {
  for (const snapshot of ledger.qualitySnapshots) {
    const failures = validateVerificationQualitySnapshot(snapshot)
    if (failures.length > 0) {
      throw new Error(
        `geographic review quality snapshot is invalid: ${failures.join('; ')}`,
      )
    }
    if (
      snapshot.campaign.campaignId !== ledger.campaign.campaignId ||
      snapshot.campaign.samplingPurpose !== ledger.campaign.samplingPlan.purpose ||
      snapshot.campaign.samplingDesign !== ledger.campaign.samplingPlan.design
    ) {
      throw new Error('geographic review quality snapshot campaign identity differs')
    }
  }
  return (
    [...ledger.qualitySnapshots].sort(
      (left, right) =>
        left.capturedAt.localeCompare(right.capturedAt) ||
        left.snapshotSha256.localeCompare(right.snapshotSha256),
    ).at(-1) ?? null
  )
}

function geographicState(
  consensus: ReturnType<typeof projectVerificationConsensus>[number],
): GeographicHumanReviewState {
  if (
    consensus.status === 'complete_agreement' ||
    consensus.status === 'adjudicated'
  ) {
    return consensus.consensusOutcome === 'yes'
      ? 'reviewed_target_positive'
      : 'reviewed_non_target'
  }
  switch (consensus.status) {
    case 'unresolved_disagreement':
    case 'uncertain_only':
      return 'uncertain'
    case 'media_failure':
      return 'media_failure'
    case 'deferred':
      return 'skipped'
    case 'pending':
      return 'pending'
  }
}

function releaseReadyForItem(input: {
  readonly consensusOutcome: 'yes' | 'no' | null
  readonly latestQuality: VerificationQualitySnapshot | null
  readonly releaseDecision: GeographicOccurrenceReleaseDecision | null
}): boolean {
  const { releaseDecision } = input
  if (releaseDecision === null || releaseDecision.decisionStatus === 'blocked') {
    return false
  }
  if (input.consensusOutcome !== 'yes') {
    throw new Error('release-ready geographic decision lacks positive consensus')
  }
  if (
    input.latestQuality === null ||
    input.latestQuality.release.status !== 'release_ready' ||
    releaseDecision.qualitySnapshotId !== input.latestQuality.snapshotSha256
  ) {
    throw new Error('release-ready geographic decision lacks the exact ready quality snapshot')
  }
  return validateOccurrenceReleaseGateEvidence(releaseDecision)
}

function releaseDecisionForItem(
  decisions: readonly GeographicOccurrenceReleaseDecision[],
  campaignId: string,
  itemId: string,
): GeographicOccurrenceReleaseDecision | null {
  const matches = decisions.filter(
    (decision) =>
      decision.campaignId === campaignId && decision.itemId === itemId,
  )
  if (matches.length > 1) {
    throw new Error(`geographic release decision is repeated: ${campaignId}/${itemId}`)
  }
  return matches[0] ?? null
}

function consistentAssignmentCount(
  bindings: readonly GeographicReviewSpatialBinding[],
): number {
  const counts = new Set(bindings.map(({ reviewerAssignmentCount }) => reviewerAssignmentCount))
  for (const count of counts) assertCount(count, 'reviewer assignment count')
  if (counts.size > 1) {
    throw new Error('geographic review bindings disagree on assignment count')
  }
  return [...counts][0] ?? 0
}

function validateBindings(
  bindings: readonly GeographicReviewSpatialBinding[],
  items: ReadonlyMap<string, GeographicReviewItemProjection>,
): void {
  const bindingKeys = new Set<string>()
  for (const binding of bindings) {
    const itemKey = reviewItemKey(binding.campaignId, binding.itemId)
    if (!items.has(itemKey)) {
      throw new Error(`geographic review binding names an unknown item: ${itemKey}`)
    }
    assertCount(binding.spatialResolution, 'spatial resolution')
    assertCount(binding.reviewerAssignmentCount, 'reviewer assignment count')
    if (binding.spatialCellId.trim() === '') {
      throw new Error('geographic review binding requires a spatial cell ID')
    }
    const bindingKey = `${itemKey}\u0000${binding.spatialResolution}\u0000${binding.spatialCellId}`
    if (bindingKeys.has(bindingKey)) {
      throw new Error(`geographic review spatial binding is repeated: ${bindingKey}`)
    }
    bindingKeys.add(bindingKey)
  }
}

function validateReleaseDecisionScope(
  decisions: readonly GeographicOccurrenceReleaseDecision[],
  items: ReadonlyMap<string, GeographicReviewItemProjection>,
): void {
  for (const decision of decisions) {
    if (!items.has(reviewItemKey(decision.campaignId, decision.itemId))) {
      throw new Error('geographic release decision names an unknown campaign item')
    }
  }
}

function projectCells(
  bindings: readonly GeographicReviewSpatialBinding[],
  items: ReadonlyMap<string, GeographicReviewItemProjection>,
): readonly GeographicReviewCellProjection[] {
  const grouped = new Map<string, Map<string, GeographicReviewItemProjection>>()
  for (const binding of bindings) {
    if (!binding.cellSupported) continue
    const cellKey = `${binding.spatialResolution}\u0000${binding.spatialCellId}`
    const cellItems = grouped.get(cellKey) ?? new Map()
    const itemKey = reviewItemKey(binding.campaignId, binding.itemId)
    cellItems.set(itemKey, items.get(itemKey)!)
    grouped.set(cellKey, cellItems)
  }
  return Object.freeze(
    [...grouped.entries()]
      .map(([cellKey, itemMap]) => {
        const separator = cellKey.indexOf('\u0000')
        const spatialResolution = Number(cellKey.slice(0, separator))
        const spatialCellId = cellKey.slice(separator + 1)
        const projected = [...itemMap.values()]
        return Object.freeze({
          spatialResolution,
          spatialCellId,
          campaignItemCount: projected.length,
          assignedCount: count(projected, ({ assigned }) => assigned),
          decisivelyReviewedCount: count(
            projected,
            ({ decisivelyReviewed }) => decisivelyReviewed,
          ),
          reviewedPositiveCount: count(
            projected,
            ({ state }) => state === 'reviewed_target_positive',
          ),
          reviewedNegativeCount: count(
            projected,
            ({ state }) => state === 'reviewed_non_target',
          ),
          uncertainCount: count(projected, ({ state }) => state === 'uncertain'),
          pendingCount: count(projected, ({ state }) => state === 'pending'),
          mediaFailureCount: count(
            projected,
            ({ state }) => state === 'media_failure',
          ),
          skippedCount: count(projected, ({ state }) => state === 'skipped'),
          qualityValidReviewedCount: count(
            projected,
            ({ qualityValidReviewed }) => qualityValidReviewed,
          ),
          populationQualityEligibleCount: count(
            projected,
            ({ populationQualityEligible }) => populationQualityEligible,
          ),
          targetedFailureDiscoveryReviewedCount: count(
            projected,
            ({ decisivelyReviewed, samplingPurpose }) =>
              decisivelyReviewed && samplingPurpose === 'failure_discovery',
          ),
          releaseReadyCount: count(projected, ({ releaseReady }) => releaseReady),
          scientificClaimAllowed: false as const,
        })
      })
      .sort(
        (left, right) =>
          left.spatialResolution - right.spatialResolution ||
          left.spatialCellId.localeCompare(right.spatialCellId),
      ),
  )
}

function count<T>(values: readonly T[], predicate: (value: T) => boolean): number {
  return values.filter(predicate).length
}

function reviewItemKey(campaignId: string, itemId: string): string {
  return `${campaignId}\u0000${itemId}`
}

function assertCount(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`)
  }
}
