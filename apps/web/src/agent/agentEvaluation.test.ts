import { beforeAll, describe, expect, it, vi } from 'vitest'

import { loadEvidenceFacade, type EvidenceFacade } from '../data/evidenceFacade'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import {
  INITIAL_AGENT_EVALUATION_CASES,
  INITIAL_AGENT_EVALUATION_THRESHOLD,
  runInitialAgentEvaluation,
} from './agentEvaluation'

let facade: EvidenceFacade

beforeAll(async () => {
  facade = await loadEvidenceFacade(
    new AbortController().signal,
    createCommittedFixtureFetcher(),
  )
})

describe('initial research workflow evaluation', () => {
  it('passes the explicit threshold across at least 30 deterministic tool cases', async () => {
    const report = await runInitialAgentEvaluation(facade)

    expect(INITIAL_AGENT_EVALUATION_CASES).toHaveLength(30)
    expect(
      report.cases
        .filter(({ passed }) => !passed)
        .map(({ id, checks }) => ({
          id,
          failedChecks: checks.filter(({ passed }) => !passed).map(({ id }) => id),
        })),
    ).toEqual([])
    expect(report).toMatchObject({
      schemaVersion: 'taxalens-agent-evaluation:v1.1.0',
      scope: 'deterministic_research_workflow',
      threshold: INITIAL_AGENT_EVALUATION_THRESHOLD,
      caseThreshold: 1,
      caseCount: 31,
      passedCaseCount: 31,
      passRate: 1,
      score: 1,
      passed: true,
      deterministic: true,
      liveApiCalls: false,
      modelOutputEvaluated: false,
      scientificEvaluation: false,
    })
    expect(report.cases.every(({ passed }) => passed)).toBe(true)
    expect(report.cases.every(({ checks }) => checks.every(({ passed }) => passed))).toBe(true)
    expect(report.cases.flatMap(({ checks }) => checks)).toHaveLength(247)
    expect(Object.isFrozen(report)).toBe(true)
    expect(Object.isFrozen(report.cases)).toBe(true)
  })

  it('covers every required workflow topic without promoting scientific evaluation', async () => {
    const report = await runInitialAgentEvaluation(facade)
    const topics = new Set(report.cases.map(({ topic }) => topic))

    expect(topics).toEqual(
      new Set([
        'stored_replay',
        'mission_planning',
        'why_found',
        'why_unavailable',
        'why_abstained',
        'strongest_competitor',
        'reference_shortfall',
        'candidate_vs_occurrence',
        'embedding_reuse',
        'no_geo_fallback',
        'unsupported_claim_rejection',
        'scientific_boundary',
        'evidence_export',
        'target_resolution',
        'prototype_reference',
        'prototype_runtime',
        'prototype_policy',
        'prototype_staged',
        'prototype_release',
        'prototype_rights',
      ]),
    )
    expect(report.limitations.join(' ')).toContain('not live Configured model response quality')
    expect(report.limitations.join(' ')).toContain('not a BioMiner Phase 14 scientific evaluation')
    expect(
      report.cases.find(({ id }) => id === 'why-abstained-is-not-evaluated'),
    ).toMatchObject({ observedStatus: 'blocked', passed: true })
    expect(
      report.cases.find(({ id }) => id === 'strongest-competitor-unavailable'),
    ).toMatchObject({ observedStatus: 'partial', passed: true })
    expect(
      report.cases.find(({ id }) => id === 'prototype-release-explicit-mode-only'),
    ).toMatchObject({ observedStatus: 'available', passed: true })
    expect(
      report.cases.find(({ id }) => id === 'prototype-scientific-release-is-no-go'),
    ).toMatchObject({ observedStatus: 'blocked', passed: true })
  })

  it('is repeatable and makes no network, clock, random, or live-model call', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const nowSpy = vi.spyOn(Date, 'now')
    const randomSpy = vi.spyOn(Math, 'random')

    const first = await runInitialAgentEvaluation(facade)
    const second = await runInitialAgentEvaluation(facade)

    expect(second).toEqual(first)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(nowSpy).not.toHaveBeenCalled()
    expect(randomSpy).not.toHaveBeenCalled()

    fetchSpy.mockRestore()
    nowSpy.mockRestore()
    randomSpy.mockRestore()
  })
})
