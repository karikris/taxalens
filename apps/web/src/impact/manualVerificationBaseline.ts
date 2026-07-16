export const VERIFICATION_IMPACT_SESSION_SCHEMA_VERSION =
  'taxalens-verification-impact-session:v1.0.0' as const

export const MANUAL_BASELINE_PROTOCOL_VERSION =
  'taxalens-manual-verification-baseline:v1.0.0' as const

export type ImpactDecisionOutcome =
  | 'yes'
  | 'no'
  | 'cant_tell'
  | 'cant_view'
  | 'skipped'

export type ManualBaselineActionKind =
  | 'page_opened'
  | 'duplicate_inspected'
  | 'field_completed'
  | 'decision_recorded'
  | 'other'

export interface ManualBaselineActionInput {
  readonly actionKind: ManualBaselineActionKind
  readonly actionId: string
  readonly recordedAt: string
  readonly pageId?: string
  readonly duplicateGroupId?: string
  readonly fieldId?: string
  readonly itemId?: string
  readonly outcome?: ImpactDecisionOutcome
}

export interface ImpactActivityEvent {
  readonly eventType: 'activity'
  readonly sequence: number
  readonly recordedAt: string
  readonly state: 'active' | 'paused'
  readonly reason: 'session_started' | 'participant_pause' | 'session_completed'
}

export interface ImpactActionEvent {
  readonly eventType: 'action'
  readonly sequence: number
  readonly recordedAt: string
  readonly actionKind: ManualBaselineActionKind
  readonly actionId: string
  readonly pageId: string | null
  readonly duplicateGroupId: string | null
  readonly fieldId: string | null
  readonly itemId: string | null
  readonly outcome: ImpactDecisionOutcome | null
}

export interface ImpactCompletionEvent {
  readonly eventType: 'completion'
  readonly sequence: number
  readonly recordedAt: string
  readonly state: 'completed'
}

export type VerificationImpactEvent =
  | ImpactActivityEvent
  | ImpactActionEvent
  | ImpactCompletionEvent

export interface ManualVerificationBaselineSession {
  readonly schemaVersion: typeof VERIFICATION_IMPACT_SESSION_SCHEMA_VERSION
  readonly protocolVersion: typeof MANUAL_BASELINE_PROTOCOL_VERSION
  readonly workflow: 'manual_baseline'
  readonly studyId: string
  readonly sessionId: string
  readonly participantIdHash: string
  readonly taskSetId: string
  readonly startedAt: string
  readonly completedAt: string | null
  readonly events: readonly VerificationImpactEvent[]
}

export interface VerificationImpactSummary {
  readonly schemaVersion: 'taxalens-verification-impact-summary:v1.0.0'
  readonly workflow: 'manual_baseline'
  readonly studyId: string
  readonly sessionId: string
  readonly taskSetId: string
  readonly completed: boolean
  readonly activeMilliseconds: number
  readonly activeMinutes: number
  readonly elapsedMilliseconds: number | null
  readonly elapsedMinutes: number | null
  readonly actions: number
  readonly pagesOpened: number
  readonly uniquePagesOpened: number
  readonly duplicatesInspected: number
  readonly uniqueDuplicatesInspected: number
  readonly fieldsCompleted: number
  readonly uniqueFieldsCompleted: number
  readonly decisions: number
  readonly uniqueItemsDecided: number
  readonly outcomeCounts: Readonly<Record<ImpactDecisionOutcome, number>>
}

export function createManualVerificationBaseline(input: {
  readonly studyId: string
  readonly sessionId: string
  readonly participantIdHash: string
  readonly taskSetId: string
  readonly startedAt: string
}): ManualVerificationBaselineSession {
  requireIdentifier(input.studyId, 'studyId')
  requireIdentifier(input.sessionId, 'sessionId')
  requireIdentifier(input.taskSetId, 'taskSetId')
  if (!/^[a-f0-9]{64}$/u.test(input.participantIdHash)) {
    throw new Error('participantIdHash must be a lowercase SHA-256 digest')
  }
  requireTimestamp(input.startedAt, 'startedAt')
  return freezeSession({
    schemaVersion: VERIFICATION_IMPACT_SESSION_SCHEMA_VERSION,
    protocolVersion: MANUAL_BASELINE_PROTOCOL_VERSION,
    workflow: 'manual_baseline',
    studyId: input.studyId,
    sessionId: input.sessionId,
    participantIdHash: input.participantIdHash,
    taskSetId: input.taskSetId,
    startedAt: input.startedAt,
    completedAt: null,
    events: [
      {
        eventType: 'activity',
        sequence: 1,
        recordedAt: input.startedAt,
        state: 'active',
        reason: 'session_started',
      },
    ],
  })
}

