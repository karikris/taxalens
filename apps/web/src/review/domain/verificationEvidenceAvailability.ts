import {
  availableEvidence,
  blockedEvidence,
  failedEvidence,
  measuredZeroEvidence,
  notApplicableEvidence,
  unavailableEvidence,
  validateEvidenceAvailability,
  type EvidenceAvailability,
} from './evidenceAvailability'
import type { HumanReviewInspection } from './reviewSession'
import type { VerificationConsensus } from './verificationConsensus'
import type {
  VerificationCampaign,
  VerificationItem,
} from './verificationContracts'
import type { VerificationEvent } from './verificationEvents'
import type { VerificationQualitySnapshot } from './verificationQualitySnapshot'

export const VERIFICATION_EVIDENCE_AVAILABILITY_SCHEMA_VERSION =
  'taxalens-verification-evidence-availability:v1.0.0' as const

export interface VerificationMediaEvidence {
  readonly eligibleItemCount: number
  readonly inspectedItemCount: number
  readonly viewableItemCount: number
  readonly failedItemCount: number
}

export interface VerificationDecisionEvidence {
  readonly eventCount: number
  readonly effectiveReviewCount: number
  readonly decisiveReviewCount: number
}

export interface VerificationConsensusEvidence {
  readonly itemCount: number
  readonly decisivelyResolvedItemCount: number
  readonly unresolvedConflictItemCount: number
}

export interface VerificationQualityEvidence {
  readonly snapshotCount: number
  readonly latestSnapshotSha256: string
  readonly releaseStatus: VerificationQualitySnapshot['release']['status']
}

export interface VerificationCalibrationEvidence {
  readonly method: VerificationQualitySnapshot['precision']['method']
  readonly pointEstimate: number
  readonly interval: EvidenceAvailability<{
    readonly lower: number
    readonly upper: number
  }>
  readonly confidenceLevel: EvidenceAvailability<number>
  readonly effectiveSampleSize: EvidenceAvailability<number>
}

export interface VerificationCommentEvidence {
  readonly commentCount: number
  readonly eventIds: readonly string[]
}

export interface VerificationReferenceReadinessEvidence {
  readonly status: 'ready'
  readonly prototypeSupportCount: EvidenceAvailability<number>
  readonly verifiedSupportCount: EvidenceAvailability<number>
  readonly excludedSupportCount: EvidenceAvailability<number>
  readonly independentHumanTaxonomicVerificationClaimed: EvidenceAvailability<boolean>
}

export interface VerificationEvidenceAvailability {
  readonly schemaVersion:
    typeof VERIFICATION_EVIDENCE_AVAILABILITY_SCHEMA_VERSION
  readonly campaignId: string
  readonly media: EvidenceAvailability<VerificationMediaEvidence>
  readonly decision: EvidenceAvailability<VerificationDecisionEvidence>
  readonly consensus: EvidenceAvailability<VerificationConsensusEvidence>
  readonly quality: EvidenceAvailability<VerificationQualityEvidence>
  readonly calibration: EvidenceAvailability<VerificationCalibrationEvidence>
  readonly comments: EvidenceAvailability<VerificationCommentEvidence>
  readonly referenceReadiness: EvidenceAvailability<VerificationReferenceReadinessEvidence>
}

export interface VerificationEvidenceAvailabilityInput {
  readonly campaign: VerificationCampaign
  readonly items: readonly VerificationItem[]
  readonly events: readonly VerificationEvent[]
  readonly consensus: readonly VerificationConsensus[]
  readonly inspections: Readonly<Record<string, HumanReviewInspection>>
  readonly qualitySnapshots: readonly VerificationQualitySnapshot[]
}

export function projectVerificationEvidenceAvailability(
  input: VerificationEvidenceAvailabilityInput,
): VerificationEvidenceAvailability {
  const projection = deepFreeze({
    schemaVersion: VERIFICATION_EVIDENCE_AVAILABILITY_SCHEMA_VERSION,
    campaignId: input.campaign.campaignId,
    media: projectMedia(input),
    decision: projectDecision(input),
    consensus: projectConsensus(input),
    quality: projectQuality(input),
    calibration: projectCalibration(input),
    comments: projectComments(input),
    referenceReadiness: projectReferenceReadiness(input),
  })
  const failures = validateVerificationEvidenceAvailability(projection)
  if (failures.length > 0) {
    throw new Error(
      `Verification evidence availability is invalid: ${failures.join('; ')}`,
    )
  }
  return projection
}

