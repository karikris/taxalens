import { beforeAll, describe, expect, it } from 'vitest'

import { loadEvidenceFacade, type ReplayEvidence } from '../data/evidenceFacade'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import { buildWorkflowEfficiencyModel } from './workflowEfficiencyModel'

let replay: ReplayEvidence

beforeAll(async () => {
  replay = (
    await loadEvidenceFacade(
      new AbortController().signal,
      createCommittedFixtureFetcher(),
    )
  ).replay
})

describe('workflow efficiency model', () => {
  it('withholds five counterfactual efficiency claims while preserving diagnostics', () => {
    const model = buildWorkflowEfficiencyModel(replay)

    expect(model.metrics).toHaveLength(6)
    expect(model.measuredMetricCount).toBe(1)
    expect(model.unavailableMetricCount).toBe(5)
    expect(model.metrics.filter(({ status }) => status === 'unavailable')).toHaveLength(5)
    expect(model.metrics.find(({ id }) => id === 'api-calls-avoided')?.diagnostics).toEqual([
      expect.objectContaining({ label: 'Observed requests', value: '314' }),
      expect.objectContaining({ label: 'Retries', value: '0' }),
      expect.objectContaining({ label: 'Rate limits', value: '0' }),
    ])
    expect(
      model.metrics.find(({ id }) => id === 'duplicate-downloads-avoided')?.diagnostics,
    ).toEqual([
      expect.objectContaining({ label: 'Media-candidate rows deduplicated', value: '5' }),
      expect.objectContaining({ label: 'Images downloaded', value: '0' }),
    ])
  })

  it('measures artifact verification and section states without a scientific percentage', () => {
    const model = buildWorkflowEfficiencyModel(replay)
    const completeness = model.metrics.find(({ id }) => id === 'evidence-completeness')

    expect(completeness?.status).toBe('measured')
    expect(completeness?.value).toBe('25 of 25 artifacts verified')
    expect(completeness?.interpretation).toContain('not scientific completeness')
    expect(model.sectionStates).toEqual({ available: 5, partial: 9, unavailable: 6, total: 20 })
    expect(model.provenance.map(({ artifactId }) => artifactId)).toEqual([
      'reference-readiness',
      'duplicate-summaries',
      'run-summary',
    ])
  })
})
