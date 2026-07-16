export const VERIFICATION_RELEASE_POLICY_SCHEMA_VERSION =
  'taxalens-verification-release-policy:v1.0.0' as const

export interface VerificationReleasePolicy {
  readonly schemaVersion: typeof VERIFICATION_RELEASE_POLICY_SCHEMA_VERSION
  readonly policyId: string
  readonly minimumDecisiveSample: number
  readonly requiredStrata: readonly string[]
  readonly minimumReviewerAgreement: number
  readonly maximumConflictRate: number
  readonly requireReferenceReadiness: boolean
  readonly minimumPrecisionLowerBound: number
  readonly requireReviewedLabelLeakageGate: boolean
}

export function defineVerificationReleasePolicy(
  policy: VerificationReleasePolicy,
): VerificationReleasePolicy {
  const failures = validateVerificationReleasePolicy(policy)
  if (failures.length > 0) {
    throw new Error(
      `Verification release policy is invalid: ${failures.join('; ')}`,
    )
  }
  return Object.freeze({
    ...policy,
    requiredStrata: Object.freeze([...policy.requiredStrata]),
  })
}

export function validateVerificationReleasePolicy(
  policy: VerificationReleasePolicy,
): readonly string[] {
  const failures: string[] = []
  if (policy.schemaVersion !== VERIFICATION_RELEASE_POLICY_SCHEMA_VERSION) {
    failures.push('release policy schema version is unsupported')
  }
  if (policy.policyId.trim() === '') {
    failures.push('release policy ID must not be empty')
  }
  if (
    !Number.isInteger(policy.minimumDecisiveSample) ||
    policy.minimumDecisiveSample < 1
  ) {
    failures.push('minimum decisive sample must be a positive integer')
  }
  if (
    policy.requiredStrata.some((stratumId) => stratumId.trim() === '') ||
    !sortedUnique(policy.requiredStrata)
  ) {
    failures.push('required strata must be non-empty, sorted, and unique')
  }
  if (!isProportion(policy.minimumReviewerAgreement)) {
    failures.push('minimum reviewer agreement must be a proportion')
  }
  if (!isProportion(policy.maximumConflictRate)) {
    failures.push('maximum conflict rate must be a proportion')
  }
  if (!isProportion(policy.minimumPrecisionLowerBound)) {
    failures.push('minimum precision lower bound must be a proportion')
  }
  if (
    typeof policy.requireReferenceReadiness !== 'boolean' ||
    typeof policy.requireReviewedLabelLeakageGate !== 'boolean'
  ) {
    failures.push('release readiness gates must be Boolean')
  }
  return Object.freeze(failures)
}

function isProportion(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1
}

function sortedUnique(values: readonly string[]): boolean {
  return values.every(
    (value, index) => index === 0 || values[index - 1]! < value,
  )
}