export function validateVerificationEvidenceAvailability(
  value: unknown,
): readonly string[] {
  if (!isRecord(value)) {
    return Object.freeze([
      'verification evidence availability must be an object',
    ])
  }
  const failures: string[] = []
  if (
    !hasExactKeys(value, [
      'calibration',
      'campaignId',
      'comments',
      'consensus',
      'decision',
      'media',
      'quality',
      'referenceReadiness',
      'schemaVersion',
    ])
  ) {
    failures.push('verification evidence availability fields are invalid')
  }
  if (
    value.schemaVersion !==
    VERIFICATION_EVIDENCE_AVAILABILITY_SCHEMA_VERSION
  ) {
    failures.push('verification evidence availability schema version is unsupported')
  }
  if (
    typeof value.campaignId !== 'string' ||
    value.campaignId.trim().length === 0
  ) {
    failures.push('verification evidence availability campaign ID is empty')
  }
  validateCategory('media', value.media, isMediaEvidence, failures)
  validateCategory('decision', value.decision, isDecisionEvidence, failures)
  validateCategory('consensus', value.consensus, isConsensusEvidence, failures)
  validateCategory('quality', value.quality, isQualityEvidence, failures)
  validateCategory(
    'calibration',
    value.calibration,
    isCalibrationEvidence,
    failures,
  )
  validateCategory('comments', value.comments, isCommentEvidence, failures)
  validateCategory(
    'referenceReadiness',
    value.referenceReadiness,
    isReferenceReadinessEvidence,
    failures,
  )
  return Object.freeze(failures)
}

function projectMedia(
  input: VerificationEvidenceAvailabilityInput,
): EvidenceAvailability<VerificationMediaEvidence> {
  if (input.items.length === 0) {
    return notApplicableEvidence(
      'The campaign contains no media items eligible for inspection.',
    )
  }
  const inspections = input.items
    .map(({ itemId }) => input.inspections[itemId])
    .filter(
      (inspection): inspection is HumanReviewInspection =>
        inspection !== undefined &&
        (inspection.imageOpened ||
          inspection.imageVerified ||
          inspection.imageFailureReason !== null),
    )
  if (inspections.length === 0) {
    return unavailableEvidence(
      'No campaign media inspection has been recorded.',
    )
  }
  const viewableItemCount = inspections.filter(
    ({ imageOpened, imageVerified }) => imageOpened && imageVerified,
  ).length
  const failedItemCount = inspections.filter(
    ({ imageFailureReason }) => imageFailureReason !== null,
  ).length
  if (viewableItemCount === 0 && failedItemCount > 0) {
    return failedEvidence(
      'media_inspection_failed',
      `${failedItemCount} inspected media items could not be verified for display.`,
      true,
    )
  }
  if (viewableItemCount === 0) {
    return measuredZeroEvidence()
  }
  return availableEvidence({
    eligibleItemCount: input.items.length,
    inspectedItemCount: inspections.length,
    viewableItemCount,
    failedItemCount,
  })
}

function projectDecision(
  input: VerificationEvidenceAvailabilityInput,
): EvidenceAvailability<VerificationDecisionEvidence> {
  if (input.events.length === 0) {
    return measuredZeroEvidence()
  }
  const effectiveEvents = input.consensus.flatMap(
    ({ latestEvents }) => latestEvents,
  )
  return availableEvidence({
    eventCount: input.events.length,
    effectiveReviewCount: effectiveEvents.length,
    decisiveReviewCount: effectiveEvents.filter(
      ({ outcome }) => outcome === 'yes' || outcome === 'no',
    ).length,
  })
}

function projectConsensus(
  input: VerificationEvidenceAvailabilityInput,
): EvidenceAvailability<VerificationConsensusEvidence> {
  if (input.consensus.length === 0) {
    return notApplicableEvidence(
      'The campaign contains no item consensus projections.',
    )
  }
  const unresolved = input.consensus.filter(
    ({ status }) => status === 'unresolved_disagreement',
  )
  if (unresolved.length > 0) {
    return blockedEvidence(
      'Independent adjudication is required before consensus evidence is resolved.',
      unresolved.map(({ itemId }) => `unresolved_conflict:${itemId}`),
    )
  }
  const resolvedCount = input.consensus.filter(
    ({ consensusOutcome }) => consensusOutcome !== null,
  ).length
  if (resolvedCount === 0) {
    return measuredZeroEvidence()
  }
  return availableEvidence({
    itemCount: input.consensus.length,
    decisivelyResolvedItemCount: resolvedCount,
    unresolvedConflictItemCount: 0,
  })
}

