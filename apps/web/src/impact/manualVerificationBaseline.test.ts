import { describe, expect, it } from 'vitest'

import {
  completeManualVerificationBaseline,
  createManualVerificationBaseline,
  pauseManualVerificationBaseline,
  recordManualBaselineAction,
  resumeManualVerificationBaseline,
  summarizeManualVerificationBaseline,
  validateManualVerificationBaseline,
} from './manualVerificationBaseline'

const PARTICIPANT_HASH = 'a'.repeat(64)

describe('manual verification baseline instrument', () => {
  it('measures active time and every required workflow count', () => {
    let session = createSession()
    session = recordManualBaselineAction(session, {
      actionKind: 'page_opened',
      actionId: 'open-source-sheet',
      pageId: 'source-sheet',
      recordedAt: '2026-07-16T10:00:10.000Z',
    })
    session = recordManualBaselineAction(session, {
      actionKind: 'duplicate_inspected',
      actionId: 'inspect-duplicate-group',
      duplicateGroupId: 'duplicate:one',
      recordedAt: '2026-07-16T10:00:20.000Z',
    })
    session = recordManualBaselineAction(session, {
      actionKind: 'field_completed',
      actionId: 'complete-taxon-field',
      fieldId: 'scientific-name',
      recordedAt: '2026-07-16T10:00:30.000Z',
    })
    session = pauseManualVerificationBaseline(
      session,
      '2026-07-16T10:01:00.000Z',
    )
    session = resumeManualVerificationBaseline(
      session,
      '2026-07-16T10:03:00.000Z',
    )
    session = recordManualBaselineAction(session, {
      actionKind: 'decision_recorded',
      actionId: 'record-decision',
      itemId: 'item:one',
      outcome: 'yes',
      recordedAt: '2026-07-16T10:03:30.000Z',
    })
    session = recordManualBaselineAction(session, {
      actionKind: 'other',
      actionId: 'copy-attribution',
      recordedAt: '2026-07-16T10:03:45.000Z',
    })
    session = completeManualVerificationBaseline(
      session,
      '2026-07-16T10:04:00.000Z',
    )

    expect(validateManualVerificationBaseline(session)).toEqual([])
    expect(summarizeManualVerificationBaseline(session)).toEqual({
      schemaVersion: 'taxalens-verification-impact-summary:v1.0.0',
      workflow: 'manual_baseline',
      studyId: 'verification-impact-pilot',
      sessionId: 'manual-session-001',
      taskSetId: 'control-task-set-v1',
      completed: true,
      activeMilliseconds: 120_000,
      activeMinutes: 2,
      elapsedMilliseconds: 240_000,
      elapsedMinutes: 4,
      actions: 5,
      pagesOpened: 1,
      uniquePagesOpened: 1,
      duplicatesInspected: 1,
      uniqueDuplicatesInspected: 1,
      fieldsCompleted: 1,
      uniqueFieldsCompleted: 1,
      decisions: 1,
      uniqueItemsDecided: 1,
      outcomeCounts: {
        yes: 1,
        no: 0,
        cant_tell: 0,
        cant_view: 0,
        skipped: 0,
      },
    })
  })

  it('keeps raw identity pseudonymous and immutable', () => {
    const session = createSession()
    expect(session).not.toHaveProperty('participantId')
    expect(session.participantIdHash).toBe(PARTICIPANT_HASH)
    expect(Object.isFrozen(session)).toBe(true)
    expect(Object.isFrozen(session.events)).toBe(true)
    expect(Object.isFrozen(session.events[0])).toBe(true)
  })

  it('rejects actions while paused and malformed category fields', () => {
    const paused = pauseManualVerificationBaseline(
      createSession(),
      '2026-07-16T10:00:05.000Z',
    )
    expect(() =>
      recordManualBaselineAction(paused, {
        actionKind: 'other',
        actionId: 'should-not-record',
        recordedAt: '2026-07-16T10:00:06.000Z',
      }),
    ).toThrow('manual baseline actions require active time')
    expect(() =>
      recordManualBaselineAction(createSession(), {
        actionKind: 'decision_recorded',
        actionId: 'missing-outcome',
        itemId: 'item:one',
        recordedAt: '2026-07-16T10:00:06.000Z',
      }),
    ).toThrow('decision_recorded requires outcome')
    expect(() =>
      recordManualBaselineAction(createSession(), {
        actionKind: 'page_opened',
        actionId: 'extra-field',
        pageId: 'source-sheet',
        fieldId: 'not-allowed',
        recordedAt: '2026-07-16T10:00:06.000Z',
      }),
    ).toThrow('page_opened does not allow fieldId')
  })

  it('rejects non-chronological events and mutation after completion', () => {
    expect(() =>
      pauseManualVerificationBaseline(
        createSession(),
        '2026-07-16T09:59:59.000Z',
      ),
    ).toThrow('manual baseline events must be chronological')
    const completed = completeManualVerificationBaseline(
      createSession(),
      '2026-07-16T10:01:00.000Z',
    )
    expect(() =>
      resumeManualVerificationBaseline(
        completed,
        '2026-07-16T10:02:00.000Z',
      ),
    ).toThrow('manual baseline session is already completed')
  })
})

function createSession() {
  return createManualVerificationBaseline({
    studyId: 'verification-impact-pilot',
    sessionId: 'manual-session-001',
    participantIdHash: PARTICIPANT_HASH,
    taskSetId: 'control-task-set-v1',
    startedAt: '2026-07-16T10:00:00.000Z',
  })
}
