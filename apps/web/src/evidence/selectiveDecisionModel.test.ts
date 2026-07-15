import { beforeAll, describe, expect, it } from 'vitest'

import { loadEvidenceFacade, type ReplayEvidence } from '../data/evidenceFacade'
import { createCommittedFixtureFetcher } from '../test/fixtures'
import { buildSelectiveDecisionModel } from './selectiveDecisionModel'

let replay: ReplayEvidence

beforeAll(async () => {
  replay = (
    await loadEvidenceFacade(
      new AbortController().signal,
      createCommittedFixtureFetcher(),
    )
  ).replay
})

describe('buildSelectiveDecisionModel', () => {
  it('keeps every raw signal separate from every absent calibrated output', () => {
    const model = buildSelectiveDecisionModel(replay)

    expect(model.rawEvidence.map(({ label }) => label)).toEqual([
      'Text similarity',
      'Prototype similarity',
      'Nearest support',
      'Top-k support',
      'Visual-input fusion',
      'Geography',
      'Quality',
    ])
    expect(model.decisionEvidence.map(({ label }) => label)).toEqual([
      'Calibrated target probability',
      'Calibrated non-target probability',
      'Threshold',
      'Margin',
      'Margin threshold',
      'Abstention',
      'Policy fingerprint',
    ])
    expect(
      [...model.rawEvidence, ...model.decisionEvidence].every(
        ({ status, value }) => status === 'unavailable' && value === null,
      ),
    ).toBe(true)
    expect(model.rawEvidence.at(0)?.sourceFields).toEqual(['target_raw_text_similarity'])
    expect(model.decisionEvidence.at(6)?.sourceFields).toEqual([
      'decision_policy_fingerprint',
      'threshold_provenance',
    ])
    expect(model.calibrationStatus).toBe('not_run')
    expect(model.abstentionStatus).toBe('not_evaluated')
    expect(model.gateCount).toBe(5)
    expect(model.satisfiedGateCount).toBe(0)
    expect(model.scientificClaimAllowed).toBe(false)
  })
})
