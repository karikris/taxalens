import type { ReplayEvidence } from '../data/evidenceFacade'

export const EVIDENCE_PLAN_VERSION = 'taxalens-evidence-plan-v1.1.0' as const

export const FLICKR_AUDIT_POPULATION_SIZE = 49
export const REFERENCE_AUDIT_ITEM_COUNT = 24
export const BIOMINER_ROLE_SUITABLE_RECORD_COUNT = 81

export type RetrievalPolicy =
  | 'global_then_assign_to_flickr_clusters'
  | 'target_supported_countries'
export type ReferencePolicy = 'human_review_before_support_use' | 'metadata_planning_only'
export type EvidenceStrictness = 'block_unverified_claims' | 'metadata_exploration_only'
export type MissionMode = 'replay' | 'live'

export interface MissionDraft {
  readonly targetSpecies: string
  readonly region: string
  readonly retrievalPolicy: RetrievalPolicy
  readonly maximumApiCalls: number
  readonly candidateLimit: number
  readonly reviewBudget: number
  readonly auditSampleSize: number
  readonly independentReviewerCount: number
  readonly qualityPrecisionObjectivePercent: number
  readonly referencePolicy: ReferencePolicy
  readonly evidenceStrictness: EvidenceStrictness
  readonly mode: MissionMode
  readonly device: string
}

export type MissionPlanValidationCode =
  | 'api_budget_below_replay'
  | 'api_budget_invalid'
  | 'candidate_budget_incomplete'
  | 'candidate_budget_invalid'
  | 'device_annotation_too_long'
  | 'audit_sample_invalid'
  | 'audit_sample_precision_insufficient'
  | 'quality_precision_invalid'
  | 'review_budget_insufficient'
  | 'review_budget_invalid'
  | 'reviewer_count_invalid'
  | 'live_mode_unavailable'
  | 'policy_unsupported'
  | 'region_unknown'
  | 'target_not_verified'

export interface MissionPlanValidationIssue {
  readonly code: MissionPlanValidationCode
  readonly field: keyof MissionDraft
  readonly message: string
}

export interface EvidencePlan {
  readonly planVersion: typeof EVIDENCE_PLAN_VERSION
  readonly target: {
    readonly scientificName: string
    readonly acceptedTaxonKey: string
  }
  readonly sourceRegistry: {
    readonly name: string
    readonly version: string
    readonly sourceSnapshotVersion: string
    readonly acceptedIdentityNamespace: string
  }
  readonly region: {
    readonly selection: string
    readonly regionCount: number
    readonly countryCount: number
    readonly rangeStatus: string
    readonly requiresOccurrenceSupport: boolean
    readonly taxonomicCaution: boolean
    readonly evidenceQualifier: 'planning_hypothesis'
  }
  readonly queryStrategy: {
    readonly retrievalPolicy: RetrievalPolicy
    readonly committedDefinitionCount: number
    readonly registryLinkedSpeciesCount: number
    readonly registryIdentityRequired: boolean
    readonly geographyEvidenceMode: 'soft_structured_evidence'
    readonly missingGeographyMeans: 'unknown'
    readonly targetAlwaysScoreable: true
    readonly scoreAllEligibleCandidates: true
    readonly eligibleCandidateCount: number
    readonly referencePolicy: ReferencePolicy
    readonly evidenceStrictness: EvidenceStrictness
  }
  readonly expectedStages: readonly {
    readonly sequence: number
    readonly stageId: string
    readonly status: string
    readonly recordCount: number
    readonly verificationStatus: string
    readonly scientificClaimAllowed: boolean
    readonly reason: string | null
  }[]
  readonly approvedBudget: {
    readonly maximumApiCalls: number
    readonly fixtureMaterializedApiCalls: number
    readonly candidateLimit: number
    readonly historicalLocalVerificationImages: number
    readonly localVerificationMaxImages: null
    readonly device: string | null
    readonly basis: 'validated_mission_bounds'
  }
  readonly verificationWork: {
    readonly reviewBudget: number
    readonly auditSampleSize: number
    readonly auditCampaignPopulationSize: 49
    readonly independentReviewerCount: number
    readonly plannedReviewAssignments: number
    readonly unallocatedReviewBudget: number
    readonly qualityPrecisionObjective: {
      readonly metric: '95_percent_wilson_half_width'
      readonly maximumHalfWidth: number
      readonly requestedPercent: number
      readonly approximateMinimumDecisiveOutcomes: number
      readonly auditSampleSatisfiesApproximation: true
      readonly currentDecisiveWeightedOutcomeCount: 0
      readonly intervalAvailability: 'unavailable'
    }
    readonly referenceReview: {
      readonly requirement: ReferencePolicy
      readonly campaignItemCount: 24
      readonly requiredIndependentReviewers: 2
      readonly currentIndependentOutcomeCount: 0
      readonly providerRoleSuitableRecordCount: 81
      readonly status: 'blocked' | 'metadata_planning_only'
    }
  }
  readonly unavailableStages: readonly {
    readonly sequence: number
    readonly stageId: string
    readonly reason: string
  }[]
  readonly artifactExpectations: readonly {
    readonly role: string
    readonly availability: string
    readonly artifactIds: readonly string[]
    readonly purpose: 'future_evidence_required' | 'verified_replay_input'
    readonly humanReviewRequired: boolean
    readonly scientificClaimAllowed: boolean
  }[]
  readonly approvalRequirement: {
    readonly required: true
    readonly status: 'not_approved'
    readonly liveWorkApproved: false
    readonly reason: string
    readonly requiredEvidence: readonly string[]
    readonly incompletePrerequisiteGates: readonly string[]
  }
  readonly execution: {
    readonly requestedMode: 'replay'
    readonly capability: 'plan_only'
    readonly launchesWork: false
    readonly usesOpenAI: false
  }
}

