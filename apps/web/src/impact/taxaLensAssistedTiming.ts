import {
  completeVerificationImpactSession,
  pauseVerificationImpactSession,
  recordVerificationImpactAction,
  resumeVerificationImpactSession,
  summarizeVerificationImpactSession,
  TAXALENS_ASSISTED_PROTOCOL_VERSION,
  type ImpactDecisionOutcome,
  type TaxaLensAssistedTimingSession,
  type VerificationImpactSummary,
  validateVerificationImpactSession,
  VERIFICATION_IMPACT_SESSION_SCHEMA_VERSION,
} from './manualVerificationBaseline'

export interface TaxaLensAssistedTimingArtifact {
  readonly schemaVersion: 'taxalens-assisted-timing-artifact:v1.0.0'
  readonly rawSession: TaxaLensAssistedTimingSession
  readonly summary: VerificationImpactSummary
  readonly collection: {
    readonly localOnly: true
    readonly remoteUpload: false
    readonly directParticipantIdentityStored: false
    readonly scriptedRun: boolean
  }
  readonly claims: {
    readonly humanActiveTimeObserved: boolean
    readonly humanProductivityComparisonAllowed: false
    readonly populationSavingsAllowed: false
    readonly scientificQualityMeasured: false
  }
}

export function createTaxaLensAssistedTiming(input: {
  readonly studyId: string
  readonly sessionId: string
  readonly participantIdHash: string
  readonly taskSetId: string
  readonly startedAt: string
  readonly taxalensSha: string
  readonly campaignId: string
}): TaxaLensAssistedTimingSession {
  if (!/^[a-f0-9]{64}$/u.test(input.participantIdHash)) {
    throw new Error('participantIdHash must be a lowercase SHA-256 digest')
  }
  if (!/^[a-f0-9]{40}$/u.test(input.taxalensSha)) {
    throw new Error('taxalensSha must be a lowercase Git SHA')
  }
  for (const [field, value] of Object.entries({
    studyId: input.studyId,
    sessionId: input.sessionId,
    taskSetId: input.taskSetId,
    campaignId: input.campaignId,
  })) {
    if (value.trim() === '' || value.length > 200) {
      throw new Error(`${field} must be a non-empty bounded identifier`)
    }
  }
  if (!Number.isFinite(Date.parse(input.startedAt))) {
    throw new Error('startedAt must be an ISO-compatible timestamp')
  }
  const session: TaxaLensAssistedTimingSession = Object.freeze({
    schemaVersion: VERIFICATION_IMPACT_SESSION_SCHEMA_VERSION,
    protocolVersion: TAXALENS_ASSISTED_PROTOCOL_VERSION,
    workflow: 'taxalens_assisted',
    studyId: input.studyId,
    sessionId: input.sessionId,
    participantIdHash: input.participantIdHash,
    taskSetId: input.taskSetId,
    startedAt: input.startedAt,
    completedAt: null,
    taxalensSha: input.taxalensSha,
    campaignId: input.campaignId,
    events: Object.freeze([
      Object.freeze({
        eventType: 'activity' as const,
        sequence: 1,
        recordedAt: input.startedAt,
        state: 'active' as const,
        reason: 'session_started' as const,
      }),
    ]),
  })
  const failures = validateVerificationImpactSession(session)
  if (failures.length > 0) {
    throw new Error(`Invalid assisted timing session: ${failures.join('; ')}`)
  }
  return session
}

export function recordAssistedPageOpen(
  session: TaxaLensAssistedTimingSession,
  input: {
    readonly actionId: string
    readonly pageId: string
    readonly recordedAt: string
  },
): TaxaLensAssistedTimingSession {
  return recordVerificationImpactAction(session, {
    actionKind: 'page_opened',
    ...input,
  })
}

export function recordAssistedDuplicateInspection(
  session: TaxaLensAssistedTimingSession,
  input: {
    readonly actionId: string
    readonly duplicateGroupId: string
    readonly recordedAt: string
  },
): TaxaLensAssistedTimingSession {
  return recordVerificationImpactAction(session, {
    actionKind: 'duplicate_inspected',
    ...input,
  })
}

export function recordAssistedFieldCompletion(
  session: TaxaLensAssistedTimingSession,
  input: {
    readonly actionId: string
    readonly fieldId: string
    readonly recordedAt: string
  },
): TaxaLensAssistedTimingSession {
  return recordVerificationImpactAction(session, {
    actionKind: 'field_completed',
    ...input,
  })
}

export function recordAssistedDecision(
  session: TaxaLensAssistedTimingSession,
  input: {
    readonly actionId: string
    readonly itemId: string
    readonly outcome: ImpactDecisionOutcome
    readonly recordedAt: string
  },
): TaxaLensAssistedTimingSession {
  return recordVerificationImpactAction(session, {
    actionKind: 'decision_recorded',
    ...input,
  })
}

export function recordAssistedOtherAction(
  session: TaxaLensAssistedTimingSession,
  input: {
    readonly actionId: string
    readonly recordedAt: string
  },
): TaxaLensAssistedTimingSession {
  return recordVerificationImpactAction(session, {
    actionKind: 'other',
    ...input,
  })
}

export function pauseTaxaLensAssistedTiming(
  session: TaxaLensAssistedTimingSession,
  recordedAt: string,
): TaxaLensAssistedTimingSession {
  return pauseVerificationImpactSession(session, recordedAt)
}

export function resumeTaxaLensAssistedTiming(
  session: TaxaLensAssistedTimingSession,
  recordedAt: string,
): TaxaLensAssistedTimingSession {
  return resumeVerificationImpactSession(session, recordedAt)
}

export function completeTaxaLensAssistedTiming(
  session: TaxaLensAssistedTimingSession,
  completedAt: string,
): TaxaLensAssistedTimingSession {
  return completeVerificationImpactSession(session, completedAt)
}

export function createTaxaLensAssistedTimingArtifact(
  session: TaxaLensAssistedTimingSession,
  options: {
    readonly scriptedRun: boolean
  },
): TaxaLensAssistedTimingArtifact {
  const failures = validateVerificationImpactSession(session)
  if (failures.length > 0) {
    throw new Error(`Invalid assisted timing session: ${failures.join('; ')}`)
  }
  if (session.completedAt === null) {
    throw new Error('assisted timing artifact requires a completed session')
  }
  return Object.freeze({
    schemaVersion: 'taxalens-assisted-timing-artifact:v1.0.0',
    rawSession: session,
    summary: summarizeVerificationImpactSession(session),
    collection: Object.freeze({
      localOnly: true,
      remoteUpload: false,
      directParticipantIdentityStored: false,
      scriptedRun: options.scriptedRun,
    }),
    claims: Object.freeze({
      humanActiveTimeObserved: !options.scriptedRun,
      humanProductivityComparisonAllowed: false,
      populationSavingsAllowed: false,
      scientificQualityMeasured: false,
    }),
  })
}
