import { describe, expect, it } from 'vitest'

import {
  completeTaxaLensAssistedTiming,
  createTaxaLensAssistedTiming,
  createTaxaLensAssistedTimingArtifact,
  pauseTaxaLensAssistedTiming,
  recordAssistedDecision,
  recordAssistedDuplicateInspection,
  recordAssistedFieldCompletion,
  recordAssistedOtherAction,
  recordAssistedPageOpen,
  resumeTaxaLensAssistedTiming,
} from './taxaLensAssistedTiming'

const PARTICIPANT_HASH = 'b'.repeat(64)
const TAXALENS_SHA = '53f1b52677351ea26282fb2f2c5fc16c0a1bc62a'

describe('TaxaLens-assisted verification timing', () => {
  it('captures the same burden measures with build and campaign context', () => {
    let session = createSession()
    session = recordAssistedPageOpen(session, {
      actionId: 'open-verification',
      pageId: 'verification/reference-images',
      recordedAt: '2026-07-16T11:00:05.000Z',
    })
    session = recordAssistedDuplicateInspection(session, {
      actionId: 'inspect-duplicate',
      duplicateGroupId: 'sha256:duplicate-one',
      recordedAt: '2026-07-16T11:00:10.000Z',
    })
    session = recordAssistedFieldCompletion(session, {
      actionId: 'complete-comment',
      fieldId: 'optional-comment',
      recordedAt: '2026-07-16T11:00:20.000Z',
    })
    session = recordAssistedDecision(session, {
      actionId: 'record-yes',
      itemId: 'reviewer-control:known-target',
      outcome: 'yes',
      recordedAt: '2026-07-16T11:00:30.000Z',
    })
    session = recordAssistedOtherAction(session, {
      actionId: 'export-receipt',
      recordedAt: '2026-07-16T11:00:40.000Z',
    })
    session = pauseTaxaLensAssistedTiming(
      session,
      '2026-07-16T11:00:45.000Z',
    )
    session = resumeTaxaLensAssistedTiming(
      session,
      '2026-07-16T11:01:15.000Z',
    )
    session = completeTaxaLensAssistedTiming(
      session,
      '2026-07-16T11:01:30.000Z',
    )

    const artifact = createTaxaLensAssistedTimingArtifact(session, {
      scriptedRun: false,
    })
    expect(artifact.rawSession).toMatchObject({
      workflow: 'taxalens_assisted',
      protocolVersion: 'taxalens-assisted-verification-timing:v1.0.0',
      taxalensSha: TAXALENS_SHA,
      campaignId: 'reviewer-controls-test',
    })
    expect(artifact.summary).toMatchObject({
      workflow: 'taxalens_assisted',
      protocolVersion: 'taxalens-assisted-verification-timing:v1.0.0',
      activeMilliseconds: 60_000,
      activeMinutes: 1,
      elapsedMilliseconds: 90_000,
      elapsedMinutes: 1.5,
      actions: 5,
      pagesOpened: 1,
      duplicatesInspected: 1,
      fieldsCompleted: 1,
      decisions: 1,
      outcomeCounts: {
        yes: 1,
        no: 0,
        cant_tell: 0,
        cant_view: 0,
        skipped: 0,
      },
    })
    expect(artifact.collection).toEqual({
      localOnly: true,
      remoteUpload: false,
      directParticipantIdentityStored: false,
      scriptedRun: false,
    })
    expect(artifact.claims).toEqual({
      humanActiveTimeObserved: true,
      humanProductivityComparisonAllowed: false,
      populationSavingsAllowed: false,
      scientificQualityMeasured: false,
    })
  })

  it('labels scripted runs so they cannot masquerade as human productivity', () => {
    const session = completeTaxaLensAssistedTiming(
      createSession(),
      '2026-07-16T11:00:30.000Z',
    )
    expect(
      createTaxaLensAssistedTimingArtifact(session, {
        scriptedRun: true,
      }).claims,
    ).toEqual({
      humanActiveTimeObserved: false,
      humanProductivityComparisonAllowed: false,
      populationSavingsAllowed: false,
      scientificQualityMeasured: false,
    })
  })

  it('requires exact Git, campaign, participant, and completion context', () => {
    expect(() =>
      createTaxaLensAssistedTiming({
        studyId: 'verification-impact-pilot',
        sessionId: 'assisted-session-001',
        participantIdHash: PARTICIPANT_HASH,
        taskSetId: 'control-task-set-v1',
        startedAt: '2026-07-16T11:00:00.000Z',
        taxalensSha: 'not-a-git-sha',
        campaignId: 'reviewer-controls-test',
      }),
    ).toThrow('taxalensSha must be a lowercase Git SHA')
    expect(() =>
      createTaxaLensAssistedTimingArtifact(createSession(), {
        scriptedRun: false,
      }),
    ).toThrow('assisted timing artifact requires a completed session')
  })
})

function createSession() {
  return createTaxaLensAssistedTiming({
    studyId: 'verification-impact-pilot',
    sessionId: 'assisted-session-001',
    participantIdHash: PARTICIPANT_HASH,
    taskSetId: 'control-task-set-v1',
    startedAt: '2026-07-16T11:00:00.000Z',
    taxalensSha: TAXALENS_SHA,
    campaignId: 'reviewer-controls-test',
  })
}
