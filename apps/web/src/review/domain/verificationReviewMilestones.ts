export const VERIFICATION_REVIEW_MILESTONE_SCHEMA_VERSION =
  'taxalens-verification-review-milestones:v1.0.0' as const

export const DEFAULT_VERIFICATION_REVIEW_MILESTONES = Object.freeze([
  20, 40, 60, 100,
] as const)

export interface VerificationReviewMilestonePlan {
  readonly schemaVersion:
    typeof VERIFICATION_REVIEW_MILESTONE_SCHEMA_VERSION
  readonly milestonePlanId: string
  readonly milestones: readonly number[]
}

export type VerificationMilestoneStatus =
  | 'evaluation_due'
  | 'not_due'
  | 'already_evaluated'
  | 'schedule_complete'

export interface VerificationMilestoneEvaluation {
  readonly schemaVersion:
    typeof VERIFICATION_REVIEW_MILESTONE_SCHEMA_VERSION
  readonly milestonePlanId: string
  readonly decisiveSampleCount: number
  readonly status: VerificationMilestoneStatus
  readonly releaseEvaluationAllowed: boolean
  readonly currentMilestone: number | null
  readonly nextMilestone: number | null
  readonly evaluatedMilestones: readonly number[]
  readonly missedMilestones: readonly number[]
}

export function defineVerificationReviewMilestonePlan(
  plan: VerificationReviewMilestonePlan,
): VerificationReviewMilestonePlan {
  const failures = validateVerificationReviewMilestonePlan(plan)
  if (failures.length > 0) {
    throw new Error(
      `Verification review milestone plan is invalid: ${failures.join('; ')}`,
    )
  }
  return Object.freeze({
    ...plan,
    milestones: Object.freeze([...plan.milestones]),
  })
}

export function validateVerificationReviewMilestonePlan(
  plan: VerificationReviewMilestonePlan,
): readonly string[] {
  const failures: string[] = []
  if (
    plan.schemaVersion !== VERIFICATION_REVIEW_MILESTONE_SCHEMA_VERSION
  ) {
    failures.push('review milestone schema version is unsupported')
  }
  if (plan.milestonePlanId.trim() === '') {
    failures.push('review milestone plan ID must not be empty')
  }
  if (
    plan.milestones.length === 0 ||
    plan.milestones.some(
      (milestone, index) =>
        !Number.isInteger(milestone) ||
        milestone < 1 ||
        (index > 0 && plan.milestones[index - 1]! >= milestone),
    )
  ) {
    failures.push(
      'review milestones must be positive, unique, and strictly increasing',
    )
  }
  return Object.freeze(failures)
}

export function evaluateVerificationReviewMilestone(
  plan: VerificationReviewMilestonePlan,
  decisiveSampleCount: number,
  evaluatedMilestones: readonly number[],
): VerificationMilestoneEvaluation {
  const planFailures = validateVerificationReviewMilestonePlan(plan)
  if (planFailures.length > 0) {
    throw new Error(
      `Verification review milestone plan is invalid: ${planFailures.join('; ')}`,
    )
  }
  const stateFailures = validateMilestoneState(
    plan,
    decisiveSampleCount,
    evaluatedMilestones,
  )
  if (stateFailures.length > 0) {
    throw new Error(
      `Verification review milestone state is invalid: ${stateFailures.join('; ')}`,
    )
  }
  const currentMilestone = plan.milestones.includes(decisiveSampleCount)
    ? decisiveSampleCount
    : null
  const alreadyEvaluated =
    currentMilestone !== null &&
    evaluatedMilestones.includes(currentMilestone)
  const nextMilestone =
    plan.milestones.find((milestone) => milestone > decisiveSampleCount) ??
    null
  const missedMilestones = plan.milestones.filter(
    (milestone) =>
      milestone < decisiveSampleCount &&
      !evaluatedMilestones.includes(milestone),
  )
  const status: VerificationMilestoneStatus =
    currentMilestone !== null && !alreadyEvaluated
      ? 'evaluation_due'
      : alreadyEvaluated
        ? 'already_evaluated'
        : nextMilestone === null
          ? 'schedule_complete'
          : 'not_due'
  return Object.freeze({
    schemaVersion: VERIFICATION_REVIEW_MILESTONE_SCHEMA_VERSION,
    milestonePlanId: plan.milestonePlanId,
    decisiveSampleCount,
    status,
    releaseEvaluationAllowed: status === 'evaluation_due',
    currentMilestone,
    nextMilestone,
    evaluatedMilestones: Object.freeze([...evaluatedMilestones]),
    missedMilestones: Object.freeze(missedMilestones),
  })
}

function validateMilestoneState(
  plan: VerificationReviewMilestonePlan,
  decisiveSampleCount: number,
  evaluatedMilestones: readonly number[],
): readonly string[] {
  const failures: string[] = []
  if (
    !Number.isInteger(decisiveSampleCount) ||
    decisiveSampleCount < 0
  ) {
    failures.push('decisive sample count must be a non-negative integer')
  }
  if (
    evaluatedMilestones.some(
      (milestone, index) =>
        !plan.milestones.includes(milestone) ||
        milestone > decisiveSampleCount ||
        (index > 0 && evaluatedMilestones[index - 1]! >= milestone),
    )
  ) {
    failures.push(
      'evaluated milestones must be reached, declared, sorted, and unique',
    )
  }
  return Object.freeze(failures)
}