export function recordManualBaselineAction(
  session: ManualVerificationBaselineSession,
  input: ManualBaselineActionInput,
): ManualVerificationBaselineSession {
  validateSession(session)
  requireOpenActiveSession(session)
  validateAction(input)
  requireTimestampAfterSession(session, input.recordedAt)
  return appendEvent(session, {
    eventType: 'action',
    sequence: session.events.length + 1,
    recordedAt: input.recordedAt,
    actionKind: input.actionKind,
    actionId: input.actionId,
    pageId: input.pageId ?? null,
    duplicateGroupId: input.duplicateGroupId ?? null,
    fieldId: input.fieldId ?? null,
    itemId: input.itemId ?? null,
    outcome: input.outcome ?? null,
  })
}

export function pauseManualVerificationBaseline(
  session: ManualVerificationBaselineSession,
  recordedAt: string,
): ManualVerificationBaselineSession {
  validateSession(session)
  requireOpenActiveSession(session)
  requireTimestampAfterSession(session, recordedAt)
  return appendEvent(session, {
    eventType: 'activity',
    sequence: session.events.length + 1,
    recordedAt,
    state: 'paused',
    reason: 'participant_pause',
  })
}

export function resumeManualVerificationBaseline(
  session: ManualVerificationBaselineSession,
  recordedAt: string,
): ManualVerificationBaselineSession {
  validateSession(session)
  requireOpenSession(session)
  if (currentActivityState(session) !== 'paused') {
    throw new Error('manual baseline session is already active')
  }
  requireTimestampAfterSession(session, recordedAt)
  return appendEvent(session, {
    eventType: 'activity',
    sequence: session.events.length + 1,
    recordedAt,
    state: 'active',
    reason: 'participant_pause',
  })
}

export function completeManualVerificationBaseline(
  session: ManualVerificationBaselineSession,
  completedAt: string,
): ManualVerificationBaselineSession {
  validateSession(session)
  requireOpenSession(session)
  requireTimestampAfterSession(session, completedAt)
  const events = [...session.events]
  if (currentActivityState(session) === 'active') {
    events.push({
      eventType: 'activity',
      sequence: events.length + 1,
      recordedAt: completedAt,
      state: 'paused',
      reason: 'session_completed',
    })
  }
  events.push({
    eventType: 'completion',
    sequence: events.length + 1,
    recordedAt: completedAt,
    state: 'completed',
  })
  const completed = {
    ...session,
    completedAt,
    events,
  }
  validateSession(completed)
  return freezeSession(completed)
}

export function summarizeManualVerificationBaseline(
  session: ManualVerificationBaselineSession,
): VerificationImpactSummary {
  validateSession(session)
  const actions = session.events.filter(
    (event): event is ImpactActionEvent => event.eventType === 'action',
  )
  const pages = values(actions, 'page_opened', 'pageId')
  const duplicates = values(
    actions,
    'duplicate_inspected',
    'duplicateGroupId',
  )
  const fields = values(actions, 'field_completed', 'fieldId')
  const decisions = actions.filter(
    ({ actionKind }) => actionKind === 'decision_recorded',
  )
  const itemIds = decisions.flatMap(({ itemId }) =>
    itemId === null ? [] : [itemId],
  )
  const outcomeCounts: Record<ImpactDecisionOutcome, number> = {
    yes: 0,
    no: 0,
    cant_tell: 0,
    cant_view: 0,
    skipped: 0,
  }
  for (const decision of decisions) {
    if (decision.outcome !== null) {
      outcomeCounts[decision.outcome] += 1
    }
  }
  const activeMilliseconds = calculateActiveMilliseconds(session)
  const elapsedMilliseconds =
    session.completedAt === null
      ? null
      : Date.parse(session.completedAt) - Date.parse(session.startedAt)
  return Object.freeze({
    schemaVersion: 'taxalens-verification-impact-summary:v1.0.0',
    workflow: 'manual_baseline',
    studyId: session.studyId,
    sessionId: session.sessionId,
    taskSetId: session.taskSetId,
    completed: session.completedAt !== null,
    activeMilliseconds,
    activeMinutes: activeMilliseconds / 60_000,
    elapsedMilliseconds,
    elapsedMinutes:
      elapsedMilliseconds === null ? null : elapsedMilliseconds / 60_000,
    actions: actions.length,
    pagesOpened: pages.length,
    uniquePagesOpened: new Set(pages).size,
    duplicatesInspected: duplicates.length,
    uniqueDuplicatesInspected: new Set(duplicates).size,
    fieldsCompleted: fields.length,
    uniqueFieldsCompleted: new Set(fields).size,
    decisions: decisions.length,
    uniqueItemsDecided: new Set(itemIds).size,
    outcomeCounts: Object.freeze(outcomeCounts),
  })
}