export class MissionPlanValidationError extends Error {
  readonly issues: readonly MissionPlanValidationIssue[]

  constructor(issues: readonly MissionPlanValidationIssue[]) {
    super(issues.map((issue) => issue.message).join(' '))
    this.name = 'MissionPlanValidationError'
    this.issues = deepFreeze([...issues])
  }
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null) {
    return value
  }
  for (const child of Object.values(value)) {
    deepFreeze(child)
  }
  return Object.freeze(value)
}

function sameScientificName(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.toLowerCase()
}

export function createMissionDraft(replay: ReplayEvidence): MissionDraft {
  return {
    targetSpecies: replay.target.scientificName,
    region: 'global',
    retrievalPolicy: replay.mission.queryPolicy.defaultRetrievalPolicy as RetrievalPolicy,
    maximumApiCalls: replay.mission.budgets.materializedRequestCount,
    candidateLimit: replay.mission.candidatePolicy.candidateCount,
    reviewBudget: 80,
    auditSampleSize: 40,
    independentReviewerCount: 2,
    qualityPrecisionObjectivePercent: 20,
    referencePolicy: 'human_review_before_support_use',
    evidenceStrictness: 'block_unverified_claims',
    mode: 'replay',
    device: '',
  }
}

function validateMissionDraft(
  draft: MissionDraft,
  replay: ReplayEvidence,
): readonly MissionPlanValidationIssue[] {
  const issues: MissionPlanValidationIssue[] = []
  const retrievalPolicies: readonly RetrievalPolicy[] = [
    'global_then_assign_to_flickr_clusters',
    'target_supported_countries',
  ]
  const referencePolicies: readonly ReferencePolicy[] = [
    'human_review_before_support_use',
    'metadata_planning_only',
  ]
  const strictnessPolicies: readonly EvidenceStrictness[] = [
    'block_unverified_claims',
    'metadata_exploration_only',
  ]

  if (!sameScientificName(draft.targetSpecies, replay.target.scientificName)) {
    issues.push({
      code: 'target_not_verified',
      field: 'targetSpecies',
      message: `Only ${replay.target.scientificName} has a checksum-verified replay fixture.`,
    })
  }

  if (
    draft.region !== 'global' &&
    !replay.mission.regions.some((region) => region.name === draft.region)
  ) {
    issues.push({
      code: 'region_unknown',
      field: 'region',
      message: 'Choose a region declared by the verified range-planning artifact.',
    })
  }

  if (!Number.isInteger(draft.maximumApiCalls) || draft.maximumApiCalls < 1) {
    issues.push({
      code: 'api_budget_invalid',
      field: 'maximumApiCalls',
      message: 'Maximum API calls must be a positive whole number.',
    })
  } else if (draft.maximumApiCalls < replay.mission.budgets.materializedRequestCount) {
    issues.push({
      code: 'api_budget_below_replay',
      field: 'maximumApiCalls',
      message: `The submitted replay already records ${replay.mission.budgets.materializedRequestCount} API calls.`,
    })
  } else if (draft.maximumApiCalls > replay.mission.queryPolicy.occurrenceSearchCeiling) {
    issues.push({
      code: 'api_budget_invalid',
      field: 'maximumApiCalls',
      message: `Maximum API calls cannot exceed ${replay.mission.queryPolicy.occurrenceSearchCeiling}.`,
    })
  }

  if (!Number.isInteger(draft.candidateLimit) || draft.candidateLimit < 1) {
    issues.push({
      code: 'candidate_budget_invalid',
      field: 'candidateLimit',
      message: 'Candidate limit must be a positive whole number.',
    })
  } else if (draft.candidateLimit !== replay.mission.candidatePolicy.candidateCount) {
    issues.push({
      code: 'candidate_budget_incomplete',
      field: 'candidateLimit',
      message: `The plan must retain all ${replay.mission.candidatePolicy.candidateCount} eligible regional candidates.`,
    })
  }

  if (!Number.isInteger(draft.reviewBudget) || draft.reviewBudget < 1) {
    issues.push({
      code: 'review_budget_invalid',
      field: 'reviewBudget',
      message: 'Review budget must be a positive whole number of decisions.',
    })
  }
  if (
    !Number.isInteger(draft.auditSampleSize) ||
    draft.auditSampleSize < 1 ||
    draft.auditSampleSize > FLICKR_AUDIT_POPULATION_SIZE
  ) {
    issues.push({
      code: 'audit_sample_invalid',
      field: 'auditSampleSize',
      message: `Audit sample size must be between 1 and ${FLICKR_AUDIT_POPULATION_SIZE}.`,
    })
  }
  if (
    !Number.isInteger(draft.independentReviewerCount) ||
    draft.independentReviewerCount < 2 ||
    draft.independentReviewerCount > 5
  ) {
    issues.push({
      code: 'reviewer_count_invalid',
      field: 'independentReviewerCount',
      message:
        'Independent reviewer count must be a whole number between 2 and 5.',
    })
  }
  if (
    !Number.isFinite(draft.qualityPrecisionObjectivePercent) ||
    draft.qualityPrecisionObjectivePercent < 5 ||
    draft.qualityPrecisionObjectivePercent > 50
  ) {
    issues.push({
      code: 'quality_precision_invalid',
      field: 'qualityPrecisionObjectivePercent',
      message:
        'Quality precision objective must be between 5 and 50 percentage points.',
    })
  }
  if (
    Number.isInteger(draft.auditSampleSize) &&
    draft.auditSampleSize > 0 &&
    Number.isFinite(draft.qualityPrecisionObjectivePercent) &&
    draft.qualityPrecisionObjectivePercent >= 5 &&
    draft.qualityPrecisionObjectivePercent <= 50 &&
    draft.auditSampleSize <
      approximateMinimumDecisiveOutcomes(
        draft.qualityPrecisionObjectivePercent,
      )
  ) {
    issues.push({
      code: 'audit_sample_precision_insufficient',
      field: 'auditSampleSize',
      message: `The ${draft.qualityPrecisionObjectivePercent}-point objective needs approximately ${approximateMinimumDecisiveOutcomes(
        draft.qualityPrecisionObjectivePercent,
      )} decisive outcomes before finite-population adjustment.`,
    })
  }
  if (
    Number.isInteger(draft.reviewBudget) &&
    draft.reviewBudget > 0 &&
    Number.isInteger(draft.auditSampleSize) &&
    draft.auditSampleSize > 0 &&
    Number.isInteger(draft.independentReviewerCount) &&
    draft.independentReviewerCount > 0 &&
    draft.reviewBudget <
      draft.auditSampleSize * draft.independentReviewerCount
  ) {
    issues.push({
      code: 'review_budget_insufficient',
      field: 'reviewBudget',
      message: `Review budget must cover ${draft.auditSampleSize * draft.independentReviewerCount} planned reviewer assignments.`,
    })
  }

  if (!retrievalPolicies.includes(draft.retrievalPolicy)) {
    issues.push({
      code: 'policy_unsupported',
      field: 'retrievalPolicy',
      message: 'The retrieval policy is not supported by this plan version.',
    })
  }
  if (!referencePolicies.includes(draft.referencePolicy)) {
    issues.push({
      code: 'policy_unsupported',
      field: 'referencePolicy',
      message: 'The reference policy is not supported by this plan version.',
    })
  }
  if (!strictnessPolicies.includes(draft.evidenceStrictness)) {
    issues.push({
      code: 'policy_unsupported',
      field: 'evidenceStrictness',
      message: 'The evidence strictness is not supported by this plan version.',
    })
  }

  if (draft.mode !== 'replay') {
    issues.push({
      code: 'live_mode_unavailable',
      field: 'mode',
      message: 'Live execution is unavailable; generate a replay plan instead.',
    })
  }

  if (draft.device.trim().length > 120) {
    issues.push({
      code: 'device_annotation_too_long',
      field: 'device',
      message: 'Optional device annotations must be 120 characters or fewer.',
    })
  }

  return Object.freeze(issues)
}