function projectQuality(
  input: VerificationEvidenceAvailabilityInput,
): EvidenceAvailability<VerificationQualityEvidence> {
  const latest = input.qualitySnapshots.at(-1)
  if (latest === undefined) {
    return unavailableEvidence(
      'No immutable verification quality snapshot is attached.',
    )
  }
  return availableEvidence({
    snapshotCount: input.qualitySnapshots.length,
    latestSnapshotSha256: latest.snapshotSha256,
    releaseStatus: latest.release.status,
  })
}

function projectCalibration(
  input: VerificationEvidenceAvailabilityInput,
): EvidenceAvailability<VerificationCalibrationEvidence> {
  if (input.campaign.samplingPlan.purpose !== 'quality_estimation') {
    return notApplicableEvidence(
      `Calibration evidence is not applicable to ${input.campaign.samplingPlan.purpose} sampling.`,
    )
  }
  const latest = input.qualitySnapshots.at(-1)
  if (latest === undefined) {
    return unavailableEvidence(
      'Calibration evidence requires an immutable quality snapshot.',
    )
  }
  const precision = latest.precision
  if (precision.availability !== 'available') {
    return blockedEvidence(
      'The target precision estimate is blocked.',
      precision.estimateBlockers,
    )
  }
  if (precision.pointEstimate === null) {
    return unavailableEvidence(
      'The quality snapshot does not contain a target precision point estimate.',
    )
  }
  if (Object.is(precision.pointEstimate, 0)) {
    return measuredZeroEvidence()
  }
  return availableEvidence({
    method: precision.method,
    pointEstimate: precision.pointEstimate,
    interval:
      precision.interval === null
        ? precision.intervalBlockers.length > 0
          ? blockedEvidence(
              'The target precision interval is blocked.',
              precision.intervalBlockers,
            )
          : unavailableEvidence(
              'The target precision interval is unavailable.',
            )
        : availableEvidence({
            lower: precision.interval.lower,
            upper: precision.interval.upper,
          }),
    confidenceLevel: numericEvidence(
      precision.confidenceLevel,
      'The target precision confidence level is unavailable.',
    ),
    effectiveSampleSize: numericEvidence(
      precision.effectiveSampleSize,
      'The target precision effective sample size is unavailable.',
    ),
  })
}

function projectComments(
  input: VerificationEvidenceAvailabilityInput,
): EvidenceAvailability<VerificationCommentEvidence> {
  const commentedEvents = input.events.filter(
    ({ comment }) => comment !== null && comment.trim().length > 0,
  )
  if (commentedEvents.length === 0) {
    return measuredZeroEvidence()
  }
  return availableEvidence({
    commentCount: commentedEvents.length,
    eventIds: Object.freeze(
      commentedEvents
        .map(({ eventId }) => eventId)
        .sort((left, right) => left.localeCompare(right)),
    ),
  })
}

function projectReferenceReadiness(
  input: VerificationEvidenceAvailabilityInput,
): EvidenceAvailability<VerificationReferenceReadinessEvidence> {
  const latest = input.qualitySnapshots.at(-1)
  if (latest === undefined) {
    return unavailableEvidence(
      'Reference readiness requires an immutable quality snapshot.',
    )
  }
  if (latest.referenceReadiness.status === 'unavailable') {
    return unavailableEvidence(
      'Reference readiness is unavailable in the latest quality snapshot.',
    )
  }
  if (latest.referenceReadiness.status === 'not_ready') {
    return blockedEvidence(
      'Reference readiness is blocked in the latest quality snapshot.',
      latest.referenceReadiness.blockers,
    )
  }
  const bank = latest.referenceBank
  return availableEvidence({
    status: 'ready' as const,
    prototypeSupportCount:
      bank === null
        ? unavailableEvidence('Reference-bank counts are unavailable.')
        : numericEvidence(
            bank.prototypeSupportCount,
            'Prototype support count is unavailable.',
          ),
    verifiedSupportCount:
      bank === null
        ? unavailableEvidence('Reference-bank counts are unavailable.')
        : numericEvidence(
            bank.verifiedSupportCount,
            'Verified support count is unavailable.',
          ),
    excludedSupportCount:
      bank === null
        ? unavailableEvidence('Reference-bank counts are unavailable.')
        : numericEvidence(
            bank.excludedSupportCount,
            'Excluded support count is unavailable.',
          ),
    independentHumanTaxonomicVerificationClaimed:
      bank === null
        ? unavailableEvidence(
            'Reference-bank taxonomic verification evidence is unavailable.',
          )
        : availableEvidence(
            bank.prototypeRoleAttestations
              .independentHumanTaxonomicVerificationClaimed,
          ),
  })
}