export function validateManualVerificationBaseline(
  session: ManualVerificationBaselineSession,
): readonly string[] {
  try {
    validateSession(session)
    return Object.freeze([])
  } catch (error) {
    return Object.freeze([
      error instanceof Error ? error.message : 'manual baseline is invalid',
    ])
  }
}

function validateSession(session: ManualVerificationBaselineSession): void {
  if (
    session.schemaVersion !== VERIFICATION_IMPACT_SESSION_SCHEMA_VERSION ||
    session.protocolVersion !== MANUAL_BASELINE_PROTOCOL_VERSION ||
    session.workflow !== 'manual_baseline'
  ) {
    throw new Error('manual baseline schema or protocol is unsupported')
  }
  requireIdentifier(session.studyId, 'studyId')
  requireIdentifier(session.sessionId, 'sessionId')
  requireIdentifier(session.taskSetId, 'taskSetId')
  if (!/^[a-f0-9]{64}$/u.test(session.participantIdHash)) {
    throw new Error('participantIdHash must be a lowercase SHA-256 digest')
  }
  requireTimestamp(session.startedAt, 'startedAt')
  if (session.events.length === 0) {
    throw new Error('manual baseline requires an activity-start event')
  }
  let activityState: 'active' | 'paused' | null = null
  let completionCount = 0
  let previousTime = Date.parse(session.startedAt)
  for (const [index, event] of session.events.entries()) {
    if (event.sequence !== index + 1) {
      throw new Error('manual baseline event sequences must be contiguous')
    }
    requireTimestamp(event.recordedAt, 'event recordedAt')
    const eventTime = Date.parse(event.recordedAt)
    if (eventTime < previousTime) {
      throw new Error('manual baseline events must be chronological')
    }
    previousTime = eventTime
    if (event.eventType === 'activity') {
      if (event.state === activityState) {
        throw new Error('manual baseline activity states must alternate')
      }
      if (
        index === 0 &&
        (event.state !== 'active' || event.reason !== 'session_started')
      ) {
        throw new Error('manual baseline must begin active')
      }
      activityState = event.state
    } else if (event.eventType === 'action') {
      if (activityState !== 'active') {
        throw new Error('manual baseline actions require active time')
      }
      validateAction(event)
    } else {
      completionCount += 1
      if (index !== session.events.length - 1) {
        throw new Error('manual baseline completion must be the final event')
      }
    }
  }
  if (session.completedAt === null) {
    if (completionCount !== 0) {
      throw new Error('open manual baseline cannot contain completion')
    }
  } else {
    requireTimestamp(session.completedAt, 'completedAt')
    const finalEvent = session.events.at(-1)
    if (
      completionCount !== 1 ||
      finalEvent?.eventType !== 'completion' ||
      finalEvent.recordedAt !== session.completedAt
    ) {
      throw new Error('completed manual baseline requires one final completion')
    }
  }
}

