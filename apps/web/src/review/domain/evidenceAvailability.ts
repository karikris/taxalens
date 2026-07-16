export const EVIDENCE_AVAILABILITY_SCHEMA_VERSION =
  'taxalens-evidence-availability:v1.0.0' as const

export const EVIDENCE_AVAILABILITY_STATES = Object.freeze([
  'available',
  'measured_zero',
  'unavailable',
  'blocked',
  'not_applicable',
  'failed',
] as const)

export type EvidenceAvailabilityState =
  (typeof EVIDENCE_AVAILABILITY_STATES)[number]

export interface AvailableEvidence<T> {
  readonly schemaVersion: typeof EVIDENCE_AVAILABILITY_SCHEMA_VERSION
  readonly state: 'available'
  readonly value: T
}

export interface MeasuredZeroEvidence {
  readonly schemaVersion: typeof EVIDENCE_AVAILABILITY_SCHEMA_VERSION
  readonly state: 'measured_zero'
  readonly value: 0
}

export interface UnavailableEvidence {
  readonly schemaVersion: typeof EVIDENCE_AVAILABILITY_SCHEMA_VERSION
  readonly state: 'unavailable'
  readonly reason: string
}

export interface BlockedEvidence {
  readonly schemaVersion: typeof EVIDENCE_AVAILABILITY_SCHEMA_VERSION
  readonly state: 'blocked'
  readonly reason: string
  readonly blockers: readonly string[]
}

export interface NotApplicableEvidence {
  readonly schemaVersion: typeof EVIDENCE_AVAILABILITY_SCHEMA_VERSION
  readonly state: 'not_applicable'
  readonly reason: string
}

export interface FailedEvidence {
  readonly schemaVersion: typeof EVIDENCE_AVAILABILITY_SCHEMA_VERSION
  readonly state: 'failed'
  readonly errorCode: string
  readonly message: string
  readonly retryable: boolean
}

export type EvidenceAvailability<T> =
  | AvailableEvidence<T>
  | MeasuredZeroEvidence
  | UnavailableEvidence
  | BlockedEvidence
  | NotApplicableEvidence
  | FailedEvidence

export class EvidenceAvailabilityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EvidenceAvailabilityError'
  }
}

export function availableEvidence<T>(
  value: NonNullable<T>,
): AvailableEvidence<NonNullable<T>> {
  if (value === null || value === undefined) {
    throw new EvidenceAvailabilityError(
      'Available evidence cannot contain null or undefined',
    )
  }
  if (typeof value === 'number' && Object.is(value, 0)) {
    throw new EvidenceAvailabilityError(
      'Measured numeric zero must use the measured_zero evidence state',
    )
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new EvidenceAvailabilityError(
      'Available numeric evidence must be finite',
    )
  }
  return deepFreeze({
    schemaVersion: EVIDENCE_AVAILABILITY_SCHEMA_VERSION,
    state: 'available' as const,
    value: clonePlainValue(value),
  })
}

export function measuredZeroEvidence(): MeasuredZeroEvidence {
  return deepFreeze({
    schemaVersion: EVIDENCE_AVAILABILITY_SCHEMA_VERSION,
    state: 'measured_zero' as const,
    value: 0 as const,
  })
}

export function unavailableEvidence(reason: string): UnavailableEvidence {
  return deepFreeze({
    schemaVersion: EVIDENCE_AVAILABILITY_SCHEMA_VERSION,
    state: 'unavailable' as const,
    reason: boundedText(reason, 'Unavailable evidence reason'),
  })
}

export function blockedEvidence(
  reason: string,
  blockers: readonly string[],
): BlockedEvidence {
  const canonicalBlockers = canonicalStrings(
    blockers,
    'Blocked evidence blocker',
  )
  if (canonicalBlockers.length === 0) {
    throw new EvidenceAvailabilityError(
      'Blocked evidence requires at least one blocker',
    )
  }
  return deepFreeze({
    schemaVersion: EVIDENCE_AVAILABILITY_SCHEMA_VERSION,
    state: 'blocked' as const,
    reason: boundedText(reason, 'Blocked evidence reason'),
    blockers: canonicalBlockers,
  })
}

