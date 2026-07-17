import { describe, expect, it } from 'vitest'

import { GEOGRAPHIC_AGENT_EVALUATION_CASES, runGeographicAgentEvaluation } from './geographicAgentEvaluation'

describe('geographic analyst evaluation', () => {
  it('passes at least 20 deterministic safety and grounding cases', () => {
    const report = runGeographicAgentEvaluation()
    expect(GEOGRAPHIC_AGENT_EVALUATION_CASES.length).toBeGreaterThanOrEqual(20)
    expect(report).toMatchObject({ passed: true, passRate: 1, liveOpenAiCallExecuted: false })
  })

  it('covers every required geographic safety topic', () => {
    const topics = new Set(GEOGRAPHIC_AGENT_EVALUATION_CASES.map(({ topic }) => topic))
    for (const topic of ['provider double counting', 'candidate versus reviewed', 'data deficiency', 'unavailable direct iNaturalist delta', 'no-geo', 'range-edge candidate', 'invalid quality sample', 'release blocked', 'no model-memory calculation']) {
      expect(topics.has(topic), topic).toBe(true)
    }
  })
})