function validateAction(
  input: Omit<ManualBaselineActionInput, 'pageId' | 'duplicateGroupId' | 'fieldId' | 'itemId' | 'outcome'> & {
    readonly pageId?: string | null
    readonly duplicateGroupId?: string | null
    readonly fieldId?: string | null
    readonly itemId?: string | null
    readonly outcome?: ImpactDecisionOutcome | null
  },
): void {
  requireIdentifier(input.actionId, 'actionId')
  requireTimestamp(input.recordedAt, 'action recordedAt')
  const fields = {
    pageId: input.pageId ?? null,
    duplicateGroupId: input.duplicateGroupId ?? null,
    fieldId: input.fieldId ?? null,
    itemId: input.itemId ?? null,
    outcome: input.outcome ?? null,
  }
  const expectedByKind: Readonly<
    Record<ManualBaselineActionKind, readonly string[]>
  > = {
    page_opened: ['pageId'],
    duplicate_inspected: ['duplicateGroupId'],
    field_completed: ['fieldId'],
    decision_recorded: ['itemId', 'outcome'],
    other: [],
  }
  if (!Object.hasOwn(expectedByKind, input.actionKind)) {
    throw new Error('manual baseline action kind is unsupported')
  }
  const expected = expectedByKind[input.actionKind]
  for (const [field, value] of Object.entries(fields)) {
    const required = expected.includes(field)
    if (required && (value === null || value === '')) {
      throw new Error(`${input.actionKind} requires ${field}`)
    }
    if (!required && value !== null) {
      throw new Error(`${input.actionKind} does not allow ${field}`)
    }
  }
}

function calculateActiveMilliseconds(
  session: ManualVerificationBaselineSession,
): number {
  let activeStartedAt: number | null = null
  let activeMilliseconds = 0
  for (const event of session.events) {
    if (event.eventType !== 'activity') {
      continue
    }
    const time = Date.parse(event.recordedAt)
    if (event.state === 'active') {
      activeStartedAt = time
    } else if (activeStartedAt !== null) {
      activeMilliseconds += time - activeStartedAt
      activeStartedAt = null
    }
  }
  return activeMilliseconds
}

function values(
  actions: readonly ImpactActionEvent[],
  actionKind: ManualBaselineActionKind,
  field: 'pageId' | 'duplicateGroupId' | 'fieldId',
): readonly string[] {
  return actions.flatMap((action) => {
    const value = action.actionKind === actionKind ? action[field] : null
    return value === null ? [] : [value]
  })
}

function appendEvent(
  session: ManualVerificationBaselineSession,
  event: VerificationImpactEvent,
): ManualVerificationBaselineSession {
  const candidate = {
    ...session,
    events: [...session.events, event],
  }
  validateSession(candidate)
  return freezeSession(candidate)
}

function currentActivityState(
  session: ManualVerificationBaselineSession,
): 'active' | 'paused' {
  const activity = [...session.events]
    .reverse()
    .find(
      (event): event is ImpactActivityEvent => event.eventType === 'activity',
    )
  if (activity === undefined) {
    throw new Error('manual baseline activity state is unavailable')
  }
  return activity.state
}

function requireOpenActiveSession(
  session: ManualVerificationBaselineSession,
): void {
  requireOpenSession(session)
  if (currentActivityState(session) !== 'active') {
    throw new Error('manual baseline actions require active time')
  }
}

function requireOpenSession(session: ManualVerificationBaselineSession): void {
  if (session.completedAt !== null) {
    throw new Error('manual baseline session is already completed')
  }
}

function requireTimestampAfterSession(
  session: ManualVerificationBaselineSession,
  timestamp: string,
): void {
  requireTimestamp(timestamp, 'event timestamp')
  const previous = session.events.at(-1)?.recordedAt ?? session.startedAt
  if (Date.parse(timestamp) < Date.parse(previous)) {
    throw new Error('manual baseline events must be chronological')
  }
}

function requireIdentifier(value: string, field: string): void {
  if (value.trim() === '' || value.length > 200) {
    throw new Error(`${field} must be a non-empty bounded identifier`)
  }
}

function requireTimestamp(value: string, field: string): void {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error(`${field} must be an ISO-compatible timestamp`)
  }
}

function freezeSession(
  session: ManualVerificationBaselineSession,
): ManualVerificationBaselineSession {
  return Object.freeze({
    ...session,
    events: Object.freeze(
      session.events.map((event) => Object.freeze({ ...event })),
    ),
  })
}