function numericEvidence(
  value: number | null,
  unavailableReason: string,
): EvidenceAvailability<number> {
  if (value === null) {
    return unavailableEvidence(unavailableReason)
  }
  return value === 0
    ? measuredZeroEvidence()
    : availableEvidence(value)
}

function validateCategory<T>(
  label: string,
  value: unknown,
  validateAvailable: (value: unknown) => value is T,
  failures: string[],
): void {
  failures.push(
    ...validateEvidenceAvailability(value, validateAvailable).map(
      (failure) => `${label}: ${failure}`,
    ),
  )
}

function isMediaEvidence(value: unknown): value is VerificationMediaEvidence {
  return hasExactNonNegativeCounts(value, [
    'eligibleItemCount',
    'inspectedItemCount',
    'viewableItemCount',
    'failedItemCount',
  ])
}

function isDecisionEvidence(
  value: unknown,
): value is VerificationDecisionEvidence {
  return hasExactNonNegativeCounts(value, [
    'eventCount',
    'effectiveReviewCount',
    'decisiveReviewCount',
  ])
}

function isConsensusEvidence(
  value: unknown,
): value is VerificationConsensusEvidence {
  return hasExactNonNegativeCounts(value, [
    'itemCount',
    'decisivelyResolvedItemCount',
    'unresolvedConflictItemCount',
  ])
}

function isQualityEvidence(
  value: unknown,
): value is VerificationQualityEvidence {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      'latestSnapshotSha256',
      'releaseStatus',
      'snapshotCount',
    ]) &&
    nonNegativeInteger(value.snapshotCount) &&
    typeof value.latestSnapshotSha256 === 'string' &&
    /^[a-f0-9]{64}$/u.test(value.latestSnapshotSha256) &&
    (value.releaseStatus === 'not_evaluated' ||
      value.releaseStatus === 'blocked' ||
      value.releaseStatus === 'release_ready')
  )
}

function isCalibrationEvidence(
  value: unknown,
): value is VerificationCalibrationEvidence {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      'confidenceLevel',
      'effectiveSampleSize',
      'interval',
      'method',
      'pointEstimate',
    ]) &&
    typeof value.method === 'string' &&
    typeof value.pointEstimate === 'number' &&
    Number.isFinite(value.pointEstimate) &&
    validateEvidenceAvailability(value.interval, isIntervalEvidence).length ===
      0 &&
    validateEvidenceAvailability(value.confidenceLevel, isFiniteNumber)
      .length === 0 &&
    validateEvidenceAvailability(value.effectiveSampleSize, isFiniteNumber)
      .length === 0
  )
}

function isCommentEvidence(
  value: unknown,
): value is VerificationCommentEvidence {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['commentCount', 'eventIds']) &&
    nonNegativeInteger(value.commentCount) &&
    Array.isArray(value.eventIds) &&
    value.eventIds.length === value.commentCount &&
    value.eventIds.every(nonEmptyString) &&
    new Set(value.eventIds).size === value.eventIds.length
  )
}

function isReferenceReadinessEvidence(
  value: unknown,
): value is VerificationReferenceReadinessEvidence {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      'excludedSupportCount',
      'independentHumanTaxonomicVerificationClaimed',
      'prototypeSupportCount',
      'status',
      'verifiedSupportCount',
    ]) &&
    value.status === 'ready' &&
    validateEvidenceAvailability(
      value.prototypeSupportCount,
      isFiniteNumber,
    ).length === 0 &&
    validateEvidenceAvailability(
      value.verifiedSupportCount,
      isFiniteNumber,
    ).length === 0 &&
    validateEvidenceAvailability(
      value.excludedSupportCount,
      isFiniteNumber,
    ).length === 0 &&
    validateEvidenceAvailability(
      value.independentHumanTaxonomicVerificationClaimed,
      (candidate): candidate is boolean => typeof candidate === 'boolean',
    ).length === 0
  )
}

function isIntervalEvidence(
  value: unknown,
): value is { readonly lower: number; readonly upper: number } {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['lower', 'upper']) &&
    isFiniteNumber(value.lower) &&
    isFiniteNumber(value.upper) &&
    value.lower <= value.upper
  )
}

function hasExactNonNegativeCounts(
  value: unknown,
  keys: readonly string[],
): boolean {
  return (
    isRecord(value) &&
    hasExactKeys(value, keys) &&
    keys.every((key) => nonNegativeInteger(value[key]))
  )
}

function hasExactKeys(
  value: Readonly<Record<string, unknown>>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  )
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function nonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) {
    return value
  }
  for (const child of Object.values(value)) {
    deepFreeze(child)
  }
  return Object.freeze(value)
}
