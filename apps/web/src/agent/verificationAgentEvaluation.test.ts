import { describe, expect, it, vi } from 'vitest'

import {
  runVerificationAgentEvaluation,
  VERIFICATION_AGENT_EVALUATION_CASES,
  VERIFICATION_AGENT_EVALUATION_THRESHOLD,
} from './verificationAgentEvaluation'

describe('verification analyst evaluation', () => {
  it('passes at least 20 verification-specific deterministic cases', async () => {
    const report = await runVerificationAgentEvaluation()

    expect(VERIFICATION_AGENT_EVALUATION_CASES).toHaveLength(28)
    expect(VERIFICATION_AGENT_EVALUATION_CASES.length).toBeGreaterThanOrEqual(20)
    expect(
      report.cases
        .filter(({ passed }) => !passed)
        .map(({ id, checks }) => ({
          id,
          failedChecks: checks
            .filter(({ passed }) => !passed)
            .map(({ id: checkId }) => checkId),
        })),
    ).toEqual([])
    expect(report).toMatchObject({
      schemaVersion: 'taxalens-verification-agent-evaluation:v1.0.0',
      scope: 'deterministic_verification_workflow',
      threshold: VERIFICATION_AGENT_EVALUATION_THRESHOLD,
      caseThreshold: 1,
      caseCount: 28,
      passedCaseCount: 28,
      passRate: 1,
      score: 1,
      passed: true,
      deterministic: true,
      liveApiCalls: false,
      modelOutputEvaluated: false,
      storedReplayEvaluated: true,
      scientificEvaluation: false,
    })
    expect(report.cases.every(({ passed }) => passed)).toBe(true)
    expect(Object.isFrozen(report)).toBe(true)
    expect(Object.isFrozen(report.cases)).toBe(true)
  })

  it('covers every required verification analyst risk', async () => {
    const report = await runVerificationAgentEvaluation()
    const ids = new Set(report.cases.map(({ id }) => id))

    for (const requiredId of [
      'valid-quality-explanation',
      'invalid-guarantee-rejection',
      'representative-sample',
      'active-learning-distinction',
      'unresolved-conflict-action',
      'missing-interval',
      'missing-image-evidence',
      'reference-shortfall',
      'reviewer-disagreement-retained',
      'no-taxon-guessing',
      'unsupported-release-rejection',
    ]) {
      expect(ids.has(requiredId)).toBe(true)
    }
    expect(report.limitations.join(' ')).toContain(
      'does not score live Configured model response quality',
    )
    expect(report.limitations.join(' ')).toContain(
      'not a BioMiner Phase 14 scientific evaluation',
    )
  })

  it('makes no network, clock, random, or live-model call in default CI', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const nowSpy = vi.spyOn(Date, 'now')
    const randomSpy = vi.spyOn(Math, 'random')

    const first = await runVerificationAgentEvaluation()
    const second = await runVerificationAgentEvaluation()

    expect(second).toEqual(first)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(nowSpy).not.toHaveBeenCalled()
    expect(randomSpy).not.toHaveBeenCalled()

    fetchSpy.mockRestore()
    nowSpy.mockRestore()
    randomSpy.mockRestore()
  })
})
