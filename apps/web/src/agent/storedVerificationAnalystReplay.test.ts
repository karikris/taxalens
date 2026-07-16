import { describe, expect, it, vi } from 'vitest'

import { createVerificationAgentEvidenceFixture } from '../test/verificationAgentEvidence'
import storedReplayJson from './fixtures/verificationAnalystStoredReplay.json'
import {
  loadStoredVerificationAnalystReplay,
  StoredVerificationAnalystReplayError,
} from './storedVerificationAnalystReplay'

describe('stored verification analyst replay', () => {
  it('replays the committed GPT-5.6 output through real deterministic tools', async () => {
    const { evidence } = await createVerificationAgentEvidenceFixture()
    const run = await loadStoredVerificationAnalystReplay(evidence)

    expect(run).toMatchObject({
      schemaVersion: 'taxalens-verification-analyst-run:v1.2.0',
      model: 'gpt-5.6-sol',
      toolCallingMode: 'direct',
      programCallCount: 0,
      responseIds: [
        'stored-verification-turn-01',
        'stored-verification-turn-02',
        'stored-verification-turn-03',
        'stored-verification-turn-04',
        'stored-verification-turn-05',
        'stored-verification-turn-06',
      ],
      output: {
        requestKind: 'next_review_action',
        recommendation: {
          action: 'adjudication',
          basis: 'unresolved_review_conflict',
          nextItemIds: ['commons-papilio-demoleus-open-wing'],
        },
        qualityChange: null,
        campaignAnalysis: null,
        externalActionsExecuted: false,
        unsupportedClaimsRejected: true,
        scientificClaimAllowed: false,
      },
    })
    expect(run.toolResults).toHaveLength(5)
    expect(run.toolResults.every(({ artifactCitations }) => artifactCitations.length === 7))
      .toBe(true)
    expect(JSON.stringify(run)).not.toMatch(
      /encrypted_content|privateReasoning|OPENAI_API_KEY/iu,
    )
  })

  it('is credential-free and performs no network, clock, or random operation', async () => {
    const { evidence } = await createVerificationAgentEvidenceFixture()
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const nowSpy = vi.spyOn(Date, 'now')
    const randomSpy = vi.spyOn(Math, 'random')

    const first = await loadStoredVerificationAnalystReplay(evidence)
    const second = await loadStoredVerificationAnalystReplay(evidence)

    expect(second).toEqual(first)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(nowSpy).not.toHaveBeenCalled()
    expect(randomSpy).not.toHaveBeenCalled()

    fetchSpy.mockRestore()
    nowSpy.mockRestore()
    randomSpy.mockRestore()
  })

  it('rejects private fields, changed tool bindings, and changed final actions', async () => {
    const { evidence } = await createVerificationAgentEvidenceFixture()
    const privateReplay = structuredClone(storedReplayJson) as Record<string, unknown>
    privateReplay.privateReasoning = 'must never be accepted'

    const changedCall = structuredClone(storedReplayJson)
    changedCall.responses[0]!.output[0]!.arguments =
      '{"campaign_id":"another-campaign"}'

    const changedOutput = structuredClone(storedReplayJson)
    const parsed = JSON.parse(
      changedOutput.responses.at(-1)!.output_text,
    ) as {
      recommendation: { action: string }
    }
    parsed.recommendation.action = 'unbiased_audit'
    changedOutput.responses.at(-1)!.output_text = JSON.stringify(parsed)

    for (const invalid of [privateReplay, changedCall, changedOutput]) {
      await expect(
        loadStoredVerificationAnalystReplay(evidence, invalid),
      ).rejects.toBeInstanceOf(StoredVerificationAnalystReplayError)
    }
  })
})