export function generateEvidencePlan(draft: MissionDraft, replay: ReplayEvidence): EvidencePlan {
  const issues = validateMissionDraft(draft, replay)
  if (issues.length > 0) {
    throw new MissionPlanValidationError(issues)
  }

  const selectedRegion =
    draft.region === 'global'
      ? undefined
      : replay.mission.regions.find((region) => region.name === draft.region)
  const expectedStages = replay.mission.pipelineStages.map((stage, index) => ({
    sequence: index + 1,
    ...stage,
  }))
  const unavailableStages = expectedStages
    .filter((stage) => stage.status === 'unavailable')
    .map((stage) => ({
      sequence: stage.sequence,
      stageId: stage.stageId,
      reason: stage.reason ?? 'No committed evidence is available for this stage.',
    }))
  const artifactExpectations = Object.values(replay.sections)
    .sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))
    .map((section) => ({
      role: section.name,
      availability: section.status,
      artifactIds: [...section.artifactIds],
      purpose:
        section.status === 'unavailable'
          ? ('future_evidence_required' as const)
          : ('verified_replay_input' as const),
      humanReviewRequired: section.humanReviewRequired,
      scientificClaimAllowed: section.scientificClaimAllowed,
    }))
  const plannedReviewAssignments =
    draft.auditSampleSize * draft.independentReviewerCount
  const minimumDecisiveOutcomes = approximateMinimumDecisiveOutcomes(
    draft.qualityPrecisionObjectivePercent,
  )

  return deepFreeze<EvidencePlan>({
    planVersion: EVIDENCE_PLAN_VERSION,
    target: {
      scientificName: replay.target.scientificName,
      acceptedTaxonKey: replay.target.acceptedTaxonKey,
    },
    sourceRegistry: { ...replay.mission.sourceRegistry },
    region: {
      selection: selectedRegion?.name ?? 'global',
      regionCount: selectedRegion === undefined ? replay.mission.regions.length : 1,
      countryCount:
        selectedRegion?.countryCount ??
        replay.mission.regions.reduce((total, region) => total + region.countryCount, 0),
      rangeStatus: selectedRegion?.rangeStatus ?? 'multiple_planning_statuses',
      requiresOccurrenceSupport:
        selectedRegion?.requiresOccurrenceSupport ??
        replay.mission.regions.some((region) => region.requiresOccurrenceSupport),
      taxonomicCaution:
        selectedRegion?.taxonomicCaution ??
        replay.mission.regions.some((region) => region.taxonomicCaution),
      evidenceQualifier: 'planning_hypothesis',
    },
    queryStrategy: {
      retrievalPolicy: draft.retrievalPolicy,
      committedDefinitionCount: replay.mission.queryPolicy.queryCount,
      registryLinkedSpeciesCount: replay.mission.queryPolicy.queriedSpeciesCount,
      registryIdentityRequired: replay.mission.queryPolicy.registryIdentityRequired,
      geographyEvidenceMode: 'soft_structured_evidence',
      missingGeographyMeans: 'unknown',
      targetAlwaysScoreable: true,
      scoreAllEligibleCandidates: true,
      eligibleCandidateCount: replay.mission.candidatePolicy.candidateCount,
      referencePolicy: draft.referencePolicy,
      evidenceStrictness: draft.evidenceStrictness,
    },
    expectedStages,
    approvedBudget: {
      maximumApiCalls: draft.maximumApiCalls,
      fixtureMaterializedApiCalls: replay.mission.budgets.materializedRequestCount,
      candidateLimit: draft.candidateLimit,
      historicalLocalVerificationImages:
        replay.mission.budgets.historicalLocalBuildVerificationImages,
      localVerificationMaxImages: null,
      device: draft.device.trim() || null,
      basis: 'validated_mission_bounds',
    },
    verificationWork: {
      reviewBudget: draft.reviewBudget,
      auditSampleSize: draft.auditSampleSize,
      auditCampaignPopulationSize: FLICKR_AUDIT_POPULATION_SIZE,
      independentReviewerCount: draft.independentReviewerCount,
      plannedReviewAssignments,
      unallocatedReviewBudget: draft.reviewBudget - plannedReviewAssignments,
      qualityPrecisionObjective: {
        metric: '95_percent_wilson_half_width',
        maximumHalfWidth: draft.qualityPrecisionObjectivePercent / 100,
        requestedPercent: draft.qualityPrecisionObjectivePercent,
        approximateMinimumDecisiveOutcomes: minimumDecisiveOutcomes,
        auditSampleSatisfiesApproximation: true,
        currentDecisiveWeightedOutcomeCount: 0,
        intervalAvailability: 'unavailable',
      },
      referenceReview: {
        requirement: draft.referencePolicy,
        campaignItemCount: REFERENCE_AUDIT_ITEM_COUNT,
        requiredIndependentReviewers: 2,
        currentIndependentOutcomeCount: 0,
        providerRoleSuitableRecordCount:
          BIOMINER_ROLE_SUITABLE_RECORD_COUNT,
        status:
          draft.referencePolicy === 'human_review_before_support_use'
            ? 'blocked'
            : 'metadata_planning_only',
      },
    },
    unavailableStages,
    artifactExpectations,
    approvalRequirement: {
      required: true,
      status: 'not_approved',
      liveWorkApproved: false,
      reason: 'Human-reviewed reference evidence and all Phase 15 gates are incomplete.',
      requiredEvidence: [...replay.mission.stoppingConditions.requiredEvidence],
      incompletePrerequisiteGates: replay.mission.prerequisiteGates
        .filter((gate) => gate.status !== 'complete')
        .map((gate) => gate.gateId),
    },
    execution: {
      requestedMode: 'replay',
      capability: 'plan_only',
      launchesWork: false,
      usesOpenAI: false,
    },
  })
}

function approximateMinimumDecisiveOutcomes(
  objectivePercent: number,
): number {
  const halfWidth = objectivePercent / 100
  return Math.ceil((1.96 ** 2 * 0.25) / halfWidth ** 2)
}