export function notApplicableEvidence(
  reason: string,
): NotApplicableEvidence {
  return deepFreeze({
    schemaVersion: EVIDENCE_AVAILABILITY_SCHEMA_VERSION,
    state: 'not_applicable' as const,
    reason: boundedText(reason, 'Not-applicable evidence reason'),
  })
}

export function failedEvidence(
  errorCode: string,
  message: string,
  retryable: boolean,
): FailedEvidence {
  const canonicalCode = boundedText(
    errorCode,
    'Failed evidence error code',
  )
  if (!/^[a-z][a-z0-9_]{0,119}$/u.test(canonicalCode)) {
    throw new EvidenceAvailabilityError(
      'Failed evidence error code must be lower snake case',
    )
  }
  return deepFreeze({
    schemaVersion: EVIDENCE_AVAILABILITY_SCHEMA_VERSION,
    state: 'failed' as const,
    errorCode: canonicalCode,
    message: boundedText(message, 'Failed evidence message', 2_000),
    retryable,
  })
}

export function validateEvidenceAvailability<T>(
  value: unknown,
  validateAvailableValue?: (value: unknown) => value is T,
): readonly string[] {
  if (!isRecord(value)) {
    return Object.freeze(['evidence availability must be an object'])
  }
  if (value.schemaVersion !== EVIDENCE_AVAILABILITY_SCHEMA_VERSION) {
    return Object.freeze(['evidence availability schema version is unsupported'])
  }
  if (
    typeof value.state !== 'string' ||
    !EVIDENCE_AVAILABILITY_STATES.includes(
      value.state as EvidenceAvailabilityState,
    )
  ) {
    return Object.freeze(['evidence availability state is unsupported'])
  }
  const keys = Object.keys(value).sort()
  switch (value.state) {
    case 'available':
      return validateAvailable(value, keys, validateAvailableValue)
    case 'measured_zero':
      return validateMeasuredZero(value, keys)
    case 'unavailable':
    case 'not_applicable':
      return validateReasonOnly(value, keys, value.state)
    case 'blocked':
      return validateBlocked(value, keys)
    case 'failed':
      return validateFailed(value, keys)
    default:
      return Object.freeze(['evidence availability state is unsupported'])
  }
}

export function mapAvailableEvidence<T, U>(
  evidence: EvidenceAvailability<T>,
  transform: (value: T) => NonNullable<U>,
): EvidenceAvailability<NonNullable<U>> {
  if (evidence.state !== 'available') {
    return evidence
  }
  return availableEvidence(transform(evidence.value))
}

export function evidenceValueOrUndefined<T>(
  evidence: EvidenceAvailability<T>,
): T | 0 | undefined {
  switch (evidence.state) {
    case 'available':
      return evidence.value
    case 'measured_zero':
      return 0
    case 'unavailable':
    case 'blocked':
    case 'not_applicable':
    case 'failed':
      return undefined
  }
}

function validateAvailable<T>(
  value: Readonly<Record<string, unknown>>,
  keys: readonly string[],
  validateAvailableValue: ((value: unknown) => value is T) | undefined,
): readonly string[] {
  const failures: string[] = []
  if (!sameKeys(keys, ['schemaVersion', 'state', 'value'])) {
    failures.push('available evidence fields are invalid')
  }
  if (value.value === null || value.value === undefined) {
    failures.push('available evidence value must not be null or undefined')
  }
  if (typeof value.value === 'number') {
    if (Object.is(value.value, 0)) {
      failures.push('numeric zero must use measured_zero evidence')
    }
    if (!Number.isFinite(value.value)) {
      failures.push('available numeric evidence must be finite')
    }
  }
  if (
    validateAvailableValue !== undefined &&
    !validateAvailableValue(value.value)
  ) {
    failures.push('available evidence value is invalid')
  }
  return Object.freeze(failures)
}

