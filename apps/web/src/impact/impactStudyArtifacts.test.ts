import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  summarizeVerificationImpactSession,
  type VerificationImpactSession,
  validateVerificationImpactSession,
} from './manualVerificationBaseline'

interface RawStudy {
  readonly measurementKind: string
  readonly sessions: readonly {
    readonly scriptedRun: boolean
    readonly rawSession: VerificationImpactSession
  }[]
  readonly claims: {
    readonly humanParticipants: number
    readonly humanProductivityMeasured: boolean
    readonly humanTimeSavingsAllowed: boolean
  }
}

interface StudySummary {
  readonly sessionSummaries: readonly unknown[]
  readonly measuredResult: {
    readonly metric: string
    readonly manual: number
    readonly assisted: number
    readonly relativeChange: number
  }
  readonly timeSavings: {
    readonly availability: string
  }
  readonly qualityImpact: {
    readonly availability: string
  }
}

const raw = readJson<RawStudy>(
  'demo/source/impact/verification-impact-study.raw.json',
)
const summary = readJson<StudySummary>(
  'demo/source/impact/verification-impact-summary.json',
)

describe('committed verification impact artifacts', () => {
  it('validates and independently summarizes both raw sessions', () => {
    expect(raw.sessions).toHaveLength(2)
    for (const entry of raw.sessions) {
      expect(entry.scriptedRun).toBe(true)
      expect(validateVerificationImpactSession(entry.rawSession)).toEqual([])
    }
    expect(
      raw.sessions.map(({ rawSession }) =>
        summarizeVerificationImpactSession(rawSession),
      ),
    ).toEqual(summary.sessionSummaries)
  })

  it('publishes only the bounded scripted interaction result', () => {
    expect(raw.measurementKind).toBe('scripted_browser_protocol')
    expect(raw.claims).toEqual({
      humanParticipants: 0,
      humanProductivityMeasured: false,
      humanTimeSavingsAllowed: false,
      populationSavingsAllowed: false,
      scientificQualityMeasured: false,
    })
    expect(summary.measuredResult).toMatchObject({
      metric: 'scripted_action_count',
      manual: 20,
      assisted: 10,
      relativeChange: -0.5,
    })
    expect(summary.timeSavings.availability).toBe('unavailable')
    expect(summary.qualityImpact.availability).toBe('unavailable')
  })
})

function readJson<T>(relativePath: string): T {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), '..', '..', relativePath), 'utf8'),
  ) as T
}