function validateMeasuredZero(
  value: Readonly<Record<string, unknown>>,
  keys: readonly string[],
): readonly string[] {
  const failures: string[] = []
  if (!sameKeys(keys, ['schemaVersion', 'state', 'value'])) {
    failures.push('measured-zero evidence fields are invalid')
  }
  if (!Object.is(value.value, 0)) {
    failures.push('measured-zero evidence value must equal numeric zero')
  }
  return Object.freeze(failures)
}

function validateReasonOnly(
  value: Readonly<Record<string, unknown>>,
  keys: readonly string[],
  label: 'unavailable' | 'not_applicable',
): readonly string[] {
  const failures: string[] = []
  if (!sameKeys(keys, ['reason', 'schemaVersion', 'state'])) {
    failures.push(`${label} evidence fields are invalid`)
  }
  if (!validText(value.reason)) {
    failures.push(`${label} evidence reason must be non-empty`)
  }
  return Object.freeze(failures)
}

function validateBlocked(
  value: Readonly<Record<string, unknown>>,
  keys: readonly string[],
): readonly string[] {
  const failures: string[] = []
  if (!sameKeys(keys, ['blockers', 'reason', 'schemaVersion', 'state'])) {
    failures.push('blocked evidence fields are invalid')
  }
  if (!validText(value.reason)) {
    failures.push('blocked evidence reason must be non-empty')
  }
  if (
    !Array.isArray(value.blockers) ||
    value.blockers.length === 0 ||
    value.blockers.some((blocker) => !validText(blocker)) ||
    new Set(value.blockers).size !== value.blockers.length ||
    !sameOrderedValues(
      value.blockers,
      [...value.blockers].sort((left, right) =>
        String(left).localeCompare(String(right)),
      ),
    )
  ) {
    failures.push('blocked evidence blockers must be non-empty unique sorted strings')
  }
  return Object.freeze(failures)
}

function validateFailed(
  value: Readonly<Record<string, unknown>>,
  keys: readonly string[],
): readonly string[] {
  const failures: string[] = []
  if (
    !sameKeys(keys, [
      'errorCode',
      'message',
      'retryable',
      'schemaVersion',
      'state',
    ])
  ) {
    failures.push('failed evidence fields are invalid')
  }
  if (
    typeof value.errorCode !== 'string' ||
    !/^[a-z][a-z0-9_]{0,119}$/u.test(value.errorCode)
  ) {
    failures.push('failed evidence error code is invalid')
  }
  if (!validText(value.message)) {
    failures.push('failed evidence message must be non-empty')
  }
  if (typeof value.retryable !== 'boolean') {
    failures.push('failed evidence retryable must be boolean')
  }
  return Object.freeze(failures)
}

function canonicalStrings(
  values: readonly string[],
  label: string,
): readonly string[] {
  const canonical = values.map((value) => boundedText(value, label))
  if (new Set(canonical).size !== canonical.length) {
    throw new EvidenceAvailabilityError(`${label}s must be unique`)
  }
  return Object.freeze(
    [...canonical].sort((left, right) => left.localeCompare(right)),
  )
}

function boundedText(
  value: string,
  label: string,
  maximum = 1_200,
): string {
  const canonical = value.trim()
  if (canonical.length === 0 || canonical.length > maximum) {
    throw new EvidenceAvailabilityError(
      `${label} must contain between 1 and ${maximum} characters`,
    )
  }
  return canonical
}

function validText(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= 2_000
  )
}

function sameKeys(
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  return sameOrderedValues(
    actual,
    [...expected].sort((left, right) => left.localeCompare(right)),
  )
}

function sameOrderedValues(
  left: readonly unknown[],
  right: readonly unknown[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  )
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function clonePlainValue<T>(value: T): T {
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'string'
  ) {
    return value
  }
  if (Array.isArray(value)) {
    return value.map((item) => clonePlainValue(item)) as T
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        clonePlainValue(child),
      ]),
    ) as T
  }
  throw new EvidenceAvailabilityError(
    'Available evidence value must be JSON-compatible',
  )
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
